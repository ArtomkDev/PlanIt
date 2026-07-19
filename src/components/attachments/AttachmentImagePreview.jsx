import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Image as ImageIcon,
  WarningCircle,
  X,
} from "phosphor-react-native";

import {
  getAttachmentCacheState,
  ensureLocalAttachment,
  formatAttachmentError,
  isImageAttachment,
  openAttachment,
} from "../../services/attachmentService";
import MorphingLoader from "../ui/MorphingLoader";
import { t } from "../../utils/i18n";
import { triggerHaptic } from "../../utils/haptics";

const GALLERY_SPRING = {
  damping: 22,
  stiffness: 230,
  mass: 0.72,
};

const getAttachmentIdentity = (attachment = {}) => (
  attachment.id
  || attachment.storagePath
  || attachment.downloadURL
  || attachment.url
  || attachment.localUri
  || attachment.uri
  || attachment.name
);

const getAttachmentPreviewUri = (attachment = {}) => (
  attachment.localUri
  || attachment.openUri
  || attachment.uri
  || attachment.downloadURL
  || attachment.url
  || ""
);

const dedupeImageAttachments = (attachments, activeAttachment) => {
  const byKey = new Map();

  const add = (attachment) => {
    if (!attachment || !isImageAttachment(attachment)) return;
    const key = getAttachmentIdentity(attachment);
    if (!key || byKey.has(key)) return;
    byKey.set(key, attachment);
  };

  (Array.isArray(attachments) ? attachments : []).forEach(add);
  add(activeAttachment);

  return Array.from(byKey.values());
};

const clampIndex = (index, count) => (
  Math.max(0, Math.min(count - 1, index))
);

