const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileModule = (filePath, mocks = new Map()) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => mocks.get(request) || originalRequire(request);
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const fingerprintPath = path.resolve(__dirname, '../src/utils/scheduleDataFingerprint.js');
const fingerprint = compileModule(fingerprintPath);
const syncPath = path.resolve(__dirname, '../src/utils/scheduleSync.js');
const sync = compileModule(syncPath, new Map([
  ['./scheduleDataFingerprint', fingerprint],
]));
const createDefaultDataPath = path.resolve(__dirname, '../src/config/createDefaultData.js');
const createDefaultData = compileModule(createDefaultDataPath).default;
const shareServicePath = path.resolve(__dirname, '../src/services/shareService.js');
const shareService = compileModule(shareServicePath, new Map([
  ['firebase/firestore', {}],
  ['expo-crypto', {}],
  ['../config/firebase', { db: {} }],
]));

const schedule = (overrides = {}) => ({
  id: 'schedule-1',
  name: 'Local',
  version: 3,
  baseVersion: 3,
  lastModified: 100,
  lastSynced: 100,
  subjects: [],
  schedule: [],
  ...overrides,
});

const data = (item, globalOverrides = {}) => ({
  global: {
    version: 2,
    baseVersion: 2,
    lastModified: 80,
    lastSynced: 80,
    fileLibrary: [],
    ...globalOverrides,
  },
  schedules: item ? [item] : [],
});

test('initial data never creates a schedule before onboarding finishes', () => {
  const initialData = createDefaultData();
  assert.deepEqual(initialData.schedules, []);
  assert.equal(initialData.global.currentScheduleId, null);
});

test('friend schedule import accepts a raw code or a complete share link', () => {
  assert.equal(shareService.normalizeShareCodeInput('abc12'), 'ABC12');
  assert.equal(
    shareService.normalizeShareCodeInput('https://planit.app/share/Friend42?source=chat'),
    'FRIEND42',
  );
  assert.throws(
    () => shareService.normalizeShareCodeInput('https://planit.app/not-a-share-link'),
    /invalid_code/,
  );
});

test('fingerprint covers arbitrary and nested user fields', () => {
  const left = data(schedule({ nameKey: 'one', custom: { nested: 1 } }));
  const right = data(schedule({ nameKey: 'two', custom: { nested: 2 } }));
  assert.notEqual(
    fingerprint.getScheduleDataFingerprint(left),
    fingerprint.getScheduleDataFingerprint(right),
  );
});

test('fingerprint ignores Firestore collection order but not in-schedule order', () => {
  const first = data(null);
  first.schedules = [schedule({ id: 'b' }), schedule({ id: 'a' })];
  const second = data(null);
  second.schedules = [schedule({ id: 'a' }), schedule({ id: 'b' })];
  assert.equal(
    fingerprint.getScheduleDataFingerprint(first),
    fingerprint.getScheduleDataFingerprint(second),
  );
});

test('clean local entity accepts the newer cloud entity', () => {
  const local = data(schedule());
  const cloudSchedule = schedule({ name: 'Cloud', version: 4, baseVersion: 4, lastModified: 200, lastSynced: 200 });
  const result = sync.resolveSyncConflict(local, data(cloudSchedule));
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.mergedData.schedules[0].name, 'Cloud');
  assert.equal(result.needsPushToCloud, false);
});

test('equal clean versions with different content become an explicit recovery conflict', () => {
  const localSchedule = schedule({ name: 'Only on device A' });
  const cloudSchedule = schedule({ name: 'Only on device B' });
  const result = sync.resolveSyncConflict(data(localSchedule), data(cloudSchedule));

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].reason, 'same-version-divergence');
  assert.equal(result.mergedData.schedules[0].name, 'Only on device A');
});

