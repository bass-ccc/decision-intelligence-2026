// Particle formations for the "swarm" of 9,221 glyphs.
// 9,221 = the number of validation points behind People Model's r = 0.89.
// Each formation returns { pos: Float32Array(N*3), col: Float32Array(N*3) } in local space.

export const N = 9221;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const PAPER = hex('#ECE4D4');
const GREY = hex('#8C877E');

function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function out() {
  return { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) };
}
function setCol(col, i, c, k = 1) {
  col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
}
function mixc(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Hero: a collective mind — a fibonacci sphere of people around the closed book.
export function sphere(accent = '#C5D96B') {
  const o = out(), r = rng(11), acc = hex(accent);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = ga * i;
    const R = 4.1 + gauss(r) * 0.12 + (r() < 0.06 ? r() * 1.6 : 0);
    o.pos[i * 3] = Math.cos(th) * rad * R;
    o.pos[i * 3 + 1] = y * R;
    o.pos[i * 3 + 2] = Math.sin(th) * rad * R;
    setCol(o.col, i, r() < 0.07 ? acc : mixc(GREY, PAPER, r()), 0.55 + r() * 0.45);
  }
  return o;
}

// Intro: three orbits — Business, People and Organization Growth.
export function orbits(color) {
  const o = out(), r = rng(21), c = hex(color);
  const rings = [
    { R: 7.4, tilt: 0.35, yaw: 0.0 },
    { R: 6.0, tilt: -0.55, yaw: 1.1 },
    { R: 4.6, tilt: 0.9, yaw: 2.2 },
  ];
  for (let i = 0; i < N; i++) {
    const g = rings[i % 3];
    const a = r() * Math.PI * 2;
    const spread = gauss(r) * 0.22;
    let x = Math.cos(a) * (g.R + spread), y = gauss(r) * 0.12, z = Math.sin(a) * (g.R + spread);
    // tilt around X, then yaw around Y
    const y1 = y * Math.cos(g.tilt) - z * Math.sin(g.tilt);
    const z1 = y * Math.sin(g.tilt) + z * Math.cos(g.tilt);
    const x2 = x * Math.cos(g.yaw) + z1 * Math.sin(g.yaw);
    const z2 = -x * Math.sin(g.yaw) + z1 * Math.cos(g.yaw);
    if (r() < 0.12) { // a faint core of ideas
      const rr = Math.pow(r(), 0.5) * 2.2, t = r() * Math.PI * 2, p = Math.acos(2 * r() - 1);
      o.pos.set([rr * Math.sin(p) * Math.cos(t), rr * Math.cos(p), rr * Math.sin(p) * Math.sin(t)], i * 3);
      setCol(o.col, i, c, 0.5 + r() * 0.5);
      continue;
    }
    o.pos.set([x2, y1, z2], i * 3);
    setCol(o.col, i, mixc(PAPER, c, i % 3 === 0 ? 0.9 : r() * 0.5), 0.45 + r() * 0.55);
  }
  return o;
}

