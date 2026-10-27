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

test('isOnlyForegroundWindow accepts being alone in front', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isOnlyForegroundWindow(payload, 'com.cleantv.launcher'), true);
});

// Breaks a check that trusts top-level appId alone: the input stand-in
// reports our app id while windowGroup:true marks it as the fake black screen.
test('isInputStandIn detects the windowGroup:true placeholder', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: true }],
  };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), true);
});

test('isInputStandIn is false for the real web app window', () => {
  const payload = {
    foregroundAppInfo: [{ appId: 'com.cleantv.launcher', windowGroup: false }],
  };
  assert.equal(fg.isInputStandIn(payload, 'com.cleantv.launcher'), false);
});

// Breaks a check with no sink filter: an HDMI sink entry present alongside a
// tuner one should not be mistaken for the tuner being on MAIN.
test('isTunerOnMainSink ignores a non-MAIN sink', () => {
  const payload = { video: [{ sink: 'SUB', connected: true, connectedSource: 'VDEC' }] };
  assert.equal(fg.isTunerOnMainSink(payload), false);
});

test('isTunerOnMainSink is true for a connected tuner on MAIN', () => {
  const payload = { video: [{ sink: 'MAIN', connected: true, connectedSource: 'VDEC' }] };
  assert.equal(fg.isTunerOnMainSink(payload), true);
});

// Breaks a check that only looks at returnValue: a launch with no
// returnValue field at all (malformed reply) should count as failed, not pass.
test('launchError treats a missing returnValue as failure', () => {
  assert.notEqual(fg.launchError({}), null);
});

test('launchError is null for an accepted launch', () => {
  assert.equal(fg.launchError({ returnValue: true }), null);
});
