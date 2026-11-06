const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { getStateFromPath, getPathFromState } = require('@react-navigation/core');

global.IS_REACT_ACT_ENVIRONMENT = true;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx', target + '.cjs'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (resolved.endsWith('.json') || resolved.endsWith('.cjs')) return original(name);
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}
const gate = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const schedule = () => ({ name: 'Published copy', repeat: 1, subjects: [{ id: 'math', name: 'Math' }],
  teachers: [{ id: 'teacher', name: 'Teacher', phone: 'private contact' }], schedule: [{ week1: ['math'] }] });
const share = (overrides = {}) => ({ id: 'SHARED123', ownerId: 'owner', scheduleName: 'University', isActive: true,
  createdAt: Date.now() - 60000, expiresAt: Date.now() + 3600000, scheduleData: schedule(), ...overrides });

function serviceHarness() {
  let value = share(), documents = [];
  const reads = [];
  const service = load('src/services/shareService.js', {
    '../config/firebase': { db: {} }, 'expo-crypto': {}, '@react-native-async-storage/async-storage': {},
    'firebase/firestore': { doc: (_db, ...parts) => parts.join('/'),
      getDocFromServer: async ref => { reads.push(ref); return { exists: () => value !== null, data: () => value }; },
      collection: () => ({}), query: () => ({}), where: () => ({}), getDocs: async () => ({ docs: documents }),
    },
  });
  return { service, reads, set: next => { value = next; }, docs: next => { documents = next; } };
}

test('owner previews include expired snapshots but never another account data or private teacher contacts', async () => {
  const env = serviceHarness();
  const source = share({ expiresAt: 1, isActive: false });
  env.set(source);
  const before = JSON.stringify(source);
  const copy = await env.service.getOwnedSharedSchedule('owner', 'shared123');
  assert.equal(copy.id, 'SHARED123');
  assert.equal(copy.scheduleData.teachers[0].phone, undefined);
  assert.equal(JSON.stringify(source), before);
  env.set({ ...source, scheduleData: {} });
  const damaged = await env.service.getOwnedSharedSchedule('owner', 'SHARED123');
  assert.equal(damaged.scheduleData, null);
  assert.equal(damaged.previewError, 'share.manager_preview_failed');
  await assert.rejects(env.service.getOwnedSharedSchedule('another', 'SHARED123'), /not_found/);
  env.set(null);
  await assert.rejects(env.service.getOwnedSharedSchedule('owner', 'SHARED123'), /not_found/);
  const reads = env.reads.length;
  await assert.rejects(env.service.getOwnedSharedSchedule(null, 'SHARED123'), /auth_required/);
  assert.equal(env.reads.length, reads);
});

test('share lists use document IDs and sort numeric and Firestore timestamps consistently', async () => {
  const env = serviceHarness();
  env.docs([{ id: 'FIRST123', data: () => share({ id: 'forged-id', createdAt: 1000 }) },
    { id: 'LATEST123', data: () => share({ createdAt: { toMillis: () => 5000 } }) }]);
  const result = await env.service.getUserSharedSchedules('owner');
  assert.deepEqual(result.map(item => item.id), ['LATEST123', 'FIRST123']);
  assert.equal(env.service.getSharedScheduleTimestamp({ seconds: 0 }), 0);
  assert.equal(env.service.getSharedScheduleTimestamp('broken'), null);
  assert.equal(env.service.getSharedScheduleTimestamp(Number.MAX_VALUE), null);
  for (const expiresAt of [undefined, null, 'broken', 100]) assert.equal(env.service.getSharedScheduleStatus(share({ expiresAt }), 100), 'expired');
  assert.equal(env.service.getSharedScheduleStatus(share({ isActive: false })), 'inactive');
});

