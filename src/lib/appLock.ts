import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityLevel } from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * App lock: Face ID / Touch ID / fingerprint with the device passcode as fallback. The setting
 * lives in the OS keychain/keystore (expo-secure-store), not in the database, so restoring a
 * backup on another phone never locks you out.
 */

export type AppLockSettings = {
  enabled: boolean;
  /** How long the app may sit in the background before it locks again. */
  lockAfterSeconds: number;
};

export const LOCK_AFTER_CHOICES = [0, 60, 300];
export const DEFAULT_APP_LOCK: AppLockSettings = { enabled: false, lockAfterSeconds: 0 };

const KEY = 'app-lock';

export const appLockSupported = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

export async function readAppLock(): Promise<AppLockSettings> {
  if (!appLockSupported) return DEFAULT_APP_LOCK;
  try {
    const stored = await SecureStore.getItemAsync(KEY);
    const value = stored ? (JSON.parse(stored) as Partial<AppLockSettings>) : {};
    return {
      enabled: value.enabled === true,
      lockAfterSeconds: LOCK_AFTER_CHOICES.includes(value.lockAfterSeconds ?? -1)
        ? (value.lockAfterSeconds as number)
        : DEFAULT_APP_LOCK.lockAfterSeconds,
    };
  } catch {
    return DEFAULT_APP_LOCK;
  }
}

export async function saveAppLock(settings: AppLockSettings): Promise<void> {
  if (!appLockSupported) return;
  await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
}

/** True when the phone has a screen lock (biometrics or at least a passcode) to check against. */
export async function canUseAppLock(): Promise<boolean> {
  if (!appLockSupported) return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(promptMessage: string, cancelLabel: string): Promise<boolean> {
  if (!appLockSupported) return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
