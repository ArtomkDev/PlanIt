// src/components/AuthLayout.jsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useSystemThemeColors from '../hooks/useSystemThemeColors';

const AuthLayout = ({ 
  children, 
  title, 
  subtitle, 
  onBack, 
  showBackButton = false,
  showBackgroundIcon = true
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useSystemThemeColors();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Декоративний фон */}
      {showBackgroundIcon && (
        <View style={styles.backgroundIcon}>
          <Ionicons 
            name="calendar" 
            size={300} 
            color={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} 
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Кнопка Назад */}
        {showBackButton && onBack && (
          <TouchableOpacity 
            onPress={onBack} 
            style={[styles.backButton, { backgroundColor: colors.backgroundColor2 }]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textColor} />
          </TouchableOpacity>
        )}

        {/* Заголовки */}
        <View style={styles.header}>
          {title && (
            <Text style={[styles.title, { color: colors.textColor }]}>{title}</Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textColor2 }]}>{subtitle}</Text>
          )}
        </View>

        {/* Контент */}
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundIcon: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    transform: [{ rotate: '-20deg' }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
});

export default AuthLayout;