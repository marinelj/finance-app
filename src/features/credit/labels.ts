import type { TFunction } from 'i18next';

import type { StatusTone } from '@/design/tokens';
import type { CustomProductType } from '@/db/schema';
import type { PresetKey, ProductKind } from '@/domain/credit';

type Typed = { kind: ProductKind; preset: PresetKey | null; customTypeId: string | null };

/** "Huabei", "Credit card", or the name of the user's own type. */
export function productTypeLabel(
  product: Typed,
  customTypes: CustomProductType[],
  t: TFunction
): string {
  const custom = product.customTypeId
    ? customTypes.find((type) => type.id === product.customTypeId)
    : undefined;
  if (custom) return custom.name;
  if (product.preset && product.preset !== 'other') return t(`presets.${product.preset}`);
  return t(`kinds.${product.kind}`);
}

/** "Day 23 of each month" / "Last day of each month". */
export function dayOfMonthLabel(day: number, t: TFunction): string {
  return day >= 31 ? t('product.lastDayOfMonth') : t('product.dayOfMonth', { day });
}

/** Short value for day pickers: "Day 23" / "Last day". */
export function dayValueLabel(day: number | null, t: TFunction): string {
  if (day == null) return '';
  return day >= 31 ? t('form.lastDay') : t('form.dayValue', { day });
}

/** Under 30% is healthy, under 70% worth watching, above that a problem. */
export function utilizationTone(utilization: number): StatusTone {
  if (utilization < 0.3) return 'good';
  if (utilization < 0.7) return 'caution';
  return 'danger';
}
