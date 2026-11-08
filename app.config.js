import fs from 'node:fs';
import path from 'node:path';
import pkg from './package.json';
import nativeEnglish from './src/locales/native/en.json';
import { getAndroidVersionCode } from './src/config/appVersion.cjs';
import { FIREBASE_PRODUCTION_PROJECT_ID } from './src/config/firebaseProjects.cjs';
import { WEB_APP_URL } from './src/config/website.cjs';

const versionCode = getAndroidVersionCode(pkg.version);

const forceTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';
const activeBuildPlatform =
  process.env.EAS_BUILD_PLATFORM || process.env.PLANIT_BUILD_PLATFORM;
const googleDemoPublisherPrefix = 'ca-app-pub-3940256099942544';
const appIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const googleDemoAppIds = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

const normalizeHost = (value) => (value || '')
  .trim()
  .replace(/^https?:\/\//, '')
  .split('/')[0];
const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_FILE || './google-services.json';
const iosGoogleServicesFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST || './GoogleService-Info.plist';

// .env.development switches `expo start` and dev-client builds to the
// development Firebase project; release commands run with NODE_ENV=production.
if (process.env.NODE_ENV === 'development' && firebaseProjectId === FIREBASE_PRODUCTION_PROJECT_ID) {
  throw new Error(
    `Development runs must not use the production Firebase project "${FIREBASE_PRODUCTION_PROJECT_ID}". `
    + 'Create .env.development from .env.example.',
  );
}

const nativeFirebaseProjectIds = {
  [androidGoogleServicesFile]: (contents) => JSON.parse(contents).project_info?.project_id,
  [iosGoogleServicesFile]: (contents) => contents.match(/<key>PROJECT_ID<\/key>\s*<string>([^<]+)<\/string>/)?.[1],
};
for (const [file, readProjectId] of Object.entries(nativeFirebaseProjectIds)) {
  const filePath = path.resolve(__dirname, file);
  if (!firebaseProjectId || !fs.existsSync(filePath)) continue;
  const nativeProjectId = readProjectId(fs.readFileSync(filePath, 'utf8'));
  if (nativeProjectId !== firebaseProjectId) {
    throw new Error(
      `${file} belongs to Firebase project "${nativeProjectId}", `
      + `but EXPO_PUBLIC_FIREBASE_PROJECT_ID is "${firebaseProjectId}".`,
    );
  }
}

const firebaseAuthLinkHost = normalizeHost(
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_LINK_DOMAIN
  || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  || (firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : ''),
);
const shareLinkHost = new URL(WEB_APP_URL).hostname;
const authLinkIntentFilters = firebaseAuthLinkHost ? [{
  action: 'VIEW',
  autoVerify: true,
  data: [
    {
      scheme: 'https',
      host: firebaseAuthLinkHost,
      pathPrefix: '/__/auth/links',
    },
    {
      scheme: 'https',
      host: firebaseAuthLinkHost,
      pathPrefix: '/password-reset',
    },
  ],
  category: ['BROWSABLE', 'DEFAULT'],
}] : [];

const shareLinkIntentFilters = [{
  action: 'VIEW',
  autoVerify: true,
  data: [{
    scheme: 'https',
    host: shareLinkHost,
    pathPrefix: '/share',
  }],
  category: ['BROWSABLE', 'DEFAULT'],
}];

const resolveAdMobAppId = (platform, configuredId) => {
  if (forceTestAds) return googleDemoAppIds[platform];
  if (
    appIdPattern.test(configuredId || '') &&
    !configuredId.startsWith(googleDemoPublisherPrefix)
  ) {
    return configuredId;
  }

  if (activeBuildPlatform === platform) {
    throw new Error(
      `A valid production AdMob App ID is required for ${platform}.`,
    );
  }

  // Expo evaluates both platform configs even for many single-platform tasks.
  // Leave an untargeted platform empty, but fail above when it is actually built.
  return '';
};

const androidAdMobAppId = resolveAdMobAppId(
  'android',
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
);
const iosAdMobAppId = resolveAdMobAppId(
  'ios',
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
);

export default {
  expo: {
    name: "PlanIt",
    slug: "PlanIt",
    locales: {
      en: "./src/locales/native/en.json",
      uk: "./src/locales/native/uk.json",
    },
    version: pkg.version,
    scheme: "planit",
    // Keep the existing iOS behavior. The Android compliance plugin removes
    // this generated restriction only from MainActivity for Android 16.
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.artomk.planit",
      userInterfaceStyle: "automatic",
      usesAppleSignIn: true,
      googleServicesFile: iosGoogleServicesFile,
      associatedDomains: [
        ...(firebaseAuthLinkHost ? [`applinks:${firebaseAuthLinkHost}`] : []),
        `applinks:${shareLinkHost}`,
      ],
      infoPlist: {
        CFBundleAllowMixedLocalizations: true
      }
    },
    android: {
      package: "com.artomk.planit",
      versionCode: versionCode,
      googleServicesFile: androidGoogleServicesFile,
      intentFilters: [
        ...authLinkIntentFilters,
        ...shareLinkIntentFilters,
      ],
      // Attachments are photos only, and overlays are needed only by the debug
      // dev client, whose own manifest keeps SYSTEM_ALERT_WINDOW.
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      userInterfaceStyle: "automatic"
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "c405e09d-0c69-44bd-859a-d6123086964f"
      }
    },
    owner: "artomk",
    // Native configuration changes must not share an OTA runtime with older
    // binaries. Each app version gets its own compatible update runtime.
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/c405e09d-0c69-44bd-859a-d6123086964f"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: "#F2F4F7",
          dark: {
            image: "./assets/splash-icon-dark.png",
            backgroundColor: "#121214"
          }
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "kotlinVersion": "2.3.20",
            "enableMinifyInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ],
      "expo-localization",
      "expo-notifications",
      ["expo-navigation-bar", { "enforceContrast": false }],
      "expo-image",
      [
        "expo-image-picker",
        {
          "photosPermission": nativeEnglish.ios.NSPhotoLibraryUsageDescription,
          "cameraPermission": nativeEnglish.ios.NSCameraUsageDescription,
          "microphonePermission": nativeEnglish.ios.NSMicrophoneUsageDescription
        }
      ],
      "expo-document-picker",
      "expo-sharing",
      "@react-native-google-signin/google-signin",
      "expo-apple-authentication",
      "@react-native-community/datetimepicker",
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": androidAdMobAppId,
          "iosAppId": iosAdMobAppId,
          "delayAppMeasurementInit": true
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      [
        "react-native-android-widget",
        {
          "widgets": [
            {
              "name": "ScheduleWidget",
              "label": "Мій Розклад",
              "minWidth": "150dp",
              "minHeight": "110dp",
              "description": "Показує ваше наступне заняття",
              "resizeMode": "horizontal|vertical"
            }
          ]
        }
      ],
      "./plugins/withWidgetUpdateScheduler",
      "./plugins/withRestoreCredentials",
      "./plugins/withAndroidPlayCompliance"
    ]
  }
};
