import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Keyboard
} from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { DownloadSimple, X } from "phosphor-react-native";
import { useScheduleActions, useScheduleData } from "../../context/ScheduleProvider";
import { fetchSharedSchedule } from "../../services/shareService";
import { sanitizeImportedSchedule } from "../../utils/scheduleValidation";
import themes from "../../config/themes";
import { t } from "../../utils/i18n";
import BottomSheet, { SheetScrollView } from "../ui/BottomSheet";
import MorphingLoader from "../ui/MorphingLoader";
import { triggerHaptic } from "../../utils/haptics";

export default function ImportScheduleModal({ visible, onClose, initialCode = "" }) {
  const { global, lang } = useScheduleData();
  const { addSchedule, setGlobalDraft } = useScheduleActions();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const lastAutoFetchedCodeRef = useRef("");
  const requestIdRef = useRef(0);
  const importedRef = useRef(false);

  useEffect(() => {
    importedRef.current = false;
    if (!visible) {
      requestIdRef.current += 1;
      setLoading(false);
      setCode('');
      setError(null);
      setPreviewData(null);
    }
    return () => { requestIdRef.current += 1; };
  }, [visible]);

  const fetchSchedulePreview = useCallback(async (rawCode, options = {}) => {
    if (options.dismissKeyboard !== false) {
      Keyboard.dismiss();
    }
    const nextCode = String(rawCode || "").trim();
    if (!nextCode) {
      triggerHaptic("warning");
      return;
    }
    setLoading(true);
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const data = await fetchSharedSchedule(nextCode);
      if (requestId !== requestIdRef.current) return;
      setPreviewData(data);
      triggerHaptic("success");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      triggerHaptic("error");
      if (err.message === "not_found") setError(t("share.error_not_found", lang));
      else if (err.message === "invalid_code") setError(t("share.error_not_found", lang));
      else if (err.message === "inactive") setError(t("share.error_inactive", lang));
      else if (err.message === "expired") setError(t("share.error_expired", lang));
      else setError(t("common.action_failed", lang));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [lang]);
  useEffect(() => {
    if (visible && initialCode) {
      const normalizedInitialCode = initialCode.toUpperCase();
      setCode(normalizedInitialCode);
      if (lastAutoFetchedCodeRef.current !== normalizedInitialCode) {
        setError(null);
        setPreviewData(null);
        lastAutoFetchedCodeRef.current = normalizedInitialCode;
        fetchSchedulePreview(normalizedInitialCode, { dismissKeyboard: false });
      }
    } else if (!visible) {
      lastAutoFetchedCodeRef.current = "";
    }
  }, [visible, initialCode, fetchSchedulePreview]);

  const handleFetch = () => {
    if (!loading && code.trim().length >= 5) fetchSchedulePreview(code);
  };

  const handleImport = () => {
    if (!previewData || importedRef.current) return;
    try {
      const newSchedule = sanitizeImportedSchedule(previewData.scheduleData);
      importedRef.current = true;
      addSchedule(newSchedule);
      setGlobalDraft(prev => ({ ...prev, currentScheduleId: newSchedule.id }));
      triggerHaptic("success");
      resetAndClose(false);
    } catch (err) {
      triggerHaptic("error");
      if (err.message === "invalid_shared_schedule") {
        setError(t("share.error_invalid_schedule", lang));
      } else {
        setError(t("common.error", lang));
      }
    }
  };

  const resetAndClose = (withHaptic = true) => {
    requestIdRef.current += 1;
    setLoading(false);
    Keyboard.dismiss();
    if (withHaptic) triggerHaptic("sheetClose");
    setCode("");
    setError(null);
    setPreviewData(null);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={resetAndClose}
      snapPoints={["72%", "94%"]}
      initialSnapIndex={1}
      maxWidth={620}
      keyboardBehavior="extend"
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      accessibilityLabel={initialCode ? t("share.open_title", lang) : t("share.import_title", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="import-schedule-sheet"
    >
            <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
              <Text style={[styles.title, { color: themeColors.textColor }]}>
                {initialCode ? t("share.open_title", lang) : t("share.import_title", lang)}
              </Text>
              <TouchableOpacity onPress={resetAndClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t('common.close', lang)}>
                <X size={24} color={themeColors.textColor} weight="bold" />
              </TouchableOpacity>
            </View>

            <SheetScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!previewData ? (
                <>
                  <Text style={[styles.label, { color: themeColors.textColor2 }]}>
                    {t("share.enter_code", lang)}
                  </Text>
                  
                  <View style={styles.inputWrapper}>
                    <BottomSheetTextInput
                      accessibilityLabel={t('share.enter_code', lang)}
                      placeholder="ABCDE"
                      placeholderTextColor={themeColors.textColor2}
                      editable={!loading}
                      style={[styles.input, { backgroundColor: themeColors.backgroundColor2, color: themeColors.textColor, borderColor: error ? "#FF3B30" : themeColors.borderColor }]}
                      value={code}
                      onChangeText={(text) => { setCode(text); setError(null); }}
                      autoCapitalize="characters"
                      maxLength={256}
                      autoCorrect={false}
                      returnKeyType="search"
                      onSubmitEditing={handleFetch}
                    />
                  </View>
                  
                  {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('share.find_btn', lang)}
                    accessibilityState={{ disabled: loading || code.trim().length < 5, busy: loading }}
                    style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor, opacity: loading || code.trim().length < 5 ? 0.5 : 1 }]}
                    onPress={handleFetch}
                    disabled={loading || code.trim().length < 5}
                  >
                    {loading && <MorphingLoader size={24} />}
                    <Text style={[styles.primaryBtnText, { color: themeColors.textOnAccent }]}>{t("share.find_btn", lang)}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.previewContainer}>
                  <View style={[styles.previewCard, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
                    <Text style={[styles.previewLabel, { color: themeColors.textColor2 }]}>{t("common.schedule_name", lang)}</Text>
                    <Text style={[styles.previewValue, { color: themeColors.textColor }]}>{previewData.scheduleName}</Text>
                    
                    <Text style={[styles.previewLabel, { color: themeColors.textColor2, marginTop: 16 }]}>{t("share.author", lang)}</Text>
                    <Text style={[styles.previewValue, { color: themeColors.textColor }]}>{previewData.ownerName}</Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('share.add_to_account_btn', lang)}
                    style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor, flexDirection: "row", gap: 10 }]}
                    onPress={handleImport}
                  >
                    <DownloadSimple size={22} color={themeColors.textOnAccent} weight="bold" />
                    <Text style={[styles.primaryBtnText, { color: themeColors.textOnAccent }]}>{t("share.add_to_account_btn", lang)}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { position: "relative", justifyContent: "center", marginBottom: 8 },
  input: { height: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, fontSize: 22, fontWeight: "800", letterSpacing: 3, textAlign: "center" },
  errorText: { color: "#FF3B30", fontSize: 14, textAlign: "center", marginTop: 4, fontWeight: "600" },
  primaryBtn: { width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 24 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  previewContainer: { alignItems: "center" },
  previewCard: { width: "100%", padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  previewLabel: { fontSize: 12, textTransform: "uppercase", fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  previewValue: { fontSize: 20, fontWeight: "700" },
});
