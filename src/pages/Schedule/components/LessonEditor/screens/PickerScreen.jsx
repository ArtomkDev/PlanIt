import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { PlusCircle, Trash } from "phosphor-react-native";

import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";

import AppIconPickerGrid from "../../../../../components/ui/AppIconPickerGrid";
import SettingsSelectionRow from "../../../../../components/ui/SettingsKit/SettingsSelectionRow";
import SettingsActionRow from "../../../../../components/ui/SettingsKit/SettingsActionRow";

export default function LessonEditorPickerScreen({
  options,
  selectedValues = [],
  alreadySelected = [],
  multiSelect = false,
  onSave,
  onEdit,
  onAdd,
  themeColors,
  layout = 'list',
}) {
  const { lang } = useScheduleData();
  const [tempSelected, setTempSelected] = useState([]);

  useEffect(() => {
    setTempSelected(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
  }, [selectedValues]);

  const isIconPicker = layout === 'grid';

  const handlePressItem = (key) => {
    if (multiSelect) {
      setTempSelected((prev) =>
        prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
      );
    } else {
      setTempSelected([key]);
      if (onSave) onSave(key);
    }
  };

  const renderListItem = (item) => {
    const isSelected = tempSelected.includes(item.key);
    const isAlreadySelected = alreadySelected.includes(item.key) && item.key !== 'none';
    const canBeEdited = onEdit && item.key !== 'none';
    const Icon = item.iconComponent;

    return (
      <SettingsSelectionRow
        key={item.key}
        label={item.label}
        editAccessibilityLabel={`${t('common.edit', lang)}: ${item.label}`}
        hint={isAlreadySelected ? t('schedule.picker_screen.already_added', lang) : item.hint}
        isSelected={isSelected}
        isAlreadySelected={isAlreadySelected}
        themeColors={themeColors}
        rightContent={Icon ? (
          <View style={[styles.optionIcon, { backgroundColor: (item.iconColor || themeColors.accentColor) + '15' }]}>
            <Icon size={18} color={item.iconColor || themeColors.accentColor} weight="bold" />
          </View>
        ) : null}
        onPress={() => handlePressItem(item.key)}
        onLongPress={() => canBeEdited && onEdit(item.key)}
        onEdit={canBeEdited ? () => onEdit(item.key) : undefined}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, multiSelect && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {isIconPicker ? (
          <AppIconPickerGrid
            iconKeys={options.map((option) => option.key).filter((key) => key !== 'none')}
            selectedIcon={tempSelected[0] === 'none' ? null : tempSelected[0]}
            onSelect={(iconKey) => handlePressItem(iconKey || 'none')}
            themeColors={themeColors}
            showNone={options.some(o => o.key === 'none')}
            noneAccessibilityLabel={t('schedule.icon_categories.none', lang)}
            accessibilityLabelPrefix={t('schedule.lesson_editor.choose_icon', lang)}
          />
        ) : (
          <View style={styles.listWrapper}>
            {onAdd && (
              <View style={{ marginBottom: 2 }}>
                <SettingsActionRow
                  icon={PlusCircle}
                  label={t('schedule.picker_screen.add_new', lang)}
                  onPress={onAdd}
                  themeColors={themeColors}
                />
              </View>
            )}

            {options.filter(o => o.key !== 'none').map(renderListItem)}

            {options.some(o => o.key === 'none') && (
              <View style={{ marginTop: 8 }}>
                <SettingsActionRow
                  icon={Trash}
                  label={t('schedule.lesson_editor.delete_slot', lang)}
                  onPress={() => handlePressItem('none')}
                  danger={true}
                  themeColors={themeColors}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {multiSelect && (
        <View style={[styles.footer, { backgroundColor: themeColors.backgroundColor, borderTopColor: themeColors.borderColor }]}>
          <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]}
              onPress={() => {
                triggerHaptic("success");
                onSave?.(tempSelected);
              }}
          >
              <Text style={[styles.saveBtnText, { color: '#fff' }]}>{t('common.save', lang)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  listWrapper: { gap: 10 },
  optionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  saveBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3
  },
  saveBtnText: { fontWeight: '700', fontSize: 16 },
});