test('historically acknowledged local version is not replaced by an older cloud copy', () => {
  const localSchedule = schedule({
    name: 'Acknowledged before failed upload',
    version: 4,
    baseVersion: 4,
    lastModified: 200,
    lastSynced: 200,
  });
  const cloudSchedule = schedule({
    name: 'Older cloud copy',
    version: 3,
    baseVersion: 3,
  });
  const result = sync.resolveSyncConflict(data(localSchedule), data(cloudSchedule));

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].reason, 'cloud-version-behind');
  assert.equal(result.mergedData.schedules[0].name, 'Acknowledged before failed upload');
});

test('dirty local entity with unchanged base remains pending for upload', () => {
  const localSchedule = schedule({ name: 'Offline edit', lastModified: 150 });
  const result = sync.resolveSyncConflict(data(localSchedule), data(schedule()));
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.mergedData.schedules[0].name, 'Offline edit');
  assert.equal(result.needsPushToCloud, true);
});

test('two-device update becomes an explicit conflict and preserves local data', () => {
  const localSchedule = schedule({ name: 'Device A', lastModified: 150 });
  const cloudSchedule = schedule({ name: 'Device B', version: 4, baseVersion: 4, lastModified: 160, lastSynced: 160 });
  const result = sync.resolveSyncConflict(data(localSchedule), data(cloudSchedule));
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].reason, 'concurrent-update');
  assert.equal(result.mergedData.schedules[0].name, 'Device A');
});

test('delete versus edit is never resolved by device clock timestamps', () => {
  const localDelete = schedule({ isDeleted: true, deletedAt: 1000, lastModified: 1000 });
  const cloudEdit = schedule({ name: 'Important cloud edit', version: 4, baseVersion: 4, lastModified: 10, lastSynced: 10 });
  const result = sync.resolveSyncConflict(data(localDelete), data(cloudEdit));
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.mergedData.schedules[0].isDeleted, true);
  assert.equal(result.conflicts[0].cloud.name, 'Important cloud edit');
});

test('compacted remote tombstone does not silently delete a returning device copy', () => {
  const local = data(schedule({ name: 'Recovered after long offline period' }));
  const result = sync.resolveSyncConflict(local, data(null));
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].reason, 'remote-missing');
  assert.equal(result.mergedData.schedules[0].name, 'Recovered after long offline period');
});

test('a never-synced offline schedule is queued for upload when cloud is missing it', () => {
  const local = data(schedule({ version: 0, baseVersion: 0, lastSynced: 0, lastModified: 20 }));
  const result = sync.resolveSyncConflict(local, data(null));
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.needsPushToCloud, true);
  assert.equal(result.mergedData.schedules.length, 1);
});

test('concurrent global changes become a conflict instead of a lossy object spread', () => {
  const local = data(schedule(), { lastModified: 120, fileLibrary: [{ id: 'local-file' }] });
  const cloud = data(schedule(), { version: 3, baseVersion: 3, lastModified: 130, lastSynced: 130, fileLibrary: [{ id: 'cloud-file' }] });
  const result = sync.resolveSyncConflict(local, cloud);
  assert.equal(result.conflicts.some((item) => item.kind === 'global'), true);
  assert.deepEqual(result.mergedData.global.fileLibrary, [{ id: 'local-file' }]);
});

test('missing cloud global document cannot replace valid local settings', () => {
  const local = data(schedule(), {
    theme: ['dark', 'cyan'],
    fileLibrary: [{ id: 'important-local-file' }],
  });
  const cloud = data(schedule(), {
    _cloudMissing: true,
    version: 0,
    baseVersion: 0,
    lastModified: 0,
    lastSynced: 0,
    theme: ['light', 'blue'],
  });
  const result = sync.resolveSyncConflict(local, cloud);
  assert.deepEqual(result.mergedData.global.theme, ['dark', 'cyan']);
  assert.deepEqual(result.mergedData.global.fileLibrary, [{ id: 'important-local-file' }]);
  assert.equal(result.needsPushToCloud, true);
  assert.equal(sync.isSyncEntityDirty(result.mergedData.global), true);
});

