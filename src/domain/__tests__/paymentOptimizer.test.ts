import type { CreditProduct } from '../credit';
import {
  availableCredit,
  checkLimit,
  floatCalendar,
  floatForPurchase,
  interestCosts,
  rankByFloat,
} from '../paymentOptimizer';
import { evalInTimeZone } from './helpers/timeZone';

function card(overrides: Partial<CreditProduct> = {}): CreditProduct {
  return {
    id: 'cmb',
    name: 'CMB',
    issuer: '招商银行',
    kind: 'credit_card',
    currency: 'CNY',
    creditLimit: 50000,
    balance: 8650,
    statementBalance: 6200,
    minimumPayment: null,
    statementDay: 5,
    dueRule: 'fixed_day',
    dueDay: 23,
    dueDaysAfterStatement: null,
    hasGracePeriod: true,
    interestRate: 0.05,
    interestRateUnit: 'daily',
    repaymentDay: null,
    paidThrough: '2026-09-23',
    isActive: true,
    ...overrides,
  };
}

const huabei = card({
  id: 'huabei',
  kind: 'revolving_bnpl',
  creditLimit: 15000,
  balance: 2380,
  statementDay: 31,
  dueDay: 10,
});
const chase = card({
  id: 'chase',
  currency: 'USD',
  creditLimit: 12000,
  balance: 1840.55,
  statementDay: 12,
  dueRule: 'days_after_statement',
  dueDay: null,
  dueDaysAfterStatement: 25,
});
const jiebei = card({
  id: 'jiebei',
  kind: 'installment_loan',
  creditLimit: 50000,
  balance: 10000,
  statementDay: null,
  dueRule: null,
  dueDay: null,
  hasGracePeriod: false,
  interestRate: 0.03,
  repaymentDay: 21,
});
const wangshangdai = card({
  id: 'wangshangdai',
  kind: 'installment_loan',
  creditLimit: 0,
  balance: 20000,
  statementDay: null,
  dueRule: null,
  dueDay: null,
  hasGracePeriod: false,
  interestRate: 0.04,
  repaymentDay: 15,
});

describe('floatForPurchase', () => {
  it('bills a purchase before the statement day on that statement', () => {
    expect(floatForPurchase(card(), '2026-10-21')).toMatchObject({
      statementDate: '2026-11-05',
      dueDate: '2026-11-23',
      floatDays: 33,
    });
  });

  it('keeps a purchase on the statement day in that statement', () => {
    expect(floatForPurchase(card(), '2026-11-05')).toMatchObject({
      statementDate: '2026-11-05',
      dueDate: '2026-11-23',
      floatDays: 18,
    });
  });

  it('rolls a purchase after the statement day into the next cycle', () => {
    expect(floatForPurchase(card(), '2026-11-06')).toMatchObject({
      statementDate: '2026-12-05',
      dueDate: '2026-12-23',
      floatDays: 47,
    });
  });

  it('clamps due day 31 to the end of February, including leap years', () => {
    const product = card({ statementDay: 10, dueDay: 31 });
    expect(floatForPurchase(product, '2026-01-20')).toMatchObject({
      statementDate: '2026-02-10',
      dueDate: '2026-02-28',
      floatDays: 39,
    });
    expect(floatForPurchase(product, '2028-01-20')).toMatchObject({
      dueDate: '2028-02-29',
      floatDays: 40,
    });
  });

  it('treats a statement day 31 as month end in short months', () => {
    expect(floatForPurchase(huabei, '2026-02-15')).toMatchObject({
      statementDate: '2026-02-28',
      dueDate: '2026-03-10',
      floatDays: 23,
    });
  });

  it('handles statement day = due day (due one month after the statement)', () => {
    const product = card({ statementDay: 15, dueDay: 15 });
    expect(floatForPurchase(product, '2026-10-15')).toMatchObject({
      dueDate: '2026-11-15',
      floatDays: 31,
    });
    expect(floatForPurchase(product, '2026-10-16')).toMatchObject({
      dueDate: '2026-12-15',
      floatDays: 60,
    });
  });

  it('counts days after the statement across the year end', () => {
    expect(floatForPurchase(chase, '2026-12-13')).toMatchObject({
      statementDate: '2027-01-12',
      dueDate: '2027-02-06',
      floatDays: 55,
    });
  });

  it('flags a due date on a weekend without moving it', () => {
    const product = card({ statementDay: 20, dueDay: 5 });
    const option = floatForPurchase(product, '2026-10-21');
    expect(option).toMatchObject({ dueDate: '2026-12-05', floatDays: 45 });
    expect(option?.dueFlags).toEqual({ weekend: true, holiday: null, businessDay: false });
  });

  it('flags bank holidays in the card’s own country', () => {
    const national = floatForPurchase(card({ statementDay: 10, dueDay: 1 }), '2026-09-05');
    expect(national?.dueDate).toBe('2026-10-01');
    expect(national?.dueFlags.holiday).toBe('cn.nationalDay');

    const thanksgiving = floatForPurchase(
      card({ currency: 'USD', statementDay: 1, dueDay: 26 }),
      '2026-10-21'
    );
    expect(thanksgiving?.dueDate).toBe('2026-11-26');
    expect(thanksgiving?.dueFlags.holiday).toBe('us.thanksgiving');
  });

  it('ignores loans, closed products and products without a cycle', () => {
    expect(floatForPurchase(jiebei, '2026-10-21')).toBeNull();
    expect(floatForPurchase(card({ isActive: false }), '2026-10-21')).toBeNull();
    expect(floatForPurchase(card({ statementDay: null }), '2026-10-21')).toBeNull();
    expect(floatForPurchase(card({ hasGracePeriod: false }), '2026-10-21')).toBeNull();
  });

  it('uses the device’s local date: the same instant ranks differently by time zone', () => {
    const instant = 'new Date("2026-03-01T03:30:00Z")';
    const la = evalInTimeZone(
      'America/Los_Angeles',
      'src/domain/dates.ts',
      `m.todayLocal(${instant})`
    );
    const shanghai = evalInTimeZone(
      'Asia/Shanghai',
      'src/domain/dates.ts',
      `m.todayLocal(${instant})`
    );
    expect([la, shanghai]).toEqual(['2026-02-28', '2026-03-01']);

    const product = card({ statementDay: 28, dueDay: 15 });
    // In Los Angeles it is still the statement day, so the purchase is due in two weeks; in
    // Shanghai it is already March and rolls into the next cycle.
    expect(floatForPurchase(product, la)?.floatDays).toBe(15);
    expect(floatForPurchase(product, shanghai)?.floatDays).toBe(45);
  });
});

