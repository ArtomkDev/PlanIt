import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from "react-native";
import { X, PlusCircle, Trash } from "phosphor-react-native";

import { useSchedule } from "../../../../../context/ScheduleProvider";
import { ICON_CATEGORIES } from "../../../../../config/subjectIcons";
import { t } from "../../../../../utils/i18n";

import SettingsSelectionRow from "../../../../../components/ui/SettingsKit/SettingsSelectionRow";
import SettingsActionRow from "../../../../../components/ui/SettingsKit/SettingsActionRow";

const { width } = Dimensions.get('window');
const GRID_SPACING = 10;
const COLUMNS = 5;
const ITEM_SIZE = (width - 32 - (COLUMNS - 1) * GRID_SPACING) / COLUMNS;

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
  const { lang } = useSchedule();
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

  const renderIconItem = (itemKey) => {
    const option = options.find(o => o.key === itemKey);
    if (!option && itemKey !== 'none') return null;

    const isSelected = tempSelected.includes(itemKey);
    const IconComponent = option?.iconComponent;

    return (
      <TouchableOpacity
        key={itemKey}
        style={[
          styles.gridItem, 
          { 
            backgroundColor: isSelected ? themeColors.accentColor + '25' : themeColors.backgroundColor2, 
            borderColor: isSelected ? themeColors.accentColor : 'transparent', 
            borderWidth: 2 
          }
        ]}
        onPress={() => handlePressItem(itemKey)}
        activeOpacity={0.6}
      >
        {itemKey === 'none' ? (
          <X size={24} color={themeColors.textColor2} weight="bold" />
        ) : (
          IconComponent && <IconComponent size={26} color={isSelected ? themeColors.accentColor : themeColors.textColor} weight={isSelected ? "fill" : "regular"} />
        )}
      </TouchableOpacity>
    );
  };

  const renderListItem = (item) => {
    const isSelected = tempSelected.includes(item.key);
    const isAlreadySelected = alreadySelected.includes(item.key) && item.key !== 'none';
    const canBeEdited = onEdit && item.key !== 'none';

    return (
      <SettingsSelectionRow
        key={item.key}
        label={item.label}
        hint={isAlreadySelected ? t('schedule.picker_screen.already_added', lang) : null}
        isSelected={isSelected}
        isAlreadySelected={isAlreadySelected}
        themeColors={themeColors}
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
          <>
            {options.some(o => o.key === 'none') && (
               <View style={styles.categorySection}>
                 <Text style={[styles.categoryTitle, { color: themeColors.textColor2 }]}>
                   {(t('schedule.icon_categories.none', lang) || "").toUpperCase()}
                 </Text>
                 <View style={styles.gridContainer}>
                    {renderIconItem('none')}
                 </View>
               </View>
            )}

            {ICON_CATEGORIES.map((category) => (
              <View key={category.id} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: themeColors.textColor2 }]}>
                  {(t(`schedule.icon_categories.${category.id}`, lang) || category.id).toUpperCase()}
                </Text>
                <View style={styles.gridContainer}>
                  {category.icons.map(iconKey => renderIconItem(iconKey))}
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.listWrapper}>
            {options.filter(o => o.key !== 'none').map(renderListItem)}
            
            {onAdd && (
              <View style={{ marginTop: 4 }}>
                <SettingsActionRow 
                  icon={PlusCircle}
                  label={t('schedule.picker_screen.add_new', lang)}
                  onPress={onAdd}
                  themeColors={themeColors}
                />
              </View>
            )}

            {options.some(o => o.key === 'none') && (
              <View style={{ marginTop: 8 }}>
                <SettingsActionRow 
                  icon={Trash}
                  label={t('schedule.picker_screen.delete_slot', lang)}
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
              onPress={() => onSave && onSave(tempSelected)}
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
  categorySection: { marginBottom: 24 },
  categoryTitle: { 
    fontSize: 12, 
    fontWeight: '700', 
    letterSpacing: 1.2, 
    marginBottom: 12, 
    marginLeft: 4 
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: GRID_SPACING 
  },
  gridItem: { 
    width: ITEM_SIZE, 
    height: ITEM_SIZE, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  listWrapper: { gap: 10 },
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