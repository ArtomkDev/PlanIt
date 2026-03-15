import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  onReset,
  onEdit,   
  onAdd,    
  themeColors,
  layout = 'list',
}) {
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

  // Витягуємо системну опцію 'none' (Видалити слот), щоб не показувати її в загальному списку
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
            <Text style={[styles.hintText, { color: themeColors.accentColor, opacity: 1 }]}>Вже додано до пари</Text>
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

  const hasFooter = multiSelect || onReset;

  return (
    <View style={styles.container}>
      <FlatList
        key={layout} 
        data={displayOptions}
        keyExtractor={(item) => String(item.key)} 
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, hasFooter && { paddingBottom: 140 }]}
        numColumns={layout === 'grid' ? COLUMNS : 1}
        columnWrapperStyle={layout === 'grid' ? styles.columnWrapper : null}
        ListFooterComponent={(onAdd || showRemoveSlot) && (
          <View style={styles.actionButtonsContainer}>
            {/* Кнопка "Додати новий" */}
            {onAdd && (
              <TouchableOpacity style={[styles.actionButton, { borderColor: themeColors.accentColor, borderStyle: 'dashed' }]} onPress={onAdd}>
                <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>Додати новий</Text>
              </TouchableOpacity>
            )}
            
            {/* Кнопка "Видалити слот" */}
            {showRemoveSlot && (
              <TouchableOpacity style={[styles.actionButton, { borderColor: '#EF4444', backgroundColor: '#EF444415', borderStyle: 'solid' }]} onPress={() => handlePressItem('none')}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Видалити слот</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {hasFooter && (
        <View style={[styles.footer, { backgroundColor: themeColors.backgroundColor, borderTopColor: themeColors.borderColor }]}>
          {onReset && (
            <TouchableOpacity 
                style={[styles.resetBtn, { borderColor: themeColors.borderColor }]} 
                onPress={onReset}
            >
                <Text style={[styles.resetText, { color: themeColors.accentColor }]}>
                    ↩ Скинути до стандартних
                </Text>
            </TouchableOpacity>
          )}

          {multiSelect && (
            <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
                onPress={() => onSave && onSave(tempSelected)}
            >
                <Text style={[styles.saveBtnText, { color: '#fff' }]}>Зберегти</Text>
            </TouchableOpacity>
          )}
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
  
  // Стилі для кнопок у футері списку
  actionButtonsContainer: {
    marginTop: 10,
    gap: 12, // Відстань між кнопками (працює в нових версіях RN)
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
  
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, position: 'absolute', bottom: 0, left: 0, right: 0, gap: 12 },
  resetBtn: { width: '100%', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  resetText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontWeight: '700', fontSize: 16 },
});