import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { Text } from '../Text';
import { gutterFor, linear, niceBounds } from './scale';

export type LinePoint = { label: string; value: number };

type LineChartProps = {
  points: LinePoint[];
  color: string;
  /** Height of the plot, not counting the x-axis labels under it. */
  height?: number;
  /** Full value, for the scrub tooltip and direct labels. */
  formatValue: (value: number) => string;
  /** Short value for the y-axis ticks (1.2M, 12万). */
  formatTick: (value: number) => string;
  /** Points that get a direct value label; defaults to the last point. */
  labelIndexes?: number[];
  /** Points whose x label is shown; defaults to the first and the last. */
  xLabelIndexes?: number[];
  accessibilityLabel: string;
};

const TOP = 28;
const X_AXIS = 22;
const RIGHT = 10;

const DOT_RADIUS = 4.5;

/**
 * Single-series line with a 10% area wash, a 2px line and a ringed end dot. Press and drag (or
 * tap) to scrub: a crosshair snaps to the nearest point and a tooltip shows its value.
 */
export function LineChart({
  points,
  color,
  height = 160,
  formatValue,
  formatTick,
  labelIndexes,
  xLabelIndexes,
  accessibilityLabel,
}: LineChartProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((point) => point.value);
  const bounds = niceBounds(Math.min(...values), Math.max(...values), 3);
  // Room for the y-axis tick labels, left of the plot.
  const LEFT = gutterFor(bounds.ticks.map((value) => formatTick(value)));
  const plotBottom = TOP + height;
  const x = linear([0, Math.max(1, points.length - 1)], [LEFT, Math.max(LEFT + 1, width - RIGHT)]);
  const y = linear([bounds.min, bounds.max], [plotBottom, TOP]);
  const coords = points.map((point, i) => ({ x: x(i), y: y(point.value) }));

  const line = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const area =
    coords.length > 1
      ? `${line} L${coords[coords.length - 1].x.toFixed(1)},${plotBottom} L${coords[0].x.toFixed(1)},${plotBottom} Z`
      : '';

  const nearest = (px: number) => {
    if (points.length === 0 || width === 0) return null;
    const step = (width - RIGHT - LEFT) / Math.max(1, points.length - 1);
    return Math.max(0, Math.min(points.length - 1, Math.round((px - LEFT) / step)));
  };
  const select = (px: number) => {
    const index = nearest(px);
    if (index !== active && index != null) haptics.selection();
    setActive(index);
  };

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onActivate: (event) => select(event.x),
    onUpdate: (event) => select(event.x),
    onFinalize: () => setActive(null),
  });
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => {
      const index = nearest(event.x);
      setActive(index === active ? null : index);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const labelled = labelIndexes ?? [points.length - 1];
  const xLabels = xLabelIndexes ?? [0, points.length - 1];
  const activePoint = active != null ? points[active] : null;
  const activeCoord = active != null ? coords[active] : null;
  const tooltipWidth = 132;

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: plotBottom + X_AXIS }}>
        {width > 0 && points.length > 0 ? (
          <>
            <Svg width={width} height={plotBottom}>
              {bounds.ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={LEFT}
                  x2={width}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={colors.chart.grid}
                  strokeWidth={1}
                />
              ))}
              {area ? <Path d={area} fill={color} fillOpacity={0.1} /> : null}
              <Path
                d={line}
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
              {activeCoord ? (
                <Line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={TOP - 8}
                  y2={plotBottom}
                  stroke={colors.chart.axis}
                  strokeWidth={1}
                />
              ) : null}
              {labelled.map((i) =>
                coords[i] ? (
                  <Circle
                    key={i}
                    cx={coords[i].x}
                    cy={coords[i].y}
                    r={DOT_RADIUS}
                    fill={color}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                ) : null
              )}
              {activeCoord ? (
                <Circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={DOT_RADIUS + 1}
                  fill={color}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ) : null}
            </Svg>

            {bounds.ticks.map((tick) => (
              <Text
                key={tick}
                variant="micro"
                tone="muted"
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                style={[styles.tick, { top: y(tick) - 8, width: LEFT - 6 }]}>
                {formatTick(tick)}
              </Text>
            ))}

            {active == null
              ? labelled.map((i) =>
                  coords[i] ? (
                    <Text
                      key={`label-${i}`}
                      variant="caption"
                      weight="700"
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      style={[
                        styles.pointLabel,
                        {
                          top: Math.max(0, coords[i].y - 24),
                          left: Math.min(Math.max(0, coords[i].x - 60), width - 120),
                        },
                      ]}>
                      {formatValue(points[i].value)}
                    </Text>
                  ) : null
                )
              : null}

            {xLabels.map((i) =>
              points[i] ? (
                <Text
                  key={`x-${i}`}
                  variant="micro"
                  tone="muted"
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  style={[
                    styles.xLabel,
                    {
                      top: plotBottom + 4,
                      left: Math.min(Math.max(0, coords[i].x - 40), width - 80),
                      textAlign: i === 0 ? 'left' : i === points.length - 1 ? 'right' : 'center',
                    },
                  ]}>
                  {points[i].label}
                </Text>
              ) : null
            )}

            {activePoint && activeCoord ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  {
                    width: tooltipWidth,
                    left: Math.min(
                      Math.max(0, activeCoord.x - tooltipWidth / 2),
                      width - tooltipWidth
                    ),
                  },
                ]}>
                <Text variant="callout" weight="700" numberOfLines={1} adjustsFontSizeToFit>
                  {formatValue(activePoint.value)}
                </Text>
                <Text variant="micro" tone="muted" numberOfLines={1}>
                  {activePoint.label}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const makeStyles = ({ colors, radius, shadow }: Theme) =>
  StyleSheet.create({
    tick: { position: 'absolute', left: 0, textAlign: 'right' },
    pointLabel: { position: 'absolute', width: 120, textAlign: 'center' },
    xLabel: { position: 'absolute', width: 80 },
    tooltip: {
      position: 'absolute',
      top: 0,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      boxShadow: shadow.raised,
    },
  });
