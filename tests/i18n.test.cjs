const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compile = (relative, mocks = {}) => {
  const filename = path.resolve(__dirname, '..', relative);
  const output = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = instance.require.bind(instance);
  instance.require = (request) => mocks[request] ?? originalRequire(request);
  instance._compile(output, filename);
  return instance.exports;
};
const uk = compile('src/locales/uk.js');
const en = compile('src/locales/en.js');
const { t, normalizeLanguage, getLocale, formatText } = compile('src/utils/i18n.js', {
  '../locales/uk.js': uk, '../locales/en.js': en,
});

test('normalizes regional language tags and unsupported languages', () => {
  assert.equal(normalizeLanguage(' UK_ua '), 'uk');
  assert.equal(normalizeLanguage('en-GB'), 'en');
  for (const language of ['pl', '__proto__', null, undefined]) {
    assert.equal(normalizeLanguage(language), 'en');
  }
  assert.equal(getLocale('uk-UA'), uk.default.locale);
  assert.equal(t('common.save', 'uk-UA'), 'Зберегти');
});
test('interpolates repeated parameters literally and preserves missing parameters', () => {
  assert.equal(formatText('{value} / {value} / {missing}', { value: '$&' }), '$& / $& / {missing}');
  assert.equal(formatText('{count}', { count: 0 }), '0');
  assert.equal(formatText(null), '');
});
test('does not expose prototype values or catalog objects', () => {
  for (const key of ['missing.key', 'constructor', '__proto__', 'common']) assert.equal(t(key, 'uk'), key);
  assert.equal(t(null), '');
});
test('uses Ukrainian plural categories, including fractional counts', () => {
  for (const [count, category] of [[-22, 'few'], [0, 'many'], [1, 'one'], [2, 'few'], [5, 'many'], [11, 'many'], [21, 'one'], [22, 'few'], [111, 'many'], [1.5, 'other']]) {
    assert.equal(t('tasks.count', 'uk', { count }), formatText(uk.default.tasks.count[category], { count }));
  }
});
test('uses English plural forms and localized recurrence counts', () => {
  for (const count of [-1, 0, 1, 2, 11]) {
    const category = Math.abs(count) === 1 ? 'one' : 'other';
    assert.equal(t('tasks.count', 'en', { count }), formatText(en.default.tasks.count[category], { count }));
    assert.equal(t('tasks.editor.occurrences_count', 'en', { count }), formatText(en.default.tasks.editor.occurrences_count[category], { count }));
  }
});

test('loads and pluralizes when Intl.PluralRules is unavailable', () => {
  const originalPluralRules = Intl.PluralRules;
  try {
    Intl.PluralRules = undefined;
    const i18nWithoutPluralRules = compile('src/utils/i18n.js', {
      '../locales/uk.js': uk, '../locales/en.js': en,
    });
    assert.equal(
      i18nWithoutPluralRules.t('tasks.count', 'uk', { count: 22 }),
      formatText(uk.default.tasks.count.few, { count: 22 }),
    );
    assert.equal(i18nWithoutPluralRules.t('tasks.count', 'en', { count: 1 }), '1 task');
  } finally {
    Intl.PluralRules = originalPluralRules;
  }
});

test('falls back to English for a missing localized key', () => {
  en.default.test_fallback = 'Value {count}';
  try { assert.equal(t('test_fallback', 'uk', { count: 3 }), 'Value 3'); }
  finally { delete en.default.test_fallback; }
});


test('all legal documents are complete in both languages and use safe fallback lookup', () => {
  const { getLegalDocument, LEGAL_DOCUMENTS, LEGAL_DOCUMENTS_UK } = compile('src/config/legalDocuments.generated.js', {
    '../utils/i18n': { normalizeLanguage },
  });
  for (const type of Object.keys(LEGAL_DOCUMENTS)) {
    const english = getLegalDocument(type, 'en');
    const ukrainian = getLegalDocument(type, 'uk-UA');
    assert.equal(ukrainian, LEGAL_DOCUMENTS_UK[type]);
    assert.notEqual(ukrainian.title, english.title);
    assert.equal(ukrainian.sections.length, english.sections.length);
    ukrainian.sections.forEach((section, index) => {
      assert.equal(section.blocks.length, english.sections[index].blocks.length);
      assert.match(section.title, /[А-ЯІЇЄа-яіїє]/);
    });
  }
  assert.equal(getLegalDocument('__proto__', 'uk'), LEGAL_DOCUMENTS_UK.privacy);
  assert.equal(getLegalDocument('terms', 'pl'), LEGAL_DOCUMENTS.terms);
});


test('language selection reacts to device preference changes and ignores stale async reads', async () => {
  const React = require('react');
  const renderer = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  let resolvePrefs;
  let current;
  const useAppLanguage = compile('src/hooks/useAppLanguage.js', {
    '../utils/storage': { getDevicePrefs: () => new Promise((resolve) => { resolvePrefs = resolve; }) },
    'expo-localization': { getLocales: () => [{ languageCode: 'uk' }] },
    '../utils/i18n': { normalizeLanguage },
  }).default;
  const Probe = (props) => { current = useAppLanguage(props.globalLanguage, props.deviceLanguage); return null; };
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Probe, { globalLanguage: 'uk' })); });
  assert.equal(current.isLangLoading, true);
  await renderer.act(async () => { tree.update(React.createElement(Probe, { globalLanguage: 'uk', deviceLanguage: 'en-US' })); });
  assert.equal(current.lang, 'en');
  await renderer.act(async () => { resolvePrefs({ language: 'uk' }); });
  assert.equal(current.lang, 'en');
  await renderer.act(async () => { tree.update(React.createElement(Probe, { globalLanguage: 'en', deviceLanguage: 'uk-UA' })); });
  assert.equal(current.lang, 'uk');
  assert.equal(current.isLangLoading, false);
  await renderer.act(async () => { tree.unmount(); });
});
