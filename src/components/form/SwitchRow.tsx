import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { haptics } from '@/lib/haptics';

import { Text } from '../Text';

type SwitchRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A labelled switch with an optional one-line explanation. */
export function SwitchRow({ label, hint, value, onChange, disabled }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="body" weight="600">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          haptics.selection();
          onChange(next);
        }}
        trackColor={{ false: colors.hairline, true: colors.primary }}
        ios_backgroundColor={colors.hairline}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  text: { flex: 1, gap: 2 },
});
