const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
const compile = (relative, mocks = {}) => {
  const filename = path.join(root, relative);
  const compiled = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, presets: ['babel-preset-expo'],
  }).code;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : originalRequire(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
};
const model = compile('src/pages/Schedule/dayNavigation.js');
const day = (number) => new Date(2026, 8, number);

// Separate UI and JS queues deliberately expose the frame between animation
// completion and React's commit. Native timing itself still needs device testing.
const createRuntime = () => {
  const ui = [];
  const js = [];
  const reactions = new Set();
  const values = new Set();
  let gesture;
  const assertSerializable = (value, seen = new Set()) => {
    if (value === null || value === undefined || seen.has(value)) return;
    seen.add(value);
    if (value.mockShared) return;
    assert.ok(!(value instanceof Date), 'Date captured by a worklet');
    if (typeof value === 'function') {
      if (value.__closure) assertSerializable(value.__closure, seen);
      return;
    }
    if (typeof value === 'object') {
      for (const child of Object.values(value)) assertSerializable(child, seen);
    }
  };
  const reanimated = {
    __esModule: true,
    default: { View: 'AnimatedView' },
    Easing: { out: (fn) => fn, cubic: (x) => x ** 3 },
    ReduceMotion: { System: 'system' },
    cancelAnimation: (shared) => { shared.animation = null; },
    runOnJS: (fn) => (...args) => { js.push(() => fn(...args)); },
    runOnUI: (fn) => (...args) => {
      assertSerializable(fn);
      assertSerializable(args);
      ui.push(() => fn(...args));
    },
    withTiming: (target, config, callback) => {
      assertSerializable(callback);
      return { mockAnimation: true, target, config, callback };
    },
    useSharedValue: (initial) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        ref.current = {
          mockShared: true,
          current: initial,
          animation: null,
          get value() { return this.current; },
          set value(next) {
            if (next?.mockAnimation) this.animation = next;
            else { this.current = next; this.animation = null; }
          },
        };
        values.add(ref.current);
      }
      return ref.current;
    },
    useAnimatedStyle: (fn) => {
      assertSerializable(fn);
      return { readStyle: fn };
    },
    useAnimatedReaction: (prepare, react) => {
      assertSerializable(prepare);
      assertSerializable(react);
      React.useLayoutEffect(() => {
        const entry = { prepare, react, previous: undefined };
        reactions.add(entry);
        return () => reactions.delete(entry);
      }, [prepare, react]);
    },
  };
  const runtime = {
    reanimated,
    Gesture: {
      Pan: () => {
        const callbacks = {};
        const pan = { callbacks };
        for (const name of ['enabled', 'averageTouches', 'activeOffsetX', 'failOffsetY']) {
          pan[name] = () => pan;
        }
        for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
          pan[name] = (callback) => {
            assertSerializable(callback);
            callbacks[name] = callback;
            return pan;
          };
        }
        gesture = pan;
        return pan;
      },
    },
    ui() {
      for (let pass = 0; pass < 50; pass++) {
        let changed = ui.length > 0;
        while (ui.length) ui.shift()();
        for (const entry of reactions) {
          const next = entry.prepare();
          if (next !== entry.previous) {
            const previous = entry.previous;
            entry.previous = next;
            entry.react(next, previous);
            changed = true;
          }
        }
        if (!changed) return;
      }
      throw new Error('UI reaction did not settle');
    },
    async js() { await act(async () => { while (js.length) js.shift()(); }); },
    async flush() {
      for (let pass = 0; pass < 10; pass++) {
        runtime.ui();
        if (!js.length) return;
        await runtime.js();
      }
      throw new Error('Pager queues did not settle');
    },
    animate(fraction = 1) {
      for (const value of values) {
        const animation = value.animation;
        if (!animation) continue;
        value.current += (animation.target - value.current) * fraction;
        if (fraction === 1) {
          value.animation = null;
          animation.callback?.(true);
        }
      }
    },
    gesture(name, event = {}) {
      gesture.callbacks[name](event);
      runtime.ui();
    },
    pendingAnimations: () => [...values].filter((value) => value.animation).length,
    durations: () => [...values].filter((value) => value.animation)
      .map((value) => value.animation.config.duration),
  };
  return runtime;
};

