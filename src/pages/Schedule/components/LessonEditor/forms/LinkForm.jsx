import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link as LinkIcon, TextT } from "phosphor-react-native";
import { getLinkTypeMeta, LINK_TYPES } from "../../../../../config/contactTypes";
import {
  getContactTypeColor,
  getLinkOpenUrl,
  getLinkValueError,
  inferLinkIconId,
  inferLinkType,
  normalizeContactIcon,
} from "../../../../../utils/contactData";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import ContactAppearancePicker from "./ContactAppearancePicker";

export default function LinkEditor({ linkId, localLinkData, onSaveLocal, onBack, saveLabel, onOpenColorPicker, themeColors }) {
  const { lang } = useScheduleData();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("website");
  const [icon, setIcon] = useState("globe");
  const [color, setColor] = useState(getContactTypeColor("website"));
  const [appearanceEdited, setAppearanceEdited] = useState(false);
  const [errorKey, setErrorKey] = useState("");

  useEffect(() => {
    if (!localLinkData) return;
    const initialType = getLinkTypeMeta(localLinkData.type, localLinkData.url).id;
    const initialIcon = normalizeContactIcon(
      localLinkData.icon || inferLinkIconId(localLinkData.url, initialType),
      initialType,
    );
    setName(localLinkData.name || "");
    setUrl(localLinkData.url || "");
    setType(initialType);
    setIcon(initialIcon);
    setColor(/^#[0-9a-f]{6}$/i.test(localLinkData.color || "") ? localLinkData.color : getContactTypeColor(initialType));
    setAppearanceEdited(Boolean(localLinkData.icon || localLinkData.color));
    setErrorKey("");
  }, [localLinkData]);

  const selectedType = getLinkTypeMeta(type, url);

  const handleUrlChange = (value) => {
    setUrl(value);
    setErrorKey("");
    if (!localLinkData?.type && type === "website") {
      const inferredType = inferLinkType(value);
      setType(inferredType);
      if (!appearanceEdited) {
        setIcon(inferLinkIconId(value, inferredType));
        setColor(getContactTypeColor(inferredType));
      }
    }
  };

  const handleSave = () => {
    const nextErrorKey = getLinkValueError(type, url);
    if (nextErrorKey) {
      setErrorKey(nextErrorKey);
      return;
    }

    const cleanUrl = getLinkOpenUrl({ type, url });
    const cleanType = getLinkTypeMeta(type, cleanUrl).id;
    onSaveLocal({
      ...localLinkData,
      id: linkId,
      name: name.trim() || t("schedule.lesson_editor.new_link_default", lang),
      url: cleanUrl,
      type: cleanType,
      icon: normalizeContactIcon(icon, cleanType),
      color,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      enabled={Platform.OS === "ios"}
      keyboardVerticalOffset={110}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.link_name_label", lang)}
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
            <TextT size={20} color={themeColors.textColor2} weight="bold" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: themeColors.textColor }]}
              accessibilityLabel={t("schedule.lesson_editor.link_name_label", lang)}
              placeholder={t("schedule.lesson_editor.link_name_placeholder", lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              value={name}
              onChangeText={setName}
              autoFocus={Platform.OS === "web"}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.link_type_label", lang)}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
            keyboardShouldPersistTaps="handled"
          >
            {LINK_TYPES.map((item) => {
              const selected = item.id === selectedType.id;
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor: selected ? item.color : themeColors.backgroundColor2,
                      borderColor: selected ? item.color : themeColors.borderColor,
                    },
                  ]}
                  onPress={() => {
                    setType(item.id);
                    setErrorKey("");
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={t(item.labelKey, lang)}
                  accessibilityState={{ selected, checked: selected }}
                  activeOpacity={0.75}
                >
                  <Icon size={16} color={selected ? "#fff" : item.color} weight={selected ? "fill" : "bold"} />
                  <Text style={[styles.typeButtonText, { color: selected ? "#fff" : themeColors.textColor }]}>
                    {t(item.labelKey, lang)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.link_value_label", lang)}
          </Text>
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: themeColors.backgroundColor2, borderColor: errorKey ? "#DC2626" : "transparent" },
              errorKey ? styles.inputErrorBorder : null,
            ]}
          >
            <LinkIcon size={20} color={errorKey ? "#DC2626" : themeColors.textColor2} weight="bold" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: themeColors.textColor }]}
              accessibilityLabel={t("schedule.lesson_editor.link_value_label", lang)}
              accessibilityHint={t(selectedType.placeholderKey, lang)}
              accessibilityState={{ invalid: Boolean(errorKey) }}
              placeholder={t(selectedType.placeholderKey, lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              value={url}
              onChangeText={handleUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={type === "telegram" ? "default" : "url"}
              textContentType={type === "telegram" ? "none" : "URL"}
              autoComplete={type === "telegram" ? "off" : "url"}
            />
          </View>
          {errorKey ? (
            <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {t(errorKey, lang)}
            </Text>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.link_appearance_label", lang)}
          </Text>
          <ContactAppearancePicker
            iconId={icon}
            color={color}
            onIconChange={(nextIcon) => {
              setIcon(nextIcon);
              setAppearanceEdited(true);
            }}
            onColorChange={(nextColor) => {
              setColor(nextColor);
              setAppearanceEdited(true);
            }}
            onCustomColorPress={onOpenColorPicker ? () => onOpenColorPicker(color, (nextColor) => {
              setColor(nextColor);
              setAppearanceEdited(true);
            }) : undefined}
            themeColors={themeColors}
            lang={lang}
          />
        </View>

        <Text style={[styles.legalHint, { color: themeColors.textColor2 }]}>
          {t("schedule.lesson_editor.link_rights_hint", lang)}
        </Text>

        <View style={{ flex: 1, minHeight: 32 }} />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.backgroundColor2 }]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel", lang)}
          >
            <Text style={[styles.buttonText, { color: themeColors.textColor }]}>{t("common.cancel", lang)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { backgroundColor: themeColors.accentColor }]}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={saveLabel || t("common.save_changes", lang)}
          >
            <Text style={styles.saveButtonText}>{saveLabel || t("common.save_changes", lang)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 30 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  inputContainer: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, height: 54 },
  inputErrorBorder: { borderWidth: 1 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, height: "100%" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "600", marginTop: 7, marginHorizontal: 4 },
  typeRow: { gap: 8, paddingRight: 4 },
  typeButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  typeButtonText: { fontSize: 13, fontWeight: "700" },
  legalHint: { fontSize: 13, lineHeight: 19, marginHorizontal: 4 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 20 },
  button: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveButton: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
