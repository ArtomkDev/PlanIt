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
    plugins: [
      ...(filename.endsWith('.jsx') ? ['@babel/plugin-transform-react-jsx'] : []),
      '@babel/plugin-transform-modules-commonjs',
    ],
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

async function mountLegalDocument(context, documentType = 'privacy') {
  const React = require('react');
  const { act, create } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    route: { params: { documentType, lang: 'uk-UA' } },
    focused: true,
    data: { global: { language: 'uk', theme: ['light', 'blue'] }, lang: 'uk' },
    openedUrls: [], alerts: [], scrolls: [], failLink: false,
  };
  const native = {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    StyleSheet: { create: value => value },
    Linking: { openURL: async url => {
      state.openedUrls.push(url);
      if (state.failLink) throw new Error('Browser unavailable');
    } },
    Animated: {
      Value: class { setValue() {} },
      event: () => () => {},
      View: 'AnimatedView',
      ScrollView: React.forwardRef((props, ref) => {
        React.useImperativeHandle(ref, () => ({ scrollTo: options => state.scrolls.push(options) }), []);
        return React.createElement('ScrollView', props);
      }),
    },
  };
  const documents = compile('src/config/legalDocuments.generated.js', { '../utils/i18n': { normalizeLanguage } });
  const links = compile('src/utils/legalDocumentLinks.js', {
    '../config/legalDocuments.generated': documents, './i18n': { normalizeLanguage },
  });
  const TabSwitcher = compile('src/components/ui/TabSwitcher.jsx', {
    'react-native': native,
    '../../utils/haptics': { triggerHaptic() {} },
    '../../hooks/useReducedMotionPreference': () => true,
  }).default;
  const Screen = compile('src/pages/Settings/components/LegalDocumentScreen.jsx', {
    'react-native': native,
    'expo-status-bar': { StatusBar: () => null },
    'phosphor-react-native': { Globe: 'Globe' },
    '@react-navigation/native': {
      useRoute: () => state.route,
      useFocusEffect: callback => React.useEffect(() => {
        if (state.focused) return callback();
      }, [callback, state.focused]),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '../../../config/themes': { getColors: () => ({}) },
    '../../../config/legalDocuments.generated': documents,
    '../../../components/ui/SettingsHeader': ({ rightButton, ...props }) => React.createElement('SettingsHeader', props, rightButton),
    '../../../components/ui/TabSwitcher': TabSwitcher,
    '../../../context/ScheduleProvider': { useScheduleData: () => state.data },
    '../../../context/AppDialogContext': { useAppDialog: () => ({ alert: async (options) => state.alerts.push(options) }) },
    '../../../utils/i18n': { t },
    '../../../utils/haptics': { triggerHaptic() {} },
    '../../../utils/legalDocumentLinks': links,
    '../../../config/layoutMetrics': { getSettingsHeaderHeight: () => 60 },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  context.after(async () => { await act(async () => tree.unmount()); });
  return {
    state,
    async render() { await act(async () => tree.update(React.createElement(Screen))); },
    async select(language) {
      const label = language === 'uk' ? 'Українська' : 'English';
      await act(async () => tree.root.findByProps({ accessibilityRole: 'tab', accessibilityLabel: label }).props.onPress());
    },
    async openBrowser(index = 0) {
      await act(async () => tree.root.findAllByProps({ accessibilityRole: 'button' })[index].props.onPress());
    },
    assertLanguage(type, language) {
      const document = documents.getLegalDocument(type, language);
      const text = tree.root.findAllByType('Text').flatMap(node => node.props.children);
      assert.equal(tree.root.findByType('SettingsHeader').props.title, document.title);
      assert.ok(text.includes(document.title));
      assert.ok(text.includes(document.sections[0].title));
      assert.ok(text.includes(document.effectiveDateLine || document.effectiveDate));
      assert.equal(text.includes(t('settings.about_screen.document_language_notice', 'uk')), language === 'uk');
      const tabs = tree.root.findAllByProps({ accessibilityRole: 'tab' });
      assert.equal(tabs.filter(tab => tab.props.accessibilityState.selected).length, 1);
      assert.equal(tabs.find(tab => tab.props.accessibilityState.selected).props.accessibilityLabel, language === 'uk' ? 'Українська' : 'English');
      for (const button of tree.root.findAllByProps({ accessibilityRole: 'button' })) {
        assert.equal(button.props.accessibilityLabel, t('settings.about_screen.open_in_browser', language));
      }
    },
    browserUrl: (type, language) => links.getLegalDocumentBrowserUrl(type, language),
  };
}

for (const type of ['privacy', 'terms', 'cookies', 'delete', 'licenses']) {
  test(`${type} opens in English despite app and route languages, with an independent translation switch`, async context => {
    const ui = await mountLegalDocument(context, type);
    ui.assertLanguage(type, 'en');
    await ui.openBrowser();
    assert.equal(ui.state.openedUrls.at(-1), ui.browserUrl(type, 'en'));
    await ui.select('uk');
    ui.assertLanguage(type, 'uk');
    await ui.openBrowser(1);
    assert.equal(ui.state.openedUrls.at(-1), ui.browserUrl(type, 'uk'));
    await ui.select('en');
    ui.assertLanguage(type, 'en');
    assert.equal(ui.state.data.global.language, 'uk');
  });
}

test('legal language survives app language changes and resets on refocus or a different document', async context => {
  const ui = await mountLegalDocument(context);
  await ui.select('uk');
  for (const language of ['en', 'uk']) {
    ui.state.data = { ...ui.state.data, lang: language, global: { language } };
    await ui.render();
    ui.assertLanguage('privacy', 'uk');
  }
  ui.state.focused = false;
  await ui.render();
  ui.state.focused = true;
  await ui.render();
  ui.assertLanguage('privacy', 'en');
  await ui.select('uk');
  ui.state.route = { params: { documentType: 'terms', lang: 'uk' } };
  await ui.render();
  ui.assertLanguage('terms', 'en');
  assert.deepEqual(ui.state.scrolls, Array(3).fill({ y: 0, animated: false }));
});

test('browser failures use the explicitly selected legal language', async context => {
  const ui = await mountLegalDocument(context);
  ui.state.failLink = true;
  for (const language of ['en', 'uk']) {
    await ui.select(language);
    await ui.openBrowser();
    assert.deepEqual(ui.state.alerts.at(-1), {
      title: t('common.error', language),
      message: t('settings.about_screen.link_open_failed', language),
      buttonLabel: t('common.ok', language),
    });
  }
});
