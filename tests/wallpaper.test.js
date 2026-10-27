const test = require('node:test');
const assert = require('node:assert/strict');
const { pickWallpaper } = require('../app/lib/wallpaper.js');

// Breaks a naive `ids[Math.random() * ids.length | 0]` with no exclusion: would
// return 'a' again right after 'a' was last shown, given enough runs.
test('never repeats the last wallpaper when another exists', () => {
  for (let i = 0; i < 50; i++) {
    const picked = pickWallpaper(['a', 'b', 'c'], 'a');
    assert.notEqual(picked, 'a');
  }
});

// Breaks a version that assumes at least two wallpapers and throws or returns
// undefined on a single-item list.
test('falls back to the only wallpaper when there is just one', () => {
  assert.equal(pickWallpaper(['only'], 'only'), 'only');
});

test('rejects an empty list', () => {
  assert.throws(() => pickWallpaper([], null));
});
