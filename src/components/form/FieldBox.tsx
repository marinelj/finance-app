import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';

import { Text } from '../Text';

export type FieldBoxProps = {
  label: string;
  error?: string;
  hint?: string;
  focused?: boolean;
  /** Label suffix such as "Optional". */
  aside?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Field chrome: the label sits inside the box above the value; hint or error below it. */
export function FieldBox({ label, error, hint, focused, aside, children, style }: FieldBoxProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const borderColor = error ? colors.status.danger.mark : focused ? colors.primary : 'transparent';
  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.box, { borderColor }]}>
        <View style={styles.labelRow}>
          <Text variant="caption" tone={error ? 'danger' : 'muted'} style={styles.label}>
            {label}
          </Text>
          {aside ? (
            <Text variant="caption" tone="muted">
              {aside}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    wrapper: { gap: space.xs },
    box: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      borderWidth: 1.5,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.sm,
      gap: 2,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    label: { flex: 1 },
  });
