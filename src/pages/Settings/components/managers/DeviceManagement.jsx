import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import { Monitor, DeviceMobile, SignOut, X } from "phosphor-react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { removeDevice, removeAllOtherDevices, getDeviceId } from "../../../../utils/deviceService";
import { useScheduleData } from "../../../../context/ScheduleProvider";
import SettingsScreenLayout from "../../../../layouts/SettingsScreenLayout";
import { db } from "../../../../config/firebase";
import themes from "../../../../config/themes";
import { t } from "../../../../utils/i18n";
import MorphingLoader from "../../../../components/ui/MorphingLoader";
import { formatDeviceActivity, getDeviceActivity, getDevicePresentation } from "./devicePresentation";

export default function DeviceManager() {
  const { user, global, lang } = useScheduleData();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(null);
  const busy = useRef(false);
  const [now, setNow] = useState(Date.now);
  const [mode, accent] = global?.theme || ["light", "blue"];
  const colors = themes.getColors(mode, accent);
  const label = (key, params) => t(`settings.device_screen.${key}`, lang, params);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe;
    setLoading(true);
    setError(null);
    setDevices([]);
    setCurrentDeviceId(null);
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    const fail = () => {
      if (!active) return;
      setError("load_error");
      setLoading(false);
    };
    getDeviceId().then((id) => {
      if (!active) return;
      setCurrentDeviceId(id);
      unsubscribe = onSnapshot(collection(db, "users", user.uid, "devices"), (snap) => {
        if (!active) return;
        setDevices(snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((device) => (device.status || "active") === "active"));
        setLoading(false);
        setError(null);
      }, fail);
    }).catch(fail);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [user?.uid, retry]);

  async function signOutDevice(device) {
    if (busy.current || !user?.uid) return;
    busy.current = true;
    setPending(device?.id || "all");
    setError(null);
    try {
      if (device) await removeDevice(user.uid, device.id);
      else await removeAllOtherDevices(user.uid);
    } catch {
      setError("logout_error");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function confirmSignOut(device) {
    const message = device
      ? label("logout_confirm", { device: getDevicePresentation(device, lang).title })
      : label("logout_all_confirm");
    if (Platform.OS === "web") {
      if (window.confirm(message)) signOutDevice(device);
      return;
    }
    Alert.alert(label("logout"), message, [
      { text: t("common.cancel", lang), style: "cancel" },
      { text: label("logout"), style: "destructive", onPress: () => signOutDevice(device) },
    ]);
  }

  const current = devices.find((device) => device.id === currentDeviceId);
  const others = devices.filter((device) => device.id !== currentDeviceId)
    .sort((a, b) => getDeviceActivity(b) - getDeviceActivity(a));

  function renderDevice(device, index) {
    const { title, mobile } = getDevicePresentation(device, lang);
    const Icon = mobile ? DeviceMobile : Monitor;
    const isCurrent = device.id === currentDeviceId;
    const ip = device.lastIpAddress;
    return (
      <View key={device.id}>
        {index > 0 && <View style={[styles.separator, { backgroundColor: colors.borderColor }]} />}
        <View style={styles.deviceRow}>
          <View style={styles.deviceIcon} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon size={30} color={colors.textColor} weight="regular" />
          </View>
          <View style={styles.details}>
            <Text style={[styles.deviceTitle, { color: colors.textColor }]}>{title}</Text>
            <Text selectable style={[styles.metadata, { color: colors.textColor2 }]}>
              {ip && ip !== "Unknown IP" ? `IP: ${ip}` : label("location_unavailable")}
            </Text>
            <Text style={[styles.activity, { color: isCurrent ? colors.accentColor : colors.textColor2 }]}>
              {isCurrent ? label("this_device") : label("last_active", { time: formatDeviceActivity(device, lang, now) })}
            </Text>
          </View>
          {!isCurrent && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label("logout_device", { device: title })}
              accessibilityState={{ disabled: !!pending, busy: pending === device.id }}
              disabled={!!pending}
              onPress={() => confirmSignOut(device)}
              style={({ pressed }) => [styles.removeButton, { backgroundColor: pressed ? colors.borderColor : "transparent", opacity: pending ? 0.5 : 1 }]}
            >
              {pending === device.id ? <ActivityIndicator size="small" color={colors.textColor2} /> : <X size={22} color={colors.textColor2} />}
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  function renderSection(title, items) {
    return (
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textColor2 }]}>{title}</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundColor2 }]}>{items.map(renderDevice)}</View>
      </View>
    );
  }

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={[styles.intro, { color: colors.textColor2 }]}>{label("description")}</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <MorphingLoader size={48} />
            <Text style={[styles.metadata, { color: colors.textColor2 }]}>{label("loading")}</Text>
          </View>
        ) : (
          <>
            {error && (
              <View style={styles.section}>
                <Text accessibilityRole="alert" style={[styles.metadata, { color: colors.textColor }]}>{label(error)}</Text>
                {error === "load_error" && <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} style={styles.retryButton}>
                  <Text style={{ color: colors.accentColor }}>{label("retry")}</Text>
                </Pressable>}
              </View>
            )}
            {current && renderSection(label("current_device"), [current])}
            {others.length > 0 && renderSection(label("other_devices"), others)}
            {!devices.length && !error && <Text style={[styles.metadata, { color: colors.textColor2 }]}>{label("empty")}</Text>}
            {others.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !!pending, busy: pending === "all" }}
                disabled={!!pending}
                onPress={() => confirmSignOut(null)}
                style={({ pressed }) => [styles.logoutButton, { borderColor: colors.borderColor, backgroundColor: pressed ? colors.backgroundColor2 : "transparent", opacity: pending ? 0.5 : 1 }]}
              >
                {pending === "all" ? <ActivityIndicator size="small" color={themes.accentColors.red} /> : <SignOut size={22} color={themes.accentColors.red} />}
                <Text style={[styles.logoutLabel, { color: themes.accentColors.red }]}>{label("logout_all_others")}</Text>
              </Pressable>
            )}
            {devices.length > 0 && <Text style={[styles.securityNote, { color: colors.textColor2 }]}>{label("security_note")}</Text>}
          </>
        )}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
  intro: { fontSize: 15, lineHeight: 23, marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10, paddingHorizontal: 4 },
  card: { borderRadius: 18, overflow: "hidden" },
  deviceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 18, paddingLeft: 16, paddingRight: 8, gap: 12 },
  deviceIcon: { width: 32, alignItems: "center", justifyContent: "center" },
  details: { flex: 1, minWidth: 0, gap: 4 },
  deviceTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  metadata: { fontSize: 14, lineHeight: 20 },
  activity: { fontSize: 13, lineHeight: 19 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  removeButton: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logoutButton: { minHeight: 52, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  logoutLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  securityNote: { fontSize: 13, lineHeight: 20, marginTop: 16, paddingHorizontal: 4 },
  loadingContainer: { padding: 32, alignItems: "center", gap: 16 },
  retryButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 12 },
});
