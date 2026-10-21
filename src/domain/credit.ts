import type { LocalDate } from './dates';
import type { CurrencyCode } from './money';

export const PRODUCT_KINDS = [
  'credit_card',
  'revolving_bnpl',
  'installment_loan',
  'other',
] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const DUE_RULE_TYPES = ['fixed_day', 'days_after_statement'] as const;
export type DueRuleType = (typeof DUE_RULE_TYPES)[number];

export const RATE_UNITS = ['apr', 'daily'] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

export const REPAYMENT_METHODS = [
  'equal_installment',
  'equal_principal',
  'interest_first',
] as const;
export type RepaymentMethod = (typeof REPAYMENT_METHODS)[number];

/**
 * The fields of a credit product that the finance logic needs. Database rows satisfy this type
 * structurally. Amounts are in the product's own currency; rates are percentages
 * (`18` = 18% APR, `0.03` = 0.03% per day).
 */
export type CreditProduct = {
  id: string;
  name: string;
  issuer: string;
  kind: ProductKind;
  currency: CurrencyCode;
  creditLimit: number;
  /** Everything owed right now, billed or not. */
  balance: number;
  /** The current bill to pay by the next due date; null until the user enters it. */
  statementBalance: number | null;
  minimumPayment: number | null;
  statementDay: number | null;
  dueRule: DueRuleType | null;
  dueDay: number | null;
  dueDaysAfterStatement: number | null;
  hasGracePeriod: boolean;
  interestRate: number | null;
  interestRateUnit: RateUnit | null;
  repaymentDay: number | null;
  /** Due date of the latest bill the user marked as paid. */
  paidThrough: LocalDate | null;
  isActive: boolean;
};

export type Installment = {
  id: string;
  productId: string;
  seq: number;
  dueDate: LocalDate;
  principal: number;
  interest: number;
  amount: number;
  paidAt: LocalDate | null;
};

/** Kinds that revolve against a limit and count towards credit utilization. */
export function isRevolving(kind: ProductKind): boolean {
  return kind === 'credit_card' || kind === 'revolving_bnpl';
}

/** Annual rate in percent, converting daily quotes with a 365-day year (0.03%/day → 10.95%). */
export function aprPercent(rate: number | null, unit: RateUnit | null): number | null {
  if (rate == null || unit == null) return null;
  return unit === 'daily' ? rate * 365 : rate;
}

/** Daily rate in percent (18% APR → 0.0493%/day). */
export function dailyRatePercent(rate: number | null, unit: RateUnit | null): number | null {
  if (rate == null || unit == null) return null;
  return unit === 'daily' ? rate : rate / 365;
}

export const PRESET_KEYS = [
  'credit_card',
  'huabei',
  'baitiao',
  'jiebei',
  'wangshangdai',
  'weilidai',
  'other',
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export type ProductPreset = {
  key: PresetKey;
  kind: ProductKind;
  emoji: string;
  color: string;
  currency: CurrencyCode;
  hasGracePeriod: boolean;
  statementDay?: number;
  dueRule?: DueRuleType;
  dueDay?: number;
  dueDaysAfterStatement?: number;
  interestRate?: number;
  interestRateUnit?: RateUnit;
  repaymentMethod?: RepaymentMethod;
  loanTermMonths?: number;
};

/**
 * Starting values for common products. They are typical terms, not facts about any account:
 * every field stays editable.
 */
export const PRODUCT_PRESETS: Record<PresetKey, ProductPreset> = {
  credit_card: {
    key: 'credit_card',
    kind: 'credit_card',
    emoji: '💳',
    color: '#6C4DFF',
    currency: 'CNY',
    hasGracePeriod: true,
    statementDay: 5,
    dueRule: 'fixed_day',
    dueDay: 23,
    interestRate: 0.05,
    interestRateUnit: 'daily',
  },
  huabei: {
    key: 'huabei',
    kind: 'revolving_bnpl',
    emoji: '🌸',
    color: '#1677FF',
    currency: 'CNY',
    hasGracePeriod: true,
    // The bill covers a calendar month and is due on the 10th.
    statementDay: 31,
    dueRule: 'fixed_day',
    dueDay: 10,
    interestRate: 0.05,
    interestRateUnit: 'daily',
  },
  baitiao: {
    key: 'baitiao',
    kind: 'revolving_bnpl',
    emoji: '🛒',
    color: '#E5484D',
    currency: 'CNY',
    hasGracePeriod: true,
    statementDay: 31,
    dueRule: 'days_after_statement',
    dueDaysAfterStatement: 9,
    interestRate: 0.05,
    interestRateUnit: 'daily',
  },
  jiebei: {
    key: 'jiebei',
    kind: 'installment_loan',
    emoji: '💰',
    color: '#0FB5AE',
    currency: 'CNY',
    hasGracePeriod: false,
    interestRate: 0.03,
    interestRateUnit: 'daily',
    repaymentMethod: 'equal_installment',
    loanTermMonths: 12,
  },
  wangshangdai: {
    key: 'wangshangdai',
    kind: 'installment_loan',
    emoji: '🏦',
    color: '#F5A524',
    currency: 'CNY',
    hasGracePeriod: false,
    interestRate: 0.04,
    interestRateUnit: 'daily',
    repaymentMethod: 'equal_installment',
    loanTermMonths: 12,
  },
  weilidai: {
    key: 'weilidai',
    kind: 'installment_loan',
    emoji: '🟢',
    color: '#1BAF7A',
    currency: 'CNY',
    hasGracePeriod: false,
    interestRate: 0.04,
    interestRateUnit: 'daily',
    repaymentMethod: 'equal_installment',
    loanTermMonths: 10,
  },
  other: {
    key: 'other',
    kind: 'other',
    emoji: '✨',
    color: '#2B2B44',
    currency: 'CNY',
    hasGracePeriod: false,
  },
};

/** Card colours offered in the editor. */
export const PRODUCT_COLORS = [
  '#6C4DFF',
  '#2A78D6',
  '#1677FF',
  '#0FB5AE',
  '#1BAF7A',
  '#F5A524',
  '#EB6834',
  '#E5484D',
  '#E8457C',
  '#B5179E',
  '#2B2B44',
] as const;

export const PRODUCT_EMOJIS = [
  '💳',
  '🌸',
  '🛒',
  '💰',
  '🏦',
  '🟢',
  '✨',
  '🧧',
  '🏠',
  '🚗',
  '✈️',
  '🎓',
];
