import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tinycolor from 'tinycolor2';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import { t } from '../../../../../utils/i18n';

export default function EditorFormActions({ onSave, onCancel, saveLabel, disabled = false, themeColors }) {
  const { lang } = useScheduleData();
  const insets = useSafeAreaInsets();
  const foreground = tinycolor(themeColors.accentColor).isLight() ? '#111827' : '#fff';
  return <View style={[styles.footer, { backgroundColor: themeColors.backgroundColor, borderTopColor: themeColors.borderColor, paddingBottom: Math.max(16, insets.bottom) }]}>
    {onCancel && <Pressable onPress={onCancel} accessibilityRole="button" style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.label, { color: themeColors.textColor }]}>{t('common.cancel', lang)}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onSave}
      style={({ pressed }) => [styles.save, { backgroundColor: themeColors.accentColor, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}>
      <Text style={[styles.label, { color: foreground }]}>{saveLabel || t('common.save', lang)}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  save: { flex: 1, minHeight: 50, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 12, maxWidth: '40%' },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
});
