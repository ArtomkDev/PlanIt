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
const compiled = new Map();
function load(relative, mocks) {
  const filename = path.join(root, relative);
  if (!compiled.has(filename)) {
    compiled.set(filename, babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      filename, presets: ['babel-preset-expo'],
    }).code);
  }
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : originalRequire(name);
  loaded._compile(compiled.get(filename), filename);
  return loaded.exports;
}

function runtime({ reduceMotion = false, platform = 'web', width = 390 } = {}) {
  const modals = new Map();
  const backHandlers = new Set();
  const keys = new Set();
  const originalDocument = global.document;
  global.document = {
    addEventListener: (_, fn) => keys.add(fn),
    removeEventListener: (_, fn) => keys.delete(fn),
  };
  const reanimated = {
    __esModule: true,
    default: { View: 'AnimatedScene' },
    ReduceMotion: { Always: 'always', System: 'system' },
    useSharedValue: (initial) => React.useRef({ value: initial }).current,
    useAnimatedStyle: (read) => ({ read }),
  };
  const native = {
    View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList',
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: platform, select: (values) => values[platform] || values.default },
    useWindowDimensions: () => ({ width, height: 844 }),
    Keyboard: { dismiss: () => {} },
    BackHandler: {
      addEventListener: (_, fn) => {
        backHandlers.add(fn);
        return { remove: () => backHandlers.delete(fn) };
      },
    },
  };
  const gorhom = {
    BottomSheetModalProvider: ({ children }) => children,
    BottomSheetBackdrop: 'Backdrop',
    BottomSheetHandle: 'Handle',
    useBottomSheetSpringConfigs: (config) => config,
    BottomSheetModal: React.forwardRef((props, ref) => {
      const instance = React.useRef(null);
      if (!instance.current) {
        instance.current = {
          presents: 0, dismisses: 0,
          present() { this.presents++; },
          dismiss() { this.dismisses++; },
        };
      }
      instance.current.props = props;
      modals.set(props.name, instance.current);
      React.useImperativeHandle(ref, () => instance.current, []);
      return React.createElement('Modal', props, props.children);
    }),
  };
  const mocks = { 'react-native': native, 'react-native-reanimated': reanimated, '@gorhom/bottom-sheet': gorhom };
  const provider = load('src/context/BottomSheetPresentationContext.jsx', {
    ...mocks, '../hooks/useReducedMotionPreference': () => reduceMotion,
  });
  const Sheet = load('src/components/ui/BottomSheet.jsx', {
    ...mocks,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../../context/BottomSheetPresentationContext': provider,
    '../../hooks/useReducedMotionPreference': () => reduceMotion,
  }).default;
  let renderer;
  return {
    modals,
    async render(sheets) {
      const tree = React.createElement(provider.BottomSheetPresentationProvider, null,
        sheets.map((props) => React.createElement(Sheet, { key: props.testID, ...props })));
      await act(async () => {
        if (renderer) renderer.update(tree);
        else renderer = create(tree);
      });
    },
    scene: () => renderer.root.findByType('AnimatedScene').props,
    style: () => renderer.root.findByType('AnimatedScene').props.style[1].read(),
    async dismiss(name) {
      const modal = modals.get(name);
      modal.props.animatedIndex.value = -1;
      await act(async () => modal.props.onDismiss());
    },
    async escape() {
      await act(async () => {
        for (const fn of [...keys]) fn({ key: 'Escape', preventDefault() {} });
      });
    },
    async back() {
      await act(async () => {
        for (const fn of [...backHandlers].reverse()) if (fn()) break;
      });
    },
    async cleanup() {
      await act(async () => renderer?.unmount());
      global.document = originalDocument;
      assert.equal(keys.size, 0);
      assert.equal(backHandlers.size, 0);
    },
  };
}

test('background follows the drag, clamps overshoot, and restores after dismissal', async (t) => {
  const app = runtime();
  t.after(() => app.cleanup());
  await app.render([{ testID: 'editor' }]);
  const index = app.modals.get('editor').props.animatedIndex;
  assert.equal(app.style().transform[1].scale, 1);
  assert.equal(app.scene().pointerEvents, 'none');
  assert.equal(app.scene().inert, true);
  index.value = -0.5;
  assert.equal(app.style().transform[1].scale, 0.97);
  assert.equal(app.style().borderRadius, 14);
  index.value = 1.2;
  assert.equal(app.style().transform[1].scale, 0.94);
  index.value = -2;
  assert.equal(app.style().transform[1].scale, 1);
  await app.dismiss('editor');
  assert.equal(app.scene().pointerEvents, 'auto');
  assert.equal(app.scene().accessibilityElementsHidden, false);
  assert.equal(app.scene().inert, false);
});

