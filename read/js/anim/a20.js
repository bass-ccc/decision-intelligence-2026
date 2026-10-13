// 20 拒絕同質化 AI Slop — AI's biggest risk is not making mistakes but becoming average.
// step 0  hand-drawn shapes, each one different, go into the machine and come out as the same grey glyph blob
// step 1  超加工創意: a nutrition label — plenty of 熱量 (volume), none of 觀點、個性、文化脈絡、情感溫度
// step 2  成本換了位置: making is fast now; the queue builds at governance, > 2 hours for every AI error
// step 3  Creator → Architecture Designer: a person draws the spec, the AI fills it in, a person checks the end
// step 4  交付力: Vanguard, brief to delivery, 5.5 days → 0.25 day
// step 5  SLIP: Spec → Line → Inspection → Pattern; every shape keeps its own form, and the pattern loops back
// Drag along the belt to push the line (step 4: drag the clock hand).
import { hash, lerp, approach, clamp, noise3 } from '../engine/noise.js';

export const hint = '拖曳，推動產線';

const NUTRITION = ['觀點', '個性', '文化脈絡', '情感溫度'];
const SLIP = [
  ['S', 'Spec 規格化', '定義不能妥協的'],
  ['L', 'Line 產線化', '模組化品牌資產庫'],
  ['I', 'Inspection 檢驗化', '三道關卡'],
  ['P', 'Pattern 模式化', '勝率模式回饋'],
];
const SPEED = 26; // belt, px per second

