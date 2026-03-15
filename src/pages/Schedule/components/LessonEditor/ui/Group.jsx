import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, LinearTransition, Easing } from "react-native-reanimated";

const isWeb = Platform.OS === "web";

// Використовуємо строгу і швидку анімацію (200мс).
const customLayoutTransition = isWeb 
  ? undefined 
  : LinearTransition.duration(200).easing(Easing.out(Easing.quad));

export default function Group({ title, children, onAdd, themeColors, showScopeToggle, scope, onScopeChange }) {
  
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
                {scope === "local" ? "Ця пара" : "Всі пари"}
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
              // Залишаємо тільки появу
              entering={isWeb ? undefined : FadeIn.duration(200)}
              // ВАЖЛИВО: Ми прибрали exiting та layout тут, щоб уникнути артефактів (zombie elements)
              // при "руйнуванні" екрану під час переходів.
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