// People: a fingerprint — identity, the thing AI cannot fake (echoes the book's People divider).
export function fingerprint(color) {
  const o = out(), r = rng(31), c = hex(color);
  let i = 0;
  const ridges = 34;
  const total = (ridges * (ridges + 1)) / 2;
  for (let k = 1; k <= ridges && i < N; k++) {
    const count = Math.floor((k / total) * N * 0.93);
    const base = k * 0.24;
    for (let j = 0; j < count && i < N; j++) {
      const a = (j / count) * Math.PI * 2 + k * 0.3;
      // break some ridges like a real print
      if (Math.sin(a * 3 + k * 1.7) > 0.93) continue;
      const wob = Math.sin(a * 2 + k * 0.4) * 0.12 * k * 0.1 + Math.sin(a * 5 + k) * 0.05;
      const rx = (base + wob) * 1.0, ry = (base + wob) * 1.32;
      const loop = Math.max(0, Math.cos(a - 1.5)) * 0.9 * Math.min(1, k / 10); // the loop sweep
      o.pos[i * 3] = Math.cos(a) * rx + loop * 0.6 + gauss(r) * 0.025;
      o.pos[i * 3 + 1] = Math.sin(a) * ry - loop * 0.4 + gauss(r) * 0.025;
      o.pos[i * 3 + 2] = gauss(r) * 0.18 + Math.sin(a * 2 + k) * 0.25;
      setCol(o.col, i, k % 5 === 0 ? c : mixc(GREY, PAPER, 0.4 + r() * 0.6), 0.5 + r() * 0.5);
      i++;
    }
  }
  // the rest dissolves into ASCII dust drifting off to one side (like the book's dissolve)
  for (; i < N; i++) {
    const t = r();
    o.pos[i * 3] = 8.6 + t * 5 + gauss(r) * 0.6;
    o.pos[i * 3 + 1] = gauss(r) * 3.5 * (1 - t * 0.5);
    o.pos[i * 3 + 2] = gauss(r) * 1.2;
    setCol(o.col, i, mixc(GREY, c, r() * 0.6), 0.3 + r() * 0.4);
  }
  return o;
}

// Model: a sunflower — phyllotaxis, nature's own model (echoes the book's Model divider).
export function sunflower(color) {
  const o = out(), r = rng(41), c = hex(color);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const seeds = Math.floor(N * 0.72);
  for (let i = 0; i < seeds; i++) {
    const rr = 0.078 * Math.sqrt(i);
    const th = i * ga;
    o.pos[i * 3] = Math.cos(th) * rr;
    o.pos[i * 3 + 1] = Math.sin(th) * rr;
    o.pos[i * 3 + 2] = -rr * rr * 0.05 + gauss(r) * 0.03;
    const edge = rr / (0.078 * Math.sqrt(seeds));
    setCol(o.col, i, edge > 0.8 ? c : mixc(GREY, PAPER, 0.3 + 0.7 * r()), 0.45 + r() * 0.55);
  }
  const petals = 34;
  for (let i = seeds; i < N; i++) {
    const p = (i - seeds) % petals;
    const a = (p / petals) * Math.PI * 2 + (p % 2) * 0.09;
    const len = 2.6 + (p % 3) * 0.35;
    const t = r();
    const w = Math.sin(t * Math.PI) * 0.45 * (1 - t * 0.3);
    const side = gauss(r) * w;
    const R0 = 5.4;
    const d = R0 + t * len;
    o.pos[i * 3] = Math.cos(a) * d - Math.sin(a) * side;
    o.pos[i * 3 + 1] = Math.sin(a) * d + Math.cos(a) * side;
    o.pos[i * 3 + 2] = -t * t * 1.4 + gauss(r) * 0.05;
    setCol(o.col, i, mixc(c, PAPER, t * 0.6), 0.55 + r() * 0.45);
  }
  return o;
}

