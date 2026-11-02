import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hashPassword, Throttle, verifyPassword } from '../src/auth.js';
import { rowsForInsert, toCamel, toSnake } from '../src/sync.js';

describe('names', () => {
  it('converts between the app and database spellings', () => {
    assert.equal(toSnake('dueDaysAfterStatement'), 'due_days_after_statement');
    assert.equal(toCamel('due_days_after_statement'), 'dueDaysAfterStatement');
    assert.equal(toCamel(toSnake('unitsPerUsd')), 'unitsPerUsd');
  });
});

describe('rowsForInsert', () => {
  it('keeps known columns and sets user_id from the server', () => {
    const rows = rowsForInsert(
      'incomes',
      [{ id: 'a', name: 'Salary', userId: 'evil', extra: 1 }],
      ['id', 'user_id', 'name'],
      'me'
    );
    assert.deepEqual(rows, [{ id: 'a', name: 'Salary', user_id: 'me' }]);
  });
});

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    assert.equal(await verifyPassword('correct horse battery', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
    assert.equal(await verifyPassword('x', 'plain-text'), false);
  });
});

describe('Throttle', () => {
  it('blocks after the limit and resets after the window', () => {
    let now = 0;
    const throttle = new Throttle({ limit: 2, windowMs: 1000, now: () => now });
    throttle.fail('k');
    assert.equal(throttle.blocked('k'), false);
    throttle.fail('k');
    assert.equal(throttle.blocked('k'), true);
    now = 2000;
    assert.equal(throttle.blocked('k'), false);
  });
});
