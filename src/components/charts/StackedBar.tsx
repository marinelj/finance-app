import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';

export type BarSegment = { key: string; value: number; color: string };

type StackedBarProps = {
  segments: BarSegment[];
  /** Full length of the bar; defaults to the sum of the segments. */
  total?: number;
  height?: number;
  accessibilityLabel: string;
};

/**
 * Horizontal part-to-whole bar: segments separated by a 2px surface gap, square at the start
 * (the baseline) and rounded at the data end. The legend beside it carries the values.
 */
export function StackedBar({ segments, total, height = 16, accessibilityLabel }: StackedBarProps) {
  const { colors } = useTheme();
  const visible = segments.filter((segment) => segment.value > 0);
  const sum = visible.reduce((acc, segment) => acc + segment.value, 0);
  const whole = Math.max(total ?? sum, sum, 1);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { height, backgroundColor: colors.chart.grid }]}>
      {visible.map((segment, i) => {
        const last = i === visible.length - 1;
        return (
          <View
            key={segment.key}
            style={{
              width: `${(segment.value / whole) * 100}%`,
              backgroundColor: segment.color,
              marginLeft: i > 0 ? 2 : 0,
              borderTopRightRadius: last && sum >= whole ? 4 : 0,
              borderBottomRightRadius: last && sum >= whole ? 4 : 0,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
