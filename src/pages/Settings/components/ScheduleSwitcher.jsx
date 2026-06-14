import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Platform,
  ActivityIndicator
} from "react-native";
import { 
  CloudArrowUp, 
  CloudArrowDown, 
  PencilSimple, 
  Trash, 
  PlusCircle 
} from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, ZoomOut } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import themes from "../../../config/themes"; 
import { t } from "../../../utils/i18n";
import { generateId } from "../../../utils/idGenerator";
import TabSwitcher from "../../../components/ui/TabSwitcher";
import SettingsSelectionRow from "../../../components/ui/SettingsKit/SettingsSelectionRow";
import SettingsActionRow from "../../../components/ui/SettingsKit/SettingsActionRow";

let storageOperationQueue = Promise.resolve();

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
  
  const [processingIds, setProcessingIds] = useState(new Set());

  const schedulesRef = useRef(schedules);
  useEffect(() => { 
    schedulesRef.current = schedules; 
  }, [schedules]);

  const guestSchedulesRef = useRef(guestSchedulesList);
  useEffect(() => { 
    guestSchedulesRef.current = guestSchedulesList; 
  }, [guestSchedulesList]);

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
        const filtered = (data.schedules || []).filter(s => !s.isDeleted);
        setGuestSchedulesList(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!global) return null;

  const handleChange = (newId) => {
    setGlobalDraft((prev) => ({ ...prev, currentScheduleId: newId }));
  };

  const handleEdit = (scheduleId) => {
    navigation.navigate("ScheduleEditorScreen", { scheduleId });
  };

  const handleAddNew = () => {
    navigation.navigate("ScheduleEditorScreen", { isNew: true });
  };

  const handleDelete = (scheduleId, scheduleName) => {
    if (schedules.length <= 1) {
      Alert.alert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
      return;
    }
    const message = t('settings.schedule_switcher.delete_confirm_msg', lang).replace('{name}', scheduleName || "Untitled");
    Alert.alert(
      t('settings.schedule_switcher.delete_title', lang),
      message,
      [
        { text: t('common.cancel', lang), style: "cancel" },
        { text: t('common.delete', lang), style: "destructive", onPress: () => removeSchedule(scheduleId) }
      ]
    );
  };

  const startProcessing = (id) => setProcessingIds(prev => new Set(prev).add(id));
  const stopProcessing = (id) => setProcessingIds(prev => { 
    const next = new Set(prev); 
    next.delete(id); 
    return next; 
  });

  const enqueueOperation = (operation) => {
    storageOperationQueue = storageOperationQueue
      .then(async () => {
        try {
          await operation();
        } catch (error) {
          console.error(error);
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      })
      .catch(console.error);
  };

  const handleMoveToCloud = (guestSchedule) => {
    enqueueOperation(async () => {
      startProcessing(guestSchedule.id);

      try {
        const scheduleCopy = JSON.parse(JSON.stringify(guestSchedule));
        scheduleCopy.isCloud = true;

        const oldId = scheduleCopy.id;
        scheduleCopy.id = generateId();
        scheduleCopy.lastModified = Date.now();
        scheduleCopy.lastSynced = 0;
        
        await addSchedule(scheduleCopy);

        const raw = await AsyncStorage.getItem('guest_schedule');
        if (raw) {
          let guestData = JSON.parse(raw);
          
          guestData.schedules = guestData.schedules.map(s => {
            if (s.id === oldId) {
              return { ...s, isDeleted: true, lastModified: Date.now() };
            }
            return s;
          });

          await AsyncStorage.setItem('guest_schedule', JSON.stringify(guestData));
          
          const filtered = guestData.schedules.filter(s => !s.isDeleted);
          setGuestSchedulesList(filtered);
        }
      } catch (error) {
        console.error(error);
      } finally {
        stopProcessing(guestSchedule.id);
      }
    });
  };

  const handleMoveToLocal = (accountSchedule) => {
    enqueueOperation(async () => {
      startProcessing(accountSchedule.id);

      try {
        if (schedulesRef.current.length <= 1) {
          Alert.alert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
          return;
        }

        const scheduleCopy = JSON.parse(JSON.stringify(accountSchedule));
        scheduleCopy.isCloud = false; 

        const oldId = scheduleCopy.id;
        scheduleCopy.id = generateId();
        scheduleCopy.lastModified = Date.now();
        scheduleCopy.lastSynced = 0;

        const raw = await AsyncStorage.getItem('guest_schedule');
        let guestData = raw ? JSON.parse(raw) : { global: {}, schedules: [] };
        if (!guestData.schedules) guestData.schedules = [];

        guestData.schedules.push(scheduleCopy);
        
        await AsyncStorage.setItem('guest_schedule', JSON.stringify(guestData));
        
        const filtered = guestData.schedules.filter(s => !s.isDeleted);
        setGuestSchedulesList(filtered);

        await removeSchedule(oldId);

      } catch (error) {
        console.error(error);
      } finally {
        stopProcessing(accountSchedule.id);
      }
    });
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
          onPress: () => {
            enqueueOperation(async () => {
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
            });
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
            const delay = Math.min(index * 40, 200); 
            
            const isItemProcessing = processingIds.has(s.id);

            return (
              <Animated.View
                key={s.id}
                entering={FadeInDown.delay(delay).duration(250)}
                exiting={ZoomOut.duration(150)}
                style={{ marginBottom: 10 }}
              >
                <View 
                  style={{ opacity: isItemProcessing ? 0.4 : 1 }} 
                  pointerEvents={isItemProcessing ? "none" : "auto"}
                >
                  <SettingsSelectionRow
                    label={s.name || t('settings.schedule_switcher.untitled', lang)}
                    isSelected={isSelected}
                    themeColors={themeColors}
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
                    rightContent={
                      isItemProcessing ? (
                        <ActivityIndicator size="small" color={themeColors.accentColor} style={{ marginRight: 8 }} />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {!guest && isAccountTab && (
                            <TouchableOpacity 
                              hitSlop={15}
                              onPress={() => handleMoveToLocal(s)}
                              style={styles.iconButton}
                            >
                              <CloudArrowDown size={20} color={themeColors.textColor2} weight="regular" />
                            </TouchableOpacity>
                          )}

                          {!guest && !isAccountTab && (
                            <TouchableOpacity 
                              hitSlop={15}
                              onPress={() => handleMoveToCloud(s)}
                              style={styles.iconButton}
                            >
                              <CloudArrowUp size={20} color={themeColors.accentColor} weight="bold" />
                            </TouchableOpacity>
                          )}

                          {isAccountTab && (
                            <TouchableOpacity 
                              hitSlop={15}
                              onPress={() => handleEdit(s.id)}
                              style={styles.iconButton}
                            >
                              <PencilSimple size={20} color={themeColors.textColor2} weight="bold" />
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity 
                            hitSlop={15}
                            onPress={() => isAccountTab ? handleDelete(s.id, s.name) : handleDeleteGuest(s.id, s.name)}
                            style={styles.iconButton}
                          >
                            <Trash size={20} color={themes.accentColors.red} weight="bold" />
                          </TouchableOpacity>
                        </View>
                      )
                    }
                  />
                </View>
              </Animated.View>
            );
          })}

          {isAccountTab && (
            <Animated.View entering={FadeInDown.delay(displaySchedules.length * 40).duration(250)}>
              <SettingsActionRow
                icon={PlusCircle}
                label={t('settings.schedule_switcher.add_new', lang)}
                onPress={handleAddNew}
                themeColors={themeColors}
              />
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
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  iconButton: {
    padding: 4,
  },
});

export default ScheduleSwitcher;