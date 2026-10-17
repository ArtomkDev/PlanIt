const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

const root = path.resolve(__dirname, '..');
global.IS_REACT_ACT_ENVIRONMENT = true;

function load(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (name === 'expo-crypto') return { randomUUID };
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(path.relative(root, resolved), mocks);
  };
  mod._compile(babel.transformFileSync(filename, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code, filename);
  return mod.exports;
}

const { createCollegeTestSchedule } = load('src/config/development/collegeSchedule.js');
const { buildScheduleSlots } = load('src/utils/scheduleTime.js');
const { sanitizeSharedSchedule } = load('src/utils/scheduleValidation.js');
const { SUBJECT_ICONS } = load('src/config/subjectIcons.js', {
  'phosphor-react-native': new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }),
});
const { getLessonColors } = load('src/utils/scheduleColors.js');
const { createPerceptualGradientStops, getReadableForeground } = load('src/utils/gradientColors.js');
const tinycolor = require('tinycolor2');

test('college timetable retains both alternating weeks, all six bell slots and valid references', () => {
  const schedule = createCollegeTestSchedule();
  assert.equal(schedule.repeat, 2);
  assert.equal(schedule.subjects.length, 7);
  assert.equal(schedule.teachers.length, 7);
  assert.equal(schedule.links.length, 8);
  assert.equal(new Date(schedule.starting_week).getDay(), 1);
  assert.equal(new Date(schedule.starting_week).getUTCDay(), 1);
  assert.deepEqual(buildScheduleSlots(schedule.start_time, schedule.duration, schedule.breaks, schedule.slotDurations)
    .map(slot => [slot.start, slot.end]), [
    ['08:30', '09:50'], ['10:00', '11:20'], ['11:40', '13:00'],
    ['13:10', '14:30'], ['14:40', '16:00'], ['16:10', '17:30'],
  ]);
  assert.deepEqual(schedule.schedule.map(day => [day.week1.length, day.week2.length]), [
    [0, 0], [3, 4], [4, 3], [2, 2], [2, 2], [3, 3], [0, 0],
  ]);
  const lessons = schedule.schedule.flatMap(day => [...day.week1, ...day.week2]);
  assert.equal(new Set(lessons.map(lesson => lesson.recurrence.id)).size, 15);
  for (const lesson of lessons) {
    assert.ok(schedule.subjects.some(subject => subject.id === lesson.subjectId));
    for (const id of lesson.teachers || []) assert.ok(schedule.teachers.some(teacher => teacher.id === id));
    for (const id of lesson.links || []) assert.ok(schedule.links.some(link => link.id === id));
  }
  assert.equal(sanitizeSharedSchedule(schedule).schedule.flatMap(day => [...day.week1, ...day.week2]).length, 28);
});

test('source date conditions, streams, meeting credentials and distinct Saturday teacher/link are preserved', () => {
  const schedule = createCollegeTestSchedule();
  const catchUp = schedule.schedule[3].week1[0];
  assert.match(catchUp.note, /01\.10, 07\.10, 14\.10, 21\.10/);
  assert.match(catchUp.note, /738 8432 4105\nPasscode: dg0mqF/);
  assert.equal(schedule.schedule[2].week1.at(-1).note, 'Потік С7');
  const saturday = schedule.schedule[5].week1.at(-1);
  assert.equal(saturday.note, 'потік ОНС14\nз 17.10.2026');
  assert.equal(schedule.teachers.find(teacher => teacher.id === saturday.teachers[0]).name, 'Яфонкін Анатолій Олексійович');
  assert.match(schedule.links.find(link => link.id === saturday.links[0]).url, /nubip-edu-ua\.zoom\.us\/j\/9907610585\?pwd=/);
  for (const link of schedule.links) assert.equal(new URL(link.url).protocol, 'https:');
  const other = createCollegeTestSchedule();
  assert.notEqual(other.id, schedule.id);
  assert.equal(other.subjects.some(subject => schedule.subjects.some(existing => existing.id === subject.id)), false);
});

