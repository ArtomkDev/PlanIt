import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Share, Platform } from "react-native";
import { ShareNetwork, Copy, CheckCircle, X, FilePdf, FileDoc, Table, ChatText, Check } from "phosphor-react-native";
import * as Clipboard from "expo-clipboard";
import { useScheduleData } from "../../context/ScheduleProvider";
import { createSharedSchedule, createSharedScheduleLink } from "../../services/shareService";
import { exportSchedule } from "../../services/scheduleExportService";
import { sanitizeSharedSchedule } from "../../utils/scheduleValidation";
import TabSwitcher from "../ui/TabSwitcher";
import AppSwitch from "../ui/AppSwitch";
import SettingsGroup from "../ui/SettingsKit/SettingsGroup";
import SettingsRow from "../ui/SettingsKit/SettingsRow";
import CalendarSheet from "../CalendarSheet/CalendarSheet";
import themes from "../../config/themes";
import { SUPPORTED_LANGUAGES, getLocale, t } from "../../utils/i18n";
import { getScheduleWeekNumbers } from "../../utils/scheduleTime";
import { SCHEDULE_EXPORT_DEFAULTS, getScheduleExportCalendarRange, buildScheduleWeekCalendar } from "../../utils/scheduleExport";
import BottomSheet, { SheetScrollView } from "../ui/BottomSheet";
import MorphingLoader from "../ui/MorphingLoader";
import { triggerHaptic } from "../../utils/haptics";
import { logCrashlyticsError } from "../../utils/analytics/crashlytics";

const FORMATS = [{ id: "pdf", icon: FilePdf }, { id: "docx", icon: FileDoc }, { id: "xlsx", icon: Table }, { id: "csv", icon: Table }, { id: "text", icon: ChatText }];

