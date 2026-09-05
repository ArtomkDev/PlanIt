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
import { CaretDown, PencilSimple, Plus, Trash, User } from "phosphor-react-native";
import {
  getContactIconComponent,
  getTeacherContactTypeMeta,
  TEACHER_CONTACT_TYPES,
} from "../../../../../config/contactTypes";
import {
  getContactValueError,
  getTeacherAppearance,
  getTeacherContactOpenUrl,
  normalizeContactIcon,
  normalizeTeacherContacts,
} from "../../../../../utils/contactData";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import ContactAppearancePicker from "./ContactAppearancePicker";

const createLocalContactId = (seed = "") => `${Date.now().toString(36)}${String(seed)}${Math.random().toString(36).slice(2, 6)}`;

const getKeyboardType = (type) => {
  if (type === "phone") return "phone-pad";
  if (type === "email") return "email-address";
  if (type === "website") return "url";
  return "default";
};

const getAutoComplete = (type) => {
  if (type === "phone") return "tel";
  if (type === "email") return "email";
  if (type === "website") return "url";
  return "off";
};

export default function TeacherEditor({
  teacherId,
  localTeacherData,
  initialContactId,
  initialContact,
  onSaveLocal,
  onBack,
  onOpenColorPicker,
  themeColors,
}) {
  const { lang } = useScheduleData();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("user");
  const [color, setColor] = useState("#6366F1");
  const [contacts, setContacts] = useState([]);
  const [expandedContactId, setExpandedContactId] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!localTeacherData) return;
    const normalizedContacts = normalizeTeacherContacts(localTeacherData, createLocalContactId);
    const appearance = getTeacherAppearance(localTeacherData);
    setName(localTeacherData.name || "");
    setIcon(appearance.icon);
    setColor(appearance.color);
    setContacts(normalizedContacts);
    const requestedContact = normalizedContacts.find((contact) => (
      (initialContactId && contact.id === initialContactId)
      || (
        initialContact
        && contact.type === initialContact.type
        && contact.value === initialContact.value
      )
    ));
    setExpandedContactId(requestedContact?.id || null);
    setErrors({});
  }, [initialContact, initialContactId, localTeacherData]);

  const addContact = () => {
    const meta = getTeacherContactTypeMeta("phone");
    const id = createLocalContactId("contact");
    setContacts((prev) => [
      ...prev,
      {
        id,
        type: meta.id,
        label: "",
        value: "",
        icon: meta.iconId,
        color: meta.color,
      },
    ]);
    setExpandedContactId(id);
  };

  const updateContact = (id, updates) => {
    setContacts((prev) => prev.map((contact) => contact.id === id ? { ...contact, ...updates } : contact));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateContactType = (contact, nextType) => {
    const previousMeta = getTeacherContactTypeMeta(contact.type);
    const nextMeta = getTeacherContactTypeMeta(nextType);
    updateContact(contact.id, {
      type: nextMeta.id,
      icon: contact.icon === previousMeta.iconId ? nextMeta.iconId : contact.icon,
      color: contact.color === previousMeta.color ? nextMeta.color : contact.color,
    });
  };

  const removeContact = (id) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
    setExpandedContactId((current) => current === id ? null : current);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSave = () => {
    const nextErrors = {};
    const preparedContacts = contacts.map((contact) => {
      const value = contact.value.trim();
      if (!value) return null;
      const meta = getTeacherContactTypeMeta(contact.type);
      const errorKey = getContactValueError(meta.id, value);
      if (errorKey) {
        nextErrors[contact.id] = errorKey;
        return null;
      }
      return {
        id: contact.id || createLocalContactId(meta.id),
        type: meta.id,
        label: contact.label.trim(),
        value,
        url: getTeacherContactOpenUrl({ type: meta.id, value }),
        icon: normalizeContactIcon(contact.icon, meta.id),
        color: contact.color || meta.color,
      };
    }).filter(Boolean);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setExpandedContactId(Object.keys(nextErrors)[0]);
      return;
    }

    const cleanContacts = normalizeTeacherContacts({ contacts: preparedContacts }, createLocalContactId);
    onSaveLocal({
      ...localTeacherData,
      id: teacherId,
      name: name.trim() || t("schedule.lesson_editor.teacher_name_default", lang),
      icon: normalizeContactIcon(icon, "user"),
      color,
      phone: cleanContacts.find((contact) => contact.type === "phone")?.value || "",
      email: cleanContacts.find((contact) => contact.type === "email")?.value || "",
      contacts: cleanContacts,
    });
  };

  const renderTypeButton = (contact, type) => {
    const selected = contact.type === type.id;
    const Icon = type.icon;
    return (
      <TouchableOpacity
        key={type.id}
        style={[
          styles.typeButton,
          {
            backgroundColor: selected ? type.color : themeColors.backgroundColor,
            borderColor: selected ? type.color : themeColors.borderColor,
          },
        ]}
        onPress={() => updateContactType(contact, type.id)}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityLabel={t(type.labelKey, lang)}
        accessibilityState={{ selected, checked: selected }}
      >
        <Icon size={16} color={selected ? "#fff" : type.color} weight={selected ? "fill" : "bold"} />
        <Text style={[styles.typeButtonText, { color: selected ? "#fff" : themeColors.textColor }]}>
          {t(type.labelKey, lang)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContact = (contact, index) => {
    const meta = getTeacherContactTypeMeta(contact.type);
    const contactColor = contact.color || meta.color;
    const iconId = normalizeContactIcon(contact.icon, meta.id);
    const Icon = getContactIconComponent(iconId, meta.id);
    const errorKey = errors[contact.id];
    const expanded = expandedContactId === contact.id;
    const summary = contact.label || contact.value || t(meta.labelKey, lang);

    return (
      <View
        key={contact.id}
        style={[
          styles.contactCard,
          {
            backgroundColor: themeColors.backgroundColor2,
            borderColor: errorKey ? "#DC2626" : expanded ? contactColor + "88" : themeColors.borderColor,
          },
        ]}
      >
        <View style={styles.contactHeader}>
          <TouchableOpacity
            style={styles.contactSummary}
            onPress={() => setExpandedContactId(expanded ? null : contact.id)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`${t("schedule.lesson_editor.teacher_contact_item", lang)} ${index + 1}: ${summary}`}
            accessibilityHint={t("schedule.lesson_editor.teacher_contact_edit_hint", lang)}
            accessibilityState={{ expanded }}
          >
            <View style={[styles.contactIcon, { backgroundColor: contactColor + "18" }]}>
              <Icon size={20} color={contactColor} weight="bold" />
            </View>
            <View style={styles.contactSummaryText}>
              <Text style={[styles.contactTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                {summary}
              </Text>
              <Text style={[styles.contactSubtitle, { color: errorKey ? "#DC2626" : themeColors.textColor2 }]} numberOfLines={1}>
                {errorKey ? t(errorKey, lang) : t(meta.labelKey, lang)}
              </Text>
            </View>
            <PencilSimple size={18} color={themeColors.textColor2} weight="bold" />
            <CaretDown
              size={16}
              color={themeColors.textColor2}
              weight="bold"
              style={expanded ? styles.caretOpen : null}
            />
          </TouchableOpacity>
        </View>

        {expanded ? (
          <View style={styles.contactDetails}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeRow}
              keyboardShouldPersistTaps="handled"
              accessibilityRole="radiogroup"
            >
              {TEACHER_CONTACT_TYPES.map((type) => renderTypeButton(contact, type))}
            </ScrollView>

            <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: themeColors.textColor2 }]}>
              {t(meta.labelKey, lang)}
            </Text>
            <View
              style={[
                styles.inputContainer,
                styles.compactInput,
                { backgroundColor: themeColors.backgroundColor, borderColor: errorKey ? "#DC2626" : "transparent" },
                errorKey ? styles.inputErrorBorder : null,
              ]}
            >
              <TextInput
                style={[styles.input, { color: themeColors.textColor }]}
                accessibilityLabel={t(meta.labelKey, lang)}
                accessibilityHint={t(meta.placeholderKey, lang)}
                accessibilityState={{ invalid: Boolean(errorKey) }}
                placeholder={t(meta.placeholderKey, lang)}
                placeholderTextColor={themeColors.textColor2 + "80"}
                value={contact.value}
                onChangeText={(value) => updateContact(contact.id, { value })}
                keyboardType={getKeyboardType(contact.type)}
                textContentType={contact.type === "email" ? "emailAddress" : contact.type === "phone" ? "telephoneNumber" : contact.type === "website" ? "URL" : "none"}
                autoComplete={getAutoComplete(contact.type)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errorKey ? (
              <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {t(errorKey, lang)}
              </Text>
            ) : null}

            <Text style={[styles.fieldLabel, styles.fieldSpacing, { color: themeColors.textColor2 }]}>
              {t("schedule.lesson_editor.teacher_contact_label", lang)}
            </Text>
            <View style={[styles.inputContainer, styles.compactInput, { backgroundColor: themeColors.backgroundColor }]}>
              <TextInput
                style={[styles.input, { color: themeColors.textColor }]}
                accessibilityLabel={t("schedule.lesson_editor.teacher_contact_label", lang)}
                placeholder={t("schedule.lesson_editor.teacher_contact_label_placeholder", lang)}
                placeholderTextColor={themeColors.textColor2 + "80"}
                value={contact.label}
                onChangeText={(label) => updateContact(contact.id, { label })}
              />
            </View>

            <ContactAppearancePicker
              iconId={iconId}
              color={contactColor}
              onIconChange={(nextIcon) => updateContact(contact.id, { icon: nextIcon })}
              onColorChange={(nextColor) => updateContact(contact.id, { color: nextColor })}
              onCustomColorPress={onOpenColorPicker ? () => onOpenColorPicker(
                contactColor,
                (nextColor) => updateContact(contact.id, { color: nextColor }),
              ) : undefined}
              themeColors={themeColors}
              lang={lang}
            />

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeContact(contact.id)}
              accessibilityRole="button"
              accessibilityLabel={t("schedule.lesson_editor.teacher_contact_remove", lang)}
            >
              <Trash size={18} color="#DC2626" weight="bold" />
              <Text style={styles.removeButtonText}>{t("schedule.lesson_editor.teacher_contact_remove", lang)}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
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
            {t("schedule.lesson_editor.teacher_name_label", lang)}
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
            <User size={20} color={themeColors.textColor2} weight="bold" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: themeColors.textColor }]}
              accessibilityLabel={t("schedule.lesson_editor.teacher_name_label", lang)}
              placeholder={t("schedule.lesson_editor.teacher_name_placeholder", lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              value={name}
              onChangeText={setName}
              autoFocus={Platform.OS === "web"}
              textContentType="name"
              autoComplete="name"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.teacher_appearance_label", lang)}
          </Text>
          <ContactAppearancePicker
            iconId={icon}
            color={color}
            onIconChange={setIcon}
            onColorChange={setColor}
            onCustomColorPress={onOpenColorPicker ? () => onOpenColorPicker(color, setColor) : undefined}
            themeColors={themeColors}
            lang={lang}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.teacher_contacts_label", lang)}
          </Text>
          <Text style={[styles.privacyHint, { color: themeColors.textColor2 }]}>
            {t("schedule.lesson_editor.teacher_contacts_privacy_hint", lang)}
          </Text>
          {contacts.map(renderContact)}
          <TouchableOpacity
            style={[styles.addContactButton, { borderColor: themeColors.accentColor, backgroundColor: themeColors.accentColor + "10" }]}
            onPress={addContact}
            accessibilityRole="button"
            accessibilityLabel={t("schedule.lesson_editor.teacher_contact_add", lang)}
            activeOpacity={0.75}
          >
            <Plus size={20} color={themeColors.accentColor} weight="bold" />
            <Text style={[styles.addContactText, { color: themeColors.accentColor }]}>
              {t("schedule.lesson_editor.teacher_contact_add", lang)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />
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
            accessibilityLabel={t("common.save_changes", lang)}
          >
            <Text style={styles.saveButtonText}>{t("common.save_changes", lang)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  privacyHint: { fontSize: 12, lineHeight: 18, marginHorizontal: 4, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 7 },
  fieldSpacing: { marginTop: 12 },
  inputContainer: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 14, height: 52 },
  inputErrorBorder: { borderWidth: 1 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, height: "100%", minWidth: 0 },
  compactInput: { height: 46 },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "600", marginTop: 7 },
  contactCard: { borderWidth: 1, borderRadius: 14, marginBottom: 8, overflow: "hidden" },
  contactHeader: { minHeight: 58 },
  contactSummary: { minHeight: 58, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  contactIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  contactSummaryText: { flex: 1, minWidth: 0 },
  contactTitle: { fontSize: 14, fontWeight: "700" },
  contactSubtitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  contactDetails: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(128,128,128,0.24)", padding: 12, paddingTop: 10 },
  caretOpen: { transform: [{ rotate: "180deg" }] },
  removeButton: { minHeight: 44, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  removeButtonText: { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  typeRow: { gap: 8, paddingRight: 4 },
  typeButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  typeButtonText: { fontSize: 13, fontWeight: "700" },
  addContactButton: { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  addContactText: { fontSize: 14, fontWeight: "700" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 16 },
  button: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveButton: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
