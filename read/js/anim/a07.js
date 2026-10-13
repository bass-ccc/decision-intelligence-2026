// 07 AI 可以幫人買東西，但品牌要讓人想買東西 — AI computes the best deal; people walk toward what they are 偏心 to.
// step 0  options with glyph scores; AI's straight line to the best deal; the person's pencil path bends to the brand
// step 1  偏愛 vs 偏心: the options sort into a comparison table; the brand stays outside it, the path loops around it
// step 2  旅程被壓縮、隨時被截胡: 搜尋 → 比較 → 過濾 → 購買 collapses into one agent hop; discount darts cut in
// step 3  You are what you post: a long row of posts builds the right to speak; then 觸及 102%, 互動 152%
// step 4  從需求分眾到情境分眾: people leave demographic boxes for moments of the day; Zespri meets them at 早餐
// step 5  情境需求地圖: a relay, 喚醒情境 → 建立嚮往 → 降低疑慮 → 累積記憶 → 承接轉換
// Drag the brand (steps 0 and 1): desire needs time to grow where it stands; just moved, the path goes to the best deal.
import { ARTICLES } from '../content.js';
import { rng, smooth, lerp, approach, clamp } from '../engine/noise.js';

export const hint = '拖動品牌';

const ART = ARTICLES.find((a) => a.no === 7);
// illustrative options (示意): position in the option field (u, v) and a value score
const OPTIONS = [
  [0.06, 0.22, 78], [0.3, 0.06, 84], [0.55, 0.2, 91], [0.86, 0.1, 95], [0.16, 0.56, 73],
  [0.46, 0.44, 88], [0.74, 0.4, 81], [0.97, 0.56, 86], [0.66, 0.8, 90], [0.94, 0.86, 76],
];
const BEST = 3;
const RELAY = ART.framework.items[2][1].split(' → '); // 喚醒情境 … 承接轉換
const MOMENTS = [['早餐', 168], ['下午需要提神', 118], ['下班需要安慰', 64], ['週末需要犒賞', 16]];
const DEMO = ['年齡', '性別', '地區', '購買紀錄'];

