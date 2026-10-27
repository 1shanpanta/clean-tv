// 12-hour clock, no leading zero, matching the reference screenshot ("2:53").
function formatClock(date) {
  let hours = date.getHours() % 12;
  if (hours === 0) hours = 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return hours + ':' + minutes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatClock };
} else {
  window.CleanTV = window.CleanTV || {};
  window.CleanTV.formatClock = formatClock;
}
