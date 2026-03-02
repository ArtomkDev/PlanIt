import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, useColorScheme, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from "@expo/vector-icons"; 

export default function MobileWebWarning({ onIgnore }) {
  const systemTheme = useColorScheme(); 
  const isDark = systemTheme === 'dark';

  // 🎨 Оновлена палітра (Clean & Modern)
  const colors = {
    background: isDark ? '#000000' : '#FFFFFF', 
    textPrimary: isDark ? '#FFFFFF' : '#111827', // Майже чорний для контрасту
    textSecondary: isDark ? '#A1A1AA' : '#6B7280', // Сірий
    
    // Акцентний колір (синій)
    primary: '#2563EB', 
    primaryText: '#FFFFFF',
    
    // Вторинний (сірий фон кнопки)
    secondaryBg: isDark ? '#27272A' : '#F3F4F6',
    secondaryText: isDark ? '#E5E7EB' : '#374151',
    
    // Іконка
    iconBg: isDark ? '#18181B' : '#EFF6FF', // Дуже світлий синій для світлої теми
    iconMain: '#3B82F6',
    warningBadgeBg: isDark ? '#000000' : '#FFFFFF',
    warningIcon: '#F59E0B'
  };

  const handleDownload = () => {
    const APP_LINK = "https://artemkoval1.github.io/15/#download"; 
    Linking.openURL(APP_LINK);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {Platform.OS === 'web' && <style type="text/css">{`body { background-color: ${colors.background}; }`}</style>}

      <View style={styles.content}>
        
        {/* Верхня частина: Іконка */}
        <View style={styles.headerArea}>
           <View style={[styles.iconCircle, { backgroundColor: colors.iconBg }]}>
              {/* Основна іконка - Телефон */}
              <Ionicons name="phone-portrait-outline" size={72} color={colors.iconMain} />
              
              {/* Бейджик з попередженням */}
              <View style={[styles.warningBadge, { backgroundColor: colors.warningBadgeBg }]}>
                 <Ionicons name="warning" size={32} color={colors.warningIcon} />
              </View>
           </View>
        </View>

        {/* Середня частина: Текст */}
        <View style={styles.textArea}>
           <Text style={[styles.title, { color: colors.textPrimary }]}>
             Мобільний браузер
           </Text>
           <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
             Веб-версія PlanIt не адаптована для смартфонів і може працювати некоректно.
             {"\n\n"}
             Для найкращого досвіду завантажте наш додаток.
           </Text>
        </View>

        {/* Нижня частина: Кнопки */}
        <View style={styles.actionArea}>
           {/* Кнопка завантаження */}
           <TouchableOpacity 
             style={[styles.buttonPrimary, { backgroundColor: colors.primary }]} 
             onPress={handleDownload}
             activeOpacity={0.85}
           >
              {/* 👇 Хмаринка зі стрілочкою */}
              <Ionicons name="cloud-download-outline" size={26} color={colors.primaryText} style={{ marginRight: 12 }} />
              <Text style={[styles.buttonTextPrimary, { color: colors.primaryText }]}>
                Завантажити додаток
              </Text>
           </TouchableOpacity>

           {/* Кнопка ігнорування */}
           <TouchableOpacity 
             style={[styles.buttonSecondary, { backgroundColor: colors.secondaryBg }]} 
             onPress={onIgnore}
             activeOpacity={0.7}
           >
              <Text style={[styles.buttonTextSecondary, { color: colors.secondaryText }]}>
                Продовжити в браузері
              </Text>
           </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32, // Більше відступів з боків
    justifyContent: 'space-between', 
    paddingVertical: 40,
    maxWidth: 600, // Обмеження ширини для планшетів
    alignSelf: 'center', // Центрування на широких екранах
    width: '100%',
  },
  headerArea: {
    alignItems: 'center',
    flex: 2, // Займає більше місця зверху
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    marginBottom: 48,
    flex: 1,
  },
  actionArea: {
    width: '100%',
    gap: 16, 
  },
  
  // Icon
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  warningBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  // Typography
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: '400',
  },

  // Buttons
  buttonPrimary: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12, 
    // Тінь тільки для основної кнопки
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonSecondary: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTextPrimary: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '500',
  }
});