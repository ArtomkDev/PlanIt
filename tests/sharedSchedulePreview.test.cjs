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
    const resolved = [target, target + '.js', target + '.jsx', target + '.cjs'].find(file => fs.existsSync(file));
    if (resolved.endsWith('.json') || resolved.endsWith('.cjs')) return original(name);
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}

let ids = 0;
const crypto = { randomUUID: () => `copy-${++ids}` };
const fixture = () => ({
  name: 'University', repeat: 2, duration: 45, start_time: '08:30', breaks: [0, 20], slotDurations: [45, 60, 80],
  subjects: [{ id: 'math', name: 'Math', note: 'Shared note', links: ['lecture'] }],
  links: [{ id: 'lecture', url: 'https://example.com/class', label: 'Lecture' }],
  schedule: [{ week1: [null, { subjectId: 'math', timeMode: 'slot', slotNumber: 2 }],
    week2: [{ subjectId: 'math', timeMode: 'custom', startTime: '14:15', endTime: '15:00' }] }],
});
const payload = () => ({ id: 'SHARED123', ownerName: 'Teacher', scheduleData: fixture(), isActive: true,
  expiresAt: { toMillis: () => Date.now() + 3600000 } });

function serviceHarness() {
  let read = payload(), next, failure;
  const values = new Map();
  const service = load('src/services/shareService.js', {
    'expo-crypto': crypto,
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) || null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key),
    },
    '../config/firebase': { db: {} },
    'firebase/firestore': {
      doc: (_db, ...parts) => parts.join('/'),
      getDocFromServer: async () => ({ exists: () => read !== null, data: () => read }),
      onSnapshot: (_reference, _options, onData, onError) => { next = onData; failure = onError; return () => {}; },
    },
  });
  return { service, values, setRead: value => { read = value; }, emit: (value, fromCache = false) => next({
    metadata: { fromCache }, exists: () => value !== null, data: () => value,
  }), fail: error => failure(error) };
}

test('server preview validates data without creating IDs or mutating the shared payload', async () => {
  const { service, setRead } = serviceHarness();
  const source = payload();
  const original = JSON.stringify(source.scheduleData);
  setRead(source);
  const beforeIds = ids;
  const result = await service.fetchSharedSchedule('https://app.planitflow.com/share/shared123?from=chat');
  assert.equal(ids, beforeIds);
  assert.equal(result.scheduleData.id, undefined);
  assert.equal(JSON.stringify(source.scheduleData), original);
  assert.deepEqual(result.scheduleData.slotDurations, [45, 60, 80]);
  assert.equal(result.scheduleData.schedule[0].week1[0].slotNumber, 2);
  assert.equal(result.scheduleData.schedule[0].week2[0].startTime, '14:15');
  for (const [value, message] of [[null, 'not_found'], [{ ...source, isActive: false }, 'inactive'],
    [{ ...source, expiresAt: Date.now() - 1 }, 'expired'], [{ ...source, expiresAt: undefined }, 'expired'],
    [{ ...source, scheduleData: {} }, 'invalid_shared_schedule']]) {
    setRead(value);
    await assert.rejects(service.fetchSharedSchedule('SHARED123'), new RegExp(message));
  }
});

test('public subscriptions ignore stale cache and remove access after revocation', () => {
  const env = serviceHarness();
  const values = [], errors = [];
  env.service.subscribeToSharedSchedule('SHARED123', value => values.push(value), error => errors.push(error));
  env.emit(payload(), true);
  assert.equal(values.length, 0);
  env.emit(payload());
  assert.equal(values.length, 1);
  env.emit(null);
  assert.equal(errors[0].message, 'not_found');
  env.fail({ code: 'permission-denied' });
  assert.equal(env.service.getSharedScheduleErrorKey(errors[1]), 'share.error_unavailable');
});

test('share input accepts complete native and HTTPS links and rejects truncated or unrelated paths', () => {
  const { service } = serviceHarness();
  for (const input of ['shared123', 'planit://share/shared123', 'planit:///share/shared123',
    'https://app.planitflow.com/share/shared123/#preview']) assert.equal(service.normalizeShareCodeInput(input), 'SHARED123');
  for (const input of ['https://example.com/share/SHARED123/extra', 'https://example.com/not-share/SHARED123',
    'https://example.com/share/' + 'A'.repeat(33), 'SHARED123/extra']) assert.throws(() => service.normalizeShareCodeInput(input), /invalid_code/);
});

