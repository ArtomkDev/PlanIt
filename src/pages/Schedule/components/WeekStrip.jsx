import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation, Easing, interpolateColor, ReduceMotion, runOnJS, runOnUI,
  useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";

import themes from "../../../config/themes";
import { useNotificationDrawer } from "../../../context/NotificationDrawerContext";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { triggerHaptic } from "../../../utils/haptics";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import { t } from "../../../utils/i18n";
import { dateFromCalendarDayNumber, getCalendarDayNumber } from "../dayNavigation";

const selectionAmount = (number, progress, transition, amount) => {
  "worklet";
  if (!transition?.active) return Math.max(0, 1 - Math.abs(progress - number));
  const distance = (number - transition.origin) / 7;
  return Number.isInteger(distance) ? Math.max(0, 1 - Math.abs(distance - amount)) : 0;
};

const DayButton = React.memo(({ number, name, locale, today, selected, progress, weekTransition, weekProgress, colors, onSelect }) => {
  const date = useMemo(() => dateFromCalendarDayNumber(number), [number]);
  const nameColor = today === number ? colors.accentColor : colors.textColor2;
  const numberColor = today === number ? colors.accentColor : colors.textColor;
  const selectedColor = colors.textOnAccent;
  const nameStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selectionAmount(number, progress.value, weekTransition?.value, weekProgress?.value ?? 0), [0, 1], [nameColor, selectedColor]),
  }));
  const numberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selectionAmount(number, progress.value, weekTransition?.value, weekProgress?.value ?? 0), [0, 1], [numberColor, selectedColor]),
  }));
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
      accessibilityState={{ selected: selected === number }}
      activeOpacity={0.65}
      style={styles.day}
      onPress={() => onSelect(number)}
    >
      <Reanimated.Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.name, nameStyle]}>{name}</Reanimated.Text>
      <Reanimated.Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.number, numberStyle]}>{date.getDate()}</Reanimated.Text>
      {today === number && <View style={[styles.dot, { backgroundColor: colors.accentColor }]} />}
    </TouchableOpacity>
  );
});

const WeekRow = React.memo(({ week, offset, camera, width, progress, weekTransition, weekProgress, names, locale, today, selected, colors, onSelect, active }) => {
  const firstDay = week * 7 + offset;
  const rowStyle = useAnimatedStyle(() => ({
    opacity: width.value > 0 || week === Math.round(camera.value) ? 1 : 0,
    transform: [{ translateX: (week - camera.value) * width.value }],
  }));
  const accentStyle = useAnimatedStyle(() => {
    const transition = weekTransition?.value;
    const day = transition?.active ? ((transition.origin - offset) % 7 + 7) % 7 : progress.value - firstDay;
    const cell = width.value / 7;
    const scale = transition?.active ? selectionAmount(firstDay + day, progress.value, transition, weekProgress.value) : 1;
    return {
      width: Math.max(0, cell - 2),
      opacity: transition?.active ? scale : Math.max(0, Math.min(1, day + 1, 7 - day)),
      transform: [{ translateX: Math.max(0, Math.min(6, day)) * cell + 1 }, { scale }],
    };
  });
  return (
    <Reanimated.View collapsable={false} style={[styles.row, active ? styles.currentRow : styles.bufferRow, rowStyle]} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} aria-hidden={!active}>
      <Reanimated.View pointerEvents="none" style={[styles.accent, { backgroundColor: colors.accentColor }, accentStyle]} />
      {names.map((name, index) => (
        <DayButton key={index} number={firstDay + index} name={name} locale={locale} today={today} selected={selected} progress={progress} weekTransition={weekTransition} weekProgress={weekProgress} colors={colors} onSelect={onSelect} />
      ))}
    </Reanimated.View>
  );
});

