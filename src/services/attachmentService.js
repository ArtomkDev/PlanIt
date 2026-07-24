import { Platform, Linking, Image as NativeImage } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import {
  deleteObject,
  getDownloadURL,
  ref,
  updateMetadata,
  uploadBytesResumable,
  uploadString,
} from "firebase/storage";

import { auth, storage, storageBucketName } from "../config/firebase";
import { generateId } from "../utils/idGenerator";
import { t } from "../utils/i18n";

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ENTITY = 10;
export const MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_UPLOAD_COMPRESSION_TARGET_BYTES = 620 * 1024;
const IMAGE_UPLOAD_COMPRESSION_MAX_DIMENSION = 1800;
const IMAGE_UPLOAD_COMPRESSION_DIMENSION_STEPS = [1800, 1600, 1440, 1280];
const IMAGE_UPLOAD_WEBP_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64];
const IMAGE_UPLOAD_JPEG_FALLBACK_QUALITY_STEPS = [0.78, 0.68, 0.58, 0.5];
const IMAGE_PREVIEW_MAX_DIMENSION = 28;
const IMAGE_PREVIEW_JPEG_QUALITY = 0.24;
const IMAGE_PREVIEW_MAX_DATA_URI_LENGTH = 4200;
const COMPRESSIBLE_IMAGE_MIME_TYPES = new Set([
  "image/bmp",
  "image/heic",
  "image/heif",
  "image/jpg",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const NEVER_REENCODE_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/svg+xml",
]);
const IMAGE_UPLOAD_OUTPUT_FORMATS = [
  {
    codec: "webp",
    extension: "webp",
    mimeType: "image/webp",
    nativeFormat: ImageManipulator.SaveFormat?.WEBP || "webp",
    qualitySteps: IMAGE_UPLOAD_WEBP_QUALITY_STEPS,
  },
  {
    codec: "jpeg",
    extension: "jpg",
    mimeType: "image/jpeg",
    nativeFormat: ImageManipulator.SaveFormat?.JPEG || "jpeg",
    qualitySteps: IMAGE_UPLOAD_JPEG_FALLBACK_QUALITY_STEPS,
  },
];

