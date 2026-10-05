import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { CaretRight, PencilSimple } from "phosphor-react-native";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";

export default function SettingRow({ label, value, desc, onPress, onLongPress, onEdit, themeColors, icon: Icon, iconColor, rightContent, showCaret = true, accessibilityLabel, accessibilityHint, accessibilityState }) {
  const { lang } = useScheduleData();
  const Component = onPress ? Pressable : View;
  const content = <>
    {Icon && <View style={styles.icon}><Icon size={22} color={iconColor || themeColors.textColor2} weight="regular" /></View>}
    <View style={styles.text}>
      <Text style={[styles.label, { color: themeColors.textColor }]}>{label}</Text>
      {!!value && <Text style={[styles.value, { color: themeColors.textColor2 }]}>{value}</Text>}
      {!!desc && <Text style={[styles.description, { color: themeColors.textColor2 }]}>{desc}</Text>}
    </View>
    {rightContent && <View style={styles.preview}>{rightContent}</View>}
    {!!onPress && showCaret && <CaretRight size={18} color={themeColors.textColor2} />}
  </>;
  return <View style={styles.container}>
    <Component
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel || [label, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      onPress={onPress ? () => { triggerHaptic('selection'); onPress(); } : undefined}
      onLongPress={onLongPress}
      style={onPress ? ({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }] : styles.row}
    >{content}</Component>
    {onEdit && <Pressable style={styles.edit} accessibilityRole="button" accessibilityLabel={`${t('common.edit', lang)}: ${value || label}`} onPress={onEdit}>
      <PencilSimple size={20} color={themeColors.accentColor} />
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  icon: { width: 24, alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  value: { fontSize: 14, lineHeight: 20 },
  description: { fontSize: 12, lineHeight: 18 },
  preview: { flexShrink: 1, maxWidth: '45%' },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
});
