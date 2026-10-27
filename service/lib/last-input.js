// Points webOS's boot-time "last input" at our app, so a cold boot opens us
// instead of whatever was last playing (a tuner, an HDMI source). Backs up
// the original once, restores it on the fail-safe path. ES5 only (Node
// v0.12.2 on the TV, confirmed live).
//
// Design adapted from hbertsch/lgtv-webos-root-launcher (MIT); written fresh.
var fs = require('fs');

// unusedInputId: a source bootd won't try to re-tune (no tuner, no device)
// so our app isn't opened behind a live picture from something else.
function buildLauncherContent(appId, unusedInputId) {
  return JSON.stringify({ type: unusedInputId, appId: appId });
}

// Marks a backup taken when the real file didn't exist yet (first boot,
// factory reset): restoreOriginal reads this back and removes the file
// again, instead of writing a bogus "original" into it.
var ABSENT_MARKER = JSON.stringify({ absent: true });

// Directory part of an absolute path, string-only (no 'path' module needed
// for this one use).
function dirOf(filePath) {
  var idx = filePath.lastIndexOf('/');
  if (idx === -1) return '.';
  return filePath.slice(0, idx) || '/';
}

// fsync a directory by path: a rename or unlink inside it isn't guaranteed
// durable without this on some filesystems.
function fsyncDir(dir) {
  var dirFd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(dirFd);
  } finally {
    fs.closeSync(dirFd);
  }
}

// Same write-then-rename pattern throughout: a crash mid-write leaves the
// old file intact, never a half-written one. fsync before rename so a power
// cut right after still can't leave a truncated file on the renamed path,
// then fsync the containing directory too, since the rename itself isn't
// guaranteed durable without that on some filesystems. The temp name carries
// our pid so two instances, or a crash-then-retry, can't collide on one
// fixed temp file. The mode is set on the open fd before the rename
// (fchmodSync), so the real path never briefly carries a default mode.
// uid/gid are carried the same way but best-effort (fchownSync can fail on
// permissions); the mode is the part that actually matters and always works.
function atomicWrite(path, content) {
  var tmpPath = path + '.' + process.pid + '.launcher.tmp';
  var mode = null;
  var uid = null;
  var gid = null;
  try {
    var st = fs.statSync(path);
    mode = st.mode;
    uid = st.uid;
    gid = st.gid;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  var fd = fs.openSync(tmpPath, 'w');
  try {
    // writeSync returns bytes actually written and neither retries nor
    // throws on a short write (disk full, etc). A short write here must
    // not reach fsync/rename, or a truncated tmp file gets renamed into
    // place as if it were the real content, corrupting the backup path.
    var written = fs.writeSync(fd, content);
    var expected = Buffer.byteLength(content);
    if (written !== expected) {
      throw new Error('atomicWrite: short write to ' + tmpPath + ' (' + written + ' of ' + expected + ' bytes)');
    }
    if (mode !== null) {
      fs.fchmodSync(fd, mode);
    }
    if (uid !== null) {
      try {
        fs.fchownSync(fd, uid, gid);
      } catch (e) {
        // Best-effort: a permission error here must not block the write.
      }
    }
    fs.fsyncSync(fd);
  } catch (e) {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(tmpPath);
    } catch (cleanupErr) {
      // Cleanup failure must not hide the real error being thrown below.
    }
    throw e;
  }
  fs.closeSync(fd);
  fs.renameSync(tmpPath, path);
  fsyncDir(dirOf(path));
}

