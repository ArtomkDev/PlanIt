import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CaretDown, Palette } from "phosphor-react-native";
import {
  CONTACT_COLOR_OPTIONS,
  CONTACT_ICON_OPTIONS,
  getContactIconComponent,
} from "../../../../../config/contactTypes";
import { t } from "../../../../../utils/i18n";

export default function ContactAppearancePicker({
  iconId,
  color,
  onIconChange,
  onColorChange,
  onCustomColorPress,
  themeColors,
  lang,
}) {
  const [activePanel, setActivePanel] = useState(null);
  const CurrentIcon = getContactIconComponent(iconId);

  const togglePanel = (panel) => {
    setActivePanel((current) => current === panel ? null : panel);
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]}
          onPress={() => togglePanel("icon")}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={t("schedule.lesson_editor.contact_icon_label", lang)}
          accessibilityState={{ expanded: activePanel === "icon" }}
        >
          <View style={[styles.iconPreview, { backgroundColor: color + "18", borderColor: themeColors.borderColor }]}>
            <CurrentIcon size={19} color={color} weight="bold" />
          </View>
          <Text style={[styles.actionText, { color: themeColors.textColor }]} numberOfLines={1}>
            {t("schedule.lesson_editor.contact_icon_label", lang)}
          </Text>
          <CaretDown
            size={15}
            color={themeColors.textColor2}
            weight="bold"
            style={activePanel === "icon" ? styles.caretOpen : null}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]}
          onPress={() => togglePanel("color")}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={t("schedule.lesson_editor.color_tab", lang)}
          accessibilityState={{ expanded: activePanel === "color" }}
        >
          <View style={[styles.colorPreview, { backgroundColor: color, borderColor: themeColors.borderColor }]} />
          <Text style={[styles.actionText, { color: themeColors.textColor }]} numberOfLines={1}>
            {t("schedule.lesson_editor.color_tab", lang)}
          </Text>
          <CaretDown
            size={15}
            color={themeColors.textColor2}
            weight="bold"
            style={activePanel === "color" ? styles.caretOpen : null}
          />
        </TouchableOpacity>
      </View>

      {activePanel === "icon" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionRow}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="radiogroup"
        >
          {CONTACT_ICON_OPTIONS.map((option) => {
            const selected = option.id === iconId;
            const Icon = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: selected ? color + "22" : themeColors.backgroundColor,
                    borderColor: selected ? color : themeColors.borderColor,
                  },
                ]}
                onPress={() => onIconChange(option.id)}
                accessibilityRole="radio"
                accessibilityLabel={t(option.labelKey, lang)}
                accessibilityState={{ selected, checked: selected }}
                activeOpacity={0.72}
              >
                <Icon size={21} color={selected ? color : themeColors.textColor2} weight={selected ? "fill" : "regular"} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {activePanel === "color" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionRow}
          keyboardShouldPersistTaps="handled"
        >
          {CONTACT_COLOR_OPTIONS.map((option) => {
            const selected = option.color.toLowerCase() === String(color).toLowerCase();
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.colorButton,
                  { backgroundColor: option.color, borderColor: selected ? themeColors.textColor : "transparent" },
                ]}
                onPress={() => onColorChange(option.color)}
                accessibilityRole="radio"
                accessibilityLabel={t(option.labelKey, lang)}
                accessibilityState={{ selected, checked: selected }}
                activeOpacity={0.72}
              >
                {selected ? <View style={styles.selectedColorMark} /> : null}
              </TouchableOpacity>
            );
          })}
          {onCustomColorPress ? (
            <TouchableOpacity
              style={[styles.customColorButton, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]}
              onPress={onCustomColorPress}
              accessibilityRole="button"
              accessibilityLabel={t("schedule.lesson_editor.contact_custom_color", lang)}
              activeOpacity={0.72}
            >
              <Palette size={19} color={color} weight="bold" />
              <Text style={[styles.customColorText, { color: themeColors.textColor }]} numberOfLines={1}>
                {t("schedule.lesson_editor.contact_custom_color", lang)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" },
  iconPreview: { width: 30, height: 30, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  colorPreview: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  caretOpen: { transform: [{ rotate: "180deg" }] },
  optionRow: { gap: 8, paddingTop: 10, paddingRight: 4 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedColorMark: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.16)",
  },
  customColorButton: {
    minHeight: 44,
    maxWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customColorText: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
});