// eight kinds of hand-drawn shape, in a unit box; open ones are strokes, closed ones can be filled
function shapePts(type) {
  const p = [];
  if (type === 0) for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? 0.44 : 1;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  else if (type === 1) for (let i = 0; i <= 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    p.push([Math.cos(a), Math.sin(a) * 0.95 + 0.12]);
  }
  else if (type === 2) for (let i = 0; i <= 44; i++) {
    const k = i / 44;
    const a = k * Math.PI * 4.4;
    p.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  else if (type === 3) p.push([-0.78, -0.8], [0.82, -0.74], [0.76, 0.82], [-0.8, 0.76], [-0.78, -0.8]);
  else if (type === 4) for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    p.push([(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.05]);
  }
  else if (type === 5) p.push([-0.15, -1], [0.5, -1], [0.08, -0.12], [0.58, -0.12], [-0.38, 1], [-0.04, 0.16], [-0.52, 0.16], [-0.15, -1]);
  else if (type === 6) for (let i = 0; i <= 50; i++) {
    const a = (i / 50) * Math.PI * 2;
    const r = 0.64 + 0.36 * Math.cos(a * 5);
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  else for (let i = 0; i <= 26; i++) {
    const k = i / 26;
    p.push([-1 + 2 * k, Math.sin(k * Math.PI * 3) * 0.42]);
  }
  return p;
}
const SHAPES = Array.from({ length: 8 }, (_, i) => shapePts(i));
const OPEN = [false, false, true, false, false, false, false, true];
function insideShape(type, x, y) {
  const p = SHAPES[type];
  if (OPEN[type]) {
    // near the stroke
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const k = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
      if (Math.hypot(x - x0 - dx * k, y - y0 - dy * k) < 0.2) return true;
    }
    return false;
  }
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export default function make(env) {
  const { ink, ascii } = env;
  const mix = [1, 0, 0, 0, 0, 0];
  const t0 = [0, 0, 0, 0, 0, 0];
  const b0 = [0, 0, 0, 0, 0, 0];
  let cur = -1;
  let G = {};
  let belt = 0; // how far the belt has run (auto + dragged)
  let clock = 0; // step 4 playhead, 0..1
  let clockDrag = false;
  let lastDrag = -9;

  function geom() {
    const { w, h, mini } = env;
    const pad = mini ? 8 : w < 520 ? 16 : 28;
    const top = mini ? 8 : 44;
    const bot = mini ? h - 8 : h - 60;
    const C = { x: pad, y: top, w: w - pad * 2, h: bot - top };
    G = { w, h, C, cx: w / 2, cy: top + C.h / 2, narrow: w < 560 };
    G.r = mini ? 11 : clamp(Math.min(C.w / 32, C.h / 26), 11, 24);
    G.sp = G.r * 3.3;
  }
  geom();

  const tw = (s, size, kind = 'hand') => {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size);
    const m = g.measureText(s).width;
    g.restore();
    return m;
  };
  function tag(str, x, y, size, a, o = {}) {
    const m = tw(str, size, o.font);
    const x0 = o.align === 'center' ? x - m / 2 : o.align === 'right' ? x - m : x;
    ink.marker(x0 - 6, y - size * 0.98, m + 12, size * 1.38, { seed: o.seed || 1, alpha: env.c.hlAlpha * a });
    ink.text(str, x, y, { size, align: o.align, alpha: a, font: o.font, weight: o.weight });
  }
  function person(x, y, s, a, seed = 1) {
    ink.circle(x, y - s * 0.24, s * 0.2, { seed, alpha: 0.9 * a });
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = Math.PI + (i / 12) * Math.PI;
      pts.push([x + Math.cos(k) * s * 0.46, y + s * 0.5 + Math.sin(k) * s * 0.44]);
    }
    ink.path(pts, { seed: seed + 1, alpha: 0.9 * a });
  }
  function check(x, y, s, a, seed) {
    ink.path([[x - s * 0.5, y], [x - s * 0.12, y + s * 0.42], [x + s * 0.55, y - s * 0.5]], { seed, alpha: 0.95 * a, w: 1.7, wobble: 0.6 });
  }

  // ── the pieces on the belt ──
  // a hand-drawn shape (each item its own kind, size and tilt)
  function pencilShape(it, x, y, r, a, o = {}) {
    const rot = it.rot;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const pts = SHAPES[it.type].map(([px, py]) => [x + (px * cs - py * sn) * r * it.k, y + (px * sn + py * cs) * r * it.k]);
    ink.path(pts, { seed: it.seed, alpha: (o.alpha ?? 0.9) * a, w: o.w || 1.4 });
  }
  // the same shape filled with its own glyph texture: still itself
  function glyphShape(it, x, y, r, a) {
    const cell = clamp(r / 3.6, 4.5, 7);
    const n = Math.ceil((r * it.k * 2) / cell);
    const cs = Math.cos(-it.rot);
    const sn = Math.sin(-it.rot);
    for (let q = 0; q <= n; q++) for (let w = 0; w <= n; w++) {
      const px = x - r * it.k + q * cell;
      const py = y - r * it.k + w * cell;
      const ux = (px - x) / (r * it.k);
      const uy = (py - y) / (r * it.k);
      if (!insideShape(it.type, ux * cs - uy * sn, ux * sn + uy * cs)) continue;
      const v = 0.42 + ((q * (it.type % 3 + 1) + w * (it.type % 2 + 1)) % 4) * 0.16;
      ascii.glyph(v, px, py, cell, env.c.ink, a);
    }
  }
  // the slop: one grey glyph blob, identical every time (drawn once, then stamped)
  const blobC = document.createElement('canvas');
  let blobKey = '';
  function slop(x, y, r, a) {
    const S = Math.ceil(r * 2.3);
    const key = [Math.round(r), env.c.ink, env.dpr].join('|');
    if (key !== blobKey) {
      blobKey = key;
      blobC.width = Math.ceil(S * env.dpr);
      blobC.height = Math.ceil(S * env.dpr);
      const bg = blobC.getContext('2d');
      bg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
      const keep = env.g;
      env.g = bg;
      const cell = clamp(r / 3.4, 4.5, 7);
      const n = Math.ceil((r * 2) / cell);
      for (let q = 0; q <= n; q++) for (let w = 0; w <= n; w++) {
        const px = S / 2 - r + q * cell;
        const py = S / 2 - r + w * cell;
        if (Math.hypot(px - S / 2, py - S / 2) > r) continue;
        ascii.glyph(0.44, px, py, cell, env.c.ink, 0.75);
      }
      env.g = keep;
    }
    const g = env.g;
    g.save();
    g.globalAlpha *= a;
    g.drawImage(blobC, x - S / 2, y - S / 2, S, S);
    g.restore();
  }

  // items: a fixed set that loops along the belt
  const items = Array.from({ length: 40 }, (_, i) => ({
    i,
    type: Math.floor(hash(i, 1) * 8),
    seed: 100 + i,
    rot: (hash(i, 2) - 0.5) * 0.8,
    k: 0.8 + hash(i, 3) * 0.3,
    win: hash(i, 4) < 0.34,
  }));
  // every item currently on a belt from x0 to x1: [item, x]
  function onBelt(x0, x1) {
    const { sp } = G;
    const L = sp * items.length;
    const out = [];
    for (const it of items) {
      let x = (it.i * sp + belt) % L;
      if (x < 0) x += L;
      x += x0 - sp;
      if (x > x0 - sp * 0.5 && x < x1 + sp * 0.5) out.push([it, x]);
    }
    return out;
  }
  function beltLine(x0, x1, y, a) {
    const g = env.g;
    const { c } = env;
    ink.line(x0, y, x1, y, { seed: 11, alpha: 0.85 * a, w: 1.3 });
    ink.line(x0, y + 10, x1, y + 10, { seed: 12, alpha: 0.7 * a, w: 1.1 });
    // the moving belt: little ticks, batched into one path
    g.save();
    g.strokeStyle = c.pencil;
    g.globalAlpha *= 0.45 * a;
    g.lineWidth = 1;
    g.beginPath();
    const step = 18;
    let off = belt % step;
    if (off < 0) off += step;
    for (let x = x0 + off; x < x1; x += step) {
      g.moveTo(x, y + 2);
      g.lineTo(x - 3, y + 8);
    }
    g.stroke();
    g.restore();
    for (let k = 0; k < 2; k++) ink.circle(k ? x1 - 5 : x0 + 5, y + 5, 5, { seed: 13 + k, alpha: 0.7 * a, w: 1 });
  }
  function machine(x, by, mw, mh, a, label) {
    const { c } = env;
    const y = by - mh;
    const g = env.g;
    g.save();
    g.globalAlpha *= 0.9 * a;
    g.fillStyle = c.sheet;
    g.fillRect(x - mw / 2, y, mw, mh);
    g.restore();
    const cell = clamp(mw / 12, 6, 10);
    ascii.field(x - mw / 2 + 4, y + 4, mw - 8, mh - 8, cell, (px, py, q, r) => 0.25 + 0.5 * Math.abs(noise3(q * 0.3, r * 0.3, env.t * 0.8)), c.ink, a * 0.8);
    ink.rect(x - mw / 2, y, mw, mh, { seed: 15, alpha: 0.9 * a, w: 1.4 });
    if (label) ink.text(label, x, y - 12, { size: G.narrow || env.mini ? 13 : 15, align: 'center', alpha: a });
  }

  // ── step 0: in go the shapes, out comes the average ──
  function scene0(a) {
    const { c, mini } = env;
    const { C, cy, narrow, r } = G;
    const by = mini ? C.y + C.h * 0.66 : cy + 24;
    const mx = C.x + C.w * 0.5;
    const mw = clamp(C.w * 0.16, 54, 150);
    const mh = clamp(C.h * 0.3, 50, 170);
    const x0 = C.x;
    const x1 = C.x + C.w;
    beltLine(x0, x1, by, a);
    for (const [it, x] of onBelt(x0, x1)) {
      const y = by - r * 1.15;
      if (x < mx - mw / 2 - r * 0.6) pencilShape(it, x, y, r, a);
      else if (x > mx + mw / 2 + r * 0.6) slop(x, y, r * 0.95, a);
    }
    machine(mx, by, mw, mh, a, mini ? '' : 'AI 生成');
    if (mini) {
      tag('AI Slop', x1 - 4, by + 34, 13, a, { align: 'right', font: 'latin', weight: 500, seed: 18 });
      return;
    }
    const fs = narrow ? 14 : 16;
    ink.text('每一個都不一樣', (x0 + mx - mw / 2) / 2, by - r * 3.4, { size: fs, align: 'center', alpha: a });
    tag('AI Slop', (mx + mw / 2 + x1) / 2, by - r * 3.4, fs + 2, a, { align: 'center', font: 'latin', weight: 500, seed: 18 });
    ink.text('同質化的內容洪流', (mx + mw / 2 + x1) / 2, by + 40, { size: narrow ? 13 : 14, align: 'center', color: c.ink2, alpha: a });
    ink.text('AI 最大的風險不是犯錯，而是變得平均', C.x + C.w / 2, C.y + C.h - 4, { size: fs, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 1: ultra-processed creativity, the nutrition label ──
  function scene1(a) {
    const { c } = env;
    const { C, narrow, r } = G;
    const by = C.y + C.h - 34;
    const mx = C.x + C.w * 0.3;
    const mw = clamp(C.w * 0.12, 50, 110);
    const mh = narrow ? 30 : clamp(C.h * 0.16, 40, 90);
    const made = Math.max(0, Math.floor((belt - b0[1]) / G.sp));
    const heap = Math.min(999, 28 + made);
    const rr = r * 0.62;
    const hx = C.x + C.w - 9 * rr * 0.95 - 4;
    const bend = hx - 9 * rr * 0.95 - r * 0.5;
    beltLine(C.x, bend, by, a);
    for (const [it, x] of onBelt(C.x, bend - r)) {
      const y = by - r * 1.15;
      if (x < mx - mw / 2 - r * 0.6) pencilShape(it, x, y, r * 0.85, a);
      else if (x > mx + mw / 2 + r * 0.6) slop(x, y, r * 0.8, a);
    }
    machine(mx, by, mw, mh, a, '');
    // the heap of output
    let k = 0;
    const shown = Math.min(45, heap);
    const base = Math.ceil((Math.sqrt(8 * shown + 1) - 1) / 2);
    for (let row = 0; k < shown; row++) {
      const n = Math.max(1, base - row);
      for (let i = 0; i < n && k < shown; i++, k++) slop(hx + (i - (n - 1) / 2) * rr * 1.9, by + 4 - rr - row * rr * 1.6, rr, a);
    }
    // the label
    const lw = Math.min(400, C.w * (narrow ? 1 : 0.62));
    const lx = C.x + (C.w - lw) / 2;
    const fs = narrow ? 14 : 16;
    const rowH = narrow ? 22 : 34;
    const ly = C.y + (narrow ? 0 : 8);
    const g = env.g;
    const lh = (narrow ? 58 : 70) + rowH * 5 + (narrow ? 14 : 24);
    g.save();
    g.globalAlpha *= 0.9 * a;
    g.fillStyle = c.sheet;
    g.fillRect(lx, ly, lw, lh);
    g.restore();
    ink.rect(lx, ly, lw, lh, { seed: 20, alpha: 0.9 * a, w: 1.4 });
    const hd = narrow ? 40 : 48;
    ink.text('營養標示', lx + 14, ly + hd - 16, { size: narrow ? 18 : 24, weight: 700, alpha: a });
    ink.text('超加工創意', lx + lw - 14, ly + hd - 18, { size: fs - 1, align: 'right', color: c.ink2, alpha: a });
    ink.line(lx + 10, ly + hd, lx + lw - 10, ly + hd, { seed: 21, alpha: 0.9 * a, w: 3, passes: 1 });
    // 熱量: the volume keeps rising
    let y = ly + hd + rowH * 0.85;
    ink.text('熱量（產量）', lx + 14, y, { size: fs, weight: 700, alpha: a });
    const bx = lx + 14 + tw('熱量（產量）', fs) + 14;
    const bw = (lx + lw - 70 - bx) * Math.min(1, heap / 70);
    ascii.field(bx, y - 13, Math.max(2, bw), 14, 7, () => 0.8, c.ink, a);
    ink.text(`${heap} 件`, lx + lw - 14, y, { font: 'mono', size: 13, align: 'right', alpha: a });
    ink.line(lx + 10, y + rowH * 0.36, lx + lw - 10, y + rowH * 0.36, { seed: 22, alpha: 0.7 * a, w: 1.6, passes: 1 });
    // the nutrition that was taken out
    NUTRITION.forEach((name, i) => {
      y += rowH;
      ink.text(name, lx + 24, y, { size: fs, alpha: a });
      ink.text('0%', lx + lw - 14, y, { font: 'mono', size: 13, align: 'right', alpha: a });
      const m = tw(name, fs);
      ink.line(lx + 20, y - fs * 0.32, lx + 28 + m, y - fs * 0.34, { seed: 23 + i, alpha: 0.7 * a, w: 1.1 });
      ink.line(lx + 10, y + rowH * 0.36, lx + lw - 10, y + rowH * 0.36, { seed: 30 + i, alpha: 0.4 * a, w: 0.9, passes: 1 });
    });
    ink.text('示意', lx + lw - 14, ly + lh - 8, { size: 13, align: 'right', color: c.ink2, alpha: a });
    if (!narrow) ink.text('有熱量，沒有營養', lx + 14, ly + lh - 8, { size: 13, color: c.ink2, alpha: a });
  }

  // ── step 2: the cost moved to governance ──
  function scene2(a) {
    const { c } = env;
    const { C, cy, narrow, r } = G;
    const by = cy + 30;
    const mx = C.x + C.w * 0.2;
    const mw = clamp(C.w * 0.12, 50, 110);
    const mh = clamp(C.h * 0.22, 46, 120);
    const gx = C.x + C.w * (narrow ? 0.7 : 0.72);
    const gh = clamp(C.h * 0.3, 60, 160);
    const fs = narrow ? 13 : 15;
    const made = Math.max(0, Math.floor((belt - b0[2]) / G.sp));
    const queue = Math.min(26, 8 + made);
    beltLine(C.x, C.x + C.w, by, a);
    for (const [it, x] of onBelt(C.x, C.x + C.w)) {
      const y = by - r * 1.15;
      if (x < mx - mw / 2 - r * 0.6) pencilShape(it, x, y, r * 0.85, a);
      else if (x > mx + mw / 2 + r * 0.6 && x < gx - r * 7) slop(x, y, r * 0.8, a);
    }
    // the queue piles up before the gate
    const rr = r * 0.7;
    let k = 0;
    for (let row = 0; k < queue; row++) {
      const n = Math.max(1, 8 - row * 2);
      for (let i = 0; i < n && k < queue; i++, k++) slop(gx - rr * 1.6 - i * rr * 1.85 - row * rr * 0.9, by - rr - row * rr * 1.6, rr, a);
    }
    // the gate: governance and quality control, one at a time
    ink.line(gx, by - 2, gx, by - gh, { seed: 40, alpha: 0.95 * a, w: 2 });
    ink.line(gx + 14, by - 2, gx + 14, by - gh, { seed: 41, alpha: 0.95 * a, w: 2 });
    ink.line(gx - 8, by - gh, gx + 22, by - gh, { seed: 42, alpha: 0.9 * a, w: 1.6 });
    const pass = (env.t % 2.4) / 2.4;
    slop(lerp(gx + 7, C.x + C.w - 10, pass), by - rr, rr * 0.9, a * (1 - pass * 0.3));
    machine(mx, by, mw, mh, a, '');
    ink.text('生成：只要幾秒', mx, by - mh - 14, { size: fs, align: 'center', alpha: a });
    ink.text('治理與品質控管', gx + 7, by - gh - 16, { size: fs, align: 'center', alpha: a });
    tag('瓶頸移到這裡', gx + 7, by - gh - 42, fs, a, { align: 'center', seed: 43 });
    // a person fixing, and the clock
    const px = narrow ? C.x + C.w * 0.36 : gx - 90;
    const py = by + 66;
    person(px, py, narrow ? 46 : 60, a, 44);
    const kx = px + (narrow ? 50 : 70);
    const ky = py - 4;
    const kr = narrow ? 16 : 22;
    ink.circle(kx, ky, kr, { seed: 46, alpha: 0.9 * a, w: 1.3 });
    const hand = env.t * 2.2;
    ink.line(kx, ky, kx + Math.cos(hand) * kr * 0.8, ky + Math.sin(hand) * kr * 0.8, { seed: 47, alpha: a, w: 1.4 });
    ink.line(kx, ky, kx + Math.cos(hand / 12 - 1) * kr * 0.5, ky + Math.sin(hand / 12 - 1) * kr * 0.5, { seed: 48, alpha: a, w: 1.8 });
    if (!narrow) {
      ink.text('每次 AI 錯誤', kx + kr + 12, ky - 4, { size: fs, alpha: a });
      ink.text('平均 > 2 小時修正', kx + kr + 12, ky + 16, { size: fs, alpha: a });
      ink.text('Workslop', kx + kr + 12, ky + 36, { font: 'latin', size: 13, weight: 500, color: c.ink2, alpha: a });
    } else ink.text('> 2 小時／錯誤', kx + kr + 8, ky + 5, { size: 13, alpha: a });
    ink.text('成本沒有消失，只是換了位置', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 3: the creator draws the rules ──
  function scene3(a) {
    const { c } = env;
    const { C, cy, narrow, r } = G;
    const by = cy + (narrow ? 14 : 50);
    const mx = C.x + C.w * 0.52;
    const mw = clamp(C.w * 0.13, 50, 120);
    const mh = clamp(C.h * 0.22, 46, 120);
    const kx = C.x + C.w * 0.86; // where the second person checks
    const fs = narrow ? 13 : 15;
    beltLine(C.x + C.w * 0.2, C.x + C.w, by, a);
    for (const [it, x] of onBelt(C.x + C.w * 0.2, C.x + C.w)) {
      const y = by - r * 1.15;
      if (x < mx - mw / 2 - r * 0.6) pencilShape(it, x, y, r, a, { alpha: 0.55, w: 1.1 });
      else if (x > mx + mw / 2 + r * 0.6) {
        glyphShape(it, x, y, r, a);
        pencilShape(it, x, y, r, a, { alpha: 0.5, w: 1 });
        if (x > kx) check(x + r * 0.7, y - r * 1.2, 12, a, 60 + it.i);
      }
    }
    machine(mx, by, mw, mh, a, 'AI 生成');
    // the spec: a sheet of outlines, being drawn by a person
    const sw = clamp(C.w * 0.16, 70, 150);
    const sh = sw * 1.2;
    const sx = C.x + (narrow ? 0 : 8);
    const sy = by - sh - 30;
    const g = env.g;
    g.save();
    g.globalAlpha *= 0.9 * a;
    g.fillStyle = c.sheet;
    g.fillRect(sx, sy, sw, sh);
    g.restore();
    ink.rect(sx, sy, sw, sh, { seed: 50, alpha: 0.9 * a, w: 1.2 });
    for (let i = 0; i < 4; i++) {
      const it = items[i * 3];
      pencilShape(it, sx + sw * (i % 2 ? 0.7 : 0.3), sy + sh * (i < 2 ? 0.3 : 0.68), sw * 0.16, a, { alpha: 0.75, w: 1.1 });
    }
    if (!narrow) ink.text('Spec', sx + sw / 2, sy - 10, { font: 'latin', size: 15, weight: 700, align: 'center', alpha: a });
    person(sx + sw * 0.5, by + (narrow ? 42 : 52), narrow ? 36 : 58, a, 51);
    ink.arrow(sx + sw + 8, sy + sh * 0.5, C.x + C.w * 0.2 + 10, by - r * 1.2, { seed: 52, alpha: 0.6 * a, w: 1, head: 7 });
    person(kx + (narrow ? 4 : 24), by + (narrow ? 42 : 52), narrow ? 36 : 58, a, 53);
    // the two loops
    const ty = C.y + 18;
    if (!narrow) {
      tag('Creator-in-the-Loop', sx, ty, 15, a, { font: 'latin', weight: 500, seed: 54 });
      ink.text('人定義 AI：世界觀與規則', sx, ty + 24, { size: fs, alpha: a });
      tag('Human-in-the-Loop', C.x + C.w, ty, 15, a, { font: 'latin', weight: 500, align: 'right', seed: 55 });
      ink.text('人在後端：保護品牌不犯錯', C.x + C.w, ty + 24, { size: fs, align: 'right', alpha: a });
    } else {
      ink.text('前端：人定義 AI', C.x, ty, { size: 13, alpha: a });
      ink.text('後端：人來把關', C.x + C.w, ty, { size: 13, align: 'right', alpha: a });
    }
    ink.text('從 Creator 到 Architecture Designer', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 4: delivery as the moat ──
  function scene4(a, T, still, dt) {
    const { c } = env;
    const { C, cy, narrow } = G;
    const fs = narrow ? 13 : 15;
    const lab = narrow ? 0 : 110;
    const x0 = C.x + lab;
    const x1 = C.x + C.w - (narrow ? 4 : 24);
    const W = x1 - x0;
    const dayX = (d) => x0 + (d / 5.5) * W;
    if (!clockDrag && dt > 0 && env.t - lastDrag > 1.5) clock = (clock + dt / 9) % 1.08;
    const ph = still ? 1 : Math.min(1, clock);
    const yA = cy - (narrow ? 56 : 70);
    const yB = cy + (narrow ? 30 : 40);
    const bh = narrow ? 20 : 28;
    // day ruler
    const ry = yB + bh + 34;
    ink.line(x0, ry, x1, ry, { seed: 70, alpha: 0.6 * a, w: 1, passes: 1 });
    for (let d = 0; d <= 5; d++) {
      ink.line(dayX(d), ry - 4, dayX(d), ry + 4, { seed: 71 + d, alpha: 0.6 * a, w: 1, passes: 1 });
      if (d < 5 || W / 11 > 56) ink.text(String(d), dayX(d), ry + 20, { font: 'mono', size: 13, align: 'center', color: c.ink2, alpha: a });
    }
    ink.text('5.5 天', dayX(5.5), ry + 20, { font: 'mono', size: 13, align: 'right', color: c.ink2, alpha: a });
    // before: one brief, one delivery, 5.5 days
    if (!narrow) {
      ink.text('過去', C.x, yA + bh * 0.7, { size: fs + 1, alpha: a });
      ink.text('Vanguard', C.x, yB + bh * 0.7, { font: 'latin', size: fs, weight: 700, alpha: a });
    } else ink.text('Vanguard', x0, yB - 10, { font: 'latin', size: 13, weight: 700, alpha: a });
    const fa = clamp(ph);
    ink.rect(x0, yA, W, bh, { seed: 80, alpha: 0.8 * a, w: 1.2, passes: 1 });
    ascii.field(x0 + 2, yA + 2, Math.max(1, (W - 4) * fa), bh - 4, 8, () => 0.3, c.ink, a * 0.8);
    ink.text(narrow ? '過去：Brief' : 'Brief', x0 + (narrow ? 0 : 6), yA - 8, { size: 13, color: narrow ? c.ink : c.ink2, alpha: a });
    ink.text(fa >= 1 ? '交付 1 次' : '交付', x1, yA - 8, { size: 13, align: 'right', color: c.ink2, alpha: a });
    // after: 0.25 day each, back to back (illustration of the same 5.5 days)
    const n = 22;
    const segW = W / n;
    let done = 0;
    for (let i = 0; i < n; i++) {
      const sx = x0 + i * segW;
      const f = clamp((ph * W - i * segW) / segW + 1e-6);
      if (f <= 0) break;
      if (f >= 0.999) {
        done++;
        ink.marker(sx + 1, yB - 1, segW - 3, bh + 2, { seed: 90 + i, alpha: c.hlAlpha * a });
      }
      ascii.field(sx + 2, yB + 2, Math.max(1, (segW - 5) * f), bh - 4, 6, () => 0.62, c.ink, a);
      ink.rect(sx + 1, yB, segW - 3, bh, { seed: 100 + i, alpha: 0.65 * a, w: 0.9, passes: 1 });
    }
    ink.text(`0.25 天（約 6 小時）× ${done}`, x0, yB + bh + 2 + (narrow ? 14 : 16), { size: 13, color: c.ink2, alpha: a });
    // the clock hand you can drag
    const hx = x0 + W * clamp(ph);
    ink.line(hx, yA - 4, hx, ry, { seed: 110, alpha: 0.9 * a, w: 1.3 });
    ink.blob(hx, ry, 9, { seed: 112, alpha: c.hlAlpha * a });
    ink.circle(hx, ry, 6, { seed: 111, alpha: 0.9 * a, w: 1.3 });
    ink.text('5.5 天 → 0.25 天', C.x + C.w / 2, C.y + 22, { font: 'mono', size: narrow ? 18 : 24, align: 'center', alpha: a });
    if (C.h > 300) ink.text('同時維持接近 100% 的品牌與法規合規率', C.x + C.w / 2, C.y + C.h - 26, { size: narrow ? 13 : 15, align: 'center', alpha: a });
    ink.text('同樣 5.5 天：示意', C.x + C.w / 2, C.y + C.h - 4, { size: 13, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 5: SLIP, a line where every shape stays itself ──
  function scene5(a) {
    const { c } = env;
    const { C, cy, narrow, r } = G;
    const by = cy + 46;
    const fs = narrow ? 13 : 15;
    const stX = (i) => C.x + C.w * (0.14 + i * 0.24);
    const archH = r * 3.4;
    beltLine(C.x, C.x + C.w, by, a);
    for (const [it, x] of onBelt(C.x, C.x + C.w)) {
      const y = by - r * 1.15;
      if (x < stX(0)) {
        ink.dot(x, by - 6, 3, { seed: it.seed, alpha: 0.8 * a, color: c.ink });
        continue;
      }
      const win = it.win && x > stX(3);
      if (win) ink.blob(x, y, r * 1.15, { seed: it.seed, alpha: c.hlAlpha * a });
      if (x > stX(1)) glyphShape(it, x, y, r, a);
      pencilShape(it, x, y, r, a, { alpha: x > stX(1) ? 0.5 : 0.9, w: x > stX(1) ? 1 : 1.3 });
      if (x > stX(2) + r) check(x + r * 0.75, y - r * 1.15, 10, a * 0.9, 120 + it.i);
    }
    // stations
    SLIP.forEach(([L, name, desc], i) => {
      const x = stX(i);
      ink.path([[x - r * 1.6, by - 1], [x - r * 1.6, by - archH], [x + r * 1.6, by - archH], [x + r * 1.6, by - 1]], { seed: 130 + i, alpha: 0.85 * a, w: 1.3 });
      if (i === 2) for (let k = 0; k < 3; k++) ink.line(x - r * 1.6 + k * r * 1.6, by - archH, x - r * 1.6 + k * r * 1.6, by - archH + 8, { seed: 135 + k, alpha: 0.7 * a, w: 1 });
      ink.blob(x, by - archH - 26, 17, { seed: 140 + i, alpha: c.hlAlpha * a });
      ink.text(L, x, by - archH - 17, { font: 'latin', size: 24, weight: 700, align: 'center', alpha: a });
      ink.text(narrow ? name.split(' ')[1] : name, x, by + 38, { size: fs, align: 'center', alpha: a });
      if (!narrow) ink.text(desc, x, by + 58, { size: 13, align: 'center', color: c.ink2, alpha: a });
    });
    // the pattern goes back to the spec
    const ay = by - archH - 56;
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const q = k / 20;
      pts.push([lerp(stX(3), stX(0), q), ay - Math.sin(q * Math.PI) * (narrow ? 18 : 30)]);
    }
    ink.path(pts, { seed: 150, alpha: 0.8 * a, w: 1.2 });
    const [ex, ey] = pts[pts.length - 1];
    ink.line(ex, ey, ex + 9, ey - 6, { seed: 151, alpha: 0.8 * a, w: 1.2 });
    ink.line(ex, ey, ex + 10, ey + 4, { seed: 152, alpha: 0.8 * a, w: 1.2 });
    ink.text('勝率模式回饋到規格與模組', (stX(0) + stX(3)) / 2, ay - (narrow ? 26 : 40), { size: fs, align: 'center', alpha: a });
    ink.text('AI 讓生成力變成商品，交付力才是護城河', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 13 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  const scenes = [scene0, scene1, scene2, scene3, scene4, scene5];

  return {
    resize: geom,
    down(x) {
      if (env.step === 4) {
        const { C } = G;
        const lab = G.narrow ? 0 : 110;
        clockDrag = true;
        clock = clamp((x - C.x - lab) / (C.w - lab - (G.narrow ? 4 : 24)));
      }
    },
    up() {
      clockDrag = false;
      lastDrag = env.t;
    },
    drag(x, y, dx) {
      lastDrag = env.t;
      if (env.step === 4) {
        const { C } = G;
        const lab = G.narrow ? 0 : 110;
        clock = clamp((x - C.x - lab) / (C.w - lab - (G.narrow ? 4 : 24)));
      } else belt += dx;
    },
    frame(t, dt) {
      const s = env.step;
      const still = dt === 0;
      if (s !== cur) {
        t0[s] = t;
        b0[s] = belt;
        if (s === 4) clock = 0;
        cur = s;
      }
      if (still) belt = Math.max(belt, 3.5 * SPEED);
      else belt += dt * SPEED;
      for (let i = 0; i < 6; i++) mix[i] = still ? (i === s ? 1 : 0) : approach(mix[i], i === s ? 1 : 0, dt, 0.18);
      for (let i = 0; i < 6; i++) {
        if (mix[i] < 0.02) continue;
        scenes[i](mix[i] * mix[i], t - t0[i], still, dt);
      }
    },
  };
}