const ATTACHMENT_CACHE_MANIFEST_KEY = "planit_attachment_cache_manifest_v1";
const ATTACHMENT_CACHE_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}attachments/`
  : null;
const ANDROID_DOWNLOAD_DIRECTORY_URI_KEY = "planit_android_download_directory_uri_v1";
const ANDROID_DOWNLOAD_FOLDER_NAME = "Download";
const WEB_ATTACHMENT_CACHE_DB_NAME = "planit_attachment_cache_v1";
const WEB_ATTACHMENT_CACHE_STORE = "attachments";
const CACHE_FRESH_STATUSES = new Set(["local", "source"]);

const MIME_BY_EXTENSION = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

const EXTENSION_BY_MIME = {
  "application/msword": "doc",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/x-zip-compressed": "zip",
  "application/zip": "zip",
  "image/bmp": "jpg",
  "image/gif": "gif",
  "image/heic": "jpg",
  "image/heif": "jpg",
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/csv": "csv",
  "text/markdown": "md",
  "text/plain": "txt",
};

const EXACT_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-zip-compressed",
  "application/zip",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

const PICKER_MIME_TYPES = [
  "image/*",
  "text/*",
  ...Array.from(EXACT_MIME_TYPES),
];

const makeAttachmentError = (code, params = {}) => {
  const error = new Error(code);
  error.attachmentCode = code;
  error.params = params;
  return error;
};

const FIREBASE_STORAGE_ERROR_CODES = {
  "storage/bucket-not-found": "storage_not_configured",
  "storage/canceled": "upload_canceled",
  "storage/invalid-url": "storage_not_configured",
  "storage/no-default-bucket": "storage_not_configured",
  "storage/object-not-found": "open_failed",
  "storage/project-not-found": "storage_not_configured",
  "storage/quota-exceeded": "storage_quota_exceeded",
  "storage/retry-limit-exceeded": "network_failed",
  "storage/unauthenticated": "auth_required",
  "storage/unauthorized": "storage_unauthorized",
};

export const getAttachmentErrorCode = (error) => {
  if (error?.attachmentCode) return error.attachmentCode;
  if (FIREBASE_STORAGE_ERROR_CODES[error?.code]) return FIREBASE_STORAGE_ERROR_CODES[error.code];

  const message = String(error?.message || "").toLowerCase();
  if (message.includes("permission") || message.includes("unauthorized")) {
    return "storage_unauthorized";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "network_failed";
  }
  return "upload_failed";
};

const interpolate = (template, params = {}) => (
  Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  )
);

const getExtension = (name = "") => {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
};

const getAssetFile = (asset) => (
  asset?.file
  || (asset?.output && asset.output[0])
  || null
);

const getAssetName = (asset = {}, fallbackPrefix = "attachment") => {
  const file = getAssetFile(asset);
  return (
    file?.name
    || asset.name
    || asset.fileName
    || `${fallbackPrefix}-${Date.now()}.jpg`
  );
};

const getAssetSize = (asset = {}) => {
  const file = getAssetFile(asset);
  return Number(file?.size ?? asset.size ?? asset.fileSize ?? 0) || 0;
};

export const inferAttachmentMimeType = (name, mimeType, fallback = "application/octet-stream") => {
  const normalizedMime = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";
  if (normalizedMime) return normalizedMime;
  return MIME_BY_EXTENSION[getExtension(name)] || fallback;
};

export const isAttachmentMimeTypeAllowed = (name, mimeType) => {
  const resolvedMime = inferAttachmentMimeType(name, mimeType, "");
  if (!resolvedMime) return false;
  if (resolvedMime === "image/svg+xml") return false;
  if (resolvedMime.startsWith("image/")) return true;
  if (resolvedMime.startsWith("text/")) return true;
  return EXACT_MIME_TYPES.has(resolvedMime);
};

const sanitizeFileName = (name = "attachment") => (
  String(name)
    .replace(/[\\/#?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
  || "attachment"
);

const sanitizePathSegment = (value = "attachment") => (
  String(value)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120)
  || "attachment"
);

export const normalizeAttachmentDisplayName = (name, attachment = {}) => {
  const requestedName = sanitizeFileName(name || attachment.name || "attachment")
    .replace(/^\.+/, "")
    .trim();
  return requestedName || "attachment";
};

export const normalizeAttachmentDisplayNameForMimeType = (name, mimeType) => {
  const displayName = normalizeAttachmentDisplayName(name || "attachment");
  const resolvedMimeType = inferAttachmentMimeType(displayName, mimeType, "");
  const extension = EXTENSION_BY_MIME[resolvedMimeType];
  if (!extension) return displayName;

  const currentExtension = getExtension(displayName);
  if (currentExtension === extension) return displayName;

  const baseName = displayName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\.+$/, "")
    .trim() || "attachment";
  return sanitizeFileName(`${baseName}.${extension}`);
};

export const renameAttachmentDisplayName = (attachment, nextName) => ({
  ...attachment,
  name: normalizeAttachmentDisplayName(nextName, attachment),
});

const getAttachmentFileId = (attachment = {}) => (
  attachment.fileId
  || attachment.libraryId
  || attachment.id
  || sanitizePathSegment(attachment.storagePath || attachment.downloadURL || attachment.name || generateId())
);

export const normalizeAttachmentLibrary = (files) => (
  Array.isArray(files)
    ? files
      .filter((file) => file && typeof file === "object")
      .map((file) => {
        const id = getAttachmentFileId(file);
        const storageMode = file.storageMode === "local" ? "local" : "cloud";
        const compression = normalizeAttachmentCompression(file.compression);
        const imagePreview = normalizeAttachmentImagePreview(file.imagePreview);

        return {
          id,
          fileId: id,
          name: normalizeAttachmentDisplayName(file.name || "attachment", file),
          mimeType: inferAttachmentMimeType(file.name, file.mimeType),
          size: Number(file.size) || 0,
          storageMode,
          storagePath: storageMode === "local" ? null : file.storagePath || null,
          downloadURL: storageMode === "local" ? null : file.downloadURL || file.url || null,
          cacheKey: getAttachmentCacheKey({ ...file, id }),
          cloudRevision: getAttachmentRevision(file),
          createdAt: Number(file.createdAt) || Date.now(),
          uploadedAt: Number(file.uploadedAt) || null,
          privacySanitized: file.privacySanitized === true,
          ...(compression ? { compression } : {}),
          ...(imagePreview ? { imagePreview } : {}),
        };
      })
      .filter((file) => file.id)
    : []
);

export const getAttachmentLibraryUsage = (files) => (
  normalizeAttachmentLibrary(files).reduce((total, file) => (
    file.storageMode === "local" ? total : total + (Number(file.size) || 0)
  ), 0)
);

export const upsertAttachmentLibraryFiles = (files, nextFiles) => {
  const byId = new Map(normalizeAttachmentLibrary(files).map((file) => [file.id, file]));

  normalizeAttachmentLibrary(nextFiles).forEach((file) => {
    byId.set(file.id, {
      ...(byId.get(file.id) || {}),
      ...file,
      updatedAt: Date.now(),
    });
  });

  return Array.from(byId.values()).sort((a, b) => (
    (Number(b.updatedAt || b.uploadedAt || b.createdAt) || 0)
    - (Number(a.updatedAt || a.uploadedAt || a.createdAt) || 0)
  ));
};

export const createAttachmentReference = (file) => {
  const normalizedFile = normalizeAttachmentLibrary([file])[0];
  const fileId = normalizedFile?.id || getAttachmentFileId(file);

  return {
    id: generateId(),
    fileId,
    attachedAt: Date.now(),
  };
};

const getAttachmentLibraryMap = (fileLibrary) => new Map(
  normalizeAttachmentLibrary(fileLibrary).map((file) => [file.id, file])
);

export const resolveAttachmentList = (attachments, fileLibrary = []) => {
  const fileById = getAttachmentLibraryMap(fileLibrary);

  return normalizeAttachmentDraftList(attachments)
    .map((attachment) => {
      const fileId = attachment.fileId || attachment.libraryId || null;
      const libraryFile = fileId ? fileById.get(fileId) : null;

      if (!libraryFile) {
        const [legacyAttachment] = normalizeAttachmentList([attachment]);
        return legacyAttachment || attachment;
      }

      return {
        ...libraryFile,
        ...attachment,
        id: attachment.id || `${fileId}-ref`,
        fileId,
        name: libraryFile.name,
        mimeType: libraryFile.mimeType,
        size: libraryFile.size,
        storageMode: libraryFile.storageMode,
        storagePath: libraryFile.storagePath,
        downloadURL: libraryFile.downloadURL,
        cacheKey: libraryFile.cacheKey,
        cloudRevision: libraryFile.cloudRevision,
        privacySanitized: libraryFile.privacySanitized,
        compression: libraryFile.compression,
        imagePreview: libraryFile.imagePreview,
      };
    })
    .filter(Boolean);
};

const getAttachmentContentDisposition = (name = "attachment") => {
  const fileName = sanitizeFileName(name || "attachment");
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export const isImageAttachment = (attachment) => (
  String(attachment?.mimeType || "").toLowerCase().startsWith("image/")
);

const getAttachmentMimeType = (attachment = {}) => (
  inferAttachmentMimeType(attachment.name, attachment.mimeType, "")
);

const isCompressibleImageAttachment = (attachment = {}) => {
  const mimeType = getAttachmentMimeType(attachment);
  if (NEVER_REENCODE_IMAGE_MIME_TYPES.has(mimeType)) return false;
  if (COMPRESSIBLE_IMAGE_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith("image/")) return true;

  const extension = getExtension(attachment.name);
  return ["bmp", "heic", "heif", "jpg", "jpeg", "png", "webp"].includes(extension);
};

const getShortPrivateToken = (value = "") => {
  const source = String(value || generateId());
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
};

const getPrivateImageAttachmentName = (attachment = {}, outputFormat = IMAGE_UPLOAD_OUTPUT_FORMATS[0]) => {
  const extension = outputFormat?.extension || "webp";
  return `photo-${getShortPrivateToken(attachment.id || attachment.name)}.${extension}`;
};

const getImageUploadQualitySteps = (outputFormat) => (
  Array.isArray(outputFormat?.qualitySteps) && outputFormat.qualitySteps.length
    ? outputFormat.qualitySteps
    : IMAGE_UPLOAD_JPEG_FALLBACK_QUALITY_STEPS
);

const isOversizedImageCompressionCandidate = (asset, source) => {
  const name = getAssetName(asset, source === "camera" ? "photo" : "attachment");
  const mimeType = inferAttachmentMimeType(name, asset?.mimeType || getAssetFile(asset)?.type, "");
  return isCompressibleImageAttachment({ name, mimeType });
};

const getScaledImageDimensions = (
  width,
  height,
  maxDimension = IMAGE_UPLOAD_COMPRESSION_MAX_DIMENSION
) => {
  const sourceWidth = Number(width) || 0;
  const sourceHeight = Number(height) || 0;
  const targetMaxDimension = Number(maxDimension) || IMAGE_UPLOAD_COMPRESSION_MAX_DIMENSION;
  const longestSide = Math.max(sourceWidth, sourceHeight);

  if (!sourceWidth || !sourceHeight || longestSide <= targetMaxDimension) {
    return { width: sourceWidth, height: sourceHeight, resized: false };
  }

  const scale = targetMaxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    resized: true,
  };
};

const getImageCompressionPlans = (width, height) => {
  const sourceWidth = Number(width) || 0;
  const sourceHeight = Number(height) || 0;
  const longestSide = Math.max(sourceWidth, sourceHeight);

  if (!sourceWidth || !sourceHeight || !longestSide) {
    return [{ width: sourceWidth, height: sourceHeight, resized: false }];
  }

  const firstMaxDimension = Math.min(longestSide, IMAGE_UPLOAD_COMPRESSION_MAX_DIMENSION);
  const dimensionSteps = [
    firstMaxDimension,
    ...IMAGE_UPLOAD_COMPRESSION_DIMENSION_STEPS.filter((dimension) => (
      dimension < firstMaxDimension
      && dimension >= 900
    )),
  ];
  const uniqueDimensionSteps = Array.from(new Set(dimensionSteps));

  return uniqueDimensionSteps.map((dimension) => (
    getScaledImageDimensions(sourceWidth, sourceHeight, dimension)
  ));
};

const shouldAttemptImageCompression = (attachment = {}) => {
  if (!isCompressibleImageAttachment(attachment)) return false;
  if (!attachment.localUri && !attachment.uri && !attachment.file) return false;
  return true;
};

const getImageCompressionTargetBytes = (attachment = {}) => {
  const originalSize = Number(attachment.size) || 0;

  if (!originalSize) return IMAGE_UPLOAD_COMPRESSION_TARGET_BYTES;
  if (originalSize > 12 * 1024 * 1024) return 1400 * 1024;
  if (originalSize > 5 * 1024 * 1024) return 1150 * 1024;
  if (originalSize > 2 * 1024 * 1024) return 900 * 1024;
  if (originalSize > 1024 * 1024) return 650 * 1024;
  return Math.max(260 * 1024, Math.round(originalSize * 0.68));
};

const shouldUseCompressedImage = (originalAttachment, compressedSize) => {
  const nextSize = Number(compressedSize) || 0;

  if (!nextSize) return false;
  return isCompressibleImageAttachment(originalAttachment) && nextSize <= MAX_ATTACHMENT_SIZE_BYTES;
};

const withImageCompressionMetadata = (attachment, {
  originalAttachment,
  outputFormat,
  quality,
  width,
  height,
  resized,
}) => {
  const imagePreview = normalizeAttachmentImagePreview(
    attachment.imagePreview || originalAttachment?.imagePreview
  );

  return {
    ...attachment,
    privacySanitized: true,
    ...(imagePreview ? { imagePreview } : {}),
    compression: {
      codec: outputFormat?.codec || "webp",
      compressedSize: Number(attachment.size) || 0,
      originalSize: Number(originalAttachment?.size) || null,
      originalMimeType: getAttachmentMimeType(originalAttachment) || null,
      metadataStripped: true,
      quality,
      width: Number(width) || null,
      height: Number(height) || null,
      resized: Boolean(resized),
    },
  };
};

const normalizeAttachmentCompression = (compression) => {
  if (!compression || typeof compression !== "object") return null;

  const compressedSize = Number(compression.compressedSize) || 0;
  if (!compressedSize) return null;

  return {
    codec: String(compression.codec || "jpeg"),
    compressedSize,
    originalSize: Number(compression.originalSize) || null,
    originalMimeType: typeof compression.originalMimeType === "string"
      ? compression.originalMimeType
      : null,
    metadataStripped: compression.metadataStripped !== false,
    quality: Number(compression.quality) || null,
    width: Number(compression.width) || null,
    height: Number(compression.height) || null,
    resized: Boolean(compression.resized),
  };
};

const normalizePreviewColors = (colors) => (
  Array.isArray(colors)
    ? colors
      .filter((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
      .slice(0, 4)
    : []
);

const normalizeAttachmentImagePreview = (preview) => {
  if (!preview || typeof preview !== "object") return null;

  const uri = typeof preview.uri === "string"
    && preview.uri.startsWith("data:image/")
    && preview.uri.length <= IMAGE_PREVIEW_MAX_DATA_URI_LENGTH
    ? preview.uri
    : "";
  const colors = normalizePreviewColors(preview.colors);

  if (!uri && colors.length < 2) return null;

  return {
    type: uri ? "lqip" : "gradient",
    ...(uri ? { uri } : {}),
    ...(colors.length >= 2 ? { colors } : {}),
    width: Number(preview.width) || null,
    height: Number(preview.height) || null,
  };
};

export const getAttachmentRevision = (attachment = {}) => (
  Number(
    attachment.cloudRevision
    || attachment.uploadedAt
    || attachment.updatedAt
    || attachment.createdAt
    || 0
  ) || 0
);

const getAttachmentCacheKey = (attachment = {}) => (
  attachment.cacheKey
  || (
    attachment.id
      ? `${sanitizePathSegment(attachment.id)}-${sanitizePathSegment(attachment.storagePath || attachment.name || "attachment").slice(0, 72)}`
      : sanitizePathSegment(attachment.storagePath || attachment.downloadURL || attachment.name)
  )
);

const canUseNativeAttachmentCache = () => Platform.OS !== "web" && !!ATTACHMENT_CACHE_DIR;

const canUseWebAttachmentCache = () => (
  Platform.OS === "web"
  && typeof indexedDB !== "undefined"
  && typeof Blob !== "undefined"
  && typeof URL !== "undefined"
  && typeof URL.createObjectURL === "function"
);

let webAttachmentCacheDbPromise = null;
const webAttachmentObjectUrls = new Map();

const openWebAttachmentCacheDb = () => {
  if (!canUseWebAttachmentCache()) return Promise.resolve(null);
  if (webAttachmentCacheDbPromise) return webAttachmentCacheDbPromise;

  webAttachmentCacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(WEB_ATTACHMENT_CACHE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WEB_ATTACHMENT_CACHE_STORE)) {
        db.createObjectStore(WEB_ATTACHMENT_CACHE_STORE, { keyPath: "cacheKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(request.error || makeAttachmentError("cache_unavailable"));
  }).catch((error) => {
    webAttachmentCacheDbPromise = null;
    throw error;
  });

  return webAttachmentCacheDbPromise;
};

const runWebAttachmentCacheTransaction = async (mode, handler) => {
  const db = await openWebAttachmentCacheDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WEB_ATTACHMENT_CACHE_STORE, mode);
    const store = transaction.objectStore(WEB_ATTACHMENT_CACHE_STORE);
    let result = null;

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    try {
      result = handler(store, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
};

const getWebAttachmentObjectUrlKey = (entry = {}) => (
  [
    entry.cacheKey || "",
    Number(entry.revision) || 0,
    Number(entry.size) || 0,
    Number(entry.cachedAt) || 0,
  ].join("|")
);

const revokeWebAttachmentObjectUrl = (objectUrl) => {
  if (!objectUrl || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(objectUrl);
  } catch (error) {}
};

const revokeWebAttachmentObjectUrlsForCacheKey = (cacheKey) => {
  if (!cacheKey) return;

  Array.from(webAttachmentObjectUrls.entries()).forEach(([objectUrlKey, objectUrl]) => {
    if (!objectUrlKey.startsWith(`${cacheKey}|`)) return;
    revokeWebAttachmentObjectUrl(objectUrl);
    webAttachmentObjectUrls.delete(objectUrlKey);
  });
};

const getWebAttachmentCachedObjectUrl = (entry) => {
  if (
    !entry?.blob
    || typeof URL === "undefined"
    || typeof URL.createObjectURL !== "function"
  ) {
    return "";
  }

  const objectUrlKey = getWebAttachmentObjectUrlKey(entry);
  const cachedObjectUrl = webAttachmentObjectUrls.get(objectUrlKey);
  if (cachedObjectUrl) return cachedObjectUrl;

  const objectUrl = URL.createObjectURL(entry.blob);
  webAttachmentObjectUrls.set(objectUrlKey, objectUrl);
  return objectUrl;
};

const getWebAttachmentCacheRecord = async (attachment) => {
  if (!canUseWebAttachmentCache()) return null;
  const cacheKey = typeof attachment === "string" ? attachment : getAttachmentCacheKey(attachment);
  if (!cacheKey) return null;

  return runWebAttachmentCacheTransaction("readonly", (store, resolve, reject) => {
    const request = store.get(cacheKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    return null;
  });
};

const writeWebAttachmentCacheRecord = async (attachment, blob) => {
  if (!canUseWebAttachmentCache() || !blob?.size) return null;

  const cacheKey = getAttachmentCacheKey(attachment);
  const entry = {
    cacheKey,
    blob,
    storagePath: attachment.storagePath || null,
    downloadURL: attachment.downloadURL || attachment.url || null,
    revision: getAttachmentRevision(attachment),
    size: Number(attachment.size) || Number(blob.size) || 0,
    name: attachment.name || "attachment",
    mimeType: inferAttachmentMimeType(attachment.name, attachment.mimeType),
    cachedAt: Date.now(),
  };

  await runWebAttachmentCacheTransaction("readwrite", (store, resolve, reject) => {
    const request = store.put(entry);
    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(request.error);
    return null;
  });

  return entry;
};

const deleteWebAttachmentCacheRecord = async (attachment) => {
  if (!canUseWebAttachmentCache()) return;
  const cacheKey = typeof attachment === "string" ? attachment : getAttachmentCacheKey(attachment);
  if (!cacheKey) return;

  try {
    await runWebAttachmentCacheTransaction("readwrite", (store, resolve, reject) => {
      const request = store.delete(cacheKey);
      request.onsuccess = () => resolve(null);
      request.onerror = () => reject(request.error);
      return null;
    });
    revokeWebAttachmentObjectUrlsForCacheKey(cacheKey);
  } catch (error) {}
};

const getWebAttachmentSourceBlob = async (attachment, sourceUri) => {
  if (typeof Blob !== "undefined" && attachment?.file instanceof Blob) {
    return attachment.file;
  }

  const uri = sourceUri || attachment?.localUri || attachment?.uri;
  if (!uri || typeof fetch !== "function") return null;

  const response = await fetch(uri);
  return response.blob();
};

const getAttachmentCacheDirectory = (attachment) => {
  if (!canUseNativeAttachmentCache()) return null;
  return `${ATTACHMENT_CACHE_DIR}${sanitizePathSegment(getAttachmentCacheKey(attachment))}/`;
};

const getAttachmentCacheFileUri = (attachment) => {
  const directory = getAttachmentCacheDirectory(attachment);
  if (!directory) return null;

  const revision = getAttachmentRevision(attachment) || "local";
  const fileName = sanitizeFileName(attachment?.name || "attachment");
  return `${directory}${sanitizePathSegment(revision)}-${fileName}`;
};

const ensureDirectory = async (directory) => {
  if (!directory) return;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
};

const readAttachmentCacheManifest = async () => {
  if (!canUseNativeAttachmentCache()) return {};

  try {
    const raw = await AsyncStorage.getItem(ATTACHMENT_CACHE_MANIFEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

const saveAttachmentCacheManifest = async (manifest) => {
  if (!canUseNativeAttachmentCache()) return;
  try {
    await AsyncStorage.setItem(ATTACHMENT_CACHE_MANIFEST_KEY, JSON.stringify(manifest || {}));
  } catch (error) {}
};

const writeAttachmentCacheEntry = async (attachment, localUri) => {
  if (!canUseNativeAttachmentCache() || !localUri) return null;

  const cacheKey = getAttachmentCacheKey(attachment);
  const manifest = await readAttachmentCacheManifest();
  const entry = {
    cacheKey,
    uri: localUri,
    storagePath: attachment.storagePath || null,
    downloadURL: attachment.downloadURL || attachment.url || null,
    revision: getAttachmentRevision(attachment),
    size: Number(attachment.size) || 0,
    name: attachment.name || "attachment",
    mimeType: inferAttachmentMimeType(attachment.name, attachment.mimeType),
    cachedAt: Date.now(),
  };

  manifest[cacheKey] = entry;
  await saveAttachmentCacheManifest(manifest);
  return entry;
};

const getFreshAttachmentDownloadURL = async (attachment) => {
  if (!attachment?.storagePath) return attachment?.downloadURL || attachment?.url || "";
  try {
    return await getDownloadURL(ref(storage, attachment.storagePath));
  } catch (error) {
    return attachment?.downloadURL || attachment?.url || "";
  }
};

const getManifestCacheEntry = async (attachment) => {
  const cacheKey = getAttachmentCacheKey(attachment);
  const manifest = await readAttachmentCacheManifest();
  return manifest[cacheKey] || null;
};

const isCacheEntryFresh = (attachment, entry) => {
  if (!entry?.uri && !entry?.blob) return false;
  if (entry.storagePath && attachment?.storagePath && entry.storagePath !== attachment.storagePath) return false;
  const attachmentRevision = getAttachmentRevision(attachment);
  const entryRevision = Number(entry.revision) || 0;
  if (attachmentRevision && entryRevision && entryRevision < attachmentRevision) return false;
  const attachmentSize = Number(attachment?.size) || 0;
  const entrySize = Number(entry.size) || 0;
  if (attachmentSize && entrySize && attachmentSize !== entrySize) return false;
  return true;
};

const canUseCachedAttachment = (attachment, cacheState) => (
  CACHE_FRESH_STATUSES.has(cacheState?.status)
  || (!attachment?.storagePath && cacheState?.status === "stale")
);

export const getAttachmentCacheState = async (attachment) => {
  const localSourceUri = attachment?.localUri || attachment?.uri || null;
  if (localSourceUri && !attachment?.storagePath) {
    return { status: "source", uri: localSourceUri, stale: false };
  }

  if (canUseWebAttachmentCache()) {
    try {
      const webEntry = await getWebAttachmentCacheRecord(attachment);
      if (webEntry?.blob) {
        const fresh = isCacheEntryFresh(attachment, webEntry);
        return {
          status: fresh ? "local" : "stale",
          uri: getWebAttachmentCachedObjectUrl(webEntry),
          stale: !fresh,
          cachedAt: webEntry.cachedAt || null,
        };
      }
    } catch (error) {}
  }

  if (!canUseNativeAttachmentCache()) {
    return {
      status: attachment?.downloadURL || attachment?.url || localSourceUri ? "remote" : "missing",
      uri: attachment?.downloadURL || attachment?.url || localSourceUri || null,
      stale: false,
    };
  }

  const candidates = [];
  const manifestEntry = await getManifestCacheEntry(attachment);
  if (manifestEntry?.uri) candidates.push(manifestEntry);

  const deterministicUri = getAttachmentCacheFileUri(attachment);
  if (deterministicUri) {
    candidates.push({
      ...manifestEntry,
      uri: deterministicUri,
      revision: getAttachmentRevision(attachment),
      storagePath: attachment?.storagePath || null,
      size: Number(attachment?.size) || 0,
    });
  }

  for (const entry of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(entry.uri);
      if (info.exists) {
        const fresh = isCacheEntryFresh(attachment, entry);
        return {
          status: fresh ? "local" : "stale",
          uri: entry.uri,
          stale: !fresh,
          cachedAt: entry.cachedAt || null,
        };
      }
    } catch (error) {}
  }

  return {
    status: attachment?.downloadURL || attachment?.url ? "remote" : "missing",
    uri: attachment?.downloadURL || attachment?.url || localSourceUri || null,
    stale: false,
  };
};

export const cacheAttachmentFromLocalUri = async (attachment, sourceUri) => {
  if (canUseWebAttachmentCache()) {
    try {
      const blob = await getWebAttachmentSourceBlob(attachment, sourceUri);
      if (!blob?.size) return attachment;

      const webEntry = await writeWebAttachmentCacheRecord(attachment, blob);
      return {
        ...attachment,
        localUri: getWebAttachmentCachedObjectUrl(webEntry) || sourceUri || attachment?.localUri || attachment?.uri || null,
        cacheState: "local",
        cacheRevision: getAttachmentRevision(attachment),
      };
    } catch (error) {
      return attachment;
    }
  }

  if (!canUseNativeAttachmentCache() || !sourceUri) return attachment;

  const cacheUri = getAttachmentCacheFileUri(attachment);
  const cacheDirectory = getAttachmentCacheDirectory(attachment);
  if (!cacheUri || !cacheDirectory) return attachment;

  try {
    await ensureDirectory(ATTACHMENT_CACHE_DIR);
    await ensureDirectory(cacheDirectory);

    if (sourceUri !== cacheUri) {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
      await FileSystem.copyAsync({ from: sourceUri, to: cacheUri });
    }

    await writeAttachmentCacheEntry(attachment, cacheUri);
    return {
      ...attachment,
      localUri: cacheUri,
      cacheState: "local",
      cacheRevision: getAttachmentRevision(attachment),
    };
  } catch (error) {
    return attachment;
  }
};

export const ensureLocalAttachment = async (attachment, { forceDownload = false } = {}) => {
  const localSourceUri = attachment?.localUri || attachment?.uri || null;
  if (localSourceUri && !attachment?.storagePath && !forceDownload) {
    return {
      ...attachment,
      localUri: localSourceUri,
      openUri: localSourceUri,
      cacheState: "source",
    };
  }

  const cacheState = await getAttachmentCacheState(attachment);
  if ((!forceDownload || !attachment?.storagePath) && canUseCachedAttachment(attachment, cacheState) && cacheState.uri) {
    return {
      ...attachment,
      localUri: cacheState.uri,
      openUri: cacheState.uri,
      cacheState: cacheState.status,
    };
  }

  if (canUseWebAttachmentCache()) {
    const remoteUri = await getFreshAttachmentDownloadURL(attachment)
      || attachment?.downloadURL
      || attachment?.url
      || localSourceUri;
    if (!remoteUri) throw makeAttachmentError("open_failed", { name: attachment?.name });

    try {
      const blob = await getWebAttachmentSourceBlob(attachment, remoteUri);
      if (blob?.size) {
        const cacheReadyAttachment = {
          ...attachment,
          downloadURL: attachment?.downloadURL || attachment?.url || remoteUri,
        };
        const webEntry = await writeWebAttachmentCacheRecord(cacheReadyAttachment, blob);
        const objectUrl = getWebAttachmentCachedObjectUrl(webEntry) || remoteUri;
        return {
          ...cacheReadyAttachment,
          localUri: objectUrl,
          openUri: objectUrl,
          cacheState: "local",
          cacheRevision: getAttachmentRevision(attachment),
        };
      }
    } catch (error) {
      if (forceDownload) {
        throw makeAttachmentError("download_failed", {
          name: attachment?.name,
          originalError: error,
        });
      }
    }

    return {
      ...attachment,
      openUri: remoteUri,
      cacheState: "remote",
    };
  }

  if (!canUseNativeAttachmentCache()) {
    const remoteUri = attachment?.downloadURL || attachment?.url || localSourceUri;
    if (!remoteUri) throw makeAttachmentError("open_failed", { name: attachment?.name });
    return {
      ...attachment,
      openUri: remoteUri,
      cacheState: "remote",
    };
  }

  const downloadURL = await getFreshAttachmentDownloadURL(attachment);
  if (!downloadURL) {
    if (localSourceUri) {
      return cacheAttachmentFromLocalUri(attachment, localSourceUri);
    }
    throw makeAttachmentError("open_failed", { name: attachment?.name });
  }

  const cacheUri = getAttachmentCacheFileUri(attachment);
  const cacheDirectory = getAttachmentCacheDirectory(attachment);
  if (!cacheUri || !cacheDirectory) {
    throw makeAttachmentError("cache_unavailable", { name: attachment?.name });
  }

  try {
    await ensureDirectory(ATTACHMENT_CACHE_DIR);
    await ensureDirectory(cacheDirectory);
    const result = await FileSystem.downloadAsync(downloadURL, cacheUri);
    const cachedAttachment = {
      ...attachment,
      downloadURL,
      localUri: result.uri || cacheUri,
      openUri: result.uri || cacheUri,
      cacheState: "local",
      cacheRevision: getAttachmentRevision(attachment),
    };
    await writeAttachmentCacheEntry(cachedAttachment, cachedAttachment.localUri);
    return cachedAttachment;
  } catch (error) {
    if (cacheState.uri && (cacheState.status === "local" || cacheState.status === "stale")) {
      return {
        ...attachment,
        localUri: cacheState.uri,
        openUri: cacheState.uri,
        cacheState: cacheState.status,
      };
    }
    throw makeAttachmentError("download_failed", {
      name: attachment?.name,
      originalError: error,
    });
  }
};

export const deleteLocalAttachmentCache = async (attachment) => {
  if (canUseWebAttachmentCache()) {
    await deleteWebAttachmentCacheRecord(attachment);
  }

  if (!canUseNativeAttachmentCache()) return;

  const cacheKey = getAttachmentCacheKey(attachment);
  const cacheDirectory = getAttachmentCacheDirectory(attachment);

  try {
    const manifest = await readAttachmentCacheManifest();
    delete manifest[cacheKey];
    await saveAttachmentCacheManifest(manifest);
  } catch (error) {}

  if (!cacheDirectory) return;
  try {
    await FileSystem.deleteAsync(cacheDirectory, { idempotent: true });
  } catch (error) {}
};

export const clearAllLocalAttachmentCaches = async () => {
  const failures = [];

  if (canUseWebAttachmentCache()) {
    try {
      await runWebAttachmentCacheTransaction("readwrite", (store, resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(null);
        request.onerror = () => reject(request.error);
        return null;
      });
      webAttachmentObjectUrls.forEach((objectUrl) => {
        revokeWebAttachmentObjectUrl(objectUrl);
      });
      webAttachmentObjectUrls.clear();
    } catch (error) {
      failures.push(error);
    }
  }

  if (canUseNativeAttachmentCache()) {
    try {
      await AsyncStorage.removeItem(ATTACHMENT_CACHE_MANIFEST_KEY);
    } catch (error) {
      failures.push(error);
    }

    try {
      await FileSystem.deleteAsync(ATTACHMENT_CACHE_DIR, { idempotent: true });
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    const error = makeAttachmentError("cache_clear_failed");
    error.cause = failures[0];
    throw error;
  }
};

const createDraftAttachment = (asset, source) => {
  const name = sanitizeFileName(getAssetName(asset, source === "camera" ? "photo" : "attachment"));
  const mimeType = inferAttachmentMimeType(name, asset?.mimeType || getAssetFile(asset)?.type);
  const size = getAssetSize(asset);

  return {
    id: generateId(),
    name,
    mimeType,
    size,
    source,
    status: "pending",
    localUri: asset?.uri || null,
    file: Platform.OS === "web" ? getAssetFile(asset) : null,
    createdAt: Date.now(),
  };
};

const validateAsset = (asset, source, { allowCompressionCandidate = true } = {}) => {
  const name = getAssetName(asset, source === "camera" ? "photo" : "attachment");
  const size = getAssetSize(asset);
  const mimeType = inferAttachmentMimeType(name, asset?.mimeType || getAssetFile(asset)?.type, "");

  if (
    size > MAX_ATTACHMENT_SIZE_BYTES
    && (!allowCompressionCandidate || !isOversizedImageCompressionCandidate(asset, source))
  ) {
    return makeAttachmentError("file_too_large", { name, size });
  }

  if (!isAttachmentMimeTypeAllowed(name, mimeType)) {
    return makeAttachmentError("file_type_unsupported", { name });
  }

  return null;
};

const buildPickResult = (assets, source, currentCount = 0) => {
  const attachments = [];
  const errors = [];

  (Array.isArray(assets) ? assets : []).forEach((asset) => {
    if (currentCount + attachments.length >= MAX_ATTACHMENTS_PER_ENTITY) {
      errors.push(makeAttachmentError("too_many", {
        max: MAX_ATTACHMENTS_PER_ENTITY,
        name: getAssetName(asset),
      }));
      return;
    }

    const validationError = validateAsset(asset, source);
    if (validationError) {
      errors.push(validationError);
      return;
    }

    attachments.push(createDraftAttachment(asset, source));
  });

  return { attachments, errors };
};

export const buildAttachmentPickResultFromWebFiles = (files, currentCount = 0) => {
  if (Platform.OS !== "web") return { attachments: [], errors: [] };

  const assets = Array.from(files || [])
    .filter((file) => file && typeof file === "object")
    .map((file) => ({
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
    }));

  return buildPickResult(assets, "file", currentCount);
};

export const pickAttachmentFiles = async ({ currentCount = 0 } = {}) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: PICKER_MIME_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
      base64: false,
    });

    if (result?.canceled) return { attachments: [], errors: [] };
    return buildPickResult(result?.assets, "file", currentCount);
  } catch (error) {
    throw makeAttachmentError("picker_failed", { originalError: error });
  }
};

export const pickAttachmentPhotos = async ({ currentCount = 0 } = {}) => {
  try {
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted && permission?.accessPrivileges !== "limited") {
        throw makeAttachmentError("media_permission_denied");
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_ATTACHMENTS_PER_ENTITY - currentCount),
      exif: false,
      quality: 0.9,
    });

    if (result?.canceled) return { attachments: [], errors: [] };
    return buildPickResult(result?.assets, "photo", currentCount);
  } catch (error) {
    if (error?.attachmentCode) throw error;
    throw makeAttachmentError("picker_failed", { originalError: error });
  }
};

export const captureAttachmentPhoto = async ({ currentCount = 0 } = {}) => {
  try {
    if (currentCount >= MAX_ATTACHMENTS_PER_ENTITY) {
      return {
        attachments: [],
        errors: [makeAttachmentError("too_many", { max: MAX_ATTACHMENTS_PER_ENTITY })],
      };
    }

    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission?.granted) {
        throw makeAttachmentError("camera_permission_denied");
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      cameraType: ImagePicker.CameraType?.back,
      exif: false,
      quality: 0.9,
    });

    if (result?.canceled) return { attachments: [], errors: [] };
    return buildPickResult(result?.assets, "camera", currentCount);
  } catch (error) {
    if (error?.attachmentCode) throw error;
    throw makeAttachmentError("camera_unavailable", { originalError: error });
  }
};

export const formatFileSize = (size) => {
  const bytes = Number(size) || 0;
  if (bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

export const formatAttachmentError = (error, lang) => {
  const code = getAttachmentErrorCode(error);
  const params = error?.params || {};
  const fallback = t("attachments.upload_failed", lang);
  const template = t(`attachments.errors.${code}`, lang);
  const resolvedTemplate = template === `attachments.errors.${code}` ? fallback : template;

  return interpolate(resolvedTemplate, {
    name: params.name || t("attachments.file", lang),
    max: params.max || "",
    limit: formatFileSize(MAX_ATTACHMENT_SIZE_BYTES),
  });
};

export const normalizeAttachmentList = (attachments) => (
  Array.isArray(attachments)
    ? attachments
      .filter((attachment) => attachment && typeof attachment === "object")
      .map((attachment) => {
          const compression = normalizeAttachmentCompression(attachment.compression);
          const imagePreview = normalizeAttachmentImagePreview(attachment.imagePreview);
          return {
            id: attachment.id || generateId(),
          fileId: attachment.fileId || attachment.libraryId || null,
            name: sanitizeFileName(attachment.name || "attachment"),
          mimeType: inferAttachmentMimeType(attachment.name, attachment.mimeType),
          size: Number(attachment.size) || 0,
          storageMode: attachment.storageMode === "local" ? "local" : "cloud",
          storagePath: attachment.storagePath || null,
          downloadURL: attachment.downloadURL || attachment.url || null,
          cacheKey: getAttachmentCacheKey(attachment),
          cloudRevision: getAttachmentRevision(attachment),
          createdAt: Number(attachment.createdAt) || Date.now(),
          uploadedAt: Number(attachment.uploadedAt) || null,
          privacySanitized: attachment.privacySanitized === true,
          ...(compression ? { compression } : {}),
          ...(imagePreview ? { imagePreview } : {}),
        };
      })
      .filter((attachment) => (
        attachment.storageMode === "local"
        || (attachment.storagePath && attachment.downloadURL)
      ))
    : []
);

export const normalizeAttachmentDraftList = (attachments) => (
  Array.isArray(attachments)
    ? attachments.filter((attachment) => attachment && typeof attachment === "object")
    : []
);

const getStoragePath = (userId, attachment) => (
  `users/${userId}/attachments/${attachment.id}/${sanitizeFileName(attachment.name)}`
);

const getAttachmentUploadUserId = async (requestedUserId) => {
  const currentUser = auth?.currentUser;
  if (!currentUser?.uid) throw makeAttachmentError("auth_required");
  if (requestedUserId && currentUser.uid !== requestedUserId) {
    throw makeAttachmentError("auth_required");
  }

  try {
    await currentUser.reload();
    const tokenResult = await currentUser.getIdTokenResult(true);
    const tokenEmailVerified = tokenResult?.claims?.email_verified === true;

    if (currentUser.emailVerified !== true && !tokenEmailVerified) {
      throw makeAttachmentError("email_unverified");
    }

    return currentUser.uid;
  } catch (error) {
    if (error?.attachmentCode) throw error;
    if (error?.code === "auth/network-request-failed") {
      throw makeAttachmentError("network_failed", { originalError: error });
    }
    throw makeAttachmentError("auth_refresh_failed", { originalError: error });
  }
};

const logAttachmentUploadError = (error) => {
  if (typeof console === "undefined" || typeof console.warn !== "function") return;

  console.warn("Attachment upload failed", {
    attachmentCode: getAttachmentErrorCode(error),
    firebaseCode: error?.code,
    message: error?.message,
    originalCode: error?.params?.originalError?.code,
    originalMessage: error?.params?.originalError?.message,
  });
};

const getNativeImageSize = (uri) => new Promise((resolve) => {
  if (!uri || typeof NativeImage?.getSize !== "function") {
    resolve(null);
    return;
  }

  NativeImage.getSize(
    uri,
    (width, height) => resolve({ width, height }),
    () => resolve(null)
  );
});

const deleteNativeCompressionCandidate = async (candidate) => {
  if (Platform.OS === "web" || !candidate?.uri) return;
  try {
    await FileSystem.deleteAsync(candidate.uri, { idempotent: true });
  } catch (error) {}
};

const getPreviewResizeDimensions = (width, height) => {
  const sourceWidth = Number(width) || 0;
  const sourceHeight = Number(height) || 0;

  if (!sourceWidth || !sourceHeight) {
    return { width: IMAGE_PREVIEW_MAX_DIMENSION };
  }

  const longestSide = Math.max(sourceWidth, sourceHeight);
  if (longestSide <= IMAGE_PREVIEW_MAX_DIMENSION) {
    return { width: sourceWidth, height: sourceHeight };
  }

  const scale = IMAGE_PREVIEW_MAX_DIMENSION / longestSide;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
};

const createNativeAttachmentImagePreview = async (sourceUri, sourceDimensions) => {
  if (!sourceUri) return null;

  let result = null;
  try {
    const previewDimensions = getPreviewResizeDimensions(
      sourceDimensions?.width,
      sourceDimensions?.height
    );
    result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: previewDimensions }],
      {
        compress: IMAGE_PREVIEW_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    const uri = result?.base64 ? `data:image/jpeg;base64,${result.base64}` : "";
    return normalizeAttachmentImagePreview({
      uri,
      width: result?.width || previewDimensions.width,
      height: result?.height || previewDimensions.height,
    });
  } catch (error) {
    return null;
  } finally {
    if (result?.uri && result.uri !== sourceUri) {
      await deleteNativeCompressionCandidate({ uri: result.uri });
    }
  }
};

const componentToHex = (value) => (
  Math.max(0, Math.min(255, Math.round(value) || 0)).toString(16).padStart(2, "0")
);

const rgbToHex = (red, green, blue) => (
  `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`
);

const getAverageColorFromImageData = (data, width, height, startX, endX) => {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  const sampleStep = Math.max(1, Math.round(Math.max(width, height) / 16));

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = startX; x < endX; x += sampleStep) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 24) continue;

      red += data[offset];
      green += data[offset + 1];
      blue += data[offset + 2];
      count += 1;
    }
  }

  if (!count) return null;
  return rgbToHex(red / count, green / count, blue / count);
};

const getCanvasPreviewColors = (context, width, height) => {
  try {
    const imageData = context.getImageData(0, 0, width, height).data;
    const stops = [0, 1, 2].map((index) => {
      const startX = Math.floor((width * index) / 3);
      const endX = Math.max(startX + 1, Math.floor((width * (index + 1)) / 3));
      return getAverageColorFromImageData(imageData, width, height, startX, endX);
    }).filter(Boolean);

    return Array.from(new Set(stops));
  } catch (error) {
    return [];
  }
};

const createWebAttachmentImagePreview = (image) => {
  if (typeof document === "undefined" || !image) return null;

  try {
    const sourceWidth = image.naturalWidth || image.width || 0;
    const sourceHeight = image.naturalHeight || image.height || 0;
    const dimensions = getPreviewResizeDimensions(sourceWidth, sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width || IMAGE_PREVIEW_MAX_DIMENSION;
    canvas.height = dimensions.height || IMAGE_PREVIEW_MAX_DIMENSION;

    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return null;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const colors = getCanvasPreviewColors(context, canvas.width, canvas.height);
    let uri = "";
    try {
      uri = canvas.toDataURL("image/jpeg", IMAGE_PREVIEW_JPEG_QUALITY);
    } catch (error) {}

    return normalizeAttachmentImagePreview({
      uri,
      colors,
      width: canvas.width,
      height: canvas.height,
    });
  } catch (error) {
    return null;
  }
};

const logAttachmentCompressionResult = (attachment, result) => {
  const isDevelopment = typeof __DEV__ !== "undefined"
    ? __DEV__
    : typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  if (!isDevelopment || typeof console === "undefined" || typeof console.info !== "function") return;

  const originalSize = Number(attachment?.size) || 0;
  const compressedSize = Number(result?.size) || 0;
  const savedBytes = Math.max(0, originalSize - compressedSize);

  console.info("[PlanIt attachments] optimized image before cloud upload", {
    name: attachment?.name,
    originalSize,
    compressedSize,
    savedBytes,
    codec: result?.outputFormat?.codec,
    mimeType: result?.outputFormat?.mimeType,
    quality: result?.quality,
    width: result?.width,
    height: result?.height,
    targetBytes: getImageCompressionTargetBytes(attachment),
  });
};

const isBetterImageUploadCandidate = (candidate, currentCandidate) => {
  if (!candidate?.size) return false;
  if (!currentCandidate?.size) return true;
  if (candidate.size !== currentCandidate.size) return candidate.size < currentCandidate.size;
  return (Number(candidate.quality) || 0) > (Number(currentCandidate.quality) || 0);
};

const createNativeCompressedImageCandidate = async (
  sourceUri,
  actions,
  dimensions,
  outputFormat,
  quality,
  sourceDimensions
) => {
  try {
    const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
      compress: quality,
      format: outputFormat.nativeFormat,
    });
    const info = await FileSystem.getInfoAsync(result.uri);
    const candidate = {
      uri: result.uri,
      size: Number(info?.size) || 0,
      outputFormat,
      quality,
      width: Number(result.width || dimensions?.width || sourceDimensions?.width) || null,
      height: Number(result.height || dimensions?.height || sourceDimensions?.height) || null,
      resized: Boolean(dimensions?.resized),
    };

    if (!candidate.size) {
      await deleteNativeCompressionCandidate(candidate);
      return null;
    }

    return candidate;
  } catch (error) {
    return null;
  }
};

const compressNativeImageAttachment = async (attachment) => {
  const sourceUri = attachment.localUri || attachment.uri;
  if (!sourceUri) return attachment;

  const sourceDimensions = await getNativeImageSize(sourceUri);
  const imagePreview = await createNativeAttachmentImagePreview(sourceUri, sourceDimensions);
  const compressionPlans = sourceDimensions
    ? getImageCompressionPlans(sourceDimensions.width, sourceDimensions.height)
    : [{ width: null, height: null, resized: false }];
  let uploadCandidate = null;

  for (const outputFormat of IMAGE_UPLOAD_OUTPUT_FORMATS) {
    let formatBestCandidate = null;

    for (const dimensions of compressionPlans) {
      const actions = dimensions?.resized
        ? [{ resize: { width: dimensions.width, height: dimensions.height } }]
        : [];

      for (const quality of getImageUploadQualitySteps(outputFormat)) {
        const candidate = await createNativeCompressedImageCandidate(
          sourceUri,
          actions,
          dimensions,
          outputFormat,
          quality,
          sourceDimensions
        );
        if (!candidate) continue;

        if (isBetterImageUploadCandidate(candidate, formatBestCandidate)) {
          await deleteNativeCompressionCandidate(formatBestCandidate);
          formatBestCandidate = candidate;
        } else {
          await deleteNativeCompressionCandidate(candidate);
        }
      }
    }

    if (formatBestCandidate && shouldUseCompressedImage(attachment, formatBestCandidate.size)) {
      uploadCandidate = formatBestCandidate;
      break;
    }

    await deleteNativeCompressionCandidate(formatBestCandidate);
  }

  if (!uploadCandidate) {
    return attachment;
  }

  const compressedAttachment = {
    ...attachment,
    name: getPrivateImageAttachmentName(attachment, uploadCandidate.outputFormat),
    mimeType: uploadCandidate.outputFormat.mimeType,
    size: uploadCandidate.size,
    localUri: uploadCandidate.uri,
    uri: uploadCandidate.uri,
    file: null,
    ...(imagePreview ? { imagePreview } : {}),
  };

  logAttachmentCompressionResult(attachment, uploadCandidate);

  return withImageCompressionMetadata(compressedAttachment, {
    originalAttachment: attachment,
    outputFormat: uploadCandidate.outputFormat,
    quality: uploadCandidate.quality,
    width: uploadCandidate.width,
    height: uploadCandidate.height,
    resized: Boolean(uploadCandidate.resized),
  });
};

const getWebObjectUrl = (blob) => {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return "";
  return URL.createObjectURL(blob);
};

const revokeWebObjectUrl = (uri) => {
  if (!uri || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(uri);
  } catch (error) {}
};

const loadWebImageElement = (uri) => new Promise((resolve, reject) => {
  if (typeof window === "undefined" || typeof window.Image !== "function") {
    reject(makeAttachmentError("file_read_failed"));
    return;
  }

  const image = new window.Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.decoding = "async";
  image.src = uri;
});

const getCanvasBlob = (canvas, mimeType, quality) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), mimeType, quality);
});

const paintImageForOutputFormat = (context, image, width, height, outputFormat) => {
  if (outputFormat?.mimeType === "image/jpeg") {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
};

const createWebCompressedImageCandidate = async (image, dimensions, outputFormat, quality) => {
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width || image.naturalWidth || image.width;
  canvas.height = dimensions.height || image.naturalHeight || image.height;

  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) return null;

  paintImageForOutputFormat(context, image, canvas.width, canvas.height, outputFormat);

  const blob = await getCanvasBlob(canvas, outputFormat.mimeType, quality);
  if (!blob?.size) return null;
  const blobMimeType = String(blob.type || outputFormat.mimeType || "").toLowerCase();
  if (blob.type && blobMimeType !== outputFormat.mimeType) return null;

  return {
    blob,
    size: Number(blob.size) || 0,
    outputFormat,
    quality,
    width: canvas.width,
    height: canvas.height,
    resized: Boolean(dimensions.resized),
  };
};

const compressWebImageAttachment = async (attachment) => {
  if (typeof document === "undefined") return attachment;

  const sourceBlob = attachment.file || null;
  const temporarySourceUrl = sourceBlob ? getWebObjectUrl(sourceBlob) : "";
  const sourceUri = temporarySourceUrl || attachment.localUri || attachment.uri;
  if (!sourceUri) return attachment;

  try {
    const image = await loadWebImageElement(sourceUri);
    const imagePreview = createWebAttachmentImagePreview(image);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const compressionPlans = getImageCompressionPlans(sourceWidth, sourceHeight);
    let uploadCandidate = null;

    for (const outputFormat of IMAGE_UPLOAD_OUTPUT_FORMATS) {
      let formatBestCandidate = null;

      for (const dimensions of compressionPlans) {
        for (const quality of getImageUploadQualitySteps(outputFormat)) {
          const candidate = await createWebCompressedImageCandidate(image, dimensions, outputFormat, quality);
          if (!candidate) continue;

          if (isBetterImageUploadCandidate(candidate, formatBestCandidate)) {
            formatBestCandidate = candidate;
          }
        }
      }

      if (formatBestCandidate && shouldUseCompressedImage(attachment, formatBestCandidate.size)) {
        uploadCandidate = formatBestCandidate;
        break;
      }
    }

    if (!uploadCandidate) {
      return attachment;
    }

    const privateName = getPrivateImageAttachmentName(attachment, uploadCandidate.outputFormat);
    const file = typeof File === "function"
      ? new File([uploadCandidate.blob], privateName, {
        type: uploadCandidate.outputFormat.mimeType,
        lastModified: Date.now(),
      })
      : uploadCandidate.blob;
    const objectUrl = getWebObjectUrl(uploadCandidate.blob);
    const compressedAttachment = {
      ...attachment,
      name: privateName,
      mimeType: uploadCandidate.outputFormat.mimeType,
      size: uploadCandidate.size,
      file,
      localUri: objectUrl || attachment.localUri || attachment.uri || null,
      uri: objectUrl || attachment.uri || attachment.localUri || null,
      ...(imagePreview ? { imagePreview } : {}),
    };

    logAttachmentCompressionResult(attachment, uploadCandidate);

    return withImageCompressionMetadata(compressedAttachment, {
      originalAttachment: attachment,
      outputFormat: uploadCandidate.outputFormat,
      quality: uploadCandidate.quality,
      width: uploadCandidate.width,
      height: uploadCandidate.height,
      resized: Boolean(uploadCandidate.resized),
    });
  } finally {
    revokeWebObjectUrl(temporarySourceUrl);
  }
};

const prepareAttachmentForUpload = async (attachment) => {
  if (!shouldAttemptImageCompression(attachment)) return attachment;

  try {
    const preparedAttachment = Platform.OS === "web"
      ? await compressWebImageAttachment(attachment)
      : await compressNativeImageAttachment(attachment);
    if (!preparedAttachment?.privacySanitized) {
      throw makeAttachmentError("image_privacy_cleanup_failed", { name: attachment?.name });
    }
    return preparedAttachment;
  } catch (error) {
    if (error?.attachmentCode) throw error;
    throw makeAttachmentError("image_privacy_cleanup_failed", {
      name: attachment?.name,
      originalError: error,
    });
  }
};

const uploadBodyWithProgress = (storageRef, uploadBody, attachment, metadata, onProgress) => new Promise((resolve, reject) => {
  const task = uploadBytesResumable(storageRef, uploadBody, metadata);
  task.on(
    "state_changed",
    (snapshot) => {
      const total = snapshot.totalBytes || attachment.size || 1;
      onProgress?.(Math.min(1, snapshot.bytesTransferred / total));
    },
    reject,
    resolve
  );
});

const getBlobFromUri = (uri, attachment) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.onload = () => resolve(xhr.response);
  xhr.onerror = () => reject(makeAttachmentError("file_read_failed", { name: attachment.name }));
  xhr.responseType = "blob";
  xhr.open("GET", uri, true);
  xhr.send(null);
});

const uploadWebAttachment = async (storageRef, attachment, metadata, onProgress) => {
  let uploadBody = attachment.file;
  if (!uploadBody && attachment.localUri) {
    const response = await fetch(attachment.localUri);
    uploadBody = await response.blob();
  }

  if (!uploadBody) throw makeAttachmentError("file_read_failed", { name: attachment.name });
  await uploadBodyWithProgress(storageRef, uploadBody, attachment, metadata, onProgress);
};

const uploadNativeAttachment = async (storageRef, attachment, metadata, onProgress) => {
  const uri = attachment.localUri || attachment.uri;
  if (!uri) throw makeAttachmentError("file_read_failed", { name: attachment.name });

  let blob = null;
  try {
    blob = await getBlobFromUri(uri, attachment);
    await uploadBodyWithProgress(storageRef, blob, attachment, metadata, onProgress);
  } catch (error) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await uploadString(storageRef, base64, "base64", metadata);
    onProgress?.(1);
  } finally {
    blob?.close?.();
  }
};

export const uploadAttachmentDraft = async (attachment, {
  userId,
  onProgress,
  skipAuthRefresh = false,
} = {}) => {
  const [storedAttachment] = normalizeAttachmentList([attachment]);
  if (storedAttachment) return storedAttachment;

  if (!storageBucketName) throw makeAttachmentError("storage_not_configured");

  const uploadUserId = skipAuthRefresh ? userId : await getAttachmentUploadUserId(userId);
  if (!uploadUserId) throw makeAttachmentError("auth_required");

  const draft = {
    ...attachment,
    id: attachment.id || generateId(),
    name: sanitizeFileName(attachment.name || "attachment"),
    mimeType: inferAttachmentMimeType(attachment.name, attachment.mimeType),
    size: Number(attachment.size) || 0,
  };
  const normalized = await prepareAttachmentForUpload(draft);
  const validationError = validateAsset(normalized, normalized.source || "file", {
    allowCompressionCandidate: false,
  });
  if (validationError) throw validationError;

  const storagePath = getStoragePath(uploadUserId, normalized);
  const storageRef = ref(storage, storagePath);
  const compression = normalizeAttachmentCompression(normalized.compression);
  const imagePreview = normalizeAttachmentImagePreview(normalized.imagePreview);
  const metadata = {
    contentType: normalized.mimeType,
    contentDisposition: getAttachmentContentDisposition(normalized.name),
    customMetadata: {
      planitAttachment: "true",
      privacySanitized: normalized.privacySanitized ? "true" : "false",
      ...(imagePreview ? {
        imagePreview: "true",
        ...(imagePreview.colors ? { imagePreviewColors: imagePreview.colors.join(",") } : {}),
      } : {}),
      ...(compression ? {
        imageProcessed: "true",
        imageCodec: compression.codec,
        imageMetadataStripped: compression.metadataStripped ? "true" : "false",
      } : {}),
    },
  };

  if (Platform.OS === "web") {
    await uploadWebAttachment(storageRef, normalized, metadata, onProgress);
  } else {
    await uploadNativeAttachment(storageRef, normalized, metadata, onProgress);
  }

  const uploadedAt = Date.now();
  const downloadURL = await getDownloadURL(storageRef);
  const uploadedAttachment = {
    id: normalized.id,
    fileId: normalized.fileId || normalized.id,
    name: normalized.name,
    mimeType: normalized.mimeType,
    size: normalized.size,
    storagePath,
    downloadURL,
    cacheKey: getAttachmentCacheKey({ ...normalized, storagePath }),
    cloudRevision: uploadedAt,
    createdAt: Number(normalized.createdAt) || Date.now(),
    uploadedAt,
    privacySanitized: normalized.privacySanitized === true,
    ...(compression ? { compression } : {}),
    ...(imagePreview ? { imagePreview } : {}),
  };

  const cachedAttachment = await cacheAttachmentFromLocalUri(uploadedAttachment, normalized.localUri || normalized.uri);
  if (
    compression
    && Platform.OS === "web"
    && normalized.localUri
    && cachedAttachment?.localUri
    && cachedAttachment.localUri !== normalized.localUri
  ) {
    revokeWebObjectUrl(normalized.localUri);
  }
  if (
    compression
    && Platform.OS !== "web"
    && normalized.localUri
    && cachedAttachment?.localUri
    && cachedAttachment.localUri !== normalized.localUri
  ) {
    await deleteNativeCompressionCandidate({ uri: normalized.localUri });
  }
  return cachedAttachment;
};

export const uploadAttachmentDrafts = async (attachments, {
  userId,
  onAttachmentProgress,
  onAttachmentStart,
} = {}) => {
  const uploaded = [];
  const uploadedDuringThisRun = [];

  try {
    const draftList = normalizeAttachmentDraftList(attachments);
    const hasNewAttachments = draftList.some((attachment) => normalizeAttachmentList([attachment]).length === 0);
    const uploadUserId = hasNewAttachments ? await getAttachmentUploadUserId(userId) : userId;

    for (const attachment of draftList) {
      const wasAlreadyStored = normalizeAttachmentList([attachment]).length > 0;
      onAttachmentStart?.(attachment);
      const nextAttachment = await uploadAttachmentDraft(attachment, {
        userId: uploadUserId,
        skipAuthRefresh: true,
        onProgress: (progress) => onAttachmentProgress?.(attachment, progress),
      });
      uploaded.push(nextAttachment);
      if (!wasAlreadyStored) uploadedDuringThisRun.push(nextAttachment);
    }
  } catch (error) {
    logAttachmentUploadError(error);
    await deleteStoredAttachments(uploadedDuringThisRun);
    throw error;
  }

  return uploaded;
};

export const deleteStoredAttachment = async (attachment) => {
  if (!attachment?.storagePath) {
    await deleteLocalAttachmentCache(attachment);
    return;
  }

  try {
    await deleteObject(ref(storage, attachment.storagePath));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
  } finally {
    await deleteLocalAttachmentCache(attachment);
  }
};

export const deleteCloudAttachmentObject = async (attachment) => {
  if (!attachment?.storagePath) return;

  try {
    await deleteObject(ref(storage, attachment.storagePath));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
  }
};

export const deleteStoredAttachments = async (attachments) => {
  const uniqueAttachments = new Map();
  normalizeAttachmentDraftList(attachments).forEach((attachment) => {
    const key = attachment?.storagePath
      || attachment?.localUri
      || attachment?.uri
      || attachment?.id
      || attachment?.name;
    if (key) uniqueAttachments.set(key, attachment);
  });

  await Promise.allSettled(
    Array.from(uniqueAttachments.values()).map((attachment) => deleteStoredAttachment(attachment))
  );
};

const getCacheBustedUrl = (url) => {
  if (!String(url || "").startsWith("http")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}planitDownload=${Date.now()}`;
};

