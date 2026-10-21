import { billingCycleOf, cycleForPurchase } from './billingCycle';
import { aprPercent, dailyRatePercent, type CreditProduct } from './credit';
import { addDays, daysBetween, type LocalDate } from './dates';
import { convert, type FxTable } from './fx';
import { dateFlags, type DateFlags } from './holidays';
import { dailyInterestCost } from './loans';
import { roundMoney, type CurrencyCode } from './money';

/**
 * "Which card gives me the longest payment days?"
 *
 * A purchase on a card (or 花呗-style BNPL) with an interest-free grace period is billed on the
 * statement that closes on or after the purchase date; purchases after the statement day roll
 * into the next cycle. The interest-free float is the number of days from the purchase to that
 * statement's due date.
 *
 * Loans such as 借呗 and 网商贷 charge daily interest from the day you borrow, so they are never
 * ranked here; `interestCosts` shows what they actually cost instead.
 *
 * All dates are calendar dates in the device's time zone (see dates.ts).
 */

/** An amount the user is about to spend, in any currency. */
export type Spend = { amount: number; currency: CurrencyCode };

/** Whether the remaining limit can take the spend. */
export type LimitCheck = 'ok' | 'tight' | 'insufficient' | 'unknown';

/** Spending more than this share of what is left on a card is flagged as tight. */
export const TIGHT_LIMIT_SHARE = 0.9;

export type FloatOption = {
  productId: string;
  purchaseDate: LocalDate;
  statementDate: LocalDate;
  dueDate: LocalDate;
  /** Interest-free days: due date minus purchase date. */
  floatDays: number;
  /** Weekend or bank holiday on the due date. Flagged only; the due date is never moved. */
  dueFlags: DateFlags;
  /** Credit left in the product's currency; null when no limit is recorded. */
  available: number | null;
  /** The spend converted into the product's currency; null without a spend. */
  spendInCurrency: number | null;
  limit: LimitCheck;
};

/** Active products with a grace period and a complete statement cycle. */
export function isFloatEligible(product: CreditProduct): boolean {
  return (
    product.isActive &&
    product.hasGracePeriod &&
    product.kind !== 'installment_loan' &&
    billingCycleOf(product) != null
  );
}

export function availableCredit(product: CreditProduct): number | null {
  if (!(product.creditLimit > 0)) return null;
  return Math.max(0, product.creditLimit - Math.max(0, product.balance));
}

export function checkLimit(available: number | null, spend: number | null): LimitCheck {
  if (spend == null || spend <= 0) return 'ok';
  if (available == null) return 'unknown';
  if (spend > available) return 'insufficient';
  if (spend > available * TIGHT_LIMIT_SHARE) return 'tight';
  return 'ok';
}

/** The float a purchase on `date` gets on `product`; null when the product has no free float. */
export function floatForPurchase(
  product: CreditProduct,
  date: LocalDate,
  spend: Spend | null = null,
  fx: FxTable = {}
): FloatOption | null {
  const billing = billingCycleOf(product);
  if (!billing || !isFloatEligible(product)) return null;
  const { statementDate, dueDate } = cycleForPurchase(date, billing);
  const available = availableCredit(product);
  const spendInCurrency =
    spend && spend.amount > 0
      ? roundMoney(convert(spend.amount, spend.currency, product.currency, fx), product.currency)
      : null;
  return {
    productId: product.id,
    purchaseDate: date,
    statementDate,
    dueDate,
    floatDays: daysBetween(date, dueDate),
    dueFlags: dateFlags(dueDate, product.currency),
    available,
    spendInCurrency,
    limit: checkLimit(available, spendInCurrency),
  };
}

export type FloatRanking = {
  /** Longest float first; ties go to the card with more credit left, then input order. */
  ranked: FloatOption[];
  /** Cards whose remaining limit cannot take the spend. */
  excluded: FloatOption[];
};

export function rankByFloat(
  products: CreditProduct[],
  date: LocalDate,
  spend: Spend | null = null,
  fx: FxTable = {}
): FloatRanking {
  const options = products
    .map((product) => floatForPurchase(product, date, spend, fx))
    .filter((option): option is FloatOption => option != null);
  const order = (a: FloatOption, b: FloatOption) =>
    b.floatDays - a.floatDays || (b.available ?? -1) - (a.available ?? -1);
  return {
    ranked: options.filter((option) => option.limit !== 'insufficient').sort(order),
    excluded: options.filter((option) => option.limit === 'insufficient').sort(order),
  };
}

export type CalendarDay = {
  date: LocalDate;
  /** The card with the longest float for a purchase on this day, if any can take it. */
  best: FloatOption | null;
  ranked: FloatOption[];
};

/**
 * For each of the next `days` days, which card gives the longest float. Remaining limits are
 * today's; future purchases and payments are not projected.
 */
export function floatCalendar(
  products: CreditProduct[],
  start: LocalDate,
  days = 30,
  spend: Spend | null = null,
  fx: FxTable = {}
): CalendarDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const { ranked } = rankByFloat(products, date, spend, fx);
    return { date, best: ranked[0] ?? null, ranked };
  });
}

export type InterestCost = {
  productId: string;
  aprPercent: number;
  dailyRatePercent: number;
  /** Interest the current balance costs per day, in the product's currency. */
  dailyCostOfBalance: number;
  /** Interest on the spend if borrowed here for `days` days, in the product's currency. */
  costOfSpend: number | null;
};

/** Products that charge interest from the day you borrow (no grace period) and have a rate. */
export function chargesInterestFromDayOne(product: CreditProduct): boolean {
  return (
    product.isActive &&
    !product.hasGracePeriod &&
    product.interestRate != null &&
    product.interestRateUnit != null
  );
}

/**
 * What borrowing actually costs on products without an interest-free period, highest rate
 * first: the order to repay them in (paying the highest-rate debt first saves the most).
 */
export function interestCosts(
  products: CreditProduct[],
  spend: Spend | null = null,
  days = 30,
  fx: FxTable = {}
): InterestCost[] {
  return products
    .filter(chargesInterestFromDayOne)
    .map((product) => {
      const daily = dailyRatePercent(product.interestRate, product.interestRateUnit) ?? 0;
      const amount =
        spend && spend.amount > 0
          ? convert(spend.amount, spend.currency, product.currency, fx)
          : null;
      return {
        productId: product.id,
        aprPercent: aprPercent(product.interestRate, product.interestRateUnit) ?? 0,
        dailyRatePercent: daily,
        dailyCostOfBalance: roundMoney(
          dailyInterestCost(Math.max(0, product.balance), daily, 1),
          product.currency
        ),
        costOfSpend:
          amount == null
            ? null
            : roundMoney(dailyInterestCost(amount, daily, days), product.currency),
      };
    })
    .sort((a, b) => b.aprPercent - a.aprPercent);
}
