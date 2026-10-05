import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { SheetFlatList } from '../../../../../components/ui/BottomSheet';
import themes from '../../../../../config/themes';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import { t } from '../../../../../utils/i18n';
import { triggerHaptic } from '../../../../../utils/haptics';

export default function ColorPicker({ selected, onSelect, themeColors }) {
  const { lang } = useScheduleData();
  return <SheetFlatList data={Object.entries(themes.accentColors)} numColumns={4} keyExtractor={([key]) => key}
    contentContainerStyle={styles.list} renderItem={({ item: [key, color] }) => {
      const checked = selected === key || selected?.toLowerCase() === color.toLowerCase();
      return <Pressable style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="radio"
        accessibilityLabel={t(`schedule.lesson_editor.colors.${key}`, lang)} accessibilityState={{ checked }}
        onPress={() => { triggerHaptic('selection'); onSelect(key); }}>
        <View style={[styles.swatch, { backgroundColor: color }]}>
          {checked && <View style={styles.mark}><Check size={18} color="#111827" weight="bold" /></View>}
        </View>
        <Text style={[styles.label, { color: themeColors.textColor }]}>{t(`schedule.lesson_editor.colors.${key}`, lang)}</Text>
      </Pressable>;
    }} />;
}
const styles = StyleSheet.create({
  list: { paddingBottom: 32 }, tile: { width: '25%', padding: 6, alignItems: 'center', gap: 8, marginBottom: 8 },
  swatch: { width: '100%', aspectRatio: 1, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mark: { backgroundColor: '#fff', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
