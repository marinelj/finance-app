import type { CreditProduct, Installment } from '../credit';
import { nextDue } from '../creditStatus';
import { planPayment, planUndo, suggestedPayment } from '../payments';

const today = '2026-10-21';

function card(overrides: Partial<CreditProduct> = {}): CreditProduct {
  return {
    id: 'cmb',
    name: 'CMB',
    issuer: '招商银行',
    kind: 'credit_card',
    currency: 'CNY',
    creditLimit: 50000,
    balance: 8650,
    statementBalance: 6200,
    minimumPayment: 620,
    statementDay: 5,
    dueRule: 'fixed_day',
    dueDay: 23,
    dueDaysAfterStatement: null,
    hasGracePeriod: true,
    interestRate: 0.05,
    interestRateUnit: 'daily',
    repaymentDay: null,
    paidThrough: '2026-09-23',
    isActive: true,
    ...overrides,
  };
}

function loan(overrides: Partial<CreditProduct> = {}): CreditProduct {
  return card({
    id: 'jiebei',
    kind: 'installment_loan',
    creditLimit: 0,
    balance: 6000,
    statementBalance: null,
    minimumPayment: null,
    statementDay: null,
    dueRule: null,
    dueDay: null,
    hasGracePeriod: false,
    interestRate: 0.03,
    repaymentDay: 10,
    paidThrough: null,
    ...overrides,
  });
}

const installment: Installment = {
  id: 'i7',
  productId: 'jiebei',
  seq: 7,
  dueDate: '2026-11-10',
  principal: 990,
  interest: 54.75,
  amount: 1044.75,
  paidAt: null,
};

describe('planPayment for a card bill', () => {
  const product = card();
  const due = nextDue(product, [], today);

  it('settles the bill: balance down, paidThrough at the due date, bill amount cleared', () => {
    expect(due?.dueDate).toBe('2026-10-23');
    const plan = planPayment(product, due, null, {
      amount: 6200,
      date: today,
      settlesDue: false,
    });
    expect(plan.product).toEqual({
      balance: 2450,
      statementBalance: null,
      paidThrough: '2026-10-23',
    });
    expect(plan.record).toMatchObject({
      amount: 6200,
      forDueDate: '2026-10-23',
      balanceReduction: 6200,
      previousPaidThrough: '2026-09-23',
      previousStatementBalance: 6200,
    });
    // The next due moves to November's bill, estimated from the remaining balance.
    const after = nextDue({ ...product, ...plan.product }, [], today);
    expect(after).toMatchObject({ dueDate: '2026-11-23', amount: 2450, amountIsEstimate: true });
  });

  it('keeps a partial payment open and lowers the bill amount', () => {
    const plan = planPayment(product, due, null, { amount: 2000, date: today, settlesDue: false });
    expect(plan.product).toEqual({
      balance: 6650,
      statementBalance: 4200,
      paidThrough: '2026-09-23',
    });
    expect(plan.record.forDueDate).toBeNull();
  });

  it('lets the user settle the bill with the minimum payment', () => {
    const plan = planPayment(product, due, null, { amount: 620, date: today, settlesDue: true });
    expect(plan.product).toEqual({
      balance: 8030,
      statementBalance: null,
      paidThrough: '2026-10-23',
    });
  });

  it('never takes the balance below zero', () => {
    const plan = planPayment(product, due, null, { amount: 9000, date: today, settlesDue: true });
    expect(plan.product.balance).toBe(0);
    expect(plan.record.balanceReduction).toBe(8650);
  });

  it('rounds to the currency minor unit', () => {
    const plan = planPayment(card({ balance: 100 }), due, null, {
      amount: 10.005,
      date: today,
      settlesDue: false,
    });
    expect(plan.record.amount).toBe(10.01);
    expect(plan.product.balance).toBe(89.99);
  });

  it('does not move paidThrough backwards when an older bill is settled late', () => {
    const plan = planPayment(card({ paidThrough: '2026-11-23' }), due, null, {
      amount: 6200,
      date: today,
      settlesDue: true,
    });
    expect(plan.product.paidThrough).toBe('2026-11-23');
  });
});

describe('planPayment for a loan installment', () => {
  const product = loan();
  const due = nextDue(product, [installment], today);

  it('marks the installment paid and lowers the balance by its principal only', () => {
    const plan = planPayment(product, due, installment, {
      amount: 1044.75,
      date: today,
      settlesDue: true,
    });
    expect(plan.paidInstallmentId).toBe('i7');
    expect(plan.product).toEqual({ balance: 5010, statementBalance: null, paidThrough: null });
    expect(plan.record).toMatchObject({ forDueDate: '2026-11-10', installmentId: 'i7' });
  });

  it('applies anything paid on top of the installment to principal', () => {
    const plan = planPayment(product, due, installment, {
      amount: 2044.75,
      date: today,
      settlesDue: true,
    });
    expect(plan.product.balance).toBe(4010);
  });

  it('splits a partial payment between principal and interest', () => {
    const plan = planPayment(product, due, installment, {
      amount: 500,
      date: today,
      settlesDue: false,
    });
    expect(plan.paidInstallmentId).toBeNull();
    expect(plan.record.balanceReduction).toBeCloseTo(473.8, 2);
  });
});

describe('planPayment without a schedule', () => {
  it('lowers the balance of a loan with only a repayment day', () => {
    const product = loan({ minimumPayment: 1100 });
    const due = nextDue(product, [], today);
    expect(due?.dueDate).toBe('2026-11-10');
    const plan = planPayment(product, due, null, { amount: 1100, date: today, settlesDue: false });
    expect(plan.product).toEqual({
      balance: 4900,
      statementBalance: null,
      paidThrough: '2026-11-10',
    });
  });

  it('records a payment when nothing is due', () => {
    const product = card({ statementDay: null, dueRule: null, dueDay: null });
    const plan = planPayment(product, null, null, { amount: 650, date: today, settlesDue: true });
    expect(plan.product).toEqual({
      balance: 8000,
      statementBalance: 5550,
      paidThrough: '2026-09-23',
    });
    expect(plan.record.forDueDate).toBeNull();
  });
});

describe('planUndo', () => {
  it('restores exactly what planPayment changed', () => {
    const product = card();
    const due = nextDue(product, [], today);
    const plan = planPayment(product, due, null, { amount: 6200, date: today, settlesDue: true });
    const after = { ...product, ...plan.product };
    const undo = planUndo(after, plan.record);
    expect(undo.product).toEqual({
      balance: product.balance,
      statementBalance: product.statementBalance,
      paidThrough: product.paidThrough,
    });
    expect(undo.unpaidInstallmentId).toBeNull();
  });

  it('marks the installment unpaid again', () => {
    const product = loan();
    const due = nextDue(product, [installment], today);
    const plan = planPayment(product, due, installment, {
      amount: 1044.75,
      date: today,
      settlesDue: true,
    });
    const undo = planUndo({ ...product, ...plan.product }, plan.record);
    expect(undo.unpaidInstallmentId).toBe('i7');
    expect(undo.product.balance).toBe(6000);
  });
});

describe('suggestedPayment', () => {
  it('suggests the amount due, or the bill/balance when nothing is scheduled', () => {
    const product = card();
    expect(suggestedPayment(product, nextDue(product, [], today))).toBe(6200);
    expect(suggestedPayment(card({ statementBalance: null }), null)).toBe(8650);
  });
});
