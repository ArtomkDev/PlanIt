import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Share } from "react-native";
import { ShareNetwork, Copy, CheckCircle, X, BookOpen, GraduationCap, Palette, User, Link, Note } from "phosphor-react-native";
import * as Clipboard from "expo-clipboard";
import { useScheduleData } from "../../context/ScheduleProvider";
import { createSharedSchedule } from "../../services/shareService";
import { sanitizeSharedSchedule } from "../../utils/scheduleValidation";
import TabSwitcher from "../ui/TabSwitcher";
import AppSwitch from "../ui/AppSwitch";
import themes from "../../config/themes";
import { t } from "../../utils/i18n";
import BottomSheet, { SheetScrollView } from "../ui/BottomSheet";
import { triggerHaptic } from "../../utils/haptics";

export default function ShareScheduleModal({ visible, onClose, scheduleToShare }) {
  const { user, global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [duration, setDuration] = useState("7");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [shareTeachers, setShareTeachers] = useState(true);
  const [shareGradients, setShareGradients] = useState(true);
  const [shareLinks, setShareLinks] = useState(true);
  const [shareNotes, setShareNotes] = useState(true);
  const [shareAuthorName, setShareAuthorName] = useState(true);

  const handleGenerate = async () => {
    if (!user || !scheduleToShare) {
      triggerHaptic("warning");
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const processedSchedule = sanitizeSharedSchedule(scheduleToShare, {
        shareTeachers,
        shareGradients,
        shareLinks,
        shareNotes,
      });

      const customOwnerName = shareAuthorName 
        ? (user.displayName || user.email || "User") 
        : t("share.anonymous", lang) || "Anonymous";

      const code = await createSharedSchedule(
        { ...user, displayName: customOwnerName },
        processedSchedule,
        Number(duration)
      );
      setGeneratedCode(code);
      triggerHaptic("success");
    } catch (error) {
      triggerHaptic("error");
      console.error(error);
      setErrorMessage(t("common.error", lang));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await Clipboard.setStringAsync(generatedCode);
    triggerHaptic("success");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareSystem = async () => {
    if (!generatedCode) return;
    const url = `https://planit.app/share/${generatedCode}`;
    try {
      triggerHaptic("open");
      await Share.share({
        message: `${t("share.share_message", lang)}: ${url}`,
        url: url,
      });
    } catch (error) {
      triggerHaptic("error");
      console.error(error);
    }
  };

  const resetAndClose = () => {
    triggerHaptic("sheetClose");
    setGeneratedCode(null);
    setDuration("7");
    setErrorMessage(null);
    setShareTeachers(true);
    setShareGradients(true);
    setShareLinks(true);
    setShareNotes(true);
    setShareAuthorName(true);
    onClose();
  };

  const durationTabs = [
    { id: "1", label: t("share.duration_1d", lang) },
    { id: "3", label: t("share.duration_3d", lang) },
    { id: "7", label: t("share.duration_7d", lang) },
    { id: "30", label: t("share.duration_30d", lang) },
  ];

  const toggleShareOption = (setter) => (value) => {
    triggerHaptic(value ? "toggleOn" : "toggleOff");
    setter(value);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={resetAndClose}
      snapPoints={["58%", "92%"]}
      initialSnapIndex={1}
      maxWidth={680}
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("share.modal_title", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="share-schedule-sheet"
    >
            <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
              <Text style={[styles.title, { color: themeColors.textColor }]}>
                {t("share.modal_title", lang)}
              </Text>
              <TouchableOpacity onPress={resetAndClose} hitSlop={15}>
                <X size={24} color={themeColors.textColor} weight="bold" />
              </TouchableOpacity>
            </View>

            <SheetScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!generatedCode ? (
                <>
                  <Text style={[styles.label, { color: themeColors.textColor2 }]}>
                    {t("share.select_duration", lang)}
                  </Text>
                  
                  <View style={styles.tabWrapper}>
                    <TabSwitcher
                      tabs={durationTabs}
                      activeTab={duration}
                      onTabPress={setDuration}
                      themeColors={themeColors}
                      containerBackgroundColor={themeColors.backgroundColor2}
                    />
                  </View>

                  <Text style={[styles.label, { color: themeColors.textColor2, marginTop: 24, marginBottom: 8 }]}>
                    {t("share.privacy_settings", lang) || "НАЛАШТУВАННЯ КОНФІДЕНЦІЙНОСТІ"}
                  </Text>

                  <View style={[styles.optionsGroup, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
                    <View style={styles.optionRow}>
                      <View style={styles.optionLeft}>
                        <GraduationCap size={22} color={themeColors.textColor2} weight="bold" />
                        <Text style={[styles.optionText, { color: themeColors.textColor }]}>
                          {t("share.include_teachers", lang) || "Поділитися викладачами"}
                        </Text>
                      </View>
                      <AppSwitch
                        value={shareTeachers}
                        onValueChange={toggleShareOption(setShareTeachers)}
                        themeColors={themeColors}
                      />
                    </View>

                    <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

                    <View style={styles.optionRow}>
                      <View style={styles.optionLeft}>
                        <Palette size={22} color={themeColors.textColor2} weight="bold" />
                        <Text style={[styles.optionText, { color: themeColors.textColor }]}>
                          {t("share.include_colors", lang) || "Зберегти кольори та градієнти"}
                        </Text>
                      </View>
                      <AppSwitch
                        value={shareGradients}
                        onValueChange={toggleShareOption(setShareGradients)}
                        themeColors={themeColors}
                      />
                    </View>

                    <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

                    <View style={styles.optionRow}>
                      <View style={styles.optionLeft}>
                        <Link size={22} color={themeColors.textColor2} weight="bold" />
                        <Text style={[styles.optionText, { color: themeColors.textColor }]}>
                          {t("share.include_links", lang) || "Поділитися посиланнями"}
                        </Text>
                      </View>
                      <AppSwitch
                        value={shareLinks}
                        onValueChange={toggleShareOption(setShareLinks)}
                        themeColors={themeColors}
                      />
                    </View>

                    <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

                    <View style={styles.optionRow}>
                      <View style={styles.optionLeft}>
                        <Note size={22} color={themeColors.textColor2} weight="bold" />
                        <Text style={[styles.optionText, { color: themeColors.textColor }]}>
                          {t("share.include_notes", lang) || "Включити нотатки до занять"}
                        </Text>
                      </View>
                      <AppSwitch
                        value={shareNotes}
                        onValueChange={toggleShareOption(setShareNotes)}
                        themeColors={themeColors}
                      />
                    </View>

                    <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

                    <View style={styles.optionRow}>
                      <View style={styles.optionLeft}>
                        <User size={22} color={themeColors.textColor2} weight="bold" />
                        <Text style={[styles.optionText, { color: themeColors.textColor }]}>
                          {t("share.include_author", lang) || "Показувати моє ім'я відправника"}
                        </Text>
                      </View>
                      <AppSwitch
                        value={shareAuthorName}
                        onValueChange={toggleShareOption(setShareAuthorName)}
                        themeColors={themeColors}
                      />
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor }]}
                    onPress={handleGenerate}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t("share.generate_btn", lang)}</Text>
                    )}
                  </TouchableOpacity>

                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.resultContainer}>
                  <Text style={[styles.successTitle, { color: themeColors.textColor }]}>
                    {t("share.success_title", lang)}
                  </Text>
                  
                  <View style={[styles.codeBox, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
                    <Text style={[styles.codeText, { color: themeColors.accentColor }]}>
                      {generatedCode}
                    </Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: themeColors.backgroundColor2 }]}
                      onPress={handleCopy}
                    >
                      {copied ? <CheckCircle size={24} color="#34C759" weight="fill" /> : <Copy size={24} color={themeColors.textColor} weight="bold" />}
                      <Text style={[styles.actionBtnText, { color: themeColors.textColor }]}>
                        {copied ? t("common.copied", lang) : t("common.copy", lang)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: themeColors.accentColor }]}
                      onPress={handleShareSystem}
                    >
                      <ShareNetwork size={24} color="#fff" weight="bold" />
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                        {t("common.share", lang)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  tabWrapper: { minHeight: 48, marginBottom: 8 },
  optionsGroup: { borderRadius: 16, borderWidth: 1, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 4 },
  optionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  optionText: { fontSize: 15, fontWeight: "600", flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, width: "100%" },
  primaryBtn: { width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 28 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorText: { color: "#FF3B30", fontSize: 14, textAlign: "center", marginTop: 12, fontWeight: "600" },
  resultContainer: { alignItems: "center", paddingVertical: 10 },
  successTitle: { fontSize: 18, fontWeight: "600", marginBottom: 20 },
  codeBox: { paddingVertical: 24, paddingHorizontal: 40, borderRadius: 16, borderWidth: 1, marginBottom: 24, width: "100%", alignItems: "center" },
  codeText: { fontSize: 36, fontWeight: "900", letterSpacing: 4 },
  actionRow: { flexDirection: "row", gap: 12, width: "100%" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 8 },
  actionBtnText: { fontSize: 15, fontWeight: "600" },
});
