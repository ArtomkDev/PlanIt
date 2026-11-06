import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSharedScheduleTimestamp } from '../services/shareService';

export default function useSharedScheduleClock(shares) {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const next = Math.min(...shares.filter(item => item.isActive)
        .map(item => getSharedScheduleTimestamp(item.expiresAt)).filter(value => value !== null && value > current));
      if (Number.isFinite(next)) timer = setTimeout(update, Math.min(next - current + 1, 2147483647));
    };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [shares]));
  return now;
}
