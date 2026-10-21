import { dateFlags, holidayOn } from '../holidays';

describe('China', () => {
  it('uses the published 2026 schedule', () => {
    expect(holidayOn('2026-02-17', 'cn')).toBe('cn.springFestival');
    expect(holidayOn('2026-06-19', 'cn')).toBe('cn.dragonBoat');
    expect(holidayOn('2026-09-26', 'cn')).toBe('cn.midAutumn');
    expect(holidayOn('2026-10-07', 'cn')).toBe('cn.nationalDay');
    expect(holidayOn('2026-10-08', 'cn')).toBeNull();
  });

  it('treats make-up working weekends as business days', () => {
    // Saturday 10 October 2026 is a working day after the National Day break.
    expect(dateFlags('2026-10-10', 'CNY')).toEqual({
      weekend: false,
      holiday: null,
      businessDay: true,
    });
    expect(dateFlags('2026-10-11', 'CNY').businessDay).toBe(false);
  });

  it('falls back to the fixed-date holidays in other years', () => {
    expect(holidayOn('2027-10-03', 'cn')).toBe('cn.nationalDay');
    expect(holidayOn('2027-05-01', 'cn')).toBe('cn.labour');
    expect(holidayOn('2027-02-06', 'cn')).toBeNull();
  });
});

describe('United States', () => {
  it('computes the floating Monday and Thursday holidays', () => {
    expect(holidayOn('2026-01-19', 'us')).toBe('us.mlk');
    expect(holidayOn('2026-05-25', 'us')).toBe('us.memorial');
    expect(holidayOn('2026-09-07', 'us')).toBe('us.labor');
    expect(holidayOn('2026-11-26', 'us')).toBe('us.thanksgiving');
  });

  it('flags both the date and its observed weekday', () => {
    // 4 July 2026 is a Saturday, observed on Friday 3 July.
    expect(holidayOn('2026-07-04', 'us')).toBe('us.independence');
    expect(holidayOn('2026-07-03', 'us')).toBe('us.independence');
    // 1 January 2028 is a Saturday, observed on Friday 31 December 2027.
    expect(holidayOn('2027-12-31', 'us')).toBe('us.newYear');
  });
});

describe('dateFlags', () => {
  it('only flags weekends for currencies without a holiday calendar', () => {
    expect(dateFlags('2026-12-25', 'EUR')).toEqual({
      weekend: false,
      holiday: null,
      businessDay: true,
    });
    expect(dateFlags('2026-12-26', 'EUR')).toEqual({
      weekend: true,
      holiday: null,
      businessDay: false,
    });
  });
});