test('college lessons inherit valid subject icons and readable gradients across both weeks and sharing', () => {
  const schedule = createCollegeTestSchedule();
  const shared = sanitizeSharedSchedule(schedule);
  assert.equal(schedule.gradients.length, schedule.subjects.length);
  assert.equal(new Set(schedule.subjects.map(subject => subject.icon)).size, schedule.subjects.length);
  assert.equal(new Set(schedule.gradients.map(gradient => JSON.stringify(gradient.colors))).size, schedule.subjects.length);
  for (const model of [schedule, shared]) {
    for (const subject of model.subjects) {
      assert.ok(Object.hasOwn(SUBJECT_ICONS, subject.icon));
      assert.equal(subject.typeColor, 'gradient');
      const gradient = model.gradients.find(item => item.id === subject.colorGradient);
      assert.ok(gradient, `${subject.name}: gradient reference must resolve`);
      assert.equal(gradient.type, 'linear');
      assert.deepEqual(gradient.colors.map(stop => stop.position), [0, 1]);
      assert.equal(subject.color, gradient.colors[0].color);
      const foreground = getReadableForeground(gradient);
      for (const stop of createPerceptualGradientStops(gradient)) {
        assert.ok(tinycolor.readability(foreground, stop.color) >= 4.5, `${subject.name}: text must stay readable throughout the gradient`);
      }
    }
    for (const lesson of model.schedule.flatMap(day => [...day.week1, ...day.week2])) {
      const subject = model.subjects.find(item => item.id === lesson.subjectId);
      assert.equal(getLessonColors(lesson, model).activeGrad?.id, subject.colorGradient);
    }
  }
  const other = createCollegeTestSchedule();
  assert.equal(other.gradients.some(gradient => schedule.gradients.some(existing => existing.id === gradient.id)), false);
  other.gradients[0].colors[0].color = '#000000';
  assert.notEqual(schedule.gradients[0].colors[0].color, '#000000');
});

for (const lang of ['uk', 'en']) {
  test(`${lang}: dev button creates and selects once through ScheduleProvider actions without authentication`, () => {
    const added = [];
    let selected;
    let onCreated = 0;
    const Button = load('src/components/development/CreateTestScheduleButton.jsx', {
      'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
      'phosphor-react-native': { Flask: () => null },
      '../../context/ScheduleProvider': {
        useScheduleData: () => ({ lang, guest: true, user: null }),
        useScheduleActions: () => ({ addSchedule: schedule => added.push(schedule), setGlobalDraft: update => { selected = update({}).currentScheduleId; } }),
      },
      '../ui/SettingsKit/SettingsRow': props => React.createElement('SettingsRow', props),
    }).default;
    let renderer;
    act(() => { renderer = create(React.createElement(Button, { themeColors: {}, onCreated: () => { onCreated += 1; } })); });
    const press = renderer.root.findByType('SettingsRow').props.onPress;
    act(() => { press(); press(); });
    assert.equal(added.length, 1);
    assert.equal(selected, added[0].id);
    assert.equal(onCreated, 1);
    assert.equal(renderer.root.findByType('SettingsRow').props.disabled, true);
    act(() => renderer.unmount());
  });
}

test('release resolver refuses accidental dev imports, including assets, but allows them in dev', () => {
  const { resolveRequest } = require('../metro.config.js').resolver;
  for (const dev of [false, undefined, true]) {
    for (const type of ['sourceFile', 'assetFiles']) {
      const filePath = path.join(root, 'src/config/development/collegeSchedule.js');
      const resolution = type === 'sourceFile' ? { type, filePath } : { type, filePaths: [filePath] };
      const resolve = () => resolveRequest({ dev, resolveRequest: () => resolution }, './fixture', 'android');
      if (dev === true) assert.equal(resolve(), resolution);
      else assert.throws(resolve, /Development modules must be removed/);
    }
  }
  const regular = { type: 'sourceFile', filePath: path.join(root, 'src/config/themes.js') };
  assert.equal(resolveRequest({ dev: false, resolveRequest: () => regular }, './themes', 'web'), regular);
});

test('real Expo Metro transform removes dev dependencies and button code from all release platforms', async () => {
  const config = require('expo/metro-config').getDefaultConfig(root);
  const worker = require('../node_modules/@expo/metro-config/build/transform-worker/metro-transform-worker.js');
  for (const platform of ['android', 'ios', 'web']) {
    for (const dev of [false, true]) {
      for (const filename of ['src/pages/Onboarding/OnboardingWizard.jsx', 'src/pages/Settings/components/ScheduleSwitcher.jsx']) {
        const result = await worker.transform(config.transformer, root, filename, fs.readFileSync(path.join(root, filename)), {
          dev, hot: false, minify: !dev, platform, type: 'module', inlineRequires: false,
          experimentalImportSupport: false, customTransformOptions: {}, unstable_transformProfile: 'hermes-stable',
        });
        assert.equal(result.dependencies.some(dependency => dependency.name.includes('/development/')), dev, `${platform}, ${dev}, ${filename}`);
        if (!dev) assert.ok(result.output.every(output => !output.data.code.includes('CreateTestScheduleButton')));
      }
    }
  }
});
