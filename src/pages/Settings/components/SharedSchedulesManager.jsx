import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { Trash, Clock } from "phosphor-react-native";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { getUserSharedSchedules, deleteSharedSchedule } from "../../../services/shareService";
import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import MorphingLoader from "../../../components/ui/MorphingLoader";
import themes from "../../../config/themes";
import { t, getLocale } from "../../../utils/i18n";

export default function SharedSchedulesManager() {
  const { user, global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [sharedList, setSharedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingCode, setPendingCode] = useState(null);
  const requestIdRef = useRef(0);
  const deletionBusyRef = useRef(false);

  const fetchSchedules = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    if (!user?.uid) {
      setSharedList([]);
      setLoading(false);
      return;
    }
    try {
      const data = await getUserSharedSchedules(user.uid);
      if (requestId === requestIdRef.current) setSharedList(data);
    } catch (error) {
      if (requestId === requestIdRef.current) setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    setSharedList([]);
    fetchSchedules();
    return () => { requestIdRef.current += 1; };
  }, [fetchSchedules]);

  const handleDelete = (shareCode) => {
    if (deletionBusyRef.current) return;
    const deactivate = async () => {
      if (deletionBusyRef.current) return;
      deletionBusyRef.current = true;
      setPendingCode(shareCode);
      setError(false);
      try {
        await deleteSharedSchedule(shareCode);
        setSharedList(prev => prev.filter(item => item.id !== shareCode));
      } catch {
        setError(true);
      } finally {
        deletionBusyRef.current = false;
        setPendingCode(null);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('share.deactivate_desc', lang))) deactivate();
      return;
    }
    Alert.alert(
      t("share.deactivate_title", lang),
      t("share.deactivate_desc", lang),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        {
          text: t("share.deactivate_btn", lang),
          style: "destructive",
          onPress: deactivate,
        },
      ]
    );
  };

  const renderItem = (item) => {
    const expirationMs = item.expiresAt?.toMillis 
      ? item.expiresAt.toMillis() 
      : (item.expiresAt?.seconds ? item.expiresAt.seconds * 1000 : item.expiresAt);
      
    const isExpired = Date.now() > expirationMs;
    const isInactive = !item.isActive;
    const isDead = isExpired || isInactive;

    return (
      <View
        key={item.id}
        style={[
          styles.card,
          { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.scheduleName, { color: themeColors.textColor }]} numberOfLines={1}>
            {item.scheduleName}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isDead ? themeColors.backgroundColor3 : themeColors.accentColor + "20" },
            ]}
          >
            <Text style={[styles.statusText, { color: isDead ? themeColors.textColor2 : themeColors.accentTextColor }]}>
              {isInactive ? t("share.status_inactive", lang) : isExpired ? t("share.status_expired", lang) : t("share.status_active", lang)}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={[styles.codeText, { color: themeColors.textColor }]}>
            {t("share.code_label", lang)}: <Text style={{ fontWeight: "800", color: themeColors.accentTextColor }}>{item.id}</Text>
          </Text>
          <View style={styles.timeWrapper}>
            <Clock size={14} color={themeColors.textColor2} />
            <Text style={[styles.timeText, { color: themeColors.textColor2 }]}>
              {new Date(expirationMs).toLocaleDateString(getLocale(lang))}
            </Text>
          </View>
        </View>

        {!isDead && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${t('share.deactivate_btn', lang)}: ${item.scheduleName}`}
            accessibilityState={{ disabled: pendingCode !== null, busy: pendingCode === item.id }}
            disabled={pendingCode !== null}
            style={[styles.deactivateBtn, { borderTopColor: themeColors.borderColor }]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash size={18} color="#FF3B30" weight="bold" />
            <Text style={styles.deactivateText}>{t("share.deactivate_btn", lang)}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SettingsScreenLayout title={t("settings.menu.shared_schedules.title", lang)}>
      {error && <View style={styles.errorBox}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.emptyText, { color: themeColors.textColor }]}>{t('common.action_failed', lang)}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.retry', lang)} onPress={fetchSchedules} style={styles.retryButton}>
          <Text style={{ color: themeColors.accentTextColor }}>{t('common.retry', lang)}</Text>
        </TouchableOpacity>
      </View>}
      {loading ? (
        <View style={styles.center}>
          <MorphingLoader size={58} />
        </View>
      ) : sharedList.length === 0 && !error ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
            {t("share.manager_empty", lang)}
          </Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {sharedList.map((item) => renderItem(item))}
        </View>
      )}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: { padding: 16, gap: 8 },
  retryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  emptyText: { fontSize: 16, fontWeight: "500" },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  scheduleName: { fontSize: 17, fontWeight: "700", flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  codeText: { fontSize: 14 },
  timeWrapper: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { fontSize: 13, fontWeight: "500" },
  deactivateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: "rgba(255, 59, 48, 0.05)", gap: 8 },
  deactivateText: { color: "#FF3B30", fontSize: 14, fontWeight: "700" },
});
