import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Plus, ArrowsCounterClockwise } from "phosphor-react-native";
import Animated, { FadeIn, LinearTransition, Easing } from "react-native-reanimated";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";
import useReducedMotionPreference from "../../../../../hooks/useReducedMotionPreference";

const isWeb = Platform.OS === "web";

export default function Group({ title, children, onAdd, onReset, themeColors, showScopeToggle, scope, onScopeChange }) {
  const { lang } = useScheduleData();
  const reduceMotion = useReducedMotionPreference();
  const customLayoutTransition = isWeb || reduceMotion ? undefined : LinearTransition.duration(180).easing(Easing.out(Easing.quad));

  const handleScopeChange = () => {
    triggerHaptic(scope === "local" ? "toggleOff" : "toggleOn");
    onScopeChange(scope === "local" ? "global" : "local");
  };

  const handleAdd = () => {
    triggerHaptic("open");
    onAdd?.();
  };

  const handleReset = () => {
    triggerHaptic("warning");
    onReset?.();
  };

  return (
    <Animated.View 
      style={styles.container}
      layout={customLayoutTransition}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          {title.toUpperCase()}
        </Text>
        <View style={styles.headerRight}>
          
          {showScopeToggle && (
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: scope === "local" ? themeColors.accentColor : themeColors.backgroundColor2 }
              ]}
              onPress={handleScopeChange}
              activeOpacity={0.7}
              accessibilityRole="switch"
              accessibilityLabel={t('schedule.lesson_editor.selection', lang)}
              accessibilityState={{ checked: scope === "local" }}
              hitSlop={6}
            >
              <Text style={[styles.scopeText, { color: scope === "local" ? "#fff" : themeColors.textColor }]}>
                {scope === "local" ? t('schedule.lesson_editor.scope_local', lang) : t('schedule.lesson_editor.scope_global', lang)}
              </Text>
            </TouchableOpacity>
          )}

          {onAdd ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.iconButton, { backgroundColor: themeColors.backgroundColor2 }]}
              onPress={handleAdd}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.add', lang)}
              hitSlop={6}
            >
              <Plus size={18} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>
          ) : onReset ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.iconButton, { backgroundColor: themeColors.backgroundColor2 }]}
              onPress={handleReset}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.reset', lang)}
              hitSlop={6}
            >
              <ArrowsCounterClockwise size={18} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>
          ) : showScopeToggle ? (
            <View style={[styles.actionButton, styles.iconButton, { opacity: 0 }]} pointerEvents="none" />
          ) : null}

        </View>
      </View>
      
      <Animated.View 
        style={[styles.contentContainer, { backgroundColor: themeColors.backgroundColor2 }]}
        layout={customLayoutTransition}
      >
        {React.Children.map(children, (child, index) => {
          if (!child) return null;
          
          const isLast = index === React.Children.count(children) - 1;
          const itemKey = child.key ? child.key : `group-item-${index}`;

          return (
            <Animated.View 
              key={itemKey}
              entering={isWeb || reduceMotion ? undefined : FadeIn.duration(160).easing(Easing.out(Easing.quad))}
            >
              {child}
              {!isLast && <View style={[styles.separator, { backgroundColor: themeColors.borderColor || "#ccc" }]} />}
            </Animated.View>
          );
        })}
      </Animated.View>
    </Animated.View>
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
    minHeight: 30,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    paddingHorizontal: 0,
  },
  scopeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  contentContainer: {
    borderRadius: 12,
    overflow: "hidden", 
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
});
