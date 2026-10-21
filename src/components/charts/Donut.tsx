import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/design/theme';

export type DonutSegment = { key: string; value: number; color: string };

type DonutProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  accessibilityLabel: string;
  /** Content in the hole, e.g. the total. */
  children?: ReactNode;
};

/** Gap between segments, in pixels along the ring. */
const GAP = 2;

/** Part-to-whole ring with 2px gaps between segments (at most six segments). */
export function Donut({
  segments,
  size = 168,
  thickness = 18,
  accessibilityLabel,
  children,
}: DonutProps) {
  const { colors } = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? GAP : 0;

  let offset = 0;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.rotate}>
        {total === 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.chart.grid}
            strokeWidth={thickness}
            fill="none"
          />
        ) : (
          visible.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dash = Math.max(0.5, length - gap);
            const circle = (
              <Circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                fill="none"
              />
            );
            offset += length;
            return circle;
          })
        )}
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
  // Start the first segment at 12 o'clock.
  rotate: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
});
