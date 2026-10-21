import {
  CASH_KINDS,
  EXPENSE_CATEGORIES,
  HOUSING_KINDS,
  INCOME_KINDS,
  INCOME_PERIODS,
  INSURANCE_TYPES,
  PREMIUM_PERIODS,
} from './cashflow';
import { isLocalDate, type LocalDate } from './dates';
import { isCurrencyCode, roundMoney, type CurrencyCode } from './money';
import { parseDecimal, parseInteger, toInputText } from './numberInput';
import { ASSET_CLASSES } from './stocks';

/**
 * The portfolio inputs (income, housing, insurance, expenses, cash, bonds, stocks) are edited
 * with one generic form. Each kind is a list of field specs; the same specs drive rendering,
 * validation and the conversion between form text and stored values. Field keys equal the
 * database column names (a test keeps them in sync).
 */

export const WEALTH_KINDS = [
  'income',
  'housing',
  'insurance',
  'expense',
  'cash',
  'bond',
  'stock',
] as const;
export type WealthKind = (typeof WEALTH_KINDS)[number];

export function isWealthKind(value: unknown): value is WealthKind {
  return WEALTH_KINDS.includes(value as WealthKind);
}

export type FieldType =
  /** Free text; `notes` is multi-line. */
  | 'text'
  | 'notes'
  /** Money in the item's currency. */
  | 'amount'
  /** Percent per year. */
  | 'percent'
  /** Bond price in percent of face value (98.75). */
  | 'price'
  /** Any decimal number, e.g. a share count. */
  | 'number'
  | 'integer'
  | 'date'
  /** Month of the year, 1–12. */
  | 'month'
  | 'select'
  | 'switch'
  | 'currency';

export type WealthFormValues = Record<string, string | boolean>;

export type FieldSpec = {
  key: string;
  type: FieldType;
  required?: boolean | ((values: WealthFormValues) => boolean);
  visible?: (values: WealthFormValues) => boolean;
  /** Choices for `select`; stored as numbers when `numeric`. */
  options?: readonly string[];
  numeric?: boolean;
  /** Translation group for the option labels: `wealth.options.<optionSet>.<value>`. */
  optionSet?: string;
  initial?: string | boolean;
  positive?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  /** Has a hint at `wealth.hints.<key>`. */
  hint?: boolean;
  /** Has a placeholder at `wealth.placeholders.<kind>.<key>`. */
  placeholder?: boolean;
  /** Text transformed before saving. */
  uppercase?: boolean;
  /** Date checks relative to today. */
  date?: 'future' | 'past';
};

const strings = (values: readonly (string | number)[]) => values.map(String);
const when =
  (key: string, ...accepted: string[]) =>
  (values: WealthFormValues) =>
    accepted.includes(String(values[key]));

