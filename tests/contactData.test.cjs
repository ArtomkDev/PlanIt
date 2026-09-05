const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileModule = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const contacts = compileModule(path.resolve(__dirname, '../src/utils/contactData.js'));

test('Telegram accepts @handles, bare handles and canonical links', () => {
  const expected = 'https://t.me/planit_test';
  assert.equal(contacts.getTeacherContactOpenUrl({ type: 'telegram', value: '@planit_test' }), expected);
  assert.equal(contacts.getTeacherContactOpenUrl({ type: 'telegram', value: 'planit_test' }), expected);
  assert.equal(contacts.getTeacherContactOpenUrl({ type: 'telegram', value: 'https://t.me/planit_test' }), expected);
  assert.equal(contacts.getLinkOpenUrl({ type: 'telegram', url: '@planit_test' }), expected);
});

test('social profile handles are normalized without accepting the wrong host', () => {
  assert.equal(
    contacts.getTeacherContactOpenUrl({ type: 'instagram', value: '@plan.it' }),
    'https://www.instagram.com/plan.it/',
  );
  assert.equal(
    contacts.getTeacherContactOpenUrl({ type: 'facebook', value: 'planit.page' }),
    'https://www.facebook.com/planit.page',
  );
  assert.equal(
    contacts.getTeacherContactOpenUrl({ type: 'instagram', value: 'https://example.com/planit' }),
    '',
  );
});

test('web links allow only http and https destinations', () => {
  assert.equal(contacts.ensureWebUrl('example.com/page'), 'https://example.com/page');
  assert.equal(contacts.ensureWebUrl('javascript:alert(1)'), '');
  assert.equal(contacts.ensureWebUrl('data:text/html,hello'), '');
  assert.equal(contacts.ensureWebUrl('file:///private/file'), '');
});

test('legacy provider-specific material types migrate to semantic types', () => {
  assert.equal(contacts.normalizeLinkType('zoom', 'https://zoom.us/j/1'), 'meeting');
  assert.equal(contacts.normalizeLinkType('meet', 'https://meet.google.com/abc'), 'meeting');
  assert.equal(contacts.normalizeLinkType('moodle', 'https://moodle.example.edu'), 'course');
  assert.equal(contacts.normalizeLinkType('other', 'https://example.com'), 'website');
  assert.equal(contacts.inferLinkIconId('https://teams.microsoft.com/l/meetup-join/1'), 'teams');
});

test('icon choice is independent and unrecognized icon ids fall back safely', () => {
  assert.equal(contacts.normalizeContactIcon('instagram', 'phone'), 'instagram');
  assert.equal(contacts.normalizeContactIcon('custom-svg-payload', 'telegram'), 'telegram');
});

test('teacher appearance is independent from contact appearance', () => {
  assert.deepEqual(
    contacts.getTeacherAppearance({ icon: 'chat', color: '#123ABC' }),
    { icon: 'chat', color: '#123ABC' },
  );
  assert.deepEqual(
    contacts.getTeacherAppearance({ icon: 'unknown', color: 'red' }),
    { icon: 'user', color: '#6366F1' },
  );
});

test('teacher contacts remove canonical duplicates and preserve appearance', () => {
  const normalized = contacts.normalizeTeacherContacts({
    contacts: [
      { id: 'a', type: 'telegram', value: '@planit_test', icon: 'star-not-allowed', color: '#DC2626' },
      { id: 'b', type: 'telegram', value: 'https://t.me/planit_test' },
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].url, 'https://t.me/planit_test');
  assert.equal(normalized[0].icon, 'telegram');
  assert.equal(normalized[0].color, '#DC2626');
});
