// 05 AI 代理時代的增長架構師 — strategy drawn as an architect's blueprint: from 商業課題 up to 成長績效.
// step 0  the blueprint: a building rises from 商業課題 (base) to 成長績效 (roof); the old 傳播答案 shed beside it
// step 1  先定義對的成長課題: symptoms on the surface (聲量不足、轉換不佳), their roots under the ground
// step 2  從人性出發: AI's answers pile into a neat bell of glyphs; human motives are pencil scribbles outside it
// step 3  數據精準，人性破局 (Speak): a glyph arrow reaches the person; the bubble hesitates one second, then speaks
// step 4  預見下一個商機: AI extends the past; the architect stakes out the 2030s themes away from that line
// step 5  智能與人性並進的增長系統: the five directions as five floors, half glyph (智能), half pencil (人性)
// Click: dig up a root, light a floor, a motive or a future theme; replay the second before speaking.
import { ARTICLES } from '../content.js';
import { rng, smooth, lerp, approach, clamp, noise2 } from '../engine/noise.js';

export const hint = '點一下，看見根因';

const FLOORS = ARTICLES.find((a) => a.no === 5).framework.items; // [['01', '讓品牌進入 AI 代理的決策語境'], …]
const SYMPTOMS = [
  ['聲量不足', '定位不清'],
  ['轉換不佳', '信任不足'],
];
// motives from the text: 害怕丟臉而放棄學習、想被理解而加入社群、焦慮而追求療癒、厭倦演算法餵養的相似內容
const MOTIVES = [
  ['害怕丟臉', -0.62, 0.26],
  ['想被理解', 0.6, 0.2],
  ['焦慮', -0.58, 0.58],
  ['厭倦演算法', 0.62, 0.56],
];
// 十大未來主題: five are named in the text, the other five are left as unnamed signals
const THEMES = [
  ['AI 革命', 0.1, 0.62],
  ['高齡', 0.3, 0.2],
  ['永續', 0.52, 0.5],
  ['數位娛樂', 0.72, 0.16],
  ['新孤獨生活型態', 0.84, 0.48],
  ['', 0.2, 0.36],
  ['', 0.42, 0.74],
  ['', 0.6, 0.3],
  ['', 0.9, 0.78],
  ['', 0.96, 0.24],
];