// A.I: a voxel head of data — matter turning into information (echoes the book's A.I divider).
export function voxels(color) {
  const o = out(), r = rng(51), c = hex(color);
  const step = 0.36;
  let i = 0;
  const pts = [];
  for (let x = -6; x <= 6; x += step) for (let y = -7; y <= 7; y += step) for (let z = -6; z <= 6; z += step) {
    // a stylised head: ellipsoid skull + jaw + nose
    const skull = (x * x) / 18 + ((y - 1.2) * (y - 1.2)) / 30 + (z * z) / 22;
    const jaw = (x * x) / 9 + ((y + 3.4) * (y + 3.4)) / 8 + ((z - 0.8) * (z - 0.8)) / 12;
    const nose = ((x) * (x)) / 0.5 + ((y - 0.2) * (y - 0.2)) / 2.2 + ((z - 4.4) * (z - 4.4)) / 1.2;
    const inside = skull < 1 || jaw < 1 || nose < 1;
    const shell = inside && (skull > 0.72 || jaw > 0.6 || nose > 0.2);
    if (shell) pts.push([x, y, z]);
  }
  for (let k = pts.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pts[k], pts[j]] = [pts[j], pts[k]]; }
  const body = Math.min(pts.length, Math.floor(N * 0.8));
  for (; i < body; i++) {
    const [x, y, z] = pts[i];
    // the back of the head dissolves
    const dissolve = z < -2.2 && r() < 0.55;
    const dz = dissolve ? -r() * 5.5 : 0;
    o.pos[i * 3] = x + (dissolve ? gauss(r) * 0.6 : 0);
    o.pos[i * 3 + 1] = y + (dissolve ? gauss(r) * 0.4 : 0);
    o.pos[i * 3 + 2] = z + dz;
    // rotate the head to show its profile
    const ang = -1.2, X = o.pos[i * 3], Z = o.pos[i * 3 + 2];
    o.pos[i * 3] = X * Math.cos(ang) - Z * Math.sin(ang);
    o.pos[i * 3 + 2] = X * Math.sin(ang) + Z * Math.cos(ang);
    setCol(o.col, i, dissolve ? c : mixc(GREY, PAPER, 0.25 + r() * 0.75), 0.45 + r() * 0.55);
  }
  for (; i < N; i++) {
    const a = r() * Math.PI * 2, rr = 7 + r() * 6;
    o.pos[i * 3] = Math.cos(a) * rr;
    o.pos[i * 3 + 1] = gauss(r) * 4;
    o.pos[i * 3 + 2] = Math.sin(a) * rr;
    setCol(o.col, i, mixc(GREY, c, r()), 0.25 + r() * 0.35);
  }
  return o;
}

// People Model validation: simulated vs. real answer shares.
// Reconstructed to match the reported statistics (r ≈ 0.89, MAE ≈ 9.4, RMSE ≈ 13.1) — illustrative, not the raw data.
export function scatter(size = 9.5) {
  const o = out(), r = rng(61);
  const pink = hex('#F2A9A7'), lime = hex('#C5D96B');
  const xs = new Float32Array(N), ys = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // answer shares cluster low, with a long tail up to 100
    let x = Math.pow(r(), 1.4) * 88;
    if (r() < 0.03) x = 55 + r() * 45;
    const u = r() - 0.5;
    const lap = -10.5 * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    let y = x + lap;
    y = Math.min(100, Math.max(0, y));
    xs[i] = x; ys[i] = y;
  }
  let mx = 0, my = 0; for (let i = 0; i < N; i++) { mx += xs[i]; my += ys[i]; } mx /= N; my /= N;
  let sxy = 0, sxx = 0, syy = 0, mae = 0, mse = 0;
  for (let i = 0; i < N; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    const e = ys[i] - xs[i]; mae += Math.abs(e); mse += e * e;
  }
  const stats = { r: sxy / Math.sqrt(sxx * syy), mae: mae / N, rmse: Math.sqrt(mse / N) };
  for (let i = 0; i < N; i++) {
    o.pos[i * 3] = (xs[i] / 100 - 0.5) * size;
    o.pos[i * 3 + 1] = (ys[i] / 100 - 0.5) * size;
    o.pos[i * 3 + 2] = gauss(r) * 0.06;
    const err = Math.min(1, Math.abs(ys[i] - xs[i]) / 30);
    setCol(o.col, i, err < 0.25 ? mixc(PAPER, lime, 0.35) : mixc(PAPER, pink, err), 0.55 + (1 - err) * 0.45);
  }
  o.stats = stats;
  return o;
}

// Overview: the swarm spreads into a nebula around the whole spiral.
export function nebula(height, radius) {
  const o = out(), r = rng(71);
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2;
    const rr = r() < 0.5 ? Math.sqrt(r()) * radius * 0.55 : radius * (1.15 + r() * 0.9);
    o.pos[i * 3] = Math.cos(a) * rr;
    o.pos[i * 3 + 1] = (r() - 0.5) * height;
    o.pos[i * 3 + 2] = Math.sin(a) * rr;
    setCol(o.col, i, mixc(GREY, PAPER, r()), 0.25 + r() * 0.45);
  }
  return o;
}
