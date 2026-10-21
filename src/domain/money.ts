/**
 * Money helpers. Amounts are plain numbers in major units (yuan, dollars), rounded to the
 * currency's minor unit when stored. Formatting is done by hand instead of `Intl` so the output
 * is identical in Jest (Node ICU) and on device (Hermes), and so Chinese compact units (万 / 亿)
 * work everywhere.
 */

export const CURRENCY_CODES = [
  'CNY',
  'USD',
  'HKD',
  'EUR',
  'GBP',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

type CurrencyInfo = { symbol: string; decimals: number };

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  CNY: { symbol: '¥', decimals: 2 },
  USD: { symbol: '$', decimals: 2 },
  HKD: { symbol: 'HK$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  GBP: { symbol: '£', decimals: 2 },
  JPY: { symbol: 'JP¥', decimals: 0 },
  SGD: { symbol: 'S$', decimals: 2 },
  AUD: { symbol: 'A$', decimals: 2 },
  CAD: { symbol: 'C$', decimals: 2 },
};

export type NumberLocale = 'en' | 'zh-Hans';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Rounds half away from zero, robust to binary artefacts such as 1.005 * 100 = 100.4999…. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.round(scaled * (1 + Number.EPSILON)) / factor;
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

export function roundMoney(amount: number, currency: CurrencyCode): number {
  return roundTo(amount, CURRENCIES[currency].decimals);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function trimTrailingZeros(fraction: string): string {
  return fraction.replace(/0+$/, '');
}

export type MoneyFormatOptions = {
  locale?: NumberLocale;
  /** 12.35万 / 123.5K style. */
  compact?: boolean;
  /** `auto` shows "-" only; `always` also shows "+" for positive amounts. */
  sign?: 'auto' | 'always' | 'never';
  symbol?: boolean;
};

export type MoneyParts = {
  sign: '' | '-' | '+';
  symbol: string;
  integer: string;
  fraction: string;
  suffix: string;
};

type CompactUnit = { value: number; suffix: string; decimals: number };

const COMPACT_UNITS: Record<NumberLocale, CompactUnit[]> = {
  'zh-Hans': [
    { value: 1e8, suffix: '亿', decimals: 2 },
    { value: 1e4, suffix: '万', decimals: 2 },
  ],
  en: [
    { value: 1e9, suffix: 'B', decimals: 1 },
    { value: 1e6, suffix: 'M', decimals: 1 },
    { value: 1e3, suffix: 'K', decimals: 1 },
  ],
};

export function formatMoneyParts(
  amount: number,
  currency: CurrencyCode,
  options: MoneyFormatOptions = {}
): MoneyParts {
  const { locale = 'en', compact = false, sign = 'auto', symbol = true } = options;
  const info = CURRENCIES[currency];
  const safe = Number.isFinite(amount) ? amount : 0;

  let magnitude = Math.abs(safe);
  let decimals = info.decimals;
  let suffix = '';
  let trim = false;
  if (compact) {
    const unit = COMPACT_UNITS[locale].find((u) => magnitude >= u.value);
    if (unit) {
      magnitude /= unit.value;
      decimals = unit.decimals;
      suffix = unit.suffix;
      trim = true;
    }
  }

  const rounded = roundTo(magnitude, decimals);
  const [intPart, fracPart = ''] = rounded.toFixed(decimals).split('.');
  const fraction = trim ? trimTrailingZeros(fracPart) : fracPart;
  const isZero = rounded === 0;

  let signChar: MoneyParts['sign'] = '';
  if (!isZero && sign !== 'never') {
    if (safe < 0) signChar = '-';
    else if (sign === 'always') signChar = '+';
  }

  return {
    sign: signChar,
    symbol: symbol ? info.symbol : '',
    integer: groupThousands(intPart),
    fraction,
    suffix,
  };
}

export function joinMoneyParts(parts: MoneyParts): string {
  const fraction = parts.fraction ? `.${parts.fraction}` : '';
  return `${parts.sign}${parts.symbol}${parts.integer}${fraction}${parts.suffix}`;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options: MoneyFormatOptions = {}
): string {
  return joinMoneyParts(formatMoneyParts(amount, currency, options));
}

/** `0.1234` → `"12.3%"`. */
export function formatPercent(
  fraction: number,
  options: { decimals?: number; sign?: 'auto' | 'always' } = {}
): string {
  const { decimals = 1, sign = 'auto' } = options;
  const value = roundTo(fraction * 100, decimals);
  const body = Math.abs(value).toFixed(decimals);
  if (value < 0) return `-${body}%`;
  if (value > 0 && sign === 'always') return `+${body}%`;
  return `${body}%`;
}