const updateWebAttachmentDownloadMetadata = async (attachment) => {
  if (!attachment?.storagePath) return;

  try {
    await updateMetadata(ref(storage, attachment.storagePath), {
      contentDisposition: getAttachmentContentDisposition(attachment?.name || "attachment"),
    });
  } catch (error) {}
};

const triggerWebAttachmentDownload = async (url, attachment) => {
  if (typeof document === "undefined") {
    throw makeAttachmentError("download_failed", { name: attachment?.name });
  }

  const fileName = sanitizeFileName(attachment?.name || "attachment");
  const downloadUrl = getCacheBustedUrl(url);

  if (!String(downloadUrl || "").startsWith("http")) {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  await updateWebAttachmentDownloadMetadata(attachment);

  const iframe = document.createElement("iframe");
  iframe.src = downloadUrl;
  iframe.title = fileName;
  iframe.style.display = "none";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
  }, 60000);
};

const shareNativeAttachment = async (attachment) => {
  const localUri = attachment?.localUri || attachment?.openUri || attachment?.uri;
  if (!localUri) throw makeAttachmentError("download_failed", { name: attachment?.name });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    return attachment;
  }

  await Sharing.shareAsync(localUri, {
    dialogTitle: attachment?.name || t("attachments.file", "en"),
    mimeType: inferAttachmentMimeType(attachment?.name, attachment?.mimeType),
    UTI: isImageAttachment(attachment) ? "public.image" : "public.data",
  });

  return attachment;
};

