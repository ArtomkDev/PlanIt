export const TEACHER_CONTACT_TYPE_IDS = [
  "phone",
  "email",
  "telegram",
  "whatsapp",
  "instagram",
  "facebook",
  "website",
];

export const LINK_TYPE_IDS = [
  "website",
  "meeting",
  "course",
  "document",
  "telegram",
];

export const CONTACT_ICON_IDS = [
  "user",
  "phone",
  "email",
  "globe",
  "link",
  "video",
  "telegram",
  "whatsapp",
  "instagram",
  "facebook",
  "google",
  "teams",
  "document",
  "chat",
];

export const TEACHER_DEFAULT_ICON_ID = "user";
export const TEACHER_DEFAULT_COLOR = "#6366F1";

export const CONTACT_COLOR_VALUES = [
  "#2563EB",
  "#0891B2",
  "#16A34A",
  "#CA8A04",
  "#EA580C",
  "#DC2626",
  "#DB2777",
  "#7C3AED",
  "#4F46E5",
  "#64748B",
];

const TYPE_COLORS = {
  phone: "#16A34A",
  email: "#2563EB",
  website: "#0891B2",
  meeting: "#4F46E5",
  course: "#EA580C",
  document: "#7C3AED",
  telegram: "#229ED9",
  whatsapp: "#16A34A",
  instagram: "#DB2777",
  facebook: "#2563EB",
};

const DEFAULT_ICON_BY_TYPE = {
  user: "user",
  phone: "phone",
  email: "email",
  website: "globe",
  meeting: "video",
  course: "chat",
  document: "document",
  telegram: "telegram",
  whatsapp: "whatsapp",
  instagram: "instagram",
  facebook: "facebook",
};

const LEGACY_LINK_TYPE_MAP = {
  zoom: "meeting",
  meet: "meeting",
  teams: "meeting",
  moodle: "course",
  classroom: "course",
  other: "website",
};

const LINK_INFERENCE = [
  { type: "telegram", match: /(^|\.)t\.me\/|(^|\.)telegram\.me\/|^telegram:/i },
  { type: "meeting", match: /(^|\.)zoom\.us\/|zoommtg:|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com/i },
  { type: "course", match: /moodle|classroom\.google\.com|canvas\.|blackboard\./i },
  { type: "document", match: /docs\.google\.com|drive\.google\.com|onedrive\.live\.com|dropbox\.com|\.(pdf|docx?|xlsx?|pptx?|odt)(?:[?#]|$)/i },
];

const cleanText = (value) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
const withoutScheme = (value, scheme) => value.toLowerCase().startsWith(scheme) ? value.slice(scheme.length) : value;

const getSafeHttpUrl = (value) => {
  const clean = cleanText(value);
  if (!clean || /\s/.test(clean)) return "";
  const explicitScheme = clean.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") return "";
  const candidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) return "";
    return parsed.toString();
  } catch (_error) {
    return "";
  }
};

const getProfilePart = (value, hosts) => {
  const clean = cleanText(value);
  if (!clean) return { handle: "", url: "" };

  if (/^https?:\/\//i.test(clean) || /^(?:www\.)?[a-z0-9.-]+\//i.test(clean)) {
    const url = getSafeHttpUrl(clean);
    if (!url) return { handle: "", url: "" };
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!hosts.includes(hostname)) return { handle: "", url: "" };
    const handle = decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[0] || "");
    return { handle, url };
  }

  return { handle: clean.replace(/^@/, ""), url: "" };
};

const normalizeTelegramUrl = (value) => {
  const { handle, url } = getProfilePart(value, ["t.me", "telegram.me"]);
  if (url && (/^\+/.test(handle) || handle === "joinchat")) return url;
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(handle)) return "";
  return `https://t.me/${handle}`;
};

