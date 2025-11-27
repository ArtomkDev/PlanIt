import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function LinkEditor({ linkId, onBack, themeColors }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const link = schedule?.links.find((l) => l.id === linkId);

  const [name, setName] = useState(link?.name || "");
  const [url, setUrl] = useState(link?.url || "");

  useEffect(() => {
    if (link) {
      setName(link.name);
      setUrl(link.url);
    }
  }, [linkId]);

  const handleSave = () => {
    setScheduleDraft((prev) => {
      const next = { ...prev };
      next.links = prev.links.map((l) =>
        l.id === linkId ? { ...l, name, url } : l
      );
      return next;
    });
    onBack();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textColor2 }]}>Назва посилання</Text>
      <TextInput
        style={[styles.input, { backgroundColor: themeColors.backgroundColor3, color: themeColors.textColor }]}
        placeholder="Напр. Zoom лекція"
        placeholderTextColor={themeColors.textColor2}
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { color: themeColors.textColor2 }]}>URL адреса</Text>
      <TextInput
        style={[styles.input, { backgroundColor: themeColors.backgroundColor3, color: themeColors.textColor }]}
        placeholder="https://..."
        placeholderTextColor={themeColors.textColor2}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.backgroundColor3 }]} 
            onPress={onBack}
        >
          <Text style={[styles.buttonText, { color: themeColors.textColor }]}>Скасувати</Text>
        </TouchableOpacity>

        <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.accentColor }]} 
            onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: "#fff" }]}>Зберегти</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  label: { fontSize: 14, marginBottom: 6, marginLeft: 4 },
  input: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});