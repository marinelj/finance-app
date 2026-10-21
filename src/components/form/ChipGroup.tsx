import { Pressable, StyleSheet, View } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { Text } from '../Text';

export type ChipOption<T extends string | number> = { value: T; label: string };

type ChipGroupProps<T extends string | number> = {
  options: ChipOption<T>[];
  accessibilityLabel: string;
} & (
  | { multiple?: false; value: T; onChange: (value: T) => void }
  | { multiple: true; value: T[]; onChange: (value: T[]) => void }
);

/** Wrapping pills for picking one value (currency, method) or several (reminder days). */
export function ChipGroup<T extends string | number>(props: ChipGroupProps<T>) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const isSelected = (value: T) =>
    props.multiple ? props.value.includes(value) : props.value === value;

  const toggle = (value: T) => {
    haptics.selection();
    if (props.multiple) {
      const next = props.value.includes(value)
        ? props.value.filter((item) => item !== value)
        : [...props.value, value];
      props.onChange(next);
    } else if (props.value !== value) {
      props.onChange(value);
    }
  };

  return (
    <View
      accessibilityRole={props.multiple ? undefined : 'radiogroup'}
      accessibilityLabel={props.accessibilityLabel}
      style={styles.wrap}>
      {props.options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => toggle(option.value)}
            accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
            accessibilityState={props.multiple ? { checked: selected } : { selected }}
            accessibilityLabel={option.label}
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              selected && { backgroundColor: colors.primary },
              pressed && !selected && styles.pressed,
            ]}>
            <Text
              variant="callout"
              weight={selected ? '700' : '600'}
              tone={selected ? 'onPrimary' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: space.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    pressed: { backgroundColor: colors.hairline },
  });
