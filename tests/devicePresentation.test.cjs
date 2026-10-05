const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (name) => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name.endsWith('.js') ? name : name + '.js')))
    : original(name);
  loaded._compile(babel.transformFileSync(filename).code, filename);
  return loaded.exports;
}
const { getDevicePresentation, getDeviceActivity, formatDeviceActivity } = load('src/pages/Settings/components/managers/devicePresentation.js');
test('native phones use one device type and platform plus app title', () => {
  for (const platform of ['Android', 'iOS']) {
    assert.deepEqual(getDevicePresentation({ platform, model: 'Private device name' }, 'en'), { title: `${platform} · PlanIt`, mobile: true });
  }
});
test('mobile web OS is detected before Linux and macOS; browser variants keep their names', () => {
  for (const [name, title, mobile] of [
    ['Mozilla Linux Android Chrome/120', 'Android · Chrome', true],
    ['Mozilla iPhone like Mac OS X CriOS/120 Safari/600', 'iOS · Chrome', true],
    ['Mozilla iPad like Mac OS X FxiOS/120 Safari/600', 'iOS · Firefox', true],
    ['Mozilla Windows Chrome/120 Edg/120', 'Windows · Edge', false],
    ['Mozilla Windows Chrome/120 OPR/99', 'Windows · Opera', false],
    ['Mozilla Linux Android Chrome/120 SamsungBrowser/24', 'Android · Samsung Internet', true],
    ['Mozilla Macintosh Safari/600', 'macOS · Safari', false],
  ]) assert.deepEqual(getDevicePresentation({ platform: 'Web', name }, 'en'), { title, mobile });
});
test('activity uses the newest recorded event across supported timestamps', () => {
  assert.equal(getDeviceActivity({ lastLogin: 1000, lastSeenAt: { seconds: 3 }, lastSyncTime: { toMillis: () => 5000 } }), 5000);
  assert.equal(getDeviceActivity({ lastLogin: '2026-09-20T00:00:00Z', lastSeenAt: 'invalid' }), Date.parse('2026-09-20T00:00:00Z'));
  assert.equal(getDeviceActivity({}), 0);
});
test('relative activity is localized and handles missing or future timestamps', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  assert.equal(formatDeviceActivity({ lastSeenAt: now - 4 * 86400000 }, 'en', now), '4 days ago');
  assert.equal(formatDeviceActivity({ lastSeenAt: now - 4 * 86400000 }, 'uk', now), '4 дні тому');
  assert.equal(formatDeviceActivity({ lastSeenAt: now + 1000 }, 'uk', now), 'щойно');
  assert.equal(formatDeviceActivity({}, 'uk', now), 'Невідомо');
});
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
test('device screen groups sessions and preserves the current device; subscription errors allow retry', async () => {
  const filename = path.resolve(__dirname, '../src/pages/Settings/components/managers/DeviceManagement.jsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  let receive, fail;
  const mocks = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Button', Platform: { OS: 'web' }, Alert: {}, ActivityIndicator: 'Spinner', StyleSheet: { create: (s) => s, hairlineWidth: 1 } },
    'phosphor-react-native': { Monitor: 'Monitor', DeviceMobile: 'DeviceMobile', SignOut: 'SignOut', X: 'X' },
    'firebase/firestore': { collection() {}, onSnapshot(_, next, error) { receive = next; fail = error; return () => {}; } },
    '../../../../utils/deviceService': { getDeviceId: async () => 'current' },
    '../../../../context/ScheduleProvider': { useScheduleData: () => ({ user: { uid: 'user' }, global: {}, lang: 'uk' }) },
    '../../../../layouts/SettingsScreenLayout': 'Layout',
    '../../../../config/firebase': {},
    '../../../../config/themes': { getColors: () => ({}), accentColors: { red: 'red' } },
    '../../../../utils/i18n': load('src/utils/i18n.js'),
    '../../../../components/ui/MorphingLoader': 'Loader',
    './devicePresentation': { getDevicePresentation, getDeviceActivity, formatDeviceActivity },
  };
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : originalRequire(name);
  loaded._compile(babel.transformFileSync(filename).code, filename);
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(loaded.exports.default)); });
    await act(async () => receive({ docs: [
      { id: 'current', data: () => ({ platform: 'iOS', lastIpAddress: '192.0.2.1' }) },
      { id: 'pc', data: () => ({ platform: 'Web', name: 'Windows Chrome/120', lastSeenAt: Date.now() }) },
      { id: 'revoked', data: () => ({ platform: 'Android', status: 'revoked' }) },
    ] }));
    const content = () => tree.root.findAllByType('Text').map((n) => n.props.children).flat().join(' ');
    assert.match(content(), /Поточний пристрій/);
    assert.match(content(), /Інші пристрої/);
    assert.match(content(), /iOS · PlanIt/);
    assert.match(content(), /Windows · Chrome/);
    assert.match(content(), /IP: 192.0.2.1/);
    assert.equal(tree.root.findAllByType('DeviceMobile').length, 1);
    assert.equal(tree.root.findAllByType('Monitor').length, 1);
    const logoutButtons = tree.root.findAllByType('Button').filter((n) => n.props.accessibilityLabel);
    assert.equal(logoutButtons.length, 1);
    assert.match(logoutButtons[0].props.accessibilityLabel, /Windows · Chrome/);
    await act(async () => fail(new Error('offline')));
    assert.match(content(), /Не вдалося завантажити пристрої/);
    assert.match(content(), /Спробувати ще раз/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('relative activity works without Intl constructors and preserves plural forms', () => {
  const relativeTimeFormat = Intl.RelativeTimeFormat;
  const pluralRules = Intl.PluralRules;
  const now = Date.parse('2026-09-25T12:00:00Z');
  try {
    Intl.RelativeTimeFormat = undefined;
    Intl.PluralRules = undefined;
    const format = (seconds, lang = 'uk') => formatDeviceActivity({ lastSeenAt: now - seconds * 1000 }, lang, now);
    for (const [size, words] of [
      [60, ['хвилину', 'хвилини', 'хвилин']],
      [3600, ['годину', 'години', 'годин']],
      [86400, ['день', 'дні', 'днів']],
      [2592000, ['місяць', 'місяці', 'місяців']],
      [31536000, ['рік', 'роки', 'років']],
    ]) {
      for (const [count, word] of [[1, words[0]], [2, words[1]], [5, words[2]], [11, words[2]]]) {
        assert.equal(format(size * count), `${count} ${word} тому`);
      }
    }
    assert.equal(format(21 * 60), '21 хвилину тому');
    assert.equal(format(22 * 60), '22 хвилини тому');
    assert.equal(format(60, 'en'), '1 minute ago');
    assert.equal(format(120, 'en-US'), '2 minutes ago');
    assert.equal(format(3600, 'unsupported'), '1 hour ago');
    assert.equal(format(59), 'щойно');
  } finally {
    Intl.RelativeTimeFormat = relativeTimeFormat;
    Intl.PluralRules = pluralRules;
  }
});
