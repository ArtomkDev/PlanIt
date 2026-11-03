const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

process.env.TZ = 'Europe/Kyiv';

const compileCommonJsModule = (filePath, mocks = new Map()) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => (
    mocks.has(request) ? mocks.get(request)
      : request === '../utils/scheduleSync' ? syncUtils : originalRequire(request)
  );
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const scheduleCorePath = path.resolve(__dirname, '../src/widgets/scheduleCore.js');
const scheduleTimePath = path.resolve(__dirname, '../src/utils/scheduleTime.js');
const scheduleTime = compileCommonJsModule(scheduleTimePath);
const syncUtils = compileCommonJsModule(path.resolve(__dirname, '../src/utils/scheduleSync.js'), new Map([
  ['./scheduleDataFingerprint', compileCommonJsModule(path.resolve(__dirname, '../src/utils/scheduleDataFingerprint.js'))],
  ['./scheduleIdentity', compileCommonJsModule(path.resolve(__dirname, '../src/utils/scheduleIdentity.js'))],
]));
const scheduleCore = compileCommonJsModule(scheduleCorePath, new Map([
  ['../utils/scheduleTime', scheduleTime],
]));
const taskLessonLinking = compileCommonJsModule(path.resolve(__dirname, '../src/utils/taskLessonLinking.js'), new Map([
  ['./scheduleTime', scheduleTime],
]));
const widgetLinking = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetLinking.js'), new Map([
  ['../utils/taskLessonLinking', taskLessonLinking],
]));

const createSchedule = () => ({
  repeat: 2,
  starting_week: '2026-03-23',
  start_time: '08:30',
  duration: 45,
  breaks: [15],
  subjects: [
    { id: 'math', name: 'Математика', color: '#0A84FF' },
    { id: 'physics', name: 'Фізика', color: '#FF9500' },
  ],
  schedule: [
    {
      week1: [],
      week2: [
        { id: 'lesson-1', subjectId: 'math', startTime: '10:00', endTime: '10:45' },
        { id: 'lesson-2', subjectId: 'physics', startTime: '11:00', endTime: '11:45' },
      ],
    },
  ],
});

test('uses DST-safe calendar weeks and one injected clock snapshot', () => {
  const now = new Date(2026, 2, 30, 10, 15, 30, 0);
  const result = scheduleCore.parseRealSchedule(createSchedule(), now, 0, now);

  assert.equal(result.currentWeekNum, 2);
  assert.equal(result.items[0].subject, 'Математика');
  assert.equal(result.items[0].isCurrent, true);
  assert.equal(result.items[0].minutesLeft, 30);
  assert.equal(result.nextTransitionAt, new Date(2026, 2, 30, 10, 45, 0, 0).getTime());
});

test('switches current lesson exactly at the boundary', () => {
  const now = new Date(2026, 2, 30, 10, 45, 0, 0);
  const result = scheduleCore.parseRealSchedule(createSchedule(), now, 0, now);

  assert.equal(result.items[0].isCurrent, false);
  assert.equal(result.items[1].type, 'break');
  assert.equal(result.items[1].isCurrent, true);
  assert.equal(result.nextTransitionAt, new Date(2026, 2, 30, 11, 0, 0, 0).getTime());
});

test('caps legacy repeat values to the supported schedule cycle', () => {
  const now = new Date(2026, 2, 30, 10, 15, 30, 0);
  const schedule = createSchedule();
  schedule.repeat = 99;

  const result = scheduleCore.parseRealSchedule(schedule, now, 0, now);

  assert.equal(result.totalWeeks, 12);
});

test('builds a presentation-ready model and schedules the next boundary', () => {
  const widgetCorePath = path.resolve(__dirname, '../src/widgets/widgetCore.js');
  const widgetCore = compileCommonJsModule(widgetCorePath, new Map([
    ['./scheduleCore', scheduleCore],
    ['@react-native-async-storage/async-storage', {
      __esModule: true,
      default: {},
    }],
    ['react-native', {
      NativeModules: {},
      Platform: { OS: 'android' },
    }],
  ]));
  const now = new Date(2026, 2, 30, 10, 15, 30, 0);
  const model = widgetCore.buildScheduleWidgetModel({
    schedule: createSchedule(),
    lang: 'uk',
    dateOffset: 0,
    now,
  });

  assert.equal(model.headerText, 'Сьогодні');
  assert.equal(model.dateInfo, '30 березня • Тиждень 2');
  assert.equal(model.items[0].isCurrent, true);
  assert.equal(
    model.nextRefreshAt,
    new Date(2026, 2, 30, 10, 45, 0, 0).getTime() + 750,
  );
});

