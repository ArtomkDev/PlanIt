import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Check, Palette, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tinycolor from "tinycolor2";

import BottomSheet, { SheetScrollView } from "./BottomSheet";
import ColorSpectrumPicker from "./ColorSpectrumPicker";
import themes from "../../config/themes";
import { useScheduleData } from "../../context/ScheduleProvider";
import { t } from "../../utils/i18n";
import { triggerHaptic } from "../../utils/haptics";

const normalizeColor = (color) => {
  const parsedColor = tinycolor(color);
  return parsedColor.isValid() ? parsedColor.toHexString() : "#000000";
};

function AdvancedColorPickerContent({
  visible,
  initialColor,
  onSave,
  onClose,
  themeColors,
  lang,
  bottomInset,
}) {
  const [currentColor, setCurrentColor] = useState(() => normalizeColor(initialColor));
  const [hexInput, setHexInput] = useState(() => (
    normalizeColor(initialColor).toUpperCase()
  ));

  useEffect(() => {
    if (!visible) return;
    const normalizedColor = normalizeColor(initialColor);
    const nextHex = normalizedColor.toUpperCase();
    setCurrentColor((previous) => (
      previous === normalizedColor ? previous : normalizedColor
    ));
    setHexInput((previous) => (previous === nextHex ? previous : nextHex));
  }, [visible, initialColor]);

  const handleHexInputBlur = () => {
    const newColor = tinycolor(hexInput);
    if (newColor.isValid()) {
      triggerHaptic("selection");
      const normalizedColor = newColor.toHexString();
      setCurrentColor(normalizedColor);
      setHexInput(normalizedColor.toUpperCase());
    } else {
      triggerHaptic("error");
      setHexInput(currentColor.toUpperCase());
    }
  };
  const contentColor = tinycolor(currentColor).isLight() ? "#111827" : "#FFFFFF";
  const title = t("color_picker.title", lang);

  const handleColorChange = useCallback((nextColor) => {
    setCurrentColor(nextColor);
    setHexInput(nextColor.toUpperCase());
  }, []);

  const handleClose = () => {
    triggerHaptic("sheetClose");
    onClose?.();
  };

  const handleSave = () => {
    triggerHaptic("success");
    onSave?.(currentColor);
  };

  return (
    <SheetScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.pickerContainer,
        { paddingBottom: Math.max(bottomInset, 20) },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: themeColors.accentColorLight }]}>
          <Palette size={23} color={themeColors.accentColor} weight="bold" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: themeColors.textColor }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
            {t("color_picker.subtitle", lang)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("common.close", lang)}
          style={[styles.closeButton, { backgroundColor: themeColors.backgroundColor3 }]}
        >
          <X size={20} color={themeColors.textColor} weight="bold" />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.valueCard,
          {
            backgroundColor: themeColors.backgroundColor4,
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.colorPreview, { backgroundColor: currentColor }]}>
          <Check size={23} color={contentColor} weight="bold" />
        </View>
        <View style={styles.valueCopy}>
          <Text style={[styles.valueLabel, { color: themeColors.textColor2 }]}>
            {t("color_picker.current_color", lang)}
          </Text>
          <TextInput
            accessibilityLabel={t("color_picker.hex_label", lang)}
            accessibilityHint={t("color_picker.hex_hint", lang)}
            style={[
              styles.hexInput,
              {
                backgroundColor: themeColors.backgroundColor3,
                color: themeColors.textColor,
                borderColor: themeColors.borderColor,
              },
            ]}
            value={hexInput}
            onChangeText={setHexInput}
            onBlur={handleHexInputBlur}
            onSubmitEditing={() => {
              handleHexInputBlur();
              Keyboard.dismiss();
            }}
            maxLength={7}
            selectTextOnFocus
            returnKeyType="done"
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
          />
        </View>
      </View>

      <ColorSpectrumPicker
        color={currentColor}
        onChange={handleColorChange}
        themeColors={themeColors}
        lang={lang}
      />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("color_picker.save", lang)}
        style={[styles.saveButton, { backgroundColor: currentColor }]}
        onPress={handleSave}
        activeOpacity={0.78}
      >
        <Check size={20} color={contentColor} weight="bold" />
        <Text style={[styles.saveButtonText, { color: contentColor }]}>
          {t("color_picker.save", lang)}
        </Text>
      </TouchableOpacity>
    </SheetScrollView>
  );
}

// Picker gestures update repeatedly while dragging. Keeping that state below the
// modal shell prevents @gorhom/portal from re-registering the sheet each time.
const AdvancedColorPickerSheet = React.memo(function AdvancedColorPickerSheet({
  visible,
  initialColor,
  onSave,
  onClose,
  themeColors,
  lang,
  bottomInset,
  snapPoints,
}) {
  const title = t("color_picker.title", lang);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnapIndex={0}
      maxWidth={620}
      backgroundColor={themeColors.backgroundColor2}
      handleColor={themeColors.textColor3}
      enableContentPanningGesture={false}
      accessibilityLabel={title}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="advanced-color-picker-sheet"
    >
      <AdvancedColorPickerContent
        visible={visible}
        initialColor={initialColor}
        onSave={onSave}
        onClose={onClose}
        themeColors={themeColors}
        lang={lang}
        bottomInset={bottomInset}
      />
    </BottomSheet>
  );
});

export default function AdvancedColorPicker({ visible, initialColor, onSave, onClose }) {
  const { global, lang } = useScheduleData();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const snapPoints = useMemo(() => [
    Math.min(height * 0.82, 700),
    Math.min(height * 0.94, 840),
  ], [height]);
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  onSaveRef.current = onSave;
  onCloseRef.current = onClose;

  const handleSave = useCallback((color) => onSaveRef.current?.(color), []);
  const handleClose = useCallback(() => onCloseRef.current?.(), []);

  return (
    <AdvancedColorPickerSheet
      visible={visible}
      initialColor={initialColor}
      onSave={handleSave}
      onClose={handleClose}
      themeColors={themeColors}
      lang={lang}
      bottomInset={insets.bottom}
      snapPoints={snapPoints}
    />
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  pickerContainer: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  valueCard: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  colorPreview: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  valueCopy: {
    flex: 1,
    minWidth: 0,
  },
  valueLabel: {
    marginBottom: 5,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  hexInput: {
    width: "100%",
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  saveButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  saveButtonText: {
    fontWeight: "800",
    fontSize: 16,
  },
});
