import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { useStyles } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { isHovered } from '@/hooks/useHover';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';

export type SegmentOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

const PADDING = 4;

/** Pill-shaped single choice with a sliding white indicator (Copilot-style range chips). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;

  const x = useSharedValue(index * segment);
  useEffect(() => {
    const target = index * segment;
    x.set(reduceMotion ? target : withSpring(target, springs.snappy));
  }, [x, index, segment, reduceMotion]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {segment > 0 ? (
        <Animated.View style={[styles.indicator, { width: segment }, indicatorStyle]} />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            style={(state) => [styles.segment, !selected && isHovered(state) && styles.hovered]}>
            <Text
              variant="callout"
              weight={selected ? '700' : '500'}
              tone={selected ? 'default' : 'muted'}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, radius, shadow }: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: PADDING,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    indicator: {
      position: 'absolute',
      top: PADDING,
      bottom: PADDING,
      left: PADDING,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
    hovered: { backgroundColor: 'rgba(20, 20, 43, 0.05)', borderRadius: radius.pill },
    segment: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
  });