test('closing or unmounting a nested sheet keeps the underlying sheet depth', async (t) => {
  const app = runtime();
  t.after(() => app.cleanup());
  await app.render([{ testID: 'editor' }, { testID: 'calendar' }]);
  app.modals.get('editor').props.animatedIndex.value = 1;
  app.modals.get('calendar').props.animatedIndex.value = -0.8;
  assert.equal(app.style().transform[1].scale, 0.94);
  await app.dismiss('calendar');
  assert.equal(app.style().transform[1].scale, 0.94);
  await app.render([]);
  assert.equal(app.style().transform[1].scale, 1);
  assert.equal(app.scene().pointerEvents, 'auto');
});

test('hidden sheets never dismiss an unpresented modal; controlled reopen waits for dismissal', async (t) => {
  const app = runtime();
  t.after(() => app.cleanup());
  let closes = 0;
  const props = { testID: 'editor', onClose: () => closes++ };
  await app.render([{ ...props, visible: false }]);
  const modal = app.modals.get('editor');
  assert.equal(modal.dismisses, 0);
  assert.equal(app.scene().pointerEvents, 'auto');
  await app.render([{ ...props, visible: true }]);
  await app.render([{ ...props, visible: false }]);
  await app.render([{ ...props, visible: true }]);
  assert.equal(modal.presents, 1);
  assert.equal(modal.dismisses, 1);
  await app.dismiss('editor');
  assert.equal(modal.presents, 2);
  assert.equal(closes, 0);
  assert.equal(app.scene().pointerEvents, 'none');
});

test('Escape closes only the top sheet even when lower listeners were registered later', async (t) => {
  const app = runtime();
  t.after(() => app.cleanup());
  await app.render([{ testID: 'editor', onMinimize() {} }, { testID: 'calendar' }]);
  await app.render([{ testID: 'editor', onMinimize() {} }, { testID: 'calendar' }]);
  await app.escape();
  await app.escape();
  assert.equal(app.modals.get('calendar').dismisses, 1);
  assert.equal(app.modals.get('editor').dismisses, 0);
  await app.dismiss('calendar');
  await app.escape();
  assert.equal(app.modals.get('editor').dismisses, 1);
});

test('Android back minimizes the top editor and imperative close preserves its close callback', async (t) => {
  const app = runtime({ platform: 'android' });
  t.after(() => app.cleanup());
  const ref = React.createRef();
  let minimized = 0;
  let closed = 0;
  const props = { testID: 'editor', ref, onMinimize: () => minimized++, onClose: () => closed++ };
  await app.render([props]);
  await app.back();
  await app.dismiss('editor');
  assert.equal(minimized, 1);
  assert.equal(closed, 0);
  await app.render([{ ...props, visible: false }]);
  await app.render([props]);
  await act(async () => ref.current.close());
  await app.dismiss('editor');
  assert.equal(closed, 1);
  assert.equal(minimized, 1);
});

test('reduced motion disables spatial effects while keeping modal interaction isolation', async (t) => {
  const app = runtime({ reduceMotion: true });
  t.after(() => app.cleanup());
  await app.render([{ testID: 'editor' }]);
  const modal = app.modals.get('editor');
  modal.props.animatedIndex.value = 1;
  assert.equal(modal.props.overrideReduceMotion, 'always');
  assert.equal(app.style().transform[1].scale, 1);
  assert.equal(app.style().borderRadius, 0);
  assert.equal(app.scene().pointerEvents, 'none');
});

test('desktop uses a gentler depth and header belongs to the drag handle', async (t) => {
  const app = runtime({ width: 1200 });
  t.after(() => app.cleanup());
  const header = React.createElement('EditorHeader');
  await app.render([{ testID: 'editor', header }]);
  const modal = app.modals.get('editor');
  modal.props.animatedIndex.value = 0;
  assert.equal(app.style().transform[1].scale, 0.97);
  assert.equal(modal.props.detached, true);
  assert.ok(modal.props.handleComponent({}).props.children.includes(header));
  assert.equal(modal.props.enablePanDownToClose, true);
});


test('custom header background is opt-in and leaves the drag handle and editor header intact', async (t) => {
  const app = runtime();
  t.after(() => app.cleanup());
  const header = React.createElement('ViewerHeader');
  const background = React.createElement('GradientBackground');
  await app.render([{ testID: 'viewer', header, headerBackground: background, handleColor: '#fff' }]);
  const custom = app.modals.get('viewer').props.handleComponent({});
  assert.equal(custom.props.children[0].props.pointerEvents, 'none');
  assert.equal(custom.props.children[0].props.children, background);
  assert.equal(custom.props.children[1].props.indicatorStyle[1].backgroundColor, '#fff');
  assert.ok(custom.props.children.includes(header));
  await app.render([{ testID: 'editor', header }]);
  const standard = app.modals.get('editor').props.handleComponent({});
  assert.equal(standard.props.children[0], undefined);
  assert.equal(standard.props.children[1].props.style.height, 44);
  assert.ok(standard.props.children.includes(header));
});
