import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference";

const BottomSheetPresentationContext = createContext(null);

export function BottomSheetPresentationProvider({ children }) {
  const [sheets, setSheets] = useState([]);
  const sheetsRef = useRef([]);
  const reduceMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const depthScale = Platform.OS === "web" && width >= 768 ? 0.97 : 0.94;

  const registerSheet = useCallback((id, animatedIndex) => {
    const next = [...sheetsRef.current.filter((sheet) => sheet.id !== id), { id, animatedIndex }];
    sheetsRef.current = next;
    setSheets(next);
  }, []);

  const unregisterSheet = useCallback((id) => {
    if (!sheetsRef.current.some((sheet) => sheet.id === id)) return;
    const next = sheetsRef.current.filter((sheet) => sheet.id !== id);
    sheetsRef.current = next;
    setSheets(next);
  }, []);

  const isTopSheet = useCallback((id) => (
    sheetsRef.current[sheetsRef.current.length - 1]?.id === id
  ), []);

  const value = useMemo(() => ({ registerSheet, unregisterSheet, isTopSheet }), [
    registerSheet, unregisterSheet, isTopSheet,
  ]);

  const sceneStyle = useAnimatedStyle(() => {
    let progress = 0;
    for (const sheet of sheets) {
      progress = Math.max(progress, Math.min(1, Math.max(0, sheet.animatedIndex.value + 1)));
    }
    if (reduceMotion) progress = 0;
    return {
      borderRadius: 28 * progress,
      transform: [{ translateY: -8 * progress }, { scale: 1 - (1 - depthScale) * progress }],
    };
  }, [sheets, reduceMotion, depthScale]);

  return (
    <BottomSheetPresentationContext.Provider value={value}>
      <View style={styles.stage}>
        <BottomSheetModalProvider>
          {/* The portal host stays outside the transformed scene so sheets retain full-screen coordinates. */}
          <Animated.View
            style={[styles.scene, sceneStyle]}
            pointerEvents={sheets.length ? "none" : "auto"}
            {...(Platform.OS === "web" ? { inert: sheets.length > 0 } : {})}
            accessibilityElementsHidden={sheets.length > 0}
            importantForAccessibility={sheets.length ? "no-hide-descendants" : "auto"}
          >
            {children}
          </Animated.View>
        </BottomSheetModalProvider>
      </View>
    </BottomSheetPresentationContext.Provider>
  );
}

export function useBottomSheetPresentation() {
  const context = useContext(BottomSheetPresentationContext);
  if (!context) throw new Error("BottomSheet requires BottomSheetPresentationProvider");
  return context;
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#000" },
  scene: { flex: 1, overflow: "hidden" },
});
