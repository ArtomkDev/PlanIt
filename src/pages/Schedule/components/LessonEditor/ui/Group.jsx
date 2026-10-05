import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Plus, ArrowsCounterClockwise, CaretDown } from "phosphor-react-native";
import TabSwitcher from "../../../../../components/ui/TabSwitcher";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

export default function Group({ title, children, onAdd, onReset, themeColors, showScopeToggle, scope, onScopeChange }) {
  const { lang } = useScheduleData();
  const [scopeOpen, setScopeOpen] = useState(false);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: themeColors.textColor }]}>{title}</Text>
        <View style={styles.actions}>
          {showScopeToggle && <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${t(scope === 'local' ? 'schedule.lesson_editor.scope_local' : 'schedule.lesson_editor.scope_global', lang)}`}
            accessibilityState={{ expanded: scopeOpen }}
            onPress={() => setScopeOpen(value => !value)}
            style={({ pressed }) => [styles.scopeButton, { backgroundColor: pressed || scopeOpen ? themeColors.backgroundColor2 : 'transparent' }]}
          >
            <Text style={[styles.scopeText, { color: themeColors.accentColor }]}>{t(scope === 'local' ? 'schedule.lesson_editor.scope_local' : 'schedule.lesson_editor.scope_global', lang)}</Text>
            <CaretDown size={14} color={themeColors.accentColor} />
          </Pressable>}
          {(onAdd || onReset) && <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t(onAdd ? 'common.add' : 'common.reset', lang)}: ${title}`}
            onPress={onAdd || onReset}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? themeColors.borderColor : themeColors.backgroundColor2 }]}
          >
            {onAdd ? <Plus size={19} color={themeColors.accentColor} /> : <ArrowsCounterClockwise size={19} color={themeColors.textColor2} />}
          </Pressable>}
        </View>
      </View>
      {showScopeToggle && scopeOpen && <View style={styles.scopePanel}>
        <TabSwitcher
          tabs={[{ id: 'global', label: t('schedule.lesson_editor.scope_global', lang) }, { id: 'local', label: t('schedule.lesson_editor.scope_local', lang) }]}
          activeTab={scope}
          onTabPress={onScopeChange}
          themeColors={themeColors}
        />
        <Text style={[styles.help, { color: themeColors.textColor2 }]}>{t(scope === 'local' ? 'schedule.lesson_editor.scope_local_help' : 'schedule.lesson_editor.scope_global_help', lang)}</Text>
      </View>}
      <View style={[styles.card, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
        {items.map((child, index) => <View key={child.key || index}>
          {index > 0 && <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />}
          {child}
        </View>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600', flexGrow: 1, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scopeButton: { minHeight: 44, paddingHorizontal: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scopeText: { fontSize: 12, fontWeight: '600' },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scopePanel: { marginBottom: 12 },
  help: { fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
