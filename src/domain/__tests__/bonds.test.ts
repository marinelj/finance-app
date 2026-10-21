import {
  accruedInterest,
  annualCouponIncome,
  bondMarketValue,
  couponDates,
  couponSchedule,
  currentYield,
  days30360,
  previousCouponDate,
  priceFromYield,
  yearsToMaturity,
  yieldToMaturity,
  type Bond,
} from '../bonds';

const bond = (overrides: Partial<Bond> = {}): Bond => ({
  faceValue: 10000,
  couponRate: 5,
  couponFrequency: 2,
  maturityDate: '2031-03-15',
  currency: 'USD',
  ...overrides,
});

describe('coupon dates', () => {
  it('counts back from maturity in equal steps', () => {
    expect(couponDates(bond(), '2030-01-01')).toEqual(['2030-03-15', '2030-09-15', '2031-03-15']);
    expect(couponDates(bond({ couponFrequency: 4 }), '2030-10-01')).toEqual([
      '2030-12-15',
      '2031-03-15',
    ]);
  });

  it('keeps month-end maturities at month end, including February', () => {
    expect(couponDates(bond({ maturityDate: '2030-08-31' }), '2029-08-01')).toEqual([
      '2029-08-31',
      '2030-02-28',
      '2030-08-31',
    ]);
  });

  it('pays a zero-coupon bond once, at maturity', () => {
    expect(couponDates(bond({ couponFrequency: 0 }), '2026-10-21')).toEqual(['2031-03-15']);
  });

  it('returns nothing after maturity', () => {
    expect(couponDates(bond(), '2031-03-16')).toEqual([]);
  });

  it('finds the start of the current coupon period', () => {
    expect(previousCouponDate(bond(), '2026-10-21')).toBe('2026-09-15');
    expect(previousCouponDate(bond(), '2026-09-15')).toBe('2026-09-15');
  });
});

describe('coupon schedule', () => {
  it('pays face × rate / frequency, plus the face value at maturity', () => {
    expect(couponSchedule(bond(), '2030-06-01')).toEqual([
      { date: '2030-09-15', amount: 250, principal: 0 },
      { date: '2031-03-15', amount: 10250, principal: 10000 },
    ]);
  });

  it('can stop at a date, for a 12-month calendar', () => {
    expect(couponSchedule(bond(), '2026-10-21', '2027-10-20').map((item) => item.date)).toEqual([
      '2027-03-15',
      '2027-09-15',
    ]);
  });

  it('reports yearly coupon income', () => {
    expect(annualCouponIncome(bond())).toBe(500);
  });
});

describe('30/360 and accrued interest', () => {
  it('counts 30-day months', () => {
    expect(days30360('2026-03-15', '2026-09-15')).toBe(180);
    expect(days30360('2026-01-31', '2026-03-01')).toBe(31);
    expect(days30360('2026-01-30', '2026-03-31')).toBe(60);
  });

  it('accrues linearly through the coupon period', () => {
    // 60 of 180 days into a 2.5-point coupon.
    expect(accruedInterest(bond(), '2026-11-15')).toBeCloseTo(0.8333, 4);
    expect(accruedInterest(bond(), '2026-09-15')).toBe(0);
    expect(accruedInterest(bond({ couponFrequency: 0 }), '2026-11-15')).toBe(0);
  });
});

describe('price and yield', () => {
  it('prices a bond at par when its yield equals its coupon on a coupon date', () => {
    expect(priceFromYield(bond(), '2026-09-15', 5)).toBeCloseTo(100, 8);
    expect(yieldToMaturity(bond(), '2026-09-15', 100)).toBeCloseTo(5, 6);
  });

  it('matches the textbook 10-year example', () => {
    // 6% semiannual, 10 years, 7% yield: 3 × a(20, 3.5%) + 100 × 1.035^-20 = 92.8938.
    const tenYear = bond({ couponRate: 6, maturityDate: '2036-09-15' });
    expect(priceFromYield(tenYear, '2026-09-15', 7)).toBeCloseTo(92.8938, 3);
    expect(yieldToMaturity(tenYear, '2026-09-15', 92.8938)).toBeCloseTo(7, 4);
  });

  it('yields more than the coupon below par and less above par', () => {
    expect(yieldToMaturity(bond(), '2026-10-21', 96)).toBeGreaterThan(5);
    expect(yieldToMaturity(bond(), '2026-10-21', 104)).toBeLessThan(5);
  });

  it('round-trips price and yield between coupon dates', () => {
    const price = priceFromYield(bond(), '2026-11-15', 6.2);
    expect(yieldToMaturity(bond(), '2026-11-15', price)).toBeCloseTo(6.2, 6);
    // Close to par when the yield equals the coupon mid-period.
    expect(priceFromYield(bond(), '2026-11-15', 5)).toBeCloseTo(100, 1);
  });

  it('discounts a zero-coupon bond over the years to maturity', () => {
    const zero = bond({ couponFrequency: 0, couponRate: 0, maturityDate: '2031-10-21' });
    const price = priceFromYield(zero, '2026-10-21', 4);
    expect(price).toBeCloseTo(100 / 1.04 ** (1826 / 365), 6);
    expect(yieldToMaturity(zero, '2026-10-21', price)).toBeCloseTo(4, 6);
  });

  it('has no yield after maturity or without a price', () => {
    expect(yieldToMaturity(bond(), '2031-03-15', 99)).toBeNull();
    expect(yieldToMaturity(bond(), '2026-10-21', 0)).toBeNull();
  });

  it('works out current yield, market value and years left', () => {
    expect(currentYield(bond(), 98)).toBeCloseTo(5.102, 3);
    expect(bondMarketValue(bond(), 98, '2026-11-15')).toBe(9883.33);
    expect(yearsToMaturity(bond(), '2026-10-21')).toBe(4.4);
  });
});
