import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import { typography, type Theme } from '@/design/tokens';

import { Text } from '../Text';
import { FieldBox } from './FieldBox';

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  /** Shown before the value, e.g. a currency symbol. */
  prefix?: string;
  /** Shown after the value, e.g. "%". */
  suffix?: string;
  optional?: boolean;
  optionalLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  /** Passwords and passphrases: hidden, no autocorrect or capitalisation. */
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Text input inside a FieldBox. Numeric fields pass `keyboardType="decimal-pad"`. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  prefix,
  suffix,
  optional,
  optionalLabel,
  keyboardType,
  multiline,
  maxLength,
  autoFocus,
  secure,
  style,
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <FieldBox
      label={label}
      error={error}
      hint={hint}
      focused={focused}
      aside={optional ? optionalLabel : undefined}
      style={style}>
      <View style={styles.row}>
        {prefix ? (
          <Text variant="body" tone="secondary" weight="600">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          autoFocus={autoFocus}
          secureTextEntry={secure}
          autoCapitalize={secure ? 'none' : undefined}
          autoCorrect={secure ? false : undefined}
          textContentType={secure ? 'password' : undefined}
          maxFontSizeMultiplier={2}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: colors.text }, multiline && styles.multiline]}
        />
        {suffix ? (
          <Text variant="body" tone="secondary" weight="600">
            {suffix}
          </Text>
        ) : null}
      </View>
    </FieldBox>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    input: {
      ...typography.body,
      fontWeight: '600',
      flex: 1,
      minHeight: 28,
      paddingVertical: 2,
      paddingHorizontal: 0,
      outlineWidth: 0,
    },
    multiline: { minHeight: 64, textAlignVertical: 'top' },
  });
