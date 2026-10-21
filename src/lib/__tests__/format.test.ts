import { dayPart, formatDate, formatHour, formatMonth } from '../format';

describe('formatDate', () => {
  it('formats short dates in both languages', () => {
    expect(formatDate('2026-10-23', 'en')).toBe('Oct 23');
    expect(formatDate('2026-10-23', 'zh-Hans')).toBe('10月23日');
  });

  it('adds the weekday on request', () => {
    expect(formatDate('2026-10-23', 'en', { weekday: true })).toBe('Fri, Oct 23');
    expect(formatDate('2026-10-24', 'zh-Hans', { weekday: true })).toBe('10月24日 周六');
  });

  it('shows the year only when it differs from today, unless forced', () => {
    expect(formatDate('2027-01-10', 'en', { today: '2026-10-21' })).toBe('Jan 10, 2027');
    expect(formatDate('2026-11-10', 'en', { today: '2026-10-21' })).toBe('Nov 10');
    expect(formatDate('2026-11-10', 'zh-Hans', { year: true })).toBe('2026年11月10日');
  });
});

describe('small formatters', () => {
  it('formats months, hours and day parts', () => {
    expect(formatMonth(2026, 10, 'en')).toBe('October 2026');
    expect(formatMonth(2026, 10, 'zh-Hans')).toBe('2026年10月');
    expect(formatHour(9)).toBe('09:00');
    expect(dayPart(8)).toBe('morning');
    expect(dayPart(13)).toBe('afternoon');
    expect(dayPart(20)).toBe('evening');
  });
});
