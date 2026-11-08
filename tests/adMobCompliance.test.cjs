const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
global.__DEV__ = false;

const servicePath = path.resolve(
  __dirname,
  '../src/utils/adInit/adInit.native.js',
);
const adConfigPath = path.resolve(__dirname, '../src/config/ads.js');

const compiledComponents = new Map();
const loadAdComponent = (relativePath, mocks, exportName = 'default') => {
  const filename = path.resolve(__dirname, '..', relativePath);
  if (!compiledComponents.has(filename)) {
    compiledComponents.set(filename, babel.transformFileSync(filename, {
      plugins: [
        '@babel/plugin-transform-dynamic-import',
        '@babel/plugin-transform-modules-commonjs',
      ],
    }).code);
  }
  const componentModule = new Module(filename, module);
  componentModule.filename = filename;
  componentModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = componentModule.require.bind(componentModule);
  componentModule.require = (name) => Object.hasOwn(mocks, name)
    ? mocks[name]()
    : originalRequire(name);
  componentModule._compile(compiledComponents.get(filename), filename);
  return exportName ? componentModule.exports[exportName] : componentModule.exports;
};

const mountBanner = async (t, options = {}) => {
  let canShowAds = options.canShowAds ?? true;
  let width = options.width ?? 390;
  let visible = options.visible ?? true;
  let reserveSpace = options.reserveSpace ?? false;
  let isPrivacyOptionsLoading = false;
  let isDialogVisible = false;
  const listeners = new Map();
  const listen = (name, callback) => {
    listeners.set(name, callback);
    return { remove: () => listeners.delete(name) };
  };
  let imports = 0;
  let mounts = 0;
  let unmounts = 0;
  const insets = { top: 24, bottom: 0, left: 0, right: 0, ...options.insets };
  const BannerAd = (props) => {
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      mounts += 1;
      return () => { unmounts += 1; };
    }, []);
    return React.createElement('BannerAd', {
      ...props,
      style: { width: loaded ? 320 : 0, height: loaded ? 50 : 0 },
      onAdLoaded: () => {
        setLoaded(true);
        props.onAdLoaded?.({ width: 320, height: 50 });
      },
    });
  };
  const implementation = loadAdComponent('src/components/AdBanner/AdBannerImpl.jsx', {
    'react-native': () => ({
      View: 'View',
      StyleSheet: { create: value => value, hairlineWidth: 0.5 },
      useWindowDimensions: () => ({ width }),
    }),
    'react-native-safe-area-context': () => ({ useSafeAreaInsets: () => insets }),
    'react-native-google-mobile-ads': () => ({
      BannerAd,
      BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    }),
    '../../config/ads': () => ({ AD_UNITS: { BANNER: options.unitId === null ? null : 'ca-app-pub-3940256099942544/9214589741' } }),
  });
  const Component = loadAdComponent('src/components/AdBanner/AdBanner.native.jsx', {
    'react-native': () => ({
      AppState: { currentState: options.appState ?? 'active', addEventListener: listen },
      Keyboard: { isVisible: () => false, addListener: listen },
      Platform: { OS: options.platform ?? 'android' },
    }),
    expo: () => ({ isRunningInExpoGo: () => options.isExpoGo === true }),
    '../../context/AdsContext': () => ({ useAds: () => ({ canShowAds, isPrivacyOptionsLoading }) }),
    '../../context/AppDialogContext': () => ({ useIsAppDialogVisible: () => isDialogVisible }),
    './AdBannerImpl': () => {
      imports += 1;
      if (options.importFails) throw new Error('Native ads unavailable');
      return { __esModule: true, default: implementation };
    },
  });
  let tree;
  const element = () => React.createElement(Component, { visible, reserveSpace });
  await act(async () => { tree = create(element()); });
  t.after(async () => {
    await act(async () => tree.unmount());
    assert.equal(listeners.size, 0);
  });
  return {
    tree,
    counts: () => ({ imports, mounts, unmounts }),
    async emit(name, value) {
      await act(async () => listeners.get(name)?.(value));
    },
    async update(next = {}) {
      canShowAds = next.canShowAds ?? canShowAds;
      width = next.width ?? width;
      visible = next.visible ?? visible;
      reserveSpace = next.reserveSpace ?? reserveSpace;
      isPrivacyOptionsLoading = next.isPrivacyOptionsLoading ?? isPrivacyOptionsLoading;
      isDialogVisible = next.isDialogVisible ?? isDialogVisible;
      await act(async () => tree.update(element()));
    },
  };
};

