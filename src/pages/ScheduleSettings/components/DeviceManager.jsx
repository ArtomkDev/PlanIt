// DeviceManager.jsx
import React, { useEffect, useState } from "react";
import { View, Text, Button, FlatList, StyleSheet } from "react-native";
import { deactivateDevice, deactivateAllExceptCurrent } from "../../../utils/deviceService";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import { db } from "../../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function DeviceManager() {
  const { user } = useSchedule();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const devicesRef = collection(db, "users", user.uid, "devices");

    // 🔥 підписуємося на live-зміни
    const unsubscribe = onSnapshot(devicesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDevices(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  async function handleDeactivate(deviceId) {
    await deactivateDevice(user.uid, deviceId);
  }

  async function handleDeactivateAll() {
    await deactivateAllExceptCurrent(user.uid);
  }

  if (loading) return <Text>Завантаження...</Text>;

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={styles.title}>Мої пристрої</Text>
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text>
                {item.name} ({item.platform})
              </Text>
              <Text>Останній вхід: {new Date(item.lastLogin).toLocaleString()}</Text>
              {item.isActive ? (
                <Button title="Від’єднати" onPress={() => handleDeactivate(item.id)} />
              ) : (
                <Text style={{ color: "red" }}>Від’єднано</Text>
              )}
            </View>
          )}
        />
        <Button title="Від’єднати всі, крім цього" onPress={handleDeactivateAll} />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, marginBottom: 10 },
  item: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#ccc" },
});
