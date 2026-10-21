import {
  billingCycleOf,
  cyclesFrom,
  monthlyRepaymentCycle,
  nextUnpaidCycle,
  type BillingCycle,
} from './billingCycle';
import { isRevolving, type CreditProduct, type Installment } from './credit';
import { daysBetween, monthKey, type LocalDate } from './dates';
import { convert, type FxTable } from './fx';
import type { CurrencyCode } from './money';

export type DueInfo = {
  dueDate: LocalDate;
  /** Negative when overdue. */
  daysLeft: number;
  /** Statement the payment belongs to; null for loan installments. */
  statementDate: LocalDate | null;
  /** In the product's currency. */
  amount: number;
  /** True when the bill amount is not known yet and the balance stands in for it. */
  amountIsEstimate: boolean;
  installmentId: string | null;
};

export type ProductStatus<P extends CreditProduct = CreditProduct> = {
  product: P;
  due: DueInfo | null;
  /** Share of the credit limit in use, 0–1+; null without a limit. */
  utilization: number | null;
  available: number | null;
};

function cycleFor(product: CreditProduct): BillingCycle | null {
  const repayment =
    product.repaymentDay != null ? monthlyRepaymentCycle(product.repaymentDay) : null;
  if (product.kind === 'installment_loan') return repayment;
  return billingCycleOf(product) ?? repayment;
}

function unpaidInstallments(productId: string, installments: Installment[]): Installment[] {
  return installments
    .filter((item) => item.productId === productId && item.paidAt == null)
    .sort((a, b) => (a.dueDate === b.dueDate ? a.seq - b.seq : a.dueDate < b.dueDate ? -1 : 1));
}

export function owesSomething(product: CreditProduct): boolean {
  return product.balance > 0 || (product.statementBalance ?? 0) > 0;
}

/** The next payment to make on a product, or null when nothing is owed or no schedule is set. */
export function nextDue(
  product: CreditProduct,
  installments: Installment[],
  today: LocalDate
): DueInfo | null {
  if (!product.isActive) return null;

  const [installment] = unpaidInstallments(product.id, installments);
  if (installment) {
    return {
      dueDate: installment.dueDate,
      daysLeft: daysBetween(today, installment.dueDate),
      statementDate: null,
      amount: installment.amount,
      amountIsEstimate: false,
      installmentId: installment.id,
    };
  }

  if (!owesSomething(product)) return null;
  const cycle = cycleFor(product);
  if (!cycle) return null;
  const next = nextUnpaidCycle(today, cycle, product.paidThrough);
  const isLoan = product.kind === 'installment_loan';

  let amount: number;
  let amountIsEstimate: boolean;
  if (isLoan) {
    amount = product.minimumPayment ?? product.statementBalance ?? product.balance;
    amountIsEstimate = product.minimumPayment == null && product.statementBalance == null;
  } else if ((product.statementBalance ?? 0) > 0) {
    amount = product.statementBalance ?? 0;
    amountIsEstimate = false;
  } else {
    amount = product.balance;
    amountIsEstimate = true;
  }

  return {
    dueDate: next.dueDate,
    daysLeft: daysBetween(today, next.dueDate),
    statementDate: isLoan ? null : next.statementDate,
    amount,
    amountIsEstimate,
    installmentId: null,
  };
}

/** The next `count` due dates of a product, for scheduling reminders. */
export function upcomingDueDates(
  product: CreditProduct,
  installments: Installment[],
  today: LocalDate,
  count = 2
): LocalDate[] {
  if (!product.isActive) return [];
  const unpaid = unpaidInstallments(product.id, installments);
  if (unpaid.length > 0) return unpaid.slice(0, count).map((item) => item.dueDate);
  if (!owesSomething(product)) return [];
  const cycle = cycleFor(product);
  if (!cycle) return [];
  const next = nextUnpaidCycle(today, cycle, product.paidThrough);
  return cyclesFrom(next.statementDate, cycle, count).map((item) => item.dueDate);
}

export function productStatus<P extends CreditProduct>(
  product: P,
  installments: Installment[],
  today: LocalDate
): ProductStatus<P> {
  const hasLimit = product.creditLimit > 0;
  return {
    product,
    due: nextDue(product, installments, today),
    utilization: hasLimit ? Math.max(0, product.balance) / product.creditLimit : null,
    available: hasLimit ? Math.max(0, product.creditLimit - product.balance) : null,
  };
}

/** Active products by days left (overdue first), then active ones with nothing due, then closed. */
export function sortByDue<P extends CreditProduct>(
  statuses: ProductStatus<P>[]
): ProductStatus<P>[] {
  const rank = (s: ProductStatus<P>) => (!s.product.isActive ? 2 : s.due ? 0 : 1);
  return [...statuses].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (a.due && b.due && a.due.daysLeft !== b.due.daysLeft) return a.due.daysLeft - b.due.daysLeft;
    return a.product.name.localeCompare(b.product.name);
  });
}

export type CreditSummary = {
  /** All amounts in the home currency. */
  totalOwed: number;
  dueThisMonth: number;
  dueThisMonthCount: number;
  next: { productId: string; due: DueInfo } | null;
  revolvingBalance: number;
  revolvingLimit: number;
  /** Revolving balance over revolving limit; null without limits. */
  utilization: number | null;
  activeCount: number;
};

export function summarizeCredit(
  products: CreditProduct[],
  installments: Installment[],
  today: LocalDate,
  home: CurrencyCode,
  fx: FxTable
): CreditSummary {
  const month = monthKey(today);
  const summary: CreditSummary = {
    totalOwed: 0,
    dueThisMonth: 0,
    dueThisMonthCount: 0,
    next: null,
    revolvingBalance: 0,
    revolvingLimit: 0,
    utilization: null,
    activeCount: 0,
  };

  for (const product of products) {
    if (!product.isActive) continue;
    const toHome = (amount: number) => convert(amount, product.currency, home, fx);
    summary.activeCount += 1;
    summary.totalOwed += toHome(Math.max(0, product.balance));
    if (isRevolving(product.kind)) {
      summary.revolvingBalance += toHome(Math.max(0, product.balance));
      summary.revolvingLimit += toHome(Math.max(0, product.creditLimit));
    }

    const unpaid = unpaidInstallments(product.id, installments);
    if (unpaid.length > 0) {
      const dueNow = unpaid.filter((item) => monthKey(item.dueDate) <= month);
      if (dueNow.length > 0) {
        summary.dueThisMonth += toHome(dueNow.reduce((sum, item) => sum + item.amount, 0));
        summary.dueThisMonthCount += 1;
      }
    }

    const due = nextDue(product, installments, today);
    if (!due) continue;
    if (unpaid.length === 0 && monthKey(due.dueDate) <= month) {
      summary.dueThisMonth += toHome(due.amount);
      summary.dueThisMonthCount += 1;
    }
    if (!summary.next || due.daysLeft < summary.next.due.daysLeft) {
      summary.next = { productId: product.id, due };
    }
  }

  summary.utilization =
    summary.revolvingLimit > 0 ? summary.revolvingBalance / summary.revolvingLimit : null;
  return summary;
}
