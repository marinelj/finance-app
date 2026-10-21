import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { openDatabase } from '@/db/client';

type GateState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/** Keeps the splash screen up until the database is open and migrated. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    openDatabase().then(
      () => active && setState({ status: 'ready' }),
      (error: unknown) => active && setState({ status: 'error', message: describeError(error) })
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hide();
  }, [state.status]);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <View style={styles.page}>
        <EmptyState
          emoji="🛠️"
          tone="sun"
          title={t('database.errorTitle')}
          message={t('database.errorMessage', { message: state.message })}
        />
        <Button
          label={t('database.retry')}
          onPress={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
          style={styles.retry}
        />
      </View>
    );
  }
  return children;
}

const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    page: {
      flex: 1,
      justifyContent: 'center',
      padding: space.xxl,
      backgroundColor: colors.background,
    },
    retry: { alignSelf: 'center' },
  });

/** The error and its causes on one line; Drizzle wraps the SQLite error in `cause`. */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current && parts.length < 4) {
    parts.push(
      current instanceof Error ? current.message.replace(/\s+/g, ' ').trim() : String(current)
    );
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(' ← ');
}
