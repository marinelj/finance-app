import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';

type ProductEditButtonProps = {
  name: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
};

/** Always visible, with its own hit target; editing must not also open the card. */
export function ProductEditButton({
  name,
  onPress,
  color,
  backgroundColor,
}: ProductEditButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('credit.editProduct', { name })}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgroundColor ?? colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name="pencil-outline" size={20} color={color ?? colors.primaryText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
