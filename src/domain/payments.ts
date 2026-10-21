import type { CreditProduct, Installment } from './credit';
import type { DueInfo } from './creditStatus';
import { maxDate, type LocalDate } from './dates';
import { roundMoney } from './money';

export type PaymentInput = {
  amount: number;
  date: LocalDate;
  /**
   * Whether the payment settles the due it was made for (the bill or the installment). Paying
   * at least the amount due always settles it; a smaller payment settles it only when the user
   * says so, e.g. after paying the minimum.
   */
  settlesDue: boolean;
  note?: string | null;
};

type ProductFields = Pick<CreditProduct, 'balance' | 'statementBalance' | 'paidThrough'>;

export type PaymentRecord = {
  amount: number;
  date: LocalDate;
  /** Due date this payment settled, if it settled one. */
  forDueDate: LocalDate | null;
  installmentId: string | null;
  note: string | null;
  balanceReduction: number;
  previousPaidThrough: LocalDate | null;
  previousStatementBalance: number | null;
};

export type PaymentPlan = {
  product: ProductFields;
  /** Installment to mark as paid on the payment date. */
  paidInstallmentId: string | null;
  record: PaymentRecord;
};

/**
 * What recording a payment changes. Payments lower the balance (never below zero; overpayments
 * are not tracked as credit) and, when they settle a bill, move `paidThrough` to its due date and
 * clear the bill amount until the next statement is entered. Loan installments are marked paid;
 * only their principal lowers the balance, plus anything paid on top of the installment.
 */
export function planPayment(
  product: CreditProduct,
  due: DueInfo | null,
  installment: Installment | null,
  input: PaymentInput
): PaymentPlan {
  const money = (value: number) => roundMoney(value, product.currency);
  const amount = money(input.amount);
  const owed = Math.max(0, product.balance);
  const settles = due != null && (input.settlesDue || amount >= money(due.amount));

  let reduction: number;
  let statementBalance = product.statementBalance;
  let paidThrough = product.paidThrough;
  let paidInstallmentId: string | null = null;

  if (due?.installmentId && installment && installment.id === due.installmentId) {
    if (settles) {
      paidInstallmentId = installment.id;
      reduction = installment.principal + Math.max(0, amount - installment.amount);
    } else {
      // A partial installment payment covers principal and interest in the same proportion.
      const principalShare =
        installment.amount > 0 ? installment.principal / installment.amount : 1;
      reduction = amount * principalShare;
    }
  } else {
    reduction = amount;
    if (due && settles) {
      paidThrough = paidThrough ? maxDate(paidThrough, due.dueDate) : due.dueDate;
      statementBalance = null;
    } else if (statementBalance != null) {
      const left = money(statementBalance - amount);
      statementBalance = left > 0 ? left : null;
    }
  }

  const balanceReduction = money(Math.min(owed, Math.max(0, reduction)));
  return {
    product: { balance: money(owed - balanceReduction), statementBalance, paidThrough },
    paidInstallmentId,
    record: {
      amount,
      date: input.date,
      forDueDate: settles && due ? due.dueDate : null,
      installmentId: paidInstallmentId,
      note: input.note?.trim() ? input.note.trim() : null,
      balanceReduction,
      previousPaidThrough: product.paidThrough,
      previousStatementBalance: product.statementBalance,
    },
  };
}

export type UndoPlan = {
  product: ProductFields;
  /** Installment to mark unpaid again. */
  unpaidInstallmentId: string | null;
};

/**
 * Reverses `planPayment` exactly. Only valid for a product's most recent payment, since later
 * payments build on the state this one left behind.
 */
export function planUndo(
  product: Pick<CreditProduct, 'balance' | 'currency'>,
  payment: Pick<
    PaymentRecord,
    'balanceReduction' | 'previousPaidThrough' | 'previousStatementBalance' | 'installmentId'
  >
): UndoPlan {
  return {
    product: {
      balance: roundMoney(product.balance + payment.balanceReduction, product.currency),
      statementBalance: payment.previousStatementBalance,
      paidThrough: payment.previousPaidThrough,
    },
    unpaidInstallmentId: payment.installmentId,
  };
}

/** The amount to suggest when the user taps "mark as paid". */
export function suggestedPayment(product: CreditProduct, due: DueInfo | null): number {
  if (due) return roundMoney(Math.max(0, due.amount), product.currency);
  return roundMoney(Math.max(0, product.statementBalance ?? product.balance), product.currency);
}
