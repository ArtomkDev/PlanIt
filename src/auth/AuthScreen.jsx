import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager,
  Animated, Easing, useWindowDimensions, BackHandler, PanResponder, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Planet, RocketLaunch, Compass, Fingerprint, IdentificationCard, ShieldCheck, 
  UserPlus, CalendarBlank, PencilSimple, EnvelopeOpen, PaperPlaneRight, CheckCircle,
  GraduationCap, Eye, EyeClosed, CheckSquare, Square, ArrowLeft, User, EnvelopeSimple, LockKey, WarningCircle
} from 'phosphor-react-native';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

import { auth } from '../config/firebase'; 
import SocialAuthButtons from './components/SocialAuthButtons';
import useSystemThemeColors from '../hooks/useSystemThemeColors';
import useAppLanguage from '../hooks/useAppLanguage';
import { t } from '../utils/i18n';
import MorphingLoader from '../components/ui/MorphingLoader';

if (
  Platform.OS === 'android' && 
  UIManager.setLayoutAnimationEnabledExperimental && 
  global._IS_FABRIC !== true
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const breathAnim = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(currentView === 'welcome' ? 1 : 0)).current;
  const signinOpacity = useRef(new Animated.Value(currentView === 'signin' ? 1 : 0)).current;
  const signupOpacity = useRef(new Animated.Value(currentView === 'signup' ? 1 : 0)).current;
  const verifyOpacity = useRef(new Animated.Value(currentView === 'verify' ? 1 : 0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(breathAnim, { toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(welcomeOpacity, { toValue: currentView === 'welcome' ? 1 : 0, duration: 600, useNativeDriver: true }),
      Animated.timing(signinOpacity, { toValue: currentView === 'signin' ? 1 : 0, duration: 600, useNativeDriver: true }),
      Animated.timing(signupOpacity, { toValue: currentView === 'signup' ? 1 : 0, duration: 600, useNativeDriver: true }),
      Animated.timing(verifyOpacity, { toValue: currentView === 'verify' ? 1 : 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [currentView]);

  const baseColor = colors.backgroundColor;
  
  const palettes = {
    welcome: { secondary: isDark ? '#2e1065' : '#e0e7ff', accent: isDark ? '#7c3aed' : '#4f46e5' },
    signin: { secondary: isDark ? '#020617' : '#e0f2fe', accent: isDark ? '#0369a1' : '#0284c7' },
    signup: { secondary: isDark ? '#022c22' : '#dcfce7', accent: isDark ? '#059669' : '#10b981' },
    verify: { secondary: isDark ? '#164e63' : '#cffafe', accent: isDark ? '#06b6d4' : '#0891b2' }
  };

  const renderLayer = (opacityAnim, palette) => (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]} pointerEvents="none">
      <LinearGradient colors={[baseColor, palette.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breathAnim }]}>
        <LinearGradient colors={['transparent', palette.accent]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.22 : 0.12 }]} />
      </Animated.View>
    </Animated.View>
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
  const animX = useRef(new Animated.Value(targetConfig.x)).current;
  const animY = useRef(new Animated.Value(targetConfig.y)).current;
  const animScale = useRef(new Animated.Value(targetConfig.scale)).current;
  const animRotate = useRef(new Animated.Value(targetConfig.rotate)).current;
  const animOpacity = useRef(new Animated.Value(targetConfig.opacity)).current;
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [ActiveIcon, setActiveIcon] = useState(() => targetConfig.IconComponent);

  useEffect(() => {
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
      Animated.timing(animRotate, { toValue: targetConfig.rotate, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: targetConfig.opacity, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [targetConfig]);

  const spin = animRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

  return (
    <Animated.View style={[styles.backgroundIconWrapper, { transform: [{ translateX: animX }, { translateY: animY }, { scale: animScale }, { rotate: spin }], opacity: animOpacity }]}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {ActiveIcon && <ActiveIcon size={280} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} weight="regular" />}
      </Animated.View>
    </Animated.View>
  );
};

const InputField = ({ InputIcon, placeholder, secureTextEntry, value, onChangeText, isPasswordButton, isPasswordVisible, setIsPasswordVisible, autoCapitalize="none", keyboardType="default", colors, isDark }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <View style={[
      styles.inputContainer, 
      { 
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', 
        borderColor: isFocused ? colors.accentColor : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
      }
    ]}>
      {InputIcon && <InputIcon size={20} color={isFocused ? colors.accentColor : colors.textColor2} style={styles.inputIcon} weight={isFocused ? "fill" : "regular"} />}
      <TextInput 
        style={[styles.input, { color: colors.textColor }]} 
        placeholder={placeholder} 
        placeholderTextColor={colors.textColor2} 
        secureTextEntry={secureTextEntry} 
        value={value} 
        onChangeText={onChangeText} 
        autoCapitalize={autoCapitalize} 
        keyboardType={keyboardType}
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
        <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
          {isPasswordVisible ? 
            <EyeClosed size={22} color={colors.textColor2} weight="regular" /> : 
            <Eye size={22} color={colors.textColor2} weight="regular" />
          }
        </TouchableOpacity>
      )}
    </View>
  );
};

