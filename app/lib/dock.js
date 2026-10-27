// Validates dock entries from config and builds the Luna launch payload for one.
function buildDockConfig(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    throw new Error('buildDockConfig: expected an array');
  }

  return rawEntries.map((entry, index) => {
    if (!entry || typeof entry.id !== 'string' || entry.id === '') {
      throw new Error(`buildDockConfig: entry ${index} is missing an app id`);
    }
    return {
      id: entry.id,
      label: typeof entry.label === 'string' ? entry.label : entry.id,
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDockConfig, buildLaunchPayload };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.buildDockConfig = buildDockConfig;
  window.CleanTV.buildLaunchPayload = buildLaunchPayload;
}
