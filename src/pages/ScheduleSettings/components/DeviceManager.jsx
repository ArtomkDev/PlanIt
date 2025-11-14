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
  removeDevice,
  removeAllOtherDevices,
  getDeviceId,
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
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  const [mode, accent] = global.theme || ["light", "blue"];
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

  function getPlatformIcon(platform) {
    if (platform === "iOS")
      return <Ionicons name="logo-apple" size={24} color={themeColors.textColor} />;
    if (platform === "Android")
      return <Ionicons name="logo-android" size={24} color="green" />;
    if (platform === "Web")
      return <MaterialCommunityIcons name="web" size={24} color={themeColors.textColor2} />;
    // Add more specific icons as needed
    return <MaterialCommunityIcons name="devices" size={24} color={themeColors.textColor2} />;
  }

  async function handleRemoveDevice(deviceId) {
    await removeDevice(user.uid, deviceId);
  }

  async function handleRemoveAllOthers() {
    await removeAllOtherDevices(user.uid);
  }

  if (loading)
    return <Text style={{ color: themeColors.textColor }}>Loading devices...</Text>;

  function renderDevice({ item }) {
    const isCurrent = item.id === currentDeviceId;
    return (
      <View
        style={[
          styles.item,
          { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.backgroundColor3 },
          isCurrent && styles.currentDeviceHighlight,
        ]}
      >
        <View style={styles.row}>
          {getPlatformIcon(item.platform)}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.deviceName, { color: themeColors.textColor }]}>
              {item.name} {isCurrent && "(This Device)"}
            </Text>
            <Text style={[styles.subText, { color: themeColors.textColor2 }]}>
              Last login: {new Date(item.lastLogin).toLocaleString()}
            </Text>
          </View>
          {!isCurrent && (
            <TouchableOpacity onPress={() => handleRemoveDevice(item.id)}>
              <Ionicons
                name="log-out-outline"
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
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          Logged-in Devices
        </Text>
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderDevice}
        />
        {devices.length > 1 && (
          <TouchableOpacity
            style={[styles.deactivateAll, { backgroundColor: themes.accentColors.red }]}
            onPress={handleRemoveAllOthers}
          >
            <Text style={styles.deactivateAllText}>Log Out on All Other Devices</Text>
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
  currentDeviceHighlight: {
    borderColor: themes.accentColors.blue, // Or any color to highlight the current device
    borderWidth: 2,
  },
  deactivateAll: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  deactivateAllText: { color: "white", fontWeight: "bold" },
});
