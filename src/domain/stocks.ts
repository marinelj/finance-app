import { roundMoney, type CurrencyCode } from './money';

/** Stocks, ETFs and funds entered by hand (no price feed). */

export const DIVIDEND_FREQUENCIES = [0, 1, 2, 4, 12] as const;
/** Dividend payments per year; 0 means the holding pays none. */
export type DividendFrequency = (typeof DIVIDEND_FREQUENCIES)[number];

export const ASSET_CLASSES = [
  'domestic_equity',
  'international_equity',
  'bonds',
  'cash',
  'other',
] as const;
/** The buckets the planner allocates across. */
export type AssetClass = (typeof ASSET_CLASSES)[number];

export type StockHolding = {
  shares: number;
  /** Total paid for the position, in the holding's currency. */
  costBasis: number;
  /** Latest price per share, entered by hand. */
  price: number;
  /** Paid per share on each dividend date. */
  dividendPerShare: number;
  dividendFrequency: DividendFrequency;
  /** Month (1–12) of the first payment in a calendar year, for the income calendar. */
  firstPayMonth: number | null;
  currency: CurrencyCode;
};

export function stockMarketValue(holding: StockHolding): number {
  return roundMoney(holding.shares * holding.price, holding.currency);
}

export function unrealizedGain(holding: StockHolding): number {
  return roundMoney(stockMarketValue(holding) - holding.costBasis, holding.currency);
}

/** Return on cost as a fraction (0.12 = +12%); null without a cost basis. */
export function unrealizedReturn(holding: StockHolding): number | null {
  return holding.costBasis > 0 ? unrealizedGain(holding) / holding.costBasis : null;
}

/** Yearly dividend per share. */
export function annualDividendPerShare(holding: StockHolding): number {
  return holding.dividendPerShare * holding.dividendFrequency;
}

/** Dividend income per year from the whole position. */
export function annualDividendIncome(holding: StockHolding): number {
  return roundMoney(annualDividendPerShare(holding) * holding.shares, holding.currency);
}

/** Yearly dividend per share over today's price, as a fraction. */
export function dividendYield(holding: StockHolding): number | null {
  return holding.price > 0 ? annualDividendPerShare(holding) / holding.price : null;
}

/** Yearly dividend income over what was paid for the position, as a fraction. */
export function yieldOnCost(holding: StockHolding): number | null {
  return holding.costBasis > 0 ? annualDividendIncome(holding) / holding.costBasis : null;
}

/**
 * The calendar months dividends arrive in: evenly spaced from the first payment month
 * (quarterly from February → Feb, May, Aug, Nov). Without a known first month, payments are
 * assumed to fall at the end of each period (quarterly → Mar, Jun, Sep, Dec).
 */
export function dividendMonths(
  frequency: DividendFrequency,
  firstPayMonth: number | null
): number[] {
  if (frequency === 0) return [];
  const step = 12 / frequency;
  const first =
    firstPayMonth != null && firstPayMonth >= 1 && firstPayMonth <= 12
      ? ((firstPayMonth - 1) % step) + 1
      : step;
  return Array.from({ length: frequency }, (_, i) => first + i * step);
}
