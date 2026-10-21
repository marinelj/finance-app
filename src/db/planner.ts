import { asc } from 'drizzle-orm';

import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from '@/domain/portfolioPlanner';
import type { CurrencyCode } from '@/domain/money';

import { getDb } from './client';
import { nowIso } from './ids';
import { netWorthSnapshots } from './schema';
import { readSetting, writeSetting } from './settings';

export function readSnapshots() {
  return getDb().select().from(netWorthSnapshots).orderBy(asc(netWorthSnapshots.month)).all();
}

export type SnapshotValues = {
  assets: number;
  liabilities: number;
  netWorth: number;
  currency: CurrencyCode;
};

/** Keeps the latest figures for a month (`YYYY-MM`); earlier months are never rewritten. */
export function upsertSnapshot(month: string, values: SnapshotValues): void {
  const updatedAt = nowIso();
  getDb()
    .insert(netWorthSnapshots)
    .values({ month, ...values, updatedAt })
    .onConflictDoUpdate({ target: netWorthSnapshots.month, set: { ...values, updatedAt } })
    .run();
}

const PLANNER_KEY = 'planner';

export function readPlannerSettings(): PlannerSettings {
  const stored = readSetting<Partial<PlannerSettings>>(PLANNER_KEY);
  const valid = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && value >= min && value <= max;
  return {
    highInterestApr: valid(stored?.highInterestApr, 0, 50)
      ? (stored?.highInterestApr as number)
      : DEFAULT_PLANNER_SETTINGS.highInterestApr,
    emergencyMonths: valid(stored?.emergencyMonths, 1, 24)
      ? (stored?.emergencyMonths as number)
      : DEFAULT_PLANNER_SETTINGS.emergencyMonths,
  };
}

export function savePlannerSettings(settings: PlannerSettings): void {
  writeSetting(PLANNER_KEY, settings);
}
