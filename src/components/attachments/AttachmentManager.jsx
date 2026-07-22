import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArrowUpRight,
  Camera,
  Check,
  DownloadSimple,
  File,
  Files,
  Image as ImageIcon,
  Paperclip,
  PencilSimple,
  ShareNetwork,
  Trash,
  WarningCircle,
  X,
} from "phosphor-react-native";

import {
  captureAttachmentPhoto,
  deleteStoredAttachments,
  formatAttachmentError,
  formatFileSize,
  getAttachmentShareLabel,
  getAttachmentCacheState,
  isImageAttachment,
  MAX_ATTACHMENT_SIZE_BYTES,
  createAttachmentReference,
  getAttachmentLibraryUsage,
  normalizeAttachmentDraftList,
  normalizeAttachmentLibrary,
  openAttachment,
  pickAttachmentFiles,
  pickAttachmentPhotos,
  renameAttachmentDisplayName,
  resolveAttachmentList,
  shareAttachment,
  upsertAttachmentLibraryFiles,
  uploadAttachmentDrafts,
} from "../../services/attachmentService";
import { t } from "../../utils/i18n";
import { triggerHaptic } from "../../utils/haptics";
import AttachmentImagePreview from "./AttachmentImagePreview";

const interpolate = (template, params = {}) => (
  Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  )
);

const getAttachmentKindIcon = (attachment) => (
  String(attachment?.mimeType || "").startsWith("image/") ? ImageIcon : File
);

