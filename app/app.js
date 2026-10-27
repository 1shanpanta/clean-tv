// Wires the tested lib functions (lib/clock.js, lib/dock.js) into the actual
// page. Plain DOM, no framework: this TV's Chromium ~53-era engine (dated
// via the ignition flag, see lib/clock.js, not the constant WebKit-Version
// string) does not need one and a build step adds nothing here.

// Icons are our own local copies, not bundled from elsewhere: each one was
// pulled directly off this TV from the real app's own appinfo.json icon path
// (see README), so they are what LG's own Content Store already ships for
// these apps, not hand-drawn or guessed.
var DOCK_ENTRIES = window.CleanTV.buildDockConfig([
  { id: 'youtube.leanback.v4', label: 'YouTube', icon: 'assets/icons/youtube.png' },
  { id: 'amazon', label: 'Prime Video', icon: 'assets/icons/prime.png' },
  { id: 'com.webos.app.browser', label: 'Web Browser', icon: 'assets/icons/browser.png' },
  { id: 'org.webosbrew.hbchannel', label: 'Homebrew Channel', icon: 'assets/icons/hbchannel.png' },
  { id: 'com.webos.app.livetv', label: 'Live TV', icon: 'assets/icons/livetv.png' },
]);

function renderClock() {
  var el = document.getElementById('clock');
  el.textContent = window.CleanTV.formatClock(new Date());
}

// Built once, on load. A CSS transition only animates a property change on
// the SAME element across two paints; rebuilding the dock's innerHTML on
// every focus move (the old approach) replaces each tile with a brand new
// node every time, so there was nothing for a transition to animate between.
var dockItems = [];

function buildDock() {
  var dock = document.getElementById('dock');
  dock.innerHTML = '';
  dockItems = [];

  DOCK_ENTRIES.forEach(function (entry) {
    var item = document.createElement('div');
    item.className = 'dock-item';

    var glyph = document.createElement('div');
    glyph.className = 'glyph';
    var img = document.createElement('img');
    img.src = entry.icon;
    img.alt = entry.label;
    glyph.appendChild(img);

    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = entry.label;

    item.appendChild(glyph);
    item.appendChild(label);
    dock.appendChild(item);
    dockItems.push(item);
  });
}

function updateFocus(focusedIndex) {
  dockItems.forEach(function (item, index) {
    item.classList.toggle('focused', index === focusedIndex);
  });
}

var focusedIndex = 0;

function moveFocus(direction) {
  focusedIndex = window.CleanTV.nextFocusedIndex(focusedIndex, direction, DOCK_ENTRIES.length);
  updateFocus(focusedIndex);
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
  } else if (e.key === 'Enter' || e.keyCode === 13) {
    // The remote's OK key is assumed to report the same keycode as Enter,
    // not yet confirmed live on this TV.
    launchEntry(DOCK_ENTRIES[focusedIndex]);
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
updateFocus(focusedIndex);
