import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";
import {
  deactivateDevice,
  deactivateAllExceptCurrent,
} from "../../../utils/deviceService";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import { db } from "../../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import themes from "../../../config/themes";

export default function DeviceManager() {
  const { user, global } = useSchedule();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mode, accent] = global.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  useEffect(() => {
    if (!user) return;
    const devicesRef = collection(db, "users", user.uid, "devices");

    const unsubscribe = onSnapshot(devicesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDevices(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  function getPlatformIcon(platform) {
    if (platform === "iOS")
      return (
        <Ionicons
          name="logo-apple"
          size={24}
          color={themeColors.textColor}
        />
      );
    if (platform === "Android")
      return <Ionicons name="logo-android" size={24} color="green" />;
    if (platform === "Web")
      return (
        <MaterialCommunityIcons
          name="web"
          size={24}
          color={themeColors.textColor2}
        />
      );
    if (platform.includes("Windows"))
      return <FontAwesome5 name="windows" size={22} color="blue" />;
    if (platform.includes("Mac"))
      return (
        <FontAwesome5
          name="laptop"
          size={22}
          color={themeColors.textColor}
        />
      );
    return (
      <MaterialCommunityIcons
        name="devices"
        size={24}
        color={themeColors.textColor2}
      />
    );
  }

  async function handleDeactivate(deviceId) {
    await deactivateDevice(user.uid, deviceId);
  }

  async function handleDeactivateAll() {
    await deactivateAllExceptCurrent(user.uid);
  }

  if (loading)
    return (
      <Text style={{ color: themeColors.textColor }}>Завантаження...</Text>
    );

  const activeDevices = devices.filter((d) => d.isActive);
  const inactiveDevices = devices.filter((d) => !d.isActive);

  function renderDevice(item) {
    return (
      <View
        style={[
          styles.item,
          {
            backgroundColor: themeColors.backgroundColor2,
            borderColor: themeColors.backgroundColor3,
          },
          !item.isActive && { opacity: 0.5 },
        ]}
      >
        <View style={styles.row}>
          {getPlatformIcon(item.platform)}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              style={[styles.deviceName, { color: themeColors.textColor }]}
            >
              {item.name}
            </Text>
            <Text style={[styles.subText, { color: themeColors.textColor2 }]}>
              {item.platform} | версія {item.appVersion}
            </Text>
            <Text style={[styles.subText, { color: themeColors.textColor2 }]}>
              Останній вхід: {new Date(item.lastLogin).toLocaleString()}
            </Text>
          </View>
          {item.isActive && (
            <TouchableOpacity onPress={() => handleDeactivate(item.id)}>
              <Ionicons
                name="close-circle"
                size={28}
                color={themes.accentColors.red}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <SettingsScreenLayout>
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.backgroundColor },
        ]}
      >
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          Активні пристрої
        </Text>
        <FlatList
          data={activeDevices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderDevice(item)}
        />

        {inactiveDevices.length > 0 && (
          <>
            <Text style={[styles.title, { color: themeColors.textColor }]}>
              Від’єднані пристрої
            </Text>
            <FlatList
              data={inactiveDevices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderDevice(item)}
            />
          </>
        )}

        {activeDevices.length > 1 && (
          <TouchableOpacity
            style={[
              styles.deactivateAll,
              { backgroundColor: themes.accentColors.red },
            ]}
            onPress={handleDeactivateAll}
          >
            <Text style={styles.deactivateAllText}>
              Від’єднати всі, крім цього
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  item: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  deviceName: { fontSize: 16, fontWeight: "600" },
  subText: { fontSize: 12 },
  deactivateAll: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  deactivateAllText: { color: "white", fontWeight: "bold" },
});
