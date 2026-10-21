import {
  billingCycleOf,
  cycleForPurchase,
  cyclesFrom,
  dueDateForStatement,
  initialPaidThrough,
  latestStatementOnOrBefore,
  monthlyRepaymentCycle,
  nextUnpaidCycle,
  statementForPurchase,
  type BillingCycle,
} from '../billingCycle';

// 招商银行-style card: statement on the 5th, due on the 23rd of the same month.
const cmb: BillingCycle = { statementDay: 5, dueRule: { type: 'fixed_day', day: 23 } };
// Card whose due day comes before its statement day: due next month.
const lateStatement: BillingCycle = { statementDay: 20, dueRule: { type: 'fixed_day', day: 8 } };
// 花呗: bill covers the calendar month, due on the 10th.
const huabei: BillingCycle = { statementDay: 31, dueRule: { type: 'fixed_day', day: 10 } };
// 交通银行-style: due 25 days after the statement.
const bocom: BillingCycle = {
  statementDay: 15,
  dueRule: { type: 'days_after_statement', days: 25 },
};

describe('statementForPurchase', () => {
  it('keeps purchases on the statement day in that statement', () => {
    expect(statementForPurchase('2026-10-05', 5)).toBe('2026-10-05');
  });

  it('rolls purchases after the statement day into the next cycle', () => {
    expect(statementForPurchase('2026-10-06', 5)).toBe('2026-11-05');
    expect(statementForPurchase('2026-12-20', 10)).toBe('2027-01-10');
  });

  it('clamps a statement day of 31 to short months', () => {
    expect(statementForPurchase('2026-02-10', 31)).toBe('2026-02-28');
    expect(statementForPurchase('2028-02-29', 31)).toBe('2028-02-29');
    expect(statementForPurchase('2026-04-30', 31)).toBe('2026-04-30');
    expect(statementForPurchase('2026-03-31', 30)).toBe('2026-04-30');
  });
});

describe('latestStatementOnOrBefore', () => {
  it('finds the current or previous closing date', () => {
    expect(latestStatementOnOrBefore('2026-10-21', 5)).toBe('2026-10-05');
    expect(latestStatementOnOrBefore('2026-10-04', 5)).toBe('2026-09-05');
    expect(latestStatementOnOrBefore('2026-03-01', 31)).toBe('2026-02-28');
    expect(latestStatementOnOrBefore('2026-01-03', 5)).toBe('2025-12-05');
  });
});

describe('dueDateForStatement', () => {
  it('uses the same month when the due day is after the statement day', () => {
    expect(dueDateForStatement('2026-10-05', cmb.dueRule)).toBe('2026-10-23');
  });

  it('moves to the next month when the due day is before the statement day', () => {
    expect(dueDateForStatement('2026-10-20', lateStatement.dueRule)).toBe('2026-11-08');
  });

  it('treats statement day = due day as due one month later', () => {
    expect(dueDateForStatement('2026-10-15', { type: 'fixed_day', day: 15 })).toBe('2026-11-15');
  });

  it('clamps due day 31 in February, including leap years', () => {
    expect(dueDateForStatement('2026-01-31', { type: 'fixed_day', day: 31 })).toBe('2026-02-28');
    expect(dueDateForStatement('2028-01-31', { type: 'fixed_day', day: 31 })).toBe('2028-02-29');
    expect(dueDateForStatement('2026-02-10', { type: 'fixed_day', day: 31 })).toBe('2026-02-28');
  });

  it('counts days after the statement across month and year ends', () => {
    expect(dueDateForStatement('2026-10-15', bocom.dueRule)).toBe('2026-11-09');
    expect(dueDateForStatement('2026-12-15', bocom.dueRule)).toBe('2027-01-09');
    expect(dueDateForStatement('2026-02-15', bocom.dueRule)).toBe('2026-03-12');
  });
});

describe('cycleForPurchase', () => {
  it('models 花呗: a month of purchases is due on the 10th of the next month', () => {
    expect(cycleForPurchase('2026-10-01', huabei)).toEqual({
      statementDate: '2026-10-31',
      dueDate: '2026-11-10',
    });
    expect(cycleForPurchase('2026-10-31', huabei).dueDate).toBe('2026-11-10');
    expect(cycleForPurchase('2026-11-01', huabei).dueDate).toBe('2026-12-10');
  });

  it('crosses the year end', () => {
    expect(cycleForPurchase('2026-12-06', cmb)).toEqual({
      statementDate: '2027-01-05',
      dueDate: '2027-01-23',
    });
  });
});

