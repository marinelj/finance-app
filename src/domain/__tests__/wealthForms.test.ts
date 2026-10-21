import { getTableColumns } from 'drizzle-orm';

import {
  bondHoldings,
  cashAccounts,
  expenses,
  housing,
  incomes,
  insurancePolicies,
  stockHoldings,
} from '@/db/schema';

import {
  defaultWealthValues,
  fromWealthRecord,
  isSecurityIdentifier,
  isVisible,
  toWealthRecord,
  validateWealthForm,
  WEALTH_FIELDS,
  WEALTH_KINDS,
  wealthFieldKeys,
  type WealthFormValues,
  type WealthKind,
} from '../wealthForms';

const today = '2026-10-21';

const TABLES = {
  income: incomes,
  housing,
  insurance: insurancePolicies,
  expense: expenses,
  cash: cashAccounts,
  bond: bondHoldings,
  stock: stockHoldings,
};

describe('field specs and tables', () => {
  it.each(WEALTH_KINDS)('%s fields map onto table columns', (kind) => {
    const columns = getTableColumns(TABLES[kind]);
    const keys = wealthFieldKeys(kind);
    for (const key of keys) expect(Object.keys(columns)).toContain(key);
    // Every required column is filled by the form: always-present fields or a required one.
    for (const [key, column] of Object.entries(columns)) {
      if (['id', 'createdAt', 'updatedAt'].includes(key) || !column.notNull) continue;
      const spec = WEALTH_FIELDS[kind].find((item) => item.key === key);
      expect({
        key,
        filled: Boolean(
          spec &&
          (spec.required === true ||
            ['select', 'switch', 'currency'].includes(spec.type) ||
            column.hasDefault)
        ),
      }).toEqual({ key, filled: true });
    }
  });
});

function values(kind: WealthKind, overrides: WealthFormValues = {}): WealthFormValues {
  return { ...defaultWealthValues(kind, 'CNY'), ...overrides };
}

describe('defaults', () => {
  it('starts in the home currency, except bonds in USD', () => {
    expect(values('income').currency).toBe('CNY');
    expect(values('bond').currency).toBe('USD');
    expect(values('expense')).toMatchObject({ category: 'food', essential: true });
  });
});

describe('validateWealthForm', () => {
  it('requires the essentials and reports every error at once', () => {
    expect(validateWealthForm('income', values('income'), today)).toEqual({
      name: 'required',
      amount: 'required',
    });
  });

  it('checks numbers', () => {
    const errors = validateWealthForm(
      'stock',
      values('stock', { ticker: 'VTI', shares: '0', price: 'abc', firstPayMonth: '13' }),
      today
    );
    expect(errors).toEqual({ shares: 'positive', price: 'number', firstPayMonth: 'monthRange' });
  });

  it('only checks fields that apply', () => {
    const rent = values('housing', { name: 'Flat', kind: 'rent', monthlyRent: '6500' });
    expect(validateWealthForm('housing', rent, today)).toEqual({});
    const mortgage = values('housing', { name: 'Home', kind: 'mortgage', remainingMonths: '600' });
    expect(validateWealthForm('housing', mortgage, today)).toEqual({
      balance: 'required',
      remainingMonths: 'tooLarge',
    });
  });

  it('checks bond dates and identifiers', () => {
    const bond = values('bond', {
      issuer: 'Apple Inc.',
      identifier: '037833AK6',
      faceValue: '10000',
      couponRate: '2.4',
      maturityDate: '2023-05-03',
      purchaseDate: '2027-01-01',
    });
    expect(validateWealthForm('bond', bond, today)).toEqual({
      maturityDate: 'mustBeFuture',
      purchaseDate: 'mustBePast',
    });
    expect(
      validateWealthForm('bond', { ...bond, maturityDate: '2031-05-03', purchaseDate: '' }, today)
    ).toEqual({});
    expect(validateWealthForm('bond', { ...bond, identifier: '12345' }, today).identifier).toBe(
      'identifier'
    );
  });

  it('recognises CUSIPs and ISINs', () => {
    expect(isSecurityIdentifier('037833AK6')).toBe(true);
    expect(isSecurityIdentifier('US0378331005')).toBe(true);
    expect(isSecurityIdentifier('US037833100')).toBe(false);
  });
});

describe('records', () => {
  it('converts text to stored values and drops hidden fields', () => {
    const record = toWealthRecord(
      'housing',
      values('housing', {
        name: ' Flat ',
        kind: 'rent',
        monthlyRent: '6,500',
        balance: '900000',
      })
    );
    expect(record).toMatchObject({
      name: 'Flat',
      kind: 'rent',
      currency: 'CNY',
      monthlyRent: 6500,
      balance: null,
      notes: null,
    });
  });

  it('stores numeric selects as numbers and uppercases tickers', () => {
    const record = toWealthRecord(
      'stock',
      values('stock', { ticker: 'vti', shares: '40', price: '250.123', dividendFrequency: '4' })
    );
    expect(record).toMatchObject({
      ticker: 'VTI',
      shares: 40,
      price: 250.12,
      dividendFrequency: 4,
    });
  });

  it('round-trips through the form', () => {
    const form = values('bond', {
      issuer: 'Apple Inc.',
      faceValue: '10000',
      couponRate: '4.65',
      couponFrequency: '2',
      maturityDate: '2046-02-23',
      purchasePrice: '92.5',
    });
    const record = toWealthRecord('bond', form);
    expect(fromWealthRecord('bond', record, 'CNY')).toEqual({ ...form });
  });

  it('marks fields visible by their conditions', () => {
    const [, , , , , , , , firstPayMonth] = WEALTH_FIELDS.stock;
    expect(firstPayMonth.key).toBe('firstPayMonth');
    expect(isVisible(firstPayMonth, { dividendFrequency: '0' })).toBe(false);
    expect(isVisible(firstPayMonth, { dividendFrequency: '4' })).toBe(true);
  });
});
