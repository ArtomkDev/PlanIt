import { useState, useEffect } from 'react';
import { Platform, NativeModules } from 'react-native';
import { getDevicePrefs } from '../utils/storage';

export default function useAppLanguage(globalLanguage) {
  const [lang, setLang] = useState('uk');
  const [isLangLoading, setIsLangLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const determineLanguage = async () => {
      try {
        if (globalLanguage) {
          if (isMounted) { setLang(globalLanguage); setIsLangLoading(false); }
          return;
        }

        const prefs = await getDevicePrefs();
        if (prefs?.language) {
          if (isMounted) { setLang(prefs.language); setIsLangLoading(false); }
          return;
        }

        let deviceLang = '';
        if (Platform.OS === 'web') {
          deviceLang = window.navigator?.language || '';
        } else if (Platform.OS === 'ios') {
          deviceLang = NativeModules.SettingsManager?.settings?.AppleLocale ||
                       NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || '';
        } else {
          deviceLang = NativeModules.I18nManager?.localeIdentifier || '';
        }

        const shortCode = deviceLang.split(/[-_]/)[0].toLowerCase();
        
        if (shortCode === 'uk' || shortCode === 'en') {
          if (isMounted) { setLang(shortCode); setIsLangLoading(false); }
          return;
        }

        if (isMounted) { setLang('en'); setIsLangLoading(false); }
      } catch (error) {
        if (isMounted) { setLang('uk'); setIsLangLoading(false); }
      }
    };

    determineLanguage();

    return () => { isMounted = false; };
  }, [globalLanguage]);

  return { lang, isLangLoading };
}