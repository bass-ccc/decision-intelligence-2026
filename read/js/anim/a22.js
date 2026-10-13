// 22 AI Agent 走進消費旅程 — the question is not "an Agent or not" but which tasks, and up to which level.
// step 0  four stairs of authority (觀察／理解 → 推薦 → 決策 → 行動), a glyph Agent at the bottom
// step 1  零售 Walmart Sparky: 「替八人聚會準備食物」 turns into a full basket by itself; +35% order value
// step 2  美妝 Olive Young: a skin-test scan grid becomes a recommendation; 73% vs 53% conversion
// step 3  保健 Thorne Taia: how much it can answer depends on how much it is allowed; 20 萬則訊息, 94% positive
// step 4  企業能力: clean data, structured products, live stock, rules → the Agent amplifies them; or the mess
// step 5  四層權限框架: the four stairs with the question each one must answer; the four cases placed on them
// Drag up / down to set the level of authority (step 4: click to swap clean ↔ messy).
import { hash, lerp, approach, clamp, noise3, easeOut } from '../engine/noise.js';

export const hint = '拖曳授權等級';

const LEVELS = ['觀察／理解', '推薦', '決策', '行動'];
// the guard question at each level (short forms of the text)
const GUARD = [
  ['資料來源可靠嗎？', '取得同意了嗎？'],
  ['推薦規則清楚嗎？', '錯誤容忍度？'],
  ['可以撤回嗎？', '何時要人工確認？'],
  ['可執行範圍？', '金額上限、稽核？'],
];
// where each case sits (the text: Olive Young & Thorne at 觀察／理解 + 推薦, BRAINEFFECT to the cart, Walmart to fulfilment)
const CASES = [
  ['Olive Young', 1],
  ['Thorne', 1],
  ['BRAINEFFECT', 2],
  ['Walmart', 3],
];
const BASKET = ['主食', '飲料', '甜點', '餐具', '紙巾', '冰塊', '零食', '水果'];
const CAPS = ['乾淨的顧客資料', '結構化商品資訊', '即時庫存', '治理規則'];
const WRONG = ['屬性沒填齊，推錯品項', '退貨規則散在三個系統', '庫存不同步', '權責不清'];

