import React, { useState, useMemo, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, useWindowDimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider"; //
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes"; //
import GradientBackground from "../../../components/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";

// --- ЛОГІКА ТАЙМЕРА ---
const getTimerState = (startStr, endStr, isToday) => {
  if (!isToday || !startStr || !endStr) return { isActive: false, timeLeft: null };

  const now = new Date();
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  
  const startDate = new Date(); startDate.setHours(startH, startM, 0, 0);
  const endDate = new Date(); endDate.setHours(endH, endM, 0, 0);

  if (now >= startDate && now < endDate) {
    const totalSeconds = Math.floor((endDate - now) / 1000);
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

// --- КОМПОНЕНТ ---
const LessonCard = React.memo(({ lesson, onPress, onLongPress }) => {
  const { width: screenWidth } = useWindowDimensions();
  const { schedule, global } = useSchedule();
  const { isToday } = useDaySchedule(); 
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const isLightTheme = mode === 'light'; // 🔥 Перевірка теми для тіней

  const { subjects = [], teachers = [], gradients = [] } = schedule || {};
  const subject = subjects.find((s) => s.id === lesson.subjectId) || {};
  const teacher = teachers.find((t) => t.id === subject.teacher) || {};
  const MainIcon = getIconComponent(subject.icon);

  const { timeLeft, isActive } = useLessonTimer(lesson?.timeInfo?.start, lesson?.timeInfo?.end, isToday);
  const iconOpacity = useRef(new Animated.Value(0)).current;

  // Радіус картки
  const CARD_RADIUS = 29;

  useEffect(() => {
    Animated.timing(iconOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // 1. Динамічний стиль тіні (Тільки для світлої теми)
  const shadowStyle = useMemo(() => {
    if (isLightTheme) {
      return Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: {
          elevation: 5,
          shadowColor: "#000",
        },
        web: {
          boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
        }
      });
    }
    // Для темної теми тінь вимикаємо
    return Platform.select({
      android: { elevation: 0 },
      web: { boxShadow: 'none' },
      ios: { shadowOpacity: 0 }
    });
  }, [isLightTheme]);

  // 2. Шар Фону
  const BackgroundLayer = useMemo(() => {
    const bgStyle = { ...StyleSheet.absoluteFillObject, borderRadius: CARD_RADIUS };

    if (subject?.typeColor === "gradient" && subject?.colorGradient) {
      const grad = gradients.find((g) => g.id === subject.colorGradient);
      if (grad) return <GradientBackground gradient={grad} style={bgStyle} />;
    }
    
    const color = themes.accentColors[subject?.color] || subject?.color || themes.accentColors.grey;
    return <View style={[bgStyle, { backgroundColor: color }]} />;
  }, [subject, gradients]);

  // 3. Шар Патерну (Іконки)
  const PatternLayer = useMemo(() => {
    if (!MainIcon) return null;
    
    const size = 45; 
    const cols = Math.ceil(screenWidth / size) + 1; 
    const icons = [];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          icons.push(
            <MainIcon
              key={`${r}-${c}`}
              size={26}
              color="white"
              style={{
                position: 'absolute',
                top: r * size + 10,
                left: c * size + 10,
                opacity: 0.5,
                transform: [{ rotate: '-10deg' }]
              }}
              strokeWidth={2.5}
            />
          );
        }
      }
    }
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: iconOpacity, borderRadius: CARD_RADIUS, overflow: 'hidden' }]} pointerEvents="none">
        {icons}
      </Animated.View>
    );
  }, [screenWidth, MainIcon]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.({ ...lesson, subject, teacher })}
      onLongPress={() => onLongPress?.({ ...lesson, subject, teacher })}
      delayLongPress={200}
      style={[
        styles.cardShadowWrapper,
        shadowStyle, // 🔥 Застосовуємо умовну тінь
        { 
          borderRadius: CARD_RADIUS,
        }
      ]}
    >
      <View style={[
        styles.innerContainer, 
        { 
          borderRadius: CARD_RADIUS,
          // У світлій темі бордер не потрібен, якщо є тінь. У темній - потрібен для контрасту.
          // Якщо активна пара - завжди білий.
          borderColor: isActive ? '#fff' : (isLightTheme ? 'transparent' : 'rgba(255,255,255,0.1)'),
          borderWidth: isActive ? 2 : 1,
          backgroundColor: themeColors.backgroundColor2,
        }
      ]}>
        
        {BackgroundLayer}
        {PatternLayer}

        <View style={styles.content}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
              <Ionicons name={isActive ? "hourglass-outline" : "time"} size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>
                {isActive ? `Залишилось ${timeLeft}` : `${lesson?.timeInfo?.start} - ${lesson?.timeInfo?.end}`}
              </Text>
            </View>

            {subject.type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{subject.type}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 4 }}>
            <Text style={styles.title} numberOfLines={2}>
              {subject?.name || "Предмет"}
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.infoBadge}>
              <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" style={{ marginRight: 4 }} />
              <Text style={styles.infoText} numberOfLines={1}>{teacher?.name || "—"}</Text>
            </View>

            {(subject.room || subject.building) && (
              <View style={[styles.infoBadge, { marginLeft: 8 }]}>
                <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" style={{ marginRight: 4 }} />
                <Text style={styles.infoText}>{subject.building} {subject.room}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default LessonCard;

const styles = StyleSheet.create({
  // Зовнішній контейнер для тіні та відступів
  cardShadowWrapper: {
    marginBottom: 14,
    // Тіні тут видалені, вони додаються динамічно через shadowStyle
    backgroundColor: 'transparent',
  },
  // Внутрішній контейнер
  innerContainer: {
    minHeight: 110,
    overflow: 'hidden', 
    position: 'relative',
  },
  content: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeInactive: { backgroundColor: 'rgba(0,0,0,0.35)' },
  badgeActive: { backgroundColor: '#27ae60' },
  
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  
  typeBadge: { 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.4)' 
  },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#fff', 
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.3)', 
    textShadowOffset: { width: 0, height: 1 }, 
    textShadowRadius: 2 
  },
  
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  infoText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});