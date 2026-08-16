const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const firestorePath = path.resolve(__dirname, '../src/config/firestore.js');

const makeFakes = (initialDocuments = []) => {
  const documents = new Map(initialDocuments.map(({ path: documentPath, data }) => [documentPath, data]));
  const snapshotListeners = new Map();
  let transactionFailure = null;
  const doc = (_db, ...segments) => ({ path: segments.join('/'), kind: 'doc' });
  const collection = (_db, ...segments) => ({ path: segments.join('/'), kind: 'collection' });
  const snapshotFor = (reference) => ({
    exists: () => documents.has(reference.path),
    data: () => documents.get(reference.path),
    id: reference.path.split('/').at(-1),
    ref: reference,
  });
  const collectionSnapshotFor = (reference) => {
    const prefix = `${reference.path}/`;
    const docs = [...documents.entries()]
      .filter(([documentPath]) => {
        if (!documentPath.startsWith(prefix)) return false;
        return !documentPath.slice(prefix.length).includes('/');
      })
      .map(([documentPath]) => snapshotFor({ path: documentPath, kind: 'doc' }));
    return { docs, empty: docs.length === 0, metadata: {} };
  };
  const runTransaction = async (_db, operation) => {
    if (transactionFailure) throw transactionFailure;
    const staged = [];
    const transaction = {
      async get(reference) {
        return snapshotFor(reference);
      },
      set(reference, value, options) {
        staged.push({ reference, value, options });
      },
    };
    const result = await operation(transaction);
    staged.forEach(({ reference, value, options }) => {
      if (options?.merge && documents.has(reference.path)) {
        documents.set(reference.path, { ...documents.get(reference.path), ...value });
      } else {
        documents.set(reference.path, value);
      }
    });
    return result;
  };

  return {
    documents,
    emitDocument(documentPath, data, metadata = {}) {
      if (data === undefined) documents.delete(documentPath);
      else documents.set(documentPath, data);
      const key = `doc:${documentPath}`;
      (snapshotListeners.get(key) || []).forEach(({ next }) => next({
        ...snapshotFor({ path: documentPath, kind: 'doc' }),
        metadata: {
          fromCache: false,
          hasPendingWrites: false,
          ...metadata,
        },
      }));
    },
    emitCollection(collectionPath, items, metadata = {}) {
      const key = `collection:${collectionPath}`;
      const docs = items.map(({ id, data }) => ({
        id,
        ref: { path: `${collectionPath}/${id}`, kind: 'doc' },
        data: () => data,
      }));
      (snapshotListeners.get(key) || []).forEach(({ next }) => next({
        docs,
        empty: docs.length === 0,
        metadata: {
          fromCache: false,
          hasPendingWrites: false,
          ...metadata,
        },
      }));
    },
    setTransactionFailure(error) {
      transactionFailure = error;
    },
    api: {
      collection,
      doc,
      getDoc: async (reference) => snapshotFor(reference),
      getDocFromServer: async (reference) => snapshotFor(reference),
      getDocs: async (reference) => collectionSnapshotFor(reference),
      getDocsFromServer: async (reference) => collectionSnapshotFor(reference),
      onSnapshot: (reference, ...args) => {
        const callbacks = args.filter((argument) => typeof argument === 'function');
        const listener = { next: callbacks[0], error: callbacks[1] };
        const key = `${reference.kind}:${reference.path}`;
        const listeners = snapshotListeners.get(key) || [];
        listeners.push(listener);
        snapshotListeners.set(key, listeners);
        return () => {
          snapshotListeners.set(
            key,
            (snapshotListeners.get(key) || []).filter((item) => item !== listener),
          );
        };
      },
      query: (reference) => reference,
      runTransaction,
      serverTimestamp: () => ({ __serverTimestamp: true }),
      setDoc: async (reference, value) => documents.set(reference.path, value),
      waitForPendingWrites: async () => {},
      where: () => ({}),
      writeBatch: () => ({
        delete() {},
        set() {},
        async commit() {},
      }),
    },
  };
};

