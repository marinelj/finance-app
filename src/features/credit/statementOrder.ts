import type { CreditProduct } from '@/domain/credit';
import { daysBetween, type LocalDate } from '@/domain/dates';
import { floatForPurchase } from '@/domain/paymentOptimizer';

export type StatementOrdered<S> = {
  status: S;
  /** Days from today to the next statement; null without a billing cycle. */
  statementDays: number | null;
  /** Interest-free days for a purchase made today; null without one. */
  graceDays: number | null;
};

/**
 * Longest wait until the next statement first, since spending there stays interest-free
 * longest. Ties go to the longer grace period; products without a cycle keep their order last.
 */
export function orderByNextStatement<S extends { product: CreditProduct }>(
  statuses: S[],
  today: LocalDate
): StatementOrdered<S>[] {
  return statuses
    .map((status, order) => {
      const float = floatForPurchase(status.product, today);
      return {
        status,
        order,
        statementDays: float ? daysBetween(today, float.statementDate) : null,
        graceDays: float?.floatDays ?? null,
      };
    })
    .sort(
      (a, b) =>
        (b.statementDays ?? -1) - (a.statementDays ?? -1) ||
        (b.graceDays ?? -1) - (a.graceDays ?? -1) ||
        a.order - b.order
    )
    .map(({ status, statementDays, graceDays }) => ({ status, statementDays, graceDays }));
}
