// Kestrel Courier — main loop and screens.
// Wires input, flight model, renderer, HUD and audio together, and owns the
// game state machine: title -> playing -> paused -> results. With a
// `?shot=<name>` query it renders one staged frame and stops, so the entry's
// screenshots are real renders of this code.

import { GAME } from './config.js';
import { clamp } from './random.js';
import { createPlane, stepFlight } from './flight.js';
import { driftClouds, makeClouds } from './world.js';
import {
  drawClouds,
  drawCockpitFrame,
  drawPlane,
  drawRings,
  drawRunway,
  drawSea,
  drawSky,
  drawTerrain,
  makeCamera,
} from './render.js';
import {
  drawAttitude,
  drawBanner,
  drawCompass,
  drawEnginePanel,
  drawMissionBar,
  drawPause,
  drawResults,
  drawSideTapes,
  drawTitle,
} from './hud.js';
import {
  createAudio,
  ensureAudio,
  playCrash,
  playRingChime,
  playThud,
  toggleMute,
  updateAudio,
} from './audio.js';
import {
  attachInput,
  consumePressed,
  createInputState,
  readFlightInput,
  throttleNudge,
} from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = GAME.width;
canvas.height = GAME.height;
// The fallback paragraph is only for no-JavaScript browsers; hide it now
// that the game has loaded so it never overlaps the HUD in screenshots.
const fallback = document.getElementById('fallback');
if (fallback) fallback.style.display = 'none';

const clouds = makeClouds();
const audio = createAudio();
const input = createInputState();
let plane = createPlane();
let screen = 'title'; // title | playing | paused | results
let cameraMode = 'chase';
let banner = null; // { text, subtext, colour, until }
let bannerTimer = 0;
let elapsed = 0;
let lastTime = 0;
let muted = false;

attachInput(input, canvas, () => ensureAudio(audio));

function showBanner(text, subtext, colour, seconds = 3) {
  banner = { text, subtext, colour };
  bannerTimer = seconds;
}

function startRun() {
  plane = createPlane();
  screen = 'playing';
  cameraMode = 'chase';
  banner = null;
  ensureAudio(audio);
  showBanner('SOLMAR SKY RUN', 'Take off from runway 09 — ring 1 is east, 620 m out', '#ffd23e', 4);
}

function handleEvents(events) {
  for (const e of events) {
    if (e === 'ring') {
      playRingChime(audio);
      const n = plane.ringsFlown;
      showBanner(
        `RING ${n} FLOWN  +${250 + 50 * (plane.combo - 1)}`,
        n >= 8 ? 'All rings flown — land on runway 09' : `Ring ${n + 1} ahead`,
        '#8dff6e',
      );
    } else if (e === 'takeoff') {
      showBanner('AIRBORNE', 'Gear up when you are ready — G toggles the gear', '#7fe7ff');
    } else if (e === 'stall') {
      showBanner('STALL', 'Nose down, throttle up', '#ff5a4e');
    } else if (e === 'lowfuel') {
      showBanner('LOW FUEL', 'Finish the run — the tank is nearly dry', '#ff5a4e');
    } else if (e === 'landed') {
      playThud(audio);
      screen = 'results';
    } else if (e === 'crashed') {
      playCrash(audio);
      screen = 'results';
    }
  }
}