export default function make(env) {
  const m = [1, 0, 0, 0, 0, 0]; // how much of each step is on screen
  const B = { x: 0, y: 0, w: 0, h: 0, a: 1 }; // building: centre x, base y, width, height, alpha
  let G = {};
  let build = 0; // 0..1 the first construction of the building
  let first = true;
  const lit = new Set(); // lit floors (steps 0 and 5)
  const litMotive = new Set();
  const litTheme = new Set();
  const dug = [null, null]; // time each root started to grow
  let speakAt = 0; // step 3 sequence start

  function geom() {
    const { w, h } = env;
    const top = env.mini ? 22 : 48;
    const bot = env.mini ? h - 16 : h - 60;
    const U = Math.min(w, h);
    const narrow = w < 560;
    G = { w, h, top, bot, U, narrow, fs: narrow ? 13 : 15, grid: clamp(U / 21, 18, 30) };
    G.gy = top + (bot - top) * 0.42; // step 1 ground
    G.bellBase = top + (bot - top) * 0.8;
    G.bellW = Math.min(w * 0.58, 560);
    G.cell = clamp(U / 64, 7, 10.5);
    G.axisY = top + (bot - top) * 0.86;
    if (first) {
      Object.assign(B, target(env.step));
      first = false;
    }
  }

  // where the building stands in each step
  function target(s) {
    const { w, top, bot, narrow, gy } = G;
    const w0 = clamp(w * 0.24, 92, 228);
    const base0 = bot - (narrow ? 16 : 24);
    const h0 = Math.max(40, base0 - top - (env.mini ? 12 : 44));
    if (s === 0 || env.mini) return { x: narrow || env.mini ? w * 0.5 : w * 0.57, y: base0, w: w0, h: h0, a: 1 };
    if (s === 5) {
      const base = bot - (narrow ? 22 : 26);
      return { x: narrow ? w * 0.17 : w * 0.27, y: base, w: narrow ? clamp(w * 0.18, 56, 80) : clamp(w * 0.2, 70, 196), h: Math.max(40, base - top - (narrow ? 50 : 64)), a: 1 };
    }
    const h1 = (gy - top - 6) * 0.86;
    return { x: w * 0.5, y: gy, w: Math.max(54, (w0 * h1) / h0), h: h1, a: s === 1 ? 0.4 : 0 };
  }

  // floors of the building: [x0, y0, x1, y1] from the ground up; slab and roof bands
  function parts() {
    const x0 = B.x - B.w / 2;
    const x1 = B.x + B.w / 2;
    const slab = clamp(B.h * 0.08, 7, 28);
    const roof = clamp(B.h * 0.06, 6, 20);
    const fh = (B.h - slab - roof) / 5;
    const floors = [];
    for (let i = 0; i < 5; i++) {
      const yb = B.y - slab - i * fh;
      floors.push([x0, yb - fh, x1, yb]);
    }
    return { x0, x1, slab, roof, fh, floors, top: B.y - B.h };
  }

  // many short pencil strokes in one path: segs = [x1, y1, x2, y2, …]
  function strokes(segs, o = {}) {
    const g = env.g;
    const r = rng((o.seed || 1) * 31 + env.boil * 7);
    const j = o.j ?? 0.9;
    g.save();
    g.strokeStyle = o.color || env.c.pencil;
    g.globalAlpha = o.alpha ?? 0.75;
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

  // diagonal pencil hatching inside a box, one path
  function hatchBox(x, y, w, h, gap, o = {}) {
    const segs = [];
    for (let d = -h; d < w; d += gap) {
      const ax = x + Math.max(0, d);
      const ay = y + h - Math.max(0, -d);
      const len = Math.min(w - Math.max(0, d), h - Math.max(0, -d));
      segs.push(ax, ay, ax + len, ay - len);
    }
    strokes(segs, o);
  }

  const textW = (str, size, kind = 'hand') => {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size);
    const v = g.measureText(str).width;
    g.restore();
    return v;
  };

  // ── the building ──
  function drawBuilding(a, f5, hover) {
    const { ink, ascii, c, acc } = env;
    const P = parts();
    const { x0, x1, slab, roof, fh, floors } = P;
    const k = build;
    const reach = B.y - B.h * k; // how high the pencil has got
    // lit / hovered floors: highlighter under the pencil
    floors.forEach((f, i) => {
      if (f[3] < reach - 1) return;
      if (lit.has(i)) ink.marker(f[0] + 2, f[1] + 2, f[2] - f[0] - 4, f[3] - f[1] - 4, { seed: 60 + i, alpha: c.hlAlpha * a });
      else if (hover === i) ink.marker(f[0] + 2, f[1] + 2, f[2] - f[0] - 4, f[3] - f[1] - 4, { seed: 60 + i, alpha: c.hlAlpha * 0.35 * a });
    });
    // roof: 成長績效 in highlighter once it is built
    if (k > 0.97) ink.marker(x0 - 3, P.top - 2, B.w + 6, roof + 2, { seed: 71, alpha: c.hlAlpha * a });
    // step 5: each floor half glyph (智能), half pencil (人性)
    if (f5 > 0.02) {
      const cell = clamp(fh * 0.24, 6, 9);
      floors.forEach((f, i) => {
        const mid = (f[0] + f[2]) / 2;
        ascii.field(f[0] + 3, f[1] + 3, mid - f[0] - 5, f[3] - f[1] - 6, cell, (x, y) => 0.28 + 0.3 * (0.5 + 0.5 * noise2(x * 0.05 + i, y * 0.05)), c.ink, 0.75 * f5 * a);
        hatchBox(mid + 3, f[1] + 4, f[2] - mid - 6, f[3] - f[1] - 8, 5, { seed: 80 + i, alpha: 0.5 * f5 * a, w: 0.9 });
      });
    }
    // windows (elevation drawing), fading out as the floors fill in step 5
    const wa = (1 - f5) * a;
    if (wa > 0.02) {
      const segs = [];
      const ww = B.w * 0.16;
      const wh = fh * 0.42;
      floors.forEach((f) => {
        if (f[1] < reach) return;
        for (let q = 0; q < 3; q++) {
          const cx = lerp(f[0], f[2], 0.22 + q * 0.28);
          const cy = (f[1] + f[3]) / 2 - wh * 0.1;
          const l = cx - ww / 2;
          const r = cx + ww / 2;
          const t = cy - wh / 2;
          const b = cy + wh / 2;
          segs.push(l, t, r, t, r, t, r, b, r, b, l, b, l, b, l, t);
        }
      });
      strokes(segs, { seed: 90, alpha: 0.55 * wa, w: 0.9 });
    }
    // slab: 商業課題, hatched
    hatchBox(x0, B.y - slab, B.w, slab, 4, { seed: 95, alpha: 0.55 * a, w: 0.9 });
    // walls grow with k; floor lines appear as they are reached
    const o = { w: 1.4, alpha: 0.9 * a };
    ink.line(x0, B.y, x0, reach, { ...o, seed: 101 });
    ink.line(x1, B.y, x1, reach, { ...o, seed: 102 });
    ink.line(x0, B.y - slab, x1, B.y - slab, { ...o, seed: 103, w: 1.1 });
    floors.forEach((f, i) => {
      if (f[1] >= reach - 0.5) ink.line(x0, f[1], x1, f[1], { ...o, seed: 104 + i, w: 1.1 });
    });
    if (k > 0.97) {
      ink.line(x0 - 4, P.top, x1 + 4, P.top, { ...o, seed: 111 });
      ink.line(x0 - 4, P.top + roof, x1 + 4, P.top + roof, { ...o, seed: 112, w: 1 });
    }
    // construction lines: overshooting, faint
    const ca = 0.28 * a;
    strokes([x0, B.y + 14, x0, P.top - 26, x1, B.y + 14, x1, P.top - 26, x0 - 30, P.top, x1 + 30, P.top], { seed: 120, alpha: ca, w: 0.8 });
  }

  function floorAt(x, y) {
    if (B.a < 0.5 || build < 0.97) return -1;
    const P = parts();
    if (x < P.x0 - 6 || x > P.x1 + 6) return -1;
    return P.floors.findIndex((f) => y >= f[1] && y <= f[3]);
  }

  // ── step 1: symptom tags and their roots ──
  function symptomGeom(i) {
    const { w, gy, bot, narrow } = G;
    const side = i ? 1 : -1;
    const sx = w / 2 + side * (narrow ? w * 0.27 : Math.min(w * 0.3, 300));
    return { sx, sy: gy - (narrow ? 26 : 38), rx: sx + side * (narrow ? 4 : 18), ry: gy + (bot - gy) * (narrow ? 0.5 : 0.6) };
  }

  function drawStep1(a, t, dt) {
    const { ink, ascii, c } = env;
    const { w, gy, bot, narrow, fs } = G;
    // soil: sparse glyphs below the ground
    ascii.field(0, gy + 8, w, bot - gy - 4, 13, (x, y) => {
      const n = noise2(x * 0.018, y * 0.018);
      return n > 0.25 ? 0.1 + (n - 0.25) * 0.35 : -1;
    }, c.ink, 0.32 * a);
    SYMPTOMS.forEach(([sym, root], i) => {
      const { sx, sy, rx, ry } = symptomGeom(i);
      const tw = textW(sym, narrow ? 15 : 18) + 18;
      const th = narrow ? 26 : 32;
      // the tag on the surface, tied to the wall
      const side = i ? 1 : -1;
      const wallX = B.x + side * (B.w / 2);
      g0(() => {
        env.g.setLineDash([4, 4]);
        ink.line(sx - side * (tw / 2), sy, wallX + side * 4, gy - B.h * 0.45, { seed: 130 + i, w: 0.9, alpha: 0.6 * a, passes: 1 });
        env.g.setLineDash([]);
      });
      ink.line(sx, sy + th / 2, sx, gy, { seed: 133 + i, w: 1, alpha: 0.8 * a });
      ink.rect(sx - tw / 2, sy - th / 2, tw, th, { seed: 135 + i, w: 1.1, alpha: 0.9 * a, passes: 1 });
      if (!narrow) ink.text('看似', sx - tw / 2, sy - th / 2 - 8, { size: 13, color: c.ink2, alpha: a });
      ink.text(sym, sx, sy + (narrow ? 5 : 6), { size: narrow ? 15 : 18, align: 'center', alpha: a });
      // the root
      const p = dug[i] === null ? 0 : dt === 0 ? 1 : smooth((t - dug[i]) / 1.1);
      const n = 16;
      const pts = [];
      const upto = Math.max(1, Math.round(n * p));
      for (let q = 0; q <= upto; q++) {
        const k = q / n;
        pts.push([lerp(sx, rx, smooth(k)) + noise2(q * 0.6, i * 7) * 9 * Math.sin(k * Math.PI), lerp(gy, ry, k)]);
      }
      if (p > 0) {
        ink.path(pts, { seed: 140 + i, w: 1.5, alpha: 0.9 * a });
        // rootlets
        [0.35, 0.55, 0.75].forEach((k, j) => {
          if (p < k + 0.1) return;
          const [bx, by] = pts[Math.round(k * n)];
          const dir = j % 2 ? 1 : -1;
          const L = (bot - gy) * 0.12;
          ink.path([[bx, by], [bx + dir * L * 0.5, by + L * 0.35], [bx + dir * L, by + L * 0.8]], { seed: 150 + i * 5 + j, w: 0.9, alpha: 0.7 * a, passes: 1 });
        });
      } else {
        // not dug yet: a dashed stub and a question
        g0(() => {
          env.g.setLineDash([3, 5]);
          ink.line(sx, gy, sx, gy + (ry - gy) * 0.4, { seed: 160 + i, w: 1, alpha: 0.5 * a, passes: 1 });
          env.g.setLineDash([]);
        });
        ascii.glyph('?', sx, gy + (ry - gy) * 0.5, narrow ? 16 : 22, c.ink, 0.7 * a);
        // breathing ring: click me
        const br = 0.5 + 0.5 * Math.sin(t * 3 + i);
        ink.circle(sx, sy, tw * 0.62 + br * 4, { seed: 165 + i, w: 0.8, alpha: (0.25 + 0.25 * br) * a, passes: 1 });
      }
      if (p > 0.85) {
        const la = a * smooth((p - 0.85) / 0.15);
        const rw = textW(root, narrow ? 15 : 18) + 16;
        ink.dot(rx, ry, 4, { seed: 170 + i, alpha: la });
        ink.marker(rx - rw / 2, ry + 10, rw, narrow ? 24 : 30, { seed: 172 + i, alpha: c.hlAlpha * la });
        ink.text(root, rx, ry + (narrow ? 28 : 32), { size: narrow ? 15 : 18, align: 'center', alpha: la });
        if (!narrow) ink.text('背後可能是', rx + (i ? -12 : 12), ry + 4, { size: 13, align: i ? 'right' : 'left', color: c.ink2, alpha: la });
      }
    });
    if (!narrow) ink.text('問題定義對了，品牌、行銷與內容才不會各自為政', w / 2, bot, { size: fs, align: 'center', color: c.ink2, alpha: a });
  }

  // run a drawing callback inside save / restore
  function g0(fn) {
    env.g.save();
    fn();
    env.g.restore();
  }

  // ── step 2: the bell of glyphs and the scribbles outside it ──
  function motivePos(i) {
    const [, u, v] = MOTIVES[i];
    return [G.w / 2 + u * G.bellW * (G.narrow ? 0.82 : 0.86), G.top + v * (G.bot - G.top)];
  }

  function drawStep2(a, since) {
    const { ink, ascii, c } = env;
    const { w, top, bot, bellBase, bellW, cell, narrow, U } = G;
    const n = Math.floor(bellW / cell) | 1;
    const sig = n * 0.15;
    const peak = Math.floor(Math.min((bellBase - top - 80) * 0.78, sig * cell * 2.3) / cell);
    const fill = clamp(since / 1.4);
    const x0 = w / 2 - (n * cell) / 2;
    for (let i = 0; i < n; i++) {
      const d = (i - (n - 1) / 2) / sig;
      const rows = Math.round(peak * Math.exp(-0.5 * d * d));
      const show = Math.round(rows * smooth(fill * 1.3 - Math.abs(d) * 0.08));
      const x = x0 + i * cell + cell / 2;
      for (let r = 0; r < show; r++) ascii.glyph('0', x, bellBase - r * cell - cell / 2, cell, c.ink, (r === show - 1 ? 0.95 : 0.7) * a);
    }
    ink.line(w / 2 - bellW / 2 - 20, bellBase + 2, w / 2 + bellW / 2 + 20, bellBase + 2, { seed: 200, w: 1, alpha: 0.6 * a, passes: 1 });
    ink.text('合理 · 安全 · 平均', w / 2, bellBase + 28, { size: narrow ? 15 : 18, align: 'center', alpha: a });
    if (!narrow) ink.text('AI 擅長給出的答案', w / 2, bellBase - peak * cell - 14, { font: 'body', size: 13, align: 'center', color: c.ink2, alpha: a });
    // scribbles: tangled, never on the curve
    const R = clamp(U * 0.062, 16, 40);
    MOTIVES.forEach(([word], i) => {
      const [mx, my] = motivePos(i);
      const k = smooth(since * 1.2 - 0.4 - i * 0.18);
      if (k <= 0) return;
      if (litMotive.has(i)) ink.blob(mx, my, R * 1.25, { seed: 210 + i, alpha: c.hlAlpha * a });
      // a tangle: the loop keeps changing size, direction and centre
      const pts = [];
      const N = Math.round(46 * k);
      let ang = i * 1.7;
      for (let q = 0; q <= N; q++) {
        ang += 0.55 + 0.5 * noise2(q * 0.17, i * 5.3);
        const rr = R * (0.25 + 0.75 * Math.abs(noise2(q * 0.13, i * 3.1 + 2)));
        const ox = noise2(q * 0.05, i + 9) * R * 0.5;
        const oy = noise2(i + 4, q * 0.05) * R * 0.35;
        pts.push([mx + ox + Math.cos(ang) * rr, my + oy + Math.sin(ang * 1.21) * rr * 0.75]);
      }
      ink.path(pts, { seed: 220 + i, w: 1.1, alpha: 0.85 * a, wobble: 1.6 });
      ink.text(word, mx, my + R + (narrow ? 16 : 20), { size: narrow ? 14 : 16, align: 'center', alpha: a * k });
    });
    ink.text(narrow ? '不理性 · 矛盾 · 脆弱' : '人真實的動機：不理性、矛盾、脆弱', w / 2, top + 10, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
    if (!narrow) ink.text('這些不完美，才是策略的入口', w / 2, bot, { size: 16, align: 'center', alpha: a });
  }

  // ── step 3: Speak ──
  function speakGeom() {
    const { w, top, bot, U, narrow } = G;
    const hr = clamp(U * 0.055, 15, 34);
    const px = w * (narrow ? 0.7 : 0.62);
    const py = top + (bot - top) * 0.62;
    const bw = clamp(w * 0.2, 100, 190);
    const bh = bw * 0.58;
    const bx = Math.min(w - 16 - bw / 2, px + hr + bw * 0.36);
    const by = py - hr * 1.6 - bh / 2 - 4;
    return { hr, px, py, bw, bh, bx, by };
  }

  // a rounded speech-bubble outline as points (closed)
  function bubble(l, t, W, H) {
    const rr = Math.min(W, H) * 0.38;
    const pts = [];
    const corners = [[l + W - rr, t + rr, -Math.PI / 2], [l + W - rr, t + H - rr, 0], [l + rr, t + H - rr, Math.PI / 2], [l + rr, t + rr, Math.PI]];
    corners.forEach(([cx, cy, a0]) => {
      for (let q = 0; q <= 4; q++) {
        const a = a0 + (q / 4) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
    });
    pts.push(pts[0], pts[1]);
    return pts;
  }

  function drawStep3(a, tt) {
    const { ink, ascii, c } = env;
    const { w, bot, narrow, fs } = G;
    const { hr, px, py, bw, bh, bx, by } = speakGeom();
    // the person
    ink.circle(px, py, hr, { seed: 300, w: 1.5, alpha: 0.95 * a });
    ink.path([[px - hr * 2, py + hr * 3.1], [px - hr * 1.75, py + hr * 1.9], [px - hr * 0.8, py + hr * 1.35], [px + hr * 0.8, py + hr * 1.35], [px + hr * 1.75, py + hr * 1.9], [px + hr * 2, py + hr * 3.1]], { seed: 301, w: 1.5, alpha: 0.95 * a });
    // data: a precise glyph arrow
    const ax0 = w * 0.06;
    const ax1 = px - hr * 2.4;
    // what the functional answer would have said: crossed out
    if (!narrow) {
      const x = w * 0.06;
      const y = G.top + 36;
      ink.text('卡住的，不是', x, y, { size: 14, color: c.ink2, alpha: a });
      ['文法', '字彙量'].forEach((s, i) => {
        const yy = y + 30 + i * 30;
        ink.text(s, x, yy, { font: 'body', size: 16, alpha: 0.75 * a });
        ink.line(x - 4, yy - 6, x + textW(s, 16, 'body') + 6, yy - 4, { seed: 330 + i, w: 1.4, alpha: 0.9 * a });
      });
    }
    const pa = smooth(tt / 0.8);
    const cell = narrow ? 10 : 13;
    const n = Math.floor((ax1 - ax0) / (cell * 0.8));
    const head = n * pa;
    for (let i = 0; i <= head; i++) {
      const x = ax0 + (i / n) * (ax1 - ax0);
      ascii.glyph(i > head - 1 ? '>' : '=', x, py, cell, c.ink, 0.9 * a);
      if (i % 2 === 0 && i < head - 1) ascii.glyph('·', x, py - cell * 0.5, cell * 0.8, c.ink, 0.35 * a);
    }
    ink.text('數據', ax0, py - cell * 2.2, { font: 'body', size: 14, weight: 500, alpha: a });
    const labels = ['地點', '時機', '受眾'];
    labels.forEach((l, i) => {
      const k = (i + 1.3) / 4.3;
      if (pa < k) return;
      const x = lerp(ax0, ax1, k);
      ascii.glyph('|', x, py + cell * 0.95, cell, c.ink, 0.6 * a);
      ink.text(l, x, py + cell * 2.6, { font: 'body', size: 13, align: 'center', color: c.ink2, alpha: a });
    });
    if (pa > 0.98) {
      // crosshair on the target
      const cx = ax1 + cell;
      ascii.glyph('+', cx, py, cell + 6, c.ink, a);
      ink.circle(cx, py, cell * 1.1, { seed: 305, w: 0.9, alpha: 0.7 * a, passes: 1 });
      if (!narrow) ink.text('忠孝復興', cx, py + cell * 2.6, { font: 'body', size: 13, align: 'center', color: c.ink2, alpha: a });
    }
    // the second before speaking: the bubble trembles, three dots, a one-second ring
    const hes = clamp((tt - 0.75) / 1.0);
    const open = smooth((tt - 1.85) / 0.35);
    const shake = hes > 0 && open < 1 ? (1 - open) * 2.2 : 0;
    const jx = shake ? noise2(tt * 30, 1) * shake : 0;
    const jy = shake ? noise2(1, tt * 30) * shake : 0;
    const sc = lerp(0.72, 1, open);
    const BW = bw * sc;
    const BH = bh * sc;
    const bl = bx - BW / 2 + jx;
    const bt = by - BH / 2 + jy;
    if (tt > 0.75) {
      if (open > 0.05) ink.blob(bl + BW / 2, bt + BH / 2, BH * 0.44, { seed: 310, alpha: c.hlAlpha * open * a });
      ink.path(bubble(bl, bt, BW, BH), { seed: 311, w: 1.3, alpha: 0.9 * a, wobble: 1 + shake * 0.9, passes: open > 0.5 ? 2 : 1 });
      // tail to the mouth
      ink.path([[bl + BW * 0.2, bt + BH - 3], [px + hr * 0.45, py - hr * 0.75], [bl + BW * 0.38, bt + BH]], { seed: 312, w: 1.2, alpha: 0.9 * a });
      if (open < 0.5) {
        // three dots, one at a time: the words do not come out
        const dots = Math.min(3, Math.floor(hes * 3.2) + 1);
        for (let q = 0; q < dots; q++) ink.dot(bl + BW / 2 + (q - 1) * BW * 0.14, bt + BH / 2, 2.6, { seed: 314 + q, alpha: a * (1 - open * 2) });
        // the one second
        const rx = bl + BW + 14;
        const ry = bt + 2;
        ink.path(Array.from({ length: 25 }, (_, q) => {
          const ang = -Math.PI / 2 + (q / 24) * Math.PI * 2 * hes;
          return [rx + Math.cos(ang) * 10, ry + Math.sin(ang) * 10];
        }), { seed: 313, w: 1, alpha: 0.8 * a, passes: 1 });
        if (rx + 50 < w) ink.text('1 秒', rx + 15, ry + 5, { font: 'mono', size: 12, color: c.ink2, alpha: a });
      } else {
        ink.text('敢講', bl + BW / 2, bt + BH / 2 + BH * 0.15, { size: Math.round(bh * 0.4), weight: 700, align: 'center', alpha: a * (open * 2 - 1) });
      }
    }
    // what the hesitation is made of
    const fearA = a * clamp(hes * 3) * (1 - open * 0.55);
    if (fearA > 0.02) {
      if (narrow) ink.text('開口前那一秒', 16, G.top + 6, { size: 14, alpha: fearA });
      else {
        const fx = Math.max(16, bx - bw / 2 - 16);
        ink.text('開口前那一秒', fx, by - 6, { size: 16, align: 'right', alpha: fearA });
        ink.text('怕講錯、怕被笑', fx, by + 16, { size: 13, align: 'right', color: c.ink2, alpha: fearA });
      }
    }
    // human insight: a pencil stroke that opens the bubble
    const pi = smooth((tt - 1.4) / 0.45);
    if (pi > 0 && !narrow) {
      const sx = bx - bw * 0.85;
      const sy = G.top + 30;
      const ex = bx - bw * 0.22;
      const ey = by - bh / 2 - 10;
      const pts = [];
      for (let q = 0; q <= 14 * pi; q++) {
        const k = q / 14;
        pts.push([lerp(sx, ex, smooth(k)) + Math.sin(k * Math.PI) * 30, lerp(sy, ey, k)]);
      }
      if (pts.length > 1) ink.path(pts, { seed: 320, w: 1.4, alpha: 0.9 * a });
      if (pi > 0.95) {
        const ang = Math.atan2(ey - pts[pts.length - 2][1], ex - pts[pts.length - 2][0]);
        ink.line(ex, ey, ex - Math.cos(ang - 0.45) * 9, ey - Math.sin(ang - 0.45) * 9, { seed: 321, w: 1.2, alpha: 0.9 * a });
        ink.line(ex, ey, ex - Math.cos(ang + 0.45) * 9, ey - Math.sin(ang + 0.45) * 9, { seed: 322, w: 1.2, alpha: 0.9 * a });
      }
      ink.text('人性洞察', sx - 10, sy + 4, { size: 17, align: 'right', alpha: a * pi });
      ink.text('一個不會評價你的練習對象', sx - 10, sy + 26, { size: 13, align: 'right', color: c.ink2, alpha: a * pi });
    }
    if (narrow) ink.text('數據精準，人性破局', 16, bot, { size: fs, alpha: a });
    else {
      ink.text('數據決定如何精準抵達', w * 0.06, bot, { size: fs, color: c.ink2, alpha: a });
      ink.text('人性洞察決定為何能真正打動', w - 16, bot, { size: fs, align: 'right', alpha: a });
    }
  }

  // ── step 4: the near future ──
  function themePos(i) {
    const { w, top, axisY, narrow } = G;
    const fx0 = w * (narrow ? 0.36 : 0.4);
    const fx1 = w - (narrow ? 40 : 60);
    const [, u, v] = THEMES[i];
    // on a phone the named themes take turns high and low so their labels never touch
    const vv = narrow && i < 5 ? [0.85, 0.12, 0.7, 0.05, 0.62][i] : v;
    return [lerp(fx0, fx1, u), narrow ? lerp(top + 34, axisY - 30, vv) : lerp(top + 46, axisY - 70, vv)];
  }

  function drawStep4(a, since) {
    const { ink, ascii, c } = env;
    const { w, top, axisY, narrow, fs, bot } = G;
    const xL = w * 0.06;
    const x25 = w * (narrow ? 0.34 : 0.38);
    const xR = w - 24;
    const cell = narrow ? 9 : 11;
    // the axis: 2025 → 2035
    ink.arrow(xL, axisY, xR, axisY, { seed: 400, w: 1.2, alpha: 0.85 * a, head: 9 });
    const yr = [[x25, '2025'], [lerp(x25, xR - 20, 0.5), '2030'], [xR - 20, '2035']];
    yr.forEach(([x, s], i) => {
      ink.line(x, axisY - 5, x, axisY + 5, { seed: 401 + i, w: 1, alpha: 0.8 * a, passes: 1 });
      ink.text(s, x, axisY + 22, { font: 'mono', size: 12, align: 'center', color: c.ink2, alpha: a });
    });
    if (!narrow) ink.text('觀測起點', x25, axisY + 40, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // past data and the line AI extends from it
    const slope = -0.32;
    const y25 = axisY - (axisY - top) * 0.28;
    const r = rng(41);
    for (let i = 0; i < 38; i++) {
      const x = lerp(xL + 8, x25 - 6, r());
      const y = y25 + (x - x25) * slope + (r() - 0.5) * 34;
      ascii.glyph('0', x, y, cell, c.ink, (0.5 + r() * 0.4) * a);
    }
    const pl = clamp(since / 0.9);
    const ex = lerp(x25, xR - 10, pl);
    ascii.line(x25, y25, ex, y25 + (ex - x25) * slope, cell, c.ink, 0.55 * a, '·');
    if (!narrow) ink.text('AI：根據過去資料推測', x25 - 12, y25 - 46, { font: 'body', size: 13, align: 'right', color: c.ink2, alpha: a });
    // weak signals, then the ten themes: five named in the text
    ascii.field(x25 + 10, top + 30, xR - x25 - 20, axisY - top - 50, 16, (x, y) => {
      const n = noise2(x * 0.03, y * 0.03 + 9);
      return n > 0.45 ? 0.08 : -1;
    }, c.ink, 0.35 * a);
    const R = narrow ? 7 : 10;
    THEMES.forEach(([name], i) => {
      const k = smooth((since - 0.5 - i * 0.12) / 0.5);
      if (k <= 0) return;
      const [x, y] = themePos(i);
      if (!name) {
        ascii.glyph('·', x, y, cell + 4, c.ink, 0.6 * a * k);
        ink.circle(x, y, R * 0.6, { seed: 410 + i, w: 0.8, alpha: 0.35 * a * k, passes: 1 });
        return;
      }
      if (litTheme.has(i)) ink.blob(x, y, R * 2.4, { seed: 420 + i, alpha: c.hlAlpha * a });
      g0(() => {
        env.g.setLineDash([3, 4]);
        ink.line(x, y + R, x, axisY - 2, { seed: 430 + i, w: 0.9, alpha: 0.5 * a * k, passes: 1 });
        env.g.setLineDash([]);
      });
      ink.circle(x, y, R, { seed: 440 + i, w: 1.3, alpha: 0.95 * a * k });
      ink.dot(x, y, 2.4, { seed: 445 + i, alpha: a * k });
      const ts = narrow ? 13 : 16;
      const half = textW(name, ts) / 2;
      ink.text(name, clamp(x, 16 + half, w - 16 - half), y - R - 8, { size: ts, align: 'center', alpha: a * k });
    });
    ink.text(narrow ? '十大未來主題' : '電通創意未來學：2030s 台灣近未來生活 · 十大未來主題', narrow ? w - 16 : w / 2, top + 6, { size: narrow ? 14 : 16, align: narrow ? 'right' : 'center', color: c.ink2, alpha: a });
    if (!narrow) ink.text('從「追逐趨勢」轉向「佈局機會」', w / 2, bot, { size: fs, align: 'center', alpha: a });
  }

  function themeAt(x, y) {
    let best = -1;
    let bd = 34 * 34;
    THEMES.forEach(([name], i) => {
      if (!name) return;
      const [tx, ty] = themePos(i);
      const d = (tx - x) ** 2 + (ty - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  return {
    resize: geom,
    step(i) {
      if (i === 3) speakAt = env.t;
    },
    click(x, y) {
      const s = env.step;
      if (s === 0 || s === 5) {
        const f = floorAt(x, y);
        if (f >= 0) lit.has(f) ? lit.delete(f) : lit.add(f);
      } else if (s === 1) {
        SYMPTOMS.forEach((_, i) => {
          const { sx, sy } = symptomGeom(i);
          if (Math.abs(x - sx) < 90 && y > sy - 40 && y < G.gy + 60) dug[i] = env.t;
        });
      } else if (s === 2) {
        MOTIVES.forEach((_, i) => {
          const [mx, my] = motivePos(i);
          if (Math.hypot(x - mx, y - my) < 50) litMotive.has(i) ? litMotive.delete(i) : litMotive.add(i);
        });
      } else if (s === 3) speakAt = env.t;
      else if (s === 4) {
        const i = themeAt(x, y);
        if (i >= 0) litTheme.has(i) ? litTheme.delete(i) : litTheme.add(i);
      }
    },
    frame(t, dt) {
      const { ink, ascii, c, w, h, pointer } = env;
      const s = env.mini ? 0 : env.step;
      const still = dt === 0;
      const since = still ? 99 : t - env.stepAt;
      for (let i = 0; i < 6; i++) m[i] = still ? (i === s ? 1 : 0) : approach(m[i], i === s ? 1 : 0, dt, 0.28);
      build = still ? 1 : Math.min(1, build + dt / 1.7);
      // roots grow by themselves if nobody digs: the first soon, the second a little later
      if (s === 1) {
        if (still) {
          if (dug[0] === null) dug[0] = t - 10;
          if (dug[1] === null) dug[1] = t - 10;
        } else {
          if (dug[0] === null && since > 0.9) dug[0] = t;
          if (dug[1] === null && since > 3.2) dug[1] = t;
        }
      }
      const T = target(s);
      for (const k of ['x', 'y', 'w', 'h', 'a']) B[k] = still ? T[k] : approach(B[k], T[k], dt, 0.3);

      // blueprint grid: faint glyph crosses
      const S = env.mini ? 18 : G.grid;
      const gx0 = ((w % S) / 2) + S / 2;
      for (let y = 34 + S / 2; y < h - 40; y += S) for (let x = gx0; x < w; x += S) ascii.glyph('+', x, y, env.mini ? 8 : 9, c.ink, 0.2);

      // ground line
      const ga = Math.max(m[0], m[1], m[5]);
      if (ga > 0.02) {
        const x0 = m[1] > 0.5 ? 0 : w * 0.05;
        ink.line(x0, B.y, w - x0, B.y, { seed: 10, w: 1.2, alpha: 0.75 * ga });
      }

      // the old way, step 0: a one-storey shed called 傳播答案
      if (m[0] > 0.02 && !G.narrow && !env.mini) {
        const a = m[0];
        const sw = Math.min(w * 0.17, 170);
        const sx = w * 0.06;
        const sh = clamp(B.h * 0.16, 40, 74);
        g0(() => {
          env.g.setLineDash([5, 5]);
          ink.rect(sx, B.y - sh, sw, sh, { seed: 20, w: 1, alpha: 0.55 * a, passes: 1 });
          env.g.setLineDash([]);
        });
        ink.text('專案簡報 → 傳播概念', sx + sw / 2, B.y - sh / 2 + 5, { size: 13, align: 'center', color: c.ink2, alpha: a });
        ink.text('過去：傳播答案', sx, B.y - sh - 14, { size: 15, color: c.ink2, alpha: a });
        // 升級: from the shed's roof up to the new building
        if (build > 0.97) {
          const x0 = sx + sw * 0.7;
          const y0 = B.y - sh - 34;
          const x1 = B.x - B.w / 2 - 22;
          const y1 = B.y - B.h * 0.55;
          const pts = [];
          for (let q = 0; q <= 10; q++) {
            const k = q / 10;
            pts.push([lerp(x0, x1, k), lerp(y0, y1, k) - Math.sin(k * Math.PI) * 40]);
          }
          g0(() => {
            env.g.setLineDash([4, 5]);
            ink.path(pts, { seed: 22, w: 1, alpha: 0.6 * a, passes: 1 });
            env.g.setLineDash([]);
          });
          ink.line(x1, y1, x1 - 9, y1 + 2, { seed: 23, w: 1, alpha: 0.7 * a });
          ink.line(x1, y1, x1 - 5, y1 + 8, { seed: 24, w: 1, alpha: 0.7 * a });
          ink.text('升級', lerp(x0, x1, 0.5), lerp(y0, y1, 0.5) - 48, { size: 15, align: 'center', alpha: a });
        }
      }

      // the building (all steps but 2–4)
      const hoverF = pointer.in && (s === 0 || s === 5) ? floorAt(pointer.x, pointer.y) : -1;
      if (B.a > 0.02) drawBuilding(B.a, m[5], hoverF);

      // labels around the building
      const P = parts();
      const la = Math.max(m[0], m[5]) * (build > 0.97 ? 1 : 0);
      if (la > 0.02) {
        const fs = env.mini ? 12 : G.fs;
        const lx = env.mini ? P.x0 - 8 : P.x0 - 14;
        if (G.narrow && m[5] > 0.5) {
          // no room on the left: above the roof, under the ground
          ink.text('成長績效', B.x, P.top - 8, { size: fs, align: 'center', alpha: la });
          ink.text('商業課題', B.x, B.y + 16, { size: fs, align: 'center', alpha: la });
        } else {
          ink.text('商業課題', lx, B.y - P.slab / 2 + fs * 0.35, { size: fs, align: 'right', alpha: la });
          ink.text('成長績效', lx, P.top + P.roof / 2 + fs * 0.35, { size: fs, align: 'right', alpha: la });
        }
        if (!env.mini && !(G.narrow && m[5] > 0.5)) {
          ink.text('開始', lx, B.y - P.slab / 2 + fs * 0.35 + 18, { size: 13, align: 'right', color: c.ink2, alpha: la });
          ink.text('結束', lx, P.top + P.roof / 2 + fs * 0.35 + 18, { size: 13, align: 'right', color: c.ink2, alpha: la });
        }
      }
      // step 0: a dimension line 增長架構, revealed floor names, title block
      if (m[0] > 0.02 && build > 0.97) {
        const a = m[0];
        const dx = P.x1 + (env.mini ? 16 : 30);
        ink.arrow(dx, B.y - B.h / 2, dx, P.top, { seed: 30, w: 1, alpha: 0.7 * a, head: 7 });
        ink.arrow(dx, B.y - B.h / 2, dx, B.y, { seed: 31, w: 1, alpha: 0.7 * a, head: 7 });
        if (!env.mini) {
          ink.text('增長架構', dx + 12, B.y - B.h / 2, { size: G.fs, rotate: Math.PI / 2, alpha: a });
          lit.forEach((i) => {
            const f = P.floors[i];
            const [no, name] = FLOORS[i];
            const fx = dx + 34;
            const fy = (f[1] + f[3]) / 2 + 5;
            if (G.narrow) return;
            ink.text(`${no}`, fx, fy, { font: 'mono', size: 12, color: c.ink2, alpha: a });
            ink.text(name, fx + 24, fy, { size: 14, alpha: a });
          });
          if (!lit.size && !G.narrow) ink.text('點一層樓，看它是什麼', dx + 34, (P.floors[2][1] + P.floors[2][3]) / 2 + 5, { size: 13, color: c.ink2, alpha: a * 0.9 });
          const tbw = 186;
          if (!G.narrow && w - (dx + 40) > tbw + 20) {
            const tx = w - tbw - 20;
            const ty = G.bot - 44;
            ink.rect(tx, ty, tbw, 44, { seed: 33, w: 0.9, alpha: 0.6 * a, passes: 1 });
            ink.line(tx, ty + 24, tx + tbw, ty + 24, { seed: 34, w: 0.7, alpha: 0.45 * a, passes: 1 });
            ink.text('增長藍圖', tx + 10, ty + 18, { size: 14, alpha: a });
            ink.text('GROWTH ARCHITECT · 05', tx + 10, ty + 36, { font: 'mono', size: 11, color: c.ink2, alpha: a });
          }
        }
      }
      // step 5: floor names, the system's name
      if (m[5] > 0.02 && !env.mini) {
        const a = m[5];
        const lx = P.x1 + (G.narrow ? 22 : 30);
        const size = G.narrow ? 13 : 16;
        const maxW = w - lx - 16;
        // floors tall enough: a label beside each; otherwise spread the labels and lead to them
        const roomy = P.fh > size * 2.6;
        P.floors.forEach((f, i) => {
          const [no, name] = FLOORS[i];
          const fy = (f[1] + f[3]) / 2;
          const ly = roomy ? fy : lerp(G.bot - 6, P.top + 4, i / 4);
          ink.path([[P.x1 + 4, fy], [lx - 14, fy], [lx - 6, ly]], { seed: 500 + i, w: 0.8, alpha: 0.5 * a, passes: 1 });
          const lines = roomy ? ink.wrap(name, maxW - 30, { size }) : [name];
          const lh = size * 1.3;
          const y0 = ly - ((lines.length - 1) * lh) / 2 + size * 0.35;
          if (lit.has(i)) {
            const tw = Math.min(maxW, Math.max(...lines.map((l) => textW(l, size))) + 40);
            ink.marker(lx - 4, y0 - size - 2, tw, lines.length * lh + 6, { seed: 510 + i, alpha: c.hlAlpha * a });
          }
          ink.text(no, lx, y0, { font: 'mono', size: 12, color: c.ink2, alpha: a });
          lines.forEach((l, j) => ink.text(l, lx + 28, y0 + j * lh, { size, alpha: a }));
        });
        const name = ARTICLES.find((x) => x.no === 5).framework.name;
        ink.text(name, G.narrow ? 16 : P.x0, G.top + 4, { size: G.narrow ? 15 : 18, alpha: a });
        if (!G.narrow) {
          ink.text('智能', P.x0 + B.w * 0.25, P.top - 12, { size: 13, align: 'center', color: c.ink2, alpha: a });
          ink.text('人性', P.x0 + B.w * 0.75, P.top - 12, { size: 13, align: 'center', color: c.ink2, alpha: a });
        }
      }

      if (m[1] > 0.02) drawStep1(m[1], t, dt);
      if (m[2] > 0.02) drawStep2(m[2], since);
      if (m[3] > 0.02) drawStep3(m[3], still ? 99 : t - speakAt);
      if (m[4] > 0.02) drawStep4(m[4], since);
    },
  };
}
