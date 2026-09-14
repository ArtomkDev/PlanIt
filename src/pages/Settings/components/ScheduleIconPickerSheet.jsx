import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScheduleIcon from "../../../components/ScheduleIcon";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import AppIconPickerGrid from "../../../components/ui/AppIconPickerGrid";
import { triggerHaptic } from "../../../utils/haptics";
import { t } from "../../../utils/i18n";
import { scheduleColorWithAlpha } from "../../../utils/scheduleColors";

export default function ScheduleIconPickerSheet({
  visible,
  onClose,
  onSelect,
  selectedIcon,
  scheduleName,
  scheduleColor,
  themeColors,
  lang,
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const snapPoints = [Math.min(height * 0.68, 560), Math.min(height * 0.9, 760)];

  const handleClose = () => {
    triggerHaptic("sheetClose");
    onClose();
  };

  const handleSelect = (icon) => {
    onSelect(icon);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={snapPoints}
      initialSnapIndex={1}
      maxWidth={640}
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("settings.schedule_editor.choose_icon", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="schedule-icon-picker-sheet"
      contentStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: themeColors.textColor }]}>
            {t("settings.schedule_editor.choose_icon", lang)}
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
            {t("settings.schedule_editor.icon_hint", lang)}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.close", lang)}
          activeOpacity={0.7}
          onPress={handleClose}
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
        <AppIconPickerGrid
          selectedIcon={selectedIcon}
          onSelect={handleSelect}
          themeColors={themeColors}
          noneAccessibilityLabel={t("settings.schedule_editor.no_icon", lang)}
          accessibilityLabelPrefix={t("settings.schedule_editor.icon", lang)}
          renderNone={() => (
            <ScheduleIcon
              name={scheduleName}
              size={30}
              iconSize={18}
              backgroundColor={scheduleColorWithAlpha(scheduleColor, 0.16)}
              color={scheduleColor}
            />
          )}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