async function mount(t, options = {}) {
  let focused = true;
  const state = { user: { uid: 'owner' }, global: { theme: ['dark', 'blue'] }, lang: 'en', ...options.state };
  const copies = [], shares = [], deletes = [], confirmations = [], navigations = [], requests = [], appListeners = [];
  const actual = serviceHarness().service;
  const service = { ...actual,
    getUserSharedSchedules: async uid => { requests.push(uid); return options.fetchList ? options.fetchList(uid) : options.items || [share()]; },
    getOwnedSharedSchedule: async (uid, code) => { requests.push([uid, code]); return options.fetchItem ? options.fetchItem(uid, code) : options.item || share(); },
    deleteSharedSchedule: async code => { deletes.push(code); await options.delete?.(code); },
  };
  const translate = key => key;
  const mocks = {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', Platform: { OS: options.platform || 'ios' },
      StyleSheet: { create: x => x, hairlineWidth: 1 },
      Share: { share: async value => { shares.push(value); await options.share?.(value); } },
      AppState: { addEventListener: (_type, listener) => { appListeners.push(listener); return { remove() {} }; } } },
    'expo-clipboard': { setStringAsync: async value => { copies.push(value); return options.copy?.(value); } },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(() => focused ? callback() : undefined, [callback, focused]) },
    'phosphor-react-native': new Proxy({}, { get: (_target, name) => name }),
    '../../../context/ScheduleProvider': { useScheduleData: () => state },
    '../context/AppDialogContext': { useAppDialog: () => ({ confirm: async value => { confirmations.push(value); return options.confirm ? options.confirm(value) : true; } }) },
    '../../../services/shareService': service, '../services/shareService': service,
    '../../../layouts/SettingsScreenLayout': 'Layout', '../../../components/ui/MorphingLoader': 'Loader',
    '../../../components/ui/TabSwitcher': 'Tabs', '../../../components/ui/SettingsKit/SettingsGroup': 'Group',
    '../../../components/ui/SettingsKit/SettingsRow': 'Row', '../../../components/schedule/SharedSchedulePreview': 'Preview',
    '../../../utils/i18n': { t: translate, getLocale: () => 'en-US' }, '../utils/i18n': { t: translate },
    '../utils/haptics': { triggerHaptic() {} },
  };
  const filename = 'src/pages/Settings/components/' + (options.detail ? 'SharedScheduleDetails' : 'SharedSchedulesManager') + '.jsx';
  const Component = load(filename, mocks).default;
  const navigation = { navigate: (...args) => navigations.push(args), canGoBack: () => true,
    goBack: () => navigations.push(['back']), replace: (...args) => navigations.push(['replace', ...args]) };
  let tree, code = 'SHARED123';
  const element = () => React.createElement(Component, { navigation, route: { params: { code } } });
  await act(async () => { tree = create(element()); });
  t.after(async () => act(async () => tree.unmount()));
  const button = label => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label
    || node.findAllByType('Text').some(text => text.props.children === label));
  return { tree, state, copies, shares, deletes, confirmations, navigations, requests, appListeners, button,
    async update(patch, nextCode = code) { Object.assign(state, patch); code = nextCode; await act(async () => tree.update(element())); },
    async focus(value) { focused = value; await act(async () => tree.update(element())); },
    rows: () => tree.root.findAllByType('Row'),
    text: () => tree.root.findAllByType('Text').map(node => String(node.props.children)).join('\n'),
  };
}

test('the manager filters by status, opens details by code and copies the canonical HTTPS link', async t => {
  const env = await mount(t, { items: [share(), share({ id: 'EXPIRED123', scheduleName: 'Old', expiresAt: 1 })] });
  await act(async () => env.button('share.copy_link: University').props.onPress());
  assert.deepEqual(env.copies, ['https://app.planitflow.com/share/SHARED123']);
  assert.match(env.text(), /common.copied/);
  assert.equal(env.button('share.copy_link: Old').props.disabled, true);
  await act(async () => env.button('share.manager_details: Old').props.onPress());
  assert.deepEqual(env.navigations, [['SharedScheduleDetails', { code: 'EXPIRED123' }]]);
  await act(async () => env.tree.root.findByType('Tabs').props.onTabPress('active'));
  assert.doesNotMatch(env.text(), /Old/);
  await act(async () => env.tree.root.findByType('Tabs').props.onTabPress('ended'));
  assert.match(env.text(), /Old/);
  assert.doesNotMatch(env.text(), /University/);
});

