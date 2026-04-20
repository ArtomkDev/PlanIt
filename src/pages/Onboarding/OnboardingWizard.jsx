import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform,
  PanResponder, useColorScheme, useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CalendarDots, Clock, CalendarBlank, CaretDown, Trash, Plus,
  Hourglass, Coffee, HandWaving, PencilSimple, CaretLeft,
  CaretRight, Check, Eye, EyeSlash
} from 'phosphor-react-native';
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useSchedule } from '../../context/ScheduleProvider';
import { t } from '../../utils/i18n';
import themes from '../../config/themes';
import defaultSchedule from '../../config/defaultSchedule';
import TabSwitcher from '../../components/ui/TabSwitcher';
import CalendarSheet from '../../components/CalendarSheet/CalendarSheet';
import ExpandableCard from '../../components/ui/ExpandableCard';
import AppBlur from '../../components/ui/AppBlur';

const ICONS = [HandWaving, PencilSimple, CalendarDots, Clock];
const TOTAL_STEPS = 4;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function OnboardingWizard() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const { lang, global, addSchedule, setGlobalDraft } = useSchedule();

  const rawTheme = global?.theme?.[0];
  const defaultMode = colorScheme === 'dark' ? 'dark' : 'light';
  const mode = rawTheme === 'system' ? defaultMode : (rawTheme || defaultMode);
  const accent = global?.theme?.[1] || 'blue';
  const themeColors = themes.getColors(mode, accent);

  const [step, setStep] = useState(0);
  const [stepHeights, setStepHeights] = useState([400, 400, 400, 400]);
  const [showNavButtons, setShowNavButtons] = useState(Platform.OS === 'web');

  const scrollY = useRef(new Animated.Value(0)).current;
  const position = useRef(new Animated.Value(0)).current;
  const currentPosRef = useRef(0);
  const swipeStartPos = useRef(0);

  const exitAnim = useRef(new Animated.Value(1)).current;

  const exitOpacity = exitAnim;
  const exitScale = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
    extrapolate: 'clamp'
  });
  const exitTranslateY = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
    extrapolate: 'clamp'
  });

  const navAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  const toggleBtnScale = useRef(new Animated.Value(1)).current;
  const toggleIconRotate = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(navAnim, {
        toValue: showNavButtons ? 1 : 0,
        useNativeDriver: true,
        bounciness: 5,
        speed: 12
      }),
      Animated.timing(toggleIconRotate, {
        toValue: showNavButtons ? 1 : 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  }, [showNavButtons, navAnim, toggleIconRotate]);

  const navTranslateY = navAnim.interpolate({ inputRange: [0, 1], outputRange: [150, 0] });
  const navOpacity = navAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  const iconRotation = toggleIconRotate.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });

  const handleToggleNav = () => {
    Animated.sequence([
      Animated.timing(toggleBtnScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(toggleBtnScale, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
    setShowNavButtons(prev => !prev);
  };

  useEffect(() => {
    const id = position.addListener(({ value }) => {
      currentPosRef.current = value;
      const closestStep = Math.round(value);
      if (closestStep !== step && closestStep >= 0 && closestStep < TOTAL_STEPS) {
        setStep(closestStep);
      }
    });
    return () => position.removeListener(id);
  }, [step, position]);

  const [scheduleName, setScheduleName] = useState('');
  const [weeksCount, setWeeksCount] = useState('1');
  const [startingWeek, setStartingWeek] = useState(new Date().toISOString());
  const [isCalendarVisible, setCalendarVisible] = useState(false);
  const [firstLessonTime, setFirstLessonTime] = useState('08:30');
  const [lessonDuration, setLessonDuration] = useState('80');
  const [breaks, setBreaks] = useState(["10", "10", "10", "10"]);

  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [isDurationExpanded, setIsDurationExpanded] = useState(false);
  const [isBreaksExpanded, setIsBreaksExpanded] = useState(false);

  const toggleTimeExpand = () => { setIsTimeExpanded(!isTimeExpanded); setIsDurationExpanded(false); setIsBreaksExpanded(false); };
  const toggleDurationExpand = () => { setIsDurationExpanded(!isDurationExpanded); setIsTimeExpanded(false); setIsBreaksExpanded(false); };
  const toggleBreaksExpand = () => { setIsBreaksExpanded(!isBreaksExpanded); setIsTimeExpanded(false); setIsDurationExpanded(false); };

  const navigateToStep = (newStep) => {
    if (newStep < 0) return;
    
    if (newStep >= TOTAL_STEPS) {
      Animated.parallel([
        Animated.spring(position, {
          toValue: TOTAL_STEPS,
          useNativeDriver: false,
          bounciness: 0,
          speed: 16
        }),
        Animated.timing(exitAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true
        })
      ]).start(() => {
        handleFinish();
      });
      return;
    }
    
    if (newStep === 1 && currentPosRef.current < 0.5 && !scheduleName.trim()) {
      setScheduleName(t('sync_conflict.untitled', lang));
    }
    
    Animated.spring(position, {
      toValue: newStep,
      useNativeDriver: false,
      bounciness: 0,
      speed: 16
    }).start();
  };

  const handleFinish = async () => {
    const finalRepeat = Math.max(1, Number(weeksCount) || 1);
    const scheduleId = uuidv4();
    addSchedule({
      ...defaultSchedule,
      id: scheduleId,
      name: scheduleName.trim() || t('sync_conflict.untitled', lang),
      repeat: finalRepeat,
      duration: Number(lessonDuration) || 80,
      breaks: breaks.map(b => (isNaN(Number(b)) || Number(b) <= 0) ? 10 : Number(b)),
      start_time: firstLessonTime,
      starting_week: startingWeek,
    });
    setGlobalDraft(prev => ({ ...prev, currentScheduleId: scheduleId }));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
      },
      onPanResponderGrant: () => {
        position.stopAnimation();
        swipeStartPos.current = currentPosRef.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        let newPos = swipeStartPos.current - (gestureState.dx / width);
        if (newPos < 0) newPos = newPos * 0.25;
        if (newPos > TOTAL_STEPS - 1) newPos = (TOTAL_STEPS - 1) + (newPos - (TOTAL_STEPS - 1)) * 0.4;
        position.setValue(newPos);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        let targetStep = Math.round(currentPosRef.current);

        if (dx > 50 || vx > 0.5) targetStep = Math.floor(currentPosRef.current);
        else if (dx < -50 || vx < -0.5) targetStep = Math.ceil(currentPosRef.current);

        targetStep = Math.max(0, Math.min(TOTAL_STEPS, targetStep));
        navigateToStep(targetStep);
      }
    })
  ).current;

  const dynamicContainerHeight = position.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: stepHeights,
    extrapolate: 'clamp'
  });

  const compactH = Platform.OS === 'ios' ? 100 : 80;
  const headerHeight = position.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [240, compactH, compactH, compactH], extrapolate: 'clamp' });
  const dynamicBlurOpacity = scrollY.interpolate({ inputRange: [0, 20], outputRange: [0, 1], extrapolate: 'clamp' });
  const dynamicBorderColor = scrollY.interpolate({ inputRange: [0, 20], outputRange: ['transparent', themeColors.borderColor], extrapolate: 'clamp' });

  const iconTop = position.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [80, Platform.OS === 'ios' ? 35 : 15, Platform.OS === 'ios' ? 35 : 15, Platform.OS === 'ios' ? 35 : 15], extrapolate: 'clamp' });
  const iconLeft = position.interpolate({ inputRange: [0, 0.4, 1, 2, 3], outputRange: [width / 2 - 40, 4, 4, 4, 4], extrapolate: 'clamp' });
  const iconScale = position.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [1, 0.5, 0.5, 0.5], extrapolate: 'clamp' });

  const dotsTop = position.interpolate({ inputRange: [0, 0.6, 1, 2, 3], outputRange: [180, 140, Platform.OS === 'ios' ? 71 : 51, Platform.OS === 'ios' ? 71 : 51, Platform.OS === 'ios' ? 71 : 51], extrapolate: 'clamp' });
  const dotsLeft = position.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [width / 2 - 40, 84, 84, 84], extrapolate: 'clamp' });

  const isCustomRepeat = !['1', '2', '3', '4'].includes(String(weeksCount));
  const isCustomDuration = !['45', '60', '80', '90'].includes(String(lessonDuration));
  const isSingleWeek = Number(weeksCount) <= 1;

  const startDateObj = new Date(startingWeek);
  const formattedDate = startDateObj.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const dayOfWeek = startDateObj.toLocaleDateString(lang, { weekday: 'long' });
  const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

  const [hours, minutes] = (firstLessonTime || "08:30").split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(isNaN(hours) ? 8 : hours, isNaN(minutes) ? 30 : minutes, 0, 0);

  const handleBreakChange = (text, index) => setBreaks(prev => { const n = [...prev]; n[index] = text.replace(/[^0-9]/g, ''); return n; });
  const handleAddBreak = () => setBreaks(prev => [...prev, "10"]);
  const handleRemoveBreak = (index) => setBreaks(prev => prev.filter((_, i) => i !== index));

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: themeColors.textColor }]}>{t('onboarding.welcome_main_title', lang)}</Text>
      <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>{t('onboarding.welcome_main_desc', lang)}</Text>
      <Text style={[styles.swipeHint, { color: themeColors.textColor2 }]}>{t('onboarding.swipe_to_continue', lang)} ➔</Text>
      <Text style={[styles.swipeHintSub, { color: themeColors.textColor2 }]}>{t('onboarding.swipe_hint_sub', lang)}</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: themeColors.textColor, textAlign: 'center' }]}>{t('onboarding.welcome_title', lang)}</Text>
      <Text style={[styles.subtitle, { color: themeColors.textColor2, textAlign: 'center', marginBottom: 30 }]}>{t('onboarding.welcome_subtitle', lang)}</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: themeColors.textColor }]}>{t('onboarding.step1_title', lang)}</Text>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.step1_desc', lang)}</Text>
        <TextInput style={[styles.textInput, { backgroundColor: themeColors.backgroundColor2, color: themeColors.textColor, borderColor: themeColors.borderColor }]} placeholder={t('onboarding.schedule_name_placeholder', lang)} placeholderTextColor={themeColors.textColor2} value={scheduleName} onChangeText={setScheduleName} />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: themeColors.textColor, textAlign: 'center' }]}>{t('onboarding.step2_title', lang)}</Text>
      <Text style={[styles.subtitle, { color: themeColors.textColor2, textAlign: 'center', marginBottom: 30 }]}>{t('onboarding.step2_desc', lang)}</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: themeColors.textColor }]}>{t('settings.menu.weeks.title', lang)}</Text>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.weeks_count_desc', lang)}</Text>
        <TabSwitcher tabs={[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }]} activeTab={String(weeksCount)} onTabPress={setWeeksCount} themeColors={themeColors} activeTabBackgroundColor={isCustomRepeat ? 'transparent' : themeColors.accentColor} containerBackgroundColor={themeColors.backgroundColor2} containerBorderColor={themeColors.borderColor} />
        <View style={[styles.customInputContainer, { backgroundColor: themeColors.backgroundColor2, borderColor: (isCustomRepeat && weeksCount !== "") ? themeColors.accentColor : themeColors.borderColor }]}>
          <TextInput style={[styles.customInput, { color: themeColors.textColor }]} value={isCustomRepeat ? String(weeksCount) : ""} onChangeText={(text) => setWeeksCount(text.replace(/[^0-9]/g, ''))} placeholder={t('settings.week_manager.repeat_label', lang)} placeholderTextColor={themeColors.textColor2} keyboardType="number-pad" maxLength={2} />
        </View>
      </View>

      <View style={[styles.inputGroup, { opacity: isSingleWeek ? 0.5 : 1, marginTop: 10 }]}>
        <Text style={[styles.label, { color: themeColors.textColor }]}>{t('onboarding.starting_week', lang)}</Text>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.starting_week_desc', lang)}</Text>
        <TouchableOpacity style={[styles.dateCard, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]} onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
          <View style={[styles.dateCardIcon, { backgroundColor: themeColors.accentColor + '15' }]}>
            <CalendarBlank size={26} color={themeColors.accentColor} weight="fill" />
          </View>
          <View style={styles.dateCardTextContainer}>
            <Text style={[styles.dateCardDay, { color: themeColors.textColor }]}>{capitalizedDay}</Text>
            <Text style={[styles.dateCardDate, { color: themeColors.textColor2 }]}>{formattedDate}</Text>
          </View>
          <CaretDown size={20} color={themeColors.textColor2} weight="bold" style={{ opacity: 0.5 }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: themeColors.textColor, textAlign: 'center' }]}>{t('onboarding.step3_title', lang)}</Text>
      <Text style={[styles.subtitle, { color: themeColors.textColor2, textAlign: 'center', marginBottom: 30 }]}>{t('onboarding.step3_desc', lang)}</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.first_lesson_time_desc', lang)}</Text>
        <ExpandableCard title={t('settings.menu.start_time.title', lang)} value={firstLessonTime} icon={Clock} themeColors={themeColors} isExpanded={isTimeExpanded} onToggle={toggleTimeExpand} hideChevronOnAndroid>
          {Platform.OS === 'android' ? (
            <DateTimePicker value={timeDate} mode="time" is24Hour display="default" themeVariant={mode} onChange={(e, d) => { setIsTimeExpanded(false); if (e.type === 'set' && d) setFirstLessonTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); }} />
          ) : (
            <View style={styles.timePickerContainer}>
              {Platform.OS !== 'web' ? <DateTimePicker value={timeDate} mode="time" is24Hour display="spinner" themeVariant={mode} onChange={(e, d) => { if (d) setFirstLessonTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); }} textColor={themeColors.textColor} style={{ height: 120, width: '100%' }} /> : <View style={{ padding: 20, width: '100%', alignItems: 'center' }}><input type="time" value={firstLessonTime} onChange={(e) => setFirstLessonTime(e.target.value)} style={{ fontSize: 24, padding: 12, borderRadius: 12, width: '100%', textAlign: 'center', border: `1px solid ${themeColors.borderColor}`, backgroundColor: themeColors.backgroundColor, color: themeColors.textColor }} /></View>}
            </View>
          )}
        </ExpandableCard>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.lesson_duration_desc', lang)}</Text>
        <ExpandableCard title={t('settings.menu.duration.title', lang)} value={`${lessonDuration} ${t('schedule.main_screen.minutes', lang)}`} icon={Hourglass} themeColors={themeColors} isExpanded={isDurationExpanded} onToggle={toggleDurationExpand}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <TabSwitcher tabs={[{ id: '45', label: '45' }, { id: '60', label: '60' }, { id: '80', label: '80' }, { id: '90', label: '90' }]} activeTab={String(lessonDuration)} onTabPress={setLessonDuration} themeColors={themeColors} activeTabBackgroundColor={isCustomDuration ? 'transparent' : themeColors.accentColor} containerBackgroundColor={themeColors.backgroundColor} containerBorderColor={themeColors.borderColor} />
            <View style={[styles.customInputContainer, { backgroundColor: themeColors.backgroundColor, borderColor: (isCustomDuration && lessonDuration !== "") ? themeColors.accentColor : themeColors.borderColor }]}>
              <TextInput style={[styles.customInput, { color: themeColors.textColor }]} value={isCustomDuration ? String(lessonDuration) : ""} onChangeText={(t) => setLessonDuration(t.replace(/[^0-9]/g, ''))} placeholder={t('schedule.main_screen.duration', lang)} placeholderTextColor={themeColors.textColor2} keyboardType="number-pad" maxLength={3} />
            </View>
          </View>
        </ExpandableCard>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputDesc, { color: themeColors.textColor2 }]}>{t('onboarding.breaks_desc', lang)}</Text>
        <ExpandableCard title={t('settings.menu.breaks.title', lang)} value={`${breaks.length}`} icon={Coffee} themeColors={themeColors} isExpanded={isBreaksExpanded} onToggle={toggleBreaksExpand}>
          <View style={{ paddingBottom: 8 }}>
            {breaks.map((brk, idx) => (
              <View key={`break-${idx}`} style={[styles.breakRow, { borderBottomColor: themeColors.borderColor }]}>
                <Text style={[styles.breakRowLabel, { color: themeColors.textColor }]}>{t('schedule.day_schedule.break', lang)} {idx + 1}</Text>
                <View style={styles.breakActions}>
                  <View style={[styles.breakInputWrapper, { backgroundColor: themeColors.accentColor + '15' }]}>
                    <TextInput style={[styles.breakRowInput, { color: themeColors.accentColor }]} value={String(brk)} onChangeText={(t) => handleBreakChange(t, idx)} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                    <Text style={[styles.breakRowMin, { color: themeColors.accentColor }]}>{t('schedule.main_screen.minutes', lang)}</Text>
                  </View>
                  {breaks.length > 1 && <TouchableOpacity onPress={() => handleRemoveBreak(idx)} style={styles.trashBtn} activeOpacity={0.7}><Trash size={18} color="#FF3B30" weight="bold" /></TouchableOpacity>}
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.addBreakBtn, { borderColor: themeColors.accentColor, backgroundColor: themeColors.accentColor + '0A' }]} onPress={handleAddBreak} activeOpacity={0.7}>
              <Plus size={20} color={themeColors.accentColor} weight="bold" />
              <Text style={[styles.addBreakText, { color: themeColors.accentColor }]}>{t('settings.breaks_manager.add_btn', lang)}</Text>
            </TouchableOpacity>
          </View>
        </ExpandableCard>
      </View>
    </View>
  );

  const stepsRenderers = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[{ flex: 1, opacity: exitOpacity, transform: [{ scale: exitScale }, { translateY: exitTranslateY }] }]}>
        
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: showNavButtons ? (Platform.OS === 'ios' ? 140 : 110) : 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          <Animated.View style={{ height: headerHeight }} />

          <Animated.View style={[styles.contentContainer, { width, height: dynamicContainerHeight }]}>
            {stepsRenderers.map((renderItem, idx) => {
              const isActive = step === idx;
              const opacity = position.interpolate({
                inputRange: [idx - 0.6, idx, idx + 0.6],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp'
              });
              const translateX = position.interpolate({
                inputRange: [idx - 1, idx, idx + 1],
                outputRange: [width * 0.5, 0, -width * 0.5],
                extrapolate: 'clamp'
              });
              const scale = position.interpolate({
                inputRange: [idx - 1, idx, idx + 1],
                outputRange: [0.85, 1, 0.85],
                extrapolate: 'clamp'
              });

              return (
                <Animated.View
                  key={idx}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (Math.abs(stepHeights[idx] - h) > 2) {
                      setStepHeights(prev => {
                        const next = [...prev];
                        next[idx] = h;
                        return next;
                      });
                    }
                  }}
                  style={[styles.stepWrapper, { width, opacity, transform: [{ translateX }, { scale }], zIndex: isActive ? 10 : 0 }]}
                  pointerEvents={isActive ? 'auto' : 'none'}
                >
                  {renderItem()}
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.ScrollView>

        <Animated.View style={[styles.header, { height: headerHeight, borderBottomColor: dynamicBorderColor }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: dynamicBlurOpacity }]}>
            <AppBlur style={StyleSheet.absoluteFill} />
          </Animated.View>

          <AnimatedTouchableOpacity
            style={[
              styles.toggleNavBtn,
              {
                top: Platform.OS === 'ios' ? 58 : 38,
                backgroundColor: themeColors.backgroundColor2,
                borderColor: themeColors.borderColor,
                transform: [{ scale: toggleBtnScale }]
              }
            ]}
            onPress={handleToggleNav}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
              {showNavButtons ? (
                <Eye size={18} color={themeColors.textColor} weight="bold" />
              ) : (
                <EyeSlash size={18} color={themeColors.textColor} weight="bold" />
              )}
            </Animated.View>
            <Text style={[styles.toggleNavText, { color: themeColors.textColor }]}>
              {t('onboarding.navigation', lang)}
            </Text>
          </AnimatedTouchableOpacity>

          <Animated.View style={[styles.dotsWrapper, { top: dotsTop, left: dotsLeft }]}>
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
              const dotWidth = position.interpolate({ inputRange: [idx - 1, idx, idx + 1], outputRange: [8, 24, 8], extrapolate: 'clamp' });
              const dotColor = position.interpolate({ inputRange: [idx - 1, idx], outputRange: [themeColors.borderColor, themeColors.accentColor], extrapolate: 'clamp' });
              return <Animated.View key={idx} style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]} />;
            })}
          </Animated.View>

          <Animated.View style={[styles.iconCircle, { top: iconTop, left: iconLeft, transform: [{ scale: iconScale }] }]}>
            <View style={[StyleSheet.absoluteFill, { borderRadius: 40, overflow: 'hidden' }]}>
              <LinearGradient colors={[themeColors.accentColor + '30', themeColors.accentColor + '05']} style={StyleSheet.absoluteFill} />
            </View>
            {ICONS.map((Icon, idx) => {
              const opacity = position.interpolate({ inputRange: [idx - 1, idx, idx + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' });
              const bounce = position.interpolate({ inputRange: [idx - 1, idx, idx + 1], outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
              return (
                <Animated.View key={idx} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale: bounce }] }]} pointerEvents="none">
                  <Icon size={40} color={themeColors.accentColor} weight="fill" />
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomNavContainer,
            { 
              borderTopColor: themeColors.borderColor,
              opacity: navOpacity,
              transform: [{ translateY: navTranslateY }]
            }
          ]}
          pointerEvents={showNavButtons ? 'auto' : 'none'}
        >
          <View style={StyleSheet.absoluteFill}>
            <AppBlur style={StyleSheet.absoluteFill} />
          </View>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: themeColors.backgroundColor2, opacity: step === 0 ? 0.4 : 1 }]}
            disabled={step === 0}
            onPress={() => navigateToStep(step - 1)}
            activeOpacity={0.7}
          >
            <CaretLeft size={20} color={themeColors.textColor} weight="bold" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtnMain, { backgroundColor: themeColors.accentColor }]}
            onPress={() => navigateToStep(step + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnMainText}>
              {step === TOTAL_STEPS - 1 ? t('settings.menu.done', lang) : t('onboarding.next', lang)}
            </Text>
            {step === TOTAL_STEPS - 1 ? (
              <Check size={20} color="#FFF" weight="bold" style={{ marginLeft: 8 }} />
            ) : (
              <CaretRight size={20} color="#FFF" weight="bold" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>

      <CalendarSheet visible={isCalendarVisible} onClose={() => setCalendarVisible(false)} currentDate={new Date(startingWeek)} customSchedule={{ repeat: Math.max(1, Number(weeksCount) || 1) }} onDateSelect={(date) => { setStartingWeek(date.toISOString()); setCalendarVisible(false); }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden', backgroundColor: 'transparent' },
  toggleNavBtn: { position: 'absolute', right: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, zIndex: 50 },
  toggleNavText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  dotsWrapper: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  iconCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
  contentContainer: { position: 'relative', paddingTop: 20 },
  stepWrapper: { position: 'absolute', top: 20, left: 0, paddingHorizontal: 24 },
  stepContent: { alignItems: 'center', width: '100%', paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, lineHeight: 24, paddingHorizontal: 10 },
  swipeHint: { fontSize: 15, fontWeight: '600', marginTop: 40, opacity: 0.6 },
  swipeHintSub: { fontSize: 13, marginTop: 12, opacity: 0.5, textAlign: 'center', paddingHorizontal: 20 },
  inputGroup: { width: '100%', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, opacity: 0.9 },
  inputDesc: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  textInput: { width: '100%', height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, borderWidth: 1 },
  customInputContainer: { height: 52, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  customInput: { fontSize: 16, fontWeight: '500', height: '100%' },
  dateCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  dateCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  dateCardTextContainer: { flex: 1 },
  dateCardDay: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  dateCardDate: { fontSize: 14 },
  timePickerContainer: { alignItems: 'center', overflow: 'hidden' },
  breakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  breakRowLabel: { fontSize: 16, fontWeight: '500' },
  breakActions: { flexDirection: 'row', alignItems: 'center' },
  breakInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 10, marginRight: 8 },
  breakRowInput: { fontSize: 16, fontWeight: '700', textAlign: 'center', minWidth: 30 },
  breakRowMin: { fontSize: 14, fontWeight: '600', marginLeft: 2, opacity: 0.8 },
  trashBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF3B3015', justifyContent: 'center', alignItems: 'center' },
  addBreakBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
  addBreakText: { fontSize: 15, fontWeight: '600', marginLeft: 8 },
  bottomNavContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 20, borderTopWidth: StyleSheet.hairlineWidth, position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', overflow: 'hidden' },
  navBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  navBtnMain: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 16 },
  navBtnMainText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});