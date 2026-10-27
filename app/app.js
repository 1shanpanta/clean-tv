// Wires the tested lib functions (lib/clock.js, lib/dock.js) into the actual
// page. Plain DOM, no framework: this TV's Chromium ~53-era engine (dated
// via the ignition flag, see lib/clock.js, not the constant WebKit-Version
// string) does not need one and a build step adds nothing here.

// Flat white glyphs via a CSS mask (see style.css .glyph img), not this TV's
// own colored app icons: those came back inconsistent (different brand
// colors each, and YouTube's only asset on this TV is a wordmark banner,
// never a square mark). youtube.svg/primevideo.svg are CleanFrame's own
// (github.com/nthnclrk/CleanFrame, MIT); globe/tv/beer are Lucide
// (lucide.dev, ISC, pinned v0.460.0).
var DOCK_ENTRIES = window.CleanTV.buildDockConfig([
  { id: 'youtube.leanback.v4', label: 'YouTube', icon: 'assets/icons-svg/youtube.svg' },
  { id: 'amazon', label: 'Prime Video', icon: 'assets/icons-svg/primevideo.svg' },
  { id: 'com.webos.app.browser', label: 'Web Browser', icon: 'assets/icons-svg/globe.svg' },
  { id: 'org.webosbrew.hbchannel', label: 'Homebrew', icon: 'assets/icons-svg/beer.svg' },
  { id: 'com.webos.app.livetv', label: 'Live TV', icon: 'assets/icons-svg/tv.svg' },
]);

// Three app ids, all confirmed live on this TV via getAppInfo before wiring
// (com.webos.app.settings does not exist here; com.palm.app.settings does).
var TOP_ICONS = window.CleanTV.buildDockConfig([
  { id: 'com.webos.app.photovideo', label: 'Photo & Video', icon: 'assets/icons-svg/image.svg' },
  { id: 'com.webos.app.discovery', label: 'LG Content Store', icon: 'assets/icons-svg/grid.svg' },
  { id: 'com.palm.app.settings', label: 'Settings', icon: 'assets/icons-svg/settings.svg' },
]);

function renderClock() {
  var el = document.getElementById('clock');
  el.textContent = window.CleanTV.formatClock(new Date());
}

// Built once, on load. A CSS transition only animates a property change on
// the SAME element across two paints; rebuilding a container's innerHTML on
// every focus move (the old approach) replaces each tile with a brand new
// node every time, so there was nothing for a transition to animate between.
// Shared by both the dock and the top-icons row, same tile shape either way.
function buildRow(containerId, entries, itemClassName) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  var items = [];

  entries.forEach(function (entry) {
    var item = document.createElement('div');
    item.className = itemClassName;

    // A flat white glyph via a CSS mask, not an <img>: the mask only reads
    // the source SVG's shape (alpha), never its own fill/stroke color, so
    // CleanFrame's solid-fill marks and Lucide's stroke-only outlines both
    // come out the same uniform white regardless of how each was drawn.
    var glyph = document.createElement('div');
    glyph.className = 'glyph';
    var mark = document.createElement('div');
    mark.className = 'mark';
    mark.style.webkitMaskImage = 'url(' + entry.icon + ')';
    mark.style.maskImage = 'url(' + entry.icon + ')';
    glyph.appendChild(mark);

    item.appendChild(glyph);

    if (itemClassName === 'dock-item') {
      var label = document.createElement('div');
      label.className = 'label';
      label.textContent = entry.label;
      item.appendChild(label);
    }

    container.appendChild(item);
    items.push(item);
  });

  return items;
}

var dockItems = [];
var topItems = [];

function buildDock() {
  dockItems = buildRow('dock', DOCK_ENTRIES, 'dock-item');
}

function buildTopIcons() {
  topItems = buildRow('top-icons', TOP_ICONS, 'top-icon');
}

