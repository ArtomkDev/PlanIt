import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Check,
  Cloud,
  CloudArrowUp,
  CloudSlash,
  DownloadSimple,
  File,
  Image as ImageIcon,
  Camera,
  Paperclip,
  PencilSimple,
  Trash,
  WarningCircle,
  X,
} from "phosphor-react-native";

import SettingsScreenLayout from "../../../layouts/SettingsScreenLayout";
import SettingsGroup from "../../../components/ui/SettingsKit/SettingsGroup";
import AttachmentImagePreview from "../../../components/attachments/AttachmentImagePreview";
import StagedAttachmentImage from "../../../components/attachments/StagedAttachmentImage";
import TabSwitcher from "../../../components/ui/TabSwitcher";
import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import {
  cacheAttachmentFromLocalUri,
  buildAttachmentPickResultFromWebFiles,
  deleteCloudAttachmentObject,
  deleteStoredAttachments,
  deleteStoredAttachment,
  ensureLocalAttachment,
  formatAttachmentError,
  formatFileSize,
  getAttachmentCacheState,
  getAttachmentLibraryUsage,
  getAttachmentRevision,
  isImageAttachment,
  MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES,
  normalizeAttachmentDisplayNameForMimeType,
  normalizeAttachmentDraftList,
  normalizeAttachmentLibrary,
  openAttachment,
  captureAttachmentPhoto,
  pickAttachmentFiles,
  pickAttachmentPhotos,
  renameAttachmentDisplayName,
  uploadAttachmentDraft,
  uploadAttachmentDrafts,
  upsertAttachmentLibraryFiles,
} from "../../../services/attachmentService";
import { t } from "../../../utils/i18n";
import { triggerHaptic } from "../../../utils/haptics";

const interpolate = (template, params = {}) => (
  Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  )
);

const getFileIcon = (file) => (
  String(file?.mimeType || "").startsWith("image/") ? ImageIcon : File
);

const getAttachmentPreviewUri = (file) => (
  file?.localUri || file?.uri || file?.downloadURL || file?.url || ""
);

const getAttachmentFileRefId = (attachment = {}) => (
  attachment.fileId || attachment.libraryId || attachment.id || null
);

const makeFileLibraryAttachmentError = (code, params = {}) => {
  const error = new Error(code);
  error.attachmentCode = code;
  error.params = params;
  return error;
};

const withoutFileReferences = (attachments, fileId) => {
  const cleanList = normalizeAttachmentDraftList(attachments);
  const nextList = cleanList.filter((attachment) => (
    String(getAttachmentFileRefId(attachment)) !== String(fileId)
  ));

  return {
    changed: nextList.length !== cleanList.length,
    attachments: nextList,
  };
};

const withAttachmentList = (item, attachments) => {
  const nextItem = { ...item };
  if (attachments.length > 0) {
    nextItem.attachments = attachments;
  } else {
    delete nextItem.attachments;
  }
  return nextItem;
};

const removeFileReferencesFromSchedule = (schedule, fileId, now) => {
  if (!schedule || typeof schedule !== "object") return schedule;

  let changed = false;

  const nextSubjects = Array.isArray(schedule.subjects)
    ? schedule.subjects.map((subject) => {
      const result = withoutFileReferences(subject?.attachments, fileId);
      if (!result.changed) return subject;
      changed = true;
      return withAttachmentList(subject, result.attachments);
    })
    : schedule.subjects;

  const nextTasks = Array.isArray(schedule.tasks)
    ? schedule.tasks.map((task) => {
      const result = withoutFileReferences(task?.attachments, fileId);
      if (!result.changed) return task;
      changed = true;
      return withAttachmentList(task, result.attachments);
    })
    : schedule.tasks;

  const nextScheduleGrid = Array.isArray(schedule.schedule)
    ? schedule.schedule.map((day) => {
      if (!day || typeof day !== "object") return day;

      let dayChanged = false;
      const nextDay = Object.keys(day).reduce((acc, weekKey) => {
        const lessons = day[weekKey];
        if (!Array.isArray(lessons)) {
          acc[weekKey] = lessons;
          return acc;
        }

        const nextLessons = lessons.map((lesson) => {
          const result = withoutFileReferences(lesson?.attachments, fileId);
          if (!result.changed) return lesson;
          dayChanged = true;
          changed = true;
          return withAttachmentList(lesson, result.attachments);
        });

        acc[weekKey] = nextLessons;
        return acc;
      }, {});

      return dayChanged ? nextDay : day;
    })
    : schedule.schedule;

  if (!changed) return schedule;

  return {
    ...schedule,
    subjects: nextSubjects,
    tasks: nextTasks,
    schedule: nextScheduleGrid,
    lastModified: now,
  };
};

