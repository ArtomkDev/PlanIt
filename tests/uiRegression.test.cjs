const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
const tinycolor = require('tinycolor2');

global.IS_REACT_ACT_ENVIRONMENT = true;
global.__DEV__ = false;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('/ui/AppTextInput')) return 'Input';
    if (name.endsWith('/ui/AppDateTimePicker')) return mocks['@react-native-community/datetimepicker'];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}

const themes = load('src/config/themes.js').default;

async function mountAutoSave(t, online = true) {
  const timers = new Set(), animations = [];
  const nativeSet = global.setTimeout, nativeClear = global.clearTimeout;
  t.mock.method(global, 'setTimeout', (callback, delay, ...args) => {
    if (delay !== 2000 && delay !== 60000 && delay !== 4000) return nativeSet(callback, delay, ...args);
    const timer = { callback, delay };
    timers.add(timer);
    return timer;
  });
  t.mock.method(global, 'clearTimeout', timer => { if (!timers.delete(timer)) nativeClear(timer); });
  let saves = 0;
  let saveNow = () => { saves++; };
  class Value {
    interpolate() { return 0; }
    stopAnimation() {}
  }
  const AutoSave = load('src/services/AutoSaveManager.jsx', {
    'react-native': {
      StyleSheet: { create: value => value },
      Animated: {
        Value, View: 'view', Text: 'text',
        timing: () => ({ start() {} }),
        parallel: () => ({ start: callback => { if (callback) animations.push(callback); } }),
      },
    },
    '../context/ScheduleProvider': {
      useScheduleActions: () => ({ saveNow }),
      useScheduleData: () => ({ user: { uid: 'test' }, lang: 'uk' }),
      useScheduleSync: () => ({ isDirty: true, isOnline: online, isCloudSaving: false, cloudSyncState: 'synced', conflictQueue: [] }),
    },
    '../utils/i18n': { t: value => value },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(AutoSave)); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    timers, animations, tree, saves: () => saves,
    async replaceSaveAction() {
      saveNow = () => { saves += 10; };
      await act(async () => tree.update(React.createElement(AutoSave, { revision: 1 })));
    },
  };
}

test('autosave status UI does not start a second cloud save scheduler', async t => {
  const ui = await mountAutoSave(t);
  await ui.replaceSaveAction();
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.saves(), 0);
});

test('an animation finishing after autosave UI unmount cannot leave a timer', async t => {
  const ui = await mountAutoSave(t, false);
  assert.equal(ui.animations.length, 1);
  await act(async () => ui.tree.unmount());
  ui.animations[0]({ finished: true });
  assert.equal(ui.timers.size, 0);
});

for (const mode of ['light', 'dark', 'oled']) {
  test(`${mode} themes preserve the exact chosen accent and readable button labels, including custom colors`, () => {
    for (const accent of [...Object.keys(themes.accentColors), '#FFFFFF', '#000000', '#808080', '#ffcc00', '#C00060']) {
      const colors = themes.getColors(mode, accent);
      const chosenAccent = themes.accentColors[accent] || accent;
      assert.ok(tinycolor.equals(colors.accentColor, chosenAccent), `${accent}: accent must remain unchanged`);
      assert.ok(tinycolor.equals(colors.accentTextColor, chosenAccent), `${accent}: accent foreground must keep the chosen color`);
      const minimumContrast = mode === 'light' || !tinycolor.equals(colors.textOnAccent, '#ffffff') ? 4.5 : 1.8;
      assert.ok(tinycolor.readability(colors.textOnAccent, colors.accentColor) >= minimumContrast, `${accent}: button label`);
      for (const background of [colors.backgroundColor, colors.backgroundColor2]) {
        assert.ok(tinycolor.readability(colors.textColor2, background) >= 4.5, `${mode}: secondary text on ${background}`);
        assert.ok(tinycolor.readability(colors.textColor3, background) >= 4.5, `${mode}: muted text on ${background}`);
      }
    }
  });
}

const fixture = () => ({
  global: { language: 'uk', theme: ['light', 'blue'], currentScheduleId: 'existing', version: 1, baseVersion: 1, lastModified: 1, lastSynced: 1 },
  schedules: [{ id: 'existing', name: 'Existing schedule', days: [], version: 1, baseVersion: 1, lastModified: 1, lastSynced: 1 }],
  deletedSchedules: [],
});

async function mountProvider(t, options = {}) {
  const writes = [], prefsWrites = [];
  let appStateListener;
  const mocks = {
    'react-native': { Platform: { OS: 'ios' }, useColorScheme: () => 'light', AppState: { addEventListener: (_event, listener) => { appStateListener = listener; return { remove() {} }; } } },
    '@react-native-community/netinfo': { addEventListener(callback) { callback({ isConnected: options.online === true }); return () => {}; } },
    'firebase/auth': { signOut: async () => {} },
    '@react-native-async-storage/async-storage': { removeItem: async () => {} },
    'expo-crypto': { randomUUID: () => 'generated-id' },
    '../config/firebase': { app: { options: {} }, auth: {} },
    '../config/firestore': {
      getScheduleFromServer: (...args) => options.readCloud?.(...args) ?? Promise.resolve(null),
      subscribeToSchedule: (...args) => options.subscribe?.(...args) ?? (() => {}),
      saveSchedule: (...args) => options.saveCloud?.(...args) ?? Promise.resolve(), resetUserSchedules: async () => {}, updateDeviceSyncTimeAndCleanUp: async () => {},
    },
    '../utils/storage': {
      getDevicePrefs: options.readPrefs || (async () => ({ language: 'uk', theme: ['light', 'blue'], blur: true, navigationStyle: 'classic', navigationLabels: true, navigationAnimations: true, hapticsEnabled: true, currentScheduleId: 'existing' })),
      saveDevicePrefs: async (prefs, config) => { prefsWrites.push(prefs); if (config?.throwOnError) await options.writePrefs?.(prefs); },
      getLocalSchedule: (...args) => options.readLocal?.(...args) ?? Promise.resolve(null),
      saveLocalSchedule: async (data, scope) => {
        writes.push({ data, scope });
        if (options.failWrite) throw new Error('Disk unavailable');
        await options.writeLocal?.(data, scope);
      },
      clearLocalSchedule: async () => {}, saveScheduleRecoverySnapshot: (...args) => options.saveRecovery?.(...args) ?? Promise.resolve(),
    },
    '../hooks/useAppLanguage': () => ({ lang: 'uk', isLangLoading: false }),
    '../utils/deviceService': { syncCurrentDeviceLanguage: async () => {} },
    '../utils/haptics': { setHapticsEnabled() {} },
    '../services/attachmentService': { deleteCloudAttachmentObject: (...args) => options.deleteCloudFile?.(...args), getScheduleAttachmentFiles: () => [] },
    '../utils/analytics/crashlytics': { logCrashlyticsError() {} },
    '../widgets/widgetService': { getWidgetSelectedScheduleId: async () => null, setWidgetSelectedScheduleId: async () => {}, syncScheduleToWidget: async () => {} },
    '../services/notificationService': { cancelLessonRemindersForSchedule: async () => {}, reconcileLessonRemindersForSchedule: async () => {} },
    '../navigation/navigationMetrics': { getDefaultNavigationStyle: () => 'classic', resolveNavigationStyle: value => value || 'classic' },
  };
  const { ScheduleProvider, useSchedule } = load('src/context/ScheduleProvider.jsx', mocks);
  let snapshot, tree;
  function Probe() { snapshot = useSchedule(); return null; }
  const render = user => React.createElement(ScheduleProvider, { guest: options.guest, user }, React.createElement(Probe));
  await act(async () => { tree = create(render(options.guest ? null : { uid: 'user-1' })); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    state: () => snapshot, writes, prefsWrites, appState: value => appStateListener(value),
    async refreshUser() { await act(async () => tree.update(render({ uid: 'user-1' }))); },
  };
}

const gate = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('automatic lesson-day preference survives unrelated edits and is saved on the device', async t => {
  const provider = await mountProvider(t, {
    guest: true,
    readLocal: async () => fixture(),
    readPrefs: async () => ({ currentScheduleId: 'existing', autoSelectLessonDay: false }),
  });
  assert.equal(provider.state().global.autoSelectLessonDay, false);
  await act(async () => provider.state().setGlobalDraft(prev => ({ ...prev, autoSelectLessonDay: true })));
  assert.equal(provider.state().global.autoSelectLessonDay, true);
  assert.equal(provider.prefsWrites.at(-1).autoSelectLessonDay, true);
  await act(async () => provider.state().setGlobalDraft(prev => ({ ...prev, blur: false })));
  assert.equal(provider.state().global.autoSelectLessonDay, true);
  await act(async () => provider.state().setGlobalDraft(prev => ({ ...prev, autoSelectLessonDay: false })));
  assert.equal(provider.prefsWrites.at(-1).autoSelectLessonDay, false);
});

test('startup exposes saved preferences before a first cloud fetch finishes', async t => {
  const prefs = gate();
  const cloud = gate();
  const provider = await mountProvider(t, { readPrefs: () => prefs.promise, readCloud: () => cloud.promise });
  assert.equal(provider.state().isDevicePrefsReady, false);
  await act(async () => prefs.resolve({ theme: ['light', 'blue'], language: 'uk' }));
  assert.equal(provider.state().isDevicePrefsReady, true);
  assert.equal(provider.state().isLoading, true, 'network loading can show its existing loader and timeout UI');
  assert.deepEqual(provider.state().global.theme, ['light', 'blue']);
  await act(async () => cloud.resolve(fixture()));
  assert.equal(provider.state().isLoading, false);
});

test('unreadable startup preferences release the gate so the existing recovery UI can appear', async t => {
  const provider = await mountProvider(t, { readPrefs: async () => { throw new Error('Preferences unavailable'); } });
  assert.equal(provider.state().isDevicePrefsReady, true);
  assert.equal(provider.state().isLoading, false);
  assert.equal(provider.state().error, 'Preferences unavailable');
});

test('saved theme remains available while local data loads and if that data is corrupt', async t => {
  const local = gate();
  const provider = await mountProvider(t, { guest: true, readLocal: async () => {
    await local.promise;
    throw new Error('Local data unavailable');
  } });
  assert.equal(provider.state().isDevicePrefsReady, true);
  assert.equal(provider.state().isLoading, true);
  assert.deepEqual(provider.state().global.theme, ['light', 'blue']);
  await act(async () => local.resolve());
  assert.equal(provider.state().isLoading, false);
  assert.equal(provider.state().error, 'Local data unavailable');
  assert.deepEqual(provider.state().global.theme, ['light', 'blue']);
});

function captureProviderTimers(t) {
  let now = 100000;
  const timers = new Set();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(global, 'setTimeout', (callback, delay) => {
    const timer = { callback, due: now + delay };
    timers.add(timer);
    return timer;
  });
  t.mock.method(global, 'clearTimeout', timer => timers.delete(timer));
  return {
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(timer => timer.due <= target).sort((a, b) => a.due - b.due)[0];
        if (!next) break;
        now = next.due;
        timers.delete(next);
        await act(async () => next.callback());
      }
      now = target;
    },
  };
}