export default function AttachmentImagePreview({
  visible,
  attachment,
  attachments,
  onClose,
  onCacheStateChange,
  themeColors,
  lang,
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const galleryListRef = useRef(null);
  const thumbnailListRef = useRef(null);
  const closingRef = useRef(false);
  const resolvingKeysRef = useRef(new Set());
  const resolvedUrisRef = useRef({});

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const imageScale = useSharedValue(0.985);
  const backdropOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-12);
  const railTranslateY = useSharedValue(18);

  const [activeIndex, setActiveIndex] = useState(0);
  const [resolvedUris, setResolvedUris] = useState({});
  const [state, setState] = useState({
    loading: false,
    saving: false,
    error: "",
  });

  const imageAttachments = useMemo(
    () => dedupeImageAttachments(attachments, attachment),
    [attachment, attachments]
  );
  const requestedIndex = useMemo(() => {
    if (!attachment) return 0;
    const requestedKey = getAttachmentIdentity(attachment);
    const nextIndex = imageAttachments.findIndex((item) => getAttachmentIdentity(item) === requestedKey);
    return nextIndex >= 0 ? nextIndex : 0;
  }, [attachment, imageAttachments]);
  const canNavigate = imageAttachments.length > 1;
  const showArrowNavigation = canNavigate && Platform.OS === "web" && width >= 768;
  const activeAttachment = imageAttachments[activeIndex] || attachment;
  const counterLabel = canNavigate ? `${activeIndex + 1}/${imageAttachments.length}` : "";
  const backgroundColor = themeColors?.mode === "light" ? "#0B0B0F" : "#000";
  const textColor = "#fff";

  useEffect(() => {
    resolvedUrisRef.current = resolvedUris;
  }, [resolvedUris]);

  const getDisplayUri = useCallback((item) => {
    const key = getAttachmentIdentity(item);
    return (key && resolvedUris[key]) || getAttachmentPreviewUri(item);
  }, [resolvedUris]);

  const rememberResolvedAttachment = useCallback((item) => {
    const key = getAttachmentIdentity(item);
    const uri = getAttachmentPreviewUri(item);
    if (!key || !uri) return;

    setResolvedUris((currentUris) => (
      currentUris[key] === uri ? currentUris : { ...currentUris, [key]: uri }
    ));
    onCacheStateChange?.(item);
  }, [onCacheStateChange]);

  const resolveAttachmentForPreview = useCallback(async (item, { active = false } = {}) => {
    const key = getAttachmentIdentity(item);
    if (!key || !isImageAttachment(item)) return;

    const initialUri = resolvedUrisRef.current[key] || getAttachmentPreviewUri(item);
    if (active) {
      setState((prev) => ({
        ...prev,
        loading: !initialUri,
        error: "",
      }));
    }

    if (initialUri) {
      setResolvedUris((currentUris) => (
        currentUris[key] ? currentUris : { ...currentUris, [key]: initialUri }
      ));
    }

    if (resolvingKeysRef.current.has(key)) return;
    resolvingKeysRef.current.add(key);

    try {
      const cacheState = await getAttachmentCacheState(item);
      if (
        (cacheState.status === "local" || cacheState.status === "source")
        && cacheState.uri
      ) {
        rememberResolvedAttachment({
          ...item,
          localUri: cacheState.uri,
          openUri: cacheState.uri,
          cacheState: cacheState.status,
        });
        if (active) {
          setState((prev) => ({ ...prev, loading: false, error: "" }));
        }
        return;
      }

      const prepared = await ensureLocalAttachment(item);
      rememberResolvedAttachment(prepared);
      if (active) {
        setState((prev) => ({ ...prev, loading: false, error: "" }));
      }
    } catch (error) {
      if (active) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatAttachmentError(error, lang),
        }));
      }
    } finally {
      resolvingKeysRef.current.delete(key);
    }
  }, [lang, rememberResolvedAttachment]);

  const scrollGalleryToIndex = useCallback((index, animated = true) => {
    const nextIndex = clampIndex(index, imageAttachments.length);
    if (!imageAttachments.length) return;

    galleryListRef.current?.scrollToIndex({
      index: nextIndex,
      animated,
      viewPosition: 0,
    });
  }, [imageAttachments.length]);

  const goToIndex = useCallback((nextIndex, animated = true) => {
    if (nextIndex < 0 || nextIndex >= imageAttachments.length) return;
    if (nextIndex !== activeIndex) {
      triggerHaptic("selection");
      setState((prev) => ({ ...prev, error: "" }));
      setActiveIndex(nextIndex);
    }
    scrollGalleryToIndex(nextIndex, animated);
  }, [activeIndex, imageAttachments.length, scrollGalleryToIndex]);

  const goToOffset = useCallback((offset) => {
    if (!canNavigate) return;
    const count = imageAttachments.length;
    goToIndex((activeIndex + offset + count) % count);
  }, [activeIndex, canNavigate, goToIndex, imageAttachments.length]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    onClose?.();
  }, [onClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    triggerHaptic("sheetClose");

    chromeOpacity.value = withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) });
    headerTranslateY.value = withTiming(-14, { duration: 170, easing: Easing.out(Easing.cubic) });
    railTranslateY.value = withTiming(20, { duration: 170, easing: Easing.out(Easing.cubic) });
    dragY.value = withTiming(28, { duration: 210, easing: Easing.out(Easing.cubic) });
    dragX.value = withTiming(0, { duration: 210, easing: Easing.out(Easing.cubic) });
    imageScale.value = withTiming(0.965, { duration: 210, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(0, {
      duration: 210,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [backdropOpacity, chromeOpacity, dragX, dragY, finishClose, headerTranslateY, imageScale, railTranslateY]);

  useEffect(() => {
    if (!visible || !attachment) return;

    setActiveIndex(requestedIndex);

    const frame = requestAnimationFrame(() => {
      scrollGalleryToIndex(requestedIndex, false);
    });
    return () => cancelAnimationFrame(frame);
  }, [attachment, requestedIndex, scrollGalleryToIndex, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    closingRef.current = false;
    dragX.value = 0;
    dragY.value = 0;
    imageScale.value = 0.985;
    backdropOpacity.value = 0;
    chromeOpacity.value = 0;
    headerTranslateY.value = -12;
    railTranslateY.value = 18;

    const frame = requestAnimationFrame(() => {
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      chromeOpacity.value = withTiming(1, { duration: 210, easing: Easing.out(Easing.cubic) });
      headerTranslateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      railTranslateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      imageScale.value = withSpring(1, GALLERY_SPRING);
    });

    return () => cancelAnimationFrame(frame);
  }, [backdropOpacity, chromeOpacity, dragX, dragY, headerTranslateY, imageScale, railTranslateY, visible]);

  useEffect(() => {
    if (!visible || !activeAttachment) return;

    resolveAttachmentForPreview(activeAttachment, { active: true });
    [activeIndex - 1, activeIndex + 1]
      .filter((index) => index >= 0 && index < imageAttachments.length)
      .forEach((index) => resolveAttachmentForPreview(imageAttachments[index]));
  }, [activeAttachment, activeIndex, imageAttachments, resolveAttachmentForPreview, visible]);

  useEffect(() => {
    if (!visible || !canNavigate) return;

    thumbnailListRef.current?.scrollToIndex({
      index: activeIndex,
      animated: true,
      viewPosition: 0.5,
    });
  }, [activeIndex, canNavigate, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToOffset(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToOffset(1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, goToOffset, visible]);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: imageScale.value },
    ],
  }));

  const topChromeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const bottomChromeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
    transform: [{ translateY: railTranslateY.value }],
  }));

  const dismissGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      const y = Math.max(0, event.translationY);
      const progress = Math.min(1, y / Math.max(height * 0.45, 1));

      dragY.value = y;
      dragX.value = event.translationX * 0.06;
      imageScale.value = Math.max(0.88, 1 - progress * 0.13);
      backdropOpacity.value = Math.max(0.18, 1 - progress * 0.72);
      chromeOpacity.value = Math.max(0, 1 - progress * 1.45);
      headerTranslateY.value = -12 * progress;
      railTranslateY.value = 18 * progress;
    })
    .onEnd((event) => {
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const shouldClose = (
        (event.translationY > 112 && absY > absX * 0.85)
        || (event.translationY > 28 && event.velocityY > 900 && absY > absX * 0.65)
      );

      if (shouldClose) {
        runOnJS(triggerHaptic)("sheetClose");
        chromeOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
        headerTranslateY.value = withTiming(-16, { duration: 170, easing: Easing.out(Easing.cubic) });
        railTranslateY.value = withTiming(22, { duration: 170, easing: Easing.out(Easing.cubic) });
        dragY.value = withTiming(Math.max(height, 1), { duration: 230, easing: Easing.out(Easing.cubic) });
        dragX.value = withTiming(event.translationX * 0.12, { duration: 230, easing: Easing.out(Easing.cubic) });
        imageScale.value = withTiming(0.88, { duration: 230, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(0, {
          duration: 210,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        return;
      }

      dragX.value = withSpring(0, GALLERY_SPRING);
      dragY.value = withSpring(0, GALLERY_SPRING);
      imageScale.value = withSpring(1, GALLERY_SPRING);
      backdropOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
      chromeOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
      headerTranslateY.value = withSpring(0, GALLERY_SPRING);
      railTranslateY.value = withSpring(0, GALLERY_SPRING);
    }), [
    backdropOpacity,
    chromeOpacity,
    dragX,
    dragY,
    finishClose,
    headerTranslateY,
    height,
    imageScale,
    railTranslateY,
  ]);

  const handleGalleryMomentumEnd = useCallback((event) => {
    const nextIndex = clampIndex(
      Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)),
      imageAttachments.length
    );
    if (nextIndex !== activeIndex) {
      triggerHaptic("selection");
      setState((prev) => ({ ...prev, error: "" }));
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, imageAttachments.length, width]);

  const handleDownload = async () => {
    if (!activeAttachment || state.saving) return;

    const activeUri = getDisplayUri(activeAttachment);
    const downloadableAttachment = activeUri
      ? { ...activeAttachment, localUri: activeUri, openUri: activeUri }
      : activeAttachment;

    try {
      triggerHaptic("open");
      setState((prev) => ({ ...prev, saving: true, error: "" }));

      if (Platform.OS === "web") {
        await openAttachment(downloadableAttachment, { download: true });
        setState((prev) => ({ ...prev, saving: false }));
        return;
      }

      const prepared = await openAttachment(downloadableAttachment, { download: true });
      rememberResolvedAttachment(prepared);
      setState((prev) => ({
        ...prev,
        loading: false,
        saving: false,
        error: "",
      }));
      triggerHaptic("success");
    } catch (error) {
      triggerHaptic("error");
      setState((prev) => ({
        ...prev,
        saving: false,
        error: formatAttachmentError(error, lang),
      }));
    }
  };

  const renderGalleryItem = useCallback(({ item }) => {
    const uri = getDisplayUri(item);

    return (
      <View style={[styles.galleryPage, { width }]}>
        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="contain"
            fadeDuration={140}
            style={styles.image}
          />
        ) : (
          <View style={styles.emptyImagePage}>
            <ImageIcon size={42} color="rgba(255,255,255,0.62)" weight="bold" />
          </View>
        )}
      </View>
    );
  }, [getDisplayUri, width]);

  const renderThumbnail = useCallback(({ item, index }) => {
    const uri = getDisplayUri(item);
    const isActive = index === activeIndex;

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => goToIndex(index)}
        style={[
          styles.thumbnailButton,
          isActive ? styles.thumbnailButtonActive : null,
        ]}
        accessibilityRole="button"
      >
        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="cover"
            fadeDuration={100}
            style={styles.thumbnailImage}
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <ImageIcon size={24} color="rgba(255,255,255,0.72)" weight="bold" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [activeIndex, getDisplayUri, goToIndex]);

  const handleScrollToIndexFailed = useCallback((info) => {
    const fallbackOffset = Math.max(0, info.index * Math.max(width, 1));
    requestAnimationFrame(() => {
      galleryListRef.current?.scrollToOffset({ offset: fallbackOffset, animated: false });
    });
  }, [width]);

  const handleThumbnailScrollToIndexFailed = useCallback((info) => {
    requestAnimationFrame(() => {
      thumbnailListRef.current?.scrollToOffset({
        offset: Math.max(0, info.index * 68 - 24),
        animated: true,
      });
    });
  }, []);

  if (!visible || !activeAttachment) return null;

  const activeUri = getDisplayUri(activeAttachment);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={close}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            { backgroundColor },
            modalAnimatedStyle,
          ]}
        />

        <View style={styles.container}>
          <Animated.View
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top, 14),
              },
              topChromeAnimatedStyle,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={close}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.close", lang)}
            >
              <X size={24} color={textColor} weight="bold" />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                {activeAttachment.name || t("attachments.file", lang)}
              </Text>
              {!!counterLabel && (
                <Text style={styles.counterText} numberOfLines={1}>
                  {counterLabel}
                </Text>
              )}
              {!!state.error && (
                <View style={styles.errorRow}>
                  <WarningCircle size={14} color="#FF453A" weight="bold" />
                  <Text style={styles.errorText} numberOfLines={1}>
                    {state.error}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.72}
              disabled={state.saving}
              onPress={handleDownload}
              style={[styles.headerButton, state.saving ? styles.disabledButton : null]}
              accessibilityRole="button"
              accessibilityLabel={t("attachments.download", lang)}
            >
              {state.saving ? (
                <MorphingLoader size={24} />
              ) : (
                <DownloadSimple size={23} color={textColor} weight="bold" />
              )}
            </TouchableOpacity>
          </Animated.View>

          <GestureDetector gesture={dismissGesture}>
            <Animated.View style={[styles.imageStage, stageAnimatedStyle]}>
              <FlatList
                ref={galleryListRef}
                data={imageAttachments}
                extraData={resolvedUris}
                style={styles.galleryList}
                initialScrollIndex={requestedIndex}
                keyExtractor={(item, index) => getAttachmentIdentity(item) || `image-${index}`}
                renderItem={renderGalleryItem}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                disableIntervalMomentum
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={3}
                removeClippedSubviews={Platform.OS !== "web"}
                getItemLayout={(_, index) => ({
                  length: Math.max(width, 1),
                  offset: Math.max(width, 1) * index,
                  index,
                })}
                onMomentumScrollEnd={handleGalleryMomentumEnd}
                onScrollToIndexFailed={handleScrollToIndexFailed}
              />

              {state.loading && !activeUri && (
                <View style={styles.loadingLayer}>
                  <MorphingLoader size={64} />
                </View>
              )}

              {showArrowNavigation && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => goToOffset(-1)}
                    style={[styles.navButton, styles.navButtonLeft]}
                    accessibilityRole="button"
                  >
                    <CaretLeft size={28} color={textColor} weight="bold" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => goToOffset(1)}
                    style={[styles.navButton, styles.navButtonRight]}
                    accessibilityRole="button"
                  >
                    <CaretRight size={28} color={textColor} weight="bold" />
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </GestureDetector>

          {canNavigate && (
            <Animated.View
              style={[
                styles.thumbnailRail,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                },
                bottomChromeAnimatedStyle,
              ]}
            >
              <FlatList
                ref={thumbnailListRef}
                data={imageAttachments}
                extraData={`${activeIndex}:${Object.keys(resolvedUris).length}`}
                keyExtractor={(item, index) => getAttachmentIdentity(item) || `thumb-${index}`}
                renderItem={renderThumbnail}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailContent}
                getItemLayout={(_, index) => ({
                  length: 68,
                  offset: 68 * index,
                  index,
                })}
                onScrollToIndexFailed={handleThumbnailScrollToIndexFailed}
              />
            </Animated.View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  disabledButton: {
    opacity: 0.62,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  title: {
    maxWidth: "100%",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  counterText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 1,
  },
  errorRow: {
    maxWidth: "100%",
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  errorText: {
    flexShrink: 1,
    minWidth: 0,
    color: "#FF453A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginLeft: 4,
  },
  imageStage: {
    flex: 1,
    overflow: "hidden",
  },
  galleryList: {
    flex: 1,
  },
  galleryPage: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyImagePage: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  navButton: {
    position: "absolute",
    top: "50%",
    width: 48,
    height: 56,
    marginTop: -28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  navButtonLeft: {
    left: 12,
  },
  navButtonRight: {
    right: 12,
  },
  thumbnailRail: {
    paddingTop: 10,
    backgroundColor: "rgba(0,0,0,0.74)",
  },
  thumbnailContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  thumbnailButton: {
    width: 58,
    height: 58,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  thumbnailButtonActive: {
    borderColor: "#fff",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
