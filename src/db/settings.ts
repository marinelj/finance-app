import { eq } from 'drizzle-orm';

import { getDb } from './client';
import { settings } from './schema';

/** Small JSON documents keyed by name, e.g. "preferences" or "reminders". */
export function readSetting<T>(key: string): T | null {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  getDb()
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run();
}