test('keep-both resolution creates a new unsynced recovery copy', () => {
  const localSchedule = schedule({ name: 'Device A', lastModified: 150 });
  const cloudSchedule = schedule({ name: 'Device B', version: 4, baseVersion: 4, lastModified: 160, lastSynced: 160 });
  const conflict = sync.resolveSyncConflict(data(localSchedule), data(cloudSchedule)).conflicts[0];
  const resolved = sync.resolveConflictChoice(data(localSchedule), conflict, 'both', () => 'recovered-id', 200);
  assert.equal(resolved.schedules.length, 2);
  assert.equal(resolved.schedules[0].name, 'Device B');
  assert.equal(resolved.schedules[1].id, 'recovered-id');
  assert.equal(resolved.schedules[1].lastSynced, 0);
  assert.equal(resolved.schedules[1].name.includes('Recovered copy'), true);
});

test('logical timestamps remain dirty when the device clock moves backwards', () => {
  const entity = { lastModified: 500, lastSynced: 500 };
  assert.equal(sync.nextLogicalTimestamp(entity, 100), 501);
});

test('cloud subscription starts only after the matching account scope is loaded', () => {
  const base = {
    guest: false,
    userId: 'user-1',
    isLoading: false,
    loadedScopeKey: 'user-1',
  };

  assert.equal(sync.getCloudSubscriptionUserId(base), 'user-1');
  assert.equal(sync.getCloudSubscriptionUserId({ ...base, isLoading: true }), null);
  assert.equal(sync.getCloudSubscriptionUserId({ ...base, loadedScopeKey: null }), null);
  assert.equal(sync.getCloudSubscriptionUserId({ ...base, loadedScopeKey: 'user-2' }), null);
  assert.equal(sync.getCloudSubscriptionUserId({ ...base, guest: true }), null);
  assert.equal(sync.getCloudSubscriptionUserId({ ...base, userId: null }), null);
});

test('schedule provider reacts when cloud subscription readiness changes', () => {
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );
  const subscribeCallIndex = providerSource.indexOf('unsubscribeCloud = subscribeToSchedule');
  const effectDependencyStart = providerSource.indexOf('}, [', subscribeCallIndex);
  const effectDependencyEnd = providerSource.indexOf(']);', effectDependencyStart);
  const dependencies = providerSource.slice(effectDependencyStart, effectDependencyEnd);

  assert.notEqual(subscribeCallIndex, -1);
  assert.notEqual(effectDependencyStart, -1);
  assert.match(dependencies, /cloudSubscriptionUserId/);
});

test('schedule provider owns a screen-independent autosave safety path', () => {
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );
  const safetyPathStart = providerSource.indexOf('Data safety must not depend on AutoSaveManager');
  const safetyPath = providerSource.slice(safetyPathStart, safetyPathStart + 2600);

  assert.notEqual(safetyPathStart, -1);
  assert.match(safetyPath, /cloudSubscriptionUserId/);
  assert.match(safetyPath, /isDirtyRef\.current/);
  assert.match(safetyPath, /await saveNow\(\)/);
  assert.doesNotMatch(safetyPath, /cloudSyncState !== 'synced'/);
});

test('an expected conflict cannot poison the fatal application error state', () => {
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );
  const saveErrorStart = providerSource.indexOf("logSyncDiagnostic('cloud-save-error'");
  const conflictHandlerEnd = providerSource.indexOf('return false;', saveErrorStart);
  const saveErrorHandler = providerSource.slice(saveErrorStart, conflictHandlerEnd);

  assert.notEqual(saveErrorStart, -1);
  assert.match(saveErrorHandler, /const isExpectedConflict = e\?\.code === 'sync\/conflict'/);
  assert.match(saveErrorHandler, /if \(!isExpectedConflict\) \{\s*setError/);
  assert.match(saveErrorHandler, /if \(isExpectedConflict\)/);
  assert.match(saveErrorHandler, /setError\(null\)/);

  const resolveStart = providerSource.indexOf('const handleResolveConflict');
  const resolveEnd = providerSource.indexOf('const dataValue', resolveStart);
  const resolveHandler = providerSource.slice(resolveStart, resolveEnd);
  assert.match(resolveHandler, /if \(resolutionDurable\) setError\(null\)/);
});

