import { Platform } from "react-native";
import * as Device from "expo-device";

// Android phones with 4 GB of RAM or less pair it with CPUs and GPUs that cannot
// rasterize decorative SVG layers within a frame budget.
const LOW_END_MEMORY_BYTES = 5 * 1024 ** 3;

export const isLowEndDevice = Platform.OS === "android"
  && Number.isFinite(Device.totalMemory)
  && Device.totalMemory < LOW_END_MEMORY_BYTES;
