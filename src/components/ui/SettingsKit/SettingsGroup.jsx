import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, { FadeIn, LinearTransition, Easing } from "react-native-reanimated";

const isAndroid = Platform.OS === "android";
const isWeb = Platform.OS === "web";
const customLayoutTransition = isWeb ? undefined : LinearTransition.duration(200).easing(Easing.out(Easing.quad));

export default function SettingsGroup({ 
  title, 
  children, 
  themeColors, 
  headerRight,
  contentStyle 
}) {
  const validChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <Animated.View style={styles.container} layout={customLayoutTransition}>
      {(title || headerRight) && (
        <View style={styles.header}>
          {title ? (
            <Text style={[
              styles.title, 
              { color: isAndroid ? themeColors.accentColor : themeColors.textColor2 }
            ]}>
              {isAndroid ? title : title.toUpperCase()}
            </Text>
          ) : <View />}
          
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}
      
      <Animated.View 
        style={[
          styles.contentContainer, 
          !isAndroid && { 
            backgroundColor: themeColors.backgroundColor2,
            borderRadius: 12,
            overflow: "hidden",
          },
          contentStyle
        ]}
        layout={customLayoutTransition}
      >
        {validChildren.map((child, index) => {
          const isLast = index === validChildren.length - 1;
          
          return (
            <Animated.View 
              key={child.key || `sg-item-${index}`} 
              entering={isWeb ? undefined : FadeIn.duration(200)}
            >
              {child}
              {!isLast && !isAndroid && (
                <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />
              )}
            </Animated.View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginBottom: isAndroid ? 12 : 24,
    width: '100%',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
    paddingHorizontal: 16, 
  },
  title: {
    fontSize: isAndroid ? 14 : 13,
    fontWeight: isAndroid ? "700" : "400",
    letterSpacing: isAndroid ? 0 : 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contentContainer: {
    marginHorizontal: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56, 
  },
});