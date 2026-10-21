import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import {
  DUE_RULE_TYPES,
  PRESET_KEYS,
  PRODUCT_KINDS,
  RATE_UNITS,
  REPAYMENT_METHODS,
} from '../domain/credit';
import { CURRENCY_CODES } from '../domain/money';

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

export type SettingRow = typeof settings.$inferSelect;
export type FxRateRow = typeof fxRates.$inferSelect;
export type CustomProductType = typeof customProductTypes.$inferSelect;
export type CreditProductRow = typeof creditProducts.$inferSelect;
export type NewCreditProduct = typeof creditProducts.$inferInsert;
export type InstallmentRow = typeof installments.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
