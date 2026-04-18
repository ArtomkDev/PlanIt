import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, Platform } from "react-native";
import { CaretRight } from "phosphor-react-native";
import Animated, { FadeIn, Easing } from "react-native-reanimated";

const isWeb = Platform.OS === "web";

export default function SettingRow({ 
  label, 
  value, 
  onPress, 
  onLongPress, 
  themeColors, 
  icon: Icon,
  rightContent 
}) {
  return (
    <TouchableOpacity 
      style={styles.row} 
      onPress={onPress} 
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        {Icon && (
          <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + '20' }]}>
            <Icon size={20} color={themeColors.accentColor} weight="fill" />
          </View>
        )}
        <Text style={[styles.label, { color: themeColors.textColor }]}>{label}</Text>
      </View>

      <View style={styles.right}>
        {rightContent ? (
          rightContent
        ) : (
          <Animated.Text 
            key={value}
            entering={isWeb ? undefined : FadeIn.duration(250).easing(Easing.out(Easing.quad))}
            style={[styles.value, { color: themeColors.textColor2 }]} 
            numberOfLines={1}
          >
            {value}
          </Animated.Text>
        )}
        <CaretRight size={18} color={themeColors.textColor3 || "#aaa"} weight="bold" style={{marginLeft: 6}}/>
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
  value: { fontSize: 16, textAlign: 'right', flexShrink: 1 },
});