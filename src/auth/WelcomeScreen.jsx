import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useSystemThemeColors from '../hooks/useSystemThemeColors';

const WelcomeScreen = ({ navigation, onGuestLogin }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useSystemThemeColors('blue'); 

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
       {/* Фон */}
       <View style={styles.backgroundIcon}>
        <Ionicons 
          name="calendar-outline" 
          size={400} 
          color={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'} 
        />
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        
        {/* Логотип */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.accentColor }]}>
             <Ionicons name="school" size={60} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.textColor }]}>PlanIt</Text>
          <Text style={[styles.subtitle, { color: colors.textColor2 }]}>
            Ваш ідеальний розклад занять завжди під рукою.
          </Text>
        </View>

        {/* Кнопки */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accentColor }]}
            onPress={() => navigation.navigate('SignIn')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Увійти</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}
            onPress={() => navigation.navigate('SignUp')} 
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textColor }]}>Створити акаунт</Text>
          </TouchableOpacity>

          {/* 🔥 КНОПКА ГОСТЯ ТЕПЕР НОРМАЛЬНА */}
          <TouchableOpacity 
            style={[styles.secondaryButton, { backgroundColor: 'transparent', borderColor: colors.borderColor, marginTop: 0 }]} 
            onPress={onGuestLogin}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textColor2, fontSize: 16 }]}>
              Продовжити як гість
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  backgroundIcon: {
    position: 'absolute',
    top: '10%',
    left: -100,
    transform: [{ rotate: '15deg' }],
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: '15%',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  actions: {
    width: '100%',
    gap: 15,
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default WelcomeScreen;