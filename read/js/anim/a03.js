// 03 真實的力量 — when real things get stamped "AI?", imperfection becomes the proof of a person.
// step 0  a rainbow cloud in pencil; the comments pop up around it: 「AI？」
// step 1  真實越來越不真實: the stamps spread over everything real (cloud, a phone call, Prada, LEGO)
// step 2  超越最佳化: a row of identical, perfect glyph shapes, and one imperfect pencil one
// step 3  自我認同: a person walks past the "best" option to the one that is most like them
// step 4  更像一個人: the brand turns from glyphs into a pencil face
// step 5  創意的進化: 傳播包裝 → 情感架構, Attention → Affection, Impression → Emotional Impression
// Hover: the perfect ones go grey, the imperfect one comes alive; stamps lift where you look.
import { hash, smooth, lerp, approach, clamp, easeOut } from '../engine/noise.js';

export const hint = '滑過去比比看';

const TAU = Math.PI * 2;
const CAPTION = [
  '「這太厲害了，一定是 AI！」',
  '奇蹟發生了，沒有人相信。',
  '人為的不完美，反而更加難能可貴',
  '人買的是情感上的自我認同',
  '不是幫品牌自動化，而是幫品牌更像一個人',
  '創意不再只是讓人看見，而是讓人願意靠近',
];
// the four real things that were doubted, and what people said
const REAL = [
  { name: '彩虹雲', say: '「AI？」' },
  { name: '教宗來電', say: '「詐騙？」' },
  { name: 'Prada · 近五十人', say: '「AI slop？」' },
  { name: '樂高', say: '「AI？」' },
];
const EVO = [
  ['傳播包裝', '情感架構', '讓人願意靠近'],
  ['Attention', 'Affection', '建立依戀'],
  ['Impression', 'Emotional Impression', '刻下情感印記'],
];

