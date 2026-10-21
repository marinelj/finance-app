/**
 * Recurring money in and out, normalised to a monthly amount so everything can be added up.
 */

export const INCOME_KINDS = ['salary', 'bonus', 'side', 'rental', 'pension', 'other'] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export const INCOME_PERIODS = ['monthly', 'annual'] as const;
export type IncomePeriod = (typeof INCOME_PERIODS)[number];

export const PREMIUM_PERIODS = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export type PremiumPeriod = (typeof PREMIUM_PERIODS)[number];

export const HOUSING_KINDS = ['mortgage', 'rent', 'owned'] as const;
export type HousingKind = (typeof HOUSING_KINDS)[number];

export const INSURANCE_TYPES = [
  'health',
  'life',
  'critical_illness',
  'property',
  'accident',
  'other',
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'utilities',
  'phone_internet',
  'education',
  'healthcare',
  'childcare',
  'family',
  'entertainment',
  'shopping',
  'travel',
  'subscriptions',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories counted as essential by default (they set the emergency-fund target). */
export const ESSENTIAL_CATEGORIES: readonly ExpenseCategory[] = [
  'food',
  'transport',
  'utilities',
  'phone_internet',
  'education',
  'healthcare',
  'childcare',
  'family',
];

export const CASH_KINDS = ['checking', 'savings', 'money_market', 'time_deposit', 'other'] as const;
export type CashKind = (typeof CASH_KINDS)[number];

const MONTHS_PER_PERIOD: Record<IncomePeriod | PremiumPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** The monthly equivalent of an amount paid or received once per `period`. */
export function monthlyEquivalent(amount: number, period: IncomePeriod | PremiumPeriod): number {
  return amount / MONTHS_PER_PERIOD[period];
}

/**
 * Level monthly payment that repays `balance` over `months` at an annual rate in percent
 * (the usual mortgage formula). Zero rate spreads the balance evenly.
 */
export function amortizedPayment(
  balance: number,
  annualRatePercent: number,
  months: number
): number {
  if (!(balance > 0) || !(months >= 1)) return 0;
  const r = Math.max(0, annualRatePercent) / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - (1 + r) ** -months);
}

export type HousingCost = {
  kind: HousingKind;
  monthlyPayment: number | null;
  monthlyRent: number | null;
  balance: number | null;
  ratePercent: number | null;
  remainingMonths: number | null;
};

/**
 * What a home costs each month: the rent, the mortgage payment as entered, or one estimated from
 * the balance, rate and remaining term when the payment was left empty.
 */
export function monthlyHousingCost(home: HousingCost): number {
  if (home.kind === 'rent') return Math.max(0, home.monthlyRent ?? 0);
  if (home.kind === 'owned') return 0;
  if (home.monthlyPayment != null && home.monthlyPayment > 0) return home.monthlyPayment;
  if (home.balance != null && home.remainingMonths != null) {
    return amortizedPayment(home.balance, home.ratePercent ?? 0, home.remainingMonths);
  }
  return 0;
}
