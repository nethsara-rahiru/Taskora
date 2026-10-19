const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../../public/js/schedule-rules');

test('legacy schedules repeat without restrictions', () => {
  assert.equal(rules.isActiveOn({}, '2026-11-05'), true);
});

test('start and end dates are inclusive, including across years', () => {
  const schedule = { startsOn: '2026-12-31', endsOn: '2027-01-02' };
  assert.equal(rules.isActiveOn(schedule, '2026-12-30'), false);
  assert.equal(rules.isActiveOn(schedule, '2026-12-31'), true);
  assert.equal(rules.isActiveOn(schedule, '2027-01-02'), true);
  assert.equal(rules.isActiveOn(schedule, '2027-01-03'), false);
});

test('single days and whole weeks are skipped inclusively and then resume', () => {
  const schedule = { skipRanges: [
    { start: '2026-11-05', end: '2026-11-05' },
    { start: '2026-11-09', end: '2026-11-15' }
  ] };
  assert.equal(rules.isActiveOn(schedule, '2026-11-04'), true);
  assert.equal(rules.isActiveOn(schedule, '2026-11-05'), false);
  assert.equal(rules.isActiveOn(schedule, '2026-11-06'), true);
  for (let day = 9; day <= 15; day++) {
    assert.equal(rules.isActiveOn(schedule, `2026-11-${String(day).padStart(2, '0')}`), false);
  }
  assert.equal(rules.isActiveOn(schedule, '2026-11-16'), true);
  assert.equal(rules.isActiveOn({ ...schedule, skipRanges: [] }, '2026-11-05'), true);
});

test('pause hides all occurrences and resume restores them', () => {
  assert.equal(rules.isActiveOn({ isPaused: true }, '2026-11-05'), false);
  assert.equal(rules.isActiveOn({ isPaused: false }, '2026-11-05'), true);
});

test('invalid dates, reversed ranges, priority, and pause types are rejected', () => {
  for (const settings of [
    { startsOn: '2026-02-30' }, { endsOn: '05/11/2026' },
    { startsOn: '2026-11-06', endsOn: '2026-11-05' },
    { skipRanges: [{ start: '2026-11-06', end: '2026-11-05' }] },
    { skipRanges: [{ start: null, end: '2026-11-05' }] },
    { skipRanges: 'all' }, { priority: 'invalid' }, { isPaused: 'false' }
  ]) assert.throws(() => rules.normalizeSettings(settings));
  assert.equal(rules.validDate('2028-02-29'), true);
  assert.equal(rules.validDate('2026-02-29'), false);
});

test('settings can be cleared and priority ordering includes legacy defaults', () => {
  assert.deepEqual(rules.normalizeSettings({ startsOn: '', endsOn: null, skipRanges: [] }),
    { startsOn: null, endsOn: null, skipRanges: [] });
  assert.deepEqual([{ priority: 'low' }, {}, { priority: 'urgent' }, { priority: 'high' }]
    .sort(rules.comparePriority).map(s => s.priority || 'medium'), ['urgent', 'high', 'medium', 'low']);
});
