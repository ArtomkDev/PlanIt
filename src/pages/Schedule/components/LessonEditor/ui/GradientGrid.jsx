import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, PencilSimple, Plus } from 'phosphor-react-native';
import { SheetFlatList } from '../../../../../components/ui/BottomSheet';
import GradientBackground from '../../../../../components/ui/GradientBackground';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import { t } from '../../../../../utils/i18n';
import { triggerHaptic } from '../../../../../utils/haptics';

export default function GradientGrid({ gradients, selected, onSelect, onEdit, onAddGradient, themeColors }) {
  const { lang } = useScheduleData();
  return <SheetFlatList data={gradients || []} keyExtractor={item => String(item.id)} numColumns={2} contentContainerStyle={styles.list}
    ListHeaderComponent={onAddGradient && <Pressable style={[styles.add, { backgroundColor: themeColors.backgroundColor2 }]} onPress={onAddGradient} accessibilityRole="button">
      <Plus size={20} color={themeColors.accentColor} /><Text style={{ color: themeColors.accentColor, fontWeight: '600' }}>{t('schedule.lesson_editor.add_gradient', lang)}</Text>
    </Pressable>}
    ListEmptyComponent={<Text style={[styles.empty, { color: themeColors.textColor2 }]}>{t('schedule.lesson_editor.empty_gradients', lang)}</Text>}
    renderItem={({ item, index }) => {
      const name = item.name || t('schedule.lesson_editor.gradient_number', lang, { number: index + 1 });
      return <View style={styles.cell}>
        <View style={[styles.card, { backgroundColor: themeColors.backgroundColor2, borderColor: selected === item.id ? themeColors.accentColor : themeColors.borderColor }]}>
          <Pressable onPress={() => { triggerHaptic('selection'); onSelect(item.id); }} onLongPress={onEdit ? () => onEdit(item) : undefined}
            accessibilityRole="radio" accessibilityLabel={name} accessibilityState={{ checked: selected === item.id }}>
            <GradientBackground gradient={item} fallbackColor={themeColors.backgroundColor3} style={styles.preview}>
              {selected === item.id && <View style={styles.check}><Check size={18} color="#111827" weight="bold" /></View>}
            </GradientBackground>
          </Pressable>
          <View style={styles.caption}>
            <Text style={[styles.name, { color: themeColors.textColor }]}>{name}</Text>
            {onEdit && <Pressable style={styles.edit} onPress={() => onEdit(item)} accessibilityRole="button" accessibilityLabel={`${t('common.edit', lang)}: ${name}`}>
              <PencilSimple size={19} color={themeColors.accentColor} />
            </Pressable>}
          </View>
        </View>
      </View>;
    }} />;
}
const styles = StyleSheet.create({
  list: { paddingBottom: 32 }, add: { minHeight: 50, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, marginBottom: 16 },
  cell: { width: '50%', padding: 4 }, card: { borderWidth: 1.5, borderRadius: 18, overflow: 'hidden' },
  preview: { height: 108, padding: 12, alignItems: 'flex-end' }, check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  caption: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 4 }, name: { flex: 1, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, empty: { fontSize: 15, lineHeight: 22, textAlign: 'center', padding: 24 },
});
