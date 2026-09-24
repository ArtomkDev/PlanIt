import React, { useState, useMemo, useEffect, useRef, useCallback, useId } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, Platform } from "react-native";
import { Clock, Hourglass, User, MapPin } from "phosphor-react-native";
import Svg, { Defs, G, Use, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { cancelAnimation, createAnimatedComponent, Easing, runOnJS, useAnimatedProps, useAnimatedReaction, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useNowTick } from "../../../hooks/useNowTick";
import useSystemThemeColors from "../../../hooks/useSystemThemeColors";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/ui/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";
import { triggerHaptic } from "../../../utils/haptics";
import { t } from "../../../utils/i18n";
import {
  colorWithAlpha,
  getGradientColor,
  getGradientColors,
  getReadableForeground,
  isLightForeground,
  resolveValidColor,
} from "../../../utils/gradientColors";

const ICON_SIZE = 18;
const PATTERN_ICON_OPACITY = 0.2;
const CARD_BORDER_RADIUS = 18;
const PATTERN_REVEAL_DURATION = 1000;
const PATTERN_CARD_STAGGER = 180;
const PATTERN_WAVE_SOFTNESS = 0.8;
const AnimatedWaveGradient = createAnimatedComponent(LinearGradient);

const getPatternPositions = (width, height) => {
  if (width < 52 || height < 52) return [];
  const columns = Math.floor((width - 52) / 46) + 1;
  const rows = Math.floor((height - 52) / 38) + 1;
  const positions = [];
  for (let row = 0; row < rows; row += 1) {
    const count = Math.max(1, columns - row % 2);
    const top = (height - (rows - 1) * 38 - ICON_SIZE) / 2 + row * 38;
    const start = (width - (count - 1) * 46 - ICON_SIZE) / 2;
    for (let column = 0; column < count; column += 1) {
      positions.push({
        key: `${row}-${column}`,
        left: start + column * 46,
        top,
        angle: (row + column) % 2 ? 8 : -8,
      });
    }
  }
  return positions;
};

function getTimerState(startStr, endStr, targetDate, nowValue) {
  if (!startStr || !endStr || !targetDate) return { isActive: false, timeLeft: null };
  
  if (!nowValue) return { isActive: false, timeLeft: null };
  const now = new Date(nowValue);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays !== 0 && diffDays !== 1) return { isActive: false, timeLeft: null };
  
  const [sH, sM] = startStr.split(":").map(Number);
  const [eH, eM] = endStr.split(":").map(Number);
  
  let startMins = sH * 60 + sM;
  let endMins = eH * 60 + eM;
  if (endMins < startMins) endMins += 24 * 60;
  
  let currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  
  if (diffDays === 1) {
     if (startMins >= 12 * 60 && currentMins < 12 * 60) {
         currentMins += 24 * 60;
     } else {
         return { isActive: false, timeLeft: null };
     }
  }
  
  if (currentMins >= startMins && currentMins < endMins) {
     const diff = endMins - currentMins;
     const m = Math.floor(diff);
     const s = Math.floor((diff - m) * 60);
     return { isActive: true, timeLeft: `${m}:${s < 10 ? '0' : ''}${s}` };
  }
  return { isActive: false, timeLeft: null };
}

function useLessonData(lesson, schedule, isDark) {
  return useMemo(() => {
    const { subjects = [], teachers = [], gradients = [] } = schedule || {};
    const subject = subjects.find((s) => s.id === lesson?.subjectId) || {};
    const instanceData = lesson?.data || {};

    const teacherId = instanceData.teachers?.[0] || instanceData.teacher || subject.teachers?.[0] || subject.teacher;
    const teacher = teachers.find((t) => t.id === teacherId) || {};
    
    let subjectColor = resolveValidColor(
      themes.accentColors[subject?.color] || subject?.color,
      themes.accentColors.grey,
    );
    let activeGrad = null;

    if (subject?.typeColor === "gradient" && subject?.colorGradient) {
      activeGrad = gradients.find((g) => g.id === subject.colorGradient);
      subjectColor = getGradientColor(activeGrad, subjectColor);
    }

    const hasRenderableGradient = getGradientColors(activeGrad).length > 0;
    const contentColor = getReadableForeground(
      hasRenderableGradient ? activeGrad : subjectColor,
      isDark ? '#ffffff' : '#111827',
    );

    return {
      subject,
      teacher,
      displayType: instanceData.type || subject.type,
      displayRoom: instanceData.room || subject.room,
      displayBuilding: instanceData.building || subject.building,
      MainIcon: getIconComponent(subject.icon),
      activeGrad,
      subjectColor,
      contentColor,
      activePillText: isDark ? '#111827' : '#ffffff',
    };
  }, [lesson, schedule, isDark]);
}

