import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Trash, XCircle } from "phosphor-react-native";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";

export default function LessonEditorInputScreen({
  title,
  initialValue,
  placeholder,
  onSave,
  onDelete,
  themeColors,
  saveLabel,
  autoFocusDelayMs = 0,
}) {
  const { lang } = useScheduleData();

  const inputRef = useRef(null);
  const [value, setValue] = useState(initialValue || "");

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  useEffect(() => {
    if (!autoFocusDelayMs) return undefined;
    const timer = setTimeout(() => {
      inputRef.current?.focus?.();
    }, autoFocusDelayMs);
    return () => clearTimeout(timer);
  }, [autoFocusDelayMs]);

  const handleSave = () => {
    triggerHaptic("success");
    onSave?.(value);
  };

  const handleClear = () => {
    triggerHaptic("selection");
    setValue("");
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textColor2 }]}>
        {title}
      </Text>
      
      <View style={[styles.inputWrapper, { backgroundColor: themeColors.backgroundColor2 }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: themeColors.textColor }]}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textColor2}
          autoFocus={!autoFocusDelayMs}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          accessibilityLabel={title}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton} hitSlop={15} accessibilityRole="button" accessibilityLabel={t('common.clear', lang)}>
            <XCircle size={22} color={themeColors.textColor2} weight="fill" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footerContainer}>
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('schedule.lesson_editor.delete_entity', lang)}
          >
            <Trash size={19} color="#DC2626" weight="bold" />
            <Text style={styles.deleteBtnText}>
              {t('schedule.lesson_editor.delete_entity', lang)}
            </Text>
          </TouchableOpacity>
        )}
        {onSave && (
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} 
            onPress={handleSave}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={saveLabel || t('common.save', lang)}
          >
            <Text style={[styles.saveBtnText, { color: "#fff" }]}>
              {saveLabel || t('common.save', lang)}
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
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  footerContainer: { 
    gap: 12 
  },
  deleteBtn: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
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
