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
