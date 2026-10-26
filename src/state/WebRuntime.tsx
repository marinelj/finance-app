import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/design/theme';
import { Text } from '@/components/Text';

export type WebStorageStatus = 'checking' | 'persistent' | 'bestEffort' | 'unsupported';

const WebStorageContext = createContext<WebStorageStatus>('unsupported');

export function useWebStorageStatus(): WebStorageStatus {
  return useContext(WebStorageContext);
}

export function WebRuntime({ children }: { children: ReactNode }) {
  const [storageStatus, setStorageStatus] = useState<WebStorageStatus>(
    process.env.EXPO_OS === 'web' && typeof navigator !== 'undefined' && 'storage' in navigator
      ? 'checking'
      : 'unsupported'
  );
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.EXPO_OS !== 'web' || !('storage' in navigator)) return;

    let active = true;
    void (async () => {
      try {
        const storage = navigator.storage;
        const alreadyPersistent = await storage.persisted();
        const persistent = alreadyPersistent || (await storage.persist());
        if (active) setStorageStatus(persistent ? 'persistent' : 'bestEffort');
      } catch {
        if (active) setStorageStatus('bestEffort');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (process.env.EXPO_OS !== 'web' || !('serviceWorker' in navigator)) return;

    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const showUpdate = () => active && setUpdateReady(true);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.data && typeof event.data === 'object' && 'type' in event.data) {
        if (event.data.type === 'FINANCE_UPDATE_READY') showUpdate();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    void navigator.serviceWorker.ready.then((readyRegistration) => {
      if (!active) return;
      registration = readyRegistration;
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate();
      void registration.update().catch(() => {});
    });

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('message', onMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const value = useMemo(() => storageStatus, [storageStatus]);
  return (
    <WebStorageContext.Provider value={value}>
      {children}
      {process.env.EXPO_OS === 'web' ? (
        <UpdateBanner visible={updateReady} onReload={() => activateUpdate()} />
      ) : null}
    </WebStorageContext.Provider>
  );
}

function activateUpdate() {
  if (process.env.EXPO_OS !== 'web' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready.then((registration) => {
    registration.waiting?.postMessage({ type: 'FINANCE_ACTIVATE_UPDATE' });
  });
}

function UpdateBanner({ visible, onReload }: { visible: boolean; onReload: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, shadow } = useTheme();
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.bannerHost}>
      <View
        accessibilityRole="alert"
        style={[
          styles.banner,
          { backgroundColor: colors.surface, borderRadius: radius.lg, boxShadow: shadow.raised },
        ]}>
        <Text variant="callout" weight="600" style={styles.message}>
          {t('web.updateReady')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('web.reload')}
          onPress={onReload}
          style={[styles.action, { backgroundColor: colors.primary }]}>
          <Text variant="caption" weight="700" style={{ color: colors.textOnPrimary }}>
            {t('web.reload')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerHost: { position: 'absolute', left: 16, right: 16, bottom: 20, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: 520,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  message: { flex: 1 },
  action: { minHeight: 40, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center' },
});