test('provides localized native labels and row text from the schedule model', () => {
  const widgetCore = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetCore.js'), new Map([
    ['./scheduleCore', scheduleCore],
    ['@react-native-async-storage/async-storage', { __esModule: true, default: {} }],
    ['react-native', { NativeModules: {}, Platform: { OS: 'android' } }],
  ]));
  const model = widgetCore.buildScheduleWidgetModel({
    schedule: createSchedule(), lang: 'uk', now: new Date(2026, 2, 30, 10, 45),
  });
  assert.equal(model.labels.today, 'Сьогодні');
  assert.equal(model.labels.now, 'Зараз');
  assert.equal(model.labels.openSettings, 'Відкрити налаштування');
  assert.match(model.items[0].title, /Математика/);
  assert.match(model.items[0].subtitle, /10:00 - 10:45/);
  assert.equal(model.items[1].title, 'Перерва · 15 хв');
  assert.equal(model.items[1].subtitle, '10:45 - 11:00');
});

test('waits for the native widget commit before completing a headless task', async () => {
  const model = { hasSchedule: true, nextRefreshAt: 1234 };
  const scheduled = [];
  const rendered = [];
  let commit;
  const committed = new Promise((resolve) => { commit = resolve; });
  const renderer = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetRenderer.js'), new Map([
    ['react-native', { NativeModules: { ScheduleWidget: { render: (id, json) => {
      rendered.push([id, JSON.parse(json)]);
      return committed;
    } } } }],
    ['react-native-android-widget', {}],
    ['./widgetCore', {
      getScheduleWidgetSnapshot: async () => model,
      scheduleNextWidgetRefresh: (time) => scheduled.push(time),
    }],
  ]));
  const task = renderer.renderScheduleWidgetTask({ widgetId: 7 });
  await Promise.resolve();
  assert.deepEqual(rendered, [[7, model]]);
  assert.deepEqual(scheduled, []);
  commit();
  assert.equal(await task, model);
  assert.deepEqual(scheduled, [1234]);
});

test('updates multiple widget instances with one storage read and one schedule calculation', async () => {
  let reads = 0;
  let calculations = 0;
  let queries = 0;
  const rendered = [];
  const state = { schedule: createSchedule() };
  const model = { hasSchedule: true, nextRefreshAt: 2345 };
  const renderer = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetRenderer.js'), new Map([
    ['react-native', { NativeModules: { ScheduleWidget: { render: async (id, json) => {
      rendered.push([id, JSON.parse(json)]);
    } } } }],
    ['react-native-android-widget', { getWidgetInfo: async () => {
      queries++;
      return [{ widgetId: 1 }, { widgetId: 2 }];
    } }],
    ['./widgetCore', {
      SCHEDULE_WIDGET_NAME: 'ScheduleWidget',
      readWidgetState: async () => { reads++; return state; },
      getScheduleWidgetSnapshot: async (_now, input) => {
        calculations++;
        assert.equal(input, state);
        return model;
      },
      scheduleNextWidgetRefresh: (time) => assert.equal(time, 2345),
    }],
  ]));
  await renderer.refreshScheduleWidgets();
  assert.equal(reads, 1);
  assert.equal(calculations, 1);
  assert.equal(queries, 1);
  assert.deepEqual(rendered, [[1, model], [2, model]]);
});

test('registers headless widget tasks without loading the application UI', () => {
  const registered = [];
  let appLoads = 0;
  const App = () => null;
  compileCommonJsModule(path.resolve(__dirname, '../index.js'), new Map([
    ['expo', { registerRootComponent: (component) => registered.push(component), isRunningInExpoGo: () => false }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['react', { createElement: (component) => component }],
    ['./App', { get default() { appLoads++; return App; } }],
    ['react-native-android-widget', { registerWidgetTaskHandler: (task) => registered.push(task) }],
    ['./src/widgets/widgetTask', { widgetTask: () => {} }],
    ['./src/widgets/widgetPushTask', {}],
  ]));
  assert.equal(registered.length, 2);
  assert.equal(appLoads, 0);
  assert.equal(registered[0]({}), App);
  assert.equal(appLoads, 1);
});

test('persists widget language and uses it for background rendering', async () => {
  const values = new Map();
  let cacheClears = 0;
  const widgetCore = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetCore.js'), new Map([
    ['./scheduleCore', scheduleCore],
    ['@react-native-async-storage/async-storage', {
      __esModule: true,
      default: {
        setItem: async (key, value) => values.set(key, value),
        getItem: async (key) => values.get(key) ?? null,
        multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null]),
        multiRemove: async (keys) => keys.forEach((key) => values.delete(key)),
      },
    }],
    ['react-native', {
      NativeModules: { ScheduleWidget: { clearCache: async () => { cacheClears++; } } },
      Platform: { OS: 'android' },
    }],
  ]));
  const now = new Date(2026, 2, 30, 10, 15);
  await widgetCore.persistWidgetSchedule(createSchedule(), 'uk-UA');
  assert.equal((await widgetCore.getScheduleWidgetSnapshot(now)).headerText, 'Сьогодні');
  await widgetCore.persistWidgetSchedule(createSchedule(), 'en-US');
  const english = await widgetCore.getScheduleWidgetSnapshot(now);
  assert.equal(english.headerText, 'Today');
  assert.match(english.dateInfo, /March 30.*Week 2/);
  await widgetCore.persistWidgetSchedule(null, 'uk');
  const empty = await widgetCore.readWidgetState();
  assert.equal(empty.schedule, null);
  assert.equal(empty.lang, 'uk');
  assert.equal(cacheClears, 1);
  await widgetCore.clearWidgetData();
  assert.equal(values.has('widget_language'), false);
  assert.equal(cacheClears, 2);
});

