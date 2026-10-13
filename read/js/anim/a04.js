// 04 Agents of Growth — AI agents now sit at every step of the consumer journey; brands must win
// the algorithm, the heart and the culture at once.
// step 0  the journey 觸發需求 → 品牌擁護 in pencil, a consumer walking it; quiet agents wait at every node
// step 1  the agents step in: the consumer is carried from agent to agent (零點擊); 89% of CMOs
// step 2  被 AI 讀懂: one brand's information is clean glyph rows and gets recommended; the other is noise and goes missing
// step 3  信任與品味: three brands on the same AI base; only pencil layers (洞察、文化、美感、信任) set one apart
// step 4  兩大解方: Creative E2E — 12 services break out of their silos into one chain; AI-Powered IMC — a learning loop
// step 5  增長三角: 贏得演算法 / 贏得人心 / 贏得文化, draggable corners, Human + AI in the middle
// Drag: the consumer along the journey (steps 0–1), the triangle's corners (step 5).
import { hash, smooth, lerp, approach, clamp, easeInOut } from '../engine/noise.js';

export const hint = '拖曳旅程上的人、三角的角';

const TAU = Math.PI * 2;
const GOLD = Math.PI * (3 - Math.sqrt(5));
const STAGES = ['觸發需求', '啟發探索', '比較評估', '轉換購買', '品牌擁護'];
const SHORT = ['觸發', '探索', '評估', '轉換', '擁護'];
// the 12 services of 電通創意事業群, by the side of the triangle they serve
const SERVICES = [
  ['AI Content Production / TAG', 0], ['Data & Martech', 0], ['Media', 0], ['Social Commerce', 0],
  ['Strategy & Consult', 1], ['Brand & Creative', 1], ['Experience Design / Dentsu Lab', 1], ['BX', 1],
  ['PR Influence', 2], ['Event', 2], ['Entertainment & Sports', 2], ['IP Design Lab', 2],
];
const AXES = [['贏得演算法', 'Anticipate the Algorithm'], ['贏得人心', 'Invest in Intimacy'], ['贏得文化', 'The Culture Advantage']];
const IMC = ['行為預測', '內容生成', '媒體配置', '動態創意優化', '轉換追蹤'];
const LAYERS = ['洞察', '文化', '美感', '信任'];
const INFO = ['產品資訊', '內容結構', '數據訊號', '品牌價值'];
const CAPTION = [
  'AI 代理，正在改寫消費旅程',
  '品牌面對的不只是人，也是替人做判斷的 AI 代理',
  '被 AI 清楚讀取、正確理解、有效推薦，才不會缺席',
  '技術不再是壁壘；拉開差距的，是對人的洞察與信任',
  '從單點執行，走向系統轉型',
  '未來的競爭不是 Human vs AI，而是 Human + AI',
];

