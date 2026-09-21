import React, {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle,
  useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, ReduceMotion, runOnJS, runOnUI,
  useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";

import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import {
  createDayWindow, prepareDayWindow, settleDayWindow, normalizeCalendarDate, getCalendarDayNumber,
} from "../dayNavigation";

const IDLE = 0;
const DRAGGING = 1;
const PREPARING = 2;
const SETTLING = 3;
const COMMITTING = 4;

const PagerPage = memo(function PagerPage({ page, camera, width, phase, moving, center, active, renderDay, onPageLayout, weekTransition, weekProgress }) {
  const { position, timestamp } = page;
  const day = getCalendarDayNumber(timestamp);
  const [idle, setIdle] = useState(false);
  const [decorationsReady, setDecorationsReady] = useState(false);
  useAnimatedReaction(
    () => phase.value === IDLE && center.value === position,
    (next, previous) => { if (next !== previous) runOnJS(setIdle)(next); },
  );
  useEffect(() => {
    if (!idle || decorationsReady) return;
    const timeout = setTimeout(() => setDecorationsReady(true), 140);
    return () => clearTimeout(timeout);
  }, [decorationsReady, idle]);
  const date = useMemo(() => new Date(timestamp), [timestamp]);
  const style = useAnimatedStyle(() => {
    if (weekTransition?.value.active) {
      const offset = (day - weekTransition.value.origin) / 7;
      return {
        opacity: Number.isInteger(offset) ? 1 : 0,
        transform: [{ translateX: (offset - weekProgress.value) * width.value }],
      };
    }
    return { opacity: 1, transform: [{ translateX: (position - camera.value) * width.value }] };
  });

  return (
    <Animated.View
      onLayout={(event) => onPageLayout(timestamp, event.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      aria-hidden={!active}
    >
      {renderDay(date, decorationsReady, moving)}
    </Animated.View>
  );
});

const DayPager = memo(forwardRef(function DayPager({ date, onDateChange, renderDay, dayProgress, weekTransition, weekProgress }, ref) {
  const [window, setWindow] = useState(() => createDayWindow(date));
  const windowRef = useRef(window);
  const revisionRef = useRef(0);
  const commandIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const widthRef = useRef(0);
  const measuredPages = useRef(new Map());
  const [, setLayoutVersion] = useState(0);
  const handlePageLayout = useCallback((timestamp, pageWidth) => {
    if (pageWidth <= 0 || measuredPages.current.get(timestamp) === pageWidth) return;
    measuredPages.current.set(timestamp, pageWidth);
    setLayoutVersion((version) => version + 1);
  }, []);
  const reduceMotion = useReducedMotionPreference();

  const camera = useSharedValue(0);
  const width = useSharedValue(0);
  const center = useSharedValue(0);
  const revision = useSharedValue(0);
  const phase = useSharedValue(COMMITTING);
  const gestureRevision = useSharedValue(-1);
  const gestureOrigin = useSharedValue(0);
  const gestureBase = useSharedValue(0);
  const settleTarget = useSharedValue(0);
  const interruptible = useSharedValue(true);
  const motionReduced = useSharedValue(reduceMotion);
  const command = useSharedValue({ id: 0, timestamp: 0, animated: true });
  const handledCommand = useSharedValue(0);
  const mountedPages = useSharedValue([]);
  const moving = useSharedValue(true);
  const pendingSteps = useSharedValue(0);
  const queuedGesture = useSharedValue(false);
  const gestureTranslation = useSharedValue(0);
  const layoutEpoch = useSharedValue(0);
  const gestureLayoutEpoch = useSharedValue(0);
  const readyWeekId = useSharedValue(0);
  const committedWeekId = useSharedValue(0);
  const weekOrigin = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (weekTransition?.value.active) return weekTransition.value.origin + weekProgress.value * 7;
      const pages = mountedPages.value;
      if (!pages.length) return null;
      const left = pages.find((page) => page.position === Math.floor(camera.value));
      const right = pages.find((page) => page.position === Math.ceil(camera.value));
      if (!left || !right) return null;
      const fraction = camera.value - Math.floor(camera.value);
      // Distant calendar jumps switch their calendar anchor halfway through the slide.
      if (Math.abs(right.day - left.day) > 1 && !weekTransition?.value.active) return fraction < 0.5 ? left.day : right.day;
      return left.day + (right.day - left.day) * fraction;
    },
    (next) => { if (dayProgress && next !== null) dayProgress.value = next; },
  );

  useAnimatedReaction(
    () => phase.value !== IDLE,
    (next) => { moving.value = next; },
  );

  const publishWindow = useCallback((next) => {
    windowRef.current = next;
    setWindow(next);
  }, []);

  const commitPage = useCallback((position, sourceRevision) => {
    if (!mountedRef.current || sourceRevision !== revisionRef.current) return;
    const next = settleDayWindow(windowRef.current, position, ++revisionRef.current);
    publishWindow(next);
    onDateChange(new Date(next.timestamp));
  }, [onDateChange, publishWindow]);

  const prepareCommand = useCallback((timestamp, animated, sourceRevision) => {
    if (!mountedRef.current || sourceRevision !== revisionRef.current) return;
    publishWindow(prepareDayWindow(
      windowRef.current, timestamp, animated, ++revisionRef.current,
    ));
  }, [publishWindow]);

  useAnimatedReaction(
    () => weekTransition?.value.active && weekTransition.value.id !== readyWeekId.value
      && (phase.value === IDLE || phase.value === SETTLING)
      ? weekTransition.value : null,
    (next) => {
      if (!next) return;
      const origin = mountedPages.value.find((page) => page.day === next.origin);
      if (!origin) return;
      cancelAnimation(camera);
      weekOrigin.value = origin.position;
      readyWeekId.value = next.id;
      phase.value = DRAGGING;
    },
  );
  useAnimatedReaction(
    () => weekTransition?.value.active && readyWeekId.value === weekTransition.value.id
      && committedWeekId.value !== weekTransition.value.id
      ? weekProgress.value + (weekTransition.value.finished ? 10 : 0) : null,
    (next) => {
      if (next === null) return;
      const amount = weekProgress.value;
      camera.value = weekOrigin.value + amount * 7;
      if (weekTransition.value.finished) {
        committedWeekId.value = weekTransition.value.id;
        phase.value = COMMITTING;
        runOnJS(commitPage)(weekOrigin.value + Math.round(amount) * 7, revision.value);
      }
    },
  );

  const animateTo = useCallback((position, animated = true, allowInterrupt = true) => {
    "worklet";
    phase.value = SETTLING;
    settleTarget.value = position;
    interruptible.value = allowInterrupt;
    const sourceRevision = revision.value;
    const distance = Math.abs(position - camera.value);
    camera.value = withTiming(position, {
      duration: !animated || motionReduced.value ? 0 : Math.max(70, Math.min(180, 180 * distance)),
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (!finished || revision.value !== sourceRevision) return;
      phase.value = COMMITTING;
      runOnJS(commitPage)(position, sourceRevision);
    });
  }, [camera, commitPage, interruptible, motionReduced, phase, revision, settleTarget]);

  const navigateToDate = useCallback((input, options = {}) => {
    const target = normalizeCalendarDate(input);
    if (!target) return;
    command.value = {
      id: ++commandIdRef.current,
      timestamp: target.getTime(),
      animated: options.animated !== false,
    };
  }, [command]);

  useImperativeHandle(ref, () => ({ navigateToDate }), [navigateToDate]);

  // A busy gesture/animation finishes before the latest button command is applied.
  useAnimatedReaction(
    () => phase.value === IDLE && command.value.id > handledCommand.value
      ? command.value
      : null,
    (next) => {
      if (!next) return;
      handledCommand.value = next.id;
      pendingSteps.value = 0;
      const prepared = mountedPages.value.find((page) => page.timestamp === next.timestamp);
      if (prepared && Math.abs(prepared.position - center.value) <= 2) {
        if (prepared.position !== center.value) animateTo(prepared.position, next.animated, false);
        return;
      }
      phase.value = PREPARING;
      runOnJS(prepareCommand)(next.timestamp, next.animated, revision.value);
    },
  );

  useAnimatedReaction(
    () => phase.value === IDLE && !queuedGesture.value
      && command.value.id <= handledCommand.value ? pendingSteps.value : 0,
    (steps) => {
      if (!steps) return;
      const advance = Math.max(-2, Math.min(2, steps));
      pendingSteps.value -= advance;
      animateTo(center.value + advance);
    },
  );

  useLayoutEffect(() => {
    motionReduced.value = reduceMotion;
  }, [motionReduced, reduceMotion]);

  const dateTimestamp = normalizeCalendarDate(date)?.getTime();
  useEffect(() => {
    if (dateTimestamp !== windowRef.current.timestamp) {
      navigateToDate(dateTimestamp, { animated: false });
    }
  }, [dateTimestamp, navigateToDate]);

  const targetPage = window.pages.find((page) => page.position === window.target);
  const targetReady = !targetPage || measuredPages.current.get(targetPage.timestamp) === viewportWidth;

  useLayoutEffect(() => {
    if (viewportWidth <= 0) return;
    const timestamps = new Set(window.pages.map((page) => page.timestamp));
    for (const timestamp of measuredPages.current.keys()) {
      if (!timestamps.has(timestamp)) measuredPages.current.delete(timestamp);
    }
    const nextCenter = window.center;
    const nextRevision = window.revision;
    const target = window.target;
    const animated = window.animated;
    const pages = window.pages.map(({ timestamp, position }) => ({ timestamp, position, day: getCalendarDayNumber(timestamp) }));
    runOnUI(() => {
      cancelAnimation(camera);
      if (width.value !== viewportWidth) {
        if (weekTransition?.value.active) {
          cancelAnimation(weekProgress);
          weekTransition.value = { ...weekTransition.value, active: false };
        }
        layoutEpoch.value += 1;
        pendingSteps.value = 0;
        queuedGesture.value = false;
      }
      width.value = viewportWidth;
      center.value = nextCenter;
      revision.value = nextRevision;
      mountedPages.value = pages;
      if (target !== null) {
        if (targetReady) animateTo(target, animated, false);
        else phase.value = PREPARING;
      } else {
        // Normal commits keep the camera and visible page at the same coordinate.
        camera.value = nextCenter;
        if (weekTransition?.value.active && committedWeekId.value === weekTransition.value.id) {
          weekTransition.value = { ...weekTransition.value, active: false };
        }
        phase.value = IDLE;
      }
    })();
  }, [animateTo, camera, center, committedWeekId, layoutEpoch, mountedPages, pendingSteps, phase, queuedGesture, revision, targetReady, viewportWidth, weekProgress, weekTransition, width, window]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimation(camera);
      if (weekProgress) cancelAnimation(weekProgress);
      if (weekTransition) weekTransition.value = { ...weekTransition.value, active: false };
    };
  }, [camera, weekProgress, weekTransition]);

  const handleLayout = useCallback((event) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth <= 0 || nextWidth === widthRef.current) return;
    widthRef.current = nextWidth;
    const current = windowRef.current;
    publishWindow(createDayWindow(
      current.timestamp, current.center, ++revisionRef.current, current.pages,
    ));
    setViewportWidth(nextWidth);
  }, [publishWindow]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(viewportWidth > 0)
    .averageTouches(true)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onStart(() => {
      gestureRevision.value = -1;
      queuedGesture.value = false;
      gestureLayoutEpoch.value = layoutEpoch.value;
      gestureTranslation.value = 0;
      if (weekTransition?.value.active) { queuedGesture.value = true; return; }
      queuedGesture.value = phase.value !== IDLE && phase.value !== SETTLING
        || phase.value === SETTLING && !interruptible.value;
      if (queuedGesture.value) return;
      gestureBase.value = phase.value === SETTLING ? settleTarget.value : center.value;
      gestureOrigin.value = camera.value;
      cancelAnimation(camera);
      gestureRevision.value = revision.value;
      phase.value = DRAGGING;
    })
    .onUpdate((event) => {
      gestureTranslation.value = event.translationX;
      if (phase.value !== DRAGGING || gestureRevision.value !== revision.value) return;
      camera.value = Math.max(center.value - 2, Math.min(
        center.value + 2, gestureOrigin.value - event.translationX / width.value,
      ));
    })
    .onEnd((event) => {
      if (gestureLayoutEpoch.value !== layoutEpoch.value) return;
      if (queuedGesture.value) {
        queuedGesture.value = false;
        const projected = -gestureTranslation.value / width.value - event.velocityX / width.value * 0.15;
        if (Math.abs(projected) >= 0.22) pendingSteps.value += Math.sign(projected);
        return;
      }
      if (phase.value !== DRAGGING || gestureRevision.value !== revision.value) return;
      const projected = (camera.value - gestureOrigin.value) - event.velocityX / width.value * 0.15;
      const direction = Math.abs(projected) >= 0.22 ? Math.sign(projected) : 0;
      const requested = gestureBase.value + pendingSteps.value + direction;
      const available = Math.max(center.value - 2, Math.min(center.value + 2, requested));
      pendingSteps.value = requested - available;
      animateTo(available);
    })
    .onFinalize(() => {
      queuedGesture.value = false;
      if (phase.value === DRAGGING && gestureRevision.value === revision.value) {
        animateTo(gestureBase.value);
      }
    }), [animateTo, camera, center, gestureBase, gestureLayoutEpoch, gestureOrigin, gestureRevision, gestureTranslation, interruptible, layoutEpoch, pendingSteps, phase, queuedGesture, revision, settleTarget, viewportWidth, weekTransition, width]);

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <View style={styles.viewport} onLayout={handleLayout}>
        {viewportWidth > 0 && window.pages.map((page) => (
          <PagerPage
            key={page.key}
            page={page}
            camera={camera}
            width={width}
            phase={phase}
            moving={moving}
            center={center}
            active={page.position === window.center}
            renderDay={renderDay}
            onPageLayout={handlePageLayout}
            weekTransition={weekTransition}
            weekProgress={weekProgress}
          />
        ))}
      </View>
    </GestureDetector>
  );
}));

export default DayPager;

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
});
