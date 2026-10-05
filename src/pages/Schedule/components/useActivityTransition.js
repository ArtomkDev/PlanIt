import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";

export default function useActivityTransition(active) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reduceMotion]);

  return useMemo(() => ({
    activeOpacity: progress,
    inactiveOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  }), [progress]);
}
