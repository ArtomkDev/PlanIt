import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScheduleActions, useScheduleData, useScheduleLayout } from '../../../context/ScheduleProvider';
import { useAppDialog } from '../../../context/AppDialogContext';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';
import { DEFAULT_SCHEDULE_NAME_KEY, getScheduleDisplayName, isDefaultScheduleName } from '../../../utils/scheduleDisplay';
import SettingsHeader from '../../../components/ui/SettingsHeader';
import ScheduleIdentityEditor from '../../../components/ScheduleIdentityEditor';
import ScheduleCycleEditor from '../../../components/ScheduleCycleEditor';
import SchedulePreferencesEditor from '../../../components/SchedulePreferencesEditor';
import ScheduleTimeEditor from '../../../components/ScheduleTimeEditor';
import { generateId } from '../../../utils/idGenerator';
import { resolveScheduleColor } from '../../../utils/scheduleColors';
import { normalizeScheduleReminder } from '../../../utils/reminderSettings';
import { getTaskAutoLinkMode } from '../../../utils/taskLessonLinking';
import { getLastMondayISODate, normalizeScheduleRepeat, normalizeScheduleTiming, buildScheduleSlots, createScheduleTimingDraft, findScheduleTimingConflict } from '../../../utils/scheduleTime';
import { reconcileScheduleRepeat } from '../../../utils/lessonRecurrence';
import { getSettingsHeaderHeight } from '../../../config/layoutMetrics';

