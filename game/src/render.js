// Kestrel Courier — renderer: sky, sea, terrain, runway, rings, clouds and
// the aircraft itself, all drawn on one 2D canvas with a small 3D projector.
// The chase camera sits behind and above the plane and looks along its nose,
// so the screenshots read as a flight game at a glance: plane in frame,
// terrain below, a glowing ring or the runway ahead.

import { GAME, PALETTE, RINGS, RUNWAY } from './config.js';
import { clamp, degToRad, lerp } from './random.js';
import { terrainColor, terrainHeight } from './world.js';

const FOCAL = 760; // projection focal length in pixels
const NEAR = 6;

// Camera basis from the plane: chase position behind the nose, looking ahead.
export function makeCamera(plane, mode) {
  const heading = plane.heading;
  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  const pitch = plane.pitch;
  if (mode === 'cockpit') {
    // Inside the cockpit: the camera is the pilot's eyes, the nose is the view.
    return {
      px: plane.x,
      py: plane.y + 1.6,
      pz: plane.z,
      fx,
      fy: Math.sin(pitch),
      fz: fz * Math.cos(pitch),
      roll: plane.roll,
    };
  }
  const back = 13;
  const up = 4.2;
  return {
    px: plane.x - fx * back * Math.cos(pitch),
    py: plane.y + up - Math.sin(pitch) * back,
    pz: plane.z - fz * back * Math.cos(pitch),
    fx,
    fy: Math.sin(pitch) * 0.55,
    fz: fz * Math.cos(pitch),
    roll: plane.roll * 0.55,
  };
}

// Project a world point into screen space. Returns null behind the camera.
function project(cam, x, y, z, w, h) {
  const dx = x - cam.px;
  const dy = y - cam.py;
  const dz = z - cam.pz;
  // Camera basis: forward (f), right (r), up (u), rolled by cam.roll.
  const fl = Math.hypot(cam.fx, cam.fy, cam.fz);
  const fx = cam.fx / fl;
  const fy = cam.fy / fl;
  const fz = cam.fz / fl;
  // World up rolled around the forward axis.
  const cosR = Math.cos(cam.roll);
  const sinR = Math.sin(cam.roll);
  // Right = forward x world-up, then rolled.
  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // Up = right x forward.
  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;
  // Roll the right/up pair around forward.
  const r2x = rx * cosR + ux * sinR;
  const r2y = ry * cosR + uy * sinR;
  const r2z = rz * cosR + uz * sinR;
  const u2x = ux * cosR - rx * sinR;
  const u2y = uy * cosR - ry * sinR;
  const u2z = uz * cosR - rz * sinR;
  const cz = dx * fx + dy * fy + dz * fz;
  if (cz < NEAR) return null;
  const cx = dx * r2x + dy * r2y + dz * r2z;
  const cy = dx * u2x + dy * u2y + dz * u2z;
  return {
    x: w / 2 + (cx / cz) * FOCAL,
    y: h / 2 - (cy / cz) * FOCAL,
    depth: cz,
  };
}

// Sky: a vertical gradient whose horizon line follows the camera pitch,
// plus a low sun and a soft haze band where the sky meets the sea.
export function drawSky(ctx, w, h, plane, cam, sunset) {
  const horizon = h / 2 - Math.tan(cam.fy) * FOCAL - plane.pitch * 300;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (sunset) {
    grad.addColorStop(0, PALETTE.sunsetTop);
    grad.addColorStop(0.55, PALETTE.sunsetMid);
    grad.addColorStop(0.75, PALETTE.sunsetLow);
    grad.addColorStop(1, '#5a3a52');
  } else {
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(0.78, PALETTE.skyLow);
    grad.addColorStop(1, '#cfe8ef');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun: a warm disc low in the west, with a glow.
  const sunX = w * 0.22;
  const sunY = clamp(horizon - 60, 60, h * 0.62);
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
  glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 200, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 200, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  return horizon;
}

// Sea: everything below the horizon that is not land. Painted as a gradient
// with a sun glint and a few drifting wave strokes.
export function drawSea(ctx, w, h, horizon, time) {
  if (horizon >= h) return;
  const grad = ctx.createLinearGradient(0, horizon, 0, h);
  grad.addColorStop(0, PALETTE.seaShallow);
  grad.addColorStop(0.4, '#1a7d92');
  grad.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, Math.max(0, horizon), w, h - Math.max(0, horizon));
  // Sun glint: a shimmering path under the sun.
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = PALETTE.seaGlint;
  const gx = w * 0.22;
  for (let i = 0; i < 9; i++) {
    const y = Math.max(0, horizon) + 12 + i * ((h - Math.max(0, horizon)) / 10);
    const ww = 26 + i * 9 + Math.sin(time * 2 + i) * 8;
    ctx.fillRect(gx - ww / 2, y, ww, 2.5);
  }
  ctx.restore();
}

