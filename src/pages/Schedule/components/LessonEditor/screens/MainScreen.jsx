import React, { useState, useRef } from "react";
import { ScrollView, StyleSheet, View, Text, Platform, LayoutAnimation, UIManager, TouchableOpacity } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  BookOpen, 
  Tag, 
  Buildings, 
  MapPin, 
  User, 
  Link as LinkIcon, 
  Palette, 
  Image as ImageIcon, 
  Clock,
  Plus,
  ArrowsCounterClockwise
} from "phosphor-react-native";

import SettingsGroup from "../../../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../../../components/ui/SettingsKit/SettingsRow";

import GradientBackground from "../../../../../components/ui/GradientBackground";
import themes from "../../../../../config/themes";
import { getIconComponent } from "../../../../../config/subjectIcons"; 
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LessonEditorMainScreen({
  themeColors,
  selectedSubjectId,
  currentSubject,
  gradients,
  setActivePicker,
  onDirectEdit,
  onEditSubjectColor,
  getLabel,
  scopes,
  onScopeChange,
  getValueLabel,
  getArrayData,
  instanceData,
  defaultTime,
  onTimeChange,
  onClearSubject
}) {
  const { lang } = useSchedule();
  const [expandedField, setExpandedField] = useState(null);
  const scrollViewRef = useRef(null);

  const safeGetLabel = getLabel || ((type, val) => t('schedule.main_screen.not_defined', lang));

  const isCustomStart = instanceData?.startTime !== undefined;
  const isCustomEnd = instanceData?.endTime !== undefined;

  const currentStart = isCustomStart ? instanceData.startTime : defaultTime?.start;
  const currentEnd = isCustomEnd ? instanceData.endTime : defaultTime?.end;
  
  const isTimeModified = currentStart !== defaultTime?.start || currentEnd !== defaultTime?.end;

  const getDurationMinutes = (start, end) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  };
  
  const duration = getDurationMinutes(currentStart, currentEnd);

  const toggleExpand = (field) => {
    if (Platform.OS === 'android') {
        setExpandedField(field);
    } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedField(prev => {
            const nextField = prev === field ? null : field;
            if (nextField) {
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 250);
            }
            return nextField;
        });
    }
  };

  const renderTimeValue = (val, isHighlight) => (
    <Text style={{
        fontSize: 16,
        color: isHighlight ? themeColors.textColor : themeColors.textColor2,
        fontWeight: isHighlight ? '600' : '400'
    }}>
        {val || "—"}
    </Text>
  );

  const renderTimePicker = (field, currentValue) => {
    const timeValue = currentValue || "08:00";
    const [hours, minutes] = timeValue.split(":").map(Number);
    const date = new Date();
    date.setHours(isNaN(hours) ? 8 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

    if (Platform.OS === 'android') {
        return (
            <DateTimePicker
                value={date}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, selectedDate) => {
                    setExpandedField(null);
                    if (event.type === 'set' && selectedDate) {
                        const hh = String(selectedDate.getHours()).padStart(2, '0');
                        const mm = String(selectedDate.getMinutes()).padStart(2, '0');
                        onTimeChange(field, `${hh}:${mm}`);
                    }
                }}
            />
        );
    }

    return (
        <View style={[styles.timePickerContainer, { backgroundColor: themeColors.backgroundColor2, borderTopColor: themeColors.borderColor }]}>
            {Platform.OS !== 'web' ? (
                <DateTimePicker
                    value={date}
                    mode="time"
                    is24Hour={true}
                    display="spinner"
                    onChange={(event, selectedDate) => {
                        if (selectedDate) {
                            const hh = String(selectedDate.getHours()).padStart(2, '0');
                            const mm = String(selectedDate.getMinutes()).padStart(2, '0');
                            onTimeChange(field, `${hh}:${mm}`);
                        }
                    }}
                    textColor={themeColors.textColor}
                    style={{ height: 160, width: '100%' }}
                />
            ) : (
                <View style={{ padding: 20 }}>
                    {React.createElement('input', {
                        type: 'time',
                        value: timeValue,
                        onChange: (e) => onTimeChange(field, e.target.value),
                        style: { fontSize: 18, padding: 8, borderRadius: 8, border: `1px solid ${themeColors.borderColor}`, backgroundColor: themeColors.backgroundColor, color: themeColors.textColor }
                    })}
                </View>
            )}
        </View>
    );
  };

  const renderIconValue = () => {
    if (!currentSubject.icon) {
      return <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>{t('schedule.main_screen.none', lang)}</Text>;
    }
    const IconCmp = getIconComponent(currentSubject.icon);
    return IconCmp ? (
      <IconCmp size={20} color={themeColors.textColor2} weight="regular" />
    ) : (
      <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>{t('schedule.main_screen.none', lang)}</Text>
    );
  };

  const renderColorPreview = () => {
    if (currentSubject?.typeColor === "gradient" && currentSubject?.colorGradient) {
      const grad = gradients.find((g) => g.id === currentSubject.colorGradient);
      return grad ? <GradientBackground gradient={grad} style={styles.colorPreview} /> : null;
    }
    const color = themes.accentColors[currentSubject?.color] || currentSubject?.color || themes.accentColors.grey;
    return <View style={[styles.colorPreview, { backgroundColor: color }]} />;
  };

  const renderHeaderRight = (showScopeToggle, scope, onScopeChangeHandler, onAdd, onReset) => {
    const hasButtons = showScopeToggle || onAdd || onReset;
    if (!hasButtons) return null;

    return (
      <>
        {showScopeToggle && onScopeChangeHandler && (
          <TouchableOpacity
            style={[
              styles.headerActionButton,
              { 
                backgroundColor: scope === "local" ? themeColors.accentColor : themeColors.backgroundColor2, 
                paddingHorizontal: 10, 
                width: 'auto' 
              }
            ]}
            onPress={() => onScopeChangeHandler(scope === "local" ? "global" : "local")}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: scope === "local" ? "#fff" : themeColors.textColor }}>
              {scope === "local" ? t('schedule.lesson_editor.scope_local', lang) : t('schedule.lesson_editor.scope_global', lang)}
            </Text>
          </TouchableOpacity>
        )}

        {onAdd && (
          <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: themeColors.backgroundColor2 }]} onPress={onAdd} activeOpacity={0.7}>
            <Plus size={18} color={themeColors.textColor} weight="bold" />
          </TouchableOpacity>
        )}

        {onReset && (
          <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: themeColors.backgroundColor2 }]} onPress={onReset} activeOpacity={0.7}>
            <ArrowsCounterClockwise size={18} color={themeColors.textColor} weight="bold" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  if (!selectedSubjectId) {
    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <SettingsGroup 
          themeColors={themeColors} 
          title={t('schedule.main_screen.subject', lang)}
        >
          <SettingsRow
            label={t('schedule.main_screen.subject_name', lang)}
            value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
            onPress={() => setActivePicker("subject")}
            themeColors={themeColors}
            icon={BookOpen}
          />
        </SettingsGroup>
      </ScrollView>
    );
  }

  const { array: teachersArr } = getArrayData("teachers", "people");
  const { array: linksArr } = getArrayData("links", "materials");

  return (
    <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.scrollContent}>
      
      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.subject', lang)} 
        headerRight={renderHeaderRight(false, null, null, null, onClearSubject)}
      >
        <SettingsRow
          label={t('schedule.main_screen.subject_name', lang)}
          value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon={BookOpen}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.lesson_type_group', lang)}
        headerRight={renderHeaderRight(true, scopes.type, (s) => onScopeChange('type', s), null, null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.lesson_type_label', lang)}
          value={getValueLabel("type", "type", "type")}
          onPress={() => setActivePicker("type")}
          themeColors={themeColors}
          icon={Tag}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.location', lang)}
        headerRight={renderHeaderRight(true, scopes.location, (s) => onScopeChange('location', s), null, null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.building', lang)}
          value={getValueLabel("building", "text", "location")}
          onPress={() => setActivePicker("building")}
          themeColors={themeColors}
          icon={Buildings}
        />
        <SettingsRow
          label={t('schedule.main_screen.room', lang)}
          value={getValueLabel("room", "text", "location")}
          onPress={() => setActivePicker("room")}
          themeColors={themeColors}
          icon={MapPin}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.people', lang)}
        headerRight={renderHeaderRight(true, scopes.people, (s) => onScopeChange('people', s), () => setActivePicker('teacher', teachersArr.length), null)}
      >
        {teachersArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   {t('schedule.main_screen.no_teachers', lang)}
               </Text>
           </View>
        ) : (
            teachersArr.map((id, index) => (
                <SettingsRow
                    key={`teacher-${id}`}
                    label={`${t('schedule.main_screen.teacher', lang)} ${index + 1}`}
                    value={safeGetLabel("teacher", id)}
                    onPress={() => setActivePicker("teacher", index)}
                    onLongPress={() => onDirectEdit("teacher", id, index)} 
                    themeColors={themeColors}
                    icon={User}
                />
            ))
        )}
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.materials', lang)}
        headerRight={renderHeaderRight(true, scopes.materials, (s) => onScopeChange('materials', s), () => setActivePicker('link', linksArr.length), null)}
      >
        {linksArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   {t('schedule.main_screen.no_links', lang)}
               </Text>
           </View>
        ) : (
            linksArr.map((id, index) => (
                <SettingsRow
                    key={`link-${id}`}
                    label={`${t('schedule.main_screen.link', lang)} ${index + 1}`}
                    value={safeGetLabel("link", id)}
                    onPress={() => setActivePicker("link", index)}
                    onLongPress={() => onDirectEdit("link", id, index)} 
                    themeColors={themeColors}
                    icon={LinkIcon}
                />
            ))
        )}
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.appearance', lang)}
      >
        <SettingsRow
          label={t('schedule.main_screen.card_color', lang)}
          rightContent={renderColorPreview()}
          onPress={onEditSubjectColor} 
          themeColors={themeColors}
          icon={Palette}
        />
        <SettingsRow
          label={t('schedule.main_screen.subject_icon', lang)}
          rightContent={renderIconValue()}
          onPress={() => setActivePicker("icon")}
          themeColors={themeColors}
          icon={ImageIcon}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.time', lang) || "Час заняття"} 
        headerRight={renderHeaderRight(false, null, null, null, isTimeModified ? () => {
            onTimeChange("startTime", null);
            onTimeChange("endTime", null);
        } : null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.start_time', lang) || "Початок"}
          rightContent={renderTimeValue(currentStart, isTimeModified)}
          onPress={() => toggleExpand("startTime")}
          themeColors={themeColors}
          icon={Clock}
        />
        {expandedField === "startTime" && renderTimePicker("startTime", currentStart)}

        <SettingsRow
          label={t('schedule.main_screen.end_time', lang) || "Кінець"}
          rightContent={renderTimeValue(currentEnd, isTimeModified)}
          onPress={() => toggleExpand("endTime")}
          themeColors={themeColors}
          icon={Clock}
        />
        {expandedField === "endTime" && renderTimePicker("endTime", currentEnd)}

        <View style={styles.durationContainer}>
          <Text style={[styles.durationText, { color: themeColors.textColor }]}>
            {duration ? `${duration} ${t('schedule.main_screen.minutes', lang)}` : "—"}
          </Text>
        </View>
      </SettingsGroup>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  scrollContent: { paddingBottom: 40 },
  headerActionButton: {
    width: 34,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  timePickerContainer: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingBottom: 16,
  },
  durationContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorPreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  emptyContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
  }
});