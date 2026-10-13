// 18 體驗這件事 — for twenty years experience had one user, a person; now the Agent is a user too.
// step 0  one circle, two halves: the pencil half (人 · UX/CX/EX) we always drew, the glyph half (Agent · AX) we never asked about
// step 1  深夜裡的核對: under a desk lamp, pencil checks run over the Agent's glyph report, again and again
// step 2  旅程壓縮: 30 options pour into the Agent, only 3 come out in front of the customer
// step 3  限制是設計出來的: a case that crosses ≥ 2 policies makes the Agent stop, gather the conflicts, hand over to a person
// step 4  四堵牆: the Agent climbs four walls; each one turns an old habit into a new one
// step 5  六個信任模式: six switches around the Agent; every switch that is on makes it steadier
// Click: hand the Agent a task (step 5: flip the nearest switch).
import { rng, hash, lerp, approach, clamp, noise3, easeOut, easeInOut } from '../engine/noise.js';

export const hint = '點一下，交給 Agent';

const WALLS = [
  ['設計介面', '設計工作條件'],
  ['單一使用者', '多主體協同'],
  ['單次會話', '持續關係'],
  ['以人為中心', '以信任為中心'],
];
// ring arcs around the Agent: left column (0-2) on the left, right column (3-5) on the right
const ARC = [-130, 180, 130, -50, 0, 50].map((d) => (d * Math.PI) / 180);
const ROWS = [['股票', 0.78], ['基金', 0.56], ['保單', 0.4]];
const CASES = [
  { tags: ['商品瑕疵', '超過鑑賞期兩天', '跨境退貨'], hard: true },
  { tags: ['查詢訂單'], hard: false },
  { tags: ['商品瑕疵', '超過鑑賞期兩天', '跨境退貨'], hard: true },
  { tags: ['安排提醒'], hard: false },
];