test('long share histories render one page at a time and refresh on returning from details', async t => {
  const env = await mount(t, { items: Array.from({ length: 45 }, (_, index) => share({ id: 'SHARED' + index, scheduleName: 'Course ' + index })) });
  assert.equal(env.tree.root.findAllByType('Button').filter(node => node.props.accessibilityLabel?.startsWith('share.copy_link:')).length, 20);
  await act(async () => env.button('share.manager_next').props.onPress());
  assert.match(env.text(), /Course 20/);
  assert.doesNotMatch(env.text(), /Course 0/);
  await env.focus(false); await env.focus(true);
  assert.equal(env.requests.length, 2);
});

test('a failed refresh retains the loaded list and exposes retry', async t => {
  let fail = false;
  const env = await mount(t, { fetchList: async () => { if (fail) throw new Error('offline'); return [share()]; } });
  fail = true;
  await act(async () => env.button('share.manager_refresh').props.onPress());
  assert.match(env.text(), /University/);
  assert.match(env.text(), /share.manager_load_failed/);
  fail = false;
  await act(async () => env.button('common.retry').props.onPress());
  assert.doesNotMatch(env.text(), /share.manager_load_failed/);
});

test('old account responses cannot replace the new account list and guests issue no private query', async t => {
  const reading = gate();
  const env = await mount(t, { fetchList: uid => uid === 'owner' ? reading.promise : Promise.resolve([share({ ownerId: uid, scheduleName: 'New account' })]) });
  await env.update({ user: { uid: 'new-owner' } });
  await act(async () => { reading.resolve([share()]); await reading.promise; });
  assert.match(env.text(), /New account/);
  assert.doesNotMatch(env.text(), /University/);
  await env.update({ user: null });
  assert.doesNotMatch(env.text(), /New account/);
  assert.equal(env.requests.length, 2);
  assert.match(env.text(), /share.manager_account_required/);
});

test('expired owner details retain the snapshot and disable sharing without creating a schedule', async t => {
  const expired = share({ expiresAt: 1 });
  const env = await mount(t, { detail: true, item: expired });
  assert.equal(env.tree.root.findByType('Preview').props.schedule, expired.scheduleData);
  assert.equal(env.button('share.copy_link').props.disabled, true);
  assert.equal(env.button('share.manager_share').props.disabled, true);
  assert.equal(env.button('share.manager_open_public'), undefined);
  assert.match(env.text(), /share.manager_ended_hint/);
});

test('an unsupported old snapshot does not prevent the owner from removing its shared link', async t => {
  const env = await mount(t, { detail: true, item: share({ scheduleData: null, previewError: 'share.manager_preview_failed', expiresAt: 1 }) });
  assert.equal(env.tree.root.findAllByType('Preview').length, 0);
  assert.match(env.text(), /share.manager_preview_failed/);
  await act(async () => env.rows().find(row => row.props.label === 'share.manager_remove').props.onPress());
  assert.deepEqual(env.deletes, ['SHARED123']);
});

test('copying a code and sharing a link keep the schedule data out of the shared message', async t => {
  const env = await mount(t, { detail: true });
  await act(async () => env.rows().find(row => row.props.label === 'share.code_label').props.onPress());
  assert.deepEqual(env.copies, ['SHARED123']);
  await act(async () => env.button('share.manager_share').props.onPress());
  assert.deepEqual(env.shares, [{ message: 'University: https://app.planitflow.com/share/SHARED123', url: 'https://app.planitflow.com/share/SHARED123' }]);
});

test('the web visitor preview stays on the current site while copying uses the public link', async t => {
  const env = await mount(t, { detail: true, platform: 'web' });
  const preview = env.button('share.manager_open_public');
  assert.equal(preview.props.href, '/share/SHARED123');
  assert.deepEqual(preview.props.hrefAttrs, { target: '_blank', rel: 'noopener noreferrer' });
  await act(async () => env.button('share.copy_link').props.onPress());
  const { WEB_APP_URL } = require('../src/config/website.cjs');
  assert.deepEqual(env.copies, [`${WEB_APP_URL}/share/SHARED123`]);
});

test('clipboard denial shows a recoverable error and never reports a successful copy', async t => {
  let deny = true;
  const env = await mount(t, { detail: true, copy: () => !deny });
  await act(async () => env.button('share.copy_link').props.onPress());
  assert.match(env.text(), /share.manager_copy_failed/);
  assert.doesNotMatch(env.text(), /common.copied/);
  deny = false;
  await act(async () => env.button('share.copy_link').props.onPress());
  assert.match(env.text(), /common.copied/);
  assert.doesNotMatch(env.text(), /share.manager_copy_failed/);
});

