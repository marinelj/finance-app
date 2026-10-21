import { z } from 'zod';

import {
  billingCycleOf,
  initialPaidThrough,
  monthlyRepaymentCycle,
  type BillingCycle,
} from './billingCycle';
import {
  aprPercent,
  DUE_RULE_TYPES,
  PRODUCT_KINDS,
  PRODUCT_PRESETS,
  RATE_UNITS,
  REPAYMENT_METHODS,
  type CreditProduct,
  type DueRuleType,
  type Installment,
  type PresetKey,
  type ProductKind,
  type RateUnit,
  type RepaymentMethod,
} from './credit';
import { isLocalDate, parseLocalDate, type LocalDate } from './dates';
import { generateSchedule, type ScheduledInstallment } from './loans';
import { CURRENCY_CODES, roundMoney, type CurrencyCode } from './money';
import { parseDecimal, parseInteger, toInputText } from './numberInput';

/**
 * The add/edit credit product form: raw field values (numbers stay text while typed), one
 * validation pass that reports every problem at once, and the conversion to stored fields.
 * Error messages are i18n keys under `form.errors`.
 */

export type ProductFormValues = {
  name: string;
  issuer: string;
  kind: ProductKind;
  preset: PresetKey | null;
  customTypeId: string | null;
  currency: CurrencyCode;
  color: string;
  emoji: string;
  creditLimit: string;
  balance: string;
  statementBalance: string;
  minimumPayment: string;
  statementDay: number | null;
  dueRule: DueRuleType;
  dueDay: number | null;
  dueDaysAfterStatement: string;
  hasGracePeriod: boolean;
  graceNote: string;
  interestRate: string;
  interestRateUnit: RateUnit;
  annualFee: string;
  feeWaiver: string;
  repaymentDay: number | null;
  /** Loans: generate the installment schedule from the loan terms. */
  useSchedule: boolean;
  loanPrincipal: string;
  loanStartDate: LocalDate;
  loanTermMonths: string;
  repaymentMethod: RepaymentMethod;
  notes: string;
  isActive: boolean;
};

export type ProductFormField = keyof ProductFormValues;

export const MAX_NAME_LENGTH = 40;
export const MAX_LOAN_TERM_MONTHS = 360;
export const MAX_DAYS_AFTER_STATEMENT = 60;
export const MAX_DAILY_RATE_PERCENT = 1;
export const MAX_APR_PERCENT = 100;

/** Products billed in statement cycles (revolving credit, and "other" when a cycle is set). */
export function usesStatementCycle(kind: ProductKind): boolean {
  return kind !== 'installment_loan';
}

export function isLoanKind(kind: ProductKind): boolean {
  return kind === 'installment_loan';
}

/** Kinds that must have a statement day and due date to be useful. */
function requiresCycle(kind: ProductKind): boolean {
  return kind === 'credit_card' || kind === 'revolving_bnpl';
}

/** Products only offered in mainland China default to CNY; cards follow the home currency. */
const CNY_ONLY: PresetKey[] = ['huabei', 'baitiao', 'jiebei', 'wangshangdai', 'weilidai'];

export type CustomTypeTemplate = {
  id: string;
  kind: ProductKind;
  hasGracePeriod: boolean;
  emoji: string;
  color: string;
};

export function defaultFormValues(options: {
  preset?: PresetKey;
  customType?: CustomTypeTemplate;
  name?: string;
  homeCurrency: CurrencyCode;
  today: LocalDate;
}): ProductFormValues {
  const { customType, homeCurrency, today } = options;
  const preset = PRODUCT_PRESETS[options.preset ?? (customType ? 'other' : 'credit_card')];
  const kind = customType?.kind ?? preset.kind;
  const loan = isLoanKind(kind);
  const presetKey = customType ? null : preset.key;
  return {
    name: options.name ?? '',
    issuer: '',
    kind,
    preset: presetKey,
    customTypeId: customType?.id ?? null,
    currency: presetKey && CNY_ONLY.includes(presetKey) ? 'CNY' : homeCurrency,
    color: customType?.color ?? preset.color,
    emoji: customType?.emoji ?? preset.emoji,
    creditLimit: '',
    balance: '',
    statementBalance: '',
    minimumPayment: '',
    statementDay: preset.statementDay ?? null,
    dueRule: preset.dueRule ?? 'fixed_day',
    dueDay: preset.dueDay ?? null,
    dueDaysAfterStatement: toInputText(preset.dueDaysAfterStatement),
    hasGracePeriod: loan ? false : (customType?.hasGracePeriod ?? preset.hasGracePeriod),
    graceNote: '',
    interestRate: toInputText(preset.interestRate),
    interestRateUnit: preset.interestRateUnit ?? 'apr',
    annualFee: '',
    feeWaiver: '',
    repaymentDay: null,
    useSchedule: loan,
    loanPrincipal: '',
    loanStartDate: today,
    loanTermMonths: toInputText(preset.loanTermMonths ?? (loan ? 12 : null)),
    repaymentMethod: preset.repaymentMethod ?? 'equal_installment',
    notes: '',
    isActive: true,
  };
}

