import { StyleSheet, View } from 'react-native';

import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';

import { Text } from '../Text';

export type LegendItem = {
  key: string;
  label: string;
  color: string;
  /** Formatted value, e.g. "¥8,000". */
  value?: string;
  /** Formatted share or note, e.g. "27%". */
  detail?: string;
};

type LegendProps = {
  items: LegendItem[];
  /** Swatch shape mirrors the mark: a square for bars and areas, a short line for lines. */
  swatch?: 'square' | 'dot' | 'line';
};

/**
 * Legend that doubles as the chart's table view: every series with its value in text colours,
 * identity carried by the swatch beside it (never by coloured text).
 */
export function Legend({ items, swatch = 'square' }: LegendProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View
          key={item.key}
          accessible
          accessibilityLabel={[item.label, item.value, item.detail].filter(Boolean).join(', ')}
          style={styles.row}>
          <View
            style={[
              swatch === 'line' ? styles.line : swatch === 'dot' ? styles.dot : styles.square,
              { backgroundColor: item.color },
            ]}
          />
          <Text variant="callout" tone="secondary" numberOfLines={1} style={styles.label}>
            {item.label}
          </Text>
          {item.detail ? (
            <Text variant="caption" tone="muted" tabular>
              {item.detail}
            </Text>
          ) : null}
          {item.value ? (
            <Text variant="callout" weight="600" tabular style={styles.value}>
              {item.value}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
    square: { width: 10, height: 10, borderRadius: 2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    line: { width: 14, height: 2, borderRadius: 1 },
    label: { flex: 1 },
    value: { minWidth: 72, textAlign: 'right' },
  });