test('Android browser intent opens the shared schedule in the app and falls back to Google Play', () => {
  const { service } = serviceHarness();
  assert.equal(service.createSharedScheduleAndroidIntentUrl('shared123'), 'intent://share/SHARED123#Intent;scheme=planit;'
    + 'package=com.artomk.planit;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.artomk.planit;end');
  assert.throws(() => service.createSharedScheduleAndroidIntentUrl('bad/code'), /invalid_code/);
});

const native = { View: 'View', Text: 'Text', ScrollView: 'Scroll', TouchableOpacity: 'Button', Pressable: 'WeekButton',
  Platform: { OS: 'web' }, StyleSheet: { create: value => value, hairlineWidth: 1 }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: 390 }),
  AppState: { addEventListener: () => ({ remove() {} }) } };

async function mountScreen(t, options = {}) {
  const listeners = [], appListeners = [], added = [], selected = [];
  const navigation = [], guestStarts = [], preferences = [];
  const legalReads = [], legalWrites = [];
  let pending = options.pending || null;
  let tree;
  const state = { lang: 'en', user: null, guest: false, isLoading: false, ...options.state };
  const screen = load('src/pages/Schedule/SharedScheduleScreen.jsx', {
    'react-native': { ...native, Platform: { OS: options.platform || 'web' }, AppState: { addEventListener: (_type, listener) => { appListeners.push(listener); return { remove() {} }; } } },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-crypto': crypto,
    'phosphor-react-native': { CaretDown: 'Icon', CaretUp: 'Icon', DownloadSimple: 'Icon', ArrowLeft: 'Icon', Moon: 'Icon', Sun: 'Icon' },
    '../../components/ui/PlanItWordmark': 'Wordmark',
    '../../components/schedule/SharedScheduleAccessSheet': 'AccessSheet',
    '../../services/legalAcceptanceService': {
      hasLegalAcceptance: async scope => { legalReads.push(scope); return options.readAcceptance ? options.readAcceptance(scope) : options.accepted !== false; },
      recordLegalAcceptance: async (_lang, scope) => { legalWrites.push(scope); },
    },
    '../../context/ScheduleProvider': {
      useScheduleData: () => state,
      useScheduleActions: () => ({ setSignedOutPreferences: value => preferences.push(value), addSchedule: async (copy, config) => {
        const owner = state.user?.uid || state.guest;
        added.push({ copy, config }); await options.persist?.();
        if (config.select && owner === (state.user?.uid || state.guest)) selected.push(copy.id);
      } }),
    },
    '../../hooks/useAppTheme': () => ({ colors: {}, colorScheme: 'light' }),
    '../../components/ui/MorphingLoader': 'Loader',
    '../../components/schedule/SharedSchedulePreview': 'Preview',
    '../../services/shareService': {
      fetchSharedSchedule: async () => options.fetch ? options.fetch() : payload(),
      readSharedScheduleImport: async () => pending,
      prepareSharedScheduleImport: async (code, changes = {}) => (pending = { code, copyId: pending?.copyId || 'copy-id', ...pending, ...changes }),
      clearSharedScheduleImport: async () => { pending = null; },
      subscribeToSharedSchedule: (code, next, fail) => {
        const listener = { code, next, fail, stopped: false }; listeners.push(listener);
        return () => { listener.stopped = true; };
      },
      getSharedScheduleErrorKey: () => 'share.error_unavailable',
    },
  }).default;
  const render = code => React.createElement(screen, { route: { params: { code } }, navigation: {
    reset: () => { throw new Error('reset replaces the browser history entry'); }, navigate: (...args) => navigation.push(args),
    push: name => navigation.push(['push', name]), replace: name => navigation.push(['replace', name]),
    canGoBack: () => options.canGoBack === true, goBack: () => navigation.push(['back']),
  }, fallbackRoute: options.fallbackRoute || 'Auth', onGuestLogin: () => guestStarts.push(true) });
  await act(async () => { tree = create(render('SHARED123')); });
  t.after(async () => act(async () => tree.unmount()));
  const emit = async (value = { ...payload(), expiresAt: Date.now() + 3600000 }) => act(async () => listeners.at(-1).next(value));
  const save = () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === 'Save a separate copy');
  return { tree, added, selected, listeners, state, emit, save, appListeners, navigation, guestStarts, legalReads, legalWrites, preferences, pending: () => pending,
    update: async code => act(async () => tree.update(render(code))) };
}

