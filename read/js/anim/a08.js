// 08 當注意力成為稀缺資源 — attention flicks past as glyphs; only what passes a moment worth remembering stays, in pencil.
// step 0  the attention ring: one screen's dwell time shrinks from 150 秒 (2004) to 47 秒, glyphs flick past
// step 1  Gen Z 用消費管理情緒: attention wanders; emotional moments (療癒系 IP、演唱會…) pull it into orbit
// step 2  粉絲經濟的六個現場: six islands where attention pools
// step 3  從流量到轉換: one stream, 節目 → Shorts → Talk Concert → 周邊, glyphs become actions
// step 4  把 Attention 轉化為 Memory: what passes through a memorable moment becomes a pencil star that stays
// step 5  IP × 娛樂 × 體驗 × 商業: the cycle around IP
// Click or hold: open a moment of your own; attention passing through it becomes a memory star (counted).
import { ARTICLES } from '../content.js';
import { rng, hash, smooth, lerp, approach, clamp, noise2 } from '../engine/noise.js';

export const hint = '點住，抓住注意力';

const ART = ARTICLES.find((a) => a.no === 8);
const EMO = ['療癒系 IP', '演唱會', '運動賽事', '沉浸式娛樂'];
const ISLANDS = ['二次元', '周邊商品', '2.5 次元', '經典 IP', '短劇', '運動'];
const ISLAND_NOTE = { 0: '50.5 萬人次 · 2026 台北國際動漫節', 4: '97% Z 世代看過短影音' };
const STATIONS = ['節目', 'Shorts', 'Talk Concert', '周邊'];
const CYCLE = ART.framework.items; // 娛樂 體驗 粉絲社群 商業
const CHARS = '·:*+·.:';

