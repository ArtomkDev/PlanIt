import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, Platform } from "react-native";
import { CaretRight } from "phosphor-react-native";

const isAndroid = Platform.OS === "android";

export default function SettingsRow({ 
  label, 
  desc,
  value, 
  icon: Icon,
  onPress, 
  themeColors, 
  rightContent,
  danger = false, 
  showCaret = true, 
  disabled = false,
  iconColor,
  iconBgColor,
  iconWeight,
}) {
  const Component = onPress ? TouchableOpacity : View;
  
  const mainColor = danger ? '#FF3B30' : themeColors.textColor;
  const calculatedIconColor = iconColor || (danger ? '#FF3B30' : themeColors.accentColor);
  const calculatedIconBgColor = iconBgColor || (danger ? '#FF3B3015' : themeColors.accentColor + '15');
  
  return (
    <Component 
      style={[
        styles.row, 
        disabled && styles.disabled,
        isAndroid ? { 
          backgroundColor: themeColors.backgroundColor2,
          borderRadius: 12, 
          marginBottom: 6,
        } : {
          backgroundColor: 'transparent', 
        }
      ]} 
      onPress={onPress} 
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={styles.left}>
        {Icon && (
          <View style={[styles.iconContainer, { backgroundColor: calculatedIconBgColor }]}>
            <Icon size={20} color={calculatedIconColor} weight={iconWeight || "regular"} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: mainColor }]}>{label}</Text>
          {!!desc && <Text style={[styles.desc, { color: themeColors.textColor2 }]}>{desc}</Text>}
        </View>
      </View>

      <View style={styles.right}>
        {rightContent || (!!value && <Text style={[styles.value, { color: themeColors.textColor2 }]}>{value}</Text>)}
        {showCaret && !!onPress && <CaretRight size={18} color={themeColors.textColor3 || "#aaa"} weight="bold" style={styles.caret} />}
      </View>
    </Component>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  left: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  textContainer: { flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", flex: 0.8, justifyContent: 'flex-end' },
  iconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
  label: { fontSize: 16, fontWeight: "500" },
  desc: { fontSize: 13, marginTop: 2 },
  value: { fontSize: 16, textAlign: 'right' },
  caret: { marginLeft: 6 },
  disabled: { opacity: 0.5 }
});