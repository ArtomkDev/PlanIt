import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useSchedule } from "../context/ScheduleProvider";
import { t } from "../utils/i18n";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global, schedule, isOnline, conflictQueue, cloudSyncState, lang } = useSchedule();
  
  const [statusMessage, setStatusMessage] = useState("");
  
  const prevOnlineRef = useRef(isOnline);
  const debounceTimeoutRef = useRef(null);
  const maxWaitTimeoutRef = useRef(null);
  const uiTimeoutRef = useRef(null);
  
  const heightAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user || !isDirty || !isOnline || isCloudSaving || cloudSyncState !== 'synced' || conflictQueue.length > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      saveNow();
    }, 2000);

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [schedule, global, isDirty, isOnline, isCloudSaving, cloudSyncState, conflictQueue.length, saveNow, user]);

  useEffect(() => {
    if (isDirty && isOnline && !isCloudSaving && cloudSyncState === 'synced' && conflictQueue.length === 0) {
      if (!maxWaitTimeoutRef.current) {
        maxWaitTimeoutRef.current = setTimeout(() => {
          saveNow();
          maxWaitTimeoutRef.current = null;
        }, 60000);
      }
    } else {
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
        maxWaitTimeoutRef.current = null;
      }
    }

    return () => {
      if (maxWaitTimeoutRef.current) clearTimeout(maxWaitTimeoutRef.current);
    };
  }, [isDirty, isOnline, isCloudSaving, cloudSyncState, conflictQueue.length, saveNow]);

  useEffect(() => {
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }

    if (!isOnline) {
      setStatusMessage(t('autosave.no_internet', lang));
      Animated.timing(colorAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();

      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 64, duration: 300, useNativeDriver: false }),
        Animated.timing(textOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: false })
      ]).start(() => {
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
      ]).start(() => {
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