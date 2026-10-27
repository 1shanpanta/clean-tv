const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildLauncherContent, createLastInput } = require('../service/lib/last-input.js');

function tmpPaths(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-tv-lastinput-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    path: path.join(dir, 'lastinput'),
    backupPath: path.join(dir, 'lastinput.orig'),
  };
}

test('buildLauncherContent points at our app and an unused input', () => {
  const content = JSON.parse(buildLauncherContent('com.cleantv.launcher', 'TEST_INPUT'));
  assert.equal(content.appId, 'com.cleantv.launcher');
  assert.equal(content.type, 'TEST_INPUT');
});

// Breaks a version with a default like 'HDMI_1': on this TV that is the
// actually-active input, so a silent default could point boot at a live
// source instead of an unused one. Omitting it must throw, not guess.
test('createLastInput throws when unusedInputId is not passed', (t) => {
  const p = tmpPaths(t);
  assert.throws(() => createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher' }));
});

// Breaks a version with no backup check: calling pointAtLauncher twice would
// overwrite the real original with our own already-rewritten content, making
// restoreOriginal recover the wrong thing.
test('a second pointAtLauncher call does not clobber the backup', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();
  li.pointAtLauncher();

  const backup = JSON.parse(fs.readFileSync(p.backupPath, 'utf8'));
  assert.equal(backup.appId, 'com.webos.app.hdmi2');
});

// Breaks a version that forgets to read from backupPath: restoreOriginal
// must put back the ORIGINAL content, not something else.
test('restoreOriginal puts the real original content back', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();
  li.restoreOriginal();

  const restored = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(restored.appId, 'com.webos.app.hdmi2');
});

// Breaks a version that returns a plain boolean: "nothing was ever touched"
// must read differently from "we touched it and lost the backup", since the
// two carry opposite risk.
test('restoreOriginal reports already-original when nothing was ever touched', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  assert.equal(li.restoreOriginal(), 'already-original');
  const unchanged = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(unchanged.appId, 'com.webos.app.hdmi2');
});

// Breaks a version that can't tell "safe, nothing to do" apart from "unsafe,
// original is lost, recovered with a safe fallback": the file already
// points at us but the backup vanished (reinstall, manual cleanup) must be
// reported as backup-lost-recovered, not false or a plain 'restored', and
// the live file must actually be deleted (the real original is gone, only
// a safe fallback was applied, the same way we assume bootd handles the
// first-boot case, not yet confirmed live).
test('restoreOriginal recovers by deleting the live file when the backup is lost', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();
  fs.unlinkSync(p.backupPath);

  assert.equal(li.restoreOriginal(), 'backup-lost-recovered');
  assert.equal(fs.existsSync(p.path), false);
});

// Breaks a version that treats "no backup" as always meaning "first run":
// if the backup is missing AND the file already holds our own content,
// backing up now would store our own content as if it were LG's original.
test('pointAtLauncher refuses to back up its own content when the backup is missing', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, JSON.stringify({ type: 'HDMI_9', appId: 'com.cleantv.launcher' }));
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  assert.throws(() => li.pointAtLauncher(), /cannot determine the real original/);
});

// Breaks a version that lets readFileSync throw uncaught on ENOENT: first
// boot / factory reset means `path` doesn't exist yet, and pointAtLauncher
// must still succeed, backing up a sentinel instead of crashing.
test('pointAtLauncher handles a missing source file on first boot', (t) => {
  const p = tmpPaths(t);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();

  const written = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(written.appId, 'com.cleantv.launcher');
});

// Breaks a version that backs up the sentinel as if it were real original
// content: restoreOriginal must remove the file again, not write the
// sentinel marker into it.
test('restoreOriginal removes the file when the backup is the absent-sentinel', (t) => {
  const p = tmpPaths(t);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();
  assert.equal(li.restoreOriginal(), 'restored');
  assert.equal(fs.existsSync(p.path), false);
});

// Guards the delete ORDER in the absent-marker path, not the fsync itself:
// a version that unlinks the backup before the live file could get power-cut
// in between and strand the TV with the backup gone but the live file still
// present, wiping the only record that this file was meant to be absent.
// This test does not check whether fsyncDir actually runs between the two
// deletes; it only proves that by the time the backup is unlinked, the live
// file is already gone.
test('restoreOriginal deletes the live file before the backup in the absent-marker case', (t) => {
  const p = tmpPaths(t);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  li.pointAtLauncher(); // first boot: the backup becomes the absent-marker

  const originalUnlink = fs.unlinkSync;
  let liveFileGoneWhenBackupUnlinkRan = null;
  fs.unlinkSync = (target) => {
    if (target === p.backupPath) {
      liveFileGoneWhenBackupUnlinkRan = !fs.existsSync(p.path);
    }
    originalUnlink(target);
  };
  try {
    assert.equal(li.restoreOriginal(), 'restored');
  } finally {
    fs.unlinkSync = originalUnlink;
  }

  assert.equal(liveFileGoneWhenBackupUnlinkRan, true);
});