const mountPager = async (initialDay = 7, reducedMotion = false) => {
  const runtime = createRuntime();
  const DayPager = compile('src/pages/Schedule/components/DayPager.jsx', {
    'react-native': { View: 'View', StyleSheet: { create: (x) => x, absoluteFill: {} } },
    'react-native-gesture-handler': { Gesture: runtime.Gesture, GestureDetector: 'GestureDetector' },
    'react-native-reanimated': runtime.reanimated,
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => reducedMotion },
    '../dayNavigation': model,
  }).default;
  const ref = React.createRef();
  const commits = [];
  const dayProgress = { mockShared: true, value: model.getCalendarDayNumber(day(initialDay)) };
  const weekTransition = { mockShared: true, value: { id: 0, active: false, origin: 0, finished: false } };
  const weekProgress = { mockShared: true, value: 0 };
  let mountId = 0;
  const Day = ({ date, decorationsReady }) => {
    const [identity] = React.useState(() => ++mountId);
    return React.createElement('Day', { timestamp: date.getTime(), identity, decorationsReady });
  };
  const renderDay = (date, decorationsReady) => React.createElement(Day, { date, decorationsReady });
  const App = () => {
    const [date, setDate] = React.useState(day(initialDay));
    const onDateChange = React.useCallback((next) => {
      commits.push(next.getDate());
      setDate(next);
    }, []);
    return React.createElement(DayPager, { ref, date, onDateChange, renderDay, dayProgress, weekTransition, weekProgress });
  };
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  let measuredWidth = 400;
  const resize = async (width) => {
    measuredWidth = width;
    await act(async () => {
      renderer.root.findByType('View').props.onLayout({ nativeEvent: { layout: { width } } });
    });
    await runtime.flush();
  };
  await resize(400);
  const flush = async () => {
    await runtime.flush();
    await act(async () => {
      for (const page of renderer.root.findAllByType('AnimatedView')) {
        page.props.onLayout?.({ nativeEvent: { layout: { width: measuredWidth } } });
      }
    });
    await runtime.flush();
  };
  return {
    ...runtime, ref, commits, resize, dayProgress, weekTransition, weekProgress,
    flush, flushWithoutLayout: runtime.flush,
    page(number) {
      const instance = renderer.root.findAllByType('AnimatedView').find((page) => (
        page.findByType('Day').props.timestamp === day(number).getTime()
      ));
      if (!instance) return null;
      return {
        identity: instance.findByType('Day').props.identity,
        decorationsReady: instance.findByType('Day').props.decorationsReady,
        x: instance.props.style[1].readStyle().transform[0].translateX,
        opacity: instance.props.style[1].readStyle().opacity,
        active: instance.props.pointerEvents === 'auto',
      };
    },
    pageCount: () => renderer.root.findAllByType('Day').length,
    mountCount: () => mountId,
    close: async () => { await act(async () => renderer.unmount()); },
  };
};

const compileWeekStrip = (runtime) => {
  const colors = { backgroundColor: '#fff', backgroundColor2: '#eee', accentColor: '#00f', textOnAccent: '#fff' };
  return compile('src/pages/Schedule/components/WeekStrip.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: (x) => x, absoluteFillObject: {} } },
    'react-native-reanimated': { ...runtime.reanimated, default: { View: 'AnimatedView', Text: 'AnimatedText' }, interpolateColor: (amount, range, colors) => amount >= 1 ? colors[1] : colors[0] },
    'react-native-gesture-handler': { Gesture: runtime.Gesture, GestureDetector: 'GestureDetector' },
    '../../../config/themes': { __esModule: true, default: { getColors: () => colors } },
    '../../../context/NotificationDrawerContext': { useNotificationDrawer: () => ({}) },
    '../../../context/ScheduleProvider': { useScheduleData: () => ({ global: {}, lang: 'en' }) },
    '../../../utils/haptics': { triggerHaptic() {} },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => false },
    '../../../utils/i18n': { t: () => 'en-US' },
    '../dayNavigation': model,
  }).default;
};

test('week strip follows live days and animates week gestures and distant jumps', async () => {
  const runtime = createRuntime();
  const progress = { mockShared: true, value: model.getCalendarDayNumber(day(7)) };
  const selected = [];
  const WeekStrip = compileWeekStrip(runtime);
  let renderer;
  await act(async () => { renderer = create(React.createElement(WeekStrip, { currentDate: day(7), dayProgress: progress, onSelectDate: (date) => selected.push(date) })); });
  const rows = () => renderer.root.findAllByType('AnimatedView').filter((node) => node.props['aria-hidden'] !== undefined);
  const x = (row) => row.props.style.find((style) => style?.readStyle).readStyle().transform[0].translateX;
  try {
    await act(async () => renderer.root.findAllByType('View').find((node) => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    await runtime.flush();
    runtime.animate();
    await runtime.flush();
    assert.equal(rows().length, 3);
    assert.equal(x(rows()[1]), 0);
    assert.equal(rows()[1].props.style[1].position, 'relative');
    assert.ok(rows().every((row) => row.props.style[0].height === 40));
    assert.ok(renderer.root.findAllByType('Button').every((button) => button.props.style.height === 40));
    assert.ok(renderer.root.findAllByType('Button').every((button) => button.findAllByType('AnimatedText').length === 2), 'each day has exactly one weekday label and one date');
    assert.equal(renderer.root.findAllByType('Text').length, 0, 'there is no duplicate static text layer');
    const beforeCancel = selected.length;
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: 80 });
    runtime.gesture('onFinalize');
    runtime.animate();
    await runtime.flush();
    assert.equal(selected.length, beforeCancel);
    assert.equal(x(rows()[1]), 0);
    const accents = () => renderer.root.findAllByType('AnimatedView').filter((node) => Array.isArray(node.props.style) && node.props.style[2]?.readStyle?.().width !== undefined);
    progress.value += 0.5;
    runtime.ui();
    assert.equal(accents()[1].props.style[2].readStyle().transform[0].translateX, 26);
    assert.equal(selected.length, 0);
    progress.value = model.getCalendarDayNumber(day(14));
    runtime.ui();
    runtime.animate(0.5);
    assert.ok(x(rows()[1]) < 0 && x(rows()[1]) > -350);
    runtime.animate();
    await runtime.flush();
    assert.equal(x(rows()[1]), 0);
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: -120 });
    assert.ok(x(rows()[1]) < 0);
    runtime.gesture('onEnd', { velocityX: -500 });
    runtime.gesture('onFinalize');
    await runtime.flush();
    assert.equal(model.getCalendarDayKey(selected.at(-1)), '2026-09-21');
    runtime.animate();
    await runtime.flush();
    progress.value = model.getCalendarDayNumber(day(100));
    await runtime.flush();
    runtime.animate();
    await runtime.flush();
    assert.equal(rows().length, 3);
    assert.equal(x(rows()[1]), 0);
  } finally { await act(async () => renderer.unmount()); }
});

