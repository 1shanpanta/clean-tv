// This TV's own system clock drifts: autoClock is on, but LG TVs commonly
// sync from the broadcast signal (DVB/ATSC time), not internet NTP, and
// there's no antenna connected here, so it has nothing to sync against.
// Rather than trust `new Date()` directly, the app fetches an accurate
// timestamp once (app.js) and applies the resulting offset to every render.
function computeOffset(serverEpochMs, localEpochMs) {
  return serverEpochMs - localEpochMs;
}

function applyOffset(date, offsetMs) {
  return new Date(date.getTime() + offsetMs);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeOffset, applyOffset };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.computeOffset = computeOffset;
  window.CleanTV.applyOffset = applyOffset;
}
