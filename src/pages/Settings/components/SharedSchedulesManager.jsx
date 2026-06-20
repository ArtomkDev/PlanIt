import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Trash, Clock } from "phosphor-react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import { getUserSharedSchedules, deleteSharedSchedule } from "../../../services/shareService";
import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";

export default function SharedSchedulesManager() {
  const { user, global, lang } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [sharedList, setSharedList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, [user]);

  const fetchSchedules = async () => {
    if (!user) return;
    try {
      const data = await getUserSharedSchedules(user.uid);
      setSharedList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (shareCode) => {
    Alert.alert(
      t("share.deactivate_title", lang),
      t("share.deactivate_desc", lang),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        {
          text: t("share.deactivate_btn", lang),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSharedSchedule(shareCode);
              setSharedList((prev) => prev.filter((item) => item.id !== shareCode));
            } catch (error) {
              console.error(error);
            }
          },
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
            <Text style={[styles.statusText, { color: isDead ? themeColors.textColor2 : themeColors.accentColor }]}>
              {isInactive ? t("share.status_inactive", lang) : isExpired ? t("share.status_expired", lang) : t("share.status_active", lang)}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={[styles.codeText, { color: themeColors.textColor }]}>
            {t("share.code_label", lang)}: <Text style={{ fontWeight: "800", color: themeColors.accentColor }}>{item.id}</Text>
          </Text>
          <View style={styles.timeWrapper}>
            <Clock size={14} color={themeColors.textColor2} />
            <Text style={[styles.timeText, { color: themeColors.textColor2 }]}>
              {new Date(expirationMs).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isDead && (
          <TouchableOpacity
            style={[styles.deactivateBtn, { borderTopColor: themeColors.borderColor }]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash size={18} color="#FF3B30" weight="bold" />
            <Text style={styles.deactivateText}>{t("share.deactivate_action", lang)}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SettingsScreenLayout title={t("share.manager_title", lang)}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.accentColor} />
        </View>
      ) : sharedList.length === 0 ? (
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