test('signed-out visitors read the schedule without creating a guest session or saving a schedule', async t => {
  const env = await mountScreen(t);
  await env.emit();
  assert.equal(env.tree.root.findByType('Preview').props.schedule.name, 'University');
  assert.ok(env.save());
  assert.deepEqual(env.added, []);
  assert.deepEqual(env.selected, []);
  await act(async () => env.save().props.onPress());
  assert.equal(env.tree.root.findByType('AccessSheet').props.visible, true);
  assert.deepEqual(env.added, []);
  const legalLinks = env.tree.root.findAllByType('Button').filter(node => /\/(privacy|terms)/.test(node.props.href || ''));
  assert.equal(legalLinks.length, 2);
  assert.ok(legalLinks.every(node => node.props.hrefAttrs.rel.includes('noreferrer')));
  await act(async () => env.listeners.at(-1).fail({ code: 'permission-denied' }));
  assert.equal(env.tree.root.findAllByType('Preview').length, 0);
});

test('signed-out visitors switch theme and language from the preview header', async t => {
  const env = await mountScreen(t);
  const button = label => env.tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
  await act(async () => button('Switch to dark theme').props.onPress());
  await act(async () => button('Switch language to Українська').props.onPress());
  env.state.lang = 'uk';
  await env.update('SHARED123');
  await act(async () => button('Змінити мову на English').props.onPress());
  assert.deepEqual(env.preferences, [{ theme: ['dark', 'blue'] }, { language: 'uk' }, { language: 'en' }]);
});

for (const state of [{ user: { uid: 'existing-user' } }, { guest: true }]) {
  test(`${state.guest ? 'guest' : 'account'} sessions keep appearance in Settings instead of the preview header`, async t => {
    const env = await mountScreen(t, { state });
    assert.equal(env.tree.root.findAllByType('Button').some(node => /theme|language/.test(node.props.accessibilityLabel || '')), false);
  });
}

for (const [name, state] of [['account', { user: { uid: 'existing-user' } }], ['guest', { guest: true }]]) {
  for (const storageFails of [false, true]) {
    test(`an active ${name} saves and opens a copy without a legal prompt when its receipt is ${storageFails ? 'unreadable' : 'missing'}`, async t => {
      const env = await mountScreen(t, { state, accepted: false,
        readAcceptance: async () => { if (storageFails) throw new Error('unavailable'); return false; } });
      await env.emit();
      await act(async () => env.save().props.onPress());
      assert.equal(env.tree.root.findByType('AccessSheet').props.visible, false);
      assert.equal(env.added.length, 1);
      assert.deepEqual(env.navigation, [['MainLayout', { screen: 'Tabs', params: { screen: 'ScheduleTab' } }]]);
      assert.deepEqual(env.legalReads, []);
      assert.deepEqual(env.legalWrites, []);
    });
  }
}

test('the signed-out warning closes as soon as a guest session appears and stale entry actions do nothing', async t => {
  const env = await mountScreen(t, { accepted: false });
  await env.emit();
  await act(async () => env.save().props.onPress());
  const previousContinue = env.tree.root.findByType('AccessSheet').props.onContinue;
  assert.equal(env.tree.root.findByType('AccessSheet').props.visible, true);
  env.state.guest = true;
  await env.update('SHARED123');
  assert.equal(env.tree.root.findByType('AccessSheet').props.visible, false);
  await act(async () => previousContinue('guest', true));
  assert.deepEqual(env.guestStarts, []);
  assert.deepEqual(env.legalWrites, []);
  await act(async () => env.save().props.onPress());
  assert.equal(env.added.length, 1);
});

