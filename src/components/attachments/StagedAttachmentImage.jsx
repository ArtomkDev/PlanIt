import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const DEFAULT_COLORS = ["rgba(136,136,146,0.56)", "rgba(96,96,108,0.7)"];
const SCAN_LINE_HEIGHT = 58;
const DEFAULT_LOADER_DELAY_MS = 140;
const loadedAttachmentImageKeys = new Set();

const normalizePreviewColors = (colors) => (
  Array.isArray(colors)
    ? colors
      .filter((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
      .slice(0, 4)
    : []
);

const getAttachmentPreview = (attachment) => {
  const preview = attachment?.imagePreview;
  if (!preview || typeof preview !== "object") {
    return { uri: "", colors: [], width: 0, height: 0 };
  }

  return {
    uri: typeof preview.uri === "string" ? preview.uri : "",
    colors: normalizePreviewColors(preview.colors),
    width: Number(preview.width) || 0,
    height: Number(preview.height) || 0,
  };
};

const getAttachmentAspectRatio = (attachment) => {
  const compressionWidth = Number(attachment?.compression?.width) || 0;
  const compressionHeight = Number(attachment?.compression?.height) || 0;
  if (compressionWidth > 0 && compressionHeight > 0) {
    return compressionWidth / compressionHeight;
  }

  const previewWidth = Number(attachment?.imagePreview?.width) || 0;
  const previewHeight = Number(attachment?.imagePreview?.height) || 0;
  if (previewWidth > 0 && previewHeight > 0) {
    return previewWidth / previewHeight;
  }

  return 0;
};

const getContainedFrameStyle = (layout, aspectRatio) => {
  const width = Number(layout?.width) || 0;
  const height = Number(layout?.height) || 0;
  const ratio = Number(aspectRatio) || 0;

  if (width <= 0 || height <= 0 || ratio <= 0) {
    return StyleSheet.absoluteFillObject;
  }

  const boxRatio = width / height;
  const frameWidth = ratio > boxRatio ? width : Math.min(width, height * ratio);
  const frameHeight = ratio > boxRatio ? Math.min(height, width / ratio) : height;

  return {
    position: "absolute",
    left: (width - frameWidth) / 2,
    top: (height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
};

export function AttachmentImageLoadingOverlay({
  active,
  scanning = active,
  attachment,
  baseColor = "rgba(126,126,136,0.34)",
  delayMs = 0,
  resizeMode = "cover",
  aspectRatio,
  style,
}) {
  const initialActive = active && delayMs <= 0;
  const overlayOpacity = useRef(new Animated.Value(initialActive ? 1 : 0)).current;
  const scanProgress = useRef(new Animated.Value(0)).current;
  const visibilityTokenRef = useRef(0);
  const scanStartedRef = useRef(false);
  const [delayedActive, setDelayedActive] = useState(initialActive);
  const [overlayVisible, setOverlayVisible] = useState(initialActive);
  const [layout, setLayout] = useState({ width: 0, height: 160 });
  const preview = useMemo(() => getAttachmentPreview(attachment), [attachment]);
  const colors = preview.colors.length >= 2 ? preview.colors : DEFAULT_COLORS;
  const hasRichPreview = !!preview.uri || preview.colors.length >= 2;
  const resolvedAspectRatio = Number(aspectRatio) || getAttachmentAspectRatio(attachment);
  const contentFrameStyle = resizeMode === "contain"
    ? getContainedFrameStyle(layout, resolvedAspectRatio)
    : StyleSheet.absoluteFillObject;
  const scanHeight = resizeMode === "contain" && contentFrameStyle?.height
    ? contentFrameStyle.height
    : layout.height;

  useEffect(() => {
    if (!active) {
      setDelayedActive(false);
      return undefined;
    }

    if (!delayMs) {
      setDelayedActive(true);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setDelayedActive(true);
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [active, delayMs]);

  useEffect(() => {
    visibilityTokenRef.current += 1;
    const token = visibilityTokenRef.current;

    if (delayedActive) {
      setOverlayVisible(true);
      overlayOpacity.stopAnimation();
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    overlayOpacity.stopAnimation();
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && visibilityTokenRef.current === token) {
        scanStartedRef.current = false;
        setOverlayVisible(false);
      }
    });
  }, [delayedActive, overlayOpacity]);

  useEffect(() => {
    if (!overlayVisible || !scanning) return undefined;

    if (!scanStartedRef.current) {
      scanProgress.setValue(0);
      scanStartedRef.current = true;
    }
    const animation = Animated.loop(
      Animated.timing(scanProgress, {
        toValue: 1,
        duration: 1450,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [overlayVisible, scanProgress, scanning]);

  if (!overlayVisible) return null;

  const translateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCAN_LINE_HEIGHT, scanHeight + SCAN_LINE_HEIGHT],
  });

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(event) => {
        const nextWidth = event?.nativeEvent?.layout?.width;
        const nextHeight = event?.nativeEvent?.layout?.height;
        if (nextWidth > 0 && nextHeight > 0) {
          setLayout((currentLayout) => (
            currentLayout.width === nextWidth && currentLayout.height === nextHeight
              ? currentLayout
              : { width: nextWidth, height: nextHeight }
          ));
        }
      }}
      style={[styles.overlay, style, { opacity: overlayOpacity }]}
    >
      <View style={[styles.baseLayer, { backgroundColor: baseColor }]} />

      <View style={[styles.contentFrame, contentFrameStyle]}>
        {preview.uri ? (
          <Image
            source={{ uri: preview.uri }}
            resizeMode={resizeMode}
            blurRadius={18}
            fadeDuration={0}
            style={styles.previewImage}
          />
        ) : (
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.previewImage,
              { opacity: hasRichPreview ? 1 : 0.38 },
            ]}
          />
        )}

        <View style={styles.softShade} />

        {scanning && (
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(255,255,255,0)",
                "rgba(255,255,255,0.62)",
                "rgba(255,255,255,0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const getStableImageKey = (attachment, uri) => (
  attachment?.id
  || attachment?.fileId
  || attachment?.libraryId
  || attachment?.cacheKey
  || attachment?.storagePath
  || attachment?.downloadURL
  || attachment?.url
  || uri
  || ""
);

const getStableImageRevision = (attachment) => (
  attachment?.cacheRevision
  || attachment?.cloudRevision
  || attachment?.uploadedAt
  || attachment?.updatedAt
  || attachment?.createdAt
  || attachment?.size
  || ""
);

const getStableImageLoadKey = (attachment, uri) => {
  const imageKey = getStableImageKey(attachment, uri);
  if (!imageKey) return uri || "";

  const revision = getStableImageRevision(attachment);
  return revision ? `${imageKey}:${revision}` : imageKey;
};

export default function StagedAttachmentImage({
  uri,
  attachment,
  resizeMode = "cover",
  style,
  imageStyle,
  baseColor,
  loaderDelayMs = DEFAULT_LOADER_DELAY_MS,
  loaderResizeMode = resizeMode,
  loaderScanning = true,
  onLoad,
  onError,
}) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const [, setLoadVersion] = useState(0);
  const [failedSignature, setFailedSignature] = useState("");
  const imageKey = getStableImageKey(attachment, uri);
  const imageLoadKey = getStableImageLoadKey(attachment, uri);
  const imageSignature = `${imageKey}:${uri || ""}`;
  const imageLoaded = !!imageLoadKey && loadedAttachmentImageKeys.has(imageLoadKey);
  const imageFailed = !!imageSignature && failedSignature === imageSignature && !imageLoaded;

  useEffect(() => {
    setFailedSignature((currentSignature) => (
      currentSignature.startsWith(`${imageKey}:`) && currentSignature !== imageSignature
        ? ""
        : currentSignature
    ));
    imageOpacity.stopAnimation();
    imageOpacity.setValue(imageLoaded ? 1 : 0);
  }, [imageKey, imageLoaded, imageOpacity, imageSignature, uri]);

  const showOverlay = !imageLoaded;
  const showScanner = loaderScanning && showOverlay && !imageFailed;

  return (
    <View style={[styles.root, style, { backgroundColor: baseColor }]}>
      {!!uri && !imageFailed && (
        <Animated.Image
          source={{ uri }}
          resizeMode={resizeMode}
          fadeDuration={0}
          onLoad={(event) => {
            loadedAttachmentImageKeys.add(imageLoadKey);
            setFailedSignature("");
            setLoadVersion((value) => value + 1);
            Animated.timing(imageOpacity, {
              toValue: 1,
              duration: 190,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();
            onLoad?.(event);
          }}
          onError={(event) => {
            if (!loadedAttachmentImageKeys.has(imageLoadKey)) {
              setFailedSignature(imageSignature);
              setLoadVersion((value) => value + 1);
            }
            onError?.(event);
          }}
          style={[
            styles.absoluteImage,
            imageStyle,
            { opacity: imageOpacity },
          ]}
        />
      )}

      <AttachmentImageLoadingOverlay
        active={showOverlay}
        scanning={showScanner}
        attachment={attachment}
        baseColor={baseColor}
        delayMs={uri ? loaderDelayMs : 0}
        resizeMode={loaderResizeMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
  },
  absoluteImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  contentFrame: {
    overflow: "hidden",
  },
  baseLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  softShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: SCAN_LINE_HEIGHT,
    opacity: 0.78,
  },
});
