import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, LinearTransition, Easing } from "react-native-reanimated";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

const isWeb = Platform.OS === "web";

const customLayoutTransition = isWeb 
  ? undefined 
  : LinearTransition.duration(200).easing(Easing.out(Easing.quad));

export default function Group({ title, children, onAdd, onReset, themeColors, showScopeToggle, scope, onScopeChange }) {
  const { global , lang} = useSchedule();

  const handleScopeChange = () => {
    onScopeChange(scope === "local" ? "global" : "local");
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
            >
              <Text style={[styles.scopeText, { color: scope === "local" ? "#fff" : themeColors.textColor }]}>
                {scope === "local" ? t('schedule.lesson_editor.scope_local', lang) : t('schedule.lesson_editor.scope_global', lang)}
              </Text>
            </TouchableOpacity>
          )}

          {onAdd ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.iconButton, { backgroundColor: themeColors.backgroundColor2 }]}
              onPress={onAdd}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={themeColors.textColor} />
            </TouchableOpacity>
          ) : onReset ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.iconButton, { backgroundColor: themeColors.backgroundColor2 }]}
              onPress={onReset}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color={themeColors.textColor} />
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
              entering={isWeb ? undefined : FadeIn.duration(200)}
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
    height: 30, 
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    width: 36, 
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