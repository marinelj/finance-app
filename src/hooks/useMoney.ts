import { formatMoney, formatPercent, type CurrencyCode } from '@/domain/money';
import { usePreferences } from '@/state/preferences';

/**
 * Formatters for amounts in text (labels, sentences, chart ticks) that respect the language and
 * the "hide amounts" preference. Big standalone amounts use <AmountText> instead.
 */
export function useMoney() {
  const { prefs, language } = usePreferences();
  const hidden = prefs.hideAmounts;
  const home = prefs.homeCurrency;
  return {
    home,
    hidden,
    format: (amount: number, currency: CurrencyCode = home) =>
      hidden ? '••••' : formatMoney(amount, currency, { locale: language }),
    compact: (amount: number, currency: CurrencyCode = home) =>
      hidden ? '••' : formatMoney(amount, currency, { locale: language, compact: true }),
    /** Axis ticks: compact and without minor units ("$400", "$420K", "¥12万"). */
    tick: (amount: number, currency: CurrencyCode = home) =>
      hidden
        ? '••'
        : formatMoney(amount, currency, { locale: language, compact: true, maxDecimals: 0 }),
    percent: (fraction: number, decimals = 0) => formatPercent(fraction, { decimals }),
  };
}
