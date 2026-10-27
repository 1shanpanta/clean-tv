// Pure helpers for reading getForegroundAppInfo / getStatus Luna payloads.
// ES5 only: this runs on the TV's Node v0.12.2 (confirmed live), no let/const,
// no arrow functions, no destructuring.
//
// Design adapted from hbertsch/lgtv-webos-root-launcher (MIT); written
// fresh, against webOS 6's Home originally. Our TV's Home is a native
// compiled binary, not web/Flutter; these window-shape checks are
// unverified against that difference until tested live.

// getForegroundAppInfo with extraInfo:true lists every window (overlays like
// Settings too). Only a lone window for our app id counts as "the only
// foreground window" here, real app or the HOME-key stand-in alike: this is
// a pure window count, it does not classify what's behind the window. See
// isReallyInFront below for the check that also excludes the stand-in.
function isOnlyForegroundWindow(foregroundPayload, appId) {
  if (foregroundPayload && foregroundPayload.returnValue === false) {
    return false;
  }
  var raw = foregroundPayload && foregroundPayload.foregroundAppInfo;
  var windows = Array.isArray(raw) ? raw : [];
  return windows.length === 1 &&
    Boolean(windows[0]) &&
    windows[0].appId === appId;
}

// A HOME-key input stand-in reports our app id as foreground, but as a
// windowGroup:true placeholder with no real web app behind it (black screen).
function isInputStandIn(foregroundPayload, appId) {
  var raw = foregroundPayload && foregroundPayload.foregroundAppInfo;
  var windows = Array.isArray(raw) ? raw : [];
  return windows.some(function (w) {
    return Boolean(w) && w.appId === appId && w.windowGroup === true;
  });
}

// The only check safe to arm the takeover on: isOnlyForegroundWindow alone
// counts windows but doesn't classify them, so it reports true for the
// HOME-key stand-in just as much as for our real app. This function adds
// the isInputStandIn exclusion on top, so it actually tells them apart.
function isReallyInFront(foregroundPayload, appId) {
  return isOnlyForegroundWindow(foregroundPayload, appId) &&
    !isInputStandIn(foregroundPayload, appId);
}

// videooutput/getStatus: the MAIN sink entry, or undefined if none.
function mainSink(videoPayload) {
  var raw = videoPayload && videoPayload.video;
  var sinks = Array.isArray(raw) ? raw : [];
  return sinks.filter(function (s) {
    return Boolean(s) && s.sink === 'MAIN';
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
  isOnlyForegroundWindow: isOnlyForegroundWindow,
  isInputStandIn: isInputStandIn,
  isReallyInFront: isReallyInFront,
  mainSink: mainSink,
  isTunerOnMainSink: isTunerOnMainSink,
  launchError: launchError,
};
