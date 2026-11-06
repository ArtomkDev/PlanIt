const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, before, beforeEach, after } = require('node:test');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } = require('firebase/firestore');
const { ref, uploadBytes, getBytes, deleteObject } = require('firebase/storage');

let environment;
const context = (uid = 'owner', verified = true, authAge = 0) => environment.authenticatedContext(uid, {
  email_verified: verified,
  auth_time: Math.floor(Date.now() / 1000) - authAge,
});
const scheduleRef = db => doc(db, 'users/owner/schedules/schedule');
const schedule = (version = 1) => ({ name: 'Private timetable', version, lastModified: Date.now(), subjects: [], schedule: [] });

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'Run npm run test:rules to start isolated emulators.');
  environment = await initializeTestEnvironment({
    projectId: 'demo-planit-release',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.resolve(__dirname, '../storage.rules'), 'utf8') },
  });
});
beforeEach(async () => { await environment.clearFirestore(); await environment.clearStorage(); });
after(async () => { await environment?.cleanup(); });

test('only the verified owner can read and write private schedules', async () => {
  const owner = context().firestore();
  await assertSucceeds(setDoc(scheduleRef(owner), schedule()));
  for (const other of [context('other').firestore(), context('owner', false).firestore(), environment.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(scheduleRef(other)));
    await assertFails(setDoc(scheduleRef(other), schedule(2)));
  }
  assert.equal((await getDoc(scheduleRef(owner))).data().name, 'Private timetable');
});

test('a stale schedule version cannot overwrite the committed cloud draft', async () => {
  const db = context().firestore();
  await setDoc(scheduleRef(db), schedule());
  await assertSucceeds(updateDoc(scheduleRef(db), { version: 2, name: 'Committed update' }));
  await assertFails(setDoc(scheduleRef(db), { ...schedule(2), name: 'Stale overwrite' }));
  assert.equal((await getDoc(scheduleRef(db))).data().name, 'Committed update');
  await assertFails(updateDoc(scheduleRef(db), { version: 4 }));
});

test('widget push metadata stays private and cannot revive a revoked installation', async () => {
  const db = context().firestore();
  const location = 'users/owner/devices/installation_1234567890';
  const now = Timestamp.now();
  const registration = {
    status: 'active', name: 'Phone', platform: 'android', brand: 'Brand', model: 'Model',
    createdAt: now, lastLogin: now, lastSeenAt: now,
    widgetPushToken: 'native-fcm-token', widgetScheduleId: 'schedule',
  };
  await assertSucceeds(setDoc(doc(db, location), registration));
  const other = context('other').firestore();
  await assertFails(getDoc(doc(other, location)));
  await assertFails(updateDoc(doc(other, location), { widgetPushToken: 'stolen' }));
  await assertFails(updateDoc(doc(db, location), { widgetPushToken: 'x'.repeat(4097) }));
  await assertSucceeds(updateDoc(doc(db, location), { status: 'revoked', revokedAt: now, revokedReason: 'user' }));
  await assertFails(updateDoc(doc(db, location), { widgetPushToken: 'replacement' }));
});

test('file metadata and deferred deletion intent commit together and reject stale overwrites', async () => {
  const owner = context();
  const settings = doc(owner.firestore(), 'users/owner/global/settings');
  const storagePath = 'users/owner/attachments/file/generation/document.pdf';
  await assertSucceeds(uploadBytes(ref(owner.storage(), storagePath), new Uint8Array([1]), { contentType: 'application/pdf' }));
  await setDoc(settings, { version: 1, lastModified: 1, fileLibrary: [{ id: 'file', storagePath }] });
  await assertSucceeds(updateDoc(settings, {
    version: 2, lastModified: 2, fileLibrary: [], attachmentDeletionQueue: [{ storagePath }],
  }));
  await assertFails(updateDoc(settings, { version: 2, attachmentDeletionQueue: [] }));
  assert.deepEqual((await getDoc(settings)).data().attachmentDeletionQueue, [{ storagePath }]);
  await assertFails(getDoc(doc(context('other').firestore(), settings.path)));
  await assertSucceeds(deleteObject(ref(owner.storage(), storagePath)));
  await assertSucceeds(updateDoc(settings, { version: 3, lastModified: 3, attachmentDeletionQueue: [] }));
});

