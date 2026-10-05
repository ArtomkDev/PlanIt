import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  Alert
} from "react-native";
import {
  Check,
  CloudArrowUp,
  CloudArrowDown,
  PencilSimple,
  Copy,
  Trash,
  Plus,
  DotsThree,
  CalendarBlank,
  ShareNetwork,
  DownloadSimple
} from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";

import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import MorphingLoader from "../../../components/ui/MorphingLoader";
import ScheduleIcon from "../../../components/ScheduleIcon";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";
import { generateId } from "../../../utils/idGenerator";
import { createScheduleCopy } from "../../../utils/scheduleCopy";
import { getLocalSchedule, saveLocalSchedule } from "../../../utils/storage";
import { triggerHaptic } from "../../../utils/haptics";
import { getScheduleDisplayName } from "../../../utils/scheduleDisplay";
import {
  markScheduleAsAccountOwned,
  markScheduleAsDeviceLocal,
} from "../../../utils/scheduleOwnership";
import {
  resolveScheduleColor,
  scheduleColorWithAlpha,
} from "../../../utils/scheduleColors";

import TabSwitcher from "../../../components/ui/TabSwitcher";
import SettingsRow from "../../../components/ui/SettingsKit/SettingsRow";

import ShareScheduleModal from "../../../components/modals/ShareScheduleModal";
import ImportScheduleModal from "../../../components/modals/ImportScheduleModal";

let storageOperationQueue = Promise.resolve();

