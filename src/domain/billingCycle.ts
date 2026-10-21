import { addDays, clampedDate, parseLocalDate, shiftMonth, type LocalDate } from './dates';

/**
 * Statement and due-date arithmetic for revolving credit (cards, 花呗-style BNPL).
 *
 * Conventions, matching how card issuers describe their products:
 * - The statement (billing) day closes a cycle. A purchase made ON the statement day is part of
 *   that statement; purchases after it roll into the next cycle.
 * - Day numbers above a month's length clamp to its last day, so "31" means "month end".
 * - A fixed due day is the first such day strictly after the statement closes. That puts it in
 *   the same month when the due day is later than the statement day, and in the next month
 *   otherwise (including statement day = due day).
 * - Some issuers instead give a number of days after the statement (交通银行: 25 days).
 */

export type DueRule =
  { type: 'fixed_day'; day: number } | { type: 'days_after_statement'; days: number };

export type BillingCycle = { statementDay: number; dueRule: DueRule };

export type Cycle = { statementDate: LocalDate; dueDate: LocalDate };

type CycleFields = {
  statementDay: number | null;
  dueRule: 'fixed_day' | 'days_after_statement' | null;
  dueDay: number | null;
  dueDaysAfterStatement: number | null;
};

/** Reads a product's cycle settings; null when they are incomplete. */
export function billingCycleOf(fields: CycleFields): BillingCycle | null {
  const { statementDay, dueRule, dueDay, dueDaysAfterStatement } = fields;
  if (statementDay == null || dueRule == null) return null;
  if (dueRule === 'fixed_day') {
    return dueDay == null ? null : { statementDay, dueRule: { type: 'fixed_day', day: dueDay } };
  }
  return dueDaysAfterStatement == null
    ? null
    : { statementDay, dueRule: { type: 'days_after_statement', days: dueDaysAfterStatement } };
}

/** A monthly repayment day (loans) expressed as a cycle whose due date is its statement date. */
export function monthlyRepaymentCycle(repaymentDay: number): BillingCycle {
  return { statementDay: repaymentDay, dueRule: { type: 'days_after_statement', days: 0 } };
}

/** The statement closing date that a purchase made on `date` belongs to. */
export function statementForPurchase(date: LocalDate, statementDay: number): LocalDate {
  const { year, month } = parseLocalDate(date);
  const closeThisMonth = clampedDate(year, month, statementDay);
  if (date <= closeThisMonth) return closeThisMonth;
  const next = shiftMonth(year, month, 1);
  return clampedDate(next.year, next.month, statementDay);
}

/** The most recent statement closing on or before `date`. */
export function latestStatementOnOrBefore(date: LocalDate, statementDay: number): LocalDate {
  const { year, month } = parseLocalDate(date);
  const closeThisMonth = clampedDate(year, month, statementDay);
  if (closeThisMonth <= date) return closeThisMonth;
  const previous = shiftMonth(year, month, -1);
  return clampedDate(previous.year, previous.month, statementDay);
}

/** The statement closing `cycles` cycles away (negative for earlier ones). */
export function shiftStatement(close: LocalDate, statementDay: number, cycles: number): LocalDate {
  const { year, month } = parseLocalDate(close);
  const target = shiftMonth(year, month, cycles);
  return clampedDate(target.year, target.month, statementDay);
}

/** Payment due date for the statement that closes on `close`. */
export function dueDateForStatement(close: LocalDate, rule: DueRule): LocalDate {
  if (rule.type === 'days_after_statement') return addDays(close, rule.days);
  const { year, month } = parseLocalDate(close);
  const sameMonth = clampedDate(year, month, rule.day);
  if (sameMonth > close) return sameMonth;
  const next = shiftMonth(year, month, 1);
  return clampedDate(next.year, next.month, rule.day);
}

export function cycleForStatement(close: LocalDate, billing: BillingCycle): Cycle {
  return { statementDate: close, dueDate: dueDateForStatement(close, billing.dueRule) };
}

/** The cycle a purchase made on `date` is billed in. */
export function cycleForPurchase(date: LocalDate, billing: BillingCycle): Cycle {
  return cycleForStatement(statementForPurchase(date, billing.statementDay), billing);
}

const MAX_CYCLES_BACK = 12;

/**
 * The earliest cycle whose due date is after `paidThrough`, i.e. the payment to make next.
 * It can be overdue (due date before `today`) when an earlier bill was never marked paid; the
 * look-back is capped at a year. With no payment history, everything due before today counts as
 * settled.
 */
export function nextUnpaidCycle(
  today: LocalDate,
  billing: BillingCycle,
  paidThrough: LocalDate | null
): Cycle {
  const settled = paidThrough ?? addDays(today, -1);
  let close = latestStatementOnOrBefore(today, billing.statementDay);

  for (let i = 0; i < MAX_CYCLES_BACK; i++) {
    const earlier = shiftStatement(close, billing.statementDay, -1);
    if (dueDateForStatement(earlier, billing.dueRule) > settled) close = earlier;
    else break;
  }
  for (let i = 0; i < MAX_CYCLES_BACK * 2; i++) {
    const cycle = cycleForStatement(close, billing);
    if (cycle.dueDate > settled) return cycle;
    close = shiftStatement(close, billing.statementDay, 1);
  }
  return cycleForStatement(close, billing);
}

/** `count` consecutive cycles starting with the one that closes on `close`. */
export function cyclesFrom(close: LocalDate, billing: BillingCycle, count: number): Cycle[] {
  return Array.from({ length: count }, (_, i) =>
    cycleForStatement(shiftStatement(close, billing.statementDay, i), billing)
  );
}

/**
 * Where to start the payment history when a product is first added. If the latest statement's
 * payment window is still open and there is a bill to pay, that bill is the next due; otherwise
 * it is treated as settled and the next statement's due date comes next.
 */
export function initialPaidThrough(
  today: LocalDate,
  billing: BillingCycle,
  hasAmountDue: boolean
): LocalDate {
  const close = latestStatementOnOrBefore(today, billing.statementDay);
  const current = cycleForStatement(close, billing);
  if (current.dueDate >= today && hasAmountDue) {
    return dueDateForStatement(shiftStatement(close, billing.statementDay, -1), billing.dueRule);
  }
  return current.dueDate;
}
