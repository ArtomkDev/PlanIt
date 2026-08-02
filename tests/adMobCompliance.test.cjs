const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/utils/adInit/adInit.native.js',
);
const adConfigPath = path.resolve(__dirname, '../src/config/ads.js');

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
    getAdsModuleLoads: () => adsModuleLoads,
    service: testModule.exports,
  };
};

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
    'ca-app-pub-3940256099942544/6300978111';

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
  assert.match(mainLayout, /<AdBanner\s*\/>/);
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
  assert.match(releaseApkScript, /AdsMode\s+-eq\s+"test"/);
  assert.match(releaseApkScript, /PlanIt-TestAds/);
  assert.match(devBuildScript, /EXPO_PUBLIC_FORCE_TEST_ADS\s*=\s*"true"/);
  assert.match(releaseAabScript, /PLANIT_BUILD_PLATFORM\s*=\s*"android"/);
  assert.match(releaseApkScript, /PLANIT_BUILD_PLATFORM\s*=\s*"android"/);
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
});