test('continuous edits cannot postpone provider autosave past one minute', async t => {
  const clock = captureProviderTimers(t);
  let saves = 0;
  const provider = await mountProvider(t, {
    online: true,
    readLocal: async () => fixture(),
    saveCloud: async (_uid, data) => {
      saves++;
      return { schedules: data.schedules.map(item => ({ ...item, version: 2, baseVersion: 2, lastSynced: item.lastModified })) };
    },
  });
  for (let edit = 0; edit < 60; edit++) {
    await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: `Edit ${edit}` })));
    await clock.advance(1000);
  }
  assert.equal(saves, 1);
  assert.equal(provider.state().isDirty, false);
});

test('editing after a failed autosave preserves retry backoff', async t => {
  const clock = captureProviderTimers(t);
  let saves = 0;
  const provider = await mountProvider(t, {
    online: true,
    readLocal: async () => fixture(),
    saveCloud: async () => { saves++; throw new Error('Unavailable'); },
  });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'First' })));
  await clock.advance(2500);
  assert.equal(saves, 1);
  await clock.advance(1000);
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Second' })));
  await clock.advance(2500);
  assert.equal(saves, 1);
  await clock.advance(1500);
  assert.equal(saves, 2);
});

test('an offline local save failure retries the draft without another edit', async t => {
  const clock = captureProviderTimers(t);
  const options = { guest: true, readLocal: async () => fixture(), failWrite: true };
  const provider = await mountProvider(t, options);
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Keep offline' })));
  await clock.advance(500);
  assert.equal(provider.writes.length, 1);
  options.failWrite = false;
  await clock.advance(1000);
  assert.equal(provider.writes.length, 2);
  assert.equal(provider.writes.at(-1).data.schedules[0].name, 'Keep offline');
  assert.equal(provider.state().error, null);
});

test('concurrent local flushes of the same draft share the durable write', async t => {
  const writing = gate();
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture(), writeLocal: () => writing.promise });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'One durable draft' })));
  let first, second;
  await act(async () => {
    first = provider.state().setData(prev => prev, { persistLocally: true });
    second = provider.state().setData(prev => prev, { persistLocally: true });
  });
  assert.equal(provider.writes.length, 1);
  await act(async () => { writing.resolve(); await Promise.all([first, second]); });
});

test('refreshing the same account does not reload or replace an unsaved draft', async t => {
  let reads = 0;
  const provider = await mountProvider(t, { readLocal: async () => { reads++; return fixture(); } });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Still editing' })));
  await provider.refreshUser();
  assert.equal(reads, 1);
  assert.equal(provider.state().schedule.name, 'Still editing');
});

function captureAttachmentCleanup(t) {
  const callbacks = [];
  const originalSet = global.setTimeout;
  const originalClear = global.clearTimeout;
  t.mock.method(global, 'setTimeout', (callback, delay, ...args) => {
    if (delay !== 1000 && delay !== 30000) return originalSet(callback, delay, ...args);
    const timer = { attachmentCleanup: true, callback, delay };
    callbacks.push(timer);
    return timer;
  });
  t.mock.method(global, 'clearTimeout', timer => { if (!timer?.attachmentCleanup) originalClear(timer); });
  return callbacks;
}

test('attachment cloud deletion waits for a server-confirmed clean draft', async t => {
  const timers = captureAttachmentCleanup(t);
  const initial = fixture();
  const storagePath = 'users/user-1/attachments/file/old/document.pdf';
  initial.global.attachmentDeletionQueue = [{ storagePath }];
  let deliver;
  const removed = [];
  const provider = await mountProvider(t, {
    online: true, readLocal: async () => initial,
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
    deleteCloudFile: async file => removed.push(file.storagePath),
  });
  assert.equal(timers.length, 0, 'local startup data does not authorize cloud cleanup');
  await act(async () => deliver(initial, false));
  assert.ok(timers.length > 0);
  await act(async () => timers.at(-1).callback());
  assert.deepEqual(removed, [storagePath]);
  assert.deepEqual(provider.state().global.attachmentDeletionQueue, []);
  assert.equal(provider.state().isDirty, true, 'queue acknowledgement is synchronized through the existing provider');
});

test('a restored file is removed from the deletion queue without deleting its cloud bytes', async t => {
  const timers = captureAttachmentCleanup(t);
  const initial = fixture();
  const storagePath = 'users/user-1/attachments/file/old/document.pdf';
  initial.global.fileLibrary = [{ id: 'restored', storagePath }];
  initial.global.attachmentDeletionQueue = [{ storagePath }];
  let deliver, removed = 0;
  const provider = await mountProvider(t, {
    online: true, readLocal: async () => initial,
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
    deleteCloudFile: async () => { removed++; },
  });
  await act(async () => deliver(initial, false));
  await act(async () => timers.at(-1).callback());
  assert.equal(removed, 0);
  assert.deepEqual(provider.state().global.attachmentDeletionQueue, []);
});

test('a failed cloud cleanup keeps its durable intent and retries with backoff', async t => {
  const timers = captureAttachmentCleanup(t);
  const initial = fixture();
  initial.global.attachmentDeletionQueue = [{ storagePath: 'users/user-1/attachments/file/old/document.pdf' }];
  let deliver;
  const provider = await mountProvider(t, {
    online: true, readLocal: async () => initial,
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
    deleteCloudFile: async () => { throw new Error('Offline'); },
  });
  await act(async () => deliver(initial, false));
  await act(async () => timers.at(-1).callback());
  assert.equal(provider.state().global.attachmentDeletionQueue.length, 1);
  assert.equal(timers.at(-1).delay, 30000);
});

