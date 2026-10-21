import { getRandomBytes } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { formatPercent } from '@/domain/money';
import { backupCreatedAt, BackupError, decryptBackup, encryptBackup } from '@/lib/backup/crypto';
import {
  backupFileName,
  pickBackupFile,
  shareBackupFile,
  type PickedFile,
} from '@/lib/backup/files';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences, reloadPreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

const MIN_PASSPHRASE = 8;

type Busy = { kind: 'encrypt' | 'decrypt'; progress: number } | null;

/** Encrypted export to a file the user keeps, and restore from such a file. */
export default function BackupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();

  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [exportTried, setExportTried] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreError, setRestoreError] = useState<string | undefined>();

  const passphraseError =
    exportTried && passphrase.length < MIN_PASSPHRASE ? t('backup.tooShort') : undefined;
  const repeatError =
    exportTried && !passphraseError && repeat !== passphrase ? t('backup.mismatch') : undefined;

  const errorText = (error: unknown) => {
    if (error instanceof BackupError || error instanceof RestoreError) {
      return t(`backup.errors.${error.code}`);
    }
    return t('backup.errors.failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  };

  const createBackup = async () => {
    setExportTried(true);
    if (passphrase.length < MIN_PASSPHRASE || repeat !== passphrase) {
      haptics.error();
      return;
    }
    try {
      setBusy({ kind: 'encrypt', progress: 0 });
      const now = new Date();
      const content = await encryptBackup(JSON.stringify(collectBackup(now)), passphrase, {
        randomBytes: getRandomBytes,
        now,
        onProgress: (progress) => setBusy({ kind: 'encrypt', progress }),
      });
      setBusy(null);
      await shareBackupFile(backupFileName(now), content, t('backup.shareTitle'));
      haptics.success();
      toast({ message: t('backup.ready') });
      setPassphrase('');
      setRepeat('');
      setExportTried(false);
    } catch (error) {
      setBusy(null);
      haptics.error();
      toast({ message: errorText(error), icon: 'alert-circle' });
    }
  };

  const choose = async () => {
    setRestoreError(undefined);
    try {
      const file = await pickBackupFile();
      if (file) setPicked(file);
    } catch (error) {
      setRestoreError(errorText(error));
    }
  };

  const restore = async () => {
    if (!picked) return;
    setRestoreError(undefined);
    const ok = await confirm({
      title: t('backup.confirmTitle'),
      message: t('backup.confirmMessage'),
      confirmLabel: t('backup.restore'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      setBusy({ kind: 'decrypt', progress: 0 });
      const text = await decryptBackup(picked.content, restorePassphrase, (progress) =>
        setBusy({ kind: 'decrypt', progress })
      );
      const count = restoreBackup(parseBackupPayload(text));
      reloadPreferences();
      setBusy(null);
      haptics.success();
      toast({ message: t('backup.restored', { count }) });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (error) {
      setBusy(null);
      haptics.error();
      setRestoreError(errorText(error));
    }
  };

  const createdAt = picked ? backupCreatedAt(picked.content) : null;
  const progressLabel = (kind: 'encrypt' | 'decrypt', progress: number) =>
    t(kind === 'encrypt' ? 'backup.encrypting' : 'backup.decrypting', {
      percent: formatPercent(progress, { decimals: 0 }),
    });

  return (
    <Screen hasHeader>
      <View style={styles.intro}>
        <Icon name="shield-checkmark-outline" size={20} color={colors.status.good.text} />
        <Text variant="callout" tone="secondary" style={styles.flex}>
          {t('backup.intro')}
        </Text>
      </View>

      <Card style={styles.section}>
        <SectionHeader title={t('backup.exportTitle')} />
        <TextField
          label={t('backup.passphrase')}
          value={passphrase}
          onChangeText={setPassphrase}
          secure
          hint={t('backup.passphraseHint')}
          error={passphraseError}
        />
        <TextField
          label={t('backup.confirm')}
          value={repeat}
          onChangeText={setRepeat}
          secure
          error={repeatError}
        />
        {busy?.kind === 'encrypt' ? (
          <Progress label={progressLabel('encrypt', busy.progress)} value={busy.progress} />
        ) : null}
        <Button
          label={t('backup.create')}
          icon="share-outline"
          fullWidth
          loading={busy?.kind === 'encrypt'}
          disabled={busy != null}
          onPress={() => void createBackup()}
        />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title={t('backup.restoreTitle')} />
        <Text variant="caption" tone="muted">
          {t('backup.restoreHint')}
        </Text>
        <Button
          label={picked ? picked.name : t('backup.choose')}
          icon="document-outline"
          variant="secondary"
          fullWidth
          disabled={busy != null}
          onPress={() => void choose()}
        />
        {createdAt ? (
          <Text variant="caption" tone="muted">
            {t('backup.createdOn', {
              date: formatDate(createdAt.slice(0, 10), language, { year: true }),
            })}
          </Text>
        ) : null}
        {picked ? (
          <>
            <TextField
              label={t('backup.restorePassphrase')}
              value={restorePassphrase}
              onChangeText={(text) => {
                setRestorePassphrase(text);
                setRestoreError(undefined);
              }}
              secure
              error={restoreError}
            />
            {busy?.kind === 'decrypt' ? (
              <Progress label={progressLabel('decrypt', busy.progress)} value={busy.progress} />
            ) : null}
            <Button
              label={t('backup.restore')}
              icon="refresh"
              variant="danger"
              fullWidth
              loading={busy?.kind === 'decrypt'}
              disabled={busy != null || restorePassphrase.length === 0}
              onPress={() => void restore()}
            />
          </>
        ) : restoreError ? (
          <Text variant="caption" tone="danger">
            {restoreError}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={styles.progress}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(value * 100)}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    intro: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
    flex: { flex: 1 },
    section: { gap: space.md },
    progress: { gap: space.xs },
    track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
  });