const normalizeInstagramUrl = (value) => {
  const { handle } = getProfilePart(value, ["instagram.com"]);
  if (!/^(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/.test(handle)) return "";
  return `https://www.instagram.com/${handle}/`;
};

const normalizeFacebookUrl = (value) => {
  const { handle } = getProfilePart(value, ["facebook.com", "fb.com"]);
  if (!/^[a-zA-Z0-9.]{5,80}$/.test(handle)) return "";
  return `https://www.facebook.com/${handle}`;
};

const normalizeWhatsAppUrl = (value) => {
  const { handle, url } = getProfilePart(value, ["wa.me", "api.whatsapp.com"]);
  if (url && new URL(url).hostname.toLowerCase().replace(/^www\./, "") === "api.whatsapp.com") return url;
  const digits = (handle || cleanText(value)).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return `https://wa.me/${digits}`;
};

export const normalizeTeacherContactType = (type) => {
  const clean = cleanText(type).toLowerCase();
  if (clean === "other") return "website";
  return TEACHER_CONTACT_TYPE_IDS.includes(clean) ? clean : "phone";
};

export const inferLinkType = (url = "") => {
  const clean = cleanText(url);
  const found = LINK_INFERENCE.find((item) => item.match.test(clean));
  return found?.type || "website";
};

export const normalizeLinkType = (type, url = "") => {
  const clean = cleanText(type).toLowerCase();
  const migrated = LEGACY_LINK_TYPE_MAP[clean] || clean;
  if (LINK_TYPE_IDS.includes(migrated)) return migrated;
  return inferLinkType(url);
};

export const getContactTypeColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.website;

export const getDefaultContactIconId = (type) => DEFAULT_ICON_BY_TYPE[type] || "link";

export const normalizeContactIcon = (icon, fallbackType = "website") => (
  CONTACT_ICON_IDS.includes(icon) ? icon : getDefaultContactIconId(fallbackType)
);

export const getTeacherAppearance = (teacher = {}) => ({
  icon: normalizeContactIcon(teacher.icon, "user"),
  color: /^#[0-9a-f]{6}$/i.test(cleanText(teacher.color))
    ? cleanText(teacher.color)
    : TEACHER_DEFAULT_COLOR,
});

export const inferLinkIconId = (url = "", type = inferLinkType(url)) => {
  const clean = cleanText(url);
  if (/zoom\.us|zoommtg:/i.test(clean)) return "video";
  if (/meet\.google\.com|classroom\.google\.com/i.test(clean)) return "google";
  if (/teams\.microsoft\.com|teams\.live\.com/i.test(clean)) return "teams";
  if (/t\.me\/|telegram\.me\/|telegram:/i.test(clean)) return "telegram";
  if (/moodle|canvas\.|blackboard\./i.test(clean)) return "chat";
  return getDefaultContactIconId(type);
};

export const ensureWebUrl = (value) => getSafeHttpUrl(value);

export const getTeacherContactOpenUrl = (contact) => {
  const type = normalizeTeacherContactType(contact?.type);
  const value = cleanText(contact?.value || contact?.url);
  if (!value) return "";

  if (type === "phone") {
    const phone = withoutScheme(value, "tel:").replace(/\s+/g, "");
    return /^[0-9a-z+().,;=%*#-]{3,40}$/i.test(phone) ? `tel:${phone}` : "";
  }
  if (type === "email") {
    const email = withoutScheme(value, "mailto:");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : "";
  }
  if (type === "telegram") return normalizeTelegramUrl(value);
  if (type === "whatsapp") return normalizeWhatsAppUrl(value);
  if (type === "instagram") return normalizeInstagramUrl(value);
  if (type === "facebook") return normalizeFacebookUrl(value);
  return ensureWebUrl(value);
};

export const getLinkOpenUrl = (link) => {
  const type = normalizeLinkType(link?.type, link?.url || link?.value);
  const value = cleanText(link?.url || link?.value);
  if (!value) return "";
  if (type === "telegram") return normalizeTelegramUrl(value);
  return ensureWebUrl(value);
};

export const getContactValueError = (type, value) => {
  if (!cleanText(value)) return "schedule.contact_errors.required";
  return getTeacherContactOpenUrl({ type, value }) ? "" : `schedule.contact_errors.invalid_${normalizeTeacherContactType(type)}`;
};

export const getLinkValueError = (type, value) => {
  if (!cleanText(value)) return "schedule.contact_errors.required";
  return getLinkOpenUrl({ type, url: value }) ? "" : `schedule.contact_errors.invalid_${normalizeLinkType(type, value)}`;
};

export const normalizeTeacherContacts = (teacher = {}, createId = () => "") => {
  const source = Array.isArray(teacher.contacts) ? teacher.contacts : [];
  const seen = new Set();
  const contacts = source
    .map((contact, index) => {
      if (!contact || typeof contact !== "object") return null;
      const type = normalizeTeacherContactType(contact.type);
      const value = cleanText(contact.value || contact.url);
      const url = getTeacherContactOpenUrl({ ...contact, type, value });
      if (!value || !url) return null;
      const dedupeKey = `${type}:${url.toLowerCase()}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        id: cleanText(contact.id) || createId(index),
        type,
        label: cleanText(contact.label),
        value,
        url,
        icon: normalizeContactIcon(contact.icon, type),
        color: /^#[0-9a-f]{6}$/i.test(cleanText(contact.color)) ? cleanText(contact.color) : getContactTypeColor(type),
      };
    })
    .filter(Boolean);

  const addLegacy = (type, value, seed) => {
    const clean = cleanText(value);
    const url = getTeacherContactOpenUrl({ type, value: clean });
    const dedupeKey = `${type}:${url.toLowerCase()}`;
    if (!clean || !url || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    contacts.push({
      id: createId(seed),
      type,
      label: "",
      value: clean,
      url,
      icon: getDefaultContactIconId(type),
      color: getContactTypeColor(type),
    });
  };

  addLegacy("phone", teacher.phone, "phone");
  addLegacy("email", teacher.email, "email");

  return contacts;
};
