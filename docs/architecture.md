# Architecture: the takeover mechanism

Adapted from `hbertsch/lgtv-webos-root-launcher` (MIT), tested there on one
webOS 6.5.3 TV (2021 OLED). No code copied, the actual implementation below
is written fresh for webOS 4.10, but the *design* is theirs, credited here
in full since it's the reason this project works at all.

## What it actually does

Our launcher is a normal installed web app, same as Homebrew Channel or
YouTube. It does **not** touch LG's Home at all, doesn't matter that Home
on this TV is a native compiled binary (`type: "native"`, confirmed via
`getAppInfo`), the mechanism never reads or writes anything about Home
itself. Instead, a background Node service:

1. Watches for the HOME key and for power-on/wake.
2. Races LG's Home to the foreground, launching our app via the normal
   `applicationManager/launch` Luna call.
3. Once our app is confirmed in front (the "armed" state), sets
   `com.webos.surfacemanager.disableHome: true`, telling the system's own
   surface manager to stop routing HOME to LG's Home at all. From then on,
   our own HOME-key watch is the only thing responding.
4. Rewrites `/var/lib/eim/lastinput` so a cold boot opens our app, not
   LG's Home or whatever was last playing.
5. **Fail-safe by design**: nothing above happens until our app has been
   seen in front once. If a launch is ever refused, or it doesn't make it
   to front after retries, the service flips `disableHome` back to false
   and restores the original `lastinput`, then goes passive until
   restarted. Nothing is ever taken from LG on a guess.

## Persistence: what survives reboot

| What | Where | Why |
|---|---|---|
| `lastinput` override | `/var/lib/eim/lastinput` | Rewritten continuously (every heartbeat tick, not just once), since the system itself overwrites it on input changes |
| Original `lastinput` | `/var/lib/webosbrew/lastinput.orig` | One-time backup, read back by the fail-safe restore |
| `disableHome` flag | webOS's own config DB | Reset to `false` defensively by the boot script itself, every boot, *before* the service starts, so a service that silently died never leaves HOME permanently dead |
| The service itself | `/var/lib/webosbrew/init.d/50-launcher` → our `autostart.sh` | Homebrew Channel's own `init.d` run-parts convention, already confirmed to exist on this TV. No systemd, no Upstart job, nothing OS-version-specific here |

Everything else (PID file, logs) lives in `/tmp`, gone on every reboot, by
design.

## Known fragile points (their docs flag these; we inherit the same risk)

These are the exact things their one TV happened to measure. None of them
are guaranteed to be the same on our webOS 4.10 TV, a 2018 set, and none
have been checked live yet:

- **HOME key scan code.** Hardcoded per remote (theirs: `773`). Must be
  re-measured on our own remote.
- **Raw `input_event` struct layout.** 16-byte records assumed (32-bit ARM
  kernel). Our TV is also armv7l (confirmed via `uname -a`), so likely the
  same, not yet confirmed.
- **`com.webos.surfacemanager.disableHome` config key.** Assumed to exist
  and behave the same. Not yet checked on this TV.
- **`/var/lib/eim/lastinput` file and its schema.** Assumed present.
  Not yet checked.
- **`tvpower/power/getPowerState` on the private Luna bus.** Assumed
  present and shaped the same. Not yet checked.
- **`getForegroundAppInfo` window shapes** (the "input stand-in" detection
  that tells a black-screen placeholder apart from our real app). Reverse
  engineered against *their* Home's behavior, our native (not Flutter/web)
  Home may report different window shapes entirely.
- **Timing constants** (45s settle window, 1.5s retry, etc.) tuned against
  their Home's launch speed. An older, native Home could be faster or
  slower, making these too short or needlessly long.

## Confirmed, live, on this TV (2026-10-27)

All four unknowns checked before writing any service code:

- `com.webos.surfacemanager.disableHome` config key exists, read via
  `getConfigs`, current value `false`.
- `/var/lib/eim/lastinput` exists: `{"type":"HDMI_1","appId":"com.webos.app.hdmi1"}`.
- `tvpower/power/getPowerState` answers `{"state":"Active"}`.
- Real input device is `/dev/input/event1` ("LGE RCU", found via
  `/proc/bus/input/devices`; this TV's own `/dev/input/eventN` numbering
  has several stale nodes that return ENODEV, do not assume the node
  number, read the device list). Captured a real HOME press:
  `type=1 (EV_KEY) code=773 value=1`, then `value=0` on release. Same
  scan code hbertsch's remote happened to use, confirmed independently
  here, not copied on faith.

Nothing left unverified from the original list. Next: write the service.
