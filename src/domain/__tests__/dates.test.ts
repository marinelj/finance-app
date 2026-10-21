import path from 'node:path';

import {
  addDays,
  addMonths,
  clampedDate,
  daysBetween,
  daysInMonth,
  fromEpochDay,
  isLocalDate,
  isWeekend,
  monthKey,
  parseLocalDate,
  shiftMonth,
  toEpochDay,
  weekday,
} from '../dates';
import { evalInTimeZone } from './helpers/timeZone';

describe('daysInMonth', () => {
  it('knows short months and leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('validation and parsing', () => {
  it('accepts real dates only', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate(20260101)).toBe(false);
  });

  it('parses parts', () => {
    expect(parseLocalDate('2026-10-21')).toEqual({ year: 2026, month: 10, day: 21 });
    expect(() => parseLocalDate('2026-02-30')).toThrow();
  });
});

describe('clamping and month arithmetic', () => {
  it('clamps day 31 to the end of shorter months', () => {
    expect(clampedDate(2026, 2, 31)).toBe('2026-02-28');
    expect(clampedDate(2028, 2, 31)).toBe('2028-02-29');
    expect(clampedDate(2026, 4, 31)).toBe('2026-04-30');
    expect(clampedDate(2026, 5, 31)).toBe('2026-05-31');
  });

  it('shifts months across year boundaries in both directions', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 3, -14)).toEqual({ year: 2025, month: 1 });
  });

  it('adds months, clamping or using an explicit day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-03-15', 1, 31)).toBe('2026-04-30');
    expect(addMonths('2026-12-10', 1)).toBe('2027-01-10');
  });
});

describe('day arithmetic', () => {
  it('round-trips epoch days', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(fromEpochDay(toEpochDay('2026-10-21'))).toBe('2026-10-21');
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates, ignoring daylight saving', () => {
    expect(daysBetween('2026-10-21', '2026-11-20')).toBe(30);
    // US daylight saving ends on 2026-11-01; Europe on 2026-10-25.
    expect(daysBetween('2026-10-24', '2026-11-02')).toBe(9);
    expect(daysBetween('2026-11-20', '2026-10-21')).toBe(-30);
  });
});

describe('weekdays', () => {
  it('identifies weekends', () => {
    expect(weekday('2026-10-21')).toBe(3); // Wednesday
    expect(isWeekend('2026-10-24')).toBe(true); // Saturday
    expect(isWeekend('2026-10-25')).toBe(true); // Sunday
    expect(isWeekend('2026-10-26')).toBe(false);
  });
});

describe('device local date', () => {
  const datesModule = path.resolve(__dirname, '../dates.ts');

  it('uses the device time zone to decide what "today" is', () => {
    const expr = 'm.todayLocal(new Date("2026-03-01T03:30:00Z"))';
    expect(evalInTimeZone('America/Los_Angeles', datesModule, expr)).toBe('2026-02-28');
    expect(evalInTimeZone('Asia/Shanghai', datesModule, expr)).toBe('2026-03-01');
  });

  it('builds reminder times in local wall-clock time', () => {
    const expr = 'm.atLocalTime("2026-10-21", 9).toISOString()';
    expect(evalInTimeZone('Asia/Shanghai', datesModule, expr)).toBe('2026-10-21T01:00:00.000Z');
    expect(evalInTimeZone('America/New_York', datesModule, expr)).toBe('2026-10-21T13:00:00.000Z');
  });
});

describe('monthKey', () => {
  it('returns the year and month', () => {
    expect(monthKey('2026-10-21')).toBe('2026-10');
  });
});