for (const fallbackRoute of ['Auth', 'MainLayout']) {
  for (const canGoBack of [false, true]) {
    test(`the web logo adds ${fallbackRoute} to history when a previous app route ${canGoBack ? 'exists' : 'does not exist'}`, async t => {
      const env = await mountScreen(t, { fallbackRoute, canGoBack });
      await env.emit();
      const logo = env.tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === 'Back to PlanIt');
      await act(async () => logo.props.onPress());
      assert.deepEqual(env.navigation, [['push', fallbackRoute]]);
      assert.deepEqual(env.added, []);
    });
  }
}

test('native logo navigation retains its existing back behavior', async t => {
  const env = await mountScreen(t, { platform: 'ios', canGoBack: true });
  await env.emit();
  const logo = env.tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === 'Back to PlanIt');
  await act(async () => logo.props.onPress());
  assert.deepEqual(env.navigation, [['back']]);
});

test('switching links ignores late responses and returning to the app rechecks access', async t => {
  const env = await mountScreen(t);
  const oldListener = env.listeners[0];
  await env.update('OTHER123');
  assert.equal(oldListener.stopped, true);
  await act(async () => oldListener.next({ ...payload(), expiresAt: Date.now() + 3600000 }));
  assert.equal(env.tree.root.findAllByType('Preview').length, 0);
  await env.emit();
  await act(async () => env.appListeners.at(-1)('active'));
  assert.equal(env.tree.root.findAllByType('Preview').length, 0);
  assert.equal(env.listeners.at(-1).code, 'OTHER123');
});

test('an expired open preview disappears without relying on a new server snapshot', async t => {
  const env = await mountScreen(t);
  await env.emit({ ...payload(), expiresAt: Date.now() - 1 });
  assert.equal(env.tree.root.findAllByType('Preview').length, 0);
  assert.ok(env.tree.root.findAllByType('Text').some(node => node.props.children === 'Link has expired'));
});

test('a save finishing after an account switch cannot select a schedule in the new account', async t => {
  let complete;
  const env = await mountScreen(t, { state: { user: { uid: 'one' } }, persist: () => new Promise(resolve => { complete = resolve; }) });
  await env.emit();
  let saving;
  await act(async () => { saving = env.save().props.onPress(); });
  env.state.user = { uid: 'two' };
  await env.update('SHARED123');
  await act(async () => { complete(); await saving; });
  assert.deepEqual(env.selected, []);
});

test('saving is explicit and duplicate presses and persistence retries keep one independent copy', async t => {
  let writes = 0;
  const env = await mountScreen(t, { state: { guest: true }, persist: async () => { if (++writes === 1) throw new Error('disk full'); } });
  await env.emit();
  assert.deepEqual(env.added, []);
  const press = env.save().props.onPress;
  await act(async () => { await Promise.all([press(), press()]); });
  assert.equal(env.added.length, 1);
  assert.deepEqual(env.selected, []);
  await act(async () => env.save().props.onPress());
  assert.equal(env.added.length, 2);
  assert.equal(env.added[0].copy.id, env.added[1].copy.id);
  assert.equal(env.added[0].config.persistLocally, true);
  assert.deepEqual(env.selected, [env.added[0].copy.id]);
  assert.equal(env.added[0].copy.ownerId, undefined);
});

test('the actual preview renders times, notes, weeks and safe browser links', async t => {
  const Component = load('src/components/schedule/SharedSchedulePreview.jsx', {
    'react-native': native,
    'phosphor-react-native': { ArrowClockwise: 'Icon', ArrowRight: 'Icon', CalendarBlank: 'Icon', CalendarCheck: 'Icon', CaretDown: 'Icon', CaretUp: 'Icon', Clock: 'Icon' },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, { schedule: fixture(), lang: 'en', themeColors: {} })); });
  t.after(async () => act(async () => tree.unmount()));
  const text = () => tree.root.findAllByType('Text').map(node => React.Children.toArray(node.props.children).join(' ')).join('\n');
  await act(async () => tree.root.findAllByType('WeekButton').find(node => node.props.accessibilityLabel === 'Week 1').props.onPress());
  assert.match(text(), /09:15 – 10:15/);
  assert.match(text(), /Math/);
  assert.doesNotMatch(text(), /Shared note/);
  await act(async () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel?.includes('Math')).props.onPress());
  assert.match(text(), /Shared note/);
  assert.equal(tree.root.findAllByType('Button').find(node => node.props.href).props.href, 'https://example.com/class');
  await act(async () => tree.root.findAllByType('WeekButton').find(node => node.props.accessibilityLabel === 'Week 2').props.onPress());
  assert.match(text(), /14:15 – 15:00/);
});

