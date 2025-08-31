import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Modal, FlatList } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import AppBlur from "../../../components/AppBlur";

export default function Header({ currentDate }) {
  const { global, schedule, schedules, setGlobalDraft } = useSchedule();
  const [modalVisible, setModalVisible] = useState(false);

  if (!schedule) return null;

  const [mode, accent] = global.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleSelectSchedule = (id) => {
    setGlobalDraft((prev) => ({ ...prev, currentScheduleId: id }));
    setModalVisible(false);
  };

  return (
    <View style={styles.headerWrapper}>

    <AppBlur />
      

      <View style={styles.headerContent}>
        <TouchableOpacity 
          onPress={() => setModalVisible(true)} 
          style={styles.scheduleWrapper}
        >
          <Text
            style={[styles.scheduleNameText, { color: themeColors.textColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {schedule?.name || "Невідомий розклад"}
          </Text>
        </TouchableOpacity>

        {/* Дата */}
        <Text 
          style={[styles.dateText, { color: themeColors.textColor }]} 
          numberOfLines={1}
        >
          {currentDate.toLocaleDateString("uk-UA")}
        </Text>
      </View>

      {/* Модальне вікно вибору розкладу */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: mode === "dark" ? "#222" : "#fff" }]}>
            <FlatList
              data={schedules}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.scheduleItem}
                  onPress={() => handleSelectSchedule(item.id)}
                >
                  <Text style={{ color: mode === "dark" ? "#fff" : "#000", fontSize: 16 }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={{ color: "red", fontSize: 16 }}>Закрити</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 5,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scheduleWrapper: {
    maxWidth: "70%",
    marginRight: 10,
  },
  scheduleNameText: { 
    fontSize: 20, 
    fontWeight: "bold",
  },
  dateText: { 
    fontSize: 16, 
    flexShrink: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    borderRadius: 10,
    padding: 15,
    maxHeight: "60%",
  },
  scheduleItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  closeButton: {
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },
});