const flattenStyle = style => Object.assign({}, ...(Array.isArray(style) ? style : [style]));

const loadAdConfig = ({
  platform = 'android',
  isDev = false,
  forceTestAds = 'false',
  productionBannerId = 'ca-app-pub-1234567890123456/1234567890',
} = {}) => {
  const previousForceTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS;
  const previousAndroidBannerId =
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
  const previousDev = global.__DEV__;

  process.env.EXPO_PUBLIC_FORCE_TEST_ADS = forceTestAds;
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID = productionBannerId;
  global.__DEV__ = isDev;

  try {
    const source = fs.readFileSync(adConfigPath, 'utf8');
    const transformed = babel.transformSync(source, {
      filename: adConfigPath,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const testModule = new Module(adConfigPath, module);
    testModule.filename = adConfigPath;
    testModule.paths = Module._nodeModulePaths(path.dirname(adConfigPath));
    const originalRequire = testModule.require.bind(testModule);

    testModule.require = function mockedRequire(request) {
      if (request === 'react-native') {
        return {
          Platform: {
            select: (options) => options[platform] ?? options.default,
          },
        };
      }
      return originalRequire(request);
    };

    testModule._compile(transformed, adConfigPath);
    return testModule.exports.AD_UNITS;
  } finally {
    if (previousForceTestAds === undefined) {
      delete process.env.EXPO_PUBLIC_FORCE_TEST_ADS;
    } else {
      process.env.EXPO_PUBLIC_FORCE_TEST_ADS = previousForceTestAds;
    }
    if (previousAndroidBannerId === undefined) {
      delete process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
    } else {
      process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID =
        previousAndroidBannerId;
    }
    if (previousDev === undefined) {
      delete global.__DEV__;
    } else {
      global.__DEV__ = previousDev;
    }
  }
};

const loadAdService = ({
  bannerUnitId = 'test-banner-unit',
  consentInfo,
  consentError = null,
  fallbackConsentInfo = null,
  isExpoGo = false,
} = {}) => {
  const calls = [];
  let adsModuleLoads = 0;
  const mobileAdsInstance = {
    setRequestConfiguration: async (configuration) => {
      calls.push(['setRequestConfiguration', configuration]);
    },
    initialize: async () => {
      calls.push(['initialize']);
    },
  };
  const adsModule = {
    __esModule: true,
    default: () => mobileAdsInstance,
    AdsConsent: {
      gatherConsent: async () => {
        calls.push(['gatherConsent']);
        if (consentError) throw consentError;
        return consentInfo;
      },
      getConsentInfo: async () => {
        calls.push(['getConsentInfo']);
        return fallbackConsentInfo;
      },
      showPrivacyOptionsForm: async () => {
        calls.push(['showPrivacyOptionsForm']);
        return consentInfo;
      },
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      REQUIRED: 'REQUIRED',
    },
    MaxAdContentRating: {
      G: 'G',
    },
  };
  const expoModule = {
    isRunningInExpoGo: () => isExpoGo,
  };

  const source = fs.readFileSync(servicePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: servicePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(servicePath, module);
  testModule.filename = servicePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(servicePath));

  const originalRequire = testModule.require.bind(testModule);
  testModule.require = function mockedRequire(request) {
    if (request === 'expo') return expoModule;
    if (request === 'react-native-google-mobile-ads') {
      adsModuleLoads += 1;
      return adsModule;
    }
    if (request === '../../config/ads') {
      return { AD_UNITS: { BANNER: bannerUnitId } };
    }
    return originalRequire(request);
  };

  testModule._compile(transformed, servicePath);
  return {
    calls,
    adsModule,
    getAdsModuleLoads: () => adsModuleLoads,
    service: testModule.exports,
  };
};

for (const [name, options] of [
  ['consent is pending or ads are disabled', { canShowAds: false }],
  ['running in Expo Go', { isExpoGo: true }],
  ['the native module cannot load', { importFails: true }],
  ['the banner unit is unavailable', { unitId: null }],
  ['the screen is narrower than the banner', { width: 319 }],
  ['landscape safe areas leave insufficient width', { width: 390, insets: { left: 44, right: 44 } }],
]) {
  test(`leaves no banner spacing when ${name}`, async t => {
    const banner = await mountBanner(t, options);
    assert.equal(banner.tree.toJSON(), null);
    assert.equal(banner.counts().mounts, 0);
    if (options.isExpoGo || options.canShowAds === false) {
      assert.equal(banner.counts().imports, 0);
    }
  });
}

test('reserves a separate fixed banner slot before loading and keeps it stable after loading', async t => {
  const banner = await mountBanner(t, { insets: { left: 12, right: 8 } });
  const views = banner.tree.root.findAllByType('View');
  const placement = flattenStyle(views[0].props.style);
  const frame = flattenStyle(views[1].props.style);
  assert.equal(placement.paddingTop, 24);
  assert.equal(placement.paddingLeft, 12);
  assert.equal(placement.paddingRight, 8);
  assert.equal(placement.paddingBottom, 8);
  assert.ok(placement.borderBottomWidth > 0);
  assert.equal(placement.flexShrink, 0);
  assert.equal(frame.width, 370);
  assert.equal(frame.minHeight, 60);
  assert.equal(frame.flexShrink, 0);
  for (const style of [placement, frame]) {
    assert.equal(style.position, undefined);
    assert.equal(style.transform, undefined);
    assert.equal(style.overflow, undefined);
    assert.equal(style.opacity, undefined);
  }
  const ad = banner.tree.root.findByType('BannerAd');
  assert.equal(ad.props.size, 'ANCHORED_ADAPTIVE_BANNER');
  assert.equal(ad.props.width, 370);
  assert.equal(ad.props.requestOptions.requestNonPersonalizedAdsOnly, true);
  await act(async () => ad.props.onAdLoaded());
  assert.deepEqual(flattenStyle(views[0].props.style), placement);
  assert.deepEqual(flattenStyle(views[1].props.style), frame);
  await banner.update();
  assert.deepEqual(banner.counts(), { imports: 1, mounts: 1, unmounts: 0 });
});

for (const loaded of [false, true]) {
  test(`unmounts the banner and releases its whole slot after ${loaded ? 'a refresh failure' : 'no fill or a network failure'}`, async t => {
    const banner = await mountBanner(t);
    const ad = banner.tree.root.findByType('BannerAd');
    if (loaded) await act(async () => ad.props.onAdLoaded());
    await act(async () => ad.props.onAdFailedToLoad(new Error('No ad available')));
    assert.equal(banner.tree.toJSON(), null);
    assert.deepEqual(banner.counts(), { imports: 1, mounts: 1, unmounts: 1 });
    await banner.update();
    assert.equal(banner.tree.toJSON(), null);
    assert.equal(banner.counts().mounts, 1, 'a failed banner must not retry into the released slot');
  });
}

test('removes the ad and its safe area immediately when consent is revoked', async t => {
  const banner = await mountBanner(t, { canShowAds: false });
  await banner.update({ canShowAds: true });
  assert.equal(banner.tree.root.findAllByType('BannerAd').length, 1);
  await banner.update({ canShowAds: false });
  assert.equal(banner.tree.toJSON(), null);
  assert.equal(banner.counts().unmounts, 1);
});

test('removes banners that no longer fit after a resize', async t => {
  const banner = await mountBanner(t);
  await banner.update({ width: 300 });
  assert.equal(banner.tree.toJSON(), null);
  assert.equal(banner.counts().unmounts, 1);
  await banner.update({ width: 390 });
  assert.equal(banner.tree.root.findAllByType('BannerAd').length, 1);
});

test('does not request the first banner behind an overlay or in the background', async t => {
  const banner = await mountBanner(t, { visible: false, reserveSpace: true, appState: 'background' });
  assert.equal(banner.tree.toJSON(), null);
  await banner.update({ visible: true });
  assert.equal(banner.counts().imports, 0);
  await banner.emit('change', 'active');
  assert.equal(banner.counts().mounts, 1);
});

test('hides the native banner with a stable measured slot and reuses it after overlays close', async t => {
  const banner = await mountBanner(t);
  await act(async () => banner.tree.root.findByType('BannerAd').props.onSizeChange({ height: 72 }));
  await banner.update({ visible: false, reserveSpace: true });
  const views = banner.tree.root.findAllByType('View');
  assert.equal(flattenStyle(views[0].props.style).display, undefined);
  assert.equal(views[0].props.pointerEvents, 'none');
  assert.equal(views[0].props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(flattenStyle(views[1].props.style).minHeight, 72);
  assert.equal(flattenStyle(views[2].props.style).display, 'none');
  await banner.update({ reserveSpace: false });
  assert.equal(flattenStyle(views[0].props.style).display, 'none');
  await banner.update({ visible: true });
  assert.equal(flattenStyle(views[0].props.style).display, undefined);
  assert.equal(flattenStyle(views[2].props.style).display, undefined);
  assert.equal(views[0].props.pointerEvents, 'box-none');
  assert.deepEqual(banner.counts(), { imports: 1, mounts: 1, unmounts: 0 });
});

for (const platform of ['android', 'ios']) {
  test(`hides banners during keyboard, privacy, and app interruptions on ${platform}`, async t => {
    const banner = await mountBanner(t, { platform, reserveSpace: true });
    const hidden = () => flattenStyle(banner.tree.root.findAllByType('View')[2].props.style).display === 'none';
    await banner.emit(platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow');
    assert.equal(hidden(), true);
    await banner.update({ isPrivacyOptionsLoading: true });
    await banner.emit('keyboardDidHide');
    assert.equal(hidden(), true, 'closing one blocker cannot reveal a banner under another');
    await banner.update({ isPrivacyOptionsLoading: false });
    assert.equal(hidden(), false);
    await banner.update({ isDialogVisible: true });
    assert.equal(hidden(), true);
    await banner.update({ isDialogVisible: false });
    assert.equal(hidden(), false);
    await banner.emit('change', 'inactive');
    assert.equal(hidden(), true);
    await banner.emit('change', 'active');
    assert.equal(hidden(), false);
    if (platform === 'android') {
      await banner.emit('blur');
      assert.equal(hidden(), true);
      await banner.emit('focus');
      assert.equal(hidden(), false);
    }
    assert.deepEqual(banner.counts(), { imports: 1, mounts: 1, unmounts: 0 });
  });
}

for (const platform of ['web', 'android']) {
test(`MainLayout scopes screen safe areas without reserving a missing banner on ${platform}`, async t => {
  const wrapper = ({ children }) => React.createElement('Navigator', null, children);
  class AnimatedValue {
    stopAnimation() {}
  }
  let routeName = 'ScheduleTab';
  let hasPresentedSheets = false;
  let isImagePreviewOpen = false;
  let conflictQueue = [];
  let loading = false;
  const barStyles = [];
  const stateListeners = new Set();
  const appState = {
    currentState: 'active',
    addEventListener: (_, callback) => { stateListeners.add(callback); return { remove: () => stateListeners.delete(callback) }; },
  };
  const Banner = () => null;
  const mocks = {
    'expo-status-bar': () => ({ StatusBar: 'StatusBar' }),
    'expo': () => ({ requireOptionalNativeModule: () => ({ setStyle: async style => {
      barStyles.push(style);
      if (barStyles.length === 1) throw Object.assign(new Error('The current activity is no longer available'), { code: 'ERR_MISSING_ACTIVITY' });
    } }) }),
    'expo-system-ui': () => ({ setBackgroundColorAsync: async () => {} }),
    'react-native': () => ({
      View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
      Appearance: { getColorScheme: () => 'light' },
      Platform: { OS: platform },
      StyleSheet: { create: value => value, absoluteFill: {} },
      AppState: appState,
      Animated: {
        Value: AnimatedValue,
        View: 'Overlay',
        timing: () => ({ start: callback => callback?.({ finished: true }) }),
      },
    }),
    '@react-navigation/native-stack': () => ({
      createNativeStackNavigator: () => ({ Navigator: wrapper, Screen: ({ children }) => children() }),
    }),
    '@react-navigation/native': () => ({
      useNavigation: () => ({}),
      useNavigationState: (select) => select({ index: 0, routes: [{ name: 'MainLayout', state: {
        index: 0, routes: [{ name: 'Tabs', state: { index: 0, routes: [{ name: routeName }] } }],
      } }] }),
    }),
    'react-native-safe-area-context': () => ({
      SafeAreaProvider: 'SafeAreaProvider',
      useSafeAreaInsets: () => ({ top: 24 }),
    }),
    '@react-native-async-storage/async-storage': () => ({ getItem: async () => null }),
    'expo-linking': () => ({ useURL: () => null }),
    '../context/ScheduleProvider': () => ({
      useScheduleData: () => ({ schedules: [{}], schedule: {}, global: {}, lang: 'uk', isLoading: loading }),
      useScheduleActions: () => ({}),
      useScheduleSync: () => ({ conflictQueue }),
    }),
    '../context/BottomSheetPresentationContext': () => ({ useBottomSheetPresentation: () => ({ hasPresentedSheets }) }),
    '../context/AttachmentImagePreviewContext': () => ({ useAttachmentImagePreview: () => ({ isImagePreviewOpen }) }),
    '../context/AdsContext': () => ({ useAds: () => ({ canShowAds: true, isLoading: true }) }),
    '../hooks/useAppTheme': () => () => ({ colorScheme: 'light', colors: { backgroundColor: '#fff' } }),
    '../utils/i18n': () => ({ t: key => key }),
    '../hooks/useReducedMotionPreference': () => () => true,
    '../components/AdBanner/AdBanner': () => Banner,
  };
  for (const relative of [
    '../services/AutoSaveManager', '../navigation/TabNavigator',
    '../components/modals/MigrationModal', '../components/ui/AppBlur',
    '../components/ui/MorphingLoader', '../pages/SyncConflict/SyncConflictScreen',
    '../pages/Onboarding/OnboardingWizard', '../components/modals/ImportScheduleModal',
    '../pages/Schedule/components/SchedulePickerSheet',
  ]) mocks[relative] = () => relative.split('/').at(-1);
  mocks['../navigation/TabNavigator'] = () => ({ __esModule: true, default: 'TabNavigator' });
  const MainLayout = loadAdComponent('src/layouts/MainLayout.jsx', mocks);
  let tree;
  await act(async () => { tree = create(React.createElement(MainLayout, { guest: true })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  if (platform === 'android') {
    assert.deepEqual(barStyles, ['dark'], 'a missing activity rejection is handled by the native promise consumer');
    for (const state of ['background', 'active']) {
      appState.currentState = state;
      await act(async () => { stateListeners.forEach(listener => listener(state)); });
    }
    assert.deepEqual(barStyles, ['dark', 'dark'], 'resume reapplies the requested theme');
  } else assert.deepEqual(barStyles, []);
  const content = tree.toJSON().children[1];
  assert.equal(content.type, 'SafeAreaProvider');
  assert.deepEqual(content.props.style, { flex: 1 });
  assert.equal(tree.root.findAllByType('Overlay').length, 1);
  const props = () => tree.root.findByType(Banner).props;
  assert.equal(props().visible, false, 'ready data cannot reveal a screen before its content has laid out');
  await act(async () => tree.root.findByType('TabNavigator').props.onLayout());
  assert.equal(tree.root.findAllByType('Overlay').length, 0);
  const update = async () => { await act(async () => tree.update(React.createElement(MainLayout, { guest: true }))); };
  assert.equal(props().visible, true);
  hasPresentedSheets = true;
  await update();
  assert.equal(props().visible, false);
  assert.equal(props().reserveSpace, true);
  isImagePreviewOpen = true;
  hasPresentedSheets = false;
  await update();
  assert.equal(props().visible, false);
  isImagePreviewOpen = false;
  await update();
  assert.equal(props().visible, true);
  const drawerVisibility = tree.root.findByType('TabNavigator').props.onNotificationsVisibilityChange;
  await act(async () => drawerVisibility(true));
  assert.equal(props().visible, false);
  await act(async () => drawerVisibility(false));
  assert.equal(props().visible, true);
  for (const name of ['SettingsTab', 'Settings', 'LegalDocument', 'ScheduleEditorScreen', 'Onboarding', 'PasswordReset']) {
    routeName = name;
    await update();
    assert.equal(props().visible, false, name);
    assert.equal(props().reserveSpace, false, name);
  }
  routeName = 'TasksTab';
  await update();
  assert.equal(props().visible, true);
  conflictQueue = [{}];
  await update();
  assert.equal(props().visible, false);
  conflictQueue = [];
  loading = true;
  await update();
  assert.equal(props().visible, false);
  appState.currentState = 'background';
  const count = barStyles.length;
  await act(async () => tree.unmount());
  assert.equal(barStyles.length, count, 'cleanup cannot access an unavailable background activity');
  assert.equal(stateListeners.size, 0);
});
}

test('image preview visibility follows open, replacement, and close requests', async t => {
  let previewImports = 0;
  const Preview = props => React.createElement('Preview', props);
  const { AttachmentImagePreviewProvider, useAttachmentImagePreview } = loadAdComponent('src/context/AttachmentImagePreviewContext.jsx', {
    '../components/attachments/AttachmentImagePreview': () => {
      previewImports++;
      return { __esModule: true, default: Preview };
    },
  }, null);
  let state;
  let closes = 0;
  const Observer = () => { state = useAttachmentImagePreview(); return null; };
  let tree;
  await act(async () => { tree = create(React.createElement(AttachmentImagePreviewProvider, null, React.createElement(Observer))); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(state.isImagePreviewOpen, false);
  assert.equal(previewImports, 0);
  await act(async () => state.openImagePreview({}));
  assert.equal(state.isImagePreviewOpen, false);
  assert.equal(previewImports, 0);
  await act(async () => state.openImagePreview({ attachment: { id: 'first' } }));
  assert.equal(state.isImagePreviewOpen, true);
  assert.equal(tree.root.findByType('Preview').props.attachment.id, 'first');
  await act(async () => state.openImagePreview({ attachment: { id: 'second' }, onClose: () => closes++ }));
  assert.equal(state.isImagePreviewOpen, true);
  assert.equal(tree.root.findByType('Preview').props.attachment.id, 'second');
  await act(async () => tree.root.findByType('Preview').props.onClose());
  assert.equal(state.isImagePreviewOpen, false);
  assert.equal(tree.root.findAllByType('Preview').length, 0);
  assert.equal(closes, 1);
});

test('a transient consent failure can recover on the next initialization attempt', async () => {
  const env = loadAdService({ consentError: new Error('Offline') });
  await assert.rejects(env.service.initAds(), /Offline/);
  env.adsModule.AdsConsent.gatherConsent = async () => ({ canRequestAds: true });
  assert.equal((await env.service.initAds()).initialized, true);
  assert.equal(env.calls.filter(([name]) => name === 'initialize').length, 1);
});

test('gathers UMP consent before configuring and initializing Mobile Ads', async () => {
  const { calls, service } = loadAdService({
    consentInfo: {
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    },
  });

  const state = await service.initAds();

  assert.deepEqual(calls.map(([name]) => name), [
    'gatherConsent',
    'setRequestConfiguration',
    'initialize',
  ]);
  assert.deepEqual(calls[1][1], {
    maxAdContentRating: 'G',
    tagForChildDirectedTreatment: false,
  });
  assert.deepEqual(state, {
    canRequestAds: true,
    initialized: true,
    privacyOptionsRequired: true,
  });
});

test('does not initialize or request ads when UMP does not permit it', async () => {
  const { calls, service } = loadAdService({
    consentInfo: {
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    },
  });

  const state = await service.initAds();

  assert.deepEqual(calls.map(([name]) => name), ['gatherConsent']);
  assert.equal(state.canRequestAds, false);
  assert.equal(state.initialized, false);
});

test('does not initialize UMP or Mobile Ads without a valid banner unit', async () => {
  const { calls, service } = loadAdService({
    bannerUnitId: null,
    consentInfo: {
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    },
  });

  const state = await service.initAds();

  assert.deepEqual(calls, []);
  assert.equal(state.canRequestAds, false);
  assert.equal(state.initialized, false);
});

test('does not evaluate the unavailable Mobile Ads native module in Expo Go', async () => {
  const { calls, getAdsModuleLoads, service } = loadAdService({
    isExpoGo: true,
    consentInfo: {
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    },
  });

  assert.equal(getAdsModuleLoads(), 0);
  const state = await service.initAds();

  assert.equal(getAdsModuleLoads(), 0);
  assert.deepEqual(calls, []);
  assert.equal(state.canRequestAds, false);
  assert.equal(state.initialized, false);
});

test('uses a valid previous-session UMP decision after a refresh error', async () => {
  const { calls, service } = loadAdService({
    consentError: new Error('network unavailable'),
    fallbackConsentInfo: {
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    },
  });

  const state = await service.initAds();

  assert.deepEqual(calls.map(([name]) => name), [
    'gatherConsent',
    'getConsentInfo',
    'setRequestConfiguration',
    'initialize',
  ]);
  assert.equal(state.canRequestAds, true);
  assert.equal(state.initialized, true);
});

test('selects Google demo ads for forced-test and development builds', () => {
  const googleAndroidDemoBannerId =
    'ca-app-pub-3940256099942544/9214589741';

  assert.equal(
    loadAdConfig({ forceTestAds: 'true', isDev: false }).BANNER,
    googleAndroidDemoBannerId,
  );
  assert.equal(
    loadAdConfig({ forceTestAds: 'false', isDev: true }).BANNER,
    googleAndroidDemoBannerId,
  );
});

test('selects the configured production banner only for production builds', () => {
  const productionBannerId = 'ca-app-pub-1234567890123456/1234567890';

  assert.equal(
    loadAdConfig({
      forceTestAds: 'false',
      isDev: false,
      productionBannerId,
    }).BANNER,
    productionBannerId,
  );
  assert.equal(
    loadAdConfig({
      forceTestAds: 'false',
      isDev: false,
      productionBannerId: 'invalid-banner-id',
    }).BANNER,
    null,
  );
});

test('keeps the banner out of the navigation controls and hardens build configuration', () => {
  const tabBar = fs.readFileSync(
    path.resolve(__dirname, '../src/navigation/PlanItTabBar.jsx'),
    'utf8',
  );
  const mainLayout = fs.readFileSync(
    path.resolve(__dirname, '../src/layouts/MainLayout.jsx'),
    'utf8',
  );
  const adConfig = fs.readFileSync(
    path.resolve(__dirname, '../src/config/ads.js'),
    'utf8',
  );
  const appConfig = fs.readFileSync(
    path.resolve(__dirname, '../app.config.js'),
    'utf8',
  );
  const easConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../eas.json'), 'utf8'),
  );
  const packageConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
  );
  const releaseAabScript = fs.readFileSync(
    path.resolve(__dirname, '../scripts/build-aab.ps1'),
    'utf8',
  );
  const releaseApkScript = fs.readFileSync(
    path.resolve(__dirname, '../scripts/build-android.ps1'),
    'utf8',
  );
  const devBuildScript = fs.readFileSync(
    path.resolve(__dirname, '../scripts/build-dev.ps1'),
    'utf8',
  );

  assert.doesNotMatch(tabBar, /<AdBanner\b/);
  assert.match(mainLayout, /<AdBanner\s+visible=/);
  assert.match(adConfig, /GOOGLE_DEMO_BANNER_IDS/);
  assert.doesNotMatch(adConfig, /react-native-google-mobile-ads/);
  assert.match(adConfig, /PROD_BANNER_ID_PATTERN/);
  assert.match(adConfig, /GOOGLE_DEMO_PUBLISHER_PREFIX/);
  assert.match(appConfig, /delayAppMeasurementInit["']?:\s*true/);
  assert.match(appConfig, /resolveAdMobAppId/);
  assert.match(appConfig, /activeBuildPlatform === platform/);
  assert.match(appConfig, /valid production AdMob App ID is required/);
  assert.equal(
    easConfig.build.preview.env.EXPO_PUBLIC_FORCE_TEST_ADS,
    'true',
  );
  assert.equal(
    easConfig.build.production.env.EXPO_PUBLIC_FORCE_TEST_ADS,
    'false',
  );
  assert.match(releaseAabScript, /EXPO_PUBLIC_FORCE_TEST_ADS\s*=\s*"false"/);
  assert.match(releaseApkScript, /AdsMode\s*=\s*"production"/);
  assert.match(releaseApkScript, /build-aab\.ps1[\s\S]+-ArtifactType apk -AdsMode \$AdsMode/);
  assert.match(releaseAabScript, /AdsMode\s+-eq\s+"test"/);
  assert.match(releaseAabScript, /PlanIt-TestAds/);
  assert.match(devBuildScript, /EXPO_PUBLIC_FORCE_TEST_ADS\s*=\s*"true"/);
  assert.match(releaseAabScript, /PLANIT_BUILD_PLATFORM\s*=\s*"android"/);
  assert.match(devBuildScript, /PLANIT_BUILD_PLATFORM\s*=\s*"android"/);
  assert.equal(
    packageConfig.scripts['build:apk'],
    'npm run legal:sync && powershell -ExecutionPolicy Bypass -File ./scripts/build-android.ps1',
  );
  assert.equal(
    packageConfig.scripts['build:test-apk'],
    'npm run legal:sync && powershell -ExecutionPolicy Bypass -File ./scripts/build-android.ps1 -AdsMode test',
  );
  assert.equal(
    packageConfig.scripts['build:aab'],
    'npm run legal:sync && powershell -ExecutionPolicy Bypass -File ./scripts/build-aab.ps1',
  );
  for (const command of ['release:patch', 'release:minor', 'release:major']) {
    assert.match(packageConfig.scripts[command], /npm run build:apk$/);
  }
  for (const command of [
    'playstore:patch',
    'playstore:minor',
    'playstore:major',
  ]) {
    assert.match(packageConfig.scripts[command], /npm run build:aab$/);
  }
  for (const command of ['deploy:web:patch', 'deploy:web:minor', 'deploy:web:major']) {
    assert.match(packageConfig.scripts[command], /npm run deploy:web$/);
  }
  assert.equal(
    packageConfig.scripts['build:ultimate'],
    'npm run legal:sync && powershell -ExecutionPolicy Bypass -File ./scripts/build-aab.ps1 -ArtifactType all && npm run deploy:web',
  );
  for (const command of ['ultimate:patch', 'ultimate:minor', 'ultimate:major']) {
    assert.match(packageConfig.scripts[command], /npm run build:ultimate$/);
  }
});
