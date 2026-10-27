// Pure helpers for reading getForegroundAppInfo / getStatus Luna payloads.
// ES5 only: this runs on the TV's Node v0.12.2 (confirmed live), no let/const,
// no arrow functions, no destructuring.
//
// Mechanism credit: adapted from hbertsch/lgtv-webos-root-launcher (MIT),
// which built this against webOS 6's Home. Our TV's Home is a native
// compiled binary, not web/Flutter; these window-shape checks are
// unverified against that difference until tested live.

// getForegroundAppInfo without extraInfo: just { appId, returnValue }.
function isLauncherInFront(foregroundPayload, appId) {
  return Boolean(foregroundPayload) &&
    foregroundPayload.returnValue !== false &&
    foregroundPayload.appId === appId;
}

// getForegroundAppInfo with extraInfo:true lists every window (overlays like
// Settings too). Only a lone window for our app id counts as "really" in front.
function isOnlyForegroundWindow(foregroundPayload, appId) {
  var windows = (foregroundPayload && foregroundPayload.foregroundAppInfo) || [];
  return windows.length === 1 &&
    windows[0].appId === appId &&
    windows[0].windowGroup !== true;
}

// A HOME-key input stand-in reports our app id as foreground, but as a
// windowGroup:true placeholder with no real web app behind it (black screen).
function isInputStandIn(foregroundPayload, appId) {
  var windows = (foregroundPayload && foregroundPayload.foregroundAppInfo) || [];
  return windows.some(function (w) {
    return w.appId === appId && w.windowGroup === true;
  });
}

// videooutput/getStatus: the MAIN sink entry, or undefined if none.
function mainSink(videoPayload) {
  var sinks = (videoPayload && videoPayload.video) || [];
  return sinks.filter(function (s) {
    return s.sink === 'MAIN';
  })[0];
}

// True if a live TV tuner is feeding the MAIN sink (would play muted audio
// behind another app if not released).
function isTunerOnMainSink(videoPayload) {
  var sink = mainSink(videoPayload);
  return Boolean(sink) && sink.connected === true && sink.connectedSource === 'VDEC';
}

// The reason a launch failed, or null if it was accepted.
function launchError(launchPayload) {
  if (launchPayload && launchPayload.returnValue === true) {
    return null;
  }
  return 'launch failed: ' + JSON.stringify(launchPayload);
}

module.exports = {
  isLauncherInFront: isLauncherInFront,
  isOnlyForegroundWindow: isOnlyForegroundWindow,
  isInputStandIn: isInputStandIn,
  mainSink: mainSink,
  isTunerOnMainSink: isTunerOnMainSink,
  launchError: launchError,
};
