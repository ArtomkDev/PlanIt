import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Group({ title, children }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 20,
    marginBottom: 10,
  },
  groupTitle: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
    paddingHorizontal: 20,
    textTransform: "uppercase",
  },
});