export default function AttachmentManager({
  attachments,
  onChange,
  onRemoveStoredAttachment,
  onUploadedAttachments,
  onUploadStateChange,
  fileLibrary = [],
  onFileLibraryChange,
  storageLimitBytes = MAX_ATTACHMENT_SIZE_BYTES,
  userId,
  ownerAvailable = true,
  disabled = false,
  uploadState,
  themeColors,
  lang,
}) {
  const [localError, setLocalError] = useState("");
  const [internalUploadState, setInternalUploadState] = useState({ uploading: false });
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [cacheStates, setCacheStates] = useState({});
  const [renamingAttachmentId, setRenamingAttachmentId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const activeUploadState = uploadState || internalUploadState;
  const normalizedAttachments = useMemo(
    () => normalizeAttachmentDraftList(attachments),
    [attachments]
  );
  const normalizedFileLibrary = useMemo(
    () => normalizeAttachmentLibrary(fileLibrary),
    [fileLibrary]
  );
  const displayAttachments = useMemo(
    () => resolveAttachmentList(normalizedAttachments, normalizedFileLibrary),
    [normalizedAttachments, normalizedFileLibrary]
  );
  const attachedFileIds = useMemo(() => new Set(
    normalizedAttachments
      .map((attachment) => attachment.fileId || attachment.libraryId || null)
      .filter(Boolean)
  ), [normalizedAttachments]);
  const availableLibraryFiles = useMemo(
    () => normalizedFileLibrary.filter((file) => !attachedFileIds.has(file.id)),
    [attachedFileIds, normalizedFileLibrary]
  );
  const cloudStorageUsed = useMemo(
    () => getAttachmentLibraryUsage(normalizedFileLibrary),
    [normalizedFileLibrary]
  );

  const refreshAttachmentCacheState = useCallback(async (attachment) => {
    if (!attachment?.id) return;
    try {
      const nextState = await getAttachmentCacheState(attachment);
      setCacheStates((prev) => ({
        ...prev,
        [attachment.id]: nextState,
      }));
    } catch (error) {}
  }, []);

  useEffect(() => {
    let active = true;

    const loadCacheStates = async () => {
      const entries = await Promise.all(
        displayAttachments.map(async (attachment) => {
          try {
            return [attachment.id, await getAttachmentCacheState(attachment)];
          } catch (error) {
            return [attachment.id, { status: "remote", uri: attachment.downloadURL || attachment.url || null }];
          }
        })
      );

      if (!active) return;
      setCacheStates(Object.fromEntries(entries.filter(([id]) => !!id)));
    };

    loadCacheStates();
    return () => {
      active = false;
    };
  }, [displayAttachments]);

  useEffect(() => {
    if (!renamingAttachmentId) return;
    const stillExists = normalizedAttachments.some((attachment) => attachment.id === renamingAttachmentId);
    if (!stillExists) {
      setRenamingAttachmentId(null);
      setRenameValue("");
    }
  }, [normalizedAttachments, renamingAttachmentId]);

  const updateUploadState = (nextState) => {
    setInternalUploadState(nextState);
    onUploadStateChange?.(nextState);
  };

  const setErrorFromResult = (errors = []) => {
    if (!errors.length) {
      setLocalError("");
      return;
    }

    setLocalError(errors.slice(0, 2).map((error) => formatAttachmentError(error, lang)).join("\n"));
  };

  const addPickedAttachments = async (result) => {
    setErrorFromResult(result?.errors);
    const pickedAttachments = result?.attachments || [];
    if (!pickedAttachments.length) return;

    const baseAttachments = normalizedAttachments;
    onChange?.([...baseAttachments, ...pickedAttachments]);

    try {
      updateUploadState({ uploading: true, attachmentId: null, progress: 0, error: "" });
      const uploadedAttachments = await uploadAttachmentDrafts(pickedAttachments, {
        userId,
        onAttachmentStart: (attachment) => {
          updateUploadState({ uploading: true, attachmentId: attachment.id, progress: 0, error: "" });
        },
        onAttachmentProgress: (attachment, progress) => {
          updateUploadState({ uploading: true, attachmentId: attachment.id, progress, error: "" });
        },
      });

      if (
        onFileLibraryChange
        && storageLimitBytes > 0
        && cloudStorageUsed + getAttachmentLibraryUsage(uploadedAttachments) > storageLimitBytes
      ) {
        await deleteStoredAttachments(uploadedAttachments);
        const limitError = new Error("storage_limit_reached");
        limitError.attachmentCode = "storage_limit_reached";
        throw limitError;
      }

      onUploadedAttachments?.(uploadedAttachments);
      if (onFileLibraryChange) {
        const nextLibrary = upsertAttachmentLibraryFiles(normalizedFileLibrary, uploadedAttachments);
        onFileLibraryChange(nextLibrary);
        onChange?.([
          ...baseAttachments,
          ...uploadedAttachments.map((attachment) => createAttachmentReference(attachment)),
        ]);
      } else {
        onChange?.([...baseAttachments, ...uploadedAttachments]);
      }
      uploadedAttachments.forEach(refreshAttachmentCacheState);
      updateUploadState({ uploading: false });
      setLocalError("");
      triggerHaptic("success");
    } catch (error) {
      const formattedError = formatAttachmentError(error, lang);
      triggerHaptic("error");
      onChange?.(baseAttachments);
      updateUploadState({
        uploading: false,
        attachmentId: null,
        progress: 0,
        error: formattedError,
      });
      setLocalError(formattedError);
    }
  };

  const runPicker = async (picker) => {
    if (disabled || activeUploadState?.uploading) return;
    if (!ownerAvailable || !userId) {
      setLocalError(t("attachments.errors.auth_required", lang));
      triggerHaptic("warning");
      return;
    }

    try {
      setLocalError("");
      const result = await picker({ currentCount: normalizedAttachments.length });
      await addPickedAttachments(result);
    } catch (error) {
      triggerHaptic("error");
      setLocalError(formatAttachmentError(error, lang));
    }
  };

  const removeAttachment = (attachment) => {
    if (disabled || activeUploadState?.uploading) return;

    triggerHaptic("warning");
    if (attachment?.storagePath && !attachment?.fileId) {
      onRemoveStoredAttachment?.(attachment);
    }
    onChange?.(normalizedAttachments.filter((item) => item.id !== attachment.id));
  };

  const attachLibraryFile = (file) => {
    if (disabled || activeUploadState?.uploading || !file?.id) return;

    triggerHaptic("success");
    onChange?.([...normalizedAttachments, createAttachmentReference(file)]);
    setLibraryOpen(false);
  };

  const startRenamingAttachment = (attachment) => {
    if (disabled || activeUploadState?.uploading || !attachment?.id) return;
    triggerHaptic("selection");
    setRenamingAttachmentId(attachment.id);
    setRenameValue(attachment.name || "");
    setLocalError("");
  };

  const cancelRenamingAttachment = () => {
    setRenamingAttachmentId(null);
    setRenameValue("");
  };

  const saveRenamedAttachment = (attachment) => {
    if (!attachment?.id) return;

    const renamedAttachment = renameAttachmentDisplayName(attachment, renameValue);
    if (attachment.fileId && onFileLibraryChange) {
      onFileLibraryChange(upsertAttachmentLibraryFiles(normalizedFileLibrary, [{
        ...attachment,
        id: attachment.fileId,
        fileId: attachment.fileId,
        name: renamedAttachment.name,
      }]));
    } else {
      onChange?.(normalizedAttachments.map((item) => (
        item.id === attachment.id
          ? {
            ...item,
            name: renamedAttachment.name,
          }
          : item
      )));
    }
    setRenamingAttachmentId(null);
    setRenameValue("");
    setLocalError("");
    triggerHaptic("success");
  };

  const handleOpen = async (attachment, download = false) => {
    try {
      triggerHaptic("open");
      if (!download && isImageAttachment(attachment)) {
        setPreviewAttachment(attachment);
        return;
      }
      await openAttachment(attachment, { download });
      await refreshAttachmentCacheState(attachment);
    } catch (error) {
      triggerHaptic("error");
      setLocalError(formatAttachmentError(error, lang));
    }
  };

  const handleShare = async (attachment) => {
    try {
      triggerHaptic("open");
      await shareAttachment(attachment);
      await refreshAttachmentCacheState(attachment);
    } catch (error) {
      triggerHaptic("error");
      setLocalError(formatAttachmentError(error, lang));
    }
  };

  const handlePreviewCacheStateChange = useCallback((attachment) => {
    refreshAttachmentCacheState(attachment);
  }, [refreshAttachmentCacheState]);

  const renderActionButton = ({ label, icon: Icon, onPress }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled || activeUploadState?.uploading}
      onPress={onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: themeColors.backgroundColor,
          borderColor: themeColors.borderColor,
          opacity: disabled || activeUploadState?.uploading ? 0.55 : 1,
        },
      ]}
    >
      <Icon size={17} color={themeColors.accentColor} weight="bold" />
      <Text style={[styles.actionButtonText, { color: themeColors.textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderAttachment = (attachment) => {
    const Icon = getAttachmentKindIcon(attachment);
    const isUploading = activeUploadState?.uploading && activeUploadState?.attachmentId === attachment.id;
    const isRenaming = renamingAttachmentId === attachment.id;
    const progress = Math.round((activeUploadState?.progress || 0) * 100);
    const cacheState = cacheStates[attachment.id]?.status;
    const cacheDetail = attachment?.status === "pending"
      ? null
      : cacheState === "local" || cacheState === "source"
        ? t("attachments.local_ready", lang)
        : cacheState === "stale"
          ? t("attachments.needs_update", lang)
          : cacheState === "remote"
            ? t("attachments.cloud_ready", lang)
            : null;
    const details = isUploading
      ? `${t("attachments.uploading", lang)} ${progress}%`
      : [
        attachment?.status === "pending" ? t("attachments.pending", lang) : null,
        formatFileSize(attachment?.size),
        cacheDetail,
      ].filter(Boolean).join(" - ");

    return (
      <View
        key={attachment.id}
        style={[
          styles.attachmentRow,
          {
            backgroundColor: themeColors.backgroundColor,
            borderColor: isUploading ? themeColors.accentColor : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.fileIcon, { backgroundColor: themeColors.accentColor + "15" }]}>
          <Icon size={20} color={themeColors.accentColor} weight="bold" />
        </View>

        {isRenaming ? (
          <View style={styles.attachmentBody}>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              onSubmitEditing={() => saveRenamedAttachment(attachment)}
              placeholder={t("attachments.rename_placeholder", lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              returnKeyType="done"
              selectTextOnFocus
              maxLength={140}
              style={[
                styles.renameInput,
                {
                  color: themeColors.textColor,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.backgroundColor2 || themeColors.backgroundColor,
                },
              ]}
            />
            {!!details && (
              <Text style={[styles.attachmentDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {details}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.attachmentBody}
            onPress={() => handleOpen(attachment)}
            disabled={isUploading}
          >
            <Text style={[styles.attachmentName, { color: themeColors.textColor }]} numberOfLines={1}>
              {attachment.name || t("attachments.file", lang)}
            </Text>
            {!!details && (
              <Text style={[styles.attachmentDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {details}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.attachmentActions}>
          {isRenaming ? (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading || disabled}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  saveRenamedAttachment(attachment);
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.rename_save", lang)}
              >
                <Check size={18} color={themeColors.accentColor} weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading || disabled}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  cancelRenamingAttachment();
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.rename_cancel", lang)}
              >
                <X size={18} color={themeColors.textColor2} weight="bold" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading || disabled}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  startRenamingAttachment(attachment);
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.rename", lang)}
              >
                <PencilSimple size={18} color={themeColors.textColor2} weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  handleOpen(attachment);
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.open", lang)}
              >
                <ArrowUpRight size={18} color={themeColors.textColor2} weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  handleOpen(attachment, true);
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.download", lang)}
              >
                <DownloadSimple size={18} color={themeColors.textColor2} weight="bold" />
              </TouchableOpacity>
              {Platform.OS === "android" && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={isUploading}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    handleShare(attachment);
                  }}
                  style={styles.iconButton}
                  accessibilityLabel={getAttachmentShareLabel(lang)}
                >
                  <ShareNetwork size={18} color={themeColors.textColor2} weight="bold" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isUploading || disabled}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  removeAttachment(attachment);
                }}
                style={styles.iconButton}
                accessibilityLabel={t("attachments.delete", lang)}
              >
                <Trash size={18} color="#FF3B30" weight="bold" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const displayError = localError || activeUploadState?.error || "";

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        {renderActionButton({
          label: t("attachments.add_file", lang),
          icon: Paperclip,
          onPress: () => runPicker(pickAttachmentFiles),
        })}
        {renderActionButton({
          label: t("attachments.add_photo", lang),
          icon: ImageIcon,
          onPress: () => runPicker(pickAttachmentPhotos),
        })}
        {renderActionButton({
          label: t("attachments.take_photo", lang),
          icon: Camera,
          onPress: () => runPicker(captureAttachmentPhoto),
        })}
        {!!onFileLibraryChange && renderActionButton({
          label: t("attachments.library", lang),
          icon: Files,
          onPress: () => setLibraryOpen((value) => !value),
        })}
      </View>

      {!!displayError && (
        <View style={[styles.errorBox, { backgroundColor: "#FF3B3012", borderColor: "#FF3B3030" }]}>
          <WarningCircle size={17} color="#FF3B30" weight="bold" />
          <Text style={styles.errorText}>{displayError}</Text>
        </View>
      )}

      {libraryOpen && onFileLibraryChange && (
        <View style={[styles.libraryPanel, { borderColor: themeColors.borderColor, backgroundColor: themeColors.backgroundColor }]}>
          {availableLibraryFiles.length === 0 ? (
            <Text style={[styles.libraryEmptyText, { color: themeColors.textColor2 }]}>
              {t("attachments.library_empty", lang)}
            </Text>
          ) : (
            availableLibraryFiles.map((file) => {
              const Icon = getAttachmentKindIcon(file);
              return (
                <TouchableOpacity
                  key={file.id}
                  activeOpacity={0.72}
                  style={styles.libraryFileRow}
                  onPress={() => attachLibraryFile(file)}
                >
                  <Icon size={18} color={themeColors.accentColor} weight="bold" />
                  <View style={styles.libraryFileBody}>
                    <Text style={[styles.libraryFileName, { color: themeColors.textColor }]} numberOfLines={1}>
                      {file.name || t("attachments.file", lang)}
                    </Text>
                    <Text style={[styles.libraryFileMeta, { color: themeColors.textColor2 }]} numberOfLines={1}>
                      {[formatFileSize(file.size), file.storageMode === "local" ? t("attachments.local_only", lang) : t("attachments.cloud_ready", lang)].filter(Boolean).join(" - ")}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {displayAttachments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
            {t("attachments.empty", lang)}
          </Text>
          <Text style={[styles.hintText, { color: themeColors.textColor3 || themeColors.textColor2 }]}>
            {onFileLibraryChange
              ? interpolate(t("attachments.storage_hint", lang), {
                used: formatFileSize(cloudStorageUsed),
                limit: formatFileSize(storageLimitBytes),
              })
              : interpolate(t("attachments.size_hint", lang), {
                limit: formatFileSize(MAX_ATTACHMENT_SIZE_BYTES),
              })}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {displayAttachments.map(renderAttachment)}
        </View>
      )}

      <AttachmentImagePreview
        visible={!!previewAttachment}
        attachment={previewAttachment}
        attachments={displayAttachments}
        onClose={() => setPreviewAttachment(null)}
        onCacheStateChange={handlePreviewCacheStateChange}
        themeColors={themeColors}
        lang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  actionButton: {
    minHeight: 38,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    marginLeft: 6,
  },
  emptyContainer: {
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },
  list: {
    gap: 8,
  },
  libraryPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 4,
  },
  libraryEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    paddingVertical: 6,
  },
  libraryFileRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  libraryFileBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  libraryFileName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  libraryFileMeta: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 1,
  },
  attachmentRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  attachmentBody: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  renameInput: {
    height: 34,
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: Platform.OS === "web" ? 5 : 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  attachmentDetails: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  attachmentActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: Platform.OS === "web" ? 2 : 0,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  errorBox: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    color: "#FF3B30",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginLeft: 7,
  },
});
