// Kestrel Courier — configuration for the Solmar Sky Run.
// One file, one job: every tunable number for the flight model, the course,
// the scoring and the look of the game lives here, so the rest of the code
// reads like the game it describes.

export const GAME = {
  title: 'Kestrel Courier',
  subtitle: 'Solmar Sky Run',
  pilot: 'Kestrel-7',
  width: 1280,
  height: 720,
};

// Flight model (speeds in knots, distances in metres, 1 knot = 0.514 m/s).
export const FLIGHT = {
  minSpeed: 0,
  maxSpeed: 195,
  cruiseSpeed: 132,
  stallSpeed: 58,
  rotateSpeed: 72,
  takeoffSpeed: 78,
  maxRollDeg: 62,
  maxPitchUpDeg: 24,
  maxPitchDownDeg: -14,
  rollRate: 95, // degrees per second towards the commanded bank
  pitchRate: 42,
  turnAuthority: 0.52, // how hard a bank turns the nose
  climbFactor: 0.9,
  gravitySink: 26, // m/s of sink when stalled
  groundFriction: 14,
  fuelCapacity: 100,
  fuelBurnPerSec: 0.055, // at full throttle; 100 fuel is ~30 min of flying
  missionTimeLimitSec: 420, // seven minutes for the whole run
};

// The ring course: eight glowing gates looped around the archipelago, then
// the runway. Each ring is { x, z, y, radius } in world metres.
export const RINGS = [
  { x: 620, z: -160, y: 185, radius: 30 },
  { x: 1120, z: -720, y: 235, radius: 30 },
  { x: 320, z: -1420, y: 265, radius: 30 },
  { x: -920, z: -1120, y: 245, radius: 30 },
  { x: -1520, z: -220, y: 205, radius: 30 },
  { x: -1120, z: 920, y: 225, radius: 30 },
  { x: -40, z: 1420, y: 205, radius: 30 },
  { x: 920, z: 920, y: 185, radius: 30 },
];

// Solmar Field: the home runway on the main island. Heading east (+x).
export const RUNWAY = {
  x: 0,
  z: 0,
  elevation: 18,
  length: 720,
  width: 56,
  headingDeg: 90, // east
  name: 'SOLMAR FIELD 09',
};

// Scoring.
export const SCORE = {
  ring: 250,
  ringComboBonus: 50, // extra per consecutive ring without a miss
  landingBase: 500,
  landingSmoothBonus: 500, // scaled by how gentle the touchdown was
  timeBonusPerSec: 4, // unused seconds under the limit, on a landing
  crashPenalty: 0,
};

// Look: one warm late-afternoon palette for sky, sea and land.
export const PALETTE = {
  skyTop: '#2f6fb8',
  skyMid: '#7fb2dd',
  skyLow: '#f6c98a',
  sunsetTop: '#3a4a8f',
  sunsetMid: '#e08a5a',
  sunsetLow: '#ffc46b',
  seaDeep: '#0e5f7a',
  seaShallow: '#2fb3a3',
  seaGlint: '#bfeee6',
  sand: '#e8d29a',
  grass: '#5d9a4a',
  forest: '#2f6b34',
  rock: '#8a7a68',
  snow: '#eef2f5',
  runway: '#3c4148',
  runwayMark: '#f2f0d8',
  ring: '#ffd23e',
  ringGlow: '#ff9d2e',
  hudAmber: '#ffb347',
  hudCyan: '#7fe7ff',
  hudGreen: '#8dff6e',
  hudRed: '#ff5a4e',
  panel: 'rgba(10, 18, 30, 0.82)',
};

// Keyboard + mouse mapping (also shown on the briefing screen).
export const CONTROLS = {
  throttleUp: ['KeyW', 'ShiftLeft'],
  throttleDown: ['KeyS', 'ControlLeft'],
  rollLeft: ['KeyA', 'ArrowLeft'],
  rollRight: ['KeyD', 'ArrowRight'],
  pitchUp: ['ArrowDown'],
  pitchDown: ['ArrowUp'],
  gear: ['KeyG'],
  flaps: ['KeyF'],
  brake: ['Space'],
  camera: ['KeyC'],
  pause: ['KeyP'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  start: ['Enter'],
};
