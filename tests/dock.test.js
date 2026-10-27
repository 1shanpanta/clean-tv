const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDockConfig, buildLaunchPayload, nextFocusedIndex } = require('../app/lib/dock.js');

// Breaks a version with no validation: an entry with no id would silently
// become a dock tile that launches nothing when pressed.
test('rejects an entry missing an id', () => {
  assert.throws(() => buildDockConfig([{ label: 'Nothing' }]));
});

// Breaks a version that requires a label: real config, like YouTube with no
// label set, should fall back to showing the id.
test('falls back to the id when label is missing', () => {
  const [entry] = buildDockConfig([{ id: 'youtube.leanback.v4' }]);
  assert.equal(entry.label, 'youtube.leanback.v4');
});

// Breaks a version that only checks `typeof label !== 'string'`: an empty
// string is a string, so it would be kept as-is instead of falling back.
test('falls back to the id when label is an empty string', () => {
  const [entry] = buildDockConfig([{ id: 'youtube.leanback.v4', label: '' }]);
  assert.equal(entry.label, 'youtube.leanback.v4');
});

// Breaks a version with no duplicate check: two entries sharing one id would
// both try to launch and focus the same dock tile.
test('rejects a duplicate id', () => {
  assert.throws(() => buildDockConfig([{ id: 'youtube.leanback.v4' }, { id: 'youtube.leanback.v4' }]));
});

// Breaks a version that forgets to pass params through, which would make it
// impossible to launch a specific video the way we did manually over SSAP.
test('launch payload carries the params given to it', () => {
  const entry = { id: 'youtube.leanback.v4' };
  const payload = buildLaunchPayload(entry, { contentTarget: 'x' });
  assert.equal(payload.params.contentTarget, 'x');
});

// Breaks a version that doesn't default params: a plain Enter-key launch
// with no params at all must still produce an object, not crash downstream
// code that reads payload.params.
test('buildLaunchPayload defaults params to an empty object when omitted', () => {
  const entry = { id: 'youtube.leanback.v4' };
  const payload = buildLaunchPayload(entry);
  assert.deepEqual(payload.params, {});
});

// Breaks a version with no validation: launching with no real app id would
// silently send a broken Luna call instead of failing loudly.
test('buildLaunchPayload throws when the entry has no id', () => {
  assert.throws(() => buildLaunchPayload({ id: '' }, {}));
  assert.throws(() => buildLaunchPayload({}, {}));
});

// Breaks a version with no wrap: moving left from the first tile must land
// on the last tile, not go negative or stay stuck at 0.
test('nextFocusedIndex wraps from the first tile to the last', () => {
  assert.equal(nextFocusedIndex(0, -1, 4), 3);
});

// Breaks a version with no wrap: moving right from the last tile must land
// back on the first tile, not run past the end of the dock.
test('nextFocusedIndex wraps from the last tile to the first', () => {
  assert.equal(nextFocusedIndex(3, 1, 4), 0);
});

test('nextFocusedIndex moves one step within range', () => {
  assert.equal(nextFocusedIndex(1, 1, 4), 2);
});