describe('nextUnpaidCycle', () => {
  const today = '2026-10-21';

  it('returns the open bill when the previous one is settled', () => {
    expect(nextUnpaidCycle(today, cmb, '2026-09-23')).toEqual({
      statementDate: '2026-10-05',
      dueDate: '2026-10-23',
    });
  });

  it('moves to the next statement once the current bill is paid', () => {
    expect(nextUnpaidCycle(today, cmb, '2026-10-23')).toEqual({
      statementDate: '2026-11-05',
      dueDate: '2026-11-23',
    });
  });

  it('surfaces an overdue bill that was never marked paid', () => {
    // Due date 2026-10-23 has passed on 2026-10-25 without payment.
    expect(nextUnpaidCycle('2026-10-25', cmb, '2026-09-23').dueDate).toBe('2026-10-23');
  });

  it('reaches back to the oldest unpaid bill, but no further than a year', () => {
    expect(nextUnpaidCycle(today, cmb, '2026-07-23').dueDate).toBe('2026-08-23');
    expect(nextUnpaidCycle(today, cmb, '2020-01-23').dueDate).toBe('2025-10-23');
  });

  it('with no history treats everything before today as settled', () => {
    expect(nextUnpaidCycle(today, cmb, null).dueDate).toBe('2026-10-23');
    expect(nextUnpaidCycle('2026-10-24', cmb, null).dueDate).toBe('2026-11-23');
  });

  it('handles a due date that falls before the next statement closes', () => {
    // Statement 20th, due 8th of next month: on 10-21 the Oct 20 bill is due Nov 8.
    expect(nextUnpaidCycle(today, lateStatement, '2026-10-08')).toEqual({
      statementDate: '2026-10-20',
      dueDate: '2026-11-08',
    });
  });

  it('works for monthly loan repayment days', () => {
    const loan = monthlyRepaymentCycle(31);
    expect(nextUnpaidCycle('2026-02-10', loan, '2026-01-31').dueDate).toBe('2026-02-28');
  });
});

describe('cyclesFrom', () => {
  it('lists consecutive cycles, keeping month-end statements at month end', () => {
    expect(cyclesFrom('2026-01-31', huabei, 3)).toEqual([
      { statementDate: '2026-01-31', dueDate: '2026-02-10' },
      { statementDate: '2026-02-28', dueDate: '2026-03-10' },
      { statementDate: '2026-03-31', dueDate: '2026-04-10' },
    ]);
  });
});

describe('initialPaidThrough', () => {
  it('leaves the open bill unpaid when the user has an amount due', () => {
    const paidThrough = initialPaidThrough('2026-10-21', cmb, true);
    expect(paidThrough).toBe('2026-09-23');
    expect(nextUnpaidCycle('2026-10-21', cmb, paidThrough).dueDate).toBe('2026-10-23');
  });

  it('skips to the next bill when nothing is due now', () => {
    const paidThrough = initialPaidThrough('2026-10-21', cmb, false);
    expect(paidThrough).toBe('2026-10-23');
    expect(nextUnpaidCycle('2026-10-21', cmb, paidThrough).dueDate).toBe('2026-11-23');
  });

  it('skips to the next bill when the window already closed', () => {
    expect(initialPaidThrough('2026-10-25', cmb, true)).toBe('2026-10-23');
  });
});

describe('billingCycleOf', () => {
  it('builds a cycle only from complete settings', () => {
    expect(
      billingCycleOf({
        statementDay: 5,
        dueRule: 'fixed_day',
        dueDay: 23,
        dueDaysAfterStatement: null,
      })
    ).toEqual(cmb);
    expect(
      billingCycleOf({
        statementDay: 15,
        dueRule: 'days_after_statement',
        dueDay: null,
        dueDaysAfterStatement: 25,
      })
    ).toEqual(bocom);
    expect(
      billingCycleOf({
        statementDay: 5,
        dueRule: 'fixed_day',
        dueDay: null,
        dueDaysAfterStatement: 20,
      })
    ).toBeNull();
    expect(
      billingCycleOf({
        statementDay: null,
        dueRule: 'fixed_day',
        dueDay: 23,
        dueDaysAfterStatement: null,
      })
    ).toBeNull();
  });
});
