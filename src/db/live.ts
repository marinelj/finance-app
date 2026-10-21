import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

/**
 * Reads rows synchronously on the first render (no empty flash) and re-reads them after writes
 * to any of `tables`. A transaction fires one change event per row, so refreshes are coalesced
 * into one per tick. Pass a module-level `read` function so its identity is stable.
 */
export function useLiveRows<T>(tables: readonly string[], read: () => T): T {
  const [value, setValue] = useState(read);
  const key = tables.join('|');

  useEffect(() => {
    const watched = new Set(key.split('|'));
    let pending: ReturnType<typeof setTimeout> | null = null;
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (!watched.has(tableName) || pending) return;
      pending = setTimeout(() => {
        pending = null;
        setValue(read());
      }, 0);
    });
    return () => {
      subscription.remove();
      if (pending) clearTimeout(pending);
    };
  }, [key, read]);

  return value;
}
