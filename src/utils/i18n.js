import uk from '../locales/uk';
import en from '../locales/en';

const translations = { uk, en };

export const t = (key, lang = 'en') => {
  const keys = key.split('.');
  let result = translations[lang] || translations['en'];
  
  for (const k of keys) {
    if (result[k]) {
      result = result[k];
    } else {
      return key; 
    }
  }
  return result;
};

export const SUPPORTED_LANGUAGES = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];