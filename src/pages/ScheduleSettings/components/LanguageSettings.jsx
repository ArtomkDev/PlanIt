import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, FlatList, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import SettingsScreenLayout from "../SettingsScreenLayout";
import { t, SUPPORTED_LANGUAGES } from "../../../utils/i18n";

const LanguageSettings = () => {
  const { global, setGlobalDraft, saveNow, isDirty } = useSchedule();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const currentAppLang = global?.language || 'uk';

  const isFirstMount = useRef(true);

  const handleSelect = (code) => {
    if (code !== currentAppLang) {
      setGlobalDraft(prev => ({ ...prev, language: code }));
    }
  };

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (isDirty) {
      saveNow();
    }
  }, [currentAppLang, isDirty, saveNow]);

  const renderItem = ({ item }) => {
    const isSelected = currentAppLang === item.code;
    const translatedName = t(`languages.${item.code}`, currentAppLang);

    const renderFlagIcon = () => {
      if (Platform.OS === 'web') {
        return (
          <View style={[styles.webFlagCircle, { backgroundColor: isSelected ? themeColors.accentColor : themeColors.borderColor }]}>
             <Text style={[styles.webFlagText, { color: isSelected ? '#fff' : themeColors.textColor }]}>
               {item.code.toUpperCase()}
             </Text>
          </View>
        );
      }
      return <Text style={styles.flag}>{item.flag}</Text>;
    };

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { 
            backgroundColor: themeColors.backgroundColor2,
            borderColor: isSelected ? themeColors.accentColor : 'transparent',
            borderWidth: 2 
          }
        ]}
        onPress={() => handleSelect(item.code)}
        activeOpacity={0.7}
      >
        <View style={styles.leftSection}>
          <View style={styles.flagContainer}>
             {renderFlagIcon()}
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.nativeLabel, { color: themeColors.textColor }]}>
              {item.label}
            </Text>
            <Text style={[styles.translatedLabel, { color: themeColors.textColor2 }]}>
              {translatedName}
            </Text>
          </View>
        </View>

        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={themeColors.accentColor} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          {t('settings.language_screen.subtitle', currentAppLang)}
        </Text>
        <Text style={[styles.desc, { color: themeColors.textColor2 }]}>
          {t('settings.language_screen.desc', currentAppLang)}
        </Text>

        <FlatList
          data={SUPPORTED_LANGUAGES}
          renderItem={renderItem}
          keyExtractor={item => item.code}
          contentContainerStyle={styles.listGap}
          scrollEnabled={false}
        />
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  desc: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  listGap: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' },
      default: { elevation: 1 }
    })
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  flagContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flag: { 
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 34,
  },
  webFlagCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFlagText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textContainer: { justifyContent: 'center' },
  nativeLabel: { fontSize: 17, fontWeight: '600' },
  translatedLabel: { fontSize: 13, marginTop: 2 },
});

export default LanguageSettings;