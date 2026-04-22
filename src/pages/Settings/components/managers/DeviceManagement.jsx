import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { 
  Monitor, 
  DeviceMobile, 
  AppleLogo, 
  AndroidLogo, 
  SignOut 
} from "phosphor-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { removeDevice, removeAllOtherDevices, getDeviceId } from "../../../../utils/deviceService";
import { useSchedule } from "../../../../context/ScheduleProvider";
import SettingsScreenLayout from "../../../../layouts/SettingsScreenLayout";
import { db } from "../../../../config/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import themes from "../../../../config/themes";
import { t } from "../../../../utils/i18n";

import SettingsGroup from "../../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../../components/ui/SettingsKit/SettingsRow";
import SettingsActionRow from "../../../../components/ui/SettingsKit/SettingsActionRow";

export default function DeviceManager() {
  const { user, global, lang } = useSchedule();
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
    if (!device) return { Icon: DeviceMobile, color: themeColors.textColor2 };

    if (device.platform === "Web") {
      return { Icon: Monitor, color: themes.accentColors.blue };
    }
    if (device.platform === "iOS" || device.brand?.toLowerCase() === "apple") {
      return { Icon: AppleLogo, color: themeColors.textColor };
    }
    if (device.platform?.includes("Android") || device.platform?.includes("realme") || (device.brand && device.brand?.toLowerCase() !== "apple")) {
      return { Icon: AndroidLogo, color: themes.accentColors.green };
    }
    return { Icon: DeviceMobile, color: themeColors.textColor2 };
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

  function renderDevice(item) {
    if (!item) return null;

    const isCurrent = item.id === currentDeviceId;
    const displayName = getDeviceDisplayName(item);
    const { Icon, color } = getDeviceIconDetails(item);

    const currentBadge = isCurrent ? (
      <View style={[styles.currentBadge, { backgroundColor: themeColors.accentColor + "20" }]}>
        <Text style={[styles.currentBadgeText, { color: themeColors.accentColor }]}>
          {t('settings.device_screen.current', lang)}
        </Text>
      </View>
    ) : null;

    const deleteBtn = !isCurrent ? (
      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: themes.accentColors.red + "15" }]}
        onPress={() => handleRemoveDevice(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <SignOut size={20} color={themes.accentColors.red} weight="bold" />
      </TouchableOpacity>
    ) : null;

    return (
      <SettingsRow
        key={item.id}
        label={displayName}
        desc={formatDate(item.lastLogin)}
        icon={Icon}
        iconColor={color}
        iconBgColor={color + "15"}
        iconWeight={isCurrent ? "fill" : "regular"}
        themeColors={themeColors}
        rightContent={isCurrent ? currentBadge : deleteBtn}
      />
    );
  }

  const bottomPadding = insets.bottom + (Platform.OS === 'ios' ? 90 : 110);

  return (
    <SettingsScreenLayout>
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
        
        <SettingsGroup 
          title={t('settings.device_screen.active_sessions', lang)} 
          themeColors={themeColors}
        >
          {sortedDevices.map((device) => renderDevice(device))}
        </SettingsGroup>

        {sortedDevices.length > 1 && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <SettingsActionRow
              icon={SignOut}
              label={t('settings.device_screen.logout_all_others', lang)}
              onPress={handleRemoveAllOthers}
              danger={true}
              themeColors={themeColors}
            />
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
  loadingText: {
    padding: 20,
    fontSize: 16,
    textAlign: "center",
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
    borderRadius: 8,
  },
});