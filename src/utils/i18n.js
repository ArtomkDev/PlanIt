import uk from '../locales/uk.js';
import en from '../locales/en.js';

const translations = { uk, en };

const getPluralCategory = (language, count) => {
  if (!Number.isInteger(count)) return 'other';
  const absoluteCount = Math.abs(count);
  if (language === 'en') return absoluteCount === 1 ? 'one' : 'other';

  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return 'one';
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return 'few';
  return 'many';
};

export const SUPPORTED_LANGUAGES = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export const normalizeLanguage = (language) => {
  const code = typeof language === 'string' ? language.trim().toLowerCase().split(/[-_]/)[0] : '';
  return Object.hasOwn(translations, code) ? code : 'en';
};

export const getLocale = (language) => translations[normalizeLanguage(language)].locale;

export const formatText = (template, params = {}) => (
  typeof template === 'string'
    ? template.replace(/\{(\w+)\}/g, (token, name) => (
      Object.hasOwn(params, name) ? String(params[name]) : token
    ))
    : ''
);

const lookup = (key, language, params) => {
  let value = translations[language];
  for (const part of key.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  if (value && typeof value === 'object' && Number.isFinite(params.count)) {
    const category = getPluralCategory(language, params.count);
    value = Object.hasOwn(value, category) ? value[category] : value.other;
  }
  return typeof value === 'string' ? value : undefined;
};

export const t = (key, language = 'en', params = {}) => {
  if (typeof key !== 'string') return '';
  const lang = normalizeLanguage(language);
  const template = lookup(key, lang, params) ?? lookup(key, 'en', params) ?? key;
  return formatText(template, params);
};
