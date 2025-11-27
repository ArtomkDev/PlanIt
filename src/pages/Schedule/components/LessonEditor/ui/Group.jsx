import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Group({ title, children, onAdd, themeColors }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          {title.toUpperCase()}
        </Text>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add-circle" size={24} color={themeColors.accentColor} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={[styles.contentContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
        {React.Children.map(children, (child, index) => {
          if (!child) return null;
          // Додаємо лінію розділення, якщо це не останній елемент
          const isLast = index === React.Children.count(children) - 1;
          return (
            <View>
              {child}
              {!isLast && <View style={[styles.separator, { backgroundColor: themeColors.borderColor || '#ccc' }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  contentContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50, // Відступ під іконку
  },
});