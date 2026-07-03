import React, {
  forwardRef,
  useCallback,
  useEffect,
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
  BottomSheetModal,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_SNAP_POINTS = ["48%", "90%"];
const DESKTOP_BREAKPOINT = 768;

const BottomSheet = forwardRef(function BottomSheet(
  {
    visible = true,
    onClose,
    onMinimize,
    onChange,
    children,
    header,
    backgroundColor = "#fff",
    handleColor = "rgba(120,120,128,0.55)",
    snapPoints = DEFAULT_SNAP_POINTS,
    initialSnapIndex,
    maxWidth = 720,
    backdropOpacity = 0.52,
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
  const visibleRef = useRef(visible);
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
    damping: 30,
    stiffness: 260,
    mass: 0.82,
    overshootClamping: false,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 0.5,
  });

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      dismissReasonRef.current = null;
      modalRef.current?.present();
    } else {
      dismissReasonRef.current = "controlled";
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const requestDismiss = useCallback(
    (reason = "close") => {
      dismissReasonRef.current = reason;
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    },
    []
  );

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
      requestDismiss(onMinimize ? "minimize" : "close");
      return true;
    });
    return () => subscription.remove();
  }, [onMinimize, requestDismiss, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestDismiss(onMinimize ? "minimize" : "close");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onMinimize, requestDismiss, visible]);

  const handleDismiss = useCallback(() => {
    const reason = dismissReasonRef.current;
    dismissReasonRef.current = null;
    
    if (!visibleRef.current || reason === "controlled") return;
    if (reason === "minimize" || (!reason && onMinimize)) {
      onMinimize?.();
      return;
    }
    onClose?.();
  }, [onClose, onMinimize]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        accessibilityRole="button"
        accessibilityLabel={closeAccessibilityLabel}
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
      topInset={Math.max(insets.top, 8)}
      bottomInset={isDesktop ? 16 : 0}
      detached={isDesktop}
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, { backgroundColor }]}
      handleStyle={[styles.handleArea, { backgroundColor }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: handleColor }]}
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
        {header}
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
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...(Platform.OS === "web" ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 } : null),
  },
  handleArea: {
    height: 36,
    paddingVertical: 0,
    justifyContent: "center",
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    overflow: "hidden",
  },
});

export default BottomSheet;
