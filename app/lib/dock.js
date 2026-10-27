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

// Moves the focused dock index by one in `direction` (-1 or 1), wrapping
// around: past the last tile goes to the first, past the first goes to the
// last, a real carousel rather than stopping at the ends.
function nextFocusedIndex(currentIndex, direction, length) {
  if (length <= 0) return 0;
  return ((currentIndex + direction) % length + length) % length;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDockConfig, buildLaunchPayload, nextFocusedIndex };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.buildDockConfig = buildDockConfig;
  window.CleanTV.buildLaunchPayload = buildLaunchPayload;
  window.CleanTV.nextFocusedIndex = nextFocusedIndex;
}
