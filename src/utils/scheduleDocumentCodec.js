import { decodeStorageValue, encodeStorageValue, isEncodedStorageValue } from "./dataCodec";

const CODEC_NAME = "planit.lz.v1";
const CODEC_FIELD = "_c";
const PAYLOAD_FIELD = "_p";

const SCHEDULE_META_KEYS = new Set([
  "id",
  "version",
  "baseVersion",
  "lastModified",
  "lastSynced",
  "isDeleted",
  "deletedAt",
]);

const GLOBAL_META_KEYS = new Set([
  "version",
  "baseVersion",
  "lastModified",
  "lastSynced",
  "watermark",
  "watermarkUpdatedAt",
]);

const SCHEDULE_DOCUMENT_KEYS = new Set([
  CODEC_FIELD,
  PAYLOAD_FIELD,
  "id",
  "version",
  "baseVersion",
  "lastModified",
  "isDeleted",
  "deletedAt",
]);

const GLOBAL_DOCUMENT_KEYS = new Set([
  CODEC_FIELD,
  PAYLOAD_FIELD,
  "version",
  "baseVersion",
  "lastModified",
  "watermark",
  "watermarkUpdatedAt",
]);

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const omitKeys = (source = {}, keys) => {
  const result = {};
  Object.keys(source || {}).forEach((key) => {
    if (!keys.has(key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  });
  return result;
};

const compactObject = (source = {}) => {
  const result = {};
  Object.keys(source || {}).forEach((key) => {
    const value = source[key];
    if (value !== undefined) result[key] = value;
  });
  return result;
};

const decodePayload = (data = {}) => {
  const payload = data[PAYLOAD_FIELD];
  if (!isEncodedStorageValue(payload)) return {};
  return decodeStorageValue(payload, {}) || {};
};

export const isEncodedDocument = (data = {}) => (
  data?.[CODEC_FIELD] === CODEC_NAME && isEncodedStorageValue(data?.[PAYLOAD_FIELD])
);

const hasOnlyDocumentKeys = (data = {}, allowedKeys) => (
  Object.keys(data || {}).every((key) => allowedKeys.has(key))
);

export const needsScheduleDocumentRewrite = (data = {}) => (
  !isEncodedDocument(data) || !hasOnlyDocumentKeys(data, SCHEDULE_DOCUMENT_KEYS)
);

export const needsGlobalDocumentRewrite = (data = {}) => (
  !isEncodedDocument(data) || !hasOnlyDocumentKeys(data, GLOBAL_DOCUMENT_KEYS)
);

export const encodeScheduleDocument = (schedule = {}) => {
  const payload = omitKeys(schedule, SCHEDULE_META_KEYS);
  const encoded = {
    [CODEC_FIELD]: CODEC_NAME,
    [PAYLOAD_FIELD]: encodeStorageValue(payload),
    id: schedule.id,
    version: Number(schedule.version) || 1,
    baseVersion: Number(schedule.baseVersion) || 1,
    lastModified: Number(schedule.lastModified) || Date.now(),
  };

  if (schedule.isDeleted === true) encoded.isDeleted = true;
  if (schedule.deletedAt !== undefined && schedule.deletedAt !== null) {
    encoded.deletedAt = schedule.deletedAt;
  }

  return compactObject(encoded);
};

export const decodeScheduleDocument = (data = {}, fallbackId = null) => {
  if (!isObject(data)) return fallbackId ? { id: fallbackId } : {};

  if (!isEncodedDocument(data)) {
    return compactObject({ ...data, id: data.id || fallbackId });
  }

  const payload = decodePayload(data);
  return compactObject({
    ...payload,
    id: data.id || fallbackId,
    version: data.version,
    baseVersion: data.baseVersion,
    lastModified: data.lastModified,
    isDeleted: data.isDeleted === true,
    deletedAt: data.deletedAt,
  });
};

export const encodeGlobalDocument = (globalData = {}, options = {}) => {
  const { includePayload = true } = options;
  const encoded = {};

  if (includePayload) {
    encoded[CODEC_FIELD] = CODEC_NAME;
    encoded[PAYLOAD_FIELD] = encodeStorageValue(omitKeys(globalData, GLOBAL_META_KEYS));
  }

  [
    "version",
    "baseVersion",
    "lastModified",
    "watermark",
    "watermarkUpdatedAt",
  ].forEach((key) => {
    if (globalData[key] !== undefined) encoded[key] = globalData[key];
  });

  return compactObject(encoded);
};

export const decodeGlobalDocument = (data = {}) => {
  if (!isObject(data)) return {};

  if (!isEncodedDocument(data)) {
    const { [CODEC_FIELD]: _codec, [PAYLOAD_FIELD]: _payload, ...legacyData } = data;
    return compactObject(legacyData);
  }

  const payload = decodePayload(data);
  return compactObject({
    ...payload,
    version: data.version,
    baseVersion: data.baseVersion,
    lastModified: data.lastModified,
    watermark: data.watermark,
    watermarkUpdatedAt: data.watermarkUpdatedAt,
  });
};

export const encodeSharedScheduleDocument = (sharedDoc = {}) => {
  const { scheduleData, ...meta } = sharedDoc;
  return compactObject({
    ...meta,
    [CODEC_FIELD]: CODEC_NAME,
    [PAYLOAD_FIELD]: encodeStorageValue(scheduleData || {}),
  });
};

export const decodeSharedScheduleDocument = (data = {}) => {
  if (!isObject(data)) return {};

  if (!isEncodedDocument(data)) {
    return data;
  }

  const { [CODEC_FIELD]: _codec, [PAYLOAD_FIELD]: _payload, ...meta } = data;
  return compactObject({
    ...meta,
    scheduleData: decodePayload(data),
  });
};
