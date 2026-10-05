import React, { useLayoutEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { triggerHaptic } from "../../utils/haptics";
import useReducedMotionPreference from "../../hooks/useReducedMotionPreference";

export default function TabSwitcher({
  tabs,
  activeTab,
  onTabPress,
  themeColors,
  containerBackgroundColor,
  containerBorderColor,
  activeTabBackgroundColor,
  activeTextColor, 
  withShadow = false,
}) {
  const tabsKey = JSON.stringify(tabs.map(tab => tab.id));
  const [measurements, setMeasurements] = useState({ key: tabsKey, layouts: {} });
  const containerPadding = 4;
  const reduceMotion = useReducedMotionPreference();
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const previousLayout = useRef(null);
  const activeLayout = measurements.key === tabsKey && tabs.some(tab => tab.id === activeTab)
    ? measurements.layouts[activeTab]
    : undefined;

  const handleTabLayout = (id, event) => {
    const { x, width } = event.nativeEvent.layout;
    if (width <= 0) return;
    setMeasurements(prev => {
      const layouts = prev.key === tabsKey ? prev.layouts : {};
      if (layouts[id]?.x === x && layouts[id]?.width === width) return prev;
      return { key: tabsKey, layouts: { ...layouts, [id]: { x, width } } };
    });
  };

  useLayoutEffect(() => {
    const previous = previousLayout.current;
    if (!activeLayout) {
      previousLayout.current = null;
      return;
    }
    previousLayout.current = { id: activeTab, key: tabsKey, ...activeLayout };
    if (reduceMotion || !previous || previous.key !== tabsKey
      || previous.id === activeTab || previous.width !== activeLayout.width) {
      indicatorPosition.setValue(activeLayout.x);
      return;
    }
    const animation = Animated.timing(indicatorPosition, {
      toValue: activeLayout.x,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [activeTab, activeLayout?.x, activeLayout?.width, tabsKey, reduceMotion, indicatorPosition]);

  const handlePress = (id) => {
    if (activeTab !== id) {
      triggerHaptic("tab");
      onTabPress(id);
    }
  };

  const bgColorContainer = containerBackgroundColor || themeColors.backgroundColor2;
  const bgColorActive = activeTabBackgroundColor || themeColors.accentColor;
  const finalActiveTextColor = activeTextColor || (activeTabBackgroundColor ? themeColors.textColor : "#fff");

  return (
    <View accessibilityRole="tablist" style={[
      styles.container, 
      { 
        backgroundColor: bgColorContainer, 
        padding: containerPadding,
        borderWidth: containerBorderColor ? StyleSheet.hairlineWidth : 0,
        borderColor: containerBorderColor 
      }
    ]}>
      {activeLayout && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.activeIndicator,
            {
              backgroundColor: bgColorActive,
              transform: [{ translateX: indicatorPosition }],
              width: activeLayout.width,
              borderRadius: 8,
            },
            withShadow && styles.shadow,
          ]}
        />
      )}

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            key={`${tabsKey}:${tab.id}`}
            onLayout={(event) => handleTabLayout(tab.id, event)}
            style={[styles.tab, isActive && !activeLayout && { backgroundColor: bgColorActive }]}
            onPress={() => handlePress(tab.id)}
            activeOpacity={0.9}
          >
            <View style={styles.tabContent}>
              {tab.colorDot && (
                <View style={[styles.colorDot, { backgroundColor: tab.colorDot }]} />
              )}
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? finalActiveTextColor : themeColors.textColor },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 12,
    marginBottom: 16,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 4, 
    bottom: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  colorDot: {
    flexShrink: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  tabText: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
});
