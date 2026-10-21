import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';

import { Card } from '../Card';
import { Text } from '../Text';

/** A white card grouping related fields under a small overline (Starling-style). */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <Card style={styles.card}>
      <Text variant="micro" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.md },
  });
