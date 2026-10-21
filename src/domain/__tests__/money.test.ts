import {
  formatMoney,
  formatMoneyParts,
  formatPercent,
  isCurrencyCode,
  roundMoney,
  roundTo,
} from '../money';

describe('roundTo / roundMoney', () => {
  it('rounds half away from zero despite binary artefacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(1.004999, 2)).toBe(1);
  });

  it('uses the minor unit of each currency', () => {
    expect(roundMoney(10.555, 'CNY')).toBe(10.56);
    expect(roundMoney(1234.5, 'JPY')).toBe(1235);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundTo(-0.001, 2), 0)).toBe(true);
  });
});

describe('formatMoney', () => {
  it('formats with grouping and the currency symbol', () => {
    expect(formatMoney(1234567.891, 'CNY')).toBe('¥1,234,567.89');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
    expect(formatMoney(999.999, 'USD')).toBe('$1,000.00');
    expect(formatMoney(1500, 'JPY')).toBe('JP¥1,500');
  });

  it('handles signs', () => {
    expect(formatMoney(-42.5, 'USD')).toBe('-$42.50');
    expect(formatMoney(42.5, 'USD', { sign: 'always' })).toBe('+$42.50');
    expect(formatMoney(-42.5, 'USD', { sign: 'never' })).toBe('$42.50');
    expect(formatMoney(-0.001, 'USD')).toBe('$0.00');
  });

  it('compacts with 万 and 亿 in Chinese', () => {
    expect(formatMoney(123456, 'CNY', { compact: true, locale: 'zh-Hans' })).toBe('¥12.35万');
    expect(formatMoney(120000, 'CNY', { compact: true, locale: 'zh-Hans' })).toBe('¥12万');
    expect(formatMoney(250_000_000, 'CNY', { compact: true, locale: 'zh-Hans' })).toBe('¥2.5亿');
    expect(formatMoney(9999, 'CNY', { compact: true, locale: 'zh-Hans' })).toBe('¥9,999.00');
  });

  it('compacts with K / M / B in English', () => {
    expect(formatMoney(123456, 'USD', { compact: true })).toBe('$123.5K');
    expect(formatMoney(2_000_000, 'USD', { compact: true })).toBe('$2M');
    expect(formatMoney(-1_250_000_000, 'USD', { compact: true })).toBe('-$1.3B');
  });

  it('treats non-finite input as zero', () => {
    expect(formatMoney(Number.NaN, 'CNY')).toBe('¥0.00');
  });

  it('exposes parts for typographic rendering', () => {
    expect(formatMoneyParts(-1234.5, 'GBP')).toEqual({
      sign: '-',
      symbol: '£',
      integer: '1,234',
      fraction: '50',
      suffix: '',
    });
    expect(formatMoneyParts(5, 'USD', { symbol: false }).symbol).toBe('');
  });
});

describe('formatPercent', () => {
  it('formats fractions as percentages', () => {
    expect(formatPercent(0.1234)).toBe('12.3%');
    expect(formatPercent(0.1095, { decimals: 2 })).toBe('10.95%');
    expect(formatPercent(-0.05)).toBe('-5.0%');
    expect(formatPercent(0.05, { sign: 'always' })).toBe('+5.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });
});

describe('isCurrencyCode', () => {
  it('accepts supported codes only', () => {
    expect(isCurrencyCode('CNY')).toBe(true);
    expect(isCurrencyCode('XYZ')).toBe(false);
  });
});

describe('maxDecimals', () => {
  it('drops decimals for axis ticks, keeping compact units', () => {
    expect(formatMoney(400, 'USD', { maxDecimals: 0 })).toBe('$400');
    expect(formatMoney(400, 'USD', { maxDecimals: 0, compact: true })).toBe('$400');
    expect(formatMoney(420000, 'USD', { maxDecimals: 0, compact: true })).toBe('$420K');
    expect(formatMoney(1250, 'JPY', { maxDecimals: 2 })).toBe('JP¥1,250');
  });
});
