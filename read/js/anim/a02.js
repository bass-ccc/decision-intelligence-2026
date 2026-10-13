// 02 Agentic 時代 — the real distance between a brand (glyphs) and a person (pencil).
// step 0  品牌 and 人 far apart; the AI agent circles the brand, not the person
// step 1  等待: the brand waits on an hourglass of glyphs, its arrow points where the person was
// step 2  拍照 vs 對話: a snapshot freezes one moment; a conversation keeps tracking the person
// step 3  產品思維 and 用戶思維: dialogue pushes the two circles into overlap; the overlap is 對話
// step 4  精度與邊界: a gauge at 0.89; beyond it, a hatched zone that still needs real people
// step 5  brand and person close, joined by a line that is half glyph, half pencil
// Click: send a new hypothesis to the person; it comes back with an answer.
import { hash, smooth, lerp, approach, clamp, noise3, easeInOut } from '../engine/noise.js';

export const hint = '點一下，丟出新假設';

const TAU = Math.PI * 2;
const GOLD = Math.PI * (3 - Math.sqrt(5));
// hypotheses, in the article's words
const HYP = ['哪種說法更打動人？', '換代言人，印象會變嗎？', '換通路，還會買嗎？', '價格提高五元，還買嗎？', '新包裝夠吸引人嗎？', '新口味會被接受嗎？'];
const CAPTION = [
  '品牌離 AI 越近，會不會反而離人越遠？',
  '慢下來，就是一種不理解的代價',
  '從一次性驗證，走向持續性驗證',
  '能拉近兩種視角的，只有對話',
  '把研究資源，留在真正需要人的地方',
  '品牌與人之間的距離，才會是真實的靠近',
];
const OUT = 1.1; // seconds to the person
const HOLD = 0.3;
const BACK = 1;

