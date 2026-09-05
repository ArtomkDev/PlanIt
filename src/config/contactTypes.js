import {
  ChatsCircle,
  EnvelopeSimple,
  FacebookLogo,
  FileText,
  Globe,
  GoogleLogo,
  InstagramLogo,
  Link as LinkIcon,
  MicrosoftTeamsLogo,
  Phone,
  TelegramLogo,
  User,
  VideoCamera,
  WhatsappLogo,
} from "phosphor-react-native";
import {
  CONTACT_COLOR_VALUES,
  CONTACT_ICON_IDS,
  getContactTypeColor,
  getDefaultContactIconId,
  inferLinkIconId,
  LINK_TYPE_IDS,
  normalizeContactIcon,
  normalizeLinkType,
  normalizeTeacherContactType,
  TEACHER_CONTACT_TYPE_IDS,
} from "../utils/contactData";

const ICONS = {
  user: User,
  phone: Phone,
  email: EnvelopeSimple,
  globe: Globe,
  link: LinkIcon,
  video: VideoCamera,
  telegram: TelegramLogo,
  whatsapp: WhatsappLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  google: GoogleLogo,
  teams: MicrosoftTeamsLogo,
  document: FileText,
  chat: ChatsCircle,
};

export const CONTACT_ICON_OPTIONS = CONTACT_ICON_IDS.map((id) => ({
  id,
  icon: ICONS[id] || LinkIcon,
  labelKey: `schedule.contact_icons.${id}`,
}));

export const CONTACT_COLOR_OPTIONS = CONTACT_COLOR_VALUES.map((color, index) => ({
  id: color,
  color,
  labelKey: `schedule.contact_colors.color_${index + 1}`,
}));

export const TEACHER_CONTACT_TYPES = TEACHER_CONTACT_TYPE_IDS.map((id) => ({
  id,
  iconId: getDefaultContactIconId(id),
  icon: ICONS[getDefaultContactIconId(id)] || LinkIcon,
  color: getContactTypeColor(id),
  labelKey: `schedule.contact_types.${id}`,
  placeholderKey: `schedule.contact_placeholders.${id}`,
}));

export const LINK_TYPES = LINK_TYPE_IDS.map((id) => ({
  id,
  iconId: getDefaultContactIconId(id),
  icon: ICONS[getDefaultContactIconId(id)] || LinkIcon,
  color: getContactTypeColor(id),
  labelKey: `schedule.link_types.${id}`,
  placeholderKey: `schedule.link_placeholders.${id}`,
}));

export const getTeacherContactTypeMeta = (type) => {
  const normalized = normalizeTeacherContactType(type);
  return TEACHER_CONTACT_TYPES.find((item) => item.id === normalized) || TEACHER_CONTACT_TYPES[0];
};

export const getLinkTypeMeta = (type, url) => {
  const normalized = normalizeLinkType(type, url);
  return LINK_TYPES.find((item) => item.id === normalized) || LINK_TYPES[0];
};

export const getContactIconComponent = (iconId, fallbackType = "website") => {
  const normalized = normalizeContactIcon(iconId, fallbackType);
  return ICONS[normalized] || LinkIcon;
};

export const getLinkIconComponent = (link = {}) => {
  const type = normalizeLinkType(link.type, link.url);
  const fallback = inferLinkIconId(link.url, type);
  return getContactIconComponent(link.icon || fallback, type);
};
