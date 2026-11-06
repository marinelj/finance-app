import { amortizedPayment, monthlyEquivalent, monthlyHousingCost } from '../cashflow';
import {
  annualDividendIncome,
  dividendMonths,
  dividendYield,
  stockMarketValue,
  unrealizedGain,
  unrealizedReturn,
  yieldOnCost,
  type StockHolding,
} from '../stocks';

describe('stocks', () => {
  const vti: StockHolding = {
    shares: 40,
    costBasis: 8000,
    price: 250,
    dividendPerShare: 0.9,
    dividendFrequency: 4,
    firstPayMonth: 3,
    currency: 'USD',
  };

  it('values the position and the gain', () => {
    expect(stockMarketValue(vti)).toBe(10000);
    expect(unrealizedGain(vti)).toBe(2000);
    expect(unrealizedReturn(vti)).toBeCloseTo(0.25, 10);
  });

  it('computes annual dividend income and yields', () => {
    expect(annualDividendIncome(vti)).toBe(144);
    expect(dividendYield(vti)).toBeCloseTo(0.0144, 10);
    expect(yieldOnCost(vti)).toBeCloseTo(0.018, 10);
  });

  it('handles positions without dividends or cost', () => {
    const growth = { ...vti, dividendPerShare: 0, dividendFrequency: 0 as const, costBasis: 0 };
    expect(annualDividendIncome(growth)).toBe(0);
    expect(yieldOnCost(growth)).toBeNull();
    expect(unrealizedReturn(growth)).toBeNull();
  });

  it('spreads payments evenly from the first pay month', () => {
    expect(dividendMonths(4, 2)).toEqual([2, 5, 8, 11]);
    expect(dividendMonths(4, 11)).toEqual([2, 5, 8, 11]);
    expect(dividendMonths(2, 6)).toEqual([6, 12]);
    expect(dividendMonths(12, null)).toHaveLength(12);
    expect(dividendMonths(4, null)).toEqual([3, 6, 9, 12]);
    expect(dividendMonths(1, null)).toEqual([12]);
    expect(dividendMonths(0, 3)).toEqual([]);
  });
});

describe('cash flow', () => {
  it('normalises amounts to a month', () => {
    expect(monthlyEquivalent(1200, 'annual')).toBe(100);
    expect(monthlyEquivalent(600, 'semiannual')).toBe(100);
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100);
    expect(monthlyEquivalent(100, 'monthly')).toBe(100);
  });

  it('computes a level mortgage payment', () => {
    // ¥1,000,000 over 30 years at 3.1%.
    expect(amortizedPayment(1_000_000, 3.1, 360)).toBeCloseTo(4270.16, 2);
    expect(amortizedPayment(12000, 0, 12)).toBe(1000);
    expect(amortizedPayment(0, 3, 12)).toBe(0);
  });

  it('uses rent, the entered payment, or an estimate', () => {
    const base = {
      monthlyPayment: null,
      monthlyRent: null,
      balance: null,
      ratePercent: null,
      remainingMonths: null,
    };
    expect(monthlyHousingCost({ ...base, kind: 'rent', monthlyRent: 6500 })).toBe(6500);
    expect(monthlyHousingCost({ ...base, kind: 'mortgage', monthlyPayment: 8000 })).toBe(8000);
    expect(
      monthlyHousingCost({
        ...base,
        kind: 'mortgage',
        balance: 1_000_000,
        ratePercent: 3.1,
        remainingMonths: 360,
      })
    ).toBeCloseTo(4270.16, 2);
    expect(monthlyHousingCost({ ...base, kind: 'owned' })).toBe(0);
  });
});
