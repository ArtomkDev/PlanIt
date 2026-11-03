import React from "react";
import { Image } from "expo-image";

// react-native-svg rasterizes each icon into its own bitmap on the UI thread, which
// stalls every page the schedule pager mounts. expo-image decodes these Phosphor
// paths once off the main thread and reuses the cached drawing for every card.
const SOURCES = {
  clock: require("../../../../assets/icons/clock.svg"),
  coffee: require("../../../../assets/icons/coffee.svg"),
  hourglass: require("../../../../assets/icons/hourglass-fill.svg"),
  "map-pin": require("../../../../assets/icons/map-pin-fill.svg"),
  timer: require("../../../../assets/icons/timer.svg"),
  user: require("../../../../assets/icons/user-fill.svg"),
};

export default function CardIcon({ name, size, color }) {
  return (
    <Image
      source={SOURCES[name]}
      tintColor={color}
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
