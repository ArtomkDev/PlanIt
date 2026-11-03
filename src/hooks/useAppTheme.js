import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useScheduleData } from '../context/ScheduleProvider';
import themes from '../config/themes';

export default function useAppTheme() {
  const { global } = useScheduleData();
  const systemScheme = useColorScheme();
  const [setting = systemScheme || 'light', accent = 'blue'] = global?.theme || [];
  const mode = setting === 'system' ? systemScheme || 'light' : setting;
  const colors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  return { mode, colors, colorScheme: mode === 'dark' || mode === 'oled' ? 'dark' : 'light' };
}
