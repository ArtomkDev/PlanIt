import React, { useMemo, useState, useEffect } from "react";
import { StyleSheet, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming, 
    withSpring, 
    Easing, 
    runOnJS 
} from "react-native-reanimated";
import { t } from "../../../utils/i18n";
import GradientBackground from "../../../components/GradientBackground";

function getDiffMinutes(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
}

function checkBreakState(lStartStr, bStartStr, bEndStr, targetDate) {
    if (!lStartStr || !bStartStr || !bEndStr || !targetDate) return { isVisible: false, isBreakNow: false, timeLeft: null };

    const now = new Date();
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays !== 0 && diffDays !== 1) return { isVisible: false, isBreakNow: false, timeLeft: null };

    const parseMins = (str) => {
        const [h, m] = str.split(":").map(Number);
        return h * 60 + m;
    };

    let lStartMins = parseMins(lStartStr);
    let bStartMins = parseMins(bStartStr);
    let bEndMins = parseMins(bEndStr);

    if (bStartMins < lStartMins) bStartMins += 24 * 60;
    if (bEndMins < bStartMins) bEndMins += 24 * 60;

    let currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    if (diffDays === 1) {
        if (lStartMins >= 12 * 60 && currentMins < 12 * 60) {
            currentMins += 24 * 60;
        } else {
            return { isVisible: false, isBreakNow: false, timeLeft: null };
        }
    }

    const isVisible = currentMins >= lStartMins && currentMins < bEndMins;
    const isBreakNow = currentMins >= bStartMins && currentMins < bEndMins;
    
    let timeLeft = null;
    if (isBreakNow) {
        const diff = bEndMins - currentMins;
        const m = Math.floor(diff);
        const s = Math.floor((diff - m) * 60);
        timeLeft = `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    return { isVisible, isBreakNow, timeLeft };
}

const AnimatedBreakCard = React.memo(({ isVisible, isBreakNow, timeLeft, durationMinutes, themeColors, subjectColor, activeGrad, lang }) => {
    const [isMounted, setIsMounted] = useState(isVisible);
    const expandProgress = useSharedValue(isVisible ? 1 : 0);

    useEffect(() => {
        if (isVisible) {
            setIsMounted(true);
            expandProgress.value = withTiming(1, { duration: 450, easing: Easing.inOut(Easing.cubic) });
        } else {
            expandProgress.value = withTiming(0, { duration: 450, easing: Easing.inOut(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setIsMounted)(false);
            });
        }
    }, [isVisible]);

    const iconScale = useSharedValue(1);
    const [iconName, setIconName] = useState(isBreakNow ? "timer-outline" : "cafe-outline");

    useEffect(() => {
        if (isBreakNow && iconName !== "timer-outline") {
            iconScale.value = withTiming(0, { duration: 150 }, () => {
                runOnJS(setIconName)("timer-outline");
                iconScale.value = withSpring(1, { damping: 12, stiffness: 100 });
            });
        } else if (!isBreakNow && iconName !== "cafe-outline") {
            iconScale.value = withTiming(0, { duration: 150 }, () => {
                runOnJS(setIconName)("cafe-outline");
                iconScale.value = withSpring(1, { damping: 12, stiffness: 100 });
            });
        }
    }, [isBreakNow]);

    const wrapperStyle = useAnimatedStyle(() => ({
        height: expandProgress.value * 48,
        opacity: expandProgress.value,
        marginBottom: expandProgress.value * 8, 
        transform: [{ scale: 0.96 + 0.04 * expandProgress.value }]
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }]
    }));

    if (!isMounted) return null; 

    let text = isBreakNow 
        ? `${t('common.left', lang)} ${timeLeft}`
        : `${t('schedule.day_schedule.break', lang)} ${durationMinutes} ${t('schedule.main_screen.minutes', lang)}`;

    const activeColor = subjectColor || themeColors.accentColor;
    const bgOpacity = isBreakNow ? 0.15 : 0.05;

    return (
        <Animated.View style={[styles.wrapper, wrapperStyle]}>
            <View style={[styles.cardContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
                <View style={styles.innerContent}>
                    {activeGrad ? (
                        <View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
                            <GradientBackground gradient={activeGrad} style={StyleSheet.absoluteFillObject} />
                        </View>
                    ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: activeColor, opacity: bgOpacity }]} />
                    )}
                    <Animated.View style={iconStyle}>
                        <Ionicons name={iconName} size={16} color={isBreakNow ? themeColors.textColor : themeColors.textColor2} style={{ marginRight: 8 }} />
                    </Animated.View>
                    <Text style={[styles.text, { color: isBreakNow ? themeColors.textColor : themeColors.textColor2, fontWeight: isBreakNow ? '700' : '600' }]}>
                        {text}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
});

export default function BreakCard({ lessonStart, breakStart, breakEnd, targetDate, themeColors, lang, subjectColor, activeGrad }) {
  const [state, setState] = useState(() => checkBreakState(lessonStart, breakStart, breakEnd, targetDate));

  useEffect(() => {
    if (!targetDate) return;
    const timer = setInterval(() => {
      setState(checkBreakState(lessonStart, breakStart, breakEnd, targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [lessonStart, breakStart, breakEnd, targetDate]);

  const durationMinutes = useMemo(() => getDiffMinutes(breakStart, breakEnd), [breakStart, breakEnd]);

  if (!targetDate || !lessonStart || !breakStart || !breakEnd || durationMinutes <= 0 || durationMinutes > 720) return null;

  return (
    <AnimatedBreakCard
      isVisible={state.isVisible}
      isBreakNow={state.isBreakNow}
      timeLeft={state.timeLeft}
      durationMinutes={durationMinutes}
      themeColors={themeColors}
      subjectColor={subjectColor}
      activeGrad={activeGrad}
      lang={lang}
    />
  );
}

const styles = StyleSheet.create({
    wrapper: {
        overflow: 'hidden', 
        justifyContent: 'center',
    },
    cardContainer: {
        marginHorizontal: 24, 
        height: 48, 
        borderRadius: 18,
        ...Platform.select({ 
            web: { boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.05)' }, 
            default: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 } 
        }),
        overflow: 'hidden'
    },
    innerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    text: {
        fontSize: 13,
        letterSpacing: 0.3,
    }
});