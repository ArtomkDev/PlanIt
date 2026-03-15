import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function LessonEditorInputScreen({
  title,
  initialValue,
  placeholder,
  onSave,
  onReset,
  themeColors,
}) {
  const [value, setValue] = useState(initialValue || "");

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

      <View style={styles.footerContainer}>
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

          {onSave && (
              <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
                  onPress={() => onSave(value)}
              >
                  <Text style={[styles.saveBtnText, { color: "#fff" }]}>Зберегти</Text>
              </TouchableOpacity>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  label: { fontSize: 14, marginBottom: 8, marginLeft: 4, fontWeight: "500" },
  input: { padding: 14, borderRadius: 12, fontSize: 17, marginBottom: 20 },
  
  footerContainer: { gap: 12 },
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