export const getAttachmentShareLabel = (lang) => {
  const localized = t("attachments.share", lang);
  if (localized && localized !== "attachments.share") return localized;
  return String(lang || "").startsWith("uk")
    ? "\u041f\u043e\u0434\u0456\u043b\u0438\u0442\u0438\u0441\u044f \u0432\u043a\u043b\u0430\u0434\u0435\u043d\u043d\u044f\u043c"
    : "Share attachment";
};

export const shareAttachment = async (attachment) => {
  const preparedAttachment = await ensureLocalAttachment(attachment);
  return shareNativeAttachment(preparedAttachment);
};

const isRemoteUri = (uri = "") => /^https?:\/\//i.test(String(uri || ""));

const isSafUri = (uri = "") => (
  String(uri || "").startsWith("content://com.android.externalstorage.documents")
);

const getCachedAndroidDownloadDirectoryUri = async () => {
  try {
    return await AsyncStorage.getItem(ANDROID_DOWNLOAD_DIRECTORY_URI_KEY);
  } catch (error) {
    return null;
  }
};

const getAndroidDownloadDirectoryUri = async ({ forcePrompt = false } = {}) => {
  const saf = FileSystem.StorageAccessFramework;
  if (!saf?.requestDirectoryPermissionsAsync || !saf?.createFileAsync) {
    throw makeAttachmentError("download_failed");
  }

  if (!forcePrompt) {
    const cachedUri = await getCachedAndroidDownloadDirectoryUri();
    if (cachedUri) return cachedUri;
  }

  let initialUri = null;
  try {
    initialUri = saf.getUriForDirectoryInRoot?.(ANDROID_DOWNLOAD_FOLDER_NAME) || null;
  } catch (error) {}

  const permissions = await saf.requestDirectoryPermissionsAsync(initialUri);
  if (!permissions?.granted || !permissions?.directoryUri) {
    throw makeAttachmentError("download_failed");
  }

  try {
    await AsyncStorage.setItem(ANDROID_DOWNLOAD_DIRECTORY_URI_KEY, permissions.directoryUri);
  } catch (error) {}

  return permissions.directoryUri;
};

