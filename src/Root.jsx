import 'react-native-gesture-handler';
import React, { useEffect, useMemo, useState, useRef } from "react";
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, getStateFromPath } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onIdTokenChanged, signOut } from "firebase/auth";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetPresentationProvider } from "./context/BottomSheetPresentationContext";
import { AppDialogProvider } from "./context/AppDialogContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as LinkingExpo from 'expo-linking';

import { auth } from "./config/firebase";
import { trackScreenView } from "./utils/analytics/analytics";
import { setCrashlyticsUser, initGlobalErrorHandling } from "./utils/analytics/crashlytics";
import { ScheduleProvider, useScheduleData } from "./context/ScheduleProvider";
import { EditorProvider } from "./context/EditorProvider";
import { AttachmentImagePreviewProvider } from "./context/AttachmentImagePreviewContext";
import { registerDevice, listenForDeviceRemoval } from "./utils/deviceService";
import { consumeManualLogin, setManualLogin } from "./utils/authFlags";
import useAppLanguage from './hooks/useAppLanguage';
import { AdsProvider } from './context/AdsContext';
import CookieConsentBanner from './components/privacy/CookieConsentBanner';
import WebThemeStyles from './components/ui/WebThemeStyles';
import NativeThemeStyles from './components/ui/NativeThemeStyles';
import useAppTheme from './hooks/useAppTheme';
import useSystemThemeColors from './hooks/useSystemThemeColors';
import MorphingLoader from './components/ui/MorphingLoader';
import { t } from './utils/i18n';
import { createPasswordResetNavigationUrl } from './auth/accountEmailService';
import { getLocalSchedule } from './utils/storage';
import { releaseAttachmentObjectUrls } from './services/attachmentService';
import { WEBSITE_URL, WEB_APP_URL } from './config/website.cjs';
import mainLayoutLinking from './navigation/mainLayoutLinking';
import { clearWidgetScheduleData, syncWidgetPushSubscription } from './widgets/widgetService';
import { readSharedScheduleImport, clearSharedScheduleImport, resolveSharedScheduleImportUrl } from './services/shareService';
import { claimEntryLegalAcceptance, hasLegalAcceptance } from './services/legalAcceptanceService';
import { clearRestoreCredential, restoreSignIn, syncRestoreCredential } from './services/restoreCredentialService';

initGlobalErrorHandling();
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [LinkingExpo.createURL('/'), 'planit://', WEBSITE_URL, WEB_APP_URL],
  getInitialURL: async () => {
    const url = await LinkingExpo.getInitialURL();
    return createPasswordResetNavigationUrl(url);
  },
  subscribe: (listener) => {
    const subscription = LinkingExpo.addEventListener('url', ({ url }) => {
      listener(createPasswordResetNavigationUrl(url));
    });

    return () => subscription.remove();
  },
  config: {
    screens: {
      MainLayout: mainLayoutLinking,
      Auth: 'auth',
      PasswordReset: 'password-reset',
      LegalDocument: 'legal/:documentType',
      SharedSchedule: 'share/:code',
    },
  },
};

const documentTitle = { formatter: () => 'PlanIt' };