const ScheduleSwitcher = () => {
  const {
    user,
    guest,
    global,
    schedules,
    lang
  } = useScheduleData();
  const {
    setGlobalDraft,
    addSchedule,
    removeSchedule,
  } = useScheduleActions();

  const navigation = useNavigation();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [activeTab, setActiveTab] = useState('account');
  const [guestSchedulesList, setGuestSchedulesList] = useState([]);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [localLoading, setLocalLoading] = useState(!guest);
  const [localError, setLocalError] = useState(false);
  const [operationError, setOperationError] = useState(false);
  const processingRef = useRef(new Set());
  const reduceMotion = useReducedMotionPreference();
  const listOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    listOpacity.stopAnimation();
    if (reduceMotion) {
      listOpacity.setValue(1);
      return;
    }
    listOpacity.setValue(0.65);
    const animation = Animated.timing(listOpacity, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [activeTab, reduceMotion, listOpacity]);

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [scheduleToShare, setScheduleToShare] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const schedulesRef = useRef(schedules);
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    if (!guest) {
      loadGuestSchedules();
    }
  }, [guest]);

  const loadGuestSchedules = async () => {
    setLocalLoading(true);
    setLocalError(false);
    try {
      const data = await getLocalSchedule(null);
      setGuestSchedulesList((data?.schedules || []).filter(s => !s.isDeleted));
    } catch {
      setLocalError(true);
    } finally {
      setLocalLoading(false);
    }
  };

  if (!global) return null;

  const handleChange = (newId) => {
    setGlobalDraft((prev) => ({ ...prev, currentScheduleId: newId }));
  };

  const handleEdit = (scheduleId, withHaptic = true) => {
    if (withHaptic) triggerHaptic("open");
    navigation.navigate("ScheduleEditorScreen", { scheduleId });
  };

  const handleAddNew = () => {
    navigation.navigate("ScheduleEditorScreen", { isNew: true });
  };

  const showScheduleAlert = (title, message, buttons) => {
    if (Platform.OS === 'web') {
      const confirmation = buttons?.find(button => button.style === 'destructive');
      if (confirmation) {
        if (window.confirm(message)) confirmation.onPress();
      } else {
        window.alert(message);
      }
      return;
    }
    Alert.alert(title, message, buttons);
  };

  const handleShare = (scheduleData) => {
    if (!user) {
      triggerHaptic("warning");
      showScheduleAlert(t('common.warning', lang), t('share.req_auth', lang));
      return;
    }
    triggerHaptic("open");
    setScheduleToShare(scheduleData);
    setShareModalVisible(true);
  };

  const handleDelete = (scheduleId, scheduleName) => {
    if (schedules.filter(schedule => !schedule.isDeleted).length <= 1) {
      triggerHaptic("warning");
      showScheduleAlert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
      return;
    }

    triggerHaptic("warning");
    const message = t('settings.schedule_switcher.delete_confirm_msg', lang, { name: scheduleName || t('common.untitled', lang) });

    showScheduleAlert(
      t('settings.schedule_switcher.delete_title', lang),
      message,
      [
        { text: t('common.cancel', lang), style: "cancel" },
        { text: t('common.delete', lang), style: "destructive", onPress: () => {
          enqueueOperation(scheduleId, async () => {
            await removeSchedule(scheduleId);
            triggerHaptic("success");
          });
        } }
      ]
    );
  };

  const startProcessing = (id) => setProcessingIds(prev => new Set(prev).add(id));
  const stopProcessing = (id) => setProcessingIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  const enqueueOperation = (id, operation) => {
    if (processingRef.current.size) return;
    processingRef.current.add(id);
    startProcessing(id);
    setOperationError(false);
    storageOperationQueue = storageOperationQueue.then(operation).catch(() => {
      triggerHaptic("error");
      setOperationError(true);
    }).finally(() => {
      processingRef.current.delete(id);
      stopProcessing(id);
    });
  };

  const handleCopy = (schedule, localOnly) => {
    enqueueOperation(schedule.id, async () => {
      if (localOnly) {
        const data = await getLocalSchedule(null) || { global: {}, schedules: [] };
        const copy = markScheduleAsDeviceLocal(
          createScheduleCopy(schedule, data.schedules || [], lang),
          { offerCloudMigration: false },
        );
        const nextSchedules = [...(data.schedules || []), copy];
        await saveLocalSchedule({ ...data, schedules: nextSchedules }, null);
        setGuestSchedulesList(nextSchedules.filter(item => !item.isDeleted));
      } else {
        await addSchedule(createScheduleCopy(schedule, schedulesRef.current, lang));
      }
      triggerHaptic("success");
    });
  };

  const handleMoveToCloud = (guestSchedule) => {
    triggerHaptic("selection");
    enqueueOperation(guestSchedule.id, async () => {
      try {
        const scheduleCopy = markScheduleAsAccountOwned(
          JSON.parse(JSON.stringify(guestSchedule)),
        );

        const oldId = scheduleCopy.id;
        scheduleCopy.id = generateId();
        scheduleCopy.lastModified = Date.now();
        scheduleCopy.lastSynced = 0;

        await addSchedule(scheduleCopy);

        const guestData = await getLocalSchedule(null);
        if (guestData) {

          guestData.schedules = guestData.schedules.map(s => {
            if (s.id === oldId) {
              const movedAt = Date.now();
              return {
                ...markScheduleAsAccountOwned(s),
                isDeleted: true,
                deletedAt: movedAt,
                lastModified: movedAt,
              };
            }
            return s;
          });

          await saveLocalSchedule(guestData, null);

          const filtered = guestData.schedules.filter(s => !s.isDeleted);
          setGuestSchedulesList(filtered);
          triggerHaptic("success");
        }
      } catch {
        triggerHaptic("error");
        setOperationError(true);
      }
    });
  };

  const handleMoveToLocal = (accountSchedule) => {
    triggerHaptic("selection");
    enqueueOperation(accountSchedule.id, async () => {
      try {
        if (schedulesRef.current.filter(schedule => !schedule.isDeleted).length <= 1) {
          triggerHaptic("warning");
          showScheduleAlert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
          return;
        }

        const scheduleCopy = markScheduleAsDeviceLocal(
          JSON.parse(JSON.stringify(accountSchedule)),
          { offerCloudMigration: false },
        );

        const oldId = scheduleCopy.id;
        scheduleCopy.id = generateId();
        scheduleCopy.lastModified = Date.now();
        scheduleCopy.lastSynced = 0;

        let guestData = await getLocalSchedule(null) || { global: {}, schedules: [] };

        if (!guestData.schedules) guestData.schedules = [];
        guestData.schedules.push(scheduleCopy);

        await saveLocalSchedule(guestData, null);

        const filtered = guestData.schedules.filter(s => !s.isDeleted);
        setGuestSchedulesList(filtered);

        await removeSchedule(oldId);
        triggerHaptic("success");
      } catch {
        triggerHaptic("error");
        setOperationError(true);
      }
    });
  };

  const handleDeleteGuest = (scheduleId, scheduleName) => {
    triggerHaptic("warning");
    const untitledName = t('common.untitled', lang);
    const name = scheduleName || untitledName;
    const message = t('settings.schedule_switcher.delete_guest_msg', lang, { name: name });

    showScheduleAlert(
      t('common.delete', lang),
      message,
      [
        { text: t('common.cancel', lang), style: "cancel" },
        {
          text: t('common.delete', lang),
          style: "destructive",
          onPress: () => {
            enqueueOperation(scheduleId, async () => {
              const guestData = await getLocalSchedule(null);
              if (guestData) {
                guestData.schedules = guestData.schedules.map(s => {
                  if (s.id === scheduleId) {
                    const deletedAt = Date.now();
                    return {
                      ...s,
                      isDeleted: true,
                      deletedAt,
                      lastModified: deletedAt,
                    };
                  }
                  return s;
                });
                await saveLocalSchedule(guestData, null);
                setGuestSchedulesList(guestData.schedules.filter(s => !s.isDeleted));
                triggerHaptic("success");
              }
            });
          }
        }
      ]
    );
  };

  const displaySchedules = (guest ? schedules : (activeTab === 'account' ? schedules : guestSchedulesList))
    .filter(schedule => !schedule.isDeleted);
  const isAccountTab = guest || activeTab === 'account';
  const busy = processingIds.size > 0;
  const label = (key, params) => t(`settings.schedule_switcher.${key}`, lang, params);
  const tabs = [
    { id: 'account', label: label('tab_account') },
    { id: 'guest', label: label('on_device') },
  ];

  const changeTab = (id) => {
    setExpandedId(null);
    setActiveTab(id);
  };

  const runAction = (action) => {
    if (busy) return;
    setExpandedId(null);
    action();
  };

  return (
    <>
      <SettingsScreenLayout>
        <View style={styles.container}>
          <Text style={[styles.intro, { color: themeColors.textColor2 }]}>{label('selection_hint')}</Text>
          <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => { changeTab('account'); handleAddNew(); }}
                style={({ pressed }) => [styles.createButton, { backgroundColor: themeColors.accentColor, opacity: pressed ? 0.8 : 1 }]}
              >
                <Plus size={20} color="#fff" weight="bold" />
                <Text style={styles.createLabel}>{label('create_schedule')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => { changeTab('account'); setImportModalVisible(true); }}
                style={({ pressed }) => [styles.importButton, { backgroundColor: pressed ? themeColors.borderColor : themeColors.backgroundColor2 }]}
              >
                <DownloadSimple size={20} color={themeColors.textColor} />
                <Text style={[styles.buttonLabel, { color: themeColors.textColor }]}>{label('import_schedule')}</Text>
              </Pressable>
          </View>
          {!guest && (
            <TabSwitcher
              tabs={tabs}
              activeTab={activeTab}
              onTabPress={changeTab}
              themeColors={themeColors}
              activeTabBackgroundColor={themeColors.backgroundColor}
              activeTextColor={themeColors.textColor}
              containerBorderColor={themeColors.borderColor}
            />
          )}
          <View style={styles.listHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: themeColors.textColor }]}>
              {guest ? label('on_device') : isAccountTab ? label('your_schedules') : label('on_device')}
            </Text>
            <Text style={[styles.count, { color: themeColors.textColor2, backgroundColor: themeColors.backgroundColor2 }]}>{displaySchedules.length}</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textColor2 }]}>
            {guest ? label('description_guest') : isAccountTab ? label('description_account') : label('local_hint')}
          </Text>
          {operationError && <Text accessibilityRole="alert" style={[styles.description, { color: themeColors.textColor }]}>{label('operation_error')}</Text>}
          <Animated.View style={{ opacity: listOpacity }}>
            {!isAccountTab && localLoading ? (
              <View style={styles.emptyState}><MorphingLoader size={36} /></View>
            ) : !isAccountTab && localError ? (
              <View style={styles.emptyState}>
                <Text accessibilityRole="alert" style={[styles.emptyDescription, { color: themeColors.textColor }]}>{label('load_error')}</Text>
                <Pressable accessibilityRole="button" onPress={loadGuestSchedules} style={styles.retryButton}>
                  <Text style={{ color: themeColors.accentColor }}>{label('retry')}</Text>
                </Pressable>
              </View>
            ) : displaySchedules.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: themeColors.backgroundColor2 }]}>
                <CalendarBlank size={36} color={themeColors.textColor2} />
                <Text style={[styles.emptyTitle, { color: themeColors.textColor }]}>{isAccountTab ? label('no_schedules') : label('no_local')}</Text>
                <Text style={[styles.emptyDescription, { color: themeColors.textColor2 }]}>{isAccountTab ? label('empty_hint') : label('local_empty_hint')}</Text>
              </View>
            )}
            {displaySchedules.map((schedule) => {
              const selected = isAccountTab && schedule.id === global.currentScheduleId;
              const expanded = expandedId === schedule.id;
              const processing = processingIds.has(schedule.id);
              const name = getScheduleDisplayName(schedule, lang);
              const color = resolveScheduleColor(schedule, themeColors.accentColor);
              const subjectCount = (schedule.subjects || []).filter(subject => !subject.isDeleted).length;
              const Selection = isAccountTab ? Pressable : View;
              return (
                <View key={schedule.id} style={[styles.card, {
                  backgroundColor: themeColors.backgroundColor2,
                  borderColor: selected ? color : themeColors.borderColor,
                }]}>
                  <View style={styles.cardTop}>
                    <Selection
                      {...(isAccountTab ? {
                        accessibilityRole: 'radio',
                        accessibilityLabel: name,
                        accessibilityState: { checked: selected, disabled: busy },
                        disabled: busy,
                        onPress: () => {
                          if (!selected) {
                            triggerHaptic('selection');
                            handleChange(schedule.id);
                          }
                        },
                        style: ({ pressed }) => [styles.selection, { opacity: pressed ? 0.7 : 1 }],
                      } : { style: styles.selection })}
                    >
                      <ScheduleIcon icon={schedule.icon} name={name} size={46} color={color} backgroundColor={scheduleColorWithAlpha(color, 0.13)} />
                      <View style={styles.scheduleText}>
                        <Text style={[styles.scheduleName, { color: themeColors.textColor }]}>{name}</Text>
                        <Text style={[styles.metadata, { color: themeColors.textColor2 }]}>{label('subject_count', { count: subjectCount })}</Text>
                        <View style={styles.currentLabel}>
                          {selected && <Check size={14} color={themeColors.accentColor} weight="bold" />}
                          <Text style={[styles.currentText, { color: selected ? themeColors.accentColor : themeColors.textColor2 }]}>{selected ? label('current_schedule') : isAccountTab ? label('select_schedule') : label('on_device')}</Text>
                        </View>
                      </View>
                    </Selection>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={label('manage_schedule', { name })}
                      accessibilityState={{ expanded, disabled: busy, busy: processing }}
                      disabled={busy}
                      onPress={() => {
                        triggerHaptic('selection');
                        setExpandedId(expanded ? null : schedule.id);
                      }}
                      style={({ pressed }) => [styles.menuButton, { backgroundColor: expanded || pressed ? themeColors.borderColor : 'transparent' }]}
                    >
                      {processing ? <MorphingLoader size={22} /> : <DotsThree size={26} color={themeColors.textColor2} weight="bold" />}
                    </Pressable>
                  </View>
                  {expanded && (
                    <View style={[styles.actionPanel, { borderTopColor: themeColors.borderColor }]}>
                      <SettingsRow
                        icon={Copy}
                        label={label('create_copy')}
                        onPress={() => runAction(() => handleCopy(schedule, !isAccountTab))}
                        themeColors={themeColors}
                        showCaret={false}
                        disabled={busy}
                      />
                      {isAccountTab && <SettingsRow icon={PencilSimple} label={t('common.edit', lang)} onPress={() => runAction(() => handleEdit(schedule.id, false))} themeColors={themeColors} showCaret={false} disabled={busy} />}
                      {isAccountTab && <SettingsRow icon={ShareNetwork} label={t('common.share', lang)} onPress={() => runAction(() => handleShare(schedule))} themeColors={themeColors} showCaret={false} disabled={busy} />}
                      {!guest && <SettingsRow
                        icon={isAccountTab ? CloudArrowDown : CloudArrowUp}
                        label={isAccountTab ? label('move_to_device') : label('move_to_account')}
                        onPress={() => runAction(() => isAccountTab ? handleMoveToLocal(schedule) : handleMoveToCloud(schedule))}
                        themeColors={themeColors} showCaret={false} disabled={busy}
                      />}
                      <SettingsRow icon={Trash} label={t('common.delete', lang)} danger onPress={() => runAction(() => isAccountTab ? handleDelete(schedule.id, name) : handleDeleteGuest(schedule.id, name))} themeColors={themeColors} showCaret={false} disabled={busy} />
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        </View>
      </SettingsScreenLayout>
      <ShareScheduleModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} scheduleToShare={scheduleToShare} />
      <ImportScheduleModal visible={importModalVisible} onClose={() => setImportModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  createButton: { flexGrow: 1, flexBasis: 170, minHeight: 50, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  importButton: { flexGrow: 1, flexBasis: 110, minHeight: 50, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createLabel: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '600', flexShrink: 1 },
  buttonLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600', flexShrink: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 19, fontWeight: '700', flexShrink: 1 },
  count: { fontSize: 13, fontWeight: '600', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  description: { fontSize: 13, lineHeight: 20, marginBottom: 18 },
  card: { borderWidth: 1.5, borderRadius: 18, marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  selection: { flex: 1, minWidth: 0, minHeight: 100, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  scheduleText: { flex: 1, minWidth: 0, gap: 4 },
  scheduleName: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  metadata: { fontSize: 13, lineHeight: 19 },
  currentLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  currentText: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  menuButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionPanel: { borderTopWidth: StyleSheet.hairlineWidth, padding: 6 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  emptyState: { borderRadius: 18, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  emptyDescription: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});

export default ScheduleSwitcher;
