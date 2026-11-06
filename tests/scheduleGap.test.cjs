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

function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = request => {
    if (request in mocks) return mocks[request];
    if (!request.startsWith('.')) return original(request);
    const resolved = path.resolve(path.dirname(filename), request);
    return load(path.relative(path.resolve(__dirname, '..'), fs.existsSync(resolved) ? resolved : resolved + '.js'), mocks);
  };
  mod._compile(babel.transformFileSync(filename).code, filename);
  return mod.exports;
}

async function mount(t, overrides = {}) {
  let now = new Date(2026, 8, 28, 9, 55);
  const animations = [];
  const Animated = {
    View: 'AnimatedView',
    Value: class {
      constructor(value) { this.value = value; }
      setValue(value) { this.value = value; }
      interpolate() { return { parent: this }; }
    },
    timing(value, config) {
      const animation = { config, stopped: false, start() { value.setValue(config.toValue); }, stop() { this.stopped = true; } };
      animations.push(animation);
      return animation;
    },
  };
  const Gap = load('src/pages/Schedule/components/BreakCard.jsx', {
    'react-native': { Animated, TouchableOpacity: 'TouchableOpacity', Platform: { OS: 'ios', select: options => options.ios ?? options.default }, Easing: { out: x => x, cubic: x => x }, View: 'View', Text: 'Text', StyleSheet: { create: x => x, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } } },
    'expo-blur': { BlurView: 'BlurView' },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => false },
    './CardIcon': { __esModule: true, default: 'CardIcon' },
    '../../../components/ui/GradientBackground': 'Gradient',
    '../../../hooks/useNowTick': { useNowTick: () => now },
  }).default;
  const props = {
    interval: { type: 'free', start: '09:50', end: '10:00', duration: 10, missingSlots: [1, 2] },
    targetDate: new Date(2026, 8, 28), lang: 'uk',
    themeColors: { accentColor: '#DD3366', textColor: '#111', textColor2: '#666', backgroundColor2: '#eee' },
    previousLesson: { subjectId: 'math' },
    schedule: { subjects: [{ id: 'math', color: '#4499CC' }] },
    ...overrides,
  };
  let tree;
  await act(async () => { tree = create(React.createElement(Gap, props)); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    root: tree.root,
    animations,
    duration: () => tree.root.findByProps({ testID: 'schedule-gap-duration' }).props.children,
    surfaces: () => tree.root.findAllByType('Gradient').map(x => x.props),
    async tick(date) { now = date; await act(async () => tree.update(React.createElement(Gap, { ...props }))); },
  };
}

test('compact gap replaces duration with a second countdown only during its interval', async t => {
  const gap = await mount(t);
  assert.equal(gap.duration(), '5:00');
  assert.ok(!gap.root.findAllByType('Text').some(x => String(x.props.children).includes('Немає пар')));
  await gap.tick(new Date(2026, 8, 28, 9, 55, 1));
  assert.equal(gap.duration(), '4:59');
  await gap.tick(new Date(2026, 8, 28, 10));
  assert.equal(gap.duration(), '10 хв');
  assert.equal(gap.animations.at(-1).config.toValue, 0);
  assert.equal(gap.root.findByProps({ testID: 'schedule-gap-active' }).props.accessibilityElementsHidden, true);
  await gap.tick(new Date(2026, 8, 28, 9, 50));
  assert.equal(gap.duration(), '10:00');
  await gap.tick(new Date(2026, 8, 29, 9, 55));
  assert.equal(gap.duration(), '10 хв');
});

test('active gap darkens the previous solid color and uses a brighter outline', async t => {
  const gap = await mount(t);
  const [outline, fill] = gap.surfaces();
  assert.equal(fill.fallbackColor, tinycolor.mix('#4499CC', '#000', 65).toRgbString());
  assert.ok(tinycolor(outline.fallbackColor).getLuminance() > tinycolor(fill.fallbackColor).getLuminance());
});

test('active gap preserves gradient direction and positions while darkening every stop', async t => {
  const gradient = { id: 'g', type: 'linear', angle: 125, colors: [{ color: '#4499CC', position: 0 }, { color: '#55CC99', position: 1 }] };
  const gap = await mount(t, { schedule: { subjects: [{ id: 'math', typeColor: 'gradient', colorGradient: 'g' }], gradients: [gradient] } });
  const fill = gap.surfaces()[1].gradient;
  assert.equal(fill.angle, 125);
  assert.deepEqual(fill.colors.map(x => x.position), [0, 1]);
  assert.equal(fill.colors[0].color, tinycolor.mix('#4499CC', '#000', 65).toRgbString());
  assert.equal(gradient.colors[0].color, '#4499CC');
});