export default function make(env) {
  const { g, ink, ascii } = env;
  let G = {};
  const mix = { s0: 1, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  let cs = 0.12; // where the consumer is on the journey (0..1)
  let held = -9; // time the consumer was last dragged
  let grab = -1; // which triangle corner is held
  const tri = [[0.5, 0.2], [0.18, 0.8], [0.82, 0.8]]; // corners, as fractions of the content box
  let hoverChip = -1;
  let cursor = '';
  const chipPos = SERVICES.map(() => [0, 0]);

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
  function patch(x, y, w, h, k) {
    g.save();
    g.globalAlpha *= 0.94 * k;
    g.fillStyle = env.c.sheet;
    g.fillRect(x, y, w, h);
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
    G.amp = G.H * (mini ? 0.16 : 0.13);
    G.jy = G.top + G.H * (mini ? 0.52 : 0.5);
  }
  geom();

  // ── the journey ──
  const pathAt = (s) => [G.left + G.W * (0.05 + 0.9 * s), G.jy + Math.sin(s * TAU * 0.95 + 0.5) * G.amp];
  const nodeS = (i) => 0.04 + i * 0.23;
  const nodeAt = (i) => pathAt(nodeS(i));
  // each node's agent sits on the side away from its label
  const up = (i) => i % 2 === 0;
  const agentAt = (i) => {
    const [x, y] = nodeAt(i);
    return [x, y + (up(i) ? 1 : -1) * G.H * (env.mini ? 0.2 : 0.2)];
  };
  // the agents' line: the zero-click route
  function agentRoute(s) {
    const n = STAGES.length;
    const f = clamp((s - nodeS(0)) / (nodeS(n - 1) - nodeS(0))) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const m = easeInOut(f - i);
    const a = agentAt(i);
    const b = agentAt(i + 1);
    return [lerp(a[0], b[0], m), lerp(a[1], b[1], m)];
  }
  const consumerAt = (s, k1) => {
    const p = pathAt(s);
    if (k1 < 0.01) return p;
    const q = agentRoute(s);
    return [lerp(p[0], q[0], k1), lerp(p[1], q[1], k1)];
  };

  function agent(x, y, r, k, t, n = 26) {
    const cell = Math.max(6, Math.min(9, r * 0.5));
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt((i + 0.5) / n);
      const a = i * GOLD + t * 0.4;
      ascii.glyph(0.95 - rr * 0.5, x + Math.cos(a) * rr * r, y + Math.sin(a) * rr * r, cell, env.c.ink, 0.9 * k);
    }
  }
  function pencilDisc(x, y, r, k, n = 26) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt((i + 0.5) / n) * r * 0.85;
      const a = i * GOLD;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      list.push(px - 1.6, py + 1.1, px + 1.6, py - 1.1);
    }
    marks(list, 0.85 * k, 1.1);
    ink.circle(x, y, r, { seed: 7, w: 1.4, alpha: 0.95 * k });
  }

  function sceneJourney(t, k0, k1) {
    const k = Math.max(k0, k1);
    const mini = env.mini;
    // the pencil path
    const pts = [];
    for (let i = 0; i <= 64; i++) pts.push(pathAt(i / 64));
    ink.path(pts, { seed: 11, w: 1.4, alpha: k * lerp(0.9, 0.3, k1) });
    ink.arrow(pts[62][0], pts[62][1], pts[64][0] + 6, pts[64][1], { seed: 12, w: 1.3, alpha: k * lerp(0.9, 0.3, k1), head: 8 });
    const ls = mini ? 12 : G.narrow ? 13 : 16;
    STAGES.forEach((name, i) => {
      const [x, y] = nodeAt(i);
      ink.circle(x, y, mini ? 6 : 9, { seed: 13 + i, w: 1.3, alpha: 0.9 * k });
      const ly = up(i) ? y - (mini ? 12 : 20) : y + (mini ? 20 : 30);
      if (!mini || i % 2 === 0) label(G.narrow || mini ? SHORT[i] : name, x, ly, { size: ls, align: 'center', k });
      // the agent at this node
      const [ax, ay] = agentAt(i);
      const ka = k * lerp(0.35, 1, k1);
      const near = Math.abs(cs - nodeS(i)) < 0.05 ? 1 - Math.abs(cs - nodeS(i)) / 0.05 : 0;
      ascii.line(x, y + (up(i) ? 12 : -12), ax, ay + (up(i) ? -16 : 16), mini ? 7 : 9, env.c.ink, ka * 0.55, '·');
      const ar = mini ? 9 : G.narrow ? 11 : lerp(15, 21, k1);
      agent(ax, ay, ar, ka, t + i, Math.round(lerp(26, 40, k1)));
      if (i === 1 && !mini && !G.narrow && k1 > 0.01) label('AI 代理', ax + ar + 10, ay + 5, { size: 15, k: k1 });
      if (near > 0 && k1 > 0.3) ink.circle(ax, ay, 20 + near * 10, { seed: 18 + i, w: 1, alpha: near * 0.6 * k1, passes: 1, boil: false });
    });
    // the agents' own line: zero clicks
    if (k1 > 0.01) {
      for (let i = 0; i < STAGES.length - 1; i++) {
        const a = agentAt(i);
        const b = agentAt(i + 1);
        const n = 16;
        for (let j = 1; j < n; j++) {
          const m = easeInOut(j / n);
          ascii.glyph(j % 3 ? '·' : ':', lerp(a[0], b[0], m), lerp(a[1], b[1], m), G.narrow ? 9 : 11, env.c.ink, 0.95 * k1);
        }
      }
    }
    // the consumer
    const [px, py] = consumerAt(cs, k1);
    const pr = mini ? 8 : G.narrow ? 10 : 13;
    ink.blob(px, py, pr * 1.5, { seed: 19, alpha: env.c.hlAlpha * k });
    pencilDisc(px, py, pr, k);
    if (!mini && !G.narrow) label('消費者', px, py + (k1 > 0.5 ? (up(Math.round((cs - 0.04) / 0.23)) ? 1 : -1) : -1) * (pr + 12) + 5, { size: 13, align: 'center', k: k * 0.9, color: env.c.ink2 });
    if (mini || G.narrow) return;
    // step 1: what is happening, and how sure the CMOs are
    if (k1 > 0.01) {
      label('零點擊體驗', G.left, G.top + 18, { size: 20, k: k1, mark: 21 });
      label('AI 代理替人搜尋、比價、篩選、購買', G.left, G.top + 44, { size: 14, k: k1, color: env.c.ink2 });
      const sx = G.right;
      const sy = G.bot - 6;
      ink.text('89%', sx, sy - 22, { font: 'mono', size: 30, weight: 500, align: 'right', alpha: k1 });
      label('行銷長同意：代理型 AI 將重大影響業務', sx, sy, { size: 13, align: 'right', k: k1, color: env.c.ink2 });
    }
  }

  // ── step 2: readable or missing ──
  function sceneRead(t, k) {
    const nar = G.narrow;
    const cw = G.W * (nar ? 0.42 : 0.33);
    const ch = G.H * 0.34;
    const cx0 = G.left + (nar ? 0 : G.W * 0.02);
    const ya = G.top + G.H * 0.08;
    const yb = G.top + G.H * 0.56;
    const ax = G.left + G.W * (nar ? 0.56 : 0.53);
    const ay = G.top + G.H * 0.47;
    const bx = G.left + G.W * (nar ? 0.68 : 0.7);
    const bw = G.right - bx;
    const by = G.top + G.H * 0.24;
    const bh = G.H * 0.46;
    const cell = nar ? 7 : 10;
    const scan = (t * 0.6) % 1;
    // brand A: four clean rows
    ink.rect(cx0, ya, cw, ch, { seed: 31, w: 1.2, alpha: 0.85 * k, passes: 1 });
    label('品牌 A', cx0, ya - 10, { size: nar ? 14 : 16, k });
    const rh = ch / 4;
    INFO.forEach((name, i) => {
      const ry = ya + rh * (i + 0.55);
      const lit = Math.floor(scan * 4) === i;
      if (!nar) label(name, cx0 + 10, ry + 5, { size: 13, k, color: env.c.ink2 });
      const gx = cx0 + (nar ? 8 : 84);
      const n = Math.floor((cx0 + cw - 10 - gx) / cell);
      const len = Math.floor(n * (0.55 + 0.4 * hash(i, 7)));
      for (let j = 0; j < len; j++) ascii.glyph(j === 0 ? '[' : j === len - 1 ? ']' : '=', gx + j * cell, ry, cell, env.c.ink, (lit ? 1 : 0.7) * k);
      if (lit) ink.marker(gx - 4, ry - cell * 0.7, len * cell + 2, cell * 1.4, { seed: 32 + i, alpha: env.c.hlAlpha * k * 0.8 });
    });
    if (!nar) label('清楚讀取 · 正確理解 · 有效推薦', cx0, ya + ch + 22, { size: 13, k, color: env.c.ink2 });
    // brand B: the same information, as noise
    ink.rect(cx0, yb, cw, ch, { seed: 33, w: 1.2, alpha: 0.6 * k, passes: 1 });
    label('品牌 B', cx0, yb - 10, { size: nar ? 14 : 16, k, color: env.c.ink2 });
    const tick = Math.floor(t * 5);
    ascii.field(cx0 + 6, yb + 6, cw - 12, ch - 12, cell, (x, y, q, r) => {
      const v = hash(q, r, tick);
      return v < 0.55 ? -1 : 0.2 + hash(r, q, tick + 1) * 0.75;
    }, env.c.ink, 0.45 * k);
    label('讀不懂，就失去能見度', cx0, yb + ch + 22, { size: 13, k, color: env.c.ink2 });
    // the agent reads both
    const ar = nar ? 14 : 22;
    ascii.line(ax - ar - 4, ay - 6, cx0 + cw + 6, ya + rh * (Math.floor(scan * 4) + 0.55), cell, env.c.ink, 0.7 * k, '·');
    ascii.line(ax - ar - 4, ay + 6, cx0 + cw + 6, yb + ch * (0.2 + 0.6 * hash(tick, 3)), cell, env.c.ink, 0.25 * k, '·');
    agent(ax, ay, ar, k, t, 40);
    label('AI 代理', ax, ay + ar + 22, { size: nar ? 13 : 15, align: 'center', k });
    // its answer
    ink.rect(bx, by, bw, bh, { seed: 34, w: 1.3, alpha: 0.9 * k, passes: 1 });
    label('AI 的推薦', bx + 8, by - 10, { size: nar ? 13 : 16, k });
    ascii.line(ax + ar + 4, ay, bx - 6, by + bh * 0.32, cell, env.c.ink, 0.7 * k, '·');
    const sx = bx + 10;
    const sy = by + bh * 0.22;
    const sw = bw - 20;
    ink.blob(sx + sw / 2, sy + bh * 0.1, Math.min(sw, bh * 0.36) * 0.45, { seed: 35, alpha: env.c.hlAlpha * k });
    label('品牌 A', sx + sw / 2, sy + bh * 0.1 + 6, { size: nar ? 14 : 18, align: 'center', k });
    g.setLineDash([4, 5]);
    ink.rect(sx, by + bh * 0.58, sw, bh * 0.3, { seed: 36, w: 1, alpha: 0.5 * k, passes: 1, boil: false });
    g.setLineDash([]);
    label('品牌 B 缺席', sx + sw / 2, by + bh * 0.58 + bh * 0.15 + 5, { size: nar ? 12 : 14, align: 'center', k, color: env.c.ink2 });
    label('示意', G.right, G.top + 4, { size: 13, align: 'right', k, color: env.c.ink2 });
  }

  // ── step 3: same AI, different pencil ──
  function layerTex(i, x, y, w, h, k, seed) {
    if (i === 0) {
      // insight: lenses
      for (let j = 0; j < 3; j++) ink.circle(x + w * (0.25 + j * 0.25), y + h / 2, Math.min(h * 0.3, w * 0.09), { seed: seed + j, w: 1.1, alpha: 0.85 * k, passes: 1 });
    } else if (i === 1) {
      // culture: waves
      for (let j = 0; j < 2; j++) {
        const pts = [];
        for (let q = 0; q <= 16; q++) pts.push([x + w * 0.08 + (w * 0.84 * q) / 16, y + h * (0.36 + j * 0.3) + Math.sin(q * 0.9 + j) * h * 0.12]);
        ink.path(pts, { seed: seed + j, w: 1.1, alpha: 0.85 * k, passes: 1 });
      }
    } else if (i === 2) {
      // aesthetics: one confident curve
      const pts = [];
      for (let q = 0; q <= 16; q++) {
        const f = q / 16;
        pts.push([x + w * (0.1 + 0.8 * f), y + h * (0.75 - 0.5 * Math.sin(f * Math.PI) + 0.12 * Math.sin(f * TAU))]);
      }
      ink.path(pts, { seed, w: 1.5, alpha: 0.9 * k });
    } else {
      // trust: two linked rings
      const r = Math.min(h * 0.32, w * 0.12);
      ink.circle(x + w / 2 - r * 0.6, y + h / 2, r, { seed, w: 1.2, alpha: 0.9 * k, passes: 1 });
      ink.circle(x + w / 2 + r * 0.6, y + h / 2, r, { seed: seed + 1, w: 1.2, alpha: 0.9 * k, passes: 1 });
    }
  }
  function sceneTaste(t, k, since) {
    const nar = G.narrow;
    const bw = G.W * (nar ? 0.2 : 0.19);
    const bh = G.H * 0.17;
    const base = G.bot - (nar ? 28 : 40);
    const xs = (nar ? [0.13, 0.5, 0.87] : [0.2, 0.5, 0.8]).map((f) => G.left + G.W * f);
    const cell = nar ? 7 : 9;
    xs.forEach((x, c) => {
      // identical AI base
      ascii.field(x - bw / 2, base - bh, bw, bh, cell, (px, py, q, r) => ((q + r) % 3 === 0 ? 0.62 : (q * 7 + r * 3) % 5 === 0 ? 0.4 : 0.22), env.c.ink, 0.75 * k);
      ink.rect(x - bw / 2, base - bh, bw, bh, { seed: 41 + c, w: 1, alpha: 0.6 * k, passes: 1 });
      if (c !== 1) {
        // the others: one thin, generic layer
        ink.hatch({ x: x - bw / 2, y: base - bh - bh * 0.32, w: bw, h: bh * 0.32 }, { seed: 44 + c, gap: 8, alpha: 0.3 * k });
        label('同質化', x, base - bh - bh * 0.32 - 12, { size: nar ? 12 : 14, align: 'center', k, color: env.c.ink2 });
      }
    });
    // the one with something only people can add
    const x = xs[1];
    const lh = Math.min(G.H * 0.13, (base - bh - G.top - (nar ? 44 : 70)) / 4);
    let y = base - bh;
    LAYERS.forEach((name, i) => {
      const p = env.reduced || since > 99 ? 1 : smooth(clamp((since - 0.3 - i * 0.35) / 0.5));
      if (p < 0.01) return;
      const yy = y - lh * p;
      ink.rect(x - bw / 2, yy, bw, lh, { seed: 51 + i, w: 1.2, alpha: 0.9 * k * p, passes: 1 });
      layerTex(i, x - bw / 2, yy, bw, lh, k * p, 60 + i * 5);
      // labels follow their layer; when layers are thin, they spread out into a list
      const fs = clamp(lh * 0.72, 13, 18);
      const step = Math.max(lh, 16);
      const ly = lh >= 16 ? yy + lh / 2 + fs * 0.35 : base - bh - (2 * lh) + (1.5 - i) * step + fs * 0.35;
      label(name, x + bw / 2 + (nar ? 6 : 12), ly, { size: fs, k: k * p, mark: i === 3 ? 56 : 0 });
      y -= lh * p;
    });
    ink.blob(x, y - 18, 10, { seed: 57, alpha: env.c.hlAlpha * k });
    label('品牌偏好', x, y - 34, { size: nar ? 14 : 17, align: 'center', k });
    // the shared base
    ink.line(xs[0] - bw / 2, base + 10, xs[2] + bw / 2, base + 10, { seed: 58, w: 1, alpha: 0.6 * k, passes: 1 });
    label('相似的 AI 工具', G.cx, base + (nar ? 26 : 30), { size: nar ? 13 : 15, align: 'center', k, color: env.c.ink2 });
    if (!nar) {
      ink.text('90%', G.left, G.top + 26, { font: 'mono', size: 28, weight: 500, alpha: k });
      label('CMO 相信：強大的品牌偏好是未來致勝關鍵', G.left, G.top + 50, { size: 13, k, color: env.c.ink2 });
    }
  }

  // ── step 4: Creative E2E and AI-Powered IMC ──
  function chip(i, x, y, k, hot) {
    const grp = SERVICES[i][1];
    const w = G.chipW;
    const h = G.chipW * 0.66;
    if (grp === 0) {
      for (let q = 0; q < 3; q++) ascii.glyph(q === 1 ? '+' : ':', x - w * 0.28 + q * w * 0.28, y, G.narrow ? 7 : 11, env.c.ink, 0.9 * k);
    } else if (grp === 1) {
      ink.hatch({ x: x - w / 2, y: y - h / 2, w, h }, { seed: 70 + i, gap: 4, alpha: 0.5 * k });
    } else ink.marker(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2, { seed: 70 + i, alpha: env.c.hlAlpha * k });
    ink.rect(x - w / 2, y - h / 2, w, h, { seed: 80 + i, w: hot ? 1.8 : 1.1, alpha: 0.9 * k, passes: 1 });
  }
  function sceneSolve(t, k, since) {
    const nar = G.narrow;
    // Creative E2E: silos → one chain
    const ex0 = G.left;
    const ex1 = G.left + G.W * (nar ? 0.5 : 0.52);
    const ey = G.top + G.H * 0.5;
    const go = env.reduced || since > 99 ? 1 : smooth(clamp((since - 1) / 1.6));
    const cols = 4;
    const gw = (ex1 - ex0) / cols;
    const gh = Math.min(G.H * 0.22, gw * 0.8);
    const { pointer } = env;
    hoverChip = -1;
    // silo walls crumble away
    if (go < 0.99) {
      const list = [];
      for (let i = 0; i < 12; i++) {
        const q = i % cols;
        const r = Math.floor(i / cols);
        const x = ex0 + gw * q + 4;
        const y = ey - gh * 1.5 + gh * r + 4;
        const drop = go * 30 * hash(i, 1);
        list.push(x, y + drop, x, y + gh - 8 + drop, x + gw - 8, y + drop, x + gw - 8, y + gh - 8 + drop);
      }
      marks(list, 0.7 * k * (1 - go), 1.2);
    }
    const chain = [];
    const rx = (ex1 - ex0) / 2 - 20;
    const ry = Math.min(rx * 0.8, G.H * 0.26);
    const ox = (ex0 + ex1) / 2;
    const oy = ey + ry * 0.55;
    G.chipW = Math.min(36, ((Math.PI * (rx + ry)) / 2 / 12) * 0.78);
    for (let i = 0; i < 12; i++) {
      const q = i % cols;
      const r = Math.floor(i / cols);
      const sx = ex0 + gw * (q + 0.5);
      const sy = ey - gh + gh * r;
      const f = i / 11;
      const cxp = ox - Math.cos(f * Math.PI) * rx;
      const cyp = oy - Math.sin(f * Math.PI) * ry;
      const m = smooth(clamp(go * 1.4 - hash(i, 2) * 0.4));
      const x = lerp(sx, cxp, m);
      const y = lerp(sy, cyp, m);
      chipPos[i] = [x, y];
      chain.push([x, y]);
    }
    if (go > 0.6) ink.path(chain, { seed: 90, w: 1.2, alpha: k * (go - 0.6) * 2.5 * 0.8 });
    for (let i = 0; i < 12; i++) {
      const [x, y] = chipPos[i];
      const hot = pointer.in && Math.abs(pointer.x - x) < G.chipW * 0.6 && Math.abs(pointer.y - y) < G.chipW * 0.45;
      if (hot) hoverChip = i;
      chip(i, x, y, k, hot);
    }
    const ts = nar ? 14 : 18;
    label('Creative E2E', ex0, G.top + 14, { size: ts, font: 'latin', weight: 600, k });
    label('12 項專業 · 打破服務孤島', ex0, G.top + 14 + (nar ? 19 : 24), { size: nar ? 12 : 14, k, color: env.c.ink2 });
    if (go > 0.9 && !nar) {
      label('需求創造', ox - rx, oy + 34, { size: 14, k, color: env.c.ink2, align: 'center' });
      label('忠誠留存', ox + rx, oy + 34, { size: 14, k, color: env.c.ink2, align: 'center' });
    }
    // AI-Powered IMC: a loop that keeps learning
    const ix = G.left + G.W * (nar ? 0.77 : 0.79);
    const iy = ey + (nar ? 8 : 4);
    const Ri = Math.min(G.W * (nar ? 0.15 : 0.13), G.H * 0.26, 120);
    for (let j = 1; j <= 3; j++) ink.circle(ix, iy, Ri * (1 - j * 0.1), { seed: 100 + j, w: 0.8, alpha: 0.18 * k, passes: 1 });
    ink.circle(ix, iy, Ri, { seed: 104, w: 1.4, alpha: 0.9 * k });
    const lap = t * 0.7;
    const ha = -Math.PI / 2 + lap * 0.9;
    for (let j = 7; j >= 0; j--) {
      const a = ha - j * 0.09;
      ascii.glyph(j ? '·' : '@', ix + Math.cos(a) * Ri, iy + Math.sin(a) * Ri, j ? 9 : 14, env.c.ink, (j ? 0.8 - j * 0.08 : 1) * k);
    }
    IMC.forEach((name, i) => {
      const a = -Math.PI / 2 + (i / IMC.length) * TAU;
      const x = ix + Math.cos(a) * Ri;
      const y = iy + Math.sin(a) * Ri;
      const lit = ((ha - a) % TAU + TAU) % TAU < 0.5;
      ink.dot(x, y, lit ? 5 : 3.5, { seed: 105 + i, alpha: k, color: env.c.ink });
      if (lit) ink.blob(x, y, 11, { seed: 110 + i, alpha: env.c.hlAlpha * k });
      if (nar) return;
      const c = Math.cos(a);
      const lx = x + c * 14;
      const ly = y + Math.sin(a) * 16 + 5;
      label(name, lx, ly, { size: 14, k, align: Math.abs(c) < 0.3 ? 'center' : c > 0 ? 'left' : 'right' });
    });
    label('AI-Powered', ix, iy - 4, { size: nar ? 12 : 14, font: 'latin', weight: 600, align: 'center', k });
    label('IMC', ix, iy + (nar ? 12 : 16), { size: nar ? 12 : 14, font: 'latin', weight: 600, align: 'center', k });
    if (!nar) label('持續學習的動態顧客旅程', ix, iy + Ri + 40, { size: 13, align: 'center', k, color: env.c.ink2 });
    // name of the service under the pointer
    if (hoverChip >= 0) {
      const [x, y] = chipPos[hoverChip];
      const s = SERVICES[hoverChip][0];
      const wd = tw(s, 13, 'mono', 500) + 16;
      const bx = clamp(x - wd / 2, 4, G.w - wd - 4);
      patch(bx, y - 44, wd, 24, k);
      ink.rect(bx, y - 44, wd, 24, { seed: 120, w: 1, alpha: 0.8 * k, passes: 1 });
      ink.text(s, bx + 8, y - 27, { font: 'mono', size: 13, weight: 500, alpha: k });
    }
  }

  // ── step 5: the growth triangle ──
  const corner = (i) => [G.left + G.W * tri[i][0], G.top + G.H * tri[i][1]];
  function sceneTriangle(t, k) {
    const nar = G.narrow;
    const C = [corner(0), corner(1), corner(2)];
    const { pointer } = env;
    // a faint highlighter fill
    g.save();
    g.globalAlpha *= env.c.hlAlpha * 0.35 * k;
    g.fillStyle = env.acc;
    g.beginPath();
    C.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.restore();
    for (let i = 0; i < 3; i++) {
      const a = C[i];
      const b = C[(i + 1) % 3];
      ink.line(a[0], a[1], b[0], b[1], { seed: 130 + i, w: 1.5, alpha: 0.9 * k });
    }
    // something always flowing around: the three wins feed each other
    const per = [0, 1, 2].map((i) => Math.hypot(C[(i + 1) % 3][0] - C[i][0], C[(i + 1) % 3][1] - C[i][1]));
    const tot = per[0] + per[1] + per[2];
    const flow = (d) => {
      d = ((d % tot) + tot) % tot;
      let i = 0;
      while (d > per[i] && i < 2) d -= per[i++];
      const a = C[i];
      const b = C[(i + 1) % 3];
      const f = d / per[i];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
    };
    const head = t * tot * 0.12;
    for (let j = 8; j >= 0; j--) {
      const [x, y] = flow(head - j * 9);
      if (j) ascii.glyph('·', x, y, 10, env.c.ink, (0.8 - j * 0.07) * k);
      else ink.dot(x, y, 4.5, { seed: 139, alpha: k, color: env.c.ink });
    }
    // corners and their services
    C.forEach(([x, y], i) => {
      const r = nar ? 11 : 17;
      const hot = grab === i || (pointer.in && Math.hypot(pointer.x - x, pointer.y - y) < 40);
      if (i === 0) agent(x, y, r, k, t, 30);
      else if (i === 1) pencilDisc(x, y, r, k);
      else {
        ink.blob(x, y, r * 1.2, { seed: 140, alpha: env.c.hlAlpha * k });
        ink.circle(x, y, r, { seed: 141, w: 1.4, alpha: 0.95 * k });
      }
      if (hot) {
        g.setLineDash([3, 4]);
        ink.circle(x, y, r + 12, { seed: 142, w: 1, alpha: 0.7 * k, passes: 1, boil: false });
        g.setLineDash([]);
      }
      // four services orbit each corner
      for (let j = 0; j < 4; j++) {
        const idx = i * 4 + j;
        const a = t * 0.35 + j * (TAU / 4) + i;
        const rr = r + (nar ? 14 : 22);
        const cx = x + Math.cos(a) * rr;
        const cy = y + Math.sin(a) * rr * 0.8;
        ink.dot(cx, cy, nar ? 2 : 2.6, { seed: 150 + idx, alpha: 0.8 * k });
      }
      const [zh, en] = AXES[i];
      const above = i === 0;
      const ty = above ? y - r - (nar ? 34 : 44) : y + r + (nar ? 34 : 42);
      const al = i === 0 ? 'center' : i === 1 ? (x < G.left + 80 ? 'left' : 'center') : x > G.right - 80 ? 'right' : 'center';
      const ax = al === 'left' ? Math.max(G.left, x - 30) : al === 'right' ? Math.min(G.right, x + 30) : x;
      label(zh, ax, ty, { size: nar ? 15 : 19, align: al, k, mark: 160 + i });
      label(en, ax, ty + (nar ? 17 : 22), { size: nar ? 12 : 13, font: 'latin', align: al, k, color: env.c.ink2 });
    });
    // Human + AI, in the middle
    const mx = (C[0][0] + C[1][0] + C[2][0]) / 3;
    const my = (C[0][1] + C[1][1] + C[2][1]) / 3 + 8;
    const hs = nar ? 15 : 20;
    const w1 = tw('Human', hs, 'hand');
    const w2 = tw(' + ', hs, 'hand');
    const w3 = tw('AI', hs - 2, 'mono', 500);
    const x0 = mx - (w1 + w2 + w3) / 2;
    patch(x0 - 8, my - hs - 2, w1 + w2 + w3 + 16, hs + 12, k * 0.8);
    ink.text('Human', x0, my, { size: hs, alpha: k });
    ink.text(' + ', x0 + w1, my, { size: hs, alpha: k });
    ink.text('AI', x0 + w1 + w2, my - 1, { font: 'mono', size: hs - 2, weight: 500, alpha: k });
  }

  function nearestS(x, y, k1) {
    let best = cs;
    let bd = 1e9;
    for (let i = 0; i <= 80; i++) {
      const s = i / 80;
      const [px, py] = consumerAt(s, k1);
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return { s: best, d: Math.sqrt(bd) };
  }

  return {
    resize: geom,
    warm(sec) {
      cs = (0.12 + sec * 0.07) % 1;
    },
    down(x, y) {
      const s = env.step;
      if (s === 5) {
        let best = -1;
        let bd = 46;
        for (let i = 0; i < 3; i++) {
          const [cx, cy] = corner(i);
          const d = Math.hypot(x - cx, y - cy);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        grab = best;
      } else if (s <= 1) {
        const n = nearestS(x, y, mix.s1);
        if (n.d < 60) {
          cs = n.s;
          held = env.t;
          grab = 9;
        }
      }
    },
    drag(x, y) {
      if (grab >= 0 && grab < 3 && env.step === 5) {
        tri[grab][0] = clamp((x - G.left) / G.W, 0.06, 0.94);
        tri[grab][1] = clamp((y - G.top) / G.H, 0.1, 0.9);
      } else if (grab === 9 && env.step <= 1) {
        cs = nearestS(x, y, mix.s1).s;
        held = env.t;
      }
    },
    up() {
      grab = -1;
    },
    frame(t, dt) {
      const { c } = env;
      const s = env.mini ? 0 : env.step;
      for (let i = 0; i < 6; i++) {
        const key = 's' + i;
        mix[key] = dt > 0 ? approach(mix[key], s === i ? 1 : 0, dt, 0.3) : s === i ? 1 : 0;
      }
      // the consumer walks on by itself unless someone is holding it
      if (dt > 0 && grab !== 9 && t - held > 1.5) {
        cs += dt * 0.07;
        if (cs > 1) cs -= 1;
      }
      const since = dt === 0 ? 999 : t - env.stepAt;
      const scene = (key, fn) => {
        const k = mix[key];
        if (k < 0.01) return;
        g.save();
        g.translate(0, (1 - k) * 10);
        fn(smooth(k));
        g.restore();
      };
      if (mix.s0 + mix.s1 > 0.01) sceneJourney(t, smooth(mix.s0), smooth(mix.s1));
      scene('s2', (k) => sceneRead(t, k));
      scene('s3', (k) => sceneTaste(t, k, since));
      scene('s4', (k) => sceneSolve(t, k, since));
      scene('s5', (k) => sceneTriangle(t, k));
      const cur = s === 5 && (grab >= 0 || [0, 1, 2].some((i) => env.pointer.in && Math.hypot(env.pointer.x - corner(i)[0], env.pointer.y - corner(i)[1]) < 40)) ? 'grab' : '';
      if (cur !== cursor) env.canvas.style.cursor = cursor = cur;
      if (env.mini || !G.cap) return;
      const ks = [mix.s0, mix.s1, mix.s2, mix.s3, mix.s4, mix.s5];
      ks.forEach((k, i) => label(CAPTION[i], G.cx, G.capY, { size: 15, align: 'center', k: smooth(k), color: c.ink2 }));
    },
  };
}
