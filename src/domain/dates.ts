/**
 * Calendar dates without a time or time zone: `YYYY-MM-DD` in the device's local calendar.
 *
 * Due dates are calendar facts ("the 23rd"), not instants, so all billing arithmetic works on
 * these strings. Only `todayLocal()` and `toLocalDate()` look at a `Date`, and they read its
 * local fields, so the user's time zone decides what "today" is. Day counts go through UTC epoch
 * days, which have no daylight-saving gaps.
 */
export type LocalDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export type DateParts = { year: number; month: number; day: number };

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function makeLocalDate(year: number, month: number, day: number): LocalDate {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(date: LocalDate): DateParts {
  if (!isLocalDate(date)) throw new Error(`Invalid local date "${date}"`);
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/** The given day of a month, clamped to the month's length (31 → 28 in February). */
export function clampedDate(year: number, month: number, day: number): LocalDate {
  return makeLocalDate(year, month, Math.min(Math.max(1, day), daysInMonth(year, month)));
}

/** Calendar month arithmetic on (year, month) pairs; `month` is 1–12. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function toEpochDay(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromEpochDay(epochDay: number): LocalDate {
  const d = new Date(epochDay * MS_PER_DAY);
  return makeLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Same day-of-month `months` later, clamped to the target month's length. */
export function addMonths(date: LocalDate, months: number, day?: number): LocalDate {
  const parts = parseLocalDate(date);
  const target = shiftMonth(parts.year, parts.month, months);
  return clampedDate(target.year, target.month, day ?? parts.day);
}

/** Today in the device's local time zone. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** The local calendar date of an instant, using the device's time zone. */
export function toLocalDate(instant: Date): LocalDate {
  return makeLocalDate(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
}

/** A local wall-clock time on the given date, e.g. 09:00 for a reminder. */
export function atLocalTime(date: LocalDate, hour: number, minute = 0): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(date: LocalDate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** `YYYY-MM`. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}