describe('limits', () => {
  it('works out the credit left', () => {
    expect(availableCredit(card())).toBe(41350);
    expect(availableCredit(card({ balance: 60000 }))).toBe(0);
    expect(availableCredit(card({ creditLimit: 0 }))).toBeNull();
  });

  it('flags spends that do not fit, or barely fit', () => {
    expect(checkLimit(3000, null)).toBe('ok');
    expect(checkLimit(3000, 2000)).toBe('ok');
    expect(checkLimit(3000, 2900)).toBe('tight');
    expect(checkLimit(3000, 3500)).toBe('insufficient');
    expect(checkLimit(null, 100)).toBe('unknown');
  });

  it('converts the spend into the card’s currency first', () => {
    const option = floatForPurchase(
      card({ balance: 43500 }),
      '2026-10-21',
      {
        amount: 1000,
        currency: 'USD',
      },
      { USD: 1, CNY: 7.1 }
    );
    expect(option).toMatchObject({ available: 6500, spendInCurrency: 7100, limit: 'insufficient' });
  });
});

describe('rankByFloat', () => {
  const products = [card(), huabei, chase, jiebei, wangshangdai];

  it('ranks only interest-free products, longest float first', () => {
    const { ranked, excluded } = rankByFloat(products, '2026-10-21');
    expect(ranked.map((option) => [option.productId, option.floatDays])).toEqual([
      ['chase', 47],
      ['cmb', 33],
      ['huabei', 20],
    ]);
    expect(excluded).toEqual([]);
  });

  it('moves cards that cannot take the spend out of the ranking', () => {
    const { ranked, excluded } = rankByFloat(
      products,
      '2026-10-21',
      {
        amount: 14000,
        currency: 'CNY',
      },
      { USD: 1, CNY: 7.1 }
    );
    // Chase has $10,159.45 left (≈ ¥72,132), CMB ¥41,350, Huabei only ¥12,620.
    expect(ranked.map((option) => option.productId)).toEqual(['chase', 'cmb']);
    expect(excluded.map((option) => option.productId)).toEqual(['huabei']);
  });

  it('breaks ties by the credit left', () => {
    const a = card({ id: 'a', balance: 40000 });
    const b = card({ id: 'b', balance: 1000 });
    expect(rankByFloat([a, b], '2026-10-21').ranked.map((option) => option.productId)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('floatCalendar', () => {
  const products = [card(), huabei, chase];
  const calendar = floatCalendar(products, '2026-10-21', 30);

  it('covers the next 30 days starting today', () => {
    expect(calendar).toHaveLength(30);
    expect(calendar[0].date).toBe('2026-10-21');
    expect(calendar[29].date).toBe('2026-11-19');
  });

  it('picks the longest float for every day', () => {
    for (const day of calendar) {
      const longest = Math.max(...day.ranked.map((option) => option.floatDays));
      expect(day.best?.floatDays).toBe(longest);
    }
  });

  it('switches cards around statement days', () => {
    const best = (date: string) => calendar.find((day) => day.date === date)?.best;
    expect(best('2026-10-21')).toMatchObject({ productId: 'chase', floatDays: 47 });
    // Huabei's October bill closed on the 31st, so a November purchase waits until December.
    expect(best('2026-11-01')).toMatchObject({ productId: 'huabei', floatDays: 39 });
    // The day after CMB's statement gives the longest float of the month.
    expect(best('2026-11-06')).toMatchObject({ productId: 'cmb', floatDays: 47 });
    expect(best('2026-11-13')).toMatchObject({ productId: 'chase', floatDays: 54 });
  });
});

describe('interestCosts', () => {
  it('lists products that charge from day one, highest rate first', () => {
    const costs = interestCosts([card(), jiebei, wangshangdai, huabei]);
    expect(costs.map((cost) => [cost.productId, cost.aprPercent])).toEqual([
      ['wangshangdai', 14.6],
      ['jiebei', 10.95],
    ]);
  });

  it('shows the actual cost: amount × daily rate × days', () => {
    const [ws, jb] = interestCosts([jiebei, wangshangdai], { amount: 5000, currency: 'CNY' }, 30);
    expect(jb).toMatchObject({ dailyRatePercent: 0.03, dailyCostOfBalance: 3, costOfSpend: 45 });
    expect(ws).toMatchObject({ dailyRatePercent: 0.04, dailyCostOfBalance: 8, costOfSpend: 60 });
  });

  it('converts the spend into the loan’s currency', () => {
    const [cost] = interestCosts([jiebei], { amount: 100, currency: 'USD' }, 10, {
      USD: 1,
      CNY: 7,
    });
    expect(cost.costOfSpend).toBe(2.1);
  });
});
