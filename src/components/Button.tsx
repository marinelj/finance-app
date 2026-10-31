import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { useHover } from '@/hooks/useHover';
import type { HapticKind } from '@/lib/haptics';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticKind | false;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = { sm: 36, md: 48, lg: 56 };

function colorsFor(theme: Theme, variant: Variant) {
  const { colors } = theme;
  switch (variant) {
    case 'secondary':
      return {
        background: colors.primarySoft,
        hover: colors.primarySoftHover,
        foreground: colors.primaryText,
      };
    case 'ghost':
      return {
        background: 'transparent',
        hover: colors.primarySoft,
        foreground: colors.primaryText,
      };
    case 'danger':
      return {
        background: colors.status.danger.soft,
        hover: colors.status.danger.softHover,
        foreground: colors.status.danger.text,
      };
    case 'dark':
      return { background: colors.text, hover: colors.textSecondary, foreground: colors.surface };
    default:
      return {
        background: colors.primary,
        hover: colors.primaryPressed,
        foreground: colors.textOnPrimary,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = 'light',
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { background, hover, foreground } = colorsFor(theme, variant);
  const inactive = disabled || loading;
  const { hovered, hoverProps } = useHover();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      haptic={haptic}
      onPress={onPress}
      {...hoverProps}
      hitSlop={size === 'sm' ? 6 : 0}
      style={[
        styles.base,
        { minHeight: HEIGHT[size], backgroundColor: hovered && !inactive ? hover : background },
        size === 'sm' ? styles.small : styles.regular,
        fullWidth && styles.fullWidth,
        inactive && !loading && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={foreground} /> : null}
          <Text
            variant={size === 'sm' ? 'caption' : 'headline'}
            weight="700"
            numberOfLines={1}
            style={{ color: foreground }}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    regular: { paddingHorizontal: space.xxl },
    small: { paddingHorizontal: space.lg },
    fullWidth: { alignSelf: 'stretch' },
    disabled: { opacity: 0.4 },
    content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  });
