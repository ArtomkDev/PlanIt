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

  const renderItem = ({ item }) => {
    const isSelected = tempSelected.includes(item.key);
    const isAlreadySelected = alreadySelected.includes(item.key) && item.key !== 'none';
    const IconComponent = item.iconComponent;

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
        disabled={isAlreadySelected}
        onLongPress={() => onEdit && onEdit(item.key)}
        delayLongPress={300}
        activeOpacity={0.7}
      >
        <View style={styles.leftContainer}>
          <Text style={[styles.optionText, { color: themeColors.textColor }, isSelected && { color: themeColors.accentColor, fontWeight: "bold" }]}>
            {item.label}
          </Text>
          {isAlreadySelected && (
            <Text style={[styles.hintText, { color: themeColors.accentColor, opacity: 1 }]}>Вже додано до пари</Text>
          )}
          {onEdit && !isAlreadySelected && (
            <Text style={[styles.hintText, { color: themeColors.textColor2 }]}>Затисніть для редагування</Text>
          )}
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color={themeColors.accentColor} />}
      </TouchableOpacity>
    );
  };

  const hasFooter = multiSelect || onReset;

  return (
    <View style={styles.container}>
      <FlatList
        key={layout} 
        data={options}
        keyExtractor={(item) => String(item.key)} 
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, hasFooter && { paddingBottom: 140 }]}
        numColumns={layout === 'grid' ? COLUMNS : 1}
        columnWrapperStyle={layout === 'grid' ? styles.columnWrapper : null}
        ListFooterComponent={onAdd && (<TouchableOpacity style={[styles.addButton, { borderColor: themeColors.accentColor }]} onPress={onAdd}><Text style={[styles.addButtonText, { color: themeColors.accentColor }]}>+ Додати новий</Text></TouchableOpacity>)}
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
  option: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftContainer: { flex: 1 },
  optionText: { fontSize: 16 },
  hintText: { fontSize: 11, marginTop: 2, opacity: 0.7 },
  columnWrapper: { gap: GRID_SPACING, marginBottom: GRID_SPACING },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  addButton: { padding: 14, borderRadius: 12, alignItems: "center", marginTop: 10, borderWidth: 1, borderStyle: 'dashed' },
  addButtonText: { fontWeight: "600", fontSize: 16 },
  
  footer: { 
      padding: 16, 
      borderTopWidth: StyleSheet.hairlineWidth, 
      position: 'absolute', 
      bottom: 0, 
      left: 0, 
      right: 0,
      gap: 12 
  },
  resetBtn: {
      width: '100%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: 12,
  },
  resetText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { 
      width: '100%', 
      paddingVertical: 14, 
      borderRadius: 12, 
      alignItems: 'center', 
      justifyContent: 'center' 
  },
  saveBtnText: { fontWeight: '700', fontSize: 16 },
});