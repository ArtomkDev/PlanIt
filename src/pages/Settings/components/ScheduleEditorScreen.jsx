import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  Alert
} from 'react-native';
import { useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { 
  Stack, 
  CalendarBlank, 
  Palette,
  Bell,
  CheckSquare,
  PencilSimple,
  Shapes
} from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScheduleActions, useScheduleData, useScheduleLayout } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t, formatText as interpolate } from '../../../utils/i18n';
import SettingsHeader from '../../../components/ui/SettingsHeader';
import TabSwitcher from '../../../components/ui/TabSwitcher';
import { generateId } from '../../../utils/idGenerator';
import CalendarSheet from '../../../components/CalendarSheet/CalendarSheet';
import AdvancedColorPicker from '../../../components/ui/AdvancedColorPicker';
import { resolveScheduleColor, scheduleColorWithAlpha } from '../../../utils/scheduleColors';
import {
  CUSTOM_REMINDER_FALLBACK_MINUTES,
  REMINDER_PRESET_MINUTES,
  clampReminderMinutes,
  getScheduleReminderSelectionId,
  normalizeScheduleReminder,
} from '../../../utils/reminderSettings';
import {
  NOTIFICATION_TYPES,
  ensureNotificationPushPermissionsForType,
} from '../../../services/notificationService';
import {
  TASK_AUTO_LINK_MODES,
  getTaskAutoLinkMode,
} from '../../../utils/taskLessonLinking';
import {
  getLastMondayISODate,
  normalizeScheduleRepeat,
  normalizeScheduleTiming,
  buildScheduleSlots,
  createScheduleTimingDraft,
} from '../../../utils/scheduleTime';
import { reconcileScheduleRepeat } from '../../../utils/lessonRecurrence';

import SettingsGroup from '../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../components/ui/SettingsKit/SettingsRow';
import ScheduleTimeEditor from '../../../components/ScheduleTimeEditor';
import AppSwitch from '../../../components/ui/AppSwitch';
import { triggerHaptic } from '../../../utils/haptics';
import useReducedMotionPreference from '../../../hooks/useReducedMotionPreference';
import ScheduleIcon from '../../../components/ScheduleIcon';
import ScheduleIconPickerSheet from './ScheduleIconPickerSheet';
import { getSettingsHeaderHeight } from '../../../config/layoutMetrics';

