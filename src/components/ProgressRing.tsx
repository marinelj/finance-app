import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useMotion } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { springs } from '@/design/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  /** 0–1; values outside are clamped for drawing. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Fill colour; carries the meaning (severity or brand). */
  color?: string;
  /** Unfilled track: a lighter step of the fill's own hue. */
  trackColor?: string;
  accessibilityLabel: string;
  children?: ReactNode;
};

/** Circular meter that springs to its value. Content (a number, a label) sits in the middle. */
export function ProgressRing({
  progress,
  size = 96,
  strokeWidth = 10,
  color,
  trackColor,
  accessibilityLabel,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotion();
  const value = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animated = useSharedValue(reduceMotion ? value : 0);
  useEffect(() => {
    animated.set(reduceMotion ? value : withSpring(value, springs.gentle));
  }, [animated, value, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.get()),
    // A zero-length dash with round caps still draws a dot; hide it at zero.
    strokeOpacity: animated.get() > 0.001 ? 1 : 0,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? colors.primarySoft}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
      {children ? (
        <View
          style={[StyleSheet.absoluteFill, styles.center]}
          importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rotate: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});
