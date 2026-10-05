import { t } from "../../../../utils/i18n";

const timestampToMs = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
};

export const getDeviceActivity = (device) => Math.max(
  timestampToMs(device.lastSeenAt),
  timestampToMs(device.lastSyncTime),
  timestampToMs(device.lastLogin),
);

export function getDevicePresentation(device, lang) {
  const web = device.platform?.toLowerCase() === "web";
  const source = web ? device.name || "" : device.platform || "";
  let platform = t("settings.device_screen.unknown_os", lang);
  if (/Android/i.test(source)) platform = "Android";
  else if (/iPhone|iPad|iPod|iOS/i.test(source)) platform = "iOS";
  else if (/Windows/i.test(source)) platform = "Windows";
  else if (/Mac/i.test(source)) platform = "macOS";
  else if (/CrOS/i.test(source)) platform = "ChromeOS";
  else if (/Linux/i.test(source)) platform = "Linux";
  else if (!web && source && source !== "Unknown") platform = source;

  let client = "PlanIt";
  if (web) {
    client = t("settings.device_screen.web_browser", lang);
    if (/Edg/i.test(source)) client = "Edge";
    else if (/OPR\/|Opera|OPiOS/i.test(source)) client = "Opera";
    else if (/SamsungBrowser/i.test(source)) client = "Samsung Internet";
    else if (/Chrome|CriOS/i.test(source)) client = "Chrome";
    else if (/Firefox|FxiOS/i.test(source)) client = "Firefox";
    else if (/Safari/i.test(source)) client = "Safari";
  }

  const mobile = platform === "Android" || platform === "iOS"
    || /Mobile|Tablet/i.test(source)
    || (!web && !/Windows|macOS|Linux|ChromeOS/.test(platform));
  return { title: `${platform} · ${client}`, mobile };
}

export function formatDeviceActivity(device, lang, now = Date.now()) {
  const timestamp = getDeviceActivity(device);
  if (!timestamp) return t("settings.device_screen.unknown_date", lang);
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return t("settings.device_screen.just_now", lang);
  const units = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  const [size, unit] = units.find(([size]) => seconds >= size);
  return t(`settings.device_screen.relative_time.${unit}`, lang, { count: Math.floor(seconds / size) });
}