test('account deletion blocks new writes while allowing the owner to complete cleanup', async () => {
  const owner = context();
  const db = owner.firestore();
  await setDoc(scheduleRef(db), schedule());
  const file = ref(owner.storage(), 'users/owner/attachments/file/document.pdf');
  await uploadBytes(file, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' });
  await assertSucceeds(setDoc(doc(db, 'deleted_accounts/owner'), { requestedAt: serverTimestamp() }));
  await assertFails(setDoc(scheduleRef(db), schedule(2)));
  await assertFails(uploadBytes(file, new Uint8Array([4]), { contentType: 'application/pdf' }));
  await assertFails(deleteDoc(doc(db, 'deleted_accounts/owner')));
  const deleting = context('owner', false);
  await assertSucceeds(deleteDoc(scheduleRef(deleting.firestore())));
  await assertSucceeds(deleteObject(ref(deleting.storage(), file.fullPath)));
});

test('a stale authentication session cannot start irreversible account deletion', async () => {
  await assertFails(setDoc(doc(context('owner', true, 600).firestore(), 'deleted_accounts/owner'), { requestedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(context('other').firestore(), 'deleted_accounts/owner'), { requestedAt: serverTimestamp() }));
});

test('attachment bytes are private and unsupported uploads are rejected', async () => {
  const owner = context().storage();
  const location = 'users/owner/attachments/file/document.pdf';
  await assertSucceeds(uploadBytes(ref(owner, location), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await assertSucceeds(getBytes(ref(owner, location)));
  for (const other of [context('other').storage(), environment.unauthenticatedContext().storage()]) {
    await assertFails(getBytes(ref(other, location)));
    await assertFails(deleteObject(ref(other, location)));
    await assertFails(uploadBytes(ref(other, location), new Uint8Array([1]), { contentType: 'application/pdf' }));
  }
  await assertFails(uploadBytes(ref(owner, 'users/owner/attachments/file/program.exe'), new Uint8Array([1]), { contentType: 'application/x-msdownload' }));
});

test('public shares are immutable, expire, and cannot reveal another owner share list', async () => {
  const db = context().firestore();
  const share = {
    id: 'PUBLICSHARE123456', ownerId: 'owner', ownerName: 'Owner', scheduleName: 'Public schedule',
    scheduleData: { name: 'Public schedule', repeat: 1, duration: 45, start_time: '08:00', subjects: [], schedule: [] },
    createdAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000), isActive: true,
  };
  const location = `shared_schedules/${share.id}`;
  await assertSucceeds(setDoc(doc(db, location), share));
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, location)));
  await assertFails(updateDoc(doc(db, location), { scheduleName: 'Replaced share' }));
  await assertFails(getDocs(collection(anonymous, 'shared_schedules')));
  await assertFails(getDocs(query(collection(anonymous, 'shared_schedules'), where('ownerId', '==', 'owner'))));
  await assertFails(setDoc(doc(anonymous, 'shared_schedules/ANONYMOUS1234567'), { ...share, id: 'ANONYMOUS1234567' }));
  await assertFails(updateDoc(doc(anonymous, location), { scheduleName: 'Changed by visitor' }));
  await assertFails(deleteDoc(doc(anonymous, location)));
  await assertSucceeds(getDocs(query(collection(db, 'shared_schedules'), where('ownerId', '==', 'owner'))));
  await environment.withSecurityRulesDisabled(async admin => {
    await updateDoc(doc(admin.firestore(), location), { expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  });
  await assertFails(getDoc(doc(anonymous, location)));
  await assertSucceeds(getDoc(doc(db, location)));
  await assertFails(getDoc(doc(context('other').firestore(), location)));
  await environment.withSecurityRulesDisabled(async admin => {
    await updateDoc(doc(admin.firestore(), location), { expiresAt: Timestamp.fromMillis(Date.now() + 86400000), isActive: false });
  });
  await assertFails(getDoc(doc(anonymous, location)));
  await assertSucceeds(getDoc(doc(db, location)));
  await assertSucceeds(deleteDoc(doc(db, location)));
});
