const test = require('node:test');
const assert = require('node:assert/strict');
const { computeOffset, applyOffset } = require('../app/lib/time-offset.js');

// Breaks a version that subtracts the wrong way round: a server 16 minutes
// ahead of local must produce a POSITIVE offset, not negative.
test('computeOffset is positive when the server is ahead of local', () => {
  const localMs = 1000;
  const serverMs = 1000 + 16 * 60 * 1000;
  assert.equal(computeOffset(serverMs, localMs), 16 * 60 * 1000);
});

test('computeOffset is zero when server and local already agree', () => {
  assert.equal(computeOffset(5000, 5000), 0);
});

// Breaks a version that ignores the offset entirely: applying a 16-minute
// correction must actually move the returned Date forward by that much.
test('applyOffset shifts the date forward by a positive offset', () => {
  const base = new Date(2026, 0, 1, 0, 0, 0);
  const corrected = applyOffset(base, 16 * 60 * 1000);
  assert.equal(corrected.getMinutes(), 16);
});

test('applyOffset is a no-op for a zero offset', () => {
  const base = new Date(2026, 0, 1, 0, 0, 0);
  assert.equal(applyOffset(base, 0).getTime(), base.getTime());
});