export default function make(env) {
  const { ink, ascii } = env;
  const mix = [1, 0, 0, 0, 0, 0];
  const t0 = [0, 0, 0, 0, 0, 0];
  let cur = -1;
  let G = {};

  // interaction state, one block per step
  const pulses = [];
  let round = 4; // Wendy is on her 4th check of the day
  let runAt = 0;
  let lastCycle = 0;
  let pickSeed = 3;
  let pickAt = 0;
  let caseIdx = 0;
  let caseAt = 0;
  let wallGoal = 0;
  let wallManual = false;
  let wallProg = 0;
  const sw = [0, 0, 0, 0, 0, 0];
  const swV = [0, 0, 0, 0, 0, 0];
  let swManual = false;
  let swLast = -1;
  let swHot = [];

  function geom() {
    const { w, h, mini } = env;
    const pad = mini ? 10 : w < 520 ? 16 : 28;
    const top = mini ? 8 : 44;
    const bot = mini ? h - 8 : h - 60;
    const B = { x: pad, y: top, w: w - pad * 2, h: bot - top };
    G = { w, h, B, cx: w / 2, cy: top + B.h / 2, narrow: w < 560, u: clamp(Math.min(B.w / 680, B.h / 560), 0.45, 1.2) };
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
  // a label with a highlighter swipe behind it
  function tag(str, x, y, size, a, o = {}) {
    const m = tw(str, size, o.font);
    const x0 = o.align === 'center' ? x - m / 2 : o.align === 'right' ? x - m : x;
    ink.marker(x0 - 6, y - size * 0.98, m + 12, size * 1.38, { seed: o.seed || 1, alpha: env.c.hlAlpha * a });
    ink.text(str, x, y, { size, align: o.align, alpha: a, font: o.font, weight: o.weight });
  }
  // head-and-shoulders: < 1 inside
  function figD(px, py, x, y, s) {
    const dh = Math.hypot(px - x, py - (y - s * 0.24)) / (s * 0.2);
    const by = y + s * 0.5;
    const ex = Math.abs(px - x) / (s * 0.46);
    const ey = Math.abs(py - by) / (s * 0.42);
    const db = py <= by ? Math.pow(ex ** 2.6 + ey ** 2.6, 1 / 2.6) : 9;
    return Math.min(dh, db);
  }
  // the Agent: a head and shoulders made of glyphs; chaos = how jittery it is
  function agentFig(x, y, s, a, t, chaos = 0.3) {
    const cell = clamp(s / 20, 5.5, 8);
    const n = Math.ceil(s / cell) + 1;
    const ox = x - (n * cell) / 2;
    const oy = y - s * 0.48;
    for (let r = 0; r < n; r++) {
      const py = oy + (r + 0.5) * cell;
      for (let q = 0; q < n; q++) {
        const px = ox + (q + 0.5) * cell;
        const d = figD(px, py, x, y, s);
        if (d > 1) continue;
        const nz = noise3(q * 0.5, r * 0.5, t * (0.4 + chaos * 4));
        const v = (d > 0.8 ? 0.97 : 0.66) + nz * (0.12 + chaos * 0.5);
        ascii.glyph(clamp(v, 0.2, 0.99), px + nz * chaos * 4, py, cell * 1.12, env.c.ink, a);
      }
    }
  }
  // a person: pencil head and shoulders
  function person(x, y, s, a, seed = 1, w = 1.3) {
    ink.circle(x, y - s * 0.24, s * 0.2, { seed, alpha: 0.9 * a, w });
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = Math.PI + (i / 12) * Math.PI;
      pts.push([x + Math.cos(k) * s * 0.46, y + s * 0.5 + Math.sin(k) * s * 0.44]);
    }
    ink.path(pts, { seed: seed + 1, alpha: 0.9 * a, w });
  }
  // a paper card: sheet-coloured fill + pencil outline
  function card(x, y, w, h, a, seed) {
    const g = env.g;
    g.save();
    g.globalAlpha = 0.88 * a;
    g.fillStyle = env.c.sheet;
    g.fillRect(x, y, w, h);
    g.restore();
    ink.rect(x, y, w, h, { seed, alpha: 0.85 * a, w: 1.1, passes: 1 });
  }
  // the first fraction f of a polyline
  function part(pts, f) {
    if (f >= 1) return pts;
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let left = L * f;
    const out = [pts[0]];
    for (let i = 1; i < pts.length && left > 0; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const k = Math.min(1, left / d);
      out.push([lerp(x0, x1, k), lerp(y0, y1, k)]);
      left -= d;
    }
    return out;
  }
  function check(x, y, s, f, a, seed) {
    if (f <= 0) return;
    const pts = part([[x - s * 0.5, y - s * 0.05], [x - s * 0.15, y + s * 0.4], [x + s * 0.55, y - s * 0.55]], f);
    if (pts.length > 1) ink.path(pts, { seed, alpha: 0.95 * a, w: 1.8, wobble: 0.6 });
  }
  // a row of glyphs reading like a line of machine text
  function glyphLine(x, y, len, cell, a, seed, dens = 0.45, scramble = 0, gaps = 0.1) {
    const n = Math.max(1, Math.floor(len / (cell * 0.8)));
    for (let i = 0; i < n; i++) {
      const hv = hash(seed, i, scramble ? Math.floor(env.t * 14) : 0);
      if (hv < gaps) continue;
      ascii.glyph(clamp(dens + (hv - 0.5) * 0.25, 0.1, 0.99), x + i * cell * 0.8 + cell / 2, y, cell, env.c.ink, a);
    }
  }

  // ── step 0: the half we never asked about ──
  function scene0(a, T, still) {
    const { g, c, acc, mini } = env;
    const { cx, B } = G;
    const lab = mini ? 26 : 66;
    const side = !mini && B.w > 600;
    const R = Math.min(B.w * (mini ? 0.38 : 0.34), side ? B.w / 2 - 128 : 1e9, ((B.h - lab) / 2) * (mini ? 0.92 : 1));
    const cy = B.y + R + (B.h - lab - 2 * R) / 2;
    const p = still ? 1 : easeOut((T - 0.4) / 2.4);
    const cell = clamp(R / 20, 5, 10);
    const ax = cx + R * 0.47;
    const fy = cy + R * 0.14;
    const fs = R * 0.7;
    // a click: a task travels from the person to the Agent
    let boost = 0;
    for (const t1 of pulses) {
      const e = env.t - t1;
      if (e > 0.75 && e < 1.6) boost = Math.max(boost, 0.2 * (1 - (e - 0.75) / 0.85));
    }
    if (p > 0.01) {
      g.save();
      g.globalAlpha = c.hlAlpha * 0.45 * a * p;
      g.fillStyle = acc;
      g.beginPath();
      const rr = rng(18);
      g.moveTo(cx + 2, cy - R);
      for (let i = 0; i <= 20; i++) {
        const k = -Math.PI / 2 + (i / 20) * Math.PI;
        const q = R * (0.97 + rr() * 0.05);
        g.lineTo(cx + Math.cos(k) * q * Math.min(1, p * 1.2), cy + Math.sin(k) * q);
      }
      g.closePath();
      g.fill();
      g.restore();
    }
    ascii.field(cx, cy - R, R + cell, R * 2, cell, (x, y, q, r) => {
      const dx = x - cx;
      const d = Math.hypot(dx, y - cy) / R;
      if (d > 1 || dx < cell * 0.6 || dx > R * p * 1.04) return -1;
      const n = noise3(q * 0.33, r * 0.33, env.t * 0.22);
      const f = figD(x, y, ax, fy, fs);
      if (f < 1) return 0.66 + (f > 0.8 ? 0.2 : 0) + n * 0.1 + boost;
      return 0.13 + (d > 0.9 ? 0.22 : 0) + n * 0.1 + boost * (1 - Math.abs(dx - R * 0.47) / R);
    }, c.ink, a);
    if (p < 1) for (let i = 0; i <= 26; i++) {
      const k = -Math.PI / 2 + (i / 26) * Math.PI;
      ascii.glyph('·', cx + Math.cos(k) * R, cy + Math.sin(k) * R, cell + 2, c.ink2, a * (1 - p));
    }
    // the half we always drew
    const arc = [];
    for (let i = 0; i <= 40; i++) {
      const k = Math.PI / 2 + (i / 40) * Math.PI;
      arc.push([cx + Math.cos(k) * R, cy + Math.sin(k) * R]);
    }
    ink.path(arc, { seed: 3, alpha: 0.9 * a, w: 1.6 });
    ink.line(cx, cy - R - 8, cx, cy + R + 8, { seed: 4, alpha: 0.55 * a, w: 1 });
    person(cx - R * 0.47, fy, fs, a, 5, mini ? 1.2 : 1.6);
    for (const t1 of pulses) {
      const e = (env.t - t1) / 0.75;
      if (e < 0 || e > 1) continue;
      const x = lerp(cx - R * 0.2, cx + R * 0.22, easeInOut(e));
      for (let k = 0; k < 3; k++) ascii.glyph('>', x - k * cell, cy - R * 0.02, cell + 2, c.ink, a * (1 - k * 0.3));
    }
    if (mini) {
      ink.text('人', cx - R * 0.5, cy + R + 20, { size: 15, align: 'center', alpha: a });
      tag('Agent', cx + R * 0.5, cy + R + 20, 14, a, { align: 'center', font: 'latin', weight: 500 });
      return;
    }
    const ly = cy + R + 34;
    ink.text('人', cx - R * 0.5, ly, { size: 20, align: 'center', alpha: a });
    ink.text('UX · CX · EX', cx - R * 0.5, ly + 24, { font: 'mono', size: 13, align: 'center', color: c.ink2, alpha: a });
    tag('Agent', cx + R * 0.5, ly, 18, a * p, { align: 'center', font: 'latin', weight: 500, seed: 6 });
    ink.text('AX', cx + R * 0.5, ly + 24, { font: 'mono', size: 13, align: 'center', color: c.ink2, alpha: a * p });
    if (side) {
      ink.text('二十年來的體驗', cx - R - 18, cy - R * 0.62, { size: 15, align: 'right', color: c.ink2, alpha: a });
      ink.text('只問了這一半', cx - R - 18, cy - R * 0.62 + 22, { size: 15, align: 'right', color: c.ink2, alpha: a });
      ink.text('Agent 也成了', cx + R + 18, cy - R * 0.62, { size: 15, color: c.ink2, alpha: a * p });
      ink.text('使用者', cx + R + 18, cy - R * 0.62 + 22, { size: 15, color: c.ink2, alpha: a * p });
    }
  }

  // ── step 1: the 4th check, late at night ──
  function scene1(a, T, still) {
    const { g, c, acc } = env;
    const { B, cx, narrow } = G;
    const sw_ = Math.min(380, B.w * (narrow ? 0.62 : 0.48));
    const sh = clamp(B.h * (narrow ? 0.6 : 0.5), 120, 290);
    const lines = sh > 210 ? 5 : 3;
    const capH = !narrow && B.h > 420 ? 30 : 0;
    const sy = B.y + Math.max(60, (B.h - capH - (70 + sh + 44)) / 2 + 70);
    const sx = narrow ? B.x + 30 : cx - sw_ * 0.7;
    // lamp
    const hx = sx + sw_ * 0.18;
    const hy = sy - 46;
    const cone = [[hx - 18, hy + 10], [hx + 26, hy + 10], [sx + sw_ + 26, sy + sh + 8], [sx - 22, sy + sh + 8]];
    card(sx, sy, sw_, sh, a, 11);
    g.save();
    g.globalAlpha = c.hlAlpha * 0.36 * a;
    g.fillStyle = acc;
    g.beginPath();
    cone.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.restore();
    ink.path([[sx - 30, sy + sh * 0.5], [sx - 40, sy - 24], [hx - 6, hy - 10]], { seed: 12, alpha: 0.8 * a, w: 1.4 });
    ink.poly([[hx - 12, hy - 18], [hx + 10, hy - 14], [hx + 28, hy + 10], [hx - 20, hy + 10]], { seed: 13, alpha: 0.9 * a, w: 1.3, closed: true });
    ink.line(sx - 46, sy + sh * 0.5, sx - 14, sy + sh * 0.5, { seed: 14, alpha: 0.8 * a, w: 1.4 });
    ink.text('晚上八點', sx + sw_, sy - 14, { size: 15, align: 'right', color: c.ink2, alpha: a });
    // the Agent's report: glyph bars and glyph text
    const P = lines * 0.7 + 1.5;
    const Tr = still ? P - 0.4 : env.t - runAt;
    const cyc = Math.floor(Tr / P);
    if (!still && cyc > lastCycle) {
      round += cyc - lastCycle;
      lastCycle = cyc;
    }
    const ph = still ? Tr : Tr % P;
    const scr = !still && env.t - runAt < 0.6;
    ink.text('資產配置報告', sx + 18, sy + 32, { size: 16, alpha: a });
    ascii.text('by Agent', sx + 18 + tw('資產配置報告', 16) + 10, sy + 27, 11, c.ink2, a);
    const cellR = 11;
    const rowY = (i) => sy + (lines === 5 ? 66 : 58) + i * Math.min(40, (sh - (lines === 5 ? 84 : 70)) / (lines - 0.4));
    const bx0 = sx + 66;
    const bw = sw_ - 66 - 50;
    ROWS.forEach(([name, len], i) => {
      const y = rowY(i);
      ink.text(name, sx + 18, y + 5, { size: 15, alpha: a });
      glyphLine(bx0, y, bw * len, cellR, a, 40 + i + round * 7, 0.92, scr, 0);
    });
    for (let i = 3; i < lines; i++) glyphLine(sx + 18, rowY(i), (sw_ - 76) * (i === 3 ? 0.92 : 0.62), 10, a * 0.85, 60 + i + round * 7, 0.5, scr, 0.16);
    for (let i = 0; i < lines; i++) {
      const f = scr ? 0 : clamp((ph - 0.3 - i * 0.7) / 0.35);
      check(sx + sw_ - 24, rowY(i), 16, f, a, 70 + i + round);
    }
    // Wendy's tally
    const ty = sy + sh + 36;
    const label = `Wendy　第 ${round} 次核對`;
    ink.text(label, sx, ty, { size: 16, alpha: a });
    const lw = tw(label, 16);
    for (let k = 0; k < Math.min(round, 12); k++) {
      const gx = sx + lw + 16 + k * 7 + Math.floor(k / 5) * 8;
      if (k % 5 === 4) ink.line(gx - 30, ty - 2, gx + 2, ty - 13, { seed: 80 + k, alpha: 0.85 * a, w: 1.2 });
      else ink.line(gx, ty - 15, gx - 1, ty + 2, { seed: 80 + k, alpha: 0.85 * a, w: 1.2 });
    }
    // the Agent never says what it is doing
    const ax = narrow ? B.x + B.w - 46 : sx + sw_ + (B.x + B.w - sx - sw_) * 0.48;
    const as = narrow ? 64 : clamp(B.h * 0.22, 80, 130);
    const ay = narrow ? sy + sh * 0.62 : sy + sh * 0.62;
    agentFig(ax, ay, as, a, env.t, 0.35);
    const qs = ['最新資料？', '漏掉帳戶？', '舊版本？'];
    if (!narrow) {
      qs.forEach((q, i) => {
        const y = ay - as * 0.75 - (2 - i) * 28;
        const x = ax + (i - 1) * 18;
        ascii.glyph('?', x - tw(q, 15) / 2 - 10, y - 5, 12, c.ink2, a);
        ink.text(q, x, y, { size: 15, align: 'center', color: c.ink2, alpha: a * (0.6 + 0.4 * Math.sin(env.t * 1.3 + i * 2) ** 2) });
      });
    } else ascii.text('? ? ?', ax - 18, ay - as * 0.8, 12, c.ink2, a);
    if (!narrow && B.h > 420) ink.text('它從未被設計成「值得信任的工作對象」', cx, B.y + B.h - 4, { size: 15, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 2: 30 options in, 3 out ──
  function scene2(a, T, still) {
    const { c } = env;
    const { B, cx, cy, narrow } = G;
    // a tall pane pours top to bottom, a wide one left to right
    const tall = B.h > B.w * 0.95;
    const u = tall ? clamp(Math.min(B.w / 520, (B.h - 60) / 600), 0.55, 1.3) : clamp(Math.min(B.w / 640, B.h / 430), 0.55, 1.4);
    const tW = 30 * u;
    const tH = 20 * u;
    const gap = 8 * u;
    const gw = 5 * tW + 4 * gap;
    const gh = 6 * tH + 5 * gap;
    const as = clamp(110 * u, 60, 140);
    const ps = clamp(84 * u, 50, 100);
    const oW = tW * 1.5;
    const oH = tH * 1.5;
    let gx, gy, ax, ay, px, py;
    if (tall) {
      gx = cx - gw / 2;
      gy = B.y + 34;
      ax = cx;
      ay = gy + gh + 46 * u + as / 2;
      px = cx;
      py = ay + as / 2 + 46 * u + oH + 40 * u + ps * 0.45;
    } else {
      gx = B.x + (narrow ? 0 : B.w * 0.04);
      gy = cy - gh / 2;
      ax = B.x + B.w * 0.5;
      ay = cy;
      px = B.x + B.w - (narrow ? 24 : 50 * u);
      py = cy;
    }
    const outXY = (k) => (tall ? [cx - oW / 2 + (k - 1) * (oW + 30 * u), ay + as / 2 + 46 * u] : [lerp(ax, px, 0.5) - oW / 2, cy - oH / 2 + (k - 1) * (oH + 14 * u)]);
    const r = rng(pickSeed * 13);
    const pick = [];
    while (pick.length < 3) {
      const k = Math.floor(r() * 30);
      if (!pick.includes(k)) pick.push(k);
    }
    const P = 6.5;
    const ph = still ? 4.5 : (env.t - pickAt) % P;
    const fadeOut = still ? 1 : clamp((P - ph) / 0.4);
    const cell = Math.max(5, Math.round(10 * u));
    const tilePos = (i) => [gx + (i % 5) * (tW + gap), gy + Math.floor(i / 5) * (tH + gap)];
    const drawTile = (x, y, i, al, sc = 1) => {
      const cols = Math.max(2, Math.round((tW * sc) / cell));
      const rows = Math.max(1, Math.round((tH * sc) / cell));
      for (let rr = 0; rr < rows; rr++) for (let q = 0; q < cols; q++) {
        const v = 0.25 + ((i * 7 + q * (1 + (i % 3)) + rr * (2 + (i % 4))) % 5) * 0.14;
        ascii.glyph(v, x + (q + 0.5) * ((tW * sc) / cols), y + (rr + 0.5) * ((tH * sc) / rows), cell * Math.min(1, sc), c.ink, al);
      }
    };
    // the funnel: two pencil lines from around the options into the Agent
    if (tall) {
      ink.line(gx - 14, gy - 6, ax - as * 0.34, ay - as * 0.4, { seed: 21, alpha: 0.7 * a, w: 1.2 });
      ink.line(gx + gw + 14, gy - 6, ax + as * 0.34, ay - as * 0.4, { seed: 22, alpha: 0.7 * a, w: 1.2 });
    } else {
      ink.line(gx + gw + 16 * u, gy - 10, ax - as * 0.55, ay - as * 0.18, { seed: 21, alpha: 0.7 * a, w: 1.2 });
      ink.line(gx + gw + 16 * u, gy + gh + 10, ax - as * 0.55, ay + as * 0.25, { seed: 22, alpha: 0.7 * a, w: 1.2 });
    }
    for (let i = 0; i < 30; i++) {
      const [x, y] = tilePos(i);
      const launch = 0.2 + i * 0.05;
      const e = still ? 2 : (ph - launch) / 0.9;
      const chosen = pick.includes(i);
      let al = 0.85;
      if (e > 0 && e < 1) {
        const k = easeInOut(e);
        drawTile(lerp(x, ax - tW / 2, k), lerp(y, ay - tH / 2, k), i, a * (1 - k * 0.8), 1 - k * 0.5);
        al = 0.3;
      } else if (e >= 1) al = chosen && ph > 2.6 ? 0.9 : 0.3;
      if (chosen && (still || ph > 2.6)) ink.marker(x - 3, y - 3, tW + 6, tH + 6, { seed: 23 + i, alpha: c.hlAlpha * a * fadeOut });
      drawTile(x, y, i, a * al);
    }
    ink.text('30 個選項', gx + gw / 2, gy - 16, { size: 16, align: 'center', alpha: a });
    agentFig(ax, ay, as, a, env.t, 0.25);
    // the three it shows, ranked
    pick.forEach((i, k) => {
      const e = still ? 1 : easeOut((ph - 2.6 - k * 0.3) / 0.6);
      if (e <= 0) return;
      const [tx, ty] = outXY(k);
      const x = lerp(ax - oW / 2, tx, e);
      const y = lerp(ay, ty, e);
      const al = a * Math.min(1, e * 2) * fadeOut;
      ink.marker(x - 4, y - 4, oW + 8, oH + 8, { seed: 30 + k, alpha: c.hlAlpha * al });
      drawTile(x, y, i, al, 1.5);
      ink.rect(x - 4, y - 4, oW + 8, oH + 8, { seed: 33 + k, alpha: 0.8 * al, w: 1, passes: 1 });
      if (tall) ink.text(String(k + 1), x + oW / 2, y + oH + 22, { font: 'mono', size: 13, align: 'center', color: c.ink2, alpha: al });
      else ink.text(String(k + 1), x - 12, y + oH / 2 + 5, { font: 'mono', size: 13, align: 'right', color: c.ink2, alpha: al });
    });
    if (tall) {
      const [x0, y0] = outXY(0);
      ink.text('只剩 3 個', x0 - 22, y0 + oH / 2 + 6, { size: 16, align: 'right', alpha: a });
    } else {
      const [x1] = outXY(1);
      ink.line(ax + as * 0.5, cy, x1 - 18, cy, { seed: 24, alpha: 0.5 * a, w: 1 });
      ink.text('只剩 3 個', x1 + oW / 2, cy - oH * 1.5 - 14 * u - 18, { size: 16, align: 'center', alpha: a });
    }
    person(px, py, ps, a, 25);
    if (B.h > 360) {
      ink.text('品牌如何被理解、被排序、被信任', B.x + B.w / 2, B.y + B.h - 26, { size: 16, align: 'center', alpha: a });
      ink.text('競爭從需求捕捉，走向需求預測', B.x + B.w / 2, B.y + B.h - 4, { size: 14, align: 'center', color: c.ink2, alpha: a });
    }
  }

  // ── step 3: knowing where to stop ──
  function scene3(a, T, still) {
    const { c } = env;
    const { B, cy, narrow } = G;
    const u = clamp(Math.min(B.w / 700, B.h / 520), 0.55, 1.1);
    const cs = CASES[caseIdx % CASES.length];
    const P = cs.hard ? 7.5 : 4.6;
    const ph = still ? 5.6 : Math.min(env.t - caseAt, P);
    const fs = narrow ? 13 : 15;
    const ax = B.x + B.w * (narrow ? 0.34 : 0.38);
    const ay = cy + (narrow ? 0 : 12);
    const as = narrow ? 84 : clamp(130 * u, 62, 140);
    const okX = B.x + B.w * 0.88;
    const okY = ay - as * 0.12;
    const huX = B.x + B.w * 0.86;
    const huY = ay + clamp(B.h * 0.27, 70, 170);
    const hs = clamp(80 * u, 44, 86);
    // the rule
    ink.text(narrow ? '兩項以上政策交叉，就停下' : '門檻：兩項以上政策交叉，Agent 就主動停下', B.x + B.w / 2, B.y + 14, { size: narrow ? 14 : 16, align: 'center', alpha: a });
    // two exits: done by itself, or handed to a person
    const g = env.g;
    g.save();
    g.setLineDash([4, 6]);
    ink.line(ax + as * 0.5, okY, okX - 34 * u, okY, { seed: 41, alpha: 0.5 * a, w: 1, passes: 1 });
    ink.path([[ax + as * 0.3, ay + as * 0.45], [lerp(ax, huX, 0.55), huY - 6], [huX - hs * 0.6, huY - 4]], { seed: 42, alpha: 0.65 * a, w: 1.1, passes: 1 });
    g.restore();
    for (let k = 0; k < 4; k++) glyphLine(okX - 22 * u, okY + 8 - k * 9 * u, 44 * u, 8 * u, a * 0.8, 400 + k, 0.55, 0, 0.2);
    ink.path([[okX - 30 * u, okY - 30 * u], [okX - 30 * u, okY + 14], [okX + 30 * u, okY + 14], [okX + 30 * u, okY - 30 * u]], { seed: 401, alpha: 0.8 * a, w: 1.1 });
    ink.text('自動完成', okX, okY - 40 * u, { size: fs, align: 'center', alpha: a });
    if (!narrow) ink.text('查詢訂單、安排提醒', okX, okY + 38, { size: 13, align: 'center', color: c.ink2, alpha: a });
    person(huX, huY, hs, a, 43);
    ink.text('真人同仁', huX, huY + hs * 0.5 + 24, { size: fs, align: 'center', alpha: a });
    if (!narrow) tag('升級路徑', huX, huY - hs * 0.5 - 26, fs, a, { align: 'center', seed: 44 });
    const thinking = cs.hard && ph > 1.2 && ph < 1.8;
    agentFig(ax, ay, as, a, env.t, thinking ? 0.9 : 0.15);
    // the case card
    const n = cs.tags.length;
    const cw = narrow ? 100 : 136 * Math.max(0.85, u);
    const ch = 28 + n * (fs + 8);
    const arrive = easeInOut(ph / 1.2);
    let kx = lerp(B.x, ax - as * 0.5 - cw - 6, arrive);
    let ky = lerp(narrow ? B.y + 30 : ay - ch / 2 - 70 * u, ay - ch / 2 + (narrow ? 20 : 0), arrive);
    if (!cs.hard && ph > 1.9) {
      const e = easeInOut((ph - 1.9) / 1);
      kx = lerp(kx, okX - cw / 2, e);
      ky = lerp(ky, okY - ch * 0.6, e);
    }
    const gone = cs.hard ? clamp((ph - 2) / 0.6) : clamp((ph - 2.5) / 0.4);
    const cardA = a * (1 - gone * (cs.hard && !narrow ? 0.8 : 1));
    if (cardA > 0.01) {
      card(kx, ky, cw, ch, cardA, 45);
      ink.text(cs.hard ? '退換貨' : '低風險任務', kx + 10, ky + 19, { size: 13, color: c.ink2, alpha: cardA });
      cs.tags.forEach((s, i) => ink.text(s, kx + 10, ky + 20 + (i + 1) * (fs + 8), { size: fs, alpha: cardA * (cs.hard && ph > 2.1 ? 0.3 : 1) }));
    }
    if (!cs.hard) {
      if (ph > 1.4) {
        const f = clamp((ph - 1.4) / 0.3);
        check(ax + as * 0.42, ay - as * 0.62, 20, f, a, 402);
      }
      return;
    }
    // stop
    const st = clamp((ph - 1.6) / 0.3);
    const sy = ay - as * 0.84;
    if (st > 0) {
      const r = 16 * Math.max(0.8, u);
      ink.blob(ax, sy, r, { seed: 46, alpha: c.hlAlpha * a * st });
      ink.circle(ax, sy, r, { seed: 47, alpha: 0.9 * a * st, w: 1.4 });
      ink.line(ax - r * 0.3, sy - r * 0.42, ax - r * 0.3, sy + r * 0.42, { seed: 48, alpha: a * st, w: 2.2 });
      ink.line(ax + r * 0.3, sy - r * 0.42, ax + r * 0.3, sy + r * 0.42, { seed: 49, alpha: a * st, w: 2.2 });
      ink.text(`政策交叉 ×${n}`, ax - r - 10, sy + 5, { size: 13, align: 'right', color: c.ink2, alpha: a * st });
    }
    // three conflict points gathered into one summary, handed to a person
    const sumW = narrow ? 112 : 148 * Math.max(0.85, u);
    const sumH = 28 + n * (fs + 7);
    const travel = easeInOut((ph - 3.6) / 1.2);
    const sx = lerp(ax - sumW / 2, huX - hs * 0.6 - sumW - 12, travel);
    const syy = lerp(ay + as * 0.62, huY - sumH / 2 - 6, travel);
    const sumA = a * clamp((ph - 2) / 0.4);
    if (sumA > 0) {
      card(sx, syy, sumW, sumH, sumA, 50);
      ink.text('三個衝突點', sx + 10, syy + 19, { size: 13, color: c.ink2, alpha: sumA });
      cs.tags.forEach((s, i) => {
        const e = easeInOut((ph - 2.1 - i * 0.25) / 0.6);
        if (e <= 0) return;
        const fx = kx + 10;
        const fy = ky + 20 + (i + 1) * (fs + 8);
        const tx = sx + 10;
        const ty = syy + 20 + (i + 1) * (fs + 7);
        ink.text(s, lerp(fx, tx, e), lerp(fy, ty, e), { size: fs, alpha: a * e });
      });
      if (travel >= 1) ink.blob(huX, huY - hs * 0.1, hs * 0.5, { seed: 51, alpha: c.hlAlpha * 0.6 * a });
    }
    // what it says to the customer
    const say = clamp((ph - 2.8) / 0.4);
    if (say > 0) {
      if (narrow) {
        ink.text('「這個問題我想讓', B.x, B.y + B.h - 22, { size: 13, alpha: a * say });
        ink.text('同仁協助您確認」', B.x, B.y + B.h - 4, { size: 13, alpha: a * say });
      } else ink.text('「這個問題我想讓同仁協助您確認」', ax + 30 * u, sy + 6, { size: 16, alpha: a * say });
    }
  }

  // ── step 4: four walls ──
  function scene4(a, T, still, dt) {
    const { c } = env;
    const { B, cy, narrow } = G;
    if (!wallManual) wallGoal = still ? 4 : clamp(Math.floor((T - 0.5) / 1.5) + 1, 0, 4);
    wallProg = still ? wallGoal : approach(wallProg, wallGoal, dt, 0.28);
    const colW = B.w * 0.22;
    const stopX = (k) => B.x + B.w * (0.06 + k * 0.22);
    const wx = (i) => B.x + B.w * (0.17 + i * 0.22);
    const fsz = clamp(colW / 6.3, 13, 17);
    const wh = clamp(B.h * 0.3, 60, 190);
    const gy = Math.min(B.y + B.h - 60, cy + wh / 2 + 10);
    const ww = clamp(colW * 0.2, 14, 40);
    // a label that does not fit its column breaks into two lines
    const split = (str, size) => (tw(str, size) > colW - 12 ? [str.slice(0, Math.ceil(str.length / 2)), str.slice(Math.ceil(str.length / 2))] : [str]);
    ink.line(B.x, gy, B.x + B.w, gy, { seed: 60, alpha: 0.75 * a, w: 1.2 });
    WALLS.forEach(([from, to], i) => {
      const x = wx(i);
      const crossed = clamp(wallProg - i);
      // wall: a pencil block with a few courses of bricks
      ink.rect(x - ww / 2, gy - wh, ww, wh, { seed: 61 + i, alpha: 0.85 * a, w: 1.2, passes: 1 });
      const courses = Math.floor(wh / 16);
      const g = env.g;
      g.save();
      g.strokeStyle = c.pencil;
      g.globalAlpha = 0.4 * a;
      g.lineWidth = 0.8;
      g.beginPath();
      for (let k = 1; k < courses; k++) {
        const y = gy - wh + k * (wh / courses);
        g.moveTo(x - ww / 2, y);
        g.lineTo(x + ww / 2, y);
        const bx = x + (k % 2 ? -ww * 0.1 : ww * 0.2);
        g.moveTo(bx, y);
        g.lineTo(bx, y - wh / courses);
      }
      g.stroke();
      g.restore();
      // before: the old habit, struck out once the Agent is over
      const fy = gy - wh - 18;
      const fl = split(from, fsz);
      fl.forEach((l, j) => {
        const y = fy - (fl.length - 1 - j) * (fsz + 6);
        ink.text(l, x, y, { size: fsz, align: 'center', color: c.ink2, alpha: a * (1 - crossed * 0.45) });
        if (crossed > 0.05) {
          const m = tw(l, fsz);
          ink.line(x - m / 2 - 2, y - fsz * 0.35, lerp(x - m / 2, x + m / 2 + 2, crossed), y - fsz * 0.35, { seed: 66 + i * 3 + j, alpha: 0.8 * a, w: 1.1 });
        }
      });
      ink.text(String(i + 1), x, fy - fl.length * (fsz + 6) - 8, { font: 'mono', size: 13, align: 'center', color: c.ink2, alpha: a });
      // after: the new one, highlighted
      split(to, fsz + 1).forEach((l, j) => {
        const ty = gy + 34 + j * (fsz + 9);
        if (crossed > 0.05) tag(l, x, ty, fsz + 1, a * crossed, { align: 'center', seed: 70 + i * 3 + j });
        else ink.text(l, x, ty, { size: fsz + 1, align: 'center', color: c.ink2, alpha: a * 0.3 });
      });
    });
    // the Agent hops from stop to stop
    const as = clamp(B.w * 0.1, 40, 110);
    const k = Math.floor(wallProg);
    const f = wallProg - k;
    const xA = stopX(k);
    const xB = stopX(Math.min(4, k + 1));
    const x = lerp(xA, xB, f);
    const hop = Math.sin(f * Math.PI) * (wh + as * 0.5);
    agentFig(x, gy - as * 0.5 - hop, as, a, env.t, 0.2);
    if (narrow) return;
    ink.text('UX', stopX(0), gy + 34, { font: 'latin', size: 15, weight: 500, align: 'center', color: c.ink2, alpha: a });
    ink.text('AX', stopX(4), gy + 34, { font: 'latin', size: 15, weight: 700, align: 'center', alpha: a * (0.3 + 0.7 * clamp(wallProg - 3)) });
    if (!narrow) ink.text('UX 到 AX，要翻越四堵牆', B.x + B.w / 2, B.y + B.h - 4, { size: 15, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 5: six trust patterns as switches ──
  function scene5(a, T, still, dt) {
    const { g, c, acc, pointer } = env;
    const { B, cx, cy, narrow } = G;
    const items = env.data?.article?.framework?.items || [];
    if (!swManual) for (let i = 0; i < 6; i++) sw[i] = still || T > 0.6 + i * 0.5 ? 1 : 0;
    for (let i = 0; i < 6; i++) swV[i] = still ? sw[i] : approach(swV[i], sw[i], dt, 0.12);
    const on = swV.reduce((s, v) => s + v, 0);
    const s = clamp(Math.min(B.h * 0.4, B.w * (narrow ? 0.22 : 0.3)), 70, 210);
    const ay = cy - 14;
    const R = s * 0.74;
    const fs = narrow ? 13 : 17;
    const pw = narrow ? 32 : 42;
    const phh = narrow ? 17 : 21;
    const colOff = R + (narrow ? 14 : 34);
    const rowH = clamp(B.h * 0.2, 44, 110);
    swHot = [];
    // ring: six arcs, one per pattern, filled when on
    for (let i = 0; i < 6; i++) {
      const a0 = ARC[i] - 0.38;
      const a1 = ARC[i] + 0.38;
      if (swV[i] > 0.02) {
        g.save();
        g.globalAlpha = c.hlAlpha * a * swV[i];
        g.strokeStyle = acc;
        g.lineWidth = 11;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(cx, ay, R, a0, lerp(a0, a1, swV[i]));
        g.stroke();
        g.restore();
      }
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const q = lerp(a0, a1, k / 10);
        pts.push([cx + Math.cos(q) * R, ay + Math.sin(q) * R]);
      }
      ink.path(pts, { seed: 90 + i, alpha: 0.75 * a, w: 1.1, passes: 1 });
    }
    agentFig(cx, ay + s * 0.04, s, a, env.t, lerp(1, 0.04, on / 6));
    // switches: left column 0..2, right column 3..5
    for (let i = 0; i < 6; i++) {
      const left = i < 3;
      const row = i % 3;
      const y = ay + (row - 1) * rowH;
      const x = left ? cx - colOff - pw : cx + colOff;
      const v = swV[i];
      // pill
      const r = phh / 2;
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const q = Math.PI / 2 + (k / 16) * Math.PI;
        pts.push([x + r + Math.cos(q) * r, y + Math.sin(q) * r]);
      }
      for (let k = 0; k <= 16; k++) {
        const q = -Math.PI / 2 + (k / 16) * Math.PI;
        pts.push([x + pw - r + Math.cos(q) * r, y + Math.sin(q) * r]);
      }
      pts.push(pts[0]);
      if (v > 0.02) ink.marker(x + 1, y - r + 1, pw - 2, phh - 2, { seed: 100 + i, alpha: c.hlAlpha * a * v });
      ink.path(pts, { seed: 110 + i, alpha: 0.85 * a, w: 1.1, passes: 1 });
      const kx = lerp(x + r, x + pw - r, v);
      ink.dot(kx, y, r * 0.62, { seed: 120 + i, alpha: 0.9 * a, color: c.ink });
      // a thin pencil wire to the ring when on
      if (v > 0.05) {
        const q = ARC[i];
        ink.line(left ? x + pw + 4 : x - 4, y, cx + Math.cos(q) * (R + 8), ay + Math.sin(q) * (R + 8), { seed: 130 + i, alpha: 0.4 * a * v, w: 0.9, passes: 1 });
      }
      const name = items[i]?.[0] || '';
      ink.text(name, left ? x - 10 : x + pw + 10, y + fs * 0.36, { size: fs, align: left ? 'right' : 'left', alpha: a * (0.55 + 0.45 * v) });
      const m = tw(name, fs);
      swHot.push({ i, x0: left ? x - 14 - m : x - 6, x1: left ? x + pw + 6 : x + pw + 14 + m, y0: y - 22, y1: y + 22 });
    }
    // hovered or last flipped: its one-line meaning
    let show = swLast;
    if (pointer.in) for (const hz of swHot) if (pointer.x > hz.x0 && pointer.x < hz.x1 && pointer.y > hz.y0 && pointer.y < hz.y1) show = hz.i;
    const n = Math.round(on);
    ink.text(`${n} / 6`, cx, ay + R + 40, { font: 'mono', size: 18, align: 'center', alpha: a });
    if (B.h > 300) {
      const line = show >= 0 && items[show] ? `${items[show][0]}：${items[show][1]}` : '可預測、可驗證、可追溯';
      ink.text(line, cx, B.y + B.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
    }
  }

  const scenes = [scene0, scene1, scene2, scene3, scene4, scene5];

  function enter(s, t) {
    t0[s] = t;
    if (s === 1) {
      runAt = t;
      lastCycle = 0;
    }
    if (s === 2) pickAt = t;
    if (s === 3) {
      caseIdx = 0;
      caseAt = t;
    }
    if (s === 4) {
      wallManual = false;
      wallGoal = 0;
      wallProg = 0;
    }
    if (s === 5 && !swManual) sw.fill(0);
  }

  return {
    resize: geom,
    click(x, y) {
      const s = env.step;
      const t = env.t;
      if (s === 0) pulses.push(t);
      else if (s === 1) {
        runAt = t;
        lastCycle = 0;
        round++;
      } else if (s === 2) {
        pickSeed++;
        pickAt = t;
      } else if (s === 3) {
        caseIdx++;
        caseAt = t;
      } else if (s === 4) {
        wallManual = true;
        if (wallGoal >= 4) {
          wallGoal = 0;
          wallProg = 0;
        } else wallGoal = Math.round(wallGoal) + 1;
      } else if (s === 5) {
        // flip the switch under the pointer, or the nearest one
        let best = -1;
        let bd = 1e9;
        for (const hz of swHot) {
          const d = Math.hypot((hz.x0 + hz.x1) / 2 - x, (hz.y0 + hz.y1) / 2 - y);
          if (d < bd) {
            bd = d;
            best = hz.i;
          }
        }
        if (best >= 0) {
          swManual = true;
          sw[best] = sw[best] ? 0 : 1;
          swLast = best;
        }
      }
      while (pulses.length > 6) pulses.shift();
    },
    frame(t, dt) {
      const s = env.step;
      const still = dt === 0;
      if (s !== cur) {
        enter(s, t);
        cur = s;
      }
      for (let i = 0; i < 6; i++) mix[i] = still ? (i === s ? 1 : 0) : approach(mix[i], i === s ? 1 : 0, dt, 0.18);
      for (let i = 0; i < 6; i++) {
        if (mix[i] < 0.02) continue;
        scenes[i](mix[i] * mix[i], t - t0[i], still, dt);
      }
    },
  };
}
