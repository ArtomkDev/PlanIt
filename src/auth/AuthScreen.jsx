import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager,
  Animated, Easing, useWindowDimensions, BackHandler, PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

import { auth } from '../../firebase'; 
import SocialAuthButtons from './components/SocialAuthButtons';
import useSystemThemeColors from '../hooks/useSystemThemeColors';
import useAppLanguage from '../hooks/useAppLanguage';
import { t } from '../utils/i18n';
import MorphingLoader from '../components/ui/MorphingLoader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getIconConfig = (vw, vh) => {
  const cx = (pct) => vw * pct - 140; 
  const cy = (pct) => vh * pct - 140;

  return {
    welcome: [
      { id: 0, icon: 'planet', x: cx(0.1), y: cy(0.15), scale: 1.1, rotate: -15, opacity: 0.05 },
      { id: 1, icon: 'rocket', x: cx(0.85), y: cy(0.85), scale: 0.9, rotate: 45, opacity: 0.06 },
      { id: 2, icon: 'compass', x: cx(0.8), y: cy(0.2), scale: 0.7, rotate: 10, opacity: 0.04 },
    ],
    signin: [
      { id: 0, icon: 'finger-print', x: cx(0.85), y: cy(0.15), scale: 1.2, rotate: 0, opacity: 0.05 },
      { id: 1, icon: 'id-card', x: cx(0.15), y: cy(0.8), scale: 0.85, rotate: -20, opacity: 0.04 },
      { id: 2, icon: 'shield-checkmark', x: cx(0.7), y: cy(0.85), scale: 0.75, rotate: 15, opacity: 0.06 },
    ],
    signup: [
      { id: 0, icon: 'person-add', x: cx(0.25), y: cy(0.15), scale: 1.1, rotate: 15, opacity: 0.06 },
      { id: 1, icon: 'calendar-clear', x: cx(0.85), y: cy(0.5), scale: 0.9, rotate: -15, opacity: 0.05 },
      { id: 2, icon: 'pencil', x: cx(0.15), y: cy(0.85), scale: 0.85, rotate: 35, opacity: 0.04 },
    ],
    verify: [
      { id: 0, icon: 'mail-unread', x: cx(0.15), y: cy(0.15), scale: 1.15, rotate: -15, opacity: 0.06 },
      { id: 1, icon: 'paper-plane', x: cx(0.85), y: cy(0.25), scale: 0.9, rotate: 25, opacity: 0.05 },
      { id: 2, icon: 'checkmark-circle', x: cx(0.5), y: cy(0.85), scale: 0.95, rotate: 10, opacity: 0.04 },
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
      Animated.timing(welcomeOpacity, { toValue: currentView === 'welcome' ? 1 : 0, duration: 800, useNativeDriver: true }),
      Animated.timing(signinOpacity, { toValue: currentView === 'signin' ? 1 : 0, duration: 800, useNativeDriver: true }),
      Animated.timing(signupOpacity, { toValue: currentView === 'signup' ? 1 : 0, duration: 800, useNativeDriver: true }),
      Animated.timing(verifyOpacity, { toValue: currentView === 'verify' ? 1 : 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [currentView]);

  const baseColor = colors.backgroundColor;
  
  const palettes = {
    welcome: { secondary: isDark ? '#4c1d95' : '#e0e7ff', accent: isDark ? '#8b5cf6' : '#6366f1' },
    signin: { secondary: isDark ? '#0f172a' : '#e0f2fe', accent: isDark ? '#0284c7' : '#0369a1' },
    signup: { secondary: isDark ? '#064e3b' : '#dcfce7', accent: isDark ? '#10b981' : '#16a34a' },
    verify: { secondary: isDark ? '#7c2d12' : '#ffedd5', accent: isDark ? '#ea580c' : '#f97316' }
  };

  const renderLayer = (opacityAnim, palette) => (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]} pointerEvents="none">
      <LinearGradient colors={[baseColor, palette.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breathAnim }]}>
        <LinearGradient colors={['transparent', palette.accent]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.25 : 0.15 }]} />
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
  const [iconName, setIconName] = useState(targetConfig.icon);

  useEffect(() => {
    if (iconName !== targetConfig.icon) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setIconName(targetConfig.icon);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }

    Animated.parallel([
      Animated.spring(animX, { toValue: targetConfig.x, friction: 7, tension: 30, useNativeDriver: true }),
      Animated.spring(animY, { toValue: targetConfig.y, friction: 7, tension: 30, useNativeDriver: true }),
      Animated.spring(animScale, { toValue: targetConfig.scale, friction: 7, tension: 40, useNativeDriver: true }),
      Animated.timing(animRotate, { toValue: targetConfig.rotate, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: targetConfig.opacity, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [targetConfig]);

  const spin = animRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

  return (
    <Animated.View style={[styles.backgroundIconWrapper, { transform: [{ translateX: animX }, { translateY: animY }, { scale: animScale }, { rotate: spin }], opacity: animOpacity }]}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Ionicons name={`${iconName}-outline`} size={280} color={isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)'} />
      </Animated.View>
    </Animated.View>
  );
};

const InputField = ({ icon, placeholder, secureTextEntry, value, onChangeText, isPasswordButton, isPasswordVisible, setIsPasswordVisible, autoCapitalize="none", keyboardType="default", colors }) => (
  <View style={[styles.inputContainer, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
    <Ionicons name={icon} size={20} color={colors.textColor2} style={styles.inputIcon} />
    <TextInput style={[styles.input, { color: colors.textColor }]} placeholder={placeholder} placeholderTextColor={colors.textColor2} secureTextEntry={secureTextEntry} value={value} onChangeText={onChangeText} autoCapitalize={autoCapitalize} keyboardType={keyboardType} />
    {isPasswordButton && (
      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
        <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textColor2} />
      </TouchableOpacity>
    )}
  </View>
);

const WelcomeContent = ({ onNavigate, colors, lang, insets, onGuestLogin }) => (
  <View style={[styles.contentBlock, { paddingTop: insets.top + 40 }]}>
    <View style={styles.welcomeHeader}>
      <View style={[styles.logoContainer, { backgroundColor: colors.accentColor }]}>
         <Ionicons name="school" size={60} color="#fff" />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.textColor }]}>PlanIt</Text>
      <Text style={[styles.welcomeSubtitle, { color: colors.textColor2 }]}>{t('auth.welcome.subtitle', lang)}</Text>
    </View>
    <View style={styles.actions}>
      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accentColor }]} onPress={() => onNavigate('signin')}>
        <Text style={styles.primaryButtonText}>{t('auth.signin.submit', lang)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]} onPress={() => onNavigate('signup')}>
        <Text style={[styles.secondaryButtonText, { color: colors.textColor }]}>{t('auth.signup.submit', lang)}</Text>
      </TouchableOpacity>
      {onGuestLogin && (
        <TouchableOpacity style={styles.guestButton} onPress={onGuestLogin}>
          <Text style={[styles.guestButtonText, { color: colors.textColor2 }]}>{t('auth.welcome.guest_btn', lang)}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

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
  
  const handleNavigate = (view) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
      }, 3000);
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
        if (gestureState.dx > 40 || gestureState.vx > 0.5) {
          if (currentView !== 'verify') handleNavigate('welcome');
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        if (gestureState.dx > 40 || gestureState.vx > 0.5) {
          if (currentView !== 'verify') handleNavigate('welcome');
        }
      }
    })
  ).current;

  const handleSignIn = async () => {
    if (!email || !password) return Alert.alert(t('common.error', lang), t('auth.errors.fill_fields', lang));
    setIsLoading(true);
    try { 
      const cred = await signInWithEmailAndPassword(auth, email, password); 
      if (!cred.user.emailVerified) {
        handleNavigate('verify');
      }
    } 
    catch (error) { 
      Alert.alert(t('auth.errors.signin_failed', lang), t('auth.errors.wrong_credentials', lang)); 
    } 
    finally { 
      setIsLoading(false); 
    }
  };

  const handleSignUp = async () => {
    if (!name || !email || !password) return Alert.alert(t('common.error', lang), t('auth.errors.fill_fields', lang));
    if (!acceptedTerms) return Alert.alert(t('common.error', lang), t('auth.errors.accept_terms', lang));
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
      handleNavigate('verify');
    } catch (error) { 
      Alert.alert(t('common.error', lang), error.message || t('auth.errors.signup_failed', lang)); 
    } 
    finally { 
      setIsLoading(false); 
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return Alert.alert(t('common.error', lang), t('auth.forgot_password.req_email', lang));
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(t('common.success', lang), t('auth.forgot_password.success_msg', lang));
    } catch (error) {
      if (error.code === 'auth/invalid-email') {
        Alert.alert(t('common.error', lang), t('auth.forgot_password.invalid_email', lang));
      } else {
        Alert.alert(t('common.error', lang), error.message);
      }
    }
  };

  const handleCancelVerification = async () => {
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error(error);
      }
    }
    handleNavigate('welcome');
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
          <TouchableOpacity onPress={() => handleNavigate('welcome')} style={[styles.backBtn, { backgroundColor: colors.backgroundColor2 }]}>
            <Ionicons name="arrow-back" size={24} color={colors.textColor} />
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
          {currentView === 'signup' && (
            <InputField icon="person-outline" placeholder={t('auth.fields.name', lang)} value={name} onChangeText={setName} autoCapitalize="words" colors={colors} />
          )}
          <InputField icon="mail-outline" placeholder={t('auth.fields.email', lang)} value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />
          <InputField icon="lock-closed-outline" placeholder={t('auth.fields.password', lang)} secureTextEntry={!isPasswordVisible} value={password} onChangeText={setPassword} isPasswordButton isPasswordVisible={isPasswordVisible} setIsPasswordVisible={setIsPasswordVisible} colors={colors} />
          
          {currentView === 'signin' ? (
            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.accentColor }]}>{t('auth.signin.forgot_password', lang)}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAcceptedTerms(!acceptedTerms)} activeOpacity={0.7}>
              <Ionicons name={acceptedTerms ? "checkbox" : "square-outline"} size={24} color={acceptedTerms ? colors.accentColor : colors.textColor2} />
              <Text style={[styles.checkboxText, { color: colors.textColor2 }]}>
                {t('auth.signup.accept_terms_prefix', lang)}
                <Text style={{ color: colors.accentColor }}>{t('auth.signup.accept_terms_link', lang)}</Text>
              </Text>
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
              style={[styles.primaryButton, { backgroundColor: colors.accentColor, opacity: (currentView === 'signup' && !acceptedTerms) ? 0.6 : 1 }]} 
              onPress={currentView === 'signin' ? handleSignIn : handleSignUp} 
              disabled={currentView === 'signup' && !acceptedTerms}
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
          <SocialAuthButtons onAuthError={(err) => Alert.alert(t('common.error', lang), err.message)} />
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        
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
            {currentView === 'welcome' && <WelcomeContent onNavigate={handleNavigate} colors={colors} lang={lang} insets={insets} onGuestLogin={onGuestLogin} />}
            
            {currentView !== 'welcome' && (
              <View style={[
                styles.formBlock, 
                currentView === 'verify' ? styles.verifyFormBlock : { paddingTop: insets.top + 40 }
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
  edgeSwipeArea: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 40, zIndex: 9999, elevation: 9999 },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backgroundIconWrapper: { position: 'absolute', top: 0, left: 0 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  responsiveContainer: { width: '100%', maxWidth: 440, flex: 1 },
  contentBlock: { flex: 1, justifyContent: 'space-between', paddingBottom: 20 },
  formBlock: { flex: 1, width: '100%', paddingBottom: 20 },
  verifyFormBlock: { flex: 1, width: '100%', justifyContent: 'center', paddingBottom: 40 },
  welcomeHeader: { alignItems: 'center', marginTop: '10%' },
  logoContainer: { width: 90, height: 90, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 8, ...Platform.select({ web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 } }) },
  welcomeTitle: { fontSize: 36, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  welcomeSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, maxWidth: '85%' },
  actions: { width: '100%', gap: 14, marginTop: 40 },
  primaryButton: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondaryButton: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  secondaryButtonText: { fontSize: 18, fontWeight: '600' },
  guestButton: { alignItems: 'center', marginTop: 10 },
  guestButtonText: { fontSize: 16, fontWeight: '500' },
  formHeader: { marginBottom: 30 },
  backBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  formTitle: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  formSubtitle: { fontSize: 16, lineHeight: 24 },
  formGroup: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16 },
  eyeButton: { padding: 10, marginRight: -10 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 10 },
  forgotPasswordText: { fontSize: 14, fontWeight: '500' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', paddingRight: 20, marginVertical: 4 },
  checkboxText: { marginLeft: 10, fontSize: 14, lineHeight: 20, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '600' },
  verifyLoaderContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  verifyTextContainer: { alignItems: 'center' },
  buttonLoaderContainer: { height: 56, justifyContent: 'center', marginTop: 16 },
  socialGroup: { marginTop: 16 }
});

export default AuthScreen;