import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type AccentTone, type Theme } from '@/design/tokens';

import { Button } from './Button';
import { Text } from './Text';

type EmptyStateProps = {
  emoji?: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  tone?: AccentTone;
};

/** Friendly placeholder: emoji in a playful blob, a title, one sentence and an optional action. */
export function EmptyState({
  emoji = '✨',
  title,
  message,
  action,
  tone = 'violet',
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();

  return (
    <View style={styles.container}>
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify(springs.bouncy.duration)}
        importantForAccessibility="no-hide-descendants"
        accessible={false}
        style={[styles.blob, { backgroundColor: colors.accentSoft[tone] }]}>
        <View style={[styles.dot, styles.dotTop, { backgroundColor: colors.accent.pink }]} />
        <View style={[styles.dot, styles.dotBottom, { backgroundColor: colors.accent.sun }]} />
        <View style={styles.inner}>
          <RNText allowFontScaling={false} style={styles.emoji}>
            {emoji}
          </RNText>
        </View>
      </Animated.View>
      <Text variant="title" align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} style={styles.action} />
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, space, shadow }: Theme) =>
  StyleSheet.create({
    container: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
    blob: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.sm,
    },
    inner: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
    emoji: { fontSize: 36 },
    dot: { position: 'absolute', borderRadius: 999 },
    dotTop: { width: 14, height: 14, top: 10, right: 14 },
    dotBottom: { width: 10, height: 10, bottom: 14, left: 12 },
    action: { alignSelf: 'center', marginTop: space.sm },
  });