test('week accents shrink and grow at gesture progress, including hold, reversal and cancellation', async () => {
  const runtime = createRuntime();
  const WeekStrip = compileWeekStrip(runtime);
  const origin = model.getCalendarDayNumber(day(7));
  const progress = { mockShared: true, value: origin };
  let transition;
  let amount;
  const App = () => {
    transition = runtime.reanimated.useSharedValue({ id: 0, active: false, origin: 0, finished: false });
    amount = runtime.reanimated.useSharedValue(0);
    return React.createElement(WeekStrip, {
      currentDate: day(7), dayProgress: progress, weekTransition: transition, weekProgress: amount,
      onSelectDate: () => assert.fail('the pager, not the strip, must commit the date'),
    });
  };
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  const scales = () => renderer.root.findAllByType('AnimatedView')
    .map((node) => node.props.style?.[2]?.readStyle?.())
    .filter((style) => style?.width !== undefined)
    .map((style) => style.transform[1].scale).filter((scale) => scale > 0).sort();
  try {
    await act(async () => renderer.root.findAllByType('View').find((node) => node.props.onLayout)
      .props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    await runtime.flush();
    runtime.animate();
    await runtime.flush();
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: -175 });
    await runtime.flush();
    assert.equal(amount.value, 0.5);
    assert.deepEqual(scales(), [0.5, 0.5]);
    assert.equal(runtime.pendingAnimations(), 0);
    runtime.animate();
    await runtime.flush();
    assert.deepEqual(scales(), [0.5, 0.5]);
    assert.equal(transition.value.finished, false);
    runtime.gesture('onUpdate', { translationX: 87.5 });
    await runtime.flush();
    assert.equal(amount.value, -0.25);
    assert.deepEqual(scales(), [0.25, 0.75]);
    runtime.gesture('onFinalize');
    runtime.animate();
    await runtime.flush();
    assert.equal(amount.value, 0);
    assert.equal(transition.value.finished, true);
    assert.deepEqual(scales(), [1]);
    transition.value = { ...transition.value, active: false };
    await runtime.flush();
    runtime.animate();
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: -175 });
    runtime.gesture('onEnd', { velocityX: 0 });
    runtime.animate(0.5);
    await runtime.flush();
    assert.equal(amount.value, 0.75);
    assert.deepEqual(scales(), [0.25, 0.75]);
    assert.equal(transition.value.finished, false);
    runtime.animate();
    await runtime.flush();
    assert.equal(amount.value, 1);
    assert.equal(transition.value.finished, true);
    assert.deepEqual(scales(), [1]);
    transition.value = { ...transition.value, active: false };
    await runtime.flush();
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: -100 });
    transition.value = { ...transition.value, active: false };
    await runtime.flush();
    runtime.gesture('onUpdate', { translationX: -250 });
    runtime.gesture('onEnd', { velocityX: -1000 });
    runtime.gesture('onFinalize');
    runtime.animate();
    await runtime.flush();
    assert.equal(transition.value.active, false, 'late events cannot restart a cancelled preview');
    assert.equal(transition.value.finished, false);
  } finally { await act(async () => renderer.unmount()); }
});

test('week input survives delayed commits and can reverse an unfinished transition', async () => {
  const runtime = createRuntime();
  const WeekStrip = compileWeekStrip(runtime);
  const progress = { mockShared: true, value: model.getCalendarDayNumber(day(7)) };
  let transition;
  let amount;
  const App = () => {
    transition = runtime.reanimated.useSharedValue({ id: 0, active: false, origin: 0, finished: false });
    amount = runtime.reanimated.useSharedValue(0);
    return React.createElement(WeekStrip, { currentDate: day(7), dayProgress: progress,
      weekTransition: transition, weekProgress: amount, onSelectDate() {} });
  };
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  const swipe = (direction) => {
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: -175 * direction });
    runtime.gesture('onEnd', { velocityX: -500 * direction });
    runtime.gesture('onFinalize');
  };
  const commit = () => {
    progress.value = transition.value.origin + amount.value * 7;
    transition.value = { ...transition.value, active: false };
    runtime.ui();
  };
  try {
    await act(async () => renderer.root.findAllByType('View').find((node) => node.props.onLayout)
      .props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    await runtime.flush();
    runtime.animate();
    await runtime.flush();
    swipe(1);
    runtime.animate(0.5);
    const before = amount.value;
    runtime.gesture('onStart');
    assert.equal(amount.value, before, 'interrupting must not snap the moving page');
    runtime.gesture('onUpdate', { translationX: 175 });
    runtime.gesture('onEnd', { velocityX: 500 });
    runtime.animate();
    assert.equal(amount.value, 0, 'reverse swipe returns to the original week');
    commit();
    swipe(1);
    runtime.animate();
    runtime.ui();
    assert.equal(transition.value.finished, true);
    for (const direction of [1, -1, 1, -1]) swipe(direction);
    const visited = [];
    for (let i = 0; i < 5; i++) {
      assert.equal(transition.value.finished, true);
      visited.push(transition.value.origin + amount.value * 7 - model.getCalendarDayNumber(day(7)));
      commit();
      runtime.animate();
      runtime.ui();
    }
    assert.deepEqual(visited, [7, 14, 7, 14, 7]);
    assert.equal(transition.value.active, false);
    swipe(1);
    runtime.animate();
    runtime.ui();
    runtime.gesture('onStart');
    runtime.gesture('onUpdate', { translationX: 175 });
    commit();
    assert.equal(amount.value, -0.5, 'a held gesture catches up as soon as the previous commit arrives');
    assert.equal(transition.value.finished, false);
    runtime.gesture('onFinalize');
    runtime.animate();
    assert.equal(amount.value, 0);
  } finally { await act(async () => renderer.unmount()); }
});

