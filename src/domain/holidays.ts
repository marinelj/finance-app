import { isWeekend, makeLocalDate, parseLocalDate, weekday, type LocalDate } from './dates';
import type { CurrencyCode } from './money';

/**
 * Bank holidays, used only to flag due dates (the app never moves a due date). A product's
 * currency decides the calendar: CNY → mainland China, USD → US federal holidays. Other
 * currencies only get weekend flags.
 *
 * China publishes its schedule, including 调休 make-up working weekends, each November for the
 * following year, so specific years are listed here. Years not listed fall back to the fixed-date
 * holidays that never move (New Year's Day, Labour Day, National Day).
 */

export type HolidayRegion = 'cn' | 'us';

export const HOLIDAY_KEYS = [
  'cn.newYear',
  'cn.springFestival',
  'cn.qingming',
  'cn.labour',
  'cn.dragonBoat',
  'cn.midAutumn',
  'cn.nationalDay',
  'us.newYear',
  'us.mlk',
  'us.presidents',
  'us.memorial',
  'us.juneteenth',
  'us.independence',
  'us.labor',
  'us.columbus',
  'us.veterans',
  'us.thanksgiving',
  'us.christmas',
] as const;
export type HolidayKey = (typeof HOLIDAY_KEYS)[number];

type CnYear = {
  holidays: [HolidayKey, LocalDate, LocalDate][];
  /** Weekend days that are working days (调休). */
  workdays: LocalDate[];
};

/** 国务院办公厅关于2026年部分节假日安排的通知. */
const CN_SCHEDULES: Record<number, CnYear> = {
  2026: {
    holidays: [
      ['cn.newYear', '2026-01-01', '2026-01-03'],
      ['cn.springFestival', '2026-02-15', '2026-02-23'],
      ['cn.qingming', '2026-04-04', '2026-04-06'],
      ['cn.labour', '2026-05-01', '2026-05-05'],
      ['cn.dragonBoat', '2026-06-19', '2026-06-21'],
      ['cn.midAutumn', '2026-09-25', '2026-09-27'],
      ['cn.nationalDay', '2026-10-01', '2026-10-07'],
    ],
    workdays: ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'],
  },
};

export function regionForCurrency(currency: CurrencyCode): HolidayRegion | null {
  if (currency === 'CNY') return 'cn';
  if (currency === 'USD') return 'us';
  return null;
}

function cnHoliday(date: LocalDate): HolidayKey | null {
  const { year, month, day } = parseLocalDate(date);
  const schedule = CN_SCHEDULES[year];
  if (schedule) {
    const match = schedule.holidays.find(([, from, to]) => date >= from && date <= to);
    return match ? match[0] : null;
  }
  if (month === 1 && day === 1) return 'cn.newYear';
  if (month === 5 && day === 1) return 'cn.labour';
  if (month === 10 && day <= 7) return 'cn.nationalDay';
  return null;
}

function cnWorkday(date: LocalDate): boolean {
  return CN_SCHEDULES[parseLocalDate(date).year]?.workdays.includes(date) ?? false;
}

/** The n-th (1-based) given weekday of a month, or the last one when n = -1. */
function nthWeekday(year: number, month: number, dayOfWeek: number, n: number): LocalDate {
  if (n > 0) {
    const first = weekday(makeLocalDate(year, month, 1));
    const day = 1 + ((dayOfWeek - first + 7) % 7) + (n - 1) * 7;
    return makeLocalDate(year, month, day);
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = weekday(makeLocalDate(year, month, lastDay));
  return makeLocalDate(year, month, lastDay - ((last - dayOfWeek + 7) % 7));
}

/** Fixed-date US holidays move to Friday when on a Saturday and Monday when on a Sunday. */
function observed(date: LocalDate): LocalDate {
  const w = weekday(date);
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + (w === 6 ? -1 : w === 0 ? 1 : 0)));
  return makeLocalDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function usHolidays(year: number): [HolidayKey, LocalDate][] {
  const fixed = (key: HolidayKey, month: number, day: number): [HolidayKey, LocalDate][] => {
    const actual = makeLocalDate(year, month, day);
    const moved = observed(actual);
    return moved === actual
      ? [[key, actual]]
      : [
          [key, actual],
          [key, moved],
        ];
  };
  return [
    ...fixed('us.newYear', 1, 1),
    ['us.mlk', nthWeekday(year, 1, 1, 3)],
    ['us.presidents', nthWeekday(year, 2, 1, 3)],
    ['us.memorial', nthWeekday(year, 5, 1, -1)],
    ...fixed('us.juneteenth', 6, 19),
    ...fixed('us.independence', 7, 4),
    ['us.labor', nthWeekday(year, 9, 1, 1)],
    ['us.columbus', nthWeekday(year, 10, 1, 2)],
    ...fixed('us.veterans', 11, 11),
    ['us.thanksgiving', nthWeekday(year, 11, 4, 4)],
    ...fixed('us.christmas', 12, 25),
  ];
}

function usHoliday(date: LocalDate): HolidayKey | null {
  const { year } = parseLocalDate(date);
  // Next year's New Year's Day is observed on Dec 31 when it falls on a Saturday.
  const candidates = [...usHolidays(year), ...usHolidays(year + 1)];
  return candidates.find(([, day]) => day === date)?.[0] ?? null;
}

export function holidayOn(date: LocalDate, region: HolidayRegion | null): HolidayKey | null {
  if (region === 'cn') return cnHoliday(date);
  if (region === 'us') return usHoliday(date);
  return null;
}

export type DateFlags = {
  weekend: boolean;
  holiday: HolidayKey | null;
  /** False on weekends and holidays, except China's make-up working weekends. */
  businessDay: boolean;
};

/** What to flag about a due date for a product in `currency`. */
export function dateFlags(date: LocalDate, currency: CurrencyCode): DateFlags {
  const region = regionForCurrency(currency);
  const holiday = holidayOn(date, region);
  const workday = region === 'cn' && cnWorkday(date);
  const weekend = isWeekend(date) && !workday;
  return { weekend, holiday, businessDay: !weekend && holiday == null };
}
