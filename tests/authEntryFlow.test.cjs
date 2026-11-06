const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function handlers(relative) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
  const result = {};
  babel.traverse(babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } }), {
    VariableDeclarator({ node }) {
      if (node.init?.type === 'ArrowFunctionExpression') result[node.id.name] = source.slice(node.init.start, node.init.end);
    },
  });
  return (name, context) => vm.runInNewContext('(' + result[name] + ')', context);
}
const authHandler = handlers('src/auth/AuthScreen.jsx');
const socialHandler = handlers('src/auth/components/SocialAuthButtons.jsx');

test('entry agreement must be explicit and durable before any authentication', async () => {
  const calls = [], context = { acceptedTerms: false, lang: 'uk',
    handleTermsMissing: () => calls.push('missing'), recordLegalAcceptance: async () => calls.push('saved'),
    setFormError: error => calls.push(error), t: key => key };
  assert.equal(await authHandler('beforeAuth', context)(), false);
  assert.deepEqual(calls, ['missing']);
  context.acceptedTerms = true;
  context.recordLegalAcceptance = async () => { throw new Error('unavailable'); };
  assert.equal(await authHandler('beforeAuth', context)(), false);
  assert.equal(calls.at(-1), 'common.action_failed');
});

for (const name of ['handleSignIn', 'handleSignUp']) {
  test(`${name} waits for agreement persistence and cannot authenticate if it fails`, async () => {
    const calls = [];
    const context = { isLoading: false, getFormErrors: () => ({}), configureAuthLayoutAnimation() {}, reduceMotion: false,
      setFieldErrors() {}, setIsLoading: value => calls.push(value), beforeAuth: async () => false,
      setManualLogin: () => calls.push('manual'), signInWithEmailAndPassword: () => calls.push('signin'),
      createUserWithEmailAndPassword: () => calls.push('signup') };
    await authHandler(name, context)();
    assert.deepEqual(calls, [true, false]);
  });
}

test('guest entry persists its continuation before changing sessions and blocks duplicate presses', async () => {
  const calls = [];
  let release;
  const context = { lang: 'uk', entryBusyRef: { current: false }, setEntryBusy() {}, beforeAuth: async scope => { calls.push(scope); return true; },
    pendingImport: { code: 'SHARED123' }, prepareSharedScheduleImport: async (code, intent) => {
      calls.push([code, intent.stage, intent.scope]); await new Promise(resolve => { release = resolve; });
    }, onGuestLogin: () => calls.push('entered'), setFormError: error => calls.push(error), t: key => key };
  const enter = authHandler('enterGuest', context);
  const pending = enter();
  await new Promise(resolve => setImmediate(resolve));
  await enter();
  assert.deepEqual(calls, ['guest', ['SHARED123', 'ready', 'guest']]);
  release(); await pending;
  assert.equal(calls.at(-1), 'entered');
  context.prepareSharedScheduleImport = async () => { throw new Error('disk full'); };
  await enter();
  assert.equal(calls.at(-1), 'common.action_failed');
  assert.equal(calls.filter(item => item === 'entered').length, 1);
});

for (const name of ['handleGoogleAuth', 'handleAppleAuth']) {
  test(`${name} waits for the same agreement gate and serializes presses`, async () => {
    let release, popups = 0;
    const errors = [];
    const context = { disabled: false, busyRef: { current: false }, isExpoGo: false, Platform: { OS: 'web' },
      triggerHaptic() {}, setLoadingProvider() {}, isLinking: false, setManualLogin() {},
      onBeforeAuth: () => new Promise(resolve => { release = resolve; }),
      GoogleAuthProvider: class {}, OAuthProvider: class {}, auth: {}, signInWithPopup: async () => { popups++; },
      onAuthError: error => errors.push(error), onAuthSuccess() {} };
    const enter = socialHandler(name, context);
    const pending = enter();
    await enter();
    assert.equal(popups, 0);
    release(false); await pending;
    assert.equal(popups, 0);
    context.onBeforeAuth = async () => true;
    await enter();
    assert.equal(popups, 1);
    assert.equal(context.busyRef.current, false);
    assert.deepEqual(errors, []);
  });
}
