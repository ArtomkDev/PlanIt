import React from "react";
import { Clock, Coffee, Hourglass, MapPin, Timer, User } from "phosphor-react-native";

const ICONS = {
  clock: [Clock, "regular"],
  coffee: [Coffee, "regular"],
  hourglass: [Hourglass, "fill"],
  "map-pin": [MapPin, "fill"],
  timer: [Timer, "regular"],
  user: [User, "fill"],
};

export default function CardIcon({ name, size, color }) {
  const [Icon, weight] = ICONS[name];
  return <Icon size={size} color={color} weight={weight} />;
}