test('prebuild installs native widget resources, service and initial layout idempotently', async (context) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planit-widget-'));
  context.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const packageName = 'com.example.planit';
  const sourceDir = path.join(projectRoot, 'app/src/main/java/com/example/planit/widget');
  const xmlDir = path.join(projectRoot, 'app/src/main/res/xml');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'ScheduleWidget.java'), `package ${packageName}.widget;

import com.reactnativeandroidwidget.RNWidgetProvider;

public class ScheduleWidget extends RNWidgetProvider {}`);
  fs.writeFileSync(path.join(xmlDir, 'widgetprovider_schedulewidget.xml'),
    '<appwidget-provider android:initialLayout="@layout/rn_widget" />');
  const plugin = require('../plugins/withWidgetUpdateScheduler');
  const config = plugin({ android: { package: packageName } });
  const modRequest = { platformProjectRoot: projectRoot };
  const input = { ...config, modRequest };
  await config.mods.android.finalized(input);
  const rendererPath = path.join(sourceDir, 'ScheduleWidgetRenderer.java');
  const generated = fs.readFileSync(rendererPath, 'utf8');
  assert.match(generated, /package com\.example\.planit\.widget/);
  assert.doesNotMatch(generated, /__PACKAGE__/);
  assert.match(generated, /BuildConfig.DEBUG \? "\.widget.WidgetLaunchActivity" : "\.MainActivity"/);
  const debugManifest = fs.readFileSync(path.join(projectRoot, 'app/src/debug/AndroidManifest.xml'), 'utf8');
  assert.equal(debugManifest.match(/com.example.planit.widget.WidgetLaunchActivity/g).length, 1);
  const debugLauncher = fs.readFileSync(path.join(projectRoot, 'app/src/debug/java/com/example/planit/widget/WidgetLaunchActivity.java'), 'utf8');
  assert.doesNotMatch(debugLauncher, /__PACKAGE__/);
  assert.match(debugLauncher, /controller.handleIntent\(lesson, null\)/);
  assert.match(debugLauncher, /Intent.ACTION_MAIN/);
  assert.match(debugLauncher, /getAppHost\(\).destroy/);
  assert.equal(fs.existsSync(path.join(sourceDir, 'WidgetLaunchActivity.java')), false, 'Expo launcher integration stays out of release sources');
  assert.match(generated, /PendingIntent.getActivity\(context, widgetId, intent, flags\)/);
  assert.match(generated, /Intent.ACTION_VIEW/);
  assert.match(generated, /appendQueryParameter\("lessonViewIntent"/);
  assert.match(generated, /data.put\("scheduleId", model.optString\("scheduleId"\)\)/);
  assert.match(generated, /setOnClickFillInIntent\(R.id.planit_widget_row, null\)/);
  assert.match(fs.readFileSync(path.join(sourceDir, 'ScheduleWidget.java'), 'utf8'), /extends CoreWidgetProvider/);
  assert.match(fs.readFileSync(path.join(xmlDir, 'widgetprovider_schedulewidget.xml'), 'utf8'),
    /initialLayout="@layout\/planit_schedule_widget"/);
  for (const file of ['planit_schedule_widget.xml', 'planit_schedule_widget_row.xml']) {
    assert.ok(fs.existsSync(path.join(projectRoot, 'app/src/main/res/layout', file)));
  }
  const rowXml = fs.readFileSync(path.join(projectRoot, 'app/src/main/res/layout/planit_schedule_widget_row.xml'), 'utf8');
  assert.match(rowXml, /<FrameLayout\b[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<LinearLayout\s+android:id="@\+id\/planit_widget_row"/,
    'the click target must be nested: Android retains a root fill-in tag when a recycled break clears its listener');
  await config.mods.android.finalized(input);
  assert.equal(fs.readFileSync(rendererPath, 'utf8'), generated);

  const manifest = { manifest: { application: [{ receiver: [{ $: { 'android:name': '.widget.ScheduleWidget' } }] }] } };
  const manifestInput = { ...config, modRequest, modResults: manifest };
  await config.mods.android.manifest(manifestInput);
  await config.mods.android.manifest(manifestInput);
  assert.equal(manifest.manifest.application[0].service.length, 1);
  assert.equal(manifest.manifest.application[0].service[0].$['android:permission'], 'android.permission.BIND_REMOTEVIEWS');
  assert.equal(manifest.manifest.application[0].service[0].$['android:exported'], 'false');
  const actions = manifest.manifest.application[0].receiver[0]['intent-filter'][0].action;
  assert.equal(actions.length, 6);
  assert.ok(actions.every((entry) => typeof entry.$['android:name'] === 'string'));

  const scheduler = fs.readFileSync(path.join(sourceDir, 'WidgetUpdateScheduler.java'), 'utf8');
  assert.match(scheduler, /ScheduleWidgetSyncWorker.class, 15, TimeUnit.MINUTES/);
  assert.match(scheduler, /setRequiredNetworkType\(NetworkType.CONNECTED\)/);
  assert.match(scheduler, /ExistingPeriodicWorkPolicy.KEEP/);
  assert.match(fs.readFileSync(path.join(sourceDir, 'ScheduleWidgetSyncWorker.java'), 'utf8'), /WIDGET_SYNC/);
  const gradle = { ...config, modRequest, modResults: { contents: 'dependencies {\n}' } };
  await config.mods.android.appBuildGradle(gradle);
  await config.mods.android.appBuildGradle(gradle);
  assert.equal(gradle.modResults.contents.match(/androidx.work:work-runtime/g).length, 1);
});