export default function make(env) {
  const { g, ink, ascii } = env;
  let G = {};
  const mix = { s0: 1, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  const P = { bx: 0, by: 0, px: 0, py: 0, bs: 1, ps: 1, amp: 0 };
  const bubbles = [];
  let asked = 0;
  let nextHyp = 0;
  let lastAuto = -9;
  let overlap = 0.85; // step 3: how far dialogue has pulled the two views together
  let needle = 0.89;
  const probes = [];

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
      ink.marker(x0 - 5, y - size * 0.9, wd + 10, size * 1.2, { seed: o.mark, alpha: env.c.hlAlpha * k });
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
  // a small paper patch so text stays readable over hatching
  function patch(x, y, w, h, k) {
    g.save();
    g.globalAlpha *= 0.92 * k;
    g.fillStyle = env.c.sheet;
    g.fillRect(x, y, w, h);
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
    G.R = Math.min(G.W * (mini ? 0.12 : G.H > G.W * 0.8 ? 0.1 : 0.085), G.H * (mini ? 0.2 : 0.14), 78);
    G.my = mini ? G.top + G.H * 0.42 : G.top + G.H * 0.47;
    // step 3 circles
    G.Rc = Math.min(G.W * 0.21, G.H * 0.36, 170);
    // step 4 gauge and boundary
    G.Rg = Math.min(G.W * 0.21, G.H * 0.36, 160);
    G.gx = G.left + G.W * (G.narrow ? 0.27 : 0.29);
    G.gy = G.top + G.H * 0.5 + G.Rg * 0.3;
    G.zone = { x: G.left + G.W * 0.58, y: G.top + G.H * 0.1, w: G.W * 0.42, h: G.H * 0.8 };
  }
  geom();

  // where the brand and the person want to be in each step
  function targets(s) {
    const { left, W, my, cx, Rc } = G;
    const d5 = Math.max(G.R * 1.9, W * 0.14);
    const gap = Rc * lerp(2.25, 1.3, overlap);
    switch (s) {
      case 1: return [left + W * 0.15, my, left + W * 0.7, my, 1, 1, 1];
      case 2: return [left + W * 0.13, my, left + W * 0.68, my, 1, 1, 1];
      case 3: return [cx - gap / 2 - Rc * 0.36, my - Rc * 0.46, cx + gap / 2 + Rc * 0.36, my - Rc * 0.46, 0.42, 0.42, 0];
      case 4: return [G.gx, G.gy, G.zone.x + G.zone.w / 2, G.zone.y + G.zone.h * 0.62, 0, 0, 0];
      case 5: return [cx - d5, my, cx + d5, my, 1, 1, 0];
      default: return [left + W * (env.mini ? 0.22 : 0.18), my, left + W * (env.mini ? 0.78 : 0.82), my, 1, 1, 0.25];
    }
  }
  // the person never stands still
  const drift = (t) => [noise3(t * 0.16, 3.1, 0.5) * 1.7, noise3(7.7, t * 0.16, 1.5) * 1.7];
  const personAt = (t) => {
    const [dx, dy] = drift(t);
    return [P.px + dx * G.W * 0.13 * P.amp, P.py + dy * G.H * 0.2 * P.amp];
  };

  // ── the brand: a disc of glyphs ──
  function brand(x, y, R, k, t) {
    if (R < 1 || k < 0.01) return;
    const n = env.mini ? 70 : 150;
    const cell = Math.max(6, Math.min(10, R * 0.16));
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt((i + 0.5) / n);
      const a = i * GOLD + t * 0.05;
      ascii.glyph(0.95 - rr * 0.55, x + Math.cos(a) * rr * R, y + Math.sin(a) * rr * R, cell, env.c.ink, 0.9 * k);
    }
  }
  // ── the person: a disc of pencil strokes ──
  function person(x, y, R, k, seed = 1) {
    if (R < 1 || k < 0.01) return;
    const n = env.mini ? 50 : 110;
    const list = [];
    const L = Math.max(1.4, R * 0.05);
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt((i + 0.5) / n) * R * 0.9;
      const a = i * GOLD;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      const b = a + 1.2;
      list.push(px - Math.cos(b) * L, py - Math.sin(b) * L, px + Math.cos(b) * L, py + Math.sin(b) * L);
    }
    marks(list, 0.8 * k, 1.2);
    ink.circle(x, y, R, { seed: 3 + seed, w: 1.3, alpha: 0.85 * k });
  }

  // ── hypothesis bubbles: out to the person, back with an answer ──
  function send(t, user) {
    bubbles.push({ t0: t, q: nextHyp % HYP.length, user });
    nextHyp++;
    if (bubbles.length > 8) bubbles.shift();
  }
  function drawBubbles(t, k, bx, by, px, py) {
    const R = G.R * P.bs;
    let lastUser = null;
    for (const b of bubbles) if (b.user) lastUser = b;
    for (const b of bubbles) {
      const a = t - b.t0;
      if (a < 0 || a > OUT + HOLD + BACK) continue;
      // the newest question floats up from the brand
      if (a < 1.6 && !env.mini && b.user && P.bs > 0.3 && b === lastUser) {
        const f = a / 1.6;
        label(HYP[b.q], bx, by - R - (mix.s0 > 0.5 ? 44 : 24) - f * 18, { size: G.narrow ? 13 : 15, align: 'center', k: k * (1 - f * f), color: env.c.ink2 });
      }
      let u;
      let back = false;
      if (a < OUT) u = easeInOut(a / OUT);
      else if (a < OUT + HOLD) u = 1;
      else {
        u = 1 - easeInOut((a - OUT - HOLD) / BACK);
        back = true;
      }
      const dx = px - bx;
      const dy = py - by;
      const d = Math.hypot(dx, dy) || 1;
      const sx = bx + (dx / d) * (R + 10);
      const sy = by + (dy / d) * (R + 10);
      const ex = px - (dx / d) * (G.R * P.ps + 12);
      const ey = py - (dy / d) * (G.R * P.ps + 12);
      const lift = Math.sin(u * Math.PI) * Math.min(40, d * 0.12) * (back ? -1 : 1) * (1 - mix.s5);
      const x = lerp(sx, ex, u) + (dy / d) * lift;
      const y = lerp(sy, ey, u) - (dx / d) * lift;
      const r = G.narrow ? 8 : 10;
      if (!back) {
        ink.circle(x, y, r, { seed: 50 + b.q, w: 1, alpha: 0.75 * k, passes: 1 });
        ascii.glyph('?', x, y + 0.5, r * 1.3, env.c.ink, k);
      } else {
        ink.blob(x, y, r + 2, { seed: 60 + b.q, alpha: env.c.hlAlpha * k });
        ink.circle(x, y, r, { seed: 70 + b.q, w: 1.2, alpha: 0.9 * k, passes: 1 });
        ink.text('!', x, y + r * 0.5, { size: r * 1.4, align: 'center', alpha: k, weight: 700 });
      }
      if (a > OUT - 0.05 && a < OUT + HOLD + 0.3) {
        const f = (a - OUT + 0.05) / (HOLD + 0.35);
        ink.circle(px, py, G.R * P.ps * (1.05 + f * 0.4), { seed: 80, w: 1, alpha: 0.6 * (1 - f) * k, passes: 1, boil: false });
      }
    }
  }

  // ── step 1: the hourglass ──
  function hourglass(x, y, cell, p, k) {
    const rows = 5;
    const col = env.c.ink;
    for (let i = -rows - 1; i <= rows + 1; i++) {
      const yy = y + i * cell;
      if (Math.abs(i) === rows + 1) {
        for (let q = -rows - 1; q <= rows + 1; q++) ascii.glyph('=', x + q * cell * 0.8, yy, cell, col, 0.9 * k);
        continue;
      }
      const half = Math.abs(i) * 0.8 + 0.7;
      ascii.glyph(i < 0 ? '\\' : '/', x - half * cell, yy, cell, col, 0.9 * k);
      ascii.glyph(i < 0 ? '/' : '\\', x + half * cell, yy, cell, col, 0.9 * k);
      const fallen = Math.round(p * rows);
      const full = i < 0 ? i >= -rows + fallen : i > rows - fallen;
      if (full && i !== 0) {
        const m = Math.floor(half - 0.6);
        for (let q = -m; q <= m; q++) ascii.glyph(':', x + q * cell, yy, cell, col, 0.75 * k);
      } else if (i >= 0 && i <= rows - fallen && p < 1) ascii.glyph('·', x, yy, cell, col, (0.5 + 0.5 * Math.sin(env.t * 9 + i)) * k);
    }
  }

  function sceneWait(t, k, bx, by, px, py) {
    const HG = 5.5;
    const n = Math.floor(t / HG);
    const p = t / HG - n;
    const t0 = n * HG;
    const [gx, gy] = personAt(t0);
    const R = G.R;
    const cell = G.narrow ? 6 : 8;
    hourglass(bx, by - R - cell * 8.5, cell, p, k);
    label('等待', bx + cell * 6, by - R - cell * 8.5 + 5, { size: G.narrow ? 14 : 17, k });
    // the person's way since the research began
    const trail = [];
    for (let i = 0; i <= 18; i++) trail.push(personAt(lerp(t0, t, i / 18)));
    ink.path(trail, { seed: 91, w: 1, alpha: 0.45 * k, passes: 1 });
    // where the person was
    g.setLineDash([4, 5]);
    ink.circle(gx, gy, R, { seed: 92, w: 1, alpha: 0.6 * k, passes: 1, boil: false });
    g.setLineDash([]);
    label('當時', gx, gy + R + 22, { size: 14, align: 'center', k, color: env.c.ink2 });
    label('現在', px, py - R - 12, { size: 14, align: 'center', k, color: env.c.ink2 });
    // the brand's arrow still points there
    const dx = gx - bx;
    const dy = gy - by;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const x1 = bx + ux * (R + 10);
    const y1 = by + uy * (R + 10);
    const x2 = gx - ux * (R + 8);
    const y2 = gy - uy * (R + 8);
    ascii.line(x1, y1, x2, y2, 10, env.c.ink, 0.75 * k, '·');
    ink.line(x2, y2, x2 - ux * 10 + uy * 6, y2 - uy * 10 - ux * 6, { seed: 93, w: 1.3, alpha: 0.9 * k, passes: 1 });
    ink.line(x2, y2, x2 - ux * 10 - uy * 6, y2 - uy * 10 + ux * 6, { seed: 94, w: 1.3, alpha: 0.9 * k, passes: 1 });
    // report ready: the arrow jumps
    if (p > 0.94) ink.circle(gx, gy, R * (1 + (p - 0.94) * 6), { seed: 95, w: 1, alpha: 0.5 * k, passes: 1, boil: false });
  }

  function sceneTalk(t, k, bx, by, px, py) {
    const R = G.R;
    // the snapshot: one frozen moment
    const SN = 4.6;
    const n = Math.floor(t / SN);
    for (let back = 1; back >= 0; back--) {
      const ts = (n - back) * SN;
      if (ts < 0) continue;
      const a = t - ts;
      const [sx, sy] = personAt(ts);
      const al = k * (back ? 0.3 : 1);
      const fr = R * 1.45;
      if (!back && a < 0.35) {
        g.save();
        g.globalAlpha *= (1 - a / 0.35) * env.c.hlAlpha;
        g.fillStyle = env.acc;
        g.fillRect(sx - fr, sy - fr, fr * 2, fr * 2);
        g.restore();
      }
      // corner brackets
      const c = fr * 0.35;
      const list = [];
      for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = sx + qx * fr;
        const y = sy + qy * fr;
        list.push(x, y, x - qx * c, y, x, y, x, y - qy * c);
      }
      marks(list, 0.9 * al, 1.4);
      // the frozen copy
      g.setLineDash([3, 4]);
      ink.circle(sx, sy, R, { seed: 101, w: 1, alpha: 0.55 * al, passes: 1, boil: false });
      g.setLineDash([]);
      if (!back) {
        label('拍照', sx - fr, sy - fr - 10, { size: G.narrow ? 14 : 16, k: al });
        if (!G.narrow) label('一次性驗證', sx - fr + 38, sy - fr - 10, { size: 13, k: al, color: env.c.ink2 });
      }
    }
    // the conversation: a wave that always reaches the person where they are now
    const dx = px - bx;
    const dy = py - by;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const L = d - R - G.R * P.ps - 16;
    const cell = G.narrow ? 8 : 10;
    const N = Math.max(2, Math.floor(L / (cell * 0.75)));
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const off = Math.sin(s * L * 0.07 - t * 6) * 6 * Math.sin(s * Math.PI);
      const x = bx + ux * (R + 8 + s * L) - uy * off;
      const y = by + uy * (R + 8 + s * L) + ux * off;
      ascii.glyph(i % 4 === 0 ? ':' : '·', x, y, cell, env.c.ink, 0.85 * k);
    }
    const mx = bx + ux * (R + 8 + L * 0.42);
    const myy = by + uy * (R + 8 + L * 0.42);
    label('對話', mx, myy + 30, { size: G.narrow ? 14 : 17, k, mark: 102, align: 'center' });
    if (!G.narrow) label('持續性驗證', mx, myy + 52, { size: 13, k, color: env.c.ink2, align: 'center' });
  }

  // ── step 3: two views, pulled together by dialogue ──
  function sceneViews(k, bx, by, px, py) {
    const { Rc, cx, my } = G;
    const gap = Rc * lerp(2.25, 1.3, overlap);
    const A = [cx - gap / 2, my];
    const B = [cx + gap / 2, my];
    // the overlap: hatched and highlighted
    const lens = Math.max(0, 2 * Rc - gap);
    if (lens > 1) {
      g.save();
      g.beginPath();
      g.arc(A[0], A[1], Rc, 0, TAU);
      g.clip();
      g.beginPath();
      g.arc(B[0], B[1], Rc, 0, TAU);
      g.clip();
      g.save();
      g.globalAlpha *= env.c.hlAlpha * k;
      g.fillStyle = env.acc;
      g.fillRect(B[0] - Rc, my - Rc, lens, Rc * 2);
      g.restore();
      ink.hatch({ x: B[0] - Rc, y: my - Rc, w: lens, h: Rc * 2 }, { seed: 111, gap: 7, alpha: 0.4 * k, w: 0.9 });
      g.restore();
    }
    // 產品思維: a ring of glyphs; 用戶思維: a pencil ring
    const n = Math.round((TAU * Rc) / 11);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ascii.glyph(i % 3 === 0 ? ':' : '·', A[0] + Math.cos(a) * Rc, A[1] + Math.sin(a) * Rc, G.narrow ? 9 : 11, env.c.ink, 0.9 * k);
    }
    ink.circle(B[0], B[1], Rc, { seed: 112, w: 1.4, alpha: 0.9 * k });
    const ts = G.narrow ? 15 : 19;
    label('產品思維', A[0], A[1] - Rc - 14, { size: ts, align: 'center', k });
    label('用戶思維', B[0], B[1] - Rc - 14, { size: ts, align: 'center', k });
    // the lens
    const lx = (A[0] + B[0]) / 2;
    const lw = Math.max(0, 2 * Rc - gap);
    if (lw > 20) {
      patch(lx - 22, my - 14, 44, 24, k * clamp((lw - 20) / 30));
      label('對話', lx, my + 5, { size: G.narrow ? 14 : 17, align: 'center', k: k * clamp((lw - 20) / 30) });
    }
    if (!G.narrow && Rc > 110) {
      const qs = 14;
      ['有什麼功能？', '給誰聽？', '想說什麼？'].forEach((q, i) => label(q, A[0] - Rc * 0.78, my + 6 + i * 23, { size: qs, k, color: env.c.ink2 }));
      ['在什麼場景？', '遇到什麼問題？', '解決哪一個？'].forEach((q, i) => label(q, B[0] + Rc * 0.78, my + 6 + i * 23, { size: qs, k, color: env.c.ink2, align: 'right' }));
    }
  }

  // ── step 4: precision and its boundary ──
  function sceneBounds(t, k) {
    const { gx, gy, Rg, zone } = G;
    // the gauge
    const arc = (r, a1, a2, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = a1 + ((a2 - a1) * i) / n;
        pts.push([gx + Math.cos(a) * r, gy + Math.sin(a) * r]);
      }
      return pts;
    };
    g.save();
    g.globalAlpha *= env.c.hlAlpha * k;
    g.strokeStyle = env.acc;
    g.lineWidth = Math.max(8, Rg * 0.12);
    g.beginPath();
    g.arc(gx, gy, Rg * 0.9, Math.PI, Math.PI + needle * Math.PI);
    g.stroke();
    g.restore();
    ink.path(arc(Rg, Math.PI, TAU, 40), { seed: 121, w: 1.4, alpha: 0.9 * k });
    ink.line(gx - Rg - 8, gy, gx + Rg + 8, gy, { seed: 122, w: 1.1, alpha: 0.7 * k, passes: 1 });
    const tk = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r0 = Rg * (i % 5 === 0 ? 0.84 : 0.91);
      tk.push(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * Rg, gy + Math.sin(a) * Rg);
    }
    marks(tk, 0.85 * k, 1.2);
    const ms = G.narrow ? 11 : 13;
    ascii.text('0', gx - Rg - 4 - ms * 0.6, gy - 10, ms, env.c.ink2, k);
    ascii.text('1', gx + Rg + 6, gy - 10, ms, env.c.ink2, k);
    ascii.text('0.5', gx - ms * 0.9, gy - Rg - 12, ms, env.c.ink2, k);
    const na = Math.PI + needle * Math.PI;
    ink.line(gx, gy, gx + Math.cos(na) * Rg * 0.8, gy + Math.sin(na) * Rg * 0.8, { seed: 123, w: 2.2, alpha: k });
    ink.dot(gx, gy, 5, { seed: 124, alpha: k, color: env.c.ink });
    const vs = G.narrow ? 24 : 34;
    ink.text('0.89', gx, gy + vs + 10, { font: 'mono', size: vs, weight: 500, align: 'center', alpha: k });
    label(G.narrow ? '與真人調查的吻合度' : 'AI Persona 與真人調查的吻合程度', gx, gy + vs + 36, { size: G.narrow ? 13 : 15, align: 'center', k, color: env.c.ink2 });
    label('精度', gx, gy - Rg - 36, { size: G.narrow ? 16 : 20, align: 'center', k, mark: 125 });
    // simulated answers flow out of the gauge; past the line they become question marks
    const cell = G.narrow ? 9 : 12;
    for (let j = 0; j < 34; j++) {
      const ph = (t * 0.16 + hash(j, 1)) % 1;
      const x = lerp(gx + Rg * 1.05, zone.x + zone.w * 0.8, ph);
      const y = lerp(zone.y + zone.h * 0.1, zone.y + zone.h * 0.92, hash(j, 2)) + Math.sin(t + j) * 4;
      const inside = x > zone.x;
      const al = inside ? 0.9 * (1 - (x - zone.x) / (zone.w * 0.8)) : 0.6 * clamp(ph * 5);
      ascii.glyph(inside ? '?' : hash(j, 3) < 0.6 ? '·' : ':', x, y, cell, env.c.ink, al * k);
    }
    // the boundary
    ink.hatch({ x: zone.x, y: zone.y, w: zone.w, h: zone.h }, { seed: 126, gap: 8, alpha: 0.32 * k, w: 0.9 });
    g.setLineDash([6, 5]);
    ink.line(zone.x, zone.y - 6, zone.x, zone.y + zone.h + 6, { seed: 127, w: 1.2, alpha: 0.85 * k, passes: 1 });
    g.setLineDash([]);
    label('邊界', zone.x + 10, zone.y - 12, { size: G.narrow ? 16 : 20, k });
    const ls = G.narrow ? 13 : 16;
    const items = ['全新品類', G.narrow ? '社會情緒劇變' : '劇烈的社會情緒轉變'];
    items.forEach((s, i) => {
      const y = zone.y + zone.h * (0.18 + i * 0.2);
      const wd = tw(s, ls);
      patch(zone.x + 14, y - ls - 2, wd + 12, ls + 10, k);
      label(s, zone.x + 20, y, { size: ls, k });
    });
    // a real person, for calibration
    const px = zone.x + zone.w * 0.5;
    const py = zone.y + zone.h * 0.66;
    const pr = Math.min(G.R * 0.8, zone.w * 0.16);
    g.save();
    g.globalAlpha *= 0.92 * k;
    g.fillStyle = env.c.sheet;
    g.beginPath();
    g.arc(px, py, pr + 7, 0, TAU);
    g.fill();
    g.restore();
    person(px, py, pr, k, 9);
    const cs = G.narrow ? 13 : 15;
    const cw = tw('仍需真人研究校準', cs);
    patch(px - cw / 2 - 6, py + pr + 6, cw + 12, cs + 12, k);
    label('仍需真人研究校準', px, py + pr + 6 + cs + 1, { size: cs, align: 'center', k, mark: 128 });
    // probes the reader dropped
    for (const p of probes) {
      const a = t - p.t0;
      if (a > 2.2) continue;
      const f = a / 2.2;
      const inZone = p.x > zone.x;
      ink.circle(p.x, p.y, 8 + f * 26, { seed: 129, w: 1, alpha: 0.6 * (1 - f) * k, passes: 1, boil: false });
      ascii.glyph(inZone ? '?' : '+', p.x, p.y, 16, env.c.ink, (1 - f) * k);
    }
  }

  // the measuring line under the two discs
  const dimY = (by) => Math.min(by + G.R + (env.mini ? 34 : 70), G.bot - (env.mini ? 4 : 24));

  // ── step 5: close, and joined ──
  function sceneClose(t, k, bx, by, px, py) {
    const R = G.R;
    const x1 = bx + R + 8;
    const x2 = px - R - 8;
    const xm = (x1 + x2) / 2;
    const cell = G.narrow ? 8 : 10;
    const n = Math.max(1, Math.floor((xm - x1) / (cell * 0.8)));
    for (let i = 0; i <= n; i++) ascii.glyph(i % 3 === 0 ? ':' : '·', lerp(x1, xm, i / n), by, cell, env.c.ink, 0.9 * k);
    ink.line(xm, by, x2, by, { seed: 131, w: 1.4, alpha: 0.9 * k });
    label('對話', xm, by - 18, { size: G.narrow ? 14 : 17, align: 'center', k });
    const ss = G.narrow ? 13 : 14;
    if (by + R + 44 < dimY(by) - 14) {
      label('產品思維', bx, by + R + 44, { size: ss, align: 'center', k, color: env.c.ink2 });
      label('用戶思維', px, py + R + 44, { size: ss, align: 'center', k, color: env.c.ink2 });
    }
    // the agent works between them now
    const u = 0.5 - 0.5 * Math.cos(t * 1.6);
    ascii.glyph('*', lerp(x1, x2, u), by - 1, G.narrow ? 12 : 15, env.c.ink, k);
  }

  return {
    resize: geom,
    warm(sec) {
      lastAuto = sec - 1;
    },
    click(x, y) {
      asked++;
      if (env.step === 4) probes.push({ x, y, t0: env.t });
      else send(env.t, true);
      if (env.step === 3) overlap = Math.min(1, overlap + 0.15);
      if (env.step === 4) needle = 0.89 + (x > G.zone.x ? -0.06 : 0.03);
      if (probes.length > 6) probes.shift();
    },
    frame(t, dt) {
      const { c } = env;
      const s = env.mini ? 0 : env.step;
      for (let i = 0; i < 6; i++) {
        const key = 's' + i;
        mix[key] = dt > 0 ? approach(mix[key], s === i ? 1 : 0, dt, 0.3) : s === i ? 1 : 0;
      }
      // dialogue keeps the two views together; silence lets them drift apart
      if (dt > 0) {
        overlap = approach(overlap, 0, dt, 8);
        needle = approach(needle, 0.89, dt, 0.35);
        if ((s === 2 || s === 3 || s === 5) && t - lastAuto > (s === 3 ? 1.7 : 2.6)) {
          send(t, false);
          lastAuto = t;
        }
        for (const b of bubbles) {
          const a = t - b.t0;
          if (s === 3 && !b.hit && a > OUT) {
            b.hit = true;
            overlap = Math.min(1, overlap + 0.22);
          }
        }
      } else overlap = s === 3 ? 0.85 : overlap;
      if (s === 4 && dt === 0) needle = 0.89;
      const tg = targets(s);
      const keys = ['bx', 'by', 'px', 'py', 'bs', 'ps', 'amp'];
      keys.forEach((key, i) => (P[key] = dt > 0 ? approach(P[key], tg[i], dt, 0.4) : tg[i]));
      const bx = P.bx;
      const by = P.by;
      const [px, py] = personAt(t);
      const R = G.R;

      // scene furniture behind the two discs
      const scene = (key, fn) => {
        const k = mix[key];
        if (k < 0.01) return;
        fn(smooth(k));
      };
      scene('s1', (k) => sceneWait(t, k, bx, by, px, py));
      scene('s2', (k) => sceneTalk(t, k, bx, by, px, py));
      scene('s3', (k) => sceneViews(k, bx, by, px, py));
      scene('s4', (k) => sceneBounds(t, k));
      scene('s5', (k) => sceneClose(t, k, bx, by, px, py));

      // step 0 and 5: the distance, measured
      const kd = smooth(mix.s0 + mix.s5);
      if (kd > 0.01) {
        const y = dimY(by);
        const x1 = bx;
        const x2 = px;
        ink.line(x1, y, x2, y, { seed: 141, w: 1, alpha: 0.6 * kd, passes: 1 });
        ink.line(x1, y - 6, x1, y + 6, { seed: 142, w: 1, alpha: 0.6 * kd, passes: 1 });
        ink.line(x2, y - 6, x2, y + 6, { seed: 143, w: 1, alpha: 0.6 * kd, passes: 1 });
        if (!env.mini) {
          label('距離', (x1 + x2) / 2, y + 24, { size: G.narrow ? 14 : 16, align: 'center', k: smooth(mix.s0), color: c.ink2 });
          label('真實的靠近', (x1 + x2) / 2, y + 26, { size: G.narrow ? 15 : 18, align: 'center', k: smooth(mix.s5), mark: 144 });
        }
      }

      // the two
      brand(bx, by, R * P.bs, Math.min(1, P.bs * 1.5), t);
      person(px, py, R * P.ps, Math.min(1, P.ps * 1.5));
      const kl = smooth(Math.min(P.bs, P.ps));
      if (kl > 0.6) {
        const ns = env.mini ? 13 : G.narrow ? 15 : 18;
        label('品牌', bx, by + R * P.bs + (env.mini ? 18 : 26), { size: ns, align: 'center', k: (kl - 0.6) / 0.4 });
        label('人', px, py + R * P.ps + (env.mini ? 18 : 26), { size: ns, align: 'center', k: (kl - 0.6) / 0.4 });
      }
      // step 0: the agent circles the brand — close to AI, far from people
      if (mix.s0 > 0.01) {
        const k = smooth(mix.s0);
        const a = t * 1.7;
        const rx = R * 1.55;
        const ry = R * 0.75;
        for (let i = 6; i >= 0; i--) {
          const b = a - i * 0.14;
          ascii.glyph(i ? '·' : '*', bx + Math.cos(b) * rx, by + Math.sin(b) * ry, i ? (env.mini ? 9 : 12) : env.mini ? 14 : 20, c.ink, (i ? 0.75 - i * 0.08 : 1) * k);
        }
        if (!env.mini && !G.narrow) ascii.text('AI agent', bx - 26, by - R - 18, 11, c.ink2, 0.8 * k);
      }
      drawBubbles(t, 1, bx, by, px, py);

      if (env.mini) return;
      if (G.cap) {
        const ks = [mix.s0, mix.s1, mix.s2, mix.s3, mix.s4, mix.s5];
        ks.forEach((k, i) => label(CAPTION[i], G.cx, G.capY, { size: 15, align: 'center', k: smooth(k), color: c.ink2 }));
      }
      if (asked) ascii.text(`你丟出的假設 ×${asked}`, G.right - 130, 46, 12, c.ink2, 0.9);
    },
  };
}
