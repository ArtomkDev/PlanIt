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
      const remaining = shares.filter(item => item.isActive)
        .map(item => getSharedScheduleTimestamp(item.expiresAt)).filter(value => value !== null && value > current)
        .map(value => value - current);
      // Wake up whenever a remaining-minute countdown changes; the last wake-up is the expiry itself.
      if (remaining.length) timer = setTimeout(update, Math.min(...remaining.map(value => value % 60000 || 60000)) + 1);
    };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [shares]));
  return now;
}