const createWidgetHarness = () => {
  const values = new Map();
  const enabled = [];
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async key => values.delete(key),
    multiGet: async keys => keys.map(key => [key, values.get(key) ?? null]),
    multiRemove: async keys => keys.forEach(key => values.delete(key)),
  };
  const core = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetCore.js'), new Map([
    ['./scheduleCore', scheduleCore],
    ['@react-native-async-storage/async-storage', { __esModule: true, default: storage }],
    ['react-native', { Platform: { OS: 'android' }, NativeModules: {
      ScheduleWidget: { clearCache: async () => {} },
      WidgetUpdateScheduler: { setCloudSyncEnabled: value => enabled.push(value) },
    } }],
  ]));
  return { core, values, storage, enabled };
};

const cleanSchedule = (version = 1) => ({
  ...createSchedule(), id: 'schedule-1', version, lastModified: version, lastSynced: version,
});
const flushWidgetWork = async () => {
  for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve));
};

const createCloudHarness = async (options = {}) => {
  const harness = createWidgetHarness();
  await harness.core.persistWidgetSchedule(options.schedule || cleanSchedule(), 'uk', 'user-1');
  const auth = { currentUser: { uid: 'user-1', emailVerified: true }, authStateReady: async () => {} };
  let reads = 0, renders = 0;
  const registrations = [];
  const sync = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetSync.js'), new Map([
    ['@react-native-async-storage/async-storage', { __esModule: true, default: harness.storage }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['react-native-android-widget', { getWidgetInfo: async () => options.widgets || [{ widgetId: 1 }] }],
    ['./widgetCore', harness.core],
    ['./widgetRenderer', { refreshScheduleWidgets: async () => { renders++; } }],
    ['../config/firebase', { auth }],
    ['../config/firestore', { getWidgetScheduleFromServer: async (...args) => {
      reads++;
      assert.deepEqual(args, ['user-1', 'schedule-1']);
      return options.read ? options.read() : cleanSchedule(2);
    } }],
    ['expo-notifications', { getDevicePushTokenAsync: async () => ({ type: 'android', data: 'native-token' }) }],
    ['../utils/deviceService', { syncWidgetPushRegistration: async (...args) => { registrations.push(args); return true; } }],
  ]));
  return { ...harness, sync, auth, registrations, reads: () => reads, renders: () => renders };
};

test('widget snapshots bind cloud data to an account and preserve legacy guest caches', async () => {
  const { core, values, enabled } = createWidgetHarness();
  values.set('widget_active_schedule', JSON.stringify(cleanSchedule()));
  assert.equal((await core.readWidgetState()).userId, null);
  await core.persistWidgetSchedule(cleanSchedule(), 'uk', 'user-1');
  assert.equal((await core.readWidgetState()).userId, 'user-1');
  assert.equal(enabled.at(-1), true);
  values.set('widget_cloud_check', '{}');
  await core.clearWidgetData();
  assert.equal(enabled.at(-1), false);
  assert.equal(values.has('widget_cloud_check'), false);
  values.set('widget_active_schedule', '{corrupt');
  await core.persistWidgetSchedule(cleanSchedule(), 'uk', 'user-1');
  assert.equal((await core.readWidgetState()).schedule.id, 'schedule-1');
});