test('calendar arithmetic crosses month/year and DST without a 24-hour assumption', () => {
  assert.equal(model.getCalendarDayKey(model.addCalendarDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(model.getCalendarDayKey(model.addCalendarDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(model.getCalendarDayDistance(new Date(2026, 2, 28), new Date(2026, 2, 30)), 2);
  assert.equal(model.normalizeCalendarDate('invalid'), null);
  for (const date of [new Date(2026, 2, 29), new Date(2026, 9, 25), new Date(2026, 11, 31)]) {
    assert.equal(model.getCalendarDayKey(model.dateFromCalendarDayNumber(model.getCalendarDayNumber(date))), model.getCalendarDayKey(date));
  }
});

test('settling preserves the exact visible page and its coordinate over 1000 transitions', () => {
  let current = model.createDayWindow(day(7));
  for (let step = 1; step <= 1000; step++) {
    const position = current.center + (step % 3 ? 1 : -1);
    const visible = current.pages.find((page) => page.position === position);
    current = model.settleDayWindow(current, position, step);
    assert.equal(current.pages[2], visible);
    assert.equal(current.center, position);
    assert.ok(current.pages.length >= 15 && current.pages.length <= 45);
    assert.equal(new Set(current.pages.map((page) => page.key)).size, current.pages.length);
    assert.deepEqual(JSON.parse(JSON.stringify(current)), current);
  }
});

test('week scrubbing holds both pages halfway, reverses and commits only after release', async () => {
  for (const finish of [0, 1, -1]) {
    const pager = await mountPager();
    try {
      pager.weekTransition.value = { id: 1, active: true, origin: model.getCalendarDayNumber(day(7)), finished: false };
      pager.weekProgress.value = 0.5;
      await pager.flush();
      assert.equal(pager.page(7).x, -200);
      assert.equal(pager.page(14).x, 200);
      assert.equal(pager.pendingAnimations(), 0);
      pager.animate();
      await pager.flush();
      assert.equal(pager.page(7).x, -200);
      assert.deepEqual(pager.commits, []);
      pager.weekProgress.value = -0.25;
      pager.ui();
      assert.equal(pager.page(7).x, 100);
      assert.equal(pager.page(0).x, -300);
      pager.weekProgress.value = finish;
      pager.weekTransition.value = { ...pager.weekTransition.value, finished: true };
      await pager.flush();
      assert.equal(pager.page(7 + finish * 7).x, 0);
      assert.equal(pager.weekTransition.value.active, false);
      assert.ok(pager.pageCount() <= 45);
    } finally { await pager.close(); }
  }
});

test('week dragging uses already mounted pages before any JS work or layout acknowledgement', async () => {
  const pager = await mountPager();
  try {
    const identities = [0, 7, 14].map((number) => pager.page(number).identity);
    const mounts = pager.mountCount();
    pager.weekTransition.value = { id: 1, active: true, origin: model.getCalendarDayNumber(day(7)), finished: false };
    for (const amount of [0.1, 0.5, 0.9, 0, -0.4, -1]) {
      pager.weekProgress.value = amount;
      pager.ui();
      assert.equal(pager.page(7).x, (0 - amount) * 400);
      assert.equal(pager.page(14).x, (1 - amount) * 400);
      assert.equal(pager.page(0).x, (-1 - amount) * 400);
      assert.equal(pager.page(8).opacity, 0, 'ordinary adjacent days must not overlap the weekly pages');
      assert.equal(pager.page(14).opacity, 1);
      assert.equal(pager.mountCount(), mounts, 'a gesture must not construct any lesson page');
      assert.deepEqual([0, 7, 14].map((number) => pager.page(number).identity), identities);
      assert.deepEqual(pager.commits, []);
    }
    pager.weekTransition.value = { ...pager.weekTransition.value, finished: true };
    pager.ui();
    assert.equal(pager.page(0).x, 0);
    assert.deepEqual(pager.commits, [], 'React has not processed the completion yet');
    await pager.flush();
    assert.equal(pager.page(0).identity, identities[0]);
    assert.equal(pager.page(0).x, 0);
    assert.deepEqual(pager.commits, [31]);
  } finally { await pager.close(); }
});

test('returning across recent weeks preserves mounted pages and their revealed decorations', async () => {
  const pager = await mountPager();
  try {
    await pager.flush();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 180)));
    const identity = pager.page(7).identity;
    assert.equal(pager.page(7).decorationsReady, true);
    let current = 7;
    let id = 0;
    const visit = async (direction) => {
      pager.weekTransition.value = { id: ++id, active: true, origin: model.getCalendarDayNumber(day(current)), finished: false };
      pager.weekProgress.value = direction;
      pager.ui();
      pager.weekTransition.value = { ...pager.weekTransition.value, finished: true };
      await pager.flush();
      current += direction * 7;
    };
    await visit(1);
    await visit(1);
    const warmedMounts = pager.mountCount();
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const direction of [-1, -1, 1, 1]) await visit(direction);
      assert.equal(pager.mountCount(), warmedMounts);
      assert.equal(pager.page(7).identity, identity);
      assert.equal(pager.page(7).decorationsReady, true);
      assert.ok(pager.pageCount() <= 45);
    }
  } finally { await pager.close(); }
});

