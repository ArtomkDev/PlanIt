import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Plus, ArrowsCounterClockwise, CaretDown } from "phosphor-react-native";
import SettingsGroup from "../../../../../components/ui/SettingsKit/SettingsGroup";
import TabSwitcher from "../../../../../components/ui/TabSwitcher";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

export default function Group({ title, children, onAdd, onReset, themeColors, showScopeToggle, scope, onScopeChange }) {
  const { lang } = useScheduleData();
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <SettingsGroup title={title} themeColors={themeColors} headerRight={
        <View style={styles.actions}>
          {showScopeToggle && <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${t(scope === 'local' ? 'schedule.lesson_editor.scope_local' : 'schedule.lesson_editor.scope_global', lang)}`}
            accessibilityState={{ expanded: scopeOpen }}
            onPress={() => setScopeOpen(value => !value)}
            style={({ pressed }) => [styles.scopeButton, { backgroundColor: pressed || scopeOpen ? themeColors.backgroundColor2 : 'transparent' }]}
          >
            <Text style={[styles.scopeText, { color: themeColors.accentTextColor }]}>{t(scope === 'local' ? 'schedule.lesson_editor.scope_local' : 'schedule.lesson_editor.scope_global', lang)}</Text>
            <CaretDown size={14} color={themeColors.accentTextColor} />
          </Pressable>}
          {(onAdd || onReset) && <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t(onAdd ? 'common.add' : 'common.reset', lang)}: ${title}`}
            onPress={onAdd || onReset}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? themeColors.borderColor : themeColors.backgroundColor2 }]}
          >
            {onAdd ? <Plus size={19} color={themeColors.accentTextColor} /> : <ArrowsCounterClockwise size={19} color={themeColors.textColor2} />}
          </Pressable>}
        </View>
      }>
      {showScopeToggle && scopeOpen && <View style={styles.scopePanel}>
        <TabSwitcher
          tabs={[{ id: 'global', label: t('schedule.lesson_editor.scope_global', lang) }, { id: 'local', label: t('schedule.lesson_editor.scope_local', lang) }]}
          activeTab={scope}
          onTabPress={onScopeChange}
          themeColors={themeColors}
        />
        <Text style={[styles.help, { color: themeColors.textColor2 }]}>{t(scope === 'local' ? 'schedule.lesson_editor.scope_local_help' : 'schedule.lesson_editor.scope_global_help', lang)}</Text>
      </View>}
      {children}
    </SettingsGroup>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scopeButton: { minHeight: 44, paddingHorizontal: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scopeText: { fontSize: 12, fontWeight: '600' },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scopePanel: { padding: 16 },
  help: { fontSize: 13, lineHeight: 19 },
});
