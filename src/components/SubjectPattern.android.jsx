import React from "react";
import { Image, StyleSheet } from "react-native";
import { SUBJECT_PATTERN_IMAGES } from "../config/subjectPatternImages.android";

// The vector paths are rasterized at build time. Fresco repeats the cached PNG
// on its image worker, leaving one bitmap layer per card on the UI thread.
export default React.memo(function SubjectPattern({ icon, color, opacity = 1, width, height }) {
  const source = SUBJECT_PATTERN_IMAGES[icon];
  if (!source || width <= 0 || height <= 0) return null;

  return (
    <Image
      source={source}
      resizeMode="repeat"
      fadeDuration={0}
      tintColor={color}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.pattern, { width, height, opacity }]}
    />
  );
});

const styles = StyleSheet.create({
  pattern: { position: "absolute", top: 0, left: 0, borderRadius: 18, overflow: "hidden", zIndex: 1 },
});
