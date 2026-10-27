// Points webOS's boot-time "last input" at our app, so a cold boot opens us
// instead of whatever was last playing (a tuner, an HDMI source). Backs up
// the original once, restores it on the fail-safe path. ES5 only (Node
// v0.12.2 on the TV, confirmed live).
//
// Mechanism credit: adapted from hbertsch/lgtv-webos-root-launcher (MIT).
var fs = require('fs');

// unusedInputId: a source bootd won't try to re-tune (no tuner, no device)
// so our app isn't opened behind a live picture from something else.
function buildLauncherContent(appId, unusedInputId) {
  return JSON.stringify({ type: unusedInputId, appId: appId });
}

// Same write-then-rename pattern throughout: a crash mid-write leaves the
// old file intact, never a half-written one.
function atomicWrite(path, content) {
  var tmpPath = path + '.launcher.tmp';
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, path);
}

function createLastInput(options) {
  var path = options.path;
  var backupPath = options.backupPath;
  var appId = options.appId;
  var unusedInputId = options.unusedInputId || 'HDMI_1';

  function pointAtLauncher() {
    // Only the FIRST call takes a backup: a second call must not overwrite
    // the real original with our own already-rewritten content.
    if (!fs.existsSync(backupPath)) {
      var current = fs.readFileSync(path, 'utf8');
      atomicWrite(backupPath, current);
    }
    atomicWrite(path, buildLauncherContent(appId, unusedInputId));
  }

  function restoreOriginal() {
    if (!fs.existsSync(backupPath)) {
      return false;
    }
    var original = fs.readFileSync(backupPath, 'utf8');
    atomicWrite(path, original);
    return true;
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
