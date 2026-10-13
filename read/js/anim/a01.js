// 01 AI for Growth — three companies, three learning loops; the gap is how fast each loop learns.
// step 0  three loops: 先知先覺 spirals in fast onto its target, 後知後覺 waits, 不知不覺 has stopped and crumbles
// step 1  the three fates, labelled; the fast loop tallies its learning cycles, the slow one starts small
// step 2  效率 vs 價值: the same speed, one loop spins in place, the other rolls forward leaving value marks
// step 3  創意 → 創新: one pencil idea becomes many quick glyph simulations; the best one is scaled up
// step 4  分工: AI works the data field, the pencil makes the judgment; two guard lines, 資料安全 and AI 成癮
// step 5  三種成長: Business / People / Organization Growth as three linked loops
// Drag: spin the loop under your finger faster — it converges sooner.
import { hash, smooth, lerp, approach, clamp, noise3 } from '../engine/noise.js';

export const hint = '拖曳，讓迴圈轉快';

const TAU = Math.PI * 2;
const TURNS = 2.6; // turns of the fast spiral per learning cycle
const FAST_T = 3; // seconds per fast cycle
const SLOW_T = 12; // seconds per slow cycle
const NAMES = ['先知先覺', '後知後覺', '不知不覺'];
const FATE = [
  ['快速學習', ''],
  ['謹慎等待', '用等待換確定性'],
  ['不做選擇', '終將被淘汰'],
];
const GROWTH = [
  ['Business Growth', '效率 vs 價值'],
  ['People Growth', '創意 vs 創新'],
  ['Organization Growth', '人 vs AI'],
];
const CAPTION = [
  '真正的分水嶺：學習循環有多快',
  '優勢不在計劃更聰明，而在學習循環更快',
  '效率不是目的，價值才是',
  '把創意變成一次次的模擬實驗',
  'AI 改變的是分工，沒改變的是判斷',
  'Learning by doing.',
];

