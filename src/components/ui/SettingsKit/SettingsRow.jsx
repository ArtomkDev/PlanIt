import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, Platform } from "react-native";
import { CaretRight } from "phosphor-react-native";
import { triggerHaptic } from "../../../utils/haptics";

const isAndroid = Platform.OS === "android";

export default function SettingsRow({
  label,
  desc,
  value,
  icon: Icon,
  onPress,
  onLongPress,
  themeColors,
  rightContent,
  danger = false,
  showCaret = true,
  disabled = false,
  iconColor,
  iconBgColor,
  iconWeight,
  skipHaptic = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  rightContentPointerEvents = "auto",
}) {
  const Component = onPress ? TouchableOpacity : View;

  const mainColor = danger ? '#FF3B30' : themeColors.textColor;
  const calculatedIconColor = iconColor || (danger ? '#FF3B30' : themeColors.accentColor);
  const calculatedIconBgColor = iconBgColor || (danger ? '#FF3B3015' : themeColors.accentColor + '15');
  const resolvedAccessibilityLabel = accessibilityLabel || [label, typeof value === "string" ? value : null].filter(Boolean).join(", ");
  const resolvedAccessibilityRole = accessibilityRole || (onPress ? "button" : undefined);
  const resolvedAccessibilityState = onPress
    ? { disabled, ...(accessibilityState || {}) }
    : accessibilityState;

  const handlePress = () => {
    if (!onPress || disabled) return;
    if (!skipHaptic) triggerHaptic(danger ? "warning" : "selection");
    onPress();
  };

  const handleLongPress = () => {
    if (!onLongPress || disabled) return;
    triggerHaptic("longPress");
    onLongPress();
  };

  return (
    <Component
      accessibilityRole={resolvedAccessibilityRole}
      accessibilityLabel={onPress ? resolvedAccessibilityLabel : undefined}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      accessibilityState={resolvedAccessibilityState}
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
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
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

      <View style={styles.right} pointerEvents={rightContentPointerEvents}>
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
  left: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", marginRight: 12 },
  textContainer: { flex: 1, minWidth: 0 },
  right: { flexShrink: 0, maxWidth: "44%", flexDirection: "row", alignItems: "center", justifyContent: 'flex-end' },
  iconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
  label: { fontSize: 16, fontWeight: "500" },
  desc: { fontSize: 13, marginTop: 2 },
  value: { flexShrink: 1, fontSize: 16, textAlign: 'right' },
  caret: { marginLeft: 6 },
  disabled: { opacity: 0.5 }
});
