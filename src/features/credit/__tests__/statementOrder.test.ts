import type { CreditProduct } from '@/domain/credit';
import { orderByNextStatement } from '@/features/credit/statementOrder';

function card(id: string, overrides: Partial<CreditProduct> = {}): { product: CreditProduct } {
  return {
    product: {
      id,
      name: id,
      issuer: '',
      kind: 'credit_card',
      currency: 'CNY',
      creditLimit: 10000,
      balance: 0,
      statementBalance: null,
      minimumPayment: null,
      statementDay: 5,
      dueRule: 'fixed_day',
      dueDay: 23,
      dueDaysAfterStatement: null,
      hasGracePeriod: true,
      interestRate: null,
      interestRateUnit: null,
      repaymentDay: null,
      paidThrough: null,
      isActive: true,
      ...overrides,
    },
  };
}

it('puts the longest wait until the next statement first, cycle-less products last', () => {
  const today = '2026-11-06';
  const rows = orderByNextStatement(
    [
      card('loan', { kind: 'installment_loan', statementDay: null, dueDay: 10 }),
      card('soon', { statementDay: 8, dueDay: 26 }),
      card('later', { statementDay: 5, dueDay: 23 }),
    ],
    today
  );
  expect(rows.map((row) => row.status.product.id)).toEqual(['later', 'soon', 'loan']);
  expect(rows[0].statementDays).toBe(29); // next statement Dec 5
  expect(rows[1].statementDays).toBe(2); // Nov 8
  expect(rows[0].graceDays).toBeGreaterThan(rows[1].graceDays!);
  expect(rows[2]).toMatchObject({ statementDays: null, graceDays: null });
});