test('day input during a pending week commit is retained', async () => {
  const pager = await mountPager();
  try {
    pager.weekTransition.value = { id: 1, active: true, origin: model.getCalendarDayNumber(day(7)), finished: false };
    pager.weekProgress.value = 1;
    pager.ui();
    pager.weekTransition.value = { ...pager.weekTransition.value, finished: true };
    pager.ui();
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -175 });
    pager.gesture('onEnd', { velocityX: -500 });
    pager.gesture('onFinalize');
    await pager.flush();
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [14, 15]);
  } finally { await pager.close(); }
});

test('resize cancels a week preview without changing the date or blocking later navigation', async () => {
  const pager = await mountPager();
  try {
    pager.weekTransition.value = { id: 1, active: true, origin: model.getCalendarDayNumber(day(7)), finished: false };
    pager.weekProgress.value = 0.5;
    await pager.flush();
    await pager.resize(700);
    assert.equal(pager.weekTransition.value.active, false);
    assert.equal(pager.page(7).x, 0);
    assert.deepEqual(pager.commits, []);
    pager.ref.current.navigateToDate(day(8));
    await pager.flush();
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [8]);
  } finally { await pager.close(); }
});

test('week jumps wait for layout and retain the prepared destination through commit', async () => {
  for (const target of [14, 0]) {
    const pager = await mountPager();
    try {
      pager.ref.current.navigateToDate(day(target));
      await pager.flushWithoutLayout();
      assert.equal(pager.pendingAnimations(), 0);
      assert.equal(pager.page(7).x, 0);
      const identity = pager.page(target).identity;
      await pager.flush();
      assert.equal(pager.pendingAnimations(), 1);
      pager.animate(0.5);
      assert.ok(Math.abs(pager.page(target).x) > 0 && Math.abs(pager.page(target).x) < 400);
      const neighborIdentity = pager.page(target + (target > 7 ? 1 : -1)).identity;
      pager.animate();
      await pager.flush();
      assert.equal(pager.page(target).identity, identity);
      assert.equal(pager.page(target + (target > 7 ? 1 : -1)).identity, neighborIdentity);
      assert.equal(pager.page(target).x, 0);
      assert.ok(pager.pageCount() <= 45);
    } finally { await pager.close(); }
  }
});

test('a prepared day starts moving on UI before React processes any queued work', async () => {
  const pager = await mountPager();
  try {
    const identity = pager.page(8).identity;
    pager.ref.current.navigateToDate(day(8));
    pager.ui();
    assert.equal(pager.pendingAnimations(), 1);
    pager.animate(0.5);
    assert.ok(pager.page(8).x > 0 && pager.page(8).x < 400);
    assert.equal(pager.page(8).identity, identity);
    assert.deepEqual(pager.commits, []);
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [8]);
  } finally { await pager.close(); }
});

test('Today commits exactly 10 from both sides and repeating it is a no-op', async () => {
  for (const initial of [7, 11]) {
    const pager = await mountPager(initial);
    try {
      pager.ref.current.navigateToDate(day(10));
      await pager.flush();
      pager.animate();
      const beforeCommit = pager.page(10);
      assert.equal(beforeCommit.x, 0);
      await pager.flush();
      assert.deepEqual(pager.commits, [10]);
      assert.equal(pager.page(10).identity, beforeCommit.identity);
      assert.equal(pager.page(10).x, 0);
      pager.ref.current.navigateToDate(day(10));
      await pager.flush();
      assert.equal(pager.pendingAnimations(), 0);
      assert.deepEqual(pager.commits, [10]);
    } finally { await pager.close(); }
  }
});

test('swipe settles on UI without waiting for JS and React does not move or remount the target', async () => {
  const pager = await mountPager();
  try {
    const originalIdentity = pager.page(8).identity;
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -150 });
    assert.equal(pager.dayProgress.value, model.getCalendarDayNumber(day(7)) + 0.375);
    pager.gesture('onEnd', { velocityX: -600 });
    pager.gesture('onFinalize');
    assert.equal(pager.pendingAnimations(), 1);
    pager.animate();
    assert.equal(pager.page(8).x, 0);
    assert.deepEqual(pager.commits, []);
    await pager.flush();
    assert.deepEqual(pager.commits, [8]);
    assert.equal(pager.page(8).identity, originalIdentity);
    assert.equal(pager.page(8).x, 0);
    assert.ok(pager.pageCount() <= 45);
  } finally { await pager.close(); }
});

test('latest command waits for a gesture, including a request to return to the original day', async () => {
  const pager = await mountPager();
  try {
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -200 });
    pager.ref.current.navigateToDate(day(10));
    pager.ref.current.navigateToDate(day(7));
    await pager.flush();
    assert.equal(pager.page(7).x, -200);
    pager.gesture('onEnd', { velocityX: -400 });
    pager.animate();
    await pager.flush();
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [8, 7]);
    assert.equal(pager.page(7).x, 0);
  } finally { await pager.close(); }
});

test('resize rejects a completed animation whose JS callback has not arrived yet', async () => {
  const pager = await mountPager();
  try {
    pager.ref.current.navigateToDate(day(10));
    await pager.flush();
    pager.animate();
    await pager.resize(760);
    assert.deepEqual(pager.commits, []);
    assert.equal(pager.page(7).x, 0);
    pager.ref.current.navigateToDate(day(10));
    await pager.flush();
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [10]);
  } finally { await pager.close(); }
});

