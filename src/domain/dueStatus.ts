/**
 * How urgent a due date is, from the number of days left (negative when overdue).
 * Thresholds follow the product brief: red at 3 days or fewer, amber at 7 or fewer.
 */
export type DueLevel = 'overdue' | 'urgent' | 'soon' | 'safe';

export const DUE_URGENT_DAYS = 3;
export const DUE_SOON_DAYS = 7;

export function dueLevel(daysLeft: number): DueLevel {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= DUE_URGENT_DAYS) return 'urgent';
  if (daysLeft <= DUE_SOON_DAYS) return 'soon';
  return 'safe';
}
