import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const getWebPreference = () => (
  Platform.OS === "web"
  && typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches
);

export default function useReducedMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(getWebPreference);

  useEffect(() => {
    let active = true;
    const updatePreference = (value) => {
      if (active) setReduceMotion(Boolean(value));
    };

    if (Platform.OS !== "web") {
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then(updatePreference)
        .catch(() => {});
    }

    const nativeSubscription = Platform.OS !== "web"
      ? AccessibilityInfo.addEventListener?.("reduceMotionChanged", updatePreference)
      : null;

    const mediaQuery = Platform.OS === "web"
      && typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    const handleWebChange = (event) => updatePreference(event.matches);
    if (mediaQuery) {
      updatePreference(mediaQuery.matches);
      if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handleWebChange);
      else mediaQuery.addListener?.(handleWebChange);
    }

    return () => {
      active = false;
      nativeSubscription?.remove?.();
      if (mediaQuery?.removeEventListener) mediaQuery.removeEventListener("change", handleWebChange);
      else mediaQuery?.removeListener?.(handleWebChange);
    };
  }, []);

  return reduceMotion;
}
