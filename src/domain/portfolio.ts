import { annualCouponIncome, bondMarketValue, yieldToMaturity, type Bond } from './bonds';
import {
  monthlyEquivalent,
  monthlyHousingCost,
  type ExpenseCategory,
  type HousingKind,
  type IncomePeriod,
  type InsuranceType,
  type PremiumPeriod,
} from './cashflow';
import type { LocalDate } from './dates';
import { convert, type FxTable } from './fx';
import type { CurrencyCode } from './money';
import {
  annualDividendIncome,
  stockMarketValue,
  type AssetClass,
  type StockHolding,
} from './stocks';

/**
 * Portfolio inputs as plain data (database rows satisfy these types) and their totals in the
 * home currency. Monthly figures are per month; balances and values are as of today.
 */

export type IncomeInput = { amount: number; period: IncomePeriod; currency: CurrencyCode };

export type HousingInput = {
  kind: HousingKind;
  currency: CurrencyCode;
  monthlyRent: number | null;
  balance: number | null;
  ratePercent: number | null;
  remainingMonths: number | null;
  monthlyPayment: number | null;
  propertyValue: number | null;
};

export type InsuranceInput = {
  type: InsuranceType;
  premium: number;
  premiumPeriod: PremiumPeriod;
  coverage: number | null;
  currency: CurrencyCode;
};

export type ExpenseInput = {
  category: ExpenseCategory;
  amount: number;
  essential: boolean;
  currency: CurrencyCode;
};

export type CashInput = {
  balance: number;
  isEmergencyFund: boolean;
  ratePercent: number | null;
  currency: CurrencyCode;
};

export type BondInput = Omit<Bond, 'couponFrequency'> & {
  couponFrequency: number;
  purchaseDate: LocalDate | null;
  purchasePrice: number | null;
  currentPrice: number | null;
};

export type StockInput = Omit<
  StockHolding,
  'dividendFrequency' | 'costBasis' | 'dividendPerShare'
> & {
  dividendFrequency: number;
  costBasis: number | null;
  dividendPerShare: number | null;
  assetClass: AssetClass;
};

export type PortfolioInputs = {
  incomes: IncomeInput[];
  housing: HousingInput[];
  insurance: InsuranceInput[];
  expenses: ExpenseInput[];
  cash: CashInput[];
  bonds: BondInput[];
  stocks: StockInput[];
};

/** Bonds are valued at the current price, else the price paid, else par. */
export function bondPrice(bond: BondInput): number {
  return bond.currentPrice ?? bond.purchasePrice ?? 100;
}

export type BondYields = {
  /** Locked in at purchase: the yield if held to maturity from the purchase date and price. */
  atPurchase: number | null;
  /** At today's price, when one is entered. */
  atCurrentPrice: number | null;
};

export function bondYields(bond: BondInput, today: LocalDate): BondYields {
  const plain = asBond(bond);
  const atPurchase =
    bond.purchasePrice != null
      ? yieldToMaturity(plain, bond.purchaseDate ?? today, bond.purchasePrice)
      : null;
  const atCurrentPrice =
    bond.currentPrice != null ? yieldToMaturity(plain, today, bond.currentPrice) : null;
  return { atPurchase, atCurrentPrice };
}

export function asBond(bond: BondInput): Bond {
  const frequency = [0, 1, 2, 4, 12].includes(bond.couponFrequency) ? bond.couponFrequency : 2;
  return { ...bond, couponFrequency: frequency as Bond['couponFrequency'] };
}

export function asStock(stock: StockInput): StockHolding {
  const frequency = [0, 1, 2, 4, 12].includes(stock.dividendFrequency)
    ? stock.dividendFrequency
    : 0;
  return {
    ...stock,
    costBasis: stock.costBasis ?? 0,
    dividendPerShare: stock.dividendPerShare ?? 0,
    dividendFrequency: frequency as StockHolding['dividendFrequency'],
  };
}

export type InputsOverview = {
  /** Monthly, home currency. */
  income: number;
  housing: number;
  insurance: number;
  expenses: number;
  essentialExpenses: number;
  /** Balances and market values, home currency. */
  cash: number;
  emergencyFund: number;
  bonds: number;
  stocks: number;
  property: number;
  mortgage: number;
  /** Per year, home currency. */
  coupons: number;
  dividends: number;
};

export function summarizeInputs(
  inputs: PortfolioInputs,
  today: LocalDate,
  home: CurrencyCode,
  fx: FxTable
): InputsOverview {
  const toHome = (amount: number, currency: CurrencyCode) => convert(amount, currency, home, fx);
  const sum = <T>(items: T[], value: (item: T) => number) =>
    items.reduce((total, item) => total + value(item), 0);

  return {
    income: sum(inputs.incomes, (item) =>
      toHome(monthlyEquivalent(item.amount, item.period), item.currency)
    ),
    housing: sum(inputs.housing, (item) => toHome(monthlyHousingCost(item), item.currency)),
    insurance: sum(inputs.insurance, (item) =>
      toHome(monthlyEquivalent(item.premium, item.premiumPeriod), item.currency)
    ),
    expenses: sum(inputs.expenses, (item) => toHome(item.amount, item.currency)),
    essentialExpenses: sum(
      inputs.expenses.filter((item) => item.essential),
      (item) => toHome(item.amount, item.currency)
    ),
    cash: sum(inputs.cash, (item) => toHome(item.balance, item.currency)),
    emergencyFund: sum(
      inputs.cash.filter((item) => item.isEmergencyFund),
      (item) => toHome(item.balance, item.currency)
    ),
    bonds: sum(inputs.bonds, (item) =>
      toHome(bondMarketValue(asBond(item), bondPrice(item), today), item.currency)
    ),
    stocks: sum(inputs.stocks, (item) => toHome(stockMarketValue(asStock(item)), item.currency)),
    property: sum(inputs.housing, (item) =>
      item.kind === 'rent' ? 0 : toHome(item.propertyValue ?? 0, item.currency)
    ),
    mortgage: sum(inputs.housing, (item) =>
      item.kind === 'mortgage' ? toHome(item.balance ?? 0, item.currency) : 0
    ),
    coupons: sum(inputs.bonds, (item) => toHome(annualCouponIncome(asBond(item)), item.currency)),
    dividends: sum(inputs.stocks, (item) =>
      toHome(annualDividendIncome(asStock(item)), item.currency)
    ),
  };
}