if (
  Platform.OS === 'android' && 
  UIManager.setLayoutAnimationEnabledExperimental && 
  global._IS_FABRIC !== true
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ScheduleEditorScreen({ route: propsRoute, onFinish }) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotionPreference();
  
  const params = route.params || propsRoute?.params || {};
  const { scheduleId, isInitialSetup, isNew } = params;

  const { global, schedules, schedule: currentActiveSchedule, lang } = useScheduleData();
  const { setData, setGlobalDraft, addSchedule } = useScheduleActions();
  const { tabBarHeight } = useScheduleLayout();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const targetSchedule = useMemo(() => {
    if (isNew) return null;
    return schedules.find(s => s.id === scheduleId) || currentActiveSchedule;
  }, [schedules, scheduleId, currentActiveSchedule, isNew]);

  const initialReminder = normalizeScheduleReminder(targetSchedule?.reminder);

  const [localData, setLocalData] = useState({
    id: targetSchedule?.id || generateId(),
    name: targetSchedule?.name || "",
    icon: targetSchedule?.icon || null,
    color: resolveScheduleColor(targetSchedule, themeColors.accentColor),
    repeat: String(normalizeScheduleRepeat(targetSchedule?.repeat)),
    ...createScheduleTimingDraft(targetSchedule),
    starting_week: targetSchedule?.starting_week || getLastMondayISODate(),
    reminder: initialReminder,
    taskAutoLinkMode: getTaskAutoLinkMode(targetSchedule),
  });
  const [customReminderMinutes, setCustomReminderMinutes] = useState(
    initialReminder.enabled && !REMINDER_PRESET_MINUTES.includes(initialReminder.minutesBefore)
      ? String(initialReminder.minutesBefore)
      : String(CUSTOM_REMINDER_FALLBACK_MINUTES)
  );
  const initialDraft = useRef(JSON.stringify(localData));
  const [isSaved, setIsSaved] = useState(false);
  const hasUnsavedChanges = JSON.stringify(localData) !== initialDraft.current;
  usePreventRemove(hasUnsavedChanges && !isSaved, ({ data }) => {
    const discard = () => navigation.dispatch(data.action);
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('common.discard_title', lang)}\n\n${t('common.discard_desc', lang)}`)) discard();
      return;
    }
    Alert.alert(t('common.discard_title', lang), t('common.discard_desc', lang), [
      { text: t('common.cancel', lang), style: 'cancel' },
      { text: t('common.discard', lang), style: 'destructive', onPress: discard },
    ]);
  });
  useEffect(() => {
    if (!isSaved) return;
    if (isInitialSetup && onFinish) onFinish();
    else if (navigation.canGoBack()) navigation.goBack();
  }, [isSaved, isInitialSetup, onFinish, navigation]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const headerHeight = getSettingsHeaderHeight(insets.top);
  const baseBottomPadding = (tabBarHeight || 80) + insets.bottom + 16;

  const sectionYs = useRef({});
  const cardYs = useRef({});

  const [isCalendarVisible, setCalendarVisible] = useState(false);
  const [isColorPickerVisible, setColorPickerVisible] = useState(false);
  const [isIconPickerVisible, setIconPickerVisible] = useState(false);
  
  const [isWeeksExpanded, setIsWeeksExpanded] = useState(false);
  const [isReminderExpanded, setIsReminderExpanded] = useState(false);

  const isAnyExpanded = isWeeksExpanded || isReminderExpanded;
  const finalBottomPadding = baseBottomPadding + (isAnyExpanded ? screenHeight * 0.5 : 0);

  const configureEditorLayoutAnimation = () => {
    if (reduceMotion || !LayoutAnimation?.configureNext) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const scrollToElement = (section, card, yOffset = 0, delay = 150) => {
    setTimeout(() => {
      const sY = sectionYs.current[section] || 0;
      const cY = cardYs.current[card] || 0;
      const targetY = sY + cY + yOffset - headerHeight - 100; 
      
      if (scrollViewRef.current) {
        const scrollNode = scrollViewRef.current.scrollTo ? scrollViewRef.current : scrollViewRef.current.getNode?.();
        scrollNode?.scrollTo({ y: Math.max(0, targetY), animated: !reduceMotion });
      }
    }, delay);
  };

  const toggleWeeksExpand = () => {
    configureEditorLayoutAnimation();
    const willExpand = !isWeeksExpanded;
    setIsWeeksExpanded(willExpand);
    if (willExpand) {
      setIsReminderExpanded(false);
      scrollToElement('general', 'weeks', 0, 150);
    }
  };

  const toggleReminderExpand = () => {
    configureEditorLayoutAnimation();
    const willExpand = !isReminderExpanded;
    setIsReminderExpanded(willExpand);
    if (willExpand) {
      setIsWeeksExpanded(false);
      scrollToElement('general', 'reminder', 0, 150);
    }
  };

  const formatReminderValue = (reminder) => {
    const normalized = normalizeScheduleReminder(reminder);
    if (!normalized.enabled) return t('schedule.reminders.off', lang);
    return interpolate(t('schedule.reminders.before_minutes', lang), {
      minutes: normalized.minutesBefore,
    });
  };

  const ensureReminderPermission = async () => {
    const permission = await ensureNotificationPushPermissionsForType(
      NOTIFICATION_TYPES.LESSON_REMINDER,
      {
        request: true,
        notificationPreferences: global?.notificationPreferences,
      }
    );
    if (permission.disabledByPreference) return true;
    if (!permission.granted && permission.status !== 'unsupported') {
      Alert.alert(t('common.warning', lang), t('schedule.reminders.permission_denied', lang));
      return false;
    }
    return true;
  };

  const handleReminderSelection = async (selection) => {
    if (selection === 'off') {
      setLocalData(prev => ({ ...prev, reminder: { enabled: false } }));
      return;
    }

    const canEnable = await ensureReminderPermission();
    if (!canEnable) return;

    if (selection === 'custom') {
      const minutes = clampReminderMinutes(customReminderMinutes, CUSTOM_REMINDER_FALLBACK_MINUTES);
      setCustomReminderMinutes(String(minutes));
      setLocalData(prev => ({ ...prev, reminder: { enabled: true, minutesBefore: minutes } }));
      return;
    }

    const minutes = clampReminderMinutes(selection);
    setLocalData(prev => ({ ...prev, reminder: { enabled: true, minutesBefore: minutes } }));
  };

  const handleCustomReminderChange = (text) => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
    const minutes = numericText === '' ? 0 : clampReminderMinutes(numericText, 0);
    const displayValue = numericText === '' ? '' : String(minutes);
    setCustomReminderMinutes(displayValue);
    setLocalData(prev => ({ ...prev, reminder: { enabled: true, minutesBefore: minutes } }));
  };

  const handleTaskAutoLinkNextLessonChange = (enabled) => {
    triggerHaptic(enabled ? "toggleOn" : "toggleOff");
    setLocalData(prev => ({
      ...prev,
      taskAutoLinkMode: enabled ? TASK_AUTO_LINK_MODES.NEXT_SAME : TASK_AUTO_LINK_MODES.SELECTED,
    }));
  };

  const handleFinalSave = () => {
    if (isSaved) return;
    const finalName = localData.name?.trim() || t("common.schedule_name", lang);
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
      Alert.alert(t('schedule.main_screen.time', lang), t('settings.schedule_editor.timing.invalid', lang));
      return;
    }
    const exceedsDay = (scheduleData.schedule || []).some((day) => Object.values(day || {}).some((lessons) =>
      Array.isArray(lessons) && lessons.some((lesson) => lesson?.timeMode === 'slot' && !slots.some((slot) => slot.number === lesson.slotNumber))));
    if (exceedsDay) {
      Alert.alert(t('schedule.main_screen.time', lang), t('schedule.lesson_editor.slots_outside_day', lang));
      return;
    }
    const reconciledSchedule = reconcileScheduleRepeat(
      scheduleData,
      targetSchedule?.repeat ?? finalRepeat,
    );

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

  const displayTitle = isNew ? t('settings.schedule_switcher.add_new', lang) : (targetSchedule?.name || t('settings.schedule_editor.edit_schedule', lang));
  const isCustomRepeat = !['1', '2', '3', '4'].includes(String(localData.repeat));
  const reminderSelectionId = getScheduleReminderSelectionId(localData.reminder);
  const isSingleWeek = Number(localData.repeat) <= 1;
  const taskAutoLinkNextLesson = getTaskAutoLinkMode(localData) === TASK_AUTO_LINK_MODES.NEXT_SAME;

  const startDateObj = new Date(localData.starting_week);
  const dayOfWeek = startDateObj.toLocaleDateString(lang, { weekday: 'long' });
  const formattedDate = startDateObj.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

  const saveButtonElement = (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={isInitialSetup ? t('common.done', lang) : t('common.save', lang)} onPress={handleFinalSave} style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' }}>
      <Text style={{ color: themeColors.accentTextColor, fontSize: 17, fontWeight: '600' }}>
        {isInitialSetup ? t('common.done', lang) : t('common.save', lang)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior="padding"
        enabled={Platform.OS === 'ios'}
      >
        <SettingsHeader title={displayTitle} scrollY={scrollY} showBackButton={!isInitialSetup} rightButton={saveButtonElement} />
        
        <Animated.ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 10, paddingBottom: finalBottomPadding }]} 
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }], 
            { useNativeDriver: true }
          )} 
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View onLayout={e => sectionYs.current['general'] = e.nativeEvent.layout.y}>
            <SettingsGroup title={t('settings.sections.general', lang)} themeColors={themeColors}>
              
              <View style={styles.nameInputContainer} onLayout={e => cardYs.current['name'] = e.nativeEvent.layout.y}>
                <TextInput 
                  style={[styles.nameInput, { color: themeColors.textColor }]} 
                  value={localData.name} 
                  onChangeText={(text) => setLocalData(prev => ({ ...prev, name: text }))} 
                  placeholder={t('settings.schedule_editor.enter_name', lang)} 
                  placeholderTextColor={themeColors.textColor2} 
                  returnKeyType="done" 
                  maxLength={40} 
                  accessibilityLabel={t('settings.schedule_editor.enter_name', lang)}
                  textContentType="name"
                  autoComplete="name"
                  onFocus={() => scrollToElement('general', 'name', 0, 300)}
                />
              </View>

              <View onLayout={e => cardYs.current['color'] = e.nativeEvent.layout.y}>
                <SettingsRow
                  label={t('settings.schedule_editor.color', lang)}
                  desc={t('settings.schedule_editor.color_hint', lang)}
                  icon={Palette}
                  themeColors={themeColors}
                  onPress={() => setColorPickerVisible(true)}
                  showCaret={false}
                  rightContent={(
                    <View
                      style={[
                        styles.colorAction,
                        {
                          backgroundColor: scheduleColorWithAlpha(localData.color, 0.14),
                          borderColor: scheduleColorWithAlpha(localData.color, 0.42),
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.colorPreview,
                          {
                            backgroundColor: localData.color,
                            borderColor: scheduleColorWithAlpha(localData.color, 0.78),
                          },
                        ]}
                      />
                      <View style={[styles.colorEditBadge, { backgroundColor: themeColors.backgroundColor2, borderColor: scheduleColorWithAlpha(localData.color, 0.36) }]}>
                        <PencilSimple size={10} color={localData.color} weight="bold" />
                      </View>
                    </View>
                  )}
                />
              </View>

              <View onLayout={e => cardYs.current['icon'] = e.nativeEvent.layout.y}>
                <SettingsRow
                  label={t('settings.schedule_editor.icon', lang)}
                  desc={t('settings.schedule_editor.icon_hint', lang)}
                  icon={Shapes}
                  themeColors={themeColors}
                  onPress={() => setIconPickerVisible(true)}
                  rightContent={(
                    <ScheduleIcon
                      icon={localData.icon}
                      name={localData.name || t("common.schedule_name", lang)}
                      size={36}
                      iconSize={20}
                      backgroundColor={scheduleColorWithAlpha(localData.color, 0.16)}
                      color={localData.color}
                    />
                  )}
                />
              </View>

              <View onLayout={e => cardYs.current['reminder'] = e.nativeEvent.layout.y}>
                <SettingsRow
                  label={t('schedule.reminders.title', lang)}
                  value={formatReminderValue(localData.reminder)}
                  icon={Bell}
                  themeColors={themeColors}
                  onPress={toggleReminderExpand}
                />
              </View>

              {isReminderExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.reminderChoiceGrid}>
                    {[
                      { id: 'off', label: t('schedule.reminders.off', lang) },
                      ...REMINDER_PRESET_MINUTES.map((minutesBefore) => ({
                        id: String(minutesBefore),
                        label: String(minutesBefore),
                      })),
                      { id: 'custom', label: t('common.custom', lang) },
                    ].map((option) => {
                      const selected = reminderSelectionId === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          accessibilityRole="radio"
                          accessibilityLabel={option.id === 'off' || option.id === 'custom' ? option.label : t('schedule.reminders.before_minutes', lang, { minutes: option.label })}
                          accessibilityState={{ selected, checked: selected }}
                          style={[
                            styles.reminderChoice,
                            {
                              backgroundColor: selected ? themeColors.accentColor : themeColors.backgroundColor,
                              borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
                            },
                          ]}
                          onPress={() => handleReminderSelection(option.id)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.reminderChoiceText, { color: selected ? themeColors.textOnAccent : themeColors.textColor }]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {reminderSelectionId === 'custom' && (
                    <View style={[styles.customInputContainer, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.accentColor }]}>
                      <TextInput
                        style={[styles.nameInput, { color: themeColors.textColor }]}
                        value={customReminderMinutes}
                        onChangeText={handleCustomReminderChange}
                        placeholder={t('schedule.reminders.custom_placeholder', lang)}
                        placeholderTextColor={themeColors.textColor2}
                        keyboardType="number-pad"
                        maxLength={4}
                        returnKeyType="done"
                        accessibilityLabel={t('schedule.reminders.custom_placeholder', lang)}
                        onFocus={() => scrollToElement('general', 'reminder', 90, 300)}
                      />
                      <Text style={[styles.inputSuffix, { color: themeColors.textColor2 }]}>
                        {t('schedule.main_screen.minutes', lang)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View onLayout={e => cardYs.current['taskAutoLink'] = e.nativeEvent.layout.y}>
                <SettingsRow
                  label={t('settings.schedule_editor.task_auto_link', lang)}
                  desc={t('settings.schedule_editor.task_auto_link_hint', lang)}
                  icon={CheckSquare}
                  themeColors={themeColors}
                  showCaret={false}
                  skipHaptic
                  accessibilityRole="switch"
                  accessibilityState={{ checked: taskAutoLinkNextLesson }}
                  rightContentPointerEvents="none"
                  onPress={() => handleTaskAutoLinkNextLessonChange(!taskAutoLinkNextLesson)}
                  rightContent={(
                    <AppSwitch
                      accessibilityLabel={t('settings.schedule_editor.task_auto_link', lang)}
                      value={taskAutoLinkNextLesson}
                      onValueChange={handleTaskAutoLinkNextLessonChange}
                      themeColors={themeColors}
                      interactive={false}
                    />
                  )}
                />
              </View>

              <View onLayout={e => cardYs.current['weeks'] = e.nativeEvent.layout.y}>
                <SettingsRow
                  label={t('settings.menu.weeks.title', lang)}
                  value={localData.repeat}
                  icon={Stack}
                  themeColors={themeColors}
                  onPress={toggleWeeksExpand}
                />
              </View>

              {isWeeksExpanded && (
                <View style={styles.expandedContent}>
                  <TabSwitcher 
                    tabs={[
                      { id: '1', label: '1' }, 
                      { id: '2', label: '2' }, 
                      { id: '3', label: '3' }, 
                      { id: '4', label: '4' }
                    ]} 
                    activeTab={String(localData.repeat)} 
                    onTabPress={(id) => setLocalData(prev => ({ ...prev, repeat: id }))} 
                    themeColors={themeColors} 
                    activeTabBackgroundColor={isCustomRepeat ? 'transparent' : themeColors.accentColor}
                    containerBackgroundColor={themeColors.backgroundColor}
                    containerBorderColor={themeColors.borderColor}
                  />
                  
                  <View style={[styles.customInputContainer, { backgroundColor: themeColors.backgroundColor, borderColor: (isCustomRepeat && localData.repeat !== "") ? themeColors.accentColor : themeColors.borderColor }]}>
                    <TextInput 
                      style={[styles.nameInput, { color: themeColors.textColor }]} 
                      value={isCustomRepeat ? String(localData.repeat) : ""} 
                      onChangeText={(text) => setLocalData(prev => ({ ...prev, repeat: text.replace(/[^0-9]/g, '') }))} 
                      placeholder={t('settings.week_manager.repeat_label', lang)} 
                      placeholderTextColor={themeColors.textColor2} 
                      keyboardType="number-pad" 
                      maxLength={2} 
                      returnKeyType="done"
                      accessibilityLabel={t('settings.week_manager.repeat_label', lang)}
                      onBlur={() => setLocalData(prev => ({
                        ...prev,
                        repeat: String(normalizeScheduleRepeat(prev.repeat)),
                      }))}
                      onFocus={() => scrollToElement('general', 'weeks', 60, 300)}
                    />
                  </View>
                  
                  <View style={{ marginTop: 24, opacity: isSingleWeek ? 0.5 : 1 }}>
                    <Text style={[styles.expandedSubtitle, { color: themeColors.textColor2 }]}>
                      {t('settings.menu.start_date.title', lang)}
                    </Text>
                    <View style={[styles.nestedCard, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]}>
                      <SettingsRow 
                        label={capitalizedDay}
                        desc={formattedDate}
                        icon={CalendarBlank}
                        themeColors={themeColors}
                        onPress={() => setCalendarVisible(true)}
                      />
                    </View>
                  </View>
                </View>
              )}
            </SettingsGroup>
          </View>

          <View>
            <ScheduleTimeEditor value={localData} onChange={setLocalData} themeColors={themeColors} lang={lang} mode={mode} minimumSlots={minimumSlots} title={t('settings.sections.time_management', lang)} />
          </View>

        </Animated.ScrollView>
      </KeyboardAvoidingView>
      
      <CalendarSheet 
        visible={isCalendarVisible} 
        onClose={() => setCalendarVisible(false)} 
        currentDate={new Date(localData.starting_week)} 
        customSchedule={{
          ...localData,
          repeat: normalizeScheduleRepeat(localData.repeat)
        }}
        onDateSelect={(date) => { 
          setLocalData(prev => ({ ...prev, starting_week: date.toISOString() })); 
          setCalendarVisible(false); 
        }} 
      />

      <AdvancedColorPicker
        visible={isColorPickerVisible}
        initialColor={localData.color}
        onClose={() => setColorPickerVisible(false)}
        onSave={(color) => {
          setLocalData(prev => ({ ...prev, color }));
          setColorPickerVisible(false);
        }}
      />

      <ScheduleIconPickerSheet
        visible={isIconPickerVisible}
        onClose={() => setIconPickerVisible(false)}
        onSelect={(icon) => setLocalData(prev => ({ ...prev, icon }))}
        selectedIcon={localData.icon}
        scheduleName={localData.name || t("common.schedule_name", lang)}
        scheduleColor={localData.color}
        themeColors={themeColors}
        lang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1 }, 
  scrollContent: { padding: 16 }, 
  
  nameInputContainer: { 
    height: 56,
    justifyContent: 'center', 
    paddingHorizontal: 16 
  }, 
  nameInput: { 
    flex: 1,
    fontSize: 16, 
    fontWeight: '500', 
    paddingVertical: 0
  }, 
  colorAction: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPreview: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
  },
  colorEditBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  expandedContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  customInputContainer: { 
    height: 52, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    borderWidth: 1,
    marginTop: 12
  }, 
  inputSuffix: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  reminderChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderChoice: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reminderChoiceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  expandedHintText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  expandedSubtitle: {
    fontSize: 12, 
    fontWeight: '600', 
    marginBottom: 8, 
    marginLeft: 4, 
    textTransform: 'uppercase'
  },
  nestedCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden'
  },

});
