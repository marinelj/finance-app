import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayLocal, type LocalDate } from '@/domain/dates';

/**
 * Today's local date. Refreshes just after midnight and whenever the app returns to the
 * foreground, so countdowns stay right when the phone sat in a pocket overnight.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => todayLocal());

  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();

    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, []);

  return today;
}
