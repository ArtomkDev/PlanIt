import 'dotenv/config';
import pkg from './package.json';

export default {
  expo: {
    name: "PlanIt",
    slug: "PlanIt",
    version: pkg.version,
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
      userInterfaceStyle: "automatic"
    },
    android: {
      package: "com.artomk.planit",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      userInterfaceStyle: "automatic",
      keystore: "./android/app/my-release-key.keystore",
      keystoreAlias: process.env.ANDROID_KEYSTORE_ALIAS,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keyPassword: process.env.ANDROID_KEY_PASSWORD
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
      "@react-native-google-signin/google-signin",
      "expo-apple-authentication",
      "@react-native-community/datetimepicker",
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-7165910523854581~9152797441",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics"
    ]
  }
};