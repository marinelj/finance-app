import { planReminders, remindersToSchedule } from '../reminders';

describe('planReminders', () => {
  const today = '2026-10-21';

  it('schedules each offset before each due date, earliest first', () => {
    const plan = planReminders(
      [
        { productId: 'b', dueDates: ['2026-10-30'] },
        { productId: 'a', dueDates: ['2026-10-25', '2026-11-25'] },
      ],
      today,
      [3, 1]
    );
    expect(plan.map((p) => `${p.productId} ${p.fireDate} -${p.daysBefore}`)).toEqual([
      'a 2026-10-22 -3',
      'a 2026-10-24 -1',
      'b 2026-10-27 -3',
      'b 2026-10-29 -1',
      'a 2026-11-22 -3',
      'a 2026-11-24 -1',
    ]);
  });

  it('skips reminders whose day has passed but keeps those for today', () => {
    const plan = planReminders([{ productId: 'a', dueDates: ['2026-10-22'] }], today, [3, 1, 0]);
    expect(plan.map((p) => p.fireDate)).toEqual(['2026-10-21', '2026-10-22']);
  });

  it('ignores duplicate and invalid offsets', () => {
    const plan = planReminders(
      [{ productId: 'a', dueDates: ['2026-11-01'] }],
      today,
      [1, 1, -2, 1.5]
    );
    expect(plan).toHaveLength(1);
  });

  it('caps the number of scheduled reminders', () => {
    const sources = Array.from({ length: 40 }, (_, i) => ({
      productId: `p${i}`,
      dueDates: ['2026-11-15', '2026-12-15'],
    }));
    expect(planReminders(sources, today, [3, 1])).toHaveLength(60);
  });
});

describe('remindersToSchedule', () => {
  const sources = [{ productId: 'a', dueDates: ['2026-10-24'] }];

  it('fires at the chosen local hour', () => {
    const plan = remindersToSchedule(sources, '2026-10-21', [3, 1], 9, new Date(2026, 9, 21, 8, 0));
    expect(plan.map((item) => item.fireDate)).toEqual(['2026-10-21', '2026-10-23']);
    expect(plan[0].fireAt).toEqual(new Date(2026, 9, 21, 9, 0));
  });

  it('drops a reminder whose time already passed today', () => {
    const plan = remindersToSchedule(
      sources,
      '2026-10-21',
      [3, 1],
      9,
      new Date(2026, 9, 21, 10, 0)
    );
    expect(plan.map((item) => item.fireDate)).toEqual(['2026-10-23']);
  });

  it('caps the result after dropping past reminders', () => {
    const many = [{ productId: 'a', dueDates: ['2026-10-22', '2026-10-25', '2026-10-30'] }];
    const plan = remindersToSchedule(many, '2026-10-21', [1], 9, new Date(2026, 9, 21, 10, 0), 2);
    expect(plan.map((item) => item.dueDate)).toEqual(['2026-10-25', '2026-10-30']);
  });
});
