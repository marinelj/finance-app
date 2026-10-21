import { aprPercent, dailyRatePercent } from '../credit';
import { dailyInterestCost, generateSchedule, totalInterest } from '../loans';

const base = {
  principal: 12000,
  aprPercent: 10.95, // 0.03% per day, a typical 借呗 rate
  startDate: '2026-10-21',
  termMonths: 12,
  currency: 'CNY' as const,
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('rate conversion', () => {
  it('turns daily quotes into APR with a 365-day year and back', () => {
    expect(aprPercent(0.03, 'daily')).toBeCloseTo(10.95, 10);
    expect(aprPercent(18, 'apr')).toBe(18);
    expect(dailyRatePercent(18.25, 'apr')).toBeCloseTo(0.05, 10);
    expect(aprPercent(null, 'apr')).toBeNull();
  });
});

describe('generateSchedule', () => {
  it('equal installment (等额本息): level payments that repay the principal exactly', () => {
    const schedule = generateSchedule({ ...base, method: 'equal_installment' });
    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toMatchObject({
      seq: 1,
      dueDate: '2026-11-21',
      interest: 109.5,
      amount: 1060.3,
    });
    for (const item of schedule.slice(0, 11)) expect(item.amount).toBe(1060.3);
    expect(Math.abs(schedule[11].amount - 1060.3)).toBeLessThan(0.05);
    expect(sum(schedule.map((i) => i.principal))).toBeCloseTo(12000, 2);
    expect(schedule[11].remaining).toBe(0);
    expect(totalInterest(schedule)).toBeCloseTo(723.6, 0);
  });

  it('equal principal (等额本金): same principal, falling interest', () => {
    const schedule = generateSchedule({ ...base, method: 'equal_principal' });
    expect(schedule[0]).toMatchObject({ principal: 1000, interest: 109.5, amount: 1109.5 });
    expect(schedule[11]).toMatchObject({ principal: 1000, interest: 9.13, amount: 1009.13 });
    expect(sum(schedule.map((i) => i.principal))).toBeCloseTo(12000, 2);
  });

  it('interest first (先息后本): principal repaid with the last payment', () => {
    const schedule = generateSchedule({ ...base, method: 'interest_first' });
    expect(schedule[0]).toMatchObject({ principal: 0, interest: 109.5, amount: 109.5 });
    expect(schedule[11]).toMatchObject({ principal: 12000, interest: 109.5, amount: 12109.5 });
  });

  it('splits evenly at zero interest and absorbs rounding in the last payment', () => {
    const schedule = generateSchedule({
      ...base,
      principal: 1000,
      aprPercent: 0,
      termMonths: 3,
      method: 'equal_installment',
    });
    expect(schedule.map((i) => i.amount)).toEqual([333.33, 333.33, 333.34]);
  });

  it('keeps month-end repayment days at month end', () => {
    const schedule = generateSchedule({
      ...base,
      startDate: '2026-01-31',
      termMonths: 3,
      method: 'equal_principal',
    });
    expect(schedule.map((i) => i.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('honours an explicit repayment day', () => {
    const schedule = generateSchedule({
      ...base,
      repaymentDay: 10,
      termMonths: 2,
      method: 'equal_principal',
    });
    expect(schedule.map((i) => i.dueDate)).toEqual(['2026-11-10', '2026-12-10']);
  });

  it('returns nothing for an empty loan', () => {
    expect(generateSchedule({ ...base, principal: 0, method: 'equal_installment' })).toEqual([]);
  });
});

describe('dailyInterestCost', () => {
  it('charges amount × daily rate × days from day one', () => {
    // ¥10,000 from 借呗 at 0.03% per day for 30 days.
    expect(dailyInterestCost(10000, 0.03, 30)).toBeCloseTo(90, 10);
    expect(dailyInterestCost(10000, 0.03, -5)).toBe(0);
  });
});
