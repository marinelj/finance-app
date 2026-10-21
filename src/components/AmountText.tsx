import { useTranslation } from 'react-i18next';
import type { StyleProp, TextStyle } from 'react-native';

import { useMotion } from '@/design/motion';
import { typography, type TypographyVariant } from '@/design/tokens';
import { formatMoney, formatMoneyParts, type CurrencyCode } from '@/domain/money';
import { useCountUp } from '@/hooks/useCountUp';
import { usePreferences } from '@/state/preferences';

import { Text, type TextTone } from './Text';

export type AmountTextProps = {
  value: number;
  currency: CurrencyCode;
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Count up to the value on mount and whenever it changes. */
  animate?: boolean;
  /** 12.35万 / 123.5K. */
  compact?: boolean;
  sign?: 'auto' | 'always' | 'never';
  /** Draw decimals smaller. Defaults to on for hero, display and title sizes. */
  smallFraction?: boolean;
  /** Overrides the global "hide amounts" preference. */
  masked?: boolean;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

const LARGE: TypographyVariant[] = ['hero', 'display', 'title'];

/** Currency-aware amount with optional count-up, compact units and privacy masking. */
export function AmountText({
  value,
  currency,
  variant = 'headline',
  tone = 'default',
  animate = false,
  compact = false,
  sign = 'auto',
  smallFraction,
  masked,
  align,
  numberOfLines = 1,
  style,
}: AmountTextProps) {
  const { t } = useTranslation();
  const { prefs, language } = usePreferences();
  const { reduceMotion } = useMotion();
  const hidden = masked ?? prefs.hideAmounts;
  const shown = useCountUp(value, { enabled: animate && !reduceMotion && !hidden });

  const options = { locale: language, compact, sign };
  const parts = formatMoneyParts(shown, currency, options);
  const label = hidden ? t('a11y.amountHidden') : formatMoney(value, currency, options);
  const shrink = smallFraction ?? LARGE.includes(variant);
  const fractionStyle = shrink
    ? { fontSize: Math.round(typography[variant].fontSize * 0.6) }
    : undefined;

  return (
    <Text
      variant={variant}
      tone={tone}
      align={align}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={numberOfLines === 1}
      minimumFontScale={0.6}
      accessibilityLabel={label}
      style={style}>
      {hidden ? (
        `${parts.symbol}••••`
      ) : (
        <>
          {parts.sign}
          {parts.symbol}
          {parts.integer}
          {parts.fraction ? (
            <Text variant={variant} tone={tone} style={fractionStyle}>
              .{parts.fraction}
            </Text>
          ) : null}
          {parts.suffix}
        </>
      )}
    </Text>
  );
}
