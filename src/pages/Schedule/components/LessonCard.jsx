import React, { useState, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";

// Розмір комірки (зменшив до 45 для щільнішого візерунку)
const CELL_SIZE = 45;

export default function LessonCard({ lesson, onPress }) {
  const { schedule } = useSchedule();
  const { subjects = [], teachers = [], gradients = [] } = schedule || {};

  const subject = subjects.find((s) => s.id === lesson.subjectId) || {};
  const teacher = teachers.find((t) => t.id === subject.teacher) || {};

  const MainIcon = getIconComponent(subject.icon);

  // Стейт розмірів картки
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  };

  // --- Фон ---
  let backgroundContent;
  if (subject?.typeColor === "gradient" && subject?.colorGradient) {
    const grad = gradients.find((g) => g.id === subject.colorGradient);
    if (grad) {
      backgroundContent = <GradientBackground gradient={grad} style={StyleSheet.absoluteFill} />;
    }
  } else {
    const subjectColor = themes.accentColors[subject?.color] || subject?.color || themes.accentColors.grey;
    backgroundContent = <View style={[StyleSheet.absoluteFill, { backgroundColor: subjectColor }]} />;
  }

  // --- Шахова сітка іконок ---
  const patternContent = useMemo(() => {
    if (layout.width === 0 || !MainIcon) return null;

    // 1. Рахуємо кількість колонок і рядків
    // Додаємо +1 про запас, щоб не було порожніх країв
    const cols = Math.ceil(layout.width / CELL_SIZE) + 1;
    const rows = Math.ceil(layout.height / CELL_SIZE) + 1;

    // Генеруємо масиви індексів
    const rowIndices = Array.from({ length: rows }, (_, i) => i);
    const colIndices = Array.from({ length: cols }, (_, i) => i);

    return (
      <View style={styles.patternContainer}>
        {rowIndices.map((rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.patternRow}>
            {colIndices.map((colIndex) => {
              
              // 2. Логіка зсуву: (ряд + колонка) % 2
              // Це створює ефект шахівниці:
              // Ряд 0: [Icon] [ ] [Icon] [ ]
              // Ряд 1: [ ] [Icon] [ ] [Icon]
              const shouldRender = (rowIndex + colIndex) % 2 === 0;

              if (!shouldRender) {
                // Рендеримо пустий блок для збереження сітки
                return <View key={`col-${colIndex}`} style={styles.cell} />;
              }

              return (
                <View key={`col-${colIndex}`} style={styles.cell}>
                  <MainIcon 
                    size={26} 
                    color="white" 
                    style={{ 
                      opacity: 0.5, // Прозорість
                      transform: [{ rotate: '-10deg' }] // 3. Нахил самої іконки
                    }} 
                    strokeWidth={2.5}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [layout.width, layout.height, MainIcon]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress({ ...lesson, subject, teacher })}
      onLayout={handleLayout} // Вимірюємо розмір
    >
      {backgroundContent}
      
      {/* Контейнер патерну (абсолютно поверх фону, але під текстом) */}
      <View style={styles.patternOverlay}>
        {patternContent}
      </View>

      <View style={styles.cardContent}>
        
        {/* Верхній рядок */}
        <View style={styles.headerRow}>
          <View style={styles.timeContainer}>
            <Ionicons name="time" size={14} color="#fff" style={{ marginRight: 4, opacity: 0.9 }} />
            <Text style={styles.timeText}>
              {lesson?.timeInfo?.start} - {lesson?.timeInfo?.end}
            </Text>
          </View>

          {subject.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{subject.type}</Text>
            </View>
          )}
        </View>

        {/* Назва */}
        <View style={styles.mainInfo}>
          <Text style={styles.subjectTitle} numberOfLines={2}>
            {subject?.name || "Предмет"}
          </Text>
        </View>

        {/* Низ */}
        <View style={styles.footerRow}>
          <View style={styles.footerItem}>
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.footerText} numberOfLines={1}>
              {teacher?.name || "—"}
            </Text>
          </View>

          {(subject.room || subject.building) && (
            <View style={styles.footerItem}>
              <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.footerText}>
                {subject.building} {subject.room}
              </Text>
            </View>
          )}
        </View>

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 25,
    marginBottom: 14,
    minHeight: 110,
    overflow: "hidden", // Обрізає все, що виходить за межі
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  
  // --- Патерн ---
  patternOverlay: {
    ...StyleSheet.absoluteFillObject, // Займає всю картку
    zIndex: 0, 
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  patternContainer: {
    // Не крутимо контейнер!
    // Просто центруємо його, якщо він трохи більший
  },
  patternRow: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Контент ---
  cardContent: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1, // Текст вище за патерн
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', // Підкладка
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  typeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainInfo: {
    marginVertical: 6,
  },
  subjectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', 
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.25)', 
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  footerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});