// Two focus zones, not one: the dock (left/right) and the top-icons row
// (left/right too), switched between with up/down. Only the active zone
// ever shows a focus highlight; leaving a zone clears it there.
var focusZone = 'dock';
var focusedIndex = 0;
var topFocusedIndex = 0;

function updateFocus() {
  dockItems.forEach(function (item, index) {
    item.classList.toggle('focused', focusZone === 'dock' && index === focusedIndex);
  });
  topItems.forEach(function (item, index) {
    item.classList.toggle('focused', focusZone === 'top' && index === topFocusedIndex);
  });
}

function moveFocus(direction) {
  if (focusZone === 'dock') {
    focusedIndex = window.CleanTV.nextFocusedIndex(focusedIndex, direction, DOCK_ENTRIES.length);
  } else {
    topFocusedIndex = window.CleanTV.nextFocusedIndex(topFocusedIndex, direction, TOP_ICONS.length);
  }
  updateFocus();
}

function switchZone(zone) {
  focusZone = zone;
  updateFocus();
}

function currentEntry() {
  return focusZone === 'dock' ? DOCK_ENTRIES[focusedIndex] : TOP_ICONS[topFocusedIndex];
}

// Launches a dock entry over Luna. PalmServiceBridge is webOS's legacy
// direct-call bridge, only present on-device; a desktop browser preview has
// no such global, so this logs the payload instead of throwing, which keeps
// the preview usable for visual iteration.
// Holds every PalmServiceBridge instance that still has a reply pending.
// bridge is a local var in launchEntry otherwise, and if webOS garbage
// collects it before the Luna reply arrives, onservicecallback (which is
// what logs a failed launch) may never fire. Kept here and spliced out once
// the callback runs, so it survives until then.
var pendingBridges = [];

function launchEntry(entry) {
  var payload = window.CleanTV.buildLaunchPayload(entry);
  if (!window.PalmServiceBridge) {
    console.log('would launch', payload);
    return;
  }
  var bridge = new window.PalmServiceBridge();
  pendingBridges.push(bridge);
  bridge.onservicecallback = function (message) {
    // A failed launch is logged here so it's at least visible in devtools.
    // Not surfaced to the user on screen, and service.js doesn't exist yet
    // (and even once it does, it only tracks whether the launcher itself
    // is in front, never whether a dock-launched app like this succeeded).
    var idx = pendingBridges.indexOf(bridge);
    if (idx !== -1) {
      pendingBridges.splice(idx, 1);
    }
    var reply;
    try {
      reply = JSON.parse(message);
    } catch (e) {
      reply = null;
    }
    if (!reply || reply.returnValue !== true) {
      console.error('launch failed', reply, entry);
    }
  };
  bridge.call('luna://com.webos.applicationManager/launch', JSON.stringify({
    id: payload.id,
    params: payload.params,
  }));
}

// This TV's input stack is unverified to populate e.key correctly; LG webOS
// sample code and docs conventionally use e.keyCode instead (37/39/13 for
// left/right/enter). Matching either means it works whichever one this TV
// actually sends.
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowLeft' || e.keyCode === 37) {
    moveFocus(-1);
  } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
    moveFocus(1);
  } else if (e.key === 'ArrowUp' || e.keyCode === 38) {
    switchZone('top');
  } else if (e.key === 'ArrowDown' || e.keyCode === 40) {
    switchZone('dock');
  } else if (e.key === 'Enter' || e.keyCode === 13) {
    // The remote's OK key is assumed to report the same keycode as Enter,
    // not yet confirmed live on this TV.
    launchEntry(currentEntry());
  }
});

// Self-correcting instead of a fixed setInterval: each tick re-schedules
// itself against the next real minute boundary, so the displayed minute
// never lags behind (a fixed interval drifts and can sit up to its own
// period behind a real minute change).
function scheduleClockTick() {
  setTimeout(function () {
    renderClock();
    scheduleClockTick();
  }, 60000 - (Date.now() % 60000));
}

renderClock();
scheduleClockTick();
buildDock();
buildTopIcons();
updateFocus();
