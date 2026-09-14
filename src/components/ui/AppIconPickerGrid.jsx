import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "phosphor-react-native";

import { ICON_CATEGORIES, getIconComponent } from "../../config/subjectIcons";
import { useScheduleData } from "../../context/ScheduleProvider";
import { triggerHaptic } from "../../utils/haptics";
import { t } from "../../utils/i18n";

const GRID_SPACING = 10;
const PHONE_COLUMNS = 5;
const LARGE_SCREEN_COLUMNS = 8;
const LARGE_SCREEN_BREAKPOINT = 600;
const FALLBACK_ITEM_SIZE = 52;

const formatIconKey = (iconKey) => (
  String(iconKey || "").replace(/_/g, " ")
);

export default function AppIconPickerGrid({
  iconKeys,
  selectedIcon,
  onSelect,
  themeColors,
  showNone = true,
  noneAccessibilityLabel,
  accessibilityLabelPrefix,
  renderNone,
}) {
  const { lang } = useScheduleData();
  const [gridWidth, setGridWidth] = useState(0);
  const allowedIcons = Array.isArray(iconKeys) ? new Set(iconKeys) : null;
  const columns = gridWidth >= LARGE_SCREEN_BREAKPOINT
    ? LARGE_SCREEN_COLUMNS
    : PHONE_COLUMNS;
  const itemSize = gridWidth > 0
    ? (gridWidth - (columns - 1) * GRID_SPACING) / columns
    : FALLBACK_ITEM_SIZE;
  const normalizedSelectedIcon = getIconComponent(selectedIcon) ? selectedIcon : null;

  const handleSelect = (iconKey) => {
    const isSelected = iconKey === normalizedSelectedIcon;
    triggerHaptic(iconKey ? (isSelected ? "selection" : "success") : "warning");
    onSelect?.(iconKey);
  };

  const renderItem = (iconKey) => {
    const Icon = iconKey ? getIconComponent(iconKey) : null;
    const isSelected = iconKey === normalizedSelectedIcon;
    const itemLabel = iconKey
      ? `${accessibilityLabelPrefix || t("schedule.lesson_editor.choose_icon", lang)}: ${formatIconKey(iconKey)}`
      : noneAccessibilityLabel || t("schedule.icon_categories.none", lang);

    return (
      <TouchableOpacity
        key={iconKey || "none"}
        accessibilityRole="radio"
        accessibilityLabel={itemLabel}
        accessibilityState={{ checked: isSelected, selected: isSelected }}
        activeOpacity={0.6}
        onPress={() => handleSelect(iconKey)}
        style={[
          styles.gridItem,
          { width: itemSize, height: itemSize },
          {
            backgroundColor: isSelected
              ? `${themeColors.accentColor}25`
              : themeColors.backgroundColor2,
            borderColor: isSelected ? themeColors.accentColor : "transparent",
          },
        ]}
      >
        {iconKey ? (
          Icon && (
            <Icon
              size={26}
              color={isSelected ? themeColors.accentColor : themeColors.textColor}
              weight={isSelected ? "fill" : "regular"}
            />
          )
        ) : renderNone ? (
          renderNone({ isSelected, itemSize })
        ) : (
          <X size={24} color={themeColors.textColor2} weight="bold" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        setGridWidth((currentWidth) => (
          currentWidth === nextWidth ? currentWidth : nextWidth
        ));
      }}
    >
      {showNone && (
        <View style={styles.categorySection}>
          <Text style={[styles.categoryTitle, { color: themeColors.textColor2 }]}>
            {(t("schedule.icon_categories.none", lang) || "").toUpperCase()}
          </Text>
          <View style={styles.gridContainer}>
            {renderItem(null)}
          </View>
        </View>
      )}

      {ICON_CATEGORIES.map((category) => {
        const visibleIcons = allowedIcons
          ? category.icons.filter((iconKey) => allowedIcons.has(iconKey))
          : category.icons;
        if (visibleIcons.length === 0) return null;

        return (
          <View key={category.id} style={styles.categorySection}>
            <Text style={[styles.categoryTitle, { color: themeColors.textColor2 }]}>
              {(t(`schedule.icon_categories.${category.id}`, lang) || category.id).toUpperCase()}
            </Text>
            <View style={styles.gridContainer}>
              {visibleIcons.map(renderItem)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_SPACING,
  },
  gridItem: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