test('a queued attachment path from another account is never deleted', async t => {
  const timers = captureAttachmentCleanup(t);
  const initial = fixture();
  initial.global.attachmentDeletionQueue = [{ storagePath: 'users/other/attachments/file/document.pdf' }];
  let deliver, removed = 0;
  const provider = await mountProvider(t, {
    online: true, readLocal: async () => initial,
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
    deleteCloudFile: async () => { removed++; },
  });
  await act(async () => deliver(initial, false));
  await act(async () => timers.at(-1).callback());
  assert.equal(removed, 0);
  assert.deepEqual(provider.state().global.attachmentDeletionQueue, []);
});

const newerCloudData = () => {
  const data = fixture();
  data.schedules[0] = { ...data.schedules[0], name: 'Cloud update', version: 2, baseVersion: 2, lastModified: 2, lastSynced: 2 };
  return data;
};

test('manual refresh preserves edits made while the recovery snapshot is being written', async t => {
  const recovery = gate();
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    readCloud: async () => newerCloudData(),
    saveRecovery: () => recovery.promise,
  });
  let refresh;
  await act(async () => { refresh = provider.state().reloadAllSchedules(); });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Latest local edit' })));
  await act(async () => { recovery.resolve(); await refresh; });
  assert.equal(provider.state().schedule.name, 'Latest local edit');
  assert.equal(provider.state().isDirty, true);
});

test('a conflict remains blocked and retryable until the chosen copy is durable', async t => {
  let deliver;
  const options = {
    readLocal: async () => fixture(),
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
  };
  const provider = await mountProvider(t, options);
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Local copy' })));
  await act(async () => deliver(newerCloudData(), false));
  assert.equal(provider.state().conflictQueue.length, 1);
  options.failWrite = true;
  let result;
  await act(async () => { result = await provider.state().handleResolveConflict('existing', 'local'); });
  assert.equal(result, false);
  assert.equal(provider.state().conflictQueue.length, 1);
  options.failWrite = false;
  await act(async () => { result = await provider.state().handleResolveConflict('existing', 'local'); });
  assert.equal(result, true);
  assert.equal(provider.state().conflictQueue.length, 0);
});

test('an edit made while persisting a cloud merge retains its dirty signal', async t => {
  const localWrite = gate();
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    readCloud: async () => newerCloudData(),
    writeLocal: () => localWrite.promise,
  });
  let refresh;
  await act(async () => { refresh = provider.state().reloadAllSchedules(); });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Edited during local write' })));
  await act(async () => { localWrite.resolve(); await refresh; });
  assert.equal(provider.state().schedule.name, 'Edited during local write');
  assert.equal(provider.state().isDirty, true);
});

test('saving immediately after an edit uses the new draft before React commits it', async t => {
  let outgoing;
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    saveCloud: async (_uid, data) => {
      outgoing = data;
      return { schedules: data.schedules.map(item => ({ ...item, version: 2, baseVersion: 2, lastSynced: item.lastModified })) };
    },
  });
  await act(async () => {
    provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Immediate edit' }));
    await provider.state().saveNow(true);
  });
  assert.equal(outgoing.schedules[0].name, 'Immediate edit');
  assert.equal(provider.state().isDirty, false);
});

test('durable schedule addition waits for disk and retains settings edited in the same event', async t => {
  const writing = gate();
  const provider = await mountProvider(t, { readLocal: async () => fixture(), writeLocal: () => writing.promise });
  let saving, finished = false;
  await act(async () => {
    provider.state().setGlobalDraft(prev => ({ ...prev, fileLibrary: [{ id: 'copied-file' }] }));
    saving = provider.state().addSchedule({ id: 'transferred', name: 'Transfer' }, { persistLocally: true }).then(() => { finished = true; });
  });
  assert.equal(finished, false);
  assert.ok(provider.writes.at(-1).data.schedules.some(item => item.id === 'transferred'));
  assert.equal(provider.writes.at(-1).data.global.fileLibrary[0].id, 'copied-file');
  await act(async () => { writing.resolve(); await saving; });
  assert.equal(finished, true);
});

test('saving and selecting an imported copy persists both the copy and its selection before completing', async t => {
  const writing = gate();
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture(), writeLocal: () => writing.promise });
  let saving, finished = false;
  await act(async () => {
    saving = provider.state().addSchedule({ id: 'shared-copy', name: 'Shared' }, { persistLocally: true, select: true }).then(() => { finished = true; });
  });
  assert.equal(finished, false);
  assert.equal(provider.state().global.currentScheduleId, 'shared-copy');
  assert.equal(provider.writes.at(-1).data.global.currentScheduleId, 'shared-copy');
  assert.equal(provider.prefsWrites.at(-1).currentScheduleId, 'shared-copy');
  assert.ok(provider.writes.at(-1).data.schedules.some(item => item.id === 'existing'));
  await act(async () => { writing.resolve(); await saving; });
  assert.equal(finished, true);
});

test('a failed selection write is retryable and cannot create a duplicate imported schedule', async t => {
  let fail = true;
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture(), writePrefs: async () => { if (fail) throw new Error('Disk full'); } });
  const copy = { id: 'shared-copy', name: 'Shared' };
  await act(async () => assert.rejects(provider.state().addSchedule(copy, { persistLocally: true, select: true }), /Disk full/));
  fail = false;
  await act(async () => provider.state().addSchedule(copy, { persistLocally: true, select: true }));
  assert.equal(provider.state().schedules.filter(item => item.id === copy.id).length, 1);
});

test('manual refresh defers reconciliation until an active cloud save finishes', async t => {
  const cloudSave = gate();
  let cloudReads = 0, outgoing;
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    readCloud: async () => { cloudReads++; return null; },
    saveCloud: (_uid, data) => { outgoing = data; return cloudSave.promise; },
  });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Saving' })));
  let saving;
  await act(async () => { saving = provider.state().saveNow(true); });
  await act(async () => provider.state().reloadAllSchedules());
  assert.equal(cloudReads, 0);
  await act(async () => {
    cloudSave.resolve({ schedules: outgoing.schedules.map(item => ({ ...item, version: 2, baseVersion: 2, lastSynced: item.lastModified })) });
    await saving;
  });
  assert.ok(cloudReads > 0);
});

test('backgrounding flushes an offline guest draft without waiting for the debounce', async t => {
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture() });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Offline guest edit' })));
  await act(async () => provider.appState('background'));
  assert.equal(provider.writes.at(-1)?.data.schedules[0].name, 'Offline guest edit');
  assert.equal(provider.writes.at(-1)?.scope, null);
});

test('acknowledging normalized outgoing settings does not leave an unchanged draft dirty', async t => {
  const initial = fixture();
  initial.global.language = null;
  initial.global.lastModified = 2;
  const provider = await mountProvider(t, {
    readLocal: async () => initial,
    saveCloud: async (_uid, data) => ({
      global: { ...data.global, version: 2, baseVersion: 2, lastSynced: data.global.lastModified },
      schedules: [],
    }),
  });
  await act(async () => provider.state().saveNow(true));
  assert.equal(provider.state().global.language, 'uk');
  assert.equal(provider.state().isDirty, false);
});

test('transaction conflict refresh cannot overwrite an edit made while preserving recovery data', async t => {
  const recovery = gate();
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    readCloud: async () => newerCloudData(),
    saveCloud: async () => { const error = new Error('Conflict'); error.code = 'sync/conflict'; throw error; },
    saveRecovery: (_data, _uid, reason) => reason === 'transaction-conflict' ? recovery.promise : Promise.resolve(),
  });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'First local edit' })));
  let saving;
  await act(async () => { saving = provider.state().saveNow(true); });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Edit during conflict refresh' })));
  await act(async () => { recovery.resolve(); await saving; });
  assert.equal(provider.state().schedule.name, 'Edit during conflict refresh');
  assert.ok(provider.state().conflictQueue.every(conflict => conflict.local.name === 'Edit during conflict refresh'));
});

