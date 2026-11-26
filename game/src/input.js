// Kestrel Courier — input: keyboard and mouse.
// The mouse steers: where the pointer sits relative to the centre of the
// screen commands bank and pitch, so the game flies with one hand. The
// keyboard covers everything the mouse does, plus throttle, gear, flaps,
// brake, camera, pause, mute and restart. Keys are tracked as a held set so
// the main loop can read them every frame.

import { CONTROLS } from './config.js';

export function createInputState() {
  return {
    keys: new Set(),
    mouseX: 0, // -1 (left) .. 1 (right) relative to screen centre
    mouseY: 0, // -1 (top) .. 1 (bottom)
    mouseActive: false,
    mouseDown: false,
    pressed: new Set(), // keys pressed since the last frame was consumed
  };
}

export function attachInput(state, canvas, onFirstGesture) {
  let gestured = false;
  const gesture = () => {
    if (!gestured) {
      gestured = true;
      onFirstGesture();
    }
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) state.pressed.add(e.code);
    state.keys.add(e.code);
    gesture();
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.code));
  window.addEventListener('blur', () => state.keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    state.mouseActive = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    state.mouseDown = true;
    gesture();
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    state.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Keys pressed since the last call, then cleared. Edge-triggered actions
// (pause, gear, camera, restart) read this; held movement reads keys.
export function consumePressed(state) {
  const pressed = new Set(state.pressed);
  state.pressed.clear();
  return pressed;
}

function held(state, codes) {
  return codes.some((c) => state.keys.has(c));
}

// Build the flight input for this frame from keys + mouse.
export function readFlightInput(state) {
  const input = { roll: 0, pitch: 0, throttle: null, brake: false };
  if (held(state, CONTROLS.rollLeft)) input.roll -= 1;
  if (held(state, CONTROLS.rollRight)) input.roll += 1;
  if (held(state, CONTROLS.pitchUp)) input.pitch += 1;
  if (held(state, CONTROLS.pitchDown)) input.pitch -= 1;
  // Mouse steering: gentle near the centre, full at the edges, with a dead
  // zone so the plane flies straight hands-off.
  if (state.mouseActive) {
    const dead = 0.08;
    const mx = Math.abs(state.mouseX) < dead ? 0 : state.mouseX;
    const my = Math.abs(state.mouseY) < dead ? 0 : state.mouseY;
    if (mx !== 0) input.roll = Math.max(-1, Math.min(1, mx * 1.4));
    if (my !== 0) input.pitch = Math.max(-1, Math.min(1, -my * 1.2));
  }
  if (held(state, CONTROLS.throttleUp)) input.throttle = 1;
  if (held(state, CONTROLS.throttleDown)) input.throttle = 0;
  if (held(state, CONTROLS.brake)) input.brake = true;
  return input;
}

// Throttle keys nudge the lever in steps while held (W/S handled as a
// continuous lever in main.js); this helper reports the nudge direction.
export function throttleNudge(state, dt) {
  let nudge = 0;
  if (held(state, CONTROLS.throttleUp)) nudge += dt * 0.55;
  if (held(state, CONTROLS.throttleDown)) nudge -= dt * 0.55;
  return nudge;
}

export { CONTROLS };
