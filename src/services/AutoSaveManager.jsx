import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useScheduleData, useScheduleSync } from "../context/ScheduleProvider";
import { t } from "../utils/i18n";

export default function AutoSaveManager() {
  const { isOnline } = useScheduleSync();
  const { user, lang } = useScheduleData();
  
  const [statusMessage, setStatusMessage] = useState("");
  
  const prevOnlineRef = useRef(isOnline);
  const uiTimeoutRef = useRef(null);
  
  const heightAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }

    if (!isOnline) {
      setStatusMessage(t('autosave.no_internet', lang));
      Animated.timing(colorAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();

      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 64, duration: 300, useNativeDriver: false }),
        Animated.timing(textOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: false })
      ]).start(({ finished }) => {
        if (!active || !finished) return;
        uiTimeoutRef.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(heightAnim, { toValue: 6, duration: 300, useNativeDriver: false }),
            Animated.timing(textOpacityAnim, { toValue: 0, duration: 300, useNativeDriver: false })
          ]).start();
        }, 4000);
      });
    } else if (prevOnlineRef.current === false) {
      setStatusMessage(t('autosave.internet_restored', lang));
      Animated.timing(colorAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();

      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 64, duration: 300, useNativeDriver: false }),
        Animated.timing(textOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: false })
      ]).start(({ finished }) => {
        if (!active || !finished) return;
        uiTimeoutRef.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(heightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
            Animated.timing(textOpacityAnim, { toValue: 0, duration: 300, useNativeDriver: false })
          ]).start();
        }, 4000);
      });
    }

    prevOnlineRef.current = isOnline;

    return () => {
      active = false;
      heightAnim.stopAnimation();
      textOpacityAnim.stopAnimation();
      colorAnim.stopAnimation();
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [isOnline, lang, heightAnim, textOpacityAnim, colorAnim]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FF3B30", "#34C759"]
  });

  const textColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#000000", "#FFFFFF"]
  });

  const dynamicPaddingTop = heightAnim.interpolate({
    inputRange: [0, 6, 64],
    outputRange: [0, 0, 16]
  });

  if (!user) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          height: heightAnim, 
          backgroundColor: backgroundColor,
          paddingTop: dynamicPaddingTop,
        }
      ]}
    >
      <Animated.Text style={[styles.text, { opacity: textOpacityAnim, color: textColor }]}>
        {statusMessage}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
