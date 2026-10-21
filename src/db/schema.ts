import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import {
  DUE_RULE_TYPES,
  PRESET_KEYS,
  PRODUCT_KINDS,
  RATE_UNITS,
  REPAYMENT_METHODS,
} from '../domain/credit';
import {
  CASH_KINDS,
  EXPENSE_CATEGORIES,
  HOUSING_KINDS,
  INCOME_KINDS,
  INCOME_PERIODS,
  INSURANCE_TYPES,
  PREMIUM_PERIODS,
} from '../domain/cashflow';
import { CURRENCY_CODES } from '../domain/money';
import { ASSET_CLASSES } from '../domain/stocks';

/**
 * Local database schema. Money is stored as REAL in major units (yuan, dollars) and rounded to
 * the currency's minor unit on write; rates are percentages; dates are `YYYY-MM-DD` strings in
 * the device's calendar; timestamps are ISO 8601.
 *
 * After changing this file run `npm run db:generate` to create a migration.
 */

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

/** App preferences as JSON values, e.g. key "preferences". */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Units of each currency per 1 USD, edited by the user. */
export const fxRates = sqliteTable('fx_rates', {
  currency: text('currency', { enum: CURRENCY_CODES }).primaryKey(),
  unitsPerUsd: real('units_per_usd').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** User-defined product types such as "分期乐", mapped onto one of the built-in kinds. */
export const customProductTypes = sqliteTable('custom_product_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: PRODUCT_KINDS }).notNull(),
  hasGracePeriod: integer('has_grace_period', { mode: 'boolean' }).notNull(),
  emoji: text('emoji').notNull(),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
});

export const creditProducts = sqliteTable(
  'credit_products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    issuer: text('issuer').notNull().default(''),
    kind: text('kind', { enum: PRODUCT_KINDS }).notNull(),
    /** Built-in preset this product started from (huabei, jiebei, …), if any. */
    preset: text('preset', { enum: PRESET_KEYS }),
    customTypeId: text('custom_type_id').references(() => customProductTypes.id, {
      onDelete: 'set null',
    }),
    currency: text('currency', { enum: CURRENCY_CODES }).notNull(),
    color: text('color').notNull(),
    emoji: text('emoji').notNull(),

    creditLimit: real('credit_limit').notNull().default(0),
    balance: real('balance').notNull().default(0),
    statementBalance: real('statement_balance'),
    minimumPayment: real('minimum_payment'),

    statementDay: integer('statement_day'),
    dueRule: text('due_rule', { enum: DUE_RULE_TYPES }),
    dueDay: integer('due_day'),
    dueDaysAfterStatement: integer('due_days_after_statement'),
    hasGracePeriod: integer('has_grace_period', { mode: 'boolean' }).notNull().default(false),
    graceNote: text('grace_note'),

    interestRate: real('interest_rate'),
    interestRateUnit: text('interest_rate_unit', { enum: RATE_UNITS }),
    annualFee: real('annual_fee'),
    feeWaiver: text('fee_waiver'),

    repaymentDay: integer('repayment_day'),
    loanPrincipal: real('loan_principal'),
    loanStartDate: text('loan_start_date'),
    loanTermMonths: integer('loan_term_months'),
    repaymentMethod: text('repayment_method', { enum: REPAYMENT_METHODS }),

    paidThrough: text('paid_through'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index('credit_products_active_idx').on(table.isActive)]
);

export const installments = sqliteTable(
  'installments',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => creditProducts.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    dueDate: text('due_date').notNull(),
    principal: real('principal').notNull(),
    interest: real('interest').notNull(),
    amount: real('amount').notNull(),
    paidAt: text('paid_at'),
  },
  (table) => [index('installments_product_idx').on(table.productId, table.dueDate)]
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => creditProducts.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    amount: real('amount').notNull(),
    /** Due date this payment settled, if it settled one. */
    forDueDate: text('for_due_date'),
    installmentId: text('installment_id'),
    note: text('note'),
    /** What the payment changed, so the latest one can be undone exactly. */
    balanceReduction: real('balance_reduction').notNull().default(0),
    previousPaidThrough: text('previous_paid_through'),
    previousStatementBalance: real('previous_statement_balance'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('payments_product_idx').on(table.productId, table.date)]
);

/* Portfolio inputs. Column names match the field keys in domain/wealthForms.ts. */

