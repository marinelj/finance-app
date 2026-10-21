import { StyleSheet, View } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { StatusTone, Theme } from '@/design/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const DEFAULT_ICON: Record<StatusTone, IconName> = {
  good: 'checkmark-circle',
  caution: 'alert-circle',
  danger: 'close-circle',
};

type StatusPillProps = {
  tone: StatusTone;
  label: string;
  icon?: IconName;
  size?: 'sm' | 'md';
};

/** Status is never colour alone: every pill carries an icon and a word. */
export function StatusPill({ tone, label, icon, size = 'md' }: StatusPillProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const palette = colors.status[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.pill, size === 'sm' && styles.small, { backgroundColor: palette.soft }]}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={size === 'sm' ? 12 : 14} color={palette.text} />
      <Text
        variant={size === 'sm' ? 'micro' : 'caption'}
        weight="700"
        numberOfLines={1}
        style={{ color: palette.text }}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingVertical: space.xs + 1,
      borderRadius: radius.pill,
    },
    small: { paddingHorizontal: space.sm, paddingVertical: space.xxs + 1 },
  });