// fs.existsSync swallows every stat error (EACCES, EIO, ...) the same as
// ENOENT, so a transient read error would read as "doesn't exist". Only
// ENOENT actually means that; anything else must propagate.
function fileExists(filePath) {
  try {
    fs.statSync(filePath);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}

function createLastInput(options) {
  var path = options.path;
  var backupPath = options.backupPath;
  var appId = options.appId;
  // No safe default exists here: on this TV, 'HDMI_1' is the actually-active
  // input, the opposite of "unused". A wrong guess must never pick itself.
  if (!options.unusedInputId) {
    throw new Error('createLastInput: unusedInputId is required, no safe default exists');
  }
  var unusedInputId = options.unusedInputId;

  function pointAtLauncher() {
    // Only the FIRST call takes a backup: a second call must not overwrite
    // the real original with our own already-rewritten content.
    if (!fileExists(backupPath)) {
      var current;
      try {
        current = fs.readFileSync(path, 'utf8');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        // First boot / factory reset: nothing to back up. Record that the
        // file was absent so restoreOriginal can remove it again later.
        atomicWrite(backupPath, ABSENT_MARKER);
        atomicWrite(path, buildLauncherContent(appId, unusedInputId));
        return;
      }
      var currentAppId;
      try {
        currentAppId = JSON.parse(current).appId;
      } catch (e) {
        // Corrupt/truncated live file: we can't prove this is our own
        // content, so treat it as not-ours and back it up verbatim below,
        // whatever garbage is actually there.
        currentAppId = null;
      }
      if (currentAppId === appId) {
        // The backup is gone but the file already points at us: we cannot
        // tell what the real original was, so backing up now would store
        // our own content as if it were LG's.
        throw new Error('lastinput already points at us and no backup exists — cannot determine the real original');
      }
      atomicWrite(backupPath, current);
    } else {
      // Backup-taking is skipped since one already exists, but an earlier
      // crashed run may have written it without fsyncing its directory yet.
      // Make that durable now, before this run overwrites the live file.
      fsyncDir(dirOf(backupPath));
    }
    atomicWrite(path, buildLauncherContent(appId, unusedInputId));
  }

  // Four-way result, not a boolean: 'restored' (backup existed, wrote it
  // back), 'already-original' (nothing was ever touched, safe),
  // 'backup-lost-recovered' (we pointed at the launcher, the backup is
  // gone so the real original can't be recovered, so the live file was
  // deleted instead, the state we assume bootd handles safely on first
  // boot, not yet confirmed live, see docs/architecture.md), not silently
  // called 'restored' since the real original really is gone.
  function restoreOriginal() {
    // Check the backup FIRST: if one exists, it's about to overwrite the
    // live file anyway, so the live file's own validity doesn't gate the
    // restore (LG's writer isn't atomic, a corrupt/truncated live file must
    // not block a restore that's going to replace it regardless).
    if (fileExists(backupPath)) {
      var original = fs.readFileSync(backupPath, 'utf8');
      if (original === ABSENT_MARKER) {
        if (fileExists(path)) {
          fs.unlinkSync(path);
        }
        // Unconditional: an earlier crashed run may have already deleted
        // the file but never got to fsync the directory, so that deletion
        // still isn't durable. Make it durable before going on to delete
        // the backup, even when this run did no unlink itself.
        fsyncDir(dirOf(path));
      } else {
        atomicWrite(path, original);
      }
      // Stale once restored: nothing refreshes it, and the design rewrites
      // the live file continuously, so a later restore must not put back
      // this same (possibly months-old) value, or re-delete a file the
      // system has since legitimately recreated (the absent-marker case).
      // path and backupPath live in different directories, so this needs
      // its own directory fsync, not just the one inside atomicWrite.
      fs.unlinkSync(backupPath);
      fsyncDir(dirOf(backupPath));
      return 'restored';
    }

    // No backup: the only thing left to determine is whether the live
    // content is already ours. A parse failure here can't be proven to be
    // ours, so treat it the same as "not ours" (the safe branch).
    var current = null;
    try {
      current = fs.readFileSync(path, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    var currentAppId = null;
    if (current !== null) {
      try {
        currentAppId = JSON.parse(current).appId;
      } catch (e) {
        currentAppId = null;
      }
    }
    if (currentAppId !== appId) {
      // Unconditional, same reasoning as the other early-exit fsyncs above:
      // an earlier crashed run could have unlinked `path` (backup-lost case)
      // or `backupPath` (restored case) without yet fsyncing that directory.
      // Make both durable before reporting success, even though this run
      // didn't write or delete anything itself.
      fsyncDir(dirOf(path));
      fsyncDir(dirOf(backupPath));
      return 'already-original';
    }
    // The real original is unrecoverable; fall back the same way first
    // boot already does (delete the file). This assumes bootd handles a
    // missing lastinput gracefully, not yet confirmed live (see
    // docs/architecture.md), but it beats leaving boot pointed at us
    // forever after an uninstall.
    fs.unlinkSync(path);
    fsyncDir(dirOf(path));
    return 'backup-lost-recovered';
  }

  return {
    pointAtLauncher: pointAtLauncher,
    restoreOriginal: restoreOriginal,
  };
}

module.exports = {
  buildLauncherContent: buildLauncherContent,
  createLastInput: createLastInput,
};
