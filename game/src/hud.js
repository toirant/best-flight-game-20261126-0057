// Kestrel Courier — HUD and screens.
// Every instrument is drawn on the canvas so the screenshots carry them:
// the compass tape and the altitude / speed / heading readouts the bounty
// asks for, a lit attitude indicator, throttle and fuel, the ring pips, and
// the title, briefing, pause and results screens.

import { GAME, PALETTE, RINGS, RUNWAY } from './config.js';
import { clamp, degToRad, radToDeg } from './random.js';
import { bearingError, nextObjective, readouts } from './flight.js';

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127, 231, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size, colour, align = 'center') {
  ctx.fillStyle = colour;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, colour, align = 'center') {
  ctx.fillStyle = colour;
  ctx.font = `${size}px "SF Mono", "Cascadia Mono", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// Compass tape across the top: the heading in degrees, the cardinal, and a
// marker showing where the next ring or the runway sits off the nose.
export function drawCompass(ctx, w, plane) {
  const r = readouts(plane);
  const tapeW = 460;
  const tapeH = 34;
  const x0 = w / 2 - tapeW / 2;
  panel(ctx, x0, 10, tapeW, tapeH, 8);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, 10, tapeW, tapeH, 8);
  ctx.clip();
  const pxPerDeg = tapeW / 120;
  const centre = r.headingDeg;
  for (let d = -60; d <= 60; d += 5) {
    let deg = Math.round((centre + d) / 5) * 5;
    const norm = ((deg % 360) + 360) % 360;
    const x = w / 2 + (deg - centre) * pxPerDeg;
    const major = norm % 30 === 0;
    ctx.strokeStyle = major ? PALETTE.hudCyan : 'rgba(127,231,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, major ? 26 : 20);
    ctx.stroke();
    if (major) {
      const card = { 0: 'N', 30: '030', 60: '060', 90: 'E', 120: '120', 150: '150', 180: 'S', 210: '210', 240: '240', 270: 'W', 300: '300', 330: '330' }[norm];
      label(ctx, card ?? String(norm).padStart(3, '0'), x, 35, 10, PALETTE.hudCyan);
    }
  }
  ctx.restore();
  // Centre caret + the big heading readout.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 10);
  ctx.lineTo(w / 2 + 7, 10);
  ctx.lineTo(w / 2, 20);
  ctx.closePath();
  ctx.fill();
  panel(ctx, w / 2 - 46, 48, 92, 30, 7);
  value(ctx, `${String(r.headingDeg).padStart(3, '0')}° ${r.headingCard}`, w / 2, 63, 16, PALETTE.hudAmber);
  // Objective marker on the tape.
  const err = bearingError(plane);
  if (Math.abs(err) < 60) {
    const mx = w / 2 + err * (tapeW / 120);
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(mx, 12);
    ctx.lineTo(mx - 6, 2);
    ctx.lineTo(mx + 6, 2);
    ctx.closePath();
    ctx.fill();
  }
}

// Left tape: airspeed. Right tape: altitude. Both with a digital readout.
export function drawSideTapes(ctx, w, h, plane) {
  const r = readouts(plane);
  // Airspeed, left.
  panel(ctx, 14, h / 2 - 110, 92, 220, 8);
  label(ctx, 'AIRSPEED', 60, h / 2 - 96, 10, PALETTE.hudCyan);
  value(ctx, `${r.speedKts}`, 60, h / 2 - 62, 30, '#ffffff');
  label(ctx, 'KTS', 60, h / 2 - 38, 11, PALETTE.hudCyan);
  const speedFrac = clamp(r.speedKts / 200, 0, 1);
  ctx.fillStyle = 'rgba(127,231,255,0.25)';
  ctx.fillRect(28, h / 2 - 20, 64, 8);
  ctx.fillStyle = r.speedKts < 58 && plane.airborne ? PALETTE.hudRed : PALETTE.hudCyan;
  ctx.fillRect(28, h / 2 - 20, 64 * speedFrac, 8);
  label(ctx, 'STALL 58', 60, h / 2 + 8, 10, r.speedKts < 58 && plane.airborne ? PALETTE.hudRed : 'rgba(255,255,255,0.55)');
  label(ctx, `V/S ${r.verticalSpeedFpm >= 0 ? '+' : ''}${r.verticalSpeedFpm}`, 60, h / 2 + 30, 11, '#ffffff');
  label(ctx, 'FT/MIN', 60, h / 2 + 48, 10, PALETTE.hudCyan);
  // Altitude, right.
  panel(ctx, w - 106, h / 2 - 110, 92, 220, 8);
  label(ctx, 'ALTITUDE', w - 60, h / 2 - 96, 10, PALETTE.hudCyan);
  value(ctx, `${r.altitudeFt}`, w - 60, h / 2 - 62, 30, '#ffffff');
  label(ctx, 'FT', w - 60, h / 2 - 38, 11, PALETTE.hudCyan);
  const altFrac = clamp(r.altitudeFt / 1200, 0, 1);
  ctx.fillStyle = 'rgba(127,231,255,0.25)';
  ctx.fillRect(w - 92, h / 2 - 20, 64, 8);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fillRect(w - 92, h / 2 - 20, 64 * altFrac, 8);
  label(ctx, `AGL ${r.altitudeM} M`, w - 60, h / 2 + 8, 11, '#ffffff');
  const obj = nextObjective(plane);
  label(ctx, obj.kind === 'ring' ? `RING ${obj.index} ${obj.distance} M` : `RWY ${obj.distance} M`, w - 60, h / 2 + 30, 11, PALETTE.ring);
  label(ctx, 'NEXT', w - 60, h / 2 + 48, 10, PALETTE.hudCyan);
}

// Attitude indicator: a lit ball that rolls and pitches with the plane,
// with a fixed aircraft symbol in the middle.
export function drawAttitude(ctx, w, h, plane) {
  const cx = 118;
  const cy = h - 118;
  const r = 52;
  ctx.save();
  panel(ctx, cx - 66, cy - 66, 132, 132, 12);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * 120;
  // Sky half / ground half.
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r - 2, -r - 2 + pitchPx, r * 2 + 4, r + 2 - pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r - 2, pitchPx, r * 2 + 4, r + 2 - pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  for (const off of [-24, 24]) {
    ctx.beginPath();
    ctx.moveTo(-18, pitchPx + off);
    ctx.lineTo(18, pitchPx + off);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  // Fixed wings symbol.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fill();
  ctx.restore();
  label(ctx, 'ATTITUDE', cx, cy + 78, 10, PALETTE.hudCyan);
}

// Bottom-right cluster: throttle lever, fuel gauge, gear / flaps lamps.
export function drawEnginePanel(ctx, w, h, plane) {
  const x = w - 210;
  const y = h - 150;
  panel(ctx, x, y, 196, 136, 10);
  label(ctx, 'THROTTLE', x + 34, y + 16, 10, PALETTE.hudCyan);
  // Throttle slot.
  ctx.fillStyle = 'rgba(127,231,255,0.25)';
  ctx.fillRect(x + 28, y + 30, 10, 84);
  ctx.fillStyle = PALETTE.hudAmber;
  const thY = y + 30 + 84 * (1 - plane.throttle);
  ctx.fillRect(x + 22, thY - 5, 22, 10);
  value(ctx, `${Math.round(plane.throttle * 100)}%`, x + 34, y + 126, 12, '#ffffff');
  // Fuel.
  label(ctx, 'FUEL', x + 104, y + 16, 10, PALETTE.hudCyan);
  const fuelFrac = plane.fuel / 100;
  ctx.fillStyle = 'rgba(127,231,255,0.25)';
  ctx.fillRect(x + 74, y + 30, 60, 12);
  ctx.fillStyle = fuelFrac < 0.15 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillRect(x + 74, y + 30, 60 * fuelFrac, 12);
  value(ctx, `${Math.round(plane.fuel)}%`, x + 104, y + 56, 13, '#ffffff');
  // Gear and flaps lamps.
  lamp(ctx, x + 84, y + 82, plane.gearDown, 'GEAR');
  lamp(ctx, x + 150, y + 82, plane.flaps, 'FLAPS');
  label(ctx, plane.airborne ? 'AIRBORNE' : 'ON GROUND', x + 118, y + 112, 10, plane.airborne ? PALETTE.hudGreen : PALETTE.hudAmber);
}

function lamp(ctx, x, y, on, text) {
  ctx.fillStyle = on ? PALETTE.hudGreen : 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, text, x, y + 20, 9, on ? PALETTE.hudGreen : 'rgba(255,255,255,0.5)');
}

// Ring progress pips and the score / timer line at the top corners.
export function drawMissionBar(ctx, w, plane) {
  panel(ctx, 14, 10, 250, 62, 8);
  label(ctx, 'SCORE', 34, 26, 10, PALETTE.hudCyan, 'left');
  value(ctx, String(plane.score), 34, 48, 22, '#ffffff', 'left');
  const mm = Math.floor(plane.timeLeft / 60);
  const ss = String(Math.floor(plane.timeLeft % 60)).padStart(2, '0');
  label(ctx, 'TIME', 190, 26, 10, PALETTE.hudCyan, 'left');
  value(ctx, `${mm}:${ss}`, 190, 48, 22, plane.timeLeft < 60 ? PALETTE.hudRed : '#ffffff', 'left');
  // Ring pips, top right under the compass.
  const total = RINGS.length;
  const pipW = 22;
  const startX = w - 14 - total * (pipW + 6);
  for (let i = 0; i < total; i++) {
    const x = startX + i * (pipW + 6);
    const done = i < plane.nextRing;
    const next = i === plane.nextRing;
    ctx.fillStyle = done ? PALETTE.hudGreen : next ? PALETTE.ring : 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.roundRect(x, 92, pipW, 16, 5);
    ctx.fill();
    label(ctx, String(i + 1), x + pipW / 2, 100, 10, '#0a1220');
  }
  label(ctx, plane.nextRing >= total ? 'ALL RINGS FLOWN — LAND ON 09' : `RING ${plane.nextRing + 1} OF ${total}`, w - 14, 126, 11, PALETTE.ring, 'right');
}

// Centre banner for transient messages (ring flown, stall, low fuel).
export function drawBanner(ctx, w, h, text, subtext, colour) {
  if (!text) return;
  const bw = Math.max(420, text.length * 16);
  panel(ctx, w / 2 - bw / 2, h * 0.3, bw, subtext ? 74 : 52, 10);
  label(ctx, text, w / 2, h * 0.3 + (subtext ? 24 : 26), 24, colour ?? PALETTE.hudAmber);
  if (subtext) label(ctx, subtext, w / 2, h * 0.3 + 54, 14, '#ffffff');
}

// Title screen: the game name over the sunset sky, with the mission brief.
export function drawTitle(ctx, w, h, plane) {
  ctx.fillStyle = 'rgba(8, 14, 28, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('KESTREL COURIER', w / 2, 168);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('— SOLMAR SKY RUN —', w / 2, 206);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Fly the mail run across the Solmar archipelago:', w / 2, 268);
  ctx.fillText('thread all 8 glowing rings, then bring Kestrel-7 home', w / 2, 296);
  ctx.fillText('and land her on runway 09 at Solmar Field.', w / 2, 324);
  panel(ctx, w / 2 - 330, 356, 660, 128, 12);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('MOUSE steers  •  W / S throttle  •  A / D or ← → bank  •  ↑ ↓ pitch', w / 2, 384);
  ctx.fillText('G gear  •  F flaps  •  SPACE brake  •  C cockpit view  •  P pause  •  M mute', w / 2, 414);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px sans-serif';
  ctx.fillText('Too slow and she stalls. Too low and the islands bite.', w / 2, 448);
  ctx.fillText('Seven minutes on the clock — smooth flying pays.', w / 2, 470);
  const pulse = 0.7 + Math.sin(Date.now() / 350) * 0.3;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.ring;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY', w / 2, 548);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game — no network, no libraries, all art and sound made in code.', w / 2, h - 24);
}

// Results screen after a landing or a crash.
export function drawResults(ctx, w, h, plane) {
  ctx.fillStyle = 'rgba(8, 14, 28, 0.6)';
  ctx.fillRect(0, 0, w, h);
  const won = plane.landed;
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.hudGreen : PALETTE.hudRed;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText(won ? 'MAIL DELIVERED' : 'RUN OVER', w / 2, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(
    won
      ? `Kestrel-7 is down safe on runway 09 — the islands have their mail.`
      : plane.crashReason || 'The run ended early.',
    w / 2,
    212,
  );
  panel(ctx, w / 2 - 260, 250, 520, 210, 12);
  const r = [
    ['RINGS FLOWN', `${plane.ringsFlown} / ${RINGS.length}`],
    ['FINAL SCORE', String(plane.score)],
    ['MISSION TIME', `${Math.floor(plane.missionTime / 60)}:${String(Math.floor(plane.missionTime % 60)).padStart(2, '0')}`],
    ['LANDING', won ? `${Math.round(plane.touchdownQuality * 100)}% smooth` : '—'],
    ['FUEL LEFT', `${Math.round(plane.fuel)}%`],
  ];
  r.forEach(([k, v], i) => {
    label(ctx, k, w / 2 - 230, 282 + i * 34, 14, PALETTE.hudCyan, 'left');
    value(ctx, v, w / 2 + 230, 282 + i * 34, 18, '#ffffff', 'right');
  });
  ctx.fillStyle = PALETTE.ring;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', w / 2, 512);
}

// Pause overlay.
export function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 28, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '18px sans-serif';
  ctx.fillText('P to resume  •  R to restart  •  M to mute', w / 2, h / 2 + 32);
}

export { RUNWAY };
