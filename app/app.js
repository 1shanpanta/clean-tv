// Wires the tested lib functions (lib/clock.js, lib/dock.js) into the actual
// page. Plain DOM, no framework: this TV's Chromium ~53-era engine (dated
// via the ignition flag, see lib/clock.js, not the constant WebKit-Version
// string) does not need one and a build step adds nothing here.

// Placeholder dock until real icons are read from each app's own appinfo.json
// on the TV (see README: icons come from the device, never bundled).
var DOCK_ENTRIES = window.CleanTV.buildDockConfig([
  { id: 'youtube.leanback.v4', label: 'YouTube', icon: 'Y' },
  { id: 'amazon', label: 'Prime Video', icon: 'P' },
  { id: 'com.webos.app.browser', label: 'Web Browser', icon: 'B' },
  { id: 'org.webosbrew.hbchannel', label: 'Homebrew Channel', icon: 'H' },
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

var focusedIndex = 0;

function moveFocus(direction) {
  focusedIndex = window.CleanTV.nextFocusedIndex(focusedIndex, direction, DOCK_ENTRIES.length);
  renderDock(focusedIndex);
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
renderDock(focusedIndex);
