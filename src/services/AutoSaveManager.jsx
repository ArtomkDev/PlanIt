import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Pressable } from "react-native";
import { useSchedule } from "../context/ScheduleProvider";
import { t } from "../utils/i18n";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global, schedule, isOnline, conflictQueue, cloudSyncState , lang} = useSchedule();
  
  const [statusMessage, setStatusMessage] = useState("");
  const prevMessageRef = useRef("");

  const debounceTimeoutRef = useRef(null);
  const maxWaitTimeoutRef = useRef(null);
  
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bgColorAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

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
    let shouldShow = false;
    let newMessage = "";
    let newColorVal = 0;

    if (conflictQueue.length > 0) {
      shouldShow = false; 
    } else if (!isOnline) {
      newMessage = t('autosave.no_internet', lang);
      newColorVal = 0;
      shouldShow = true;
    } else if (cloudSyncState === 'syncing') {
      newMessage = t('autosave.syncing', lang);
      newColorVal = 1;
      shouldShow = true;
    }

    if (shouldShow) {
      Animated.timing(bgColorAnim, {
        toValue: newColorVal,
        duration: 400,
        useNativeDriver: false
      }).start();

      if (prevMessageRef.current !== newMessage && prevMessageRef.current !== "") {
        Animated.timing(textOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
          setStatusMessage(newMessage);
          prevMessageRef.current = newMessage;
          Animated.timing(textOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
        });
      } else if (prevMessageRef.current === "") {
        setStatusMessage(newMessage);
        prevMessageRef.current = newMessage;
        textOpacityAnim.setValue(1);
      }
      showBar();
    } else {
      hideBar();
      prevMessageRef.current = "";
    }
  }, [isOnline, cloudSyncState, conflictQueue.length, lang]);

  const showBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 40, duration: 300, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: false })
    ]).start();
  };

  const hideBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false })
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ff4d4d", "#3399ff"]
  });

  if (!user) return null;

  return (
    <Pressable onPress={(isDirty && conflictQueue.length === 0 && cloudSyncState === 'synced') ? () => saveNow() : null}>
      <Animated.View 
        style={[
          styles.container, 
          { 
            height: heightAnim, 
            backgroundColor: backgroundColor,
            opacity: opacityAnim
          }
        ]}
      >
        <Animated.Text style={[styles.text, { opacity: textOpacityAnim }]}>
          {statusMessage}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
  },
});