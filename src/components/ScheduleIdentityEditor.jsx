import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Palette, Shapes } from 'phosphor-react-native';
import SettingsGroup from './ui/SettingsKit/SettingsGroup';
import SettingsRow from './ui/SettingsKit/SettingsRow';
import AdvancedColorPicker from './ui/AdvancedColorPicker';
import ScheduleIcon from './ScheduleIcon';
import ScheduleIconPickerSheet from './ScheduleIconPickerSheet';
import { scheduleColorWithAlpha } from '../utils/scheduleColors';
import { t } from '../utils/i18n';

export default function ScheduleIdentityEditor({ value, onChange, themeColors, lang, active = true }) {
  const [picker, setPicker] = useState(null);
  useEffect(() => { if (!active) setPicker(null); }, [active]);
  return (
    <>
      <SettingsGroup title={t('settings.sections.general', lang)} themeColors={themeColors}>
        <View style={styles.nameField}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>{t('common.schedule_name', lang)}</Text>
          <TextInput accessibilityLabel={t('settings.schedule_editor.enter_name', lang)} value={value.name}
            onChangeText={name => onChange({ ...value, name })} maxLength={40} returnKeyType="done"
            autoComplete="off" textContentType="none" placeholder={t('settings.schedule_editor.enter_name', lang)}
            placeholderTextColor={themeColors.textColor2}
            style={[styles.input, { color: themeColors.textColor, backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]} />
        </View>
        <SettingsRow label={t('settings.schedule_editor.color', lang)} desc={t('settings.schedule_editor.color_hint', lang)}
          icon={Palette} themeColors={themeColors} onPress={() => setPicker('color')}
          rightContent={<View style={[styles.swatch, { backgroundColor: value.color, borderColor: themeColors.borderColor }]} />} />
        <SettingsRow label={t('settings.schedule_editor.icon', lang)} desc={t('settings.schedule_editor.icon_hint', lang)}
          icon={Shapes} themeColors={themeColors} onPress={() => setPicker('icon')}
          rightContent={<ScheduleIcon icon={value.icon} name={value.name || t('common.schedule_name', lang)}
            size={36} iconSize={20} backgroundColor={scheduleColorWithAlpha(value.color, 0.16)} color={value.color} />} />
      </SettingsGroup>
      <AdvancedColorPicker visible={active && picker === 'color'} initialColor={value.color} onClose={() => setPicker(null)}
        onSave={color => { onChange({ ...value, color }); setPicker(null); }} />
      <ScheduleIconPickerSheet visible={active && picker === 'icon'} onClose={() => setPicker(null)}
        onSelect={icon => { onChange({ ...value, icon }); setPicker(null); }} selectedIcon={value.icon}
        scheduleName={value.name || t('common.schedule_name', lang)} scheduleColor={value.color} themeColors={themeColors} lang={lang} />
    </>
  );
}

const styles = StyleSheet.create({
  nameField: { padding: 16, gap: 8 },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  swatch: { width: 32, height: 32, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
});
