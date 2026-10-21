import { dueLevel } from '../dueStatus';

describe('dueLevel', () => {
  it.each([
    [-5, 'overdue'],
    [-1, 'overdue'],
    [0, 'urgent'],
    [3, 'urgent'],
    [4, 'soon'],
    [7, 'soon'],
    [8, 'safe'],
    [40, 'safe'],
  ] as const)('%i days left is %s', (days, level) => {
    expect(dueLevel(days)).toBe(level);
  });
});
