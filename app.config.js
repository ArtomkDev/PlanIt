import pkg from './package.json';

const versionParts = pkg.version.split('.');
const versionCode = parseInt(versionParts[0]) * 10000 + parseInt(versionParts[1]) * 100 + parseInt(versionParts[2]);

const forceTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';
const activeBuildPlatform =
  process.env.EAS_BUILD_PLATFORM || process.env.PLANIT_BUILD_PLATFORM;
const googleDemoPublisherPrefix = 'ca-app-pub-3940256099942544';
const appIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const googleDemoAppIds = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

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
    version: pkg.version,
    scheme: "planit",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: "./assets/splash-icon.png",
        backgroundColor: "#121214"
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.artomk.planit",
      userInterfaceStyle: "automatic",
      usesAppleSignIn: true,
      infoPlist: {
        CFBundleAllowMixedLocalizations: true
      }
    },
    android: {
      package: "com.artomk.planit",
      versionCode: versionCode,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      userInterfaceStyle: "automatic"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "c405e09d-0c69-44bd-859a-d6123086964f"
      }
    },
    owner: "artomk",
    runtimeVersion: "1.0.0",
    updates: {
      url: "https://u.expo.dev/c405e09d-0c69-44bd-859a-d6123086964f"
    },
    plugins: [
      "expo-localization",
      "expo-notifications",
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow PlanIt to attach photos to lessons and tasks.",
          "cameraPermission": "Allow PlanIt to take photos for lesson and task attachments."
        }
      ],
      "expo-document-picker",
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
      ]
    ]
  }
};
