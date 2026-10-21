import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/design/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type HeaderButtonProps = {
  label: string;
  onPress: () => void;
  /** Icon-only buttons still get `label` as their accessible name. */
  icon?: IconName;
  bold?: boolean;
};

/** Text or icon button for native stack headers. */
export function HeaderButton({ label, onPress, icon, bold }: HeaderButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      {icon ? (
        <Icon name={icon} size={22} color={colors.primaryText} />
      ) : (
        <Text
          variant="body"
          weight={bold ? '700' : '500'}
          tone="primary"
          maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 36, minWidth: 36, justifyContent: 'center', paddingHorizontal: 4 },
  pressed: { opacity: 0.5 },
});
