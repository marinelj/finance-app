import type { Installment } from '../credit';
import { nextDue } from '../creditStatus';
import { parseDecimal, parseInteger, toInputText } from '../numberInput';
import {
  defaultFormValues,
  formValuesFromProduct,
  previewSchedule,
  toProductFields,
  validateProductForm,
  type ProductFormValues,
} from '../productForm';

const today = '2026-10-21';

function cardForm(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    ...defaultFormValues({ preset: 'credit_card', homeCurrency: 'CNY', today }),
    name: '招行经典白',
    issuer: '招商银行',
    creditLimit: '50,000',
    balance: '8650',
    statementBalance: '6200',
    minimumPayment: '620',
    ...overrides,
  };
}

function loanForm(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    ...defaultFormValues({ preset: 'jiebei', name: '借呗', homeCurrency: 'USD', today }),
    loanPrincipal: '12000',
    loanStartDate: '2026-07-21',
    ...overrides,
  };
}

describe('number input parsing', () => {
  it('accepts grouping, full-width digits and a trailing dot', () => {
    expect(parseDecimal('1,234.50')).toBe(1234.5);
    expect(parseDecimal('１２３４．５')).toBe(1234.5);
    expect(parseDecimal(' 12. ')).toBe(12);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('+8')).toBe(8);
  });

  it('separates empty input from invalid input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('12a')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
    expect(parseInteger('3.5')).toBeNaN();
    expect(parseInteger('12')).toBe(12);
  });

  it('formats stored numbers for editing', () => {
    expect(toInputText(6200)).toBe('6200');
    expect(toInputText(0.05)).toBe('0.05');
    expect(toInputText(1044.7499999, 2)).toBe('1044.75');
    expect(toInputText(null)).toBe('');
  });
});

describe('defaultFormValues', () => {
  it('starts Chinese products in CNY and cards in the home currency', () => {
    expect(defaultFormValues({ preset: 'huabei', homeCurrency: 'USD', today }).currency).toBe(
      'CNY'
    );
    expect(defaultFormValues({ preset: 'credit_card', homeCurrency: 'USD', today }).currency).toBe(
      'USD'
    );
  });

  it('copies the preset billing terms', () => {
    const huabei = defaultFormValues({ preset: 'huabei', homeCurrency: 'CNY', today });
    expect(huabei).toMatchObject({
      kind: 'revolving_bnpl',
      statementDay: 31,
      dueRule: 'fixed_day',
      dueDay: 10,
      hasGracePeriod: true,
    });
    const jiebei = defaultFormValues({ preset: 'jiebei', homeCurrency: 'CNY', today });
    expect(jiebei).toMatchObject({
      kind: 'installment_loan',
      hasGracePeriod: false,
      useSchedule: true,
      interestRate: '0.03',
      interestRateUnit: 'daily',
      loanTermMonths: '12',
    });
  });

  it('applies a custom type, never giving a loan a grace period', () => {
    const values = defaultFormValues({
      customType: {
        id: 'fql',
        kind: 'installment_loan',
        hasGracePeriod: true,
        emoji: '🧧',
        color: '#E5484D',
      },
      homeCurrency: 'CNY',
      today,
    });
    expect(values).toMatchObject({
      customTypeId: 'fql',
      preset: null,
      emoji: '🧧',
      hasGracePeriod: false,
    });
  });
});

describe('validateProductForm', () => {
  it('accepts a complete credit card', () => {
    expect(validateProductForm(cardForm())).toEqual({});
  });

  it('reports every problem at once, as i18n keys', () => {
    const errors = validateProductForm(
      cardForm({
        name: '  ',
        creditLimit: 'abc',
        balance: '-5',
        statementDay: null,
        dueDay: null,
        interestRate: '3',
      })
    );
    expect(errors).toEqual({
      name: 'required',
      creditLimit: 'number',
      balance: 'nonNegative',
      statementDay: 'required',
      dueDay: 'required',
      interestRate: 'dailyRateTooHigh',
    });
  });

  it('checks the bill against the balance and the minimum against the bill', () => {
    expect(validateProductForm(cardForm({ statementBalance: '9000' }))).toEqual({
      statementBalance: 'billOverBalance',
    });
    expect(validateProductForm(cardForm({ minimumPayment: '7000' }))).toEqual({
      minimumPayment: 'minimumOverBill',
    });
  });

  it('validates days after the statement', () => {
    const form = cardForm({ dueRule: 'days_after_statement' });
    expect(validateProductForm({ ...form, dueDaysAfterStatement: '' })).toEqual({
      dueDaysAfterStatement: 'required',
    });
    expect(validateProductForm({ ...form, dueDaysAfterStatement: '75' })).toEqual({
      dueDaysAfterStatement: 'daysAfterRange',
    });
    expect(validateProductForm({ ...form, dueDaysAfterStatement: '25' })).toEqual({});
  });

  it('lets "other" products skip the billing cycle', () => {
    const other = {
      ...defaultFormValues({ preset: 'other', homeCurrency: 'CNY', today }),
      name: 'IOU',
    };
    expect(validateProductForm(other)).toEqual({});
  });

  it('requires loan terms when a schedule is generated', () => {
    const errors = validateProductForm(
      loanForm({ loanPrincipal: '', loanTermMonths: '0', interestRate: '' })
    );
    expect(errors).toEqual({
      loanPrincipal: 'required',
      loanTermMonths: 'termRange',
      interestRate: 'required',
    });
    expect(validateProductForm(loanForm())).toEqual({});
  });

  it('caps APR quotes at 100%', () => {
    expect(validateProductForm(cardForm({ interestRate: '120', interestRateUnit: 'apr' }))).toEqual(
      {
        interestRate: 'aprTooHigh',
      }
    );
  });
});

