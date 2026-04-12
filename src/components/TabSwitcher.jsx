import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { triggerLightHaptic } from "../utils/haptics";

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
  const [tabLayouts, setTabLayouts] = useState({});
  const containerPadding = 4;
  
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;

  const handleTabLayout = (id, event) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => ({ ...prev, [id]: { x, width } }));
  };

  useEffect(() => {
    const currentLayout = tabLayouts[activeTab];
    if (currentLayout) {
      Animated.parallel([
        Animated.timing(indicatorPosition, {
          toValue: currentLayout.x,
          duration: 250,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          toValue: currentLayout.width,
          duration: 250,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [activeTab, tabLayouts]);

  const handlePress = (id) => {
    if (activeTab !== id) {
      triggerLightHaptic();
      onTabPress(id);
    }
  };

  const bgColorContainer = containerBackgroundColor || themeColors.backgroundColor2;
  const bgColorActive = activeTabBackgroundColor || themeColors.accentColor;
  const finalActiveTextColor = activeTextColor || (activeTabBackgroundColor ? themeColors.textColor : "#fff");

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: bgColorContainer, 
        padding: containerPadding,
        borderWidth: containerBorderColor ? StyleSheet.hairlineWidth : 0,
        borderColor: containerBorderColor 
      }
    ]}>
      {tabs.length > 0 && tabLayouts[tabs[0].id] && (
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              backgroundColor: bgColorActive,
              transform: [{ translateX: indicatorPosition }],
              width: indicatorWidth,
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
            key={tab.id}
            onLayout={(event) => handleTabLayout(tab.id, event)}
            style={styles.tab}
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
    top: 4, 
    bottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
});