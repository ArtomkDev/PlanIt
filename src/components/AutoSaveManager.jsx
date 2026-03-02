import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Pressable } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSchedule } from "../context/ScheduleProvider";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global } = useSchedule();
  const autoSaveInterval = global?.auto_save || 60;

  const [timeLeft, setTimeLeft] = useState(autoSaveInterval);
  const [isConnected, setIsConnected] = useState(true);
  
  const [statusMessage, setStatusMessage] = useState("");
  const [statusColor, setStatusColor] = useState("#4dff88"); 
  const [showSavedState, setShowSavedState] = useState(false);

  const timerRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const prevCloudSavingRef = useRef(false);
  
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (isDirty && isConnected && !isCloudSaving && !timerRef.current) {
      setTimeLeft(autoSaveInterval);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    
    if ((!isConnected || isCloudSaving) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isDirty, isConnected, isCloudSaving, autoSaveInterval, user]);

  useEffect(() => {
    if (timeLeft === 0 && isDirty && !isCloudSaving) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      saveNow();
    }
  }, [timeLeft, isDirty, isCloudSaving, saveNow]);

  useEffect(() => {
    const justFinishedSaving = prevCloudSavingRef.current === true && isCloudSaving === false;
    
    if (justFinishedSaving && !isDirty && isConnected) {
      setShowSavedState(true);
      
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

      hideTimeoutRef.current = setTimeout(() => {
        setShowSavedState(false);
      }, 5000);
    } else if (isDirty || isCloudSaving || !isConnected) {
      setShowSavedState(false);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    }
    
    prevCloudSavingRef.current = isCloudSaving;
  }, [isCloudSaving, isDirty, isConnected]);

  useEffect(() => {
    let shouldShow = false;

    if (!isConnected) {
      setStatusMessage("Немає інтернету");
      setStatusColor("#ff4d4d");
      shouldShow = true;
    } else if (isCloudSaving) {
      setStatusMessage("Збереження у хмару...");
      setStatusColor("#ffcc00");
      shouldShow = true;
    } else if (isDirty) {
      setStatusMessage(`Автозбереження через: ${timeLeft} сек`);
      setStatusColor("#ffcc00");
      shouldShow = true;
    } else if (showSavedState) {
      setStatusMessage("Всі зміни збережено");
      setStatusColor("#4dff88");
      shouldShow = true;
    } else {
      shouldShow = false;
    }

    if (shouldShow) {
      showBar();
    } else {
      hideBar();
    }
  }, [isConnected, isCloudSaving, isDirty, timeLeft, showSavedState]);

  const showBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: 40,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  };

  const hideBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  };

  if (!user) return null;

  return (
    <Pressable onPress={isDirty ? saveNow : null}>
      <Animated.View 
        style={[
          styles.container, 
          { 
            height: heightAnim, 
            backgroundColor: statusColor,
            opacity: opacityAnim
          }
        ]}
      >
        <Animated.Text style={styles.text}>
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