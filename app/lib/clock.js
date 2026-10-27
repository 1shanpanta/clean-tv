// 12-hour clock, no leading zero, matching the reference screenshot ("2:53").
// Manual zero-pad: padStart arrived in Chrome 57, and the `--js-flags=
// --ignition` flag in the TV's WebAppMgr Upstart job file confirms Chromium
// 53 or newer (Ignition shipped from Chromium 53 onward): a lower bound.
// The flag being explicit rather than the default also suggests a version
// before Ignition became default around Chrome 59, a weaker signal, not a
// hard upper bound. WebKit-Version 537.36 only confirms this is a
// WebKit/Blink engine, that string stayed constant across years of
// Chromium releases.
function formatClock(date) {
  let hours = date.getHours() % 12;
  if (hours === 0) hours = 12;
  const minute = date.getMinutes();
  const minutes = minute < 10 ? '0' + minute : String(minute);
  return hours + ':' + minutes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatClock };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.formatClock = formatClock;
}
