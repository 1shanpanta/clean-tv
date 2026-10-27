const test = require('node:test');
const assert = require('node:assert/strict');
const fg = require('../service/lib/foreground.js');

// Breaks a check that only reads top-level appId: a Settings overlay sitting
// on top of our app would make a naive check report "in front" when it isn't
// alone.
test('isOnlyForegroundWindow rejects an overlay on top of us', () => {
  const payload = {
    foregroundAppInfo: [
      { appId: 'com.cleantv.launcher', windowGroup: false },
      { appId: 'com.webos.app.settings', windowGroup: false },
    ],
  };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check that always returns false: being alone in front, the
// normal case, must still pass.
test('isOnlyForegroundWindow accepts being alone in front', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), true);
});

// Breaks a check that only counts windows: a getForegroundAppInfo call that
// returned returnValue:false must not read as "alone in front" just because
// the window list happens to look right.
test('isOnlyForegroundWindow rejects an explicit returnValue:false', () => {
  const payload = {
    returnValue: false,
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check that reads w.appId without a null check: a null entry in
// the array (malformed Luna payload) would throw instead of just not
// matching.
test('isOnlyForegroundWindow does not crash on a null entry', () => {
  const payload = { foregroundAppInfo: [null] };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), false);
});

// Pins the new, narrower boundary: this function only counts windows, it
// doesn't classify them, so the windowGroup:true stand-in is as much "the
// only foreground window" as the real app. isReallyInFront is what excludes it.
test('isOnlyForegroundWindow also accepts the windowGroup:true stand-in', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: true }],
  };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), true);
});

// Breaks a check that only falls back to [] when foregroundAppInfo is
// missing: a truthy non-array (a malformed payload) would skip that
// fallback and crash on .length instead of just not matching.
test('isOnlyForegroundWindow does not crash when foregroundAppInfo is not an array', () => {
  const payload = { foregroundAppInfo: 'not-an-array' };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check that trusts top-level appId alone: the input stand-in
// reports our app id while windowGroup:true marks it as the fake black screen.
test('isInputStandIn detects the windowGroup:true placeholder', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: true }],
  };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), true);
});

// Breaks a check that flags every window for our app id: the real window
// (windowGroup:false) must not be mistaken for the stand-in.
test('isInputStandIn is false for the real web app window', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check that reads w.appId without a null check: a null entry in
// the array must not throw, and must not be mistaken for the stand-in.
test('isInputStandIn does not crash on a null entry', () => {
  const payload = { foregroundAppInfo: [null, { appId: 'com.cleantv.launcher', windowGroup: true }] };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), true);
});

// Breaks a check that only falls back to [] when foregroundAppInfo is
// missing: a truthy non-array (a malformed payload) would skip that
// fallback and crash on .some instead of just not matching.
test('isInputStandIn does not crash when foregroundAppInfo is not an array', () => {
  const payload = { foregroundAppInfo: 'not-an-array' };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check that only uses isOnlyForegroundWindow: the HOME-key input
// stand-in also reports a lone window with our app id, so arming on that
// check alone would treat the black-screen placeholder as our real app.
test('isReallyInFront rejects the stand-in even though it is the only window', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: true }],
  };
  assert.equal(fg.isReallyInFront(payload, 'com.cleantv.launcher'), false);
});

test('isReallyInFront accepts the real app alone in front', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isReallyInFront(payload, 'com.cleantv.launcher'), true);
});

// Breaks a version that only checks isInputStandIn (dropping the window
// count check): our window plus an overlay, neither one the stand-in, must
// still not read as really in front.
test('isReallyInFront rejects our window plus an overlay', () => {
  const payload = {
    foregroundAppInfo: [
      { appId: 'com.cleantv.launcher', windowGroup: false },
      { appId: 'com.webos.app.settings', windowGroup: false },
    ],
  };
  assert.equal(fg.isReallyInFront(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check with no null guard on s.sink: a null entry in the video
// array (malformed Luna payload) would throw instead of just not matching.
test('mainSink does not crash on a null entry in the video array', () => {
  const payload = { video: [null, { sink: 'MAIN', connected: true, connectedSource: 'VDEC' }] };
  assert.equal(fg.mainSink(payload).connectedSource, 'VDEC');
});

// Breaks a check that only falls back when video is missing (`video || []`):
// a truthy non-array video (malformed Luna payload) must not reach .filter,
// which only exists on an array.
test('mainSink does not crash on a non-array truthy video field', () => {
  const payload = { video: { sink: 'MAIN' } };
  assert.equal(fg.mainSink(payload), undefined);
});

// Breaks a check with no sink filter: a tuner connected on a non-MAIN sink,
// while something else sits on MAIN, must not be mistaken for the tuner
// being on MAIN.
test('isTunerOnMainSink ignores a non-MAIN sink', () => {
  const payload = {
    video: [
      { sink: 'SUB', connected: true, connectedSource: 'VDEC' },
      { sink: 'MAIN', connected: true, connectedSource: 'HDMI_1' },
    ],
  };
  assert.equal(fg.isTunerOnMainSink(payload), false);
});

// Breaks a check that ignores connectedSource: a MAIN sink must specifically
// be fed by VDEC (the tuner), not just "connected".
test('isTunerOnMainSink is true for a connected tuner on MAIN', () => {
  const payload = { video: [{ sink: 'MAIN', connected: true, connectedSource: 'VDEC' }] };
  assert.equal(fg.isTunerOnMainSink(payload), true);
});

// Breaks a check that ignores connected entirely: a MAIN sink reporting
// VDEC but not connected must not read as a live tuner feed.
test('isTunerOnMainSink is false when the MAIN sink is not connected', () => {
  const payload = { video: [{ sink: 'MAIN', connected: false, connectedSource: 'VDEC' }] };
  assert.equal(fg.isTunerOnMainSink(payload), false);
});

// Breaks a check that only looks at returnValue: a launch with no
// returnValue field at all (malformed reply) should count as failed, not pass.
test('launchError treats a missing returnValue as failure', () => {
  assert.notEqual(fg.launchError({}), null);
});

// Breaks a check that treats every payload as failed: returnValue:true must
// read as success, not a false positive failure.
test('launchError is null for an accepted launch', () => {
  assert.equal(fg.launchError({ returnValue: true }), null);
});