test('conflict resolution keeps edits made while its recovery copy is being saved', async t => {
  const recovery = gate();
  let deliver;
  const provider = await mountProvider(t, {
    readLocal: async () => fixture(),
    subscribe: (_uid, callback) => { deliver = callback; return () => {}; },
    saveRecovery: (_data, _uid, reason) => reason.startsWith('before-conflict-choice:') ? recovery.promise : Promise.resolve(),
  });
  await act(async () => provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Conflicting edit' })));
  await act(async () => deliver(newerCloudData(), false));
  assert.equal(provider.state().conflictQueue.length, 1);
  let resolving;
  await act(async () => { resolving = provider.state().handleResolveConflict('existing', 'local'); });
  await act(async () => {
    provider.state().setScheduleDraft(prev => ({ ...prev, name: 'Latest local edit' }));
    provider.state().setGlobalDraft(prev => ({ ...prev, fileLibrary: [{ id: 'new-file' }] }));
  });
  await act(async () => { recovery.resolve(); await resolving; });
  assert.equal(provider.state().schedule.name, 'Latest local edit');
  assert.deepEqual(provider.state().global.fileLibrary, [{ id: 'new-file' }]);
  assert.equal(provider.state().isDirty, true);
});

test('a failed guest read exposes recovery without overwriting existing storage; retry loads the original schedule', async t => {
  let recovered = false;
  const provider = await mountProvider(t, { guest: true, readLocal: async () => {
    if (!recovered) throw new Error('Read unavailable');
    return fixture();
  } });
  assert.equal(provider.state().isLoading, false);
  assert.equal(provider.state().error, 'Read unavailable');
  assert.equal(provider.state().schedules.length, 0);
  assert.deepEqual(provider.writes, []);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
  assert.ok(provider.writes.every(write => write.data.schedules.length === 1));
});

test('an unreadable account cache is preserved until retry, including unsynced changes', async t => {
  let recovered = false, cloudReads = 0;
  const provider = await mountProvider(t, {
    readLocal: async () => {
      if (!recovered) throw new Error('Read unavailable');
      return fixture();
    },
    readCloud: async () => { cloudReads++; return null; },
  });
  assert.equal(provider.state().error, 'Read unavailable');
  assert.deepEqual(provider.writes, []);
  assert.equal(cloudReads, 0);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
});

test('a failed cloud read cannot persist an empty replacement, and retry restores the server schedule', async t => {
  let recovered = false;
  const provider = await mountProvider(t, { readCloud: async () => {
    if (!recovered) throw new Error('Offline');
    return fixture();
  } });
  assert.equal(provider.state().error, 'Offline');
  assert.equal(provider.state().isDirty, false);
  assert.deepEqual(provider.writes, []);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
  assert.equal(provider.writes.length, 1);
  assert.equal(provider.writes[0].scope, 'user-1');
});

test('a disk failure after receiving cloud data retains the fetched schedule instead of creating empty data', async t => {
  const provider = await mountProvider(t, { readCloud: async () => fixture(), failWrite: true });
  assert.equal(provider.state().error, 'Disk unavailable');
  assert.equal(provider.state().schedule.id, 'existing');
  assert.ok(provider.writes.length > 0);
  assert.ok(provider.writes.every(write => write.data.schedules[0]?.id === 'existing'));
});

test('a successful empty read still permits first-run onboarding', async t => {
  const provider = await mountProvider(t, { guest: true });
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().isLoading, false);
  assert.deepEqual(provider.state().schedules, []);
});

test('device theme changes use the provider and preserve unrelated preferences', async t => {
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture() });
  await act(async () => {
    provider.state().setGlobalDraft(prev => ({ ...prev, theme: ['dark', 'pastelBlue'] }));
    provider.state().setGlobalDraft(prev => ({ ...prev, theme: ['oled', 'yellow'] }));
  });
  assert.deepEqual(provider.state().global.theme, ['oled', 'yellow']);
  const lastPrefs = provider.prefsWrites.at(-1);
  assert.deepEqual(lastPrefs.theme, ['oled', 'yellow']);
  assert.equal(lastPrefs.language, 'uk');
  assert.equal(lastPrefs.navigationStyle, 'classic');
  assert.equal(lastPrefs.currentScheduleId, 'existing');
});

const i18n = load('src/utils/i18n.js');
const tr = key => i18n.t(key, 'uk');
async function mountImport(t, fetchSharedSchedule, initialCode = '') {
  const added = [], active = [];
  let closed = 0, tree;
  const Component = load('src/components/modals/ImportScheduleModal.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Keyboard: { dismiss() {} } },
    '@gorhom/bottom-sheet': { BottomSheetTextInput: 'Input' },
    'phosphor-react-native': { DownloadSimple: 'Download', X: 'Close' },
    '../../context/ScheduleProvider': {
      useScheduleData: () => ({ global: {}, lang: 'uk' }),
      useScheduleActions: () => ({ addSchedule: value => added.push(value), setGlobalDraft: updater => active.push(updater({}).currentScheduleId) }),
    },
    '../../services/shareService': { fetchSharedSchedule, getSharedScheduleErrorKey: () => 'common.action_failed' },
    '../schedule/SharedSchedulePreview': 'SharedSchedulePreview',
    '../../utils/scheduleValidation': { sanitizeImportedSchedule: data => ({ ...data, id: 'imported' }) },
    '../../utils/haptics': { triggerHaptic() {} },
    '../ui/BottomSheet': { __esModule: true, default: 'Sheet', SheetScrollView: 'Scroll' },
    '../ui/MorphingLoader': 'Loader',
  }).default;
  const render = visible => React.createElement(Component, { visible, initialCode, onClose: () => closed++ });
  await act(async () => { tree = create(render(true)); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, added, active, closed: () => closed, update: async visible => act(async () => tree.update(render(visible))) };
}
const button = (root, key) => root.findAllByType('Button').find(node => node.props.accessibilityLabel === tr(key));

test('import ignores a late response after closing and reopening the sheet', async t => {
  let resolve;
  const modal = await mountImport(t, () => new Promise(done => { resolve = done; }));
  await act(async () => modal.root().findByType('Input').props.onChangeText('ABCDE'));
  await act(async () => button(modal.root(), 'share.find_btn').props.onPress());
  assert.equal(button(modal.root(), 'share.find_btn').props.disabled, true);
  await act(async () => modal.root().findByType('Sheet').props.onClose());
  await modal.update(false);
  await modal.update(true);
  await act(async () => resolve({ scheduleName: 'Old response', scheduleData: {} }));
  assert.equal(modal.root().findByType('Input').props.value, '');
  assert.equal(button(modal.root(), 'share.add_to_account_btn'), undefined);
  assert.deepEqual(modal.added, []);
});

test('repeated presses import a schedule once and select the imported schedule', async t => {
  const modal = await mountImport(t, async () => ({ scheduleName: 'Shared', ownerName: 'Teacher', scheduleData: {} }), 'ABCDE');
  const importButton = button(modal.root(), 'share.add_to_account_btn');
  await act(async () => { importButton.props.onPress(); importButton.props.onPress(); });
  assert.equal(modal.added.length, 1);
  assert.deepEqual(modal.active, ['imported']);
  assert.equal(modal.closed(), 1);
});

test('import errors retain the code and restore the search action', async t => {
  const modal = await mountImport(t, async () => { throw new Error('Offline'); }, 'ABCDE');
  assert.equal(modal.root().findByType('Input').props.value, 'ABCDE');
  assert.equal(button(modal.root(), 'share.find_btn').props.disabled, false);
  assert.ok(modal.root().findAllByType('Text').some(node => node.props.children === tr('common.action_failed')));
});

class AnimatedValue {
  constructor(value) { this.value = value; this.listeners = new Map(); }
  setValue(value) { this.value = value; for (const callback of this.listeners.values()) callback({ value }); }
  addListener(callback) { const id = String(this.listeners.size); this.listeners.set(id, callback); return id; }
  removeListener(id) { this.listeners.delete(id); }
  stopAnimation() {}
  interpolate({ inputRange, outputRange }) {
    const index = Math.max(0, inputRange.findIndex((value, i) => this.value <= value && i > 0) - 1);
    if (this.value >= inputRange.at(-1)) return outputRange.at(-1);
    if (typeof outputRange[index] !== 'number') return outputRange[index];
    const fraction = Math.max(0, (this.value - inputRange[index]) / (inputRange[index + 1] - inputRange[index]));
    return outputRange[index] + (outputRange[index + 1] - outputRange[index]) * fraction;
  }
}

