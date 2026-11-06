import { billingCycleOf, dueDateForStatement, monthlyRepaymentCycle } from './billingCycle';
import { type CreditProduct, type Installment } from './credit';
import type { DueInfo } from './creditStatus';
import {
  addDays,
  clampedDate,
  daysBetween,
  monthKey,
  parseLocalDate,
  shiftMonth,
  type LocalDate,
} from './dates';
import type { CurrencyCode } from './money';

type ScheduledItem = { id: string; name: string; currency: CurrencyCode };
export type CalendarInput = {
  products: CreditProduct[];
  installments: Installment[];
  insurance: (ScheduledItem & {
    premium: number;
    premiumPeriod: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
    renewalDate: string | null;
  })[];
  /** Optional scheduling data: never invent a day when a source has none. */
  incomes?: (ScheduledItem & {
    amount: number;
    period: 'monthly' | 'annual';
    payDay?: number | null;
    payMonth?: number | null;
  })[];
  housing?: (ScheduledItem & { paymentDay?: number | null; amount: number })[];
  bills?: {
    id: string;
    productId: string;
    statementDate: string | null;
    dueDate: string;
    statementBalance: number;
    currency: CurrencyCode;
    receivedAt: string;
  }[];
  today: LocalDate;
  start: LocalDate;
  end: LocalDate;
};
export type CalendarKind =
  'bill' | 'statement' | 'installment' | 'income' | 'housing' | 'insurance';
export type CalendarMarker = 'danger' | 'amber' | 'paid' | 'grey' | 'green' | 'blue' | 'purple';
export type CalendarEvent = {
  id: string;
  itemId: string;
  date: LocalDate;
  name: string;
  kind: CalendarKind;
  currency: CurrencyCode;
  amount: number | null;
  paid: boolean;
  marker: CalendarMarker;
  due: DueInfo | null;
};

