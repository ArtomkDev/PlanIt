const UNDEFINED_SENTINEL = "__planit_undefined__";
const CIRCULAR_SENTINEL = "__planit_circular__";

const normalizeForFingerprint = (value, seen) => {
  if (value === undefined) return UNDEFINED_SENTINEL;
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForFingerprint(item, seen));
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return CIRCULAR_SENTINEL;

  seen.add(value);
  const normalized = {};
  Object.keys(value).sort().forEach((key) => {
    normalized[key] = normalizeForFingerprint(value[key], seen);
  });
  seen.delete(value);
  return normalized;
};

const normalizeScheduleData = (data) => {
  const normalized = normalizeForFingerprint(data, new WeakSet());
  if (!normalized || !Array.isArray(normalized.schedules)) return normalized;

  return {
    ...normalized,
    // Firestore does not guarantee collection order. Everything within an
    // individual schedule stays ordered because that order is user data.
    schedules: [...normalized.schedules].sort((left, right) => (
      String(left?.id ?? "").localeCompare(String(right?.id ?? ""))
    )),
  };
};

export const getScheduleDataFingerprint = (data) => {
  if (data === undefined) return UNDEFINED_SENTINEL;
  return JSON.stringify(normalizeScheduleData(data));
};

export const hasScheduleDataChanged = (previousData, nextData) => (
  getScheduleDataFingerprint(previousData) !== getScheduleDataFingerprint(nextData)
);
