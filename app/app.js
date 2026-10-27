// Wires the tested lib functions (lib/clock.js, lib/wallpaper.js, lib/dock.js)
// into the actual page. Plain DOM, no framework: webOS 4's WebKit 537.36 does
// not need one and a build step adds nothing here.

// Placeholder dock until real icons are read from each app's own appinfo.json
// on the TV (see README: icons come from the device, never bundled).
var DOCK_ENTRIES = window.CleanTV.buildDockConfig([
  { id: 'youtube.leanback.v4', label: 'YouTube', icon: 'Y' },
  { id: 'org.webosbrew.hbchannel', label: 'Homebrew', icon: 'H' },
  { id: 'com.webos.app.livetv', label: 'Live TV', icon: 'L' },
  { id: 'com.webos.app.browser', label: 'Browser', icon: 'B' },
  { id: 'com.palm.app.settings', label: 'Settings', icon: 'S' },
]);

function renderClock() {
  var el = document.getElementById('clock');
  el.textContent = window.CleanTV.formatClock(new Date());
}

function renderDock(focusedIndex) {
  var dock = document.getElementById('dock');
  dock.innerHTML = '';

  DOCK_ENTRIES.forEach(function (entry, index) {
    var item = document.createElement('div');
    item.className = 'dock-item' + (index === focusedIndex ? ' focused' : '');

    var glyph = document.createElement('div');
    glyph.className = 'glyph';
    glyph.textContent = entry.icon;

    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = entry.label;

    item.appendChild(glyph);
    item.appendChild(label);
    dock.appendChild(item);
  });
}

renderClock();
setInterval(renderClock, 15000);
renderDock(0);
