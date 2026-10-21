import { eq, inArray } from 'drizzle-orm';

import { addDays, addMonths, type LocalDate } from '@/domain/dates';
import {
  defaultWealthValues,
  toWealthRecord,
  type WealthFormValues,
  type WealthKind,
} from '@/domain/wealthForms';
import type { PresetKey } from '@/domain/credit';
import { defaultFormValues, toProductFields, type ProductFormValues } from '@/domain/productForm';
import type { CurrencyCode } from '@/domain/money';

import { getDb } from './client';
import { saveProduct } from './credit';
import { newId, nowIso } from './ids';
import { readSetting, writeSetting } from './settings';
import { creditProducts, installments, payments } from './schema';
import { deleteWealthItem, saveWealthItem } from './wealth';

/**
 * Sample data for exploring the app. Only ever loaded from the "Load demo data" button, and
 * tracked by id so "Remove demo data" deletes exactly what it added.
 */

const DEMO_KEY = 'demo';

type DemoState = {
  productIds: string[];
  wealth?: { kind: WealthKind; id: string }[];
};

function product(
  preset: PresetKey,
  today: LocalDate,
  home: CurrencyCode,
  overrides: Partial<ProductFormValues>
): ProductFormValues {
  return { ...defaultFormValues({ preset, homeCurrency: home, today }), ...overrides };
}

export function hasDemoData(): boolean {
  const state = readSetting<DemoState>(DEMO_KEY);
  return (state?.productIds.length ?? 0) + (state?.wealth?.length ?? 0) > 0;
}

/** Sample income, home, insurance, spending, savings and investments. */
function demoWealth(home: CurrencyCode): [WealthKind, WealthFormValues][] {
  const item = (kind: WealthKind, values: WealthFormValues): [WealthKind, WealthFormValues] => [
    kind,
    { ...defaultWealthValues(kind, home), ...values },
  ];
  const usIsHome = home === 'USD';
  const cnIsHome = home === 'CNY';
  return [
    item('income', {
      name: '工资',
      kind: 'salary',
      amount: '32000',
      period: 'monthly',
      currency: 'CNY',
    }),
    item('income', {
      name: '年终奖',
      kind: 'bonus',
      amount: '90000',
      period: 'annual',
      currency: 'CNY',
    }),
    item('income', {
      name: 'Freelance',
      kind: 'side',
      amount: '800',
      period: 'monthly',
      currency: 'USD',
    }),
    item('housing', {
      name: '上海的家',
      kind: 'mortgage',
      currency: 'CNY',
      balance: '1150000',
      ratePercent: '3.1',
      remainingMonths: '312',
      propertyValue: '3800000',
    }),
    item('insurance', {
      name: '百万医疗险',
      type: 'health',
      premium: '1200',
      premiumPeriod: 'annual',
      coverage: '3000000',
      currency: 'CNY',
    }),
    item('insurance', {
      name: '重疾险',
      type: 'critical_illness',
      premium: '8600',
      premiumPeriod: 'annual',
      coverage: '500000',
      currency: 'CNY',
    }),
    item('insurance', {
      name: '定期寿险',
      type: 'life',
      premium: '2800',
      premiumPeriod: 'annual',
      coverage: '1500000',
      currency: 'CNY',
    }),
    item('expense', { category: 'food', amount: '4500', currency: 'CNY', essential: true }),
    item('expense', { category: 'transport', amount: '800', currency: 'CNY', essential: true }),
    item('expense', { category: 'utilities', amount: '600', currency: 'CNY', essential: true }),
    item('expense', {
      category: 'family',
      label: '父母生活费',
      amount: '2000',
      currency: 'CNY',
      essential: true,
    }),
    item('expense', {
      category: 'entertainment',
      amount: '1500',
      currency: 'CNY',
      essential: false,
    }),
    item('expense', { category: 'travel', amount: '2000', currency: 'CNY', essential: false }),
    item('cash', {
      name: '招行储蓄',
      kind: 'savings',
      balance: '40000',
      currency: 'CNY',
      ratePercent: '1.25',
      isEmergencyFund: true,
    }),
    item('cash', {
      name: '余额宝',
      kind: 'money_market',
      balance: '25000',
      currency: 'CNY',
      ratePercent: '1.4',
    }),
    item('cash', { name: 'Schwab cash', kind: 'checking', balance: '3200', currency: 'USD' }),
    item('bond', {
      issuer: 'Apple Inc.',
      name: 'AAPL 4.65 02/23/46',
      faceValue: '10000',
      couponRate: '4.65',
      couponFrequency: '2',
      maturityDate: '2046-02-23',
      purchaseDate: '2025-03-12',
      purchasePrice: '92.5',
      currency: 'USD',
    }),
    item('bond', {
      issuer: 'JPMorgan Chase & Co.',
      name: 'JPM 5.35 06/01/34',
      faceValue: '10000',
      couponRate: '5.35',
      couponFrequency: '2',
      maturityDate: '2034-06-01',
      purchaseDate: '2025-08-04',
      purchasePrice: '101.4',
      currency: 'USD',
    }),
    item('bond', {
      issuer: 'Microsoft Corp.',
      name: 'MSFT 3.3 02/06/27',
      faceValue: '5000',
      couponRate: '3.3',
      couponFrequency: '2',
      maturityDate: '2027-02-06',
      purchaseDate: '2024-11-18',
      purchasePrice: '98.2',
      currency: 'USD',
    }),
    item('stock', {
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      assetClass: usIsHome ? 'domestic_equity' : 'international_equity',
      shares: '40',
      price: '250',
      costBasis: '8000',
      dividendPerShare: '0.9',
      dividendFrequency: '4',
      firstPayMonth: '3',
      currency: 'USD',
    }),
    item('stock', {
      ticker: 'VXUS',
      name: 'Vanguard Total International Stock ETF',
      assetClass: 'international_equity',
      shares: '100',
      price: '68',
      costBasis: '6100',
      dividendPerShare: '0.45',
      dividendFrequency: '4',
      firstPayMonth: '3',
      currency: 'USD',
    }),
    item('stock', {
      ticker: '510300',
      name: '沪深300ETF',
      assetClass: cnIsHome ? 'domestic_equity' : 'international_equity',
      shares: '20000',
      price: '4.05',
      costBasis: '76000',
      dividendPerShare: '0.07',
      dividendFrequency: '1',
      firstPayMonth: '1',
      currency: 'CNY',
    }),
  ];
}

