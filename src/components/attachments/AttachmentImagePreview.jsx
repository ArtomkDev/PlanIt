import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
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
  ensureLocalAttachment,
  formatAttachmentError,
  isImageAttachment,
  openAttachment,
} from "../../services/attachmentService";
import MorphingLoader from "../ui/MorphingLoader";
import { t } from "../../utils/i18n";
import { triggerHaptic } from "../../utils/haptics";

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
  const { width } = useWindowDimensions();
  const thumbnailScrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState({
    loading: false,
    saving: false,
    uri: "",
    error: "",
  });

  const imageAttachments = useMemo(
    () => dedupeImageAttachments(attachments, attachment),
    [attachment, attachments]
  );
  const activeAttachment = imageAttachments[activeIndex] || attachment;
  const canNavigate = imageAttachments.length > 1;
  const showArrowNavigation = canNavigate && Platform.OS === "web" && width >= 768;

  useEffect(() => {
    if (!visible || !attachment) return;

    const activeKey = getAttachmentIdentity(attachment);
    const nextIndex = imageAttachments.findIndex((item) => getAttachmentIdentity(item) === activeKey);
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [attachment, imageAttachments, visible]);

  useEffect(() => {
    if (!visible || !canNavigate) return;
    thumbnailScrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * 68 - 24),
      animated: true,
    });
  }, [activeIndex, canNavigate, visible]);

  const goToOffset = useCallback((offset) => {
    if (!canNavigate) return;
    triggerHaptic("selection");
    setState((prev) => ({ ...prev, error: "" }));
    setActiveIndex((previousIndex) => {
      const count = imageAttachments.length;
      return (previousIndex + offset + count) % count;
    });
  }, [canNavigate, imageAttachments.length]);

  const goToIndex = useCallback((nextIndex) => {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= imageAttachments.length) return;
    triggerHaptic("selection");
    setState((prev) => ({ ...prev, error: "" }));
    setActiveIndex(nextIndex);
  }, [activeIndex, imageAttachments.length]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      canNavigate
      && Math.abs(gestureState.dx) > 18
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25
    ),
    onPanResponderRelease: (_, gestureState) => {
      if (!canNavigate || Math.abs(gestureState.dx) < 46) return;
      goToOffset(gestureState.dx < 0 ? 1 : -1);
    },
  }), [canNavigate, goToOffset]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToOffset(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToOffset(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToOffset, visible]);

  useEffect(() => {
    let active = true;

    const loadImage = async () => {
      if (!visible || !activeAttachment) return;

      if (!isImageAttachment(activeAttachment)) {
        setState({ loading: false, saving: false, uri: "", error: t("attachments.errors.open_failed", lang) });
        return;
      }

      setState({
        loading: true,
        saving: false,
        uri: activeAttachment.localUri || activeAttachment.uri || activeAttachment.downloadURL || activeAttachment.url || "",
        error: "",
      });

      try {
        const prepared = await ensureLocalAttachment(activeAttachment);
        if (!active) return;
        onCacheStateChange?.(prepared);
        setState({
          loading: false,
          saving: false,
          uri: prepared.openUri || prepared.localUri || prepared.downloadURL || prepared.url || "",
          error: "",
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          saving: false,
          uri: activeAttachment.localUri || activeAttachment.uri || activeAttachment.downloadURL || activeAttachment.url || "",
          error: formatAttachmentError(error, lang),
        });
      }
    };

    loadImage();
    return () => {
      active = false;
    };
  }, [activeAttachment, lang, onCacheStateChange, visible]);

  const close = () => {
    triggerHaptic("sheetClose");
    onClose?.();
  };

  const handleDownload = async () => {
    if (!activeAttachment || state.saving) return;

    try {
      triggerHaptic("open");
      setState((prev) => ({ ...prev, saving: true, error: "" }));

      if (Platform.OS === "web") {
        await openAttachment(activeAttachment, { download: true });
        setState((prev) => ({ ...prev, saving: false }));
        return;
      }

      const prepared = await openAttachment(activeAttachment, { download: true });
      onCacheStateChange?.(prepared);
      setState({
        loading: false,
        saving: false,
        uri: prepared.openUri || prepared.localUri || state.uri,
        error: "",
      });
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

  if (!activeAttachment) return null;

  const backgroundColor = themeColors?.mode === "light" ? "#0B0B0F" : "#000";
  const textColor = "#fff";
  const counterLabel = canNavigate ? `${activeIndex + 1}/${imageAttachments.length}` : "";

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 14),
            },
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
        </View>

        <View style={styles.imageStage} {...panResponder.panHandlers}>
          {!!state.uri && (
            <Image
              source={{ uri: state.uri }}
              resizeMode="contain"
              style={styles.image}
            />
          )}
          {state.loading && (
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
        </View>

        {canNavigate && (
          <View
            style={[
              styles.thumbnailRail,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <ScrollView
              ref={thumbnailScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailContent}
            >
              {imageAttachments.map((item, index) => {
                const thumbUri = getAttachmentPreviewUri(item);
                const isActive = index === activeIndex;

                return (
                  <TouchableOpacity
                    key={getAttachmentIdentity(item) || `thumb-${index}`}
                    activeOpacity={0.78}
                    onPress={() => goToIndex(index)}
                    style={[
                      styles.thumbnailButton,
                      isActive ? styles.thumbnailButtonActive : null,
                    ]}
                    accessibilityRole="button"
                  >
                    {thumbUri ? (
                      <Image
                        source={{ uri: thumbUri }}
                        resizeMode="cover"
                        style={styles.thumbnailImage}
                      />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <ImageIcon size={24} color="rgba(255,255,255,0.72)" weight="bold" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
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
    backgroundColor: "rgba(0,0,0,0.82)",
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