/** Stored product fields the form edits (everything except ids and timestamps). */
export type ProductFields = Omit<CreditProduct, 'id'> & {
  preset: PresetKey | null;
  customTypeId: string | null;
  color: string;
  emoji: string;
  graceNote: string | null;
  annualFee: number | null;
  feeWaiver: string | null;
  loanPrincipal: number | null;
  loanStartDate: LocalDate | null;
  loanTermMonths: number | null;
  repaymentMethod: RepaymentMethod | null;
  notes: string | null;
};

export function formValuesFromProduct(
  product: ProductFields,
  hasSchedule: boolean,
  today: LocalDate
): ProductFormValues {
  const money = (value: number | null) => toInputText(value, 2);
  return {
    name: product.name,
    issuer: product.issuer,
    kind: product.kind,
    preset: product.preset,
    customTypeId: product.customTypeId,
    currency: product.currency,
    color: product.color,
    emoji: product.emoji,
    creditLimit: product.creditLimit > 0 ? money(product.creditLimit) : '',
    balance: money(product.balance),
    statementBalance: money(product.statementBalance),
    minimumPayment: money(product.minimumPayment),
    statementDay: product.statementDay,
    dueRule: product.dueRule ?? 'fixed_day',
    dueDay: product.dueDay,
    dueDaysAfterStatement: toInputText(product.dueDaysAfterStatement),
    hasGracePeriod: product.hasGracePeriod,
    graceNote: product.graceNote ?? '',
    interestRate: toInputText(product.interestRate),
    interestRateUnit: product.interestRateUnit ?? 'apr',
    annualFee: money(product.annualFee),
    feeWaiver: product.feeWaiver ?? '',
    repaymentDay: product.repaymentDay,
    useSchedule: hasSchedule,
    loanPrincipal: money(product.loanPrincipal),
    loanStartDate: product.loanStartDate ?? today,
    loanTermMonths: toInputText(product.loanTermMonths),
    repaymentMethod: product.repaymentMethod ?? 'equal_installment',
    notes: product.notes ?? '',
    isActive: product.isActive,
  };
}

const dayOfMonth = z.number().int().min(1).max(31).nullable();

/** Shape check only; every rule that can fail lives in `superRefine` so all errors show at once. */
const shape = z.object({
  name: z.string(),
  issuer: z.string(),
  kind: z.enum(PRODUCT_KINDS),
  preset: z.string().nullable(),
  customTypeId: z.string().nullable(),
  currency: z.enum(CURRENCY_CODES),
  color: z.string(),
  emoji: z.string(),
  creditLimit: z.string(),
  balance: z.string(),
  statementBalance: z.string(),
  minimumPayment: z.string(),
  statementDay: dayOfMonth,
  dueRule: z.enum(DUE_RULE_TYPES),
  dueDay: dayOfMonth,
  dueDaysAfterStatement: z.string(),
  hasGracePeriod: z.boolean(),
  graceNote: z.string(),
  interestRate: z.string(),
  interestRateUnit: z.enum(RATE_UNITS),
  annualFee: z.string(),
  feeWaiver: z.string(),
  repaymentDay: dayOfMonth,
  useSchedule: z.boolean(),
  loanPrincipal: z.string(),
  loanStartDate: z.string(),
  loanTermMonths: z.string(),
  repaymentMethod: z.enum(REPAYMENT_METHODS),
  notes: z.string(),
  isActive: z.boolean(),
});