test('both platforms resolve shared links to a public root screen rather than an authenticated layout', () => {
  for (const filename of ['src/navigation/mainLayoutLinking.js', 'src/navigation/mainLayoutLinking.web.js']) {
    const main = load(filename, { '../widgets/widgetLinking': { parseWidgetLessonIntent: value => value } }).default;
    const config = { screens: { MainLayout: main, SharedSchedule: 'share/:code', Auth: 'auth' } };
    const state = getStateFromPath('/share/SHARED123', config);
    assert.equal(state.routes[0].name, 'SharedSchedule');
    assert.equal(getPathFromState(state, config), '/share/SHARED123');
  }
  const root = fs.readFileSync(path.resolve(__dirname, '../src/Root.jsx'), 'utf8');
  assert.match(root, /SharedSchedule: 'share\/:code'/);
  assert.ok(root.indexOf('<Stack.Screen name="SharedSchedule">') > root.indexOf('<Stack.Screen name="PasswordReset">'));
});

test('pending imports survive a restart, retain one copy id and do not capture schedule content', async () => {
  const env = serviceHarness();
  const first = await env.service.prepareSharedScheduleImport('shared123', { stage: 'auth', authView: 'signup', scheduleData: fixture() });
  const restored = await env.service.readSharedScheduleImport();
  assert.equal(restored.copyId, first.copyId);
  assert.equal(restored.authView, 'signup');
  assert.equal(restored.scheduleData, undefined);
  const ready = await env.service.prepareSharedScheduleImport('SHARED123', { stage: 'ready', scope: 'guest' });
  assert.equal(ready.copyId, first.copyId);
  assert.equal(ready.scheduleData, undefined);
  await env.service.clearSharedScheduleImport('another-operation');
  assert.ok(await env.service.readSharedScheduleImport());
  await env.service.clearSharedScheduleImport(first.copyId);
  assert.equal(await env.service.readSharedScheduleImport(), null);
});

test('expired and malformed pending imports never resume', async () => {
  const env = serviceHarness();
  await env.service.prepareSharedScheduleImport('SHARED123');
  const key = [...env.values.keys()][0];
  const intent = JSON.parse(env.values.get(key));
  env.values.set(key, JSON.stringify({ ...intent, createdAt: Date.now() - 86400001 }));
  assert.equal(await env.service.readSharedScheduleImport(), null);
  env.values.set(key, '{broken');
  assert.equal(await env.service.readSharedScheduleImport(), null);
});

test('continuation restores only its own link and preserves legal, password reset and widget destinations', () => {
  const { service } = serviceHarness();
  const intent = { code: 'SHARED123', stage: 'auth' };
  assert.equal(service.resolveSharedScheduleImportUrl('https://app.planitflow.com/auth', intent, null), 'planit://auth');
  assert.equal(service.resolveSharedScheduleImportUrl('https://app.planitflow.com/auth', intent, 'user:one'), 'planit://share/SHARED123');
  for (const url of ['planit://legal/privacy', 'planit://password-reset?oobCode=secret', 'planit://widget/lesson', 'https://app.planitflow.com/share/OTHER123']) {
    assert.equal(service.resolveSharedScheduleImportUrl(url, intent, 'guest'), url);
  }
  assert.equal(service.resolveSharedScheduleImportUrl(null, { ...intent, stage: 'ready', scope: 'user:one' }, 'user:two'), null);
});

