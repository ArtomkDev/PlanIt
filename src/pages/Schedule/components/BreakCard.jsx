import React, { useMemo } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import tinycolor from "tinycolor2";
import GradientBackground from "../../../components/ui/GradientBackground";
import { t } from "../../../utils/i18n";
import { useNowTick } from "../../../hooks/useNowTick";
import { createDateAtTime } from "../../../utils/scheduleTime";
import { getLessonColors } from "../../../utils/scheduleColors";
import { normalizeGradientStops } from "../../../utils/gradientColors";
import useActivityTransition from "./useActivityTransition";
import CardIcon from "./CardIcon";

export default function BreakCard({ interval, previousLesson, schedule, targetDate, themeColors, lang, blurEnabled = true, onPress, expanded = false }) {
  const now = useNowTick(targetDate, !!targetDate);
  const start = createDateAtTime(targetDate, interval.start)?.getTime();
  const end = createDateAtTime(targetDate, interval.end)?.getTime();
  const active = !!now && now >= start && now < end;
  const appearance = useMemo(() => {
    const { subjectColor, activeGrad } = getLessonColors(previousLesson, schedule,
      previousLesson ? undefined : themeColors.accentColor);
    const darken = (color, amount) => tinycolor.mix(color, '#000000', amount).toRgbString();
    const shadeGradient = (amount) => activeGrad ? {
      ...activeGrad,
      colors: normalizeGradientStops(activeGrad).map((stop) => ({ ...stop, color: darken(stop.color, amount) })),
    } : null;
    return { border: darken(subjectColor, 15), fill: darken(subjectColor, 65),
      borderGradient: shadeGradient(15), fillGradient: shadeGradient(65) };
  }, [previousLesson, schedule, themeColors.accentColor]);
  const { activeOpacity, inactiveOpacity } = useActivityTransition(active);
  const seconds = active ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
  const countdown = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const duration = interval.duration + ' ' + t('schedule.main_screen.minutes', lang);
  const renderContent = (highlighted) => {
    const foreground = highlighted ? '#FFFFFF' : themeColors.textColor;
    const muted = highlighted ? 'rgba(255,255,255,0.78)' : themeColors.textColor2;
    return <View style={styles.row}>
      <View style={styles.label}>
        <CardIcon name={highlighted ? "timer" : "coffee"} size={15} color={muted} />
        <Text style={[styles.title, { color: foreground }]}>
          {t(interval.type === 'free' ? 'schedule.day_schedule.free_time' : 'schedule.day_schedule.break', lang)}
        </Text>
      </View>
      <Text numberOfLines={1} testID={highlighted === active ? 'schedule-gap-duration' : undefined}
        accessibilityLabel={highlighted ? t('common.remaining_time', lang, { time: countdown }) : duration}
        style={[styles.duration, { color: muted }]}>{highlighted ? countdown : duration}</Text>
      <Text style={[styles.time, { color: muted }]}>{interval.start} – {interval.end}</Text>
    </View>;
  };
  return (
    <TouchableOpacity style={[styles.outline, { backgroundColor: themeColors.backgroundColor2 }]} testID="schedule-gap"
      onPress={onPress} activeOpacity={0.8} accessibilityRole="button"
      hitSlop={{ top: 4, bottom: 4 }} accessibilityState={{ expanded }}
      accessibilityLabel={`${t(interval.type === 'free' ? 'schedule.day_schedule.free_time' : 'schedule.day_schedule.break', lang)}, ${interval.start} – ${interval.end}, ${duration}`}
      accessibilityHint={t(expanded ? 'schedule.day_schedule.hide_other_breaks' : 'schedule.day_schedule.show_all_breaks', lang)}>
      <Animated.View style={{ opacity: inactiveOpacity }}
        aria-hidden={active} accessibilityElementsHidden={active} importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}>
        {renderContent(false)}
      </Animated.View>
      <Animated.View pointerEvents="none" testID="schedule-gap-active"
        aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        style={[styles.activeLayer, { opacity: activeOpacity }]}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}>
          <GradientBackground gradient={appearance.borderGradient} fallbackColor={appearance.border} style={styles.activeOutline}>
            <View style={styles.backgroundClip}>
              <GradientBackground gradient={appearance.fillGradient} fallbackColor={appearance.fill}
                style={[styles.softBackground, blurEnabled && styles.backgroundBlur]} />
              {blurEnabled && Platform.OS === 'ios' && <BlurView intensity={35} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />}
            </View>
          </GradientBackground>
        </View>
        {renderContent(true)}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outline: { position: 'relative', marginHorizontal: 12, marginBottom: 8, padding: 1, borderRadius: 14, overflow: 'hidden' },
  activeLayer: { ...StyleSheet.absoluteFill, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  activeOutline: { flex: 1, padding: 1, borderRadius: 14 },
  backgroundClip: { flex: 1, borderRadius: 13, overflow: 'hidden' },
  softBackground: { position: 'absolute', top: -18, right: -18, bottom: -18, left: -18 },
  backgroundBlur: Platform.select({ web: { filter: 'blur(16px)' }, android: { filter: [{ blur: 16 }] }, default: {} }),
  row: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  duration: { fontSize: 12, lineHeight: 18, width: 48, fontVariant: ['tabular-nums'] },
  time: { fontSize: 15, lineHeight: 20, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
});
