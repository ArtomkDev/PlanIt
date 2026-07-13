import React, { useState, useEffect } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, Keyboard
} from "react-native";
import { DownloadSimple, X } from "phosphor-react-native";
import { useScheduleActions, useScheduleData } from "../../context/ScheduleProvider";
import { fetchSharedSchedule } from "../../services/shareService";
import { sanitizeImportedSchedule } from "../../utils/scheduleValidation";
import themes from "../../config/themes";
import { t } from "../../utils/i18n";
import BottomSheet, { SheetScrollView } from "../ui/BottomSheet";

export default function ImportScheduleModal({ visible, onClose, initialCode = "" }) {
  const { global, lang } = useScheduleData();
  const { addSchedule, setGlobalDraft } = useScheduleActions();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [placeholderText, setPlaceholderText] = useState("");
  useEffect(() => {
    if (visible && initialCode) {
      setCode(initialCode.toUpperCase());
      setError(null);
      setPreviewData(null);
    }
  }, [visible, initialCode]);

  useEffect(() => {
    let interval;
    if (visible && !previewData && !initialCode) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const targetLength = 5;
      let finalCode = "";
      
      for (let i = 0; i < targetLength; i++) {
        finalCode += chars[Math.floor(Math.random() * chars.length)];
      }

      let iteration = 0;
      
      interval = setInterval(() => {
        setPlaceholderText(() => {
          return finalCode
            .split("")
            .map((char, index) => {
              if (index < iteration / 3) {
                return finalCode[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("");
        });

        if (iteration >= targetLength * 3) {
          clearInterval(interval);
        }
        iteration += 1;
      }, 40); 
    } else if (!visible) {
      setPlaceholderText("");
    }

    return () => clearInterval(interval);
  }, [visible, previewData, initialCode]);

  const handleFetch = async () => {
    Keyboard.dismiss();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSharedSchedule(code.trim());
      setPreviewData(data);
    } catch (err) {
      if (err.message === "not_found") setError(t("share.error_not_found", lang));
      else if (err.message === "invalid_code") setError(t("share.error_not_found", lang));
      else if (err.message === "inactive") setError(t("share.error_inactive", lang));
      else if (err.message === "expired") setError(t("share.error_expired", lang));
      else setError(t("common.error", lang));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!previewData) return;
    try {
      const newSchedule = sanitizeImportedSchedule(previewData.scheduleData);
      addSchedule(newSchedule);
      setGlobalDraft(prev => ({ ...prev, currentScheduleId: newSchedule.id }));
      resetAndClose();
    } catch (err) {
      if (err.message === "invalid_shared_schedule") {
        setError(t("share.error_invalid_schedule", lang));
      } else {
        setError(t("common.error", lang));
      }
    }
  };

  const resetAndClose = () => {
    Keyboard.dismiss();
    setCode("");
    setError(null);
    setPreviewData(null);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={resetAndClose}
      snapPoints={["48%", "88%"]}
      initialSnapIndex={0}
      maxWidth={620}
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("share.import_title", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="import-schedule-sheet"
    >
            <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
              <Text style={[styles.title, { color: themeColors.textColor }]}>
                {t("share.import_title", lang)}
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
              {!previewData ? (
                <>
                  <Text style={[styles.label, { color: themeColors.textColor2 }]}>
                    {t("share.enter_code", lang)}
                  </Text>
                  
                  <View style={styles.inputWrapper}>
                    {/* Independent text layer handles high-frequency updates without native TextInput drops */}
                    {!code && placeholderText ? (
                      <Text style={[styles.placeholderOverlay, { color: themeColors.textColor3 }]} pointerEvents="none">
                        {placeholderText}
                      </Text>
                    ) : null}
                    
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.backgroundColor2, color: themeColors.textColor, borderColor: error ? "#FF3B30" : themeColors.borderColor }]}
                      value={code}
                      onChangeText={(text) => { setCode(text.toUpperCase()); setError(null); }}
                      autoCapitalize="characters"
                      maxLength={32}
                      autoCorrect={false}
                      autoFocus={Platform.OS === "ios"}
                    />
                  </View>
                  
                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor }]}
                    onPress={handleFetch}
                    disabled={loading || code.length < 5}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t("share.find_btn", lang)}</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.previewContainer}>
                  <View style={[styles.previewCard, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
                    <Text style={[styles.previewLabel, { color: themeColors.textColor2 }]}>{t("share.schedule_name", lang)}</Text>
                    <Text style={[styles.previewValue, { color: themeColors.textColor }]}>{previewData.scheduleName}</Text>
                    
                    <Text style={[styles.previewLabel, { color: themeColors.textColor2, marginTop: 16 }]}>{t("share.author", lang)}</Text>
                    <Text style={[styles.previewValue, { color: themeColors.textColor }]}>{previewData.ownerName}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: themeColors.accentColor, flexDirection: "row", gap: 10 }]}
                    onPress={handleImport}
                  >
                    <DownloadSimple size={22} color="#fff" weight="bold" />
                    <Text style={styles.primaryBtnText}>{t("share.download_btn", lang)}</Text>
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
  title: { fontSize: 20, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { position: "relative", justifyContent: "center", marginBottom: 8 },
  input: { height: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, fontSize: 22, fontWeight: "800", letterSpacing: 3, textAlign: "center" },
  placeholderOverlay: { position: "absolute", width: "100%", textAlign: "center", fontSize: 22, fontWeight: "800", letterSpacing: 3, zIndex: 2 },
  errorText: { color: "#FF3B30", fontSize: 14, textAlign: "center", marginTop: 4, fontWeight: "600" },
  primaryBtn: { width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 24 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  previewContainer: { alignItems: "center" },
  previewCard: { width: "100%", padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  previewLabel: { fontSize: 12, textTransform: "uppercase", fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  previewValue: { fontSize: 20, fontWeight: "700" },
});
