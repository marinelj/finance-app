import { addDays, atLocalTime, type LocalDate } from './dates';

export type ReminderSource = { productId: string; dueDates: LocalDate[] };

export type PlannedReminder = {
  productId: string;
  dueDate: LocalDate;
  /** 0 means on the due date itself. */
  daysBefore: number;
  fireDate: LocalDate;
};

export const DEFAULT_REMINDER_OFFSETS = [3, 1];

/** iOS keeps at most 64 pending local notifications per app; stay under it. */
export const MAX_SCHEDULED_REMINDERS = 60;

/**
 * Which reminders to schedule: one per due date and offset, firing on or after today, earliest
 * first, capped so the OS limit is never hit.
 */
export function planReminders(
  sources: ReminderSource[],
  today: LocalDate,
  offsets: number[],
  limit = MAX_SCHEDULED_REMINDERS
): PlannedReminder[] {
  const uniqueOffsets = [...new Set(offsets.filter((n) => Number.isInteger(n) && n >= 0))];
  const seen = new Set<string>();
  const plan: PlannedReminder[] = [];

  for (const { productId, dueDates } of sources) {
    for (const dueDate of dueDates) {
      for (const daysBefore of uniqueOffsets) {
        const fireDate = addDays(dueDate, -daysBefore);
        const key = `${productId}|${dueDate}|${daysBefore}`;
        if (fireDate < today || seen.has(key)) continue;
        seen.add(key);
        plan.push({ productId, dueDate, daysBefore, fireDate });
      }
    }
  }

  plan.sort((a, b) =>
    a.fireDate !== b.fireDate
      ? a.fireDate < b.fireDate
        ? -1
        : 1
      : a.productId.localeCompare(b.productId) || b.daysBefore - a.daysBefore
  );
  return plan.slice(0, limit);
}

export type TimedReminder = PlannedReminder & { fireAt: Date };

/**
 * The reminders to hand to the OS: `planReminders` at a local wall-clock hour, dropping any whose
 * time has already passed today.
 */
export function remindersToSchedule(
  sources: ReminderSource[],
  today: LocalDate,
  offsets: number[],
  hour: number,
  now: Date,
  limit = MAX_SCHEDULED_REMINDERS
): TimedReminder[] {
  return planReminders(sources, today, offsets, Number.POSITIVE_INFINITY)
    .map((item) => ({ ...item, fireAt: atLocalTime(item.fireDate, hour) }))
    .filter((item) => item.fireAt.getTime() > now.getTime())
    .slice(0, limit);
}
