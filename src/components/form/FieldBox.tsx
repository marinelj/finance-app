import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/design/motion';

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

/**
 * Field chrome: the label sits inside the box above the value; hint or error below it. When an
 * error appears the box gives a short shake so the eye finds it (skipped under Reduce Motion).
 */
export function FieldBox({ label, error, hint, focused, aside, children, style }: FieldBoxProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
  const borderColor = error ? colors.status.danger.mark : focused ? colors.primary : 'transparent';

  const shake = useSharedValue(0);
  const hadError = useRef(Boolean(error));
  useEffect(() => {
    const appeared = Boolean(error) && !hadError.current;
    hadError.current = Boolean(error);
    if (!appeared || reduceMotion) return;
    shake.set(
      withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(4, { duration: 60 }),
        withTiming(0, { duration: 50 })
      )
    );
  }, [error, reduceMotion, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View style={[styles.box, { borderColor }, shakeStyle]}>
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
      </Animated.View>
      {error ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(150)}>
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        </Animated.View>
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