test('free morning uses the theme accent when no previous lesson exists', async t => {
  const gap = await mount(t, { previousLesson: undefined });
  assert.equal(gap.surfaces()[1].fallbackColor, tinycolor.mix('#DD3366', '#000', 65).toRgbString());
});

test('upcoming gaps stay neutral and fade the previous gradient in only while active', async t => {
  const gradient = { type: 'linear', angle: 0, colors: ['#00872D', '#007789'] };
  const overrides = { schedule: { subjects: [{ id: 'math', typeColor: 'gradient', colorGradient: 'g' }], gradients: [{ id: 'g', ...gradient }] } };
  const gap = await mount(t, overrides);
  await gap.tick(new Date(2026, 8, 28, 9));
  assert.equal(gap.duration(), '10 хв');
  const colorLayer = () => gap.root.findByProps({ testID: 'schedule-gap-active' });
  assert.equal(colorLayer().props.style[1].opacity.value, 0);
  assert.equal(colorLayer().props['aria-hidden'], true);
  assert.equal(gap.root.findByProps({ testID: 'schedule-gap' }).props.style[1].backgroundColor, '#eee');
  assert.equal(gap.surfaces().length, 2);
  assert.equal(gap.surfaces()[1].children, undefined);
  assert.equal(gap.surfaces()[1].gradient.colors[1].color, tinycolor.mix('#007789', '#000', 65).toRgbString());
  assert.equal(gap.root.findAllByType('BlurView').length, 1);
  assert.ok(colorLayer().findAllByType('Gradient').length === 2);
  await gap.tick(new Date(2026, 8, 28, 9, 49, 59));
  assert.equal(colorLayer().props.style[1].opacity.value, 0);
  await gap.tick(new Date(2026, 8, 28, 9, 50));
  assert.equal(colorLayer().props.style[1].opacity.value, 1);
  assert.equal(colorLayer().props['aria-hidden'], false);
  assert.equal(gap.animations.at(-1).config.duration, 220);
  await gap.tick(new Date(2026, 8, 28, 9, 59, 59));
  assert.equal(colorLayer().props.style[1].opacity.value, 1);
  await gap.tick(new Date(2026, 8, 28, 10));
  assert.equal(colorLayer().props.style[1].opacity.value, 0);
  assert.equal(colorLayer().props['aria-hidden'], true);
  assert.equal(gap.animations.at(-1).config.duration, 220);
  const noBlur = await mount(t, { ...overrides, blurEnabled: false });
  assert.equal(noBlur.root.findAllByType('BlurView').length, 0);
});

async function mountDay(t, options = {}) {
  let now = new Date(2026, 8, 28, 8);
  let reduceMotion = false;
  const transition = name => ({ duration: duration => ({ name, duration, easing() { return this; } }) });
  const schedule = { start_time: '08:30', duration: 80, breaks: [10, 20], subjects: [] };
  const Day = load('src/pages/Schedule/components/DaySchedule.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, useWindowDimensions: () => ({ height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'TimelineRow' }, Easing: { out: x => x, cubic: x => x }, LinearTransition: transition('layout'), FadeIn: transition('enter'), FadeOut: transition('exit') },
    '../../../context/ScheduleProvider': { useScheduleData: () => ({ schedule, global: { theme: ['dark', 'blue'] }, lang: 'uk' }), useScheduleLayout: () => ({ tabBarHeight: 60 }) },
    '../../../hooks/useNowTick': { useNowTick: () => now },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => reduceMotion },
    '../../../utils/devicePerformance': { isLowEndDevice: false },
    '../../../config/layoutMetrics': { APP_HEADER_CONTENT_GAP: 8, getScheduleHeaderHeight: () => 100 },
    '../../../utils/haptics': { triggerHaptic() {} },
    './LessonCard': 'LessonCard',
    './BreakCard': 'BreakCard',
  }).default;
  const props = { targetDate: new Date(2026, 8, 28), dayData: { lessons: ['math', 'code', 'data'] }, ...options };
  let tree;
  await act(async () => { tree = create(React.createElement(Day, props)); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    root: tree.root,
    gaps: () => tree.root.findAllByType('BreakCard'),
    async pressGap(index = 0) { await act(async () => tree.root.findAllByType('BreakCard')[index].props.onPress()); },
    async unmount() { await act(async () => tree.unmount()); },
    async changeDate(targetDate) {
      props.targetDate = targetDate;
      await act(async () => tree.update(React.createElement(Day, { ...props })));
    },
    async tick(date, reduced = false) {
      now = date;
      reduceMotion = reduced;
      await act(async () => tree.update(React.createElement(Day, { ...props })));
    },
  };
}

