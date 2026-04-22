import React from "react";
import { TouchableOpacity, Text, StyleSheet, Platform, View } from "react-native";

const isAndroid = Platform.OS === "android";

export default function SettingsActionRow({ icon: Icon, label, onPress, danger = false, themeColors }) {
  const color = danger ? '#FF3B30' : themeColors.accentColor;
  const bg = danger ? '#FF3B3015' : (isAndroid ? themeColors.accentColor + '08' : 'transparent');
  const borderStyle = isAndroid ? 'solid' : (danger ? 'solid' : 'dashed');

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { 
          borderColor: color, 
          backgroundColor: bg, 
          borderStyle 
        }
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {Icon && (
          <View style={[styles.iconContainer, { backgroundColor: danger ? '#FF3B3015' : themeColors.accentColor + '15' }]}>
            <Icon size={20} color={color} weight={isAndroid ? "regular" : "bold"} />
          </View>
        )}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginHorizontal: 0, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    minHeight: 56, 
    marginBottom: 8,
    justifyContent: 'center'
  },
  content: { 
    flexDirection: 'row', 
    alignItems: "center",
  },
  iconContainer: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    justifyContent: "center", 
    alignItems: "center", 
    marginRight: 12 
  },
  label: { 
    fontWeight: "700", 
    fontSize: 16 
  }
});