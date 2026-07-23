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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
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
  CornersIn,
  DownloadSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ShareNetwork,
  WarningCircle,
  X,
} from "phosphor-react-native";

import {
  getAttachmentCacheState,
  ensureLocalAttachment,
  formatAttachmentError,
  getAttachmentShareLabel,
  isImageAttachment,
  openAttachment,
  shareAttachment,
} from "../../services/attachmentService";
import MorphingLoader from "../ui/MorphingLoader";
import AndroidPagerView from "./AndroidPagerView";
import StagedAttachmentImage, { AttachmentImageLoadingOverlay } from "./StagedAttachmentImage";
import { t } from "../../utils/i18n";
import { triggerHaptic } from "../../utils/haptics";

const GALLERY_SPRING = {
  damping: 22,
  stiffness: 230,
  mass: 0.72,
};

const ZOOM_SPRING = {
  damping: 24,
  stiffness: 245,
  mass: 0.68,
};

const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.35;
const ZOOMED_EPSILON = 0.015;
const WIDE_LAYOUT_WIDTH = 768;
const EDGE_SWIPE_COMMIT_RATIO = 0.22;
const EDGE_SWIPE_VELOCITY = 640;
const IS_ANDROID = Platform.OS === "android";
const USE_ANDROID_NATIVE_PAGER = IS_ANDROID;
const ANDROID_PAGER_RENDER_DISTANCE = 1;
const ANDROID_DISMISS_ACTIVATION_Y = 18;
const ANDROID_DISMISS_FAIL_OFFSET_X = 14;
const ANDROID_PAGER_SETTLE_DELAY_MS = 80;
const ANDROID_PAGER_FORCE_SETTLE_DELAY_MS = 720;
const ANDROID_PREVIEW_CACHE_DELAY_MS = 240;
const DISMISS_COMMIT_DISTANCE = IS_ANDROID ? 38 : 112;
const DISMISS_FLING_DISTANCE = IS_ANDROID ? 12 : 28;
const DISMISS_FLING_VELOCITY = IS_ANDROID ? 520 : 900;
const DISMISS_COMMIT_VERTICAL_RATIO = IS_ANDROID ? 0.48 : 0.85;
const DISMISS_FLING_VERTICAL_RATIO = IS_ANDROID ? 0.38 : 0.65;
const DISMISS_CANCEL_COMMIT_DISTANCE = IS_ANDROID ? 30 : 112;
const GALLERY_SNAP_EPSILON = 1.5;
const GALLERY_SETTLE_DELAY_MS = 90;
const loadedZoomImageKeys = new Set();

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

const getAttachmentRenderRevision = (attachment = {}) => (
  attachment.cacheRevision
  || attachment.cloudRevision
  || attachment.uploadedAt
  || attachment.updatedAt
  || attachment.createdAt
  || attachment.size
  || ""
);

const getAttachmentLoadKey = (attachment = {}, uri = "", fallbackKey = "") => {
  const identity = getAttachmentIdentity(attachment) || fallbackKey || uri;
  if (!identity) return uri || "";

  const revision = getAttachmentRenderRevision(attachment);
  return revision ? `${identity}:${revision}` : identity;
};

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

const getContainedImageSize = (imageSize, boxWidth, boxHeight) => {
  const safeWidth = Math.max(boxWidth, 1);
  const safeHeight = Math.max(boxHeight, 1);
  const imageWidth = imageSize?.width || 0;
  const imageHeight = imageSize?.height || 0;

  if (!imageWidth || !imageHeight) {
    return { width: safeWidth, height: safeHeight };
  }

  const boxRatio = safeWidth / safeHeight;
  const imageRatio = imageWidth / imageHeight;

  if (imageRatio > boxRatio) {
    return {
      width: safeWidth,
      height: safeWidth / imageRatio,
    };
  }

  return {
    width: safeHeight * imageRatio,
    height: safeHeight,
  };
};

const getKnownAttachmentImageSize = (attachment = {}) => {
  const compressionWidth = Number(attachment?.compression?.width) || 0;
  const compressionHeight = Number(attachment?.compression?.height) || 0;
  if (compressionWidth > 0 && compressionHeight > 0) {
    return { width: compressionWidth, height: compressionHeight };
  }

  const previewWidth = Number(attachment?.imagePreview?.width) || 0;
  const previewHeight = Number(attachment?.imagePreview?.height) || 0;
  if (previewWidth > 0 && previewHeight > 0) {
    return { width: previewWidth, height: previewHeight };
  }

  return null;
};

