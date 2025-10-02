import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Plus } from "lucide-react-native"; // або свій ікон-пакет

export default function Group({ title, children, onAdd }) {
  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <Text style={styles.groupTitle}>{title}</Text>
        {onAdd && (
          <TouchableOpacity style={styles.addButton} onPress={onAdd}>
            <Plus color="#fff" size={18} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 20,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  groupTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#222",
  },
  content: {
    gap: 10,
    paddingHorizontal: 20,
  },
});
