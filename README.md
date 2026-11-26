# Kestrel Courier — Solmar Sky Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/toirant/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057/leaderboard)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/toirant/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete, original flight game that runs offline in a desktop browser
from static files — no build step, no network requests, no libraries.

## The game

You are the mail pilot of **Kestrel-7**, a red-and-cream bush plane, flying
the mail run across the **Solmar archipelago**: turquoise lagoons, white
beaches, forested volcanic islands, and one home runway — Solmar Field 09.

- **Fly the course**: take off from runway 09, thread all **8 glowing rings**
  in order around the islands (each one pays 250 points, plus a combo bonus),
  then bring her home and land on runway 09 for the landing bonus.
- **A real flight model**: throttle, bank, pitch, stalls below 58 knots,
  fuel that burns with the throttle, flaps and retractable gear, wind and
  drifting clouds, and terrain that bites if you fly into it.
- **A lit cockpit**: compass tape with heading and the next objective's
  bearing, airspeed and altitude tapes, a rolling artificial horizon,
  throttle and fuel gauges, gear/flaps lamps, ring progress pips, and a
  seven-minute mission clock.
- **Two views**: a chase view with the aircraft in frame, and a cockpit view
  (C) over the cowling with the glareshield and pillars.
- **Keyboard + mouse**: the mouse steers (bank and pitch follow the pointer),
  W/S work the throttle, A/D or arrows bank, up/down pitch, G gear, F flaps,
  Space brake, P pause, M mute, R restart. Synthesised engine, wind, ring
  chimes and touchdown sounds — all generated with Web Audio, no audio files.
- **Title, pause and results screens**, with a landing-quality rating and a
  final score when the mail is delivered.

## Play it

Serve `game/` with any static server and open `index.html` in desktop
Chrome, or run the included dev server from this directory:

```sh
node serve.ts
# then open http://localhost:8080
```

Screenshot staging lives in `game/src/shots.js`: open
`index.html?shot=cover|lagoon|approach|results` for a frozen, deterministic
frame of the real game — the same draw calls the live game uses.

## Hand it in

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` (or
`$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json` with the vendored
make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `main.ts` — the entrypoint that hands the game in
- `game/index.html`, `game/style.css` — the page
- `game/src/config.js` — tuning, course, scoring, palette
- `game/src/random.js` — seeded randomness and smooth noise
- `game/src/world.js` — the archipelago terrain, runway and clouds
- `game/src/flight.js` — the flight model, rings, landings and crashes
- `game/src/render.js` — sky, sea, terrain, runway, rings and the aircraft
- `game/src/hud.js` — instruments, banners and screens
- `game/src/audio.js` — synthesised sound
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — staged frames for the screenshots
- `game/src/main.js` — the game loop and state machine
- `screenshots/` — four real renders of the game in headless Chromium
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`. Kestrel Courier is an original game: its own idea, art,
sounds and names.