function handlePressed(pressed) {
  if (pressed.has('Enter') && screen === 'title') startRun();
  if (pressed.has('KeyR') && (screen === 'results' || screen === 'paused' || screen === 'playing')) {
    startRun();
  }
  if (pressed.has('KeyP') && screen === 'playing') screen = 'paused';
  else if (pressed.has('KeyP') && screen === 'paused') screen = 'playing';
  if (pressed.has('KeyM')) {
    muted = toggleMute(audio);
    showBanner(muted ? 'SOUND OFF' : 'SOUND ON', '', '#7fe7ff', 1.2);
  }
  if (pressed.has('KeyC') && screen === 'playing') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (pressed.has('KeyG') && screen === 'playing') {
    plane.gearDown = !plane.gearDown;
    showBanner(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', '', '#7fe7ff', 1.2);
  }
  if (pressed.has('KeyF') && screen === 'playing') {
    plane.flaps = !plane.flaps;
    showBanner(plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', '', '#7fe7ff', 1.2);
  }
  if (input.mouseDown && screen === 'title') startRun();
}

function update(dt) {
  const pressed = consumePressed(input);
  handlePressed(pressed);
  if (screen !== 'playing') return;
  // Throttle is a lever: W/S nudge it, the mouse wheel is not needed.
  plane.throttle = clamp(plane.throttle + throttleNudge(input, dt), 0, 1);
  const flightInput = readFlightInput(input);
  // On the ground the plane only rolls straight; in the air the stick flies.
  if (!plane.airborne) flightInput.roll = 0;
  const events = stepFlight(plane, flightInput, dt);
  handleEvents(events);
  if (bannerTimer > 0) bannerTimer -= dt;
  if (bannerTimer <= 0) banner = null;
  driftClouds(clouds, dt);
  updateAudio(audio, plane);
}

function render(now) {
  const w = GAME.width;
  const h = GAME.height;
  const sunset = screen === 'title' || (screen === 'results' && plane.landed);
  const cam = makeCamera(plane, cameraMode);
  const horizon = drawSky(ctx, w, h, plane, cam, sunset);
  drawSea(ctx, w, h, horizon, now);
  drawTerrain(ctx, w, h, plane, cam, horizon);
  drawRunway(ctx, w, h, cam);
  drawClouds(ctx, w, h, cam, clouds);
  drawRings(ctx, w, h, cam, plane, now);
  if (screen !== 'title') {
    if (cameraMode === 'chase') drawPlane(ctx, w, h, plane, now);
    else drawCockpitFrame(ctx, w, h, plane);
  }
  if (screen === 'playing' || screen === 'paused') {
    drawCompass(ctx, w, plane);
    drawSideTapes(ctx, w, h, plane);
    drawAttitude(ctx, w, h, plane);
    drawEnginePanel(ctx, w, h, plane);
    drawMissionBar(ctx, w, plane);
    if (banner) drawBanner(ctx, w, h, banner.text, banner.subtext, banner.colour);
    if (screen === 'paused') drawPause(ctx, w, h);
  } else if (screen === 'title') {
    drawTitle(ctx, w, h, plane);
  } else if (screen === 'results') {
    drawResults(ctx, w, h, plane);
  }
}

function frame(timestamp) {
  const now = timestamp / 1000;
  const dt = lastTime === 0 ? 0.016 : Math.min(0.05, now - lastTime);
  lastTime = now;
  elapsed = now;
  update(dt);
  render(now);
  requestAnimationFrame(frame);
}

// Screenshot mode: one frozen, staged frame — no loop, no audio, no input.
function renderShot(name) {
  const staged = stageShot(name);
  plane = staged.plane;
  screen = staged.screen;
  cameraMode = staged.camera;
  const t = staged.time;
  const w = GAME.width;
  const h = GAME.height;
  const cam = makeCamera(plane, cameraMode);
  const horizon = drawSky(ctx, w, h, plane, cam, staged.sunset);
  drawSea(ctx, w, h, horizon, t);
  drawTerrain(ctx, w, h, plane, cam, horizon);
  drawRunway(ctx, w, h, cam);
  drawClouds(ctx, w, h, cam, clouds);
  drawRings(ctx, w, h, cam, plane, t);
  if (screen !== 'title') {
    if (cameraMode === 'chase') drawPlane(ctx, w, h, plane, t);
    else drawCockpitFrame(ctx, w, h, plane);
  }
  if (screen === 'playing') {
    drawCompass(ctx, w, plane);
    drawSideTapes(ctx, w, h, plane);
    drawAttitude(ctx, w, h, plane);
    drawEnginePanel(ctx, w, h, plane);
    drawMissionBar(ctx, w, plane);
    if (staged.banner) drawBanner(ctx, w, h, staged.banner.text, staged.banner.subtext, staged.banner.colour);
  } else if (screen === 'title') {
    drawTitle(ctx, w, h, plane);
  } else if (screen === 'results') {
    drawResults(ctx, w, h, plane);
  }
  document.title = `Kestrel Courier — shot ${name}`;
}

// Resize the canvas element to the window while the drawing buffer stays
// 1280x720, so the game always looks the same in screenshots and in play.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / GAME.width, window.innerHeight / GAME.height);
  canvas.style.width = `${Math.floor(GAME.width * scale)}px`;
  canvas.style.height = `${Math.floor(GAME.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  renderShot(shot);
} else {
  requestAnimationFrame(frame);
}

// A tiny handle for play-testing from the console.
window.__kestrel = { get plane() { return plane; }, get screen() { return screen; }, startRun };
