import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PencilSimple } from "phosphor-react-native";
import SettingsRow from "../../../../../components/ui/SettingsKit/SettingsRow";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

export default function SettingRow({ onEdit, ...props }) {
  const { lang } = useScheduleData();
  return <View style={styles.container}>
    <View style={styles.content}><SettingsRow {...props} valuePosition="below" /></View>
    {onEdit && <Pressable style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.65 : 1 }]}
      accessibilityRole="button" accessibilityLabel={t('common.edit', lang) + ': ' + (props.value || props.label)} onPress={onEdit}>
      <PencilSimple size={20} color={props.themeColors.accentTextColor} />
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  content: { flex: 1, minWidth: 0 },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
});