export default function make(env) {
  const { g, ink, ascii } = env;
  let G = {};
  const mix = { s0: 1, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  let warm = 0; // hover: how alive the imperfect one is

  const tw = (str, size, kind = 'hand', weight = 400) => {
    g.save();
    g.font = env.font(kind, size, weight);
    const v = g.measureText(str).width;
    g.restore();
    return v;
  };
  function label(str, x, y, o = {}) {
    const k = o.k ?? 1;
    if (k < 0.01 || !str) return;
    const size = o.size || 16;
    if (o.mark) {
      const wd = tw(str, size, o.font || 'hand', o.weight || 400);
      const al = o.align || 'left';
      const x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x;
      ink.marker(x0 - 5, y - size * 0.9, wd + 10, size * 1.2, { seed: o.mark, alpha: env.c.hlAlpha * k * (o.markAlpha ?? 1) });
    }
    ink.text(str, x, y, { size, font: o.font, weight: o.weight, align: o.align, color: o.color || env.c.ink, alpha: k * (o.alpha ?? 1) });
  }
  function marks(list, alpha, w = 1.1) {
    if (!list.length || alpha < 0.01) return;
    g.save();
    g.strokeStyle = env.c.pencil;
    g.lineCap = 'round';
    g.lineWidth = w;
    g.globalAlpha *= alpha;
    g.beginPath();
    for (let i = 0; i < list.length; i += 4) {
      g.moveTo(list[i], list[i + 1]);
      g.lineTo(list[i + 2], list[i + 3]);
    }
    g.stroke();
    g.restore();
  }

  function geom() {
    const { w, h, mini } = env;
    const cap = !mini && w >= 520 && h >= 420;
    const top = mini ? 10 : 50;
    const bot = mini ? h - 10 : cap ? h - 90 : h - 58;
    const left = mini ? 10 : w < 480 ? 16 : 26;
    const right = w - left;
    G = { w, h, cap, top, bot, left, right, W: right - left, H: bot - top, cx: w / 2, cy: (top + bot) / 2, narrow: w < 520, capY: h - 62 };
  }
  geom();

  // ── a cloud: bumps on top, flat underneath ──
  function cloudPts(cx, cy, CW, CH, n = 90) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * TAU;
      let x = (Math.cos(th) * CW) / 2;
      let y = (Math.sin(th) * CH) / 2;
      if (y < 0) {
        const b = Math.pow(Math.abs(Math.sin(th * 3.5)), 0.6) * CH * 0.22 * -Math.sin(th);
        y -= b;
        x += Math.cos(th) * b * 0.4;
      } else y *= 0.45;
      pts.push([cx + x, cy + y]);
    }
    return pts;
  }
  // the rainbow cloud: the book's four highlighters as bands, graphite over them
  function rainbowCloud(cx, cy, CW, k, small) {
    const CH = CW * 0.52;
    const pts = cloudPts(cx, cy, CW, CH, small ? 60 : 90);
    const c = env.c;
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    const bands = [c.ai, c.people, c.intro, c.model];
    const ox = cx - CW * 0.08;
    const oy = cy + CH * 0.62;
    const th = CH * 0.2;
    g.save();
    g.globalAlpha *= c.hlAlpha * 0.9 * k;
    g.lineWidth = th;
    bands.forEach((col, b) => {
      g.strokeStyle = col;
      g.beginPath();
      g.arc(ox, oy, CH * 0.36 + b * th, Math.PI, TAU);
      g.stroke();
    });
    g.restore();
    ink.hatch({ x: cx - CW / 2, y: cy - CH, w: CW, h: CH * 1.3 }, { seed: 3, gap: small ? 7 : 6, alpha: 0.28 * k, w: 0.8, angle: -0.5 });
    g.restore();
    ink.path(pts, { seed: 4, w: small ? 1.2 : 1.6, alpha: 0.9 * k });
    return CH;
  }

  // a 「AI？」 comment: crisp, typeset, machine-like — the opposite of the pencil
  function stamp(str, x, y, rot, k, size, seed) {
    if (k < 0.01) return;
    const wd = tw(str, size, 'mono', 500) + 14;
    const hh = size * 1.7;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha *= k;
    g.save();
    g.globalAlpha *= 0.9;
    g.fillStyle = env.c.sheet;
    g.fillRect(-wd / 2, -hh / 2, wd, hh);
    g.restore();
    g.strokeStyle = env.c.ink;
    g.lineWidth = 1.2;
    g.strokeRect(-wd / 2, -hh / 2, wd, hh);
    ink.text(str, 0, size * 0.36, { font: 'mono', size, weight: 500, align: 'center' });
    g.restore();
  }

  // ── step 0 ──
  function sceneCloud(t, k, still) {
    const { cx } = G;
    const CW = Math.min(G.W * (env.mini ? 0.62 : 0.56), G.H * 1.25, 560);
    const cy = G.top + G.H * (env.mini ? 0.55 : 0.52);
    const CH = rainbowCloud(cx, cy, CW, k, env.mini);
    if (!env.mini) label('茂物上空的彩虹雲', cx, cy + CH * 0.45 + 34, { size: G.narrow ? 14 : 16, align: 'center', k, color: env.c.ink2 });
    // comments pop up around it
    const n = env.mini ? 3 : G.narrow ? 5 : 7;
    const P = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + 0.25 + (i / (n - 1)) * (Math.PI - 0.5) + (hash(i, 1) - 0.5) * 0.3;
      const rx = CW * 0.5 + (env.mini ? 4 : 30) + hash(i, 2) * 26;
      const ry = CH * 0.8 + hash(i, 3) * 26;
      const x = cx + Math.cos(a) * rx * (i % 2 ? 0.75 : 1);
      const y = cy - CH * 0.1 + Math.sin(a) * ry;
      const age = (t - i * 0.8 + P * 4) % P;
      const life = still ? (i % 3 === 2 ? 0 : 1) : age < 5.6 ? easeOut(age / 0.3) * clamp((5.6 - age) / 0.5) : 0;
      const sz = env.mini ? 12 : G.narrow ? 12 : 14;
      stamp('「AI？」', clamp(x, G.left + 40, G.right - 40), Math.max(G.top + 14, y), (hash(i, 4) - 0.5) * 0.25, k * life, sz, i);
    }
  }

  // ── step 1: four real things, four doubts ──
  function icon(i, x, y, S, k) {
    if (i === 0) {
      rainbowCloud(x, y + S * 0.08, S * 1.05, k, true);
    } else if (i === 1) {
      // a phone, and a voice coming out of it
      const pw = S * 0.42;
      const ph = S * 0.78;
      ink.rect(x - pw / 2, y - ph / 2, pw, ph, { seed: 21, w: 1.3, alpha: 0.9 * k, passes: 1 });
      ink.line(x - pw * 0.15, y - ph * 0.4, x + pw * 0.15, y - ph * 0.4, { seed: 22, w: 1.2, alpha: 0.8 * k, passes: 1 });
      ink.circle(x, y + ph * 0.38, 2.5, { seed: 23, w: 1, alpha: 0.8 * k, passes: 1 });
      for (let j = 0; j < 3; j++) {
        const r = pw * 0.55 + j * S * 0.11;
        const pts = [];
        for (let q = 0; q <= 8; q++) {
          const a = -0.6 + (1.2 * q) / 8;
          pts.push([x + pw * 0.2 + Math.cos(a) * r, y - ph * 0.12 + Math.sin(a) * r]);
        }
        ink.path(pts, { seed: 24 + j, w: 1.1, alpha: 0.75 * k, passes: 1 });
      }
    } else if (i === 2) {
      // a film frame with the fifty people who made it
      const fw = S * 1.0;
      const fh = S * 0.7;
      ink.rect(x - fw / 2, y - fh / 2, fw, fh, { seed: 31, w: 1.3, alpha: 0.9 * k, passes: 1 });
      const list = [];
      for (let r = 0; r < 5; r++) {
        for (let q = 0; q < 10; q++) {
          const px = x - fw * 0.4 + (q / 9) * fw * 0.8 + (hash(r, q) - 0.5) * 2;
          const py = y - fh * 0.3 + (r / 4) * fh * 0.6 + (hash(q, r, 1) - 0.5) * 2;
          list.push(px, py - 1.6, px, py + 1.6);
        }
      }
      marks(list, 0.85 * k, 1.6);
    } else {
      // a brick
      const bw = S * 0.9;
      const bh = S * 0.4;
      const by = y + S * 0.08;
      ink.rect(x - bw / 2, by - bh / 2, bw, bh, { seed: 41, w: 1.3, alpha: 0.9 * k, passes: 1 });
      for (let q = 0; q < 4; q++) {
        const sx = x - bw / 2 + bw * (0.14 + q * 0.24);
        ink.rect(sx - S * 0.05, by - bh / 2 - S * 0.09, S * 0.1, S * 0.09, { seed: 42 + q, w: 1.1, alpha: 0.85 * k, passes: 1 });
      }
      if (!G.narrow) ink.text('This video is not AI.', x, by + bh / 2 + 22, { size: 14, align: 'center', alpha: 0.9 * k, font: 'hand' });
    }
  }
  function sceneReal(t, k, since) {
    const wide = G.W / G.H > 1.15 || G.narrow;
    const cols = wide ? 4 : 2;
    const rows = wide ? 1 : 2;
    const cw = G.W / cols;
    const ch = G.H / rows;
    const S = Math.min(cw * 0.66, ch * (rows === 1 ? 0.46 : 0.5), 185);
    const { pointer } = env;
    REAL.forEach((it, i) => {
      const x = G.left + cw * ((i % cols) + 0.5);
      const y = G.top + ch * (Math.floor(i / cols) + 0.5) - (rows === 1 ? 10 : 14);
      icon(i, x, y, S, k);
      const ls = G.narrow ? 12 : 15;
      label(it.name, x, y + S * 0.62 + (i === 3 && !G.narrow ? 28 : 18), { size: ls, align: 'center', k, color: env.c.ink2 });
      // stamps pile up over each real thing
      const n = Math.min(G.narrow ? 1 : 5, 1 + Math.floor(Math.max(0, since - i * 0.25) / 0.7));
      const ss = G.narrow ? 12 : 13;
      const half = (tw(it.say, ss, 'mono', 500) + 14) / 2;
      for (let j = 0; j < n; j++) {
        const sx = clamp(x + (hash(i, j, 1) - 0.5) * S * 0.9, x - cw / 2 + half, x + cw / 2 - half);
        const sy = G.narrow ? y - S * 0.42 : y + (hash(i, j, 2) - 0.6) * S * 0.8;
        let look = 1;
        if (pointer.in) look = clamp((Math.hypot(pointer.x - sx, pointer.y - sy) - 30) / 60);
        const pop = easeOut(clamp((since - i * 0.25 - j * 0.7) / 0.25));
        stamp(it.say, sx, sy, (hash(i, j, 3) - 0.5) * (G.narrow ? 0.3 : 0.5), k * pop * (0.25 + 0.75 * look), ss, i * 10 + j);
      }
    });
  }

  // ── step 2 & 3: perfect glyph shapes and one imperfect pencil one ──
  function perfect(x, y, S, k, cell) {
    const hS = S / 2;
    ascii.field(x - hS, y - hS, S, S, cell, (px, py) => {
      const u = Math.abs(px - x) / hS;
      const v = Math.abs(py - y) / hS;
      const e = Math.pow(Math.pow(u, 5) + Math.pow(v, 5), 0.2);
      if (e > 1) return -1;
      return e > 0.8 ? 0.9 : 0.22;
    }, env.c.ink, k);
  }
  function imperfect(x, y, S, k, t, seed = 1) {
    const w = warm;
    const br = 1 + Math.sin(t * 2.6) * 0.03 * (0.3 + w);
    const r = S * 0.47 * br;
    ink.blob(x, y, r * (1.05 + 0.15 * w), { seed: 50 + seed, alpha: env.c.hlAlpha * k * (0.45 + 0.55 * w) });
    ink.circle(x, y, r, { seed: 51 + seed, w: 1.6, wobble: 2.6 + w * 2.5, alpha: 0.95 * k });
    ink.hatch({ x: x + r * 0.08, y: y + r * 0.1, r: r * 0.78 }, { seed: 52 + seed, gap: 6, alpha: 0.32 * k, angle: -0.6 });
    // the slip of the hand that a machine would never make
    ink.line(x + r * 0.55, y - r * 0.95, x + r * 1.05, y - r * 0.65, { seed: 53 + seed, w: 1.2, alpha: 0.75 * k, passes: 1 });
    if (w > 0.05) {
      const list = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.6;
        const r0 = r * (1.18 + 0.05 * Math.sin(t * 5 + i));
        list.push(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * (r0 + 7 * w), y + Math.sin(a) * (r0 + 7 * w));
      }
      marks(list, 0.8 * k * w, 1.3);
    }
  }
  function sceneOptimal(t, k) {
    const n = G.narrow ? 4 : 5;
    const S = Math.min(G.W / (n * 1.42 + 3.3), G.H * 0.28, 120);
    const gap = S * 0.42;
    const rowW = n * S + (n - 1) * gap;
    const total = rowW + S * 1.9 + S;
    const x0 = G.cx - total / 2 + S / 2;
    const y = G.top + G.H * 0.46;
    const grey = lerp(0.9, 0.28, warm);
    const cell = G.narrow ? 7 : 9;
    for (let i = 0; i < n; i++) perfect(x0 + i * (S + gap), y, S, k * grey, cell);
    const ix = x0 + rowW + S * 1.9;
    imperfect(ix, y, S * 1.1, k, t);
    const ls = G.narrow ? 13 : 15;
    const mid = x0 + (rowW - S) / 2;
    label('AI Agent：最佳化', mid, y - S / 2 - 22, { size: G.narrow ? 14 : 17, align: 'center', k });
    label(G.narrow ? '功能·價格·體驗都接近' : '功能接近 · 價格接近 · 體驗接近', mid, y + S / 2 + 34, { size: ls, align: 'center', k, color: env.c.ink2 });
    const lw = tw('瑕疵，是選擇的語言', ls) / 2 + 6;
    label('瑕疵，是選擇的語言', Math.min(ix, G.right - lw), y + S / 2 + 34, { size: ls, align: 'center', k, mark: 61, markAlpha: 0.4 + 0.6 * warm });
    // the dividing line: everything left of it can be optimised
    g.setLineDash([4, 6]);
    ink.line(ix - S * 1.05, y - S * 0.8, ix - S * 1.05, y + S * 0.8, { seed: 62, w: 1, alpha: 0.5 * k, passes: 1, boil: false });
    g.setLineDash([]);
  }
  function scenePick(t, k, since) {
    const S = Math.min(G.W / 6.5, G.H * 0.22, 90);
    const y = G.top + G.H * 0.3;
    const xs = [0.2, 0.4, 0.6, 0.82].map((f) => G.left + G.W * f);
    const grey = lerp(0.9, 0.3, warm);
    const cell = G.narrow ? 7 : 9;
    for (let i = 0; i < 3; i++) perfect(xs[i], y, S, k * grey * (i === 1 ? 1 : 0.7), cell);
    imperfect(xs[3], y, S * 1.05, k, t, 3);
    // the machine's recommendation
    ascii.text('[ AI 推薦 ]', xs[1] - tw('[ AI 推薦 ]', 12, 'mono', 500) / 2, y - S / 2 - 16, 12, env.c.ink, k * grey);
    const ls = G.narrow ? 13 : 16;
    label('哪個最好？', xs[1], y + S / 2 + 30, { size: ls, align: 'center', k, color: env.c.ink2 });
    const sw = tw('哪個最好？', ls);
    ink.line(xs[1] - sw / 2 - 4, y + S / 2 + 25, xs[1] + sw / 2 + 4, y + S / 2 + 21, { seed: 71, w: 1.4, alpha: 0.9 * k, passes: 1 });
    label('哪個最像我？', xs[3], y + S / 2 + 30, { size: ls + 1, align: 'center', k, mark: 72 });
    // the person: drawn to the best, hesitates, then turns to the one most like them
    const u = env.reduced || since > 99 ? 1 : clamp((since - 0.3) / 3.6);
    const P0 = [G.cx - G.W * 0.12, G.bot - 6];
    const Q = [xs[1] + S * 0.05, y + S / 2 + 74];
    const P1 = [xs[3], y + S / 2 + 76];
    const C2 = [lerp(Q[0], P1[0], 0.5), Q[1] + 60];
    const seg = (q) => {
      if (q < 0.45) {
        const m = smooth(q / 0.45);
        return [lerp(P0[0], Q[0], m), lerp(P0[1], Q[1], m)];
      }
      if (q < 0.58) return Q;
      const m = smooth((q - 0.58) / 0.42);
      return [(1 - m) * (1 - m) * Q[0] + 2 * (1 - m) * m * C2[0] + m * m * P1[0], (1 - m) * (1 - m) * Q[1] + 2 * (1 - m) * m * C2[1] + m * m * P1[1]];
    };
    const bz = seg;
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(seg((u * i) / 30));
    g.setLineDash([3, 5]);
    ink.path(pts, { seed: 73, w: 1.1, alpha: 0.7 * k, passes: 1 });
    g.setLineDash([]);
    const [px, py] = bz(u);
    const pr = G.narrow ? 10 : 16;
    const list = [];
    for (let i = 0; i < 26; i++) {
      const rr = Math.sqrt((i + 0.5) / 26) * pr * 0.85;
      const a = i * 2.4;
      const sx = px + Math.cos(a) * rr;
      const sy = py + Math.sin(a) * rr;
      list.push(sx - 1.5, sy + 1, sx + 1.5, sy - 1);
    }
    marks(list, 0.85 * k, 1.1);
    ink.circle(px, py, pr, { seed: 74, w: 1.3, alpha: 0.9 * k });
    label('我', px - pr - 8, py + 5, { size: 14, align: 'right', k, color: env.c.ink2 });
  }

  // ── step 4: the brand, from a perfect glyph logo to a pencil face ──
  function sceneHuman(t, k, since) {
    const RF = Math.min(G.W * 0.2, G.H * 0.34, 150);
    const cx = G.cx;
    const cy = G.top + G.H * 0.48;
    const go = env.reduced || since > 99 ? 1 : smooth(clamp((since - 0.3) / 3));
    const seam = lerp(cx - RF * 1.15, cx + RF * 0.72, go);
    const { pointer } = env;
    const lens = pointer.in && Math.hypot(pointer.x - cx, pointer.y - cy) < RF * 1.5;
    const LR = RF * 0.42;
    // glyph half: a flawless rounded square
    const cell = G.narrow ? 7 : 10;
    ascii.field(cx - RF, cy - RF, RF * 2, RF * 2, cell, (x, y) => {
      if (x < seam) return -1;
      if (lens && Math.hypot(x - pointer.x, y - pointer.y) < LR) return -1;
      const u = Math.abs(x - cx) / RF;
      const v = Math.abs(y - cy) / RF;
      const e = Math.pow(Math.pow(u, 5) + Math.pow(v, 5), 0.2);
      if (e > 0.98) return -1;
      return e > 0.85 ? 0.9 : 0.22;
    }, env.c.ink, 0.9 * k);
    // pencil half: a face, drawn by hand
    g.save();
    g.beginPath();
    g.rect(0, 0, seam, G.h);
    if (lens) g.arc(pointer.x, pointer.y, LR, 0, TAU);
    g.clip();
    ink.blob(cx + RF * 0.42, cy + RF * 0.28, RF * 0.22, { seed: 81, alpha: env.c.hlAlpha * k });
    ink.blob(cx - RF * 0.42, cy + RF * 0.28, RF * 0.22, { seed: 82, alpha: env.c.hlAlpha * k });
    ink.circle(cx, cy, RF * 0.98, { seed: 83, w: 1.7, alpha: 0.95 * k });
    ink.hatch({ x: cx, y: cy, r: RF * 0.9 }, { seed: 84, gap: 9, alpha: 0.16 * k, angle: -0.8 });
    const eye = (ex) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 1.15 + (Math.PI * 0.7 * i) / 8;
        pts.push([ex + Math.cos(a) * RF * 0.13, cy - RF * 0.12 + Math.sin(a) * RF * 0.1 + RF * 0.06]);
      }
      return pts;
    };
    ink.path(eye(cx - RF * 0.34), { seed: 85, w: 1.8, alpha: k });
    ink.path(eye(cx + RF * 0.34), { seed: 86, w: 1.8, alpha: k });
    const smile = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.2 + (Math.PI * 0.6 * i) / 14;
      smile.push([cx + Math.cos(a) * RF * 0.42, cy + RF * 0.02 + Math.sin(a) * RF * 0.36]);
    }
    ink.path(smile, { seed: 87, w: 1.8, alpha: k });
    g.restore();
    // the seam
    if (go < 0.999 || seam < cx + RF) ink.line(seam, cy - RF * 1.12, seam, cy + RF * 1.12, { seed: 88, w: 0.9, alpha: 0.45 * k, passes: 1 });
    const ls = G.narrow ? 14 : 18;
    const ly = cy + RF + (G.narrow ? 26 : 38);
    ascii.text('自動化', cx + RF * 0.62, ly - 4, 13, env.c.ink2, k * (1 - go * 0.4));
    label('更像一個人', cx - RF * 0.1, ly, { size: ls, k, mark: 89, align: 'right' });
  }

  // ── step 5: the evolution of creativity ──
  function sceneEvo(t, k, since) {
    const ys = [0.22, 0.5, 0.78].map((f) => G.top + G.H * f);
    const xm = G.left + G.W * (G.narrow ? 0.38 : 0.4);
    const al = G.narrow ? 26 : 52;
    const { pointer } = env;
    label('創意的進化', G.cx, G.top + (G.narrow ? 4 : 10), { size: G.narrow ? 15 : 19, align: 'center', k });
    EVO.forEach(([a, b, d], i) => {
      const y = ys[i];
      const p = env.reduced || since > 99 ? 1 : smooth(clamp((since - 0.3 - i * 0.45) / 0.7));
      const near = pointer.in ? clamp(1 - Math.abs(pointer.y - y) / 70) : 0;
      const ms = G.narrow ? 11 : 15;
      ascii.text(a, xm - al - tw(a, ms, 'mono', 500), y - 6, ms, env.c.ink2, k * (0.85 - near * 0.45));
      const x1 = xm - al + 10;
      const x2 = xm + al - 10;
      const xe = lerp(x1 + 4, x2, p);
      if (p > 0.02) ink.arrow(x1, y - 6, xe, y - 6, { seed: 91 + i, w: 1.3, alpha: 0.85 * k, head: 7 });
      // what travels along the arrow: glyphs that turn into pencil on the way
      if (p > 0.98 && !G.narrow) {
        for (let j = 0; j < 4; j++) {
          const f = (t * 0.45 + j / 4 + i * 0.13) % 1;
          const x = lerp(x1 + 4, x2 - 10, f);
          if (f < 0.5) ascii.glyph(':', x, y - 13, 9, env.c.ink, k * 0.8);
          else ink.dot(x, y - 13, 1.6, { alpha: k * 0.8, seed: 99 + j });
        }
      }
      const bs = G.narrow ? (b.length > 12 ? 14 : 17) : b.length > 12 ? 22 : 25;
      label(b, xm + al + 4, y + 2, { size: bs, k: k * p, mark: 95 + i, markAlpha: 0.65 + 0.35 * near });
      label(d, xm + al + 8, y + (G.narrow ? 21 : 30), { size: G.narrow ? 12 : 15, k: k * p, color: env.c.ink2 });
    });
  }

  return {
    resize: geom,
    frame(t, dt) {
      const { c, pointer } = env;
      const s = env.mini ? 0 : env.step;
      for (let i = 0; i < 6; i++) {
        const key = 's' + i;
        mix[key] = dt > 0 ? approach(mix[key], s === i ? 1 : 0, dt, 0.3) : s === i ? 1 : 0;
      }
      warm = dt > 0 ? approach(warm, pointer.in ? 1 : 0, dt, 0.25) : pointer.in ? 1 : 0;
      const since = dt === 0 ? 999 : t - env.stepAt;
      const scene = (key, fn) => {
        const k = mix[key];
        if (k < 0.01) return;
        g.save();
        g.translate(0, (1 - k) * 10);
        fn(smooth(k));
        g.restore();
      };
      scene('s0', (k) => sceneCloud(t, k, dt === 0));
      scene('s1', (k) => sceneReal(t, k, since));
      scene('s2', (k) => sceneOptimal(t, k));
      scene('s3', (k) => scenePick(t, k, since));
      scene('s4', (k) => sceneHuman(t, k, since));
      scene('s5', (k) => sceneEvo(t, k, since));
      if (env.mini || !G.cap) return;
      const ks = [mix.s0, mix.s1, mix.s2, mix.s3, mix.s4, mix.s5];
      ks.forEach((k, i) => label(CAPTION[i], G.cx, G.capY, { size: 15, align: 'center', k: smooth(k), color: c.ink2 }));
    },
  };
}