const ActiveHighlight = React.memo(({ isActive, isDark }) => {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    let highlightLoop = null;

    if (isActive && !reduceMotion) {
      highlightLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true })
        ])
      );
      highlightLoop.start();
    } else {
      opacityAnim.setValue(isActive ? 0.75 : 0);
    }

    return () => {
      highlightLoop?.stop();
    };
  }, [isActive, opacityAnim, reduceMotion]);

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

const BackgroundPattern = React.memo(({ MainIcon, color, width, height, order, moving }) => {
  const id = useId();
  const patternId = `lesson-pattern-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const positions = useMemo(() => getPatternPositions(width, height), [width, height]);
  const reduceMotion = useReducedMotionPreference();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const [revealed, setRevealed] = useState(reduceMotion);
  const finishReveal = useCallback(() => setRevealed(true), []);
  useAnimatedReaction(
    () => moving?.value ?? false,
    (isMoving) => {
      if (!isMoving) return;
      cancelAnimation(progress);
      progress.value = 1;
      runOnJS(finishReveal)();
    },
  );
  const gradientId = `${patternId}-gradient`;
  const maskId = `${patternId}-mask`;
  const waveProps = useAnimatedProps(() => {
    const start = progress.value * (1 + PATTERN_WAVE_SOFTNESS) - PATTERN_WAVE_SOFTNESS;
    return {
      x1: `${(1 - start) * 100}%`,
      y1: `${start * 100}%`,
      x2: `${(1 - start - PATTERN_WAVE_SOFTNESS) * 100}%`,
      y2: `${(start + PATTERN_WAVE_SOFTNESS) * 100}%`,
    };
  });
  useEffect(() => {
    if (revealed || reduceMotion || moving?.value) {
      progress.value = 1;
      setRevealed(true);
      return;
    }
    progress.value = withDelay(
      Math.max(0, order) * PATTERN_CARD_STAGGER,
      withTiming(1, { duration: PATTERN_REVEAL_DURATION, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(finishReveal)();
      }),
    );
    return () => cancelAnimation(progress);
  }, [finishReveal, moving, progress, reduceMotion, order, revealed]);
  const iconColor = colorWithAlpha(color, PATTERN_ICON_OPACITY, color);

  return (
    <View
      style={[styles.patternLayer, { width, height }]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
    >
      <Svg width={width} height={height}>
        <Defs>
          <G id={patternId}>
            <MainIcon size={ICON_SIZE} color={iconColor} weight="regular" />
          </G>
          {!revealed && <AnimatedWaveGradient id={gradientId} gradientUnits="objectBoundingBox" animatedProps={waveProps}>
            <Stop offset="0%" stopColor="white" stopOpacity={1} />
            <Stop offset="25%" stopColor="white" stopOpacity={0.84} />
            <Stop offset="50%" stopColor="white" stopOpacity={0.5} />
            <Stop offset="75%" stopColor="white" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="white" stopOpacity={0} />
          </AnimatedWaveGradient>}
          {!revealed && <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
            <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
          </Mask>}
        </Defs>
        <G mask={revealed ? undefined : `url(#${maskId})`}>
          {positions.map(({ key, left, top, angle }) => (
            <Use
              key={key}
              href={`#${patternId}`}
              transform={`translate(${left} ${top}) rotate(${angle} ${ICON_SIZE / 2} ${ICON_SIZE / 2})`}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
});

const LessonCardPure = React.memo(({ lesson, schedule, lang, targetDate, isDark, onPress, onLongPress, decorationsReady = true, moving }) => {
  const { 
    subject, teacher, displayType, displayRoom, displayBuilding, MainIcon, activeGrad,
    subjectColor, contentColor, activePillText,
  } = useLessonData(lesson, schedule, isDark);

  const timerNow = useNowTick(targetDate, !!lesson?.timeInfo?.start && !!lesson?.timeInfo?.end);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const { timeLeft, isActive } = useMemo(
    () => getTimerState(lesson?.timeInfo?.start, lesson?.timeInfo?.end, targetDate, timerNow),
    [lesson?.timeInfo?.start, lesson?.timeInfo?.end, targetDate, timerNow]
  );

  const handlePress = () => {
    triggerHaptic("open");
    onPress?.({ ...lesson, subject, teacher, displayType, displayRoom, displayBuilding });
  };

  const handleLongPress = () => {
    triggerHaptic("longPress");
    onLongPress?.({ ...lesson, subject, teacher });
  };

  const handleCardLayout = useCallback((event) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    if (nextWidth <= 0 || nextHeight <= 0) return;

    setCardSize((previous) => (
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : { width: nextWidth, height: nextHeight }
    ));
  }, []);

  const activePillBg = isDark ? '#ffffff' : '#111111';
  const usesLightContent = isLightForeground(contentColor);
  const mutedContentColor = colorWithAlpha(contentColor, 0.86, contentColor);
  const chipBackground = usesLightContent ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.24)';
  const subtleChipBackground = usesLightContent ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.18)';
  const chipBorder = colorWithAlpha(contentColor, usesLightContent ? 0.28 : 0.22, contentColor);
  const titleShadowStyle = usesLightContent
    ? null
    : Platform.select({ web: { textShadow: 'none' }, default: { textShadowColor: 'transparent' } });

  return (
    <GradientBackground
      component={TouchableOpacity}
      gradient={activeGrad}
      fallbackColor={subjectColor}
      style={styles.cardContainer}
      activeOpacity={0.85}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onLayout={handleCardLayout}
      delayLongPress={300}
    >
      {decorationsReady && MainIcon && cardSize.width > 0 && cardSize.height > 0 && <BackgroundPattern
        MainIcon={MainIcon}
        color={contentColor}
        width={cardSize.width}
        height={cardSize.height}
        order={lesson?.index ?? 0}
        moving={moving}
      />}

      <ActiveHighlight isActive={isActive} isDark={isDark} />

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          
          <View style={[styles.timeContainer, { backgroundColor: chipBackground }, isActive && { backgroundColor: activePillBg }]}>
            <View style={styles.iconFixedContainer}>
                {isActive ? (
                   <Hourglass size={11} color={activePillText} weight="fill" />
                ) : (
                   <Clock size={11} color={contentColor} weight="regular" />
                )}
            </View>
            <Text style={[styles.timeText, { color: contentColor }, isActive && { color: activePillText }]}>
              {isActive ? t("common.remaining_time", lang, { time: timeLeft }) : `${lesson?.timeInfo?.start || "—"} - ${lesson?.timeInfo?.end || "—"}`}
            </Text>
          </View>

          {!!displayType && (
            <View style={[styles.typeBadge, { backgroundColor: subtleChipBackground, borderColor: chipBorder }]}>
              <Text style={[styles.typeText, { color: contentColor }]}>{displayType}</Text>
            </View>
          )}
        </View>

        <View style={styles.mainInfo}>
          <Text style={[styles.subjectTitle, { color: contentColor }, titleShadowStyle]} numberOfLines={1}>
            {subject?.name || t('schedule.lesson_editor.subject_not_selected', lang)}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View style={[styles.footerItem, { backgroundColor: subtleChipBackground }]}>
            <View style={styles.iconFixedContainer}>
                <User size={11} color={mutedContentColor} weight="fill" />
            </View>
            <Text style={[styles.footerText, { color: mutedContentColor }]} numberOfLines={1}>{teacher?.name || "—"}</Text>
          </View>

          {!!(displayRoom || displayBuilding) && (
            <View style={[styles.footerItem, { backgroundColor: subtleChipBackground }]}>
              <View style={styles.iconFixedContainer}>
                  <MapPin size={11} color={mutedContentColor} weight="fill" />
              </View>
              <Text style={[styles.footerText, { color: mutedContentColor }]} numberOfLines={1}>
                  {displayBuilding ? `${displayBuilding} ` : ''}{displayRoom}
              </Text>
            </View>
          )}
        </View>
      </View>
    </GradientBackground>
  );
});

export default function LessonCard(props) {
  const { schedule, lang } = useScheduleData();
  const { currentDate } = useDaySchedule(); 
  const { isDark } = useSystemThemeColors();

  return <LessonCardPure {...props} schedule={schedule} lang={lang} targetDate={currentDate} isDark={isDark} />;
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
  patternLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    zIndex: 1,
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
    marginVertical: 2,
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
