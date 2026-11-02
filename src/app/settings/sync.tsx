import * as Device from 'expo-device';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/form/TextField';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import {
  clearSyncAccount,
  readSyncAccount,
  saveSyncAccount,
  type SyncAccount,
} from '@/lib/sync/account';
import { createSyncClient, SyncError } from '@/lib/sync/client';
import type { SyncPhase } from '@/lib/sync/engine';
import { syncEngine, useSyncStatus } from '@/state/serverSync';
import { useToast } from '@/state/toast';

/** The github.io build: only https servers can be reached from it. */
const isHttpsPage = process.env.EXPO_OS === 'web' && globalThis.location?.protocol === 'https:';

type Busy = 'signIn' | 'signUp' | 'resolve' | 'signOut' | null;

const PHASE_ICON: Record<SyncPhase, IconName> = {
  off: 'cloud-offline-outline',
  syncing: 'sync-outline',
  synced: 'cloud-done-outline',
  offline: 'cloud-offline-outline',
  conflict: 'git-compare-outline',
  error: 'alert-circle-outline',
};

/**
 * Signs in to the user's own Finance server. While signed in, every change saves to the server
 * automatically and changes from other devices load on their own (see state/serverSync).
 */
export default function SyncScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const status = useSyncStatus();

  const [account, setAccount] = useState<SyncAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    const stored = await readSyncAccount();
    setAccount(stored);
    if (stored) {
      setServerUrl(stored.serverUrl);
      setEmail(stored.email);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    void readSyncAccount().then((stored) => {
      if (!active) return;
      setAccount(stored);
      if (stored) {
        setServerUrl(stored.serverUrl);
        setEmail(stored.email);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [status.phase]);

  const errorText = (cause: unknown) =>
    cause instanceof SyncError ? t(`sync.errors.${cause.code}`) : t('sync.errors.server');

  const signIn = async (kind: 'signIn' | 'signUp') => {
    setError(undefined);
    setBusy(kind);
    try {
      const client = createSyncClient(serverUrl);
      const device = Device.modelName ?? undefined;
      const session =
        kind === 'signIn'
          ? await client.signIn(email.trim(), password, device)
          : await client.signUp(email.trim(), password, device);
      await saveSyncAccount({
        serverUrl: client.baseUrl,
        token: session.token,
        email: session.user.email,
        revision: null,
        syncedHash: null,
        lastSyncedAt: null,
      });
      setPassword('');
      await refresh();
      setBusy(null);
      haptics.success();
      toast({ message: t('sync.signedIn', { email: session.user.email }) });
      await syncEngine.sync();
    } catch (cause) {
      setBusy(null);
      haptics.error();
      setError(errorText(cause));
    }
  };

  const resolve = async (keep: 'device' | 'server') => {
    const ok = await confirm({
      title: t(keep === 'device' ? 'sync.keepDeviceTitle' : 'sync.keepServerTitle'),
      message: t(keep === 'device' ? 'sync.keepDeviceMessage' : 'sync.keepServerMessage'),
      confirmLabel: t(keep === 'device' ? 'sync.keepDevice' : 'sync.keepServer'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setBusy('resolve');
    await syncEngine.resolve(keep);
    setBusy(null);
  };

  const signOut = async () => {
    if (!account) return;
    setBusy('signOut');
    try {
      await createSyncClient(account.serverUrl).signOut(account.token);
    } catch {
      // Forget the token here even if the server can't be reached.
    }
    await clearSyncAccount();
    await syncEngine.load();
    await refresh();
    setBusy(null);
  };

  if (!loaded) return null;

  const statusText = () => {
    switch (status.phase) {
      case 'syncing':
        return t('sync.status.syncing');
      case 'synced':
        return status.lastSyncedAt
          ? t('sync.status.synced', { time: new Date(status.lastSyncedAt).toLocaleTimeString() })
          : t('sync.status.syncing');
      case 'offline':
        return t('sync.status.offline');
      case 'conflict':
        return t('sync.status.conflict');
      case 'error':
        return status.error ? t(`sync.errors.${status.error}`) : t('sync.errors.server');
      default:
        return t('sync.status.off');
    }
  };
  const statusTone = status.phase === 'error' || status.phase === 'conflict' ? 'danger' : 'muted';

  return (
    <Screen hasHeader>
      <View style={styles.intro}>
        <Icon name="server-outline" size={20} color={colors.status.good.text} />
        <Text variant="callout" tone="secondary" style={styles.flex}>
          {t(account ? 'sync.introSignedIn' : 'sync.intro')}
        </Text>
      </View>

      {account ? (
        <>
          <Card style={styles.section}>
            <SectionHeader title={t('sync.account')} />
            <Text variant="body">{account.email}</Text>
            <Text variant="caption" tone="muted">
              {account.serverUrl}
            </Text>
            <View style={styles.status} accessibilityLiveRegion="polite">
              <Icon
                name={PHASE_ICON[status.phase]}
                size={18}
                color={
                  statusTone === 'danger' ? colors.status.danger.text : colors.status.good.text
                }
              />
              <Text variant="caption" tone={statusTone} style={styles.flex}>
                {statusText()}
              </Text>
            </View>
            {status.phase === 'offline' || status.phase === 'error' ? (
              <Button
                label={t('sync.retry')}
                icon="refresh"
                variant="secondary"
                fullWidth
                onPress={() => void syncEngine.sync()}
              />
            ) : null}
            <Button
              label={t('sync.signOut')}
              variant="ghost"
              fullWidth
              loading={busy === 'signOut'}
              disabled={busy != null}
              onPress={() => void signOut()}
            />
          </Card>

          {status.phase === 'conflict' ? (
            <Card style={styles.section}>
              <SectionHeader title={t('sync.conflictTitle')} />
              <Text variant="callout" tone="secondary">
                {t('sync.conflictMessage')}
              </Text>
              <Button
                label={t('sync.keepServer')}
                icon="cloud-download-outline"
                fullWidth
                loading={busy === 'resolve'}
                disabled={busy != null}
                onPress={() => void resolve('server')}
              />
              <Button
                label={t('sync.keepDevice')}
                icon="phone-portrait-outline"
                variant="secondary"
                fullWidth
                disabled={busy != null}
                onPress={() => void resolve('device')}
              />
            </Card>
          ) : null}
        </>
      ) : (
        <Card style={styles.section}>
          <SectionHeader title={t('sync.signInTitle')} />
          <TextField
            label={t('sync.serverUrl')}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder={isHttpsPage ? 'https://' : '192.168.1.5:8787'}
            hint={t(isHttpsPage ? 'sync.serverUrlHintWeb' : 'sync.serverUrlHint')}
            keyboardType="url"
            plain
          />
          <TextField
            label={t('sync.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            plain
          />
          <TextField
            label={t('sync.password')}
            value={password}
            onChangeText={setPassword}
            hint={t('sync.passwordHint')}
            secure
          />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button
            label={t('sync.signIn')}
            icon="log-in-outline"
            fullWidth
            loading={busy === 'signIn'}
            disabled={busy != null || !serverUrl.trim() || !email.trim() || password.length < 8}
            onPress={() => void signIn('signIn')}
          />
          <Button
            label={t('sync.signUp')}
            variant="secondary"
            fullWidth
            loading={busy === 'signUp'}
            disabled={busy != null || !serverUrl.trim() || !email.trim() || password.length < 8}
            onPress={() => void signIn('signUp')}
          />
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    intro: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
    flex: { flex: 1 },
    section: { gap: space.md },
    status: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  });
