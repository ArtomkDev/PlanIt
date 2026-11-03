const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { getStateFromPath, getPathFromState } = require('@react-navigation/core');
const hosting = require('../firebase.json').hosting;
const { getShareLinkHost } = require('../src/config/shareLinks.cjs');
const { WEBSITE_URL, WEB_APP_URL } = require('../src/config/website.cjs');

const compiled = babel.transformFileSync(require.resolve('../src/navigation/mainLayoutLinking.web.js'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const navigationConfig = { screens: { MainLayout: context.exports.default } };

const focusedRoutes = state => {
  const routes = [];
  for (let nested = state; nested; nested = routes.at(-1).state) {
    routes.push(nested.routes[nested.index ?? nested.routes.length - 1]);
  }
  return routes;
};

test('application URLs use short public paths and restore the requested screen', () => {
  const navigator = fs.readFileSync(require.resolve('../src/navigation/TabNavigator.jsx'), 'utf8');
  const settingsScreens = [...navigator.matchAll(/<Stack.Screen name="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(Object.keys(navigationConfig.screens.MainLayout.screens.Tabs.screens.SettingsTab.screens).sort(), settingsScreens.sort());
  const routes = {
    '/': ['ScheduleTab'],
    '/tasks': ['TasksTab'],
    '/settings': ['SettingsTab', 'SettingsOverview'],
    '/settings/account': ['SettingsTab', 'AccountSettings'],
    '/settings/account/password': ['SettingsTab', 'ChangePassword'],
    '/settings/schedule/web-test': ['SettingsTab', 'ScheduleEditorScreen'],
    '/settings/legal/privacy': ['SettingsTab', 'LegalDocument'],
  };
  for (const [path, screens] of Object.entries(routes)) {
    const state = getStateFromPath(path, navigationConfig);
    assert.deepEqual(focusedRoutes(state).map(route => route.name), ['MainLayout', 'Tabs', ...screens], path);
    assert.equal(getPathFromState(state, navigationConfig), path);
  }
  const editor = focusedRoutes(getStateFromPath('/settings/schedule/web-test', navigationConfig)).at(-1);
  assert.equal(editor.params.scheduleId, 'web-test');
  assert.equal(getStateFromPath('/MainLayout/Tabs/SettingsTab/AccountSettings', navigationConfig), undefined);
  const share = getStateFromPath('/share/DEPLOYTEST123', navigationConfig);
  assert.equal(share.routes[0].name, 'MainLayout');
  assert.equal(share.routes[0].params.code, 'DEPLOYTEST123');
});

test('in-app intents and unrelated schedule ids stay out of application URLs', () => {
  const tabsState = (name, params) => ({
    routes: [{ name: 'MainLayout', state: { routes: [{ name: 'Tabs', state: { routes: [{ name, params }] } }] } }],
  });
  assert.equal(getPathFromState(tabsState('TasksTab', { createTaskIntent: { requestId: 1 } }), navigationConfig), '/tasks');
  assert.equal(getPathFromState(tabsState('ScheduleTab', { lessonViewIntent: { requestId: 1 } }), navigationConfig), '/');
  const settings = fs.readFileSync(require.resolve('../src/pages/Settings/Settings.jsx'), 'utf8');
  assert.match(settings, /navigation\.navigate\(item\.screen, item\.params\)/);
});

function signOutHandler({ confirmed = true, fail = false, refused = false, guest = false } = {}) {
  const source = fs.readFileSync(require.resolve('../src/pages/Settings/Settings.jsx'), 'utf8');
  const handlers = {};
  babel.traverse(babel.parseSync(source, { configFile: false, parserOpts: { plugins: ['jsx'] } }), {
    VariableDeclarator(path) {
      if (['performSignOut', 'handleSignOut', 'handleAuthAction'].includes(path.node.id.name)) handlers[path.node.id.name] = path.node.init;
    },
  });
  const calls = [];
  const prompts = [];
  const handler = handlers[guest ? 'handleAuthAction' : 'handleSignOut'];
  const operation = handlers.performSignOut;
  const run = vm.runInNewContext(`const performSignOut = ${source.slice(operation.start, operation.end)}; (${source.slice(handler.start, handler.end)})`, {
    lang: 'en', t: key => key,
    dialog: {
      confirm: async (options) => { prompts.push(options); return confirmed; },
      alert: async ({ message }) => { calls.push(['error', message]); },
    },
    console: { error: () => {} },
    setIsLoggingOut: value => calls.push(['loading', value]),
    guest, onExitGuest: () => calls.push(['exit-guest']),
    safeLogout: async () => { calls.push(['logout']); if (fail) throw new Error('offline'); return !refused; },
  });
  return { run, calls, prompts };
}

test('sign-out uses the in-app confirmation, can be cancelled, and reports a recoverable failure', async () => {
  const cancelled = signOutHandler({ confirmed: false });
  await cancelled.run();
  assert.deepEqual(cancelled.calls, []);
  const accepted = signOutHandler();
  await accepted.run();
  assert.deepEqual(accepted.calls, [['loading', true], ['logout']]);
  assert.equal(accepted.prompts.length, 1);
  assert.deepEqual({ ...accepted.prompts[0] }, {
    title: 'settings.alerts.logout_title',
    message: 'settings.alerts.logout_confirm',
    confirmLabel: 'settings.menu.logout.title',
    destructive: true,
  });
  const failed = signOutHandler({ fail: true });
  await failed.run();
  assert.deepEqual(failed.calls, [['loading', true], ['logout'], ['loading', false], ['error', 'settings.alerts.logout_error']]);
  const refused = signOutHandler({ refused: true });
  await refused.run();
  assert.deepEqual(refused.calls, [['loading', true], ['logout'], ['loading', false], ['error', 'settings.alerts.logout_error']]);
});

test('leaving guest mode waits for durability and keeps the editor accessible on failure', async () => {
  const accepted = signOutHandler({ guest: true });
  await accepted.run();
  assert.deepEqual(accepted.calls, [['loading', true], ['logout'], ['exit-guest']]);
  const refused = signOutHandler({ guest: true, refused: true });
  await refused.run();
  assert.deepEqual(refused.calls, [['loading', true], ['logout'], ['loading', false], ['error', 'settings.alerts.logout_error']]);
});

test('SPA routes accept nested navigation but exclude missing assets and reserved Firebase helpers', () => {
  const routes = hosting.rewrites.map(rule => new RegExp(rule.regex));
  const rewrites = path => routes.some(regex => regex.test(path));
  for (const path of ['/auth', '/password-reset', '/legal/privacy', '/share/SHARE123', '/tasks', '/welcome', '/settings', '/settings/account/password',
    '/settings/schedule/05e0f0d1-ce94-4ddc-bd0c-64c8ac912999', '/MainLayout/Tabs/SettingsTab/AboutApp']) {
    assert.equal(rewrites(path), true, path);
  }
  for (const path of ['/assets/missing.png', '/assets/missing', '/_expo/static/js/web/missing.js', '/MainLayout/missing.css', '/favicon.ico', '/__/auth/handler', '/__/firebase/init.json']) {
    assert.equal(rewrites(path), false, path);
  }
});

test('web sharing uses the application origin while native links retain their configured host', () => {
  assert.equal(WEBSITE_URL, 'https://planitflow.com');
  assert.equal(WEB_APP_URL, 'https://app.planitflow.com');
  assert.equal(getShareLinkHost('native.example.com', 'web'), new URL(WEB_APP_URL).hostname);
  assert.equal(getShareLinkHost('native.example.com', 'ios'), 'native.example.com');
  assert.equal(getShareLinkHost(undefined, 'android'), 'planit-demo.web.app');
});