// Terrain: a projected heightfield grid laid out ahead of the plane, drawn
// far to near so near quads paint over far ones. Colour comes from height
// and slope; distance fog melts the far edge into the haze.
export function drawTerrain(ctx, w, h, plane, cam, horizon) {
  const depthSteps = 42;
  const latSteps = 46;
  const maxDist = 1700;
  const halfWidth = 1050;
  // Sample points: rows ahead of the plane, columns across.
  const rows = [];
  for (let i = 0; i <= depthSteps; i++) {
    const t = i / depthSteps;
    const dist = 40 + (maxDist - 40) * t * t;
    const cx = plane.x + Math.sin(plane.heading) * dist;
    const cz = plane.z - Math.cos(plane.heading) * dist;
    const row = [];
    for (let j = 0; j <= latSteps; j++) {
      const s = (j / latSteps) * 2 - 1;
      const lat = s * halfWidth * (0.25 + 0.75 * t);
      const x = cx + Math.cos(plane.heading) * lat;
      const z = cz + Math.sin(plane.heading) * lat;
      const y = terrainHeight(x, z);
      row.push({ x, y, z, p: project(cam, x, y, z, w, h) });
    }
    rows.push(row);
  }
  // Far to near.
  for (let i = rows.length - 2; i >= 0; i--) {
    const far = rows[i + 1];
    const near = rows[i];
    const dist = 40 + (maxDist - 40) * (i / depthSteps) ** 2;
    const fog = clamp((dist - 500) / 1200, 0, 0.82);
    for (let j = 0; j < latSteps; j++) {
      const a = near[j];
      const b = near[j + 1];
      const c = far[j + 1];
      const d = far[j];
      if (!a.p || !b.p || !c.p || !d.p) continue;
      // Skip quads entirely below the sea: the sea fill already paints them.
      if (a.y < 0.5 && b.y < 0.5 && c.y < 0.5 && d.y < 0.5) continue;
      const slope = Math.abs(a.y - d.y) / 40 + Math.abs(a.y - b.y) / 40;
      const midH = (a.y + b.y + c.y + d.y) / 4;
      const midX = (a.x + b.x + c.x + d.x) / 4;
      const midZ = (a.z + b.z + c.z + d.z) / 4;
      let col = terrainColor(midX, midZ, midH, slope);
      if (fog > 0) col = mixFog(col, fog);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function mixFog(rgb, fog) {
  const m = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return rgb;
  const haze = [207, 226, 235];
  const r = Math.round(lerp(Number(m[1]), haze[0], fog));
  const g = Math.round(lerp(Number(m[2]), haze[1], fog));
  const b = Math.round(lerp(Number(m[3]), haze[2], fog));
  return `rgb(${r},${g},${b})`;
}

// Runway: the strip, centreline dashes, threshold bars and the "09" number,
// drawn as projected quads just above the flattened ground.
export function drawRunway(ctx, w, h, cam) {
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2;
  const corners = [
    [RUNWAY.x - halfL, RUNWAY.z - halfW],
    [RUNWAY.x + halfL, RUNWAY.z - halfW],
    [RUNWAY.x + halfL, RUNWAY.z + halfW],
    [RUNWAY.x - halfL, RUNWAY.z + halfW],
  ].map(([x, z]) => project(cam, x, RUNWAY.elevation + 0.6, z, w, h));
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = PALETTE.runwayMark;
  for (let x = RUNWAY.x - halfL + 30; x < RUNWAY.x + halfL - 20; x += 60) {
    const a = project(cam, x, RUNWAY.elevation + 0.8, RUNWAY.z - 1.6, w, h);
    const b = project(cam, x + 34, RUNWAY.elevation + 0.8, RUNWAY.z - 1.6, w, h);
    const c = project(cam, x + 34, RUNWAY.elevation + 0.8, RUNWAY.z + 1.6, w, h);
    const d = project(cam, x, RUNWAY.elevation + 0.8, RUNWAY.z + 1.6, w, h);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    const x0 = RUNWAY.x + end * (halfL - 26);
    for (let k = -2; k <= 2; k++) {
      const z0 = RUNWAY.z + k * 8 - 3;
      const a = project(cam, x0, RUNWAY.elevation + 0.8, z0, w, h);
      const b = project(cam, x0 + end * 16, RUNWAY.elevation + 0.8, z0, w, h);
      const c = project(cam, x0 + end * 16, RUNWAY.elevation + 0.8, z0 + 6, w, h);
      const d = project(cam, x0, RUNWAY.elevation + 0.8, z0 + 6, w, h);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Rings: glowing hoops standing in the sky. The next ring burns amber and
// pulses; flown rings are dim green; later rings are faint until their turn.
export function drawRings(ctx, w, h, cam, plane, time) {
  const sorted = RINGS.map((ring, i) => ({ ring, i })).sort((a, b) => {
    const da = Math.hypot(a.ring.x - cam.px, a.ring.y - cam.py, a.ring.z - cam.pz);
    const db = Math.hypot(b.ring.x - cam.px, b.ring.y - cam.py, b.ring.z - cam.pz);
    return db - da;
  });
  for (const { ring, i } of sorted) {
    const centre = project(cam, ring.x, ring.y, ring.z, w, h);
    if (!centre) continue;
    const top = project(cam, ring.x, ring.y + ring.radius, ring.z, w, h);
    if (!top) continue;
    // Radius on screen: project the top of the ring and measure.
    const screenR = Math.abs(centre.y - top.y);
    if (screenR < 2 || screenR > 900) continue;
    const isNext = i === plane.nextRing;
    const isDone = i < plane.nextRing;
    const pulse = isNext ? 1 + Math.sin(time * 5) * 0.12 : 1;
    const r = screenR * pulse;
    const colour = isDone ? PALETTE.hudGreen : isNext ? PALETTE.ring : '#9fc4e8';
    ctx.save();
    ctx.globalAlpha = isDone ? 0.45 : isNext ? 0.95 : 0.55;
    // Glow halo.
    ctx.strokeStyle = colour;
    ctx.lineWidth = isNext ? 10 : 5;
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = isDone ? 0.45 : isNext ? 0.95 : 0.55;
    ctx.lineWidth = isNext ? 4 : 3;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Chevrons on the next ring so it reads as a gate, not a circle.
    if (isNext) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(12, Math.round(r * 0.32))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), centre.x, centre.y);
    }
    ctx.restore();
  }
}

// Clouds: soft billboards, far to near, translucent so the sky shows through.
export function drawClouds(ctx, w, h, cam, clouds) {
  const sorted = clouds
    .map((c) => ({ c, p: project(cam, c.x, c.y, c.z, w, h) }))
    .filter((o) => o.p && o.p.depth > 20)
    .sort((a, b) => b.p.depth - a.p.depth);
  for (const { c, p } of sorted) {
    const scale = FOCAL / p.depth;
    const rx = c.size * scale * 0.5;
    const ry = rx * 0.38;
    if (rx < 3) continue;
    ctx.save();
    ctx.globalAlpha = clamp(c.alpha * clamp(1.4 - p.depth / 2200, 0.15, 1), 0, 0.9);
    const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rx);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x - rx * 0.5, p.y + ry * 0.3, rx * 0.6, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + rx * 0.55, p.y + ry * 0.25, rx * 0.55, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// The aircraft, drawn in screen space at the chase position: a red-and-cream
// bush plane with a spinning prop, lit cockpit windows and blinking nav
// lights, banked with the roll and pitched with the climb.
export function drawPlane(ctx, w, h, plane, time) {
  const cx = w / 2;
  const cy = h * 0.62 - plane.pitch * 260;
  const s = 1.05; // overall scale
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.85);
  ctx.scale(s, s);
  // Drop shadow on the ground far below is skipped: the plane is the focus.
  // Tail fin and stabiliser (behind the fuselage).
  ctx.fillStyle = '#b3271e';
  ctx.beginPath();
  ctx.moveTo(-58, -6);
  ctx.lineTo(-96, -52);
  ctx.lineTo(-78, -56);
  ctx.lineTo(-44, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f1d16';
  ctx.beginPath();
  ctx.moveTo(-52, 2);
  ctx.lineTo(-104, -8);
  ctx.lineTo(-102, 2);
  ctx.lineTo(-50, 10);
  ctx.closePath();
  ctx.fill();
  // Main wings, swept back, cream on top with red tips.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.moveTo(-18, -4);
  ctx.lineTo(-150, -34);
  ctx.lineTo(-158, -18);
  ctx.lineTo(-20, 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-18, -4);
  ctx.lineTo(150, -34);
  ctx.lineTo(158, -18);
  ctx.lineTo(-20, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c22a1f';
  ctx.beginPath();
  ctx.moveTo(-138, -31);
  ctx.lineTo(-150, -34);
  ctx.lineTo(-158, -18);
  ctx.lineTo(-146, -15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(138, -31);
  ctx.lineTo(150, -34);
  ctx.lineTo(158, -18);
  ctx.lineTo(146, -15);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a tapered red body with a cream cheatline.
  const body = ctx.createLinearGradient(0, -26, 0, 22);
  body.addColorStop(0, '#d93826');
  body.addColorStop(0.55, '#c22a1f');
  body.addColorStop(1, '#7e1a12');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(78, -12);
  ctx.quadraticCurveTo(40, -26, -10, -20);
  ctx.quadraticCurveTo(-58, -16, -72, -6);
  ctx.quadraticCurveTo(-58, 8, -20, 14);
  ctx.quadraticCurveTo(30, 18, 66, 8);
  ctx.quadraticCurveTo(82, 2, 78, -12);
  ctx.closePath();
  ctx.fill();
  // Lit cockpit windows.
  ctx.fillStyle = '#9fe8ff';
  ctx.beginPath();
  ctx.moveTo(30, -18);
  ctx.quadraticCurveTo(48, -18, 58, -10);
  ctx.lineTo(52, -2);
  ctx.lineTo(28, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(34, -16);
  ctx.lineTo(50, -14);
  ctx.lineTo(46, -8);
  ctx.lineTo(32, -10);
  ctx.closePath();
  ctx.fill();
  // Registration and the Kestrel mark.
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KESTREL-7', -6, 8);
  // Prop disc and blades at the nose.
  ctx.save();
  ctx.translate(80, -4);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#dfe8ee';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const blade = (time * 22) % Math.PI;
  ctx.strokeStyle = 'rgba(40,40,40,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(Math.cos(blade) * -42, Math.sin(blade) * -42);
  ctx.lineTo(Math.cos(blade) * 42, Math.sin(blade) * 42);
  ctx.stroke();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Nav lights: red port, green starboard, blinking white tail strobe.
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-152, -24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#35e05a';
  ctx.beginPath();
  ctx.arc(152, -24, 4, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-96, -50, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Cockpit frame for the C-key view: glareshield, pillars and a lit panel edge.
export function drawCockpitFrame(ctx, w, h, plane) {
  ctx.save();
  // Glareshield.
  ctx.fillStyle = '#1c222c';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // Centre pillar and side pillars.
  ctx.fillStyle = '#141a23';
  ctx.fillRect(w / 2 - 7, 0, 14, h * 0.74);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.06, 0);
  ctx.lineTo(w * 0.1, h * 0.74);
  ctx.lineTo(0, h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.94, 0);
  ctx.lineTo(w * 0.9, h * 0.74);
  ctx.lineTo(w, h * 0.8);
  ctx.closePath();
  ctx.fill();
  // Nose: the red cowling peeking over the glareshield, banked with the roll.
  ctx.translate(w / 2, h * 0.74);
  ctx.rotate(plane.roll * 0.5);
  ctx.fillStyle = '#c22a1f';
  ctx.beginPath();
  ctx.moveTo(-90, 0);
  ctx.quadraticCurveTo(0, -52, 90, 0);
  ctx.quadraticCurveTo(0, 26, -90, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f1d16';
  ctx.beginPath();
  ctx.moveTo(-90, 0);
  ctx.quadraticCurveTo(0, 26, 90, 0);
  ctx.lineTo(90, 6);
  ctx.lineTo(-90, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export { GAME };