test('segmented controls use readable labels for both default and explicitly supplied accent backgrounds', async t => {
  const Component = load('src/components/ui/TabSwitcher.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Animated: { Value: AnimatedValue }, Easing: {} },
    '../../utils/haptics': { triggerHaptic() {} }, '../../hooks/useReducedMotionPreference': () => true,
  }).default;
  const colors = themes.getColors('dark', 'pastelYellow');
  let tree;
  for (const background of [undefined, colors.accentColor, colors.backgroundColor2, 'transparent']) {
    await act(async () => {
      const element = React.createElement(Component, { tabs: [{ id: 'first', label: 'First' }], activeTab: 'first', onTabPress() {}, themeColors: colors, activeTabBackgroundColor: background });
      if (tree) tree.update(element);
      else tree = create(element);
    });
    const labelColor = Object.assign({}, ...tree.root.findByType('Text').props.style).color;
    assert.equal(labelColor, !background || background === colors.accentColor ? colors.textOnAccent : colors.textColor);
  }
  t.after(async () => act(async () => tree.unmount()));
});

async function mountOnboarding(t, platform = 'android') {
  const added = [], alerts = [], scrolls = [];
  let gestures, back, tree;
  const Component = load('src/pages/Onboarding/OnboardingWizard.jsx', {
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'Keyboard',
      StyleSheet: { create: x => x }, Platform: { OS: platform }, useWindowDimensions: () => ({ width: 390 }), useColorScheme: () => 'light',
      Keyboard: { dismiss() {} },
      BackHandler: { addEventListener(_, callback) { back = callback; return { remove() {} }; } },
      PanResponder: { create(callbacks) { gestures = callbacks; return { panHandlers: {} }; } },
      Animated: { Value: AnimatedValue, View: 'AnimatedView', ScrollView: 'Scroll', createAnimatedComponent: x => x, event: () => () => {} },
    },
    'expo-crypto': { randomUUID: () => 'onboarded' },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    '../../context/ScheduleProvider': {
      useScheduleData: () => ({ lang: 'uk', global: {} }),
      useScheduleActions: () => ({ addSchedule: data => added.push(data), setGlobalDraft() {} }),
    },
    '../../context/AppDialogContext': { useAppDialog: () => ({ alert: async (options) => alerts.push(options) }) },
    '../context/AppDialogContext': { useAppDialog: () => ({ alert: async (options) => alerts.push(options) }) },
    '../../components/ui/GradientBackground': props => React.createElement(props.component || 'View', props),
    '../../components/ui/TabSwitcher': 'Tabs',
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row', '../utils/haptics': { triggerHaptic() {} },
    './ui/AdvancedColorPicker': 'ColorPicker', './ScheduleIcon': 'ScheduleIcon', './ScheduleIconPickerSheet': 'IconPicker',
    './CalendarSheet/CalendarSheet': 'Calendar', './ui/AppSwitch': 'Switch',
    '../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
    '../../components/CalendarSheet/CalendarSheet': 'Calendar',
    '../../components/ui/AppBlur': 'Blur', '../../components/ui/AppSwitch': 'Switch',
    '../../components/ui/SettingsKit/SettingsGroup': 'Group', '../../components/ui/SettingsKit/SettingsRow': 'Row', '../../components/ui/SettingsKit/SettingsActionRow': 'Action',
    '../../utils/haptics': { triggerHaptic() {} },
    '../../hooks/useReducedMotionPreference': () => true,
    '../../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component), { createNodeMock: node => node.type === 'Scroll' ? { scrollTo: options => scrolls.push(options) } : null }); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, gestures: () => gestures, back: () => back(), added, alerts, scrolls };
}

test('leaving a long timing step resets scrolling and restores the next step’s own height on Android', async t => {
  const wizard = await mountOnboarding(t);
  const steps = wizard.root().findAllByType('AnimatedView').filter(node => node.props.onLayout && 'pointerEvents' in node.props);
  await act(async () => steps[3].props.onLayout({ nativeEvent: { layout: { height: 1600 } } }));
  for (let i = 0; i < 3; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  const height = () => wizard.root().findAllByType('AnimatedView').map(node => Object.assign({}, ...(Array.isArray(node.props.style) ? node.props.style : [node.props.style]))).find(style => typeof style.height === 'number' && style.width === 390).height;
  assert.equal(height(), 1600);
  await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  assert.equal(height(), 400);
  assert.deepEqual(wizard.scrolls.at(-1), { y: 0, animated: false });
});

test('onboarding exposes navigation immediately, Android Back returns a step, and swiping past the last step cannot create a schedule', async t => {
  const wizard = await mountOnboarding(t);
  assert.equal(button(wizard.root(), 'onboarding.next').props.disabled, false);
  await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => assert.equal(wizard.back(), true));
  assert.equal(button(wizard.root(), 'common.back').props.disabled, true);
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => {
    wizard.gestures().onPanResponderGrant();
    wizard.gestures().onPanResponderMove({}, { dx: -400 });
    wizard.gestures().onPanResponderRelease({}, { dx: -400, vx: -1 });
  });
  assert.deepEqual(wizard.added, []);
  const done = button(wizard.root(), 'common.done');
  await act(async () => { done.props.onPress(); done.props.onPress(); });
  assert.equal(wizard.added.length, 1);
});

test('onboarding preserves a zero-minute break when committing the schedule', async t => {
  const wizard = await mountOnboarding(t);
  const input = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === `${tr('schedule.day_schedule.break')} 1`);
  await act(async () => input.props.onChangeText('0'));
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.equal(wizard.added[0].breaks[0], 0);
});

test('onboarding saves independently edited lesson durations and the requested number of slots', async t => {
  const wizard = await mountOnboarding(t);
  const duration = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === i18n.t('settings.schedule_editor.timing.lesson_duration', 'uk', { number: 2 }));
  await act(async () => duration.props.onChangeText('45'));
  await act(async () => button(wizard.root(), 'settings.schedule_editor.timing.add').props.onPress());
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.deepEqual(wizard.added[0].slotDurations, [80, 45, 80, 80, 80, 80, 80]);
  assert.equal(wizard.added[0].breaks.length, 6);
});

for (const duration of ['999', '0', '']) {
test(`onboarding refuses an invalid lesson duration: ${duration || 'empty'}`, async t => {
  const wizard = await mountOnboarding(t);
  const row = wizard.root().findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title'));
  await act(async () => row.props.onPress());
  const input = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === tr('schedule.main_screen.duration'));
  await act(async () => input.props.onChangeText(duration));
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.deepEqual(wizard.added, []);
  assert.equal(wizard.alerts.length, 1);
  assert.ok(button(wizard.root(), 'onboarding.next'));
});
}

async function mountThemeScreen(t, platform = 'ios', initial = { theme: ['light', 'blue'] }, lang = 'uk') {
  const updates = [];
  let value = initial, tree;
  const Component = load('src/pages/Settings/components/preferences/ThemeSettings.jsx', {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Button', StyleSheet: { create: x => x, hairlineWidth: 1 }, Platform: { OS: platform } },
    'phosphor-react-native': { PencilSimple: 'Pencil', Check: 'Check' },
    '../../../../context/ScheduleProvider': {
      useScheduleData: () => ({ global: value, lang }),
      useScheduleActions: () => ({ setGlobalDraft: updater => { value = updater(value); updates.push(value); tree.update(render()); } }),
    },
    '../../../../hooks/useAppTheme': () => ({ mode: value.theme[0], colors: themes.getColors(...value.theme) }),
    '../../../../layouts/SettingsScreenLayout': 'Layout',
    '../../../../components/ui/AdvancedColorPicker': 'Picker', '../../../../components/ui/AppSwitch': 'Switch',
    '../../../../components/ui/SettingsKit/SettingsGroup': 'Group',
    '../../../../components/ui/SettingsKit/SettingsRow': props => React.createElement('Row', props, props.rightContent),
    '../../../../utils/haptics': { triggerHaptic() {} },
  }).default;
  const render = () => React.createElement(Component);
  await act(async () => { tree = create(render()); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    root: () => tree.root, value: () => value, updates,
    async press(key) {
      const label = i18n.t(`settings.theme_screen.${key}`, lang);
      await act(async () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label).props.onPress());
    },
    async external(next) { await act(async () => { value = next; tree.update(render()); }); },
    async openCustom() { await act(async () => tree.root.findAllByType('Row').find(node => node.props.label === i18n.t('settings.theme_screen.custom_color', lang)).props.onPress()); },
  };
}

