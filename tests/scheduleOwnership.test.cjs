const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileModule = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const ownership = compileModule(
  path.resolve(__dirname, '../src/utils/scheduleOwnership.js'),
);

test('new guest schedules are offered while account schedules are not marked', () => {
  const guest = ownership.markScheduleAsDeviceLocal({ id: 'guest' });
  const account = ownership.markScheduleAsAccountOwned(guest);

  assert.equal(guest.needsCloudMigration, true);
  assert.equal(ownership.isSchedulePendingCloudMigration(guest), true);
  assert.equal('needsCloudMigration' in account, false);
  assert.equal('cloudMigrationOfferHandled' in account, false);
});

test('legacy guest schedules are offered once, including missing legacy flags', () => {
  assert.equal(ownership.isSchedulePendingCloudMigration({ id: 'missing' }), true);
  assert.equal(ownership.isSchedulePendingCloudMigration({ id: 'false', isCloud: false }), true);
  assert.equal(ownership.isSchedulePendingCloudMigration({ id: 'true', isCloud: true }), false);

  const consumed = ownership.consumeCloudMigrationOffers({
    global: {},
    schedules: [
      { id: 'missing' },
      { id: 'false', isCloud: false },
      { id: 'pending', needsCloudMigration: true },
    ],
  });

  assert.equal(ownership.getPendingCloudMigrationSchedules(consumed).length, 0);
  consumed.schedules.forEach((schedule) => {
    assert.equal(schedule.cloudMigrationOfferHandled, true);
    assert.equal('needsCloudMigration' in schedule, false);
    assert.equal('isCloud' in schedule, false);
  });
});

test('migration moves selected schedules and never reoffers unselected schedules', () => {
  const source = {
    global: {},
    schedules: [
      ownership.markScheduleAsDeviceLocal({ id: 'selected', name: 'A' }),
      ownership.markScheduleAsDeviceLocal({ id: 'unselected', name: 'B' }),
    ],
  };

  const finalized = ownership.finalizeCloudMigration(
    source,
    new Set(['selected']),
    1234,
  );
  const selected = finalized.schedules.find((schedule) => schedule.id === 'selected');
  const unselected = finalized.schedules.find((schedule) => schedule.id === 'unselected');

  assert.equal(selected.isDeleted, true);
  assert.equal(selected.deletedAt, 1234);
  assert.equal(unselected.isDeleted, undefined);
  assert.equal(unselected.cloudMigrationOfferHandled, true);
  assert.equal(ownership.getPendingCloudMigrationSchedules(finalized).length, 0);
});

test('a schedule moved from cloud to the device is not offered for cloud migration again', () => {
  const local = ownership.markScheduleAsDeviceLocal(
    { id: 'was-cloud', version: 4, isCloud: true },
    { offerCloudMigration: false },
  );

  assert.equal(local.cloudMigrationOfferHandled, true);
  assert.equal('isCloud' in local, false);
  assert.equal(ownership.isSchedulePendingCloudMigration(local), false);
});

test('account switches remount the provider and reject stale cloud callbacks', () => {
  const rootSource = fs.readFileSync(path.resolve(__dirname, '../src/Root.jsx'), 'utf8');
  const providerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/context/ScheduleProvider.jsx'),
    'utf8',
  );

  assert.match(rootSource, /key=\{user\?\.uid \|\| \(guest \? 'guest' : 'signed-out'\)\}/);
  assert.match(providerSource, /let subscriptionActive = true/);
  assert.match(providerSource, /if \(!subscriptionActive \|\| !currentLocal\) return/);
  assert.match(providerSource, /subscriptionActive = false/);
});
