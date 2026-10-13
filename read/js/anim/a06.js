// 06 信任 — when content and identity can be generated, trust is what has been checked.
// step 0  a person, half pencil and half glyph, flickering: 眼前的人是否真實存在？ three sources can check it
// step 1  信任權威的兩次轉移: the trust badge goes 媒體 → 創作者 → generated identities, where it cannot settle
// step 2  真相藏在證據裡: three sources aim at a story; only three independent directions make it trustworthy
// step 3  真實仍是最有力量的內容: a 105-year-old's javelin lands and the glyph noise of criticism falls silent
// step 4  信任工程師: 內容庫 (a stack of generated glyph content) beside 信任庫 (a jar filling with people)
// step 5  信任經濟的三個轉向: three arrows, glyph words on the left, pencil words on the right
// Drag: move the three sources (steps 0 and 2); trust only forms when they look from three directions.
import { ARTICLES } from '../content.js';
import { rng, hash, smooth, lerp, approach, clamp, noise2 } from '../engine/noise.js';

export const hint = '拖動三個消息來源';

const ART = ARTICLES.find((a) => a.no === 6);
const SOURCES = ['當事人', '競爭者', '證據'];
const STATUS = ['一個來源：可能有立場', '兩個來源：可能有偏誤', '三個獨立來源：可信度開始建立'];
const NOISE = '!?#%&*@';
const DEG = Math.PI / 180;
// polar positions of the sources around their target (angle, distance in units of U)
const CLUSTER = [[184, 0.3], [199, 0.42], [214, 0.54]];
const SPREAD = [[200, 0.38], [325, 0.38], [92, 0.36]];

