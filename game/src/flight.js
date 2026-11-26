// Kestrel Courier — flight model and mission state.
// Pure logic, no canvas and no DOM, so the physics can be driven headless:
// create a plane, step it, and read back altitude, speed, heading, rings
// flown and whether the run ended in a landing, a splash or a crash.

import { FLIGHT, RINGS, RUNWAY, SCORE } from './config.js';
import { clamp, degToRad, lerp, radToDeg, wrapAngle } from './random.js';
import { isWater, onRunwayStrip, terrainHeight } from './world.js';

export const KNOT_TO_MS = 0.514444;

// A fresh run: parked at the west end of Solmar Field, nose east, engine off.
export function createPlane() {
  return {
    x: RUNWAY.x - RUNWAY.length / 2 + 40,
    y: RUNWAY.elevation + 2,
    z: RUNWAY.z,
    heading: degToRad(RUNWAY.headingDeg), // 0 = north, 90 deg = east
    pitch: 0, // radians, nose up positive
    roll: 0, // radians, right wing down positive
    speed: 0, // knots
    throttle: 0,
    gearDown: true,
    flaps: false,
    fuel: FLIGHT.fuelCapacity,
    airborne: false,
    crashed: false,
    landed: false,
    crashReason: '',
    verticalSpeed: 0, // m/s, positive climbing
    groundSpeed: 0,
    ringsFlown: 0,
    nextRing: 0,
    combo: 0,
    score: 0,
    missionTime: 0,
    timeLeft: FLIGHT.missionTimeLimitSec,
    touchdownQuality: 0, // 0..1, set on a good landing
    messages: [],
  };
}

// Pilot inputs for one step: roll/pitch in [-1, 1], throttle in [0, 1].
export function createInput() {
  return { roll: 0, pitch: 0, throttle: null, brake: false };
}

// One physics step. Returns an array of events: 'ring', 'landed', 'crashed',
// 'stall', 'lowfuel', 'timeout', 'takeoff'.
export function stepFlight(plane, input, dt) {
  const events = [];
  if (plane.crashed || plane.landed) return events;
  dt = Math.min(dt, 0.05);
  plane.missionTime += dt;
  plane.timeLeft = Math.max(0, FLIGHT.missionTimeLimitSec - plane.missionTime);

  // Throttle: the pilot's lever, eased towards its target.
  if (input.throttle !== null) plane.throttle = clamp(input.throttle, 0, 1);
  const targetSpeed = plane.throttle * FLIGHT.maxSpeed;
  const accel = plane.airborne ? 9 : 16; // knots per second
  if (plane.speed < targetSpeed) {
    plane.speed = Math.min(targetSpeed, plane.speed + accel * dt);
  } else {
    plane.speed = Math.max(targetSpeed, plane.speed - 14 * dt);
  }
  if (input.brake && !plane.airborne) {
    plane.speed = Math.max(0, plane.speed - 60 * dt);
  }

  // Bank and pitch ease towards the commanded attitude.
  const targetRoll = input.roll * degToRad(FLIGHT.maxRollDeg);
  const targetPitch = input.pitch * degToRad(
    input.pitch > 0 ? FLIGHT.maxPitchUpDeg : -FLIGHT.maxPitchDownDeg,
  );
  const rollRate = degToRad(FLIGHT.rollRate) * dt;
  const pitchRate = degToRad(FLIGHT.pitchRate) * dt;
  plane.roll += clamp(targetRoll - plane.roll, -rollRate, rollRate);
  plane.pitch += clamp(targetPitch - plane.pitch, -pitchRate, pitchRate);

  // A banked wing turns the nose: heading follows the roll.
  const turnRate =
    -Math.tan(plane.roll) * FLIGHT.turnAuthority * (plane.speed / 120);
  plane.heading = wrapAngle(plane.heading + turnRate * dt);

  // Fuel burns with the throttle; an empty tank means gliding home.
  plane.fuel = Math.max(0, plane.fuel - FLIGHT.fuelBurnPerSec * (0.25 + plane.throttle) * dt);
  if (plane.fuel <= 0 && plane.throttle > 0) plane.throttle = 0;
  if (plane.fuel < 15 && plane.fuel > 0 && !plane.messages.includes('LOW FUEL')) {
    plane.messages.push('LOW FUEL');
    events.push('lowfuel');
  }

  const ground = terrainHeight(plane.x, plane.z);
  const speedMs = plane.speed * KNOT_TO_MS;

  if (!plane.airborne) {
    // Rolling on the runway (or the grass beside it). Pitch is left alone:
    // the pilot can hold the nose up for rotation, and the ground branch
    // below must not undo the pitch the easing just built.
    plane.y = ground + 2;
    if (plane.speed >= FLIGHT.rotateSpeed && input.pitch > 0.25) {
      plane.airborne = true;
      events.push('takeoff');
    }
  }
  if (plane.airborne) {
    // In the air: climb from pitch, sink from gravity, stall below the
    // stall speed — the nose drops and the ground comes up fast.
    const stalled = plane.speed < FLIGHT.stallSpeed;
    let climb = speedMs * Math.sin(plane.pitch) * FLIGHT.climbFactor;
    if (stalled) {
      climb -= FLIGHT.gravitySink * (1 - plane.speed / FLIGHT.stallSpeed);
      plane.pitch = Math.max(plane.pitch - degToRad(30) * dt, degToRad(-12));
      if (!plane.messages.includes('STALL')) {
        plane.messages.push('STALL');
        events.push('stall');
      }
    } else {
      plane.messages = plane.messages.filter((m) => m !== 'STALL');
    }
    if (plane.flaps) climb *= 0.92;
    plane.verticalSpeed = climb;
    plane.y += climb * dt;
    plane.x += Math.sin(plane.heading) * Math.cos(plane.pitch) * speedMs * dt;
    plane.z -= Math.cos(plane.heading) * Math.cos(plane.pitch) * speedMs * dt;
  } else {
    // Still rolling: move along the runway heading.
    plane.x += Math.sin(plane.heading) * speedMs * dt;
    plane.z -= Math.cos(plane.heading) * speedMs * dt;
  }
  plane.groundSpeed = speedMs;

  // Rings: fly through the glowing hoop and it counts.
  if (plane.nextRing < RINGS.length) {
    const ring = RINGS[plane.nextRing];
    const d = Math.hypot(plane.x - ring.x, plane.y - ring.y, plane.z - ring.z);
    if (d < ring.radius && plane.airborne) {
      plane.ringsFlown += 1;
      plane.nextRing += 1;
      plane.combo += 1;
      plane.score += SCORE.ring + SCORE.ringComboBonus * (plane.combo - 1);
      events.push('ring');
    }
  }

  // The ground: landing, ditching, or a crash. The step the plane rotates
  // is exempt: it is still at gear height and climbing away from the strip.
  const clearance = plane.y - ground;
  if (plane.airborne && clearance <= 2 && !events.includes('takeoff')) {
    const aligned =
      Math.abs(wrapAngle(plane.heading - degToRad(RUNWAY.headingDeg))) < degToRad(25) ||
      Math.abs(wrapAngle(plane.heading - degToRad(RUNWAY.headingDeg + 180))) < degToRad(25);
    const gentle = plane.verticalSpeed > -7 && plane.speed < 120;
    const onStrip = onRunwayStrip(plane.x, plane.z);
    if (onStrip && gentle && aligned && plane.gearDown) {
      // A gentle runway touchdown: the run is complete only once every ring
      // is flown, otherwise it is a touch-and-go and the plane keeps rolling.
      plane.airborne = false;
      plane.y = ground + 2;
      if (plane.nextRing >= RINGS.length) {
        plane.landed = true;
        plane.touchdownQuality = clamp(1 - Math.abs(plane.verticalSpeed) / 6, 0.2, 1);
        const timeBonus = Math.round(plane.timeLeft * SCORE.timeBonusPerSec);
        plane.score +=
          SCORE.landingBase + Math.round(SCORE.landingSmoothBonus * plane.touchdownQuality) + timeBonus;
        events.push('landed');
      }
    } else if (onStrip && !plane.gearDown && gentle && plane.speed < 95) {
      crash(plane, 'Belly landing — gear was up', events);
    } else if (isWater(plane.x, plane.z)) {
      crash(plane, 'Ditched in the lagoon', events);
    } else if (plane.speed < 40 && Math.abs(plane.verticalSpeed) < 8) {
      // A slow, gentle arrival on grass: a rough field landing, not a crash.
      plane.airborne = false;
      plane.y = ground + 2;
      crash(plane, 'Forced landing in the bush — the run is over', events);
    } else {
      crash(plane, 'Crashed into the terrain', events);
    }
  }

  // Running off the island into the sea while taxiing.
  if (!plane.airborne && isWater(plane.x, plane.z) && plane.speed > 5) {
    crash(plane, 'Rolled off the runway into the sea', events);
  }

  if (plane.timeLeft <= 0 && !plane.landed) {
    crash(plane, 'Out of time — the mail goes back', events);
    events.push('timeout');
  }
  return events;
}