test('day shows one upcoming gap, keeps it through its final second and then advances', async t => {
  const day = await mountDay(t);
  const gapStart = () => day.gaps().map(gap => gap.props.interval.start);
  assert.deepEqual(gapStart(), ['09:50']);
  assert.equal(day.root.findAllByType('LessonCard').length, 3);
  await day.tick(new Date(2026, 8, 28, 9, 50));
  assert.deepEqual(gapStart(), ['09:50']);
  await day.tick(new Date(2026, 8, 28, 9, 59, 59));
  assert.deepEqual(gapStart(), ['09:50']);
  await day.tick(new Date(2026, 8, 28, 10));
  assert.deepEqual(gapStart(), ['11:20']);
  assert.equal(day.gaps()[0].props.previousLesson.subjectId, 'code');
  await day.tick(new Date(2026, 8, 28, 11, 20));
  assert.deepEqual(gapStart(), ['11:20']);
  await day.tick(new Date(2026, 8, 28, 11, 39, 59));
  assert.deepEqual(gapStart(), ['11:20']);
  await day.tick(new Date(2026, 8, 28, 11, 40));
  assert.deepEqual(gapStart(), []);
  assert.equal(day.root.findAllByType('LessonCard').length, 3);
  await day.tick(new Date(2026, 8, 28, 12, 59, 59));
  assert.deepEqual(gapStart(), []);
  await day.tick(new Date(2026, 8, 28, 13));
  assert.deepEqual(gapStart(), ['09:50']);
  await day.tick(new Date(2026, 8, 29, 8));
  assert.deepEqual(gapStart(), ['09:50']);
});

test('day selection uses the viewed date and keeps the original gap after overlapping lessons', async t => {
  const day = await mountDay(t, { dayData: { lessons: [
    { subjectId: 'math', timeMode: 'custom', startTime: '08:30', endTime: '10:00' },
    { subjectId: 'code', timeMode: 'custom', startTime: '09:00', endTime: '09:30' },
    { subjectId: 'data', timeMode: 'custom', startTime: '10:20', endTime: '11:00' },
  ] } });
  await day.tick(new Date(2026, 8, 27, 20));
  assert.deepEqual(day.gaps().map(gap => [gap.props.interval.start, gap.props.interval.end]), [['10:00', '10:20']]);
  await day.tick(new Date(2026, 8, 28, 10, 10));
  assert.equal(day.gaps().length, 1);
  await day.tick(new Date(2026, 8, 29, 8));
  assert.equal(day.gaps().length, 1);
});

test('pressing any gap toggles all gaps and cancels the old preview timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const day = await mountDay(t);
  assert.equal(day.gaps().length, 1);
  await day.pressGap();
  assert.equal(day.gaps().length, 2);
  assert.ok(day.gaps().every(gap => gap.parent.props.entering.duration === 180));
  await act(async () => t.mock.timers.tick(4000));
  await day.pressGap(1);
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.expanded, false);
  await act(async () => t.mock.timers.tick(500));
  await day.pressGap();
  await act(async () => t.mock.timers.tick(500));
  assert.equal(day.gaps().length, 2, 'the cancelled timer cannot collapse the new preview');
  await act(async () => t.mock.timers.tick(4499));
  assert.equal(day.gaps().length, 2);
  await day.tick(new Date(2026, 8, 28, 10));
  await act(async () => t.mock.timers.tick(1));
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.interval.start, '11:20', 'collapse follows the latest time');
});

test('completed days show only their first gap by default and collapse back to it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const day = await mountDay(t);
  await day.tick(new Date(2026, 8, 29, 8));
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.interval.start, '09:50');
  await day.pressGap();
  assert.equal(day.gaps().length, 2);
  await day.pressGap();
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.interval.start, '09:50');
  await act(async () => t.mock.timers.tick(5000));
  assert.equal(day.gaps().length, 1);
  await day.pressGap();
  assert.equal(day.gaps().length, 2);
  await act(async () => t.mock.timers.tick(5000));
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.interval.start, '09:50');
});

test('completed days return to the first gap after a preview expires; date changes cancel previews', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const day = await mountDay(t);
  await day.pressGap();
  await day.tick(new Date(2026, 8, 28, 13));
  await act(async () => t.mock.timers.tick(5000));
  assert.equal(day.gaps().length, 1);
  assert.equal(day.gaps()[0].props.interval.start, '09:50');
  await day.tick(new Date(2026, 8, 28, 8));
  await day.pressGap();
  await day.changeDate(new Date(2026, 8, 29));
  assert.equal(day.gaps().length, 1);
  await act(async () => t.mock.timers.tick(5000));
  await day.pressGap();
  await day.unmount();
  await act(async () => t.mock.timers.tick(5000));
});

