// Validates dock entries from config and builds the Luna launch payload for one.
function buildDockConfig(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    throw new Error('buildDockConfig: expected an array');
  }

  const seenIds = new Set();
  return rawEntries.map((entry, index) => {
    if (!entry || typeof entry.id !== 'string' || entry.id === '') {
      throw new Error(`buildDockConfig: entry ${index} is missing an app id`);
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`buildDockConfig: duplicate app id "${entry.id}"`);
    }
    seenIds.add(entry.id);
    return {
      id: entry.id,
      label: typeof entry.label === 'string' && entry.label !== '' ? entry.label : entry.id,
      icon: typeof entry.icon === 'string' ? entry.icon : null,
    };
  });
}

// webOS launches an app by id through this Luna call; params carries anything
// the app itself expects (e.g. YouTube's contentTarget).
function buildLaunchPayload(entry, params) {
  if (!entry || typeof entry.id !== 'string' || entry.id === '') {
    throw new Error('buildLaunchPayload: entry is missing an app id');
  }
  return { id: entry.id, params: params || {} };
}

// Moves the focused dock index by one in `direction` (-1 or 1), clamped to
// the valid range: the focus stops at the first/last tile rather than
// wrapping around to the other end.
function nextFocusedIndex(currentIndex, direction, length) {
  if (length <= 0) return 0;
  var next = currentIndex + direction;
  if (next < 0) return 0;
  if (next > length - 1) return length - 1;
  return next;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDockConfig, buildLaunchPayload, nextFocusedIndex };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.buildDockConfig = buildDockConfig;
  window.CleanTV.buildLaunchPayload = buildLaunchPayload;
  window.CleanTV.nextFocusedIndex = nextFocusedIndex;
}
