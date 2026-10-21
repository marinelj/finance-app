import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTheme } from '@/design/theme';
import {
  maxFontScale,
  typography,
  type ThemeColors,
  type TypographyVariant,
} from '@/design/tokens';

export type TextTone =
  'default' | 'secondary' | 'muted' | 'primary' | 'onPrimary' | 'good' | 'caution' | 'danger';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  /** Equal-width digits, for numbers that line up in columns. */
  tabular?: boolean;
};

export function toneColor(colors: ThemeColors, tone: TextTone): string {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'muted':
      return colors.textMuted;
    case 'primary':
      return colors.primaryText;
    case 'onPrimary':
      return colors.textOnPrimary;
    case 'good':
      return colors.status.good.text;
    case 'caution':
      return colors.status.caution.text;
    case 'danger':
      return colors.status.danger.text;
    default:
      return colors.text;
  }
}

/** All text in the app goes through this component so type scale and font scaling stay consistent. */
export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      style={[
        typography[variant],
        { color: toneColor(colors, tone) },
        weight !== undefined && { fontWeight: weight },
        align !== undefined && { textAlign: align },
        tabular && styles.tabular,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
});
