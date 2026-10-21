import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles } from '@/design/theme';
import type { AccentTone, StatusTone, Theme } from '@/design/tokens';

import { Card } from './Card';
import type { IconName } from './Icon';
import { IconChip } from './IconChip';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

export type StatTileProps = {
  /** Sentence case, no trailing colon. */
  label: string;
  /** Usually an <AmountText>; plain strings render in the title style. */
  value: ReactNode;
  caption?: string;
  icon?: IconName;
  emoji?: string;
  tone?: AccentTone;
  status?: { tone: StatusTone; label: string };
  /** Extra content under the caption, e.g. a DueBadge. */
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A single headline number with its label, plus an optional caption or status. */
export function StatTile({
  label,
  value,
  caption,
  icon,
  emoji,
  tone = 'violet',
  status,
  footer,
  onPress,
  accessibilityLabel,
  style,
}: StatTileProps) {
  const styles = useStyles(makeStyles);
  return (
    <Card
      padding="lg"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.tile, style]}>
      <View style={styles.header}>
        {icon || emoji ? <IconChip icon={icon} emoji={emoji} tone={tone} size={32} /> : null}
        <Text variant="caption" tone="muted" numberOfLines={2} style={styles.label}>
          {label}
        </Text>
      </View>
      {typeof value === 'string' ? (
        <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      ) : (
        value
      )}
      {status ? (
        <StatusPill tone={status.tone} label={status.label} size="sm" />
      ) : caption ? (
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
      {footer}
    </Card>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    tile: { gap: space.sm, minHeight: 124 },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    label: { flex: 1 },
  });
