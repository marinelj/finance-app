import * as SecureStore from 'expo-secure-store';

/**
 * The server address and sign-in token, kept in the OS keychain/keystore on phones. The web
 * build has no keychain, so it keeps them in this browser's local storage.
 */

export type SyncAccount = {
  serverUrl: string;
  token: string;
  email: string;
  /** Server revision this device last matched, or null before the first sync. */
  revision: number | null;
  /** Fingerprint of this device's data at that revision, to tell whether it changed since. */
  syncedHash: string | null;
  /** When this device last matched the server, ISO 8601. */
  lastSyncedAt: string | null;
};

const KEY = 'server-sync';
const isWeb = process.env.EXPO_OS === 'web';

function parse(stored: string | null): SyncAccount | null {
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<SyncAccount>;
    if (typeof value.serverUrl !== 'string' || typeof value.token !== 'string') return null;
    return {
      serverUrl: value.serverUrl,
      token: value.token,
      email: value.email ?? '',
      revision: typeof value.revision === 'number' ? value.revision : null,
      syncedHash: typeof value.syncedHash === 'string' ? value.syncedHash : null,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
}

export async function readSyncAccount(): Promise<SyncAccount | null> {
  try {
    if (isWeb) return parse(globalThis.localStorage?.getItem(KEY) ?? null);
    return parse(await SecureStore.getItemAsync(KEY));
  } catch {
    return null;
  }
}

export async function saveSyncAccount(account: SyncAccount): Promise<void> {
  const json = JSON.stringify(account);
  if (isWeb) globalThis.localStorage?.setItem(KEY, json);
  else await SecureStore.setItemAsync(KEY, json);
}

export async function clearSyncAccount(): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Already gone.
  }
}
