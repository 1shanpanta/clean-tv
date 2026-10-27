const test = require('node:test');
const assert = require('node:assert/strict');
const { formatClock } = require('../app/lib/clock.js');

// Breaks a naive `date.getHours() % 12` with no zero-check: midnight would print "0:00".
test('midnight formats as 12, not 0', () => {
  const midnight = new Date(2026, 0, 1, 0, 5);
  assert.equal(formatClock(midnight), '12:05');
});

// Breaks a format with no zero-padding: minute 3 would print "2:3" instead of "2:03".
test('single-digit minute is zero-padded', () => {
  const d = new Date(2026, 0, 1, 2, 3);
  assert.equal(formatClock(d), '2:03');
});

// Breaks a version with no `% 12` modulo at all (just an `=== 0` check): the
// AM-only cases above can't tell that apart from a real modulo, an afternoon
// hour like 13 would print "13:07" instead of "1:07".
test('afternoon hour wraps to 12-hour format', () => {
  const d = new Date(2026, 0, 1, 13, 7);
  assert.equal(formatClock(d), '1:07');
});