test('resize during a drag and late end/finalize events cannot change the date', async () => {
  const pager = await mountPager();
  try {
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -180 });
    await pager.resize(320);
    pager.gesture('onEnd', { velocityX: -1000 });
    pager.gesture('onFinalize');
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, []);
    assert.equal(pager.page(7).x, 0);
  } finally { await pager.close(); }
});

test('cancelled and short swipes return to the same mounted day', async () => {
  const pager = await mountPager();
  try {
    const identity = pager.page(7).identity;
    for (const cancelled of [true, false]) {
      pager.gesture('onStart');
      pager.gesture('onUpdate', { translationX: -20 });
      if (!cancelled) pager.gesture('onEnd', { velocityX: 0 });
      pager.gesture('onFinalize');
      pager.animate();
      await pager.flush();
      assert.equal(pager.page(7).x, 0);
      assert.equal(pager.page(7).identity, identity);
      assert.ok(pager.commits.every((number) => number === 7));
    }
  } finally { await pager.close(); }
});

test('button bursts retain only the latest pending destination without moving the active animation', async () => {
  const pager = await mountPager();
  try {
    pager.ref.current.navigateToDate(day(10));
    await pager.flush();
    pager.animate(0.5);
    const halfway = pager.page(10).x;
    for (const number of [11, 12, 6, 9]) pager.ref.current.navigateToDate(day(number));
    await pager.flush();
    assert.equal(pager.page(10).x, halfway);
    pager.animate();
    await pager.flush();
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [10, 9]);
    assert.equal(pager.page(9).x, 0);
  } finally { await pager.close(); }
});

test('reduced motion and explicitly instant commands use zero-duration transitions', async () => {
  for (const reduced of [false, true]) {
    const pager = await mountPager(7, reduced);
    try {
      pager.ref.current.navigateToDate(day(10), { animated: reduced });
      await pager.flush();
      assert.deepEqual(pager.durations(), [0]);
      pager.animate();
      await pager.flush();
      assert.deepEqual(pager.commits, [10]);
      assert.equal(pager.page(10).x, 0);
    } finally { await pager.close(); }
  }
});

test('repeated forward/backward gestures keep a bounded mounted window', async () => {
  const pager = await mountPager();
  try {
    let current = 7;
    for (let step = 0; step < 30; step++) {
      const direction = step % 3 ? -1 : 1;
      const next = current + direction;
      const identity = pager.page(next).identity;
      pager.gesture('onStart');
      pager.gesture('onUpdate', { translationX: direction * -180 });
      pager.gesture('onEnd', { velocityX: direction * -500 });
      pager.animate();
      assert.equal(pager.page(next).x, 0);
      await pager.flush();
      assert.equal(pager.page(next).identity, identity);
      assert.equal(pager.page(next).x, 0);
      assert.ok(pager.pageCount() <= 45);
      current = next;
    }
  } finally { await pager.close(); }
});

test('ten swipes survive a stalled React commit without losing days', async () => {
  const pager = await mountPager();
  const swipe = (direction) => {
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -160 * direction });
    pager.gesture('onEnd', { velocityX: -500 * direction });
    pager.gesture('onFinalize');
  };
  try {
    swipe(1);
    pager.animate();
    for (let i = 0; i < 9; i++) swipe(1);
    assert.deepEqual(pager.commits, []);
    for (let i = 0; i < 8; i++) {
      await pager.flush();
      pager.animate();
    }
    await pager.flush();
    assert.equal(pager.commits.at(-1), 17);
    assert.equal(pager.page(17).x, 0);
    assert.ok(pager.pageCount() <= 45);
  } finally { await pager.close(); }
});

test('three swipes before any animation finishes advance three days', async () => {
  const pager = await mountPager();
  try {
    for (let i = 0; i < 3; i++) {
      pager.gesture('onStart');
      pager.gesture('onUpdate', { translationX: -160 });
      pager.gesture('onEnd', { velocityX: -500 });
      pager.gesture('onFinalize');
    }
    for (let i = 0; i < 3; i++) {
      pager.animate();
      await pager.flush();
    }
    assert.equal(pager.commits.at(-1), 10);
    assert.equal(pager.page(10).x, 0);
  } finally { await pager.close(); }
});

test('queued opposite swipes cancel and resize discards pending input', async () => {
  for (const resize of [false, true]) {
    const pager = await mountPager();
    try {
      pager.gesture('onStart');
      pager.gesture('onUpdate', { translationX: -160 });
      pager.gesture('onEnd', { velocityX: -500 });
      pager.animate();
      for (const direction of resize ? [1, 1] : [1, -1]) {
        pager.gesture('onStart');
        pager.gesture('onUpdate', { translationX: -160 * direction });
        pager.gesture('onEnd', { velocityX: -500 * direction });
        pager.gesture('onFinalize');
      }
      if (resize) await pager.resize(600);
      await pager.flush();
      assert.equal(pager.pendingAnimations(), 0);
      assert.equal(pager.page(resize ? 7 : 8).x, 0);
    } finally { await pager.close(); }
  }
});

test('a second swipe catches the moving page without snapping or waiting for the first animation', async () => {
  const pager = await mountPager();
  try {
    pager.gesture('onStart');
    pager.gesture('onUpdate', { translationX: -160 });
    pager.gesture('onEnd', { velocityX: -500 });
    pager.animate(0.5);
    const before = pager.page(8).x;
    pager.gesture('onStart');
    assert.equal(pager.page(8).x, before);
    pager.gesture('onUpdate', { translationX: -180 });
    pager.gesture('onEnd', { velocityX: -500 });
    pager.animate();
    await pager.flush();
    assert.deepEqual(pager.commits, [9]);
    assert.equal(pager.page(9).x, 0);
    assert.ok(pager.pageCount() <= 45);
  } finally { await pager.close(); }
});

