import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager,
  Animated, Easing, useWindowDimensions, BackHandler, PanResponder, Linking
} from 'react-native';
import TextInput from '../components/ui/AppTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Planet, RocketLaunch, Compass, Fingerprint, IdentificationCard, ShieldCheck, 
  UserPlus, CalendarBlank, PencilSimple, EnvelopeOpen, PaperPlaneRight, CheckCircle,
  Eye, EyeClosed, ArrowLeft, User, EnvelopeSimple, LockKey, WarningCircle, DownloadSimple, X
} from 'phosphor-react-native';
import { StatusBar } from 'expo-status-bar';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut
} from 'firebase/auth';
import GradientBackground from '../components/ui/GradientBackground';

import { auth } from '../config/firebase'; 
import SocialAuthButtons from './components/SocialAuthButtons';
import useAppTheme from '../hooks/useAppTheme';
import { useScheduleData } from '../context/ScheduleProvider';
import SignedOutHeader from '../components/ui/SignedOutHeader';
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';
import { t } from '../utils/i18n';
import MorphingLoader from '../components/ui/MorphingLoader';
import TermsCheckbox from '../components/privacy/TermsCheckbox';
import PlanItWordmark from '../components/ui/PlanItWordmark';
import { setManualLogin } from '../utils/authFlags';
import { triggerHaptic } from '../utils/haptics';
import { getLegalDocumentBrowserUrl } from '../utils/legalDocumentLinks';
import { hasLegalAcceptance, recordLegalAcceptance } from '../services/legalAcceptanceService';
import { readSharedScheduleImport, clearSharedScheduleImport, prepareSharedScheduleImport, normalizeShareCodeInput } from '../services/shareService';
import {
  requestEmailVerification,
  requestPasswordResetEmailForEmail,
} from './accountEmailService';
import PasswordStrengthBar from './components/PasswordStrengthBar';
import {
  MAX_PASSWORD_LENGTH,
  getPasswordPolicyMessage,
  isPasswordAllowed,
} from './passwordPolicy';

if (
  Platform.OS === 'android' && 
  UIManager.setLayoutAnimationEnabledExperimental && 
  global._IS_FABRIC !== true
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AUTH_LAYOUT_ANIMATION = {
  duration: 240,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

const SOCIAL_AUTH_CANCEL_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

const configureAuthLayoutAnimation = (reduceMotion = false) => {
  if (!reduceMotion) LayoutAnimation.configureNext(AUTH_LAYOUT_ANIMATION);
};

const getIconConfig = (vw, vh) => {
  const cx = (pct) => vw * pct - 140; 
  const cy = (pct) => vh * pct - 140;

  return {
    welcome: [
      { id: 0, IconComponent: Planet, x: cx(0.1), y: cy(0.15), scale: 1.1, rotate: -15, opacity: 0.05 },
      { id: 1, IconComponent: RocketLaunch, x: cx(0.85), y: cy(0.85), scale: 0.9, rotate: 45, opacity: 0.06 },
      { id: 2, IconComponent: Compass, x: cx(0.8), y: cy(0.2), scale: 0.7, rotate: 10, opacity: 0.04 },
    ],
    signin: [
      { id: 0, IconComponent: Fingerprint, x: cx(0.85), y: cy(0.15), scale: 1.2, rotate: 0, opacity: 0.05 },
      { id: 1, IconComponent: IdentificationCard, x: cx(0.15), y: cy(0.8), scale: 0.85, rotate: -20, opacity: 0.04 },
      { id: 2, IconComponent: ShieldCheck, x: cx(0.7), y: cy(0.85), scale: 0.75, rotate: 15, opacity: 0.06 },
    ],
    signup: [
      { id: 0, IconComponent: UserPlus, x: cx(0.25), y: cy(0.15), scale: 1.1, rotate: 15, opacity: 0.06 },
      { id: 1, IconComponent: CalendarBlank, x: cx(0.85), y: cy(0.5), scale: 0.9, rotate: -15, opacity: 0.05 },
      { id: 2, IconComponent: PencilSimple, x: cx(0.15), y: cy(0.85), scale: 0.85, rotate: 35, opacity: 0.04 },
    ],
    verify: [
      { id: 0, IconComponent: EnvelopeOpen, x: cx(0.15), y: cy(0.15), scale: 1.15, rotate: -15, opacity: 0.06 },
      { id: 1, IconComponent: PaperPlaneRight, x: cx(0.85), y: cy(0.25), scale: 0.9, rotate: 25, opacity: 0.05 },
      { id: 2, IconComponent: CheckCircle, x: cx(0.5), y: cy(0.85), scale: 0.95, rotate: 10, opacity: 0.04 },
    ]
  };
};

const AnimatedGradientBackground = ({ currentView, colors, isDark }) => {
  const reduceMotion = useReducedMotionPreference();
  const breathAnim = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(currentView === 'welcome' ? 1 : 0)).current;
  const signinOpacity = useRef(new Animated.Value(currentView === 'signin' ? 1 : 0)).current;
  const signupOpacity = useRef(new Animated.Value(currentView === 'signup' ? 1 : 0)).current;
  const verifyOpacity = useRef(new Animated.Value(currentView === 'verify' ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      breathAnim.stopAnimation();
      breathAnim.setValue(0);
      return undefined;
    }
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(breathAnim, { toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    );
    breathLoop.start();

    return () => breathLoop.stop();
  }, [breathAnim, reduceMotion]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(welcomeOpacity, { toValue: currentView === 'welcome' ? 1 : 0, duration: reduceMotion ? 0 : 240, useNativeDriver: true }),
      Animated.timing(signinOpacity, { toValue: currentView === 'signin' ? 1 : 0, duration: reduceMotion ? 0 : 240, useNativeDriver: true }),
      Animated.timing(signupOpacity, { toValue: currentView === 'signup' ? 1 : 0, duration: reduceMotion ? 0 : 240, useNativeDriver: true }),
      Animated.timing(verifyOpacity, { toValue: currentView === 'verify' ? 1 : 0, duration: reduceMotion ? 0 : 240, useNativeDriver: true }),
    ]).start();
  }, [currentView, reduceMotion, signinOpacity, signupOpacity, verifyOpacity, welcomeOpacity]);

  const baseColor = colors.backgroundColor;
  
  const palettes = {
    welcome: { secondary: isDark ? '#2a0f18' : '#f6e3e8', accent: isDark ? '#e2537a' : '#e895ab' },
    signin: { secondary: isDark ? '#0a1a33' : '#e1e9f7', accent: isDark ? '#2563eb' : '#6b9be8' },
    signup: { secondary: isDark ? '#06302c' : '#e2f1ef', accent: isDark ? '#14b8a6' : '#5eb8ad' },
    verify: { secondary: isDark ? '#2b1608' : '#f7e8dc', accent: isDark ? '#ea7a2f' : '#eba373' }
  };

  const renderLayer = (opacityAnim, palette) => (
    <GradientBackground
      component={Animated.View}
      colors={[baseColor, palette.secondary]}
      angle={45}
      fallbackColor={baseColor}
      style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}
      pointerEvents="none"
    >
      <GradientBackground
        component={Animated.View}
        colors={['transparent', palette.accent]}
        angle={135}
        gradientOpacity={isDark ? 0.22 : 0.12}
        fallbackColor="transparent"
        style={[StyleSheet.absoluteFill, { opacity: breathAnim }]}
        pointerEvents="none"
      />
    </GradientBackground>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      {renderLayer(welcomeOpacity, palettes.welcome)}
      {renderLayer(signinOpacity, palettes.signin)}
      {renderLayer(signupOpacity, palettes.signup)}
      {renderLayer(verifyOpacity, palettes.verify)}
    </View>
  );
};

