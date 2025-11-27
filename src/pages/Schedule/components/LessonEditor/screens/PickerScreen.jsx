import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function LessonEditorPickerScreen({
  options,
  selectedValues = [], // Масив ID (навіть для одиночного вибору)
  multiSelect = false,
  onSelect,
  onEdit,   
  onAdd,    
  themeColors,
}) {
  const [tempSelected, setTempSelected] = useState([]);

  useEffect(() => {
    setTempSelected(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
  }, [selectedValues]);

  const handlePressItem = (key) => {
    if (multiSelect) {
      // Логіка для множинного вибору (Вчителі, Посилання)
      setTempSelected((prev) => {
        const newSelection = prev.includes(key)
          ? prev.filter((id) => id !== key)
          : [...prev, key];
        
        onSelect(newSelection); 
        return newSelection;
      });
    } else {
      // Логіка для одиночного вибору (Предмет, Тип)
      onSelect(key); // Одразу відправляємо вибір
      // Повернення назад (goBack) обробляється у батьківському компоненті після виклику onSelect
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = tempSelected.includes(item.key);

    return (
      <TouchableOpacity
        style={[
          styles.option,
          { 
            backgroundColor: themeColors.backgroundColor2,
            borderColor: isSelected ? themeColors.accentColor : 'transparent',
            borderWidth: 1
          }
        ]}
        onPress={() => handlePressItem(item.key)}
        onLongPress={() => onEdit && onEdit(item.key)}
        delayLongPress={300}
        activeOpacity={0.7}
      >
        <View style={styles.textContainer}>
          <Text style={[
            styles.optionText, 
            { color: themeColors.textColor },
            isSelected && { color: themeColors.accentColor, fontWeight: "bold" }
          ]}>
            {item.label}
          </Text>
          {onEdit && (
            <Text style={[styles.hintText, { color: themeColors.textColor2 }]}>
               Затисніть для редагування
            </Text>
          )}
        </View>
       
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={themeColors.accentColor} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={options}
        keyExtractor={(item) => item.key.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          onAdd && (
            <TouchableOpacity 
              style={[styles.addButton, { borderColor: themeColors.accentColor }]} 
              onPress={onAdd}
            >
              <Text style={[styles.addButtonText, { color: themeColors.accentColor }]}>
                + Додати новий
              </Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: { flex: 1 },
  optionText: { fontSize: 16 },
  hintText: { fontSize: 11, marginTop: 2, opacity: 0.7 },
  addButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: { fontWeight: "600", fontSize: 16 },
});