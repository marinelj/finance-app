import type { FxTable } from '@/domain/fx';
import type { CurrencyCode } from '@/domain/money';

import { getDb } from './client';
import { nowIso } from './ids';
import { fxRates, type FxRateRow } from './schema';

export function fxTableFromRows(rows: FxRateRow[]): FxTable {
  return Object.fromEntries(rows.map((row) => [row.currency, row.unitsPerUsd]));
}

/** Saves every rate in `table` (units of each currency per 1 USD). */
export function saveFxTable(table: FxTable): void {
  const updatedAt = nowIso();
  getDb().transaction((tx) => {
    for (const [currency, unitsPerUsd] of Object.entries(table)) {
      if (!(unitsPerUsd != null && unitsPerUsd > 0)) continue;
      tx.insert(fxRates)
        .values({ currency: currency as CurrencyCode, unitsPerUsd, updatedAt })
        .onConflictDoUpdate({ target: fxRates.currency, set: { unitsPerUsd, updatedAt } })
        .run();
    }
  });
}

/** Forgets every edited rate so the built-in defaults apply again. */
export function resetFxTable(): void {
  getDb().delete(fxRates).run();
}
