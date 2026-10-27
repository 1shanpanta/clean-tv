# clean-tv

A clean Home screen for a rooted LG webOS 4 TV: clock, photo background, a dock
of apps, designed to fall back safely to LG's stock Home if it fails to load.

<img src="app/assets/wallpaper.jpg" alt="v1 wallpaper" width="640">

The wallpaper photo is the project owner's own, not stock or AI-generated.

Built because no existing launcher supports webOS 4. [cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS)
does the same job on webOS 5+ (systemd required); this project borrows the
*design* of [hbertsch/lgtv-webos-root-launcher](https://github.com/hbertsch/lgtv-webos-root-launcher)
instead (MIT, no code copied), adapted for an older TV with no systemd and a
native, not web-based, stock Home.

## How it works

```mermaid
flowchart LR
    subgraph app["app/ — the launcher UI"]
        html[index.html]
        css[style.css]
        js[app.js]
        lib1[lib/clock.js]
        lib2[lib/dock.js]
        lib3[lib/time-offset.js]
    end

    subgraph service["service/ — the takeover daemon"]
        svc[service.js]
        fg[lib/foreground.js]
        li[lib/last-input.js]
    end

    svc -- "launches via Luna" --> html
    svc -- "reads foreground state" --> fg
    svc -- "rewrites boot target" --> li
    li -- "points boot at" --> html
```

The launcher (`app/`) will be a normal installed web app, same kind as YouTube or
Homebrew Channel. It will never touch LG's Home at all, doesn't matter that
this TV's Home is a compiled native binary, not HTML. Instead, a background
service (`service/`) is designed to race LG's Home to the screen at every
power-on and HOME key press, and once it wins once, tell the system to stop
routing HOME to LG's side entirely.

### The power-on race

```mermaid
sequenceDiagram
    participant TV as webOS boot (bootd)
    participant Svc as clean-tv service
    participant Home as LG Home (native)

    TV->>TV: power state becomes Active
    par Both try to take the screen
        TV->>Home: open last input / Home
        Svc->>Svc: wait 2s, then launch our app
    end
    Svc->>TV: getForegroundAppInfo
    alt We won
        Svc->>Svc: armed — disableHome=true
        Svc->>TV: HOME now only reaches us
    else Home won this round
        Svc->>Svc: retry (up to 4x, 1.5s apart)
    else All retries failed
        Svc->>Svc: fail-safe — give HOME and last-input back to LG
    end
```

Nothing is meant to be taken from LG on a guess: the fail-safe gate is
designed to arm only after our app has actually been confirmed on screen
once.

## Status

| Piece | State |
|---|---|
| UI logic (`app/lib/*.js`) | Written, tested (17 tests) |
| Service logic (`service/lib/*.js`) | Written, tested (41 tests) |
| UI itself (`app.js`, `style.css`) | Installed and launched on the real TV; dock (5 tiles, looping), top-icons row, and the live-time correction all confirmed working on-device |
| Live HOME key scan code | Confirmed on this TV: `773` |
| `disableHome` config key, `lastinput` file, `getPowerState` | Confirmed present on this TV |
| `getForegroundAppInfo`, `videooutput/getStatus`, `applicationManager/launch`, `setConfigs`, the timing constants | Not yet checked live |
| The service's own entry point (`service.js`) | Not yet written, HOME still opens stock LG Home until it exists |

Several things were checked live before and during writing the service code
(the HOME scan code from raw evdev, the `lastinput` plain file, two Luna
calls, `disableHome` and `getPowerState`, plus device facts like the armv7l
kernel, webOS 4.10, and Node v0.12.2); the rest wait on the entry point,
since `service.js` is what would actually call them: see
[`docs/architecture.md`](docs/architecture.md) for exactly what was
verified, live, and how.

## Decisions (frozen)

- **Scope for v1:** clock, photo background, static app dock, fallback to
  stock Home. No live TV, no voice, no themes, no remote-button escape hatch.
  Debloat is in scope as a follow-on pass, after v1's takeover is proven safe.
- **Target:** webOS 4.0–4.10, developed against a rooted 43LM5700PTC
  (firmware 05.40.97).
- **Default dock:** YouTube, Prime Video, Web Browser, Homebrew, Live TV, a
  looping row (past the last tile wraps to the first). Icons are flat white
  glyphs via a CSS mask, not this TV's own colored app icons: see Credit.
- **Top-icons row:** Photo & Video, LG Content Store, Settings
  (`com.palm.app.settings`, confirmed live, `com.webos.app.settings` does
  not exist on this TV), a separate focus zone reached with Up/Down from
  the dock.
- **License:** MIT.

## Develop

```sh
npm test
```

Runs every test in `tests/`: UI logic and service logic, 58 total. Opens no
browser and touches no TV.

## Credit

The takeover mechanism (racing HOME/power-on, `disableHome`, the last-input
rewrite, the fail-safe arm/fail state machine) is adapted from
[hbertsch/lgtv-webos-root-launcher](https://github.com/hbertsch/lgtv-webos-root-launcher)
(MIT), built there for a 2021 webOS 6 TV. No code from that repository is
copied; every file here is written fresh for webOS 4.10's older Node
(v0.12.2, confirmed live) and its Upstart-based (not systemd) boot process.

The visual design, clock top-left, photo background, bottom dock, and the
"glass" look on the dock itself, is adapted from
[nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame) (MIT), built
for Samsung The Frame (Tizen), a different OS entirely. The glass effect
there turned out to be plain gradients and an inset highlight, no
`backdrop-filter`, which happens to be exactly what this TV's decade-old
WebKit engine can actually render. The real blur behind the dock is a
genuine duplicate-and-blur of the wallpaper (the `filter` property, not
`backdrop-filter`), works in a desktop browser but this TV's engine ignores
it silently, degrading to the plain gradient with no error.

**Icons** are flat white glyphs rendered via a CSS mask, not this TV's own
colored app icons (those came back inconsistent, different brand colors
each, and YouTube's only on-device asset is a wordmark banner, never a
square mark). `youtube.svg` and `primevideo.svg` are CleanFrame's own
bundled icon pack (same repo, MIT). `globe.svg`, `tv.svg`, `beer.svg`,
`image.svg`, `grid.svg`, and `settings.svg` are from
[Lucide](https://lucide.dev) (ISC), pinned to v0.460.0.