test('main layout keeps a usable schedule visible during a transient sync error', () => {
  const layoutSource = fs.readFileSync(
    path.resolve(__dirname, '../src/layouts/MainLayout.jsx'),
    'utf8',
  );

  assert.match(layoutSource, /const hasUsableSchedule = hasSchedules && !!schedule/);
  assert.match(layoutSource, /const hasFatalDataError = !!error && !hasUsableSchedule/);
  assert.doesNotMatch(layoutSource, /isLoading \|\| isInitialSync \|\| error \|\|/);
});

test('confirmed empty state keeps onboarding mounted through transient resyncs', () => {
  const layoutSource = fs.readFileSync(
    path.resolve(__dirname, '../src/layouts/MainLayout.jsx'),
    'utf8',
  );
  const emptyStateStart = layoutSource.indexOf('const canConfirmEmptyState');
  const emptyStateEnd = layoutSource.indexOf('const isBlocking', emptyStateStart);
  const emptyStateLogic = layoutSource.slice(emptyStateStart, emptyStateEnd);
  const latchEffectStart = layoutSource.indexOf('if (hasSchedules) {', emptyStateEnd);
  const latchEffectEnd = layoutSource.indexOf('useEffect(() => {', latchEffectStart + 1);
  const latchEffect = layoutSource.slice(latchEffectStart, latchEffectEnd);

  assert.notEqual(emptyStateStart, -1);
  assert.match(emptyStateLogic, /hasConfirmedEmptyState \|\| canConfirmEmptyState/);
  assert.match(emptyStateLogic, /!hasConfirmedEmptyState[\s\S]*cloudSyncState === 'syncing'/);
  assert.match(layoutSource, /confirmedEmptyScope === emptyStateScope/);
  assert.match(latchEffect, /setConfirmedEmptyScope\(null\)/);
  assert.match(latchEffect, /setConfirmedEmptyScope\(emptyStateScope\)/);
  assert.doesNotMatch(latchEffect, /cloudSyncState === 'syncing'[\s\S]*setConfirmedEmptyScope\(null\)/);
  assert.doesNotMatch(layoutSource, /setTimeout\(\(\) => setShowOnboarding/);
});

test('first-schedule onboarding offers the existing safe import flow', () => {
  const layoutSource = fs.readFileSync(
    path.resolve(__dirname, '../src/layouts/MainLayout.jsx'),
    'utf8',
  );
  const onboardingSource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/Onboarding/OnboardingWizard.jsx'),
    'utf8',
  );
  const importModalSource = fs.readFileSync(
    path.resolve(__dirname, '../src/components/modals/ImportScheduleModal.jsx'),
    'utf8',
  );

  assert.match(layoutSource, /<OnboardingWizard[\s\S]*onImportSchedule=/);
  assert.match(layoutSource, /setImportModalVisible\(true\)/);
  assert.match(onboardingSource, /testID="onboarding-import-schedule"/);
  assert.match(onboardingSource, /onImportSchedule\?\.\(\)/);
  assert.match(importModalSource, /sanitizeImportedSchedule/);
  assert.match(importModalSource, /addSchedule\(newSchedule\)/);
  assert.match(importModalSource, /maxLength=\{256\}/);
});

test('conflict choices are locked while one resolution is being persisted', () => {
  const screenSource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/SyncConflict/SyncConflictScreen.jsx'),
    'utf8',
  );

  assert.match(screenSource, /const \[resolvingId, setResolvingId\] = useState\(null\)/);
  assert.match(screenSource, /disabled=\{isResolving\}/);
  assert.match(screenSource, /await handleResolveConflict\(conflictId, action\)/);
});

