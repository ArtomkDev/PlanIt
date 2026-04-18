import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  ScrollView, 
  Platform 
} from "react-native";
import { TextT, Link as LinkIcon } from "phosphor-react-native";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

export default function LinkEditor({ linkId, localLinkData, onSaveLocal, onBack, themeColors }) {
  const { lang } = useSchedule();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (localLinkData) {
      setName(localLinkData.name || "");
      setUrl(localLinkData.url || "");
    }
  }, [localLinkData]);

  const handleSave = () => {
    onSaveLocal({
      ...localLinkData,
      id: linkId,
      name: name.trim() || t('schedule.lesson_editor.new_link_default', lang),
      url: url.trim()
    });
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 0} 
    >
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t('schedule.lesson_editor.link_name_label', lang)}
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
            <TextT size={20} color={themeColors.textColor2} weight="bold" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: themeColors.textColor }]}
              placeholder={t('schedule.lesson_editor.link_name_placeholder', lang)}
              placeholderTextColor={themeColors.textColor2 + '80'}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t('schedule.lesson_editor.link_url_label', lang)}
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
            <LinkIcon size={20} color={themeColors.textColor2} weight="bold" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: themeColors.textColor }]}
              placeholder="https://..."
              placeholderTextColor={themeColors.textColor2 + '80'}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 40 }} />

        <View style={styles.buttonRow}>
          <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { backgroundColor: themeColors.backgroundColor2 }]} 
              onPress={onBack}
          >
            <Text style={[styles.buttonText, { color: themeColors.textColor }]}>
              {t('common.cancel', lang)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
              style={[styles.button, styles.saveButton, { backgroundColor: themeColors.accentColor }]} 
              onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>
              {t('common.save_changes', lang)}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 30 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, height: 54 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, height: "100%" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 20 },
  button: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancelButton: { borderWidth: 0 },
  saveButton: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});