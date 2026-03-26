import uk from '../locales/uk';
import en from '../locales/en';

const translations = { uk, en };

/**
 * Отримує переклад за ключем (напр. 'settings.language_title')
 * @param {string} key - шлях до ключа
 * @param {string} lang - код мови (uk, en)
 */
export const t = (key, lang = 'uk') => {
  const keys = key.split('.');
  let result = translations[lang] || translations['uk'];
  
  for (const k of keys) {
    if (result[k]) {
      result = result[k];
    } else {
      return key; // Повертаємо сам ключ, якщо переклад не знайдено
    }
  }
  return result;
};

export const SUPPORTED_LANGUAGES = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];