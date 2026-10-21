import { bondYields, summarizeInputs, type PortfolioInputs } from '../portfolio';

const fx = { USD: 1, CNY: 7 };
const today = '2026-10-21';

const inputs: PortfolioInputs = {
  incomes: [
    { amount: 30000, period: 'monthly', currency: 'CNY' },
    { amount: 84000, period: 'annual', currency: 'CNY' },
  ],
  housing: [
    {
      kind: 'mortgage',
      currency: 'CNY',
      monthlyRent: null,
      balance: 1_000_000,
      ratePercent: 3.1,
      remainingMonths: 360,
      monthlyPayment: 8000,
      propertyValue: 3_000_000,
    },
    {
      kind: 'rent',
      currency: 'CNY',
      monthlyRent: 2000,
      balance: 50000,
      ratePercent: null,
      remainingMonths: null,
      monthlyPayment: null,
      propertyValue: 999,
    },
  ],
  insurance: [
    {
      type: 'health',
      premium: 1200,
      premiumPeriod: 'annual',
      coverage: 2_000_000,
      currency: 'CNY',
    },
    { type: 'life', premium: 50, premiumPeriod: 'monthly', coverage: null, currency: 'USD' },
  ],
  expenses: [
    { category: 'food', amount: 3000, essential: true, currency: 'CNY' },
    { category: 'travel', amount: 1000, essential: false, currency: 'CNY' },
  ],
  cash: [
    { balance: 60000, isEmergencyFund: true, ratePercent: 1.5, currency: 'CNY' },
    { balance: 5000, isEmergencyFund: false, ratePercent: null, currency: 'USD' },
  ],
  bonds: [
    {
      faceValue: 10000,
      couponRate: 5,
      couponFrequency: 2,
      maturityDate: '2031-03-15',
      currency: 'USD',
      purchaseDate: null,
      purchasePrice: 98,
      currentPrice: null,
    },
  ],
  stocks: [
    {
      shares: 40,
      costBasis: 8000,
      price: 250,
      dividendPerShare: 0.9,
      dividendFrequency: 4,
      firstPayMonth: 3,
      currency: 'USD',
      assetClass: 'domestic_equity',
    },
  ],
};

describe('summarizeInputs', () => {
  const overview = summarizeInputs(inputs, today, 'CNY', fx);

  it('turns everything into monthly amounts in the home currency', () => {
    expect(overview.income).toBeCloseTo(37000, 6);
    expect(overview.housing).toBeCloseTo(10000, 6);
    expect(overview.insurance).toBeCloseTo(100 + 350, 6);
    expect(overview.expenses).toBe(4000);
    expect(overview.essentialExpenses).toBe(3000);
  });

  it('values cash, bonds, stocks, property and the mortgage', () => {
    expect(overview.cash).toBeCloseTo(95000, 6);
    expect(overview.emergencyFund).toBe(60000);
    // 98 clean + 0.5 accrued (36 of 180 days of a 2.5-point coupon), on $10,000 face, at 7.
    expect(overview.bonds).toBeCloseTo(9850 * 7, 6);
    expect(overview.stocks).toBeCloseTo(70000, 6);
    expect(overview.property).toBe(3_000_000);
    expect(overview.mortgage).toBe(1_000_000);
  });

  it('adds up yearly coupons and dividends', () => {
    expect(overview.coupons).toBeCloseTo(3500, 6);
    expect(overview.dividends).toBeCloseTo(144 * 7, 6);
  });
});

describe('bondYields', () => {
  const bond = {
    faceValue: 5000,
    couponRate: 3.3,
    couponFrequency: 2,
    maturityDate: '2027-02-06',
    currency: 'USD' as const,
    purchaseDate: '2024-11-18',
    purchasePrice: 98.2,
    currentPrice: null,
  };

  it('reports the yield locked in at purchase, not one at the old price today', () => {
    const { atPurchase, atCurrentPrice } = bondYields(bond, today);
    expect(atPurchase).toBeCloseTo(4.16, 1);
    expect(atCurrentPrice).toBeNull();
  });

  it('adds the yield at today’s price when one is entered', () => {
    expect(bondYields({ ...bond, currentPrice: 99.8 }, today).atCurrentPrice).toBeCloseTo(3.98, 2);
  });
});
