import type { TFunction } from 'i18next';

import type { AccentTone } from '@/design/tokens';
import type { WealthKind } from '@/domain/wealthForms';

export const SECTION_META: Record<WealthKind, { emoji: string; tone: AccentTone }> = {
  income: { emoji: '💼', tone: 'mint' },
  housing: { emoji: '🏠', tone: 'sky' },
  insurance: { emoji: '🛡️', tone: 'violet' },
  expense: { emoji: '🧾', tone: 'pink' },
  cash: { emoji: '💵', tone: 'mint' },
  bond: { emoji: '📜', tone: 'sun' },
  stock: { emoji: '📈', tone: 'violet' },
};

/**
 * Translates a key assembled from data (field names, option values). The locale tests check
 * that every such key exists in both languages, which the type system cannot do here.
 */
export function tKey(t: TFunction, key: string, options?: Record<string, unknown>): string {
  return (t as unknown as (key: string, options?: Record<string, unknown>) => string)(key, options);
}