const AnimatedIconSlot = ({ targetConfig, isDark }) => {
  const reduceMotion = useReducedMotionPreference();
  const animX = useRef(new Animated.Value(targetConfig.x)).current;
  const animY = useRef(new Animated.Value(targetConfig.y)).current;
  const animScale = useRef(new Animated.Value(targetConfig.scale)).current;
  const animRotate = useRef(new Animated.Value(targetConfig.rotate)).current;
  const animOpacity = useRef(new Animated.Value(targetConfig.opacity)).current;
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [ActiveIcon, setActiveIcon] = useState(() => targetConfig.IconComponent);

  useEffect(() => {
    if (reduceMotion) {
      setActiveIcon(() => targetConfig.IconComponent);
      animX.setValue(targetConfig.x);
      animY.setValue(targetConfig.y);
      animScale.setValue(targetConfig.scale);
      animRotate.setValue(targetConfig.rotate);
      animOpacity.setValue(targetConfig.opacity);
      fadeAnim.setValue(1);
      return;
    }
    if (ActiveIcon !== targetConfig.IconComponent) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setActiveIcon(() => targetConfig.IconComponent);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }

    Animated.parallel([
      Animated.spring(animX, { toValue: targetConfig.x, friction: 8, tension: 25, useNativeDriver: true }),
      Animated.spring(animY, { toValue: targetConfig.y, friction: 8, tension: 25, useNativeDriver: true }),
      Animated.spring(animScale, { toValue: targetConfig.scale, friction: 8, tension: 35, useNativeDriver: true }),
      Animated.timing(animRotate, { toValue: targetConfig.rotate, duration: 280, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: targetConfig.opacity, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [ActiveIcon, animOpacity, animRotate, animScale, animX, animY, fadeAnim, reduceMotion, targetConfig]);

  const spin = animRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

  return (
    <Animated.View style={[styles.backgroundIconWrapper, { transform: [{ translateX: animX }, { translateY: animY }, { scale: animScale }, { rotate: spin }], opacity: animOpacity }]}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {ActiveIcon && <ActiveIcon size={280} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} weight="regular" />}
      </Animated.View>
    </Animated.View>
  );
};

const InputField = ({
  ref,
  InputIcon,
  placeholder,
  accessibilityLabel,
  secureTextEntry,
  value,
  onChangeText,
  isPasswordButton,
  isPasswordVisible,
  setIsPasswordVisible,
  passwordToggleLabel,
  passwordToggleHint,
  autoCapitalize="none",
  keyboardType="default",
  autoComplete,
  textContentType,
  maxLength,
  returnKeyType,
  onSubmitEditing,
  error,
  hint,
  children,
  colors,
  isDark,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const iconColor = error ? '#ef4444' : isFocused ? colors.accentColor : colors.textColor2;

  return (
    <View>
      <View style={[
        styles.inputContainer,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: error ? '#ef4444' : isFocused ? colors.accentColor : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
        }
      ]}>
        {InputIcon && <InputIcon size={20} color={iconColor} style={styles.inputIcon} weight={isFocused ? "fill" : "regular"} />}
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel || placeholder}
          accessibilityHint={error || hint}
          style={[styles.input, { color: colors.textColor }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textColor2}
          secureTextEntry={secureTextEntry}
          autoCorrect={!secureTextEntry && keyboardType !== 'email-address'}
          spellCheck={!secureTextEntry && keyboardType !== 'email-address'}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsFocused(true);
          }}
          onBlur={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsFocused(false);
          }}
        />
        {isPasswordButton && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={passwordToggleLabel}
            accessibilityHint={passwordToggleHint}
            onPress={() => {
              triggerHaptic("selection");
              setIsPasswordVisible(!isPasswordVisible);
            }}
            style={styles.eyeButton}
          >
            {isPasswordVisible ?
              <EyeClosed size={22} color={colors.textColor2} weight="regular" /> :
              <Eye size={22} color={colors.textColor2} weight="regular" />
            }
          </TouchableOpacity>
        )}
      </View>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, { color: colors.textColor2 }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

const AuthMorphingLoader = ({ compact }) => {
  const scale = useRef(new Animated.Value(compact ? 0.58 : 1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: compact ? 0.58 : 1,
        friction: 9,
        tension: 72,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [compact, opacity, scale]);

  return (
    <Animated.View style={[styles.authLoaderMotion, { opacity, transform: [{ scale }] }]}>
      <MorphingLoader size={70} />
    </Animated.View>
  );
};

const PendingImportNotice = ({ colors, lang, onBack, onSkip, disabled }) => (
  <View style={[styles.importNotice, { backgroundColor: colors.accentColorLight, borderColor: colors.accentColor + '33' }]}>
    <View style={[styles.importNoticeIcon, { backgroundColor: colors.accentColor }]}>
      <DownloadSimple size={16} weight="bold" color={colors.textOnAccent} accessible={false} />
    </View>
    <View style={styles.importNoticeBody}>
      <Text style={[styles.importNoticeText, { color: colors.textColor }]}>{t('share.auth_continue_hint', lang)}</Text>
      <View style={styles.importNoticeActions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={8}
          onPress={onBack}
          style={styles.importNoticeAction}
        >
          <ArrowLeft size={16} weight="bold" color={colors.accentTextColor} style={styles.importNoticeActionIcon} accessible={false} />
          <Text style={[styles.importNoticeActionText, { color: colors.accentTextColor }]}>{t('share.back_to_preview', lang)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={8}
          onPress={onSkip}
          style={styles.importNoticeAction}
        >
          <X size={16} weight="bold" color="#ef4444" style={styles.importNoticeActionIcon} accessible={false} />
          <Text style={[styles.importNoticeActionText, { color: '#ef4444' }]}>{t('share.skip_copy', lang)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const WelcomeContent = ({ onNavigate, colors, lang, onGuestLogin, acceptedTerms, onToggleTerms, onTermsMissing, termsError, isDark, formError, onOpenLegalDocument, busy, notice }) => {
  const checkTerms = (action) => {
    if (!acceptedTerms) {
      onTermsMissing();
      return;
    }
    action();
  };

  return (
    <View style={styles.contentBlock}>
      <View style={styles.welcomeHeader}>
        <PlanItWordmark fontSize={52} color={colors.textColor} isDark={isDark} style={styles.welcomeTitle} />
        <Text style={[styles.welcomeSubtitle, { color: colors.textColor2 }]}>{t('auth.welcome.subtitle', lang)}</Text>
      </View>
      <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
        {notice}
        {formError ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.errorBox, { marginBottom: 16 }]}>
            <WarningCircle size={20} color="#ef4444" weight="fill" />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} accessibilityLabel={t('auth.signin.submit', lang)} style={[styles.primaryButton, { backgroundColor: colors.accentColor, opacity: acceptedTerms ? 1 : 0.6 }]} onPress={() => checkTerms(() => onNavigate('signin'))}>
          <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>{t('auth.signin.submit', lang)}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} accessibilityLabel={t('auth.signup.title', lang)} style={[styles.secondaryButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderColor: colors.borderColor, opacity: acceptedTerms ? 1 : 0.6 }]} onPress={() => checkTerms(() => onNavigate('signup'))}>
          <Text style={[styles.secondaryButtonText, { color: colors.textColor }]}>{t("auth.signup.title", lang)}</Text>
        </TouchableOpacity>
        {onGuestLogin && (
          <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} accessibilityLabel={t('auth.welcome.guest_btn', lang)} style={styles.guestButton} onPress={() => checkTerms(onGuestLogin)}>
            <Text style={[styles.guestButtonText, { color: acceptedTerms ? colors.textColor2 : colors.textColor2 + '80' }]}>{t('auth.welcome.guest_btn', lang)}</Text>
          </TouchableOpacity>
        )}
        <View style={{ marginTop: 12 }}>
          <TermsCheckbox disabled={busy} acceptedTerms={acceptedTerms} onToggle={onToggleTerms} error={termsError} colors={colors} lang={lang} onOpenDocument={onOpenLegalDocument} />
        </View>
      </View>
    </View>
  );
};

const AuthScreen = ({ onGuestLogin, navigation, route }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { width: vw, height: vh } = useWindowDimensions(); 
  const { lang, isLangLoading } = useScheduleData();
  const { colors, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  
  const [currentView, setCurrentView] = useState(() => {
    if (auth.currentUser && !auth.currentUser.emailVerified) return 'verify';
    return 'welcome';
  }); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const entryBusyRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordResetCooldown, setPasswordResetCooldown] = useState(0);
  
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;
  const shareParam = route?.params?.share;
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await readSharedScheduleImport();
      let linkedCode = null;
      try { if (shareParam) linkedCode = normalizeShareCodeInput(shareParam); } catch {}
      // The link keeps the share code, so the continuation survives cleared storage or a new tab.
      const intent = linkedCode && (stored?.code !== linkedCode || stored.stage !== 'auth')
        ? await prepareSharedScheduleImport(linkedCode, { stage: 'auth', scope: null })
        : stored;
      if (!active || intent?.stage !== 'auth') return;
      setPendingImport(intent);
      const accepted = await hasLegalAcceptance('entry');
      if (!active) return;
      setAcceptedTerms(accepted);
      if (!auth.currentUser || auth.currentUser.emailVerified) setCurrentView(intent.authView === 'signup' ? 'signup' : 'signin');
    })().catch(() => { if (active) setFormError(t('common.action_failed', lang)); });
    return () => { active = false; };
  }, [shareParam]);

  const beforeAuth = async (scope = 'entry') => {
    if (!acceptedTerms) { handleTermsMissing(); return false; }
    try { await recordLegalAcceptance(lang, scope); return true; }
    catch { setFormError(t('common.action_failed', lang)); return false; }
  };
  const enterGuest = async () => {
    if (entryBusyRef.current) return;
    entryBusyRef.current = true;
    setEntryBusy(true);
    try {
      if (!await beforeAuth('guest')) return;
      if (pendingImport) await prepareSharedScheduleImport(pendingImport.code, { stage: 'ready', scope: 'guest' });
      onGuestLogin?.();
    } catch { setFormError(t('common.action_failed', lang)); }
    finally { entryBusyRef.current = false; setEntryBusy(false); }
  };
  const cancelImport = async () => {
    try {
      await clearSharedScheduleImport(pendingImport.copyId);
      navigation.navigate('SharedSchedule', { code: pendingImport.code });
    } catch { setFormError(t('common.action_failed', lang)); }
  };
  const skipImport = async () => {
    try {
      await clearSharedScheduleImport(pendingImport.copyId);
      configureAuthLayoutAnimation(reduceMotion);
      setPendingImport(null);
      navigation?.setParams?.({ share: undefined });
    } catch { setFormError(t('common.action_failed', lang)); }
  };
  useEffect(() => navigation?.addListener?.('beforeRemove', event => {
    if (pendingImport && ['POP', 'GO_BACK'].includes(event.data.action.type)) clearSharedScheduleImport(pendingImport.copyId).catch(console.error);
  }), [navigation, pendingImport]);
  const fieldRefs = {
    name: useRef(null),
    email: useRef(null),
    password: useRef(null),
  };

  const validateEmail = (emailText) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText);
  };

  const clearMessages = () => {
    setFormError('');
    setSuccessMessage('');
  };

  const clearFieldError = (field) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const showFieldErrors = (errors) => {
    triggerHaptic("warning");
    configureAuthLayoutAnimation(reduceMotion);
    clearMessages();
    setFieldErrors(errors);
    const firstInvalidField = ['name', 'email', 'password'].find((field) => errors[field]);
    if (firstInvalidField) fieldRefs[firstInvalidField].current?.focus();
  };

  const handleTextChange = (field, setter) => (text) => {
    setter(text);
    clearFieldError(field);
    if (formError || successMessage) clearMessages();
  };

  const handleToggleTerms = () => {
    setAcceptedTerms((accepted) => !accepted);
    clearFieldError('terms');
    setFormError('');
  };

  const handleTermsMissing = () => {
    showFieldErrors({ terms: t('auth.errors.accept_terms', lang) });
  };

  const handleNavigate = (view) => {
    triggerHaptic(view === 'welcome' ? "navigateBack" : "navigation");
    configureAuthLayoutAnimation(reduceMotion);
    clearMessages();
    setFieldErrors({});
    setCurrentView(view);
  };
  const navigateRef = useRef(handleNavigate);
  navigateRef.current = handleNavigate;

  const openLegalDocument = (documentType) => {
    if (Platform.OS === 'web') {
      Linking.openURL(getLegalDocumentBrowserUrl(documentType, lang)).catch(() => {
        setFormError(t('settings.about_screen.link_open_failed', lang));
      });
      return;
    }

    navigation?.navigate?.('LegalDocument', { documentType, lang });
  };

  useEffect(() => {
    const backAction = () => {
      if (currentView === 'verify') return true;
      if (currentView !== 'welcome') {
        handleNavigate('welcome');
        return true; 
      }
      if (pendingImport) { cancelImport(); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentView, pendingImport]);

  useEffect(() => {
    let interval;
    let active = true;
    let checking = false;
    if (currentView === 'verify') {
      interval = setInterval(async () => {
        const verifyingUser = auth.currentUser;
        if (!active || checking || !verifyingUser) return;
        checking = true;
        try {
          await verifyingUser.reload();
          if (!active || auth.currentUser?.uid !== verifyingUser.uid) return;
          setFormError('');
          if (verifyingUser.emailVerified) {
            setManualLogin(true);
            await verifyingUser.getIdToken(true);
            clearInterval(interval);
          }
        } catch {
          if (active) {
            setManualLogin(false);
            setFormError(t('common.action_failed', lang));
          }
        } finally {
          checking = false;
        }
      }, 4000);
    }
    return () => { active = false; clearInterval(interval); };
  }, [currentView, lang]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (passwordResetCooldown <= 0) return undefined;
    const timer = setTimeout(
      () => setPasswordResetCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [passwordResetCooldown]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 45 || gestureState.vx > 0.5) {
          if (currentViewRef.current !== 'verify') navigateRef.current('welcome');
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        if (gestureState.dx > 45 || gestureState.vx > 0.5) {
          if (currentViewRef.current !== 'verify') navigateRef.current('welcome');
        }
      }
    })
  ).current;

  const getFormErrors = (isSignUp) => {
    const errors = {};
    const trimmedEmail = email.trim();

    if (isSignUp && !name.trim()) errors.name = t('auth.errors.name_required', lang);
    if (!trimmedEmail) errors.email = t('auth.errors.email_required', lang);
    else if (!validateEmail(trimmedEmail)) errors.email = t('auth.errors.invalid_email', lang);
    if (!password) errors.password = t('auth.errors.password_required', lang);
    else if (isSignUp && !isPasswordAllowed(password)) errors.password = getPasswordPolicyMessage(lang);
    if (!acceptedTerms) errors.terms = t('auth.errors.accept_terms', lang);

    return errors;
  };

  const handleSignIn = async () => {
    if (isLoading) return;
    const errors = getFormErrors(false);
    if (Object.keys(errors).length) return showFieldErrors(errors);

    configureAuthLayoutAnimation(reduceMotion);
    setFieldErrors({});
    setIsLoading(true);
    try {
      if (!await beforeAuth()) return;
      setManualLogin(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      triggerHaptic("success");
      if (!cred.user.emailVerified) {
        handleNavigate('verify');
      }
    } catch (error) {
      triggerHaptic("error");
      setManualLogin(false);
      let msg = t('auth.errors.wrong_credentials', lang);
      if (error.code === 'auth/too-many-requests') msg = t('auth.errors.too_many_requests', lang);
      if (error.code === 'auth/network-request-failed') msg = t('auth.errors.network_failed', lang);
      setFormError(msg);
    } finally {
      configureAuthLayoutAnimation(reduceMotion);
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (isLoading) return;
    const errors = getFormErrors(true);
    if (Object.keys(errors).length) return showFieldErrors(errors);

    configureAuthLayoutAnimation(reduceMotion);
    setFieldErrors({});
    setIsLoading(true);
    try {
      if (!await beforeAuth()) return;
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      handleNavigate('verify');
      await requestEmailVerification({ user: cred.user, lang });
      setResendCooldown(60);
      triggerHaptic("success");
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        return showFieldErrors({ email: t('auth.errors.email_in_use', lang) });
      }
      if (error.code === 'auth/invalid-email') {
        return showFieldErrors({ email: t('auth.errors.invalid_email', lang) });
      }
      if (error.code === 'auth/weak-password') {
        return showFieldErrors({ password: getPasswordPolicyMessage(lang) });
      }
      triggerHaptic("error");
      let msg = t('auth.errors.signup_failed', lang);
      if (error.code === 'auth/network-request-failed') msg = t('auth.errors.network_failed', lang);
      if (error.code?.startsWith('account-email/')) msg = t('common.action_failed', lang);
      if (error.code === 'account-email/too-many-requests') {
        setResendCooldown(60);
        msg = t('auth.errors.too_many_requests', lang);
      }
      setFormError(msg);
    } finally {
      configureAuthLayoutAnimation(reduceMotion);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (passwordResetCooldown > 0 || isLoading) {
      return;
    }
    if (!trimmedEmail) {
      showFieldErrors({ email: t('auth.forgot_password.req_email', lang) });
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      showFieldErrors({ email: t('auth.errors.invalid_email', lang) });
      return;
    }

    setIsLoading(true);
    setFormError('');
    setSuccessMessage('');
    try {
      await requestPasswordResetEmailForEmail({ email: trimmedEmail, lang });
      triggerHaptic("success");
      setPasswordResetCooldown(60);
      setSuccessMessage(t('auth.forgot_password.success_msg', lang));
    } catch (error) {
      if (error.code === 'account-email/invalid-email') {
        showFieldErrors({ email: t('auth.errors.invalid_email', lang) });
        return;
      }
      triggerHaptic("error");
      const isRateLimited = error.code === 'account-email/too-many-requests';
      if (isRateLimited) {
        setPasswordResetCooldown(60);
      }
      setFormError(t(isRateLimited ? 'auth.errors.too_many_requests' : 'auth.errors.reset_failed', lang));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuthError = (error) => {
    if (SOCIAL_AUTH_CANCEL_CODES.includes(error?.code)) return;
    setFormError(t(error?.code === 'auth/network-request-failed' ? 'auth.errors.network_failed' : 'common.action_failed', lang));
  };

  const handleCancelVerification = async () => {
    if (isLoading) return;
    setIsLoading(true);
    triggerHaptic("warning");
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      handleNavigate('welcome');
      setEmail('');
      setPassword('');
      setName('');
      setFormError('');
      setSuccessMessage('');
    } catch {
      setFormError(t('common.action_failed', lang));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || isLoading) {
      triggerHaptic("warning");
      return;
    }
    if (auth.currentUser) {
      setIsLoading(true);
      setFormError('');
      try {
        await requestEmailVerification({ user: auth.currentUser, lang });
        triggerHaptic("success");
        setResendCooldown(60);
      } catch (error) {
        triggerHaptic("error");
        if (error.code === 'account-email/too-many-requests') {
          setResendCooldown(60);
        }
        setFormError(t(error.code === 'account-email/too-many-requests'
          ? 'auth.errors.too_many_requests'
          : 'common.action_failed', lang));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const currentConfigs = getIconConfig(vw, vh)[currentView] || getIconConfig(vw, vh).welcome;
  const statusBar = <StatusBar style={isDark ? 'light' : 'dark'} />;
  const importNotice = pendingImport ? (
    <PendingImportNotice colors={colors} lang={lang} onBack={cancelImport} onSkip={skipImport} disabled={isLoading || entryBusy} />
  ) : null;

  const renderFormElements = () => {
    const elements = [];

    if (currentView === 'verify') {
      elements.push(
        <View key="loader" style={styles.verifyLoaderContainer}>
          <AuthMorphingLoader compact={false} />
        </View>
      );
      elements.push(
        <View key="verifyText" style={styles.verifyTextContainer}>
          <Text style={[styles.formTitle, { color: colors.textColor, textAlign: 'center', fontSize: 24 }]}>
            {t('auth.verify.title', lang)}
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.textColor2, textAlign: 'center', marginTop: 16, lineHeight: 24 }]}>
            {t('auth.verify.subtitle', lang, { email: email || auth.currentUser?.email || '' })}
          </Text>
          
          <View style={[styles.spamBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
            <WarningCircle size={24} color={isDark ? '#fbbf24' : '#d97706'} weight="fill" />
            <Text style={[styles.spamText, { color: isDark ? '#fbbf24' : '#d97706' }]}>
              {t('auth.verify.spam_warning', lang)}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.accentColor, marginTop: 40, opacity: resendCooldown > 0 ? 0.6 : 1 }]} 
            accessibilityRole="button"
            accessibilityLabel={t('auth.verify.resend_btn', lang)}
            accessibilityState={{ disabled: isLoading || resendCooldown > 0, busy: isLoading }}
            onPress={handleResendEmail}
            disabled={isLoading || resendCooldown > 0}
          >
            <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>
              {resendCooldown > 0 ? t('auth.verify.resend_wait', lang, { time: resendCooldown }) : t('auth.verify.resend_btn', lang)}
            </Text>
          </TouchableOpacity>
          {!!formError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{formError}</Text>}
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 10 }} 
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel', lang)}
            accessibilityState={{ disabled: isLoading }}
            disabled={isLoading}
            onPress={handleCancelVerification}
          >
            <Text style={{ color: colors.textColor2, fontSize: 16, fontWeight: '600' }}>
              {t('common.cancel', lang)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      elements.push(
        <View key="header" style={styles.formHeader}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.back', lang)}
            hitSlop={8}
            onPress={() => handleNavigate('welcome')}
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          >
            <ArrowLeft size={22} color={colors.textColor} weight="regular" />
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: colors.textColor }]}>
            {currentView === 'signin' ? t('auth.signin.title', lang) : t('auth.signup.title', lang)}
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.textColor2 }]}>
            {currentView === 'signin' ? t('auth.signin.subtitle', lang) : t('auth.signup.subtitle', lang)}
          </Text>
        </View>
      );

      if (importNotice) elements.push(<React.Fragment key="importNotice">{importNotice}</React.Fragment>);

      elements.push(
        <View key="inputs" style={styles.formGroup}>
          {currentView === 'signup' && (
            <InputField
              ref={fieldRefs.name}
              InputIcon={User}
              placeholder={t('auth.fields.name', lang)}
              value={name}
              onChangeText={handleTextChange('name', setName)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => fieldRefs.email.current?.focus()}
              error={fieldErrors.name}
              colors={colors}
              isDark={isDark}
            />
          )}
          <InputField
            ref={fieldRefs.email}
            InputIcon={EnvelopeSimple}
            placeholder={t('auth.fields.email', lang)}
            value={email}
            onChangeText={handleTextChange('email', setEmail)}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => fieldRefs.password.current?.focus()}
            error={fieldErrors.email}
            colors={colors}
            isDark={isDark}
          />
          <InputField
            ref={fieldRefs.password}
            InputIcon={LockKey}
            placeholder={t('auth.fields.password', lang)}
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={handleTextChange('password', setPassword)}
            isPasswordButton
            isPasswordVisible={isPasswordVisible}
            setIsPasswordVisible={setIsPasswordVisible}
            passwordToggleLabel={isPasswordVisible ? t('auth.fields.hide_password', lang) : t('auth.fields.show_password', lang)}
            passwordToggleHint={t('auth.fields.password_visibility_hint', lang)}
            autoComplete={currentView === 'signup' ? 'new-password' : 'current-password'}
            textContentType={currentView === 'signup' ? 'newPassword' : 'password'}
            maxLength={MAX_PASSWORD_LENGTH}
            returnKeyType="go"
            onSubmitEditing={currentView === 'signin' ? handleSignIn : handleSignUp}
            error={fieldErrors.password}
            hint={currentView === 'signup' ? getPasswordPolicyMessage(lang) : undefined}
            colors={colors}
            isDark={isDark}
          >
            {currentView === 'signup' && (
              <PasswordStrengthBar password={password} isDark={isDark} />
            )}
          </InputField>

          {currentView === 'signin' && (
            <TouchableOpacity
              style={styles.forgotPassword}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signin.forgot_password', lang)}
              accessibilityState={{ disabled: isLoading || passwordResetCooldown > 0 }}
              hitSlop={8}
              onPress={handleForgotPassword}
              disabled={isLoading || passwordResetCooldown > 0}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.accentTextColor, opacity: passwordResetCooldown > 0 ? 0.6 : 1 }]}>
                {passwordResetCooldown > 0
                  ? `${t('auth.signin.forgot_password', lang)} (${passwordResetCooldown})`
                  : t('auth.signin.forgot_password', lang)}
              </Text>
            </TouchableOpacity>
          )}

          <TermsCheckbox disabled={isLoading} acceptedTerms={acceptedTerms} onToggle={handleToggleTerms} error={fieldErrors.terms} colors={colors} lang={lang} onOpenDocument={openLegalDocument} />

          {formError ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={styles.errorBox}>
              <WarningCircle size={20} color="#ef4444" weight="fill" />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.successBox}>
              <CheckCircle size={20} color="#10b981" weight="fill" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}
        </View>
      );

      elements.push(
        <View key="loader" style={styles.buttonLoaderContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accentColor, opacity: isLoading || !acceptedTerms || (currentView === 'signup' && !isPasswordAllowed(password)) ? 0.6 : 1 }]}
            onPress={currentView === 'signin' ? handleSignIn : handleSignUp}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={currentView === 'signin' ? t('auth.signin.submit', lang) : t("auth.signup.title", lang)}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? <MorphingLoader size={24} /> : null}
            <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>
              {currentView === 'signin' ? t('auth.signin.submit', lang) : t("auth.signup.title", lang)}
            </Text>
          </TouchableOpacity>
        </View>
      );

      elements.push(
        <View key="social" style={styles.socialGroup}>
          <View style={{ opacity: acceptedTerms ? 1 : 0.6 }}>
            <SocialAuthButtons disabled={isLoading} onBeforeAuth={() => beforeAuth()} onAuthError={handleSocialAuthError} />
          </View>
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textColor2 }]}>
              {currentView === 'signin' ? t('auth.signin.no_account', lang) : t('auth.signup.already_have_account', lang)}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={currentView === 'signin' ? t('auth.signin.signup_link', lang) : t('auth.signin.submit', lang)} onPress={() => handleNavigate(currentView === 'signin' ? 'signup' : 'signin')}>
              <Text style={[styles.footerLink, { color: colors.accentTextColor }]}>
                {' '}{currentView === 'signin' ? t('auth.signin.signup_link', lang) : t("auth.signin.submit", lang)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return elements;
  };

  if (isLangLoading) {
    return (
      <View style={[styles.loadingWrapper, { backgroundColor: colors.backgroundColor }]}>
        {statusBar}
        <MorphingLoader size={70} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {statusBar}
      <KeyboardAvoidingView behavior="padding" enabled={Platform.OS === 'ios'} style={styles.container}>
        
        <AnimatedGradientBackground currentView={currentView} colors={colors} isDark={isDark} />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {currentConfigs.map((config) => (
            <AnimatedIconSlot key={config.id} targetConfig={config} isDark={isDark} />
          ))}
        </View>

        <View style={{ paddingTop: insets.top }}>
          <SignedOutHeader>
            {currentView !== 'welcome' && <PlanItWordmark fontSize={24} color={colors.textColor} isDark={isDark} />}
          </SignedOutHeader>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[
            styles.scrollContent, 
            { paddingBottom: insets.bottom + 20 },
            currentView === 'verify' && { flexGrow: 1, justifyContent: 'center' }
          ]} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.responsiveContainer}>
            {currentView === 'welcome' && (
              <WelcomeContent 
                onNavigate={handleNavigate} 
                colors={colors} 
                lang={lang} 
                onGuestLogin={enterGuest}
                busy={entryBusy}
                acceptedTerms={acceptedTerms}
                onToggleTerms={handleToggleTerms}
                onTermsMissing={handleTermsMissing}
                termsError={fieldErrors.terms}
                isDark={isDark}
                formError={formError}
                onOpenLegalDocument={openLegalDocument}
                notice={importNotice}
              />
            )}

            {currentView !== 'welcome' && (
              <View style={[
                styles.formBlock, 
                styles.glassCard,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.45)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                currentView === 'verify' ? styles.verifyFormBlock : styles.formBlockSpacing
              ]}>
                {renderFormElements()}
              </View>
            )}
          </View>
        </ScrollView>
        
        {currentView !== 'welcome' && currentView !== 'verify' && (
          <View 
            style={styles.edgeSwipeArea} 
            {...panResponder.panHandlers} 
          />
        )}

      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  edgeSwipeArea: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 45, zIndex: 9999, elevation: 9999 },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backgroundIconWrapper: { position: 'absolute', top: 0, left: 0 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  responsiveContainer: { width: '100%', maxWidth: 440, flex: 1, justifyContent: 'center' },
  contentBlock: { flex: 1, justifyContent: 'space-between', paddingBottom: 20 },
  formBlock: { width: '100%', paddingBottom: 24, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1 },
  glassCard: { padding: 20, borderRadius: 24, borderWidth: 1, backdropFilter: 'blur(20px)' },
  formBlockSpacing: { marginTop: 12 },
  verifyFormBlock: { width: '100%', justifyContent: 'center', paddingVertical: 40 },
  welcomeHeader: { alignItems: 'center', marginTop: '15%', marginBottom: '10%' },
  welcomeTitle: { marginBottom: 18 },
  welcomeSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, maxWidth: '85%', marginHorizontal: 'auto' },
  primaryButton: { width: '100%', height: 56, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondaryButton: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: 12 },
  secondaryButtonText: { fontSize: 17, fontWeight: '600' },
  guestButton: { alignItems: 'center', marginTop: 14 },
  guestButtonText: { fontSize: 15, fontWeight: '500' },
  formHeader: { marginTop: 10, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6, letterSpacing: 0 },
  formSubtitle: { fontSize: 15, lineHeight: 22 },
  formGroup: { gap: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 54 },
  inputIcon: { marginRight: 10 },
  // The container border already shows focus; drop the browser's inner outline.
  input: { flex: 1, height: '100%', fontSize: 16, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  eyeButton: { width: 48, height: 48, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  fieldError: { color: '#ef4444', fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 6, marginHorizontal: 4 },
  fieldHint: { fontSize: 13, lineHeight: 18, marginTop: 6, marginHorizontal: 4 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: -6 },
  forgotPasswordText: { fontSize: 14, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600' },
  authLoaderMotion: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  verifyLoaderContainer: { minHeight: 86, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginBottom: 24 },
  verifyTextContainer: { alignItems: 'center', width: '100%' },
  buttonLoaderContainer: { minHeight: 56, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 14 },
  socialGroup: { marginTop: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', gap: 10 },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '500', flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', gap: 10 },
  successText: { color: '#10b981', fontSize: 14, fontWeight: '500', flex: 1 },
  spamBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 20, gap: 12, width: '100%' },
  spamText: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  importNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  importNoticeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  importNoticeBody: { flex: 1, gap: 8 },
  importNoticeText: { fontSize: 14, lineHeight: 20 },
  // Always stacked: a row that wraps only in longer languages would change the card height on a language switch.
  importNoticeActions: { gap: 8 },
  importNoticeAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 24 },
  importNoticeActionText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  // Cyrillic text sits below its line-box center, so the glyph is nudged down to look centered.
  importNoticeActionIcon: { marginTop: 1 },
});

export default AuthScreen;
