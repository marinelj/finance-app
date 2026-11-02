import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { collectBackup, parseBackupPayload, restoreBackup } from '@/db/backup';
import { clearSyncAccount, readSyncAccount, saveSyncAccount } from '@/lib/sync/account';
import { createSyncClient } from '@/lib/sync/client';
import { SyncEngine } from '@/lib/sync/engine';
import { reloadPreferences } from '@/state/preferences';

/** The one sync engine for the app, wired to the real database and keychain. */
export const syncEngine = new SyncEngine({
  readAccount: readSyncAccount,
  saveAccount: saveSyncAccount,
  clearAccount: clearSyncAccount,
  createClient: (url) => createSyncClient(url),
  collect: () => collectBackup(),
  apply: (payload) => {
    restoreBackup(parseBackupPayload(JSON.stringify(payload)));
    reloadPreferences();
  },
});

export function useSyncStatus() {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getStatus, syncEngine.getStatus);
}

/** Saves this long after the last change, so a burst of edits becomes one upload. */
const SAVE_DELAY_MS = 1500;
/** How often an open app checks whether another device saved. */
const CHECK_EVERY_MS = 60_000;

/**
 * Runs sync in the background while the app is open: after local changes, on open, when the
 * app or tab comes back, when the connection returns, and once a minute.
 */
export function ServerSync() {
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const syncSoon = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        void syncEngine.sync({ checkServer: false });
      }, SAVE_DELAY_MS);
    };
    const check = () => void syncEngine.sync();

    void syncEngine.load().then(check);

    const changes = addDatabaseChangeListener(syncSoon);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, CHECK_EVERY_MS);

    const isWeb = process.env.EXPO_OS === 'web' && typeof document !== 'undefined';
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    if (isWeb) {
      document.addEventListener('visibilitychange', onVisible);
      globalThis.addEventListener?.('online', check);
    }

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      changes.remove();
      appState.remove();
      clearInterval(interval);
      if (isWeb) {
        document.removeEventListener('visibilitychange', onVisible);
        globalThis.removeEventListener?.('online', check);
      }
    };
  }, []);

  return null;
}