export default function make(env) {
  const { g, ink, ascii } = env;
  let G = {};
  const mix = { loops: 1, fate: 0, eff: 0, idea: 0, split: 0, three: 0 };
  // loop clocks: the fast loop has already learned a few times, the slow one is still on its first
  const tau = [FAST_T * 6.35, SLOW_T * 0.18, 0];
  const spin = [0, 0, 0]; // extra speed from dragging, per loop (steps 0–1)
  let boost = 0; // extra speed from dragging (steps 2–5)
  const clk = { eff: 0, idea: 0, split: 0, three: 0, small: 0, rot: 0 };

  const tw = (str, size, kind = 'hand', weight = 400) => {
    g.save();
    g.font = env.font(kind, size, weight);
    const v = g.measureText(str).width;
    g.restore();
    return v;
  };

  // a label, optionally with a highlighter swipe behind it
  function label(str, x, y, o = {}) {
    const k = o.k ?? 1;
    if (k < 0.01 || !str) return;
    const size = o.size || 16;
    if (o.mark) {
      const wd = tw(str, size, o.font || 'hand', o.weight || 400);
      const al = o.align || 'left';
      const x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x;
      ink.marker(x0 - 5, y - size * 0.9, wd + 10, size * 1.2, { seed: o.mark, alpha: env.c.hlAlpha * k });
    }
    ink.text(str, x, y, { size, font: o.font, weight: o.weight, align: o.align, color: o.color || env.c.ink, alpha: k * (o.alpha ?? 1) });
  }

  // many tiny pencil marks in one path: list = [x1, y1, x2, y2, …]
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
    const top = mini ? 12 : 50;
    const bot = mini ? h - 12 : cap ? h - 90 : h - 58;
    const left = mini ? 10 : w < 480 ? 16 : 26;
    const right = w - left;
    G = { w, h, cap, top, bot, left, right, W: right - left, H: bot - top, cx: w / 2, cy: (top + bot) / 2, narrow: w < 520, capY: h - 62 };
    // steps 0–1: three loops side by side (names above, fates below);
    // in a tall frame they step down like a ranking
    G.tall = !mini && G.H > G.W * 0.8;
    const R = G.tall ? Math.min(G.W * 0.15, G.H * 0.12, 125) : Math.min(G.W * 0.125, G.H * (mini ? 0.3 : 0.23), 125);
    G.R = R;
    const ly = mini ? G.cy + 9 : G.top + G.H * 0.47;
    G.lp = [0, 1, 2].map((i) => [left + (G.W * (G.tall ? 0.22 + i * 0.28 : 1 / 6 + i / 3)), G.tall ? G.top + G.H * (0.2 + i * 0.3) : ly]);
  }
  geom();

  // ── the fast loop: a spiral that closes in on its target, then starts the next cycle ──
  function fastLoop(cx, cy, R, q, k, o = {}) {
    const n = Math.floor(q);
    const u = q - n;
    const a0 = n * 2.4 - Math.PI / 2;
    const pt = (uu, a) => {
      const ang = a + uu * TURNS * TAU;
      const r = R * Math.pow(1 - uu, 0.85);
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    };
    // target
    ink.circle(cx, cy, Math.max(4, R * 0.08), { seed: 11, w: 1, alpha: 0.7 * k, passes: 1 });
    ink.dot(cx, cy, 1.8, { alpha: 0.9 * k, seed: 12, color: env.c.ink });
    // a hit: the last cycle just landed on the target
    if (n > 0 && u < 0.22) {
      const f = u / 0.22;
      ink.blob(cx, cy, R * (0.12 + 0.3 * f), { seed: 13 + (n % 4), alpha: env.c.hlAlpha * k * (1 - f) });
      ink.circle(cx, cy, R * (0.1 + 0.32 * f), { seed: 14, w: 1, alpha: 0.6 * k * (1 - f), passes: 1, boil: false });
      // the previous spiral's last turn, fading out
      const pts = [];
      for (let i = 0; i <= 14; i++) pts.push(pt(0.8 + (0.2 * i) / 14, (n - 1) * 2.4 - Math.PI / 2));
      ink.path(pts, { seed: 15, w: 1, alpha: 0.5 * k * (1 - f), passes: 1 });
    }
    // the last cycle, whole and faint: what it learned from
    if (n > 0 && !env.mini) {
      const rec = [];
      for (let i = 0; i <= 64; i++) rec.push(pt(i / 64, (n - 1) * 2.4 - Math.PI / 2));
      ink.path(rec, { seed: 19, w: 0.9, alpha: 0.16 * k, passes: 1 });
    }
    // this cycle so far (faint) and its fresh end (dark)
    const N = Math.max(2, Math.ceil(u * 64));
    const all = [];
    for (let i = 0; i <= N; i++) all.push(pt((u * i) / N, a0));
    ink.path(all, { seed: 16, w: 1, alpha: 0.36 * k, passes: 1 });
    const u0 = Math.max(0, u - 0.16);
    const fresh = [];
    for (let i = 0; i <= 12; i++) fresh.push(pt(u0 + ((u - u0) * i) / 12, a0));
    ink.path(fresh, { seed: 17, w: o.w || 1.5, alpha: 0.95 * k });
    // the market answers: glyph samples along the way (AI reading the reaction)
    if (o.glyphs) {
      const S = Math.round(TURNS * 4);
      for (let j = 0; j < S; j++) {
        const uj = (j + 0.5) / S;
        if (uj > u) break;
        const al = clamp(1 - (u - uj) * 2.4);
        if (al <= 0) continue;
        const [px, py] = pt(uj, a0);
        const dx = px - cx;
        const dy = py - cy;
        const d = Math.hypot(dx, dy) || 1;
        ascii.glyph(hash(n, j) < 0.62 ? '+' : '-', px + (dx / d) * 10, py + (dy / d) * 10, o.cell || 12, env.c.ink, 0.9 * al * k);
      }
    }
    const [hx, hy] = pt(u, a0);
    ink.dot(hx, hy, o.head || 3.6, { alpha: k, seed: 18, color: env.c.ink });
    return n;
  }

  // ── the slow loop: moves in short bursts, waits in between, never quite lands ──
  function slowLoop(cx, cy, R, q, k, t) {
    const n = Math.floor(q);
    const p = q - n;
    const seg = p * 3;
    const b = Math.floor(seg);
    const f = seg - b;
    const mv = smooth((f - 0.62) / 0.38);
    const uu = (b + mv) / 3;
    const a0 = -Math.PI / 2 + n * 1.3;
    const pt = (v) => {
      const r = R * (1 - 0.12 * v);
      return [cx + Math.cos(a0 + v * TAU) * r, cy + Math.sin(a0 + v * TAU) * r];
    };
    ink.line(cx - 5, cy - 5, cx + 5, cy + 5, { seed: 21, w: 1, alpha: 0.6 * k, passes: 1 });
    ink.line(cx + 5, cy - 5, cx - 5, cy + 5, { seed: 22, w: 1, alpha: 0.6 * k, passes: 1 });
    // the plan it keeps waiting on: a dotted ring
    const dots = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      dots.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a + 0.03) * R, cy + Math.sin(a + 0.03) * R);
    }
    marks(dots, 0.35 * k, 1.1);
    const N = Math.max(2, Math.ceil(uu * 40));
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(pt((uu * i) / N));
    ink.path(pts, { seed: 24, w: 1.3, alpha: 0.8 * k });
    const [hx, hy] = pt(uu);
    ink.dot(hx, hy, 3.4, { alpha: k, seed: 25, color: env.c.ink });
    // waiting: three dots appear one by one
    if (f < 0.62 && !env.mini) {
      const m = Math.floor((f / 0.62) * 4) % 4;
      const ang = a0 + uu * TAU + Math.PI / 2;
      for (let i = 0; i < m; i++) ink.dot(hx + Math.cos(ang) * (10 + i * 7), hy + Math.sin(ang) * (10 + i * 7), 1.4, { alpha: 0.8 * k, seed: 26 + i });
    }
    return n;
  }

  // ── the stopped loop: the top still stands, the bottom crumbles into a heap of dust ──
  function deadLoop(cx, cy, R, k, t, rot) {
    const pileY = cy + R + (env.mini ? 8 : 14);
    const arc = (a1, a2, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = a1 + ((a2 - a1) * i) / n + rot;
        pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      }
      return pts;
    };
    ink.path(arc(Math.PI + 0.25, TAU - 0.35, 26), { seed: 31, w: 1.1, alpha: 0.6 * k });
    // broken pieces of the lower half
    const bits = [];
    for (let i = 0; i < 14; i++) {
      if (hash(i, 3) < 0.45) continue;
      const a = -0.35 + (i / 14) * (Math.PI + 0.6) + rot;
      const L = 0.06 + hash(i, 4) * 0.1;
      bits.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a + L) * R, cy + Math.sin(a + L) * R);
    }
    marks(bits, 0.45 * k, 1);
    // dust falling from the lower arc
    const dust = [];
    const M = env.mini ? 26 : 46;
    for (let j = 0; j < M; j++) {
      const ph = (t * 0.32 + hash(j, 5)) % 1;
      const a = 0.2 + hash(j, 6) * (Math.PI - 0.4);
      const x0 = cx + Math.cos(a) * R;
      const y0 = cy + Math.sin(a) * R;
      const x = x0 + (hash(j, 7) - 0.5) * 14 * ph;
      const y = lerp(y0, pileY - 2, ph * ph);
      const al = 1 - ph;
      if (al < 0.05) continue;
      dust.push(x, y, x + 0.8, y + 1.6);
    }
    marks(dust, 0.6 * k, 1.1);
    // the heap
    const heap = [];
    const hh = env.mini ? 6 : Math.min(16, R * 0.16);
    for (let j = 0; j < 90; j++) {
      const sx = hash(j, 8) + hash(j, 10) - 1;
      const x = cx + sx * R * 0.9;
      const y = pileY - Math.pow(1 - Math.abs(sx), 1.6) * hh * hash(j, 9);
      heap.push(x, y, x + 1.4, y + 0.3);
    }
    marks(heap, 0.55 * k, 1.2);
  }

  // tally marks, groups of five
  function tally(n, x, y, k) {
    const list = [];
    const m = Math.min(n, 15);
    for (let i = 0; i < m; i++) {
      const grp = Math.floor(i / 5);
      const j = i % 5;
      const gx = x + grp * 30;
      if (j < 4) list.push(gx + j * 5 + hash(i, 1) * 1.5, y - 7, gx + j * 5 + hash(i, 2) * 1.5, y + 7);
      else list.push(gx - 3, y + 4, gx + 19, y - 4);
    }
    marks(list, 0.85 * k, 1.3);
    return Math.ceil(m / 5) * 30;
  }

  // ── step 0–1 scene ──
  function sceneLoops(t, k, kf) {
    const { R } = G;
    const lx = G.lp.map((p) => p[0]);
    const ly = G.lp.map((p) => p[1]);
    const mini = env.mini;
    const nf = fastLoop(lx[0], ly[0], R, tau[0] / FAST_T, k, { glyphs: true, cell: mini ? 8 : 11, head: mini ? 3 : 3.6 });
    slowLoop(lx[1], ly[1], R, tau[1] / SLOW_T, k, t);
    deadLoop(lx[2], ly[2], R, k, t, clk.rot);
    const ns = Math.floor(mini ? 12 : 17 + Math.min(3, R * 0.02));
    for (let i = 0; i < 3; i++) label(NAMES[i], lx[i], ly[i] - R - (mini ? 10 : 18), { size: ns, align: 'center', k, mark: kf > 0.05 && i === 0 ? 41 : 0 });
    if (kf < 0.01 || mini) return;
    // fates
    const fs = G.narrow ? 14 : 16;
    const fy = (i) => ly[i] + R + (G.tall ? 34 : 40);
    for (let i = 0; i < 3; i++) {
      label(FATE[i][0], lx[i], fy(i), { size: fs, align: 'center', k: kf });
      if (FATE[i][1]) label(FATE[i][1], lx[i], fy(i) + (G.narrow ? 19 : 23), { size: fs - 2, align: 'center', k: kf, color: env.c.ink2 });
    }
    const y1 = fy(0);
    // the fast loop counts its cycles
    const tw0 = Math.min(nf, 15) <= 5 ? 26 : Math.ceil(Math.min(nf, 15) / 5) * 30;
    const tx = lx[0] - (tw0 + 36) / 2;
    tally(nf, tx, y1 + (G.narrow ? 16 : 20), kf);
    ascii.text(`×${nf}`, tx + tw0 + 6, y1 + (G.narrow ? 16 : 20), G.narrow ? 11 : 13, env.c.ink, kf);
    // the slow loop's way out: a small, cheap loop first
    const r2 = R * 0.26;
    fastLoop(lx[1], ly[1], r2, clk.small / 1.6, kf * 0.9, { w: 1.1, head: 2.4 });
    if (!G.narrow) label('小範圍先驗證', lx[1], ly[1] + R * 0.5, { size: 13, align: 'center', k: kf, color: env.c.ink2 });
  }

  // ── step 2: the same speed — in place, or forward ──
  function sceneEff(k) {
    const yA = G.top + G.H * 0.26;
    const yB = G.top + G.H * 0.68;
    const r = Math.min(G.H * 0.14, G.W * (G.tall ? 0.1 : 0.08), 78);
    const lx = G.left;
    const x0 = lx + (G.narrow ? 40 : 76) + r;
    const OM = TAU / 1.15;
    const tc = clk.eff;
    const th = tc * OM - Math.PI / 2;
    const ls = G.narrow ? 17 : 21;
    label('效率', lx, yA + 7, { size: ls, k });
    label('價值', lx, yB + 7, { size: ls, k, mark: 51 });
    // A: spinning in place — the ring gets darker, nothing moves
    for (let i = 0; i < 3; i++) ink.circle(x0, yA, r * (0.97 + i * 0.03), { seed: 52 + i, w: 1, alpha: 0.28 * k, passes: 1 });
    const arcA = [];
    for (let i = 0; i <= 16; i++) {
      const a = th - 3.6 + (3.6 * i) / 16;
      arcA.push([x0 + Math.cos(a) * r, yA + Math.sin(a) * r]);
    }
    ink.path(arcA, { seed: 55, w: 1.5, alpha: 0.9 * k });
    ink.dot(x0 + Math.cos(th) * r, yA + Math.sin(th) * r, 3.6, { alpha: k, seed: 56, color: env.c.ink });
    const tx = x0 + r + (G.narrow ? 14 : 26);
    label('更快的原地打轉', tx, yA + 6, { size: G.narrow ? 14 : 17, k, color: env.c.ink2 });
    ascii.text(`原地轉了 ${Math.floor((tc * OM) / TAU)} 圈`, tx, yA + (G.narrow ? 24 : 30), G.narrow ? 10 : 12, env.c.ink2, 0.9 * k);
    // B: the same turn, rolling forward and leaving value behind
    const span = G.right - r - 8 - x0;
    const RUN = 7;
    const run = tc % (RUN + 1.4);
    const fade = run > RUN + 0.6 ? 1 - (run - RUN - 0.6) / 0.8 : 1;
    const kb = k * fade;
    const v = span / RUN;
    const rr = Math.min(run, RUN);
    const gy = yB + r + 9;
    const ph = -Math.PI / 2;
    const P = (s) => [x0 + v * s + Math.cos(s * OM + ph) * r, yB + Math.sin(s * OM + ph) * r];
    ink.line(x0 - r, gy, x0 + v * rr + r * 0.4, gy, { seed: 57, w: 1, alpha: 0.5 * kb, passes: 1 });
    // value marks at every contact with the ground
    for (let m = 0; ; m++) {
      const s = (Math.PI / 2 - ph + TAU * m) / OM; // bottom of the turn
      if (s > rr) break;
      const x = x0 + v * s;
      const grow = clamp((rr - s) / 0.35);
      ink.blob(x, gy, 9 * grow + 1, { seed: 60 + m, alpha: env.c.hlAlpha * kb });
      ink.circle(x, gy, 7 * grow + 0.5, { seed: 70 + m, w: 1.1, alpha: 0.85 * kb, passes: 1 });
    }
    // the whole way so far (faint) and the last turns (dark)
    const whole = [];
    const nw = Math.max(2, Math.ceil(rr * 26));
    for (let i = 0; i <= nw; i++) whole.push(P((rr * i) / nw));
    ink.path(whole, { seed: 61, w: 1, alpha: 0.28 * kb, passes: 1 });
    const pts = [];
    const s0 = Math.max(0, rr - 1.6);
    for (let i = 0; i <= 40; i++) pts.push(P(s0 + ((rr - s0) * i) / 40));
    ink.path(pts, { seed: 58, w: 1.3, alpha: 0.85 * kb });
    const [hx, hy] = P(rr);
    ink.dot(hx, hy, 3.6, { alpha: kb, seed: 59, color: env.c.ink });
    label('為消費者創造價值', G.right, yB - r - 16, { size: G.narrow ? 14 : 17, align: 'right', k: kb, color: env.c.ink2 });
  }

  // ── step 3: one idea, many quick simulations, the best one scaled ──
  const BATCH = 10;
  const GAP = 0.12;
  const PER = BATCH * GAP + 1.7;
  function trial(bi, j, S, T, tR) {
    const d = Math.sqrt(hash(bi, j, 1)) * tR * 1.8;
    const a = hash(bi, j, 2) * TAU;
    const E = [T[0] + Math.cos(a) * d, T[1] + Math.sin(a) * d * 0.85];
    const mx = (S[0] + E[0]) / 2;
    const my = (S[1] + E[1]) / 2;
    const C = [mx + (hash(bi, j, 3) - 0.5) * tR, my + (hash(bi, j, 4) - 0.5) * G.H * 0.5];
    return { E, C, d };
  }
  const bez = (S, C, E, u) => [
    (1 - u) * (1 - u) * S[0] + 2 * (1 - u) * u * C[0] + u * u * E[0],
    (1 - u) * (1 - u) * S[1] + 2 * (1 - u) * u * C[1] + u * u * E[1],
  ];
  // a pencil spark: an idea
  function spark(x, y, s, seed, list) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + hash(seed, i) * 0.25;
      const r0 = s * 0.32;
      const r1 = s * (i % 2 ? 0.75 : 1.1) * (0.9 + hash(seed, i, 2) * 0.2);
      list.push(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
  }
  // one batch of simulations at batch-time bt; returns the best trial
  function batch(bi, bt, S, T, tR, cell, al0, sparse = 1) {
    let best = 0;
    let bd = 1e9;
    const tr = [];
    for (let j = 0; j < BATCH; j++) {
      const o = trial(bi, j, S, T, tR);
      tr.push(o);
      if (o.d < bd) {
        bd = o.d;
        best = j;
      }
    }
    let launched = 0;
    const settled = bt > BATCH * GAP + 0.25;
    for (let j = 0; j < BATCH; j++) {
      const born = j * GAP;
      if (bt < born) break;
      launched++;
      const o = tr[j];
      const pr = clamp((bt - born) / 0.3);
      const len = Math.hypot(o.E[0] - S[0], o.E[1] - S[1]) * 1.15;
      const n = Math.max(2, Math.floor((len / (cell * 1.5)) * pr));
      const al = (settled && j !== best ? 0.4 : 0.85) * al0;
      for (let i = sparse; i <= n; i += sparse) {
        const [x, y] = bez(S, o.C, o.E, (i / n) * pr);
        ascii.glyph(i % 3 === 0 ? ':' : '·', x, y, cell, env.c.ink, al);
      }
      if (pr >= 1) ascii.glyph(o.d < tR ? 'o' : 'x', o.E[0], o.E[1], cell + 3, env.c.ink, Math.min(1, al * 1.2));
    }
    return { o: tr[best], launched };
  }
  function sceneIdea(k) {
    const tc = clk.idea;
    const bi = Math.floor(tc / PER);
    const bt = tc - bi * PER;
    const cy = G.top + G.H * 0.47;
    const S = [G.left + G.W * (G.narrow ? 0.09 : 0.11), cy];
    const tR = Math.min(G.H * 0.13, G.W * 0.08);
    const T = [G.left + G.W * 0.55, cy];
    const GX = G.left + G.W * (G.narrow ? 0.86 : 0.85);
    const cell = G.narrow ? 8 : 10;
    // target: where an idea has to land
    ink.circle(T[0], T[1], tR, { seed: 81, w: 1, alpha: 0.4 * k, passes: 1 });
    ink.dot(T[0], T[1], 2, { alpha: 0.6 * k, seed: 82 });
    // the idea
    const sp = [];
    spark(S[0], S[1], Math.min(28, G.H * 0.08), 3, sp);
    marks(sp, 0.9 * k, 1.6);
    ink.dot(S[0], S[1], 2.6, { alpha: k, seed: 83, color: env.c.ink });
    // the last batch stays faint, so the fan is never empty
    batch(bi + 997, PER, S, T, tR, cell, 0.32 * k, 2);
    const fade = bt > PER - 0.3 ? (PER - bt) / 0.3 : 1;
    const { o, launched } = batch(bi, bt, S, T, tR, cell, k * fade);
    // the best one, drawn by hand, then carried over to be scaled
    const kw = clamp((bt - BATCH * GAP - 0.2) / 0.45);
    if (kw > 0) {
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push(bez(S, o.C, o.E, (i / 24) * kw));
      ink.path(pts, { seed: 84, w: 1.7, alpha: 0.95 * k * fade });
    }
    const gs = Math.min(G.W * 0.05, G.H * 0.085, 36);
    const slots = [];
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) slots.push([GX + (q - 1) * gs * 1.3, cy + (r - 1) * gs * 1.3]);
    const lit = 4 + (bi % 6);
    const kc = clamp((bt - BATCH * GAP - 0.7) / 0.6);
    const tgt = slots[lit - 1];
    if (kc > 0 && kc < 1) {
      const m = smooth(kc);
      const x = lerp(o.E[0], tgt[0], m);
      const y = lerp(o.E[1], tgt[1], m) - Math.sin(m * Math.PI) * 30;
      ink.dot(x, y, 3, { alpha: k, seed: 86, color: env.c.ink });
    }
    const shown = kc >= 1 ? lit : lit - 1;
    const list = [];
    for (let i = 0; i < shown; i++) {
      ink.blob(slots[i][0], slots[i][1], gs * 0.42, { seed: 90 + i, alpha: env.c.hlAlpha * k });
      spark(slots[i][0], slots[i][1], gs * 0.42, 90 + i, list);
    }
    marks(list, 0.85 * k, 1.3);
    // labels
    const ty = cy + Math.max(G.H * 0.24, 62);
    const ls = G.narrow ? 16 : 20;
    label('創意', S[0], ty, { size: ls, align: 'center', k });
    label('創新', GX, ty, { size: ls, align: 'center', k, mark: 88 });
    if (!G.narrow) {
      label('看見別人看不見的可能', S[0] - 12, ty + 23, { size: 13, align: 'left', k, color: env.c.ink2 });
      label('能規模化的行動', GX, ty + 23, { size: 13, align: 'center', k, color: env.c.ink2 });
    }
    const ly = cy - Math.max(G.H * 0.26, 60);
    const lsz = G.narrow ? 14 : 17;
    label('AI 模擬實驗', T[0], ly, { size: lsz, align: 'center', k });
    ascii.text(`第 ${bi * BATCH + launched} 次`, T[0] + tw('AI 模擬實驗', lsz) / 2 + 10, ly - lsz * 0.35, G.narrow ? 10 : 12, env.c.ink2, 0.9 * k);
  }

  // the data field is re-drawn on twos, like the pencil (6 fps), into its own small canvas
  let fieldCv = null;
  let fieldKey = '';
  function fieldLayer(x0, y0, w, h, cell, fn, alpha) {
    const W = Math.ceil(w * env.dpr);
    const H = Math.ceil(h * env.dpr);
    if (W < 1 || H < 1) return;
    if (!fieldCv) fieldCv = document.createElement('canvas');
    const key = `${env.boil}|${W}|${H}|${env.c.ink}`;
    if (key !== fieldKey) {
      fieldKey = key;
      if (fieldCv.width !== W || fieldCv.height !== H) {
        fieldCv.width = W;
        fieldCv.height = H;
      }
      const fg = fieldCv.getContext('2d');
      fg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
      fg.clearRect(0, 0, w, h);
      const g0 = env.g;
      env.g = fg;
      try {
        ascii.field(0, 0, w, h, cell, (x, y, q, r) => fn(x + x0, y + y0, q, r), env.c.ink, 1);
      } finally {
        env.g = g0;
      }
    }
    g.save();
    g.globalAlpha *= alpha;
    g.drawImage(fieldCv, x0, y0, w, h);
    g.restore();
  }

  // ── step 4: AI works the field, the pencil judges; two guard lines ──
  function sceneSplit(k, t) {
    const tc = clk.split;
    const fx0 = G.left;
    const fx1 = G.left + G.W * 0.54;
    const fy0 = G.top + (G.narrow ? 22 : 30);
    const fy1 = G.bot - (G.narrow ? 26 : 34);
    const fence = G.left + G.W * 0.62;
    const P = 3.6;
    const ci = Math.floor(tc / P);
    const cp = tc / P - ci;
    const cand = [0.3, 0.72, 0.55].map((fy, i) => [
      lerp(fx0, fx1, [0.28, 0.42, 0.76][i]) + noise3(i, 0, t * 0.08) * 14,
      lerp(fy0, fy1, fy) + noise3(0, i, t * 0.08) * 12,
    ]);
    // the data field: dense glyphs flowing toward the fence
    const cell = G.narrow ? 9 : 13;
    const ex = (fx1 - fx0) / 2;
    const ey = (fy1 - fy0) / 2;
    const mx = fx0 + ex;
    const my = fy0 + ey;
    fieldLayer(fx0, fy0, fx1 - fx0, fy1 - fy0, cell, (x, y) => {
      const n = noise3(x * 0.012 - tc * 0.35, y * 0.012, tc * 0.12);
      const e = Math.max(Math.abs(x - mx) / ex, Math.abs(y - my) / ey);
      let v = (0.06 + 0.36 * (n * 0.5 + 0.5)) * clamp((1 - e) * 4);
      for (const c of cand) {
        const d2 = (x - c[0]) ** 2 + (y - c[1]) ** 2;
        v += 0.62 * Math.exp(-d2 / 420);
      }
      return v < 0.17 ? -1 : v;
    }, 0.7 * k);
    // guard line 1: data security, a dashed border around the data
    g.setLineDash([6, 5]);
    ink.rect(fx0 - 6, fy0 - 6, fx1 - fx0 + 12, fy1 - fy0 + 12, { seed: 101, w: 1, alpha: 0.7 * k, passes: 1 });
    g.setLineDash([]);
    // guard line 2: AI addiction, a fence the field never crosses
    ink.line(fence - 3, fy0 - 10, fence - 3, fy1 + 10, { seed: 102, w: 1.2, alpha: 0.85 * k });
    ink.line(fence + 3, fy0 - 10, fence + 3, fy1 + 10, { seed: 103, w: 1.2, alpha: 0.85 * k });
    const rungs = [];
    for (let y = fy0; y < fy1; y += 16) rungs.push(fence - 6, y, fence + 6, y + 3);
    marks(rungs, 0.6 * k, 1);
    const gs = G.narrow ? 13 : 15;
    label('防線：資料安全', fx0, fy1 + 27, { size: gs, k });
    label('防線：AI 成癮', fence, fy1 + 27, { size: gs, k, align: G.narrow ? 'left' : 'center' });
    label(G.narrow ? 'AI：處理數據' : 'AI：處理數據、加速學習、快速反饋', fx0, fy0 - 14, { size: G.narrow ? 14 : 16, k });
    // the human side
    const hx = fence + (G.narrow ? 14 : G.W * 0.06);
    const hy = G.top + G.H * (G.narrow ? 0.36 : 0.5);
    label('人：判斷', hx, hy, { size: G.narrow ? 17 : 21, k, mark: 104 });
    ['建立信任', '有溫度的決策', '承擔責任'].forEach((s, i) => label(s, hx, hy + 30 + i * (G.narrow ? 20 : 25), { size: G.narrow ? 13 : 16, k, color: env.c.ink2 }));
    // past judgments stay, slowly fading
    const rad = G.narrow ? 16 : 22;
    for (let back = 2; back >= 0; back--) {
      const idx = ci - back;
      if (idx < 0) continue;
      const c = cand[((idx % 3) + 3) % 3];
      const prog = back === 0 ? clamp((cp - 0.22) / 0.45) : 1;
      const chk = back === 0 ? clamp((cp - 0.7) / 0.15) : 1;
      const al = k * (back === 0 ? 1 : back === 1 ? 0.55 : 0.25);
      if (prog > 0) {
        const pts = [];
        const n = Math.max(2, Math.ceil(30 * prog));
        for (let i = 0; i <= n; i++) {
          const a = -2.2 + ((TAU + 0.5) * prog * i) / n;
          pts.push([c[0] + Math.cos(a) * rad * 1.15, c[1] + Math.sin(a) * rad * 0.9]);
        }
        ink.path(pts, { seed: 110 + (idx % 7), w: 1.6, alpha: 0.95 * al });
        ink.blob(c[0], c[1], rad * 0.8, { seed: 111, alpha: env.c.hlAlpha * al * 0.8 });
      }
      if (chk > 0) {
        const x = c[0] + rad * 1.25;
        const y = c[1] - rad * 0.9;
        const p = [[x, y + 5], [x + 5, y + 10], [x + 16, y - 6]];
        const q = chk < 0.4 ? [p[0], [lerp(p[0][0], p[1][0], chk / 0.4), lerp(p[0][1], p[1][1], chk / 0.4)]] : [p[0], p[1], [lerp(p[1][0], p[2][0], (chk - 0.4) / 0.6), lerp(p[1][1], p[2][1], (chk - 0.4) / 0.6)]];
        ink.path(q, { seed: 120, w: 1.8, alpha: 0.95 * al });
      }
    }
    // the pencil itself: travels, then circles the candidate
    const cur = cand[ci % 3];
    const prev = cand[(ci + 2) % 3];
    let tx;
    let ty;
    if (cp < 0.22) {
      const m = smooth(cp / 0.22);
      tx = lerp(prev[0] + rad * 1.25 + 16, cur[0] + rad * 1.15 * Math.cos(-2.2), m);
      ty = lerp(prev[1] - rad * 0.9 - 6, cur[1] + rad * 0.9 * Math.sin(-2.2), m) - Math.sin(m * Math.PI) * 30;
    } else if (cp < 0.67) {
      const a = -2.2 + (TAU + 0.5) * ((cp - 0.22) / 0.45);
      tx = cur[0] + Math.cos(a) * rad * 1.15;
      ty = cur[1] + Math.sin(a) * rad * 0.9;
    } else {
      const m = clamp((cp - 0.7) / 0.15);
      tx = cur[0] + rad * 1.25 + lerp(0, 16, m);
      ty = cur[1] - rad * 0.9 + (m < 0.4 ? 10 * (m / 0.4) : 10 - 16 * ((m - 0.4) / 0.6));
    }
    drawPencil(tx, ty, k, G.narrow ? 0.7 : 1);
  }

  function drawPencil(x, y, k, s) {
    const a = -0.95;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy;
    const ny = dx;
    const L = 128 * s;
    const tip = 18 * s;
    const wd = 7 * s;
    const B = [x + dx * tip, y + dy * tip];
    const E = [x + dx * L, y + dy * L];
    // highlighter body
    g.save();
    g.globalAlpha *= env.c.hlAlpha * k;
    g.fillStyle = env.acc;
    g.beginPath();
    g.moveTo(B[0] + nx * wd, B[1] + ny * wd);
    g.lineTo(E[0] + nx * wd, E[1] + ny * wd);
    g.lineTo(E[0] - nx * wd, E[1] - ny * wd);
    g.lineTo(B[0] - nx * wd, B[1] - ny * wd);
    g.closePath();
    g.fill();
    g.restore();
    const o = { w: 1.2, alpha: 0.9 * k, passes: 1 };
    ink.line(x, y, B[0] + nx * wd, B[1] + ny * wd, { ...o, seed: 131 });
    ink.line(x, y, B[0] - nx * wd, B[1] - ny * wd, { ...o, seed: 132 });
    ink.line(B[0] + nx * wd, B[1] + ny * wd, E[0] + nx * wd, E[1] + ny * wd, { ...o, seed: 133 });
    ink.line(B[0] - nx * wd, B[1] - ny * wd, E[0] - nx * wd, E[1] - ny * wd, { ...o, seed: 134 });
    ink.line(B[0], B[1], E[0], E[1], { ...o, seed: 135, alpha: 0.35 * k });
    ink.line(E[0] + nx * wd, E[1] + ny * wd, E[0] - nx * wd, E[1] - ny * wd, { ...o, seed: 136 });
    const F = [E[0] - dx * 16 * s, E[1] - dy * 16 * s];
    ink.line(F[0] + nx * wd, F[1] + ny * wd, F[0] - nx * wd, F[1] - ny * wd, { ...o, seed: 137 });
    ink.dot(x + dx * 3, y + dy * 3, 2.2, { alpha: k, seed: 138, color: env.c.ink });
  }

  // ── step 5: three growths as three linked loops ──
  function sceneThree(k) {
    const Rr = Math.min(G.W / 3.7, (G.H - (G.narrow ? 70 : 96)) / 3.2, 165);
    const d = Rr * 0.78;
    const cx = G.cx;
    const cy = G.top + (G.narrow ? 32 : 46) + d + Rr;
    const C = [-Math.PI / 2, (Math.PI * 5) / 6, Math.PI / 6].map((a) => [cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    const th = clk.three * (TAU / 3.2);
    C.forEach(([x, y], i) => {
      if (i === 2) {
        // 人 vs AI: half glyph, half pencil
        const n = Math.round((Math.PI * Rr) / 9);
        for (let j = 0; j <= n; j++) {
          const a = Math.PI / 2 + (Math.PI * j) / n;
          ascii.glyph(j % 3 === 0 ? '+' : ':', x + Math.cos(a) * Rr, y + Math.sin(a) * Rr, G.narrow ? 9 : 12, env.c.ink, 0.9 * k);
        }
        const pts = [];
        for (let j = 0; j <= 30; j++) {
          const a = -Math.PI / 2 + (Math.PI * j) / 30;
          pts.push([x + Math.cos(a) * Rr, y + Math.sin(a) * Rr]);
        }
        ink.path(pts, { seed: 142, w: 1.3, alpha: 0.85 * k });
      } else ink.circle(x, y, Rr, { seed: 143 + i, w: 1.3, alpha: 0.85 * k });
      // each loop runs; linked, they turn together
      const dir = i === 1 ? -1 : 1;
      const a = th * dir + i * 2.1;
      const trail = [];
      for (let j = 0; j <= 10; j++) {
        const b = a - dir * 1.1 * (1 - j / 10);
        trail.push([x + Math.cos(b) * Rr, y + Math.sin(b) * Rr]);
      }
      ink.path(trail, { seed: 149 + i, w: 2.4, alpha: 0.8 * k, passes: 1 });
      ink.dot(x + Math.cos(a) * Rr, y + Math.sin(a) * Rr, G.narrow ? 3 : 4, { alpha: k, seed: 146 + i, color: env.c.ink });
    });
    const ns = G.narrow ? 13 : 16;
    const ss = G.narrow ? 13 : 15;
    const top = C[0][1] - Rr;
    label(GROWTH[0][0], C[0][0], top - (G.narrow ? 22 : 30), { size: ns, font: 'latin', weight: 600, align: 'center', k });
    label(GROWTH[0][1], C[0][0], top - (G.narrow ? 6 : 9), { size: ss, align: 'center', k, color: env.c.ink2 });
    const by = C[1][1] + Rr + (G.narrow ? 18 : 26);
    label(GROWTH[1][0], C[1][0] + Rr * 0.25, by, { size: ns, font: 'latin', weight: 600, align: 'right', k });
    label(GROWTH[1][1], C[1][0] + Rr * 0.25, by + (G.narrow ? 17 : 21), { size: ss, align: 'right', k, color: env.c.ink2 });
    label(GROWTH[2][0], C[2][0] - Rr * 0.25, by, { size: ns, font: 'latin', weight: 600, align: 'left', k });
    label(GROWTH[2][1], C[2][0] - Rr * 0.25, by + (G.narrow ? 17 : 21), { size: ss, align: 'left', k, color: env.c.ink2 });
  }

  function advance(dt) {
    for (let i = 0; i < 3; i++) spin[i] = approach(spin[i], 0, dt, 1.3);
    boost = approach(boost, 0, dt, 1.3);
    tau[0] += dt * (1 + spin[0]);
    tau[1] += dt * (1 + spin[1] * 1.6);
    clk.rot += dt * spin[2] * 1.2;
    clk.small += dt;
    const b = 1 + boost;
    clk.eff += dt * b;
    clk.idea += dt * b;
    clk.split += dt * b;
    clk.three += dt * b;
  }

  function push(x, y, dx, dy) {
    const amt = Math.min(60, Math.hypot(dx, dy)) * 0.03;
    if (env.step <= 1) {
      let best = 0;
      let bd = 1e9;
      G.lp.forEach(([lx, ly], i) => {
        const d = Math.hypot(x - lx, y - ly);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      spin[best] = Math.min(6, spin[best] + amt);
    } else boost = Math.min(6, boost + amt);
  }

  return {
    resize: geom,
    warm(sec) {
      advance(0);
      tau[0] += sec;
      tau[1] += sec;
      clk.small += sec;
      clk.eff += sec;
      clk.idea += sec;
      clk.split += sec;
      clk.three += sec;
    },
    drag(x, y, dx, dy) {
      push(x, y, dx, dy);
    },
    frame(t, dt) {
      const { c } = env;
      const s = env.mini ? 0 : env.step;
      const want = { loops: s <= 1 ? 1 : 0, fate: s === 1 ? 1 : 0, eff: s === 2 ? 1 : 0, idea: s === 3 ? 1 : 0, split: s === 4 ? 1 : 0, three: s === 5 ? 1 : 0 };
      for (const key in mix) mix[key] = dt > 0 ? approach(mix[key], want[key], dt, 0.3) : want[key];
      if (dt > 0) advance(dt);

      // each scene rises a little as it fades in
      const scene = (key, fn) => {
        const k = mix[key];
        if (k < 0.01) return;
        g.save();
        g.translate(0, (1 - k) * 10);
        fn(smooth(k));
        g.restore();
      };
      scene('loops', (k) => sceneLoops(t, k, smooth(mix.fate)));
      scene('eff', (k) => sceneEff(k));
      scene('idea', (k) => sceneIdea(k));
      scene('split', (k) => sceneSplit(k, t));
      scene('three', (k) => sceneThree(k));

      if (env.mini) return;
      // caption
      if (G.cap) {
        const ks = [mix.loops * (1 - mix.fate), mix.fate, mix.eff, mix.idea, mix.split, mix.three];
        ks.forEach((k, i) => label(CAPTION[i], G.cx, G.capY, { size: 15, align: 'center', k: smooth(k), color: c.ink2 }));
      }
      // speed readout while dragging
      const sp = s <= 1 ? Math.max(...spin) : boost;
      if (sp > 0.05) ascii.text(`迴圈 ×${(1 + sp).toFixed(1)}`, G.right - 86, 46, 12, c.ink2, clamp(sp * 2));
    },
  };
}
