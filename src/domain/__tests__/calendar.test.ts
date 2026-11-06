import { agendaDate, calendarEvents, monthCells, type CalendarInput } from '../calendar';
import { defaultFormValues, toProductFields } from '../productForm';
const today = '2026-04-28';
const product = {
  id: 'card',
  ...toProductFields(
    {
      ...defaultFormValues({ name: 'Synthetic card', homeCurrency: 'CNY', today }),
      statementDay: 5,
      dueDay: 31,
      balance: '100',
      statementBalance: '80',
    },
    today
  ).fields,
};
const input = (extra: Partial<CalendarInput> = {}) => ({
  products: [product],
  installments: [],
  insurance: [],
  today,
  start: '2026-04-01',
  end: '2026-04-30',
  ...extra,
});
it('clamps day 31 to April 30 and marks imminent unpaid bills red', () => {
  expect(calendarEvents(input()).find((e) => e.kind === 'bill')).toMatchObject({
    date: '2026-04-30',
    marker: 'danger',
    paid: false,
    amount: 80,
  });
});
it('derives days-after-statement bills from the preceding month across year boundaries', () => {
  const events = calendarEvents(
    input({
      start: '2027-01-01',
      end: '2027-01-31',
      products: [
        { ...product, statementDay: 31, dueRule: 'days_after_statement', dueDaysAfterStatement: 9 },
      ],
    })
  );
  expect(events.find((e) => e.kind === 'bill')).toMatchObject({
    date: '2027-01-09',
    due: { statementDate: '2026-12-31' },
  });
});
it('distinguishes paid and unpaid bills and installments', () => {
  const events = calendarEvents(
    input({
      products: [{ ...product, paidThrough: '2026-04-30' }],
      installments: [
        {
          id: 'i',
          productId: 'card',
          seq: 1,
          dueDate: '2026-04-29',
          principal: 1,
          interest: 0,
          amount: 1,
          paidAt: null,
        },
      ],
    })
  );
  expect(events.find((e) => e.kind === 'bill')?.marker).toBe('paid');
  expect(events.find((e) => e.kind === 'installment')?.marker).toBe('danger');
  expect(
    calendarEvents(input({ today: '2026-04-01' })).find((e) => e.kind === 'bill')?.marker
  ).toBe('amber');
});
it('uses actual bill dates and skips the corresponding estimate', () => {
  const events = calendarEvents(
    input({
      bills: [
        {
          id: 'bill',
          productId: 'card',
          statementDate: '2026-04-05',
          dueDate: '2026-04-29',
          statementBalance: 90,
          currency: 'CNY',
          receivedAt: '2026-04-05T00:00:00Z',
        },
      ],
    })
  ).filter((e) => e.kind === 'bill');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ date: '2026-04-29', amount: 90 });
});
it('keeps dates inside the requested range and falls forward only for an empty today', () => {
  const events = calendarEvents(input());
  expect(events.every((e) => e.date >= '2026-04-01' && e.date <= '2026-04-30')).toBe(true);
  expect(agendaDate(events, today, today)).toBe('2026-04-30');
  expect(agendaDate(events, '2026-04-27', today)).toBe('2026-04-27');
});
it('aligns month grids to the chosen first weekday', () => {
  expect(monthCells(2026, 11, 1).indexOf('2026-11-01')).toBe(6);
  expect(monthCells(2026, 11, 0)[0]).toBe('2026-11-01');
  expect(monthCells(2026, 11, 1).length % 7).toBe(0);
});
it('derives premiums from their renewal anchor and skips items with unknown schedules', () => {
  const insurance = [
    {
      id: 'insurance',
      name: 'Synthetic policy',
      currency: 'CNY' as const,
      premium: 10,
      premiumPeriod: 'quarterly' as const,
      renewalDate: '2026-01-30',
    },
  ];
  expect(calendarEvents(input({ insurance })).find((e) => e.kind === 'insurance')).toMatchObject({
    date: '2026-04-30',
    marker: 'purple',
  });
  expect(
    calendarEvents(
      input({
        incomes: [
          {
            id: 'income',
            name: 'Synthetic income',
            currency: 'CNY',
            amount: 10,
            period: 'monthly',
          },
        ],
      })
    ).some((e) => e.kind === 'income')
  ).toBe(false);
});
