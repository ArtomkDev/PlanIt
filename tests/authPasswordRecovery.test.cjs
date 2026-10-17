const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const source = fs.readFileSync(path.resolve(__dirname, '../src/auth/AuthScreen.jsx'), 'utf8');
const ast = babel.parseSync(source, {
  configFile: false,
  babelrc: false,
  parserOpts: { plugins: ['jsx'] },
});
let handlerSource;
babel.traverse(ast, {
  VariableDeclarator({ node }) {
    if (node.id.name === 'handleForgotPassword') {
      handlerSource = source.slice(node.init.start, node.init.end);
    }
  },
});

const createRecoveryHandler = (request) => {
  const state = { error: 'previous error', success: 'previous success', loading: false, cooldown: 0 };
  const handler = vm.runInNewContext('(' + handlerSource + ')', {
    email: ' person@example.com ',
    lang: 'uk',
    passwordResetCooldown: 0,
    isLoading: false,
    validateEmail: () => true,
    triggerHaptic: () => {},
    t: (key) => key,
    setIsLoading: (value) => { state.loading = value; },
    setFormError: (value) => { state.error = value; },
    setSuccessMessage: (value) => { state.success = value; },
    setPasswordResetCooldown: (value) => { state.cooldown = value; },
    requestPasswordResetEmailForEmail: async (options) => request(state, options),
  });
  return { state, handler };
};

test('a successful password recovery retry clears the previous error before requesting email', async () => {
  const { state, handler } = createRecoveryHandler(async (current, options) => {
    assert.equal(current.error, '');
    assert.equal(current.success, '');
    assert.equal(current.loading, true);
    assert.equal(options.email, 'person@example.com');
  });
  await handler();
  assert.equal(state.error, '');
  assert.equal(state.success, 'auth.forgot_password.success_msg');
  assert.equal(state.cooldown, 60);
  assert.equal(state.loading, false);
});

test('a failed password recovery retry cannot retain a previous success message', async () => {
  const { state, handler } = createRecoveryHandler(async () => {
    throw Object.assign(new Error('Unavailable'), { code: 'account-email/email-failed' });
  });
  await handler();
  assert.equal(state.error, 'auth.errors.reset_failed');
  assert.equal(state.success, '');
  assert.equal(state.loading, false);
});
