import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  BackHandler,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetModal,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReduceMotion, useSharedValue } from "react-native-reanimated";
import { useBottomSheetPresentation } from "../../context/BottomSheetPresentationContext";
import useReducedMotionPreference from "../../hooks/useReducedMotionPreference";

const DEFAULT_SNAP_POINTS = ["48%", "90%"];
const DESKTOP_BREAKPOINT = 768;
const BOTTOM_SHEET_LAYER = 1000;

const BottomSheet = forwardRef(function BottomSheet(
  {
    visible = true,
    onClose,
    onMinimize,
    onChange,
    children,
    header,
    headerBackground,
    backgroundColor = "#fff",
    handleColor = "rgba(120,120,128,0.55)",
    snapPoints = DEFAULT_SNAP_POINTS,
    initialSnapIndex,
    maxWidth = 720,
    backdropOpacity = 0.36,
    closeOnBackdropPress = true,
    enablePanDownToClose = true,
    enableContentPanningGesture = false,
    keyboardBehavior = "interactive",
    stackBehavior = "push",
    contentStyle,
    sheetStyle,
    accessibilityLabel,
    closeAccessibilityLabel = "Close dialog",
    testID,
  },
  ref
) {
  const modalRef = useRef(null);
  const sheetId = useId();
  const animatedIndex = useSharedValue(-1);
  const { registerSheet, unregisterSheet, isTopSheet } = useBottomSheetPresentation();
  const reduceMotion = useReducedMotionPreference();
  const visibleRef = useRef(visible);
  const phaseRef = useRef("idle");
  const dismissReasonRef = useRef(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  const snapPointsKey = JSON.stringify(snapPoints);
  const resolvedSnapPoints = useMemo(
    () => (Array.isArray(snapPoints) && snapPoints.length ? snapPoints : DEFAULT_SNAP_POINTS),
    [snapPointsKey]
  );
  const openIndex = Math.max(
    0,
    Math.min(initialSnapIndex ?? resolvedSnapPoints.length - 1, resolvedSnapPoints.length - 1)
  );

  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 34,
    stiffness: 360,
    mass: 0.8,
    overshootClamping: true,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 0.5,
  });

  const present = useCallback(() => {
    phaseRef.current = "presented";
    dismissReasonRef.current = null;
    registerSheet(sheetId, animatedIndex);
    modalRef.current?.present();
  }, [animatedIndex, registerSheet, sheetId]);

  const requestDismiss = useCallback(
    (reason = "close") => {
      if (phaseRef.current !== "presented") return;
      phaseRef.current = "dismissing";
      dismissReasonRef.current = reason;
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    },
    []
  );

  useEffect(() => {
    visibleRef.current = visible;
    if (visible && phaseRef.current === "idle") present();
    if (!visible) requestDismiss("controlled");
  }, [present, requestDismiss, visible]);

  useEffect(() => () => unregisterSheet(sheetId), [sheetId, unregisterSheet]);

  useImperativeHandle(
    ref,
    () => ({
      close: () => requestDismiss("close"),
      dismiss: () => requestDismiss("close"),
      minimize: () => requestDismiss("minimize"),
      expand: () => modalRef.current?.snapToIndex(resolvedSnapPoints.length - 1),
      collapse: () => modalRef.current?.snapToIndex(0),
      snapToIndex: (index) => modalRef.current?.snapToIndex(index),
      snapToPosition: (position) => modalRef.current?.snapToPosition(position),
    }),
    [requestDismiss, resolvedSnapPoints.length]
  );

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isTopSheet(sheetId)) return false;
      requestDismiss(onMinimize ? "minimize" : "close");
      return true;
    });
    return () => subscription.remove();
  }, [isTopSheet, onMinimize, requestDismiss, sheetId, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || !isTopSheet(sheetId)) return;
      event.preventDefault();
      requestDismiss(onMinimize ? "minimize" : "close");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isTopSheet, onMinimize, requestDismiss, sheetId, visible]);

  const handleDismiss = useCallback(() => {
    phaseRef.current = "idle";
    unregisterSheet(sheetId);
    const reason = dismissReasonRef.current;
    dismissReasonRef.current = null;
    
    if (reason === "controlled") {
      if (visibleRef.current) present();
      return;
    }
    if (!visibleRef.current) return;
    if (reason === "minimize" || (!reason && onMinimize)) {
      onMinimize?.();
      return;
    }
    onClose?.();
  }, [onClose, onMinimize, present, sheetId, unregisterSheet]);

  const renderHandle = useCallback((props) => (
    <View style={{ backgroundColor }}>
      {headerBackground && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {headerBackground}
        </View>
      )}
      <BottomSheetHandle
        {...props}
        style={styles.handleArea}
        indicatorStyle={[styles.handle, { backgroundColor: handleColor }]}
        accessible={false}
      />
      {header}
    </View>
  ), [backgroundColor, handleColor, header, headerBackground]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        accessibilityRole="button"
        accessibilityLabel={closeAccessibilityLabel}
        accessible={closeOnBackdropPress}
        accessibilityHint={closeAccessibilityLabel}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={backdropOpacity}
        pressBehavior={closeOnBackdropPress ? "close" : "none"}
        onPress={() => {
          if (closeOnBackdropPress) {
            dismissReasonRef.current = onMinimize ? "minimize" : "close";
            Keyboard.dismiss();
          }
        }}
      />
    ),
    [backdropOpacity, closeAccessibilityLabel, closeOnBackdropPress, onMinimize]
  );

  const desktopWidth = Math.min(maxWidth, Math.max(320, width - 32));
  const maxDynamicContentSize = Math.max(240, height - insets.top - 16);

  return (
    <BottomSheetModal
      ref={modalRef}
      name={testID}
      index={openIndex}
      animatedIndex={animatedIndex}
      snapPoints={resolvedSnapPoints}
      stackBehavior={stackBehavior}
      animateOnMount
      enableDynamicSizing={false}
      enableDismissOnClose
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture
      enableOverDrag
      overDragResistanceFactor={3.2}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      maxDynamicContentSize={maxDynamicContentSize}
      topInset={Math.max(insets.top + 12, 20)}
      bottomInset={isDesktop ? 16 : 0}
      detached={isDesktop}
      animationConfigs={animationConfigs}
      overrideReduceMotion={reduceMotion ? ReduceMotion.Always : ReduceMotion.System}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      containerStyle={styles.modalContainer}
      backgroundStyle={[styles.background, { backgroundColor }]}
      style={[
        styles.sheet,
        { backgroundColor },
        isDesktop && { width: desktopWidth, marginLeft: (width - desktopWidth) / 2 },
        sheetStyle,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityViewIsModal
      onChange={onChange}
      onDismiss={handleDismiss}
    >
      <View
        style={[styles.content, { backgroundColor }, contentStyle]}
        testID={testID}
      >
        {children}
      </View>
    </BottomSheetModal>
  );
});

