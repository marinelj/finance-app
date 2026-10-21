import { completeTable, convert, DEFAULT_FX, rate, withRateToHome } from '../fx';

describe('fx', () => {
  const table = { USD: 1, CNY: 7.2, HKD: 7.8 };

  it('converts through the USD base', () => {
    expect(convert(100, 'USD', 'CNY', table)).toBeCloseTo(720, 10);
    expect(convert(720, 'CNY', 'USD', table)).toBeCloseTo(100, 10);
    expect(convert(78, 'HKD', 'CNY', table)).toBeCloseTo(72, 10);
    expect(convert(5, 'CNY', 'CNY', table)).toBe(5);
  });

  it('falls back to defaults for missing or invalid entries', () => {
    expect(convert(1, 'EUR', 'USD', {})).toBeCloseTo(1 / DEFAULT_FX.EUR, 10);
    expect(convert(1, 'USD', 'CNY', { CNY: 0 })).toBe(DEFAULT_FX.CNY);
  });

  it('reports quotes as "1 base = x quote"', () => {
    expect(rate('USD', 'CNY', table)).toBeCloseTo(7.2, 10);
    expect(rate('CNY', 'USD', table)).toBeCloseTo(1 / 7.2, 10);
  });

  it('edits a rate relative to the home currency', () => {
    // "1 USD = 7.3 CNY" with CNY as home.
    const next = withRateToHome(table, 'USD', 'CNY', 7.3);
    expect(rate('USD', 'CNY', next)).toBeCloseTo(7.3, 10);
    // "1 HKD = 0.93 CNY" leaves the other rates alone.
    const hkd = withRateToHome(table, 'HKD', 'CNY', 0.93);
    expect(rate('HKD', 'CNY', hkd)).toBeCloseTo(0.93, 10);
    expect(rate('USD', 'CNY', hkd)).toBeCloseTo(7.2, 10);
    expect(withRateToHome(table, 'CNY', 'CNY', 2)).toBe(table);
    expect(withRateToHome(table, 'USD', 'CNY', 0)).toBe(table);
  });

  it('fills a complete table', () => {
    const full = completeTable({ CNY: 7.2 });
    expect(full.CNY).toBe(7.2);
    expect(full.JPY).toBe(DEFAULT_FX.JPY);
  });
});