const makeUniqueDownloadFileName = (fileName) => {
  const safeName = sanitizeFileName(fileName || "attachment");
  const extensionMatch = safeName.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] || "";
  const baseName = extension
    ? safeName.slice(0, -extension.length).replace(/\.+$/, "")
    : safeName;

  return sanitizeFileName(`${baseName || "attachment"}-${Date.now()}${extension}`);
};

const getAndroidDownloadFileName = (attachment = {}) => (
  normalizeAttachmentDisplayNameForMimeType(
    attachment.name || "attachment",
    attachment.mimeType
  )
);

const prepareAndroidDownloadAttachment = async (attachment) => {
  const sourceUri = (
    attachment?.localUri
    || attachment?.openUri
    || attachment?.uri
    || attachment?.downloadURL
    || attachment?.url
    || ""
  );

  if (!sourceUri) {
    throw makeAttachmentError("download_failed", { name: attachment?.name });
  }

  if (isRemoteUri(sourceUri)) {
    return ensureLocalAttachment({
      ...attachment,
      downloadURL: attachment?.downloadURL || attachment?.url || sourceUri,
      localUri: null,
      openUri: null,
      uri: null,
    }, { forceDownload: true });
  }

  if (String(sourceUri).startsWith("file://") || isSafUri(sourceUri)) {
    return {
      ...attachment,
      localUri: sourceUri,
      openUri: sourceUri,
    };
  }

  const cachedAttachment = await cacheAttachmentFromLocalUri(attachment, sourceUri);
  const cachedUri = cachedAttachment?.localUri || cachedAttachment?.openUri || "";
  if (cachedUri) {
    return {
      ...cachedAttachment,
      openUri: cachedUri,
    };
  }

  return {
    ...attachment,
    localUri: sourceUri,
    openUri: sourceUri,
  };
};

