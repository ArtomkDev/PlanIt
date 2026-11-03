import React, {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle,
  useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, State } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, ReduceMotion, runOnJS, runOnUI,
  useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";

import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import {
  createDayWindow, prepareDayWindow, settleDayWindow, normalizeCalendarDate, getCalendarDayNumber,
  isRequiredDayPosition,
} from "../dayNavigation";

const IDLE = 0;
const DRAGGING = 1;
const PREPARING = 2;
const SETTLING = 3;
const COMMITTING = 4;
const IS_ANDROID = Platform.OS === "android";
const SWIPE_THRESHOLD = 0.22;
const VERTICAL_TOLERANCE = 12;
const DAY_BUFFER_RADIUS = 2;
// Cached history pages outside the required window keep their state but drop
// their native views once idle: every mounted view costs layout and ads SDK
// viewability walks, and gestures can only reach required pages.
const CONTENT_RELEASE_DELAY = 1500;

const PagerPage = memo(function PagerPage({ page, width, viewportWidth, phase, moving, center, active, retained, renderDay, onPageLayout, weekTransition, weekProgress }) {
  const { position, timestamp } = page;
  const day = getCalendarDayNumber(timestamp);
  const [decorationsReady, setDecorationsReady] = useState(false);
  const decorationsTimeout = useRef(null);
  const prepareDecorations = useCallback((idle) => {
    clearTimeout(decorationsTimeout.current);
    if (idle) decorationsTimeout.current = setTimeout(() => setDecorationsReady(true), 140);
  }, []);
  const [contentReleased, setContentReleased] = useState(!retained);
  useAnimatedReaction(
    () => decorationsReady ? null : phase.value === IDLE && center.value === position,
    (next, previous) => { if (next !== null && next !== previous) runOnJS(prepareDecorations)(next); },
  );
  useEffect(() => () => clearTimeout(decorationsTimeout.current), []);
  useEffect(() => {
    if (retained) {
      setContentReleased(false);
      return undefined;
    }
    const timeout = setTimeout(() => {
      setContentReleased(true);
      setDecorationsReady(false);
    }, CONTENT_RELEASE_DELAY);
    return () => clearTimeout(timeout);
  }, [retained]);
  const date = useMemo(() => new Date(timestamp), [timestamp]);
  const style = useAnimatedStyle(() => {
    if (weekTransition?.value.active) {
      const offset = (day - weekTransition.value.origin) / 7;
      return {
        opacity: Number.isInteger(offset) ? 1 : 0,
        transform: [{ translateX: (offset - weekProgress.value + DAY_BUFFER_RADIUS) * width.value }],
      };
    }
    return { opacity: 1, transform: [{ translateX: (position - center.value + DAY_BUFFER_RADIUS) * width.value }] };
  });

  return (
    <Animated.View
      onLayout={(event) => onPageLayout(timestamp, event.nativeEvent.layout.width)}
      style={[styles.page, { width: viewportWidth }, style]}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      aria-hidden={!active}
    >
      {retained || !contentReleased ? renderDay(date, decorationsReady, moving) : null}
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
    const current = windowRef.current;
    if (current.target !== null && current.pages.some((page) => page.timestamp === timestamp && page.position === current.target)) {
      setLayoutVersion((version) => version + 1);
    }
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
  const gestureTouchX = useSharedValue(0);
  const gestureTouchY = useSharedValue(0);
  const layoutEpoch = useSharedValue(0);
  const gestureLayoutEpoch = useSharedValue(0);
  const readyWeekId = useSharedValue(0);
  const committedWeekId = useSharedValue(0);
  const weekOrigin = useSharedValue(0);
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: weekTransition?.value.active ? 0 : (center.value - camera.value) * width.value }],
  }));

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
      if (position === center.value) {
        phase.value = IDLE;
        return;
      }
      phase.value = COMMITTING;
      runOnJS(commitPage)(position, sourceRevision);
    });
  }, [camera, center, commitPage, interruptible, motionReduced, phase, revision, settleTarget]);

  const startDrag = useCallback((translation) => {
    "worklet";
    gestureBase.value = phase.value === SETTLING ? settleTarget.value : center.value;
    gestureOrigin.value = camera.value;
    cancelAnimation(camera);
    gestureRevision.value = revision.value;
    phase.value = DRAGGING;
    camera.value = Math.max(center.value - DAY_BUFFER_RADIUS, Math.min(
      center.value + DAY_BUFFER_RADIUS, gestureOrigin.value - translation / width.value,
    ));
  }, [camera, center, gestureBase, gestureOrigin, gestureRevision, phase, revision, settleTarget, width]);

  const navigateToDate = useCallback((input, options = {}) => {
    const target = normalizeCalendarDate(input);
    if (!target) return;
    const id = ++commandIdRef.current;
    const timestamp = target.getTime();
    if (options.animated === false) {
      // External jumps must commit even before the first layout or animation frame.
      runOnUI(() => {
        phase.value = COMMITTING;
        handledCommand.value = id;
        command.value = { id, timestamp, animated: false };
        pendingSteps.value = 0;
        queuedGesture.value = false;
        gestureLayoutEpoch.value = -1;
        cancelAnimation(camera);
        if (weekTransition?.value.active) {
          cancelAnimation(weekProgress);
          weekTransition.value = { ...weekTransition.value, active: false };
        }
      })();
      const current = windowRef.current;
      const position = current.pages.find((page) => page.timestamp === timestamp)?.position ?? current.center;
      publishWindow(createDayWindow(target, position, ++revisionRef.current, current.pages));
      onDateChange(target);
      return;
    }
    command.value = {
      id,
      timestamp,
      animated: true,
    };
  }, [camera, command, gestureLayoutEpoch, handledCommand, onDateChange, pendingSteps, phase, publishWindow, queuedGesture, weekProgress, weekTransition]);

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
      if (prepared && Math.abs(prepared.position - center.value) <= DAY_BUFFER_RADIUS) {
        if (prepared.position !== center.value) animateTo(prepared.position, next.animated, false);
        return;
      }
      phase.value = PREPARING;
      runOnJS(prepareCommand)(next.timestamp, next.animated, revision.value);
    },
  );

  useAnimatedReaction(
    () => queuedGesture.value && !weekTransition?.value.active
      && gestureLayoutEpoch.value === layoutEpoch.value
      && command.value.id <= handledCommand.value
      && (phase.value === IDLE || phase.value === SETTLING && interruptible.value),
    (ready) => {
      if (!ready) return;
      queuedGesture.value = false;
      // A finger held across React's acknowledgement must resume from its full translation.
      startDrag(gestureTranslation.value);
    },
  );

  useAnimatedReaction(
    () => phase.value === IDLE && !queuedGesture.value
      && command.value.id <= handledCommand.value ? pendingSteps.value : 0,
    (steps) => {
      if (!steps) return;
      const advance = Math.max(-DAY_BUFFER_RADIUS, Math.min(DAY_BUFFER_RADIUS, steps));
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
    .failOffsetY([-VERTICAL_TOLERANCE, VERTICAL_TOLERANCE])
    .onBegin((event) => {
      gestureRevision.value = -1;
      queuedGesture.value = false;
      gestureLayoutEpoch.value = layoutEpoch.value;
      gestureTranslation.value = 0;
      gestureTouchX.value = event.absoluteX;
      gestureTouchY.value = event.absoluteY;
    })
    .onStart(() => {
      if (weekTransition?.value.active) { queuedGesture.value = true; return; }
      queuedGesture.value = phase.value !== IDLE && phase.value !== SETTLING
        || phase.value === SETTLING && !interruptible.value;
      if (queuedGesture.value) return;
      startDrag(0);
    })
    .onUpdate((event) => {
      gestureTranslation.value = event.translationX;
      if (phase.value !== DRAGGING || gestureRevision.value !== revision.value) return;
      camera.value = Math.max(center.value - DAY_BUFFER_RADIUS, Math.min(
        center.value + DAY_BUFFER_RADIUS, gestureOrigin.value - event.translationX / width.value,
      ));
    })
    .onEnd((event, success) => {
      if (!success) return;
      if (gestureLayoutEpoch.value !== layoutEpoch.value) return;
      // Android may activate late or omit update frames while React mounts new days.
      const projected = (gestureTouchX.value - event.absoluteX) / width.value - event.velocityX / width.value * 0.15;
      if (queuedGesture.value) {
        queuedGesture.value = false;
        if (Math.abs(projected) >= SWIPE_THRESHOLD) pendingSteps.value += Math.sign(projected);
        return;
      }
      if (phase.value !== DRAGGING || gestureRevision.value !== revision.value) return;
      const direction = Math.abs(projected) >= SWIPE_THRESHOLD ? Math.sign(projected) : 0;
      const requested = gestureBase.value + pendingSteps.value + direction;
      const available = Math.max(center.value - DAY_BUFFER_RADIUS, Math.min(center.value + DAY_BUFFER_RADIUS, requested));
      pendingSteps.value = requested - available;
      animateTo(available);
    })
    .onFinalize((event, success) => {
      queuedGesture.value = false;
      if (IS_ANDROID && !success && event.state === State.FAILED && event.oldState === State.BEGAN
        && gestureRevision.value === -1 && gestureLayoutEpoch.value === layoutEpoch.value
        && width.value > 0 && phase.value !== DRAGGING
        && Math.abs(event.absoluteY - gestureTouchY.value) <= VERTICAL_TOLERANCE) {
        const distance = (gestureTouchX.value - event.absoluteX) / width.value;
        if (Math.abs(distance) >= SWIPE_THRESHOLD) pendingSteps.value += Math.sign(distance);
      }
      if (phase.value === DRAGGING && gestureRevision.value === revision.value) {
        animateTo(gestureBase.value);
      }
    }), [animateTo, camera, center, gestureBase, gestureLayoutEpoch, gestureOrigin, gestureRevision, gestureTouchX, gestureTouchY, gestureTranslation, interruptible, layoutEpoch, pendingSteps, phase, queuedGesture, revision, startDrag, viewportWidth, weekTransition, width]);

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <View style={styles.viewport} onLayout={handleLayout}>
        <Animated.View testID="day-pager-track" pointerEvents="box-none" style={[
          styles.track,
          { left: -DAY_BUFFER_RADIUS * viewportWidth, width: (DAY_BUFFER_RADIUS * 2 + 1) * viewportWidth },
          trackStyle,
        ]}>
          {viewportWidth > 0 && window.pages.map((page) => (
            <PagerPage
              key={page.key}
              page={page}
              width={width}
              viewportWidth={viewportWidth}
              phase={phase}
              moving={moving}
              center={center}
              active={page.position === window.center}
              retained={isRequiredDayPosition(window, page.position)}
              renderDay={renderDay}
              onPageLayout={handlePageLayout}
              weekTransition={weekTransition}
              weekProgress={weekProgress}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}));

export default DayPager;

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  track: { position: "absolute", top: 0, bottom: 0 },
  page: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
