import { eq } from 'drizzle-orm';

import type { RiskAnswers } from '@/domain/riskProfile';
import type { WealthKind, WealthRecord } from '@/domain/wealthForms';

import { getDb } from './client';
import { newId, nowIso } from './ids';
import {
  bondHoldings,
  cashAccounts,
  expenses,
  housing,
  incomes,
  insurancePolicies,
  stockHoldings,
} from './schema';
import { readSetting, writeSetting } from './settings';

export const WEALTH_TABLES = {
  income: incomes,
  housing,
  insurance: insurancePolicies,
  expense: expenses,
  cash: cashAccounts,
  bond: bondHoldings,
  stock: stockHoldings,
} as const;

/** SQL table names, for live queries. */
export const WEALTH_TABLE_NAMES: Record<WealthKind, string> = {
  income: 'incomes',
  housing: 'housing',
  insurance: 'insurance_policies',
  expense: 'expenses',
  cash: 'cash_accounts',
  bond: 'bond_holdings',
  stock: 'stock_holdings',
};

/*
 * The record comes from `toWealthRecord`, whose keys are the kind's field specs; a unit test
 * checks those keys against the table's columns. Drizzle cannot type a union of tables, so the
 * generic writes below go through the income table's types.
 */
type AnyWealthTable = typeof incomes;
type AnyWealthInsert = typeof incomes.$inferInsert;

/** Inserts or updates one portfolio item; returns its id. */
export function saveWealthItem(kind: WealthKind, id: string | null, record: WealthRecord): string {
  const table = WEALTH_TABLES[kind] as unknown as AnyWealthTable;
  const now = nowIso();
  const itemId = id ?? newId();
  if (id) {
    getDb()
      .update(table)
      .set({ ...record, updatedAt: now } as Partial<AnyWealthInsert>)
      .where(eq(table.id, id))
      .run();
  } else {
    getDb()
      .insert(table)
      .values({ ...record, id: itemId, createdAt: now, updatedAt: now } as AnyWealthInsert)
      .run();
  }
  return itemId;
}

export function deleteWealthItem(kind: WealthKind, id: string): void {
  const table = WEALTH_TABLES[kind] as unknown as AnyWealthTable;
  getDb().delete(table).where(eq(table.id, id)).run();
}

const RISK_KEY = 'riskProfile';

export type StoredRiskProfile = { answers: RiskAnswers; completedAt: string };

export function readRiskProfile(): StoredRiskProfile | null {
  return readSetting<StoredRiskProfile>(RISK_KEY);
}

export function saveRiskProfile(answers: RiskAnswers): void {
  writeSetting(RISK_KEY, { answers, completedAt: nowIso() } satisfies StoredRiskProfile);
}