test('cloud commits cannot overwrite a foreground edit or a changed widget selection', async () => {
  const { core } = createWidgetHarness();
  await core.persistWidgetSchedule(cleanSchedule(), 'uk', 'user-1');
  const initial = await core.readWidgetState();
  await core.setWidgetSelectedScheduleId('other');
  assert.equal(await core.applyWidgetCloudSchedule(initial, cleanSchedule(2)), false);
  const selected = await core.readWidgetState();
  await core.persistWidgetSchedule({ ...cleanSchedule(), name: 'Local edit', lastModified: 10 }, 'uk', 'user-1');
  assert.equal(await core.applyWidgetCloudSchedule(selected, cleanSchedule(2)), false);
  assert.equal((await core.readWidgetState()).schedule.name, 'Local edit');
});

test('foreground startup cannot downgrade a newer widget snapshot but local edits take priority', async () => {
  const { core } = createWidgetHarness();
  await core.persistWidgetSchedule(cleanSchedule(3), 'uk', 'user-1');
  await core.persistWidgetSchedule(cleanSchedule(1), 'uk', 'user-1');
  assert.equal((await core.readWidgetState()).schedule.version, 3);
  await core.persistWidgetSchedule({ ...cleanSchedule(1), name: 'Offline edit', lastModified: 4 }, 'uk', 'user-1');
  assert.equal((await core.readWidgetState()).schedule.name, 'Offline edit');
});

test('background cloud sync restores auth and refreshes the selected schedule without the UI', async () => {
  const harness = await createCloudHarness();
  let restored = false;
  harness.auth.authStateReady = async () => { restored = true; };
  assert.equal(await harness.sync.syncWidgetFromCloud(), true);
  assert.equal(restored, true);
  assert.equal((await harness.core.readWidgetState()).schedule.version, 2);
  assert.equal(harness.renders(), 1);
  assert.equal(await harness.sync.syncWidgetFromCloud(), false);
  assert.equal(harness.reads(), 1);
});

test('push invalidations bypass polling throttle and ignore duplicates, old versions and other schedules', async () => {
  let version = 2;
  const harness = await createCloudHarness({ read: async () => cleanSchedule(version) });
  await harness.sync.syncWidgetFromCloud();
  version = 3;
  const push = { force: true, userId: 'user-1', scheduleId: 'schedule-1', version: '3' };
  assert.equal(await harness.sync.syncWidgetFromCloud(push), true);
  assert.equal(await harness.sync.syncWidgetFromCloud(push), false);
  await harness.sync.syncWidgetFromCloud({ ...push, userId: 'other', version: '4' });
  await harness.sync.syncWidgetFromCloud({ ...push, scheduleId: 'other', version: '4' });
  assert.equal(harness.reads(), 2);
  assert.equal((await harness.core.readWidgetState()).schedule.version, 3);
});

test('simultaneous widget instances share a cloud read and forced updates recheck after it', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const harness = await createCloudHarness({ read: () => ++calls === 1 ? pending : cleanSchedule(3) });
  const first = harness.sync.syncWidgetFromCloud();
  const second = harness.sync.syncWidgetFromCloud();
  const push = harness.sync.syncWidgetFromCloud({ force: true, version: 3 });
  await flushWidgetWork();
  assert.equal(harness.reads(), 1);
  release(cleanSchedule(2));
  await Promise.all([first, second, push]);
  assert.equal(harness.reads(), 2);
  assert.equal((await harness.core.readWidgetState()).schedule.version, 3);
});

test('offline failures and unsynced edits retain the last usable widget data', async () => {
  const offline = await createCloudHarness({ read: async () => { throw Object.assign(new Error('Offline'), { code: 'unavailable' }); } });
  assert.equal(await offline.sync.syncWidgetFromCloud(), false);
  assert.equal((await offline.core.readWidgetState()).schedule.version, 1);
  const dirty = await createCloudHarness({ schedule: { ...cleanSchedule(), lastModified: 5 } });
  assert.equal(await dirty.sync.syncWidgetFromCloud({ force: true }), false);
  assert.equal(dirty.reads(), 1);
  assert.equal((await dirty.core.readWidgetState()).schedule.lastModified, 5);
  assert.equal(dirty.renders(), 0);
  const push = { force: true, version: 3 };
  await offline.sync.syncWidgetFromCloud(push);
  await offline.sync.syncWidgetFromCloud(push);
  assert.equal(offline.reads(), 2);
});

