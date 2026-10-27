// Picks the next wallpaper, avoiding an immediate repeat of the last one shown.
function pickWallpaper(ids, lastId) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('pickWallpaper: ids must be a non-empty array');
  }
  if (ids.length === 1) return ids[0];

  const candidates = ids.filter((id) => id !== lastId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pickWallpaper };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.pickWallpaper = pickWallpaper;
}
