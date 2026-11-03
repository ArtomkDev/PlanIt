import React, { useState } from 'react';
import { StyleSheet, Text, Pressable, View, Platform } from 'react-native';
import { PencilSimple, Check } from 'phosphor-react-native';
import themes from '../../../../config/themes';
import { useScheduleActions, useScheduleData } from '../../../../context/ScheduleProvider';
import useAppTheme from '../../../../hooks/useAppTheme';
import SettingsScreenLayout from '../../../../layouts/SettingsScreenLayout';
import AdvancedColorPicker from '../../../../components/ui/AdvancedColorPicker';
import AppSwitch from '../../../../components/ui/AppSwitch';
import SettingsGroup from '../../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../../components/ui/SettingsKit/SettingsRow';
import { t } from '../../../../utils/i18n';
import { triggerHaptic } from '../../../../utils/haptics';

const MODE_KEYS = ['light', 'dark', 'oled'];
const COLOR_KEYS = Object.keys(themes.accentColors);

export default function ThemeSettings() {
  const { global, lang } = useScheduleData();
  const { setGlobalDraft } = useScheduleActions();
  const { mode, colors } = useAppTheme();
  const accent = global?.theme?.[1] || 'blue';
  const blurEnabled = global?.blur ?? true;
  const [pickerVisible, setPickerVisible] = useState(false);
  const accentValue = colors.accentColor;
  const isCustomColor = !COLOR_KEYS.includes(accent);
  const colorLabel = isCustomColor
    ? t('settings.theme_screen.custom_color', lang)
    : t(`settings.theme_screen.colors.${accent}`, lang);

  const selectMode = (nextMode) => {
    triggerHaptic(mode === nextMode ? 'selection' : 'success');
    if (mode === nextMode) return;
    setGlobalDraft(prev => ({ ...prev, theme: [nextMode, prev.theme?.[1] || accent] }));
  };
  const selectColor = (nextColor) => {
    triggerHaptic(accent === nextColor ? 'selection' : 'success');
    if (accent === nextColor) return;
    setGlobalDraft(prev => ({ ...prev, theme: [prev.theme?.[0] || mode, nextColor] }));
  };
  const toggleBlur = (enabled) => {
    triggerHaptic(enabled ? 'toggleOn' : 'toggleOff');
    setGlobalDraft(prev => ({ ...prev, blur: enabled }));
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textColor }]}>
            {t('settings.theme_screen.mode_title', lang)}
          </Text>
          <View style={styles.modes}>
            {MODE_KEYS.map(key => {
              const selected = mode === key;
              const sample = themes.getColors(key, accent);
              return (
                <Pressable key={key} accessibilityRole="radio"
                  accessibilityLabel={t(`settings.theme_screen.modes.${key}`, lang)}
                  accessibilityState={{ checked: selected, selected }} onPress={() => selectMode(key)}
                  style={({ pressed, focused }) => [styles.modeOption, {
                    borderColor: selected ? colors.accentColor : colors.borderColor,
                    opacity: pressed ? 0.7 : 1,
                  }, Platform.OS === 'web' && focused && [styles.focusOutline, { outlineColor: colors.textColor }]]}>
                  <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
                    style={[styles.modeSample, { backgroundColor: sample.backgroundColor, borderColor: sample.borderColor }]}>
                    <View style={styles.sampleToolbar}>
                      <View style={[styles.sampleAvatar, { backgroundColor: sample.accentColor }]} />
                      <View style={[styles.sampleHeading, { backgroundColor: sample.textColor }]} />
                      <View style={[styles.sampleAction, { backgroundColor: sample.textColor3 }]} />
                    </View>
                    <View style={[styles.sampleLesson, { backgroundColor: sample.accentColor }]}>
                      <View style={[styles.sampleLessonTitle, { backgroundColor: sample.textOnAccent }]} />
                      <View style={[styles.sampleLessonDetail, { backgroundColor: sample.textOnAccent }]} />
                    </View>
                    <View style={[styles.sampleNextLesson, { backgroundColor: sample.backgroundColor2, borderColor: sample.borderColor }]}>
                      <View style={[styles.sampleNextTitle, { backgroundColor: sample.textColor2 }]} />
                    </View>
                  </View>
                  <View style={styles.modeLabelRow}>
                    <Text style={[styles.modeLabel, { color: colors.textColor }]}>{t(`settings.theme_screen.modes.${key}`, lang)}</Text>
                    <View style={[styles.radio, { borderColor: selected ? colors.accentColor : colors.textColor3 }]}>
                      {selected && <View style={[styles.radioDot, { backgroundColor: colors.accentColor }]} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flexTitle, { color: colors.textColor }]}>
              {t('settings.theme_screen.accent_title', lang)}
            </Text>
            <Text style={[styles.colorName, { color: colors.textColor2 }]}>{colorLabel}</Text>
          </View>
          <View style={[styles.paletteSurface, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
            <View style={styles.palette}>
              {COLOR_KEYS.map(key => {
                const selected = accent === key;
                return (
                  <Pressable key={key} accessibilityRole="radio"
                    accessibilityLabel={t(`settings.theme_screen.colors.${key}`, lang)}
                    accessibilityState={{ checked: selected, selected }} onPress={() => selectColor(key)}
                    style={({ pressed, focused }) => [styles.colorOption, { opacity: pressed ? 0.6 : 1 },
                      Platform.OS === 'web' && focused && [styles.focusOutline, { outlineColor: colors.textColor }]]}>
                    <View style={[styles.swatchRing, { borderColor: selected ? colors.accentColor : 'transparent' }]}>
                      <View style={[styles.swatch, { backgroundColor: themes.accentColors[key] }]}>
                        {selected && <Check size={18} color={colors.textOnAccent} weight="bold" />}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
            <SettingsRow label={t('settings.theme_screen.custom_color', lang)} value={accentValue.toUpperCase()}
              valuePosition="below" icon={PencilSimple} themeColors={colors}
              accessibilityLabel={`${t('settings.theme_screen.custom_color', lang)}: ${accentValue.toUpperCase()}`}
              accessibilityState={{ expanded: pickerVisible }}
              rightContent={<View style={[styles.customSwatch, { backgroundColor: accentValue, borderColor: colors.borderColor }]} />}
              onPress={() => setPickerVisible(true)} />
          </View>
        </View>

        {Platform.OS !== 'android' && <SettingsGroup themeColors={colors}>
          <SettingsRow label={t('settings.theme_screen.blur_title', lang)}
            desc={t(`settings.theme_screen.${mode === 'oled' ? 'blur_desc_oled' : 'blur_desc_normal'}`, lang)}
            themeColors={colors} showCaret={false} skipHaptic accessibilityRole="switch"
            accessibilityState={{ checked: blurEnabled }} rightContentPointerEvents="none" onPress={() => toggleBlur(!blurEnabled)}
            rightContent={<AppSwitch accessibilityLabel={t('settings.theme_screen.blur_title', lang)} value={blurEnabled}
              onValueChange={toggleBlur} themeColors={colors} interactive={false} />} />
        </SettingsGroup>}
      </View>

      <AdvancedColorPicker visible={pickerVisible} initialColor={accentValue}
        onClose={() => setPickerVisible(false)}
        onSave={hex => { selectColor(hex); setPickerVisible(false); }} />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 4, gap: 28 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  flexTitle: { flex: 1 },
  colorName: { maxWidth: '48%', flexShrink: 1, fontSize: 13, lineHeight: 19, textAlign: 'right' },
  modes: { flexDirection: 'row', gap: 10 },
  modeOption: { flex: 1, minWidth: 0, borderWidth: 2, borderRadius: 16, padding: 6 },
  focusOutline: { outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
  modeSample: { height: 92, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 8, gap: 7 },
  sampleToolbar: { height: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sampleAvatar: { width: 8, height: 8, borderRadius: 3 },
  sampleHeading: { width: '42%', height: 3, borderRadius: 2, opacity: 0.8 },
  sampleAction: { width: 5, height: 5, borderRadius: 2, marginLeft: 'auto' },
  sampleLesson: { height: 30, borderRadius: 5, padding: 6, justifyContent: 'center', gap: 5 },
  sampleLessonTitle: { width: '80%', height: 4, borderRadius: 2, opacity: 0.9 },
  sampleLessonDetail: { width: '48%', height: 3, borderRadius: 2, opacity: 0.55 },
  sampleNextLesson: { height: 18, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, justifyContent: 'center' },
  sampleNextTitle: { width: '64%', height: 3, borderRadius: 2, opacity: 0.7 },
  modeLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 2, paddingTop: 10, paddingBottom: 4 },
  modeLabel: { flexShrink: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  radio: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  paletteSurface: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingTop: 10, overflow: 'hidden' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 },
  colorOption: { flexBasis: '16.666%', minWidth: 44, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { width: 44, height: 44, padding: 3, borderWidth: 2, borderRadius: 22 },
  swatch: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  customSwatch: { width: 30, height: 30, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
});
