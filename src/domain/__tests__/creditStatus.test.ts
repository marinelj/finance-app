import type { CreditProduct, Installment } from '../credit';
import {
  nextDue,
  productStatus,
  sortByDue,
  summarizeCredit,
  upcomingDueDates,
} from '../creditStatus';

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
    name: '借呗',
    issuer: '蚂蚁',
    kind: 'installment_loan',
    creditLimit: 0,
    balance: 12000,
    statementBalance: null,
    minimumPayment: null,
    statementDay: null,
    dueRule: null,
    dueDay: null,
    hasGracePeriod: false,
    interestRate: 0.03,
    repaymentDay: 21,
    paidThrough: null,
    ...overrides,
  });
}

const installment = (seq: number, dueDate: string, paidAt: string | null = null): Installment => ({
  id: `i${seq}`,
  productId: 'jiebei',
  seq,
  dueDate,
  principal: 950.8,
  interest: 109.5,
  amount: 1060.3,
  paidAt,
});

describe('nextDue', () => {
  it('uses the entered bill for cards', () => {
    expect(nextDue(card(), [], today)).toEqual({
      dueDate: '2026-10-23',
      daysLeft: 2,
      statementDate: '2026-10-05',
      amount: 6200,
      amountIsEstimate: false,
      installmentId: null,
    });
  });

  it('estimates from the balance when the bill is not entered', () => {
    const due = nextDue(card({ statementBalance: null, paidThrough: '2026-10-23' }), [], today);
    expect(due).toMatchObject({ dueDate: '2026-11-23', amount: 8650, amountIsEstimate: true });
  });

  it('flags an overdue bill with negative days', () => {
    expect(nextDue(card(), [], '2026-10-26')?.daysLeft).toBe(-3);
  });

  it('has nothing due when nothing is owed or the product is closed', () => {
    expect(nextDue(card({ balance: 0, statementBalance: 0 }), [], today)).toBeNull();
    expect(nextDue(card({ isActive: false }), [], today)).toBeNull();
  });

  it('uses the earliest unpaid installment for loans', () => {
    const items = [installment(2, '2026-12-21'), installment(1, '2026-11-21', '2026-11-20')];
    expect(nextDue(loan(), items, today)).toMatchObject({
      dueDate: '2026-12-21',
      daysLeft: 61,
      amount: 1060.3,
      installmentId: 'i2',
    });
  });

  it('falls back to the repayment day for loans without a schedule', () => {
    expect(nextDue(loan({ minimumPayment: 1100 }), [], today)).toMatchObject({
      dueDate: '2026-10-21',
      daysLeft: 0,
      amount: 1100,
      amountIsEstimate: false,
    });
  });
});

describe('upcomingDueDates', () => {
  it('lists the next cycles for cards and the next installments for loans', () => {
    expect(upcomingDueDates(card(), [], today)).toEqual(['2026-10-23', '2026-11-23']);
    const items = [
      installment(1, '2026-11-21'),
      installment(2, '2026-12-21'),
      installment(3, '2027-01-21'),
    ];
    expect(upcomingDueDates(loan(), items, today)).toEqual(['2026-11-21', '2026-12-21']);
    expect(upcomingDueDates(card({ isActive: false }), [], today)).toEqual([]);
  });
});

describe('productStatus and sortByDue', () => {
  it('computes utilization and available credit', () => {
    const status = productStatus(card(), [], today);
    expect(status.utilization).toBeCloseTo(0.173, 3);
    expect(status.available).toBe(41350);
    expect(productStatus(loan(), [], today).utilization).toBeNull();
  });

  it('sorts overdue first, then by days left, then nothing due, then closed', () => {
    const products = [
      card({ id: 'closed', name: 'Closed', isActive: false }),
      card({ id: 'paid', name: 'Paid off', balance: 0, statementBalance: 0 }),
      card({ id: 'later', name: 'Later', dueDay: 30, paidThrough: '2026-09-30' }),
      card({ id: 'soon', name: 'Soon' }),
      card({ id: 'late', name: 'Late', dueDay: 15, paidThrough: '2026-09-15' }),
    ];
    const sorted = sortByDue(products.map((p) => productStatus(p, [], today)));
    expect(sorted.map((s) => s.product.id)).toEqual(['late', 'soon', 'later', 'paid', 'closed']);
  });
});

describe('summarizeCredit', () => {
  it('totals in the home currency, counting this month and overdue dues', () => {
    const usdCard = card({
      id: 'chase',
      name: 'Chase',
      currency: 'USD',
      creditLimit: 10000,
      balance: 1000,
      statementBalance: 800,
      statementDay: 28,
      dueRule: 'days_after_statement',
      dueDay: null,
      dueDaysAfterStatement: 25,
      paidThrough: '2026-10-23',
    });
    const items = [installment(1, '2026-10-21'), installment(2, '2026-11-21')];
    const summary = summarizeCredit(
      [card(), usdCard, loan(), card({ id: 'x', isActive: false })],
      items,
      today,
      'CNY',
      { USD: 1, CNY: 7 }
    );
    expect(summary.activeCount).toBe(3);
    expect(summary.totalOwed).toBeCloseTo(8650 + 7000 + 12000, 6);
    // CMB bill (6200, due 10-23) and the loan installment due today (1060.3);
    // the Chase bill is due 11-22, next month.
    expect(summary.dueThisMonth).toBeCloseTo(6200 + 1060.3, 6);
    expect(summary.dueThisMonthCount).toBe(2);
    expect(summary.next).toMatchObject({ productId: 'jiebei', due: { daysLeft: 0 } });
    expect(summary.revolvingBalance).toBeCloseTo(8650 + 7000, 6);
    expect(summary.revolvingLimit).toBeCloseTo(50000 + 70000, 6);
    expect(summary.utilization).toBeCloseTo(15650 / 120000, 6);
  });

  it('is empty without products', () => {
    const summary = summarizeCredit([], [], today, 'CNY', {});
    expect(summary).toMatchObject({ totalOwed: 0, next: null, utilization: null });
  });
});
