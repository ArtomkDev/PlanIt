import * as Haptics from "expo-haptics";

export const triggerLightHaptic = async () => {
  const isHapticsEnabled = true; 
  
  if (isHapticsEnabled) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn("Haptics error:", error);
    }
  }
};