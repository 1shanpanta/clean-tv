# Architecture: the takeover mechanism

Adapted from `hbertsch/lgtv-webos-root-launcher` (MIT), tested there on one
webOS 6.5.3 TV (2021 OLED). No code copied, the actual implementation below
is written fresh for webOS 4.10, but the *design* is theirs, credited here
in full since it's the reason this project works at all.

## What it is designed to do

Our launcher will be a normal installed web app, same as Homebrew Channel or
YouTube. It will **not** touch LG's Home at all, doesn't matter that Home
on this TV is a native compiled binary (`type: "native"`, confirmed via
`getAppInfo`), the mechanism is designed to never read or write anything
about Home itself. Instead, a background Node service (`service.js`, not
yet written, see the Status table) is designed to:

1. Watch for the HOME key and for power-on/wake.
2. Race LG's Home to the foreground, launching our app via the normal
   `applicationManager/launch` Luna call.
3. Once our app is confirmed in front (the "armed" state), set
   `com.webos.surfacemanager.disableHome: true`, telling the system's own
   surface manager to stop routing HOME to LG's Home at all. From then on,
   our own HOME-key watch would be the only thing responding.
4. Rewrite `/var/lib/eim/lastinput` so a cold boot opens our app, not
   LG's Home or whatever was last playing.
5. **Fail-safe by design**: nothing above is meant to happen until our app
   has been seen in front once. If a launch is ever refused, or it doesn't
   make it to front after retries, the service is designed to flip
   `disableHome` back to false and restore the original `lastinput`, then
   go passive until restarted. Nothing is meant to be taken from LG on a
   guess.

## Persistence: what survives reboot

| What | Where | Why |
|---|---|---|
| `lastinput` override | `/var/lib/eim/lastinput` | Designed to be rewritten continuously (every heartbeat tick, not just once), since the system is assumed to overwrite it on input changes, same reasoning as hbertsch's design, not independently confirmed on this TV. The heartbeat doesn't exist yet: `service.js` isn't written |
| Original `lastinput` | `/var/lib/webosbrew/lastinput.orig` | Taken on each takeover cycle, read back by the fail-safe restore, then retired (deleted) so the next cycle takes a fresh backup instead of reusing a stale one |
| `disableHome` flag | webOS's own config DB | Designed to be reset to `false` defensively by a boot script, every boot, *before* the service starts, so a service that silently died never leaves HOME permanently dead. That boot script doesn't exist yet |
| The service itself | `/var/lib/webosbrew/init.d/50-launcher` → our `autostart.sh` | Homebrew Channel's own `init.d` run-parts convention, already confirmed to exist on this TV. No systemd, no Upstart job, nothing OS-version-specific here. `autostart.sh` itself isn't written yet |

Everything else (PID file, logs) lives in `/tmp`, gone on every reboot, by
design.

## Known fragile points (their docs flag these; we inherit the same risk)

These are the exact things their one TV happened to measure. None of them
were guaranteed to be the same on our webOS 4.10 TV, and several of them
have since been checked live, see the Confirmed section below:

- **HOME key scan code.** Hardcoded per remote (theirs: `773`). ✅ confirmed,
  see Confirmed section below.
- **Raw `input_event` struct layout.** 16-byte records assumed (32-bit ARM
  kernel). Our TV is also armv7l (confirmed via `uname -a`), so likely the
  same, not yet confirmed.
- **`com.webos.surfacemanager.disableHome` config key.** ✅ confirmed, see
  Confirmed section below.
- **`/var/lib/eim/lastinput` file and its schema.** ✅ confirmed, see
  Confirmed section below.
- **`tvpower/power/getPowerState` on the private Luna bus.** ✅ confirmed,
  see Confirmed section below.
- **`getForegroundAppInfo` window shapes** (the "input stand-in" detection
  that tells a black-screen placeholder apart from our real app). Reverse
  engineered against *their* Home's behavior, our native (not Flutter/web)
  Home may report different window shapes entirely. Still open, see Still
  unverified below.
- **Timing constants** (45s settle window, 1.5s retry, etc.) tuned against
  their Home's launch speed. An older, native Home could be faster or
  slower, making these too short or needlessly long. Still open, see Still
  unverified below.

## Confirmed, live, on this TV (2026-10-27)

Checked live before and during writing the service code:

- `com.webos.surfacemanager.disableHome` config key exists, read via
  `getConfigs`, current value `false`.
- `/var/lib/eim/lastinput` exists: `{"type":"HDMI_1","appId":"com.webos.app.hdmi1"}`.
- `tvpower/power/getPowerState` answers `{"state":"Active"}`.
- The HOME key scan code: real input device is `/dev/input/event1`
  ("LGE RCU", found via `/proc/bus/input/devices`; this TV's own
  `/dev/input/eventN` numbering has several stale nodes that return
  ENODEV, do not assume the node number, read the device list). Captured
  a real HOME press: `type=1 (EV_KEY) code=773 value=1`, then `value=0`
  on release. Same scan code hbertsch's remote happened to use,
  confirmed independently here, not copied on faith.
- LG's own Home is `type: "native"`, read via `getAppInfo`, not a
  web/Flutter app.
- The TV's kernel/userspace is armv7l, read via `uname -a`.
- The webOS version is 4.10, read via `sdkVersion`.
- `/var/lib/webosbrew/init.d` exists, Homebrew Channel's own run-parts
  autostart convention.
- Node is v0.12.2, the version that actually runs the service.

## Still unverified

- `getForegroundAppInfo` window shapes (`extraInfo:true`): the "input
  stand-in" detection logic is reverse engineered against hbertsch's
  Home, not tested against our native Home.
- `videooutput/getStatus` shape: assumed, not read live.
- `applicationManager/launch` behavior: assumed, not called live.
- `setConfigs` behavior, the call that would actually flip `disableHome`:
  assumed, not called live.
- All timing constants (45s settle window, 1.5s retry, etc.): tuned
  against hbertsch's Home, not measured against ours.
- No boot script and no heartbeat exist yet: `service.js` isn't written,
  so nothing re-applies `disableHome` or `lastinput` on reboot.
- Whether bootd actually honors a rewritten `lastinput` pointing at a
  third-party app id at all: not yet determined.
- Which specific "unused input" type value is actually safe on this TV: not
  yet determined. The tests use placeholders (`TEST_INPUT`, `HDMI_9`), not a
  value confirmed safe on real hardware.
- Whether bootd actually handles a missing `lastinput` file gracefully: the
  first-boot and backup-lost recovery paths both assume this, not yet
  confirmed live.
- Whether bootd handles a CORRUPT (garbage, truncated) `lastinput` the same
  way as a genuinely MISSING one: the restore path backs up and could
  restore corrupt bytes verbatim, and it's unknown if bootd copes with that
  the same as a missing file.
- File ownership (uid/gid) preservation across a rewrite is best-effort
  only: `fchownSync` can fail silently depending on permissions, only the
  file's mode is guaranteed to survive.
- The test suite runs on modern Node, not the TV's actual Node v0.12.2.
  `service/`'s ES5-correctness has been hand-verified by review, not
  automatically checked by any tool.
- The raw `input_event` struct layout (16-byte records, 32-bit ARM): assumed
  for `service.js`'s own future parsing of `/dev/input/event1`, not yet
  confirmed. The live HOME key capture above proves the scan code, not this
  layout: no code in this repo has decoded the raw bytes itself yet.

Next: write the service, which is what would actually exercise most of
the APIs above.
