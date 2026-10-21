import { asc } from 'drizzle-orm';
import { createContext, useContext, type ReactNode } from 'react';

import { getDb } from '@/db/client';
import { useLiveRows } from '@/db/live';
import {
  bondHoldings,
  cashAccounts,
  expenses,
  housing,
  incomes,
  insurancePolicies,
  stockHoldings,
  type BondRow,
  type CashRow,
  type ExpenseRow,
  type HousingRow,
  type IncomeRow,
  type InsuranceRow,
  type StockRow,
} from '@/db/schema';
import { readRiskProfile, type StoredRiskProfile } from '@/db/wealth';
import { isCompleteAnswers } from '@/domain/riskProfile';
import type { WealthKind } from '@/domain/wealthForms';

export type WealthData = {
  incomes: IncomeRow[];
  housing: HousingRow[];
  insurance: InsuranceRow[];
  expenses: ExpenseRow[];
  cash: CashRow[];
  bonds: BondRow[];
  stocks: StockRow[];
  risk: StoredRiskProfile | null;
};

export type WealthRow =
  IncomeRow | HousingRow | InsuranceRow | ExpenseRow | CashRow | BondRow | StockRow;

const readIncomes = () => getDb().select().from(incomes).orderBy(asc(incomes.createdAt)).all();
const readHousing = () => getDb().select().from(housing).orderBy(asc(housing.createdAt)).all();
const readInsurance = () =>
  getDb().select().from(insurancePolicies).orderBy(asc(insurancePolicies.createdAt)).all();
const readExpenses = () => getDb().select().from(expenses).orderBy(asc(expenses.createdAt)).all();
const readCash = () =>
  getDb().select().from(cashAccounts).orderBy(asc(cashAccounts.createdAt)).all();
const readBonds = () =>
  getDb().select().from(bondHoldings).orderBy(asc(bondHoldings.maturityDate)).all();
const readStocks = () =>
  getDb().select().from(stockHoldings).orderBy(asc(stockHoldings.createdAt)).all();
const readRisk = () => {
  const stored = readRiskProfile();
  return stored && isCompleteAnswers(stored.answers) ? stored : null;
};

const WealthDataContext = createContext<WealthData | null>(null);

/** Every portfolio input, kept live. Must render inside `DatabaseGate`. */
export function WealthDataProvider({ children }: { children: ReactNode }) {
  const value: WealthData = {
    incomes: useLiveRows(['incomes'], readIncomes),
    housing: useLiveRows(['housing'], readHousing),
    insurance: useLiveRows(['insurance_policies'], readInsurance),
    expenses: useLiveRows(['expenses'], readExpenses),
    cash: useLiveRows(['cash_accounts'], readCash),
    bonds: useLiveRows(['bond_holdings'], readBonds),
    stocks: useLiveRows(['stock_holdings'], readStocks),
    risk: useLiveRows(['settings'], readRisk),
  };
  return <WealthDataContext.Provider value={value}>{children}</WealthDataContext.Provider>;
}

export function useWealthData(): WealthData {
  const value = useContext(WealthDataContext);
  if (!value) throw new Error('useWealthData must be used inside <WealthDataProvider>');
  return value;
}

/** The rows of one kind of portfolio input. */
export function rowsOf(data: WealthData, kind: WealthKind): WealthRow[] {
  switch (kind) {
    case 'income':
      return data.incomes;
    case 'housing':
      return data.housing;
    case 'insurance':
      return data.insurance;
    case 'expense':
      return data.expenses;
    case 'cash':
      return data.cash;
    case 'bond':
      return data.bonds;
    case 'stock':
      return data.stocks;
  }
}
