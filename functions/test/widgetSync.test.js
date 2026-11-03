import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/widgetSync.js', import.meta.url), 'utf8');

const loadTrigger = ({ devices = [], responses, deleting = false, rotateToken = false } = {}) => {
  let handler, options;
  const sent = [];
  const cleared = [];
  const snapshots = devices.map((device, index) => ({
    ref: `device-${index}`, data: () => device,
  }));
  const db = {
    doc: path => ({ get: async () => {
      assert.equal(path, 'deleted_accounts/user-1');
      return { exists: deleting };
    } }),
    collection: path => ({ where: (field, operator, value) => ({ get: async () => {
      assert.equal(path, 'users/user-1/devices');
      assert.deepEqual([field, operator, value], ['status', '==', 'active']);
      return { docs: snapshots.filter(snapshot => snapshot.data().status === 'active') };
    } }) }),
    runTransaction: async callback => callback({
      get: async ref => ({ data: () => rotateToken ? { widgetPushToken: 'rotated' }
        : snapshots.find(snapshot => snapshot.ref === ref)?.data() }),
      update: (ref, patch) => cleared.push([ref, patch]),
    }),
  };
  const context = vm.createContext({
    getFirestore: () => db,
    getMessaging: () => ({ sendEach: async messages => {
      assert.ok(messages.length <= 500);
      sent.push(...messages);
      return { responses: responses || messages.map(() => ({ success: true })) };
    } }),
    FieldValue: { delete: () => 'deleted' },
    onDocumentWritten: (config, callback) => { options = config; handler = callback; },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), context);
  return {
    sent, cleared, options,
    invoke: (after = { version: 4 }) => handler({
      params: { userId: 'user-1', scheduleId: 'schedule-1' },
      data: { before: { data: () => ({ version: 3 }) }, after: { data: () => after } },
    }),
  };
};

const device = (extra = {}) => ({
  status: 'active', platform: 'Android', widgetScheduleId: 'schedule-1', widgetPushToken: 'token-1', ...extra,
});

test('schedule triggers send data-only, collapsible invalidations only to relevant active Android widgets', async () => {
  const trigger = loadTrigger({ devices: [
    device(), device({ status: 'revoked' }), device({ platform: 'ios' }),
    device({ widgetScheduleId: 'another' }), device({ widgetPushToken: null }),
  ] });
  await trigger.invoke();
  assert.equal(trigger.options.document, 'users/{userId}/schedules/{scheduleId}');
  assert.equal(trigger.options.retry, true);
  assert.equal(trigger.sent.length, 1);
  const message = trigger.sent[0];
  assert.deepEqual(JSON.parse(JSON.stringify(message.data)), {
    type: 'widget_schedule_changed', userId: 'user-1', scheduleId: 'schedule-1', version: '4',
  });
  assert.equal(message.notification, undefined);
  assert.equal(message.android.priority, 'normal');
  assert.equal(message.android.collapseKey, 'planit-widget-sync');
});

test('Android platform matching supports stored OS names and legacy lowercase values', async () => {
  const trigger = loadTrigger({ devices: [
    device(), device({ platform: 'android', widgetPushToken: 'legacy-token' }),
    device({ platform: 'iOS' }), device({ platform: 'Web' }), device({ platform: null }),
  ] });
  await trigger.invoke();
  assert.deepEqual(trigger.sent.map(message => message.token), ['token-1', 'legacy-token']);
});

test('physical deletion invalidates the displayed schedule and account cleanup sends no pushes', async () => {
  const trigger = loadTrigger({ devices: [device()] });
  await trigger.invoke(null);
  assert.equal(trigger.sent.at(-1).data.version, '4');
  const deleting = loadTrigger({ devices: [device()], deleting: true });
  await deleting.invoke();
  assert.equal(deleting.sent.length, 0);
});

test('invalid push tokens are removed without deleting rotated tokens or reviving devices', async () => {
  for (const code of ['messaging/registration-token-not-registered', 'messaging/mismatched-credential', 'messaging/invalid-argument']) {
    const expired = loadTrigger({ devices: [device()], responses: [{ success: false, error: { code } }] });
    await expired.invoke();
    assert.equal(expired.cleared.length, 1);
    assert.equal(expired.cleared[0][1].widgetPushToken, 'deleted');
    assert.equal(expired.cleared[0][1].status, undefined);
  }
  const responses = [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }];
  const rotated = loadTrigger({ devices: [device()], responses, rotateToken: true });
  await rotated.invoke();
  assert.equal(rotated.cleared.length, 0);
});

test('transient FCM failures fail the event so Firebase can retry delivery', async () => {
  const failure = Object.assign(new Error('Unavailable'), { code: 'messaging/server-unavailable' });
  const trigger = loadTrigger({ devices: [device()], responses: [{ success: false, error: failure }] });
  await assert.rejects(trigger.invoke(), failure);
});

test('FCM fanout stays within the 500-message batch limit', async () => {
  const trigger = loadTrigger({ devices: Array.from({ length: 501 }, (_, index) => device({ widgetPushToken: `token-${index}` })) });
  await trigger.invoke();
  assert.equal(trigger.sent.length, 501);
});
