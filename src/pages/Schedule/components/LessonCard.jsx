import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import useSystemThemeColors from "../../../hooks/useSystemThemeColors";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";

const CELL_SIZE = 38;
const ICON_SIZE = 18;
const CARD_BORDER_RADIUS = 18;

const isLightColor = (color) => {
  if (!color || typeof color !== 'string') return true;
  
  let r = 255, g = 255, b = 255;

  try {
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        r = parseInt(match[0], 10);
        g = parseInt(match[1], 10);
        b = parseInt(match[2], 10);
      }
    } else {
      let hex = color.replace('#', '');
      if (hex.length === 3 || hex.length === 4) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 2), 16);
        b = parseInt(hex.substring(4, 2), 16);
      }
    }
  } catch (e) {
     return true; 
  }
  
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 160;
};

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

function useLessonData(lesson, schedule) {
  return useMemo(() => {
    const { subjects = [], teachers = [], gradients = [] } = schedule || {};
    const subject = subjects.find((s) => s.id === lesson?.subjectId) || {};
    const instanceData = lesson?.data || {};

    const teacherId = instanceData.teachers?.[0] || instanceData.teacher || subject.teachers?.[0] || subject.teacher;
    const teacher = teachers.find((t) => t.id === teacherId) || {};
    
    let subjectColor = themes.accentColors[subject?.color] || subject?.color || themes.accentColors.grey;
    let activeGrad = null;

    if (subject?.typeColor === "gradient" && subject?.colorGradient) {
      activeGrad = gradients.find((g) => g.id === subject.colorGradient);
      if (activeGrad && activeGrad.colors && activeGrad.colors.length > 0) {
        subjectColor = activeGrad.colors[0] || subjectColor; 
      }
    }

    return {
      subject,
      teacher,
      displayType: instanceData.type || subject.type,
      displayRoom: instanceData.room || subject.room,
      displayBuilding: instanceData.building || subject.building,
      MainIcon: getIconComponent(subject.icon),
      activeGrad,
      subjectColor
    };
  }, [lesson, schedule]);
}

const ActiveHighlight = React.memo(({ isActive, isDark }) => {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true })
        ])
      ).start();
    } else {
      opacityAnim.setValue(0);
    }
  }, [isActive]);

  if (!isActive) return null;

  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.6)';

  return (
    <Animated.View 
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { 
          borderRadius: CARD_BORDER_RADIUS,
          borderWidth: 3.5, 
          borderColor: highlightColor,
          opacity: opacityAnim,
          zIndex: 10,
        },
        Platform.OS === 'web' && {
          borderWidth: 0,
          boxShadow: `inset 0px 0px 0px 3.5px ${highlightColor}, inset 0px 0px 24px ${highlightColor}`
        }
      ]}
    />
  );
});

const BackgroundPattern = React.memo(({ MainIcon, width, height }) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (MainIcon && width > 0 && height > 0) {
      opacityAnim.setValue(0);
      Animated.timing(opacityAnim, { 
        toValue: 1, 
        duration: 350, 
        useNativeDriver: Platform.OS !== 'web' 
      }).start();
    }
  }, [MainIcon, width, height]);

  if (!MainIcon || width === 0 || height === 0) return null;

  const icons = [];
  const startX = (width % CELL_SIZE) / 2 - CELL_SIZE;
  const startY = (height % CELL_SIZE) / 2 - CELL_SIZE;

  let r = 0;
  for (let y = startY; y < height; y += CELL_SIZE) {
    let c = 0;
    for (let x = startX; x < width; x += CELL_SIZE) {
      if ((r + c) % 2 === 0) {
        const iconTop = y + (CELL_SIZE - ICON_SIZE) / 2;
        const iconLeft = x + (CELL_SIZE - ICON_SIZE) / 2;
        
        const isVisible = (
          iconLeft + ICON_SIZE > 0 && 
          iconLeft < width && 
          iconTop + ICON_SIZE > 0 && 
          iconTop < height
        );

        if (isVisible) {
          icons.push(
            <View 
              key={`${r}-${c}`} 
              style={[
                styles.patternIconWrapper, 
                { top: iconTop, left: iconLeft }
              ]}
            >
              <MainIcon 
                size={ICON_SIZE} 
                color="white" 
                strokeWidth={2} 
                style={Platform.OS === 'web' ? { overflow: 'visible' } : {}}
              />
            </View>
          );
        }
      }
      c++;
    }
    r++;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: opacityAnim, zIndex: 0 }]} pointerEvents="none">
      {icons}
    </Animated.View>
  );
});