export default function FileLibraryScreen() {
  const { global, lang, user } = useScheduleData();
  const { setData } = useScheduleActions();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const [busyFileId, setBusyFileId] = useState(null);
  const [error, setError] = useState("");
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [activeFileTab, setActiveFileTab] = useState("photos");
  const [photoPreviewCache, setPhotoPreviewCache] = useState({});
  const [addingSource, setAddingSource] = useState(null);
  const photoPreviewLoadsRef = useRef(new Set());
  const photoPreviewCacheRef = useRef({});
  const webDropDepthRef = useRef(0);
  const webDropZoneRef = useRef(null);
  const [webDropActive, setWebDropActive] = useState(false);
  const isWebLayout = Platform.OS === "web";

  const files = useMemo(
    () => normalizeAttachmentLibrary(global?.fileLibrary),
    [global?.fileLibrary]
  );
  const basePhotoFiles = useMemo(() => files.filter(isImageAttachment), [files]);
  const filesWithPreviewUris = useMemo(() => (
    files.map((file) => {
      const cachedPreview = photoPreviewCache[file.id];
      const revision = getAttachmentRevision(file);
      return cachedPreview?.uri && cachedPreview.revision === revision
        ? { ...file, localUri: cachedPreview.uri }
        : file;
    })
  ), [files, photoPreviewCache]);
  const photoFiles = useMemo(() => filesWithPreviewUris.filter(isImageAttachment), [filesWithPreviewUris]);
  const otherFiles = useMemo(() => filesWithPreviewUris.filter((file) => !isImageAttachment(file)), [filesWithPreviewUris]);
  const visibleFiles = activeFileTab === "photos" ? photoFiles : otherFiles;
  const cloudUsage = useMemo(() => getAttachmentLibraryUsage(files), [files]);
  const cloudFilesCount = files.filter((file) => file.storageMode !== "local").length;
  const localFilesCount = files.filter((file) => file.storageMode === "local").length;
  const usageRatio = MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES > 0
    ? Math.min(1, cloudUsage / MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES)
    : 0;
  const usagePercent = Math.round(usageRatio * 100);
  const fileTabs = useMemo(() => ([
    {
      id: "photos",
      label: `${t("settings.files.photos_tab", lang)} (${photoFiles.length})`,
    },
    {
      id: "files",
      label: `${t("settings.files.other_files_tab", lang)} (${otherFiles.length})`,
    },
  ]), [lang, otherFiles.length, photoFiles.length]);

  const rememberPhotoPreview = useCallback((file) => {
    if (!file?.id || !isImageAttachment(file)) return;
    const previewUri = getAttachmentPreviewUri(file);
    if (!previewUri) return;

    const revision = getAttachmentRevision(file);
    setPhotoPreviewCache((currentCache) => {
      const currentEntry = currentCache[file.id];
      if (currentEntry?.uri === previewUri && currentEntry?.revision === revision) return currentCache;
      return {
        ...currentCache,
        [file.id]: { uri: previewUri, revision },
      };
    });
  }, []);

  useEffect(() => {
    photoPreviewCacheRef.current = photoPreviewCache;
  }, [photoPreviewCache]);

  useEffect(() => {
    let active = true;

    const loadPhotoPreviewsFromCache = async () => {
      if (activeFileTab !== "photos") return;

      for (const file of basePhotoFiles) {
        if (!active || !file?.id) return;

        const revision = getAttachmentRevision(file);
        const currentEntry = photoPreviewCacheRef.current[file.id];
        if (currentEntry?.uri && currentEntry.revision === revision) continue;

        const loadKey = `${file.id}:${revision}`;
        if (photoPreviewLoadsRef.current.has(loadKey)) continue;
        photoPreviewLoadsRef.current.add(loadKey);

        try {
          const cacheState = await getAttachmentCacheState(file);
          const prepared = (
            (cacheState.status === "local" || cacheState.status === "source")
            && cacheState.uri
          )
            ? { ...file, localUri: cacheState.uri, openUri: cacheState.uri }
            : await ensureLocalAttachment(file);
          const previewUri = getAttachmentPreviewUri(prepared);
          if (!active || !previewUri) continue;

          setPhotoPreviewCache((currentCache) => {
            const nextEntry = { uri: previewUri, revision };
            const current = currentCache[file.id];
            if (current?.uri === nextEntry.uri && current?.revision === nextEntry.revision) return currentCache;
            return { ...currentCache, [file.id]: nextEntry };
          });
        } catch (error) {
          const fallbackUri = file.localUri || file.uri || file.downloadURL || file.url || "";
          if (active && fallbackUri) {
            setPhotoPreviewCache((currentCache) => ({
              ...currentCache,
              [file.id]: { uri: fallbackUri, revision },
            }));
          }
        } finally {
          photoPreviewLoadsRef.current.delete(loadKey);
        }
      }
    };

    loadPhotoPreviewsFromCache();
    return () => {
      active = false;
    };
  }, [activeFileTab, basePhotoFiles]);

  const setLibraryFiles = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const currentFiles = normalizeAttachmentLibrary(prev.global?.fileLibrary);
      const nextFiles = typeof updater === "function" ? updater(currentFiles) : updater;

      return {
        ...prev,
        global: {
          ...(prev.global || {}),
          fileLibrary: normalizeAttachmentLibrary(nextFiles),
          lastModified: Date.now(),
        },
      };
    });
  }, [setData]);

  const setLibraryAndRemoveReferences = useCallback((fileId) => {
    const now = Date.now();
    setData((prev) => {
      if (!prev) return prev;
      const nextFiles = normalizeAttachmentLibrary(prev.global?.fileLibrary)
        .filter((file) => String(file.id) !== String(fileId));

      return {
        ...prev,
        global: {
          ...(prev.global || {}),
          fileLibrary: nextFiles,
          lastModified: now,
        },
        schedules: Array.isArray(prev.schedules)
          ? prev.schedules.map((schedule) => removeFileReferencesFromSchedule(schedule, fileId, now))
          : prev.schedules,
      };
    });
  }, [setData]);

  const setFileError = useCallback((nextError) => {
    triggerHaptic("error");
    setError(nextError);
  }, []);

  const updateFileRecord = useCallback((file) => {
    setLibraryFiles((currentFiles) => upsertAttachmentLibraryFiles(currentFiles, [file]));
  }, [setLibraryFiles]);

  const handleOpen = async (file, download = false) => {
    try {
      triggerHaptic("open");
      setError("");
      if (!download && isImageAttachment(file)) {
        setPreviewFile(file);
        return;
      }
      await openAttachment(file, { download });
    } catch (openError) {
      setFileError(formatAttachmentError(openError, lang));
    }
  };

  const handlePreviewCacheStateChange = useCallback((file) => {
    rememberPhotoPreview(file);
  }, [rememberPhotoPreview]);

  const uploadLibraryPickResult = async (pickResult, fallbackTab = "files") => {
    const pickedFiles = pickResult?.attachments || [];
    const pickErrors = pickResult?.errors || [];

    if (!pickedFiles.length) {
      if (pickErrors.length) {
        setFileError(pickErrors.slice(0, 2).map((item) => formatAttachmentError(item, lang)).join("\n"));
      }
      return;
    }

    const uploadedFiles = await uploadAttachmentDrafts(pickedFiles, { userId: user.uid });
    const nextCloudUsage = cloudUsage + getAttachmentLibraryUsage(uploadedFiles);

    if (nextCloudUsage > MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES) {
      await deleteStoredAttachments(uploadedFiles);
      const limitError = new Error("storage_limit_reached");
      limitError.attachmentCode = "storage_limit_reached";
      throw limitError;
    }

    setLibraryFiles((currentFiles) => upsertAttachmentLibraryFiles(currentFiles, uploadedFiles));
    uploadedFiles.forEach(rememberPhotoPreview);
    setActiveFileTab(uploadedFiles.some(isImageAttachment) ? "photos" : fallbackTab);

    if (pickErrors.length) {
      setError(pickErrors.slice(0, 2).map((item) => formatAttachmentError(item, lang)).join("\n"));
    } else {
      setError("");
    }
    triggerHaptic("success");
  };

  const handleAddLibraryFiles = async (picker, sourceId, fallbackTab = "files") => {
    if (addingSource) return;

    if (!user?.uid) {
      setFileError(t("attachments.errors.auth_required", lang));
      return;
    }

    setAddingSource(sourceId);
    setError("");

    try {
      const pickResult = await picker({ currentCount: 0 });
      await uploadLibraryPickResult(pickResult, fallbackTab);
    } catch (addError) {
      setFileError(formatAttachmentError(addError, lang));
    } finally {
      setAddingSource(null);
    }
  };

  const stopWebDropEvent = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.nativeEvent?.preventDefault?.();
    event?.nativeEvent?.stopPropagation?.();

    const dataTransfer = event?.dataTransfer || event?.nativeEvent?.dataTransfer;
    if (dataTransfer) dataTransfer.dropEffect = "copy";
  };

  const getWebDroppedFiles = (event) => (
    Array.from((event?.dataTransfer || event?.nativeEvent?.dataTransfer)?.files || [])
  );

  const handleWebDropEnter = (event) => {
    if (!isWebLayout) return;
    stopWebDropEvent(event);
    webDropDepthRef.current += 1;
    if (!addingSource) setWebDropActive(true);
  };

  const handleWebDropLeave = (event) => {
    if (!isWebLayout) return;
    stopWebDropEvent(event);
    webDropDepthRef.current = Math.max(0, webDropDepthRef.current - 1);
    if (webDropDepthRef.current === 0) setWebDropActive(false);
  };

  const handleWebDrop = async (event) => {
    if (!isWebLayout) return;
    stopWebDropEvent(event);
    webDropDepthRef.current = 0;
    setWebDropActive(false);

    if (addingSource) return;

    if (!user?.uid) {
      setFileError(t("attachments.errors.auth_required", lang));
      return;
    }

    const droppedFiles = getWebDroppedFiles(event);
    if (!droppedFiles.length) return;

    setAddingSource("drop");
    setError("");

    try {
      const pickResult = buildAttachmentPickResultFromWebFiles(droppedFiles, 0);
      await uploadLibraryPickResult(pickResult, "files");
    } catch (dropError) {
      setFileError(formatAttachmentError(dropError, lang));
    } finally {
      setAddingSource(null);
    }
  };

  useEffect(() => {
    if (!isWebLayout || typeof window === "undefined") return undefined;

    const preventBrowserFileOpen = (event) => {
      const types = Array.from(event?.dataTransfer?.types || []);
      if (!types.includes("Files")) return;
      event.preventDefault();
    };

    window.addEventListener("dragover", preventBrowserFileOpen, true);
    window.addEventListener("drop", preventBrowserFileOpen, true);

    return () => {
      window.removeEventListener("dragover", preventBrowserFileOpen, true);
      window.removeEventListener("drop", preventBrowserFileOpen, true);
    };
  }, [isWebLayout]);

  useEffect(() => {
    if (!isWebLayout) return undefined;

    const refNode = webDropZoneRef.current;
    const dropNode = typeof refNode?.addEventListener === "function"
      ? refNode
      : findNodeHandle(refNode);

    if (!dropNode || typeof dropNode.addEventListener !== "function") return undefined;

    dropNode.addEventListener("dragenter", handleWebDropEnter);
    dropNode.addEventListener("dragover", stopWebDropEvent);
    dropNode.addEventListener("dragleave", handleWebDropLeave);
    dropNode.addEventListener("drop", handleWebDrop);

    return () => {
      dropNode.removeEventListener("dragenter", handleWebDropEnter);
      dropNode.removeEventListener("dragover", stopWebDropEvent);
      dropNode.removeEventListener("dragleave", handleWebDropLeave);
      dropNode.removeEventListener("drop", handleWebDrop);
    };
  }, [handleWebDrop, handleWebDropEnter, handleWebDropLeave, isWebLayout]);

  const renderAddLibraryButton = ({ id, icon: Icon, label, picker, fallbackTab }) => {
    const isAdding = addingSource === id;
    const isDisabled = !!addingSource;

    return (
      <TouchableOpacity
        activeOpacity={0.76}
        disabled={isDisabled}
        onPress={() => handleAddLibraryFiles(picker, id, fallbackTab)}
        style={[
          styles.addLibraryButton,
          {
            backgroundColor: isAdding ? themeColors.accentColor : themeColors.backgroundColor2,
            borderColor: isAdding ? themeColors.accentColor : themeColors.borderColor,
            opacity: isDisabled && !isAdding ? 0.58 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon
          size={18}
          color={isAdding ? "#fff" : themeColors.accentColor}
          weight="bold"
        />
        <Text
          style={[
            styles.addLibraryButtonText,
            { color: isAdding ? "#fff" : themeColors.textColor },
          ]}
          numberOfLines={1}
        >
          {isAdding ? t("settings.files.adding_file", lang) : label}
        </Text>
      </TouchableOpacity>
    );
  };

  const startRename = (file) => {
    if (!file?.id || busyFileId) return;
    triggerHaptic("selection");
    setRenamingFileId(file.id);
    setRenameValue(file.name || "");
    setError("");
  };

  const cancelRename = () => {
    setRenamingFileId(null);
    setRenameValue("");
  };

  const saveRename = (file) => {
    if (!file?.id) return;
    const renamedFile = renameAttachmentDisplayName(file, renameValue);
    updateFileRecord({
      ...file,
      name: renamedFile.name,
    });
    setRenamingFileId(null);
    setRenameValue("");
    setError("");
    triggerHaptic("success");
  };

  const makeLocalOnly = async (file) => {
    if (!file?.id || file.storageMode === "local") return;

    setBusyFileId(file.id);
    setError("");
    try {
      const prepared = await ensureLocalAttachment(file, { forceDownload: true });
      const localFile = {
        ...file,
        storageMode: "local",
        storagePath: null,
        downloadURL: null,
        cloudRevision: getAttachmentRevision(file) || Date.now(),
      };
      delete localFile.cacheState;
      delete localFile.cacheRevision;
      delete localFile.localUri;
      delete localFile.openUri;
      delete localFile.uri;
      const cachedLocalFile = await cacheAttachmentFromLocalUri(
        localFile,
        prepared.localUri || prepared.openUri || file.downloadURL || file.url
      );
      const cacheState = await getAttachmentCacheState(localFile);
      if (!cacheState?.uri || (cacheState.status !== "local" && cacheState.status !== "source")) {
        throw makeFileLibraryAttachmentError("cache_unavailable", { name: file.name });
      }
      await deleteCloudAttachmentObject(file);
      updateFileRecord(cachedLocalFile);
      rememberPhotoPreview(cachedLocalFile);
      triggerHaptic("success");
    } catch (localError) {
      setFileError(formatAttachmentError(localError, lang));
    } finally {
      setBusyFileId(null);
    }
  };

  const confirmMakeLocalOnly = (file) => {
    Alert.alert(
      t("settings.files.local_only_title", lang),
      t("settings.files.local_only_confirm", lang),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        {
          text: t("settings.files.local_only_action", lang),
          style: "destructive",
          onPress: () => makeLocalOnly(file),
        },
      ]
    );
  };

  const makeCloudSynced = async (file) => {
    if (!file?.id || file.storageMode !== "local") return;

    if (!user?.uid) {
      setFileError(t("attachments.errors.auth_required", lang));
      return;
    }

    setBusyFileId(file.id);
    setError("");
    try {
      const prepared = await ensureLocalAttachment(file);
      const uploadSource = { ...file };
      delete uploadSource.cacheKey;
      delete uploadSource.cacheState;
      delete uploadSource.cacheRevision;
      delete uploadSource.localUri;
      delete uploadSource.openUri;
      delete uploadSource.uri;
      const draft = {
        ...uploadSource,
        id: file.id,
        fileId: file.id,
        storageMode: "cloud",
        storagePath: null,
        downloadURL: null,
        localUri: prepared.localUri || prepared.openUri || file.localUri || file.uri,
        uri: prepared.openUri || prepared.localUri || file.uri,
        status: "pending",
      };
      const uploaded = await uploadAttachmentDraft(draft, { userId: user.uid });
      const nextCloudUsage = cloudUsage + (Number(uploaded.size) || 0);

      if (nextCloudUsage > MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES) {
        await deleteCloudAttachmentObject(uploaded);
        const limitError = new Error("storage_limit_reached");
        limitError.attachmentCode = "storage_limit_reached";
        throw limitError;
      }

      const cloudFile = {
        ...uploaded,
        id: file.id,
        fileId: file.id,
        name: normalizeAttachmentDisplayNameForMimeType(file.name, uploaded.mimeType),
        createdAt: file.createdAt,
        storageMode: "cloud",
      };
      updateFileRecord(cloudFile);
      rememberPhotoPreview(cloudFile);
      triggerHaptic("success");
    } catch (cloudError) {
      setFileError(formatAttachmentError(cloudError, lang));
    } finally {
      setBusyFileId(null);
    }
  };

  const deleteFile = async (file) => {
    if (!file?.id) return;

    setBusyFileId(file.id);
    setError("");
    try {
      await deleteStoredAttachment(file);
      setLibraryAndRemoveReferences(file.id);
      triggerHaptic("success");
    } catch (deleteError) {
      setFileError(formatAttachmentError(deleteError, lang));
    } finally {
      setBusyFileId(null);
    }
  };

  const confirmDeleteFile = (file) => {
    Alert.alert(
      t("settings.files.delete_title", lang),
      interpolate(t("settings.files.delete_confirm", lang), {
        name: file?.name || t("attachments.file", lang),
      }),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        {
          text: t("common.delete", lang),
          style: "destructive",
          onPress: () => deleteFile(file),
        },
      ]
    );
  };

  const renderIconButton = ({ icon: Icon, color, onPress, disabled, label, danger }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.iconButton,
        {
          backgroundColor: danger ? "#FF3B3012" : themeColors.backgroundColor3,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Icon size={18} color={color || themeColors.textColor2} weight="bold" />
    </TouchableOpacity>
  );

  const renderFileRow = (file) => {
    const Icon = getFileIcon(file);
    const isBusy = busyFileId === file.id;
    const isRenaming = renamingFileId === file.id;
    const modeLabel = file.storageMode === "local"
      ? t("attachments.local_only", lang)
      : t("attachments.cloud_ready", lang);
    const details = [
      formatFileSize(file.size),
      modeLabel,
    ].filter(Boolean).join(" - ");

    return (
      <View
        key={file.id}
        style={[
          styles.fileRow,
          {
            borderBottomColor: themeColors.borderColor,
            opacity: isBusy ? 0.58 : 1,
          },
        ]}
      >
        <View style={[styles.fileIcon, { backgroundColor: themeColors.accentColor + "18" }]}>
          <Icon size={20} color={themeColors.accentColor} weight="bold" />
        </View>

        {isRenaming ? (
          <View style={styles.fileBody}>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              onSubmitEditing={() => saveRename(file)}
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
                  backgroundColor: themeColors.backgroundColor,
                },
              ]}
            />
            {!!details && (
              <Text style={[styles.fileDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {details}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.fileBody}
            disabled={isBusy}
            onPress={() => handleOpen(file)}
          >
            <Text style={[styles.fileName, { color: themeColors.textColor }]} numberOfLines={1}>
              {file.name || t("attachments.file", lang)}
            </Text>
            {!!details && (
              <Text style={[styles.fileDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {details}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          {isRenaming ? (
            <>
              {renderIconButton({
                icon: Check,
                color: themeColors.accentColor,
                disabled: isBusy,
                label: t("attachments.rename_save", lang),
                onPress: () => saveRename(file),
              })}
              {renderIconButton({
                icon: X,
                disabled: isBusy,
                label: t("attachments.rename_cancel", lang),
                onPress: cancelRename,
              })}
            </>
          ) : (
            <>
              {renderIconButton({
                icon: PencilSimple,
                disabled: isBusy,
                label: t("attachments.rename", lang),
                onPress: () => startRename(file),
              })}
              {renderIconButton({
                icon: DownloadSimple,
                disabled: isBusy,
                label: t("attachments.download", lang),
                onPress: () => handleOpen(file, true),
              })}
              {renderIconButton({
                icon: file.storageMode === "local" ? CloudArrowUp : CloudSlash,
                color: file.storageMode === "local" ? themeColors.accentColor : themeColors.textColor2,
                disabled: isBusy || (file.storageMode === "local" && !user?.uid),
                label: file.storageMode === "local"
                  ? t("settings.files.make_cloud", lang)
                  : t("settings.files.make_local", lang),
                onPress: () => (
                  file.storageMode === "local"
                    ? makeCloudSynced(file)
                    : confirmMakeLocalOnly(file)
                ),
              })}
              {renderIconButton({
                icon: Trash,
                color: "#FF3B30",
                disabled: isBusy,
                danger: true,
                label: t("attachments.delete", lang),
                onPress: () => confirmDeleteFile(file),
              })}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderPhotoRow = (file) => {
    const isBusy = busyFileId === file.id;
    const isRenaming = renamingFileId === file.id;
    const previewUri = getAttachmentPreviewUri(file);
    const modeLabel = file.storageMode === "local"
      ? t("attachments.local_only", lang)
      : t("attachments.cloud_ready", lang);
    const details = [
      formatFileSize(file.size),
      modeLabel,
    ].filter(Boolean).join(" - ");

    return (
      <View
        key={file.id}
        style={[
          styles.photoRow,
          {
            borderBottomColor: themeColors.borderColor,
            opacity: isBusy ? 0.58 : 1,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.74}
          disabled={isBusy}
          onPress={() => handleOpen(file)}
          style={[
            styles.photoThumb,
            { backgroundColor: themeColors.backgroundColor3 },
          ]}
        >
          <StagedAttachmentImage
            uri={previewUri}
            attachment={file}
            resizeMode="cover"
            baseColor={themeColors.backgroundColor3}
            style={styles.photoThumbImage}
          />
        </TouchableOpacity>

        <View style={styles.photoSide}>
          {isRenaming ? (
            <View style={styles.fileBody}>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                onSubmitEditing={() => saveRename(file)}
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
                    backgroundColor: themeColors.backgroundColor,
                  },
                ]}
              />
              {!!details && (
                <Text style={[styles.fileDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {details}
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.72}
              disabled={isBusy}
              onPress={() => handleOpen(file)}
              style={styles.fileBody}
            >
              <Text style={[styles.fileName, { color: themeColors.textColor }]} numberOfLines={1}>
                {file.name || t("attachments.file", lang)}
              </Text>
              {!!details && (
                <Text style={[styles.fileDetails, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {details}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={[styles.actions, styles.photoActions]}>
            {isRenaming ? (
              <>
                {renderIconButton({
                  icon: Check,
                  color: themeColors.accentColor,
                  disabled: isBusy,
                  label: t("attachments.rename_save", lang),
                  onPress: () => saveRename(file),
                })}
                {renderIconButton({
                  icon: X,
                  disabled: isBusy,
                  label: t("attachments.rename_cancel", lang),
                  onPress: cancelRename,
                })}
              </>
            ) : (
              <>
                {renderIconButton({
                  icon: PencilSimple,
                  disabled: isBusy,
                  label: t("attachments.rename", lang),
                  onPress: () => startRename(file),
                })}
                {renderIconButton({
                  icon: DownloadSimple,
                  disabled: isBusy,
                  label: t("attachments.download", lang),
                  onPress: () => handleOpen(file, true),
                })}
                {renderIconButton({
                  icon: file.storageMode === "local" ? CloudArrowUp : CloudSlash,
                  color: file.storageMode === "local" ? themeColors.accentColor : themeColors.textColor2,
                  disabled: isBusy || (file.storageMode === "local" && !user?.uid),
                  label: file.storageMode === "local"
                    ? t("settings.files.make_cloud", lang)
                    : t("settings.files.make_local", lang),
                  onPress: () => (
                    file.storageMode === "local"
                      ? makeCloudSynced(file)
                      : confirmMakeLocalOnly(file)
                  ),
                })}
                {renderIconButton({
                  icon: Trash,
                  color: "#FF3B30",
                  disabled: isBusy,
                  danger: true,
                  label: t("attachments.delete", lang),
                  onPress: () => confirmDeleteFile(file),
                })}
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    const emptyTitle = files.length === 0
      ? t("settings.files.empty_title", lang)
      : activeFileTab === "photos"
        ? t("settings.files.empty_photos_title", lang)
        : t("settings.files.empty_other_title", lang);
    const emptyDesc = files.length === 0
      ? t("settings.files.empty_desc", lang)
      : activeFileTab === "photos"
        ? t("settings.files.empty_photos_desc", lang)
        : t("settings.files.empty_other_desc", lang);

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: themeColors.textColor }]}>
          {emptyTitle}
        </Text>
        <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
          {emptyDesc}
        </Text>
      </View>
    );
  };

  return (
    <SettingsScreenLayout contentContainerStyle={styles.container}>
      <SettingsGroup
        themeColors={themeColors}
        title={t("settings.files.storage_title", lang)}
      >
        <View style={styles.storagePanel}>
          <View style={styles.storageHeader}>
            <View style={[styles.storageIcon, { backgroundColor: themeColors.accentColor + "18" }]}>
              <Cloud size={22} color={themeColors.accentColor} weight="bold" />
            </View>
            <View style={styles.storageTextBlock}>
              <Text style={[styles.storageValue, { color: themeColors.textColor }]}>
                {interpolate(t("settings.files.storage_used", lang), {
                  used: formatFileSize(cloudUsage) || "0 B",
                  limit: formatFileSize(MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES),
                })}
              </Text>
              <Text style={[styles.storageMeta, { color: themeColors.textColor2 }]}>
                {interpolate(t("settings.files.storage_counts", lang), {
                  cloud: cloudFilesCount,
                  local: localFilesCount,
                })}
              </Text>
            </View>
            <Text
              style={[
                styles.storagePercent,
                {
                  color: usageRatio >= 0.92 ? "#FF3B30" : themeColors.accentColor,
                  backgroundColor: usageRatio >= 0.92 ? "#FF3B3014" : themeColors.accentColor + "14",
                },
              ]}
              numberOfLines={1}
            >
              {usagePercent}%
            </Text>
          </View>

          <View style={[styles.usageTrack, { backgroundColor: themeColors.backgroundColor3 }]}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.round(usageRatio * 100)}%`,
                  backgroundColor: usageRatio >= 0.92 ? "#FF3B30" : themeColors.accentColor,
                },
              ]}
            />
          </View>
        </View>
      </SettingsGroup>

      {isWebLayout ? (
        <View
          ref={webDropZoneRef}
          style={[
            styles.webUploadPanel,
            {
              backgroundColor: webDropActive ? themeColors.accentColor + "14" : themeColors.backgroundColor2,
              borderColor: webDropActive ? themeColors.accentColor : themeColors.borderColor,
              borderWidth: webDropActive ? 2 : 1,
              boxShadow: webDropActive ? `0 12px 28px ${themeColors.accentColor}26` : "none",
              transform: [{ scale: webDropActive ? 1.01 : 1 }],
            },
          ]}
        >
          <View
            style={[
              styles.webUploadIcon,
              { backgroundColor: webDropActive ? themeColors.accentColor : themeColors.accentColor + "18" },
            ]}
          >
            <CloudArrowUp size={24} color={webDropActive ? "#fff" : themeColors.accentColor} weight="bold" />
          </View>
          <View style={styles.webUploadTextBlock}>
            <Text style={[styles.webUploadTitle, { color: themeColors.textColor }]} numberOfLines={1}>
              {addingSource === "drop"
                ? t("settings.files.adding_file", lang)
                : webDropActive
                  ? t("settings.files.web_drop_active", lang)
                  : t("settings.files.web_drop_title", lang)}
            </Text>
            <Text style={[styles.webUploadDesc, { color: themeColors.textColor2 }]} numberOfLines={2}>
              {t("settings.files.web_drop_desc", lang)}
            </Text>
          </View>
          <View style={styles.webUploadButtonWrap}>
            {renderAddLibraryButton({
              id: "files",
              icon: Paperclip,
              label: t("settings.files.web_upload_action", lang),
              picker: pickAttachmentFiles,
              fallbackTab: "files",
            })}
          </View>
        </View>
      ) : (
        <View style={styles.addActionRow}>
          {renderAddLibraryButton({
            id: "files",
            icon: Paperclip,
            label: t("settings.files.add_files", lang),
            picker: pickAttachmentFiles,
            fallbackTab: "files",
          })}
          {renderAddLibraryButton({
            id: "photo",
            icon: Camera,
            label: t("settings.files.add_photo", lang),
            picker: captureAttachmentPhoto,
            fallbackTab: "photos",
          })}
          {renderAddLibraryButton({
            id: "gallery",
            icon: ImageIcon,
            label: t("settings.files.add_gallery", lang),
            picker: pickAttachmentPhotos,
            fallbackTab: "photos",
          })}
        </View>
      )}

      <View style={styles.libraryTabs}>
        <TabSwitcher
          tabs={fileTabs}
          activeTab={activeFileTab}
          onTabPress={setActiveFileTab}
          themeColors={themeColors}
          containerBorderColor={themeColors.borderColor}
          activeTabBackgroundColor={themeColors.accentColor}
          withShadow
        />
      </View>

      {!!error && (
        <View style={[styles.errorBox, { borderColor: "#FF3B3030", backgroundColor: "#FF3B3012" }]}>
          <WarningCircle size={18} color="#FF3B30" weight="bold" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <SettingsGroup
        themeColors={themeColors}
        title={activeFileTab === "photos"
          ? t("settings.files.photos_title", lang)
          : t("settings.files.other_files_title", lang)}
      >
        {visibleFiles.length === 0 ? (
          renderEmptyState()
        ) : (
          visibleFiles.map((file) => (
            activeFileTab === "photos" ? renderPhotoRow(file) : renderFileRow(file)
          ))
        )}
      </SettingsGroup>

      <AttachmentImagePreview
        visible={!!previewFile}
        attachment={previewFile}
        attachments={filesWithPreviewUris}
        onClose={() => setPreviewFile(null)}
        onCacheStateChange={handlePreviewCacheStateChange}
        themeColors={themeColors}
        lang={lang}
      />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  storagePanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  storageIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  storageTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  storageValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  storageMeta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  storagePercent: {
    flexShrink: 0,
    minWidth: 54,
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  usageTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 14,
  },
  usageFill: {
    height: "100%",
    borderRadius: 4,
  },
  addActionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  addLibraryButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  addLibraryButtonText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginLeft: 8,
  },
  webUploadPanel: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  webUploadIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  webUploadTextBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  webUploadTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  webUploadDesc: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  webUploadButtonWrap: {
    width: 184,
    maxWidth: "34%",
  },
  libraryTabs: {
    marginBottom: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    color: "#FF3B30",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  emptyState: {
    minHeight: 92,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  fileRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  fileBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  fileName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  fileDetails: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  renameInput: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "web" ? 5 : 0,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  actions: {
    flexShrink: 0,
    maxWidth: 220,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: Platform.OS === "web" ? 6 : 4,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRow: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  photoThumb: {
    width: 92,
    height: 92,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 12,
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  photoSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
  },
  photoActions: {
    alignSelf: "flex-end",
    marginTop: 10,
  },
});
