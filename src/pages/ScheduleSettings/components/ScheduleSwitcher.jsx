import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Platform 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Animated, { 
  FadeInDown, 
  FadeOutDown, 
  CurvedTransition 
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import themes from "../../../config/themes"; 
import { t } from "../../../utils/i18n";
import { generateId } from "../../../utils/idGenerator";
import TabSwitcher from "../../../components/TabSwitcher"; // ОНОВЛЕНИЙ ШЛЯХ

const ScheduleSwitcher = () => {
  const { 
    guest, 
    global, 
    setGlobalDraft, 
    schedules, 
    addSchedule, 
    removeSchedule, 
    lang 
  } = useSchedule();
  
  const navigation = useNavigation();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [activeTab, setActiveTab] = useState('account');
  const [guestSchedulesList, setGuestSchedulesList] = useState([]);

  useEffect(() => {
    if (!guest) {
      loadGuestSchedules();
    }
  }, [guest]);

  const loadGuestSchedules = async () => {
    try {
      const raw = await AsyncStorage.getItem('guest_schedule');
      if (raw) {
        const data = JSON.parse(raw);
        setGuestSchedulesList((data.schedules || []).filter(s => !s.isDeleted));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  if (!global) return null;

  const handleChange = (newId) => {
    setGlobalDraft((prev) => ({
      ...prev,
      currentScheduleId: newId,
    }));
  };

  const handleEdit = (scheduleId) => {
    navigation.navigate("ScheduleEditorScreen", { scheduleId });
  };

  const handleAddNew = () => {
    navigation.navigate("ScheduleEditorScreen", { isNew: true });
  };

  const handleDelete = (scheduleId, scheduleName) => {
    if (schedules.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert(t('settings.schedule_switcher.last_schedule_error', lang));
      } else {
        Alert.alert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
      }
      return;
    }

    const untitledName = t('settings.schedule_switcher.untitled', lang);
    const message = t('settings.schedule_switcher.delete_confirm_msg', lang).replace('{name}', scheduleName || untitledName);

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(message);
      if (confirmed) {
        removeSchedule(scheduleId);
      }
    } else {
      Alert.alert(
        t('settings.schedule_switcher.delete_title', lang),
        message,
        [
          { text: t('common.cancel', lang), style: "cancel" },
          { 
            text: t('common.delete', lang), 
            style: "destructive", 
            onPress: () => removeSchedule(scheduleId)
          }
        ]
      );
    }
  };

  const handleMoveToCloud = async (guestSchedule) => {
    const scheduleCopy = JSON.parse(JSON.stringify(guestSchedule));
    scheduleCopy.isCloud = true;

    if (schedules.some(s => s.id === scheduleCopy.id)) {
      scheduleCopy.id = generateId();
    }

    addSchedule(scheduleCopy);

    try {
      const raw = await AsyncStorage.getItem('guest_schedule');
      if (raw) {
        let guestData = JSON.parse(raw);
        guestData.schedules = guestData.schedules.map(s => {
          if (s.id === guestSchedule.id) {
            return { ...s, isDeleted: true, lastModified: Date.now() };
          }
          return s;
        });
        await AsyncStorage.setItem('guest_schedule', JSON.stringify(guestData));
        setGuestSchedulesList(guestData.schedules.filter(s => !s.isDeleted));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveToLocal = async (accountSchedule) => {
    if (schedules.length <= 1) {
      Alert.alert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
      return;
    }

    const scheduleCopy = JSON.parse(JSON.stringify(accountSchedule));
    scheduleCopy.isCloud = true;

    try {
      const raw = await AsyncStorage.getItem('guest_schedule');
      let guestData = raw ? JSON.parse(raw) : { global: {}, schedules: [] };
      if (!guestData.schedules) guestData.schedules = [];

      if (guestData.schedules.some(s => s.id === scheduleCopy.id && !s.isDeleted)) {
        scheduleCopy.id = generateId();
      }

      scheduleCopy.lastModified = Date.now();
      scheduleCopy.lastSynced = 0;

      guestData.schedules.push(scheduleCopy);
      await AsyncStorage.setItem('guest_schedule', JSON.stringify(guestData));
      setGuestSchedulesList(guestData.schedules.filter(s => !s.isDeleted));

      removeSchedule(accountSchedule.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGuest = (scheduleId, scheduleName) => {
    const untitledName = t('settings.schedule_switcher.untitled', lang);
    const name = scheduleName || untitledName;
    const message = t('settings.schedule_switcher.delete_guest_msg', lang).replace('{name}', name);

    Alert.alert(
      t('common.delete', lang),
      message,
      [
        { text: t('common.cancel', lang), style: "cancel" },
        { 
          text: t('common.delete', lang), 
          style: "destructive", 
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem('guest_schedule');
              if (raw) {
                let guestData = JSON.parse(raw);
                guestData.schedules = guestData.schedules.map(s => {
                  if (s.id === scheduleId) {
                    return { ...s, isDeleted: true, lastModified: Date.now() };
                  }
                  return s;
                });
                await AsyncStorage.setItem('guest_schedule', JSON.stringify(guestData));
                setGuestSchedulesList(guestData.schedules.filter(s => !s.isDeleted));
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  const displaySchedules = guest ? schedules : (activeTab === 'account' ? schedules : guestSchedulesList);
  const isAccountTab = guest || activeTab === 'account';

  const tabs = [
    { id: 'account', label: t('settings.schedule_switcher.tab_account', lang) },
    { id: 'guest', label: t('settings.schedule_switcher.tab_guest', lang) }
  ];

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
            {t('settings.schedule_switcher.your_schedules', lang)}
          </Text>
          <Text style={[styles.sectionDescription, { color: themeColors.textColor2 }]}>
            {/* Динамічний опис на основі обраної вкладки */}
            {guest 
              ? t('settings.schedule_switcher.description_guest', lang)
              : isAccountTab 
                ? t('settings.schedule_switcher.description_account', lang) 
                : t('settings.schedule_switcher.description_guest', lang)
            }
          </Text>
        </View>

        {!guest && (
          <View style={styles.tabContainer}>
            <TabSwitcher
              tabs={tabs}
              activeTab={activeTab}
              onTabPress={setActiveTab}
              themeColors={themeColors}
              withShadow={false}
            />
          </View>
        )}

        <View style={styles.listContent}>
          {displaySchedules.length === 0 && !isAccountTab && (
            <Text style={{ textAlign: 'center', marginTop: 20, color: themeColors.textColor2 }}>
              {t('settings.schedule_switcher.no_local', lang)}
            </Text>
          )}

          {displaySchedules.map((s, index) => {
            const isSelected = isAccountTab && s.id === global.currentScheduleId;
            const delay = Math.min(index * 100, 500);

            return (
              <Animated.View
                key={s.id}
                entering={FadeInDown.delay(delay).springify()}
                exiting={FadeOutDown.springify()}
                layout={CurvedTransition}
              >
                <TouchableOpacity
                  style={[
                    styles.option,
                    {
                      backgroundColor: themeColors.backgroundColor2,
                      borderColor: isSelected ? themeColors.accentColor : 'transparent',
                      borderWidth: isSelected ? 2 : 1,
                    }
                  ]}
                  onPress={() => {
                    if (isAccountTab) {
                      !isSelected && handleChange(s.id);
                    } else {
                      Alert.alert(
                        t('settings.schedule_switcher.move_alert_title', lang), 
                        t('settings.schedule_switcher.move_alert_msg', lang)
                      );
                    }
                  }}
                  onLongPress={() => isAccountTab ? handleEdit(s.id) : null}
                  delayLongPress={300}
                  activeOpacity={isSelected ? 1 : 0.7}
                >
                  <View style={styles.leftContainer}>
                    <Text style={[
                      styles.optionText, 
                      { color: themeColors.textColor },
                      isSelected && { color: themeColors.accentColor, fontWeight: "bold" }
                    ]}>
                      {s.name || t('settings.schedule_switcher.untitled', lang)}
                    </Text>
                  </View>

                  <View style={styles.rightContainer}>
                    {!guest && isAccountTab && (
                      <TouchableOpacity 
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleMoveToLocal(s)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="cloud-download-outline" size={20} color={themeColors.textColor2} />
                      </TouchableOpacity>
                    )}

                    {!guest && !isAccountTab && (
                      <TouchableOpacity 
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleMoveToCloud(s)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="cloud-upload-outline" size={20} color={themeColors.accentColor} />
                      </TouchableOpacity>
                    )}

                    {isAccountTab && (
                      <TouchableOpacity 
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleEdit(s.id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={20} color={themeColors.textColor2} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity 
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => isAccountTab ? handleDelete(s.id, s.name) : handleDeleteGuest(s.id, s.name)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={themes.accentColors.red} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {isAccountTab && (
            <Animated.View layout={CurvedTransition}>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  { borderColor: themeColors.accentColor, borderStyle: 'dashed' }
                ]} 
                onPress={handleAddNew}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>
                  {t('settings.schedule_switcher.add_new', lang)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          
        </View>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  iconButton: {
    padding: 4,
    borderRadius: 8,
  },
  actionButton: {
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    borderWidth: 1,
    marginTop: 4,
  },
  actionButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
});

export default ScheduleSwitcher;