export function loadDemoData(today: LocalDate, home: CurrencyCode): void {
  const forms: ProductFormValues[] = [
    product('credit_card', today, home, {
      name: '招行经典白金卡',
      issuer: '招商银行',
      currency: 'CNY',
      color: '#E5484D',
      creditLimit: '50000',
      balance: '8650',
      statementBalance: '6200',
      minimumPayment: '620',
      statementDay: 5,
      dueDay: 23,
      graceNote: '最长 50 天',
      annualFee: '300',
      feeWaiver: '每年刷卡 6 次',
    }),
    product('credit_card', today, home, {
      name: 'Sapphire Preferred',
      issuer: 'Chase',
      currency: 'USD',
      color: '#2A78D6',
      emoji: '✈️',
      creditLimit: '12000',
      balance: '1840.55',
      statementBalance: '1320.40',
      minimumPayment: '40',
      statementDay: 12,
      dueRule: 'days_after_statement',
      dueDaysAfterStatement: '25',
      interestRate: '21.49',
      interestRateUnit: 'apr',
      annualFee: '95',
    }),
    product('huabei', today, home, {
      name: '花呗',
      issuer: '支付宝',
      creditLimit: '15000',
      balance: '2380',
      statementBalance: '1560',
    }),
    product('baitiao', today, home, {
      name: '京东白条',
      issuer: '京东',
      creditLimit: '8000',
      balance: '699',
    }),
    product('jiebei', today, home, {
      name: '借呗',
      issuer: '支付宝',
      loanPrincipal: '12000',
      loanStartDate: addMonths(today, -3),
      loanTermMonths: '12',
      creditLimit: '50000',
    }),
    product('wangshangdai', today, home, {
      name: '网商贷',
      issuer: '网商银行',
      useSchedule: false,
      balance: '20000',
      minimumPayment: '1780',
      repaymentDay: 15,
    }),
  ];

  const ids = forms.map((form) => saveProduct(null, toProductFields(form, today)));

  // A little history on the first card. Undoing it restores the card exactly as it is now.
  const now = nowIso();
  const card = getDb().select().from(creditProducts).where(eq(creditProducts.id, ids[0])).get();
  getDb()
    .insert(payments)
    .values([
      {
        id: newId(),
        productId: ids[0],
        date: addDays(today, -28),
        amount: 5320,
        forDueDate: addDays(today, -28),
        installmentId: null,
        note: null,
        balanceReduction: 0,
        previousPaidThrough: card?.paidThrough ?? null,
        previousStatementBalance: card?.statementBalance ?? null,
        createdAt: now,
      },
    ])
    .run();

  const wealth = demoWealth(home).map(([kind, values]) => ({
    kind,
    id: saveWealthItem(kind, null, toWealthRecord(kind, values)),
  }));

  const previous = readSetting<DemoState>(DEMO_KEY);
  writeSetting(DEMO_KEY, {
    productIds: [...(previous?.productIds ?? []), ...ids],
    wealth: [...(previous?.wealth ?? []), ...wealth],
  } satisfies DemoState);
}

export function removeDemoData(): void {
  const state = readSetting<DemoState>(DEMO_KEY);
  const ids = state?.productIds ?? [];
  for (const { kind, id } of state?.wealth ?? []) deleteWealthItem(kind, id);
  if (ids.length > 0) {
    getDb().transaction((tx) => {
      tx.delete(payments).where(inArray(payments.productId, ids)).run();
      tx.delete(installments).where(inArray(installments.productId, ids)).run();
      tx.delete(creditProducts).where(inArray(creditProducts.id, ids)).run();
    });
  }
  writeSetting(DEMO_KEY, { productIds: [], wealth: [] } satisfies DemoState);
}
