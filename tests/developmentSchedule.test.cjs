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
const { createUniversityContentSchedule } = load('src/config/development/universityContentSchedule.js');
const { buildScheduleSlots } = load('src/utils/scheduleTime.js');
const { getLocalISODate, resolveOccurrenceFromLessonRef } = load('src/utils/taskLessonLinking.js');
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

for (const [name, createSchedule] of [
  ['college', createCollegeTestSchedule],
  ['university content', createUniversityContentSchedule],
  ['English content', date => createUniversityContentSchedule(date, 'en')],
]) {
  test(`${name} lessons inherit valid subject icons and readable gradients across both weeks and sharing`, () => {
    const schedule = createSchedule();
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
    const other = createSchedule();
    assert.equal(other.gradients.some(gradient => schedule.gradients.some(existing => existing.id === gradient.id)), false);
    other.gradients[0].colors[0].color = '#000000';
    assert.notEqual(schedule.gradients[0].colors[0].color, '#000000');
  });
}

test('university content fills both weeks with four distinct subjects per weekday and fresh editable data', () => {
  const now = new Date(2026, 9, 26, 15);
  const schedule = createUniversityContentSchedule(now);
  assert.equal(schedule.name, 'Навчання · Група А');
  assert.equal(schedule.subjects.length, 7);
  assert.equal(schedule.teachers.length, 7);
  assert.equal(schedule.links.length, 7);
  assert.equal(schedule.repeat, 2);
  assert.equal(schedule.reminder.enabled, false);
  assert.equal(new Date(schedule.starting_week).getDay(), 1);
  assert.deepEqual(buildScheduleSlots(schedule.start_time, schedule.duration, schedule.breaks, schedule.slotDurations)
    .map(slot => [slot.start, slot.end]), [
    ['08:30', '09:50'], ['10:00', '11:20'], ['11:40', '13:00'], ['13:10', '14:30'],
  ]);
  for (const model of [schedule, sanitizeSharedSchedule(schedule)]) {
    for (const subject of model.subjects) {
      assert.ok(model.teachers.some(teacher => subject.teachers.includes(teacher.id)));
      assert.ok(model.links.some(link => subject.links.includes(link.id)));
      assert.ok(subject.room && subject.building && subject.note);
    }
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      for (const weekKey of ['week1', 'week2']) {
        const lessons = model.schedule[dayIndex][weekKey];
        assert.equal(lessons.length, dayIndex < 5 ? 4 : 0);
        assert.equal(new Set(lessons.map(lesson => lesson.subjectId)).size, lessons.length);
        for (const lesson of lessons) assert.ok(model.subjects.some(subject => subject.id === lesson.subjectId));
      }
    }
  }
  const other = createUniversityContentSchedule(now);
  assert.notEqual(other.id, schedule.id);
  for (const key of ['subjects', 'teachers', 'links', 'gradients', 'tasks']) {
    const originalIds = new Set(schedule[key].map(item => item.id));
    assert.ok(other[key].every(item => !originalIds.has(item.id)), `${key}: repeated creation must have fresh IDs`);
  }
  other.tasks[0].text = 'Changed';
  other.schedule[0].week1[0].recurrence.weeks.push(2);
  assert.notEqual(schedule.tasks[0].text, 'Changed');
  assert.deepEqual(schedule.schedule[0].week1[0].recurrence.weeks, [1]);
});

test('content schedule balances general subjects, matching icons and activities throughout both weeks', () => {
  const schedule = createUniversityContentSchedule(new Date(2026, 9, 16, 12));
  const subjectIcons = new Map(schedule.subjects.map(subject => [subject.name, subject.icon]));
  assert.deepEqual(Object.fromEntries(subjectIcons), {
    'Математика': 'math', 'Англійська мова': 'lang', 'Література': 'open_book',
    'Біологія': 'micro', 'Географія': 'map', 'Мистецтво': 'art', 'Фізична культура': 'run',
  });
  const sport = schedule.subjects.find(subject => subject.icon === 'run');
  assert.equal(sport.room, 'Спортзал');
  assert.equal(sport.building, 'Спортивний корпус');
  for (const weekKey of ['week1', 'week2']) {
    const lessons = schedule.schedule.flatMap(day => day[weekKey]);
    assert.equal(new Set(lessons.map(lesson => lesson.subjectId)).size, schedule.subjects.length);
    for (const subject of schedule.subjects) {
      const activities = lessons.filter(lesson => lesson.subjectId === subject.id);
      assert.equal(activities.length, subject.id === sport.id ? 2 : 3);
      if (subject.id === sport.id || subject.icon === 'lang') {
        assert.ok(activities.every(lesson => lesson.type === 'практична'));
      }
      if (subject.icon === 'micro') assert.ok(activities.some(lesson => lesson.type === 'лабораторна'));
    }
  }
  for (let offset = 0; offset < 14; offset += 1) {
    const sample = createUniversityContentSchedule(new Date(2026, 9, 12 + offset, 12));
    assert.equal(new Set(sample.tasks.map(task => task.subjectId)).size, sample.subjects.length,
      `day ${offset}: tasks should showcase every subject`);
  }
});

