import React, { useState, useMemo, useRef } from 'react';
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
  useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';
import SettingsHeader from '../../../components/ui/SettingsHeader';
import TabSwitcher from '../../../components/ui/TabSwitcher';
import { generateId } from '../../../utils/idGenerator';
import CalendarSheet from '../../../components/CalendarSheet/CalendarSheet';
import ExpandableCard from '../../../components/ui/ExpandableCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ScheduleEditorScreen({ route: propsRoute, onFinish }) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  
  const params = route.params || propsRoute?.params || {};
  const { scheduleId, isInitialSetup, isNew } = params;

  const { global, schedules, schedule: currentActiveSchedule, setData, setGlobalDraft, addSchedule, lang, tabBarHeight } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const targetSchedule = useMemo(() => {
    if (isNew) return null;
    return schedules.find(s => s.id === scheduleId) || currentActiveSchedule;
  }, [schedules, scheduleId, currentActiveSchedule, isNew]);

  const [localData, setLocalData] = useState({
    id: targetSchedule?.id || generateId(),
    name: targetSchedule?.name || "",
    repeat: String(targetSchedule?.repeat || 1),
    start_time: targetSchedule?.start_time || "08:30",
    duration: String(targetSchedule?.duration || "45"),
    breaks: targetSchedule?.breaks?.map(String) || ["10", "10", "10", "10", "10"],
    starting_week: targetSchedule?.starting_week || new Date().toISOString(),
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollY = useRef(0);
  const scrollViewRef = useRef(null);
  const headerHeight = 60 + insets.top;
  const baseBottomPadding = (tabBarHeight || 80) + insets.bottom + 16;

  const sectionYs = useRef({});
  const cardYs = useRef({});

  const [isCalendarVisible, setCalendarVisible] = useState(false);
  
  const [isWeeksExpanded, setIsWeeksExpanded] = useState(false);
  const [isDurationExpanded, setIsDurationExpanded] = useState(false);
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [isBreaksExpanded, setIsBreaksExpanded] = useState(false);

  const isAnyExpanded = isWeeksExpanded || isDurationExpanded || isTimeExpanded || isBreaksExpanded;
  const finalBottomPadding = baseBottomPadding + (isAnyExpanded ? screenHeight * 0.5 : 0);

  const scrollToElement = (section, card, yOffset = 0, delay = 150) => {
    setTimeout(() => {
      const sY = sectionYs.current[section] || 0;
      const cY = cardYs.current[card] || 0;
      const targetY = sY + cY + yOffset - headerHeight - 100; 
      
      if (scrollViewRef.current) {
        const scrollNode = scrollViewRef.current.scrollTo ? scrollViewRef.current : scrollViewRef.current.getNode?.();
        scrollNode?.scrollTo({ y: Math.max(0, targetY), animated: true });
      }
    }, delay);
  };

  const toggleWeeksExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const willExpand = !isWeeksExpanded;
    setIsWeeksExpanded(willExpand);
    if (willExpand) {
      setIsDurationExpanded(false); setIsTimeExpanded(false); setIsBreaksExpanded(false);
      scrollToElement('general', 'weeks', 0, 150);
    }
  };

  const toggleDurationExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const willExpand = !isDurationExpanded;
    setIsDurationExpanded(willExpand);
    if (willExpand) {
      setIsWeeksExpanded(false); setIsTimeExpanded(false); setIsBreaksExpanded(false);
      scrollToElement('time', 'duration', 0, 150);
    }
  };

  const toggleTimeExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const willExpand = !isTimeExpanded;
    setIsTimeExpanded(willExpand);
    if (willExpand) {
      setIsWeeksExpanded(false); setIsDurationExpanded(false); setIsBreaksExpanded(false);
      scrollToElement('time', 'startTime', 0, 150);
    }
  };

  const toggleBreaksExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const willExpand = !isBreaksExpanded;
    setIsBreaksExpanded(willExpand);
    if (willExpand) {
      setIsWeeksExpanded(false); setIsDurationExpanded(false); setIsTimeExpanded(false);
      scrollToElement('time', 'breaks', 0, 150);
    }
  };

  const handleBreakChange = (text, index) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setLocalData(prev => {
      const newBreaks = [...prev.breaks];
      newBreaks[index] = numeric;
      return { ...prev, breaks: newBreaks };
    });
  };

  const handleAddBreak = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setLocalData(prev => {
      const nextBreaks = [...prev.breaks, "10"];
      
      setTimeout(() => {
        const sY = sectionYs.current['time'] || 0;
        const cY = cardYs.current['breaks'] || 0;
        const buttonBottomY = sY + cY + 60 + (nextBreaks.length * 60) + 80; 
        const visibleBottom = currentScrollY.current + screenHeight - baseBottomPadding;
        
        if (buttonBottomY > visibleBottom) {
          const scrollNode = scrollViewRef.current?.scrollTo ? scrollViewRef.current : scrollViewRef.current?.getNode?.();
          scrollNode?.scrollTo({ y: currentScrollY.current + 80, animated: true });
        }
      }, 50);

      return { ...prev, breaks: nextBreaks };
    });
  };

  const handleRemoveBreak = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setLocalData(prev => ({ ...prev, breaks: prev.breaks.filter((_, i) => i !== index) }));
  };

  const handleFinalSave = () => {
    const finalName = localData.name?.trim() || t('settings.schedule_editor.schedule_name', lang);
    const finalRepeat = Math.max(1, Number(localData.repeat) || 1);
    const finalBreaks = localData.breaks.map(b => (isNaN(Number(b)) || Number(b) <= 0) ? 10 : Number(b));

    const scheduleData = { 
      ...targetSchedule, 
      ...localData, 
      name: finalName, 
      repeat: finalRepeat,
      duration: Number(localData.duration) || 45,
      breaks: finalBreaks
    };

    if (isNew) {
      addSchedule(scheduleData);
      setGlobalDraft(prev => ({ ...prev, currentScheduleId: scheduleData.id }));
    } else {
      setData(prev => {
        if (!prev) return prev;
        const nextSchedules = prev.schedules.map(s => 
          s.id === scheduleData.id ? { ...s, ...scheduleData, lastModified: Date.now() } : s
        );
        return { ...prev, schedules: nextSchedules };
      });
      setGlobalDraft(prev => prev);
    }
    
    if (isInitialSetup && onFinish) onFinish();
    else if (navigation.canGoBack()) navigation.goBack();
  };

  const timeValue = localData.start_time || "08:30";
  const [hours, minutes] = timeValue.split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(isNaN(hours) ? 8 : hours, isNaN(minutes) ? 30 : minutes, 0, 0);

  const displayTitle = isNew ? t('settings.schedule_switcher.add_new', lang) : (targetSchedule?.name || t('settings.schedule_editor.edit_schedule', lang));
  const isCustomRepeat = !['1', '2', '3', '4'].includes(String(localData.repeat));
  const isCustomDuration = !['45', '60', '80', '90'].includes(String(localData.duration));
  const isSingleWeek = Number(localData.repeat) <= 1;

  const startDateObj = new Date(localData.starting_week);
  const dayOfWeek = startDateObj.toLocaleDateString(lang, { weekday: 'long' });
  const formattedDate = startDateObj.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

  const saveButtonElement = (
    <TouchableOpacity onPress={handleFinalSave} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ color: themeColors.accentColor, fontSize: 17, fontWeight: '600' }}>
        {isInitialSetup ? t('common.done', lang) : t('common.save', lang)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SettingsHeader title={displayTitle} scrollY={scrollY} showBackButton={!isInitialSetup} rightButton={saveButtonElement} />
        
        <Animated.ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 10, paddingBottom: finalBottomPadding }]} 
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }], 
            { 
              useNativeDriver: true,
              listener: (event) => {
                currentScrollY.current = event.nativeEvent.contentOffset.y;
              }
            }
          )} 
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section} onLayout={e => sectionYs.current['general'] = e.nativeEvent.layout.y}>
            <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>{t('settings.sections.general', lang)}</Text>
            
            <View 
              style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor, marginBottom: 12 }]}
              onLayout={e => cardYs.current['name'] = e.nativeEvent.layout.y}
            >
              <TextInput 
                style={[styles.input, { color: themeColors.textColor }]} 
                value={localData.name} 
                onChangeText={(text) => setLocalData(prev => ({ ...prev, name: text }))} 
                placeholder={t('settings.schedule_editor.enter_name', lang)} 
                placeholderTextColor={themeColors.textColor2} 
                returnKeyType="done" 
                maxLength={40} 
                onFocus={() => scrollToElement('general', 'name', 0, 300)}
              />
            </View>

            <View onLayout={e => cardYs.current['weeks'] = e.nativeEvent.layout.y}>
              <ExpandableCard
                title={t('settings.menu.weeks.title', lang)}
                value={localData.repeat}
                icon="layers-outline"
                themeColors={themeColors}
                isExpanded={isWeeksExpanded}
                onToggle={toggleWeeksExpand}
              >
                <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
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
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor, borderColor: (isCustomRepeat && localData.repeat !== "") ? themeColors.accentColor : themeColors.borderColor }]}>
                    <TextInput 
                      style={[styles.input, { color: themeColors.textColor }]} 
                      value={isCustomRepeat ? String(localData.repeat) : ""} 
                      onChangeText={(text) => setLocalData(prev => ({ ...prev, repeat: text.replace(/[^0-9]/g, '') }))} 
                      placeholder={t('settings.week_manager.repeat_label', lang)} 
                      placeholderTextColor={themeColors.textColor2} 
                      keyboardType="number-pad" 
                      maxLength={2} 
                      returnKeyType="done" 
                      onFocus={() => scrollToElement('general', 'weeks', 60, 300)}
                    />
                  </View>
                  
                  <View style={{ marginTop: 24, opacity: isSingleWeek ? 0.5 : 1 }}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>{t('settings.menu.start_date.title', lang)}</Text>
                    <TouchableOpacity style={[styles.dateCard, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.borderColor }]} onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
                      <View style={[styles.dateCardIcon, { backgroundColor: themeColors.accentColor + '15' }]}><Ionicons name="calendar" size={26} color={themeColors.accentColor} /></View>
                      <View style={styles.dateCardTextContainer}><Text style={[styles.dateCardDay, { color: themeColors.textColor }]}>{capitalizedDay}</Text><Text style={[styles.dateCardDate, { color: themeColors.textColor2 }]}>{formattedDate}</Text></View>
                      <Ionicons name="chevron-down" size={20} color={themeColors.textColor2} style={{ opacity: 0.5 }} />
                    </TouchableOpacity>
                  </View>

                </View>
              </ExpandableCard>
            </View>
          </View>

          <View style={styles.section} onLayout={e => sectionYs.current['time'] = e.nativeEvent.layout.y}>
            <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>{t('settings.sections.time_management', lang)}</Text>
            
            <View onLayout={e => cardYs.current['duration'] = e.nativeEvent.layout.y}>
              <ExpandableCard
                title={t('settings.menu.duration.title', lang)}
                value={`${localData.duration} ${t('schedule.main_screen.minutes', lang)}`}
                icon="hourglass-outline"
                themeColors={themeColors}
                isExpanded={isDurationExpanded}
                onToggle={toggleDurationExpand}
              >
                <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                  <TabSwitcher 
                    tabs={[
                      { id: '45', label: '45' }, 
                      { id: '60', label: '60' }, 
                      { id: '80', label: '80' }, 
                      { id: '90', label: '90' }
                    ]} 
                    activeTab={String(localData.duration)} 
                    onTabPress={(id) => setLocalData(prev => ({ ...prev, duration: id }))} 
                    themeColors={themeColors} 
                    activeTabBackgroundColor={isCustomDuration ? 'transparent' : themeColors.accentColor} 
                    containerBackgroundColor={themeColors.backgroundColor}
                    containerBorderColor={themeColors.borderColor}
                  />
                  <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor, borderColor: (isCustomDuration && localData.duration !== "") ? themeColors.accentColor : themeColors.borderColor }]}>
                    <TextInput 
                      style={[styles.input, { color: themeColors.textColor }]} 
                      value={isCustomDuration ? String(localData.duration) : ""} 
                      onChangeText={(text) => setLocalData(prev => ({ ...prev, duration: text.replace(/[^0-9]/g, '') }))} 
                      placeholder={t('schedule.main_screen.duration', lang)} 
                      placeholderTextColor={themeColors.textColor2} 
                      keyboardType="number-pad" 
                      maxLength={3} 
                      returnKeyType="done" 
                      onFocus={() => scrollToElement('time', 'duration', 60, 300)}
                    />
                  </View>
                </View>
              </ExpandableCard>
            </View>

            <View onLayout={e => cardYs.current['startTime'] = e.nativeEvent.layout.y}>
              <ExpandableCard
                title={t('settings.menu.start_time.title', lang)}
                value={localData.start_time}
                icon="time-outline"
                themeColors={themeColors}
                isExpanded={isTimeExpanded}
                onToggle={toggleTimeExpand}
                hideChevronOnAndroid={true}
              >
                {Platform.OS === 'android' ? (
                  <DateTimePicker value={timeDate} mode="time" is24Hour={true} display="default" onChange={(event, date) => { setIsTimeExpanded(false); if (event.type === 'set' && date) setLocalData(prev => ({ ...prev, start_time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` })); }} />
                ) : (
                  <View style={[styles.timePickerContainer, { borderTopColor: themeColors.borderColor }]}>
                    {Platform.OS !== 'web' ? (
                      <DateTimePicker value={timeDate} mode="time" is24Hour={true} display="spinner" onChange={(event, date) => { if (date) setLocalData(prev => ({ ...prev, start_time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` })); }} textColor={themeColors.textColor} style={{ height: 160, width: '100%' }} />
                    ) : (
                      <View style={{ padding: 20, width: '100%', alignItems: 'center' }}>
                        {React.createElement('input', { type: 'time', value: timeValue, onChange: (e) => setLocalData(prev => ({ ...prev, start_time: e.target.value })), style: { fontSize: 24, padding: 12, borderRadius: 12, width: '80%', textAlign: 'center', border: `1px solid ${themeColors.borderColor}`, backgroundColor: themeColors.backgroundColor, color: themeColors.textColor } })}
                      </View>
                    )}
                  </View>
                )}
              </ExpandableCard>
            </View>

            <View onLayout={e => cardYs.current['breaks'] = e.nativeEvent.layout.y}>
              <ExpandableCard
                title={t('settings.menu.breaks.title', lang)}
                value={`${localData.breaks.length}`}
                icon="cafe-outline"
                themeColors={themeColors}
                isExpanded={isBreaksExpanded}
                onToggle={toggleBreaksExpand}
              >
                <View style={styles.breaksExpandedContent}>
                  {localData.breaks.map((brk, idx) => (
                    <View key={`break-${idx}`} style={[styles.breakRow, { borderBottomColor: themeColors.borderColor }]}>
                      <Text style={[styles.breakRowLabel, { color: themeColors.textColor }]}>{t('schedule.day_schedule.break', lang)} {idx + 1}</Text>
                      
                      <View style={styles.breakActions}>
                        <View style={[styles.breakInputWrapper, { backgroundColor: themeColors.accentColor + '15' }]}>
                          <TextInput 
                            style={[styles.breakRowInput, { color: themeColors.accentColor }]} 
                            value={String(brk)} 
                            onChangeText={(t) => handleBreakChange(t, idx)} 
                            keyboardType="number-pad" 
                            maxLength={3} 
                            selectTextOnFocus 
                            onFocus={() => scrollToElement('time', 'breaks', 60 + (idx * 56), 300)}
                          />
                          <Text style={[styles.breakRowMin, { color: themeColors.accentColor }]}>{t('schedule.main_screen.minutes', lang)}</Text>
                        </View>

                        {localData.breaks.length > 1 && (
                          <TouchableOpacity 
                            onPress={() => handleRemoveBreak(idx)} 
                            style={styles.trashBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity 
                    style={[styles.addBreakBtn, { borderColor: themeColors.accentColor, backgroundColor: themeColors.accentColor + '0A' }]} 
                    onPress={handleAddBreak} 
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={themeColors.accentColor} />
                    <Text style={[styles.addBreakText, { color: themeColors.accentColor }]}>{t('settings.breaks_manager.add_btn', lang)}</Text>
                  </TouchableOpacity>
                </View>
              </ExpandableCard>
            </View>

          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <CalendarSheet 
        visible={isCalendarVisible} 
        onClose={() => setCalendarVisible(false)} 
        currentDate={new Date(localData.starting_week)} 
        customSchedule={{
          ...localData,
          repeat: Math.max(1, Number(localData.repeat) || 1)
        }}
        onDateSelect={(date) => { 
          setLocalData(prev => ({ ...prev, starting_week: date.toISOString() })); 
          setCalendarVisible(false); 
        }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1 }, scrollContent: { padding: 16 }, section: { marginBottom: 24 }, sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }, inputContainer: { height: 52, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth }, input: { fontSize: 16, fontWeight: '500', height: '100%' }, 
  dateCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth }, dateCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, dateCardTextContainer: { flex: 1 }, dateCardDay: { fontSize: 17, fontWeight: '600', marginBottom: 2 }, dateCardDate: { fontSize: 14 }, 
  timePickerContainer: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 16, overflow: 'hidden' }, 
  breaksExpandedContent: { paddingBottom: 4 }, 
  breakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth }, 
  breakRowLabel: { fontSize: 16, fontWeight: '500' }, 
  breakActions: { flexDirection: 'row', alignItems: 'center' },
  breakInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 10, marginRight: 8 }, 
  breakRowInput: { fontSize: 16, fontWeight: '700', textAlign: 'center', minWidth: 30 }, 
  breakRowMin: { fontSize: 14, fontWeight: '600', marginLeft: 2, opacity: 0.8 }, 
  trashBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF3B3015', justifyContent: 'center', alignItems: 'center' },
  addBreakBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' }, 
  addBreakText: { fontSize: 15, fontWeight: '600', marginLeft: 8 }
});