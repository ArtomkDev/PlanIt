import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { 
  FadeInDown, 
  FadeOutDown, 
  CurvedTransition 
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  removeDevice,
  removeAllOtherDevices,
  getDeviceId,
} from "../../../utils/deviceService";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import { db } from "../../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";

export default function DeviceManager() {
  const { user, global , lang} = useSchedule();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  
  const insets = useSafeAreaInsets();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);


  useEffect(() => {
    if (!user) return;

    const fetchCurrentDeviceId = async () => {
      const id = await getDeviceId(user.uid);
      setCurrentDeviceId(id);
    };

    fetchCurrentDeviceId();

    const devicesRef = collection(db, "users", user.uid, "devices");
    const unsubscribe = onSnapshot(devicesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDevices(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.id === currentDeviceId) return -1;
      if (b.id === currentDeviceId) return 1;
      return new Date(b.lastLogin) - new Date(a.lastLogin);
    });
  }, [devices, currentDeviceId]);

  const parseWebUserAgent = (ua) => {
    if (!ua) return t('settings.device_screen.unknown_device', lang);
    let browser = t('settings.device_screen.web_browser', lang);
    let os = t('settings.device_screen.unknown_os', lang);

    if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser} on ${os}`;
  };

  const getDeviceDisplayName = (device) => {
    if (!device) return t('settings.device_screen.unknown_device', lang); 

    if (device.platform === "Web") return parseWebUserAgent(device.name);
    
    if (device.model) {
      if (device.brand?.toLowerCase() === "apple") return device.model;
      if (device.brand && !device.model.toLowerCase().includes(device.brand.toLowerCase())) {
        return `${device.brand} ${device.model}`;
      }
      return device.model;
    }
    
    return device.name || t('settings.device_screen.unknown_device', lang);
  };

  const getDeviceIconDetails = (device) => {
    if (!device) return { name: "phone-portrait-outline", color: themeColors.textColor2 };

    if (device.platform === "Web") {
      return { name: "desktop-outline", color: themes.accentColors.blue };
    }
    if (device.platform === "iOS" || device.brand?.toLowerCase() === "apple") {
      return { name: "logo-apple", color: themeColors.textColor };
    }
    if (device.platform?.includes("Android") || device.platform?.includes("realme") || (device.brand && device.brand?.toLowerCase() !== "apple")) {
      return { name: "logo-android", color: themes.accentColors.green };
    }
    return { name: "phone-portrait-outline", color: themeColors.textColor2 };
  };

  const formatDate = (isoString) => {
    if (!isoString) return t('settings.device_screen.unknown_date', lang);
    return new Date(isoString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  async function handleRemoveDevice(deviceId) {
    await removeDevice(user.uid, deviceId);
  }

  async function handleRemoveAllOthers() {
    await removeAllOtherDevices(user.uid);
  }

  if (loading) {
    return (
      <SettingsScreenLayout>
        <Text style={[styles.loadingText, { color: themeColors.textColor2 }]}>
          {t('settings.device_screen.loading', lang)}
        </Text>
      </SettingsScreenLayout>
    );
  }

  function renderDevice(item, index) {
    if (!item) return null;

    const isCurrent = item.id === currentDeviceId;
    const displayName = getDeviceDisplayName(item);
    const iconDetails = getDeviceIconDetails(item);

    const delay = index * 100;

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.delay(delay).springify()}
        exiting={FadeOutDown.springify()}
        layout={CurvedTransition} 
        style={[
          styles.card,
          { 
            backgroundColor: themeColors.backgroundColor2,
            borderColor: isCurrent ? themeColors.accentColor : "transparent",
            borderWidth: isCurrent ? 1 : 0
          },
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconContainer, { backgroundColor: iconDetails.color + "15" }]}>
            <Ionicons name={iconDetails.name} size={24} color={iconDetails.color} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.deviceName, { color: themeColors.textColor }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.subText, { color: themeColors.textColor2 }]}>
              {formatDate(item.lastLogin)}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          {isCurrent ? (
            <View style={[styles.currentBadge, { backgroundColor: themeColors.accentColor + "20" }]}>
              <Text style={[styles.currentBadgeText, { color: themeColors.accentColor }]}>
                {t('settings.device_screen.current', lang)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleRemoveDevice(item.id)}
              hitSlop={10}
            >
              <Ionicons name="log-out-outline" size={22} color={themes.accentColors.red} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }

  const bottomPadding = insets.bottom + (Platform.OS === 'ios' ? 90 : 110);

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        
        <View>
          <Text style={[styles.title, { color: themeColors.textColor }]}>
            {t('settings.device_screen.active_sessions', lang)}
          </Text>
          <View style={styles.listContent}>
            {sortedDevices.map((device, index) => renderDevice(device, index))}
          </View>
        </View>

        {sortedDevices.length > 1 && (
          <Animated.View 
            entering={FadeInDown.delay(300).springify()} 
            style={{ marginTop: 10, marginBottom: bottomPadding }}
          >
            <TouchableOpacity
              style={[styles.deactivateAll, { backgroundColor: themes.accentColors.red + "15" }]}
              onPress={handleRemoveAllOthers}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="log-out-outline" 
                size={20} 
                color={themes.accentColors.red} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.deactivateAllText, { color: themes.accentColors.red }]}>
                {t('settings.device_screen.logout_all_others', lang)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  loadingText: {
    padding: 20,
    fontSize: 16,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 10,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    fontWeight: "400",
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  currentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 10,
  },
  deactivateAll: {
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  deactivateAllText: {
    fontSize: 16,
    fontWeight: "600",
  },
});