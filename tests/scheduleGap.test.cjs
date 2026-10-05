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
    'react-native': { Animated, Easing: { out: x => x, cubic: x => x }, View: 'View', Text: 'Text', StyleSheet: { create: x => x, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } } },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => false },
    'phosphor-react-native': { Coffee: 'Coffee', Timer: 'Timer' },
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

test('timer ticks do not restart activity animation and both layers stay mounted for the exit', async t => {
  const gap = await mount(t);
  const firstAnimation = gap.animations[0];
  await gap.tick(new Date(2026, 8, 28, 9, 55, 3));
  assert.equal(gap.animations.length, 1);
  await gap.tick(new Date(2026, 8, 28, 10));
  assert.equal(firstAnimation.stopped, true);
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
  const entering = transition.animations.at(-1);
  await transition.update(false, true);
  assert.equal(entering.stopped, true);
  assert.equal(transition.progress.value, 0);
  assert.equal(transition.animations.length, 1);
  await transition.update(true, true);
  assert.equal(transition.progress.value, 1);
  assert.equal(transition.animations.length, 1);
});
