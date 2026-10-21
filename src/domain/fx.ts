import { CURRENCY_CODES, type CurrencyCode } from './money';

/**
 * Exchange rates as units of each currency per 1 USD. Storing every currency against one base
 * keeps the table consistent when the home currency changes.
 */
export type FxTable = Partial<Record<CurrencyCode, number>>;

/**
 * Rough starting values so totals work out of the box. They are not live rates: the user is
 * expected to edit them, and the UI says so.
 */
export const DEFAULT_FX: Record<CurrencyCode, number> = {
  USD: 1,
  CNY: 7.1,
  HKD: 7.78,
  EUR: 0.86,
  GBP: 0.75,
  JPY: 150,
  SGD: 1.3,
  AUD: 1.52,
  CAD: 1.38,
};

function unitsPerUsd(table: FxTable, currency: CurrencyCode): number {
  const value = table[currency];
  return value != null && value > 0 ? value : DEFAULT_FX[currency];
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  table: FxTable
): number {
  if (from === to) return amount;
  return (amount / unitsPerUsd(table, from)) * unitsPerUsd(table, to);
}

/** How many `quote` one unit of `base` buys (1 USD = 7.1 CNY → rate(USD, CNY) = 7.1). */
export function rate(base: CurrencyCode, quote: CurrencyCode, table: FxTable): number {
  return convert(1, base, quote, table);
}

/**
 * Sets "1 `currency` = `homePerUnit` `home`" and returns the updated table, keeping the home
 * currency's own entry unchanged.
 */
export function withRateToHome(
  table: FxTable,
  currency: CurrencyCode,
  home: CurrencyCode,
  homePerUnit: number
): FxTable {
  if (currency === home || !(homePerUnit > 0)) return table;
  return { ...table, [currency]: unitsPerUsd(table, home) / homePerUnit };
}

/** Every supported currency's rate, filled with defaults where the user has not set one. */
export function completeTable(table: FxTable): Record<CurrencyCode, number> {
  return Object.fromEntries(
    CURRENCY_CODES.map((code) => [code, unitsPerUsd(table, code)])
  ) as Record<CurrencyCode, number>;
}