test('a break card exposes an accessible press action without changing its countdown', async t => {
  let presses = 0;
  const gap = await mount(t, { onPress: () => presses++ });
  const button = gap.root.findByProps({ testID: 'schedule-gap' });
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityState.expanded, false);
  assert.match(button.props.accessibilityHint, /5/);
  await act(async () => button.props.onPress());
  assert.equal(presses, 1);
  assert.equal(gap.duration(), '5:00');
});

test('gap changes animate together with lesson positions and respect reduced motion', async t => {
  const day = await mountDay(t);
  const gapRow = day.gaps()[0].parent;
  assert.equal(gapRow.props.entering.duration, 180);
  assert.equal(gapRow.props.exiting.duration, 140);
  assert.equal(gapRow.props.layout.duration, 220);
  assert.ok(day.root.findAllByType('LessonCard').every(lesson => lesson.parent.props.layout.duration === 220));
  await day.tick(new Date(2026, 8, 28, 10), true);
  await day.pressGap();
  assert.equal(day.gaps().length, 2);
  assert.ok(day.root.findAllByType('TimelineRow').every(row => !row.props.layout && !row.props.entering && !row.props.exiting));
});

test('empty days and days without gaps keep their lessons and never show a break', async t => {
  const empty = await mountDay(t, { dayData: { lessons: [] } });
  assert.equal(empty.gaps().length, 0);
  assert.equal(empty.root.findAllByType('LessonCard').length, 0);
  const single = await mountDay(t, { dayData: { lessons: ['math'] } });
  assert.equal(single.gaps().length, 0);
  assert.equal(single.root.findAllByType('LessonCard').length, 1);
});

test('timer ticks do not restart activity animation and both layers stay mounted for the exit', async t => {
  const gap = await mount(t);
  assert.equal(gap.animations.length, 0, 'an active gap mounts highlighted without animating');
  await gap.tick(new Date(2026, 8, 28, 9, 55, 3));
  assert.equal(gap.animations.length, 0);
  await gap.tick(new Date(2026, 8, 28, 10));
  assert.equal(gap.animations.length, 1);
  assert.equal(gap.animations.at(-1).config.toValue, 0);
  assert.equal(gap.animations.at(-1).config.duration, 220);
  assert.equal(gap.animations.at(-1).config.useNativeDriver, true);
  assert.equal(gap.surfaces().length, 2);
});

async function mountTransition(t, initialActive) {
  let reducedMotion = false;
  const animations = [];
  const useActivityTransition = load('src/pages/Schedule/components/useActivityTransition.js', {
    'react-native': {
      Easing: { out: x => x, cubic: x => x },
      Animated: {
        Value: class {
          constructor(value) { this.value = value; }
          setValue(value) { this.value = value; }
          interpolate() { return { parent: this }; }
        },
        timing(value, config) {
          const animation = { value, config, stopped: false, start() {}, stop() { this.stopped = true; } };
          animations.push(animation);
          return animation;
        },
      },
    },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => reducedMotion },
  }).default;
  function Probe({ active }) { return React.createElement('Probe', useActivityTransition(active)); }
  let tree;
  await act(async () => { tree = create(React.createElement(Probe, { active: initialActive })); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    animations,
    progress: tree.root.findByType('Probe').props.activeOpacity,
    async update(active, reduced = false) {
      reducedMotion = reduced;
      await act(async () => tree.update(React.createElement(Probe, { active })));
    },
  };
}

test('reversing an unfinished transition preserves its current opacity', async t => {
  const transition = await mountTransition(t, false);
  await transition.update(true);
  const entering = transition.animations.at(-1);
  transition.progress.setValue(0.4);
  await transition.update(false);
  assert.equal(entering.stopped, true);
  assert.equal(transition.progress.value, 0.4);
  assert.equal(transition.animations.at(-1).config.toValue, 0);
  await transition.update(true);
  assert.equal(transition.progress.value, 0.4);
  assert.equal(transition.animations.at(-1).config.toValue, 1);
});

test('an already active card mounts highlighted and reduced motion cancels transitions', async t => {
  const transition = await mountTransition(t, true);
  assert.equal(transition.progress.value, 1);
  assert.equal(transition.animations.length, 0, 'mounting never builds an animation');
  await transition.update(false);
  const leaving = transition.animations.at(-1);
  await transition.update(true, true);
  assert.equal(leaving.stopped, true);
  assert.equal(transition.progress.value, 1);
  assert.equal(transition.animations.length, 1);
  await transition.update(false, true);
  assert.equal(transition.progress.value, 0);
  assert.equal(transition.animations.length, 1);
});