export default function ScheduleEditorScreen({ route: propsRoute, onFinish }) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const params = route.params || propsRoute?.params || {};
  const { scheduleId, isInitialSetup, isNew } = params;
  const { global, schedules, schedule: currentActiveSchedule, lang } = useScheduleData();
  const dialog = useAppDialog();
  const { setData, setGlobalDraft, addSchedule } = useScheduleActions();
  const { tabBarHeight } = useScheduleLayout();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const targetSchedule = useMemo(() => isNew ? null
    : schedules.find(s => s.id === scheduleId) || currentActiveSchedule,
  [schedules, scheduleId, currentActiveSchedule, isNew]);
  const [localData, setLocalData] = useState(() => ({
    id: targetSchedule?.id || generateId(),
    name: isDefaultScheduleName(targetSchedule?.name) ? '' : targetSchedule?.name || '',
    icon: targetSchedule?.icon || null,
    color: resolveScheduleColor(targetSchedule, themeColors.accentColor),
    repeat: String(normalizeScheduleRepeat(targetSchedule?.repeat)),
    ...createScheduleTimingDraft(targetSchedule),
    starting_week: targetSchedule?.starting_week || getLastMondayISODate(),
    reminder: normalizeScheduleReminder(targetSchedule?.reminder),
    taskAutoLinkMode: getTaskAutoLinkMode(targetSchedule),
  }));
  const initialDraft = useRef(JSON.stringify(localData));
  const saveStarted = useRef(false);
  const [isSaved, setIsSaved] = useState(false);
  const hasUnsavedChanges = JSON.stringify(localData) !== initialDraft.current;
  usePreventRemove(hasUnsavedChanges && !isSaved, async ({ data }) => {
    const confirmed = await dialog.confirm({
      title: t('common.discard_title', lang),
      message: t('common.discard_desc', lang),
      confirmLabel: t('common.discard', lang),
      destructive: true,
    });
    if (confirmed) navigation.dispatch(data.action);
  });
  useEffect(() => {
    if (!isSaved) return;
    if (isInitialSetup && onFinish) onFinish();
    else if (navigation.canGoBack()) navigation.goBack();
  }, [isSaved, isInitialSetup, onFinish, navigation]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = getSettingsHeaderHeight(insets.top);
  const handleFinalSave = () => {
    if (saveStarted.current) return;
    const finalName = localData.name?.trim() || t(DEFAULT_SCHEDULE_NAME_KEY, lang);
    const finalRepeat = normalizeScheduleRepeat(localData.repeat);
    const finalBreaks = localData.breaks.map(Number);

    const scheduleData = { 
      ...normalizeScheduleTiming(targetSchedule),
      ...localData, 
      name: finalName, 
      repeat: finalRepeat,
      duration: Number(localData.slotDurations[0]),
      slotDurations: localData.slotDurations.map(Number),
      breaks: finalBreaks
    };
    if (!localData.icon) delete scheduleData.icon;
    const slots = buildScheduleSlots(localData.start_time, localData.duration, localData.breaks, localData.slotDurations);
    if (slots.length === 0) {
      dialog.alert({ title: t('schedule.main_screen.time', lang), message: t('settings.schedule_editor.timing.invalid', lang) });
      return;
    }
    const exceedsDay = (scheduleData.schedule || []).some((day) => Object.values(day || {}).some((lessons) =>
      Array.isArray(lessons) && lessons.some((lesson) => lesson?.timeMode === 'slot' && !slots.some((slot) => slot.number === lesson.slotNumber))));
    if (exceedsDay) {
      dialog.alert({ title: t('schedule.main_screen.time', lang), message: t('schedule.lesson_editor.slots_outside_day', lang) });
      return;
    }
    const conflict = findScheduleTimingConflict(targetSchedule, scheduleData);
    if (conflict) {
      const day = new Date(2024, 0, 1 + conflict.dayIndex).toLocaleDateString(lang, { weekday: 'long' });
      dialog.alert({ title: t('schedule.main_screen.time', lang), message: t('settings.schedule_editor.timing.conflict', lang, { ...conflict, day }) });
      return;
    }
    const reconciledSchedule = reconcileScheduleRepeat(
      scheduleData,
      targetSchedule?.repeat ?? finalRepeat,
    );

    saveStarted.current = true;
    if (isNew) {
      addSchedule(reconciledSchedule);
      setGlobalDraft(prev => ({ ...prev, currentScheduleId: reconciledSchedule.id }));
    } else {
      setData(prev => {
        if (!prev) return prev;
        const nextSchedules = prev.schedules.map(s => 
          s.id === reconciledSchedule.id
            ? { ...s, ...reconciledSchedule, lastModified: Date.now() }
            : s
        );
        return { ...prev, schedules: nextSchedules };
      });
      setGlobalDraft(prev => prev);
    }
    
    setIsSaved(true);
  };

  const minimumSlots = useMemo(() => Math.max(1, ...(normalizeScheduleTiming(targetSchedule)?.schedule || []).flatMap(day =>
    Object.values(day || {}).flatMap(lessons => Array.isArray(lessons) ? lessons.map(lesson => lesson?.timeMode === 'slot' ? lesson.slotNumber : 0) : []))), [targetSchedule]);

  const displayTitle = isNew ? t('settings.schedule_switcher.add_new', lang)
    : getScheduleDisplayName(targetSchedule, lang, t('settings.schedule_editor.edit_schedule', lang));
  const editorProps = { value: localData, onChange: setLocalData, themeColors, lang };
  const saveButton = (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={isInitialSetup ? t('common.done', lang) : t('common.save', lang)}
      onPress={handleFinalSave} style={styles.saveButton}>
      <Text style={[styles.saveLabel, { color: themeColors.accentTextColor }]}>{t(isInitialSetup ? 'common.done' : 'common.save', lang)}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <KeyboardAvoidingView style={styles.container} behavior="padding" enabled={Platform.OS === 'ios'}>
        <SettingsHeader title={displayTitle} scrollY={scrollY} showBackButton={!isInitialSetup} rightButton={saveButton} />
        <Animated.ScrollView
          style={Platform.OS === 'web' && {
            '--planit-scrollbar-top': `${headerHeight}px`,
            '--planit-scrollbar-bottom': `${(tabBarHeight || 80) + insets.bottom}px`,
          }}
          contentContainerStyle={[styles.content, { paddingTop: headerHeight + 10, paddingBottom: (tabBarHeight || 80) + insets.bottom + 24 }]}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}>
          <ScheduleIdentityEditor {...editorProps} />
          <ScheduleCycleEditor {...editorProps} />
          <ScheduleTimeEditor {...editorProps} mode={mode} minimumSlots={minimumSlots} title={t('settings.sections.time_management', lang)} />
          <SchedulePreferencesEditor {...editorProps} notificationPreferences={global?.notificationPreferences} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  saveButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' },
  saveLabel: { fontSize: 17, fontWeight: '600' },
});