test('prepared schedule data covers every repeat week and is reused until the snapshot changes', () => {
  const { prepareScheduleDays } = compile('src/utils/scheduleTime.js');
  const first = [{ subjectId: 'math' }, { subjectId: 'art', startTime: '11:00', endTime: '11:30' }];
  const second = ['physics'];
  const schedule = {
    repeat: 2, starting_week: day(7).toISOString(), start_time: '08:30', duration: 45, breaks: [10],
    schedule: [{ week1: first, week2: second }],
  };
  const getDay = prepareScheduleDays(schedule);
  const monday = getDay(day(7));
  assert.equal(monday.lessons, first);
  assert.equal(getDay(day(21)), monday);
  assert.equal(getDay(day(14)).lessons, second);
  assert.deepEqual(monday.lessonTimes, [{ start: '08:30', end: '09:15' }, { start: '11:00', end: '11:30' }]);
  assert.equal(getDay(day(21)).cards[0], monday.cards[0]);
  const updated = prepareScheduleDays({ ...schedule, duration: 60 });
  assert.equal(updated(day(7)).cards[0].timeInfo.end, '09:30');
  assert.equal(monday.cards[0].timeInfo.end, '09:15');
});

test('decorations wait for an idle visible page and are not built on prefetched days', async () => {
  const pager = await mountPager();
  try {
    assert.equal(pager.page(7).decorationsReady, false);
    pager.gesture('onStart');
    await pager.flush();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 180)));
    assert.equal(pager.page(7).decorationsReady, false);
    pager.gesture('onUpdate', { translationX: -180 });
    pager.gesture('onEnd', { velocityX: -500 });
    pager.animate();
    await pager.flush();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 180)));
    assert.equal(pager.page(8).decorationsReady, true);
    assert.equal(pager.page(9).decorationsReady, false);
    assert.equal(pager.page(7).decorationsReady, false);
  } finally { await pager.close(); }
});

test('changing inactive days does not rerender every timer consumer', async () => {
  const { NowTickProvider, useNowTick } = compile('src/hooks/useNowTick.js');
  const target = new Date();
  target.setDate(target.getDate() + 10);
  let renders = 0;
  const Consumer = React.memo(() => {
    renders++;
    assert.equal(useNowTick(target), null);
    return null;
  });
  const render = (activeDate) => React.createElement(NowTickProvider, { activeDate }, React.createElement(Consumer));
  let renderer;
  await act(async () => { renderer = create(render(target)); });
  try {
    const initialRenders = renders;
    for (let offset = 1; offset <= 20; offset++) {
      const next = new Date(target);
      next.setDate(next.getDate() + offset);
      await act(async () => renderer.update(render(next)));
    }
    assert.equal(renders, initialRenders);
  } finally { await act(async () => renderer.unmount()); }
});

