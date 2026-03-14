import React, { useState, useMemo, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, useWindowDimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";

const CELL_SIZE = 45;
const ICON_SIZE = 26;
const CARD_BORDER_RADIUS = 28;
const ROWS = 4;

const parseTime = (timeStr) => {
  if (!timeStr) return new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const getTimerState = (startStr, endStr, isToday) => {
  if (!isToday || !startStr || !endStr) return { isActive: false, timeLeft: null };
  const now = new Date();
  const startDate = parseTime(startStr);
  const endDate = parseTime(endStr);
  if (now >= startDate && now < endDate) {
    const diffMs = endDate - now;
    const totalSeconds = Math.floor(diffMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return { isActive: true, timeLeft: `${m}:${s < 10 ? '0' : ''}${s}` };
  }
  return { isActive: false, timeLeft: null };
};

function useLessonTimer(startStr, endStr, isToday) {
  const [timerState, setTimerState] = useState(() => getTimerState(startStr, endStr, isToday));
  useEffect(() => {
    if (!isToday || !startStr || !endStr) return;
    const intervalId = setInterval(() => {
      setTimerState(getTimerState(startStr, endStr, isToday));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [startStr, endStr, isToday]);
  return timerState;
}

// КАСТОМНИЙ ХУК ДЛЯ АНІМАЦІЇ: Реагує на будь-яку зміну переданого значення
function useHighlightAnim(value) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      // При зміні: різко скидаємо масштаб та прозорість, потім пружинимо назад
      anim.setValue(0.3);
      Animated.spring(anim, {
        toValue: 1,
        friction: 5,     // Наскільки швидко згасає коливання
        tension: 60,     // Наскільки різкий відскок
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [value]);

  // Конвертуємо значення 0.3 -> 1.0 у красиві візуальні ефекти
  return {
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0.3, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };
}

const LessonCardPure = React.memo(({ lesson, schedule, isToday, screenWidth, onPress, onLongPress }) => {
  const { subjects = [], teachers = [], gradients = [] } = schedule || {};
  
  const subject = subjects.find((s) => s.id === lesson.subjectId) || {};
  const instanceData = lesson.data || {};

  let teacherId = null;
  if (Array.isArray(instanceData.teachers) && instanceData.teachers.length > 0) {
    teacherId = instanceData.teachers[0];
  } else if (instanceData.teacher) {
    teacherId = instanceData.teacher;
  } else if (Array.isArray(subject.teachers) && subject.teachers.length > 0) {
    teacherId = subject.teachers[0];
  } else {
    teacherId = subject.teacher;
  }
  const teacher = teachers.find((t) => t.id === teacherId) || {};

  const displayType = instanceData.type || subject.type;
  const displayRoom = instanceData.room || subject.room;
  const displayBuilding = instanceData.building || subject.building;

  const MainIcon = getIconComponent(subject.icon);

  const { timeLeft, isActive } = useLessonTimer(
    lesson?.timeInfo?.start, 
    lesson?.timeInfo?.end, 
    isToday
  );

  // Створюємо анімації для КОЖНОГО блоку даних
  const titleAnim = useHighlightAnim(subject?.name || "");
  const typeAnim = useHighlightAnim(displayType || "");
  const teacherAnim = useHighlightAnim(teacher?.name || "");
  const locationAnim = useHighlightAnim(`${displayBuilding || ""}-${displayRoom || ""}`);
  const timeAnim = useHighlightAnim(`${lesson?.timeInfo?.start || ""}-${lesson?.timeInfo?.end || ""}`);
  const bgAnim = useHighlightAnim(`${subject?.color || ""}-${subject?.colorGradient || ""}-${subject?.typeColor || ""}`);

  // Анімація для фонових піктограм (перезапускається при зміні іконки)
  const iconOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    iconOpacity.setValue(0);
    Animated.timing(iconOpacity, { 
      toValue: 1, 
      duration: 500, 
      useNativeDriver: Platform.OS !== 'web' 
    }).start();
  }, [subject?.icon]); // Додали залежність від іконки!

  const backgroundStyle = { ...StyleSheet.absoluteFillObject, borderRadius: CARD_BORDER_RADIUS };
  let backgroundContent;
  if (subject?.typeColor === "gradient" && subject?.colorGradient) {
    const grad = gradients.find((g) => g.id === subject.colorGradient);
    if (grad) backgroundContent = <GradientBackground gradient={grad} style={backgroundStyle} />;
  } else {
    const subjectColor = themes.accentColors[subject?.color] || subject?.color || themes.accentColors.grey;
    backgroundContent = <View style={[backgroundStyle, { backgroundColor: subjectColor }]} />;
  }

  const patternContent = useMemo(() => {
    if (!MainIcon) return null;
    const cols = Math.ceil(screenWidth / CELL_SIZE) + 1;
    const icons = [];
    const offset = (CELL_SIZE - ICON_SIZE) / 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          icons.push(
            <MainIcon key={`${r}-${c}`} size={ICON_SIZE} color="white" style={{ position: 'absolute', top: r * CELL_SIZE + offset, left: c * CELL_SIZE + offset, opacity: 0.5, transform: [{ rotate: '-10deg' }] }} strokeWidth={2.5} />
          );
        }
      }
    }
    return <Animated.View style={[styles.patternOverlay, { opacity: iconOpacity, pointerEvents: 'none' }]}>{icons}</Animated.View>;
  }, [screenWidth, MainIcon]);

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]} 
      activeOpacity={0.9}
      onPress={() => onPress && onPress({ ...lesson, subject, teacher, displayType, displayRoom, displayBuilding })}
      onLongPress={() => onLongPress && onLongPress({ ...lesson, subject, teacher })}
      delayLongPress={300}
    >
      {/* Фон тепер також реагує пульсацією на зміну кольору */}
      <Animated.View style={[StyleSheet.absoluteFillObject, bgAnim]}>
        {backgroundContent}
      </Animated.View>
      
      {patternContent}

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.timeContainer, isActive && styles.timeContainerActive, timeAnim]}>
            <View style={styles.iconFixedContainer}>
                <Ionicons name={isActive ? "hourglass-outline" : "time"} size={14} color="#fff" style={{ opacity: 0.9 }} />
            </View>
            <Text style={styles.timeText}>
              {isActive ? `Залишилось ${timeLeft}` : `${lesson?.timeInfo?.start} - ${lesson?.timeInfo?.end}`}
            </Text>
          </Animated.View>

          {!!displayType && (
            <Animated.View style={[styles.typeBadge, typeAnim]}>
              <Text style={styles.typeText}>{displayType}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.mainInfo}>
          <Animated.Text style={[styles.subjectTitle, titleAnim]} numberOfLines={2}>
            {subject?.name || "Предмет"}
          </Animated.Text>
        </View>

        <View style={styles.footerRow}>
          <Animated.View style={[styles.footerItem, teacherAnim]}>
            <View style={styles.iconFixedContainer}>
                <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.footerText} numberOfLines={1}>{teacher?.name || "—"}</Text>
          </Animated.View>

          {!!(displayRoom || displayBuilding) && (
            <Animated.View style={[styles.footerItem, locationAnim]}>
              <View style={styles.iconFixedContainer}>
                  <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={styles.footerText}>
                  {displayBuilding ? `${displayBuilding} ` : ''}{displayRoom}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function LessonCard(props) {
  const { schedule } = useSchedule();
  const { isToday } = useDaySchedule();
  const { width } = useWindowDimensions();

  return <LessonCardPure {...props} schedule={schedule} isToday={isToday} screenWidth={width} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_BORDER_RADIUS, marginBottom: 14, minHeight: 110, overflow: "hidden", borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', position: 'relative', backgroundColor: '#333', ...Platform.select({ web: { boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.2)' }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 } }) },
  cardActive: { borderColor: '#fff', borderWidth: 2 },
  patternOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 0, overflow: 'hidden', borderRadius: CARD_BORDER_RADIUS },
  cardContent: { padding: 16, flex: 1, justifyContent: 'space-between', zIndex: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  timeContainerActive: { backgroundColor: '#27ae60', ...Platform.select({ web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.3)' }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2 } }) },
  iconFixedContainer: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  timeText: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  typeBadge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  mainInfo: { marginVertical: 6 },
  subjectTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.3, ...Platform.select({ web: { textShadow: '0px 1px 4px rgba(0,0,0,0.6)' }, default: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } }) },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  footerItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  footerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});