import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/form/TextField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { collectBackup, parseBackupPayload, restoreBackup, RestoreError } from '@/db/backup';
import { confirm } from '@/lib/confirm';
import { haptics } from '@/lib/haptics';
import {
  clearSyncAccount,
  readSyncAccount,
  saveSyncAccount,
  type SyncAccount,
} from '@/lib/sync/account';
import { createSyncClient, SyncError } from '@/lib/sync/client';
import { reloadPreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

type Busy = 'signIn' | 'signUp' | 'upload' | 'download' | 'signOut' | null;

/** Signs in to the user's own Finance server and copies data up to it or down from it. */
export default function SyncScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [account, setAccount] = useState<SyncAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | undefined>();

  const errorText = useCallback(
    (cause: unknown) => {
      if (cause instanceof SyncError) return t(`sync.errors.${cause.code}`);
      if (cause instanceof RestoreError) return t(`backup.errors.${cause.code}`);
      return t('sync.errors.server');
    },
    [t]
  );

  const signedOut = useCallback(async () => {
    await clearSyncAccount();
    setAccount(null);
    setLastUpload(null);
  }, []);

  useEffect(() => {
    let active = true;
    void readSyncAccount().then(async (stored) => {
      if (!active) return;
      setAccount(stored);
      setLoaded(true);
      if (!stored) return;
      setServerUrl(stored.serverUrl);
      setEmail(stored.email);
      try {
        const me = await createSyncClient(stored.serverUrl).me(stored.token);
        if (active) setLastUpload(me.lastUpload);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof SyncError && cause.code === 'signedOut') await signedOut();
        else setError(errorText(cause));
      }
    });
    return () => {
      active = false;
    };
  }, [errorText, signedOut]);

  const fail = (cause: unknown) => {
    setBusy(null);
    haptics.error();
    setError(errorText(cause));
    if (cause instanceof SyncError && cause.code === 'signedOut') void signedOut();
  };

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
      const next = { serverUrl: client.baseUrl, token: session.token, email: session.user.email };
      await saveSyncAccount(next);
      const me = await client.me(session.token);
      setAccount(next);
      setLastUpload(me.lastUpload);
      setPassword('');
      setBusy(null);
      haptics.success();
      toast({ message: t('sync.signedIn', { email: session.user.email }) });
    } catch (cause) {
      fail(cause);
    }
  };

  const upload = async () => {
    if (!account) return;
    setError(undefined);
    if (lastUpload) {
      const ok = await confirm({
        title: t('sync.uploadConfirmTitle'),
        message: t('sync.uploadConfirmMessage'),
        confirmLabel: t('sync.upload'),
        cancelLabel: t('common.cancel'),
      });
      if (!ok) return;
    }
    setBusy('upload');
    try {
      const client = createSyncClient(account.serverUrl);
      const result = await client.upload(account.token, collectBackup());
      const me = await client.me(account.token);
      setLastUpload(me.lastUpload);
      setBusy(null);
      haptics.success();
      toast({ message: t('sync.uploaded', { count: result.rows }) });
    } catch (cause) {
      fail(cause);
    }
  };

  const download = async () => {
    if (!account) return;
    setError(undefined);
    const ok = await confirm({
      title: t('backup.confirmTitle'),
      message: t('sync.downloadConfirmMessage'),
      confirmLabel: t('sync.download'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setBusy('download');
    try {
      const payload = await createSyncClient(account.serverUrl).download(account.token);
      const count = restoreBackup(parseBackupPayload(JSON.stringify(payload)));
      reloadPreferences();
      setBusy(null);
      haptics.success();
      toast({ message: t('backup.restored', { count }) });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (cause) {
      fail(cause);
    }
  };

  const signOut = async () => {
    if (!account) return;
    setBusy('signOut');
    try {
      await createSyncClient(account.serverUrl).signOut(account.token);
    } catch {
      // Forget the token here even if the server can't be reached.
    }
    await signedOut();
    setBusy(null);
  };

  if (!loaded) return null;

  return (
    <Screen hasHeader>
      <View style={styles.intro}>
        <Icon name="server-outline" size={20} color={colors.status.good.text} />
        <Text variant="callout" tone="secondary" style={styles.flex}>
          {t('sync.intro')}
        </Text>
      </View>

      {account ? (
        <Card style={styles.section}>
          <SectionHeader title={t('sync.account')} />
          <Text variant="body">{account.email}</Text>
          <Text variant="caption" tone="muted">
            {account.serverUrl}
          </Text>
          <Text variant="caption" tone="muted">
            {lastUpload
              ? t('sync.lastUpload', { date: new Date(lastUpload).toLocaleString() })
              : t('sync.neverUploaded')}
          </Text>
          <Button
            label={t('sync.upload')}
            icon="cloud-upload-outline"
            fullWidth
            loading={busy === 'upload'}
            disabled={busy != null}
            onPress={() => void upload()}
          />
          <Button
            label={t('sync.download')}
            icon="cloud-download-outline"
            variant="secondary"
            fullWidth
            loading={busy === 'download'}
            disabled={busy != null || !lastUpload}
            onPress={() => void download()}
          />
          <Text variant="caption" tone="muted">
            {t('sync.downloadHint')}
          </Text>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
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
      ) : (
        <Card style={styles.section}>
          <SectionHeader title={t('sync.signInTitle')} />
          <TextField
            label={t('sync.serverUrl')}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="192.168.1.5:8787"
            hint={t('sync.serverUrlHint')}
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
  });
