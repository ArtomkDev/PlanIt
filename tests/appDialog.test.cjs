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
function load(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}

const i18n = load('src/utils/i18n.js');
const themes = load('src/config/themes.js').default;

async function mountDialogs(t, { platform = 'android', theme = ['light', 'blue'], reduceMotion = false, lang = 'uk' } = {}) {
  const native = {
    View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    Modal: ({ children, ...props }) => React.createElement('Modal', props, props.visible ? children : null),
    Platform: { OS: platform },
    StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: { position: 'absolute' } },
    useColorScheme: () => 'light',
  };
  const AppDialog = load('src/components/ui/AppDialog.jsx', { 'react-native': native });
  const { AppDialogProvider, useAppDialog, useIsAppDialogVisible } = load('src/context/AppDialogContext.jsx', {
    'react-native': native,
    '../components/ui/AppDialog': AppDialog,
    '../config/themes': { __esModule: true, default: themes },
    '../hooks/useReducedMotionPreference': { __esModule: true, default: () => reduceMotion },
    '../utils/i18n': i18n,
    './ScheduleProvider': { useScheduleData: () => ({ global: { theme }, lang }) },
  });
  const state = {};
  function Probe() {
    state.dialog = useAppDialog();
    state.visible = useIsAppDialogVisible();
    return null;
  }
  const focused = [];
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(AppDialogProvider, null, React.createElement(Probe)),
      { createNodeMock: element => ({ focus: () => focused.push(element.props.accessibilityLabel) }) },
    );
  });
  t.after(async () => act(async () => tree.unmount()));
  const modal = () => tree.root.findByType('Modal');
  const buttons = () => tree.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
  return {
    state, focused, modal, buttons,
    labels: () => buttons().map(node => node.props.accessibilityLabel),
    press: label => act(async () => buttons().find(node => node.props.accessibilityLabel === label).props.onPress()),
    dismiss: () => act(async () => modal().props.onRequestClose()),
    tapBackdrop: () => act(async () => tree.root.findByProps({ testID: 'app-dialog-backdrop' }).props.onPress()),
    card: () => tree.root.findByProps({ testID: 'app-dialog' }),
  };
}

const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test('confirmations resolve from the chosen button and every dismissal path cancels', async t => {
  const ui = await mountDialogs(t);
  let result;
  await act(async () => {
    result = ui.state.dialog.confirm({ title: 'Вийти?', message: 'Підтвердіть вихід', confirmLabel: 'Вийти', destructive: true });
  });
  assert.equal(ui.state.visible, true);
  assert.equal(ui.modal().props.visible, true);
  assert.equal(ui.card().props.role, 'alertdialog');
  assert.equal(ui.card().props.accessibilityViewIsModal, true);
  assert.deepEqual(ui.labels(), [i18n.t('common.cancel', 'uk'), 'Вийти']);
  const destructive = ui.buttons()[1];
  assert.equal(flatten(destructive.props.style({ pressed: false })).backgroundColor, '#FF3B30');
  await ui.press('Вийти');
  assert.equal(await result, true);
  assert.equal(ui.state.visible, false);
  assert.equal(ui.modal().props.visible, false);

  for (const close of [ui.dismiss, ui.tapBackdrop]) {
    await act(async () => { result = ui.state.dialog.confirm({ title: 'Видалити?', confirmLabel: 'Видалити' }); });
    await close();
    assert.equal(await result, false);
  }
});

test('alerts and multi-option choices resolve once, queue in order, and ignore duplicates', async t => {
  const ui = await mountDialogs(t, { lang: 'en' });
  let first, duplicate, second, choice;
  await act(async () => {
    first = ui.state.dialog.alert({ title: 'Error', message: 'Could not open the link' });
    duplicate = ui.state.dialog.alert({ title: 'Error', message: 'Could not open the link' });
    second = ui.state.dialog.alert({ title: 'Error', message: 'Could not open the file', buttonLabel: 'Close' });
  });
  assert.equal(first, duplicate);
  assert.deepEqual(ui.labels(), [i18n.t('common.ok', 'en')]);
  await ui.press(i18n.t('common.ok', 'en'));
  assert.equal(await first, undefined);
  assert.equal(ui.state.visible, true);
  assert.deepEqual(ui.labels(), ['Close']);
  await ui.dismiss();
  assert.equal(await second, undefined);
  assert.equal(ui.state.visible, false);

  await act(async () => {
    choice = ui.state.dialog.choose({
      title: 'Delete lesson',
      options: [{ value: 'occurrence', label: 'Only this one' }, { value: 'series', label: 'Whole series', destructive: true }],
    });
  });
  assert.deepEqual(ui.labels(), ['Only this one', 'Whole series', i18n.t('common.cancel', 'en')]);
  await ui.press('Whole series');
  assert.equal(await choice, 'series');
  await act(async () => { choice = ui.state.dialog.choose({ title: 'Delete lesson', options: [{ value: 'occurrence', label: 'Only this one' }] }); });
  await ui.dismiss();
  assert.equal(await choice, null);
});

test('the dialog follows the app theme and accent, and reduced motion disables the fade', async t => {
  const dark = await mountDialogs(t, { theme: ['dark', 'green'], reduceMotion: true });
  await act(async () => { dark.state.dialog.confirm({ title: 'Save?', confirmLabel: 'Save' }); });
  const colors = themes.getColors('dark', 'green');
  assert.equal(flatten(dark.card().props.style).backgroundColor, colors.backgroundColor2);
  assert.equal(flatten(dark.buttons()[1].props.style({ pressed: false })).backgroundColor, colors.accentColor);
  assert.equal(dark.modal().props.animationType, 'none');

  const light = await mountDialogs(t);
  await act(async () => { light.state.dialog.alert({ title: 'Done' }); });
  assert.equal(flatten(light.card().props.style).backgroundColor, themes.getColors('light', 'blue').backgroundColor2);
  assert.equal(light.modal().props.animationType, 'fade');
});

test('on web the safe action receives initial focus', async t => {
  const frames = [];
  global.requestAnimationFrame = callback => frames.push(callback);
  global.cancelAnimationFrame = () => {};
  const ui = await mountDialogs(t, { platform: 'web' });
  t.after(() => { delete global.requestAnimationFrame; delete global.cancelAnimationFrame; });
  await act(async () => { ui.state.dialog.confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true }); });
  frames.forEach(callback => callback());
  assert.deepEqual(ui.focused, [i18n.t('common.cancel', 'uk')]);
});

test('application code uses the shared dialog instead of system alerts', () => {
  const offenders = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(js|jsx)$/.test(entry.name) && /\bAlert\.alert\(|window\.(confirm|alert)\(/.test(fs.readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(root, file));
      }
    }
  };
  visit(path.join(root, 'src'));
  assert.deepEqual(offenders, []);
});