test('custom color preview and save controls use the same foreground as the applied accent', async t => {
  const saved = [];
  const Picker = load('src/components/ui/AdvancedColorPicker.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', Keyboard: { dismiss() {} },
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 900 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'phosphor-react-native': { Check: 'Check', Palette: 'Palette', X: 'X' },
    './AppTextInput': 'Input', './ColorSpectrumPicker': 'Spectrum',
    './BottomSheet': { __esModule: true, default: 'Sheet', SheetScrollView: 'ScrollView' },
    '../../context/ScheduleProvider': { useScheduleData: () => ({ global: { theme: ['dark', '#1FA4BC'] }, lang: 'uk' }) },
    '../../utils/haptics': { triggerHaptic() {} },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Picker, {
    visible: true, initialColor: '#1FA4BC', onSave: color => saved.push(color),
  })); });
  t.after(async () => act(async () => tree.unmount()));
  const assertForeground = color => {
    const expected = themes.getColors('dark', color).textOnAccent;
    assert.ok(tree.root.findAllByType('Check').every(icon => icon.props.color === expected));
    const label = tree.root.findAllByType('Text').find(node => node.props.children === i18n.t('color_picker.save', 'uk'));
    assert.equal(Object.assign({}, ...label.props.style).color, expected);
    assert.ok(tinycolor.readability(color, expected) >= 1.8);
  };
  assertForeground('#1FA4BC');
  for (const color of ['#1e3a8a', '#fef08a', '#000000', '#ffffff', '#1fa4bc', '#27c7d5']) {
    await act(async () => tree.root.findByType('Spectrum').props.onChange(color));
    assertForeground(color);
  }
  await act(async () => tree.root.findByType('Input').props.onChangeText('#123456'));
  await act(async () => tree.root.findByType('Input').props.onBlur());
  assertForeground('#123456');
  await act(async () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === i18n.t('color_picker.save', 'uk')).props.onPress());
  assert.deepEqual(saved, ['#123456']);
});

test('dark and OLED themes prefer white on vivid accents and dark text only on pale accents', () => {
  for (const mode of ['dark', 'oled']) {
    for (const color of ['#1FA4BC', '#27C7D5', '#3B82F6', '#111827']) {
      assert.equal(themes.getColors(mode, color).textOnAccent, '#ffffff');
    }
    for (const color of ['#ffffff', '#FBCFE8', '#FDE68A', '#BFDBFE']) {
      assert.equal(themes.getColors(mode, color).textOnAccent, '#111827');
    }
  }
  assert.equal(themes.getColors('light', '#27C7D5').textOnAccent, '#111827');
});

test('the theme picker renders selected colors and commits changes through the schedule provider', async t => {
  const screen = await mountThemeScreen(t);
  await screen.press('colors.pastelYellow');
  assert.deepEqual(screen.value().theme, ['light', 'pastelYellow']);
  assert.equal(screen.root().findByType('Check').props.color, themes.getColors('light', 'pastelYellow').textOnAccent);
});

test('theme choices use the latest provider values and retain unrelated preferences', async t => {
  const screen = await mountThemeScreen(t, 'android', { theme: ['dark', 'cyan'], blur: false, watermark: 1 });
  await screen.press('modes.oled');
  await screen.press('colors.red');
  assert.deepEqual(screen.value(), { theme: ['oled', 'red'], blur: false, watermark: 1 });
  const count = screen.updates.length;
  await screen.press('modes.oled');
  assert.equal(screen.updates.length, count);
  await screen.external({ theme: ['light', 'green'], blur: true, watermark: 2 });
  const selected = screen.root().findAllByType('Button').filter(node => node.props.accessibilityState?.checked);
  assert.deepEqual(selected.map(node => node.props.accessibilityLabel), [i18n.t('settings.theme_screen.modes.light', 'uk'), i18n.t('settings.theme_screen.colors.green', 'uk')]);
  assert.equal(screen.updates.length, count);
});

test('custom colors start from the active accent; cancel preserves it and save retains mode and preferences', async t => {
  const screen = await mountThemeScreen(t, 'android', { theme: ['oled', 'red'], blur: false });
  await screen.openCustom();
  assert.equal(screen.root().findByType('Picker').props.visible, true);
  assert.equal(screen.root().findByType('Picker').props.initialColor, themes.accentColors.red);
  await act(async () => screen.root().findByType('Picker').props.onClose());
  assert.equal(screen.updates.length, 0);
  await screen.openCustom();
  await act(async () => screen.root().findByType('Picker').props.onSave('#987654'));
  assert.deepEqual(screen.value(), { theme: ['oled', '#987654'], blur: false });
  assert.equal(screen.root().findByType('Picker').props.visible, false);
  assert.equal(screen.root().findByType('Picker').props.initialColor, '#987654');
});

test('the theme screen removes emoji and the result demo, labels all colors, and preserves platform blur controls', async t => {
  const screen = await mountThemeScreen(t, 'android');
  const labels = screen.root().findAllByType('Button').map(node => node.props.accessibilityLabel);
  assert.ok(labels.every(label => !/\p{Extended_Pictographic}/u.test(label)));
  assert.equal(labels.length, Object.keys(themes.accentColors).length + 3);
  assert.ok(labels.every(label => label && !label.includes('settings.theme_screen')));
  assert.ok(!screen.root().findAllByType('Text').some(node => node.props.children === 'Результат'));
  assert.equal(screen.root().findAllByType('Switch').length, 0);
  const web = await mountThemeScreen(t, 'web', { theme: ['dark', 'blue'], blur: true }, 'en');
  await act(async () => web.root().findByType('Switch').props.onValueChange(false));
  assert.deepEqual(web.value(), { theme: ['dark', 'blue'], blur: false });
});

