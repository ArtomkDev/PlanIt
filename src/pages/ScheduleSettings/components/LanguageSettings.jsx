import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, FlatList, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import SettingsScreenLayout from "../SettingsScreenLayout";
import { t, SUPPORTED_LANGUAGES } from "../../../utils/i18n";

const LanguageSettings = () => {
  const { global, setGlobalDraft } = useSchedule();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const currentAppLang = global?.language || 'uk';

  const handleSelect = (code) => {
    setGlobalDraft(prev => ({ ...prev, language: code }));
  };

  const renderItem = ({ item }) => {
    const isSelected = currentAppLang === item.code;
    const translatedName = t(`languages.${item.code}`, currentAppLang);

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
          <Text style={styles.flag}>{item.flag}</Text>
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
  textContainer: { justifyContent: 'center' },
  flag: { fontSize: 28 },
  nativeLabel: { fontSize: 17, fontWeight: '600' },
  translatedLabel: { fontSize: 13, marginTop: 2 },
});

export default LanguageSettings;