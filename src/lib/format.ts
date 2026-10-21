import type { TFunction } from 'i18next';

import { parseLocalDate, weekday, type LocalDate } from '@/domain/dates';
import { formatMoney, type CurrencyCode } from '@/domain/money';
import type { AppLanguage } from '@/i18n';

const INTL_LOCALE: Record<AppLanguage, string> = { en: 'en-US', 'zh-Hans': 'zh-CN' };

/** "Tuesday, October 21" / "10月21日星期二". Display only; never parsed back. */
export function formatLongDate(date: Date, language: AppLanguage): string {
  try {
    return date.toLocaleDateString(INTL_LOCALE[language], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toDateString();
  }
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(hour: number): DayPart {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export type DateFormatOptions = {
  /** Add the weekday ("Thu, Oct 23" / "10月23日 周四"). */
  weekday?: boolean;
  /** Show the year; by default only when it differs from `today`'s year. */
  year?: boolean;
  today?: LocalDate;
};

/**
 * Short calendar date for a `YYYY-MM-DD` value: "Oct 23" / "10月23日". Built by hand, like the
 * money formatter, so Jest and devices agree.
 */
export function formatDate(
  date: LocalDate,
  language: AppLanguage,
  options: DateFormatOptions = {}
): string {
  const { year, month, day } = parseLocalDate(date);
  const showYear =
    options.year ?? (options.today ? parseLocalDate(options.today).year !== year : false);
  const w = weekday(date);
  if (language === 'zh-Hans') {
    const body = `${showYear ? `${year}年` : ''}${month}月${day}日`;
    return options.weekday ? `${body} ${WEEKDAYS_ZH[w]}` : body;
  }
  const body = `${MONTHS_EN[month - 1]} ${day}${showYear ? `, ${year}` : ''}`;
  return options.weekday ? `${WEEKDAYS_EN[w]}, ${body}` : body;
}

/** Month heading for calendars: "October 2026" / "2026年10月". */
export function formatMonth(year: number, month: number, language: AppLanguage): string {
  if (language === 'zh-Hans') return `${year}年${month}月`;
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[month - 1]} ${year}`;
}

/** One-letter (en) or one-character (zh) weekday headers, Sunday first. */
export function weekdayInitials(language: AppLanguage): string[] {
  return language === 'zh-Hans'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

/** "09:00". */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Spoken form of an amount for accessibility labels, respecting "hide amounts". */
export function formatMoneyLabel(
  amount: number,
  currency: CurrencyCode,
  language: AppLanguage,
  hidden: boolean,
  t: TFunction
): string {
  return hidden ? t('a11y.amountHidden') : formatMoney(amount, currency, { locale: language });
}
