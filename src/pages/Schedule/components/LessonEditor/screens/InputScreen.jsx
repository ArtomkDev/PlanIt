import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function LessonEditorInputScreen({
  title,
  initialValue,
  placeholder,
  onSave,
  themeColors,
}) {
  const [value, setValue] = useState(initialValue || "");

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

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: themeColors.accentColor }]}
        onPress={() => onSave(value)}
      >
        <Text style={[styles.saveButtonText, { color: "#fff" }]}>
          Зберегти
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: "500",
  },
  input: {
    padding: 14,
    borderRadius: 12,
    fontSize: 17,
    marginBottom: 20,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});