/** One event per scheduled occurrence, using calendar dates and clamped month ends throughout. */
export function calendarEvents(input: CalendarInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const inRange = (date: string) => date >= input.start && date <= input.end;
  const add = (event: CalendarEvent) => {
    if (inRange(event.date)) events.push(event);
  };
  const marker = (date: string, paid: boolean): CalendarMarker =>
    paid ? 'paid' : daysBetween(input.today, date) <= 3 ? 'danger' : 'amber';
  const first = parseLocalDate(input.start);
  const last = parseLocalDate(input.end);
  const span = (last.year - first.year) * 12 + last.month - first.month;
  const monthDates = (day: number) =>
    Array.from({ length: span + 1 }, (_, i) => {
      const m = shiftMonth(first.year, first.month, i);
      return clampedDate(m.year, m.month, day);
    });
  const dueEvent = (
    product: CreditProduct,
    date: string,
    amount: number,
    paid: boolean,
    statementDate: string | null,
    installmentId: string | null,
    estimate: boolean
  ): CalendarEvent => ({
    id: `${installmentId ?? product.id}:${installmentId ? 'installment' : 'bill'}:${date}`,
    itemId: product.id,
    date,
    name: product.name,
    kind: installmentId ? 'installment' : 'bill',
    currency: product.currency,
    amount,
    paid,
    marker: marker(date, paid),
    due: {
      dueDate: date,
      statementDate,
      amount,
      daysLeft: daysBetween(input.today, date),
      installmentId,
      amountIsEstimate: estimate,
    },
  });
  for (const product of input.products.filter((p) => p.isActive)) {
    const installments = input.installments.filter((item) => item.productId === product.id);
    for (const item of installments)
      add(dueEvent(product, item.dueDate, item.amount, item.paidAt != null, null, item.id, false));
    const cycle =
      billingCycleOf(product) ??
      (product.repaymentDay ? monthlyRepaymentCycle(product.repaymentDay) : null);
    if (!cycle || (product.kind === 'installment_loan' && installments.length)) continue;
    const byDue = new Map<string, NonNullable<CalendarInput['bills']>[number]>();
    for (const bill of (input.bills ?? [])
      .filter((bill) => bill.productId === product.id)
      .sort(
        (a, b) =>
          (a.statementDate ?? '').localeCompare(b.statementDate ?? '') ||
          a.receivedAt.localeCompare(b.receivedAt) ||
          a.id.localeCompare(b.id)
      ))
      byDue.set(bill.dueDate, bill);
    const actual = [...byDue.values()];
    // Include earlier closing months: a days-after-statement due rule may cross two boundaries.
    for (let i = -3; i <= span; i++) {
      const m = shiftMonth(first.year, first.month, i);
      const close = clampedDate(m.year, m.month, cycle.statementDay);
      if (product.kind !== 'installment_loan')
        add({
          id: `${product.id}:statement:${close}`,
          itemId: product.id,
          date: close,
          name: product.name,
          kind: 'statement',
          currency: product.currency,
          amount: null,
          paid: false,
          marker: 'grey',
          due: null,
        });
      const date = dueDateForStatement(close, cycle.dueRule);
      // The actual email due date overrides the recurring estimate for its billing cycle.
      if (
        actual.some((bill) =>
          bill.statementDate
            ? monthKey(bill.statementDate) === monthKey(close)
            : monthKey(bill.dueDate) === monthKey(date)
        )
      )
        continue;
      add(
        dueEvent(
          product,
          date,
          product.kind === 'installment_loan'
            ? (product.minimumPayment ?? product.balance)
            : (product.statementBalance ?? product.balance),
          product.paidThrough != null && date <= product.paidThrough,
          product.kind === 'installment_loan' ? null : close,
          null,
          product.statementBalance == null
        )
      );
    }
    for (const bill of actual)
      add(
        dueEvent(
          product,
          bill.dueDate,
          bill.statementBalance,
          product.paidThrough != null && bill.dueDate <= product.paidThrough,
          bill.statementDate,
          null,
          false
        )
      );
  }
  const scheduled = (
    item: ScheduledItem,
    date: string,
    amount: number,
    kind: 'income' | 'housing' | 'insurance',
    color: CalendarMarker
  ) =>
    add({
      id: `${item.id}:${kind}:${date}`,
      itemId: item.id,
      date,
      name: item.name,
      kind,
      currency: item.currency,
      amount,
      paid: false,
      marker: color,
      due: null,
    });
  for (const income of input.incomes ?? []) {
    if (income.payDay == null) continue;
    for (const date of monthDates(income.payDay))
      if (income.period === 'monthly' || Number(date.slice(5, 7)) === income.payMonth)
        scheduled(income, date, income.amount, 'income', 'green');
  }
  for (const home of input.housing ?? [])
    if (home.paymentDay != null)
      for (const date of monthDates(home.paymentDay))
        scheduled(home, date, home.amount, 'housing', 'blue');
  for (const policy of input.insurance) {
    if (!policy.renewalDate) continue;
    const anchor = parseLocalDate(policy.renewalDate);
    const period = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[policy.premiumPeriod];
    for (let i = 0; i <= span; i++) {
      const m = shiftMonth(first.year, first.month, i);
      const offset = (m.year - anchor.year) * 12 + m.month - anchor.month;
      if (offset % period === 0)
        scheduled(
          policy,
          clampedDate(m.year, m.month, anchor.day),
          policy.premium,
          'insurance',
          'purple'
        );
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
  );
}

/** Today's agenda falls forward only when today is empty; explicit selections stay selected. */
export function agendaDate(
  events: CalendarEvent[],
  selected: LocalDate,
  today: LocalDate
): LocalDate {
  if (selected !== today || events.some((event) => event.date === today)) return selected;
  return events.find((event) => event.date > today)?.date ?? today;
}

/** A full week-aligned month; the UI follows en's locale and starts zh-Hans on Monday. */
export function monthCells(
  year: number,
  month: number,
  weekStartsOn: number
): (LocalDate | null)[] {
  const start = clampedDate(year, month, 1);
  const dow = new Date(`${start}T00:00:00Z`).getUTCDay();
  const leading = (dow - weekStartsOn + 7) % 7;
  const next = shiftMonth(year, month, 1);
  const end = addDays(clampedDate(next.year, next.month, 1), -1);
  const cells: (LocalDate | null)[] = Array.from({ length: leading }, () => null);
  for (let date = start; date <= end; date = addDays(date, 1)) cells.push(date);
  while (cells.length % 7) cells.push(null);
  return cells;
}