// Breaks a version that parses the live file before checking the backup:
// LG's own writer isn't atomic, so a corrupt/truncated live file must not
// block a restore when a good backup already exists and is about to
// overwrite it anyway.
test('restoreOriginal restores from the backup even when the live file is corrupt', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.backupPath, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  fs.writeFileSync(p.path, '{"type":"TEST_INPUT","appId":"com.clean'); // truncated mid-write
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  assert.equal(li.restoreOriginal(), 'restored');
  const restored = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(restored.appId, 'com.webos.app.hdmi2');
});

// Breaks a version that crashes on JSON.parse in pointAtLauncher's ownership
// check: a corrupt/truncated live file (LG's writer isn't atomic) must not
// throw, and the garbage must be backed up verbatim, not discarded.
test('pointAtLauncher backs up a corrupt live file verbatim instead of crashing', (t) => {
  const p = tmpPaths(t);
  const garbage = '{"type":"HDMI_2","appId":"com.webos.app.hd'; // truncated mid-write
  fs.writeFileSync(p.path, garbage);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  li.pointAtLauncher();

  assert.equal(fs.readFileSync(p.backupPath, 'utf8'), garbage);
});

// Breaks a version that leaves the backup in place after a successful
// restore: a stale backup would make a SECOND point+restore cycle skip
// taking its own backup (existsSync(backupPath) still true from the first
// cycle), so the second restore would resurrect the FIRST cycle's original
// instead of the second cycle's.
test('restoreOriginal does not leave a stale backup for a later cycle to resurrect', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  li.pointAtLauncher();
  li.restoreOriginal();
  assert.equal(fs.existsSync(p.backupPath), false);

  fs.writeFileSync(p.path, '{"type":"HDMI_3","appId":"com.webos.app.hdmi3"}');
  li.pointAtLauncher();
  li.restoreOriginal();

  const restored = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(restored.appId, 'com.webos.app.hdmi3');
});

// Proves two things: the real file ends up holding exactly what
// pointAtLauncher wrote, and no temp file is left behind afterward. It does
// not by itself prove the write is atomic, a plain direct write would pass
// this too, the write-then-rename code path is what actually provides that.
test('pointAtLauncher writes the launcher content atomically into the real file', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();

  const written = JSON.parse(fs.readFileSync(p.path, 'utf8'));
  assert.equal(written.appId, 'com.cleantv.launcher');
  assert.equal(written.type, 'HDMI_9');

  const leftoverTmp = fs.readdirSync(p.dir).filter((f) => f.indexOf('.launcher.tmp') !== -1);
  assert.equal(leftoverTmp.length, 0);
});

// Breaks a version where the renamed-over file gets a fresh default mode:
// the real file's permissions must survive a pointAtLauncher rewrite.
test("pointAtLauncher preserves the real file's mode across the rewrite", (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  fs.chmodSync(p.path, 0o640);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  li.pointAtLauncher();

  const mode = fs.statSync(p.path).mode & 0o777;
  assert.equal(mode, 0o640);
});

// Breaks a version that ignores writeSync's return value: it neither
// retries nor throws on a short write (disk full, etc), so a truncated tmp
// file would get fsynced and renamed into place as if it had succeeded.
test('atomicWrite throws on a short write and does not rename the tmp file into place', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  const originalWriteSync = fs.writeSync;
  fs.writeSync = (fd, content) => originalWriteSync(fd, content) - 1; // claim one byte short
  try {
    assert.throws(() => li.pointAtLauncher(), /short write/);
  } finally {
    fs.writeSync = originalWriteSync;
  }

  // No backup exists yet, so this is the FIRST atomicWrite call pointAtLauncher
  // makes (atomicWrite(backupPath, ...)); the short write must be caught
  // there, before the tmp file is ever renamed into backupPath.
  assert.equal(fs.existsSync(p.backupPath), false);
  const leftoverTmp = fs.readdirSync(p.dir).filter((f) => f.indexOf('.launcher.tmp') !== -1);
  assert.equal(leftoverTmp.length, 0);
});