const loadFirestore = (fakes) => {
  const source = fs.readFileSync(firestorePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: firestorePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(firestorePath, module);
  testModule.filename = firestorePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(firestorePath));

  const mocks = new Map([
    ['firebase/firestore', fakes.api],
    ['./firebase', { db: { name: 'test-db' } }],
    ['./createDefaultData', { __esModule: true, default: () => ({ global: {}, schedules: [] }) }],
    ['../services/accountDeletionService', { deleteAllUserCloudData: async () => ({}) }],
    ['../utils/analytics/crashlytics', { logCrashlyticsError: () => {} }],
    ['../utils/deviceService', { getDeviceId: async () => 'device-1' }],
    ['../utils/scheduleDataFingerprint', { getScheduleDataFingerprint: JSON.stringify }],
  ]);
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => (
    mocks.has(request) ? mocks.get(request) : originalRequire(request)
  );
  testModule._compile(transformed, firestorePath);
  return testModule.exports;
};

const flushAsyncWork = async (turns = 3) => {
  for (let index = 0; index < turns; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

test('an open third device applies realtime snapshots in server order', async () => {
  const fakes = makeFakes();
  const firestore = loadFirestore(fakes);
  const events = [];
  let releaseVersion11;
  const version11Gate = new Promise((resolve) => {
    releaseVersion11 = resolve;
  });

  const unsubscribe = firestore.subscribeToSchedule('user-live', async (payload) => {
    const version = payload.schedules[0]?.version || 0;
    events.push(`start:${version}`);
    if (version === 11) await version11Gate;
    events.push(`end:${version}`);
  });

  fakes.emitDocument('users/user-live/global/settings', {
    version: 1,
    lastModified: 10,
  });
  fakes.emitCollection('users/user-live/schedules', [{
    id: 'main',
    data: { version: 11, lastModified: 110, name: 'First winner' },
  }]);
  await flushAsyncWork();

  fakes.emitCollection('users/user-live/schedules', [{
    id: 'main',
    data: { version: 12, lastModified: 120, name: 'Conflict choice' },
  }]);
  await flushAsyncWork();
  assert.deepEqual(events, ['start:11']);

  releaseVersion11();
  await flushAsyncWork(5);
  assert.deepEqual(events, [
    'start:11',
    'end:11',
    'start:12',
    'end:12',
  ]);
  unsubscribe();
});

test('server acknowledgement is delivered after a pending snapshot with identical data', async () => {
  const fakes = makeFakes();
  const firestore = loadFirestore(fakes);
  const deliveries = [];
  const unsubscribe = firestore.subscribeToSchedule('user-pending', async (_payload, _cache, metadata) => {
    deliveries.push(metadata);
  });

  fakes.emitDocument('users/user-pending/global/settings', {
    version: 1,
    lastModified: 10,
  });
  const items = [{
    id: 'main',
    data: { version: 12, lastModified: 120, name: 'Resolved' },
  }];
  fakes.emitCollection(
    'users/user-pending/schedules',
    items,
    { hasPendingWrites: true },
  );
  await flushAsyncWork();
  fakes.emitCollection(
    'users/user-pending/schedules',
    items,
    { hasPendingWrites: false },
  );
  await flushAsyncWork();

  assert.equal(deliveries.length, 2);
  assert.equal(deliveries[0].hasPendingWrites, true);
  assert.equal(deliveries[1].hasPendingWrites, false);
  assert.equal(deliveries[1].hasDataChanged, false);
  assert.equal(deliveries[1].pendingStateChanged, true);
  unsubscribe();
});

test('transaction increments the authoritative version and acknowledges only after commit', async () => {
  const fakes = makeFakes([{
    path: 'users/user-1/schedules/schedule-1',
    data: { version: 3, lastModified: 100 },
  }]);
  const firestore = loadFirestore(fakes);
  const result = await firestore.saveSchedule('user-1', {
    schedules: [{
      id: 'schedule-1',
      name: 'Offline edit',
      subjects: [{ id: 'math', name: 'Mathematics', note: undefined }],
      schedule: [{ week1: [{ subjectId: 'math' }] }],
      version: 3,
      baseVersion: 3,
      lastModified: 150,
      lastSynced: 100,
    }],
  }, true);

  assert.equal(result.schedules[0].version, 4);
  assert.equal(result.schedules[0].baseVersion, 4);
  assert.equal(result.schedules[0].lastSynced, result.committedAt);
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1').name, 'Offline edit');
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1').version, 4);
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1').id, undefined);
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1').baseVersion, undefined);
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1').lastSynced, undefined);
  assert.equal(fakes.documents.get('users/user-1/schedules/schedule-1')._p, undefined);
  assert.deepEqual(
    fakes.documents.get('users/user-1/schedules/schedule-1').subjects,
    [{ id: 'math', name: 'Mathematics' }],
  );
  assert.equal(
    fakes.documents.get('users/user-1/schedules/schedule-1').schedule[0].week1[0].subjectId,
    'math',
  );
});

test('stale device cannot overwrite a newer cloud version', async () => {
  const fakes = makeFakes([{
    path: 'users/user-2/schedules/schedule-1',
    data: { version: 5, lastModified: 200, name: 'New cloud value' },
  }]);
  const firestore = loadFirestore(fakes);

  await assert.rejects(
    () => firestore.saveSchedule('user-2', {
      schedules: [{
        id: 'schedule-1',
        name: 'Stale offline value',
        version: 4,
        baseVersion: 4,
        lastModified: 300,
        lastSynced: 100,
      }],
    }, true),
    (error) => error.code === 'sync/conflict',
  );
  assert.equal(
    fakes.documents.get('users/user-2/schedules/schedule-1').name,
    'New cloud value',
  );
});

test('missing cloud document is a conflict for a previously synced active schedule', async () => {
  const fakes = makeFakes();
  const firestore = loadFirestore(fakes);
  await assert.rejects(
    () => firestore.saveSchedule('user-3', {
      schedules: [{
        id: 'schedule-1',
        name: 'Returning device copy',
        version: 3,
        baseVersion: 3,
        lastModified: 200,
        lastSynced: 100,
      }],
    }, true),
    (error) => error.code === 'sync/conflict',
  );
  assert.equal(fakes.documents.has('users/user-3/schedules/schedule-1'), false);
});

test('never-synced schedule can be safely created without overwriting another id', async () => {
  const fakes = makeFakes();
  const firestore = loadFirestore(fakes);
  const result = await firestore.saveSchedule('user-4', {
    schedules: [{
      id: 'new-id',
      name: 'New offline schedule',
      version: 0,
      baseVersion: 0,
      lastModified: 20,
      lastSynced: 0,
    }],
  }, true);
  assert.equal(result.schedules[0].version, 1);
  assert.equal(fakes.documents.get('users/user-4/schedules/new-id').version, 1);
});

test('compressed cloud documents are rejected instead of migrated', async () => {
  const fakes = makeFakes([{
    path: 'users/user-legacy/schedules/legacy-id',
    data: { _c: 'planit.lz.v1', _p: 'old-payload', version: 1, lastModified: 10 },
  }]);
  const firestore = loadFirestore(fakes);
  await assert.rejects(
    () => firestore.saveSchedule('user-legacy', {
      schedules: [{
        id: 'legacy-id',
        name: 'No automatic migration',
        version: 1,
        baseVersion: 1,
        lastModified: 20,
        lastSynced: 10,
      }],
    }, true),
    (error) => error.code === 'sync/unsupported-cloud-schema',
  );
  assert.equal(fakes.documents.get('users/user-legacy/schedules/legacy-id')._p, 'old-payload');
});

test('a conflict in one schedule does not block a different schedule document', async () => {
  const fakes = makeFakes([
    {
      path: 'users/user-independent/schedules/a',
      data: { version: 5, lastModified: 500, name: 'Newer A' },
    },
    {
      path: 'users/user-independent/schedules/b',
      data: { version: 2, lastModified: 200, name: 'Old B' },
    },
  ]);
  const firestore = loadFirestore(fakes);

  await assert.rejects(
    () => firestore.saveSchedule('user-independent', {
      schedules: [
        { id: 'a', name: 'Stale A', version: 4, baseVersion: 4, lastModified: 600, lastSynced: 400 },
        { id: 'b', name: 'Updated B', version: 2, baseVersion: 2, lastModified: 300, lastSynced: 200 },
      ],
    }, true),
    (error) => {
      assert.equal(error.code, 'sync/conflict');
      assert.equal(error.committed.schedules.length, 1);
      assert.equal(error.committed.schedules[0].id, 'b');
      return true;
    },
  );

  assert.equal(fakes.documents.get('users/user-independent/schedules/a').name, 'Newer A');
  assert.equal(fakes.documents.get('users/user-independent/schedules/b').name, 'Updated B');
  assert.equal(fakes.documents.get('users/user-independent/schedules/b').version, 3);
});

test('a global settings conflict does not block an independent schedule save', async () => {
  const fakes = makeFakes([
    {
      path: 'users/user-global-independent/global/settings',
      data: { version: 4, lastModified: 400, language: 'uk' },
    },
    {
      path: 'users/user-global-independent/schedules/main',
      data: { version: 1, lastModified: 100, name: 'Before' },
    },
  ]);
  const firestore = loadFirestore(fakes);

  await assert.rejects(
    () => firestore.saveSchedule('user-global-independent', {
      global: { version: 3, baseVersion: 3, lastModified: 500, lastSynced: 300, language: 'en' },
      schedules: [{ id: 'main', version: 1, baseVersion: 1, lastModified: 200, lastSynced: 100, name: 'After' }],
    }, true),
    (error) => {
      assert.equal(error.code, 'sync/conflict');
      assert.equal(error.committed.global, null);
      assert.equal(error.committed.schedules[0].id, 'main');
      return true;
    },
  );

  assert.equal(fakes.documents.get('users/user-global-independent/global/settings').language, 'uk');
  assert.equal(fakes.documents.get('users/user-global-independent/schedules/main').name, 'After');
});

test('network and permission errors are rethrown instead of reported as success', async () => {
  const fakes = makeFakes();
  const networkError = new Error('permission denied');
  networkError.code = 'permission-denied';
  fakes.setTransactionFailure(networkError);
  const firestore = loadFirestore(fakes);
  await assert.rejects(
    () => firestore.saveSchedule('user-5', {
      schedules: [{ id: 'new-id', version: 0, baseVersion: 0, lastModified: 1, lastSynced: 0 }],
    }, true),
    (error) => error.code === 'permission-denied',
  );
});

test('account reset uses authoritative cloud versions and returns a fully deleted snapshot', async () => {
  const fakes = makeFakes([
    {
      path: 'users/user-reset/global/settings',
      data: {
        version: 4,
        lastModified: 400,
        currentScheduleId: 'main',
        language: 'uk',
      },
    },
    {
      path: 'users/user-reset/schedules/main',
      data: { version: 9, lastModified: 900, name: 'Newest cloud copy' },
    },
    {
      path: 'users/user-reset/schedules/already-deleted',
      data: {
        version: 3,
        lastModified: 300,
        deletedAt: 300,
        isDeleted: true,
      },
    },
  ]);
  const firestore = loadFirestore(fakes);

  const result = await firestore.resetUserSchedules('user-reset');

  assert.equal(result.global.currentScheduleId, null);
  assert.equal(result.global.language, 'uk');
  assert.equal(result.global.version, 5);
  assert.equal(result.schedules.length, 2);
  assert.equal(result.schedules.every((schedule) => schedule.isDeleted), true);
  assert.equal(result.schedules.find((schedule) => schedule.id === 'main').version, 10);
  assert.equal(
    fakes.documents.get('users/user-reset/schedules/main').isDeleted,
    true,
  );
  assert.equal(
    fakes.documents.get('users/user-reset/schedules/already-deleted').version,
    3,
  );
});

test('tombstones survive the minimum retention window even when every device is ahead', () => {
  const firestore = loadFirestore(makeFakes());
  const day = 24 * 60 * 60 * 1000;
  const now = 200 * day;
  assert.equal(firestore.isTombstoneSafeToDelete({
    isDeleted: true,
    deletedAt: now - day,
  }, now, now), false);
});

test('old tombstones are deleted only after the conservative device watermark', () => {
  const firestore = loadFirestore(makeFakes());
  const day = 24 * 60 * 60 * 1000;
  const now = 200 * day;
  const deletedAt = now - 100 * day;
  assert.equal(firestore.isTombstoneSafeToDelete({
    isDeleted: true,
    deletedAt,
  }, deletedAt - 1, now), false);
  assert.equal(firestore.isTombstoneSafeToDelete({
    isDeleted: true,
    deletedAt,
  }, deletedAt + 10 * 60 * 1000, now), true);
});

test('security rules do not leave a broad user-subtree write bypass', () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
  assert.doesNotMatch(rules, /match \/users\/\{userId\}\/\{document=\*\*\}/);
  assert.match(rules, /request\.resource\.data\.version == resource\.data\.version \+ 1/);
  assert.match(rules, /match \/users\/\{userId\}\/schedules\/\{scheduleId\}/);
  assert.doesNotMatch(rules, /planit\.lz\.v1/);
  assert.doesNotMatch(rules, /isLegacyEncodingMigration/);
});
