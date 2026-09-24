import { useState, useEffect } from 'react';
import { getDevicePrefs } from '../utils/storage';
import * as Localization from 'expo-localization';
import { normalizeLanguage } from '../utils/i18n';

export default function useAppLanguage(globalLanguage, deviceLanguage) {
  const [lang, setLang] = useState('en');
  const [isLangLoading, setIsLangLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const determineLanguage = async () => {
      try {
        if (deviceLanguage) {
          if (isMounted) {
            setLang(normalizeLanguage(deviceLanguage));
            setIsLangLoading(false);
          }
          return;
        }
        const prefs = await getDevicePrefs();
        if (prefs?.language) {
          if (isMounted) {
            setLang(normalizeLanguage(prefs.language));
            setIsLangLoading(false);
          }
          return;
        }

        if (globalLanguage) {
          if (isMounted) {
            setLang(normalizeLanguage(globalLanguage));
            setIsLangLoading(false);
          }
          return;
        }

        const locales = Localization.getLocales();
        const deviceLang = locales?.[0]?.languageCode?.toLowerCase() || '';

        if (isMounted) {
          setLang(normalizeLanguage(deviceLang));
          setIsLangLoading(false);
        }
      } catch (error) {
        console.error("Language detection failed, falling back to English:", error);
        if (isMounted) {
          setLang('en');
          setIsLangLoading(false);
        }
      }
    };

    determineLanguage();

    return () => { isMounted = false; };
  }, [globalLanguage, deviceLanguage]);

  return { lang, isLangLoading };
}
