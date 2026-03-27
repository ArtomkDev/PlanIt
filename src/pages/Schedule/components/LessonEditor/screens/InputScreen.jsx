import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

export default function LessonEditorInputScreen({
  title,
  initialValue,
  placeholder,
  onSave,
  themeColors,
}) {
  const { global } = useSchedule();
  const lang = global?.language || 'uk';
  const [value, setValue] = useState(initialValue || "");

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textColor2 }]}>
        {title}
      </Text>
      
      <View style={[styles.inputWrapper, { backgroundColor: themeColors.backgroundColor2 }]}>
        <TextInput
          style={[styles.input, { color: themeColors.textColor }]}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textColor2}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => onSave && onSave(value)}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => setValue("")} style={styles.clearButton} hitSlop={15}>
            <Ionicons name="close-circle" size={20} color={themeColors.textColor2} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footerContainer}>
        {onSave && (
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
            onPress={() => onSave(value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveBtnText, { color: "#fff" }]}>
              {t('common.save', lang)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 30, 
  },
  label: { 
    fontSize: 13, 
    textTransform: 'uppercase', 
    fontWeight: "600", 
    marginBottom: 8, 
    marginLeft: 4, 
    letterSpacing: 0.5 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 24, 
  },
  input: { 
    flex: 1,
    paddingVertical: 14, 
    fontSize: 17, 
    fontWeight: '500'
  },
  clearButton: {
    paddingLeft: 10,
  },
  footerContainer: { 
    gap: 12 
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