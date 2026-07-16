import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { CalendarDots, CheckSquare, Square, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import themes from "../../../config/themes";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { t } from "../../../utils/i18n";
import {
  resolveScheduleColor,
  scheduleColorWithAlpha,
} from "../../../utils/scheduleColors";

const uniqueIds = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter(Boolean))]
    : []
);

export default function TaskScheduleFilterSheet({
  visible,
  onClose,
  selectedIds,
  onChange,
  activeScheduleId,
}) {
  const { global, schedules, lang } = useScheduleData();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const selectedSet = new Set(uniqueIds(selectedIds));
  const allScheduleIds = schedules.map((item) => item.id).filter(Boolean);

  const commitSelection = (nextIds) => {
    const validIds = new Set(allScheduleIds);
    const next = uniqueIds(nextIds).filter((id) => validIds.has(id));
    const fallback = activeScheduleId && validIds.has(activeScheduleId)
      ? [activeScheduleId]
      : allScheduleIds.slice(0, 1);

    onChange(next.length > 0 ? next : fallback);
  };

  const toggleSchedule = (scheduleId) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(scheduleId)) {
      nextSet.delete(scheduleId);
    } else {
      nextSet.add(scheduleId);
    }
    commitSelection(Array.from(nextSet));
  };

  const selectAll = () => {
    commitSelection(allScheduleIds);
  };

  const clearAll = () => {
    commitSelection([]);
  };

  const snapPoints = [Math.min(height * 0.46, 380), Math.min(height * 0.74, 580)];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnapIndex={1}
      maxWidth={640}
      backgroundColor={themeColors.backgroundColor2}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("tasks.filter.title", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="task-schedule-filter-sheet"
      contentStyle={[
        styles.sheetContent,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: themeColors.accentColor + "18" }]}>
          <CalendarDots size={23} color={themeColors.accentColor} weight="bold" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: themeColors.textColor }]}>
            {t("tasks.filter.title", lang)}
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
            {t("tasks.filter.subtitle", lang)}
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

      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={selectAll}
          style={[
            styles.actionButton,
            { backgroundColor: themeColors.accentColor + "18", borderColor: themeColors.accentColor + "40" },
          ]}
        >
          <Text style={[styles.actionText, { color: themeColors.accentColor }]}>
            {t("tasks.filter.all", lang)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={clearAll}
          style={[
            styles.actionButton,
            { backgroundColor: themeColors.backgroundColor4, borderColor: themeColors.borderColor },
          ]}
        >
          <Text style={[styles.actionText, { color: themeColors.textColor }]}>
            {t("tasks.filter.clear", lang)}
          </Text>
        </TouchableOpacity>
      </View>

      <SheetScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {schedules.map((item) => {
          const isSelected = selectedSet.has(item.id);
          const name = item.name || t("settings.schedule_switcher.untitled", lang);
          const itemColor = resolveScheduleColor(item, themeColors.accentColor);

          return (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggleSchedule(item.id)}
              activeOpacity={0.75}
              style={[
                styles.scheduleRow,
                {
                  backgroundColor: isSelected
                    ? scheduleColorWithAlpha(itemColor, 0.14)
                    : themeColors.backgroundColor4,
                  borderColor: isSelected ? itemColor : themeColors.borderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.monogram,
                  {
                    backgroundColor: isSelected
                      ? itemColor
                      : scheduleColorWithAlpha(itemColor, 0.16),
                  },
                ]}
              >
                <Text style={[styles.monogramText, { color: isSelected ? "#fff" : itemColor }]}>
                  {name.trim().charAt(0).toUpperCase() || "."}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={[styles.scheduleName, { color: themeColors.textColor }]}
              >
                {name}
              </Text>

              {isSelected ? (
                <CheckSquare size={27} color={itemColor} weight="fill" />
              ) : (
                <Square size={27} color={themeColors.textColor2} weight="regular" />
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.fallbackNote, { color: themeColors.textColor2 }]}>
          {t("tasks.filter.active_fallback", lang)}
        </Text>
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
    marginBottom: 14,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 9,
    paddingBottom: 8,
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
    marginRight: 10,
  },
  fallbackNote: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    paddingTop: 4,
    fontWeight: "500",
  },
});
