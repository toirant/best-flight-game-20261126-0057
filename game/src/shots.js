// Kestrel Courier — staged scenes for the entry's screenshots.
// `?shot=start|cover|lagoon|approach|results` renders one frozen,
// deterministic frame of the real game — the same draw calls the live game
// uses, with the plane, rings, runway and HUD placed so each screenshot
// shows the flight game at its best. The live game never calls this file.

import { RINGS, RUNWAY } from './config.js';
import { degToRad } from './random.js';
import { createPlane } from './flight.js';

export const SHOT_NAMES = ['start', 'cover', 'lagoon', 'approach', 'results'];

// Place the plane a set distance before a ring, nose on the ring.
function beforeRing(plane, ringIndex, distance, yOffset) {
  const ring = RINGS[ringIndex];
  const dx = ring.x - plane.x;
  const dz = ring.z - plane.z;
  const bearing = Math.atan2(dx, -dz);
  plane.heading = bearing;
  plane.x = ring.x - Math.sin(bearing) * distance;
  plane.z = ring.z + Math.cos(bearing) * distance;
  plane.y = ring.y + yOffset;
  return plane;
}

function flying(plane, overrides) {
  Object.assign(plane, {
    airborne: true,
    throttle: 0.75,
    speed: 132,
    gearDown: true,
    flaps: false,
    fuel: 82,
    missionTime: 118,
    timeLeft: 242,
  });
  Object.assign(plane, overrides);
  return plane;
}

// Title screen: Kestrel-7 parked on runway 09 at sunset, islands behind.
export function stageStart() {
  const plane = createPlane();
  plane.x = RUNWAY.x - 120;
  plane.y = RUNWAY.elevation + 2;
  plane.z = RUNWAY.z;
  plane.heading = degToRad(90);
  return {
    plane,
    screen: 'title',
    camera: 'chase',
    sunset: true,
    time: 4.2,
    banner: null,
  };
}

// The cover: banking through the lagoon towards ring 3, the main island and
// the runway ahead, instruments lit, two rings already in the bag.
export function stageCover() {
  const plane = createPlane();
  plane.x = 900;
  plane.z = -700;
  beforeRing(plane, 2, 380, -18);
  flying(plane, {
    pitch: degToRad(4),
    roll: degToRad(-16),
    speed: 138,
    throttle: 0.8,
    ringsFlown: 2,
    nextRing: 2,
    combo: 2,
    score: 550,
    fuel: 84,
    missionTime: 96,
    timeLeft: 264,
  });
  return {
    plane,
    screen: 'playing',
    camera: 'chase',
    sunset: false,
    time: 7.5,
    banner: { text: 'RING 2 FLOWN  +300', subtext: 'Ring 3 ahead — 380 m', colour: '#8dff6e' },
  };
}

// Low over the turquoise lagoon, ring 5 dead ahead, islands on both sides.
export function stageLagoon() {
  const plane = createPlane();
  plane.x = -900;
  plane.z = -500;
  beforeRing(plane, 4, 320, -30);
  flying(plane, {
    pitch: degToRad(2),
    roll: degToRad(10),
    speed: 148,
    throttle: 0.85,
    ringsFlown: 4,
    nextRing: 4,
    combo: 4,
    score: 1150,
    fuel: 71,
    missionTime: 168,
    timeLeft: 192,
  });
  return {
    plane,
    screen: 'playing',
    camera: 'chase',
    sunset: false,
    time: 11.2,
    banner: { text: 'RING 4 FLOWN  +350', subtext: 'Ring 5 ahead — 320 m', colour: '#8dff6e' },
  };
}

// Final approach: all eight rings flown, gear down, flaps out, runway 09
// filling the windscreen, 55 metres above the threshold.
export function stageApproach() {
  const plane = createPlane();
  flying(plane, {
    x: RUNWAY.x - 620,
    y: RUNWAY.elevation + 58,
    z: RUNWAY.z + 6,
    heading: degToRad(90),
    pitch: degToRad(-4),
    roll: degToRad(2),
    speed: 84,
    throttle: 0.32,
    gearDown: true,
    flaps: true,
    ringsFlown: 8,
    nextRing: 8,
    combo: 8,
    score: 2650,
    fuel: 52,
    missionTime: 238,
    timeLeft: 122,
  });
  return {
    plane,
    screen: 'playing',
    camera: 'chase',
    sunset: false,
    time: 15.8,
    banner: { text: 'ALL RINGS FLOWN', subtext: 'Land on runway 09 — gear down, flaps out', colour: '#ffd23e' },
  };
}

// The mail delivered: Kestrel-7 parked on the runway, results on screen.
export function stageResults() {
  const plane = createPlane();
  plane.x = RUNWAY.x + 60;
  plane.y = RUNWAY.elevation + 2;
  plane.z = RUNWAY.z;
  plane.heading = degToRad(90);
  plane.landed = true;
  plane.airborne = false;
  plane.speed = 0;
  plane.throttle = 0;
  plane.ringsFlown = 8;
  plane.nextRing = 8;
  plane.combo = 8;
  plane.score = 3420;
  plane.missionTime = 262;
  plane.timeLeft = 98;
  plane.touchdownQuality = 0.92;
  plane.fuel = 48;
  return {
    plane,
    screen: 'results',
    camera: 'chase',
    sunset: true,
    time: 19.4,
    banner: null,
  };
}

export function stageShot(name) {
  switch (name) {
    case 'start':
      return stageStart();
    case 'lagoon':
      return stageLagoon();
    case 'approach':
      return stageApproach();
    case 'results':
      return stageResults();
    case 'cover':
    default:
      return stageCover();
  }
}