export const WEALTH_FIELDS: Record<WealthKind, FieldSpec[]> = {
  income: [
    { key: 'name', type: 'text', required: true, maxLength: 40, placeholder: true },
    {
      key: 'kind',
      type: 'select',
      options: INCOME_KINDS,
      optionSet: 'incomeKind',
      initial: 'salary',
    },
    { key: 'amount', type: 'amount', required: true, positive: true, hint: true },
    {
      key: 'period',
      type: 'select',
      options: INCOME_PERIODS,
      optionSet: 'period',
      initial: 'monthly',
    },
    { key: 'currency', type: 'currency' },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  housing: [
    { key: 'name', type: 'text', required: true, maxLength: 40, placeholder: true },
    {
      key: 'kind',
      type: 'select',
      options: HOUSING_KINDS,
      optionSet: 'housingKind',
      initial: 'mortgage',
    },
    { key: 'currency', type: 'currency' },
    {
      key: 'monthlyRent',
      type: 'amount',
      required: true,
      positive: true,
      visible: when('kind', 'rent'),
    },
    { key: 'balance', type: 'amount', required: true, visible: when('kind', 'mortgage') },
    { key: 'ratePercent', type: 'percent', max: 30, visible: when('kind', 'mortgage') },
    {
      key: 'remainingMonths',
      type: 'integer',
      min: 1,
      max: 480,
      visible: when('kind', 'mortgage'),
    },
    { key: 'monthlyPayment', type: 'amount', hint: true, visible: when('kind', 'mortgage') },
    {
      key: 'propertyValue',
      type: 'amount',
      hint: true,
      visible: when('kind', 'mortgage', 'owned'),
    },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  insurance: [
    { key: 'name', type: 'text', required: true, maxLength: 40, placeholder: true },
    {
      key: 'type',
      type: 'select',
      options: INSURANCE_TYPES,
      optionSet: 'insuranceType',
      initial: 'health',
    },
    { key: 'insurer', type: 'text', maxLength: 40 },
    { key: 'premium', type: 'amount', required: true, positive: true },
    {
      key: 'premiumPeriod',
      type: 'select',
      options: PREMIUM_PERIODS,
      optionSet: 'period',
      initial: 'annual',
    },
    { key: 'coverage', type: 'amount', hint: true },
    { key: 'currency', type: 'currency' },
    { key: 'renewalDate', type: 'date' },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  expense: [
    {
      key: 'category',
      type: 'select',
      options: EXPENSE_CATEGORIES,
      optionSet: 'expenseCategory',
      initial: 'food',
    },
    { key: 'label', type: 'text', maxLength: 40, placeholder: true },
    { key: 'amount', type: 'amount', required: true, positive: true, hint: true },
    { key: 'currency', type: 'currency' },
    { key: 'essential', type: 'switch', initial: true, hint: true },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  cash: [
    { key: 'name', type: 'text', required: true, maxLength: 40, placeholder: true },
    { key: 'kind', type: 'select', options: CASH_KINDS, optionSet: 'cashKind', initial: 'savings' },
    { key: 'balance', type: 'amount', required: true },
    { key: 'currency', type: 'currency' },
    { key: 'ratePercent', type: 'percent', max: 30 },
    { key: 'isEmergencyFund', type: 'switch', initial: false, hint: true },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  bond: [
    { key: 'issuer', type: 'text', required: true, maxLength: 60, placeholder: true },
    { key: 'name', type: 'text', maxLength: 60, placeholder: true },
    { key: 'identifier', type: 'text', maxLength: 12, uppercase: true, hint: true },
    { key: 'faceValue', type: 'amount', required: true, positive: true, hint: true },
    { key: 'couponRate', type: 'percent', required: true, max: 30 },
    {
      key: 'couponFrequency',
      type: 'select',
      options: strings([2, 1, 4, 12, 0]),
      numeric: true,
      optionSet: 'couponFrequency',
      initial: '2',
    },
    { key: 'maturityDate', type: 'date', required: true, date: 'future' },
    { key: 'purchaseDate', type: 'date', date: 'past' },
    { key: 'purchasePrice', type: 'price', positive: true, max: 300, hint: true },
    { key: 'currentPrice', type: 'price', positive: true, max: 300, hint: true },
    { key: 'currency', type: 'currency', initial: 'USD' },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
  stock: [
    {
      key: 'ticker',
      type: 'text',
      required: true,
      maxLength: 12,
      uppercase: true,
      placeholder: true,
    },
    { key: 'name', type: 'text', maxLength: 60, placeholder: true },
    {
      key: 'assetClass',
      type: 'select',
      options: ASSET_CLASSES,
      optionSet: 'assetClass',
      initial: 'domestic_equity',
    },
    { key: 'shares', type: 'number', required: true, positive: true },
    { key: 'price', type: 'amount', required: true, positive: true, hint: true },
    { key: 'costBasis', type: 'amount', hint: true },
    { key: 'dividendPerShare', type: 'amount', hint: true },
    {
      key: 'dividendFrequency',
      type: 'select',
      options: strings([4, 12, 2, 1, 0]),
      numeric: true,
      optionSet: 'dividendFrequency',
      initial: '4',
    },
    {
      key: 'firstPayMonth',
      type: 'month',
      hint: true,
      visible: (values) => values.dividendFrequency !== '0',
    },
    { key: 'currency', type: 'currency' },
    { key: 'notes', type: 'notes', maxLength: 300 },
  ],
};

export function isVisible(spec: FieldSpec, values: WealthFormValues): boolean {
  return spec.visible ? spec.visible(values) : true;
}

function isRequired(spec: FieldSpec, values: WealthFormValues): boolean {
  return typeof spec.required === 'function' ? spec.required(values) : spec.required === true;
}

const NUMERIC_TYPES: FieldType[] = ['amount', 'percent', 'price', 'number', 'integer', 'month'];

export function defaultWealthValues(
  kind: WealthKind,
  homeCurrency: CurrencyCode
): WealthFormValues {
  const values: WealthFormValues = {};
  for (const spec of WEALTH_FIELDS[kind]) {
    if (spec.type === 'switch') values[spec.key] = spec.initial === true;
    else if (spec.type === 'currency') values[spec.key] = String(spec.initial ?? homeCurrency);
    else if (spec.type === 'select')
      values[spec.key] = String(spec.initial ?? spec.options?.[0] ?? '');
    else values[spec.key] = typeof spec.initial === 'string' ? spec.initial : '';
  }
  return values;
}

export type WealthFormErrors = Record<string, string>;

/** CUSIP (9 characters) or ISIN (12 characters), letters and digits. */
export function isSecurityIdentifier(text: string): boolean {
  return /^[A-Z0-9]{9}$/.test(text) || /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(text);
}

/** Every problem at once, as i18n keys under `form.errors`. Hidden fields are not checked. */
export function validateWealthForm(
  kind: WealthKind,
  values: WealthFormValues,
  today: LocalDate
): WealthFormErrors {
  const errors: WealthFormErrors = {};
  for (const spec of WEALTH_FIELDS[kind]) {
    if (!isVisible(spec, values)) continue;
    const raw = values[spec.key];
    const text = typeof raw === 'string' ? raw.trim() : '';
    const required = isRequired(spec, values);
    const fail = (message: string) => {
      errors[spec.key] ??= message;
    };

    if (spec.type === 'switch') continue;
    if (spec.type === 'currency') {
      if (!isCurrencyCode(text)) fail('required');
      continue;
    }
    if (spec.type === 'select') {
      if (!spec.options?.includes(text)) fail('required');
      continue;
    }
    if (text === '') {
      if (required) fail('required');
      continue;
    }
    if (spec.type === 'text' || spec.type === 'notes') {
      if (spec.maxLength != null && text.length > spec.maxLength) fail('tooLong');
      if (spec.key === 'identifier' && !isSecurityIdentifier(text.toUpperCase()))
        fail('identifier');
      continue;
    }
    if (spec.type === 'date') {
      if (!isLocalDate(text)) fail('required');
      else if (spec.date === 'future' && text <= today) fail('mustBeFuture');
      else if (spec.date === 'past' && text > today) fail('mustBePast');
      continue;
    }
    if (NUMERIC_TYPES.includes(spec.type)) {
      const integer = spec.type === 'integer' || spec.type === 'month';
      const value = integer ? parseInteger(text) : parseDecimal(text);
      if (value === null) {
        if (required) fail('required');
      } else if (Number.isNaN(value)) fail(integer ? 'wholeNumber' : 'number');
      else if (value < 0) fail('nonNegative');
      else if (spec.positive && value === 0) fail('positive');
      else if (spec.type === 'month' && (value < 1 || value > 12)) fail('monthRange');
      else if (spec.min != null && value < spec.min) fail('tooSmall');
      else if (spec.max != null && value > spec.max) fail('tooLarge');
    }
  }

  if (kind === 'bond') {
    const purchase = String(values.purchaseDate ?? '');
    const maturity = String(values.maturityDate ?? '');
    if (isLocalDate(purchase) && isLocalDate(maturity) && purchase >= maturity) {
      errors.purchaseDate ??= 'beforeMaturity';
    }
  }
  return errors;
}

export type WealthRecord = Record<string, string | number | boolean | null>;

/** Converts valid form values into stored values (numbers rounded, empty text to null). */
export function toWealthRecord(kind: WealthKind, values: WealthFormValues): WealthRecord {
  const currency = String(values.currency ?? 'CNY') as CurrencyCode;
  const record: WealthRecord = {};
  for (const spec of WEALTH_FIELDS[kind]) {
    const raw = values[spec.key];
    const visible = isVisible(spec, values);
    const text = typeof raw === 'string' ? raw.trim() : '';
    switch (spec.type) {
      case 'switch':
        record[spec.key] = raw === true;
        break;
      case 'currency':
        record[spec.key] = text;
        break;
      case 'select':
        record[spec.key] = spec.numeric ? Number(text) : text;
        break;
      case 'text':
      case 'notes':
      case 'date': {
        const value = spec.uppercase ? text.toUpperCase() : text;
        record[spec.key] = visible && value !== '' ? value : null;
        break;
      }
      default: {
        const integer = spec.type === 'integer' || spec.type === 'month';
        const parsed = integer ? parseInteger(text) : parseDecimal(text);
        const value = visible && parsed != null && !Number.isNaN(parsed) ? parsed : null;
        record[spec.key] =
          value != null && spec.type === 'amount' ? roundMoney(value, currency) : value;
      }
    }
  }
  return record;
}

/** The inverse of `toWealthRecord`, for editing a stored item. */
export function fromWealthRecord(
  kind: WealthKind,
  row: Record<string, unknown>,
  homeCurrency: CurrencyCode
): WealthFormValues {
  const values = defaultWealthValues(kind, homeCurrency);
  for (const spec of WEALTH_FIELDS[kind]) {
    const value = row[spec.key];
    if (value == null) continue;
    if (spec.type === 'switch') values[spec.key] = value === true || value === 1;
    else if (typeof value === 'number') {
      values[spec.key] =
        spec.type === 'select' ? String(value) : toInputText(value, spec.type === 'amount' ? 2 : 6);
    } else values[spec.key] = String(value);
  }
  return values;
}

/** Field keys in display order, for tests and tooling. */
export function wealthFieldKeys(kind: WealthKind): string[] {
  return WEALTH_FIELDS[kind].map((spec) => spec.key);
}
