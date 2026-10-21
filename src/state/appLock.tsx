import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, StyleSheet, Text as RNText, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import {
  appLockSupported,
  authenticate,
  DEFAULT_APP_LOCK,
  readAppLock,
  saveAppLock,
  type AppLockSettings,
} from '@/lib/appLock';
import { haptics } from '@/lib/haptics';

type AppLockContextValue = {
  settings: AppLockSettings;
  /** Changes the setting after the user proves it is them; returns whether it changed. */
  update: (next: AppLockSettings) => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

/**
 * Covers the app with a lock screen until the user authenticates, at launch and after it has
 * been in the background longer than the chosen delay. While the app is inactive (app switcher)
 * an opaque cover hides balances from the OS snapshot.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppLockSettings | null>(
    appLockSupported ? null : DEFAULT_APP_LOCK
  );
  const [locked, setLocked] = useState(appLockSupported);
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticate(t('security.promptUnlock'), t('common.cancel'));
    prompting.current = false;
    if (ok) {
      haptics.success();
      setLocked(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    void readAppLock().then((stored) => {
      if (!active) return;
      setSettings(stored);
      if (!stored.enabled) setLocked(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Ask once as soon as the lock screen shows; after a cancel the Unlock button asks again.
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (!settings?.enabled || !locked) {
      autoPrompted.current = false;
      return;
    }
    if (autoPrompted.current || AppState.currentState !== 'active') return;
    autoPrompted.current = true;
    void unlock();
  }, [settings?.enabled, locked, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!settings?.enabled) return;
      if (state === 'active') {
        setCovered(false);
        const away = backgroundedAt.current ? (Date.now() - backgroundedAt.current) / 1000 : 0;
        backgroundedAt.current = null;
        if (away >= settings.lockAfterSeconds && !prompting.current) setLocked(true);
      } else {
        setCovered(true);
        if (state === 'background' && backgroundedAt.current == null) {
          backgroundedAt.current = Date.now();
        }
      }
    });
    return () => subscription.remove();
  }, [settings]);

  const update = async (next: AppLockSettings) => {
    const changingLock = next.enabled !== (settings?.enabled ?? false);
    if (changingLock) {
      const ok = await authenticate(
        next.enabled ? t('security.promptEnable') : t('security.promptDisable'),
        t('common.cancel')
      );
      if (!ok) return false;
    }
    await saveAppLock(next);
    setSettings(next);
    return true;
  };

  if (settings == null) return null;

  return (
    <AppLockContext.Provider value={{ settings, update }}>
      {children}
      {/* A Modal, so the lock also covers screens presented as native modals. */}
      <Modal
        visible={settings.enabled && (locked || covered)}
        animationType="none"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => {
          // Android back: stay locked.
        }}>
        <LockScreen showButton={locked} onUnlock={() => void unlock()} />
      </Modal>
    </AppLockContext.Provider>
  );
}

function LockScreen({ showButton, onUnlock }: { showButton: boolean; onUnlock: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.lock}
      accessibilityViewIsModal>
      <View style={styles.badge} importantForAccessibility="no-hide-descendants">
        <RNText allowFontScaling={false} style={styles.emoji}>
          🔒
        </RNText>
      </View>
      <Text variant="title" tone="onPrimary" align="center" accessibilityRole="header">
        {t('security.lockedTitle')}
      </Text>
      <Text variant="body" tone="onPrimary" align="center" style={styles.soft}>
        {t('security.lockedMessage')}
      </Text>
      {showButton ? (
        <Button
          label={t('security.unlock')}
          variant="dark"
          size="lg"
          icon="lock-open"
          onPress={onUnlock}
          style={styles.button}
        />
      ) : null}
    </LinearGradient>
  );
}

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside <AppLockGate>');
  return value;
}

const styles = StyleSheet.create({
  lock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
  },
  emoji: { fontSize: 40 },
  soft: { opacity: 0.9 },
  button: { alignSelf: 'center', marginTop: 16 },
});
