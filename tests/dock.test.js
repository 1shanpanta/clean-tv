const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDockConfig, buildLaunchPayload } = require('../app/lib/dock.js');

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

// Breaks a version that forgets to pass params through, which would make it
// impossible to launch a specific video the way we did manually over SSAP.
test('launch payload carries the params given to it', () => {
  const entry = { id: 'youtube.leanback.v4' };
  const payload = buildLaunchPayload(entry, { contentTarget: 'x' });
  assert.equal(payload.params.contentTarget, 'x');
});