const PasswordStrengthBar = ({ password, colors, isDark }) => {
  if (!password) return null;
  
  const getStrength = (pass) => {
    if (pass.length < 6) return { width: '30%', color: '#ef4444' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    if (hasLetters && hasNumbers && pass.length >= 8) {
      return { width: '100%', color: '#10b981' };
    }
    return { width: '65%', color: '#f59e0b' };
  };

  const strength = getStrength(password);

  return (
    <View style={[styles.strengthContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
      <View style={[styles.strengthBar, { width: strength.width, backgroundColor: strength.color }]} />
    </View>
  );
};

const TermsCheckbox = ({ acceptedTerms, setAcceptedTerms, colors, lang, setFormError }) => (
  <TouchableOpacity 
    style={styles.checkboxContainer} 
    onPress={() => {
      setAcceptedTerms(!acceptedTerms);
      setFormError('');
    }} 
    activeOpacity={0.7}
  >
    {acceptedTerms ? 
      <CheckSquare size={22} color={colors.accentColor} weight="fill" /> : 
      <Square size={22} color={colors.textColor2} weight="regular" />
    }
    <Text style={[styles.checkboxText, { color: colors.textColor2 }]}>
      {t('auth.terms.agree_prefix', lang)}
      <Text style={{ color: colors.accentColor }} onPress={() => Linking.openURL('https://planit-hub.web.app/privacy.html')}>
        {t('auth.terms.privacy_policy', lang)}
      </Text>
      {t('auth.terms.and', lang)}
      <Text style={{ color: colors.accentColor }} onPress={() => Linking.openURL('https://planit-hub.web.app/terms.html')}>
        {t('auth.terms.terms_conditions', lang)}
      </Text>
    </Text>
  </TouchableOpacity>
);

const WelcomeContent = ({ onNavigate, colors, lang, insets, onGuestLogin, acceptedTerms, setAcceptedTerms, isDark, setFormError, formError }) => {
  const checkTerms = (action) => {
    if (!acceptedTerms) {
      setFormError(t('auth.errors.accept_terms_strict', lang));
      return;
    }
    action();
  };

  return (
    <View style={[styles.contentBlock, { paddingTop: insets.top + 40 }]}>
      <View style={styles.welcomeHeader}>
        <View style={[styles.logoContainer, { backgroundColor: colors.accentColor }]}>
           <GraduationCap size={54} color="#fff" weight="fill" />
        </View>
        <Text style={[styles.welcomeTitle, { color: colors.textColor }]}>PlanIt</Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.textColor2 }]}>{t('auth.welcome.subtitle', lang)}</Text>
      </View>
      <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
        
        {formError ? (
          <View style={[styles.errorBox, { marginBottom: 16 }]}>
            <WarningCircle size={20} color="#ef4444" weight="fill" />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accentColor, opacity: acceptedTerms ? 1 : 0.6 }]} onPress={() => checkTerms(() => onNavigate('signin'))}>
          <Text style={styles.primaryButtonText}>{t('auth.signin.submit', lang)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderColor: colors.borderColor, opacity: acceptedTerms ? 1 : 0.6 }]} onPress={() => checkTerms(() => onNavigate('signup'))}>
          <Text style={[styles.secondaryButtonText, { color: colors.textColor }]}>{t('auth.signup.submit', lang)}</Text>
        </TouchableOpacity>
        {onGuestLogin && (
          <TouchableOpacity style={styles.guestButton} onPress={() => checkTerms(onGuestLogin)}>
            <Text style={[styles.guestButtonText, { color: acceptedTerms ? colors.textColor2 : colors.textColor2 + '80' }]}>{t('auth.welcome.guest_btn', lang)}</Text>
          </TouchableOpacity>
        )}
        <View style={{ marginTop: 12 }}>
          <TermsCheckbox acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} colors={colors} lang={lang} setFormError={setFormError} />
        </View>
      </View>
    </View>
  );
};