export default function make(env) {
  const m = [1, 0, 0, 0, 0, 0];
  let G = {};
  const brand = { u: 0.32, v: 0.8 }; // in option-field units, can be dragged anywhere
  let desire = 1; // planted (0..1)
  let dragging = false;
  let tbl = 0; // 0 = scattered options, 1 = comparison table
  const r0 = rng(7);
  const crowd = Array.from({ length: 46 }, (_, i) => ({ i, a: r0(), b: r0(), c: r0(), moment: i < 16 ? 0 : 1 + (i % 3) }));

  function geom() {
    const { w, h } = env;
    const top = env.mini ? 16 : 48;
    const bot = env.mini ? h - 14 : h - 60;
    const U = Math.min(w, h);
    const narrow = w < 560;
    G = { w, h, top, bot, U, narrow, fs: narrow ? 13 : 15 };
    G.px = w * (narrow ? 0.1 : 0.1);
    G.py = top + (bot - top) * (env.mini ? 0.55 : 0.56);
    G.fx0 = w * (narrow ? 0.38 : 0.42);
    G.fx1 = w * (narrow ? 0.9 : 0.9);
    G.fy0 = top + (env.mini ? 18 : narrow ? 22 : 40);
    G.fy1 = bot - (env.mini ? 22 : narrow ? 34 : 56);
  }

  const optXY = (u, v) => [lerp(G.fx0, G.fx1, u), lerp(G.fy0, G.fy1, v)];
  const brandXY = () => optXY(brand.u, brand.v);

  // where option i sits: scattered field, or a row of the sorted comparison table
  const order = OPTIONS.map((o, i) => i).sort((a, b) => OPTIONS[b][2] - OPTIONS[a][2]);
  function optionPos(i) {
    const [x0, y0] = optXY(OPTIONS[i][0], OPTIONS[i][1]);
    const row = order.indexOf(i);
    const rh = Math.min(30, (G.fy1 - G.fy0) / 10);
    const tx = G.w * (G.narrow ? 0.7 : 0.68);
    const ty = G.fy0 + 12 + row * rh;
    const k = smooth(tbl * 1.4 - row * 0.04);
    return [lerp(x0, tx, k), lerp(y0, ty, k)];
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

  // a small pencil person (head and shoulders)
  function person(x, y, r, a, seed) {
    const { ink } = env;
    ink.circle(x, y, r, { seed, w: 1.4, alpha: 0.95 * a });
    ink.path([[x - r * 1.9, y + r * 3], [x - r * 1.5, y + r * 1.7], [x + r * 1.5, y + r * 1.7], [x + r * 1.9, y + r * 3]], { seed: seed + 1, w: 1.4, alpha: 0.95 * a });
  }

  // a pencil heart, s = half width in px
  function heart(x, y, s, a, seed) {
    const pts = [];
    for (let q = 0; q <= 28; q++) {
      const t = (q / 28) * Math.PI * 2;
      pts.push([x + s * Math.sin(t) ** 3, y - (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 16]);
    }
    env.ink.path(pts, { seed, w: 1.3, alpha: 0.9 * a });
  }

  // a quadratic curve sampled into points
  function quad(x0, y0, cx, cy, x1, y1, n) {
    const pts = [];
    for (let q = 0; q <= n; q++) {
      const t = q / n;
      pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1]);
    }
    return pts;
  }

  // ── steps 0 and 1: options, AI's line, the person's path, the brand ──
  function drawChoice(a, t, loops) {
    const { ink, ascii, c } = env;
    const { px, py, narrow } = G;
    const mini = env.mini;
    const cell = mini ? 9 : narrow ? 10 : 12;
    // options with glyph scores
    OPTIONS.forEach(([, , score], i) => {
      const [x, y] = optionPos(i);
      const best = i === BEST;
      ascii.glyph(best ? '@' : '0', x, y, cell + 2, c.ink, (best ? 1 : 0.75) * a);
      if (tbl > 0.5 && !mini) {
        const len = Math.max(1, Math.round((score - 70) / 2.2));
        const k = smooth(tbl * 2 - 1);
        const bc = narrow ? cell * 0.45 : cell * 0.8;
        for (let q = 0; q < len; q++) ascii.glyph(best ? '#' : '=', x + 14 + q * bc, y, cell, c.ink, (best ? 0.9 : 0.55) * a * k);
        ascii.text(String(score), x + 20 + len * bc, y, cell, c.ink, a * k);
      } else if (!mini || best) ascii.text(String(score), x + 9, y - cell * 0.9, best ? cell + 2 : cell, c.ink, (best ? 1 : 0.6) * a * (1 - tbl));
    });
    // AI: a straight glyph line to the best deal
    const [bx0, by0] = optionPos(BEST);
    const pr = mini ? 7 : narrow ? 9 : 12;
    ascii.line(px + pr * 1.6, py - pr * 0.6, bx0 - 12, by0 + 4, cell, c.ink, 0.6 * a, '·');
    const [hx, hy] = brandXY();
    // the person's path: a gentle curve to the best deal, bent by desire into loops around the brand
    const pull = smooth(desire);
    const N = 150;
    const nA = 50;
    const lr = mini ? 16 : narrow ? 17 : 38;
    const sx = px + pr * 1.4;
    const sy = py + pr * 0.4;
    const A = quad(sx, sy, lerp(px, bx0, 0.55), py + (G.bot - py) * 0.35, bx0 - 10, by0 + 12, N);
    const ang0 = Math.atan2(sy - hy, sx - hx) + 0.9;
    const ent = [hx + Math.cos(ang0) * lr * 1.5, hy + Math.sin(ang0) * lr * 1.5 * 0.85];
    const B = quad(sx, sy, lerp(sx, ent[0], 0.5), Math.max(sy, ent[1]) + (G.bot - py) * 0.3, ent[0], ent[1], nA);
    for (let q = 1; q <= N - nA; q++) {
      const k = q / (N - nA);
      const ang = ang0 - k * Math.PI * 2 * loops;
      // the orbit tightens: no reason, just pulled in
      const rr = lr * lerp(1.5, 0.8, k);
      B.push([hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.85]);
    }
    const pts = A.map((p, q) => [lerp(p[0], B[q][0], pull), lerp(p[1], B[q][1], pull)]);
    ink.path(pts, { seed: 30, w: 1.5, alpha: 0.9 * a });
    // the brand: desire planted around it
    ink.blob(hx, hy, lr * (0.3 + 0.38 * desire), { seed: 41, alpha: c.hlAlpha * a });
    ink.circle(hx, hy, mini ? 5 : 9, { seed: 42, w: 1.6, alpha: a });
    ink.dot(hx, hy, mini ? 2 : 3, { seed: 44, alpha: a });
    if (desire > 0.5) heart(hx, hy - lr * 1.75 - (mini ? 8 : 14), mini ? 7 : 11, a * smooth((desire - 0.5) * 2), 43);
    // the person
    person(px, py - pr * 1.4, pr, a, 50);
    return [hx, hy, bx0, by0, lr];
  }

  // ── step 2: the journey collapses ──
  function drawStep2(a, since, t, still) {
    const { ink, ascii, c } = env;
    const { w, top, bot, narrow, fs } = G;
    const span = bot - top;
    const px = w * 0.1;
    const py = top + span * 0.46;
    const ex = w * 0.88;
    const ey = py;
    const pr = narrow ? 9 : 12;
    const k = still ? 1 : smooth((since - 0.8) / 1.2);
    // the long way: 搜尋 → 比較 → 過濾 → 購買, winding, kept as a faint ghost once compressed
    const stations = [['搜尋', 0.3, -0.27], ['比較', 0.5, 0.25], ['過濾', 0.7, -0.27]];
    const pts = [[px + pr * 1.6, py]];
    stations.forEach(([, u, dv]) => pts.push([lerp(px, ex, u), py + dv * span]));
    pts.push([ex - 10, ey]);
    const sm = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      for (let q = 0; q < 10; q++) {
        const u = q / 10;
        sm.push([lerp(x0, x1, u), lerp(y0, y1, smooth(u))]);
      }
    }
    sm.push(pts[pts.length - 1]);
    const ga = lerp(0.85, 0.22, k);
    if (k > 0.5) env.g.setLineDash([4, 6]);
    ink.path(sm, { seed: 200, w: 1.3, alpha: ga * a, passes: k > 0.5 ? 1 : 2 });
    env.g.setLineDash([]);
    stations.forEach(([name, u, dv], i) => {
      const x = lerp(px, ex, u);
      const y = py + dv * span;
      ink.circle(x, y, 5, { seed: 210 + i, w: 1.1, alpha: ga * a, passes: 1 });
      ink.text(name, x, y + (dv < 0 ? -14 : 26), { size: narrow ? 13 : 16, align: 'center', alpha: lerp(1, 0.4, k) * a });
    });
    // the agent's hop: one short glyph arc
    let divert = 0;
    let dartX = 0;
    let dartY = 0;
    let dartText = '';
    let dartHit = 0;
    let fromTop = true;
    const cell = narrow ? 10 : 12;
    if (k > 0.2) {
      const ha = smooth((k - 0.2) / 0.6);
      // darts: a discount flies in every 3 s and pulls the hop off course
      const period = 3;
      const tt = still ? 1.3 : since - 2.2;
      const midX = lerp(px, ex, 0.6);
      if (tt > 0) {
        const n = Math.floor(tt / period);
        const u = (tt % period) / period;
        fromTop = n % 2 === 0;
        dartText = n % 2 ? '更殺的特價' : '買一送一';
        const sx = w + 40;
        const sy = fromTop ? top - 10 : bot + 10;
        const fly = smooth(u / 0.3);
        dartX = lerp(sx, midX + (narrow ? 0 : 40), fly);
        dartY = lerp(sy, py + (fromTop ? -span * 0.15 : span * 0.15), fly);
        dartHit = u > 0.3 ? 1 : 0;
        divert = dartHit ? smooth((u - 0.3) / 0.15) * (1 - smooth((u - 0.85) / 0.15)) : 0;
      }
      const tx = lerp(ex - 14, dartX - 30, divert);
      const ty = lerp(ey, dartY, divert);
      const n = Math.round(((ex - px) / cell) * ha);
      const hop = quad(px + pr * 1.6, py - 4, lerp(px, tx, 0.5), py - span * 0.16, tx, ty, Math.max(2, Math.round((ex - px) / cell)));
      for (let q = 0; q <= Math.min(n, hop.length - 1); q++) ascii.glyph(q === Math.min(n, hop.length - 1) ? '>' : '=', hop[q][0], hop[q][1], cell, c.ink, 0.9 * a);
      ink.text('Agent', lerp(px, ex, 0.5), py - span * 0.08 - 30, { font: 'latin', size: narrow ? 13 : 15, weight: 500, align: 'center', alpha: a * ha });
      if (!narrow) ink.text('替他搜尋、比較、過濾', lerp(px, ex, 0.5), py - span * 0.08 + 26, { size: 13, align: 'center', color: c.ink2, alpha: a * ha });
      if (dartText) {
        const ts = narrow ? 13 : 15;
        const tw = textW(dartText, ts, 'body') + 14;
        const th = narrow ? 22 : 26;
        ink.marker(dartX - tw / 2, dartY - th / 2, tw, th, { seed: 230, alpha: c.hlAlpha * a });
        ink.rect(dartX - tw / 2, dartY - th / 2, tw, th, { seed: 231, w: 1, alpha: 0.7 * a, passes: 1 });
        ink.text(dartText, dartX, dartY + 5, { font: 'body', size: ts, weight: 500, align: 'center', alpha: a });
        if (dartHit) ink.text('截胡！', narrow ? dartX : dartX + tw / 2 + 8, narrow ? dartY - th * 0.8 : dartY + 6, { size: narrow ? 15 : 18, align: narrow ? 'center' : 'left', alpha: a * divert });
      }
    }
    // the destination
    ink.circle(ex, ey, 9, { seed: 240, w: 1.4, alpha: a * (1 - divert * 0.6) });
    ink.text('購買', ex, ey + 30, { size: narrow ? 14 : 17, align: 'center', alpha: a });
    // the person, and the one sentence they say
    person(px, py - pr * 1.4, pr, a, 260);
    const ts = narrow ? 13 : 15;
    const pw = narrow ? 112 : 170;
    const lines = ink.wrap('「幫我挑一個送 35 歲女生的生日禮物」', pw, { size: ts });
    const lh = ts * 1.45;
    const bh = lines.length * lh + 12;
    const bx = 12;
    const by = py + pr * 2.4 + 18;
    ink.rect(bx, by, pw + 16, bh, { seed: 250, w: 1.1, alpha: 0.85 * a, passes: 1 });
    ink.line(px + 2, by, px + 6, py + pr * 1.9, { seed: 251, w: 1.1, alpha: 0.85 * a });
    lines.forEach((l, i) => ink.text(l, bx + 8, by + 6 + (i + 0.8) * lh, { size: ts, alpha: a }));
    if (!narrow) ink.text('旅程被壓縮，隨時被截胡', w / 2, bot, { size: fs, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 3: You are what you post ──
  function drawStep3(a, since, still) {
    const { ink, ascii, c } = env;
    const { w, top, bot, narrow, fs } = G;
    const base = bot - (narrow ? 30 : 44);
    const x0 = w * 0.06;
    const x1 = w * (narrow ? 0.56 : 0.58);
    ink.text('You are what you post', x0, top + 8, { font: 'latin', size: narrow ? 16 : 22, weight: 500, alpha: a });
    // posts, day after day
    const ps = narrow ? 7 : 10;
    const cols = Math.floor((x1 - x0) / (ps + 4));
    const rows = 3;
    const n = cols * rows;
    const shown = still ? n : Math.min(n, Math.floor(since * n / 1.6));
    const segs = [];
    for (let q = 0; q < shown; q++) {
      const col = Math.floor(q / rows);
      const row = q % rows;
      const x = x0 + col * (ps + 4);
      const y = base - (row + 1) * (ps + 4);
      segs.push(x, y, x + ps, y, x + ps, y, x + ps, y + ps, x + ps, y + ps, x, y + ps, x, y + ps, x, y);
    }
    strokes(segs, { seed: 300, alpha: 0.7 * a, w: 0.9, j: 0.6 });
    ink.line(x0 - 6, base, x1 + 10, base, { seed: 301, w: 1.2, alpha: 0.8 * a });
    ink.text('長期耕耘車友、共鳴內容', x0, base + 22, { size: narrow ? 13 : 15, color: c.ink2, alpha: a });
    // the character those posts build: a line that rises slowly
    const rise = [];
    const k = shown / n;
    for (let q = 0; q <= 24 * k; q++) {
      const u = q / 24;
      rise.push([lerp(x0, x1, u), base - rows * (ps + 4) - 14 - Math.pow(u, 1.6) * (base - top) * 0.42]);
    }
    if (rise.length > 1) ink.path(rise, { seed: 302, w: 1.4, alpha: 0.9 * a });
    if (k > 0.98 && !narrow) ink.text('讓品牌「有資格」這樣說話', lerp(x0, x1, 0.5), base - rows * (ps + 4) - 14 - Math.pow(0.5, 1.6) * (base - top) * 0.42 - 18, { size: 15, align: 'right', alpha: a });
    // the moment: toys take over the page
    const bk = still ? 1 : smooth((since - 1.6) / 0.5);
    if (bk > 0) {
      const ex = x1;
      const ey = base - rows * (ps + 4) - 14 - (base - top) * 0.42;
      ink.blob(ex, ey, (narrow ? 14 : 20) * bk, { seed: 303, alpha: c.hlAlpha * a });
      ink.dot(ex, ey, 4, { seed: 304, alpha: a * bk });
      if (!narrow) {
        ink.text('2026.2.23', ex - 12, ey - 34, { font: 'mono', size: 12, align: 'right', color: c.ink2, alpha: a * bk });
        ink.text('玩具總動員角色「附身」小編', ex - 12, ey - 14, { size: 15, align: 'right', alpha: a * bk });
      }
    }
    // two bars past the target
    const bx0 = w * (narrow ? 0.66 : 0.7);
    const bw = narrow ? 34 : 54;
    const gap = narrow ? 22 : 40;
    const H100 = (base - top - 60) / 1.62;
    const y100 = base - H100;
    const bars = [['觸及', 102, 'FB/IG'], ['互動', 152, '']];
    g0(() => {
      env.g.setLineDash([5, 5]);
      ink.line(bx0 - 14, y100, bx0 + 2 * bw + gap + 14, y100, { seed: 310, w: 1, alpha: 0.6 * a, passes: 1 });
      env.g.setLineDash([]);
    });
    ink.text('100%', bx0 - 18, y100 + 4, { font: 'mono', size: 12, align: 'right', color: c.ink2, alpha: a });
    bars.forEach(([name, v, pre], i) => {
      const gk = still ? 1 : smooth((since - 1.9 - i * 0.3) / 0.7);
      const x = bx0 + i * (bw + gap);
      const hh = H100 * (v / 100) * gk;
      if (hh > 1) {
        ink.marker(x + 2, base - hh, bw - 4, hh, { seed: 320 + i, alpha: c.hlAlpha * a });
        ink.rect(x, base - hh, bw, hh, { seed: 322 + i, w: 1.1, alpha: 0.9 * a, passes: 1 });
      }
      if (gk > 0.9) ink.text(`${v}%`, x + bw / 2, base - hh - 10, { font: 'mono', size: narrow ? 14 : 18, weight: 500, align: 'center', alpha: a });
      ink.text(name, x + bw / 2, base + 22, { size: narrow ? 13 : 15, align: 'center', alpha: a });
      if (pre && !narrow) ink.text(pre, x + bw / 2, base + 40, { font: 'latin', size: 12, align: 'center', color: c.ink2, alpha: a });
    });
    ink.line(bx0 - 10, base, bx0 + 2 * bw + gap + 10, base, { seed: 330, w: 1.2, alpha: 0.8 * a });
    if (!narrow) ink.text('Gogoro 社群超標', bx0 + bw + gap / 2, top + 8, { size: 15, align: 'center', color: c.ink2, alpha: a });
  }

  function g0(fn) {
    env.g.save();
    fn();
    env.g.restore();
  }

  // ── step 4: from demographic boxes to moments of the day ──
  function momentXY(i) {
    const { w, bot, narrow } = G;
    const xs = narrow ? [0.2, 0.47, 0.7, 0.9] : [0.18, 0.46, 0.68, 0.88];
    return [w * xs[i], bot - (narrow ? 40 : 110)];
  }

  function kiwi(x, y, r, a) {
    const { ink, ascii, c } = env;
    ink.blob(x, y, r * 1.05, { seed: 400, alpha: c.hlAlpha * a });
    ink.circle(x, y, r, { seed: 401, w: 1.5, alpha: a });
    for (let q = 0; q < 16; q++) {
      const ang = (q / 16) * Math.PI * 2;
      ascii.glyph('·', x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55, Math.max(6, r * 0.4), c.ink, 0.9 * a);
    }
    ink.circle(x, y, r * 0.24, { seed: 402, w: 1, alpha: 0.7 * a, passes: 1 });
  }

  function drawStep4(a, since, still) {
    const { ink, ascii, c } = env;
    const { w, top, narrow, fs } = G;
    const k = still ? 1 : smooth((since - 0.8) / 1.4);
    const [, dayY] = momentXY(0);
    // the demographic boxes the crowd used to be sorted into
    const boxW = Math.min(150, (w - 40) / 4);
    const bx0 = w / 2 - boxW * 2;
    const by = top + (narrow ? 30 : 64);
    const bh = narrow ? 40 : 76;
    DEMO.forEach((d, i) => {
      const x = bx0 + i * boxW;
      ink.text(d, x + boxW / 2, by - 8, { font: 'body', size: 13, align: 'center', color: c.ink2, alpha: a });
      ascii.line(x + 6, by, x + boxW - 6, by, 8, c.ink, 0.45 * a, '-');
      ascii.line(x + 6, by + bh, x + boxW - 6, by + bh, 8, c.ink, 0.3 * a, '-');
    });
    if (!narrow && bx0 > 130) ink.text('需求分眾', bx0 - 16, by + bh / 2 + 5, { size: 14, align: 'right', color: c.ink2, alpha: a });
    // the day
    ink.arrow(w * 0.05, dayY, w * 0.97, dayY, { seed: 410, w: 1.2, alpha: 0.8 * a, head: 8 });
    // people: glyphs in boxes → pencil heads gathered at their moments
    const heads = [];
    const pr = narrow ? 2.6 : 4.2;
    const trails = [];
    crowd.forEach((p) => {
      const col = p.i % 4;
      const row = Math.floor(p.i / 4);
      const gx = bx0 + col * boxW + 16 + (row % 4) * ((boxW - 32) / 3);
      const gy = by + 14 + Math.floor(row / 4) * ((bh - 24) / 2);
      const [mx, my] = momentXY(p.moment);
      const spread = p.moment === 0 ? (narrow ? 56 : 104) : narrow ? 28 : 54;
      const tx = mx + (p.a - 0.5) * spread;
      const ty = my - 18 - p.b * (p.moment === 0 ? spread * 0.42 : spread * 0.5);
      const kk = smooth(k * 1.4 - p.c * 0.4);
      const x = lerp(gx, tx, kk);
      const y = lerp(gy, ty, kk) - Math.sin(kk * Math.PI) * 40;
      // the data rows stay behind in the boxes, faint: the same person, seen as a demographic
      ascii.glyph('0', gx, gy, narrow ? 8 : 10, c.ink, lerp(0.8, 0.3, kk) * a);
      if (kk > 0.05) heads.push(x, y);
      // a few trails: where people went
      if (p.i % 5 === 3 && kk > 0.05 && k < 0.98 && !narrow) {
        const tr = [];
        for (let q = 0; q <= 12; q++) {
          const u = (q / 12) * kk;
          tr.push([lerp(gx, tx, u), lerp(gy, ty, u) - Math.sin(u * Math.PI) * 40]);
        }
        trails.push(tr);
      }
    });
    if (trails.length) {
      env.g.setLineDash([3, 6]);
      trails.forEach((tr, q) => ink.path(tr, { seed: 415 + q, w: 0.9, alpha: 0.5 * a * (1 - k), passes: 1 }));
      env.g.setLineDash([]);
    }
    if (heads.length) {
      const g = env.g;
      g.save();
      g.strokeStyle = c.pencil;
      g.globalAlpha *= 0.85 * a;
      g.lineWidth = 1.1;
      g.beginPath();
      for (let q = 0; q < heads.length; q += 2) {
        g.moveTo(heads[q] + pr, heads[q + 1]);
        g.arc(heads[q], heads[q + 1], pr, 0, Math.PI * 2);
        g.moveTo(heads[q] - pr * 1.6, heads[q + 1] + pr * 3);
        g.quadraticCurveTo(heads[q], heads[q + 1] + pr * 0.8, heads[q] + pr * 1.6, heads[q + 1] + pr * 3);
      }
      g.stroke();
      g.restore();
    }
    // the moments on the day
    MOMENTS.forEach(([name], i) => {
      const [mx, my] = momentXY(i);
      ink.line(mx, my - 5, mx, my + 5, { seed: 430 + i, w: 1.3, alpha: a });
      const big = i === 0;
      const label = narrow && !big ? name.replace('需要', '') : name;
      ink.text(label, mx, my + 24, { size: big ? (narrow ? 15 : 19) : narrow ? 12 : 15, align: 'center', color: big ? c.ink : c.ink2, alpha: a * lerp(0.4, 1, k) });
    });
    // Zespri at breakfast: the product meets the people in the moment
    const [zx, zy] = momentXY(0);
    if (k > 0.4) {
      const kk = smooth((k - 0.4) / 0.6);
      const zr = narrow ? 11 : 17;
      kiwi(zx, zy - (narrow ? 50 : 104), (narrow ? 8 : zr) * kk, a);
      // breakfast photos pouring in, stacked like a feed
      const photos = narrow ? 0 : still ? 14 : Math.min(14, Math.max(0, Math.floor((since - 2) * 6)));
      const ps = [];
      const s = narrow ? 5 : 8;
      for (let q = 0; q < photos; q++) {
        const ang = -Math.PI / 2 + (q - 6.5) * 0.2;
        const rr = (narrow ? 26 : 40) + (q % 2) * 9;
        const x = zx + Math.cos(ang) * rr * 1.5;
        const y = zy - (narrow ? 70 : 104) + Math.sin(ang) * rr;
        ps.push(x - s, y - s * 0.8, x + s, y - s * 0.8, x + s, y - s * 0.8, x + s, y + s * 0.8, x + s, y + s * 0.8, x - s, y + s * 0.8, x - s, y + s * 0.8, x - s, y - s * 0.8);
      }
      if (ps.length) strokes(ps, { seed: 440, alpha: 0.55 * a, w: 0.9, j: 0.5 });
      if (!narrow) {
        const lx = zx + 100;
        const ly = zy - 170;
        ink.text('Zespri「早餐營養小隊員」', lx, ly, { size: 16, alpha: a * kk });
        ink.text('20 天 · 上萬則早餐照', lx, ly + 22, { size: 14, color: c.ink2, alpha: a * kk });
        const lab = 'Top of Mind +17.4%';
        ink.marker(lx - 4, ly + 34, textW(lab, 15, 'mono') + 10, 25, { seed: 445, alpha: c.hlAlpha * a * kk });
        ink.text(lab, lx + 1, ly + 52, { font: 'mono', size: 15, weight: 500, alpha: a * kk });
      }
    }
    const head = '從需求分眾到情境分眾：什麼生活場景下，會突然需要我？';
    if (!narrow) ink.text(head, w / 2, top + 6, { size: 16, align: 'center', alpha: a });
    if (narrow) ink.text('Top of Mind +17.4%', w - 12, top + 6, { font: 'mono', size: 13, align: 'right', alpha: a * k });
  }

  // ── step 5: the relay ──
  function drawStep5(a, since) {
    const { ink, c } = env;
    const { w, top, bot, narrow, U } = G;
    const ty = top + (bot - top) * 0.66;
    const n = RELAY.length;
    const xs = RELAY.map((_, i) => w * (0.11 + i * (0.78 / (n - 1))));
    ink.text(ART.framework.name, w / 2, top + 8, { size: narrow ? 16 : 20, align: 'center', alpha: a });
    ink.text('蒐集 → 分工 → 接力', w / 2, top + (narrow ? 30 : 36), { size: narrow ? 13 : 15, align: 'center', color: c.ink2, alpha: a });
    if (!narrow) ink.text('每個情境，一棒接一棒', w / 2, top + 58, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // the track
    ink.line(w * 0.03, ty, w * 0.97, ty, { seed: 500, w: 1.2, alpha: 0.8 * a });
    // the baton moves leg by leg, the labels it has passed stay highlighted
    const leg = 1.2;
    const cyc = since / leg;
    const lap = n + 1.5;
    const pos = cyc % lap;
    const cur = Math.min(n - 1, Math.floor(pos));
    const u = pos >= n - 1 ? 0 : smooth(((pos % 1) - 0.25) / 0.6);
    const fr = clamp(U * 0.03, 7, 17);
    const ls = narrow ? 12 : 16;
    xs.forEach((x, i) => {
      // a runner in mid-stride, leaning forward
      const hy = ty - fr * 6.2;
      const s = i % 2 ? 1 : -1;
      const hip = [x - fr * 0.1, ty - fr * 2.7];
      ink.circle(x + fr * 0.5, hy, fr, { seed: 510 + i, w: 1.4, alpha: 0.95 * a });
      ink.path([[x + fr * 0.35, hy + fr], hip], { seed: 520 + i, w: 1.4, alpha: 0.95 * a });
      ink.path([hip, [hip[0] + fr * (0.9 + s * 0.3), ty - fr * 1.3], [hip[0] + fr * (0.5 + s * 0.9), ty]], { seed: 530 + i, w: 1.4, alpha: 0.95 * a });
      ink.path([hip, [hip[0] - fr * (0.5 + s * 0.3), ty - fr * 1.2], [hip[0] - fr * (1.3 + s * 0.4), ty - fr * 0.2]], { seed: 540 + i, w: 1.4, alpha: 0.95 * a });
      const sh = [x + fr * 0.28, hy + fr * 2];
      ink.path([sh, [sh[0] + fr * 1.1, sh[1] + fr * 0.9], [sh[0] + fr * 1.9, sh[1] + fr * 0.4]], { seed: 550 + i, w: 1.4, alpha: 0.95 * a });
      ink.path([sh, [sh[0] - fr * 1.0, sh[1] + fr * 1.1], [sh[0] - fr * 1.7, sh[1] + fr * 0.5]], { seed: 560 + i, w: 1.4, alpha: 0.95 * a });
      const label = RELAY[i];
      const lit = i <= cur;
      const tw = textW(label, ls);
      if (lit) ink.marker(x - tw / 2 - 5, ty + 18, tw + 10, ls + 9, { seed: 570 + i, alpha: c.hlAlpha * a });
      ink.text(label, x, ty + 18 + ls + 1, { size: ls, align: 'center', alpha: a });
      if (i < n - 1 && !narrow) ink.text('→', (x + xs[i + 1]) / 2, ty + 18 + ls + 1, { font: 'body', size: 13, align: 'center', color: c.ink2, alpha: a });
    });
    // the baton: hand to hand
    const hand = (i) => [xs[i] + fr * 2.2, ty - fr * 6.2 + fr * 2.4];
    const [ax, ay] = hand(cur);
    const [bx2, by2] = cur < n - 1 ? hand(cur + 1) : hand(cur);
    const bx = lerp(ax, bx2, u);
    const by = lerp(ay, by2, u) - Math.sin(u * Math.PI) * fr * 2.5;
    ink.blob(bx, by, fr * 0.95, { seed: 580, alpha: c.hlAlpha * a });
    ink.line(bx - fr * 0.9, by + fr * 0.35, bx + fr * 0.9, by - fr * 0.35, { seed: 581, w: 2.6, alpha: a });
    if (!narrow) ink.text('有意識、有計劃地累積購買動機，不必靠一次次追逐爆文', w / 2, bot, { size: 14, align: 'center', color: c.ink2, alpha: a });
  }

  return {
    resize: geom,
    down(x, y) {
      if (env.step > 1) return;
      const [hx, hy] = brandXY();
      if (Math.hypot(x - hx, y - hy) < 40) dragging = true;
    },
    drag(x, y) {
      if (!dragging) return;
      brand.u = clamp((x - G.fx0) / (G.fx1 - G.fx0), -0.15, 1.05);
      brand.v = clamp((y - G.fy0) / (G.fy1 - G.fy0), -0.05, 1.05);
    },
    up() {
      dragging = false;
    },
    frame(t, dt) {
      const { ink, c, w, pointer } = env;
      const s = env.mini ? 0 : env.step;
      const still = dt === 0;
      const since = still ? 99 : t - env.stepAt;
      for (let i = 0; i < 6; i++) m[i] = still ? (i === s ? 1 : 0) : approach(m[i], i === s ? 1 : 0, dt, 0.25);
      tbl = still ? (s === 1 ? 1 : 0) : approach(tbl, s === 1 ? 1 : 0, dt, 0.35);
      // desire: uprooted while the brand moves, planted again slowly where it stands
      if (still) desire = dragging ? 0 : 1;
      else if (dragging) desire = approach(desire, 0, dt, 0.12);
      else desire = Math.min(1, desire + dt * (0.1 + desire * 0.45));

      const ca = Math.max(m[0], m[1]);
      if (ca > 0.02) {
        const loops = lerp(1.6, 2.4, m[1]);
        const [hx, hy, bx, by, lr] = drawChoice(ca, t, loops);
        const near = pointer.in && Math.hypot(pointer.x - hx, pointer.y - hy) < 40;
        if ((near || dragging) && !env.mini) ink.circle(hx, hy, 16, { seed: 60, w: 1, alpha: 0.6 * ca, passes: 1 });
        if (env.mini) {
          ink.text('偏心', hx + lr * 1.6 + 6, hy + 5, { size: 13, alpha: ca });
          ink.text('最划算', bx, by - 24, { font: 'body', size: 12, align: 'center', color: c.ink2, alpha: ca });
        } else {
          const a0 = m[0];
          const a1 = m[1];
          const fs = G.fs;
          const rx = hx + lr * 1.75 + 10;
          // labels: 最划算 vs the brand
          if (!G.narrow) ink.text('AI：什麼最划算', lerp(G.px, bx, 0.5), lerp(G.py, by, 0.5) - 18, { font: 'body', size: G.narrow ? 12 : 14, align: 'center', color: c.ink2, alpha: a0 });
          const bl = desire > 0.6 ? '特別想要你' : desire < 0.25 ? '渴望還沒種下' : '慢慢種下…';
          ink.text(G.narrow && a1 > 0.5 ? '偏心' : bl, hx, hy + lr * 1.5 + (G.narrow ? 16 : 26), { size: fs + 1, align: 'center', alpha: ca });
          ink.text('品牌', rx, hy + 5, { size: fs + 1, alpha: a0 });
          if (a0 > 0.02) {
            if (!G.narrow) ink.text('需求可以被回答，渴望卻需要被種下', w / 2, G.bot, { size: fs, align: 'center', color: c.ink2, alpha: a0 });
            ink.text('示意', G.fx1, G.fy0 - 14, { size: 13, align: 'right', color: c.ink2, alpha: a0 });
          }
          if (a1 > 0.02) {
            const tx = w * (G.narrow ? 0.7 : 0.68);
            ink.text('偏愛', tx, G.fy0 - 14, { size: fs + 3, alpha: a1 });
            if (!G.narrow) ink.text('合理的策略性選擇', tx + 44, G.fy0 - 14, { size: 13, color: c.ink2, alpha: a1 });
            if (!G.narrow) ink.text('偏心', rx, hy + 7, { size: fs + 5, weight: 700, alpha: a1 });
            if (!G.narrow) ink.text('沒有理由的喜歡', rx, hy + 30, { size: 13, color: c.ink2, alpha: a1 });
            if (!G.narrow) ink.text('有濾鏡、有故事', rx, hy + 48, { size: 13, color: c.ink2, alpha: a1 });
            if (!G.narrow) ink.text('比較表：價格與 CP 值之戰', tx, G.fy0 + Math.min(30, (G.fy1 - G.fy0) / 10) * 10 + 20, { font: 'body', size: G.narrow ? 12 : 13, color: c.ink2, alpha: a1 });
          }
        }
      }
      if (m[2] > 0.02) drawStep2(m[2], since, t, still);
      if (m[3] > 0.02) drawStep3(m[3], since, still);
      if (m[4] > 0.02) drawStep4(m[4], since, still);
      if (m[5] > 0.02) drawStep5(m[5], still ? (RELAY.length - 1) * 1.2 + 0.9 : since);
    },
  };
}
