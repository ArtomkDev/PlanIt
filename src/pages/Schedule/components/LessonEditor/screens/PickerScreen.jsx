import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, PencilSimple, Check, MagnifyingGlass, X, MinusCircle, ArrowsCounterClockwise } from 'phosphor-react-native';
import { SheetFlatList, SheetScrollView } from '../../../../../components/ui/BottomSheet';
import AppIconPickerGrid from '../../../../../components/ui/AppIconPickerGrid';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import { t } from '../../../../../utils/i18n';
import { triggerHaptic } from '../../../../../utils/haptics';
import EditorFormActions from '../ui/EditorFormActions';

const EMPTY_SELECTION = Object.freeze([]);

export default function LessonEditorPickerScreen({ options, selectedValues = EMPTY_SELECTION, alreadySelected = EMPTY_SELECTION, multiSelect = false, onSave, onReset, onEdit, onAdd, themeColors, layout = 'list' }) {
  const { lang } = useScheduleData();
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  useEffect(() => { setSelected(Array.isArray(selectedValues) ? selectedValues : [selectedValues]); }, [selectedValues]);
  const isGrid = layout === 'grid';
  const select = key => {
    if (alreadySelected.includes(key) && key !== 'none') return;
    triggerHaptic('selection');
    if (multiSelect) setSelected(prev => prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]);
    else onSave?.(key);
  };
  const search = query.trim().toLocaleLowerCase();
  const filtered = options.filter(item => item.key !== 'none' && `${item.label} ${item.hint || ''}`.toLocaleLowerCase().includes(search));
  const renderAction = (label, Icon, onPress) => <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.secondary, { backgroundColor: pressed ? themeColors.backgroundColor2 : 'transparent' }]}>
    <Icon size={20} color={themeColors.accentColor} />
    <Text style={[styles.actionText, { color: themeColors.accentColor }]}>{label}</Text>
  </Pressable>;
  return <View style={styles.container}>
    {!isGrid && <View style={styles.toolbar}>
      <View style={[styles.search, { backgroundColor: themeColors.backgroundColor2 }]}>
        <MagnifyingGlass size={20} color={themeColors.textColor2} />
        <TextInput style={[styles.searchInput, { color: themeColors.textColor }]} value={query} onChangeText={setQuery}
          accessibilityLabel={t('schedule.lesson_editor.search', lang)} placeholder={t('schedule.lesson_editor.search', lang)} placeholderTextColor={themeColors.textColor2} autoCorrect={false} />
        {!!query && <Pressable style={styles.iconButton} onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.clear', lang)}><X size={18} color={themeColors.textColor2} /></Pressable>}
      </View>
      {onAdd && renderAction(t('schedule.picker_screen.add_new', lang), Plus, onAdd)}
    </View>}
    {isGrid ? <SheetScrollView contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
      <AppIconPickerGrid iconKeys={options.map(item => item.key).filter(key => key !== 'none')}
        selectedIcon={selected[0] === 'none' ? null : selected[0]} onSelect={key => select(key || 'none')}
        themeColors={themeColors} showNone={options.some(item => item.key === 'none')}
        noneAccessibilityLabel={t('schedule.icon_categories.none', lang)} accessibilityLabelPrefix={t('schedule.lesson_editor.choose_icon', lang)} />
    </SheetScrollView> : <SheetFlatList
      data={filtered} keyExtractor={item => String(item.key)} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const checked = selected.includes(item.key);
        const unavailable = alreadySelected.includes(item.key);
        const Icon = item.iconComponent;
        return <View style={[styles.option, { backgroundColor: themeColors.backgroundColor2, borderColor: checked ? themeColors.accentColor : themeColors.borderColor }]}>
          <Pressable accessibilityRole={multiSelect ? 'checkbox' : 'radio'} accessibilityLabel={item.label}
            accessibilityState={{ checked, disabled: unavailable }} disabled={unavailable}
            onPress={() => select(item.key)} onLongPress={onEdit ? () => onEdit(item.key) : undefined}
            style={({ pressed }) => [styles.optionMain, { opacity: unavailable ? 0.45 : pressed ? 0.65 : 1 }]}>
            {Icon && <Icon size={22} color={item.iconColor || themeColors.accentColor} />}
            <View style={styles.optionText}>
              <Text style={[styles.name, { color: themeColors.textColor }]}>{item.label}</Text>
              {(item.hint || unavailable) && <Text style={[styles.hint, { color: themeColors.textColor2 }]}>{unavailable ? t('schedule.picker_screen.already_added', lang) : item.hint}</Text>}
            </View>
            <View style={[styles.selection, { borderColor: checked ? themeColors.accentColor : themeColors.borderColor, backgroundColor: checked ? themeColors.accentColor : 'transparent' }]}>
              {checked && <Check size={14} color="#fff" weight="bold" />}
            </View>
          </Pressable>
          {onEdit && <Pressable style={styles.iconButton} onPress={() => onEdit(item.key)} accessibilityRole="button" accessibilityLabel={`${t('common.edit', lang)}: ${item.label}`}>
            <PencilSimple size={20} color={themeColors.accentColor} />
          </Pressable>}
        </View>;
      }}
      ListEmptyComponent={<Text style={[styles.empty, { color: themeColors.textColor2 }]}>{t(search ? 'schedule.lesson_editor.no_matches' : 'schedule.lesson_editor.empty_options', lang)}</Text>}
      ListFooterComponent={<View style={styles.listFooter}>
        {options.some(item => item.key === 'none') && renderAction(t('schedule.lesson_editor.delete_slot', lang), MinusCircle, () => select('none'))}
        {onReset && renderAction(t('schedule.lesson_editor.restore_subject', lang), ArrowsCounterClockwise, onReset)}
      </View>}
    />}
    {multiSelect && <EditorFormActions themeColors={themeColors} onSave={() => onSave?.(selected)} saveLabel={t('common.done', lang)} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, toolbar: { padding: 16, paddingBottom: 4, gap: 8 },
  search: { minHeight: 48, borderRadius: 14, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 12 },
  secondary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderRadius: 12 },
  actionText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  grid: { padding: 16, paddingBottom: 32 }, list: { padding: 16, paddingBottom: 32 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, marginBottom: 10, paddingRight: 8 },
  optionMain: { flex: 1, minWidth: 0, minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { flex: 1, minWidth: 0, gap: 4 }, name: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 19 }, selection: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24, fontSize: 15, lineHeight: 22 }, listFooter: { marginTop: 8 },
});
