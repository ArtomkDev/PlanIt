import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native"; // або своя іконка

export default function SettingRow({ label, onPress, onLongPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.iconWrapper}>
        <ChevronRight color="#fff" size={18} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#222",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  label: { color: "#fff", fontSize: 16 },
  iconWrapper: {
    marginLeft: 10,
  },
});