function StartupScreen({ colors, lang, style }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('schedule.loading', lang)}
      style={[{ flex: 1, backgroundColor: colors.backgroundColor, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <MorphingLoader size={80} />
    </View>
  );
}

// Reads the provider language and theme so a choice made in the app, including on the shared schedule
// preview before sign-in, also applies to the banner.
function AppCookieConsentBanner() {
  const { isLangLoading, lang } = useScheduleData();
  const { colorScheme } = useAppTheme();
  return isLangLoading ? null : <CookieConsentBanner lang={lang} isDark={colorScheme === 'dark'} />;
}

const ThemedNavigationContainer = React.forwardRef(function ThemedNavigationContainer({ hasInitialLayout, ...props }, ref) {
  const { colorScheme, colors } = useAppTheme();
  const { isDevicePrefsReady, isLangLoading, lang } = useScheduleData();
  const [navigationReady, setNavigationReady] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const canRenderNavigation = isDevicePrefsReady && !isLangLoading;
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.accentColor,
      background: colors.backgroundColor, card: colors.backgroundColor2,
      text: colors.textColor, border: colors.borderColor, notification: colors.accentColor } };
  }, [colorScheme, colors]);
  useEffect(() => {
    if (!canRenderNavigation || !navigationReady || !hasInitialLayout || hasFirstFrame) return;
    const frame = requestAnimationFrame(() => {
      setHasFirstFrame(true);
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [canRenderNavigation, navigationReady, hasInitialLayout, hasFirstFrame]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundColor }}>
      {canRenderNavigation && (
        <NavigationContainer {...props} ref={ref} theme={navigationTheme} onReady={() => {
          setNavigationReady(true);
          props.onReady?.();
        }} />
      )}
      {(!canRenderNavigation || !hasFirstFrame) && (
        <StartupScreen colors={colors} lang={lang} style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
});

export default function RootApp() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [hasInitialLayout, setHasInitialLayout] = useState(false);
  const { lang, isLangLoading } = useAppLanguage();
  const { colors: systemColors } = useSystemThemeColors();

  const wasLoggedIn = useRef(false);
  const navigationRef = useRef();
  const routeNameRef = useRef();
  // Android keeps returning the launch link for the whole process, so a navigation remounted for a
  // new session would open that link again.
  const launchUrlHandledRef = useRef(false);
  const navigationLinking = useMemo(() => ({
    ...linking,
    getInitialURL: async () => (launchUrlHandledRef.current ? null : linking.getInitialURL()),
  }), []);
  const sessionScope = user ? `user:${user.uid}` : guest ? 'guest' : null;
  const [initialNavigation, setInitialNavigation] = useState(null);
  useEffect(() => {
    if (!authResolved) return;
    let active = true;
    (async () => {
      const [url, intent] = await Promise.all([
        navigationLinking.getInitialURL().catch(() => null), readSharedScheduleImport().catch(() => null),
      ]);
      const resolved = resolveSharedScheduleImportUrl(url, intent, sessionScope);
      const initialState = resolved !== url && resolved?.startsWith('planit://')
        ? getStateFromPath(resolved.slice('planit://'.length), linking.config) : undefined;
      if (active) setInitialNavigation({ scope: sessionScope, initialState });
    })();
    return () => { active = false; };
  }, [authResolved, sessionScope]);

  useEffect(() => () => releaseAttachmentObjectUrls(), [user?.uid, guest]);

  useEffect(() => {
    let deviceListenerUnsubscribe = () => {};
    let active = true;
    let sessionGeneration = 0;
    let startupResolved = false;

    const authUnsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const generation = ++sessionGeneration;
      const isCurrentSession = () => active && generation === sessionGeneration;
      deviceListenerUnsubscribe();
      deviceListenerUnsubscribe = () => {};

      const handleSignOut = () => {
        if (isCurrentSession() && auth.currentUser?.uid === firebaseUser?.uid) {
          signOut(auth).catch(console.error);
        }
      };

      const attachDeviceListener = async () => {
        if (!isCurrentSession()) return;
        const unsubscribe = await listenForDeviceRemoval(firebaseUser.uid, handleSignOut);
        if (isCurrentSession()) deviceListenerUnsubscribe = unsubscribe;
        else unsubscribe();
      };
      
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          // reload() reports the verified email before the ID token carries the claim that
          // Firestore rules check, so a stale token would fail the first schedule load.
          const tokenResult = await firebaseUser.getIdTokenResult().catch(() => null);
          if (tokenResult && tokenResult.claims.email_verified !== true) {
            await firebaseUser.getIdToken(true).catch(console.error);
          }
          if (!isCurrentSession()) return;
          await claimEntryLegalAcceptance(firebaseUser.uid).catch(console.error);
          if (!isCurrentSession()) return;
          wasLoggedIn.current = true;
          const shouldCreateLoginNotification = consumeManualLogin();
          setUser(firebaseUser);
          setGuest(false);
          setAuthResolved(true); 
          setCrashlyticsUser(firebaseUser.uid);
          syncRestoreCredential(firebaseUser).catch(console.error);
          
          try {
            await registerDevice(firebaseUser.uid, {
              createLoginNotification: shouldCreateLoginNotification,
              allowReactivation: shouldCreateLoginNotification,
              lang,
            });
            if (isCurrentSession()) syncWidgetPushSubscription();
            await attachDeviceListener();
          } catch (error) {
            if (!isCurrentSession()) return;
            if (error?.code === 'device/revoked') {
              handleSignOut();
              return;
            }
            console.error(error);
            await attachDeviceListener().catch(console.error);
          }
        } else {
          setManualLogin(false);
          setUser(null);
          setGuest(false); 
          setAuthResolved(true);
        }
      } else {
        setUser(null);
        setCrashlyticsUser('');
        
        if (wasLoggedIn.current) {
          clearSharedScheduleImport().catch(console.error);
          clearWidgetScheduleData().catch(console.error);
          clearRestoreCredential().catch(console.error);
          setGuest(false);
          wasLoggedIn.current = false;
          setAuthResolved(true);
        } else if (!startupResolved) {
          // Only startup restores a session: leaving guest mode signs out again, and restoring the
          // guest then would undo the exit. A successful restore signs in, which emits the restored
          // user to this listener.
          if (await restoreSignIn().catch((error) => { console.error(error); return false; })) return;
          if (!isCurrentSession()) return;
          try {
            const localSchedule = await getLocalSchedule(null);
            const pendingImport = await readSharedScheduleImport().catch(() => null);
            const resumeGuest = pendingImport?.stage === 'ready' && pendingImport.scope === 'guest' && await hasLegalAcceptance('guest').catch(() => false);
            if (!isCurrentSession()) return;
            setGuest(!!localSchedule || resumeGuest);
          } catch (e) {
            if (!isCurrentSession()) return;
            if (e?.code === 'local-storage/corrupt-data') setGuest(true);
            console.warn(e);
          } finally {
            if (isCurrentSession()) {
              startupResolved = true;
              setAuthResolved(true);
            }
          }
        }
      }
    });

    return () => {
      active = false;
      sessionGeneration += 1;
      authUnsubscribe();
      deviceListenerUnsubscribe();
    };
  }, []);

  const appIsReady = authResolved && !isLangLoading && initialNavigation?.scope === sessionScope;

  if (!appIsReady) {
    return <StartupScreen colors={systemColors} lang={lang} />;
  }

  const handleExitGuest = () => {
    setGuest(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: systemColors.backgroundColor }}>
      <SafeAreaProvider>
        {/* Base of the status bar stack: system-themed screens follow the device theme, and
            screens with an app theme mount their own StatusBar on top of this one. */}
        <StatusBar style="auto" />
        <AttachmentImagePreviewProvider key={user?.uid || (guest ? 'guest' : 'signed-out')}>
          <AdsProvider>
            <ScheduleProvider
              guest={guest}
              user={user}
            >
              <WebThemeStyles />
              <NativeThemeStyles />
              <AppDialogProvider>
              <BottomSheetPresentationProvider>
                <ThemedNavigationContainer
                ref={navigationRef}
                hasInitialLayout={hasInitialLayout}
                linking={navigationLinking}
                initialState={initialNavigation.initialState}
                documentTitle={documentTitle}
                onReady={() => {
                  launchUrlHandledRef.current = true;
                  if (navigationRef.current) {
                    routeNameRef.current = navigationRef.current.getCurrentRoute().name;
                  }
                }}
                onStateChange={async () => {
                  const previousRouteName = routeNameRef.current;
                  const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

                  if (previousRouteName !== currentRouteName && currentRouteName) {
                    trackScreenView(currentRouteName);
                  }
                  routeNameRef.current = currentRouteName;
                }}
                >
                  <Stack.Navigator
                    screenOptions={{ headerShown: false, animation: hasInitialLayout ? 'fade' : 'none', animationDuration: 500 }}
                    screenLayout={({ children }) => (
                      <View style={{ flex: 1 }} onLayout={() => setHasInitialLayout(true)}>{children}</View>
                    )}
                  >
                  {user || guest ? (
                    <Stack.Screen name="MainLayout">
                      {(props) => {
                        const MainLayout = require('./layouts/MainLayout').default;
                        return (
                          <EditorProvider>
                            <MainLayout
                              {...props}
                              guest={guest}
                              onExitGuest={handleExitGuest}
                            />
                          </EditorProvider>
                        );
                      }}
                    </Stack.Screen>
                  ) : (
                    <Stack.Screen name="Auth">
                      {(props) => {
                        const AuthScreen = require('./auth/AuthScreen').default;
                        return <AuthScreen {...props} onGuestLogin={() => setGuest(true)} />;
                      }}
                    </Stack.Screen>
                  )}
                  <Stack.Screen name="PasswordReset">
                    {(props) => {
                      const PasswordResetScreen = require('./auth/PasswordResetScreen').default;
                      return <PasswordResetScreen
                        {...props}
                        fallbackRoute={user || guest ? 'MainLayout' : 'Auth'}
                      />;
                    }}
                  </Stack.Screen>
                  <Stack.Screen name="LegalDocument" getComponent={() => require('./pages/Settings/components/LegalDocumentScreen').default} />
                  <Stack.Screen name="SharedSchedule">
                    {(props) => {
                      const SharedScheduleScreen = require('./pages/Schedule/SharedScheduleScreen').default;
                      return <SharedScheduleScreen {...props} fallbackRoute={user || guest ? 'MainLayout' : 'Auth'} onGuestLogin={() => setGuest(true)} />;
                    }}
                  </Stack.Screen>
                  </Stack.Navigator>
                </ThemedNavigationContainer>
              </BottomSheetPresentationProvider>
              </AppDialogProvider>
              <AppCookieConsentBanner />
            </ScheduleProvider>
          </AdsProvider>
        </AttachmentImagePreviewProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