const LessonCardPure = React.memo(({ lesson, schedule, isToday, isDark, onPress, onLongPress }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const { 
    subject, teacher, displayType, displayRoom, displayBuilding, MainIcon, activeGrad, subjectColor
  } = useLessonData(lesson, schedule);

  const { timeLeft, isActive } = useLessonTimer(lesson?.timeInfo?.start, lesson?.timeInfo?.end, isToday);

  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions(prev => {
      if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) return prev;
      return { width, height };
    });
  }, []);

  const handlePress = () => onPress?.({ ...lesson, subject, teacher, displayType, displayRoom, displayBuilding });
  const handleLongPress = () => onLongPress?.({ ...lesson, subject, teacher });

  const activePillBg = isDark ? '#ffffff' : '#111111';
  let activePillText = isDark ? '#111111' : '#ffffff';

  let primaryColor = subjectColor;
  if (activeGrad?.colors && activeGrad.colors.length > 0) {
      primaryColor = activeGrad.colors[0];
  }

  if (isDark) {
    if (!isLightColor(primaryColor)) {
      activePillText = primaryColor;
    } else if (activeGrad?.colors) {
      const darkColor = activeGrad.colors.find(c => !isLightColor(c));
      if (darkColor) activePillText = darkColor;
    }
  } else {
    if (isLightColor(primaryColor)) {
      activePillText = primaryColor;
    } else if (activeGrad?.colors) {
      const lightColor = activeGrad.colors.find(c => isLightColor(c));
      if (lightColor) activePillText = lightColor;
    }
  }

  return (
    <TouchableOpacity
      style={[styles.cardContainer, { backgroundColor: subjectColor }]} 
      activeOpacity={0.85}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      onLayout={onLayout}
    >
      <View style={styles.backgroundWrapper}>
        {activeGrad && <GradientBackground gradient={activeGrad} style={StyleSheet.absoluteFillObject} />}
        <BackgroundPattern 
          MainIcon={MainIcon} 
          width={dimensions.width} 
          height={dimensions.height} 
        />
      </View>

      <ActiveHighlight isActive={isActive} isDark={isDark} />

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          
          <View style={[styles.timeContainer, isActive && { backgroundColor: activePillBg }]}>
            <View style={styles.iconFixedContainer}>
                <Ionicons 
                  name={isActive ? "hourglass-outline" : "time"} 
                  size={11} 
                  color={isActive ? activePillText : "#fff"} 
                />
            </View>
            <Text style={[styles.timeText, isActive && { color: activePillText }]}>
              {isActive ? `Залишилось ${timeLeft}` : `${lesson?.timeInfo?.start || "—"} - ${lesson?.timeInfo?.end || "—"}`}
            </Text>
          </View>

          {!!displayType && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{displayType}</Text>
            </View>
          )}
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.subjectTitle} numberOfLines={1}>
            {subject?.name || "Предмет"}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerItem}>
            <View style={styles.iconFixedContainer}>
                <Ionicons name="person" size={11} color="rgba(255,255,255,0.85)" />
            </View>
            <Text style={styles.footerText} numberOfLines={1}>{teacher?.name || "—"}</Text>
          </View>

          {!!(displayRoom || displayBuilding) && (
            <View style={styles.footerItem}>
              <View style={styles.iconFixedContainer}>
                  <Ionicons name="location" size={11} color="rgba(255,255,255,0.85)" />
              </View>
              <Text style={styles.footerText} numberOfLines={1}>
                  {displayBuilding ? `${displayBuilding} ` : ''}{displayRoom}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function LessonCard(props) {
  const { schedule } = useSchedule();
  const { isToday } = useDaySchedule();
  const { isDark } = useSystemThemeColors();

  return <LessonCardPure {...props} schedule={schedule} isToday={isToday} isDark={isDark} />;
}

const styles = StyleSheet.create({
  cardContainer: { 
    marginBottom: 8, 
    minHeight: 90, 
    position: 'relative',
    borderRadius: CARD_BORDER_RADIUS,
    ...Platform.select({ 
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' }, 
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 } 
    }) 
  },
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden', 
    zIndex: 1,
  },
  patternIconWrapper: {
    position: 'absolute', 
    width: ICON_SIZE,
    height: ICON_SIZE,
    opacity: 0.25, 
    transform: [{ rotate: '-12deg' }],
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardContent: { 
    paddingVertical: 10, 
    paddingHorizontal: 12,
    flex: 1, 
    justifyContent: 'space-between', 
    zIndex: 20 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 2 
  },
  timeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.35)', 
    paddingVertical: 2, 
    paddingHorizontal: 6, 
    borderRadius: 6 
  },
  iconFixedContainer: { 
    width: 12, 
    height: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 3 
  },
  timeText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700', 
    fontVariant: ['tabular-nums'] 
  },
  typeBadge: { 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 5, 
    paddingVertical: 1, 
    borderRadius: 5, 
    borderWidth: 0.5, 
    borderColor: 'rgba(255,255,255,0.3)' 
  },
  typeText: { 
    color: '#fff', 
    fontSize: 8, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.3 
  },
  mainInfo: { 
    marginVertical: 2 
  },
  subjectTitle: { 
    fontSize: 17, 
    fontWeight: '800', 
    color: '#fff', 
    ...Platform.select({ 
      web: { textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }, 
      default: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } 
    }) 
  },
  footerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 2 
  },
  footerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginRight: 10, 
    backgroundColor: 'rgba(0,0,0,0.15)', 
    paddingHorizontal: 5, 
    paddingVertical: 2, 
    borderRadius: 5,
    maxWidth: '55%'
  },
  footerText: { 
    color: 'rgba(255,255,255,0.9)', 
    fontSize: 10, 
    fontWeight: '600' 
  },
});