export const productFormSchema = shape.superRefine((values, ctx) => {
  const fail = (path: ProductFormField, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });

  /** Validates an optional non-negative amount and returns it (null when empty or invalid). */
  const amount = (field: ProductFormField, required = false): number | null => {
    const value = parseDecimal(values[field] as string);
    if (value === null) {
      if (required) fail(field, 'required');
      return null;
    }
    if (Number.isNaN(value)) fail(field, 'number');
    else if (value < 0) fail(field, 'nonNegative');
    else return value;
    return null;
  };

  const name = values.name.trim();
  if (!name) fail('name', 'required');
  else if (name.length > MAX_NAME_LENGTH) fail('name', 'tooLong');

  const loan = isLoanKind(values.kind);
  const scheduled = loan && values.useSchedule;

  amount('creditLimit');
  const balance = scheduled ? null : amount('balance');
  const minimum = scheduled ? null : amount('minimumPayment');
  amount('annualFee');

  if (!loan) {
    const bill = amount('statementBalance');
    if (bill != null && balance != null && bill > balance)
      fail('statementBalance', 'billOverBalance');
    if (minimum != null && bill != null && minimum > bill)
      fail('minimumPayment', 'minimumOverBill');

    const hasCycleInput = values.statementDay != null;
    if (requiresCycle(values.kind) || hasCycleInput) {
      if (values.statementDay == null) fail('statementDay', 'required');
      if (values.dueRule === 'fixed_day') {
        if (values.dueDay == null) fail('dueDay', 'required');
      } else {
        const days = parseInteger(values.dueDaysAfterStatement);
        if (days === null) fail('dueDaysAfterStatement', 'required');
        else if (Number.isNaN(days)) fail('dueDaysAfterStatement', 'wholeNumber');
        else if (days < 1 || days > MAX_DAYS_AFTER_STATEMENT) {
          fail('dueDaysAfterStatement', 'daysAfterRange');
        }
      }
    }
  }

  const rate = parseDecimal(values.interestRate);
  if (rate === null) {
    if (scheduled) fail('interestRate', 'required');
  } else if (Number.isNaN(rate)) fail('interestRate', 'number');
  else if (rate < 0) fail('interestRate', 'nonNegative');
  else if (values.interestRateUnit === 'daily' && rate > MAX_DAILY_RATE_PERCENT) {
    fail('interestRate', 'dailyRateTooHigh');
  } else if (values.interestRateUnit === 'apr' && rate > MAX_APR_PERCENT) {
    fail('interestRate', 'aprTooHigh');
  }

  if (scheduled) {
    const principal = parseDecimal(values.loanPrincipal);
    if (principal === null) fail('loanPrincipal', 'required');
    else if (Number.isNaN(principal)) fail('loanPrincipal', 'number');
    else if (principal <= 0) fail('loanPrincipal', 'positive');

    const term = parseInteger(values.loanTermMonths);
    if (term === null) fail('loanTermMonths', 'required');
    else if (Number.isNaN(term)) fail('loanTermMonths', 'wholeNumber');
    else if (term < 1 || term > MAX_LOAN_TERM_MONTHS) fail('loanTermMonths', 'termRange');

    if (!isLocalDate(values.loanStartDate)) fail('loanStartDate', 'required');
  }
});

export type ProductFormErrors = Partial<Record<ProductFormField, string>>;

export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const result = productFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: ProductFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ProductFormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

type ExistingProduct = {
  product: ProductFields;
  installments: Installment[];
};

export type ScheduleChange = {
  /** The full new schedule; replaces every stored installment of the product. */
  installments: (Omit<Installment, 'id' | 'productId'> & { remaining: number })[];
};

export type ProductSaveResult = {
  fields: ProductFields;
  /** Present when the stored installments must be replaced (possibly with none). */
  schedule: ScheduleChange | null;
};

function cycleOf(fields: ProductFields): BillingCycle | null {
  if (isLoanKind(fields.kind)) {
    return fields.repaymentDay != null ? monthlyRepaymentCycle(fields.repaymentDay) : null;
  }
  return billingCycleOf(fields);
}