test('deleted schedules and revoked sessions clear the widget without resurrecting data', async () => {
  for (const read of [async () => null, async () => { throw Object.assign(new Error('Revoked'), { code: 'device/revoked' }); }]) {
    const harness = await createCloudHarness({ read });
    assert.equal(await harness.sync.syncWidgetFromCloud(), true);
    assert.equal((await harness.core.readWidgetState()).schedule, null);
    assert.equal(harness.enabled.at(-1), false);
  }
  const dirtyRevoked = await createCloudHarness({
    schedule: { ...cleanSchedule(), lastModified: 5 },
    read: async () => { throw Object.assign(new Error('Revoked'), { code: 'device/revoked' }); },
  });
  assert.equal(await dirtyRevoked.sync.syncWidgetFromCloud(), true);
  assert.equal((await dirtyRevoked.core.readWidgetState()).schedule, null);
});

test('an account switch during a cloud request cannot commit the previous account data', async () => {
  let release;
  const harness = await createCloudHarness({ read: () => new Promise(resolve => { release = resolve; }) });
  const syncing = harness.sync.syncWidgetFromCloud();
  await flushWidgetWork();
  harness.auth.currentUser = { uid: 'user-2', emailVerified: true };
  await harness.core.persistWidgetSchedule({ ...cleanSchedule(), name: 'Other account' }, 'uk', 'user-2');
  release(cleanSchedule(2));
  assert.equal(await syncing, false);
  assert.equal((await harness.core.readWidgetState()).schedule.name, 'Other account');
});

test('a slow initial cloud read can complete within the cold-start request budget', async context => {
  const harness = await createCloudHarness({
    read: () => new Promise(resolve => setTimeout(() => resolve(cleanSchedule(2)), 9000)),
  });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const syncing = harness.sync.syncWidgetFromCloud();
  await flushWidgetWork();
  context.mock.timers.tick(9001);
  assert.equal(await syncing, true);
  assert.equal((await harness.core.readWidgetState()).schedule.version, 2);
});

test('timed out cloud reads never write late results into the widget cache', async context => {
  let release;
  const harness = await createCloudHarness({ read: () => new Promise(resolve => { release = resolve; }) });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const syncing = harness.sync.syncWidgetFromCloud();
  await flushWidgetWork();
  context.mock.timers.tick(12001);
  assert.equal(await syncing, false);
  release(cleanSchedule(2));
  await flushWidgetWork();
  assert.equal((await harness.core.readWidgetState()).schedule.version, 1);
  assert.equal(harness.renders(), 0);
});

test('push registration uses native tokens only for the current account and installed widgets', async () => {
  const installed = await createCloudHarness();
  await installed.sync.syncWidgetPushSubscription();
  assert.deepEqual(installed.registrations, [['user-1', 'schedule-1', 'native-token']]);
  await installed.sync.syncWidgetPushSubscription();
  assert.equal(installed.registrations.length, 1);
  installed.auth.currentUser = null;
  await installed.sync.syncWidgetPushSubscription();
  assert.equal(installed.registrations.length, 1);
  const removed = await createCloudHarness({ widgets: [] });
  await removed.sync.syncWidgetPushSubscription();
  assert.deepEqual(removed.registrations, [['user-1', null, null]]);
});

test('notification tasks process only widget invalidations and preserve the native payload contract', async () => {
  let task;
  const updates = [];
  compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetPushTask.js'), new Map([
    ['expo', { requireOptionalNativeModule: () => ({}) }],
    ['react-native', { AppRegistry: { registerHeadlessTask: () => {} } }],
    ['expo-task-manager', { defineTask: (_name, handler) => { task = handler; } }],
    ['expo-notifications', { registerTaskAsync: async () => {}, addPushTokenListener: () => {} }],
    ['./widgetSync', { syncWidgetFromCloud: async value => updates.push(value) }],
  ]));
  await task({ data: { data: { type: 'account_login' } } });
  await task({ data: { data: { type: 'widget_schedule_changed' } } });
  await task({ data: { data: { type: 'widget_schedule_changed', userId: 'user-1', scheduleId: 'schedule-1', version: '5' } } });
  assert.deepEqual(updates, [{ force: true, userId: 'user-1', scheduleId: 'schedule-1', version: '5' }]);
});

test('notification keep-alive does not finish before TaskService completes asynchronous work', async () => {
  const providers = new Map([['expo-task-manager', () => async () => {}]]);
  compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetPushTask.js'), new Map([
    ['expo', { requireOptionalNativeModule: () => ({}) }],
    ['react-native', { AppRegistry: { registerHeadlessTask: (name, provider) => providers.set(name, provider) } }],
    ['expo-task-manager', { defineTask: () => {} }],
    ['expo-notifications', { registerTaskAsync: async () => {}, addPushTokenListener: () => {} }],
    ['./widgetSync', {}],
  ]));
  let finished = false;
  providers.get('expo-task-manager')()().then(() => { finished = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(finished, false);
});

