const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}
const themes = load('src/config/themes.js').default;
function environment(platform = 'android') {
  const state = { data: { user: { uid: 'user' }, guest: false, global: { theme: ['dark', 'cyan'] } }, systemScheme: 'light' };
  const applied = [], listeners = new Set();
  const provider = { useScheduleData: () => state.data };
  const mocks = {
    'react-native': {
      Platform: { OS: platform }, TextInput: 'NativeInput', useColorScheme: () => state.systemScheme,
      Appearance: { setColorScheme: value => applied.push(value) },
      AppState: { addEventListener: (_event, callback) => {
        listeners.add(callback);
        return { remove: () => listeners.delete(callback) };
      } },
    },
    '../context/ScheduleProvider': provider, '../../context/ScheduleProvider': provider,
    '@react-native-community/datetimepicker': 'NativePicker',
  };
  return { state, applied, listeners, mocks };
}
async function mount(t, file, env, props = {}, options) {
  const Component = load(file, env.mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, props), options); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, async update(next = props) {
    await act(async () => tree.update(React.createElement(Component, next)));
  } };
}

test('native appearance follows light/dark/OLED, resumes correctly and releases the override on sign-out', async t => {
  const env = environment();
  const component = await mount(t, 'src/components/ui/NativeThemeStyles.jsx', env);
  assert.deepEqual(env.applied, ['dark']);
  env.state.data.global.theme = ['oled', 'red'];
  await component.update();
  assert.deepEqual(env.applied, ['dark']);
  env.state.data.global.theme = ['light', 'red'];
  await component.update();
  assert.deepEqual(env.applied, ['dark', 'light']);
  await act(async () => { for (const callback of env.listeners) callback('active'); });
  assert.equal(env.applied.at(-1), 'light');
  env.state.data.user = null;
  await component.update();
  assert.equal(env.applied.at(-1), 'unspecified');
});

test('guest sessions use their chosen theme and system mode clears the native override', async t => {
  const env = environment('ios');
  env.state.data = { user: null, guest: true, global: { theme: ['oled', 'blue'] } };
  const component = await mount(t, 'src/components/ui/NativeThemeStyles.jsx', env);
  assert.equal(env.applied.at(-1), 'dark');
  env.state.data.global.theme = ['system', 'blue'];
  await component.update();
  assert.equal(env.applied.at(-1), 'unspecified');
});

test('native bridge does not alter browser appearance', async t => {
  const env = environment('web');
  await mount(t, 'src/components/ui/NativeThemeStyles.jsx', env);
  assert.deepEqual(env.applied, []);
  assert.equal(env.listeners.size, 0);
});

test('native appearance override and foreground listeners are released when the app root unmounts', async () => {
  const env = environment();
  const Component = load('src/components/ui/NativeThemeStyles.jsx', env.mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  assert.equal(env.listeners.size, 1);
  await act(async () => tree.unmount());
  assert.equal(env.listeners.size, 0);
  assert.equal(env.applied.at(-1), 'unspecified');
});

test('one native theme bridge lives inside the schedule provider for every app route', () => {
  const filename = path.resolve(__dirname, '../src/Root.jsx');
  const ast = babel.parseSync(fs.readFileSync(filename, 'utf8'), { filename });
  let count = 0;
  babel.traverse(ast, { JSXElement(p) {
    if (p.node.openingElement.name.name !== 'NativeThemeStyles') return;
    count += 1;
    assert.ok(p.findParent(parent => parent.isJSXElement() && parent.node.openingElement.name.name === 'ScheduleProvider'));
  } });
  assert.equal(count, 1);
});

test('all text input types retain values, handlers and native refs while adapting to app theme changes', async t => {
  const env = environment();
  const ref = React.createRef();
  const nativeNode = { focus() {}, blur() {} };
  const onChangeText = () => {};
  const props = { ref, value: '80', keyboardType: 'number-pad', onChangeText, accessibilityLabel: 'Тривалість', style: { fontSize: 16 } };
  const component = await mount(t, 'src/components/ui/AppTextInput.jsx', env, props, { createNodeMock: () => nativeNode });
  let input = component.root().findByType('NativeInput').props;
  assert.equal(ref.current, nativeNode);
  assert.equal(input.value, '80');
  assert.equal(input.onChangeText, onChangeText);
  assert.equal(input.keyboardType, 'number-pad');
  assert.equal(input.keyboardAppearance, 'dark');
  assert.equal(input.cursorColor, themes.accentColors.cyan);
  env.state.data.global.theme = ['light', 'red'];
  await component.update();
  input = component.root().findByType('NativeInput').props;
  assert.equal(input.keyboardAppearance, 'light');
  assert.equal(input.cursorColor, themes.accentColors.red);
  assert.equal(input.selectionHandleColor, themes.accentColors.red);
  assert.equal(input.style[0].color, themes.light.textColor);
  assert.equal(input.accessibilityLabel, 'Тривалість');
});

test('Android pickers retain behavior and localized labels with safe native design and app accents', async t => {
  const env = environment();
  const date = new Date(2026, 10, 2, 8, 30);
  const onChange = () => {};
  const component = await mount(t, 'src/components/ui/AppDateTimePicker.jsx', env, {
    value: date, mode: 'time', onChange, design: 'material', positiveButton: { label: 'Готово', textColor: '#fff' },
  });
  const picker = component.root().findByType('NativePicker').props;
  assert.equal(picker.design, 'default');
  assert.equal(picker.value, date);
  assert.equal(picker.onChange, onChange);
  assert.equal(picker.positiveButton.label, 'Готово');
  assert.equal(picker.positiveButton.textColor, themes.accentColors.cyan);
  assert.equal(picker.negativeButton.textColor, themes.dark.textColor2);
});

test('iOS pickers use app theme instead of a conflicting system preference', async t => {
  const env = environment('ios');
  const component = await mount(t, 'src/components/ui/AppDateTimePicker.jsx', env, { display: 'spinner' });
  assert.equal(component.root().findByType('NativePicker').props.themeVariant, 'dark');
  env.state.data.global.theme = ['light', 'red'];
  await component.update();
  const picker = component.root().findByType('NativePicker').props;
  assert.equal(picker.themeVariant, 'light');
  assert.equal(picker.textColor, themes.light.textColor);
  assert.equal(picker.accentColor, themes.accentColors.red);
  assert.equal(picker.display, 'spinner');
});

test('screens cannot bypass the themed text inputs and date/time pickers', () => {
  const sourceRoot = path.resolve(__dirname, '../src');
  const violations = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(filename); continue; }
      if (!/\.(js|jsx)$/.test(filename)) continue;
      const source = fs.readFileSync(filename, 'utf8');
      if (!/TextInput|datetimepicker/.test(source)) continue;
      const ast = babel.parseSync(source, { filename });
      for (const node of ast.program.body) {
        if (node.type !== 'ImportDeclaration') continue;
        if (node.source.value === 'react-native' && node.specifiers.some(spec => spec.imported?.name === 'TextInput')
          && filename !== path.join(sourceRoot, 'components/ui/AppTextInput.jsx')) violations.push(filename);
        if (node.source.value === '@react-native-community/datetimepicker'
          && filename !== path.join(sourceRoot, 'components/ui/AppDateTimePicker.jsx')) violations.push(filename);
      }
    }
  }
  visit(sourceRoot);
  assert.deepEqual(violations, []);
});
