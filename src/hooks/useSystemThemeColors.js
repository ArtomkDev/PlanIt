// src/hooks/useSystemThemeColors.js
import { useColorScheme } from 'react-native';
import themes from '../config/themes';

export default function useSystemThemeColors(defaultAccent = 'blue') {
  // Визначаємо тему пристрою (dark/light)
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';

  // Отримуємо кольори з вашого конфігу
  const colors = themes.getColors(mode, defaultAccent);

  return { colors, isDark: mode === 'dark', mode };
}