test('older development builds without ExpoTaskManager still load widget handlers', () => {
  let taskManagerLoads = 0;
  compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetPushTask.js'), new Map([
    ['expo', { requireOptionalNativeModule: () => null }],
    ['react-native', {}],
    ['expo-task-manager', { get defineTask() { taskManagerLoads++; throw new Error('Missing native module'); } }],
    ['expo-notifications', { addPushTokenListener: () => {} }],
    ['./widgetSync', {}],
  ]));
  assert.equal(taskManagerLoads, 0);
});

test('native navigation caches nearby days and expires on the next today boundary even while browsing ahead', () => {
  const { core } = createWidgetHarness();
  const now = new Date(2026, 2, 30, 10, 15);
  const snapshot = core.buildScheduleWidgetSnapshot({
    schedule: cleanSchedule(), dateOffset: 5, lang: 'uk', now, nativeCacheGeneration: 7,
  });
  assert.equal(Object.keys(snapshot.dayModels).length, 29);
  assert.equal(snapshot.dayModels[0].headerText, 'Сьогодні');
  assert.equal(snapshot.dayModels[0].scheduleId, 'schedule-1');
  assert.equal(snapshot.dayModels[1].headerText, 'Завтра');
  assert.equal(snapshot.cacheExpiresAt, new Date(2026, 2, 30, 10, 45).getTime() + 750);
  assert.equal(snapshot.nextRefreshAt, snapshot.cacheExpiresAt);
  assert.equal(snapshot.baseDate, '2026-03-30');
  assert.equal(snapshot.cacheGeneration, 7);
  assert.equal(snapshot.dayModels[0].items[0].isCurrent, true);
  assert.equal(snapshot.dayModels[1].isTodayActive, false);
});

test('native navigation uses calendar days across DST and always includes a return to today', () => {
  const { core } = createWidgetHarness();
  const snapshot = core.buildScheduleWidgetSnapshot({
    schedule: cleanSchedule(), dateOffset: 40, lang: 'en', now: new Date(2026, 2, 28, 12),
  });
  assert.equal(Object.keys(snapshot.dayModels).length, 30);
  assert.equal(new Date(snapshot.dayModels[40].targetDateIso).getDate(), 7);
  assert.equal(snapshot.dayModels[0].isTodayActive, true);
  const dst = core.buildScheduleWidgetSnapshot({ schedule: cleanSchedule(), now: new Date(2026, 2, 28, 12) });
  assert.equal(new Date(dst.dayModels[1].targetDateIso).getHours(), 12);
  assert.equal(new Date(dst.dayModels[2].targetDateIso).getHours(), 12);
});

test('Android reads the native navigation state and avoids writing a second date offset', async () => {
  const values = new Map([['widget_date_offset', '3']]);
  const core = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetCore.js'), new Map([
    ['./scheduleCore', scheduleCore],
    ['@react-native-async-storage/async-storage', { __esModule: true, default: {
      multiGet: async keys => keys.map(key => [key, values.get(key) ?? null]),
    } }],
    ['react-native', { Platform: { OS: 'android' }, NativeModules: { ScheduleWidget: {
      getNavigationState: async legacy => { assert.equal(legacy, 3); return { dateOffset: -2, cacheGeneration: 4 }; },
      updateDateOffset: async action => { assert.equal(action, 'NEXT_DAY'); return -1; },
    } } }],
  ]));
  const state = await core.readWidgetState();
  assert.equal(state.dateOffset, -2);
  assert.equal(state.nativeCacheGeneration, 4);
  assert.equal(await core.updateWidgetOffset('NEXT_DAY'), -1);
  assert.equal(values.get('widget_date_offset'), '3');
});

test('widget actions paint cached data before cloud work and keep navigation independent of the network', async () => {
  const events = [];
  const task = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetTask.js'), new Map([
    ['./widgetLinking', widgetLinking],
    ['expo-linking', { openURL: async () => events.push('open') }],
    ['./widgetCore', {
      recordWidgetIntent: async () => events.push('intent'),
      updateWidgetOffset: async () => events.push('offset'),
    }],
    ['./widgetRenderer', {
      renderScheduleWidgetTask: async () => events.push('cached'),
      refreshScheduleWidgets: async () => events.push('all'),
    }],
    ['./widgetSync', {
      syncWidgetFromCloud: async () => { events.push('cloud'); return false; },
      syncWidgetPushSubscription: async () => events.push('subscription'),
    }],
  ])).widgetTask;
  await task({ widgetAction: 'WIDGET_UPDATE', widgetInfo: { widgetId: 1 } });
  assert.deepEqual(events.splice(0), ['cached', 'cloud', 'subscription']);
  await task({ widgetAction: 'WIDGET_CLICK', clickAction: 'NEXT_DAY', widgetInfo: { widgetId: 1 } });
  assert.deepEqual(events.splice(0), ['offset', 'cached']);
  await task({ widgetAction: 'WIDGET_SYNC' });
  assert.deepEqual(events.splice(0), ['cloud', 'all', 'subscription']);
  await task({ widgetAction: 'WIDGET_DELETED' });
  assert.deepEqual(events.splice(0), ['subscription']);
});

