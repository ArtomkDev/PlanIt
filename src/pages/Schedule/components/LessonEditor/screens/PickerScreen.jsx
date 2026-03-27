import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

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
  const { global } = useSchedule();
  const lang = global?.language || 'uk';
  const [tempSelected, setTempSelected] = useState([]);

  useEffect(() => {
    setTempSelected(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
  }, [selectedValues]);

  const handlePressItem = (key) => {
    if (multiSelect) {
      setTempSelected((prev) => {
        return prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key];
      });
    } else {
      setTempSelected([key]);
      if (onSave) onSave(key); 
    }
  };

  const displayOptions = layout === 'list' ? options.filter(o => o.key !== 'none') : options;
  const showRemoveSlot = layout === 'list' && options.some(o => o.key === 'none');

  const renderItem = ({ item }) => {
    const isSelected = tempSelected.includes(item.key);
    const isAlreadySelected = alreadySelected.includes(item.key) && item.key !== 'none';
    const IconComponent = item.iconComponent;
    
    const canBeEdited = onEdit && item.key !== 'none';

    if (layout === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridItem, { backgroundColor: isSelected ? themeColors.accentColor + '30' : themeColors.backgroundColor2, borderColor: isSelected ? themeColors.accentColor : 'transparent', borderWidth: 2 }]}
          onPress={() => handlePressItem(item.key)}
          activeOpacity={0.6}
        >
          {IconComponent ? <IconComponent size={28} color={isSelected ? themeColors.accentColor : themeColors.textColor} /> : <Ionicons name="close" size={28} color={themeColors.textColor2} />}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.option, 
          { 
            backgroundColor: themeColors.backgroundColor2, 
            borderColor: isSelected ? themeColors.accentColor : 'transparent', 
            borderWidth: 1, 
            opacity: isAlreadySelected ? 0.5 : 1
          }
        ]}
        onPress={() => {
            if (!isAlreadySelected) handlePressItem(item.key);
        }}
        activeOpacity={isAlreadySelected ? 1 : 0.7}
        onLongPress={() => canBeEdited && onEdit(item.key)}
        delayLongPress={300}
      >
        <View style={styles.leftContainer}>
          <Text style={[styles.optionText, { color: themeColors.textColor }, isSelected && { color: themeColors.accentColor, fontWeight: "bold" }]}>
            {item.label}
          </Text>
          {isAlreadySelected && (
            <Text style={[styles.hintText, { color: themeColors.accentColor, opacity: 1 }]}>
              {t('schedule.picker_screen.already_added', lang)}
            </Text>
          )}
        </View>
        
        <View style={styles.rightContainer}>
          {canBeEdited && (
            <TouchableOpacity 
              hitSlop={15}
              onPress={() => onEdit(item.key)}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={20} color={themeColors.textColor2} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        key={layout} 
        data={displayOptions}
        keyExtractor={(item) => String(item.key)} 
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, multiSelect && { paddingBottom: 100 }]}
        numColumns={layout === 'grid' ? COLUMNS : 1}
        columnWrapperStyle={layout === 'grid' ? styles.columnWrapper : null}
        ListFooterComponent={(onAdd || showRemoveSlot) && (
          <View style={styles.actionButtonsContainer}>
            {onAdd && (
              <TouchableOpacity style={[styles.actionButton, { borderColor: themeColors.accentColor, borderStyle: 'dashed' }]} onPress={onAdd}>
                <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>
                  {t('schedule.picker_screen.add_new', lang)}
                </Text>
              </TouchableOpacity>
            )}
            
            {showRemoveSlot && (
              <TouchableOpacity style={[styles.actionButton, { borderColor: '#EF4444', backgroundColor: '#EF444415', borderStyle: 'solid' }]} onPress={() => handlePressItem('none')}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
                  {t('schedule.picker_screen.delete_slot', lang)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Футер тепер відображається ТІЛЬКИ якщо це мульти-вибір */}
      {multiSelect && (
        <View style={[styles.footer, { backgroundColor: themeColors.backgroundColor, borderTopColor: themeColors.borderColor }]}>
          <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
              onPress={() => onSave && onSave(tempSelected)}
              activeOpacity={0.8}
          >
              <Text style={[styles.saveBtnText, { color: '#fff' }]}>
                {t('common.save', lang)}
              </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 10 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftContainer: { flex: 1, justifyContent: 'center' },
  rightContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { fontSize: 16, fontWeight: "500" },
  hintText: { fontSize: 12, marginTop: 4, opacity: 0.8 },
  editButton: { padding: 4, borderRadius: 8 },
  columnWrapper: { gap: GRID_SPACING, marginBottom: GRID_SPACING },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionButtonsContainer: {
    marginTop: 10,
    gap: 12, 
  },
  actionButton: { 
    padding: 14, 
    borderRadius: 16, 
    alignItems: "center", 
    justifyContent: "center", 
    flexDirection: 'row', 
    borderWidth: 1, 
  },
  actionButtonText: { 
    fontWeight: "600", 
    fontSize: 16 
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: { 
    fontWeight: '700', 
    fontSize: 16 
  },
});