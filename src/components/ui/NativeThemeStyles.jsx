import { useEffect, useLayoutEffect } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { useScheduleData } from '../../context/ScheduleProvider';
import useAppTheme from '../../hooks/useAppTheme';

export default function NativeThemeStyles() {
  const { user, guest, global } = useScheduleData();
  const { colorScheme } = useAppTheme();
  const scheme = (user || guest) && global?.theme?.[0] !== 'system' ? colorScheme : 'unspecified';

  useLayoutEffect(() => {
    if (Platform.OS === 'web') return;
    const apply = () => Appearance.setColorScheme(scheme);
    apply();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') apply();
    });
    return () => subscription.remove();
  }, [scheme]);

  useEffect(() => () => {
    if (Platform.OS !== 'web') Appearance.setColorScheme('unspecified');
  }, []);

  return null;
}