test('widget lesson links restore nested navigation for cold and warm launches, including repeated taps', () => {
  const { getStateFromPath, getActionFromState } = require('@react-navigation/core');
  const mainLayout = compileCommonJsModule(path.resolve(__dirname, '../src/navigation/mainLayoutLinking.js'), new Map([
    ['../widgets/widgetLinking', widgetLinking],
  ])).default;
  const config = { screens: { MainLayout: mainLayout, Auth: 'auth', PasswordReset: 'password-reset', LegalDocument: 'legal/:documentType' } };
  const url = widgetLinking.createWidgetLessonUrl({ targetDateStr: '2026-10-29T22:30:00.000Z', lessonIndex: 0 }, 'schedule / україна');
  const parse = () => getStateFromPath(url.slice('planit://'.length), config);
  const state = parse();
  const route = state.routes[0].state.routes[0].state.routes[0];
  assert.deepEqual([state.routes[0].name, state.routes[0].state.routes[0].name, route.name], ['MainLayout', 'Tabs', 'ScheduleTab']);
  assert.deepEqual(route.params.lessonViewIntent.lessonRef, { scheduleId: 'schedule / україна', date: '2026-10-30', lessonIndex: 0 });
  const action = getActionFromState(state, config);
  assert.equal(action.type, 'NAVIGATE');
  assert.equal(action.payload.params.screen, 'Tabs');
  assert.equal(action.payload.params.params.screen, 'ScheduleTab');
  assert.notEqual(parse().routes[0].state.routes[0].state.routes[0].params.lessonViewIntent.requestId, route.params.lessonViewIntent.requestId);
  for (const path of ['', 'share/EXAMPLE123', 'lesson-view/old-id']) {
    assert.equal(getStateFromPath(path, config).routes[0].name, 'MainLayout', path);
  }
  assert.equal(getStateFromPath('auth', config).routes[0].name, 'Auth');
  assert.equal(getStateFromPath('password-reset?oobCode=example', config).routes[0].name, 'PasswordReset');
  assert.equal(getStateFromPath('legal/privacy', config).routes[0].name, 'LegalDocument');
});

test('widget lesson links reject malformed data and resolve the intended day and slot', () => {
  for (const value of ['broken', 'null', '{}', JSON.stringify({ scheduleId: 's', targetDateStr: 'bad-date', lessonIndex: 0 }),
    JSON.stringify({ scheduleId: 's', targetDateStr: '2026-10-30', lessonIndex: -1 }),
    JSON.stringify({ scheduleId: 's', targetDateStr: '2026-10-30', lessonIndex: '0' })]) {
    assert.equal(widgetLinking.parseWidgetLessonIntent(value), undefined);
  }
  const data = { scheduleId: 'schedule-1', targetDateStr: '2026-03-30T07:15:00Z', lessonIndex: 1 };
  const intent = widgetLinking.parseWidgetLessonIntent(JSON.stringify(data));
  const occurrence = taskLessonLinking.resolveOccurrenceFromLessonRef(cleanSchedule(), intent.lessonRef);
  assert.equal(occurrence.subjectId, 'physics');
  assert.equal(occurrence.lessonIndex, 1);
});

test('older widget lesson clicks use the same deep link without a competing storage consumer', async () => {
  let opened;
  const task = compileCommonJsModule(path.resolve(__dirname, '../src/widgets/widgetTask.js'), new Map([
    ['./widgetLinking', widgetLinking],
    ['./widgetCore', { readWidgetState: async () => ({ schedule: { id: 'widget-schedule' } }), recordWidgetIntent: async () => assert.fail('lesson clicks must not use storage') }],
    ['expo-linking', { openURL: async url => { opened = url; } }],
    ['./widgetRenderer', {}], ['./widgetSync', {}],
  ])).widgetTask;
  await task({ widgetAction: 'WIDGET_CLICK', clickAction: 'OPEN_LESSON', clickActionData: { targetDateStr: '2026-10-30T12:00:00Z', lessonIndex: 2 } });
  const intent = widgetLinking.parseWidgetLessonIntent(new URL(opened).searchParams.get('lessonViewIntent'));
  assert.equal(intent.scheduleId, 'widget-schedule');
  assert.equal(intent.lessonRef.date, '2026-10-30');
  assert.equal(intent.lessonRef.lessonIndex, 2);
});
