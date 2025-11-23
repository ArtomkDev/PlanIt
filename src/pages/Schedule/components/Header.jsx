import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Modal, FlatList, Animated } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import AppBlur from "../../../components/AppBlur";

// Приймаємо scrollY
export default function Header({ currentDate, scrollY }) {
  const { global, schedule, schedules, setGlobalDraft } = useSchedule();
  const [modalVisible, setModalVisible] = useState(false);

  if (!schedule) return null;

  const [mode, accent] = global.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const isLightMode = mode === "light";

  const handleSelectSchedule = (id) => {
    setGlobalDraft((prev) => ({ ...prev, currentScheduleId: id }));
    setModalVisible(false);
  };

  // Інтерполяція прозорості фону
  const opacity = scrollY ? scrollY.interpolate({
    inputRange: [0, 10],
    outputRange: [0, 1],
    extrapolate: "clamp",
  }) : 1; // Фолбек якщо скролу немає

  return (
    <View style={styles.headerWrapper}>
      {/* Анімований фон з блюром */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <AppBlur style={StyleSheet.absoluteFill} />
        {/* Тонка лінія внизу хедера для відділення */}
        <View style={{ 
            position: 'absolute', 
            bottom: 0, left: 0, right: 0, 
            height: 1, 
            backgroundColor: themeColors.borderColor,
            opacity: 0.1 
        }} />
      </Animated.View>
      
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

        <Text 
          style={[styles.dateText, { color: themeColors.textColor }]} 
          numberOfLines={1}
        >
          {currentDate.toLocaleDateString("uk-UA")}
        </Text>
      </View>

      {/* Модальне вікно... (код без змін) */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent, 
            { backgroundColor: isLightMode ? "#fff" : (mode === 'oled' ? '#111' : '#222') }
          ]}>
            <FlatList
              data={schedules}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.scheduleItem}
                  onPress={() => handleSelectSchedule(item.id)}
                >
                  <Text style={{ color: isLightMode ? "#000" : "#fff", fontSize: 16 }}>
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
    zIndex: 1000,
    elevation: 5,
    // overflow: "hidden", // Можливо доведеться прибрати, якщо тіні обрізаються
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    borderRadius: 12,
    padding: 15,
    maxHeight: "60%",
  },
  scheduleItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(128,128,128,0.2)",
  },
  closeButton: {
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },
});