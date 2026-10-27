const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildLauncherContent, createLastInput } = require('../service/lib/last-input.js');

function tmpPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-tv-lastinput-'));
  return {
    dir,
    path: path.join(dir, 'lastinput'),
    backupPath: path.join(dir, 'lastinput.orig'),
  };
}

test('buildLauncherContent points at our app and an unused input', () => {
  const content = JSON.parse(buildLauncherContent('com.cleantv.launcher', 'HDMI_1'));
  assert.equal(content.appId, 'com.cleantv.launcher');
  assert.equal(content.type, 'HDMI_1');
});

// Breaks a version with no backup check: calling pointAtLauncher twice would
// overwrite the real original with our own already-rewritten content, making
// restoreOriginal recover the wrong thing.
test('a second pointAtLauncher call does not clobber the backup', () => {
  const p = tmpPaths();
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher' });

  li.pointAtLauncher();
  li.pointAtLauncher();

  const backup = JSON.parse(fs.readFileSync(p.backupPath, 'utf8'));
  assert.equal(backup.appId, 'com.webos.app.hdmi2');
});

test('restoreOriginal puts the real original content back', () => {
  const p = tmpPaths();
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher' });

  li.pointAtLauncher();
  li.restoreOriginal();

  const restored = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(restored.appId, 'com.webos.app.hdmi2');
});

// Breaks a version that assumes a backup always exists: restoring before any
// pointAtLauncher call (nothing to restore) must not throw or write garbage.
test('restoreOriginal with no backup yet is a safe no-op', () => {
  const p = tmpPaths();
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher' });

  assert.equal(li.restoreOriginal(), false);
  const unchanged = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(unchanged.appId, 'com.webos.app.hdmi2');
});

// Breaks a non-atomic write (write directly to `path`): a reader could catch
// a half-written file mid-write. The real file must never be the direct
// write target.
test('pointAtLauncher never writes the real file directly', () => {
  const p = tmpPaths();
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher' });

  li.pointAtLauncher();

  assert.equal(fs.existsSync(p.path + '.launcher.tmp'), false);
});
