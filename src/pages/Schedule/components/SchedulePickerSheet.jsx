import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Check, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppBlur from "../../../components/ui/AppBlur";
import themes from "../../../config/themes";
import { useSchedule } from "../../../context/ScheduleProvider";
import { triggerLightHaptic } from "../../../utils/haptics";
import { t } from "../../../utils/i18n";
import {
  resolveScheduleColor,
  scheduleColorWithAlpha,
} from "../../../utils/scheduleColors";

export default function SchedulePickerSheet({ visible, onClose, onEditSchedule }) {
  const { global, schedules, setGlobalDraft, lang } = useSchedule();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(36)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(36);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  const selectSchedule = (scheduleId) => {
    if (scheduleId === global?.currentScheduleId) {
      onClose();
      return;
    }

    triggerLightHaptic();
    setGlobalDraft((previous) => ({ ...previous, currentScheduleId: scheduleId }));
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close", lang)}
          onPress={onClose}
          style={styles.backdrop}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(height * 0.72, 560),
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: themeColors.backgroundColor2,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <AppBlur style={StyleSheet.absoluteFill} intensity={85} />

          <View style={[styles.handle, { backgroundColor: themeColors.textColor3 }]} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: themeColors.textColor }]}>
                {t("schedule.header.switch_schedule", lang)}
              </Text>
              <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
                {t("schedule.header.long_press_hint", lang)}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.close", lang)}
              onPress={onClose}
              activeOpacity={0.7}
              style={[styles.closeButton, { backgroundColor: themeColors.backgroundColor3 }]}
            >
              <X size={20} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {schedules.map((item) => {
              const isActive = item.id === global?.currentScheduleId;
              const name = item.name || t("settings.schedule_switcher.untitled", lang);
              const itemColor = resolveScheduleColor(item, themeColors.accentColor);

              return (
                <TouchableOpacity
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  onPress={() => selectSchedule(item.id)}
                  onLongPress={() => onEditSchedule?.(item.id)}
                  delayLongPress={450}
                  activeOpacity={0.75}
                  style={[
                    styles.scheduleRow,
                    {
                      backgroundColor: isActive
                        ? scheduleColorWithAlpha(itemColor, 0.14)
                        : themeColors.backgroundColor4,
                      borderColor: isActive
                        ? itemColor
                        : themeColors.borderColor,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.monogram,
                      {
                        backgroundColor: isActive
                          ? itemColor
                          : scheduleColorWithAlpha(itemColor, 0.16),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monogramText,
                        { color: isActive ? "#fff" : itemColor },
                      ]}
                    >
                      {name.trim().charAt(0).toUpperCase() || "•"}
                    </Text>
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[styles.scheduleName, { color: themeColors.textColor }]}
                  >
                    {name}
                  </Text>

                  {isActive && (
                    <View style={[styles.check, { backgroundColor: itemColor }]}> 
                      <Check size={15} color="#fff" weight="bold" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 8, 15, 0.48)",
  },
  sheet: {
    minHeight: 240,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingHorizontal: 16,
    ...Platform.select({
      web: { boxShadow: "0 -12px 40px rgba(0,0,0,0.16)" },
      default: {
        elevation: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
    }),
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 13,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    paddingLeft: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 9,
    paddingBottom: 4,
  },
  scheduleRow: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  monogram: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  monogramText: {
    fontSize: 16,
    fontWeight: "800",
  },
  scheduleName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  check: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