function ZoomableImagePage({
  attachment,
  uri,
  previousUri,
  nextUri,
  index,
  pageWidth,
  pageHeight,
  active,
  zoomActive,
  resetToken,
  zoomCommand,
  onZoomChange,
  onZoomEdgeSwipe = () => {},
  showEdgePreviews = true,
  dismissGesture = null,
}) {
  const knownImageSize = useMemo(() => getKnownAttachmentImageSize(attachment), [attachment]);
  const [imageSize, setImageSize] = useState(knownImageSize);
  const loadedImageKeyRef = useRef("");
  const [loadedImageKey, setLoadedImageKey] = useState("");
  const [failedImageSignature, setFailedImageSignature] = useState("");
  const handledCommandTokenRef = useRef(null);
  const imageKey = useMemo(
    () => getAttachmentIdentity(attachment) || uri || `image-${index}`,
    [attachment, index, uri]
  );
  const imageLoadKey = useMemo(
    () => getAttachmentLoadKey(attachment, uri, imageKey),
    [attachment, imageKey, uri]
  );
  const imageSignature = `${imageKey}:${uri || ""}`;
  const imageLoaded = (
    (!!imageLoadKey && loadedZoomImageKeys.has(imageLoadKey))
    || loadedImageKey === imageLoadKey
  );
  const imageFailed = failedImageSignature === imageSignature && !imageLoaded;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchStartFocalX = useSharedValue(0);
  const pinchStartFocalY = useSharedValue(0);
  const fitWidth = useSharedValue(Math.max(pageWidth, 1));
  const fitHeight = useSharedValue(Math.max(pageHeight, 1));
  const imageOpacity = useSharedValue(1);
  const edgeDragX = useSharedValue(0);
  const edgeDirection = useSharedValue(0);
  const panStartedAtMinX = useSharedValue(false);
  const panStartedAtMaxX = useSharedValue(false);

  const notifyZoomChange = useCallback((nextZoomed) => {
    onZoomChange?.(index, nextZoomed);
  }, [index, onZoomChange]);

  const resetZoom = useCallback((animated = true) => {
    if (animated) {
      scale.value = withSpring(1, ZOOM_SPRING);
      translateX.value = withSpring(0, ZOOM_SPRING);
      translateY.value = withSpring(0, ZOOM_SPRING);
      edgeDragX.value = withSpring(0, ZOOM_SPRING);
    } else {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      edgeDragX.value = 0;
    }

    edgeDirection.value = 0;
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    notifyZoomChange(false);
  }, [
    notifyZoomChange,
    edgeDirection,
    edgeDragX,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
  ]);

  const animateToScale = useCallback((targetScale) => {
    const nextScale = Math.max(1, Math.min(MAX_ZOOM, targetScale));
    if (nextScale <= 1 + ZOOMED_EPSILON) {
      resetZoom(true);
      return;
    }

    const currentScale = Math.max(scale.value || 1, 1);
    const scaleDelta = nextScale / currentScale;
    const maxX = Math.max(0, (fitWidth.value * nextScale - pageWidth) / 2);
    const maxY = Math.max(0, (fitHeight.value * nextScale - pageHeight) / 2);
    const nextX = Math.max(-maxX, Math.min(maxX, translateX.value * scaleDelta));
    const nextY = Math.max(-maxY, Math.min(maxY, translateY.value * scaleDelta));

    scale.value = withSpring(nextScale, ZOOM_SPRING);
    translateX.value = withSpring(nextX, ZOOM_SPRING);
    translateY.value = withSpring(nextY, ZOOM_SPRING);
    savedScale.value = nextScale;
    savedTranslateX.value = nextX;
    savedTranslateY.value = nextY;
    notifyZoomChange(true);
  }, [
    fitHeight,
    fitWidth,
    notifyZoomChange,
    pageHeight,
    pageWidth,
    resetZoom,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
  ]);

  useEffect(() => {
    setImageSize(knownImageSize);
    setFailedImageSignature((currentSignature) => (
      currentSignature.startsWith(`${imageKey}:`) && currentSignature !== imageSignature
        ? ""
        : currentSignature
    ));
    if (
      loadedImageKeyRef.current !== imageLoadKey
      && !loadedZoomImageKeys.has(imageLoadKey)
    ) {
      setLoadedImageKey("");
    }
    if (!uri || Platform.OS === "android") return undefined;

    let mounted = true;
    Image.getSize(
      uri,
      (naturalWidth, naturalHeight) => {
        if (!mounted) return;
        setImageSize({ width: naturalWidth, height: naturalHeight });
      },
      () => {}
    );

    return () => {
      mounted = false;
    };
  }, [imageKey, imageLoadKey, imageSignature, knownImageSize, uri]);

  useEffect(() => {
    const fittedSize = getContainedImageSize(imageSize, pageWidth, pageHeight);
    fitWidth.value = fittedSize.width;
    fitHeight.value = fittedSize.height;
  }, [fitHeight, fitWidth, imageSize, pageHeight, pageWidth]);

  useEffect(() => {
    resetZoom(false);
  }, [pageHeight, pageWidth, resetToken, resetZoom]);

  useEffect(() => {
    imageOpacity.value = 1;
  }, [imageOpacity, uri]);

  useEffect(() => {
    if (!active) {
      resetZoom(false);
    }
  }, [active, resetZoom]);

  useEffect(() => {
    if (!active || !zoomCommand?.token || handledCommandTokenRef.current === zoomCommand.token) return;

    handledCommandTokenRef.current = zoomCommand.token;
    if (zoomCommand.type === "reset") {
      resetZoom(true);
    } else if (zoomCommand.type === "in") {
      animateToScale((scale.value || 1) * 1.38);
    } else if (zoomCommand.type === "out") {
      animateToScale((scale.value || 1) / 1.38);
    }
  }, [active, animateToScale, resetZoom, scale, zoomCommand]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .enabled(active && !!uri)
    .onBegin(() => {
      runOnJS(notifyZoomChange)(true);
    })
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      pinchStartFocalX.value = (event.focalX || pageWidth / 2) - pageWidth / 2;
      pinchStartFocalY.value = (event.focalY || pageHeight / 2) - pageHeight / 2;
    })
    .onUpdate((event) => {
      const baseScale = Math.max(savedScale.value, 1);
      const nextScale = Math.max(1, Math.min(MAX_ZOOM, baseScale * event.scale));
      const scaleDelta = nextScale / baseScale;
      const focalX = (event.focalX || pageWidth / 2) - pageWidth / 2;
      const focalY = (event.focalY || pageHeight / 2) - pageHeight / 2;
      const maxX = Math.max(0, (fitWidth.value * nextScale - pageWidth) / 2);
      const maxY = Math.max(0, (fitHeight.value * nextScale - pageHeight) / 2);
      const nextX = (
        savedTranslateX.value * scaleDelta
        + (focalX - pinchStartFocalX.value)
        + pinchStartFocalX.value * (1 - scaleDelta)
      );
      const nextY = (
        savedTranslateY.value * scaleDelta
        + (focalY - pinchStartFocalY.value)
        + pinchStartFocalY.value * (1 - scaleDelta)
      );

      scale.value = nextScale;
      translateX.value = Math.max(-maxX, Math.min(maxX, nextX));
      translateY.value = Math.max(-maxY, Math.min(maxY, nextY));
    })
    .onEnd((event) => {
      if (scale.value <= 1 + ZOOMED_EPSILON) {
        scale.value = withSpring(1, ZOOM_SPRING);
        translateX.value = withSpring(0, ZOOM_SPRING);
        translateY.value = withSpring(0, ZOOM_SPRING);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoomChange)(false);
        return;
      }

      const maxX = Math.max(0, (fitWidth.value * scale.value - pageWidth) / 2);
      const maxY = Math.max(0, (fitHeight.value * scale.value - pageHeight) / 2);
      const nextX = Math.max(-maxX, Math.min(maxX, translateX.value));
      const nextY = Math.max(-maxY, Math.min(maxY, translateY.value));

      translateX.value = withSpring(nextX, ZOOM_SPRING);
      translateY.value = withSpring(nextY, ZOOM_SPRING);
      savedScale.value = scale.value;
      savedTranslateX.value = nextX;
      savedTranslateY.value = nextY;
      runOnJS(notifyZoomChange)(true);
    })
    .onFinalize((_, success) => {
      if (success) return;
      if (scale.value <= 1 + ZOOMED_EPSILON) {
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoomChange)(false);
      }
    }), [
    active,
    fitHeight,
    fitWidth,
    notifyZoomChange,
    pageHeight,
    pageWidth,
    pinchStartFocalX,
    pinchStartFocalY,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
    uri,
  ]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(active && zoomActive && !!uri)
    .minDistance(1)
    .averageTouches(true)
    .onStart(() => {
      const maxX = Math.max(0, (fitWidth.value * scale.value - pageWidth) / 2);

      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      panStartedAtMinX.value = maxX > 2 && translateX.value <= -maxX + 3;
      panStartedAtMaxX.value = maxX > 2 && translateX.value >= maxX - 3;
      edgeDragX.value = 0;
      edgeDirection.value = 0;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (fitWidth.value * scale.value - pageWidth) / 2);
      const maxY = Math.max(0, (fitHeight.value * scale.value - pageHeight) / 2);
      const rawX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      const hasPrevious = !!previousUri;
      const hasNext = !!nextUri;
      const previousOverflow = Math.max(0, rawX - maxX);
      const nextOverflow = Math.max(0, -maxX - rawX);

      if (previousOverflow > 0 && hasPrevious && panStartedAtMaxX.value) {
        edgeDirection.value = -1;
        edgeDragX.value = Math.min(previousOverflow, pageWidth);
        translateX.value = maxX;
        translateY.value = Math.max(-maxY, Math.min(maxY, nextY * 0.72));
        return;
      }

      if (nextOverflow > 0 && hasNext && panStartedAtMinX.value) {
        edgeDirection.value = 1;
        edgeDragX.value = -Math.min(nextOverflow, pageWidth);
        translateX.value = -maxX;
        translateY.value = Math.max(-maxY, Math.min(maxY, nextY * 0.72));
        return;
      }

      edgeDirection.value = 0;
      edgeDragX.value = 0;

      translateX.value = Math.max(-maxX, Math.min(maxX, rawX));
      translateY.value = Math.max(-maxY, Math.min(maxY, nextY));
    })
    .onEnd((event) => {
      const maxX = Math.max(0, (fitWidth.value * scale.value - pageWidth) / 2);
      const maxY = Math.max(0, (fitHeight.value * scale.value - pageHeight) / 2);
      const nextX = Math.max(-maxX, Math.min(maxX, translateX.value));
      const nextY = Math.max(-maxY, Math.min(maxY, translateY.value));
      const direction = edgeDirection.value;
      const edgeDistance = Math.abs(edgeDragX.value);
      const wantsPrevious = direction === -1 && event.velocityX > EDGE_SWIPE_VELOCITY;
      const wantsNext = direction === 1 && event.velocityX < -EDGE_SWIPE_VELOCITY;
      const shouldCommit = direction !== 0 && (
        edgeDistance > pageWidth * EDGE_SWIPE_COMMIT_RATIO
        || wantsPrevious
        || wantsNext
      );

      if (shouldCommit) {
        const targetX = direction === -1 ? pageWidth : -pageWidth;

        scale.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) });
        translateX.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, {
          duration: 170,
          easing: Easing.out(Easing.cubic),
        });
        edgeDragX.value = withTiming(targetX, {
          duration: 170,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) runOnJS(onZoomEdgeSwipe)(direction);
        });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoomChange)(false);
        return;
      }

      edgeDragX.value = withSpring(0, ZOOM_SPRING);
      edgeDirection.value = 0;
      translateX.value = withSpring(nextX, ZOOM_SPRING);
      translateY.value = withSpring(nextY, ZOOM_SPRING);
      savedTranslateX.value = nextX;
      savedTranslateY.value = nextY;
    }), [
    active,
    fitHeight,
    fitWidth,
    pageHeight,
    pageWidth,
    edgeDirection,
    edgeDragX,
    nextUri,
    panStartedAtMaxX,
    panStartedAtMinX,
    previousUri,
    savedTranslateX,
    savedTranslateY,
    savedScale,
    scale,
    translateX,
    translateY,
    notifyZoomChange,
    onZoomEdgeSwipe,
    uri,
    zoomActive,
  ]);

  const doubleTapGesture = useMemo(() => Gesture.Tap()
    .enabled(active && !!uri)
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((event, success) => {
      if (!success) return;

      if (scale.value > 1 + ZOOMED_EPSILON) {
        scale.value = withSpring(1, ZOOM_SPRING);
        translateX.value = withSpring(0, ZOOM_SPRING);
        translateY.value = withSpring(0, ZOOM_SPRING);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoomChange)(false);
        return;
      }

      const nextScale = DOUBLE_TAP_ZOOM;
      const tapX = (event.x || pageWidth / 2) - pageWidth / 2;
      const tapY = (event.y || pageHeight / 2) - pageHeight / 2;
      const maxX = Math.max(0, (fitWidth.value * nextScale - pageWidth) / 2);
      const maxY = Math.max(0, (fitHeight.value * nextScale - pageHeight) / 2);
      const nextX = Math.max(-maxX, Math.min(maxX, tapX * (1 - nextScale)));
      const nextY = Math.max(-maxY, Math.min(maxY, tapY * (1 - nextScale)));

      scale.value = withSpring(nextScale, ZOOM_SPRING);
      translateX.value = withSpring(nextX, ZOOM_SPRING);
      translateY.value = withSpring(nextY, ZOOM_SPRING);
      savedScale.value = nextScale;
      savedTranslateX.value = nextX;
      savedTranslateY.value = nextY;
      runOnJS(notifyZoomChange)(true);
    }), [
    active,
    fitHeight,
    fitWidth,
    notifyZoomChange,
    pageHeight,
    pageWidth,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
    uri,
  ]);

  const imageGesture = useMemo(
    () => (
      dismissGesture
        ? Gesture.Simultaneous(dismissGesture, pinchGesture, panGesture, doubleTapGesture)
        : Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture)
    ),
    [dismissGesture, doubleTapGesture, panGesture, pinchGesture]
  );

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const edgeProgress = Math.min(1, Math.abs(edgeDragX.value) / Math.max(pageWidth * 0.72, 1));
    const easedEdgeProgress = 1 - Math.pow(1 - edgeProgress, 2);
    const visualScale = scale.value - (scale.value - 1) * easedEdgeProgress;

    return {
      opacity: imageOpacity.value,
      transform: [
        { translateX: translateX.value * (1 - easedEdgeProgress) + edgeDragX.value },
        { translateY: translateY.value * (1 - easedEdgeProgress) },
        { scale: visualScale },
      ],
    };
  });

  const previousPreviewAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(edgeDragX.value) / Math.max(pageWidth * 0.72, 1));
    const activePreview = edgeDirection.value === -1;

    return {
      opacity: activePreview ? Math.min(1, progress * 1.35) : 0,
      transform: [
        { translateX: -pageWidth + Math.max(edgeDragX.value, 0) },
      ],
    };
  });

  const nextPreviewAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(edgeDragX.value) / Math.max(pageWidth * 0.72, 1));
    const activePreview = edgeDirection.value === 1;

    return {
      opacity: activePreview ? Math.min(1, progress * 1.35) : 0,
      transform: [
        { translateX: pageWidth + Math.min(edgeDragX.value, 0) },
      ],
    };
  });

  const cursorStyle = Platform.OS === "web" && uri
    ? { cursor: zoomActive ? "grab" : "zoom-in" }
    : null;

  return (
    <GestureDetector gesture={imageGesture}>
      <Animated.View
        style={[
          styles.zoomViewport,
          {
            width: pageWidth,
            height: pageHeight,
          },
          cursorStyle,
        ]}
      >
        {showEdgePreviews && !!previousUri && (
          <Animated.Image
            pointerEvents="none"
            source={{ uri: previousUri }}
            resizeMode="contain"
            fadeDuration={0}
            style={[styles.edgePreviewImage, previousPreviewAnimatedStyle]}
          />
        )}
        {showEdgePreviews && !!nextUri && (
          <Animated.Image
            pointerEvents="none"
            source={{ uri: nextUri }}
            resizeMode="contain"
            fadeDuration={0}
            style={[styles.edgePreviewImage, nextPreviewAnimatedStyle]}
          />
        )}

        {!!uri && !imageFailed && (
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            resizeMethod={Platform.OS === "android" ? "resize" : undefined}
            progressiveRenderingEnabled={Platform.OS === "android"}
            fadeDuration={0}
            onLoad={(event) => {
              loadedZoomImageKeys.add(imageLoadKey);
              loadedImageKeyRef.current = imageLoadKey;
              setLoadedImageKey(imageLoadKey);
              setFailedImageSignature("");
              const source = event?.nativeEvent?.source;
              if (source?.width && source?.height) {
                setImageSize({ width: source.width, height: source.height });
              }
            }}
            onError={() => {
              if (!loadedZoomImageKeys.has(imageLoadKey)) {
                setFailedImageSignature(imageSignature);
              }
            }}
            style={[styles.image, imageAnimatedStyle]}
          />
        )}

        <AttachmentImageLoadingOverlay
          active={!uri || !imageLoaded}
          scanning={Platform.OS !== "android" && (!uri || !imageLoaded) && !imageFailed}
          attachment={attachment}
          baseColor="rgba(255,255,255,0.1)"
          delayMs={uri ? 140 : 0}
          resizeMode="contain"
          style={styles.zoomLoadingOverlay}
        />
      </Animated.View>
    </GestureDetector>
  );
}

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
  const galleryPagerRef = useRef(null);
  const thumbnailListRef = useRef(null);
  const closingRef = useRef(false);
  const galleryMomentumActiveRef = useRef(false);
  const gallerySettleTimeoutRef = useRef(null);
  const androidPagerSettleTimeoutRef = useRef(null);
  const androidPagerStateRef = useRef("idle");
  const resolvingKeysRef = useRef(new Set());
  const resolvedUrisRef = useRef({});
  const activeIndexRef = useRef(0);
  const zoomActiveRef = useRef(false);
  const zoomCommandTokenRef = useRef(0);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const imageScale = useSharedValue(0.985);
  const backdropOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-12);
  const railTranslateY = useSharedValue(18);
  const dismissClosing = useSharedValue(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomResetToken, setZoomResetToken] = useState(0);
  const [zoomCommand, setZoomCommand] = useState(null);
  const [resolvedUris, setResolvedUris] = useState({});
  const [state, setState] = useState({
    loading: false,
    saving: false,
    sharing: false,
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
  const isWideLayout = width >= WIDE_LAYOUT_WIDTH;
  const showArrowNavigation = canNavigate && (Platform.OS === "web" || isWideLayout);
  const activeAttachment = imageAttachments[activeIndex] || attachment;
  const counterLabel = canNavigate ? `${activeIndex + 1}/${imageAttachments.length}` : "";
  const backgroundColor = themeColors?.mode === "light" ? "#0B0B0F" : "#000";
  const textColor = "#fff";
  const headerTopPadding = Math.max(insets.top, 14);
  const railBottomPadding = Math.max(insets.bottom, 12);
  const stageTopInset = headerTopPadding + (isWideLayout ? 72 : 64);
  const stageBottomInset = canNavigate
    ? railBottomPadding + (isWideLayout ? 90 : 82)
    : railBottomPadding + 20;
  const galleryViewportHeight = Math.max(1, height - stageTopInset - stageBottomInset);

  useEffect(() => {
    resolvedUrisRef.current = resolvedUris;
  }, [resolvedUris]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    zoomActiveRef.current = zoomActive;
  }, [zoomActive]);

  const getDisplayUri = useCallback((item) => {
    const key = getAttachmentIdentity(item);
    return (key && resolvedUris[key]) || getAttachmentPreviewUri(item);
  }, [resolvedUris]);

  const activeUri = activeAttachment ? getDisplayUri(activeAttachment) : "";
  const showZoomControls = isWideLayout && !!activeUri;

  const clearGallerySettleTimer = useCallback(() => {
    if (!gallerySettleTimeoutRef.current) return;

    clearTimeout(gallerySettleTimeoutRef.current);
    gallerySettleTimeoutRef.current = null;
  }, []);

  const clearAndroidPagerSettleTimer = useCallback(() => {
    if (!androidPagerSettleTimeoutRef.current) return;

    clearTimeout(androidPagerSettleTimeoutRef.current);
    androidPagerSettleTimeoutRef.current = null;
  }, []);

  const forceAndroidPagerToActiveIndex = useCallback((animated = false) => {
    if (!USE_ANDROID_NATIVE_PAGER || !visible || !imageAttachments.length) return;
    if (closingRef.current) return;

    const pager = galleryPagerRef.current;
    if (!pager) return;

    const nextIndex = clampIndex(activeIndexRef.current, imageAttachments.length);
    if (animated) {
      pager.setPage?.(nextIndex);
    } else {
      pager.setPageWithoutAnimation?.(nextIndex);
    }
  }, [imageAttachments.length, visible]);

  const scheduleAndroidPagerSettle = useCallback((delayMs = ANDROID_PAGER_SETTLE_DELAY_MS) => {
    if (!USE_ANDROID_NATIVE_PAGER) return;

    clearAndroidPagerSettleTimer();
    androidPagerSettleTimeoutRef.current = setTimeout(() => {
      androidPagerSettleTimeoutRef.current = null;
      if (zoomActiveRef.current) return;
      forceAndroidPagerToActiveIndex(false);
    }, delayMs);
  }, [clearAndroidPagerSettleTimer, forceAndroidPagerToActiveIndex]);

  const rememberResolvedAttachment = useCallback((item) => {
    const key = getAttachmentIdentity(item);
    const uri = getAttachmentPreviewUri(item);
    if (!key || !uri) return;

    setResolvedUris((currentUris) => (
      currentUris[key] === uri ? currentUris : { ...currentUris, [key]: uri }
    ));
    onCacheStateChange?.(item);
  }, [onCacheStateChange]);

  const resolveAttachmentForPreview = useCallback(async (
    item,
    { active = false, cacheInBackground = false } = {}
  ) => {
    const key = getAttachmentIdentity(item);
    if (!key || !isImageAttachment(item)) return;

    const initialUri = resolvedUrisRef.current[key] || getAttachmentPreviewUri(item);
    const canUseInitialAndroidUri = IS_ANDROID && !!initialUri;
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

      if (canUseInitialAndroidUri) {
        if (active) {
          setState((prev) => ({ ...prev, loading: false, error: "" }));
        }
        if (!cacheInBackground) return;
      }

      const prepared = await ensureLocalAttachment(item);
      rememberResolvedAttachment(prepared);
      if (active) {
        setState((prev) => ({ ...prev, loading: false, error: "" }));
      }
    } catch (error) {
      if (active && !canUseInitialAndroidUri) {
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

    if (USE_ANDROID_NATIVE_PAGER) {
      const pager = galleryPagerRef.current;
      if (!pager) return;

      clearAndroidPagerSettleTimer();
      androidPagerStateRef.current = animated ? "settling" : "idle";
      if (animated) {
        pager.setPage?.(nextIndex);
      } else {
        pager.setPageWithoutAnimation?.(nextIndex);
      }
      scheduleAndroidPagerSettle(
        animated ? ANDROID_PAGER_FORCE_SETTLE_DELAY_MS : ANDROID_PAGER_SETTLE_DELAY_MS
      );
      return;
    }

    galleryListRef.current?.scrollToIndex({
      index: nextIndex,
      animated,
      viewPosition: 0,
    });
  }, [clearAndroidPagerSettleTimer, imageAttachments.length, scheduleAndroidPagerSettle]);

  const resetZoomState = useCallback((force = false) => {
    if (force || zoomActiveRef.current) {
      setZoomResetToken((currentToken) => currentToken + 1);
    }

    zoomActiveRef.current = false;
    setZoomActive(false);
  }, []);

  const handleZoomChange = useCallback((index, nextZoomed) => {
    if (index !== activeIndexRef.current) return;
    zoomActiveRef.current = nextZoomed;
    setZoomActive(nextZoomed);
  }, []);

  const sendZoomCommand = useCallback((type) => {
    triggerHaptic("selection");
    zoomCommandTokenRef.current += 1;
    setZoomCommand({ type, token: zoomCommandTokenRef.current });
  }, []);

  const goToIndex = useCallback((nextIndex, animated = true) => {
    if (nextIndex < 0 || nextIndex >= imageAttachments.length) return;
    const currentIndex = activeIndexRef.current;

    if (nextIndex !== currentIndex) {
      triggerHaptic("selection");
      resetZoomState();
      setState((prev) => ({ ...prev, error: "" }));
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
    scrollGalleryToIndex(nextIndex, animated);
  }, [imageAttachments.length, resetZoomState, scrollGalleryToIndex]);

  const goToOffset = useCallback((offset) => {
    if (!canNavigate) return;
    const count = imageAttachments.length;
    goToIndex((activeIndexRef.current + offset + count) % count);
  }, [canNavigate, goToIndex, imageAttachments.length]);

  const handleZoomEdgeSwipe = useCallback((offset) => {
    if (!canNavigate) return;

    const count = imageAttachments.length;
    const nextIndex = (activeIndexRef.current + offset + count) % count;

    triggerHaptic("swipe");
    goToIndex(nextIndex, false);
  }, [canNavigate, goToIndex, imageAttachments.length]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    onClose?.();
  }, [onClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    dismissClosing.value = true;
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
  }, [
    backdropOpacity,
    chromeOpacity,
    dismissClosing,
    dragX,
    dragY,
    finishClose,
    headerTranslateY,
    imageScale,
    railTranslateY,
  ]);

  useEffect(() => {
    if (!visible || !attachment) return;

    activeIndexRef.current = requestedIndex;
    setActiveIndex(requestedIndex);
    resetZoomState(true);

    const frame = requestAnimationFrame(() => {
      scrollGalleryToIndex(requestedIndex, false);
    });
    return () => cancelAnimationFrame(frame);
  }, [attachment, requestedIndex, resetZoomState, scrollGalleryToIndex, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    closingRef.current = false;
    galleryMomentumActiveRef.current = false;
    clearGallerySettleTimer();
    clearAndroidPagerSettleTimer();
    androidPagerStateRef.current = "idle";
    resetZoomState(true);
    dragX.value = 0;
    dragY.value = 0;
    imageScale.value = 0.985;
    backdropOpacity.value = 0;
    chromeOpacity.value = 0;
    dismissClosing.value = false;
    headerTranslateY.value = -12;
    railTranslateY.value = 18;

    const frame = requestAnimationFrame(() => {
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      chromeOpacity.value = withTiming(1, { duration: 210, easing: Easing.out(Easing.cubic) });
      headerTranslateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      railTranslateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      imageScale.value = withSpring(1, GALLERY_SPRING);
    });

    return () => {
      clearGallerySettleTimer();
      clearAndroidPagerSettleTimer();
      cancelAnimationFrame(frame);
    };
  }, [
    backdropOpacity,
    chromeOpacity,
    clearAndroidPagerSettleTimer,
    clearGallerySettleTimer,
    dismissClosing,
    dragX,
    dragY,
    headerTranslateY,
    imageScale,
    railTranslateY,
    resetZoomState,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !activeAttachment) return;

    resolveAttachmentForPreview(activeAttachment, {
      active: true,
      cacheInBackground: false,
    });

    if (IS_ANDROID) return;

    [activeIndex - 1, activeIndex + 1]
      .filter((index) => index >= 0 && index < imageAttachments.length)
      .forEach((index) => resolveAttachmentForPreview(imageAttachments[index]));
  }, [activeAttachment, activeIndex, imageAttachments, resolveAttachmentForPreview, visible]);

  useEffect(() => {
    if (!visible || !IS_ANDROID) return;

    const timeoutId = setTimeout(() => {
      [activeIndex, activeIndex - 1, activeIndex + 1]
        .filter((index) => index >= 0 && index < imageAttachments.length)
        .forEach((index) => {
          resolveAttachmentForPreview(imageAttachments[index], {
            active: index === activeIndexRef.current,
            cacheInBackground: true,
          });
        });
    }, ANDROID_PREVIEW_CACHE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [activeIndex, imageAttachments, resolveAttachmentForPreview, visible]);

  useEffect(() => {
    if (!visible || !canNavigate) return;

    thumbnailListRef.current?.scrollToIndex({
      index: activeIndex,
      animated: !IS_ANDROID,
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

  const dismissGesture = useMemo(() => {
    const dismissPanGesture = Gesture.Pan()
      .enabled(!zoomActive)
      .maxPointers(1)
      .activeOffsetY(IS_ANDROID ? ANDROID_DISMISS_ACTIVATION_Y : 18);

    dismissPanGesture.failOffsetX(
      IS_ANDROID
        ? [-ANDROID_DISMISS_FAIL_OFFSET_X, ANDROID_DISMISS_FAIL_OFFSET_X]
        : [-10, 10]
    );

    if (IS_ANDROID) {
      dismissPanGesture.averageTouches(true);
    }

    const animateDismissClose = (translationX = 0) => {
      "worklet";

      if (dismissClosing.value) return;

      dismissClosing.value = true;
      runOnJS(triggerHaptic)("sheetClose");
      chromeOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
      headerTranslateY.value = withTiming(-16, { duration: 170, easing: Easing.out(Easing.cubic) });
      railTranslateY.value = withTiming(22, { duration: 170, easing: Easing.out(Easing.cubic) });
      dragY.value = withTiming(Math.max(height, 1), { duration: 230, easing: Easing.out(Easing.cubic) });
      dragX.value = withTiming(translationX * 0.12, { duration: 230, easing: Easing.out(Easing.cubic) });
      imageScale.value = withTiming(0.88, { duration: 230, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(0, {
        duration: 210,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
    };

    const panGesture = dismissPanGesture
      .onUpdate((event) => {
        if (dismissClosing.value) return;

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
          (event.translationY > DISMISS_COMMIT_DISTANCE && absY > absX * DISMISS_COMMIT_VERTICAL_RATIO)
          || (
            event.translationY > DISMISS_FLING_DISTANCE
            && event.velocityY > DISMISS_FLING_VELOCITY
            && absY > absX * DISMISS_FLING_VERTICAL_RATIO
          )
        );

        if (shouldClose) {
          animateDismissClose(event.translationX);
          return;
        }

        dragX.value = withSpring(0, GALLERY_SPRING);
        dragY.value = withSpring(0, GALLERY_SPRING);
        imageScale.value = withSpring(1, GALLERY_SPRING);
        backdropOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
        chromeOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
        headerTranslateY.value = withSpring(0, GALLERY_SPRING);
        railTranslateY.value = withSpring(0, GALLERY_SPRING);
      })
      .onFinalize((_, success) => {
        if (success) return;

        if (dragY.value < 0.5 && Math.abs(dragX.value) < 0.5) {
          return;
        }

        if (IS_ANDROID && dragY.value > DISMISS_CANCEL_COMMIT_DISTANCE) {
          animateDismissClose(dragX.value / 0.06);
          return;
        }

        dragX.value = withSpring(0, GALLERY_SPRING);
        dragY.value = withSpring(0, GALLERY_SPRING);
        imageScale.value = withSpring(1, GALLERY_SPRING);
        backdropOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
        chromeOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
        headerTranslateY.value = withSpring(0, GALLERY_SPRING);
        railTranslateY.value = withSpring(0, GALLERY_SPRING);
      });

    return panGesture;
  }, [
    backdropOpacity,
    chromeOpacity,
    dismissClosing,
    dragX,
    dragY,
    finishClose,
    headerTranslateY,
    height,
    imageScale,
    railTranslateY,
    zoomActive,
  ]);

  const settleGalleryToOffset = useCallback((offsetX, animated = true) => {
    if (!imageAttachments.length) return;

    const pageWidth = Math.max(width, 1);
    const nextIndex = clampIndex(Math.round(offsetX / pageWidth), imageAttachments.length);
    const targetOffset = nextIndex * pageWidth;
    const currentIndex = activeIndexRef.current;

    if (nextIndex !== currentIndex) {
      triggerHaptic("selection");
      resetZoomState();
      setState((prev) => ({ ...prev, error: "" }));
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }

    if (Math.abs(offsetX - targetOffset) <= GALLERY_SNAP_EPSILON) return;

    requestAnimationFrame(() => {
      galleryListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated,
      });
    });
  }, [imageAttachments.length, resetZoomState, width]);

  const handleGalleryMomentumBegin = useCallback(() => {
    galleryMomentumActiveRef.current = true;
    clearGallerySettleTimer();
  }, [clearGallerySettleTimer]);

  const handleGalleryMomentumEnd = useCallback((event) => {
    galleryMomentumActiveRef.current = false;
    clearGallerySettleTimer();
    settleGalleryToOffset(event.nativeEvent.contentOffset.x, IS_ANDROID);
  }, [clearGallerySettleTimer, settleGalleryToOffset]);

  const handleGalleryPageSelected = useCallback((event) => {
    const nextIndex = clampIndex(
      Number(event?.nativeEvent?.position) || 0,
      imageAttachments.length
    );
    const currentIndex = activeIndexRef.current;

    androidPagerStateRef.current = "idle";
    if (nextIndex !== currentIndex) {
      triggerHaptic("selection");
      resetZoomState();
      setState((prev) => ({ ...prev, error: "" }));
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }

    scheduleAndroidPagerSettle(ANDROID_PAGER_SETTLE_DELAY_MS);
  }, [imageAttachments.length, resetZoomState, scheduleAndroidPagerSettle]);

  const handleAndroidPagerScrollStateChanged = useCallback((event) => {
    if (!USE_ANDROID_NATIVE_PAGER) return;

    const nextState = event?.nativeEvent?.pageScrollState || "idle";
    androidPagerStateRef.current = nextState;

    if (nextState === "dragging") {
      clearAndroidPagerSettleTimer();
      return;
    }

    scheduleAndroidPagerSettle(
      nextState === "settling"
        ? ANDROID_PAGER_FORCE_SETTLE_DELAY_MS
        : ANDROID_PAGER_SETTLE_DELAY_MS
    );
  }, [clearAndroidPagerSettleTimer, scheduleAndroidPagerSettle]);

  const handleGalleryScrollEndDrag = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;

    clearGallerySettleTimer();
    gallerySettleTimeoutRef.current = setTimeout(() => {
      gallerySettleTimeoutRef.current = null;
      if (galleryMomentumActiveRef.current) return;

      settleGalleryToOffset(offsetX, true);
    }, GALLERY_SETTLE_DELAY_MS);
  }, [clearGallerySettleTimer, settleGalleryToOffset]);

  const handleDownload = async () => {
    if (!activeAttachment || state.saving || state.sharing) return;

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

  const handleShare = async () => {
    if (!activeAttachment || state.saving || state.sharing) return;

    const activeUri = getDisplayUri(activeAttachment);
    const shareableAttachment = activeUri
      ? { ...activeAttachment, localUri: activeUri, openUri: activeUri }
      : activeAttachment;

    try {
      triggerHaptic("open");
      setState((prev) => ({ ...prev, sharing: true, error: "" }));

      const prepared = await shareAttachment(shareableAttachment);
      rememberResolvedAttachment(prepared);
      setState((prev) => ({
        ...prev,
        loading: false,
        sharing: false,
        error: "",
      }));
      triggerHaptic("success");
    } catch (error) {
      triggerHaptic("error");
      setState((prev) => ({
        ...prev,
        sharing: false,
        error: formatAttachmentError(error, lang),
      }));
    }
  };

  const handleThumbnailPress = useCallback((index) => {
    const shouldAnimate = Math.abs(index - activeIndexRef.current) <= 1;
    goToIndex(index, shouldAnimate);
  }, [goToIndex]);

  const renderGalleryItem = useCallback(({ item, index }) => {
    const isActive = index === activeIndex;
    const uri = getDisplayUri(item);
    const previousUri = !IS_ANDROID && index > 0
      ? getDisplayUri(imageAttachments[index - 1])
      : "";
    const nextUri = !IS_ANDROID && index < imageAttachments.length - 1
      ? getDisplayUri(imageAttachments[index + 1])
      : "";

    const imagePage = (
      <ZoomableImagePage
        attachment={item}
        uri={uri}
        previousUri={previousUri}
        nextUri={nextUri}
        index={index}
        pageWidth={width}
        pageHeight={galleryViewportHeight}
        active={isActive}
        zoomActive={zoomActive && isActive}
        resetToken={zoomResetToken}
        zoomCommand={zoomCommand}
        onZoomChange={handleZoomChange}
        onZoomEdgeSwipe={handleZoomEdgeSwipe}
        showEdgePreviews={!IS_ANDROID}
        dismissGesture={IS_ANDROID && isActive ? dismissGesture : null}
      />
    );

    return (
      <View
        style={[
          styles.galleryPage,
          {
            width,
            paddingTop: stageTopInset,
            paddingBottom: stageBottomInset,
          },
        ]}
      >
        {imagePage}
      </View>
    );
  }, [
    activeIndex,
    galleryViewportHeight,
    getDisplayUri,
    imageAttachments,
    dismissGesture,
    handleZoomEdgeSwipe,
    handleZoomChange,
    stageBottomInset,
    stageTopInset,
    width,
    zoomActive,
    zoomCommand,
    zoomResetToken,
  ]);

  const renderThumbnail = useCallback(({ item, index }) => {
    const uri = getDisplayUri(item);
    const isActive = index === activeIndex;

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPressIn={() => handleThumbnailPress(index)}
        style={[
          styles.thumbnailButton,
          isActive ? styles.thumbnailButtonActive : null,
        ]}
        accessibilityRole="button"
      >
        <StagedAttachmentImage
          uri={uri}
          attachment={item}
          resizeMode="cover"
          baseColor="rgba(255,255,255,0.1)"
          loaderScanning={!IS_ANDROID}
          style={styles.thumbnailImage}
        />
      </TouchableOpacity>
    );
  }, [activeIndex, getDisplayUri, handleThumbnailPress]);

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

  const renderAndroidPagerPage = (item, index) => {
    const shouldRenderPage = Math.abs(index - activeIndex) <= ANDROID_PAGER_RENDER_DISTANCE;

    return (
      <View
        key={getAttachmentIdentity(item) || `android-image-${index}`}
        collapsable={false}
        style={styles.androidPagerPage}
      >
        {shouldRenderPage ? renderGalleryItem({ item, index }) : null}
      </View>
    );
  };

  const galleryStage = (
    <Animated.View style={[styles.imageStage, stageAnimatedStyle]}>
      {USE_ANDROID_NATIVE_PAGER ? (
        <AndroidPagerView
          ref={galleryPagerRef}
          style={styles.androidPager}
          initialPage={requestedIndex}
          scrollEnabled={!zoomActive}
          orientation="horizontal"
          overScrollMode="never"
          overdrag={false}
          offscreenPageLimit={1}
          pageMargin={0}
          onPageSelected={handleGalleryPageSelected}
          onPageScrollStateChanged={handleAndroidPagerScrollStateChanged}
        >
          {imageAttachments.map(renderAndroidPagerPage)}
        </AndroidPagerView>
      ) : (
        <FlatList
          ref={galleryListRef}
          data={imageAttachments}
          extraData={{
            activeIndex,
            resolvedUris,
            zoomActive,
            zoomCommandToken: zoomCommand?.token || 0,
            zoomResetToken,
          }}
          style={styles.galleryList}
          initialScrollIndex={requestedIndex}
          keyExtractor={(item, index) => getAttachmentIdentity(item) || `image-${index}`}
          renderItem={renderGalleryItem}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomActive}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToAlignment="start"
          snapToInterval={Math.max(width, 1)}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({
            length: Math.max(width, 1),
            offset: Math.max(width, 1) * index,
            index,
          })}
          onMomentumScrollBegin={handleGalleryMomentumBegin}
          onMomentumScrollEnd={handleGalleryMomentumEnd}
          onScrollEndDrag={handleGalleryScrollEndDrag}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
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
  );

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
                paddingTop: headerTopPadding,
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

            <View style={styles.headerActions}>
              {showZoomControls && (
                <View style={styles.zoomControls}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => sendZoomCommand("out")}
                    style={styles.headerButton}
                    accessibilityRole="button"
                    accessibilityLabel="Zoom out"
                  >
                    <MagnifyingGlassMinus size={22} color={textColor} weight="bold" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    disabled={!zoomActive}
                    onPress={() => sendZoomCommand("reset")}
                    style={[styles.headerButton, !zoomActive ? styles.disabledButton : null]}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.reset", lang)}
                  >
                    <CornersIn size={22} color={textColor} weight="bold" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => sendZoomCommand("in")}
                    style={styles.headerButton}
                    accessibilityRole="button"
                    accessibilityLabel="Zoom in"
                  >
                    <MagnifyingGlassPlus size={22} color={textColor} weight="bold" />
                  </TouchableOpacity>
                </View>
              )}

              {Platform.OS === "android" && (
                <TouchableOpacity
                  activeOpacity={0.72}
                  disabled={state.saving || state.sharing}
                  onPress={handleShare}
                  style={[styles.headerButton, state.sharing ? styles.disabledButton : null]}
                  accessibilityRole="button"
                  accessibilityLabel={getAttachmentShareLabel(lang)}
                >
                  {state.sharing ? (
                    <MorphingLoader size={24} />
                  ) : (
                    <ShareNetwork size={23} color={textColor} weight="bold" />
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.72}
                disabled={state.saving || state.sharing}
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
            </View>
          </Animated.View>

          {IS_ANDROID ? (
            galleryStage
          ) : (
            <GestureDetector gesture={dismissGesture}>
              {galleryStage}
            </GestureDetector>
          )}

          {canNavigate && (
            <Animated.View
              style={[
                styles.thumbnailRail,
                {
                  paddingBottom: railBottomPadding,
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
                initialNumToRender={IS_ANDROID ? 4 : 6}
                maxToRenderPerBatch={IS_ANDROID ? 3 : 6}
                windowSize={IS_ANDROID ? 4 : 5}
                removeClippedSubviews={IS_ANDROID}
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
    overflow: "hidden",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  disabledButton: {
    opacity: 0.46,
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: "hidden",
  },
  galleryList: {
    flex: 1,
  },
  androidPager: {
    ...StyleSheet.absoluteFillObject,
  },
  androidPagerPage: {
    flex: 1,
  },
  galleryPage: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomViewport: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  edgePreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  zoomLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  navButtonLeft: {
    left: 18,
  },
  navButtonRight: {
    right: 18,
  },
  thumbnailRail: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  thumbnailContent: {
    minHeight: 62,
    paddingHorizontal: 14,
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
});