function ExportChoice({ label, choices, value, onChange, disabled, themeColors }) {
  return <View style={styles.choiceGroup}>
    <Text style={[styles.label, { color: themeColors.textColor2 }]}>{label}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
      {choices.map((choice) => <TouchableOpacity key={choice.id} accessibilityRole="radio"
        accessibilityLabel={choice.label} accessibilityState={{ checked: value === choice.id, disabled }} disabled={disabled}
        aria-checked={value === choice.id} aria-disabled={disabled}
        onPress={() => { onChange(choice.id); triggerHaptic("selection"); }}
        style={[styles.choice, { backgroundColor: value === choice.id ? themeColors.accentColor : themeColors.backgroundColor2,
          borderColor: value === choice.id ? themeColors.accentColor : themeColors.borderColor, opacity: disabled ? 0.5 : 1 }]}>
        <Text style={[styles.choiceText, { color: value === choice.id ? themeColors.textOnAccent : themeColors.textColor }]}>{choice.label}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}

export default function ShareScheduleModal({ visible, onClose, scheduleToShare }) {
  const { user, global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const [method, setMethod] = useState("document");
  const [format, setFormat] = useState("pdf");
  const [duration, setDuration] = useState("7");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [shareTeachers, setShareTeachers] = useState(true);
  const [shareGradients, setShareGradients] = useState(true);
  const [shareLinks, setShareLinks] = useState(true);
  const [shareNotes, setShareNotes] = useState(false);
  const [shareAuthorName, setShareAuthorName] = useState(false);
  const [exportLanguage, setExportLanguage] = useState("auto");
  const [documentOptions, setDocumentOptions] = useState(SCHEDULE_EXPORT_DEFAULTS);
  const [selectedWeeks, setSelectedWeeks] = useState(null);
  const [showAppearance, setShowAppearance] = useState(false);
  const [calendarPreset, setCalendarPreset] = useState("16");
  const [calendarField, setCalendarField] = useState(null);
  const busyRef = useRef(false);
  const copyTimer = useRef(null);
  const shareUrl = generatedCode ? createSharedScheduleLink(generatedCode) : "";

  useEffect(() => {
    if (!visible) return;
    setGeneratedCode(null);
    setCopied(false);
    setErrorMessage("");
    setSuccessMessage("");
    setMethod("document");
    setFormat("pdf");
    setDuration("7");
    setShareTeachers(true);
    setShareGradients(true);
    setShareLinks(true);
    setShareNotes(false);
    setShareAuthorName(false);
    setExportLanguage("auto");
    setDocumentOptions({ ...SCHEDULE_EXPORT_DEFAULTS, ...getScheduleExportCalendarRange(scheduleToShare) });
    setSelectedWeeks(null);
    setShowAppearance(false);
    setCalendarPreset("16");
    setCalendarField(null);
  }, [visible, scheduleToShare?.id]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const close = () => {
    if (busyRef.current) return;
    triggerHaptic("sheetClose");
    onClose();
  };

  const handleCreate = async () => {
    if (!scheduleToShare || busyRef.current || (method === "code" && !user?.uid)) return;
    busyRef.current = true;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const options = { ...documentOptions, includeWeekCalendar: calendarAvailable && documentOptions.includeWeekCalendar,
        ...(selectedWeeks ? { selectedWeeks } : {}), shareTeachers, shareGradients, shareLinks, shareNotes, shareAuthorName, authorName: user?.displayName };
      if (method === "document") {
        await exportSchedule(scheduleToShare, format, exportLanguage === "auto" ? lang : exportLanguage, options);
        if (Platform.OS === "web" && format === "pdf") setSuccessMessage(t("share.pdf_download_ready", lang));
      } else {
        const code = await createSharedSchedule(
          { ...user, displayName: shareAuthorName ? user.displayName || t("share.anonymous", lang) : t("share.anonymous", lang) },
          sanitizeSharedSchedule(scheduleToShare, options), Number(duration),
        );
        setGeneratedCode(code);
      }
      triggerHaptic("success");
    } catch (error) {
      logCrashlyticsError(error, method === "document" ? "schedule-export" : "schedule-share");
      triggerHaptic("error");
      setErrorMessage(t(method === "document" ? "share.export_failed" : "common.action_failed", lang));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
      triggerHaptic("success");
    } catch (error) { setErrorMessage(t("common.action_failed", lang)); }
  };
  const handleShare = async () => {
    try { await Share.share({ message: t("share.share_message", lang) + ": " + shareUrl, url: shareUrl }); }
    catch (error) { setErrorMessage(t("common.action_failed", lang)); }
  };

  const optionRow = (label, value, setter) => (
    <SettingsRow key={label} label={t(label, lang)} themeColors={themeColors} showCaret={false}
      rightContent={<AppSwitch accessibilityLabel={t(label, lang)} value={value}
        disabled={loading}
        onValueChange={(next) => { if (!loading) { setter(next); triggerHaptic(next ? "toggleOn" : "toggleOff"); } }} themeColors={themeColors} />}
    />
  );
  const updateDocumentOption = (key, value) => setDocumentOptions((previous) => ({ ...previous, [key]: value }));
  const choice = (key, ids) => <ExportChoice label={t("share." + key, lang)} choices={ids.map((id) => ({ id, label: t("share." + key + "_" + id, lang) }))}
    value={documentOptions[key]} onChange={(value) => updateDocumentOption(key, value)} disabled={loading} themeColors={themeColors} />;
  const weeks = getScheduleWeekNumbers(scheduleToShare?.repeat);
  const activeWeeks = selectedWeeks || weeks;
  const styledDocument = format === "pdf" || format === "docx";
  const spreadsheet = format === "xlsx" || format === "csv";
  const calendarAvailable = method === "document" && (styledDocument || format === "xlsx");
  let calendarPreview = null;
  let calendarError = "";
  if (calendarAvailable && documentOptions.includeWeekCalendar) {
    try { calendarPreview = buildScheduleWeekCalendar(scheduleToShare, lang, documentOptions); }
    catch (error) { calendarError = t(error.message === "week_calendar_missing_anchor" ? "share.week_calendar_missing_anchor" : "share.week_calendar_invalid_range", lang); }
  }
  const calendarDateLabel = value => new Intl.DateTimeFormat(getLocale(lang), { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
  const handleCalendarDate = date => {
    const range = getScheduleExportCalendarRange(scheduleToShare, Number(calendarPreset) || 16, date);
    setDocumentOptions(previous => ({ ...previous,
      ...(calendarField === "from" ? calendarPreset === "custom" ? { calendarFrom: range.calendarFrom } : range : { calendarTo: range.calendarFrom }),
    }));
    if (calendarField === "to") setCalendarPreset("custom");
    setCalendarField(null);
  };

  return (
    <>
    <BottomSheet visible={visible} onClose={close} snapPoints={["58%", "92%"]} initialSnapIndex={1} maxWidth={680}
      backgroundColor={themeColors.backgroundColor} handleColor={themeColors.textColor3}
      accessibilityLabel={t("share.modal_title", lang)} closeAccessibilityLabel={t("common.close", lang)} testID="share-schedule-sheet">
      <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: themeColors.textColor }]}>{t("share.modal_title", lang)}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textColor2 }]} numberOfLines={2}>{scheduleToShare?.name}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close", lang)}
          accessibilityState={{ disabled: loading }} onPress={close} disabled={loading} style={styles.closeButton}>
          <X size={24} color={themeColors.textColor} weight="bold" />
        </TouchableOpacity>
      </View>
      <SheetScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!generatedCode ? <>
          <TabSwitcher tabs={[{ id: "document", label: t("share.document_tab", lang) }, { id: "code", label: t("share.code_tab", lang) }]}
            activeTab={method} onTabPress={(value) => { if (!loading) { setMethod(value); setErrorMessage(""); setSuccessMessage(""); } }} themeColors={themeColors} />
          <Text style={[styles.description, { color: themeColors.textColor2 }]}>
            {t(method === "document" ? "share.document_hint" : "share.code_hint", lang)}
          </Text>
          {method === "document" ? <>
            <ExportChoice label={t("share.document_language", lang)}
              choices={[{ id: "auto", label: t("share.language_auto", lang, { language: SUPPORTED_LANGUAGES.find((item) => item.code === lang)?.label || lang }) },
                ...SUPPORTED_LANGUAGES.map((item) => ({ id: item.code, label: item.label }))]}
              value={exportLanguage} onChange={setExportLanguage} disabled={loading} themeColors={themeColors} />
            <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.language_hint", lang)}</Text>
            <SettingsGroup themeColors={themeColors}>
            {FORMATS.map(({ id, icon }) => <SettingsRow key={id} icon={icon} label={t("share.format_" + id, lang)}
              desc={t(id === "pdf" && Platform.OS === "web" ? "share.format_pdf_web_desc" : "share.format_" + id + "_desc", lang)}
              onPress={() => setFormat(id)} themeColors={themeColors} disabled={loading} showCaret={false}
              accessibilityRole="radio" accessibilityState={{ checked: format === id, disabled: loading }}
              rightContent={format === id ? <Check size={22} color={themeColors.accentTextColor} weight="bold" /> : null} />)}
          </SettingsGroup>
            {weeks.length > 1 && <View style={styles.choiceGroup}>
              <Text style={[styles.label, { color: themeColors.textColor2 }]}>{t("share.export_weeks", lang)}</Text>
              <View style={styles.choices}>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading}
                  onPress={() => setSelectedWeeks(null)} style={[styles.choice, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
                  <Text style={[styles.choiceText, { color: themeColors.accentTextColor }]}>{t("share.all_weeks", lang)}</Text>
                </TouchableOpacity>
                {weeks.map((week) => <TouchableOpacity key={week} accessibilityRole="checkbox"
                  accessibilityLabel={t("common.week", lang, { week })} accessibilityState={{ checked: activeWeeks.includes(week), disabled: loading }} disabled={loading}
                  aria-checked={activeWeeks.includes(week)} aria-disabled={loading}
                  onPress={() => setSelectedWeeks(activeWeeks.includes(week) ? activeWeeks.length > 1 ? activeWeeks.filter((item) => item !== week) : activeWeeks : [...activeWeeks, week].sort((a, b) => a - b))}
                  style={[styles.choice, { backgroundColor: activeWeeks.includes(week) ? themeColors.accentColor : themeColors.backgroundColor2,
                    borderColor: activeWeeks.includes(week) ? themeColors.accentColor : themeColors.borderColor }]}>
                  <Text style={[styles.choiceText, { color: activeWeeks.includes(week) ? themeColors.textOnAccent : themeColors.textColor }]}>{t("common.week", lang, { week })}</Text>
                </TouchableOpacity>)}
              </View>
            </View>}
            {styledDocument && <>
              {choice("layout", ["grid", "combined", "agenda"])}
              <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.layout_" + documentOptions.layout + "_hint", lang)}</Text>
              <SettingsGroup themeColors={themeColors}>
                <SettingsRow label={t("share.appearance", lang)} value={t("share." + (showAppearance ? "hide_settings" : "show_settings"), lang)}
                  accessibilityState={{ expanded: showAppearance, disabled: loading }} disabled={loading}
                  onPress={() => setShowAppearance((value) => !value)} themeColors={themeColors} />
              </SettingsGroup>
              {showAppearance && <>
                {choice("paper", ["a4", "letter"])}
                {choice("orientation", ["auto", "landscape", "portrait"])}
                {choice("density", ["compact", "comfortable", "large"])}
                {choice("color", ["accent", "mono"])}
              </>}
            </>}
            {format === "csv" && <>
              {choice("csvSeparator", ["comma", "semicolon", "tab"])}
              <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.csv_hint", lang)}</Text>
            </>}
            {format === "xlsx" && <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.xlsx_hint", lang)}</Text>}
            {styledDocument && shareLinks && choice("linkStyle", ["label", "full"])}
            {calendarAvailable && <>
              <SettingsGroup themeColors={themeColors}>
                <SettingsRow label={t("share.week_calendar_title", lang)} desc={t("share.week_calendar_toggle_hint", lang)}
                  themeColors={themeColors} showCaret={false}
                  rightContent={<AppSwitch accessibilityLabel={t("share.week_calendar_title", lang)} value={documentOptions.includeWeekCalendar}
                    disabled={loading} onValueChange={value => { updateDocumentOption("includeWeekCalendar", value); triggerHaptic(value ? "toggleOn" : "toggleOff"); }} themeColors={themeColors} />} />
              </SettingsGroup>
              {documentOptions.includeWeekCalendar && <>
                <ExportChoice label={t("share.week_calendar_length", lang)} choices={[
                  ...[4, 8, 16, 26].map(count => ({ id: String(count), label: t("share.week_calendar_weeks", lang, { count }) })),
                  { id: "custom", label: t("share.week_calendar_custom", lang) },
                ]} value={calendarPreset} onChange={value => {
                  setCalendarPreset(value);
                  if (value !== "custom") setDocumentOptions(previous => ({ ...previous, ...getScheduleExportCalendarRange(scheduleToShare, Number(value), previous.calendarFrom) }));
                }} disabled={loading} themeColors={themeColors} />
                <SettingsGroup themeColors={themeColors}>
                  {["from", "to"].map(field => <SettingsRow key={field} label={t("share.week_calendar_" + field, lang)}
                    value={documentOptions[field === "from" ? "calendarFrom" : "calendarTo"] ? calendarDateLabel(documentOptions[field === "from" ? "calendarFrom" : "calendarTo"]) : ""}
                    valuePosition="below" disabled={loading} themeColors={themeColors} onPress={() => setCalendarField(field)} />)}
                </SettingsGroup>
                <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.week_calendar_hint", lang)}</Text>
                {calendarPreview && <Text style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{t("share.week_calendar_preview", lang, { count: calendarPreview.rows.length })}</Text>}
                {!!calendarError && <Text accessibilityRole="alert" style={styles.error}>{calendarError}</Text>}
              </>}
            </>}
          </> : user?.uid ? <>
            <Text style={[styles.label, { color: themeColors.textColor2 }]}>{t("share.select_duration", lang)}</Text>
            <TabSwitcher tabs={["1", "3", "7", "30"].map((id) => ({ id, label: t("share.duration_" + id + "d", lang) }))}
              activeTab={duration} onTabPress={(value) => { if (!loading) setDuration(value); }} themeColors={themeColors} />
          </> : <Text style={[styles.description, { color: themeColors.textColor2 }]}>{t("share.code_auth_hint", lang)}</Text>}

          {(method === "document" || user?.uid) && <>
            <SettingsGroup title={t(method === "document" ? "share.document_content" : "share.privacy_settings", lang)} themeColors={themeColors}>
              {method === "document" && <>
                {optionRow("share.include_locations", documentOptions.shareLocations, (value) => updateDocumentOption("shareLocations", value))}
                {optionRow("share.include_types", documentOptions.shareTypes, (value) => updateDocumentOption("shareTypes", value))}
                {optionRow("share.show_numbers", documentOptions.showNumbers, (value) => updateDocumentOption("showNumbers", value))}
                {!spreadsheet && optionRow("share.show_empty_days", documentOptions.showEmptyDays, (value) => updateDocumentOption("showEmptyDays", value))}
                {format !== "csv" && optionRow("share.show_cycle_start", documentOptions.showCycleStart, (value) => updateDocumentOption("showCycleStart", value))}
              </>}
              {optionRow("share.include_teachers", shareTeachers, setShareTeachers)}
              {optionRow("share.include_links", shareLinks, setShareLinks)}
              {optionRow("share.include_notes", shareNotes, setShareNotes)}
              {method === "code" && optionRow("share.include_colors", shareGradients, setShareGradients)}
              {!!user?.displayName && (method === "code" || format !== "csv") && optionRow("share.include_author", shareAuthorName, setShareAuthorName)}
            </SettingsGroup>
          </>}
        </> : <View>
          <Text style={[styles.title, { color: themeColors.textColor }]}>{t("share.success_title", lang)}</Text>
          <View style={[styles.codeBox, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
            <Text selectable style={[styles.code, { color: themeColors.accentTextColor }]}>{generatedCode}</Text>
            <Text selectable style={[styles.link, { color: themeColors.textColor2 }]}>{shareUrl}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity accessibilityRole="button" onPress={handleCopy} style={[styles.actionBtn, { backgroundColor: themeColors.backgroundColor2 }]}>
              {copied ? <CheckCircle size={22} color={themeColors.accentTextColor} /> : <Copy size={22} color={themeColors.textColor} />}
              <Text style={[styles.buttonText, { color: themeColors.textColor }]}>{t(copied ? "common.copied" : "share.copy_link", lang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={handleShare} style={[styles.actionBtn, { backgroundColor: themeColors.accentColor }]}>
              <ShareNetwork size={22} color={themeColors.textOnAccent} />
              <Text style={[styles.buttonText, { color: themeColors.textOnAccent }]}>{t("common.share", lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>}
      </SheetScrollView>
      {(!generatedCode && (method === "document" || user?.uid) || errorMessage || successMessage) && <View style={[styles.footer, { borderColor: themeColors.borderColor }]}>
        {!!errorMessage && <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>}
        {!!successMessage && <Text accessibilityLiveRegion="polite" style={[styles.fieldHint, { color: themeColors.textColor2 }]}>{successMessage}</Text>}
        {!generatedCode && (method === "document" || user?.uid) && <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading || !!calendarError, busy: loading }}
          style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor, opacity: loading || calendarError ? 0.7 : 1 }]}
          onPress={handleCreate} disabled={loading || !!calendarError}>
          {loading ? <MorphingLoader size={22} /> : <ShareNetwork size={22} color={themeColors.textOnAccent} weight="bold" />}
          <Text style={[styles.buttonText, { color: themeColors.textOnAccent }]}>
            {t(loading ? "share.preparing" : method === "code" ? "share.generate_btn" : format === "text" ? "share.send_text" : "share.export_btn", lang)}
          </Text>
        </TouchableOpacity>}
      </View>}
    </BottomSheet>
    {calendarField && calendarAvailable && <CalendarSheet visible={visible} onClose={() => setCalendarField(null)}
      currentDate={new Date(`${documentOptions[calendarField === "from" ? "calendarFrom" : "calendarTo"]}T12:00:00`)}
      customSchedule={scheduleToShare} onDateSelect={handleCalendarDate} />}
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  heading: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 24 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  description: { fontSize: 14, lineHeight: 21, marginVertical: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  choiceGroup: { marginTop: 20, marginBottom: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 12 },
  choiceText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  fieldHint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  primaryBtn: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 16, gap: 10 },
  buttonText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  error: { color: "#FF3B30", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  codeBox: { padding: 20, borderRadius: 16, borderWidth: 1, marginVertical: 20 },
  code: { fontSize: 26, fontWeight: "800", letterSpacing: 2 },
  link: { fontSize: 14, lineHeight: 21, marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 16, gap: 8 },
});
