import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { Text } from '../Text';
import { gutterFor, linear, niceBounds } from './scale';

export type ColumnSeries = { key: string; label: string; color: string };
export type Column = { label: string; values: number[] };

type ColumnChartProps = {
  columns: Column[];
  series: ColumnSeries[];
  height?: number;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  accessibilityLabel: string;
};

const TOP = 12;
const X_AXIS = 20;
const GAP = 2;
const MAX_WIDTH = 24;
const RADIUS = 4;

/** A column whose top corners are rounded (the data end) and whose base is square. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + w - radius},${y}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Stacked columns, one per period. Segments are separated by a 2px surface gap and only the top
 * of each column is rounded. Tap a column for its values.
 */
export function ColumnChart({
  columns,
  series,
  height = 140,
  formatValue,
  formatTick,
  accessibilityLabel,
}: ColumnChartProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const totals = columns.map((column) => column.values.reduce((sum, value) => sum + value, 0));
  const bounds = niceBounds(0, Math.max(1, ...totals), 2);
  // Room for the y-axis tick labels, left of the plot.
  const LEFT = gutterFor(bounds.ticks.map((value) => formatTick(value)));
  const plotBottom = TOP + height;
  const y = linear([0, bounds.max], [plotBottom, TOP]);
  const slot = (width - LEFT) / Math.max(1, columns.length);
  const barWidth = Math.min(MAX_WIDTH, slot * 0.6);
  const showEvery = slot < 30 ? 2 : 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: plotBottom + X_AXIS }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={plotBottom}>
            {bounds.ticks.map((tick) => (
              <Line
                key={tick}
                x1={LEFT}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? colors.chart.axis : colors.chart.grid}
                strokeWidth={1}
              />
            ))}
            {columns.map((column, i) => {
              const x = LEFT + i * slot + (slot - barWidth) / 2;
              const dim = active != null && active !== i;
              let base = plotBottom;
              const nonZero = column.values
                .map((value, s) => ({ value, s }))
                .filter((item) => item.value > 0);
              return nonZero.map(({ value, s }, k) => {
                const h = plotBottom - y(value);
                const top = base - h;
                const isTop = k === nonZero.length - 1;
                // Every segment above the first gives up 2px at its base for the surface gap.
                const gap = k > 0 ? GAP : 0;
                const segment = { x, y: top, w: barWidth, h: Math.max(0, h - gap) };
                base = top;
                return isTop ? (
                  <Path
                    key={`${i}-${s}`}
                    d={roundedTop(segment.x, segment.y, segment.w, segment.h, RADIUS)}
                    fill={series[s].color}
                    opacity={dim ? 0.35 : 1}
                  />
                ) : (
                  <Rect
                    key={`${i}-${s}`}
                    x={segment.x}
                    y={segment.y}
                    width={segment.w}
                    height={segment.h}
                    fill={series[s].color}
                    opacity={dim ? 0.35 : 1}
                  />
                );
              });
            })}
          </Svg>

          {bounds.ticks.map((tick) => (
            <Text
              key={`tick-${tick}`}
              variant="micro"
              tone="muted"
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[styles.tick, { top: y(tick) - 8, width: LEFT - 6 }]}>
              {formatTick(tick)}
            </Text>
          ))}

          {columns.map((column, i) =>
            i % showEvery === 0 ? (
              <Text
                key={`x-${i}`}
                variant="micro"
                tone={active === i ? 'default' : 'muted'}
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={[
                  styles.xLabel,
                  { top: plotBottom + 4, left: i * slot - 10, width: slot + 20 },
                ]}>
                {column.label}
              </Text>
            ) : null
          )}

          <View style={[StyleSheet.absoluteFill, styles.hitRow, { paddingLeft: LEFT }]}>
            {columns.map((column, i) => (
              <Pressable
                key={`hit-${i}`}
                onPress={() => {
                  haptics.selection();
                  setActive(active === i ? null : i);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${column.label}: ${formatValue(totals[i])}`}
                style={styles.hit}
              />
            ))}
          </View>

          {active != null ? (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                {
                  left: Math.min(Math.max(0, LEFT + active * slot + slot / 2 - 80), width - 160),
                },
              ]}>
              <Text variant="callout" weight="700" numberOfLines={1}>
                {formatValue(totals[active])}
              </Text>
              <Text variant="micro" tone="muted">
                {columns[active].label}
              </Text>
              {series.map((item, s) =>
                columns[active].values[s] > 0 ? (
                  <View key={item.key} style={styles.tooltipRow}>
                    <View style={[styles.lineKey, { backgroundColor: item.color }]} />
                    <Text variant="caption" weight="600">
                      {formatValue(columns[active].values[s])}
                    </Text>
                    <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                ) : null
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, radius, shadow }: Theme) =>
  StyleSheet.create({
    tick: { position: 'absolute', left: 0, textAlign: 'right' },
    xLabel: { position: 'absolute', textAlign: 'center' },
    hitRow: { flexDirection: 'row' },
    hit: { flex: 1 },
    tooltip: {
      position: 'absolute',
      top: 0,
      width: 160,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      boxShadow: shadow.raised,
    },
    tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineKey: { width: 10, height: 2, borderRadius: 1 },
    flex: { flex: 1 },
  });