export default function make(env) {
  const m = [1, 0, 0, 0, 0, 0];
  let G = {};
  const NP = env.mini ? 50 : 150;
  const r0 = rng(8);
  const P = Array.from({ length: NP }, (_, i) => ({
    i,
    a: r0(),
    b: r0(),
    c: r0(),
    d: r0(),
    ch: CHARS[i % CHARS.length],
    x: -100,
    y: -100,
    hidden: 0, // time until which the particle is hidden (it became a star)
    lastX: -100,
  }));
  const userStars = []; // the reader's catches: {x, y, t}
  let caught = 0;
  const sceneStars = []; // step 4's stars
  let hold = null; // the reader's moment: {x, y, r, t0, up}
  let heap = 0; // step 3 actions
  let first = true;

  function geom() {
    const { w, h } = env;
    const top = env.mini ? 14 : 48;
    const bot = env.mini ? h - 12 : h - 60;
    const U = Math.min(w, h);
    const narrow = w < 560;
    G = { w, h, top, bot, U, narrow, cx: w / 2, cy: top + (bot - top) * 0.5, fs: narrow ? 13 : 15 };
    G.R0 = env.mini ? Math.min(w * 0.3, (bot - top) * 0.4) : Math.min(w * 0.28, (bot - top) * 0.33);
    G.r0y = top + (bot - top) * (env.mini ? 0.5 : 0.47);
    G.emo = [[0.22, 0.3], [0.76, 0.24], [0.3, 0.76], [0.8, 0.72]].map(([u, v]) => [lerp(36, w - 36, u), lerp(top + 30, bot - 20, v)]);
    G.er = clamp(U * 0.085, 24, 62);
    const iy = narrow ? [0.3, 0.76] : [0.32, 0.76];
    G.isl = ISLANDS.map((_, i) => [w * [0.18, 0.5, 0.82][i % 3], lerp(top, bot, iy[Math.floor(i / 3)])]);
    G.ir = Math.min(w / 8, (bot - top) / 6.2);
    G.mx = w * 0.46;
    G.my = top + (bot - top) * 0.66;
    G.mr = clamp(U * 0.09, 26, 70);
    G.sky = [top + 30, top + (bot - top) * 0.36];
    G.cyc = Math.min(w * 0.3, (bot - top) * 0.34);
    G.cycY = top + (bot - top) * 0.53;
  }

  // the stream path of step 3 (u in 0..1)
  function flowXY(u) {
    const { w, cy, bot, top } = G;
    return [lerp(w * 0.06, w * 0.84, u), cy + Math.sin(u * Math.PI * 2.2) * (bot - top) * 0.12];
  }
  const stationU = [0.16, 0.38, 0.6, 0.8];

  // where particle p wants to be at time `since` in step s; returns [x, y, look] look: 0 glyph, 1 pencil, -1 hidden
  function want(p, s, t, since) {
    const { w, top, bot } = G;
    if (s === 0 || s === 4) {
      // a stream: fast, left to right
      const sp = (0.32 + 0.3 * p.a) * (s === 4 ? 0.7 : 1);
      const u = (p.b + t * sp) % 1;
      const x = lerp(-20, w + 20, u);
      let y = lerp(top + 16, bot - 8, p.c) + noise2(p.i * 0.3, t * 0.4) * 10;
      if (s === 4) {
        // most lanes miss the moment; a few go through it and become stars
        const through = p.i % 5 === 0;
        y = through ? G.my + (p.c - 0.5) * G.mr * 1.4 : lerp(top + (bot - top) * 0.42, bot - 4, p.c);
        if (through && x > G.mx) return [x, y, -1];
        return [x, y, 0, through ? 1 : clamp(1 - (x - G.mx) / (w - G.mx), 0.15, 1)];
      }
      return [x, y, 0, 1];
    }
    if (s === 1) {
      // wandering, until an emotional moment pulls it into orbit
      const j = p.i % EMO.length;
      const capT = 0.8 + p.d * 7;
      const [ex, ey] = G.emo[j];
      if (since > capT && p.i % 4 !== 3) {
        const ang = p.a * 6.28 + t * (0.8 + p.b * 0.6);
        const rr = G.er * (1.15 + p.c * 0.5);
        return [ex + Math.cos(ang) * rr, ey + Math.sin(ang) * rr * 0.8, 1, 1];
      }
      const x = lerp(20, w - 20, (p.a + noise2(p.i, t * 0.12) * 0.35 + 1) % 1);
      const y = lerp(top + 10, bot - 10, (p.b + noise2(t * 0.12, p.i) * 0.35 + 1) % 1);
      return [x, y, 0, 1];
    }
    if (s === 2) {
      const j = p.i % ISLANDS.length;
      const [ix, iy] = G.isl[j];
      const ang = p.a * 6.28 + t * 0.25 * (p.b > 0.5 ? 1 : -1);
      const rr = G.ir * 0.62 * Math.sqrt(p.c);
      return [ix + Math.cos(ang) * rr * 1.25, iy + Math.sin(ang) * rr * 0.8, 1, 1];
    }
    if (s === 3) {
      const u = (p.a + t * 0.09) % 1;
      const [x, y] = flowXY(u);
      const spread = (1 - u * 0.7) * (G.bot - G.top) * 0.08;
      return [x, y + (p.c - 0.5) * spread, u > stationU[3] ? 1 : 0, u > 0.97 ? 0 : 1];
    }
    // s === 5: around the cycle
    const ang = p.a * 6.28 + t * 0.35;
    const rr = G.cyc * (0.96 + (p.c - 0.5) * 0.12);
    return [G.cx + Math.cos(ang) * rr, G.cycY + Math.sin(ang) * rr * 0.82, 1, 1];
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

  // a five-point pencil star as segments
  function starSegs(segs, x, y, r, rot) {
    for (let k = 0; k < 5; k++) {
      const a1 = rot + (k * 4 * Math.PI) / 5 - Math.PI / 2;
      const a2 = rot + ((k + 1) * 4 * Math.PI) / 5 - Math.PI / 2;
      segs.push(x + Math.cos(a1) * r, y + Math.sin(a1) * r, x + Math.cos(a2) * r, y + Math.sin(a2) * r);
    }
  }

  const textW = (str, size, kind = 'hand') => {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size);
    const v = g.measureText(str).width;
    g.restore();
    return v;
  };

  // a highlighter-filled pie wedge
  function wedge(cx, cy, r, a0, a1, alpha) {
    const g = env.g;
    g.save();
    g.globalAlpha *= alpha;
    g.fillStyle = env.acc;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, a0, a1);
    g.closePath();
    g.fill();
    g.restore();
  }

  // a wobbly island outline
  function island(cx, cy, r, seed) {
    const pts = [];
    for (let q = 0; q <= 26; q++) {
      const ang = (q / 26) * Math.PI * 2;
      const rr = r * (0.88 + 0.22 * noise2(Math.cos(ang) * 1.1 + seed, Math.sin(ang) * 1.1));
      pts.push([cx + Math.cos(ang) * rr * 1.3, cy + Math.sin(ang) * rr * 0.82]);
    }
    return pts;
  }

  // ── step 0: the attention ring ──
  function drawRing(a, since, still) {
    const { ink, ascii, c } = env;
    const { cx, R0: R, r0y: cy, narrow } = G;
    const mini = env.mini;
    const k = still ? 1 : smooth((since - 0.3) / 2.2);
    const f = lerp(1, 47 / 150, k);
    const secs = Math.round(lerp(150, 47, k));
    // the seconds that are left: a highlighter wedge
    wedge(cx, cy, R * 0.94, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, c.hlAlpha * 0.55);
    // 150 glyph ticks, one per second
    const tc = mini ? 6 : narrow ? 7 : 9;
    const n = mini ? 75 : 150;
    for (let q = 0; q < n; q++) {
      const u = q / n;
      const ang = -Math.PI / 2 + u * Math.PI * 2;
      const kept = u < f;
      ascii.glyph(kept ? '|' : '·', cx + Math.cos(ang) * (R + tc * 1.3), cy + Math.sin(ang) * (R + tc * 1.3), tc, c.ink, (kept ? 0.85 : 0.35) * a);
    }
    // the full 150 s: a faint dashed ring (no overshoot)
    {
      const g = env.g;
      g.save();
      g.setLineDash([3, 6]);
      g.strokeStyle = c.pencil;
      g.globalAlpha *= 0.4 * a;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    const arc = [];
    const N = Math.max(8, Math.round(64 * f));
    for (let q = 0; q <= N; q++) {
      const ang = -Math.PI / 2 + (q / N) * f * Math.PI * 2;
      arc.push([cx + Math.cos(ang) * R, cy + Math.sin(ang) * R]);
    }
    ink.path(arc, { seed: 3, w: 2.2, alpha: 0.95 * a });
    const ea = -Math.PI / 2 + f * Math.PI * 2;
    ink.line(cx, cy, cx + Math.cos(ea) * R * 0.94, cy + Math.sin(ea) * R * 0.94, { seed: 4, w: 1.2, alpha: 0.8 * a });
    ink.line(cx, cy, cx, cy - R * 0.94, { seed: 5, w: 1, alpha: 0.5 * a, passes: 1 });
    // the number
    const ns = mini ? 30 : clamp(R * 0.42, 30, 84);
    ink.text(String(secs), cx, cy + ns * 0.34, { font: 'mono', size: ns, weight: 500, align: 'center', alpha: a });
    ink.text('秒', cx + textW(String(secs), ns, 'mono') / 2 + 6, cy + ns * 0.34, { size: mini ? 13 : Math.round(ns * 0.36), alpha: a });
    if (mini) return;
    ink.text('單一螢幕平均停留', cx, cy + ns * 0.34 + 28, { size: narrow ? 13 : 15, align: 'center', color: c.ink2, alpha: a });
    if (narrow) ink.text('2004 年約 150 秒', cx, G.bot, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // what was lost since 2004
    if (!narrow) {
      const la = -Math.PI / 2 + lerp(1, f, 0.5) * Math.PI * 2 + Math.PI * 0.18;
      const lx = cx + Math.cos(la) * (R + tc * 4);
      const ly = cy + Math.sin(la) * (R + tc * 4);
      const al = Math.cos(la) < 0 ? 'right' : 'left';
      // keep both notes inside the pane (about 15 px per character)
      const x1 = al === 'right' ? Math.max(lx, 8 + 9 * 15) : Math.min(lx, env.w - 8 - 9 * 15);
      ink.text('2004 年：約 150 秒', x1, ly, { size: 15, align: al, color: c.ink2, alpha: a });
      ink.text('現在：約 47 秒', Math.min(cx + R + tc * 3, env.w - 8 - 8 * 15), cy - R * 0.72, { size: 15, alpha: a * k });
    }
  }

  // ── step 1: emotional moments ──
  function drawEmo(a) {
    const { ink, c } = env;
    const { narrow } = G;
    G.emo.forEach(([x, y], i) => {
      ink.blob(x, y, G.er * 0.82, { seed: 100 + i, alpha: c.hlAlpha * 0.8 * a });
      ink.circle(x, y, G.er * 0.84, { seed: 104 + i, w: 1.3, alpha: 0.9 * a });
      if (narrow) ink.text(EMO[i], x, y + G.er + 12, { size: 13, align: 'center', alpha: a });
      else ink.text(EMO[i], x, y + 5, { size: clamp(G.er * 0.3, 13, 16), align: 'center', alpha: a });
    });
    if (!narrow) ink.text('消費不只是購買，更是情緒管理、自我認同與生活態度', G.cx, G.bot, { size: 14, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 2: six islands ──
  function drawIslands(a) {
    const { ink, c } = env;
    const { narrow } = G;
    G.isl.forEach(([x, y], i) => {
      ink.path(island(x, y, G.ir, i * 3.1), { seed: 200 + i, w: 1.2, alpha: 0.85 * a });
      const ty = y + G.ir * 0.82 + (narrow ? 16 : 22);
      ink.text(ISLANDS[i], x, ty, { size: narrow ? 13 : 17, align: 'center', alpha: a });
      if (ISLAND_NOTE[i] && !narrow) ink.text(ISLAND_NOTE[i], x, ty + 20, { size: 13, align: 'center', color: c.ink2, alpha: a });
    });
    if (!narrow) ink.text('Share of Voice → Share of Culture', G.cx, G.top + 6, { font: 'latin', size: 15, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 3: from traffic to action ──
  function drawFlow(a) {
    const { ink, c } = env;
    const { w, top, bot, narrow } = G;
    const pts = [];
    for (let q = 0; q <= 40; q++) pts.push(flowXY(q / 40));
    env.g.setLineDash([2, 6]);
    ink.path(pts, { seed: 300, w: 1, alpha: 0.35 * a, passes: 1 });
    env.g.setLineDash([]);
    STATIONS.forEach((name, i) => {
      const [x, y] = flowXY(stationU[i]);
      ink.circle(x, y, 7, { seed: 310 + i, w: 1.3, alpha: a });
      const up = i % 2 === 0;
      const sz = narrow ? 12 : 15;
      ink.text(name, x, y + (up ? -(bot - top) * 0.09 - 6 : (bot - top) * 0.09 + 18), { font: /[A-Za-z]/.test(name) ? 'latin' : 'hand', size: sz, align: 'center', alpha: a });
    });
    // the heap of actions
    const hx = Math.min(w * 0.92, w - 46);
    const hy = flowXY(1)[1] + 26;
    const n = Math.min(64, heap);
    const segs = [];
    // a pile: the bottom row is widest
    let q = 0;
    for (let row = 0; row < 10 && q < n; row++) {
      const wide = 10 - row;
      for (let col = 0; col < wide && q < n; col++, q++) {
        const x = hx + (col - (wide - 1) / 2) * 6.5;
        const y = hy - row * 6;
        segs.push(x - 2.2, y, x + 2.2, y, x, y - 2.2, x, y + 2.2);
      }
    }
    if (n) strokes(segs, { seed: 320, alpha: 0.85 * a, w: 1.2, j: 0.4 });
    ink.line(hx - 34, hy + 5, hx + 34, hy + 5, { seed: 321, w: 1.1, alpha: 0.8 * a });
    ink.text('Attention', w * 0.06, flowXY(0)[1] - 26, { font: 'latin', size: narrow ? 13 : 16, alpha: a });
    ink.marker(hx - 38, hy + 12, 76, 26, { seed: 322, alpha: c.hlAlpha * a });
    ink.text('Action', hx, hy + 31, { font: 'latin', size: narrow ? 13 : 16, weight: 500, align: 'center', alpha: a });
    ink.text('《The Inspector Global》', narrow ? 16 : w * 0.06, top + 6, { size: narrow ? 14 : 17, alpha: a });
    if (!narrow) ink.text('電通娛樂 × 韓國 The SMC Group', w * 0.06, top + 28, { size: 13, color: c.ink2, alpha: a });
  }

  // ── step 4: the memorable moment ──
  function drawMoment(a, still) {
    const { ink, c } = env;
    const { w, narrow, mx, my, mr } = G;
    ink.blob(mx, my, mr * 0.95, { seed: 400, alpha: c.hlAlpha * a });
    ink.circle(mx, my, mr, { seed: 401, w: 1.5, alpha: a });
    const lines = ['值得被記住', '的時刻'];
    if (narrow) ink.text('值得被記住的時刻', mx, my + mr + 18, { size: 13, align: 'center', alpha: a });
    else lines.forEach((l, i) => ink.text(l, mx, my - 4 + i * 20, { size: 16, align: 'center', alpha: a }));
    ink.text('Memory', mx, G.sky[0] - 4, { font: 'latin', size: narrow ? 13 : 16, weight: 500, align: 'center', alpha: a });
    if (!narrow) {
      ink.text('曝光', w - 20, G.bot - 26, { size: 15, align: 'right', color: c.ink2, alpha: a });
      ink.text('品牌可以購買曝光，卻無法購買記憶', G.cx, G.bot, { size: 15, align: 'center', color: c.ink2, alpha: a });
    }
  }

  // ── step 5: the cycle ──
  function drawCycle(a, t) {
    const { ink, c } = env;
    const { cx, cycY: cy, cyc: R, narrow } = G;
    ink.text(ART.framework.name, cx, G.top + 6, { font: 'latin', size: narrow ? 15 : 19, weight: 500, align: 'center', alpha: a });
    ink.blob(cx, cy, R * 0.26, { seed: 500, alpha: c.hlAlpha * a });
    ink.circle(cx, cy, R * 0.27, { seed: 501, w: 1.6, alpha: a });
    ink.text('IP', cx, cy + 9, { font: 'latin', size: narrow ? 20 : 28, weight: 700, align: 'center', alpha: a });
    // arrows around the ring
    const angs = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (let i = 0; i < 4; i++) {
      const a0 = angs[i] + 0.3;
      const a1 = angs[i] + Math.PI / 2 - 0.3;
      const pts = [];
      for (let q = 0; q <= 10; q++) {
        const ang = lerp(a0, a1, q / 10);
        pts.push([cx + Math.cos(ang) * R, cy + Math.sin(ang) * R * 0.82]);
      }
      ink.path(pts, { seed: 510 + i, w: 1.2, alpha: 0.8 * a });
      const [ex, ey] = pts[10];
      const [px, py] = pts[9];
      const d = Math.atan2(ey - py, ex - px);
      ink.line(ex, ey, ex - Math.cos(d - 0.45) * 8, ey - Math.sin(d - 0.45) * 8, { seed: 520 + i, w: 1.2, alpha: 0.8 * a });
      ink.line(ex, ey, ex - Math.cos(d + 0.45) * 8, ey - Math.sin(d + 0.45) * 8, { seed: 524 + i, w: 1.2, alpha: 0.8 * a });
    }
    CYCLE.forEach(([name, sub], i) => {
      const ang = angs[i];
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R * 0.82;
      ink.circle(x, y, 6, { seed: 530 + i, w: 1.3, alpha: a });
      ink.dot(x, y, 2.5, { seed: 534 + i, alpha: a });
      const side = Math.cos(ang);
      const lx = x + side * 16;
      const ly = y + (Math.abs(side) < 0.5 ? (Math.sin(ang) < 0 ? (narrow ? -14 : -36) : 30) : 6);
      const al = side > 0.5 ? 'left' : side < -0.5 ? 'right' : 'center';
      ink.text(name, lx, ly, { size: narrow ? 14 : 18, align: al, alpha: a });
      if (!narrow) {
        const short = sub.split('——')[1] || sub;
        ink.text(short, lx, ly + 20, { size: 13, align: al, color: c.ink2, alpha: a });
      }
    });
  }

  return {
    resize: geom,
    down(x, y) {
      if (env.mini) return;
      hold = { x, y, r: 6, t0: env.t, up: -1 };
    },
    drag(x, y) {
      if (hold) {
        hold.x = x;
        hold.y = y;
      }
    },
    up() {
      if (hold) hold.up = env.t;
    },
    frame(t, dt) {
      const { ink, ascii, c, w, h } = env;
      const s = env.mini ? 0 : env.step;
      const still = dt === 0;
      const since = still ? 6 : t - env.stepAt;
      for (let i = 0; i < 6; i++) m[i] = still ? (i === s ? 1 : 0) : approach(m[i], i === s ? 1 : 0, dt, 0.25);
      if (env.step !== 4 && sceneStars.length && m[4] < 0.05) sceneStars.length = 0;

      // the reader's moment: grows while held, fades after release
      let hr = 0;
      if (hold) {
        const held = hold.up < 0 ? t - hold.t0 : hold.up - hold.t0;
        const after = hold.up < 0 ? 0 : t - hold.up;
        hold.r = clamp(20 + held * 40, 20, 70) * (1 - smooth(after / 0.8));
        hr = hold.r;
        if (hold.up >= 0 && after > 0.8) hold = null;
      }

      // backgrounds per step
      if (m[0] > 0.02) drawRing(m[0], since, still);
      if (m[1] > 0.02) drawEmo(m[1]);
      if (m[2] > 0.02) drawIslands(m[2]);
      if (m[3] > 0.02) drawFlow(m[3]);
      if (m[4] > 0.02) drawMoment(m[4], still);
      if (m[5] > 0.02) drawCycle(m[5], t);

      // step 4 stars, made by the moment (still frame: a sky that has been filling for a while)
      if (s === 4 && still && !sceneStars.length) {
        const rs = rng(44);
        for (let q = 0; q < 26; q++) sceneStars.push({ x: lerp(30, w - 30, rs()), y: lerp(G.sky[0] + 14, G.sky[1], rs()), r: 3 + rs() * 3, t: -9 });
      }

      // particles
      const cell = env.mini ? 8 : G.narrow ? 9 : 11;
      const pen = [];
      for (const p of P) {
        const [tx, ty, look, al = 1] = want(p, s, t, since);
        // glide between formations; snap on stream wrap-around
        if (first || still || Math.abs(tx - p.x) > w * 0.5) {
          p.x = tx;
          p.y = ty;
        } else {
          const hl = s === 0 || s === 4 ? 0.06 : 0.22;
          p.x = approach(p.x, tx, dt, hl);
          p.y = approach(p.y, ty, dt, hl);
        }
        // step 4: crossing the moment makes a star
        if (s === 4 && !still && p.i % 5 === 0 && p.lastX < G.mx && tx >= G.mx && sceneStars.length < 60) {
          const rs = rng(sceneStars.length + 7);
          sceneStars.push({ x: lerp(30, w - 30, rs()), y: lerp(G.sky[0] + 14, G.sky[1], rs()), r: 3 + rs() * 3, t, fx: G.mx, fy: G.my });
        }
        if (s === 3 && !still && p.lastX > tx + w * 0.3) heap++;
        p.lastX = tx;
        if (look < 0 || t < p.hidden) continue;
        // the reader's moment catches free attention
        if (hr > 0 && Math.hypot(p.x - hold.x, p.y - hold.y) < hr) {
          caught++;
          // a memory: it stays (in step 4 it rises to the sky of memories)
          const sx = s === 4 ? lerp(30, w - 30, hash(caught, 3)) : p.x;
          const sy = s === 4 ? lerp(G.sky[0] + 14, G.sky[1], hash(caught, 5)) : p.y;
          userStars.push({ fx: p.x, fy: p.y, x: sx, y: sy, r: 3 + p.c * 3, t });
          if (userStars.length > 140) userStars.shift();
          p.hidden = t + 2.5;
          continue;
        }
        const fade = m[s] < 0.5 ? 0.5 : 1;
        if (look === 1) pen.push(p.x, p.y);
        else ascii.glyph(s === 3 ? '=' : p.ch, p.x, p.y, s === 3 ? cell + 2 : cell, c.ink, (s === 3 ? 0.9 : 0.75) * al * fade);
      }
      first = false;
      if (s === 3 && still) heap = 40;
      // pencil particles: small crosses, one path
      if (pen.length) {
        const segs = [];
        for (let q = 0; q < pen.length; q += 2) segs.push(pen[q] - 1.8, pen[q + 1], pen[q] + 1.8, pen[q + 1] + 0.4);
        strokes(segs, { seed: 600, alpha: 0.85, w: 1.6, j: 0.6 });
      }

      // stars: step 4's and the reader's
      const segs = [];
      sceneStars.forEach((st) => {
        const k = still ? 1 : smooth((t - st.t) / 0.7);
        const x = st.fx != null ? lerp(st.fx, st.x, k) : st.x;
        const y = st.fy != null ? lerp(st.fy, st.y, k) : st.y;
        starSegs(segs, x, y, st.r * (0.4 + 0.6 * k), st.x);
      });
      userStars.forEach((st) => {
        const k = still ? 1 : smooth((t - st.t - 0.3) / 1.2);
        starSegs(segs, lerp(st.fx, st.x, k), lerp(st.fy, st.y, k) - Math.sin(k * Math.PI) * 30, st.r * (still ? 1 : 0.5 + 0.5 * smooth((t - st.t) / 0.4)), st.fy);
      });
      if (segs.length) strokes(segs, { seed: 610, alpha: 0.85, w: 1.1, j: 0.5 });

      // the reader's moment
      if (hold && hr > 1) {
        ink.blob(hold.x, hold.y, hr, { seed: 620, alpha: c.hlAlpha * 0.3 });
        ink.circle(hold.x, hold.y, hr, { seed: 621, w: 1.2, alpha: 0.8 });
      }
      if (caught && !env.mini) {
        const txt = `抓住 ${caught} 個注意力，變成記憶`;
        const ty = G.narrow ? G.bot : G.top + 6;
        const tw = textW(txt, 14);
        ink.marker(w - 20 - tw, ty - 15, tw + 8, 21, { seed: 630, alpha: c.hlAlpha * 0.6 });
        ink.text(txt, w - 16, ty, { size: 14, align: 'right', alpha: 0.95 });
      }
    },
  };
}