function sameCycle(a: BillingCycle | null, b: BillingCycle | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const LOAN_TERM_FIELDS = [
  'loanPrincipal',
  'interestRate',
  'interestRateUnit',
  'loanStartDate',
  'loanTermMonths',
  'repaymentMethod',
  'repaymentDay',
  'currency',
] as const;

/**
 * Turns valid form values into stored fields. New products start their payment history so the
 * open bill counts as unpaid while anything is owed (better one reminder too many than a missed
 * due date). Loans with a schedule get their installments regenerated whenever the loan terms
 * change; installments due before today, or already paid, are marked paid and the balance is the
 * principal still outstanding.
 */
export function toProductFields(
  values: ProductFormValues,
  today: LocalDate,
  existing?: ExistingProduct
): ProductSaveResult {
  const money = (value: number | null) =>
    value == null || Number.isNaN(value) ? null : roundMoney(value, values.currency);
  const text = (value: string) => (value.trim() ? value.trim() : null);
  const number = (value: string) => {
    const parsed = parseDecimal(value);
    return parsed == null || Number.isNaN(parsed) ? null : parsed;
  };

  const loan = isLoanKind(values.kind);
  const scheduled = loan && values.useSchedule;
  const cycleSet = !loan && values.statementDay != null;
  const fixedDay = cycleSet && values.dueRule === 'fixed_day';
  const daysAfter = cycleSet && values.dueRule === 'days_after_statement';

  const fields: ProductFields = {
    name: values.name.trim(),
    issuer: values.issuer.trim(),
    kind: values.kind,
    preset: values.preset,
    customTypeId: values.customTypeId,
    currency: values.currency,
    color: values.color,
    emoji: values.emoji,
    creditLimit: money(number(values.creditLimit)) ?? 0,
    balance: money(number(values.balance)) ?? 0,
    statementBalance: loan ? null : money(number(values.statementBalance)),
    minimumPayment: scheduled ? null : money(number(values.minimumPayment)),
    statementDay: cycleSet ? values.statementDay : null,
    dueRule: cycleSet ? values.dueRule : null,
    dueDay: fixedDay ? values.dueDay : null,
    dueDaysAfterStatement: daysAfter ? parseInteger(values.dueDaysAfterStatement) : null,
    hasGracePeriod: !loan && values.hasGracePeriod,
    graceNote: !loan && values.hasGracePeriod ? text(values.graceNote) : null,
    interestRate: number(values.interestRate),
    interestRateUnit: number(values.interestRate) == null ? null : values.interestRateUnit,
    annualFee: money(number(values.annualFee)),
    feeWaiver: text(values.feeWaiver),
    repaymentDay: loan
      ? (values.repaymentDay ??
        (scheduled && isLocalDate(values.loanStartDate)
          ? parseLocalDate(values.loanStartDate).day
          : null))
      : null,
    loanPrincipal: scheduled ? money(number(values.loanPrincipal)) : null,
    loanStartDate: scheduled ? values.loanStartDate : null,
    loanTermMonths: scheduled ? parseInteger(values.loanTermMonths) : null,
    repaymentMethod: scheduled ? values.repaymentMethod : null,
    paidThrough: existing?.product.paidThrough ?? null,
    notes: text(values.notes),
    isActive: values.isActive,
  };

  let schedule: ScheduleChange | null = null;
  if (scheduled) {
    const hadSchedule = (existing?.installments.length ?? 0) > 0;
    const termsChanged =
      !existing ||
      !hadSchedule ||
      LOAN_TERM_FIELDS.some((key) => existing.product[key] !== fields[key]);
    if (termsChanged) {
      schedule = { installments: buildSchedule(fields, today, existing?.installments ?? []) };
      const paid = schedule.installments.filter((item) => item.paidAt != null);
      const principal = fields.loanPrincipal ?? 0;
      fields.balance = paid.length > 0 ? paid[paid.length - 1].remaining : principal;
    } else {
      fields.balance = existing.product.balance;
    }
    fields.paidThrough = null;
  } else {
    if (existing && existing.installments.length > 0) schedule = { installments: [] };
    const before = existing ? cycleOf(existing.product) : null;
    const after = cycleOf(fields);
    if (!after) fields.paidThrough = null;
    else if (!existing || !sameCycle(before, after)) {
      const owed =
        fields.statementBalance != null
          ? fields.statementBalance > 0
          : fields.balance > 0 || (fields.minimumPayment ?? 0) > 0;
      fields.paidThrough = initialPaidThrough(today, after, owed);
    }
  }

  return { fields, schedule };
}

function buildSchedule(
  fields: ProductFields,
  today: LocalDate,
  previous: Installment[]
): ScheduleChange['installments'] {
  const apr = aprPercent(fields.interestRate, fields.interestRateUnit) ?? 0;
  const generated: ScheduledInstallment[] = generateSchedule({
    principal: fields.loanPrincipal ?? 0,
    aprPercent: apr,
    startDate: fields.loanStartDate ?? today,
    termMonths: fields.loanTermMonths ?? 0,
    repaymentDay: fields.repaymentDay,
    method: fields.repaymentMethod ?? 'equal_installment',
    currency: fields.currency,
  });
  const paidBefore = new Map(
    previous.filter((item) => item.paidAt != null).map((item) => [item.seq, item.paidAt])
  );
  return generated.map((item) => ({
    seq: item.seq,
    dueDate: item.dueDate,
    principal: item.principal,
    interest: item.interest,
    amount: item.amount,
    remaining: item.remaining,
    paidAt: paidBefore.get(item.seq) ?? (item.dueDate < today ? item.dueDate : null),
  }));
}

/** Live preview of a loan schedule while the form is being filled in; null until it is valid. */
export function previewSchedule(values: ProductFormValues): ScheduledInstallment[] | null {
  if (!isLoanKind(values.kind) || !values.useSchedule) return null;
  const principal = parseDecimal(values.loanPrincipal);
  const term = parseInteger(values.loanTermMonths);
  const rate = parseDecimal(values.interestRate);
  if (principal == null || Number.isNaN(principal) || principal <= 0) return null;
  if (term == null || Number.isNaN(term) || term < 1 || term > MAX_LOAN_TERM_MONTHS) return null;
  if (rate == null || Number.isNaN(rate) || rate < 0) return null;
  if (!isLocalDate(values.loanStartDate)) return null;
  return generateSchedule({
    principal,
    aprPercent: aprPercent(rate, values.interestRateUnit) ?? 0,
    startDate: values.loanStartDate,
    termMonths: term,
    repaymentDay: values.repaymentDay,
    method: values.repaymentMethod,
    currency: values.currency,
  });
}
