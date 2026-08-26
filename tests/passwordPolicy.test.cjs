const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const modulePath = path.resolve(__dirname, '../src/auth/passwordPolicy.js');

const loadPolicy = () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: modulePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(modulePath, module);
  testModule.filename = modulePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(modulePath));
  testModule._compile(transformed, modulePath);
  return testModule.exports;
};

test('rejects short and commonly weak passwords', () => {
  const policy = loadPolicy();

  assert.equal(policy.isPasswordAllowed('123456'), false);
  assert.equal(policy.isPasswordAllowed('password1'), false);
  assert.equal(policy.isPasswordAllowed('alllowercase123'), false);
});

test('requires upper/lowercase letters and a number', () => {
  const policy = loadPolicy();

  assert.equal(policy.isPasswordAllowed('StrongPass1'), true);
  assert.equal(policy.isPasswordAllowed('StrongPassword'), false);
  assert.equal(policy.isPasswordAllowed('STRONGPASS1'), false);
});

test('rejects passwords over the maximum length', () => {
  const policy = loadPolicy();

  assert.equal(policy.isPasswordAllowed(`Aa1${'x'.repeat(126)}`), false);
});

test('strength meter uses the same policy inputs as validation', () => {
  const policy = loadPolicy();

  assert.deepEqual(policy.getPasswordStrength('123456'), {
    width: '30%',
    color: '#ef4444',
  });
  assert.deepEqual(policy.getPasswordStrength('StrongPass1!'), {
    width: '100%',
    color: '#10b981',
  });
});