test('duplicate revoke presses open one confirmation and cancellation preserves the share', async t => {
  const confirmation = gate();
  const env = await mount(t, { detail: true, confirm: () => confirmation.promise });
  const revoke = env.rows().find(row => row.props.label === 'share.deactivate_btn').props.onPress;
  let first;
  await act(async () => { first = revoke(); await revoke(); });
  assert.equal(env.confirmations.length, 1);
  await act(async () => { confirmation.resolve(false); await first; });
  assert.deepEqual(env.deletes, []);
  assert.deepEqual(env.navigations, []);
  assert.equal(env.tree.root.findAllByType('Preview').length, 1);
});

test('a revoke confirmed after switching accounts cannot delete the old account share', async t => {
  const confirmation = gate();
  const env = await mount(t, { detail: true, confirm: () => confirmation.promise,
    fetchItem: async uid => share({ ownerId: uid, scheduleName: uid }) });
  let revoking;
  await act(async () => { revoking = env.rows().find(row => row.props.label === 'share.deactivate_btn').props.onPress(); });
  await env.update({ user: { uid: 'new-owner' } });
  await act(async () => { confirmation.resolve(true); await revoking; });
  assert.deepEqual(env.deletes, []);
  assert.deepEqual(env.navigations, []);
});

test('a pending revoke cannot survive navigating to another shared record', async t => {
  const confirmation = gate();
  const env = await mount(t, { detail: true, confirm: () => confirmation.promise });
  let revoking;
  await act(async () => { revoking = env.rows().find(row => row.props.label === 'share.deactivate_btn').props.onPress(); });
  await env.update({}, 'OTHER123');
  await act(async () => { confirmation.resolve(true); await revoking; });
  assert.deepEqual(env.deletes, []);
});

test('lowercase detail routes show successful copy feedback for the canonical record', async t => {
  const env = await mount(t, { detail: true });
  await env.update({}, 'shared123');
  await act(async () => env.button('share.copy_link').props.onPress());
  assert.match(env.text(), /common.copied/);
  assert.deepEqual(env.copies, ['https://app.planitflow.com/share/SHARED123']);
});

test('revocation failures keep the snapshot visible and a successful retry returns to the list', async t => {
  let fail = true;
  const env = await mount(t, { detail: true, delete: async () => { if (fail) throw new Error('offline'); } });
  const revoke = () => env.rows().find(row => row.props.label === 'share.deactivate_btn').props.onPress();
  await act(async () => revoke());
  assert.match(env.text(), /share.manager_revoke_failed/);
  assert.equal(env.tree.root.findAllByType('Preview').length, 1);
  fail = false;
  await act(async () => revoke());
  assert.deepEqual(env.deletes, ['SHARED123', 'SHARED123']);
  assert.deepEqual(env.navigations, [['back']]);
});

test('share expiry updates the open list without polling the backend', async t => {
  let current = 1000, expire;
  t.mock.method(Date, 'now', () => current);
  const nativeSetTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (callback, delay, ...args) => {
    if (delay === 101) { expire = callback; return 123; }
    return nativeSetTimeout(callback, delay, ...args);
  });
  const env = await mount(t, { items: [share({ expiresAt: 1100 })] });
  assert.equal(env.button('share.copy_link: University').props.disabled, false);
  current = 1101;
  await act(async () => expire());
  assert.equal(env.button('share.copy_link: University').props.disabled, true);
  assert.equal(env.requests.length, 1);
});

test('the private details URL round-trips by code without embedding snapshot data', () => {
  const main = load('src/navigation/mainLayoutLinking.web.js').default;
  const config = { screens: { MainLayout: main, SharedSchedule: 'share/:code' } };
  const state = getStateFromPath('/settings/shared/SHARED123', config);
  const route = state.routes[0].state.routes[0].state.routes[0].state.routes.at(-1);
  assert.equal(route.name, 'SharedScheduleDetails');
  assert.equal(route.params.code, 'SHARED123');
  assert.equal(route.params.scheduleData, undefined);
  assert.equal(getPathFromState(state, config), '/settings/shared/SHARED123');
});
