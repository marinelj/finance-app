import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { FieldBox } from './FieldBox';

type SelectFieldProps = {
  label: string;
  /** Text for the current value; `placeholder` shows when it is empty. */
  value: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  hint?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** A FieldBox that opens a picker (day grid, calendar, list) instead of the keyboard. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  error,
  hint,
  icon = 'chevron-down',
  style,
}: SelectFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value || placeholder || ''}`}
      accessibilityHint={error ?? hint}
      style={style}>
      {({ pressed }) => (
        <FieldBox label={label} error={error} hint={hint} focused={pressed}>
          <View style={styles.row}>
            <Text
              variant="body"
              weight="600"
              tone={value ? 'default' : 'muted'}
              numberOfLines={1}
              style={styles.value}>
              {value || placeholder}
            </Text>
            <Icon name={icon} size={18} color={colors.textMuted} />
          </View>
        </FieldBox>
      )}
    </Pressable>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
    value: { flex: 1 },
  });
