import { useState, useEffect } from 'react';
import { getDevicePrefs } from '../utils/storage';
import * as Localization from 'expo-localization';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';

export default function useAppLanguage(globalLanguage) {
  const [lang, setLang] = useState('en');
  const [isLangLoading, setIsLangLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;

    const determineLanguage = async () => {
      try {
        const prefs = await getDevicePrefs();
        if (prefs?.language) {
          if (isMounted) { 
            setLang(prefs.language); 
            setIsLangLoading(false); 
          }
          return;
        }

        if (globalLanguage) {
          if (isMounted) { 
            setLang(globalLanguage); 
            setIsLangLoading(false); 
          }
          return;
        }

        const locales = Localization.getLocales();
        const deviceLang = locales?.[0]?.languageCode?.toLowerCase() || '';

        const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === deviceLang);

        if (isMounted) {
          setLang(isSupported ? deviceLang : 'en');
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
  }, [globalLanguage]);

  return { lang, isLangLoading };
}