const currency = () => text('currency', { enum: CURRENCY_CODES }).notNull();

export const incomes = sqliteTable('incomes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: INCOME_KINDS }).notNull(),
  amount: real('amount').notNull(),
  period: text('period', { enum: INCOME_PERIODS }).notNull(),
  currency: currency(),
  notes: text('notes'),
  ...timestamps,
});

export const housing = sqliteTable('housing', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: HOUSING_KINDS }).notNull(),
  currency: currency(),
  monthlyRent: real('monthly_rent'),
  /** Mortgage still owed. */
  balance: real('balance'),
  ratePercent: real('rate_percent'),
  remainingMonths: integer('remaining_months'),
  monthlyPayment: real('monthly_payment'),
  propertyValue: real('property_value'),
  notes: text('notes'),
  ...timestamps,
});

export const insurancePolicies = sqliteTable('insurance_policies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: INSURANCE_TYPES }).notNull(),
  insurer: text('insurer'),
  premium: real('premium').notNull(),
  premiumPeriod: text('premium_period', { enum: PREMIUM_PERIODS }).notNull(),
  /** Sum insured. */
  coverage: real('coverage'),
  currency: currency(),
  renewalDate: text('renewal_date'),
  notes: text('notes'),
  ...timestamps,
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  category: text('category', { enum: EXPENSE_CATEGORIES }).notNull(),
  label: text('label'),
  /** Per month. */
  amount: real('amount').notNull(),
  currency: currency(),
  essential: integer('essential', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  ...timestamps,
});

export const cashAccounts = sqliteTable('cash_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: CASH_KINDS }).notNull(),
  balance: real('balance').notNull(),
  currency: currency(),
  ratePercent: real('rate_percent'),
  isEmergencyFund: integer('is_emergency_fund', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  ...timestamps,
});

export const bondHoldings = sqliteTable('bond_holdings', {
  id: text('id').primaryKey(),
  issuer: text('issuer').notNull(),
  name: text('name'),
  /** CUSIP or ISIN. */
  identifier: text('identifier'),
  faceValue: real('face_value').notNull(),
  couponRate: real('coupon_rate').notNull(),
  couponFrequency: integer('coupon_frequency').notNull(),
  maturityDate: text('maturity_date').notNull(),
  purchaseDate: text('purchase_date'),
  /** Percent of face value. */
  purchasePrice: real('purchase_price'),
  currentPrice: real('current_price'),
  currency: currency(),
  notes: text('notes'),
  ...timestamps,
});

export const stockHoldings = sqliteTable('stock_holdings', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull(),
  name: text('name'),
  assetClass: text('asset_class', { enum: ASSET_CLASSES }).notNull(),
  shares: real('shares').notNull(),
  /** Per share, entered by hand. */
  price: real('price').notNull(),
  /** Total paid for the position. */
  costBasis: real('cost_basis'),
  /** Per share, per payment. */
  dividendPerShare: real('dividend_per_share'),
  dividendFrequency: integer('dividend_frequency').notNull(),
  firstPayMonth: integer('first_pay_month'),
  currency: currency(),
  notes: text('notes'),
  ...timestamps,
});

/** One row per calendar month: the latest net worth seen that month, in `currency`. */
export const netWorthSnapshots = sqliteTable('net_worth_snapshots', {
  month: text('month').primaryKey(),
  assets: real('assets').notNull(),
  liabilities: real('liabilities').notNull(),
  netWorth: real('net_worth').notNull(),
  currency: currency(),
  updatedAt: text('updated_at').notNull(),
});

export type SettingRow = typeof settings.$inferSelect;
export type FxRateRow = typeof fxRates.$inferSelect;
export type CustomProductType = typeof customProductTypes.$inferSelect;
export type CreditProductRow = typeof creditProducts.$inferSelect;
export type NewCreditProduct = typeof creditProducts.$inferInsert;
export type InstallmentRow = typeof installments.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type IncomeRow = typeof incomes.$inferSelect;
export type HousingRow = typeof housing.$inferSelect;
export type InsuranceRow = typeof insurancePolicies.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type CashRow = typeof cashAccounts.$inferSelect;
export type BondRow = typeof bondHoldings.$inferSelect;
export type StockRow = typeof stockHoldings.$inferSelect;
export type NetWorthSnapshotRow = typeof netWorthSnapshots.$inferSelect;