test('a new visitor must accept the documents before entering guest mode and saving the pending copy', async t => {
  const env = await mountScreen(t, { accepted: false });
  await env.emit();
  await act(async () => env.save().props.onPress());
  const sheet = () => env.tree.root.findByType('AccessSheet');
  await act(async () => sheet().props.onContinue('guest', false));
  assert.equal(env.guestStarts.length, 0);
  await act(async () => sheet().props.onContinue('guest', true));
  assert.equal(env.guestStarts.length, 1);
  assert.equal(env.pending().stage, 'ready');
  assert.equal(env.pending().scope, 'guest');
  assert.deepEqual(env.added, []);
});

test('sign-up preserves the import intent without saving before authorization', async t => {
  const env = await mountScreen(t);
  await env.emit();
  await act(async () => env.save().props.onPress());
  await act(async () => env.tree.root.findByType('AccessSheet').props.onContinue('signup', true));
  assert.equal(env.pending().stage, 'auth');
  assert.equal(env.pending().authView, 'signup');
  assert.deepEqual(env.navigation, [['Auth', { importRequestId: 'copy-id' }]]);
  assert.deepEqual(env.added, []);
});

test('cancelling the access sheet clears only its pending import and does not save', async t => {
  const env = await mountScreen(t);
  await env.emit();
  await act(async () => env.save().props.onPress());
  await act(async () => env.tree.root.findByType('AccessSheet').props.onClose());
  assert.equal(env.pending(), null);
  assert.deepEqual(env.added, []);
  assert.equal(env.tree.root.findByType('AccessSheet').props.visible, false);
});

test('an accepted guest session automatically resumes and opens the saved schedule', async t => {
  const env = await mountScreen(t, { state: { guest: true }, pending: { code: 'SHARED123', copyId: 'stable-copy', stage: 'ready', scope: 'guest' } });
  await env.emit();
  assert.equal(env.added.length, 1);
  assert.equal(env.added[0].copy.id, 'stable-copy');
  assert.equal(env.added[0].config.select, true);
  assert.deepEqual(env.navigation, [['MainLayout', { screen: 'Tabs', params: { screen: 'ScheduleTab' } }]]);
  assert.equal(env.pending(), null);
});

test('an unavailable share cannot be saved even when its old preview is already visible', async t => {
  const env = await mountScreen(t, { state: { guest: true }, fetch: async () => { throw new Error('expired'); } });
  await env.emit();
  await act(async () => env.save().props.onPress());
  assert.deepEqual(env.added, []);
  assert.deepEqual(env.navigation, []);
});

test('legal acceptance records versions per scope and expires unclaimed entry receipts', async () => {
  const values = new Map();
  const service = load('src/services/legalAcceptanceService.js', {
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) || null, setItem: async (key, value) => values.set(key, value),
      removeItem: async key => values.delete(key), multiRemove: async keys => keys.forEach(key => values.delete(key)),
    },
    '../config/legalDocuments.generated': { getLegalDocument: type => ({ version: type === 'terms' ? '2.4' : '2.3' }) },
  });
  assert.equal(await service.hasLegalAcceptance('guest'), false);
  await service.recordLegalAcceptance('uk', 'entry');
  await service.claimEntryLegalAcceptance('one', 'uk');
  assert.equal(await service.hasLegalAcceptance('user:one'), true);
  assert.equal(await service.hasLegalAcceptance('entry'), false);
  assert.equal(await service.hasLegalAcceptance('user:two'), false);
  const key = [...values.keys()][0], receipt = JSON.parse(values.get(key));
  values.set(key, JSON.stringify({ ...receipt, terms: 'old-version' }));
  assert.equal(await service.hasLegalAcceptance('user:one'), false);
  await service.recordLegalAcceptance('en', 'entry');
  const entryKey = [...values.keys()].find(key => key.endsWith(':entry'));
  values.set(entryKey, JSON.stringify({ ...JSON.parse(values.get(entryKey)), acceptedAt: Date.now() - 86400001 }));
  assert.equal(await service.hasLegalAcceptance('entry'), false);
  await service.recordLegalAcceptance('uk', 'guest');
  await service.clearLegalAcceptance('one');
  assert.equal(await service.hasLegalAcceptance('guest'), true);
});

