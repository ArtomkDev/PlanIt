import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Platform } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";
import themes from "../../../../config/themes";
import SettingsScreenLayout from "../../../../layouts/SettingsScreenLayout";
import { t, SUPPORTED_LANGUAGES } from "../../../../utils/i18n";

import SettingsSelectionRow from "../../../../components/ui/SettingsKit/SettingsSelectionRow";

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

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          {t('settings.language_screen.subtitle', currentAppLang)}
        </Text>
        <Text style={[styles.desc, { color: themeColors.textColor2 }]}>
          {t('settings.language_screen.desc', currentAppLang)}
        </Text>

        <View style={styles.listContent}>
          {SUPPORTED_LANGUAGES.map((item) => {
            const isSelected = currentAppLang === item.code;
            const translatedName = t(`languages.${item.code}`, currentAppLang);

            return (
              <View key={item.code} style={{ marginBottom: 12 }}>
                <SettingsSelectionRow
                  label={item.label}
                  hint={translatedName}
                  isSelected={isSelected}
                  themeColors={themeColors}
                  onPress={() => handleSelect(item.code)}
                  rightContent={
                    Platform.OS === 'web' ? (
                      <View style={[styles.webFlagCircle, { backgroundColor: isSelected ? themeColors.accentColor : themeColors.borderColor }]}>
                         <Text style={[styles.webFlagText, { color: isSelected ? '#fff' : themeColors.textColor }]}>
                           {item.code.toUpperCase()}
                         </Text>
                      </View>
                    ) : (
                      <Text style={styles.flag}>{item.flag}</Text>
                    )
                  }
                />
              </View>
            );
          })}
        </View>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: { 
    padding: 20 
  },
  title: { 
    fontSize: 20, 
    fontWeight: "700", 
    marginBottom: 8 
  },
  desc: { 
    fontSize: 14, 
    marginBottom: 24, 
    lineHeight: 20 
  },
  listContent: {
    paddingBottom: 20,
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
});

export default LanguageSettings;