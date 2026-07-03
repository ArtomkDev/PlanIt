import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Check, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
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

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const selectSchedule = (scheduleId) => {
    if (scheduleId === global?.currentScheduleId) {
      onClose();
      return;
    }

    triggerLightHaptic();
    setGlobalDraft((previous) => ({ ...previous, currentScheduleId: scheduleId }));
    onClose();
  };

  const snapPoints = [Math.min(height * 0.42, 360), Math.min(height * 0.72, 560)];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnapIndex={1}
      maxWidth={640}
      backgroundColor={themeColors.backgroundColor2}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("schedule.header.switch_schedule", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="schedule-picker-sheet"
      contentStyle={[
        styles.sheetContent,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
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

          <SheetScrollView
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
          </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 16,
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
    flex: 1,
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