test('content tasks stay populated and linked to actual classes across weekends, year boundaries and time zones', () => {
  const originalTimeZone = process.env.TZ;
  try {
    for (const timeZone of ['Europe/Kyiv', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = timeZone;
      for (const [year, month, day] of [[2026, 9, 26], [2026, 9, 31], [2026, 10, 1], [2027, 0, 1]]) {
        const now = new Date(year, month, day, 23, 30);
        const schedule = createUniversityContentSchedule(now);
        const today = getLocalISODate(now);
        assert.equal(new Date(schedule.starting_week).getDay(), 1);
        assert.equal(schedule.tasks.length, 16);
        assert.equal(schedule.tasks.filter(task => !task.completed).length, 12);
        assert.equal(schedule.tasks.filter(task => task.completed).length, 4);
        assert.equal(new Set(schedule.tasks.map(task => task.id)).size, 16);
        assert.ok(new Set(schedule.tasks.map(task => task.subjectId)).size >= 6);
        const todayTasks = schedule.tasks.filter(task => task.lessonRef.date === today);
        assert.equal(todayTasks.length, [0, 6].includes(now.getDay()) ? 0 : 4);
        for (const task of schedule.tasks) {
          assert.ok(task.text.length >= 50);
          assert.ok(Number.isFinite(task.createdAt) && task.createdAt <= now.getTime());
          assert.equal(task.updatedAt, task.createdAt);
          assert.equal(task.completed, task.lessonRef.date < today);
          const occurrence = resolveOccurrenceFromLessonRef(schedule, task.lessonRef);
          assert.ok(occurrence, `${timeZone}, ${today}: task must open an existing class`);
          assert.equal(occurrence.subjectId, task.subjectId);
          assert.equal(task.lessonRef.subjectId, task.subjectId);
          assert.equal(task.lessonRef.scheduleId, schedule.id);
          assert.equal(task.lessonRef.start, occurrence.timeInfo.start);
          assert.equal(task.lessonRef.end, occurrence.timeInfo.end);
          const subject = schedule.subjects.find(item => item.id === task.subjectId);
          assert.deepEqual(task.links, subject.links);
          assert.ok(task.links.every(id => schedule.links.some(link => link.id === id)));
        }
      }
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test('British school content uses local names and school terminology with valid task links', () => {
  for (const day of [16, 26, 31]) {
    const now = new Date(2026, 9, day, 12);
    const uk = createUniversityContentSchedule(now);
    const en = createUniversityContentSchedule(now, 'en');
    assert.equal(en.name, 'School · Year 10');
    assert.doesNotMatch(JSON.stringify(en), /\p{Script=Cyrillic}/u);
    assert.deepEqual(en.subjects.map(subject => subject.name), [
      'Maths', 'English Language', 'English Literature', 'Biology', 'Geography', 'Art & Design', 'PE',
    ]);
    assert.deepEqual(en.teachers.map(teacher => teacher.name), [
      'Emily Carter', 'James Wilson', 'Olivia Bennett', 'Daniel Harris', 'Sophie Reed', 'Charlotte Evans', 'Thomas Brooks',
    ]);
    assert.deepEqual(en.subjects.map(subject => subject.room), ['M1', 'E2', 'E3', 'B1', 'G2', 'Art Studio', 'Sports Hall']);
    assert.deepEqual(en.subjects.map(subject => subject.icon), uk.subjects.map(subject => subject.icon));
    assert.deepEqual(en.gradients.map(gradient => gradient.colors), uk.gradients.map(gradient => gradient.colors));
    assert.equal(en.subjects.at(-1).room, 'Sports Hall');
    assert.equal(en.subjects.at(-1).building, 'Sports Centre');
    const shape = schedule => schedule.schedule.map(day => ['week1', 'week2'].map(week => day[week].map(lesson => ({
      subject: schedule.subjects.findIndex(subject => subject.id === lesson.subjectId), slot: lesson.slotNumber,
    }))));
    assert.deepEqual(shape(en), shape(uk));
    const shared = sanitizeSharedSchedule(en);
    assert.deepEqual(shape(shared), shape(en));
    assert.doesNotMatch(JSON.stringify(shared), /\p{Script=Cyrillic}/u);
    assert.equal(en.tasks.length, 16);
    assert.equal(new Set(en.tasks.map(task => task.subjectId)).size, 7);
    assert.equal(en.tasks.filter(task => task.completed).length, 4);
    for (const task of en.tasks) {
      assert.ok(task.text.length >= 50);
      const occurrence = resolveOccurrenceFromLessonRef(en, task.lessonRef);
      assert.equal(occurrence?.subjectId, task.subjectId);
      assert.deepEqual(task.links, en.subjects.find(subject => subject.id === task.subjectId).links);
    }
    assert.ok(en.schedule.flatMap(day => [...day.week1, ...day.week2])
      .every(lesson => ['Lesson', 'Workshop', 'Practical', 'Discussion', 'Practice'].includes(lesson.type)));
    assert.ok(en.schedule.flatMap(day => [...day.week1, ...day.week2])
      .filter(lesson => lesson.subjectId === en.subjects.at(-1).id).every(lesson => lesson.type === 'Practice'));
    assert.notEqual(en.id, uk.id);
    assert.ok(en.subjects.every(subject => !uk.subjects.some(original => original.id === subject.id)));
  }
});

for (const lang of ['uk', 'en']) {
  test(`${lang}: all three dev buttons independently create and select once through ScheduleProvider without authentication`, () => {
    const added = [];
    let selected;
    let onCreated = 0;
    const Button = load('src/components/development/CreateTestScheduleButton.jsx', {
      'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
      'phosphor-react-native': { Flask: () => null, Camera: () => null },
      '../../context/ScheduleProvider': {
        useScheduleData: () => ({ lang, guest: true, user: null }),
        useScheduleActions: () => ({ addSchedule: schedule => added.push(schedule), setGlobalDraft: update => { selected = update({ lang, existing: true }); } }),
      },
      '../ui/SettingsKit/SettingsRow': props => React.createElement('SettingsRow', props),
    }).default;
    let renderer;
    act(() => { renderer = create(React.createElement(Button, { themeColors: {}, onCreated: () => { onCreated += 1; } })); });
    assert.equal(renderer.root.findAllByType('SettingsRow').length, 3);
    for (const index of [1, 2, 0]) {
      const rows = renderer.root.findAllByType('SettingsRow');
      assert.equal(rows[index].props.disabled, false);
      if (index === 1) assert.match(rows[index].props.label, lang === 'uk' ? /контенту/ : /content/);
      const press = rows[index].props.onPress;
      const before = added.length;
      act(() => { press(); press(); });
      assert.equal(added.length, before + 1);
      assert.equal(onCreated, before + 1);
      assert.deepEqual(selected, { lang, existing: true, currentScheduleId: added.at(-1).id });
      assert.equal(renderer.root.findAllByType('SettingsRow')[index].props.disabled, true);
      if (index === 1) {
        assert.equal(added[0].tasks.length, 16);
        assert.equal(added[0].name, 'Навчання · Група А');
        assert.equal(renderer.root.findAllByType('SettingsRow')[0].props.disabled, false);
      }
      if (index === 2) {
        assert.equal(added.at(-1).name, 'School · Year 10');
        assert.equal(added.at(-1).tasks.length, 16);
        assert.doesNotMatch(JSON.stringify(added.at(-1)), /\p{Script=Cyrillic}/u);
        assert.equal(renderer.root.findAllByType('SettingsRow')[0].props.disabled, false);
      }
    }
    act(() => renderer.unmount());
  });
}

test('release resolver refuses accidental dev imports, including assets, but allows them in dev', () => {
  const { resolveRequest } = require('../metro.config.js').resolver;
  for (const dev of [false, undefined, true]) {
    for (const filename of ['collegeSchedule.js', 'universityContentSchedule.js']) {
      for (const type of ['sourceFile', 'assetFiles']) {
        const filePath = path.join(root, 'src/config/development', filename);
        const resolution = type === 'sourceFile' ? { type, filePath } : { type, filePaths: [filePath] };
        const resolve = () => resolveRequest({ dev, resolveRequest: () => resolution }, './fixture', 'android');
        if (dev === true) assert.equal(resolve(), resolution);
        else assert.throws(resolve, /Development modules must be removed/);
      }
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
