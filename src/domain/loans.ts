import { addMonths, parseLocalDate, type LocalDate } from './dates';
import type { RepaymentMethod } from './credit';
import { roundMoney, type CurrencyCode } from './money';

export type ScheduleInput = {
  principal: number;
  /** Annual rate in percent (10.95 for 0.03% per day). */
  aprPercent: number;
  startDate: LocalDate;
  termMonths: number;
  /** Day of month repayments fall on; defaults to the day the loan started. */
  repaymentDay?: number | null;
  method: RepaymentMethod;
  currency: CurrencyCode;
};

export type ScheduledInstallment = {
  seq: number;
  dueDate: LocalDate;
  principal: number;
  interest: number;
  amount: number;
  /** Principal still owed after this payment. */
  remaining: number;
};

/**
 * Builds a repayment schedule:
 * - `equal_installment` (等额本息): the same payment every month.
 * - `equal_principal` (等额本金): the same principal every month, interest on what is left.
 * - `interest_first` (先息后本): interest only, principal repaid with the last payment.
 *
 * Interest uses the monthly rate (APR / 12) on the remaining principal. Lenders that charge by
 * the day (借呗, 网商贷) differ by a few cents a month; installments stay editable. Each amount is
 * rounded to the currency's minor unit and the last payment absorbs the rounding.
 */
export function generateSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const { principal, aprPercent, startDate, termMonths, method, currency } = input;
  if (!(principal > 0) || !(termMonths >= 1)) return [];

  const n = Math.floor(termMonths);
  const r = Math.max(0, aprPercent) / 100 / 12;
  const day = input.repaymentDay ?? parseLocalDate(startDate).day;
  const money = (value: number) => roundMoney(value, currency);
  const level = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);

  const schedule: ScheduledInstallment[] = [];
  let remaining = principal;
  for (let seq = 1; seq <= n; seq++) {
    const last = seq === n;
    const interest = money(remaining * r);
    let principalPart: number;
    if (last) principalPart = money(remaining);
    else if (method === 'equal_installment') principalPart = money(money(level) - interest);
    else if (method === 'equal_principal') principalPart = money(principal / n);
    else principalPart = 0;

    remaining = money(remaining - principalPart);
    schedule.push({
      seq,
      dueDate: addMonths(startDate, seq, day),
      principal: principalPart,
      interest,
      amount: money(principalPart + interest),
      remaining,
    });
  }
  return schedule;
}

export function totalInterest(schedule: ScheduledInstallment[]): number {
  return schedule.reduce((sum, item) => sum + item.interest, 0);
}

/**
 * Interest for borrowing `amount` for `days` at a daily rate in percent — how 借呗 and 网商贷
 * charge: from the day you borrow, with no interest-free period.
 */
export function dailyInterestCost(amount: number, dailyRatePercent: number, days: number): number {
  return amount * (dailyRatePercent / 100) * Math.max(0, days);
}