function crash(plane, reason, events) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.speed = 0;
  events.push('crashed');
}

// Readouts for the HUD, in the units a pilot reads.
export function readouts(plane) {
  const headingDeg = (radToDeg(plane.heading) + 360) % 360;
  return {
    altitudeFt: Math.round((plane.y - RUNWAY.elevation) * 3.28084),
    altitudeM: Math.round(plane.y - RUNWAY.elevation),
    speedKts: Math.round(plane.speed),
    headingDeg: Math.round(headingDeg),
    headingCard: compassCard(headingDeg),
    verticalSpeedFpm: Math.round(plane.verticalSpeed * 196.85),
    fuelPct: Math.round((plane.fuel / FLIGHT.fuelCapacity) * 100),
    ringsLeft: RINGS.length - plane.nextRing,
    timeLeft: Math.ceil(plane.timeLeft),
  };
}

export function compassCard(deg) {
  const cards = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return cards[Math.round(deg / 45) % 8];
}

// Distance and bearing from the plane to the next objective (ring or runway).
export function nextObjective(plane) {
  if (plane.nextRing < RINGS.length) {
    const ring = RINGS[plane.nextRing];
    const dx = ring.x - plane.x;
    const dz = ring.z - plane.z;
    const dist = Math.hypot(dx, plane.y - ring.y, dz);
    const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
    return { kind: 'ring', index: plane.nextRing + 1, distance: Math.round(dist), bearing, y: ring.y };
  }
  const dx = RUNWAY.x - plane.x;
  const dz = RUNWAY.z - plane.z;
  const dist = Math.hypot(dx, dz);
  const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return { kind: 'runway', index: 0, distance: Math.round(dist), bearing, y: RUNWAY.elevation };
}

// How far the next objective sits off the nose, in degrees (-180..180).
export function bearingError(plane) {
  const obj = nextObjective(plane);
  const headingDeg = (radToDeg(plane.heading) + 360) % 360;
  let err = obj.bearing - headingDeg;
  while (err > 180) err -= 360;
  while (err < -180) err += 360;
  return err;
}

export { lerp };