const AuthScreen = ({ onGuestLogin }) => {
  const insets = useSafeAreaInsets();
  const { width: vw, height: vh } = useWindowDimensions(); 
  const { lang, isLangLoading } = useAppLanguage();
  const { colors, isDark } = useSystemThemeColors('blue');
  
  const [currentView, setCurrentView] = useState(() => {
    if (auth.currentUser && !auth.currentUser.emailVerified) return 'verify';
    return 'welcome';
  }); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateEmail = (emailText) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText);
  };

  const handleTextChange = (setter) => (text) => {
    setter(text);
    if (formError || successMessage) {
      setFormError('');
      setSuccessMessage('');
    }
  };

  const handleNavigate = (view) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormError('');
    setSuccessMessage('');
    setCurrentView(view);
  };

  useEffect(() => {
    const backAction = () => {
      if (currentView === 'verify') return true;
      if (currentView !== 'welcome') {
        handleNavigate('welcome');
        return true; 
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentView]);

  useEffect(() => {
    let interval;
    if (currentView === 'verify') {
      interval = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            await auth.currentUser.getIdToken(true);
          }
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [currentView]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 45 || gestureState.vx > 0.5) {
          if (currentView !== 'verify') handleNavigate('welcome');
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        if (gestureState.dx > 45 || gestureState.vx > 0.5) {
          if (currentView !== 'verify') handleNavigate('welcome');
        }
      }
    })
  ).current;

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return setFormError(t('auth.errors.fill_fields', lang));
    if (!validateEmail(trimmedEmail)) return setFormError(t('auth.errors.invalid_email_format', lang));
    if (!acceptedTerms) return setFormError(t('auth.errors.accept_terms_strict', lang));
    
    setIsLoading(true);
    try { 
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password); 
      if (!cred.user.emailVerified) {
        handleNavigate('verify');
      }
    } catch (error) { 
      let msg = t('auth.errors.wrong_credentials', lang);
      if (error.code === 'auth/user-not-found') msg = t('auth.errors.user_not_found', lang);
      if (error.code === 'auth/wrong-password') msg = t('auth.errors.wrong_password', lang);
      if (error.code === 'auth/invalid-credential') msg = t('auth.errors.invalid_credential', lang);
      if (error.code === 'auth/too-many-requests') msg = t('auth.errors.too_many_requests', lang);
      setFormError(msg);
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    
    if (!trimmedName || !trimmedEmail || !password) return setFormError(t('auth.errors.fill_fields', lang));
    if (!validateEmail(trimmedEmail)) return setFormError(t('auth.errors.invalid_email_format', lang));
    if (password.length < 6) return setFormError(t('auth.errors.password_too_short', lang));
    if (!acceptedTerms) return setFormError(t('auth.errors.accept_terms', lang));
    
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(cred.user, { displayName: trimmedName });
      await sendEmailVerification(cred.user);
      handleNavigate('verify');
    } catch (error) { 
      let msg = t('auth.errors.signup_failed', lang);
      if (error.code === 'auth/email-already-in-use') msg = t('auth.errors.email_in_use', lang);
      if (error.code === 'auth/invalid-email') msg = t('auth.errors.invalid_email', lang);
      if (error.code === 'auth/weak-password') msg = t('auth.errors.weak_password', lang);
      setFormError(msg);
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setFormError(t('auth.forgot_password.req_email', lang));
    if (!validateEmail(trimmedEmail)) return setFormError(t('auth.errors.invalid_email_format', lang));
    
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccessMessage(t('auth.forgot_password.success_msg', lang));
    } catch (error) {
      let msg = t('auth.errors.reset_failed', lang);
      if (error.code === 'auth/invalid-email') msg = t('auth.errors.invalid_email', lang);
      if (error.code === 'auth/user-not-found') msg = t('auth.errors.user_not_found', lang);
      setFormError(msg);
    }
  };

  const handleCancelVerification = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (error) {
      console.error(error);
    } finally {
      handleNavigate('welcome');
      setEmail('');
      setPassword('');
      setName('');
      setFormError('');
      setSuccessMessage('');
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setResendCooldown(60);
      } catch (error) {
        if (error.code === 'auth/too-many-requests') {
          setResendCooldown(60);
        }
      }
    }
  };

  const currentConfigs = getIconConfig(vw, vh)[currentView] || getIconConfig(vw, vh).welcome;

  const renderFormElements = () => {
    const elements = [];

    if (currentView === 'verify') {
      elements.push(
        <View key="loader" style={styles.verifyLoaderContainer}>
          <MorphingLoader size={70} />
        </View>
      );
      elements.push(
        <View key="verifyText" style={styles.verifyTextContainer}>
          <Text style={[styles.formTitle, { color: colors.textColor, textAlign: 'center', fontSize: 24 }]}>
            {t('auth.verify.title', lang)}
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.textColor2, textAlign: 'center', marginTop: 16, lineHeight: 24 }]}>
            {t('auth.verify.subtitle', lang).replace('{email}', email || auth.currentUser?.email || '')}
          </Text>
          
          <View style={[styles.spamBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
            <WarningCircle size={24} color={isDark ? '#fbbf24' : '#d97706'} weight="fill" />
            <Text style={[styles.spamText, { color: isDark ? '#fbbf24' : '#d97706' }]}>
              {t('auth.verify.spam_warning', lang)}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.accentColor, marginTop: 40, opacity: resendCooldown > 0 ? 0.6 : 1 }]} 
            onPress={handleResendEmail}
            disabled={resendCooldown > 0}
          >
            <Text style={styles.primaryButtonText}>
              {resendCooldown > 0 ? t('auth.verify.resend_wait', lang).replace('{time}', resendCooldown) : t('auth.verify.resend_btn', lang)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 10 }} 
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
          <TouchableOpacity onPress={() => handleNavigate('welcome')} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
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

      elements.push(
        <View key="inputs" style={styles.formGroup}>
          
          {formError ? (
            <View style={styles.errorBox}>
              <WarningCircle size={20} color="#ef4444" weight="fill" />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBox}>
              <CheckCircle size={20} color="#10b981" weight="fill" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {currentView === 'signup' && (
            <InputField InputIcon={User} placeholder={t('auth.fields.name', lang)} value={name} onChangeText={handleTextChange(setName)} autoCapitalize="words" colors={colors} isDark={isDark} />
          )}
          <InputField InputIcon={EnvelopeSimple} placeholder={t('auth.fields.email', lang)} value={email} onChangeText={handleTextChange(setEmail)} keyboardType="email-address" colors={colors} isDark={isDark} />
          <View>
            <InputField 
              InputIcon={LockKey} 
              placeholder={t('auth.fields.password', lang)} 
              secureTextEntry={!isPasswordVisible} 
              value={password} 
              onChangeText={handleTextChange(setPassword)} 
              isPasswordButton 
              isPasswordVisible={isPasswordVisible} 
              setIsPasswordVisible={setIsPasswordVisible} 
              colors={colors} 
              isDark={isDark} 
            />
            {currentView === 'signup' && (
              <PasswordStrengthBar password={password} colors={colors} isDark={isDark} />
            )}
          </View>
          
          <TermsCheckbox acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} colors={colors} lang={lang} setFormError={setFormError} />
          
          {currentView === 'signin' && (
            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.accentColor }]}>{t('auth.signin.forgot_password', lang)}</Text>
            </TouchableOpacity>
          )}
        </View>
      );

      elements.push(
        <View key="loader" style={[styles.buttonLoaderContainer, !isLoading && { alignItems: 'stretch' }]}>
          {isLoading ? (
            <MorphingLoader size={40} />
          ) : (
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: colors.accentColor, opacity: !acceptedTerms || (currentView === 'signup' && password.length < 6) ? 0.6 : 1 }]} 
              onPress={currentView === 'signin' ? handleSignIn : handleSignUp}
            >
              <Text style={styles.primaryButtonText}>
                {currentView === 'signin' ? t('auth.signin.submit', lang) : t('auth.signup.submit', lang)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );

      elements.push(
        <View key="social" style={styles.socialGroup}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => { if (!acceptedTerms) setFormError(t('auth.errors.accept_terms_strict', lang)); }}
          >
            <View pointerEvents={acceptedTerms ? 'auto' : 'none'} style={{ opacity: acceptedTerms ? 1 : 0.6 }}>
              <SocialAuthButtons onAuthError={(err) => setFormError(err.message)} />
            </View>
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textColor2 }]}>
              {currentView === 'signin' ? t('auth.signin.no_account', lang) : t('auth.signup.already_have_account', lang)}
            </Text>
            <TouchableOpacity onPress={() => handleNavigate(currentView === 'signin' ? 'signup' : 'signin')}>
              <Text style={[styles.footerLink, { color: colors.accentColor }]}>
                {' '}{currentView === 'signin' ? t('auth.signin.signup_link', lang) : t('auth.signup.login_link', lang)}
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
        <MorphingLoader size={70} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior="padding" enabled={Platform.OS === 'ios'} style={styles.container}>
        
        <AnimatedGradientBackground currentView={currentView} colors={colors} isDark={isDark} />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {currentConfigs.map((config) => (
            <AnimatedIconSlot key={config.id} targetConfig={config} isDark={isDark} />
          ))}
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
                insets={insets} 
                onGuestLogin={onGuestLogin} 
                acceptedTerms={acceptedTerms} 
                setAcceptedTerms={setAcceptedTerms} 
                isDark={isDark} 
                setFormError={setFormError} 
                formError={formError}
              />
            )}

            {currentView !== 'welcome' && (
              <View style={[
                styles.formBlock, 
                styles.glassCard,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.45)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                currentView === 'verify' ? styles.verifyFormBlock : { marginTop: insets.top + 24 }
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
  verifyFormBlock: { width: '100%', justifyContent: 'center', paddingVertical: 40 },
  welcomeHeader: { alignItems: 'center', marginTop: '15%', marginBottom: '10%' },
  logoContainer: { width: 84, height: 84, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  welcomeTitle: { fontSize: 38, fontWeight: '800', marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  welcomeSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, maxWidth: '85%', marginHorizontal: 'auto' },
  primaryButton: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondaryButton: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: 12 },
  secondaryButtonText: { fontSize: 17, fontWeight: '600' },
  guestButton: { alignItems: 'center', marginTop: 14 },
  guestButtonText: { fontSize: 15, fontWeight: '500' },
  formHeader: { marginTop: 10, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  formSubtitle: { fontSize: 15, lineHeight: 22 },
  formGroup: { gap: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 54 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 16 },
  eyeButton: { padding: 8, marginRight: -6 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 },
  forgotPasswordText: { fontSize: 14, fontWeight: '500' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, marginVertical: 2 },
  checkboxText: { marginLeft: 10, fontSize: 13, lineHeight: 18, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600' },
  verifyLoaderContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  verifyTextContainer: { alignItems: 'center', width: '100%' },
  buttonLoaderContainer: { height: 54, justifyContent: 'center', marginTop: 14 },
  socialGroup: { marginTop: 14 },
  strengthContainer: { width: '100%', height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  strengthBar: { height: '100%', borderRadius: 2 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', gap: 10 },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '500', flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', gap: 10 },
  successText: { color: '#10b981', fontSize: 14, fontWeight: '500', flex: 1 },
  spamBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 20, gap: 12, width: '100%' },
  spamText: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
});

export default AuthScreen;