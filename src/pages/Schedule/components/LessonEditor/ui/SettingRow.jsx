import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SettingRow({ 
  label, 
  value, 
  onPress, 
  onLongPress, 
  themeColors, 
  icon,
  rightContent 
}) {
  return (
    <TouchableOpacity 
      style={styles.row} 
      onPress={onPress} 
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + '20' }]}>
            <Ionicons name={icon} size={20} color={themeColors.accentColor} />
          </View>
        )}
        <Text style={[styles.label, { color: themeColors.textColor }]}>{label}</Text>
      </View>

      <View style={styles.right}>
        {rightContent ? (
          rightContent
        ) : (
          <Text 
            style={[styles.value, { color: themeColors.textColor2 }]} 
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={themeColors.textColor3 || "#aaa"} style={{marginLeft: 6}}/>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  right: { flexDirection: "row", alignItems: "center", justifyContent: 'flex-end', flex: 0.8 },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  label: { fontSize: 16, fontWeight: "500" },
  value: { fontSize: 16, textAlign: 'right' },
});