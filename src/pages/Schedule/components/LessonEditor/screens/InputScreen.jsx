import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function LessonEditorInputScreen({
  title,
  initialValue,
  placeholder,
  onSave,        
  onSaveLocal,   
  onSaveGlobal,
  onReset,
  themeColors,
}) {
  const [value, setValue] = useState(initialValue || "");

  // 🔥 ВИПРАВЛЕННЯ: Слідкуємо за зміною initialValue
  // Коли натискається "Скинути", батьківський компонент передає сюди нове (стандартне) значення.
  // Цей ефект оновлює текст у полі вводу.
  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textColor2 }]}>
        {title}
      </Text>
      
      <TextInput
        style={[
          styles.input,
          { 
            backgroundColor: themeColors.backgroundColor2, 
            color: themeColors.textColor 
          }
        ]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textColor2}
        autoFocus
      />

      {/* Якщо тільки одна кнопка (старий режим) */}
      {onSave && !onSaveLocal && (
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.accentColor }]} onPress={() => onSave(value)}>
          <Text style={[styles.saveButtonText, { color: "#fff" }]}>Зберегти</Text>
        </TouchableOpacity>
      )}

      {/* 🔥 Новий режим: Футер з кнопками */}
      {(onSaveLocal && onSaveGlobal) && (
        <View style={styles.footerContainer}>
            
            {/* 1. Скинути (на всю ширину) */}
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

            {/* 2. Ряд кнопок збереження */}
            <View style={styles.buttonRow}>
                <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
                    onPress={() => onSaveLocal(value)}
                >
                    <Text style={[styles.saveBtnText, { color: "#fff" }]}>Тільки ця пара</Text>
                    <Text style={[styles.saveBtnSub, { color: 'rgba(255,255,255,0.7)' }]}>Локально</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: themeColors.backgroundColor2 }]} 
                    onPress={() => onSaveGlobal(value)}
                >
                    <Text style={[styles.saveBtnText, { color: themeColors.textColor }]}>Усі пари предмету</Text>
                    <Text style={[styles.saveBtnSub, { color: themeColors.textColor2 }]}>Глобально</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  label: { fontSize: 14, marginBottom: 8, marginLeft: 4, fontWeight: "500" },
  input: { padding: 14, borderRadius: 12, fontSize: 17, marginBottom: 20 },
  
  // Стара кнопка
  saveButton: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "600" },

  // Новий блок
  footerContainer: {
      gap: 12,
      marginTop: 10,
  },
  resetBtn: {
      width: '100%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: 4,
  },
  resetText: {
      fontSize: 15,
      fontWeight: '600',
  },
  buttonRow: { 
      flexDirection: 'row', 
      gap: 12 
  },
  saveBtn: { 
      flex: 1, 
      paddingVertical: 14, 
      borderRadius: 12, 
      alignItems: 'center', 
      justifyContent: 'center' 
  },
  saveBtnText: { fontWeight: '700', fontSize: 15 },
  saveBtnSub: { fontSize: 11, marginTop: 2 },
});