export default function make(env) {
  const m = [1, 0, 0, 0, 0, 0];
  let G = {};
  // per step (0 and 2): where the reader has put the sources; null = follow the default
  const placed = { 0: null, 2: null };
  const shown = SOURCES.map(() => ({ x: 0, y: 0 }));
  let dragging = -1;
  let trust = 0; // eased 0..1
  let firstFrame = true;

  function geom() {
    const { w, h } = env;
    const top = env.mini ? 18 : 48;
    const bot = env.mini ? h - 14 : h - 60;
    const U = Math.min(w, h);
    const narrow = w < 560;
    G = { w, h, top, bot, U, narrow, fs: narrow ? 13 : 15 };
    // step 0 portrait
    G.hr = clamp((bot - top) * 0.135, 18, 86);
    if (env.mini) G.hr = clamp((bot - top) * 0.17, 14, 40);
    G.pcx = w / 2;
    G.pcy = top + (bot - top) * (env.mini ? 0.3 : 0.3) + G.hr * (env.mini ? 0 : 0.3);
    // step 2 story
    G.scx = w / 2;
    G.scy = top + (bot - top) * 0.44;
  }

  const targetOf = (s) => (s === 2 ? [G.scx, G.scy] : [G.pcx, G.pcy]);

  // default polar positions for a step at a given time since the step began
  function defaults(s, since) {
    if (s === 0) return CLUSTER;
    const k = smooth((since - 0.5) / 1.5);
    return CLUSTER.map((c, i) => [lerp(c[0], SPREAD[i][0], k), lerp(c[1], SPREAD[i][1], k)]);
  }

  // polar (angle°, r) around a step's target ↔ canvas; step 2 is stretched to the canvas shape
  function scales(s) {
    if (s === 0) return [(G.hr * 3.6) / 0.36, (G.hr * 3.6) / 0.36];
    return [Math.min(G.w * 0.3, 340) / 0.36, Math.min((G.bot - G.top) * 0.3, 240) / 0.36];
  }

  function sourcePos(s, since) {
    const [tx, ty] = targetOf(s);
    const pol = placed[s] || defaults(s, since);
    const [kx, ky] = scales(s);
    return pol.map(([a, r]) => [clamp(tx + Math.cos(a * DEG) * r * kx, 18, G.w - 18), clamp(ty + Math.sin(a * DEG) * r * ky, G.top + 10, G.bot - 46)]);
  }

  // how many independent directions the sources look from (1..3)
  function independent(pts, tx, ty) {
    const a = pts.map(([x, y]) => Math.atan2(y - ty, x - tx)).sort((p, q) => p - q);
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const gap = i < 2 ? a[i + 1] - a[i] : a[0] + Math.PI * 2 - a[2];
      if (gap > 38 * DEG) n++;
    }
    return Math.max(1, n);
  }

  // many short pencil strokes in one path: segs = [x1, y1, x2, y2, …]
  function strokes(segs, o = {}) {
    const g = env.g;
    const r = rng((o.seed || 1) * 31 + env.boil * 7);
    const j = o.j ?? 0.9;
    g.save();
    g.strokeStyle = o.color || env.c.pencil;
    g.globalAlpha *= o.alpha ?? 0.75;
    g.lineWidth = o.w || 1;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < segs.length; i += 4) {
      g.moveTo(segs[i] + (r() - 0.5) * j, segs[i + 1] + (r() - 0.5) * j);
      g.lineTo(segs[i + 2] + (r() - 0.5) * j, segs[i + 3] + (r() - 0.5) * j);
    }
    g.stroke();
    g.restore();
  }

  const textW = (str, size, kind = 'hand') => {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size);
    const v = g.measureText(str).width;
    g.restore();
    return v;
  };

  // ── a head-and-shoulders silhouette ──
  function inside(x, y, cx, cy, hr) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < hr * hr) return true;
    if (y > cy + hr * 0.85 && y < cy + hr * 1.45 && Math.abs(dx) < hr * 0.4) return true;
    if (y > cy + hr * 1.3 && y < cy + hr * 2.9) {
      const k = smooth((y - (cy + hr * 1.3)) / (hr * 0.8));
      return Math.abs(dx) < lerp(hr * 0.9, hr * 2.2, k);
    }
    return false;
  }

  function silhouettePath(g, cx, cy, hr) {
    g.beginPath();
    g.arc(cx, cy, hr, 0, Math.PI * 2);
    g.moveTo(cx - hr * 2.2, cy + hr * 2.9);
    for (let q = 0; q <= 10; q++) {
      const k = q / 10;
      const y = lerp(cy + hr * 2.9, cy + hr * 1.3, k);
      g.lineTo(cx - lerp(hr * 2.2, hr * 0.9, smooth(k)), y);
    }
    g.lineTo(cx - hr * 0.4, cy + hr * 1.3);
    g.lineTo(cx - hr * 0.4, cy + hr * 0.8);
    g.lineTo(cx + hr * 0.4, cy + hr * 0.8);
    g.lineTo(cx + hr * 0.4, cy + hr * 1.3);
    for (let q = 10; q >= 0; q--) {
      const k = q / 10;
      const y = lerp(cy + hr * 2.9, cy + hr * 1.3, k);
      g.lineTo(cx + lerp(hr * 2.2, hr * 0.9, smooth(k)), y);
    }
    g.closePath();
  }

  // the portrait: pencil left of a jagged seam, glyphs right of it. T = trust (seam moves right)
  function portrait(cx, cy, hr, T, t, a) {
    const { g, ink, ascii, c } = env;
    const cell = clamp(hr / 8, 5, 9);
    const tick = Math.floor(t * 7);
    const amp = (1 - T) * hr * 0.55;
    const base = cx - hr * 0.05 + T * hr * 2.6;
    const rows = [];
    const y0 = cy - hr * 1.1;
    const y1 = cy + hr * 2.95;
    for (let y = y0; y <= y1 + cell; y += cell) {
      const row = Math.round((y - y0) / cell);
      // the seam glitches in blocks of rows
      const n = noise2(Math.floor(row / 3) * 0.7, tick * 0.31);
      rows.push([y, base + n * amp + (hash(row, tick) < 0.08 * (1 - T) ? (hash(row + 9, tick) - 0.5) * hr * 1.6 : 0)]);
    }
    const seamAt = (y) => rows[clamp(Math.round((y - y0) / cell), 0, rows.length - 1)][1];
    // glyph half
    ascii.field(cx - hr * 2.3, y0, hr * 4.6, y1 - y0, cell, (x, y) => {
      if (x < seamAt(y) || !inside(x, y, cx, cy, hr)) return -1;
      const light = 0.5 + 0.5 * noise2(x * 0.03, y * 0.03);
      return 0.2 + 0.32 * light + (x - cx) / (hr * 10);
    }, c.ink, 0.9 * a);
    // pencil half, clipped to the left of the seam
    g.save();
    g.beginPath();
    g.moveTo(cx - hr * 3, y0 - cell);
    rows.forEach(([y, sx]) => {
      g.lineTo(sx, y - cell / 2);
      g.lineTo(sx, y + cell / 2);
    });
    g.lineTo(cx - hr * 3, y1 + cell);
    g.closePath();
    g.clip();
    // hatching inside the silhouette
    g.save();
    silhouettePath(g, cx, cy, hr);
    g.clip();
    const segs = [];
    const gap = Math.max(3.5, hr / 11);
    for (let d = -hr * 6; d < hr * 6; d += gap) segs.push(cx + d - hr * 3, y1, cx + d + hr * 1.2, y0);
    strokes(segs, { seed: 7, alpha: 0.32 * a, w: 0.8 });
    g.restore();
    ink.circle(cx, cy, hr, { seed: 3, w: 1.6, alpha: 0.95 * a });
    const sh = [];
    for (let q = 0; q <= 10; q++) {
      const k = q / 10;
      sh.push([cx - lerp(hr * 2.2, hr * 0.9, smooth(k)), lerp(cy + hr * 2.9, cy + hr * 1.3, k)]);
    }
    ink.path([...sh, [cx - hr * 0.4, cy + hr * 1.25], [cx - hr * 0.4, cy + hr * 0.9]], { seed: 4, w: 1.6, alpha: 0.95 * a });
    ink.path(sh.map(([x, y]) => [2 * cx - x, y]).concat([[cx + hr * 0.4, cy + hr * 1.25], [cx + hr * 0.4, cy + hr * 0.9]]), { seed: 5, w: 1.6, alpha: 0.95 * a });
    g.restore();
  }

  // ── sources: three pencil circles, glyph beams to their target ──
  function drawSources(pts, tx, ty, n, a, tr, hover) {
    const { ink, ascii, c } = env;
    const cell = G.narrow ? 8 : 10;
    pts.forEach(([x, y], i) => {
      const d = Math.hypot(tx - x, ty - y);
      const ux = (tx - x) / d;
      const uy = (ty - y) / d;
      let stop = d - tr;
      // on the portrait: stop where the beam meets the silhouette
      if (tr < 0) {
        stop = 0;
        while (stop < d && !inside(x + ux * stop, y + uy * stop, G.pcx, G.pcy, G.hr)) stop += 4;
        stop -= 6;
      }
      if (stop > 20) {
        if (n === 3) ink.line(x + ux * 14, y + uy * 14, x + ux * stop, y + uy * stop, { seed: 60 + i, w: 1, alpha: 0.7 * a, passes: 1 });
        else ascii.line(x + ux * 16, y + uy * 16, x + ux * stop, y + uy * stop, cell, c.ink, 0.55 * a, '·');
      }
      if (hover === i || dragging === i) ink.blob(x, y, 17, { seed: 70 + i, alpha: c.hlAlpha * 0.6 * a });
      ink.circle(x, y, 11, { seed: 80 + i, w: 1.4, alpha: 0.95 * a });
      ink.dot(x, y, 3, { seed: 85 + i, alpha: a });
      if (G.narrow) ink.text(SOURCES[i], x - 16, y + 5, { size: 13, align: 'right', color: c.ink2, alpha: a });
      else ink.text(SOURCES[i], x, y + 28, { size: 14, align: 'center', color: c.ink2, alpha: a });
    });
  }

  function sourceAt(x, y) {
    let best = -1;
    let bd = 30 * 30;
    shown.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // ── step 1: the badge of trust and its two moves ──
  function stations() {
    const { w, top, bot, U, narrow } = G;
    const y = top + (bot - top) * 0.5;
    const S = clamp(U * 0.125, 32, 92);
    return { y, S, xs: [w * (narrow ? 0.17 : 0.18), w * 0.5, w * (narrow ? 0.83 : 0.82)] };
  }

  function face(cx, cy, r, a, t, k) {
    const { ascii, c } = env;
    const cell = clamp(r / 4.2, 4.5, 8);
    const tick = Math.floor(t * 8 + k * 3);
    ascii.field(cx - r * 2.3, cy - r * 1.1, r * 4.6, r * 4.1, cell, (x, y) => {
      if (!inside(x, y, cx, cy, r)) return -1;
      if (hash(Math.round(x), Math.round(y), tick) < 0.12) return -1;
      return 0.3 + 0.4 * (0.5 + 0.5 * noise2(x * 0.05 + k, y * 0.05 + tick * 0.1));
    }, c.ink, 0.85 * a);
  }

  function drawStep1(a, since, t) {
    const { ink, c } = env;
    const { narrow } = G;
    const { y, S, xs } = stations();
    // 媒體: a newspaper
    {
      const x = xs[0];
      const W = S * 1.3;
      const H = S * 1.0;
      ink.rect(x - W / 2, y - H / 2, W, H, { seed: 100, w: 1.3, alpha: 0.9 * a });
      ink.line(x - W / 2 + 7, y - H / 2 + 11, x + W / 2 - 7, y - H / 2 + 11, { seed: 101, w: 2.4, alpha: 0.85 * a });
      const segs = [];
      for (let q = 0; q < 4; q++) {
        const yy = y - H / 2 + 22 + q * (H - 30) / 4;
        segs.push(x - W / 2 + 7, yy, x - 3, yy, x + 4, yy, x + W / 2 - 7, yy);
      }
      strokes(segs, { seed: 102, alpha: 0.6 * a, w: 0.9 });
    }
    // 創作者: a person inside a video frame
    {
      const x = xs[1];
      const W = S * 1.3;
      const H = S * 1.0;
      ink.rect(x - W / 2, y - H / 2, W, H, { seed: 110, w: 1.3, alpha: 0.9 * a });
      const r = H * 0.17;
      ink.circle(x, y - H * 0.1, r, { seed: 111, w: 1.2, alpha: 0.9 * a });
      ink.path([[x - r * 2.2, y + H / 2], [x - r * 1.8, y + r * 1.4], [x + r * 1.8, y + r * 1.4], [x + r * 2.2, y + H / 2]], { seed: 112, w: 1.2, alpha: 0.9 * a });
      const px = x + W / 2 - 13;
      const py = y - H / 2 + 12;
      ink.poly([[px - 4, py - 5], [px + 5, py], [px - 4, py + 5]], { seed: 113, w: 1, alpha: 0.85 * a, closed: true });
    }
    // 生成的身分: three glyph faces
    const fr = S * 0.22;
    const faces = [[xs[2] - S * 0.52, y - S * 0.1], [xs[2], y - S * 0.32], [xs[2] + S * 0.52, y - S * 0.1]];
    faces.forEach(([fx, fy], k) => face(fx, fy, fr, a * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.3 + k * 2))), t, k));
    // labels
    const names = [['過去', '媒體', '查證的守門人'], ['後來', '創作者', 'Joeman 開箱陶朱隱園'], ['今天', '生成的身分', '內容與身分都可能被生成']];
    names.forEach(([when, name, sub], i) => {
      const x = xs[i];
      ink.text(when, x, y - S * 1.05 - 6, { size: 14, align: 'center', color: c.ink2, alpha: a });
      ink.text(name, x, y + S * 0.95 + 8, { size: narrow ? 15 : 18, align: 'center', alpha: a });
      if (!narrow) ink.text(sub, x, y + S * 0.95 + 30, { size: 13, align: 'center', color: c.ink2, alpha: a });
    });
    // the two transfers
    const arcs = [[xs[0], xs[1], '第一次轉移'], [xs[1], xs[2], '第二次轉移']];
    arcs.forEach(([x0, x1, lab], i) => {
      const k = smooth((since - 0.4 - i * 0.9) / 0.6);
      if (k <= 0) return;
      const ax0 = x0 + S * 0.75;
      const ax1 = x1 - S * 0.75;
      const pts = [];
      const N = 12;
      for (let q = 0; q <= N * k; q++) {
        const u = q / N;
        pts.push([lerp(ax0, ax1, u), y - S * 0.62 - Math.sin(u * Math.PI) * S * 0.55]);
      }
      if (pts.length > 1) ink.path(pts, { seed: 120 + i, w: 1.1, alpha: 0.8 * a });
      if (k > 0.98) {
        ink.line(ax1, y - S * 0.62, ax1 - 8, y - S * 0.62 - 6, { seed: 124 + i, w: 1.1, alpha: 0.8 * a });
        ink.line(ax1, y - S * 0.62, ax1 - 2, y - S * 0.62 - 10, { seed: 126 + i, w: 1.1, alpha: 0.8 * a });
        if (!narrow) ink.text(lab, (ax0 + ax1) / 2, y - S * 1.3 - 6, { size: 14, align: 'center', color: c.ink2, alpha: a });
      }
    });
    // the badge: settles on 媒體, then 創作者, then cannot settle
    const br = clamp(S * 0.3, 13, 22);
    const k1 = smooth((since - 0.4) / 0.7);
    const k2 = smooth((since - 1.3) / 0.7);
    let bx = lerp(lerp(xs[0], xs[1], k1), xs[2], k2) + S * 0.55;
    let by = y - S * 0.45 - Math.sin(k1 * Math.PI) * S * 0.6 - Math.sin(k2 * Math.PI) * S * 0.6;
    const lost = smooth((since - 2.0) / 0.4);
    if (lost > 0) {
      // wandering between faces, never landing
      const ph = t * 1.4;
      const f0 = faces[Math.floor(ph) % 3];
      const f1 = faces[(Math.floor(ph) + 1) % 3];
      const u = smooth(ph % 1);
      const wx = lerp(f0[0], f1[0], u);
      const lift = narrow ? 1.3 : 1.9;
      const wy = lerp(f0[1], f1[1], u) - fr * lift - Math.sin(u * Math.PI) * fr;
      bx = lerp(bx, wx, lost);
      by = lerp(by, wy, lost);
      faces.forEach(([fx, fy], q) => ink.blob(fx, fy - fr * lift, br * 0.8, { seed: 140 + q, alpha: c.hlAlpha * 0.3 * a * lost }));
      env.ascii.glyph('?', xs[2] + S * 0.95, y - S * 0.75, narrow ? 16 : 22, c.ink, 0.85 * a * lost);
    }
    ink.blob(bx, by, br, { seed: 130, alpha: c.hlAlpha * a });
    ink.circle(bx, by, br, { seed: 131, w: 1.1, alpha: 0.85 * a, passes: 1 });
    ink.text('信任', bx, by + 5, { size: clamp(br * 0.75, 12, 15), align: 'center', alpha: a });
  }

  // ── step 2: the story in the middle ──
  // what is known about the story: a glyph cloud of uncertainty, long along a single line of sight,
  // smaller with two directions, a solid pencil point with three
  function drawStory(a, T, t) {
    const { ink, ascii, c } = env;
    const { scx, scy, narrow } = G;
    // the mean direction the sources look from
    let mx = 0;
    let my = 0;
    shown.forEach((p) => {
      const d = Math.hypot(p.x - scx, p.y - scy) || 1;
      mx += (p.x - scx) / d;
      my += (p.y - scy) / d;
    });
    const ml = Math.hypot(mx, my) || 1;
    const ux = mx / ml;
    const uy = my / ml;
    const L = (narrow ? 90 : 150) * (1 - T) + 6;
    const W = (narrow ? 18 : 26) * (1 - T * 0.85) + 4;
    const cell = narrow ? 8 : 10;
    const R = L + 10;
    const tick = Math.floor(t * 5);
    if (T < 0.97) {
      ascii.field(scx - R, scy - R, R * 2, R * 2, cell, (x, y) => {
        const dx = x - scx;
        const dy = y - scy;
        const along = dx * ux + dy * uy;
        const across = -dx * uy + dy * ux;
        const v = Math.exp(-(along * along) / (L * L) - (across * across) / (W * W));
        if (v < 0.12) return -1;
        return hash(Math.round(x), Math.round(y), tick) < 0.15 ? -1 : 0.15 + v * 0.45;
      }, c.ink, 0.8 * a * (1 - T));
    }
    if (T > 0.05) {
      ink.blob(scx, scy, 22 * T, { seed: 202, alpha: c.hlAlpha * a * T });
      ink.dot(scx, scy, 7 * T, { seed: 203, alpha: a * T });
    }
    const lab = T > 0.9 ? '可以被相信' : '這個故事';
    ink.text(lab, scx, scy - Math.max(30, W + 18), { size: narrow ? 14 : 16, align: 'center', color: T > 0.9 ? c.ink : c.ink2, alpha: a });
  }

  // ── step 3: the javelin and the noise ──
  function drawStep3(a, since, t) {
    const { ink, ascii, c } = env;
    const { w, top, bot, U, narrow, fs } = G;
    const gy = top + (bot - top) * 0.8;
    const x0 = w * (narrow ? 0.12 : 0.14);
    const x1 = w * (narrow ? 0.84 : 0.8);
    const hy = gy - clamp(U * 0.12, 30, 76);
    const H = (gy - top) * 0.58;
    const p = clamp((since - 0.25) / 1.25);
    const landed = p >= 1;
    const tl = 1.5; // landing time
    const quiet = landed ? clamp((since - tl) / 1.4) : 0;
    // the noise: criticism in glyphs, silenced in a ring from the landing point
    const cell = narrow ? 10 : 13;
    const nx0 = w * 0.3;
    const tick = Math.floor(t * 6);
    // the silence spreads from the landing point; a faint murmur stays at the far edge
    const ringR = quiet * Math.hypot(x1 - nx0, gy - top) * 0.82;
    for (let y = top + cell; y < gy - cell * 1.5; y += cell) {
      for (let x = nx0; x < w - 12; x += cell) {
        const col = Math.round(x / cell);
        const row = Math.round(y / cell);
        const n = noise2(col * 0.18 + tick * 0.05, row * 0.22);
        if (n < 0.14) continue;
        const d = Math.hypot(x - x1, y - gy);
        const fade = clamp((d - ringR) / 80);
        const edge = clamp((x - nx0) / 120);
        const al = 0.75 * fade * edge * (1 - 0.5 * quiet);
        if (al < 0.03) {
          if (hash(col, row) < 0.05) ascii.glyph('·', x, y, cell, c.ink, 0.35 * a);
          continue;
        }
        const ch = NOISE[Math.floor(hash(col, row, tick) * NOISE.length)];
        ascii.glyph(ch, x + (hash(col, tick) - 0.5) * 2, y, cell, c.ink, al * a);
      }
    }
    const nl = 1 - quiet;
    if (nl > 0.05) ink.text('質疑與批評聲浪', w - 16, top + 6, { size: fs, align: 'right', color: c.ink2, alpha: a * nl });
    if (quiet > 0.5) ink.text('批評安靜了下來', w - 16, top + 6, { size: fs, align: 'right', alpha: a * (quiet * 2 - 1) });
    // ground
    ink.line(w * 0.04, gy, w * 0.96, gy, { seed: 300, w: 1.2, alpha: 0.8 * a });
    // the thrower: a pencil figure, arm still up
    const fr = clamp(U * 0.028, 7, 17);
    const fx = x0;
    const fy = gy - fr * 7.2;
    ink.circle(fx, fy, fr, { seed: 301, w: 1.3, alpha: 0.95 * a });
    ink.path([[fx, fy + fr], [fx - fr * 0.3, fy + fr * 3.6], [fx - fr * 0.1, gy - fr * 2.8]], { seed: 302, w: 1.4, alpha: 0.95 * a });
    ink.path([[fx - fr * 0.1, gy - fr * 2.8], [fx - fr * 1.2, gy]], { seed: 303, w: 1.3, alpha: 0.95 * a });
    ink.path([[fx - fr * 0.1, gy - fr * 2.8], [fx + fr * 1.1, gy]], { seed: 304, w: 1.3, alpha: 0.95 * a });
    ink.path([[fx - fr * 0.15, fy + fr * 1.7], [fx + fr * 1.0, fy + fr * 0.4], [fx + fr * 1.6, fy - fr * 1.2]], { seed: 305, w: 1.3, alpha: 0.95 * a });
    ink.path([[fx - fr * 0.2, fy + fr * 1.8], [fx - fr * 1.4, fy + fr * 2.6]], { seed: 306, w: 1.3, alpha: 0.95 * a });
    ink.text('105 歲', fx, gy + 24, { font: 'mono', size: 13, align: 'center', alpha: a });
    // the flight
    const sx = fx + fr * 1.6;
    const sy = fy - fr * 1.2;
    const pos = (u) => [lerp(sx, x1, u), lerp(sy, gy, u) - 4 * H * u * (1 - u)];
    const trail = [];
    const upto = Math.min(p, 0.985);
    for (let u = 0; u <= upto; u += 0.03) {
      const [ax, ay] = pos(u);
      const [bx, by] = pos(Math.min(upto, u + 0.012));
      trail.push(ax, ay, bx, by);
    }
    if (trail.length) strokes(trail, { seed: 310, alpha: 0.45 * a, w: 1 });
    const L = clamp(U * 0.09, 26, 64);
    const [jx, jy] = pos(p);
    const [kx, ky] = pos(Math.max(0, p - 0.02));
    let ang = Math.atan2(jy - ky, jx - kx);
    if (p <= 0) ang = -Math.PI / 3;
    const tipX = landed ? x1 : jx;
    const tipY = landed ? gy + 4 : jy;
    ink.line(tipX - Math.cos(ang) * L, tipY - Math.sin(ang) * L, tipX, tipY, { seed: 311, w: 2, alpha: a });
    if (landed) {
      const k = smooth((since - tl) / 0.5);
      ink.blob(x1 + 2, gy - L * 0.62, clamp(U * 0.03, 12, 22) * k, { seed: 312, alpha: c.hlAlpha * a });
      ink.text('金', x1 + 2, gy - L * 0.62 + 6, { size: narrow ? 15 : 18, weight: 700, align: 'center', alpha: a * k });
      ink.text(narrow ? '擲出標槍奪金' : '105 歲爺爺擲出標槍奪金', x1, gy + 24, { size: fs, align: 'center', alpha: a * k });
      if (!narrow) ink.text('88 歲阿嬤跑完 100 公尺', x1, gy + 44, { size: 13, align: 'center', color: c.ink2, alpha: a * k });
    }
    if (!narrow) ink.text('沒有腳本，沒有包裝，更沒有 AI 生成', w * 0.04, bot, { size: fs, color: c.ink2, alpha: a });
  }

  // ── step 4: 內容庫 and 信任庫 ──
  const people = Array.from({ length: 64 }, (_, i) => ({ i, r: rng(400 + i)() }));
  function drawStep4(a, since, still) {
    const { ink, ascii, c } = env;
    const { w, top, bot, narrow, fs } = G;
    const base = bot - (narrow ? 36 : 50);
    // content stack: generated fast, again and again
    const sx = w * (narrow ? 0.27 : 0.3);
    const cw = clamp(w * 0.18, 76, 170);
    const ch = narrow ? 8 : 11;
    const pitch = ch + (narrow ? 4 : 6);
    const maxN = Math.floor((base - top - 40) / pitch);
    const made = still ? maxN + 6 : since * 9;
    const nCards = Math.min(maxN, Math.floor(made));
    const drop = still ? 0 : made % 1;
    const cc = narrow ? 7 : 10;
    for (let q = 0; q < nCards; q++) {
      const y = base - (q + 1) * pitch - (q === nCards - 1 && made < maxN ? (1 - smooth(drop)) * 20 : 0);
      // once the stack is full, the top keeps being rewritten: more of the same
      const id = q === nCards - 1 && made >= maxN ? Math.floor(made) : q;
      const len = Math.floor((cw * (0.72 + 0.28 * hash(q, 3))) / cc);
      for (let k = 0; k < len; k++) ascii.glyph(hash(k, id) < 0.15 ? ' ' : hash(k, id, 2) < 0.3 ? '+' : '=', sx - cw / 2 + k * cc + cc / 2, y + ch / 2, cc, c.ink, 0.8 * a);
    }
    ink.text('內容庫', sx, base + 26, { size: narrow ? 16 : 19, align: 'center', alpha: a });
    if (!narrow) ink.text('品牌說了多少話', sx, base + 46, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // trust jar
    const jx = w * (narrow ? 0.72 : 0.68);
    const jw = clamp(w * 0.24, 96, 230);
    const jh = Math.min((base - top) * 0.72, jw * 1.25);
    const jt = base - jh;
    const neck = jw * 0.32;
    const jar = [[jx - neck, jt - 14], [jx - neck, jt], [jx - jw / 2 + 10, jt + 18], [jx - jw / 2, jt + 40], [jx - jw / 2, base - 10], [jx - jw / 2 + 10, base], [jx + jw / 2 - 10, base], [jx + jw / 2, base - 10], [jx + jw / 2, jt + 40], [jx + jw / 2 - 10, jt + 18], [jx + neck, jt], [jx + neck, jt - 14]];
    ink.path(jar, { seed: 410, w: 1.5, alpha: 0.95 * a });
    ink.line(jx - neck - 6, jt - 14, jx + neck + 6, jt - 14, { seed: 411, w: 1.2, alpha: 0.85 * a });
    // people, settling bottom-up
    const pr = narrow ? 3.6 : 6.2;
    const sp = pr * 4.2;
    const cols = Math.max(3, Math.floor((jw - 16) / sp));
    const rowsMax = Math.floor((jh - 50) / (sp * 1.15));
    const cap = Math.min(people.length, cols * rowsMax);
    // people come slowly: trust is earned one person at a time
    const filled = still ? Math.round(cap * 0.7) : cap * (1 - Math.exp(-Math.max(0, since - 0.3) / 3.2));
    const heads = [];
    const bodies = [];
    for (let q = 0; q < filled; q++) {
      const col = q % cols;
      const row = Math.floor(q / cols);
      const tx = jx - ((cols - 1) * sp) / 2 + col * sp + (row % 2 ? sp * 0.25 : -sp * 0.1);
      const ty = base - 12 - pr * 2.6 - row * sp * 1.15;
      const k = still ? 1 : smooth((filled - q) / 1.2);
      const x = lerp(jx + (people[q].r - 0.5) * neck, tx, k);
      const y = lerp(jt - 30, ty, k * k);
      heads.push([x, y]);
      bodies.push(x - pr * 1.5, y + pr * 2.6, x - pr * 1.1, y + pr * 1.4, x - pr * 1.1, y + pr * 1.4, x + pr * 1.1, y + pr * 1.4, x + pr * 1.1, y + pr * 1.4, x + pr * 1.5, y + pr * 2.6);
      // a few of them speak for the brand
      if (q % 3 === 0 && k > 0.95) bodies.push(x + pr * 1.4, y - pr * 1.2, x + pr * 2.4, y - pr * 2.0);
    }
    const g = env.g;
    g.save();
    g.strokeStyle = c.pencil;
    g.globalAlpha *= 0.85 * a;
    g.lineWidth = 1.1;
    g.beginPath();
    heads.forEach(([x, y]) => {
      g.moveTo(x + pr, y);
      g.arc(x, y, pr, 0, Math.PI * 2);
    });
    g.stroke();
    g.restore();
    strokes(bodies, { seed: 420, alpha: 0.85 * a, w: 1.1, j: 0.5 });
    if (filled > 1) ink.marker(jx - jw / 2 + 6, base - 8 - Math.ceil(filled / cols) * sp * 1.15, jw - 12, Math.ceil(filled / cols) * sp * 1.15, { seed: 430, alpha: c.hlAlpha * 0.45 * a });
    ink.text('信任庫', jx, base + 26, { size: narrow ? 16 : 19, align: 'center', alpha: a });
    if (!narrow) ink.text('有多少人願意替品牌說話', jx, base + 46, { size: 13, align: 'center', color: c.ink2, alpha: a });
    ink.text(narrow ? '公關創造可信度' : '廣告創造注意力，公關創造可信度', w / 2, top + 6, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 5: three turns ──
  function drawStep5(a, since) {
    const { ink, ascii, c } = env;
    const { w, top, bot, narrow } = G;
    const items = ART.framework.items;
    ink.text(ART.framework.name, w / 2, top + 6, { size: narrow ? 16 : 19, align: 'center', alpha: a });
    const mid = w * (narrow ? 0.46 : 0.45);
    const gap = narrow ? 34 : 96;
    items.forEach(([turn, sub], i) => {
      const [from, to] = turn.split(' → ');
      const y = top + (bot - top) * (0.22 + i * 0.29);
      const k = smooth((since - 0.2 - i * 0.35) / 0.6);
      const ls = narrow ? 14 : 17;
      // from: typeset, with a glyph rule
      ink.text(from, mid - gap / 2 - 10, y + 6, { font: 'body', size: ls, align: 'right', color: c.ink2, alpha: a });
      const fw = textW(from, ls, 'body');
      ascii.line(mid - gap / 2 - 10 - fw, y + 16, mid - gap / 2 - 10, y + 16, 7, c.ink, 0.45 * a, '-');
      // the arrow, drawn in
      const ax0 = mid - gap / 2;
      const ax1 = lerp(ax0, mid + gap / 2, k);
      if (k > 0.02) ink.line(ax0, y, ax1, y, { seed: 500 + i, w: 1.4, alpha: 0.95 * a });
      if (k > 0.95) {
        ink.line(ax1, y, ax1 - 8, y - 6, { seed: 504 + i, w: 1.3, alpha: 0.95 * a });
        ink.line(ax1, y, ax1 - 8, y + 6, { seed: 508 + i, w: 1.3, alpha: 0.95 * a });
      }
      // to: pencil, highlighted
      const ts = narrow ? 16 : 21;
      const tw = textW(to, ts);
      const tx = mid + gap / 2 + 10;
      if (k > 0.5) {
        const kk = smooth((k - 0.5) * 2);
        ink.marker(tx - 4, y - ts * 0.75, (tw + 8) * kk, ts * 1.15, { seed: 512 + i, alpha: c.hlAlpha * a });
        ink.text(to, tx, y + ts * 0.32, { size: ts, alpha: a * kk });
        if (narrow) ink.text(sub, w / 2, y + 30, { size: 13, align: 'center', color: c.ink2, alpha: a * kk });
        else ink.text(sub, tx, y + 32, { size: 14, color: c.ink2, alpha: a * kk });
      }
    });
  }

  return {
    resize: geom,
    down(x, y) {
      const s = env.step;
      if ((s === 0 || s === 2) && !env.mini) dragging = sourceAt(x, y);
    },
    drag(x, y) {
      if (dragging < 0) return;
      const s = env.step;
      const [tx, ty] = targetOf(s);
      if (!placed[s]) placed[s] = defaults(s, 99).map((p) => p.slice());
      const [kx, ky] = scales(s);
      const px = (x - tx) / kx;
      const py = (y - ty) / ky;
      placed[s][dragging] = [Math.atan2(py, px) / DEG, clamp(Math.hypot(px, py), 0.12, 0.9)];
    },
    up() {
      dragging = -1;
    },
    frame(t, dt) {
      const { ink, c, w, pointer } = env;
      const s = env.mini ? 0 : env.step;
      const still = dt === 0;
      const since = still ? 99 : t - env.stepAt;
      for (let i = 0; i < 6; i++) m[i] = still ? (i === s ? 1 : 0) : approach(m[i], i === s ? 1 : 0, dt, 0.25);

      // sources and how independent they are (steps 0 and 2)
      const srcStep = s === 2 ? 2 : 0;
      const pts = sourcePos(srcStep, since);
      pts.forEach(([x0, y0], i) => {
        // keep each source (and its label) inside the pane
        const x = clamp(x0, 28, w - 28);
        const y = clamp(y0, 50, env.h - 92);
        if (firstFrame || still || dragging === i) {
          shown[i].x = x;
          shown[i].y = y;
        } else {
          shown[i].x = approach(shown[i].x, x, dt, 0.18);
          shown[i].y = approach(shown[i].y, y, dt, 0.18);
        }
      });
      firstFrame = false;
      const [tx, ty] = targetOf(srcStep);
      const n = independent(shown.map((p) => [p.x, p.y]), tx, ty);
      const wantT = (n - 1) / 2;
      trust = still ? wantT : approach(trust, wantT, dt, 0.3);
      const hover = pointer.in && dragging < 0 ? sourceAt(pointer.x, pointer.y) : -1;
      const srcA = env.mini ? 0 : Math.max(m[0], m[2]);

      // step 0: the portrait
      if (m[0] > 0.02) {
        const a = m[0];
        portrait(G.pcx, G.pcy, G.hr, env.mini ? 0 : trust, t, a);
        if (env.mini) {
          ink.text('眼前的人，是否真實存在？', w / 2, G.bot - 4, { size: 13, align: 'center', alpha: a });
        } else {
          const qy = G.pcy + G.hr * 2.9 + (G.narrow ? 24 : 36);
          ink.text(trust > 0.9 ? '三個獨立來源：可信度開始建立' : '眼前的人，是否真實存在？', w / 2, Math.min(qy, G.bot - 22), { size: G.narrow ? 16 : 20, align: 'center', alpha: a });
          if (!G.narrow) {
            ink.text('過去內容最大的成本是生產，今天是驗證', w / 2, G.bot, { size: 14, align: 'center', color: c.ink2, alpha: a });
            ink.text('真實的人', G.pcx - G.hr * 2.5, G.pcy + G.hr * 2.6, { size: 15, align: 'right', color: c.ink2, alpha: a * (1 - trust) });
            ink.text('生成的身分', G.pcx + G.hr * 2.5, G.pcy + G.hr * 2.6, { font: 'body', size: 14, color: c.ink2, alpha: a * (1 - trust) });
          }
        }
      }
      if (m[2] > 0.02) {
        const a = m[2];
        drawStory(a, trust, t);
        ink.text('這個故事能被驗證嗎？', w / 2, G.top + 6, { size: G.narrow ? 16 : 19, align: 'center', alpha: a });
        // three states, the current one highlighted
        const sy = G.bot - (G.narrow ? 2 : 26);
        const label = STATUS[n - 1];
        const lw = textW(label, G.narrow ? 15 : 17);
        if (n === 3) ink.marker(w / 2 - lw / 2 - 8, sy - 19, lw + 16, 27, { seed: 220, alpha: c.hlAlpha * a });
        ink.text(label, w / 2, sy, { size: G.narrow ? 15 : 17, align: 'center', alpha: a });
        if (!G.narrow) ink.text('真相藏在證據裡，不在敘事裡', w / 2, G.bot, { size: 13, align: 'center', color: c.ink2, alpha: a });
      }
      if (srcA > 0.02) {
        const tr = srcStep === 2 ? 14 : -1;
        drawSources(shown.map((p) => [p.x, p.y]), tx, ty, n, srcA, tr, hover);
      }
      if (m[1] > 0.02) drawStep1(m[1], since, t);
      if (m[3] > 0.02) drawStep3(m[3], since, t);
      if (m[4] > 0.02) drawStep4(m[4], since, still);
      if (m[5] > 0.02) drawStep5(m[5], since);
    },
  };
}