export default function make(env) {
  const { ink, ascii } = env;
  const mix = [1, 0, 0, 0, 0, 0];
  const t0 = [0, 0, 0, 0, 0, 0];
  let cur = -1;
  let G = {};
  // the level of authority, 0..4 (0 = none, 4 = 行動), set by dragging
  let level = 1;
  let lv = 1;
  let manual = false;
  let messy = 0;
  let mv = 0;

  function geom() {
    const { w, h, mini } = env;
    const pad = mini ? 8 : w < 520 ? 16 : 28;
    const top = mini ? 8 : 44;
    const bot = mini ? h - 8 : h - 60;
    const C = { x: pad, y: top, w: w - pad * 2, h: bot - top };
    G = { w, h, C, cx: w / 2, cy: top + C.h / 2, narrow: w < 560 };
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
  function card(x, y, w, h, a, seed) {
    const g = env.g;
    g.save();
    g.globalAlpha *= 0.9 * a;
    g.fillStyle = env.c.sheet;
    g.fillRect(x, y, w, h);
    g.restore();
    ink.rect(x, y, w, h, { seed, alpha: 0.85 * a, w: 1.1, passes: 1 });
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
  // the Agent: a glyph head and shoulders; feet at (x, y), height s
  function agent(x, y, s, a, chaos = 0.15) {
    const { c } = env;
    const cell = clamp(s / 13, 4.5, 8);
    const n = Math.ceil(s / cell) + 1;
    const hx = x;
    const hy = y - s * 0.74;
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const px = x - (n * cell) / 2 + (q + 0.5) * cell;
      const py = y - s + (r + 0.5) * cell;
      const dh = Math.hypot(px - hx, py - hy) / (s * 0.2);
      const ex = Math.abs(px - x) / (s * 0.42);
      const ey = Math.abs(py - y) / (s * 0.42);
      const db = py <= y ? Math.pow(ex ** 2.6 + ey ** 2.6, 1 / 2.6) : 9;
      const d = Math.min(dh, db);
      if (d > 1) continue;
      const nz = noise3(q * 0.5, r * 0.5, env.t * (0.4 + chaos * 4));
      ascii.glyph(clamp((d > 0.78 ? 0.97 : 0.62) + nz * (0.1 + chaos * 0.5), 0.2, 0.99), px + nz * chaos * 4, py, cell * 1.1, c.ink, a);
    }
  }

  // ── the staircase of authority (steps 0 and 5) ──
  function stairs(a, o) {
    const { c } = env;
    const { narrow } = G;
    const mini = env.mini;
    const n = 4;
    const x0 = o.x0;
    const x1 = o.x1;
    const yb = o.yb;
    const yt = o.yt;
    const sw = (x1 - x0) / n;
    // leave room above the top stair for the Agent standing on it
    const sh = (yb - yt) / (n + 1.1);
    const fs = mini ? 12 : narrow ? 13 : 16;
    // stairs climbed so far are filled
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sw;
      const y = yb - (i + 1) * sh;
      const lit = clamp(lv - i);
      if (lit > 0.01) ink.marker(x + 2, y + 2, sw - 4, yb - y - 4, { seed: 10 + i, alpha: c.hlAlpha * 0.75 * a * lit });
      ink.line(x, y, x + sw, y, { seed: 20 + i, alpha: 0.9 * a, w: 1.5 });
      ink.line(x, y, x, y + sh, { seed: 30 + i, alpha: 0.9 * a, w: 1.5 });
      if (tw(LEVELS[i], fs) < sw - 8) ink.text(LEVELS[i], x + sw / 2, y + (mini ? 18 : 26), { size: fs, align: 'center', weight: lit > 0.5 ? 700 : 400, alpha: a });
      if (o.guards && !mini && !narrow) {
        const q = GUARD[i];
        const gy = y + 26 + (narrow ? 18 : 24);
        q.forEach((s, j) => ink.text(s, x + sw / 2, gy + j * (narrow ? 16 : 20), { size: narrow ? 12 : 13, align: 'center', color: c.ink2, alpha: a * (0.4 + 0.6 * lit) }));
      }
    }
    ink.line(x0 - 20, yb, x1 + 10, yb, { seed: 40, alpha: 0.8 * a, w: 1.3 });
    ink.line(x1, yb - n * sh, x1, yb, { seed: 41, alpha: 0.6 * a, w: 1.1, passes: 1 });
    // guardrails: a rail along the edge of every level it has reached
    const k = clamp(lv, 0, 4);
    const rails = Math.ceil(k - 0.05);
    const post = Math.min(sh * 0.22, 16);
    for (let r = 0; r < rails; r++) {
      const x = x0 + r * sw;
      const y = yb - (r + 1) * sh;
      const g = env.g;
      g.save();
      g.strokeStyle = c.pencil;
      g.globalAlpha *= 0.65 * a;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + sw * 0.55, y - post);
      g.lineTo(x + sw - 3, y - post);
      for (let p = 0; p < 4; p++) {
        const px = x + sw * 0.55 + (p / 3) * (sw * 0.45 - 3);
        g.moveTo(px, y);
        g.lineTo(px, y - post);
      }
      g.stroke();
      g.restore();
    }
    // the Agent stands on the highest step it may reach, and hops between them
    const at = (j) => (j <= 0 ? [x0 - sw * 0.38, yb] : [x0 + (j - 0.7) * sw, yb - j * sh]);
    const j0 = Math.floor(k);
    const f = k - j0;
    const [ax0, ay0] = at(j0);
    const [ax1, ay1] = at(Math.min(4, j0 + 1));
    const s = Math.min(sh * 1.05, 120);
    const hop = Math.sin(f * Math.PI) * sh * 0.45;
    agent(lerp(ax0, ax1, f), lerp(ay0, ay1, f) - hop, s, a, 0.12);
    return { sw, sh };
  }

  // ── step 0: which tasks, up to which level ──
  function scene0(a, T, still) {
    const { c, mini } = env;
    const { C, narrow } = G;
    const head = mini ? 0 : 56;
    const x0 = C.x + C.w * (mini ? 0.22 : narrow ? 0.18 : 0.2);
    const x1 = C.x + C.w * (mini ? 0.98 : 0.94);
    const yb = C.y + C.h - (mini ? 4 : 12);
    const yt = C.y + head + (mini ? 0 : 6);
    stairs(a, { x0, x1, yb, yt });
    if (mini) return;
    const q = '哪些任務可交給 AI、可授權到哪一層級？';
    ink.text(q, C.x + C.w / 2, C.y + 22, { size: narrow ? 15 : 19, align: 'center', alpha: a });
    if (!narrow) ink.text('自主程度：被允許讀寫哪些系統、能連續走幾步', C.x + C.w / 2, C.y + 46, { size: 14, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 1: Walmart Sparky, a task becomes a basket ──
  function scene1(a, T, still) {
    const { c } = env;
    const { C, cy, narrow } = G;
    const fs = narrow ? 13 : 16;
    const P = 7;
    const ph = still ? 5.5 : T % P;
    const reachN = Math.round(lv);
    const chain = ['理解目標', '檢索商品與庫存', '建立購物籃', '結帳與履約'];
    // middle row: the person, the Agent, the basket
    const u = clamp(Math.min(C.w / 700, C.h / 520), 0.5, 1.3);
    const rowY = cy + 20 * u;
    const ps = clamp(84 * u, 44, 120);
    const px = C.x + ps * 0.5 + 4;
    const as = clamp(120 * u, 56, 160);
    const ax = C.x + C.w * (narrow ? 0.44 : 0.42);
    const kw = clamp(220 * u, 110, 300);
    const kh = kw * 0.55;
    const kx = C.x + C.w - kw - 4;
    const ky = rowY - kh * 0.4;
    person(px, rowY - ps * 0.2, ps, a, 61);
    agent(ax, rowY + as * 0.3, as, a, 0.15);
    ink.text('Sparky', ax, rowY + as * 0.3 + 22, { font: 'latin', size: 14, weight: 700, align: 'center', alpha: a });
    // the request, said by the person
    const bub = '「替八人聚會準備食物」';
    const bw = tw(bub, fs + 1) + 24;
    const bx = C.x;
    const by = rowY - ps * 0.9 - fs - (narrow ? 40 : 40 * u);
    card(bx, by, bw, fs + 22, a, 60);
    ink.text(bub, bx + 12, by + fs + 8, { size: fs + 1, alpha: a });
    ink.line(px + 4, by + fs + 22, px + 10, rowY - ps * 0.75, { seed: 69, alpha: 0.6 * a, w: 1, passes: 1 });
    ink.arrow(px + ps * 0.6, rowY, ax - as * 0.6, rowY, { seed: 63, alpha: 0.5 * a, w: 1, head: 7 });
    // the basket
    ink.path([[kx, ky], [kx + 14, ky + kh], [kx + kw - 14, ky + kh], [kx + kw, ky]], { seed: 66, alpha: 0.9 * a, w: 1.5 });
    ink.path([[kx + kw * 0.22, ky], [kx + kw * 0.5, ky - kh * 0.5], [kx + kw * 0.78, ky]], { seed: 67, alpha: 0.8 * a, w: 1.3 });
    const canBasket = reachN >= 3;
    const perRow = 3;
    const nIn = canBasket ? (still ? BASKET.length : Math.min(BASKET.length, Math.floor(ph / 0.42))) : 0;
    BASKET.forEach((s, i) => {
      const q = i % perRow;
      const r = Math.floor(i / perRow);
      const tx = kx + 18 + q * ((kw - 30) / perRow);
      const ty = ky + kh - 12 - r * (kh / 3.3);
      if (i < nIn) {
        const e = still ? 1 : easeOut(clamp((ph - i * 0.42) / 0.4));
        const sx = ax + as * 0.4;
        const sy = rowY - as * 0.2;
        ink.text(s, lerp(sx, tx, e), lerp(sy, ty, e), { size: narrow ? 12 : 14, alpha: a });
      }
    });
    if (canBasket) {
      ink.arrow(ax + as * 0.6, rowY, kx - 10, rowY, { seed: 64, alpha: 0.5 * a, w: 1, head: 7 });
      ink.text('品項為示意', kx + kw / 2, ky - kh * 0.5 - 10, { size: 13, align: 'center', color: c.ink2, alpha: a });
    }
    else ink.text('只到推薦：購物籃要自己放', kx + kw / 2, ky + kh + 26, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // the chain: as far as it is allowed to go
    const cyy = rowY + as * 0.3 + (narrow ? 50 : 60 * u);
    const cw = C.w / 4;
    chain.forEach((s, i) => {
      const on = i < reachN;
      const x = C.x + i * cw;
      const lab = narrow ? s.slice(0, 4) : s;
      const m = tw(lab, narrow ? 12 : 15);
      if (on) ink.marker(x - 2, cyy - (narrow ? 14 : 17), m + 10, narrow ? 20 : 24, { seed: 62 + i, alpha: c.hlAlpha * a });
      ink.text(lab, x + 3, cyy, { size: narrow ? 12 : 15, alpha: a * (on ? 1 : 0.4) });
      if (i < 3) ink.text('→', x + cw - 14, cyy, { size: 13, color: c.ink2, alpha: a * 0.7 });
    });
    if (!narrow) ink.text('零售：從找商品走向完成購物任務', C.x + C.w / 2, C.y + C.h - 4, { size: 16, align: 'center', color: c.ink2, alpha: a });
    // the number
    const ny = C.y + 22;
    tag('+35%', C.x + C.w - 2, ny + 4, narrow ? 18 : 24, a, { align: 'right', font: 'mono', seed: 68 });
    ink.text('使用者平均訂單金額', C.x + C.w - 2, ny + (narrow ? 24 : 30), { size: 13, align: 'right', color: c.ink2, alpha: a });
  }

  // ── step 2: Olive Young, "suits me" becomes data ──
  function scene2(a, T, still) {
    const { c } = env;
    const { C, cy, narrow } = G;
    const fs = narrow ? 13 : 15;
    const P = 6;
    const ph = still ? 4.5 : T % P;
    // the face being scanned
    const fr = clamp(Math.min(C.w * 0.12, C.h * 0.22), 40, 120);
    const fx = C.x + fr * 0.8 + (narrow ? 2 : 10);
    const fy = cy - 20;
    // horizontal room: face | readings | cards | counsellor
    const u = clamp(C.w / 900, 0.45, 1.3);
    const face = [];
    for (let i = 0; i <= 30; i++) {
      const q = (i / 30) * Math.PI * 2.03;
      face.push([fx + Math.cos(q) * fr * 0.8, fy + Math.sin(q) * fr]);
    }
    ink.path(face, { seed: 70, alpha: 0.9 * a, w: 1.5 });
    ink.path([[fx - fr * 0.36, fy - fr * 0.12], [fx - fr * 0.2, fy - fr * 0.16]], { seed: 71, alpha: 0.9 * a, w: 1.4 });
    ink.path([[fx + fr * 0.2, fy - fr * 0.16], [fx + fr * 0.36, fy - fr * 0.12]], { seed: 72, alpha: 0.9 * a, w: 1.4 });
    ink.path([[fx - fr * 0.18, fy + fr * 0.44], [fx, fy + fr * 0.5], [fx + fr * 0.18, fy + fr * 0.44]], { seed: 73, alpha: 0.9 * a, w: 1.4 });
    // the scan grid of glyphs, sweeping down
    const sweep = clamp(ph / 2.2);
    const cell = clamp(fr / 7, 6, 11);
    ascii.field(fx - fr * 0.8, fy - fr, fr * 1.6, fr * 2 * sweep, cell, (x, y, q, r) => {
      const e = ((x - fx) / (fr * 0.8)) ** 2 + ((y - fy) / fr) ** 2;
      if (e > 1) return -1;
      return 0.2 + hash(q, r) * 0.45;
    }, c.ink, a * 0.65);
    if (sweep < 1) ink.line(fx - fr, fy - fr + fr * 2 * sweep, fx + fr, fy - fr + fr * 2 * sweep, { seed: 74, alpha: 0.8 * a, w: 1.2 });
    // the readings
    const reads = ['水分', '油分', '毛孔', '膚色'];
    const rx = fx + fr + 30 * u;
    reads.forEach((s, i) => {
      const e = clamp((ph - 0.6 - i * 0.4) / 0.4);
      const y = fy - fr * 0.6 + i * (fr * 0.42);
      ink.text(s, rx, y, { size: fs, alpha: a * e });
      const bw = 90 * u * (0.35 + hash(i, 7) * 0.6) * e;
      ascii.field(rx + tw(s, fs) + 8, y - 11, Math.max(1, bw), 12, 7, () => 0.7, c.ink, a);
    });
    // → the recommendation, and the person at the counter
    const ox = rx + tw('水分', fs) + 110 * u + 50 * u;
    const e2 = clamp((ph - 2.6) / 0.6);
    if (e2 > 0) {
      ink.arrow(ox - 44 * u, fy, ox - 10, fy, { seed: 75, alpha: 0.7 * a * e2, w: 1.1, head: 7 });
      const pw = clamp(130 * u, 66, 150);
      for (let k = 0; k < 3; k++) {
        const x = ox + k * 10;
        const y = fy - 40 + k * 10;
        card(x, y, pw, 54, a * e2, 76 + k);
      }
      tag('適合我', ox + 20 + pw / 2, fy + 30, fs + 1, a * e2, { align: 'center', seed: 79 });
      const cx2 = Math.min(C.x + C.w - 50, ox + pw + 20 + (C.x + C.w - ox - pw - 20) / 2);
      if (C.x + C.w - ox - pw > 110) {
        person(cx2, fy, clamp(80 * u, 50, 100), a * e2, 80);
        ink.text('門市美容顧問', cx2, fy + clamp(80 * u, 50, 100) * 0.5 + 24, { size: 13, align: 'center', color: c.ink2, alpha: a * e2 });
        ink.text('解釋、建議、建立信任', cx2, fy + clamp(80 * u, 50, 100) * 0.5 + 44, { size: 13, align: 'center', color: c.ink2, alpha: a * e2 });
      }
    }
    // the numbers: 73% vs 53%
    const bx = C.x + (narrow ? 0 : 10);
    const by = C.y + C.h - 10;
    const bmax = Math.min(C.w * 0.5, 320);
    const bars = [['使用膚質檢定', 73], ['未使用', 53]];
    bars.forEach(([s, v], i) => {
      const y = by - (1 - i) * 30;
      const w = (bmax * v) / 100;
      const lab = tw('使用膚質檢定', 13) + 12;
      ink.text(s, bx, y, { size: 13, color: c.ink2, alpha: a });
      if (i === 0) ink.marker(bx + lab, y - 14, w, 18, { seed: 81, alpha: c.hlAlpha * a });
      else ink.rect(bx + lab, y - 14, w, 18, { seed: 82, alpha: 0.6 * a, w: 1, passes: 1 });
      ink.text(`${v}%`, bx + lab + w + 8, y, { font: 'mono', size: 15, alpha: a });
    });
    if (!narrow) ink.text('購買轉換率', bx + tw('使用膚質檢定', 13) + 12 + bmax * 0.73 + 64, by - 30, { size: 13, color: c.ink2, alpha: a });
  }

  // ── step 3: Thorne Taia, what it may answer ──
  function scene3(a, T, still) {
    const { c, acc } = env;
    const { C, cy, narrow } = G;
    const fs = narrow ? 13 : 15;
    // the circle may grow to Rmax; keep it inside the canvas
    const Rmax = Math.min(C.h * 0.42, C.w * (narrow ? 0.34 : 0.3));
    const ax = C.x + Math.max(C.w * 0.22, Rmax * 0.92);
    const s = clamp(C.h * 0.24, 56, 130);
    const ay = cy - 14 + s * 0.5;
    agent(ax, ay, s, a, 0.12);
    ink.text('Taia', ax, ay + 24, { font: 'latin', size: 15, weight: 700, align: 'center', alpha: a });
    // the circle of what it may answer grows with the level
    const R = Math.min(s * (0.7 + lv * 0.42), Rmax);
    const g = env.g;
    g.save();
    g.globalAlpha *= c.hlAlpha * 0.35 * a;
    g.fillStyle = acc;
    g.beginPath();
    g.arc(ax, ay - s * 0.5, R, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const ring = [];
    for (let i = 0; i <= 40; i++) {
      const q = (i / 40) * Math.PI * 2.02;
      ring.push([ax + Math.cos(q) * R, ay - s * 0.5 + Math.sin(q) * R]);
    }
    ink.path(ring, { seed: 85, alpha: 0.6 * a, w: 1.1 });
    // questions: inside the circle they get an answer
    const qs = [
      ['腸道', 0.9, -2.6],
      ['皮膚', 1.1, -0.6],
      ['疲勞', 1.3, 0.5],
      ['補充品組合', 1.9, -1.6],
      ['生活型態建議', 2.4, -0.2],
      ['推薦相關產品', 2.9, -1.1],
    ];
    qs.forEach(([q, d, ang], i) => {
      const x = ax + Math.cos(ang) * s * d;
      const y = Math.max(C.y + 14, ay - s * 0.5 + Math.sin(ang) * s * d * 0.8);
      const inside = s * d < R;
      if (inside) ink.marker(x - tw(q, fs) / 2 - 5, y - fs, tw(q, fs) + 10, fs * 1.4, { seed: 86 + i, alpha: c.hlAlpha * a });
      ink.text(q + (inside ? '' : '？'), x, y, { size: fs, align: 'center', alpha: a * (inside ? 1 : 0.5) });
    });
    // the numbers
    const nx = C.x + C.w - (narrow ? 0 : 10);
    const ny = C.y + (narrow ? 20 : 30);
    const rows = [['20 萬+', '則訊息（六個月）'], ['94%', '正面回饋']];
    rows.forEach(([v, s2], i) => {
      ink.text(v, nx, ny + i * (narrow ? 44 : 58), { font: 'mono', size: narrow ? 18 : 24, align: 'right', alpha: a });
      ink.text(s2, nx, ny + i * (narrow ? 44 : 58) + 20, { size: 13, align: 'right', color: c.ink2, alpha: a });
    });
    ink.text('能回答多少，取決於敢授權多少', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 4: the Agent amplifies what is there ──
  function scene4(a, T, still) {
    const { c } = env;
    const { C, cx, cy, narrow } = G;
    // the base: four blocks of company capability, clean or messy
    const bw = Math.min(Math.max(C.w * 0.24, ...[...CAPS, ...WRONG].map((t) => tw(t, narrow ? 12 : 14) + 16)), 220);
    const bx0 = C.x + (narrow ? 0 : 10);
    const by0 = cy - 2 * (narrow ? 34 : 46) + 10;
    const bh = narrow ? 28 : 38;
    CAPS.forEach((s, i) => {
      const y = by0 + i * (bh + 8);
      const jx = mv * (hash(i, 3) - 0.5) * 30;
      const rot = mv * (hash(i, 4) - 0.5) * 0.12;
      const g = env.g;
      g.save();
      g.translate(bx0 + bw / 2 + jx, y + bh / 2);
      g.rotate(rot);
      if (mv < 0.5) ink.marker(-bw / 2, -bh / 2, bw, bh, { seed: 90 + i, alpha: c.hlAlpha * a * (1 - mv * 2) });
      ink.rect(-bw / 2, -bh / 2, bw, bh, { seed: 95 + i, alpha: 0.85 * a, w: 1.1, passes: 1 });
      ink.text(mv < 0.5 ? s : WRONG[i], 0, 5, { size: narrow ? 12 : 14, align: 'center', alpha: a });
      g.restore();
    });
    // the Agent in the middle, amplifying
    const ax = bx0 + bw + (narrow ? 40 : 80);
    const as = narrow ? 64 : clamp(C.h * 0.22, 80, 130);
    agent(ax, cy + as * 0.5, as, a, 0.1 + mv * 0.8);
    // its output fans out larger: order or chaos
    const ox = ax + as * 0.6;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const k = (i - (n - 1) / 2) / ((n - 1) / 2);
      const L = C.x + C.w - ox - 10;
      const y = cy + k * C.h * 0.32;
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const f = j / 14;
        const wob = mv * Math.sin(f * 9 + i * 1.7 + env.t * 2) * 18 * f;
        pts.push([ox + f * L, lerp(cy, y, f) + wob]);
      }
      if (mv < 0.5) ink.path(pts, { seed: 100 + i, alpha: 0.55 * a, w: 1, passes: 1 });
      else ascii.line(ox, cy, pts[14][0], pts[14][1], 9, c.ink, a * 0.6, i % 2 ? '?' : '!');
      const [ex, ey] = pts[14];
      if (mv < 0.5) {
        ink.blob(ex - 6, ey, 8, { seed: 110 + i, alpha: c.hlAlpha * a });
        ink.circle(ex - 6, ey, 5, { seed: 120 + i, alpha: 0.8 * a, w: 1 });
      } else ascii.glyph('#', ex - 6, ey + Math.sin(env.t * 3 + i) * 4, 14, c.ink, a);
    }
    const msg = mv < 0.5 ? 'Agent 會放大企業能力' : '也會放大混亂';
    tag(msg, cx, C.y + 20, narrow ? 15 : 18, a, { align: 'center', seed: 130 });
    ink.text('競爭優勢從模型轉向企業能力', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 5: the four-level framework with its questions ──
  function scene5(a, T, still) {
    const { c } = env;
    const { C, narrow } = G;
    const x0 = C.x + (narrow ? 0 : C.w * 0.02);
    const x1 = C.x + C.w * (narrow ? 1 : 0.98);
    const yb = C.y + C.h - (narrow ? 8 : 56);
    const yt = C.y + (narrow ? 44 : 22);
    const { sw } = stairs(a, { x0, x1, yb, yt, guards: true });
    // the cases, placed where the text puts them
    if (!narrow) CASES.forEach(([name, lvl], i) => {
      // Olive Young and Thorne span 觀察／理解 and 推薦; the others reach further
      const x = lvl === 1 ? x0 + sw : x0 + (lvl + 0.5) * sw;
      const y = yb + 26 + (lvl === 1 ? i * 18 : 0);
      ink.text(name, x, y, { font: 'latin', size: 13, weight: 500, align: 'center', color: c.ink2, alpha: a });
    });
    ink.text('自主程度不是越高越好', C.x + C.w / 2, C.y + 14, { size: narrow ? 14 : 16, align: 'center', alpha: a });
    if (narrow) {
      const i = clamp(Math.round(lv) - 1, 0, 3);
      ink.text(`${LEVELS[i]}：${GUARD[i].join('')}`, C.x + C.w / 2, C.y + 36, { size: 13, align: 'center', color: c.ink2, alpha: a });
    }
  }

  const scenes = [scene0, scene1, scene2, scene3, scene4, scene5];
  // each step starts at the level its case sits on
  const START = [1, 4, 2, 2, 3, 2];

  return {
    resize: geom,
    drag(x, y, dx, dy) {
      manual = true;
      level = clamp(level - dy / Math.max(40, G.C.h / 6), 0, 4);
    },
    up() {
      level = Math.round(level);
    },
    click(x, y) {
      if (env.step === 4) messy = messy ? 0 : 1;
      else {
        manual = true;
        // above the middle: one level up; below: one down
        level = clamp(Math.round(level) + (y < G.cy ? 1 : -1), 0, 4);
      }
    },
    frame(t, dt) {
      const s = env.step;
      const still = dt === 0;
      if (s !== cur) {
        t0[s] = t;
        if (!manual || s === 0) level = env.mini ? 2 : START[s];
        manual = false;
        if (s === 4) messy = 0;
        cur = s;
      }
      // left alone in step 0 the Agent climbs and comes back down
      if (s === 0 && !manual && !still) level = 2 + 2 * Math.sin((t - t0[0]) * 0.5 - 1.2) * 0.999;
      lv = still ? Math.round(level) : approach(lv, level, dt, 0.18);
      mv = still ? messy : approach(mv, messy, dt, 0.2);
      for (let i = 0; i < 6; i++) mix[i] = still ? (i === s ? 1 : 0) : approach(mix[i], i === s ? 1 : 0, dt, 0.18);
      for (let i = 0; i < 6; i++) {
        if (mix[i] < 0.02) continue;
        scenes[i](mix[i] * mix[i], t - t0[i], still, dt);
      }
    },
  };
}
