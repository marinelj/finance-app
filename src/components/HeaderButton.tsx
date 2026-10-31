import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/design/theme';
import { useHover } from '@/hooks/useHover';
import { isWeb } from '@/lib/platform';

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
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      onPress={onPress}
      {...hoverProps}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        hovered && { backgroundColor: colors.primarySoft },
        pressed && styles.pressed,
      ]}>
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
  button: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    // Browsers show a hover tint, so give it some room around the label.
    paddingHorizontal: isWeb ? 10 : 4,
    borderRadius: 18,
  },
  pressed: { opacity: 0.5 },
});
