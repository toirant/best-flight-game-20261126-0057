// Kestrel Courier — the world: Solmar archipelago terrain, runway, clouds.
// The terrain is an analytic heightfield: a handful of hand-placed volcanic
// islands (gaussian bumps) plus two octaves of value noise for ridges and
// bays, with the home runway flattened into the main island. Nothing here
// reads a file; the same seed draws the same islands every time.

// Islands: { x, z, radius, peak }. The main island holds Solmar Field.
export const ISLANDS = [
  { x: 300, z: 800, radius: 1000, peak: 210 }, // main island; the runway sits on its northern shore
  { x: -1450, z: -950, radius: 720, peak: 185 },
  { x: 1350, z: -1150, radius: 660, peak: 155 },
  { x: -950, z: 1350, radius: 620, peak: 205 },
  { x: 1550, z: 1250, radius: 760, peak: 175 },
  { x: 420, z: -1750, radius: 520, peak: 125 },
  { x: -1850, z: 320, radius: 460, peak: 145 },
  { x: 2250, z: 120, radius: 520, peak: 115 },
  { x: -2400, z: -1400, radius: 560, peak: 165 },
  { x: 2400, z: -1500, radius: 480, peak: 135 },
];

import { RUNWAY } from './config.js';
import { clamp, distToSegment, fbm2, lerp, mulberry32 } from './random.js';

const NOISE_SEED = 20261126;

// Height of the ground in metres at world (x, z). Sea level is 0.
export function terrainHeight(x, z) {
  let h = 0;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d2 = (dx * dx + dz * dz) / (island.radius * island.radius);
    if (d2 < 4) h += island.peak * Math.exp(-d2 * 2.2);
  }
  // Rolling detail: ridges on land, gentle swell offshore (clamped below).
  const detail = fbm2(x * 0.0016, z * 0.0016, NOISE_SEED) * 26;
  h += detail * clamp(h / 60, 0, 1);
  h = Math.max(h, -4);
  return flattenRunway(x, z, h);
}

// The runway sits on a flattened shelf so landings are fair: blend the
// natural height towards the runway elevation inside the strip corridor.
export function flattenRunway(x, z, h) {
  const halfLen = RUNWAY.length / 2 + 90;
  const halfWid = RUNWAY.width / 2 + 110;
  const ax = RUNWAY.x - halfLen;
  const az = RUNWAY.z;
  const bx = RUNWAY.x + halfLen;
  const bz = RUNWAY.z;
  const d = distToSegment(x, z, ax, az, bx, bz);
  const along = clamp(((x - RUNWAY.x) / halfLen) * 0.5 + 0.5, 0, 1);
  const edge = clamp(1 - d / halfWid, 0, 1);
  const w = edge * edge * (3 - 2 * edge) * (0.35 + 0.65 * Math.sin(along * Math.PI) ** 0.5);
  return lerp(h, RUNWAY.elevation, clamp(w, 0, 1));
}

// True when the point is over open water (below sea level).
export function isWater(x, z) {
  return terrainHeight(x, z) < 1;
}

// Is the point inside the runway strip (for landing checks)?
export function onRunwayStrip(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2
  );
}

// Ground colour for a terrain sample: sand at the waterline, grass, forest,
// rock and snow by height, darkened on steep slopes.
export function terrainColor(x, z, h, slope) {
  const n = fbm2(x * 0.004, z * 0.004, NOISE_SEED + 3) * 0.5 + 0.5;
  let r;
  let g;
  let b;
  if (h < 3) {
    r = 232; g = 210; b = 154; // pale sand beach
  } else if (h < 7) {
    r = 214; g = 186; b = 128; // wet sand
  } else if (h < 70) {
    r = 93 + n * 22; g = 154 + n * 18; b = 74 + n * 12; // meadow grass
  } else if (h < 150) {
    r = 47 + n * 16; g = 107 + n * 14; b = 52 + n * 10; // forest
  } else if (h < 205) {
    r = 138; g = 122; b = 104; // bare rock
  } else {
    r = 238; g = 242; b = 245; // snow on the peaks
  }
  // Slope shading: steep ground reads darker, flat ground stays bright.
  const shade = clamp(1 - slope * 0.9, 0.55, 1.05);
  // A little mottling so big flat areas do not look painted.
  const mottle = 0.94 + n * 0.1;
  return `rgb(${Math.round(r * shade * mottle)},${Math.round(g * shade * mottle)},${Math.round(
    b * shade * mottle,
  )})`;
}

// Clouds: fixed puffs drifting slowly east, drawn as soft billboards.
export function makeClouds(count = 46) {
  const rand = mulberry32(777);
  const clouds = [];
  for (let i = 0; i < count; i++) {
    clouds.push({
      x: (rand() - 0.5) * 7000,
      z: (rand() - 0.5) * 7000,
      y: 330 + rand() * 260,
      size: 90 + rand() * 190,
      alpha: 0.5 + rand() * 0.4,
      speed: 3 + rand() * 4,
    });
  }
  return clouds;
}

export function driftClouds(clouds, dt) {
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > 3600) c.x = -3600;
  }
}
