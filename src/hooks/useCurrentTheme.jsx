import { useColorScheme } from 'react-native';

export default function useCurrentTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}
