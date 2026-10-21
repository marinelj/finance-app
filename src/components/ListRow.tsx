import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { AccentTone, Theme } from '@/design/tokens';

import { Icon, type IconName } from './Icon';
import { IconChip } from './IconChip';
import { Text } from './Text';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  emoji?: string;
  tone?: AccentTone;
  /** Short value shown on the right, e.g. "CNY". */
  value?: string;
  /** Custom trailing element, e.g. a Switch. Rows with one are not pressable themselves. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** Settings-style row: icon chip, title + subtitle, and a value, control or chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  emoji,
  tone,
  value,
  trailing,
  onPress,
  accessibilityHint,
}: ListRowProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const content = (
    <>
      {icon || emoji ? <IconChip icon={icon} emoji={emoji} tone={tone} size={36} /> : null}
      <View style={styles.text}>
        <Text variant="body" weight="600">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" tone="secondary">
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress && !trailing ? (
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (!onPress || trailing) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint ?? subtitle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 56,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: colors.surfaceMuted },
    text: { flex: 1, gap: 2 },
  });