test('the schedule editor protects an unsaved draft and allows leaving after a successful save', async t => {
  let guard, tree, wentBack = 0;
  const alerts = [], confirms = [], dispatched = [], added = [];
  const navigation = { dispatch: action => dispatched.push(action), canGoBack: () => true, goBack() { assert.equal(guard.enabled, false); wentBack++; } };
  const dialog = {
    alert: async (options) => alerts.push(options),
    confirm: (options) => new Promise(resolve => confirms.push({ options, resolve })),
  };
  const Component = load('src/pages/Settings/components/ScheduleEditorScreen.jsx', {
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', TextInput: 'Input', KeyboardAvoidingView: 'Keyboard',
      StyleSheet: { create: x => x }, Platform: { OS: 'ios' }, LayoutAnimation: {}, UIManager: {},
      useWindowDimensions: () => ({ height: 844 }),
      Animated: { Value: AnimatedValue, ScrollView: 'Scroll', event: () => () => {} },
    },
    '@react-navigation/native': {
      useNavigation: () => navigation, useRoute: () => ({ params: { isNew: true } }),
      usePreventRemove: (enabled, callback) => { guard = { enabled, callback }; },
    },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    'expo-crypto': { randomUUID: () => 'new-schedule' },
    '../../../context/ScheduleProvider': {
      useScheduleData: () => ({ schedules: [], global: {}, lang: 'uk' }),
      useScheduleActions: () => ({ setData() {}, setGlobalDraft() {}, addSchedule: data => added.push(data) }),
      useScheduleLayout: () => ({ tabBarHeight: 80 }),
    },
    '../../../context/AppDialogContext': { useAppDialog: () => dialog },
    '../context/AppDialogContext': { useAppDialog: () => dialog },
    '../../../components/ui/SettingsHeader': props => React.createElement('Header', {}, props.rightButton),
    '../../../components/ui/TabSwitcher': 'Tabs', '../../../components/CalendarSheet/CalendarSheet': 'Calendar',
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row', '../utils/haptics': { triggerHaptic() {} },
    './ui/AdvancedColorPicker': 'ColorPicker', './ScheduleIcon': 'ScheduleIcon', './ScheduleIconPickerSheet': 'IconPicker',
    './CalendarSheet/CalendarSheet': 'Calendar', './ui/AppSwitch': 'Switch',
    '../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
    '../../../components/ui/AdvancedColorPicker': 'Picker', '../../../components/ui/AppSwitch': 'Switch',
    '../../../components/ui/SettingsKit/SettingsGroup': 'Group', '../../../components/ui/SettingsKit/SettingsRow': 'Row', '../../../components/ui/SettingsKit/SettingsActionRow': 'Action',
    '../../../utils/haptics': { triggerHaptic() {} }, '../../../hooks/useReducedMotionPreference': () => true,
    '../../../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => act(async () => tree.unmount()));
  assert.equal(guard.enabled, false);
  const name = tree.root.findAllByType('Input').find(node => node.props.accessibilityLabel === tr('settings.schedule_editor.enter_name'));
  await act(async () => name.props.onChangeText('Changed draft'));
  assert.equal(guard.enabled, true);
  const action = { type: 'GO_BACK' };
  await act(async () => { guard.callback({ data: { action } }); });
  assert.deepEqual(dispatched, []);
  assert.equal(confirms[0].options.destructive, true);
  assert.equal(confirms[0].options.confirmLabel, tr('common.discard'));
  await act(async () => confirms[0].resolve(true));
  assert.deepEqual(dispatched, [action]);
  await act(async () => tree.root.findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title')).props.onPress());
  const duration = tree.root.findAllByType('Input').find(node => node.props.accessibilityLabel === tr('schedule.main_screen.duration'));
  await act(async () => duration.props.onChangeText('0'));
  await act(async () => button(tree.root, 'common.save').props.onPress());
  assert.deepEqual(added, []);
  assert.equal(wentBack, 0);
  await act(async () => duration.props.onChangeText('45'));
  await act(async () => {
    const save = button(tree.root, 'common.save');
    save.props.onPress();
    save.props.onPress();
  });
  assert.equal(added.length, 1);
  assert.equal(added[0].name, 'Changed draft');
  assert.equal(wentBack, 1);
});

test('web onboarding hides inactive steps from focus and preserves input focus during scrolling', async t => {
  const wizard = await mountOnboarding(t, 'web');
  const steps = wizard.root().findAllByType('AnimatedView').filter(node => node.props.onLayout && 'pointerEvents' in node.props);
  assert.equal(steps.filter(node => node.props['aria-hidden'] === false).length, 1);
  assert.ok(steps.slice(1).every(node => node.props['aria-hidden'] && Object.assign({}, ...node.props.style).visibility === 'hidden'));
  assert.equal(wizard.root().findByType('Scroll').props.keyboardDismissMode, 'none');
});

async function mountTimeEditor(t, platform = 'android', options = {}) {
  const Component = load('src/components/ScheduleTimeEditor.jsx', {
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Platform: { OS: platform } },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row',
    '../utils/haptics': { triggerHaptic() {} },
  }).default;
  const time = load('src/utils/scheduleTime.js');
  let tree, value = { start_time: '08:30', duration: 45, breaks: [10, 20], slotDurations: [45, 60, 80] }, active = true;
  const render = () => React.createElement(Component, {
    value, onChange(next) { value = next; tree.update(render()); }, themeColors: themes.getColors('dark', 'pastelYellow'), lang: 'uk', mode: 'dark', active, ...options,
  });
  await act(async () => { tree = create(render()); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    root: () => tree.root, value: () => value,
    slots: () => time.buildScheduleSlots(value.start_time, value.duration, value.breaks, value.slotDurations),
    async setActive(next) { await act(async () => { active = next; tree.update(render()); }); },
    async open(number, field) {
      const label = i18n.t('settings.schedule_editor.timing.lesson_time', 'uk', { number, field: i18n.t(`settings.schedule_editor.timing.${field}`, 'uk'), time: this.slots()[number - 1][field] });
      await act(async () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label).props.onPress());
    },
  };
}
const clockDate = (hours, minutes) => { const date = new Date(); date.setHours(hours, minutes, 0, 0); return date; };

test('Android time edits derive breaks and resize lessons, while cancel preserves the draft', async t => {
  const editor = await mountTimeEditor(t);
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(9, 30)));
  assert.deepEqual(editor.value().breaks, [15, 20]);
  assert.equal(editor.slots()[2].start, '10:50');
  await editor.open(2, 'end');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(10, 45)));
  assert.deepEqual(editor.value().slotDurations, [45, 75, 80]);
  const before = JSON.stringify(editor.value());
  await editor.open(1, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'dismissed' }));
  assert.equal(JSON.stringify(editor.value()), before);
});

test('invalid Android edits keep the previous time and display an inline explanation', async t => {
  const editor = await mountTimeEditor(t);
  const before = JSON.stringify(editor.value());
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(8, 0)));
  assert.equal(JSON.stringify(editor.value()), before);
  assert.equal(editor.root().findAllByType('Text').filter(node => node.props.accessibilityRole === 'alert').length, 1);
});

test('iOS spinner edits apply immediately and leaving onboarding closes the picker', async t => {
  const editor = await mountTimeEditor(t, 'ios');
  await editor.open(1, 'end');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({}, clockDate(9, 30)));
  assert.equal(editor.value().slotDurations[0], 60);
  await act(async () => button(editor.root(), 'common.done').props.onPress());
  assert.equal(editor.value().slotDurations[0], 60);
  await editor.open(2, 'start');
  await editor.setActive(false);
  await editor.setActive(true);
  assert.equal(editor.root().findAllByType('TimePicker').length, 0);
});

test('web time editing commits a validated time through the same adjustment logic', async t => {
  const editor = await mountTimeEditor(t, 'web');
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('input').props.onChange({ target: { value: '09:30' } }));
  await act(async () => button(editor.root(), 'common.done').props.onPress());
  assert.equal(editor.value().breaks[0], 15);
  assert.equal(editor.slots()[2].start, '10:50');
});

test('slot count changes preserve previous numbers and protect assigned slots', async t => {
  const editor = await mountTimeEditor(t, 'android', { minimumSlots: 3 });
  assert.equal(button(editor.root(), 'settings.schedule_editor.timing.remove').props.disabled, true);
  await act(async () => button(editor.root(), 'settings.schedule_editor.timing.add').props.onPress());
  assert.deepEqual(editor.value().slotDurations, [45, 60, 80, 80]);
  assert.deepEqual(editor.value().breaks, [10, 20, 20]);
  await act(async () => button(editor.root(), 'settings.schedule_editor.timing.remove').props.onPress());
  assert.deepEqual(editor.value().slotDurations, [45, 60, 80]);
  assert.equal(button(editor.root(), 'settings.schedule_editor.timing.remove').props.disabled, true);
});

test('editing one held slot uses the shared controls and shifts every following slot', async t => {
  const editor = await mountTimeEditor(t, 'android', { slotNumber: 1 });
  const before = editor.slots();
  assert.equal(button(editor.root(), 'settings.schedule_editor.timing.add'), undefined);
  assert.equal(editor.root().findAllByType('Input').length, 2);
  await editor.open(1, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(9, 0)));
  const after = editor.slots();
  assert.deepEqual(after.map(slot => slot.start), ['09:00', '09:55', '11:15']);
  assert.deepEqual(editor.value().slotDurations, [45, 60, 80]);
  assert.deepEqual(editor.value().breaks, [10, 20]);
  assert.equal(after.length, before.length);
});

test('editing a later held slot renders its own fields and leaves earlier slots unchanged', async t => {
  const editor = await mountTimeEditor(t, 'web', { slotNumber: 3 });
  const before = editor.slots();
  assert.equal(editor.root().findAllByType('Input').length, 1);
  await editor.open(3, 'start');
  await act(async () => editor.root().findByType('input').props.onChange({ target: { value: '11:00' } }));
  assert.deepEqual(editor.slots().slice(0, 2), before.slice(0, 2));
  assert.equal(editor.slots()[2].start, '11:00');
  assert.equal(editor.slots()[2].end, '12:20');
});

test('bulk presets and individual gap edits update the same timeline, including zero-minute gaps', async t => {
  const editor = await mountTimeEditor(t);
  await act(async () => editor.root().findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title')).props.onPress());
  await act(async () => editor.root().findByType('Tabs').props.onTabPress('45'));
  assert.deepEqual(editor.value().slotDurations, ['45', '45', '45']);
  const gap = editor.root().findAllByType('Input').find(node => node.props.accessibilityLabel === `${tr('schedule.day_schedule.break')} 1`);
  await act(async () => gap.props.onChangeText('0'));
  assert.equal(editor.slots()[1].start, '09:15');
  assert.equal(editor.slots()[2].start, '10:20');
});

test('a failed reset cannot report success or delete guest schedules, and duplicate confirmations are ignored', async t => {
  let tree, confirmDialog, resolve, calls = 0, guestDeletes = 0;
  const confirmation = new Promise(done => { confirmDialog = done; });
  const haptics = [];
  const Component = load('src/pages/Settings/components/ResetDB.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Platform: { OS: 'ios' } },
    'phosphor-react-native': { Warning: 'Warning' },
    '../../../context/ScheduleProvider': {
      useScheduleData: () => ({ guest: false, global: {}, isLoading: false, lang: 'uk' }),
      useScheduleActions: () => ({ resetApplication() { calls++; return new Promise(done => { resolve = done; }); }, deleteGuestSchedules: async () => guestDeletes++ }),
    },
    '../../../context/AppDialogContext': { useAppDialog: () => ({ confirm: () => confirmation }) },
    '../../../layouts/SettingsScreenLayout': 'Layout', '../../../components/ui/MorphingLoader': 'Loader',
    '../../../utils/haptics': { triggerHaptic: value => haptics.push(value) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => act(async () => tree.unmount()));
  let first, duplicate;
  await act(async () => {
    first = button(tree.root, 'common.wipe').props.onPress();
    duplicate = button(tree.root, 'common.wipe').props.onPress();
  });
  await act(async () => { confirmDialog(true); await first; await duplicate; });
  assert.equal(calls, 1);
  assert.equal(button(tree.root, 'common.wipe').props.disabled, true);
  await act(async () => { resolve(false); });
  assert.equal(guestDeletes, 0);
  assert.ok(!haptics.includes('success'));
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === tr('common.action_failed')));
  assert.equal(button(tree.root, 'common.wipe').props.disabled, false);
});


