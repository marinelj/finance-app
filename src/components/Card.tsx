import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { AccentTone, Theme } from '@/design/tokens';

import { PressableScale } from './PressableScale';

type Variant = 'plain' | 'gradient' | 'tinted' | 'outline';

export type CardProps = {
  children: ReactNode;
  variant?: Variant;
  /** Background tint for the `tinted` variant. */
  tone?: AccentTone;
  padding?: keyof Theme['space'] | 0;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Rounded container: white card, hero gradient, pale tint or hairline outline. */
export function Card({
  children,
  variant = 'plain',
  tone = 'violet',
  padding = 'xl',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CardProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const pad = padding === 0 ? 0 : theme.space[padding];

  const surface: StyleProp<ViewStyle> = [
    styles.base,
    { padding: pad },
    variant === 'plain' && styles.plain,
    variant === 'outline' && styles.outline,
    variant === 'tinted' && { backgroundColor: theme.colors.accentSoft[tone] },
    variant === 'gradient' && styles.gradientShadow,
    style,
  ];

  const body =
    variant === 'gradient' ? (
      <LinearGradient
        colors={theme.colors.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[surface, styles.clip]}>
        {children}
      </LinearGradient>
    ) : (
      <View style={surface}>{children}</View>
    );

  if (!onPress) return body;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      haptic="light"
      onPress={onPress}>
      {body}
    </PressableScale>
  );
}

const makeStyles = ({ colors, radius, shadow }: Theme) =>
  StyleSheet.create({
    base: { borderRadius: radius.lg },
    plain: { backgroundColor: colors.surface, boxShadow: shadow.card },
    outline: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    gradientShadow: { boxShadow: shadow.raised },
    clip: { overflow: 'hidden' },
  });