// Breaks a version that uses fs.existsSync in the absent-marker branch
// (which treats EACCES, EIO, etc the same as "doesn't exist"): a transient
// stat error on the live file there must propagate, not be read as "already
// gone", which would skip the unlink, delete the backup anyway, and report
// 'restored' while the live file still points at the launcher.
test('restoreOriginal propagates a non-ENOENT stat error in the absent-marker branch instead of skipping the unlink', (t) => {
  const p = tmpPaths(t);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  li.pointAtLauncher(); // first boot: the backup becomes the absent-marker

  const originalStatSync = fs.statSync;
  fs.statSync = (target) => {
    if (target === p.path) {
      const err = new Error('simulated EACCES');
      err.code = 'EACCES';
      throw err;
    }
    return originalStatSync(target);
  };
  try {
    assert.throws(() => li.restoreOriginal(), /simulated EACCES/);
  } finally {
    fs.statSync = originalStatSync;
  }

  // The backup must still be there: the throw must happen before it's deleted.
  assert.equal(fs.existsSync(p.backupPath), true);
});

// Breaks a version that uses fs.existsSync (which treats EACCES, EIO, etc
// the same as "doesn't exist"): a transient stat error on the backup must
// propagate, not be read as "no backup exists".
test('restoreOriginal propagates a non-ENOENT stat error instead of treating it as no backup', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  fs.writeFileSync(p.backupPath, '{"type":"HDMI_1","appId":"com.webos.app.hdmi1"}');
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  const originalStatSync = fs.statSync;
  fs.statSync = (target) => {
    if (target === p.backupPath) {
      const err = new Error('simulated EACCES');
      err.code = 'EACCES';
      throw err;
    }
    return originalStatSync(target);
  };
  try {
    assert.throws(() => li.restoreOriginal(), /simulated EACCES/);
  } finally {
    fs.statSync = originalStatSync;
  }
});

// Breaks a version that skips fsyncDir when the live file is already gone:
// an earlier crashed run could have unlinked it but never fsynced the
// directory, so that deletion wouldn't be durable yet. The fsync must still
// run even though this run does no unlink of its own.
test('restoreOriginal still fsyncs the directory when the live file is already gone', (t) => {
  const p = tmpPaths(t);
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  li.pointAtLauncher(); // first boot: backup becomes the absent-marker
  fs.unlinkSync(p.path); // simulate an earlier crashed run that already deleted it

  const originalOpenSync = fs.openSync;
  let dirFsyncOpens = 0;
  fs.openSync = (target, flags) => {
    if (flags === 'r' && target === p.dir) dirFsyncOpens++;
    return originalOpenSync(target, flags);
  };
  try {
    assert.equal(li.restoreOriginal(), 'restored');
  } finally {
    fs.openSync = originalOpenSync;
  }

  // One fsyncDir for the (already-gone) live file's directory, one for the
  // backup's directory after it's unlinked: both must still run.
  assert.equal(dirFsyncOpens, 2);
});

// Breaks a version that skips fsyncDir when the backup already exists: an
// earlier crashed run could have written the backup but never fsynced its
// directory, so that write wouldn't be durable before this run overwrites
// the live file.
test('pointAtLauncher fsyncs the backup directory even when the backup already exists', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}');
  fs.writeFileSync(p.backupPath, '{"type":"HDMI_1","appId":"com.webos.app.hdmi1"}'); // backup already taken by an earlier crashed run
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'HDMI_9' });

  const originalOpenSync = fs.openSync;
  let dirFsyncOpens = 0;
  fs.openSync = (target, flags) => {
    if (flags === 'r' && target === p.dir) dirFsyncOpens++;
    return originalOpenSync(target, flags);
  };
  try {
    li.pointAtLauncher();
  } finally {
    fs.openSync = originalOpenSync;
  }

  // One fsyncDir for the pre-existing backup (skipped write, still must be
  // made durable), one from atomicWrite's own fsync after writing the live
  // file: both must run.
  assert.equal(dirFsyncOpens, 2);
});

// Breaks a version that returns 'already-original' with no fsync at all: an
// earlier crashed run could have unlinked `path` (backup-lost case) or
// `backupPath` (restored case) without yet fsyncing that directory. The
// "nothing to do" branch must still make those pending deletes durable.
test('restoreOriginal fsyncs both directories even on the already-original no-op path', (t) => {
  const p = tmpPaths(t);
  fs.writeFileSync(p.path, '{"type":"HDMI_2","appId":"com.webos.app.hdmi2"}'); // not ours, no backup exists
  const li = createLastInput({ path: p.path, backupPath: p.backupPath, appId: 'com.cleantv.launcher', unusedInputId: 'TEST_INPUT' });

  const originalOpenSync = fs.openSync;
  let dirFsyncOpens = 0;
  fs.openSync = (target, flags) => {
    if (flags === 'r' && target === p.dir) dirFsyncOpens++;
    return originalOpenSync(target, flags);
  };
  try {
    assert.equal(li.restoreOriginal(), 'already-original');
  } finally {
    fs.openSync = originalOpenSync;
  }

  // One fsyncDir for path's directory, one for backupPath's directory: both
  // must run even though this call didn't write or delete anything itself.
  assert.equal(dirFsyncOpens, 2);
});