const readAndroidDownloadSource = async (attachment) => {
  const sourceUri = attachment?.localUri || attachment?.openUri || attachment?.uri;
  if (!sourceUri) {
    throw makeAttachmentError("download_failed", { name: attachment?.name });
  }

  try {
    return await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    throw makeAttachmentError("download_failed", {
      name: attachment?.name,
      originalError: error,
    });
  }
};

const createAndroidDownloadFile = async (directoryUri, fileName, mimeType) => {
  const saf = FileSystem.StorageAccessFramework;

  try {
    return await saf.createFileAsync(directoryUri, fileName, mimeType);
  } catch (error) {
    return saf.createFileAsync(directoryUri, makeUniqueDownloadFileName(fileName), mimeType);
  }
};

const writeAndroidDownloadFile = async (directoryUri, attachment, base64Contents) => {
  const saf = FileSystem.StorageAccessFramework;
  const fileName = getAndroidDownloadFileName(attachment);
  const mimeType = inferAttachmentMimeType(fileName, attachment?.mimeType);
  let outputUri = "";

  try {
    outputUri = await createAndroidDownloadFile(directoryUri, fileName, mimeType);
    await saf.writeAsStringAsync(outputUri, base64Contents, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      ...attachment,
      downloadUri: outputUri,
      downloadedFileName: fileName,
    };
  } catch (error) {
    if (outputUri) {
      try {
        await saf.deleteAsync(outputUri, { idempotent: true });
      } catch (deleteError) {}
    }
    throw error;
  }
};

