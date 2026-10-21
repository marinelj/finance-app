import { eq, inArray } from 'drizzle-orm';

import { addDays, addMonths, type LocalDate } from '@/domain/dates';
import type { PresetKey } from '@/domain/credit';
import { defaultFormValues, toProductFields, type ProductFormValues } from '@/domain/productForm';
import type { CurrencyCode } from '@/domain/money';

import { getDb } from './client';
import { saveProduct } from './credit';
import { newId, nowIso } from './ids';
import { readSetting, writeSetting } from './settings';
import { creditProducts, installments, payments } from './schema';

/**
 * Sample data for exploring the app. Only ever loaded from the "Load demo data" button, and
 * tracked by id so "Remove demo data" deletes exactly what it added.
 */

const DEMO_KEY = 'demo';

type DemoState = { productIds: string[] };

function product(
  preset: PresetKey,
  today: LocalDate,
  home: CurrencyCode,
  overrides: Partial<ProductFormValues>
): ProductFormValues {
  return { ...defaultFormValues({ preset, homeCurrency: home, today }), ...overrides };
}

export function hasDemoData(): boolean {
  return (readSetting<DemoState>(DEMO_KEY)?.productIds.length ?? 0) > 0;
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

  const previous = readSetting<DemoState>(DEMO_KEY)?.productIds ?? [];
  writeSetting(DEMO_KEY, { productIds: [...previous, ...ids] } satisfies DemoState);
}

export function removeDemoData(): void {
  const ids = readSetting<DemoState>(DEMO_KEY)?.productIds ?? [];
  if (ids.length > 0) {
    getDb().transaction((tx) => {
      tx.delete(payments).where(inArray(payments.productId, ids)).run();
      tx.delete(installments).where(inArray(installments.productId, ids)).run();
      tx.delete(creditProducts).where(inArray(creditProducts.id, ids)).run();
    });
  }
  writeSetting(DEMO_KEY, { productIds: [] } satisfies DemoState);
}
