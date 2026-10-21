import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Shown beside the label and read by screen readers. */
  formatValue: (value: number) => string;
};

const THUMB = 28;

/**
 * Horizontal slider: drag or tap the track. Screen readers get an adjustable control that
 * steps up and down; values always snap to `step`.
 */
export function Slider({ label, value, min, max, step, onChange, formatValue }: SliderProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const span = Math.max(step, max - min);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const snap = (next: number) => clamp(Math.round((next - min) / step) * step + min);
  const share = (clamp(value) - min) / span;
  const track = Math.max(1, width - THUMB);

  const setFromX = (x: number) => {
    const next = snap(min + ((x - THUMB / 2) / track) * span);
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  };

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (event) => setFromX(event.x),
    onUpdate: (event) => setFromX(event.x),
  });
  const tap = useTapGesture({ runOnJS: true, onActivate: (event) => setFromX(event.x) });
  const gesture = useCompetingGestures(pan, tap);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text variant="callout" tone="secondary" style={styles.flex}>
          {label}
        </Text>
        <Text variant="headline" tabular>
          {formatValue(value)}
        </Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: value, text: formatValue(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
            onChange(snap(value + delta));
          }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.hitArea}>
          <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
            <View
              style={[
                styles.fill,
                { width: share * track + THUMB / 2, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <View style={[styles.thumb, { left: share * track }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    wrapper: { gap: space.xs },
    header: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    flex: { flex: 1 },
    hitArea: { height: 44, justifyContent: 'center' },
    track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
      boxShadow: shadow.card,
    },
  });
