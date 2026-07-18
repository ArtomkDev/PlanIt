import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

let hapticsEnabled = true;
const lastFeedbackAt = new Map();

const impactStyle = (style, fallback = "Light") => (
  Haptics.ImpactFeedbackStyle?.[style] || Haptics.ImpactFeedbackStyle?.[fallback]
);

const notificationType = (type, fallback = "Success") => (
  Haptics.NotificationFeedbackType?.[type] || Haptics.NotificationFeedbackType?.[fallback]
);

const HAPTIC_EVENTS = {
  selection: { kind: "selection", minInterval: 35 },
  tab: { kind: "selection", minInterval: 70 },
  navigation: { kind: "impact", style: impactStyle("Light"), minInterval: 90 },
  navigateBack: { kind: "impact", style: impactStyle("Light"), minInterval: 90 },
  open: { kind: "impact", style: impactStyle("Soft"), minInterval: 90 },
  sheetClose: { kind: "impact", style: impactStyle("Soft"), minInterval: 90 },
  minimize: { kind: "impact", style: impactStyle("Soft"), minInterval: 120 },
  expand: { kind: "impact", style: impactStyle("Soft"), minInterval: 120 },
  swipe: { kind: "impact", style: impactStyle("Light"), minInterval: 140 },
  dragStart: { kind: "impact", style: impactStyle("Light"), minInterval: 180 },
  toggleOn: { kind: "impact", style: impactStyle("Medium"), minInterval: 90 },
  toggleOff: { kind: "impact", style: impactStyle("Light"), minInterval: 90 },
  longPress: { kind: "impact", style: impactStyle("Medium"), minInterval: 220 },
  success: { kind: "notification", style: notificationType("Success"), minInterval: 240 },
  warning: { kind: "notification", style: notificationType("Warning"), minInterval: 260 },
  error: { kind: "notification", style: notificationType("Error"), minInterval: 260 },
  destructive: { kind: "notification", style: notificationType("Warning"), minInterval: 260 },
  notification: { kind: "notification", style: notificationType("Warning"), minInterval: 3000 },
};

export const setHapticsEnabled = (enabled) => {
  hapticsEnabled = enabled !== false;
};

export const getHapticsEnabled = () => hapticsEnabled;

export const triggerHaptic = async (event = "selection", options = {}) => {
  if (!hapticsEnabled || Platform.OS === "web") return;

  const pattern = HAPTIC_EVENTS[event] || HAPTIC_EVENTS.selection;
  const key = options.key || event;
  const minInterval = options.minInterval ?? pattern.minInterval ?? 0;
  const now = Date.now();

  if (minInterval > 0 && now - (lastFeedbackAt.get(key) || 0) < minInterval) return;
  lastFeedbackAt.set(key, now);

  try {
    if (pattern.kind === "notification") {
      await Haptics.notificationAsync(pattern.style);
    } else if (pattern.kind === "selection") {
      await Haptics.selectionAsync();
    } else {
      await Haptics.impactAsync(pattern.style);
    }
  } catch (error) {
  }
};

export const triggerLightHaptic = () => triggerHaptic("navigation");