test('foregrounding performs a server reconciliation without requiring a restart', () => {
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );
  const appStateStart = providerSource.indexOf('AppState.addEventListener("change"');
  const appStateEnd = providerSource.indexOf('return () => subscription.remove()', appStateStart);
  const appStateHandler = providerSource.slice(appStateStart, appStateEnd);

  assert.notEqual(appStateStart, -1);
  assert.match(appStateHandler, /nextAppState === "active"/);
  assert.match(appStateHandler, /conflictQueueRef\.current\.length === 0/);
  assert.match(appStateHandler, /reloadAllSchedules\(\)/);
});

test('the device that initiates a reset cannot interpret its own cloud snapshots as conflicts', () => {
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );
  const resetStart = providerSource.indexOf('const resetApplication');
  const resetEnd = providerSource.indexOf('const deleteGuestSchedules', resetStart);
  const resetHandler = providerSource.slice(resetStart, resetEnd);
  const lockIndex = resetHandler.indexOf('isCloudSavingRef.current = true');
  const resetCallIndex = resetHandler.indexOf('await resetUserSchedules(user.uid)');
  const successConflictClearIndex = resetHandler.lastIndexOf('conflictQueueRef.current = []');

  assert.notEqual(resetStart, -1);
  assert.match(resetHandler, /if \(resetInProgressRef\.current\) return false/);
  assert.match(resetHandler, /while \(\(isSavingRef\.current \|\| isCloudSavingRef\.current\)/);
  assert.ok(lockIndex >= 0 && lockIndex < resetCallIndex);
  assert.match(resetHandler, /await saveLocalScheduleIfChanged\(newData, user\.uid\)/);
  assert.ok(successConflictClearIndex > resetCallIndex);
  assert.match(resetHandler, /isCloudSavingRef\.current = false/);
  assert.match(resetHandler, /setDeferredCloudRefreshSeq/);
  assert.match(resetHandler, /setCloudSyncState\('synced'\)/);
  assert.match(resetHandler, /setError\(null\)/);
});

test('removing a schedule through a generic updater creates a tombstone', () => {
  const previous = data(schedule());
  const next = sync.markScheduleDataDirty(previous, { ...previous, schedules: [] }, 200);
  assert.equal(next.schedules.length, 1);
  assert.equal(next.schedules[0].isDeleted, true);
  assert.equal(sync.isSyncEntityDirty(next.schedules[0]), true);
});

test('ordinary attachment edits never hard-delete the cloud blob before sync', () => {
  const fileLibrarySource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/Settings/components/FileLibraryScreen.jsx'),
    'utf8',
  );
  const makeLocalOnlyBody = fileLibrarySource.slice(
    fileLibrarySource.indexOf('const makeLocalOnly'),
    fileLibrarySource.indexOf('const confirmMakeLocalOnly'),
  );
  const deleteFileBody = fileLibrarySource.slice(
    fileLibrarySource.indexOf('const deleteFile'),
    fileLibrarySource.indexOf('const confirmDeleteFile'),
  );
  assert.doesNotMatch(makeLocalOnlyBody, /deleteCloudAttachmentObject|deleteStoredAttachment/);
  assert.doesNotMatch(deleteFileBody, /deleteCloudAttachmentObject|deleteStoredAttachment\(/);
  assert.match(deleteFileBody, /deleteLocalAttachmentCache/);

  for (const relativePath of [
    '../src/pages/Tasks/components/TaskEditor.jsx',
    '../src/pages/Schedule/components/LessonEditor.jsx',
    '../src/pages/Schedule/components/LessonViewer.jsx',
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
    assert.match(source, /deleteLocalAttachmentCaches/);
    assert.doesNotMatch(source, /deleteStoredAttachments/);
  }
});
