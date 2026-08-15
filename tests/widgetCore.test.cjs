const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
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
    mocks.has(request) ? mocks.get(request) : originalRequire(request)
  );
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const scheduleCorePath = path.resolve(__dirname, '../src/widgets/scheduleCore.js');
const scheduleCore = compileCommonJsModule(scheduleCorePath);

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

test('builds a presentation-ready model and schedules the next boundary', () => {
  const widgetCorePath = path.resolve(__dirname, '../src/widgets/widgetCore.js');
  const widgetCore = compileCommonJsModule(widgetCorePath, new Map([
    ['./scheduleCore', scheduleCore],
    ['../utils/dataCodec', {
      decodeStorageValue: () => null,
      encodeStorageValue: () => '',
      isEncodedStorageValue: () => true,
    }],
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
    dateOffset: 0,
    widgetInfo: { width: 320, height: 400 },
    now,
  });

  assert.equal(model.headerText, 'Сьогодні');
  assert.equal(model.dateInfo, '30 березня • Тиждень 2');
  assert.equal(model.items[0].isCurrent, true);
  assert.equal(model.width, 320);
  assert.equal(
    model.nextRefreshAt,
    new Date(2026, 2, 30, 10, 45, 0, 0).getTime() + 750,
  );
});

test('keeps the Android widget as a presentation-only component', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(__dirname, '../src/widgets/ScheduleWidget.jsx'),
    'utf8',
  );
  const taskSource = fs.readFileSync(
    path.resolve(__dirname, '../src/widgets/widgetTask.js'),
    'utf8',
  );

  assert.match(widgetSource, /export function ScheduleWidget\(\{ model \}\)/);
  assert.doesNotMatch(widgetSource, /parseRealSchedule|new Date\(/);
  assert.match(taskSource, /renderScheduleWidgetTask\(widgetInfo, renderWidget\)/);
  assert.doesNotMatch(taskSource, /requestWidgetUpdate|isRendering/);
});
