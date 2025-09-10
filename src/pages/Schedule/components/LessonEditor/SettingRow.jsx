import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function SettingRow({ label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "Немає"} ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  label: { color: "#aaa", fontSize: 16 },
  value: { color: "#fff", fontSize: 16 },
});
