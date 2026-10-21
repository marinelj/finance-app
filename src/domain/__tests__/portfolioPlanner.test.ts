import type { CreditProduct, Installment } from '../credit';
import type { PortfolioInputs } from '../portfolio';
import {
  allocationGaps,
  buildPlan,
  debtsFromCredit,
  expectedReturn,
  healthRatios,
  insuranceGaps,
  passiveIncomeCalendar,
  projectNetWorth,
  splitContribution,
  TARGET_ALLOCATIONS,
  type Action,
  type DebtInput,
  type Plan,
} from '../portfolioPlanner';
import { scoreRisk } from '../riskProfile';

const today = '2026-10-21';
const fx = { USD: 1, CNY: 7 };

const inputs: PortfolioInputs = {
  incomes: [{ amount: 30000, period: 'monthly', currency: 'CNY' }],
  housing: [
    {
      kind: 'mortgage',
      currency: 'CNY',
      monthlyRent: null,
      balance: 1_000_000,
      ratePercent: 3.1,
      remainingMonths: 300,
      monthlyPayment: 8000,
      propertyValue: 3_000_000,
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
  ],
  expenses: [
    { category: 'food', amount: 4000, essential: true, currency: 'CNY' },
    { category: 'travel', amount: 2000, essential: false, currency: 'CNY' },
  ],
  cash: [
    { balance: 20000, isEmergencyFund: true, ratePercent: null, currency: 'CNY' },
    { balance: 10000, isEmergencyFund: false, ratePercent: null, currency: 'CNY' },
  ],
  bonds: [],
  stocks: [
    {
      shares: 5000,
      price: 10,
      costBasis: 45000,
      dividendPerShare: 0.1,
      dividendFrequency: 1,
      firstPayMonth: 1,
      currency: 'CNY',
      assetClass: 'domestic_equity',
    },
    {
      shares: 10,
      price: 100,
      costBasis: 900,
      dividendPerShare: null,
      dividendFrequency: 0,
      firstPayMonth: null,
      currency: 'USD',
      assetClass: 'international_equity',
    },
  ],
};

const debts: DebtInput[] = [
  {
    id: 'jiebei',
    name: '借呗',
    kind: 'installment_loan',
    hasGracePeriod: false,
    balance: 12000,
    creditLimit: 0,
    aprPercent: 10.95,
    monthlyPayment: 1060,
  },
  {
    id: 'card',
    name: 'CMB',
    kind: 'credit_card',
    hasGracePeriod: true,
    balance: 5000,
    creditLimit: 50000,
    aprPercent: 18.25,
    monthlyPayment: 0,
  },
];

const risk = scoreRisk({
  age: 34,
  horizon: 'over15',
  goal: 'balanced',
  dropReaction: 'hold',
  incomeStability: 'stable',
});

function plan(overrides: Partial<Parameters<typeof buildPlan>[0]> = {}): Plan {
  return buildPlan({ today, home: 'CNY', fx, inputs, debts, risk, ...overrides });
}

function action<K extends Action['key']>(result: Plan, key: K): Extract<Action, { key: K }> {
  const found = result.actions.find((item) => item.key === key);
  if (!found) throw new Error(`no ${key} action`);
  return found as Extract<Action, { key: K }>;
}

describe('debtsFromCredit', () => {
  const product = (overrides: Partial<CreditProduct>): CreditProduct => ({
    id: 'p',
    name: 'P',
    issuer: '',
    kind: 'credit_card',
    currency: 'CNY',
    creditLimit: 10000,
    balance: 2000,
    statementBalance: null,
    minimumPayment: 200,
    statementDay: 5,
    dueRule: 'fixed_day',
    dueDay: 23,
    dueDaysAfterStatement: null,
    hasGracePeriod: true,
    interestRate: 18,
    interestRateUnit: 'apr',
    repaymentDay: null,
    paidThrough: null,
    isActive: true,
    ...overrides,
  });
  const installment: Installment = {
    id: 'i',
    productId: 'loan',
    seq: 3,
    dueDate: '2026-11-10',
    principal: 990,
    interest: 70,
    amount: 1060,
    paidAt: null,
  };

  it('uses the next installment for loans and nothing for cards', () => {
    const result = debtsFromCredit(
      [
        product({}),
        product({
          id: 'loan',
          kind: 'installment_loan',
          hasGracePeriod: false,
          interestRate: 0.03,
          interestRateUnit: 'daily',
        }),
        product({
          id: 'fixed',
          kind: 'installment_loan',
          hasGracePeriod: false,
          minimumPayment: 1780,
        }),
        product({ id: 'closed', isActive: false }),
      ],
      [installment],
      today,
      'CNY',
      fx
    );
    expect(result.map((debt) => [debt.id, debt.monthlyPayment, debt.aprPercent])).toEqual([
      ['p', 0, 18],
      ['loan', 1060, 10.95],
      ['fixed', 1780, 18],
    ]);
  });

  it('converts into the home currency', () => {
    const [debt] = debtsFromCredit([product({ currency: 'USD' })], [], today, 'CNY', fx);
    expect(debt).toMatchObject({ balance: 14000, creditLimit: 70000 });
  });
});

describe('buildPlan: net worth and cash flow', () => {
  const result = plan();

  it('adds up assets and liabilities', () => {
    expect(result.netWorth).toMatchObject({
      cash: 30000,
      stocks: 57000,
      property: 3_000_000,
      assets: 3_087_000,
      creditDebt: 17000,
      mortgage: 1_000_000,
      liabilities: 1_017_000,
      netWorth: 2_070_000,
    });
  });

  it('works out the monthly surplus: income − (debt + housing + insurance + expenses)', () => {
    expect(result.cashFlow).toEqual({
      income: 30000,
      debtPayments: 1060,
      housing: 8000,
      insurance: 100,
      expenses: 6000,
      outflows: 15160,
      surplus: 14840,
    });
  });
});

describe('health ratios', () => {
  it('colours each ratio by its thresholds', () => {
    const ratios = Object.fromEntries(plan().ratios.map((ratio) => [ratio.key, ratio]));
    expect(ratios.debtToIncome).toMatchObject({ tone: 'good' });
    expect(ratios.debtToIncome.value).toBeCloseTo(9060 / 30000, 10);
    expect(ratios.housingCost.value).toBeCloseTo(8000 / 30000, 10);
    expect(ratios.insuranceCost).toMatchObject({ tone: 'good' });
    // Essentials: 4,000 food + 8,000 housing + 100 insurance + 1,060 loan = 13,160.
    expect(ratios.emergencyMonths.value).toBeCloseTo(20000 / 13160, 10);
    expect(ratios.emergencyMonths.tone).toBe('danger');
    expect(ratios.creditUtilization).toMatchObject({ value: 0.1, tone: 'good' });
  });

  it('marks each boundary', () => {
    const base = {
      cashFlow: {
        income: 10000,
        debtPayments: 0,
        housing: 0,
        insurance: 0,
        expenses: 0,
        outflows: 0,
        surplus: 10000,
      },
      mortgagePayments: 0,
      emergencyCash: 0,
      essentialMonthly: 1000,
      revolvingBalance: 0,
      revolvingLimit: 0,
      emergencyTargetMonths: 6,
    };
    const tone = (key: string, input: Partial<typeof base>) =>
      healthRatios({ ...base, ...input }).find((ratio) => ratio.key === key)?.tone;
    expect(tone('debtToIncome', { mortgagePayments: 3600 })).toBe('good');
    expect(tone('debtToIncome', { mortgagePayments: 4300 })).toBe('caution');
    expect(tone('debtToIncome', { mortgagePayments: 4400 })).toBe('danger');
    expect(tone('insuranceCost', {})).toBe('caution');
    expect(tone('emergencyMonths', { emergencyCash: 6000 })).toBe('good');
    expect(tone('emergencyMonths', { emergencyCash: 3000 })).toBe('caution');
    expect(tone('creditUtilization', { revolvingBalance: 8000, revolvingLimit: 10000 })).toBe(
      'danger'
    );
    expect(tone('creditUtilization', {})).toBeNull();
  });

  it('cannot work out income ratios without income', () => {
    const result = plan({ inputs: { ...inputs, incomes: [] } });
    expect(result.ratios.find((ratio) => ratio.key === 'debtToIncome')?.value).toBeNull();
    expect(result.actions.map((item) => item.key)).not.toContain('fixCashFlow');
    expect(result.actions.map((item) => item.key)).not.toContain('invest');
  });
});

describe('the action plan', () => {
  const result = plan();

  it('puts the steps in order', () => {
    expect(result.actions.map((item) => item.key)).toEqual([
      'payHighInterest',
      'emergencyFund',
      'insurance',
      'invest',
      'rebalance',
      'payCardsInFull',
    ]);
  });

  it('pays debt above the APR threshold first, highest rate first; cards are not loans', () => {
    expect(action(result, 'payHighInterest')).toMatchObject({
      done: false,
      threshold: 6,
      debts: [{ id: 'jiebei', aprPercent: 10.95, balance: 12000 }],
      total: 12000,
      months: 1,
      keepStarterFund: false,
    });
  });

  it('respects a different threshold', () => {
    expect(
      action(plan({ settings: { highInterestApr: 12, emergencyMonths: 6 } }), 'payHighInterest')
        .done
    ).toBe(true);
  });

  it('builds the emergency fund to six months of essentials', () => {
    expect(action(result, 'emergencyFund')).toMatchObject({
      done: false,
      essentialMonthly: 13160,
      target: 78960,
      current: 20000,
      gap: 58960,
      months: 4,
    });
  });

  it('flags insurance gaps relative to income, without suggesting products', () => {
    expect(action(result, 'insurance').gaps).toEqual([
      { key: 'lowLife', coverage: 0, suggested: 3_600_000 },
      { key: 'noCriticalIllness', suggested: 1_080_000 },
    ]);
  });

  it('invests the surplus after the earlier steps, by the risk profile', () => {
    const invest = action(result, 'invest');
    expect(invest).toMatchObject({
      monthly: 14840,
      profile: 'growth',
      afterEarlierSteps: true,
      assumedProfile: false,
    });
    expect(Object.values(invest.split).reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      14840,
      6
    );
  });

  it('assumes Balanced until the quiz is taken', () => {
    expect(action(plan({ risk: null }), 'invest')).toMatchObject({
      profile: 'balanced',
      assumedProfile: true,
    });
  });

  it('asks to fix a negative cash flow before investing', () => {
    const tight = plan({
      inputs: { ...inputs, incomes: [{ amount: 12000, period: 'monthly', currency: 'CNY' }] },
    });
    expect(action(tight, 'fixCashFlow').shortfall).toBe(3160);
    expect(tight.actions.map((item) => item.key)).not.toContain('invest');
  });

  it('suggests rebalancing when a bucket drifts more than 5% of the total', () => {
    const rebalance = action(result, 'rebalance');
    expect(rebalance.total).toBe(67000);
    expect(rebalance.largest).toEqual({ bucket: 'domestic_equity', gap: -23200 });
    expect(rebalance.done).toBe(false);
  });

  it('reminds to pay cards in full, naming the highest rate', () => {
    expect(action(result, 'payCardsInFull')).toMatchObject({ highestApr: 18.25, name: 'CMB' });
  });
});

describe('allocation maths', () => {
  const target = TARGET_ALLOCATIONS.growth;
  const current = {
    cash: 10000,
    bonds: 0,
    domestic_equity: 50000,
    international_equity: 7000,
    other: 0,
  };

  it('has targets that add up to 100% for every profile', () => {
    for (const shares of Object.values(TARGET_ALLOCATIONS)) {
      expect(Object.values(shares).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    }
  });

  it('measures the gap to target per bucket', () => {
    expect(allocationGaps(current, target)).toEqual({
      cash: 3350 - 10000,
      bonds: 13400,
      domestic_equity: 26800 - 50000,
      international_equity: 20100 - 7000,
      other: 3350,
    });
  });

  it('sends new money to underweight buckets only', () => {
    const split = splitContribution(current, target, 14840);
    expect(split.cash).toBe(0);
    expect(split.domestic_equity).toBe(0);
    expect(split.bonds).toBeCloseTo((14840 * 16368) / 38012, 6);
    expect(split.international_equity).toBeCloseTo((14840 * 17552) / 38012, 6);
    expect(split.other).toBeCloseTo((14840 * 4092) / 38012, 6);
  });

  it('lands every bucket on target when none is overweight', () => {
    const split = splitContribution(
      { cash: 5, bonds: 20, domestic_equity: 40, international_equity: 30, other: 0 },
      target,
      5
    );
    expect(split.other).toBeCloseTo(5, 10);
    expect(split.bonds).toBeCloseTo(0, 10);
  });

  it('weights the return assumptions by the target', () => {
    expect(expectedReturn(target)).toBeCloseTo(5.525, 10);
  });
});

describe('passive income calendar', () => {
  it('places coupons and dividends in the months they arrive', () => {
    const months = passiveIncomeCalendar(
      {
        stocks: inputs.stocks,
        bonds: [
          {
            faceValue: 10000,
            couponRate: 5,
            couponFrequency: 2,
            maturityDate: '2031-03-15',
            currency: 'USD',
            purchaseDate: null,
            purchasePrice: null,
            currentPrice: null,
          },
        ],
      },
      today,
      'CNY',
      fx
    );
    expect(months.map((item) => item.month)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
      '2027-06',
      '2027-07',
      '2027-08',
      '2027-09',
    ]);
    const byMonth = Object.fromEntries(months.map((item) => [item.month, item]));
    expect(byMonth['2027-01']).toMatchObject({ dividends: 500, coupons: 0 });
    expect(byMonth['2027-03'].coupons).toBe(1750);
    expect(byMonth['2027-09'].coupons).toBe(1750);
    expect(byMonth['2026-11']).toMatchObject({ coupons: 0, dividends: 0 });
  });

  it('totals a year of passive income in the plan', () => {
    expect(plan().passive).toMatchObject({ annual: 500, monthlyAverage: 500 / 12 });
  });
});

describe('insurance gaps', () => {
  it('flags missing health cover and premiums above 15% of income', () => {
    const gaps = insuranceGaps(
      {
        insurance: [
          {
            type: 'life',
            premium: 2000,
            premiumPeriod: 'monthly',
            coverage: 9_000_000,
            currency: 'CNY',
          },
        ],
        housing: [],
        expenses: [],
      },
      10000,
      'CNY',
      fx
    );
    expect(gaps).toEqual([
      { key: 'noHealth' },
      { key: 'noCriticalIllness', suggested: 360000 },
      { key: 'highPremiums', share: 0.2 },
    ]);
  });
});

describe('projectNetWorth', () => {
  it('compounds monthly and adds the monthly investment', () => {
    const points = projectNetWorth({
      invested: 100000,
      other: 50000,
      monthly: 1000,
      annualReturnPercent: 6,
      years: 1,
    });
    expect(points[0]).toEqual({ year: 0, netWorth: 150000 });
    expect(points[1].netWorth).toBeCloseTo(150000 + 106167.78 - 100000 + 12335.56 + 0, 0);
  });

  it('is a straight line at a 0% return', () => {
    const points = projectNetWorth({
      invested: 0,
      other: 0,
      monthly: 1000,
      annualReturnPercent: 0,
      years: 20,
    });
    expect(points.map((point) => point.netWorth)).toEqual(
      Array.from({ length: 21 }, (_, year) => year * 12000)
    );
  });
});