const saveAndroidAttachmentToDownloads = async (attachment) => {
  const preparedAttachment = await prepareAndroidDownloadAttachment(attachment);
  const base64Contents = await readAndroidDownloadSource(preparedAttachment);
  const cachedDirectoryUri = await getCachedAndroidDownloadDirectoryUri();

  if (cachedDirectoryUri) {
    try {
      return await writeAndroidDownloadFile(cachedDirectoryUri, preparedAttachment, base64Contents);
    } catch (error) {
      try {
        await AsyncStorage.removeItem(ANDROID_DOWNLOAD_DIRECTORY_URI_KEY);
      } catch (storageError) {}
    }
  }

  try {
    const directoryUri = await getAndroidDownloadDirectoryUri({ forcePrompt: true });
    return await writeAndroidDownloadFile(directoryUri, preparedAttachment, base64Contents);
  } catch (error) {
    throw makeAttachmentError("download_failed", {
      name: attachment?.name,
      originalError: error,
    });
  }
};

export const openAttachment = async (attachment, { download = false } = {}) => {
  const url = attachment?.downloadURL || attachment?.url || attachment?.localUri || attachment?.uri;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    let webUrl = url;
    if (!webUrl) {
      try {
        const cacheState = await getAttachmentCacheState(attachment);
        webUrl = cacheState?.uri || "";
      } catch (error) {}
    }
    if (!webUrl) {
      webUrl = await getFreshAttachmentDownloadURL(attachment);
    }
    if (!webUrl) throw makeAttachmentError("open_failed", { name: attachment?.name });

    if (download && typeof document !== "undefined") {
      await triggerWebAttachmentDownload(webUrl, attachment);
      return;
    }

    if (typeof document !== "undefined") {
      const anchor = document.createElement("a");
      anchor.href = webUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (!url && !attachment?.storagePath) {
    const cacheState = await getAttachmentCacheState(attachment);
    if (!cacheState?.uri) throw makeAttachmentError("open_failed", { name: attachment?.name });
  }

  const preparedAttachment = await ensureLocalAttachment(attachment, { forceDownload: download });
  if (download) {
    if (Platform.OS === "android") {
      return saveAndroidAttachmentToDownloads(preparedAttachment);
    }
    return shareNativeAttachment(preparedAttachment);
  }

  let openUri = preparedAttachment.openUri || preparedAttachment.localUri || url;
  if (Platform.OS === "android" && String(openUri).startsWith("file://")) {
    try {
      openUri = await FileSystem.getContentUriAsync(openUri);
    } catch (error) {}
  }

  const supported = await Linking.canOpenURL(openUri);
  if (!supported) throw makeAttachmentError("open_failed", { name: attachment?.name });
  await Linking.openURL(openUri);
  return preparedAttachment;
};