const WeekStrip = React.memo(({ currentDate, onSelectDate, dayProgress, weekTransition, weekProgress }) => {
  const { global: globalSettings, lang } = useScheduleData();
  const { drawerProgress } = useNotificationDrawer();
  const [mode, accent] = globalSettings?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const reduceMotion = useReducedMotionPreference();
  const locale = t("locale", lang);
  const selected = getCalendarDayNumber(currentDate);
  const today = getCalendarDayNumber(new Date());
  const startDay = useMemo(() => {
    if (!globalSettings?.starting_week) return 1;
    const date = new Date(globalSettings?.starting_week);
    return Number.isNaN(date.getTime()) ? 1 : date.getDay();
  }, [globalSettings?.starting_week]);
  const offset = (startDay - 4 + 7) % 7;
  const initialWeek = Math.floor((selected - offset) / 7);
  const fallbackProgress = useSharedValue(selected);
  const progress = dayProgress ?? fallbackProgress;
  const camera = useSharedValue(initialWeek);
  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragOrigin = useSharedValue(initialWeek);
  const dragDay = useSharedValue(selected);
  const dragBase = useSharedValue(0);
  const weekTarget = useSharedValue(0);
  const queuedGesture = useSharedValue(false);
  const queuedWeeks = useSharedValue([]);
  const translation = useSharedValue(0);
  const [renderedWeek, setRenderedWeek] = useState(initialWeek);
  const names = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const name = new Date(2023, 0, 1 + (startDay + index) % 7).toLocaleDateString(locale, { weekday: "short" });
    return name.replace(".", "").toUpperCase();
  }), [locale, startDay]);

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(drawerProgress?.value ?? 0, [0, 1], [themeColors.backgroundColor2, themeColors.backgroundColor]),
  }));

  const animateWeek = useCallback((week) => {
    "worklet";
    camera.value = withTiming(week, {
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [camera, reduceMotion]);

  const finishWeekGesture = useCallback((direction) => {
    "worklet";
    const id = weekTransition.value.id;
    weekTarget.value = direction;
    weekProgress.value = withTiming(direction, {
      duration: reduceMotion ? 0 : Math.max(70, 180 * Math.abs(direction - weekProgress.value)),
      easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished && weekTransition.value.active && weekTransition.value.id === id) {
        weekTransition.value = { ...weekTransition.value, finished: true };
      }
    });
  }, [reduceMotion, weekProgress, weekTarget, weekTransition]);
  useAnimatedReaction(
    () => !!weekTransition && !weekTransition.value.active && queuedGesture.value
      && dragging.value && queuedWeeks.value.length === 0,
    (ready) => {
      if (!ready) return;
      queuedGesture.value = false;
      dragBase.value = 0;
      dragOrigin.value = 0;
      weekTarget.value = 0;
      weekProgress.value = Math.max(-1, Math.min(1, -translation.value / Math.max(1, width.value)));
      weekTransition.value = { id: weekTransition.value.id + 1, active: true, origin: Math.round(progress.value), finished: false };
    },
  );
  useAnimatedReaction(
    () => weekTransition && !weekTransition.value.active && !dragging.value && queuedWeeks.value.length
      ? queuedWeeks.value[0] : null,
    (direction) => {
      if (direction === null) return;
      queuedWeeks.value = queuedWeeks.value.slice(1);
      weekProgress.value = 0;
      weekTransition.value = { id: weekTransition.value.id + 1, active: true, origin: Math.round(progress.value), finished: false };
      finishWeekGesture(direction);
    },
  );
  useAnimatedReaction(
    () => weekTransition?.value.active ? Math.floor((weekTransition.value.origin - offset) / 7) + weekProgress.value : null,
    (next) => { if (next !== null) camera.value = next; },
  );

  useAnimatedReaction(
    () => weekTransition?.value.active ? null : Math.floor((Math.round(progress.value) - offset) / 7),
    (week) => {
      if (week === null) return;
      if (weekTransition && !queuedGesture.value) dragging.value = false;
      if (dragging.value) return;
      if (Math.abs(week - camera.value) > 1) runOnJS(setRenderedWeek)(week);
      else animateWeek(week);
    },
  );
  useAnimatedReaction(
    () => weekTransition?.value.active
      ? Math.floor((weekTransition.value.origin - offset) / 7) : Math.round(camera.value),
    (week, previous) => { if (week !== previous) runOnJS(setRenderedWeek)(week); },
  );
  useLayoutEffect(() => {
    if (!dayProgress) fallbackProgress.value = selected;
  }, [dayProgress, fallbackProgress, selected]);
  useLayoutEffect(() => {
    runOnUI(() => {
      if (Math.abs(renderedWeek - camera.value) > 1) {
        camera.value = renderedWeek - Math.sign(renderedWeek - camera.value);
        animateWeek(renderedWeek);
      }
    })();
  }, [animateWeek, camera, renderedWeek]);

  const selectDay = useCallback((number) => {
    triggerHaptic("selection");
    onSelectDate(dateFromCalendarDayNumber(number));
  }, [onSelectDate]);
  const selectWeek = useCallback((number) => {
    triggerHaptic("swipe");
    onSelectDate(dateFromCalendarDayNumber(number));
  }, [onSelectDate]);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      dragging.value = true;
      translation.value = 0;
      queuedGesture.value = !!weekTransition && (weekTransition.value.finished && weekTransition.value.active || queuedWeeks.value.length > 0);
      if (queuedGesture.value) return;
      cancelAnimation(camera);
      if (weekTransition) {
        cancelAnimation(weekProgress);
        if (!weekTransition.value.active) {
          weekProgress.value = 0;
          weekTarget.value = 0;
          weekTransition.value = { id: weekTransition.value.id + 1, active: true, origin: Math.round(progress.value), finished: false };
        }
        dragOrigin.value = weekProgress.value;
        dragBase.value = weekTarget.value;
        return;
      }
      dragOrigin.value = camera.value;
      const column = ((Math.round(progress.value) - offset) % 7 + 7) % 7;
      dragDay.value = Math.round(camera.value) * 7 + offset + column;
    })
    .onUpdate((event) => {
      if (!dragging.value || width.value <= 0) return;
      translation.value = event.translationX;
      if (queuedGesture.value) return;
      if (weekTransition) {
        if (!weekTransition.value.active) { dragging.value = false; return; }
        weekProgress.value = Math.max(-1, Math.min(1, dragOrigin.value - event.translationX / width.value));
        return;
      }
      camera.value = dragOrigin.value + Math.max(-1, Math.min(1, -event.translationX / width.value));
    })
    .onEnd((event) => {
      if (!dragging.value) return;
      if (queuedGesture.value) {
        queuedGesture.value = false;
        dragging.value = false;
        const projected = -translation.value / Math.max(1, width.value) - event.velocityX / Math.max(1, width.value) * 0.12;
        if (Math.abs(projected) > 0.18) queuedWeeks.value = [...queuedWeeks.value, Math.sign(projected)];
        return;
      }
      if (weekTransition) {
        dragging.value = false;
        if (!weekTransition.value.active) return;
        const projected = -translation.value / Math.max(1, width.value) - event.velocityX / Math.max(1, width.value) * 0.12;
        const requested = dragBase.value + (Math.abs(projected) > 0.18 ? Math.sign(projected) : 0);
        const target = Math.max(-1, Math.min(1, requested));
        if (requested !== target) queuedWeeks.value = [...queuedWeeks.value, requested - target];
        finishWeekGesture(target);
        return;
      }
      const projected = camera.value - dragOrigin.value - event.velocityX / Math.max(1, width.value) * 0.12;
      const direction = Math.abs(projected) > 0.18 ? Math.sign(projected) : 0;
      dragging.value = false;
      animateWeek(Math.round(dragOrigin.value) + direction);
      if (direction) runOnJS(selectWeek)(dragDay.value + direction * 7);
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      if (queuedGesture.value) { queuedGesture.value = false; return; }
      if (weekTransition) {
        if (weekTransition.value.active) finishWeekGesture(dragBase.value);
        return;
      }
      animateWeek(Math.floor((Math.round(progress.value) - offset) / 7));
    }), [animateWeek, camera, dragBase, dragDay, dragOrigin, dragging, finishWeekGesture, offset, progress, queuedGesture, queuedWeeks, selectWeek, translation, weekProgress, weekTarget, weekTransition, width]);
  const handleLayout = useCallback((event) => {
    const next = event.nativeEvent.layout.width;
    if (next <= 0) return;
    runOnUI(() => {
      if (width.value > 0 && width.value !== next) {
        queuedWeeks.value = [];
        queuedGesture.value = false;
        dragging.value = false;
      }
      width.value = next;
    })();
  }, [dragging, queuedGesture, queuedWeeks, width]);

  useLayoutEffect(() => () => {
    cancelAnimation(camera);
    if (weekProgress) cancelAnimation(weekProgress);
    queuedWeeks.value = [];
    queuedGesture.value = false;
    dragging.value = false;
  }, [camera, dragging, queuedGesture, queuedWeeks, weekProgress]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Reanimated.View collapsable={false} style={[styles.surface, { borderColor: themeColors.borderColor }, surfaceStyle]}>
          <View collapsable={false} style={styles.viewport} onLayout={handleLayout}>
            {[-1, 0, 1].map((relative) => (
              <WeekRow key={renderedWeek + relative} week={renderedWeek + relative} offset={offset} camera={camera} width={width} progress={progress} weekTransition={weekTransition} weekProgress={weekProgress} names={names} locale={locale} today={today} selected={selected} colors={themeColors} onSelect={selectDay} active={relative === 0} />
            ))}
          </View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
});

export default WeekStrip;

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", flexShrink: 0, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 4 },
  surface: { alignSelf: "stretch", flexShrink: 0, borderWidth: 1, borderRadius: 15, padding: 2, overflow: "hidden" },
  viewport: { width: "100%", height: 40, flexShrink: 0, overflow: "hidden" },
  row: { width: "100%", height: 40, flexShrink: 0, flexDirection: "row" },
  currentRow: { position: "relative" },
  bufferRow: { position: "absolute", top: 0, left: 0 },
  accent: { position: "absolute", top: 0, bottom: 0, borderRadius: 12 },
  day: { flex: 1, minWidth: 0, height: 40, marginHorizontal: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 8, lineHeight: 10, marginBottom: 1, fontWeight: "800", letterSpacing: 0.25, textTransform: "uppercase" },
  number: { fontSize: 15, lineHeight: 18, fontWeight: "800" },
  dot: { position: "absolute", bottom: 2, width: 3, height: 3, borderRadius: 2 },
});