test('card patterns reuse one icon and keep every rotated instance inside safe margins', async () => {
  let reduceMotion = false;
  const progressValues = [];
  const starts = [];
  const reactions = new Set();
  const reanimated = {
    createAnimatedComponent: (component) => component,
    Easing: { linear: (value) => value },
    useAnimatedProps: (read) => ({ read }),
    runOnJS: (callback) => callback,
    useAnimatedReaction: (read, react) => {
      React.useEffect(() => {
        const reaction = () => react(read());
        reactions.add(reaction);
        reaction();
        return () => reactions.delete(reaction);
      }, [read, react]);
    },
    useSharedValue: (initial) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        let current = initial;
        ref.current = {
          get value() { return current; },
          set value(next) {
            if (typeof next === 'object') starts.push(next);
            else current = next;
          },
        };
        progressValues.push(ref.current);
      }
      return ref.current;
    },
    withTiming: (target, config, callback) => ({ target, ...config, callback }),
    withDelay: (delay, animation) => ({ delay, ...animation }),
    cancelAnimation() {},
  };
  const schedule = { subjects: [{ id: 'math', name: 'Mathematics' }], teachers: [], gradients: [] };
  const animated = {
    View: 'AnimatedView',
    Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } },
    timing: (value, config) => ({ start: () => value.setValue(config.toValue), stop() {} }),
  };
  const LessonCard = compile('src/pages/Schedule/components/LessonCard.jsx', {
    'react-native-reanimated': reanimated,
    'react-native': {
      StyleSheet: { create: (x) => x, absoluteFillObject: {} },
      Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity', Animated: animated,
      Platform: { OS: 'ios', select: (options) => options.ios ?? options.default },
    },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', G: 'G', Use: 'Use', LinearGradient: 'LinearGradient', Mask: 'Mask', Rect: 'Rect', Stop: 'Stop' },
    'phosphor-react-native': { Clock: 'Clock', Hourglass: 'Hourglass', User: 'User', MapPin: 'MapPin' },
    '../../../context/ScheduleProvider': { useScheduleData: () => ({ schedule, lang: 'en' }) },
    '../../../context/DayScheduleProvider': { useDaySchedule: () => ({ currentDate: day(7) }) },
    '../../../hooks/useNowTick': { useNowTick: () => null },
    '../../../hooks/useSystemThemeColors': { __esModule: true, default: () => ({ isDark: false }) },
    '../../../hooks/useReducedMotionPreference': { __esModule: true, default: () => reduceMotion },
    '../../../config/themes': { __esModule: true, default: { accentColors: { grey: '#999' } } },
    '../../../components/ui/GradientBackground': { __esModule: true, default: 'GradientBackground' },
    '../../../config/subjectIcons': { getIconComponent: () => 'PatternIcon' },
    '../../../utils/haptics': { triggerHaptic() {} },
    '../../../utils/i18n': { t: (key) => key },
    '../../../utils/gradientColors': {
      colorWithAlpha: (color) => color, getGradientColor: (_, color) => color, getGradientColors: () => [],
      getReadableForeground: () => '#111', isLightForeground: () => false,
      resolveValidColor: (color, fallback) => color ?? fallback,
    },
  }).default;
  const props = { lesson: { subjectId: 'math', timeInfo: { start: '08:30', end: '09:15' } } };
  let renderer;
  await act(async () => { renderer = create(React.createElement(LessonCard, { ...props, decorationsReady: false })); });
  try {
    assert.ok(renderer.root.findAllByType('Text').some((text) => text.props.children === 'Mathematics'));
    await act(async () => renderer.root.findByType('GradientBackground').props.onLayout({ nativeEvent: { layout: { width: 380, height: 100 } } }));
    assert.equal(renderer.root.findAllByType('PatternIcon').length, 0);
    await act(async () => renderer.update(React.createElement(LessonCard, { ...props, decorationsReady: true })));
    assert.equal(starts[0].delay, 0);
    assert.equal(starts[0].duration, 1000);
    const opacityAt = (x, y) => {
      const gradient = renderer.root.findByType('LinearGradient');
      const { x1, y1, x2, y2 } = Object.fromEntries(Object.entries(gradient.props.animatedProps.read()).map(([key, value]) => [key, parseFloat(value) / 100]));
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distance = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      const stops = renderer.root.findAllByType('Stop').map(({ props }) => ({ offset: parseFloat(props.offset) / 100, opacity: props.stopOpacity }));
      const end = stops.findIndex((stop) => stop.offset >= distance);
      if (end === 0) return stops[0].opacity;
      const a = stops[end - 1];
      const b = stops[end];
      return a.opacity + (b.opacity - a.opacity) * (distance - a.offset) / (b.offset - a.offset);
    };
    const wave = () => [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]].map(([x, y]) => opacityAt(x, y));
    assert.equal(renderer.root.findAllByType('Mask').length, 1);
    assert.ok(renderer.root.findAllByType('Use').every((icon) => !icon.props.animatedProps));
    assert.ok(wave().every((opacity) => opacity === 0));
    progressValues[0].value = 0.5;
    assert.equal(opacityAt(1, 0), 1, 'top-right is revealed first');
    assert.equal(opacityAt(0, 1), 0, 'bottom-left is revealed last');
    assert.ok(opacityAt(0.51, 0.49) > opacityAt(0.49, 0.51), 'the wave varies continuously across an icon');
    assert.ok(wave().some((opacity) => opacity > 0 && opacity < 1));
    progressValues[0].value = 1;
    assert.ok(wave().every((opacity) => opacity === 1));
    for (const [width, height] of [[240, 90], [320, 90], [380, 100], [430, 130], [768, 140], [1440, 160]]) {
      await act(async () => renderer.root.findByType('GradientBackground').props.onLayout({ nativeEvent: { layout: { width, height } } }));
      assert.equal(renderer.root.findAllByType('PatternIcon').length, 1);
      const uses = renderer.root.findAllByType('Use');
      assert.ok(uses.length > 0);
      const centers = [];
      for (const instance of uses) {
        const values = instance.props.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
        const [left, top, angle] = values;
        assert.ok(Math.abs(angle) === 8);
        const centerX = left + 9;
        const centerY = top + 9;
        const radians = angle * Math.PI / 180;
        for (const dx of [-9, 9]) for (const dy of [-9, 9]) {
          const x = centerX + dx * Math.cos(radians) - dy * Math.sin(radians);
          const y = centerY + dx * Math.sin(radians) + dy * Math.cos(radians);
          assert.ok(x >= 14 && x <= width - 14, `horizontal clipping at ${width}x${height}`);
          assert.ok(y >= 14 && y <= height - 14, `vertical clipping at ${width}x${height}`);
        }
        for (const [x, y] of centers) assert.ok(Math.hypot(centerX - x, centerY - y) >= 38);
        centers.push([centerX, centerY]);
      }
      assert.ok(Math.abs((Math.min(...centers.map(([x]) => x)) + Math.max(...centers.map(([x]) => x))) / 2 - width / 2) < 0.01);
    }
    assert.equal(starts.length, 1, 'resizing must not restart the reveal');
    await act(async () => renderer.update(React.createElement(LessonCard, { lesson: { ...props.lesson, index: 3 } })));
    assert.equal(starts.at(-1).delay, 540);
    const moving = { value: false };
    await act(async () => renderer.update(React.createElement(LessonCard, { ...props, moving })));
    await act(async () => {
      moving.value = true;
      for (const react of reactions) react();
    });
    assert.equal(renderer.root.findAllByType('Mask').length, 0, 'swiping removes the expensive mask');
    assert.ok(renderer.root.findAllByType('Use').length > 0, 'swiping preserves the pattern');
    const animationCount = starts.length;
    reduceMotion = true;
    await act(async () => renderer.update(React.createElement(LessonCard, { ...props, decorationsReady: false })));
    await act(async () => renderer.update(React.createElement(LessonCard, props)));
    assert.equal(starts.length, animationCount, 'reduced motion must not schedule a wave');
    assert.equal(renderer.root.findAllByType('Mask').length, 0);
  } finally { await act(async () => renderer.unmount()); }
});