export const SheetScrollView = forwardRef(function SheetScrollView(
  { bounces = false, overScrollMode = "never", nestedScrollEnabled = true, ...props },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      bounces={bounces}
      overScrollMode={overScrollMode}
      nestedScrollEnabled={nestedScrollEnabled}
      directionalLockEnabled
      {...props}
    />
  );
});

export const SheetFlatList = forwardRef(function SheetFlatList(
  { bounces = false, overScrollMode = "never", nestedScrollEnabled = true, ...props },
  ref
) {
  return (
    <FlatList
      ref={ref}
      bounces={bounces}
      overScrollMode={overScrollMode}
      nestedScrollEnabled={nestedScrollEnabled}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    zIndex: BOTTOM_SHEET_LAYER,
    ...Platform.select({
      web: {
        overscrollBehavior: "contain",
      },
      default: {
        elevation: BOTTOM_SHEET_LAYER,
      },
    }),
  },
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...(Platform.OS === "web"
      ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
      : null),
    ...Platform.select({
      web: { boxShadow: "0 -18px 60px rgba(0,0,0,0.22)" },
      default: {
        elevation: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.2,
        shadowRadius: 28,
      },
    }),
  },
  background: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...(Platform.OS === "web" ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 } : null),
  },
  handleArea: {
    height: 44,
    paddingVertical: 0,
    justifyContent: "center",
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    overflow: "hidden",
    ...Platform.select({
      web: {
        overscrollBehavior: "contain",
      },
      default: null,
    }),
  },
});

export default BottomSheet;
