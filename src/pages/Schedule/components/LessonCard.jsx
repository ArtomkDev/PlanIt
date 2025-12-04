import React, { useState, useMemo, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";

// Константи
const CELL_SIZE = 45;
const ICON_SIZE = 26;
const CARD_BORDER_RADIUS = 24;
const ROWS = 4; // Фіксована висота візерунка, достатня для картки

// Допоміжні функції (винесені для швидкості)
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
    return { 
      isActive: true, 
      timeLeft: `${m}:${s < 10 ? '0' : ''}${s}` 
    };
  }
  return { isActive: false, timeLeft: null };
};

/**
 * Хук таймера
 */
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

const LessonCard = React.memo(({ lesson, onPress }) => {
  const { schedule } = useSchedule();
  const { isToday } = useDaySchedule(); 
  
  // ⚡️ РЕАКТИВНІСТЬ: Отримуємо ширину екрану динамічно.
  // Це змусить компонент перерендеритись при зміні розміру вікна браузера.
  const { width: screenWidth } = useWindowDimensions();

  const { subjects = [], teachers = [], gradients = [] } = schedule || {};
  const subject = subjects.find((s) => s.id === lesson.subjectId) || {};
  const teacher = teachers.find((t) => t.id === subject.teacher) || {};
  const MainIcon = getIconComponent(subject.icon);

  const { timeLeft, isActive } = useLessonTimer(
    lesson?.timeInfo?.start, 
    lesson?.timeInfo?.end, 
    isToday
  );

  // ⚡️ Анімація для ПЛАВНОЇ появи іконок (Fade In)
  const iconOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Запускаємо анімацію появи відразу при монтуванні
    Animated.timing(iconOpacity, {
      toValue: 1,
      duration: 400, // Швидкий фейд (0.4с)
      useNativeDriver: true,
    }).start();
  }, []);

  // --- Фон ---
  const backgroundStyle = { 
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_BORDER_RADIUS 
  };

  let backgroundContent;
  if (subject?.typeColor === "gradient" && subject?.colorGradient) {
    const grad = gradients.find((g) => g.id === subject.colorGradient);
    if (grad) {
      backgroundContent = <GradientBackground gradient={grad} style={backgroundStyle} />;
    }
  } else {
    const subjectColor = themes.accentColors[subject?.color] || subject?.color || themes.accentColors.grey;
    backgroundContent = <View style={[backgroundStyle, { backgroundColor: subjectColor }]} />;
  }

  // --- ДИНАМІЧНИЙ ПАТЕРН ---
  const patternContent = useMemo(() => {
    if (!MainIcon) return null;

    // Рахуємо колонки динамічно на основі screenWidth
    const cols = Math.ceil(screenWidth / CELL_SIZE) + 1;
    const icons = [];
    const offset = (CELL_SIZE - ICON_SIZE) / 2;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          icons.push(
            <MainIcon
              key={`${r}-${c}`}
              size={ICON_SIZE}
              color="white"
              style={{
                position: 'absolute',
                top: r * CELL_SIZE + offset,
                left: c * CELL_SIZE + offset,
                opacity: 0.5,
                transform: [{ rotate: '-10deg' }]
              }}
              strokeWidth={2.5}
            />
          );
        }
      }
    }
    
    // Обгортаємо в Animated.View для плавної появи
    return (
      <Animated.View 
        style={[styles.patternOverlay, { opacity: iconOpacity }]} 
        pointerEvents="none"
      >
        {icons}
      </Animated.View>
    );
  }, [screenWidth, MainIcon]); // ⚡️ Перераховуємо, коли змінюється ширина

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]} 
      activeOpacity={0.9}
      onPress={() => onPress({ ...lesson, subject, teacher })}
    >
      {/* 1. Фон (миттєво) */}
      {backgroundContent}
      
      {/* 2. Візерунок (динамічний + плавний фейд) */}
      {patternContent}

      {/* 3. Контент (миттєво + стабільно завдяки iconFixedContainer) */}
      <View style={styles.cardContent}>
        
        <View style={styles.headerRow}>
          <View style={[styles.timeContainer, isActive && styles.timeContainerActive]}>
            <View style={styles.iconFixedContainer}>
                <Ionicons name={isActive ? "hourglass-outline" : "time"} size={14} color="#fff" style={{ opacity: 0.9 }} />
            </View>
            <Text style={styles.timeText}>
              {isActive ? `Залишилось ${timeLeft}` : `${lesson?.timeInfo?.start} - ${lesson?.timeInfo?.end}`}
            </Text>
          </View>

          {subject.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{subject.type}</Text>
            </View>
          )}
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.subjectTitle} numberOfLines={2}>
            {subject?.name || "Предмет"}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerItem}>
            <View style={styles.iconFixedContainer}>
                <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.footerText} numberOfLines={1}>{teacher?.name || "—"}</Text>
          </View>

          {(subject.room || subject.building) && (
            <View style={styles.footerItem}>
              <View style={styles.iconFixedContainer}>
                  <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={styles.footerText}>{subject.building} {subject.room}</Text>
            </View>
          )}
        </View>

      </View>
    </TouchableOpacity>
  );
});

export default LessonCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_BORDER_RADIUS,
    marginBottom: 14,
    minHeight: 110,
    overflow: "hidden", 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    
    // Тіні
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    backgroundColor: '#333', // Фолбек колір
  },
  cardActive: {
    borderColor: '#fff', 
    borderWidth: 2,
  },
  
  patternOverlay: {
    ...StyleSheet.absoluteFillObject, 
    zIndex: 0,
    overflow: 'hidden',
    borderRadius: CARD_BORDER_RADIUS,
  },

  cardContent: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2, 
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  
  timeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 8 
  },
  timeContainerActive: { 
    backgroundColor: '#27ae60', 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 2, 
    elevation: 2 
  },
  
  // Стабільний каркас для іконок
  iconFixedContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4, 
  },

  timeText: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  typeBadge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  mainInfo: { marginVertical: 6 },
  subjectTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  
  footerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginRight: 16, 
    backgroundColor: 'rgba(0,0,0,0.25)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  
  footerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});