describe('toProductFields for revolving products', () => {
  it('converts and rounds values, and leaves the open bill unpaid', () => {
    const { fields, schedule } = toProductFields(cardForm({ balance: '8650.555' }), today);
    expect(schedule).toBeNull();
    expect(fields).toMatchObject({
      name: '招行经典白',
      creditLimit: 50000,
      balance: 8650.56,
      statementBalance: 6200,
      statementDay: 5,
      dueRule: 'fixed_day',
      dueDay: 23,
      dueDaysAfterStatement: null,
      interestRate: 0.05,
      interestRateUnit: 'daily',
      paidThrough: '2026-09-23',
    });
    // The October bill is the next due, matching what the user sees on their card statement.
    expect(nextDue({ id: 'x', ...fields }, [], today)?.dueDate).toBe('2026-10-23');
  });

  it('skips to the next bill when the current bill is zero', () => {
    const { fields } = toProductFields(
      cardForm({ statementBalance: '0', minimumPayment: '' }),
      today
    );
    expect(fields.paidThrough).toBe('2026-10-23');
  });

  it('keeps payment history on edit unless the billing days change', () => {
    const first = toProductFields(cardForm(), today).fields;
    const paid = { ...first, paidThrough: '2026-10-23', statementBalance: null };
    const renamed = toProductFields(
      { ...formValuesFromProduct(paid, false, today), name: 'CMB' },
      today,
      { product: paid, installments: [] }
    );
    expect(renamed.fields.paidThrough).toBe('2026-10-23');

    const moved = toProductFields(
      { ...formValuesFromProduct(paid, false, today), dueDay: 25 },
      today,
      { product: paid, installments: [] }
    );
    // A new cycle restarts from the current state: something is owed, so October's bill is open.
    expect(moved.fields.paidThrough).toBe('2026-09-25');
  });

  it('drops cycle fields that do not apply', () => {
    const { fields } = toProductFields(
      cardForm({ dueRule: 'days_after_statement', dueDaysAfterStatement: '25', dueDay: 23 }),
      today
    );
    expect(fields).toMatchObject({
      dueRule: 'days_after_statement',
      dueDay: null,
      dueDaysAfterStatement: 25,
    });
  });
});

describe('toProductFields for loans', () => {
  it('generates the schedule, marks past installments paid and derives the balance', () => {
    const { fields, schedule } = toProductFields(loanForm(), today);
    expect(fields).toMatchObject({
      kind: 'installment_loan',
      repaymentDay: 21,
      loanPrincipal: 12000,
      loanTermMonths: 12,
      paidThrough: null,
      minimumPayment: null,
      statementBalance: null,
    });
    const items = schedule?.installments ?? [];
    expect(items).toHaveLength(12);
    expect(items.slice(0, 2).map((item) => item.paidAt)).toEqual(['2026-08-21', '2026-09-21']);
    // Due today is not assumed paid.
    expect(items[2]).toMatchObject({ dueDate: '2026-10-21', paidAt: null });
    expect(fields.balance).toBe(items[1].remaining);
  });

  it('keeps the schedule when only the name changes', () => {
    const created = toProductFields(loanForm(), today);
    const installments: Installment[] = (created.schedule?.installments ?? []).map((item, i) => ({
      ...item,
      id: `i${i}`,
      productId: 'p',
    }));
    const existing = { product: { ...created.fields, balance: 9000 }, installments };
    const edited = toProductFields(
      { ...formValuesFromProduct(existing.product, true, today), name: '借呗 2' },
      today,
      existing
    );
    expect(edited.schedule).toBeNull();
    expect(edited.fields.balance).toBe(9000);
  });

  it('regenerates on new terms, keeping installments the user already paid', () => {
    const created = toProductFields(loanForm(), today);
    const installments: Installment[] = (created.schedule?.installments ?? []).map((item, i) => ({
      ...item,
      id: `i${i}`,
      productId: 'p',
      paidAt: item.seq <= 3 ? (item.paidAt ?? today) : null,
    }));
    const existing = { product: created.fields, installments };
    const edited = toProductFields(
      { ...formValuesFromProduct(created.fields, true, today), interestRate: '0.02' },
      today,
      existing
    );
    const items = edited.schedule?.installments ?? [];
    expect(items.filter((item) => item.paidAt != null).map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(edited.fields.balance).toBe(items[2].remaining);
  });

  it('removes the schedule when the user switches it off', () => {
    const created = toProductFields(loanForm(), today);
    const installments: Installment[] = (created.schedule?.installments ?? []).map((item, i) => ({
      ...item,
      id: `i${i}`,
      productId: 'p',
    }));
    const edited = toProductFields(
      {
        ...formValuesFromProduct(created.fields, true, today),
        useSchedule: false,
        balance: '8000',
        minimumPayment: '1100',
        repaymentDay: 10,
      },
      today,
      { product: created.fields, installments }
    );
    expect(edited.schedule).toEqual({ installments: [] });
    expect(edited.fields).toMatchObject({
      balance: 8000,
      minimumPayment: 1100,
      repaymentDay: 10,
      loanPrincipal: null,
      paidThrough: '2026-10-10',
    });
  });

  it('previews the schedule only once the terms are valid', () => {
    expect(previewSchedule(loanForm({ loanPrincipal: '' }))).toBeNull();
    const preview = previewSchedule(loanForm());
    expect(preview).toHaveLength(12);
    expect(preview?.[0].dueDate).toBe('2026-08-21');
  });
});
