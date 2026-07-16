import React, { useCallback } from "react";
import { Alert, Platform, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, SignIn } from "phosphor-react-native";

import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import SettingsGroup from "../../../components/ui/SettingsKit/SettingsGroup";
import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import { NOTIFICATION_TYPE_CONFIG } from "../../../config/notificationTypes";
import {
  createNotificationPreferencesWithPush,
  ensureNotificationPushPermissionsForType,
  isNotificationPushEnabled,
} from "../../../services/notificationService";
import { refreshCurrentDevicePushRegistration } from "../../../utils/deviceService";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";

const isAndroid = Platform.OS === "android";

const getTypeIcon = (type) => {
  if (type === "account_login") return SignIn;
  return Bell;
};

export default function NotificationsScreen() {
  const { user, global, lang } = useScheduleData();
  const { setGlobalDraft } = useScheduleActions();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const updatePushPreference = useCallback(async (type, value) => {
    const nextPreferences = createNotificationPreferencesWithPush(
      global?.notificationPreferences,
      type,
      value
    );

    if (value === true) {
      const permission = await ensureNotificationPushPermissionsForType(type, {
        request: true,
        notificationPreferences: nextPreferences,
      });

      if (!permission.granted && permission.status !== "unsupported") {
        Alert.alert(
          t("common.warning", lang),
          t("settings.notifications.permission_denied", lang)
        );
        return;
      }

      if (user?.uid && permission.status !== "unsupported") {
        refreshCurrentDevicePushRegistration(user.uid, { request: false }).catch(() => {});
      }
    }

    setGlobalDraft((previous) => ({
      ...previous,
      notificationPreferences: {
        ...createNotificationPreferencesWithPush(previous?.notificationPreferences, type, value),
      },
    }));
  }, [global?.notificationPreferences, lang, setGlobalDraft, user?.uid]);

  const renderTypeRow = (item) => {
    const Icon = getTypeIcon(item.type);
    const isEnabled = isNotificationPushEnabled(global?.notificationPreferences, item.type);

    return (
      <View
        key={item.type}
        style={[
          styles.typeRow,
          isAndroid
            ? {
                backgroundColor: themeColors.backgroundColor2,
                borderColor: themeColors.borderColor + "30",
              }
            : { backgroundColor: "transparent" },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + "15" }]}>
          <Icon size={20} color={themeColors.accentColor} weight="regular" />
        </View>

        <View style={styles.typeText}>
          <View style={styles.typeHeader}>
            <Text style={[styles.typeTitle, { color: themeColors.textColor }]} numberOfLines={2}>
              {t(item.titleKey, lang)}
            </Text>
          </View>
          <Text style={[styles.typeDesc, { color: themeColors.textColor2 }]} numberOfLines={3}>
            {t(item.descKey, lang)}
          </Text>
        </View>

        <View style={styles.pushControl}>
          <Text style={[styles.pushLabel, { color: themeColors.textColor2 }]}>
            {t("settings.notifications.push_label", lang)}
          </Text>
          <Switch
            accessibilityLabel={`${t("settings.notifications.push_label", lang)} ${t(item.titleKey, lang)}`}
            value={isEnabled}
            onValueChange={(value) => updatePushPreference(item.type, value)}
            trackColor={{ false: themeColors.backgroundColor3, true: themeColors.accentColor }}
            thumbColor="#fff"
          />
        </View>
      </View>
    );
  };

  return (
    <SettingsScreenLayout contentContainerStyle={styles.container}>
      <View style={styles.intro}>
        <View style={[styles.introIcon, { backgroundColor: themeColors.accentColor + "15" }]}>
          <Bell size={22} color={themeColors.accentColor} weight="bold" />
        </View>
        <Text style={[styles.introTitle, { color: themeColors.textColor }]}>
          {t("settings.notifications.push_title", lang)}
        </Text>
        <Text style={[styles.introDesc, { color: themeColors.textColor2 }]}>
          {t("settings.notifications.push_desc", lang)}
        </Text>
      </View>

      <SettingsGroup title={t("settings.notifications.settings_title", lang)} themeColors={themeColors}>
        {NOTIFICATION_TYPE_CONFIG.map(renderTypeRow)}
      </SettingsGroup>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  intro: {
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  introIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 6,
  },
  introDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  typeRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: isAndroid ? 12 : 0,
    borderWidth: isAndroid ? StyleSheet.hairlineWidth : 0,
    marginBottom: isAndroid ? 6 : 0,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  typeText: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  typeHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  typeTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  typeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  pushControl: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 5,
  },
  pushLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
