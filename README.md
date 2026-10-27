# clean-tv

A clean Home screen for a rooted LG webOS 4 TV: clock, photo background, a dock of
apps, and a safe fallback to LG's stock Home if it fails to load.

Built because no existing launcher supports webOS 4. [cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS)
does the same job on webOS 5+ (systemd required); this project adapts its
bind-mount idea to webOS 4's Upstart init system instead.

## Decisions (frozen)

- **Scope for v1:** clock, photo background, static app dock, fallback to stock
  Home. No live TV, no voice, no themes, no remote-button escape hatch.
  Debloat is in scope as a follow-on pass, after v1's takeover is proven safe.
- **Mechanism:** `mount --bind` a new Home directory over LG's stock one
  (nothing of LG's is overwritten), then `initctl restart` the app manager job
  instead of `systemctl restart sam` (webOS 4 has no systemd).
- **Target:** webOS 4.0–4.10, tested against a rooted 43LM5700PTC
  (firmware 05.40.97).
- **License:** MIT.

## Parked (not decided yet)

- Whether this TV's Home is the old QML kind or something else; changes how
  `stage-home.sh` builds the replacement directory.
- Debloat pass (stretch, after v1 fallback is proven safe).

## Confirmed, live against the TV

- Init system is Upstart (`/sbin/initctl`, `/etc/init/*.conf`), no systemd.
- `WebAppMgr` (`/usr/bin/WebAppMgr`, user `wam`) is the single process hosting
  every web-based app, Home included. Its Upstart job has `respawn` and stops
  cleanly on request.
- `initctl restart WebAppMgr` is this TV's equivalent of `systemctl restart
  sam` on newer webOS. Confirmed via `initctl status` and the job file, not
  yet actually run.
- Restarting it will close every running web-based app (Home, browser);
  native players like YouTube's `cobalt` process are unaffected. Matches the
  same trade-off `cleanyourtv-WebOS` itself warns about on supported TVs.
- Stock app directories live at `/usr/palm/applications/<id>/`, confirmed by
  cross-reading two other webOS root projects (`hbertsch`,
  `NaveenDA`), consistent with this TV's own file layout.

## Status

Pure UI logic has tests and runs in a browser. The TV-side mount/restart
scripts are **unverified**: written from the mechanism above, not yet run
against a real TV. That is the next step, one command at a time, with the
undo path confirmed before anything else changes.

## Develop

```sh
npm test
```

Opens no browser and touches no TV: tests cover `app/lib/*.js` only.

## Credit

The bind-mount-over-stock-Home idea is adapted from
[cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS) (MIT). No
code from that repository is copied; the webOS 5+ mechanism does not run as-is
on webOS 4, so this is a from-scratch reimplementation for the older init
system.