test('all session choices stay disabled until the legal checkbox is explicitly selected', async t => {
  const calls = [], documents = [];
  const Component = load('src/components/schedule/SharedScheduleAccessSheet.jsx', {
    'react-native': native,
    '../ui/BottomSheet': { __esModule: true, default: 'Sheet', SheetScrollView: 'Scroll' },
    'phosphor-react-native': { CheckSquare: 'Check', Square: 'Square' },
    '../../utils/haptics': { triggerHaptic() {} },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, {
    visible: true, onClose() {}, onContinue: (...args) => calls.push(args),
    needsAcceptance: true, busy: false, colors: {}, lang: 'en', onOpenDocument: type => documents.push(type),
  })); });
  t.after(async () => act(async () => tree.unmount()));
  const choices = () => tree.root.findAllByType('Button').filter(node => node.props.accessibilityRole === 'button' && node.props.accessibilityState);
  assert.equal(choices().length, 3);
  assert.ok(choices().every(node => node.props.disabled));
  const checkbox = tree.root.findAllByType('Button').find(node => node.props.accessibilityRole === 'checkbox');
  assert.equal(checkbox.props.accessibilityState.checked, false);
  await act(async () => checkbox.props.onPress());
  assert.ok(choices().every(node => !node.props.disabled));
  await act(async () => choices()[0].props.onPress());
  assert.deepEqual(calls, [['guest', true]]);
});

test('a twelve-week cycle keeps empty weeks dimmed but selectable and names them on hover', async t => {
  const Component = load('src/components/schedule/SharedSchedulePreview.jsx', {
    'react-native': native,
    'phosphor-react-native': { ArrowClockwise: 'Icon', ArrowRight: 'Icon', CalendarBlank: 'Icon', CalendarCheck: 'Icon', CaretDown: 'Icon', CaretUp: 'Icon', Clock: 'Icon' },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, { schedule: { ...fixture(), repeat: 12 }, lang: 'en', themeColors: {} })); });
  t.after(async () => act(async () => tree.unmount()));
  const weekButton = number => tree.root.findAllByType('WeekButton').find(node => node.props.accessibilityLabel.split(',')[0] === `Week ${number}`);
  assert.ok(Array.from({ length: 12 }, (_, index) => weekButton(index + 1)).every(Boolean));
  assert.equal(weekButton(1).props.accessibilityLabel, 'Week 1');
  assert.equal(weekButton(3).props.accessibilityLabel, 'Week 3, Empty');
  const numberOpacity = number => weekButton(number).findByType('Text').props.style.at(-1).opacity;
  assert.equal(numberOpacity(1), 1);
  assert.ok(numberOpacity(3) < 1);
  const tooltip = () => weekButton(3).findAllByType('Text').filter(node => node.props.children === 'Empty');
  assert.equal(tooltip().length, 0);
  await act(async () => weekButton(3).props.onHoverIn());
  assert.equal(tooltip().length, 1);
  await act(async () => weekButton(3).props.onHoverOut());
  assert.equal(tooltip().length, 0);
  await act(async () => weekButton(12).props.onPress());
  assert.deepEqual(weekButton(12).props.accessibilityState, { selected: true });
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === 'Week 12: no classes'));
  const nextLesson = tree.root.findAllByType('Button').find(node => node.findAllByType('Text').some(text => /^Show the (next class|class in progress)$/.test(text.props.children)));
  assert.ok(nextLesson);
  await act(async () => nextLesson.props.onPress());
  assert.deepEqual(weekButton(1).props.accessibilityState, { selected: true });
});

test('screens keep browser history instead of resetting the navigation state', () => {
  const root = path.resolve(__dirname, '..', 'src');
  const files = fs.readdirSync(root, { recursive: true }).filter(file => /\.jsx?$/.test(file));
  const offenders = files.filter(file => /navigation\.reset\(|CommonActions\.reset/.test(fs.readFileSync(path.join(root, file), 'utf8')));
  assert.deepEqual(offenders, [], 'On web a reset replaces the current browser entry, so Back cannot return to the previous page. Navigate or push instead.');
});
