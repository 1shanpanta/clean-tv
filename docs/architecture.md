# Architecture: the takeover mechanism

Design adapted from `hbertsch/lgtv-webos-root-launcher` (MIT), built for
webOS 6. No code copied; the implementation here is written fresh for
webOS 4.10.

`service.js` is not written. This page describes the plan and what has been
checked on the TV.

## How the takeover works

Our launcher is a normal installed web app, same as Homebrew Channel or
YouTube. LG's Home on this TV is a native app. The launcher never touches
it. A background Node service (`service.js`):

1. Watches for the HOME key and for power-on/wake.
2. Races LG's Home to the foreground and launches our app through the
   normal `applicationManager/launch` Luna call.
3. Once our app is in front (the "armed" state), sets the surface manager's
   disable-Home flag. The system then stops routing HOME to LG's Home, and
   our own HOME-key watch is the only thing that responds.
4. Rewrites the boot-input file so a cold boot opens our app, not LG's Home
   or whatever was last playing.
5. Sets the flag only after our app has been seen in front once. If a launch
   is refused, or retries run out, the service resets the flag, restores the
   backup, and stops until restarted.

## Persistence: what survives reboot

| What | Where | Why |
|---|---|---|
| Boot-input override | the boot-input file | Rewritten on every heartbeat tick, not once, because the system overwrites it on input changes. Same reasoning as hbertsch's design, not confirmed on this TV |
| Original boot input | `/var/lib/webosbrew/lastinput.orig` | Taken on each takeover cycle, read back by the fail-safe restore, then deleted so the next cycle takes a fresh backup instead of reusing a stale one |
| Disable-Home flag | webOS's own config DB | Reset to `false` by a boot script, every boot, before the service starts, so a service that silently died never leaves HOME dead |
| The service itself | `/var/lib/webosbrew/init.d/50-launcher` to our `autostart.sh` | Homebrew Channel's own `init.d` run-parts convention, confirmed to exist on this TV. No systemd, no Upstart job, nothing OS-version-specific |

Everything else (PID file, logs) lives in `/tmp`, gone on every reboot.

## Confirmed on this TV

- The disable-Home config key exists, read via `getConfigs`, current value
  `false`.
- The boot-input file exists and holds a JSON object with `type` and `appId`.
- `getPowerState` answers `Active`.
- A HOME press arrives on the remote's evdev node as a plain key event. The
  scan code matches the one hbertsch's remote uses. Do not assume the node
  number: this TV has several stale `/dev/input/eventN` nodes that return
  ENODEV, so read the device list first.
- LG's Home is a native app, read via `getAppInfo`, not a web or Flutter app.
- Kernel and userspace are armv7l.
- webOS version is 4.10.
- Homebrew Channel's `init.d` autostart directory exists.
- Node is v0.12.2.

## Still unverified

- Four Luna calls not made live: `getForegroundAppInfo` with
  `extraInfo:true` (the "input stand-in" detection is reverse engineered
  against hbertsch's Home, not our native one), `videooutput/getStatus`,
  `applicationManager/launch`, and `setConfigs` (the call that flips the
  disable-Home flag).
- bootd's behavior with a rewritten, missing or corrupt boot-input file. The
  restore path could write corrupt bytes back verbatim. Which "unused input"
  value is safe is also open; the tests use placeholders (`TEST_INPUT`,
  `HDMI_9`).
- Timing constants (45s settle window, 1.5s retry) are tuned against
  hbertsch's Home, not measured against ours.
- File ownership across a rewrite is best effort: `fchownSync` can fail
  silently, only the file mode is guaranteed to survive.
- The test suite runs on modern Node, not v0.12.2. `service/` ES5
  correctness is checked by review, not by a tool.
- The raw `input_event` struct layout (16-byte records, 32-bit ARM) is
  assumed for the future parsing of the remote's evdev node. No code in this
  repo has decoded the raw bytes yet.
- No boot script and no heartbeat exist, so nothing re-applies the flag or
  the boot-input file on reboot.
