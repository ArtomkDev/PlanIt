import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Імпортуємо оновлені редактори
import TeacherEditor from "./TeacherEditor";
import LinkEditor from "./LinkEditor";

export default function OptionListModal({
  visible,
  title,
  options,
  type, // 'teacher', 'link', 'subject'
  onSelect,
  selectedValues = [],
  multiSelect = false,
  onClose,
  onAddNew,
  onUpdate,
  themeColors, // 🔥 Отримуємо тему
}) {
  // Стейт для навігації всередині модалки: 'list', 'edit_teacher', 'edit_link', 'edit_simple'
  const [viewMode, setViewMode] = useState("list");
  
  // Дані елемента, який редагуємо
  const [editingItem, setEditingItem] = useState(null);
  
  // Для простого перейменування (наприклад, предметів)
  const [simpleEditValue, setSimpleEditValue] = useState("");

  const [tempSelected, setTempSelected] = useState([]);

  useEffect(() => {
    if (visible) {
      resetState();
      setTempSelected(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
    }
  }, [visible, selectedValues]);

  const resetState = () => {
    setViewMode("list");
    setEditingItem(null);
    setSimpleEditValue("");
  };

  const handlePressItem = (key) => {
    if (multiSelect) {
      setTempSelected((prev) => {
        if (prev.includes(key)) {
          return prev.filter((id) => id !== key);
        } else {
          return [...prev, key];
        }
      });
    } else {
      onSelect(key);
    }
  };

  const handleMultiSelectSave = () => {
    onSelect(tempSelected);
    onClose();
  };

  // --- ЛОГІКА ВХОДУ В РЕДАКТОР ---
  const startEditing = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingItem(item);

    if (type === "teacher") {
      setViewMode("edit_teacher");
    } else if (type === "link") {
      setViewMode("edit_link");
    } else {
      setSimpleEditValue(item.label);
      setViewMode("edit_simple");
    }
  };

  // --- ЛОГІКА ВИХОДУ З РЕДАКТОРА ---
  const goBackToList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode("list");
    setEditingItem(null);
  };

  const saveSimpleEditing = () => {
    if (onUpdate && editingItem) {
      onUpdate(editingItem.key, simpleEditValue);
    }
    goBackToList();
  };

  // --- РЕНДЕР СПИСКУ ---
  const renderItem = ({ item }) => {
    const isSelected = tempSelected.includes(item.key);

    return (
      <TouchableOpacity
        style={[
            styles.option, 
            { borderBottomColor: themeColors.borderColor || 'rgba(255,255,255,0.1)' },
            isSelected && multiSelect && { backgroundColor: themeColors.accentColor + '20', borderRadius: 8, borderBottomColor: 'transparent' }
        ]}
        onPress={() => handlePressItem(item.key)}
        onLongPress={() => startEditing(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={{flex: 1}}>
           <Text style={[
               styles.optionText, 
               { color: themeColors.textColor },
               isSelected && multiSelect && { color: themeColors.accentColor, fontWeight: "bold" }
           ]}>
            {item.label}
          </Text>
          <Text style={[styles.hintText, { color: themeColors.textColor2 }]}>
             Затисніть для редагування
          </Text>
        </View>
       
        {multiSelect && isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={themeColors.accentColor} />
        )}
      </TouchableOpacity>
    );
  };

  // --- РЕНДЕР ЗАГОЛОВКА ---
  const renderHeader = () => (
    <View style={styles.header}>
        {viewMode !== "list" && (
            <TouchableOpacity onPress={goBackToList} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color={themeColors.accentColor} />
                <Text style={[styles.backText, { color: themeColors.accentColor }]}>Назад</Text>
            </TouchableOpacity>
        )}
        
        <Text style={[styles.title, { color: themeColors.textColor }]}>
            {viewMode === "list" ? title : 
             viewMode === "edit_simple" ? "Перейменування" : 
             viewMode === "edit_teacher" ? "Редагування викладача" : 
             "Редагування посилання"}
        </Text>
        
        {/* Пустий блок для балансу заголовка */}
        {viewMode !== "list" && <View style={{width: 60}} />} 
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
          
          {renderHeader()}

          <View style={{ flex: 1 }}>
            {/* 1. СПИСОК */}
            {viewMode === "list" && (
              <>
                <FlatList
                    data={options}
                    keyExtractor={(item) => item.key.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
                
                <View style={styles.footerButtons}>
                    {multiSelect && (
                    <TouchableOpacity 
                        style={[styles.saveButton, { backgroundColor: themeColors.accentColor }]} 
                        onPress={handleMultiSelectSave}
                    >
                        <Text style={styles.saveButtonText}>Застосувати ({tempSelected.length})</Text>
                    </TouchableOpacity>
                    )}

                    <View style={styles.actionRow}>
                        {onAddNew && (
                        <TouchableOpacity 
                            style={[styles.addButton, { backgroundColor: themeColors.backgroundColor2 }]} 
                            onPress={onAddNew}
                        >
                            <Text style={[styles.addButtonText, { color: themeColors.textColor }]}>+ Створити</Text>
                        </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            style={[styles.closeButton]} 
                            onPress={onClose}
                        >
                            <Text style={[styles.closeText, { color: themeColors.accentColor }]}>Закрити</Text>
                        </TouchableOpacity>
                    </View>
                </View>
              </>
            )}

            {/* 2. РЕДАКТОР ВИКЛАДАЧА */}
            {viewMode === "edit_teacher" && (
                <TeacherEditor 
                    teacherId={editingItem?.key} 
                    onBack={goBackToList} 
                    themeColors={themeColors}
                />
            )}

            {/* 3. РЕДАКТОР ПОСИЛАННЯ */}
            {viewMode === "edit_link" && (
                <LinkEditor 
                    linkId={editingItem?.key} 
                    onBack={goBackToList} 
                    themeColors={themeColors}
                />
            )}

            {/* 4. ПРОСТЕ ПЕРЕЙМЕНУВАННЯ */}
            {viewMode === "edit_simple" && (
                <View style={{ paddingTop: 20 }}>
                    <Text style={[styles.label, { color: themeColors.textColor2 }]}>Нова назва</Text>
                    <TextInput
                        style={[styles.input, { 
                            backgroundColor: themeColors.backgroundColor2, 
                            color: themeColors.textColor 
                        }]}
                        value={simpleEditValue}
                        onChangeText={setSimpleEditValue}
                        autoFocus
                    />
                    <TouchableOpacity 
                        style={[styles.saveButton, { backgroundColor: themeColors.accentColor, marginTop: 10 }]} 
                        onPress={saveSimpleEditing}
                    >
                        <Text style={styles.saveButtonText}>Зберегти</Text>
                    </TouchableOpacity>
                </View>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    borderRadius: 20,
    padding: 20,
    maxHeight: "85%",
    minHeight: 300,
    width: "100%",
    // Тіні
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    minHeight: 30,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: { fontSize: 16 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: 'center',
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 10
  },
  optionText: {
    fontSize: 16,
  },
  hintText: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7
  },
  footerButtons: {
    marginTop: 15,
    gap: 10,
  },
  saveButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 5,
  },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  addButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginRight: 10
  },
  addButtonText: { fontWeight: "600", fontSize: 15 },
  closeButton: { 
    alignItems: "center", 
    padding: 10,
    flex: 0.5
  },
  closeText: { fontSize: 16, fontWeight: "500" },
  
  // Simple Edit
  label: { fontSize: 14, marginBottom: 8, marginLeft: 4 },
  input: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
  },
});