async function mountScheduleControl(t, name, initialValue, options = {}) {
  const alerts = [];
  const Component = load('src/components/' + name + '.jsx', {
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', StyleSheet: { create: x => x } },
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    '../context/AppDialogContext': { useAppDialog: () => ({ alert: async (options) => alerts.push(options) }) },
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row',
    './ui/AdvancedColorPicker': 'ColorPicker', './ScheduleIcon': 'Icon', './ScheduleIconPickerSheet': 'IconPicker',
    './CalendarSheet/CalendarSheet': 'Calendar', './ui/AppSwitch': 'Switch',
    '../utils/haptics': { triggerHaptic() {} },
    '../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: options.permission || (async () => ({ granted: true })) },
  }).default;
  let value, tree, active = true, update;
  function Controlled() {
    const [draft, setDraft] = React.useState(initialValue);
    value = draft; update = setDraft;
    return React.createElement(Component, { value: draft, onChange: setDraft, themeColors: themes.getColors('dark', 'blue'), lang: 'uk', active });
  }
  await act(async () => { tree = create(React.createElement(Controlled)); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, value: () => value, alerts,
    async update(fn) { await act(async () => update(fn)); },
    async setActive(next) { await act(async () => { active = next; tree.update(React.createElement(Controlled)); }); },
  };
}

test('cycle field retains partial preset digits so twelve weeks can be typed and clamps to the supported range', async t => {
  const editor = await mountScheduleControl(t, 'ScheduleCycleEditor', { repeat: '1', starting_week: '2026-10-12' });
  const input = () => editor.root().findByType('Input');
  await act(async () => input().props.onChangeText('1'));
  assert.equal(input().props.value, '1');
  await act(async () => input().props.onChangeText('12'));
  assert.equal(input().props.value, '12');
  assert.equal(editor.value().repeat, '12');
  await act(async () => input().props.onChangeText('99'));
  await act(async () => input().props.onBlur());
  assert.equal(editor.value().repeat, '12');
  await act(async () => editor.root().findByType('Tabs').props.onTabPress('2'));
  assert.equal(input().props.value, '2');
  await act(async () => editor.root().findAllByType('Row').find(row => row.props.icon === 'CalendarBlank').props.onPress());
  assert.equal(editor.root().findByType('Calendar').props.visible, true);
  await editor.setActive(false);
  await editor.setActive(true);
  assert.equal(editor.root().findByType('Calendar').props.visible, false);
});

test('identity editor applies custom colors and icons without losing schedule fields', async t => {
  const editor = await mountScheduleControl(t, 'ScheduleIdentityEditor', { name: 'Course', color: '#123456', repeat: '2' });
  await act(async () => editor.root().findAllByType('Row').find(row => row.props.label === tr('settings.schedule_editor.color')).props.onPress());
  assert.equal(editor.root().findByType('ColorPicker').props.visible, true);
  await act(async () => editor.root().findByType('ColorPicker').props.onSave('#654321'));
  await act(async () => editor.root().findAllByType('Row').find(row => row.props.label === tr('settings.schedule_editor.icon')).props.onPress());
  await act(async () => editor.root().findByType('IconPicker').props.onSelect('book'));
  assert.deepEqual(editor.value(), { name: 'Course', color: '#654321', repeat: '2', icon: 'book' });
  assert.equal(editor.root().findByType('IconPicker').props.visible, false);
});

test('reminder permission preserves concurrent schedule edits and switching off cancels a pending enable', async t => {
  const permission = gate();
  const editor = await mountScheduleControl(t, 'SchedulePreferencesEditor', { name: 'Before', reminder: { enabled: false } }, { permission: () => permission.promise });
  await act(async () => editor.root().findAllByType('Row')[0].props.onPress());
  const choices = () => editor.root().findAllByType('Button');
  await act(async () => { choices().find(node => node.props.accessibilityLabel === i18n.t('schedule.reminders.before_minutes', 'uk', { minutes: '5' })).props.onPress(); });
  await editor.update(prev => ({ ...prev, name: 'Latest' }));
  await act(async () => { permission.resolve({ granted: true }); await permission.promise; });
  assert.equal(editor.value().name, 'Latest');
  assert.equal(editor.value().reminder.minutesBefore, 5);

  const pending = gate();
  const canceled = await mountScheduleControl(t, 'SchedulePreferencesEditor', { reminder: { enabled: false } }, { permission: () => pending.promise });
  await act(async () => canceled.root().findAllByType('Row')[0].props.onPress());
  await act(async () => { canceled.root().findAllByType('Button').find(node => node.props.accessibilityLabel === i18n.t('schedule.reminders.before_minutes', 'uk', { minutes: '5' })).props.onPress(); });
  await act(async () => canceled.root().findAllByType('Button').find(node => node.props.accessibilityLabel === tr('schedule.reminders.off')).props.onPress());
  await act(async () => { pending.resolve({ granted: true }); await pending.promise; });
  assert.deepEqual(canceled.value().reminder, { enabled: false });
});

test('permission denial leaves reminders off and exposes an actionable explanation', async t => {
  const editor = await mountScheduleControl(t, 'SchedulePreferencesEditor', { reminder: { enabled: false } }, { permission: async () => ({ granted: false, status: 'denied' }) });
  await act(async () => editor.root().findAllByType('Row')[0].props.onPress());
  await act(async () => editor.root().findAllByType('Button').find(node => node.props.accessibilityLabel === i18n.t('schedule.reminders.before_minutes', 'uk', { minutes: '5' })).props.onPress());
  assert.deepEqual(editor.value().reminder, { enabled: false });
  assert.equal(editor.alerts[0].message, tr('schedule.reminders.permission_denied'));
});

test('invalid durations expose a field error and never keep old times enabled', async t => {
  const editor = await mountTimeEditor(t);
  await act(async () => editor.root().findAllByType('Input').find(node => node.props.accessibilityLabel === i18n.t('settings.schedule_editor.timing.lesson_duration', 'uk', { number: 2 })).props.onChangeText('0'));
  assert.ok(editor.root().findAllByType('Text').some(node => node.props.children === tr('settings.schedule_editor.timing.duration_range')));
  const times = editor.root().findAllByType('Button').filter(node => node.props.accessibilityLabel?.includes(': '));
  assert.ok(times.length > 0);
  assert.ok(times.every(node => node.props.disabled && node.props.accessibilityLabel.endsWith('—')));
});

test('onboarding commits shared identity and cycle settings with normalized values', async t => {
  const wizard = await mountOnboarding(t);
  await act(async () => wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === tr('settings.schedule_editor.enter_name')).props.onChangeText('  My course  '));
  await act(async () => wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === tr('settings.week_manager.repeat_label')).props.onChangeText('12'));
  await act(async () => wizard.root().findByType('IconPicker').props.onSelect('book'));
  await act(async () => wizard.root().findByType('ColorPicker').props.onSave('#654321'));
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.equal(wizard.added[0].name, 'My course');
  assert.equal(wizard.added[0].repeat, 12);
  assert.equal(wizard.added[0].icon, 'book');
  assert.equal(wizard.added[0].color, '#654321');
  assert.equal(wizard.added[0].duration, load('src/utils/scheduleTime.js').createScheduleTimingDraft().duration);
});
