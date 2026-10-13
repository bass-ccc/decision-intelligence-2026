// 21 超越效率 — one big idea, made at the scale of 48 markets, each one local.
// step 0  the big idea (a pencil ball) unfolds into 48 market tiles, each with its own glyph texture
// step 1  AI 也能打磨質感: one frame built from layers — 場景、光影、色調、人物特徵 — into a finished image
// step 2  AI 原生製作是一套系統: 市場 DNA 檔案 + 母提示詞, hundreds of rules around one image, thousands of variants out
// step 3  AI 製作人: not only at the helm but building the boat, plank by glyph plank
// step 4  在地內容引擎: Tier 1 / 2 / 3 out of one engine, into PTT、Dcard、Threads、Facebook、LINE
// step 5  人才、創意工藝、科技 turning together on 成效
// Click a tile to swap its market.
import { hash, lerp, approach, clamp, easeOut, easeInOut } from '../engine/noise.js';

export const hint = '點格子換市場';

const MARKETS = 48;
const LAYERS = ['場景', '光影', '色調', '人物特徵'];
const CHANNELS = ['PTT', 'Dcard', 'Threads', 'Facebook', 'LINE'];
// each channel takes its own size and format
const FORMAT = [
  [1, 0.55],
  [1, 0.8],
  [0.8, 1],
  [1, 1],
  [0.7, 0.7],
];

export default function make(env) {
  const { ink, ascii } = env;
  const mix = [1, 0, 0, 0, 0, 0];
  const t0 = [0, 0, 0, 0, 0, 0];
  let cur = -1;
  let G = {};
  const variant = new Array(MARKETS).fill(0);
  const flipAt = new Array(MARKETS).fill(-9);
  let feat = 5; // the market shown large in steps 1–5
  let featAt = -9;
  let hot = []; // clickable tiles this frame: [x, y, w, h, id]

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
  // the big idea: a pencil ball (circle, a pentagon, five seams)
  function ball(x, y, r, a, seed, w = 1.4) {
    ink.circle(x, y, r, { seed, alpha: 0.9 * a, w });
    if (r < 14) {
      ink.dot(x, y, r * 0.32, { seed: seed + 1, alpha: 0.85 * a, color: env.c.ink });
      return;
    }
    const pent = [];
    for (let i = 0; i < 5; i++) {
      const q = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pent.push([x + Math.cos(q) * r * 0.36, y + Math.sin(q) * r * 0.36]);
    }
    ink.poly(pent, { seed: seed + 2, alpha: 0.9 * a, w, closed: true });
    pent.forEach(([px, py], i) => {
      const q = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      ink.line(px, py, x + Math.cos(q) * r * 0.98, y + Math.sin(q) * r * 0.98, { seed: seed + 3 + i, alpha: 0.75 * a, w: w * 0.8, passes: 1 });
    });
  }
  // a market's own texture: eight families of glyph pattern, seeded by its DNA
  function texture(kind, dna, q, r, u, v) {
    switch (kind) {
      case 0: return (r + dna) % 3 === 0 ? 0.82 : 0.16;
      case 1: return (q + dna) % 3 === 0 ? 0.76 : 0.14;
      case 2: return (q + r + dna) % 4 === 0 ? 0.84 : 0.18;
      case 3: return q % 2 === 0 && r % 2 === 0 ? 0.92 : 0;
      case 4: return 0.12 + u * 0.75;
      case 5: return Math.floor(Math.hypot(u - 0.5, v - 0.5) * 7 + dna) % 2 ? 0.74 : 0.14;
      case 6: return ((q >> 1) + (r >> 1)) % 2 ? 0.72 : 0.1;
      default: return Math.sin(u * 7 + v * 3 + dna) > 0.25 ? 0.78 : 0.16;
    }
  }
  const dnaOf = (id) => Math.floor(hash(id, variant[id], 21) * 9973);
  // one market tile: local glyph texture (sometimes a local colour), the same ball on top
  function renderTile(w, h, dna, id, o) {
    const { c } = env;
    const kind = dna % 8;
    if (hash(dna, 5) < 0.34) ink.marker(0, 0, w, h, { seed: dna, alpha: c.hlAlpha * 0.85 });
    const cell = o.cell || clamp(Math.min(w, h) / 5.5, 5, 12);
    const cols = Math.max(1, Math.floor(w / cell));
    const rows = Math.max(1, Math.floor(h / cell));
    const cw = w / cols;
    const chh = h / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const v = texture(kind, dna, q, r, (q + 0.5) / cols, (r + 0.5) / rows);
      if (v > 0.05) ascii.glyph(v, (q + 0.5) * cw, (r + 0.5) * chh, Math.min(cw, chh) * 1.05, c.ink, 0.72);
    }
    if (o.frame !== false) ink.rect(0, 0, w, h, { seed: 200 + id, alpha: 0.6, w: 0.9, passes: 1, wobble: 0.5, boil: false });
    if (o.ball !== false) {
      const br = Math.min(w, h) * 0.22;
      const g = env.g;
      g.save();
      g.globalAlpha *= 0.92;
      g.fillStyle = c.sheet;
      g.beginPath();
      g.arc(w / 2, h / 2, br * 1.12, 0, Math.PI * 2);
      g.fill();
      g.restore();
      ball(w / 2, h / 2, br, 1, 300 + (id % 9) * 11, br > 20 ? 1.4 : 1.1);
    }
  }
  // tiles are drawn once into small canvases and stamped (48 of them every frame would be too slow)
  const cache = new Map();
  function tileCanvas(w, h, dna, id, o) {
    const W = Math.max(4, Math.round(w));
    const H = Math.max(4, Math.round(h));
    const key = [W, H, dna, o.ball === false ? 0 : 1, o.frame === false ? 0 : 1, o.cell || 0, env.c.ink, env.acc, env.dpr].join('|');
    let cv = cache.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = Math.ceil((W + 4) * env.dpr);
    cv.height = Math.ceil((H + 4) * env.dpr);
    const cg = cv.getContext('2d');
    cg.setTransform(env.dpr, 0, 0, env.dpr, 2 * env.dpr, 2 * env.dpr);
    const keep = env.g;
    env.g = cg;
    renderTile(W, H, dna, id, o);
    env.g = keep;
    cache.set(key, cv);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return cv;
  }
  // o.full: the size the tile is made at (it may be drawn smaller while it unfolds)
  function tile(x, y, w, h, id, a, o = {}) {
    const dna = o.dna ?? dnaOf(id);
    const [fw, fh] = o.full || [w, h];
    const cv = tileCanvas(fw, fh, dna, id, o);
    const flip = o.flip ?? clamp((env.t - flipAt[id]) / 0.45);
    const sx = flip < 1 ? Math.max(0.06, Math.abs(Math.cos(flip * Math.PI))) : 1;
    const kx = (w / Math.round(fw)) * sx;
    const ky = h / Math.round(fh);
    const g = env.g;
    g.save();
    g.globalAlpha *= a;
    g.drawImage(cv, x + (w - w * sx) / 2 - 2 * kx, y - 2 * ky, (Math.round(fw) + 4) * kx, (Math.round(fh) + 4) * ky);
    g.restore();
  }
  // one big picture for steps 1–5
  const featDNA = () => Math.floor(hash(feat, 77) * 9973);
  const featFlip = () => clamp((env.t - featAt) / 0.45);

  // ── step 0: one idea, 48 markets ──
  function scene0(a, T, still) {
    const { mini } = env;
    const { C, cx, narrow } = G;
    const head = mini ? 0 : 34;
    const gap = mini ? 4 : narrow ? 5 : 8;
    // a tall pane gets 6 × 8 instead of 8 × 6
    const tallG = C.h - head > C.w * 0.95;
    const COLS = tallG ? 6 : 8;
    const ROWS = tallG ? 8 : 6;
    const tw_ = Math.min((C.w - gap * (COLS - 1)) / COLS, ((C.h - head - gap * (ROWS - 1)) / ROWS) * 1.33);
    const th = tw_ / 1.33;
    const gw = COLS * tw_ + (COLS - 1) * gap;
    const gh = ROWS * th + (ROWS - 1) * gap;
    const gx = cx - gw / 2;
    const gy = C.y + head + (C.h - head - gh) / 2;
    const ccx = gx + gw / 2;
    const ccy = gy + gh / 2;
    const all = still ? 1 : clamp((T - 0.3) / 1.6);
    const bigR = Math.min(gw, gh) * 0.36;
    for (let i = 0; i < MARKETS; i++) {
      const q = i % COLS;
      const r = Math.floor(i / COLS);
      const x = gx + q * (tw_ + gap);
      const y = gy + r * (th + gap);
      const d = Math.hypot(x + tw_ / 2 - ccx, y + th / 2 - ccy) / Math.hypot(gw, gh);
      const e = still ? 1 : easeOut((T - 0.5 - d * 1.6) / 0.6);
      if (e <= 0.01) continue;
      const k = 0.4 + 0.6 * e;
      const xx = lerp(ccx, x + tw_ / 2, e) - (tw_ * k) / 2;
      const yy = lerp(ccy, y + th / 2, e) - (th * k) / 2;
      tile(xx, yy, tw_ * k, th * k, i, a * Math.min(1, e * 1.5), { full: [tw_, th], cell: mini ? 6 : undefined });
      hot.push([x, y, tw_, th, i]);
    }
    // the idea itself: big at first, then it lives on inside every tile
    if (all < 0.99) ball(ccx, ccy, bigR, a * 0.95 * (1 - all), 7, 1.8);
    if (mini) return;
    const fs = narrow ? 14 : 16;
    const t1 = clamp(1 - all * 1.5);
    if (t1 > 0) ink.text('一個大創意', cx, C.y + 16, { size: fs + 2, align: 'center', alpha: a * t1 });
    if (all > 0.5) {
      const msg = '一個大創意 → 48 個市場，各自在地';
      ink.text(msg, cx, C.y + 16, { size: fs, align: 'center', alpha: a * (all * 2 - 1) });
    }
  }

  // ── step 1: craft, layer by layer ──
  function scene1(a, T, still) {
    const { c, acc } = env;
    const { C, cx, cy, narrow } = G;
    // the exploded stack is about 2.9 frames tall: size the frame so it fits
    const fw = clamp(Math.min(C.w * (narrow ? 0.5 : 0.42), ((C.h - 40) / 2.9) * 1.33), 90, 380);
    const fh = fw / 1.33;
    const fx = Math.max(C.x + fw * 0.18 + 4, narrow ? C.x : cx - fw * 0.75);
    const P = 6;
    const ph = still ? 0.6 : T % P;
    // apart → together → hold
    const join = ph < 1 ? 0 : ph < 2.6 ? easeInOut((ph - 1) / 1.6) : ph < 5.4 ? 1 : 1 - easeInOut((ph - 5.4) / 0.6);
    const spread = (1 - join) * fh * 0.62;
    const skew = (1 - join) * fw * 0.18;
    const baseY = cy - fh / 2 + spread * 1.5;
    const dna = featDNA();
    const fl = featFlip();
    const lx = fx + fw + (narrow ? 12 : 40);
    for (let k = 0; k < 4; k++) {
      const y = baseY - (3 - k) * spread;
      const al = a * (0.55 + 0.45 * join);
      const g = env.g;
      const quad = [[fx + skew, y], [fx + fw + skew, y], [fx + fw - skew, y + fh], [fx - skew, y + fh]];
      // each layer adds one thing to the picture
      if (k === 0) tile(fx, y, fw, fh, 99, al, { dna, ball: false, frame: false, flip: fl });
      if (k === 1) {
        ascii.field(fx, y, fw, fh, 14, (px, py) => {
          const d = Math.hypot(px - (fx + fw * 0.2), py - (y + fh * 0.15)) / fw;
          return d < 0.5 ? 0.12 + (0.5 - d) * 0.9 : -1;
        }, c.ink, al * 0.55);
      }
      if (k === 2) {
        g.save();
        g.globalAlpha *= c.hlAlpha * 0.35 * al;
        g.fillStyle = acc;
        g.beginPath();
        quad.forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy)));
        g.closePath();
        g.fill();
        g.restore();
      }
      if (k === 3) ball(fx + fw / 2, y + fh / 2, fh * 0.24, al, 31, 1.8);
      ink.poly(quad, { seed: 40 + k, alpha: 0.7 * al, w: 1.1, closed: true, passes: 1 });
      // its name, with a leader line
      const ly = y + fh * 0.5 + (k - 1.5) * (join * 22);
      if (!narrow || k % 1 === 0) {
        ink.line(fx + fw + skew * 0.2 + 4, y + fh * 0.5, lx - 6, ly - 5, { seed: 50 + k, alpha: 0.35 * a, w: 0.9, passes: 1 });
        ink.text(LAYERS[k], lx, ly, { size: narrow ? 13 : 16, alpha: a });
      }
    }
    ink.rect(fx, cy - fh / 2 + spread * 1.5, fw, fh, { seed: 60, alpha: 0.9 * a * join, w: 1.5 });
    if (!narrow) {
      tag('質感 craft', fx + fw / 2, Math.min(baseY + fh + 40, C.y + C.h - 34), 17, a, { align: 'center', seed: 61 });
      ink.text('過去要大量後製的畫面，如今由創意人用生成式 AI 完成', C.x + C.w / 2, C.y + C.h - 4, { size: 15, align: 'center', color: c.ink2, alpha: a });
    } else ink.text('質感 craft', C.x + C.w / 2, C.y + C.h - 4, { size: 14, align: 'center', alpha: a * join });
    hot.push([fx, cy - fh / 2, fw, fh, -1]);
  }

  // ── step 2: a system behind every image ──
  function scene2(a, T, still) {
    const { c } = env;
    const { C, cx, cy, narrow } = G;
    const fs = narrow ? 13 : 15;
    // the image in the middle
    const iw = clamp(Math.min(C.w * 0.26, C.h * 0.32 * 1.33), 90, 260);
    const ih = iw / 1.33;
    const ix = cx - iw / 2;
    const iy = cy - ih / 2 + 20;
    // hundreds of rules around it
    const n = 300;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const q = (i / n) * Math.PI * 2 * 7;
      const ring = 1 + (i % 7) * 0.075;
      pts.push([cx + Math.cos(q + i) * iw * 0.62 * ring, iy + ih / 2 + Math.sin(q + i) * ih * 0.66 * ring]);
    }
    pts.forEach(([x, y], i) => ascii.glyph(i % 3 ? '·' : ':', x, y, 8, c.ink, a * (0.35 + 0.3 * hash(i, 9))));
    tile(ix, iy, iw, ih, 98, a, { dna: featDNA(), flip: featFlip() });
    hot.push([ix, iy, iw, ih, -1]);
    ink.text('一張圖，數百項規則與品牌規範', cx, iy + ih + ih * 0.5 + 34, { size: fs, align: 'center', alpha: a });
    // the market DNA files, one per market (48)
    const dn = narrow ? 12 : 24;
    const dw = Math.min(22, (C.w * 0.62) / dn - 3);
    const dy = C.y + 26;
    const dx0 = cx - (dn * (dw + 3)) / 2;
    const sel = feat % dn;
    for (let i = 0; i < dn; i++) {
      const x = dx0 + i * (dw + 3);
      if (i === sel) ink.marker(x - 2, dy - 2, dw + 4, dw * 1.3 + 4, { seed: 70, alpha: c.hlAlpha * a });
      ink.rect(x, dy, dw, dw * 1.3, { seed: 71 + i, alpha: 0.6 * a, w: 0.9, passes: 1, wobble: 0.4 });
      ascii.glyph(0.3 + (i % 5) * 0.12, x + dw / 2, dy + dw * 0.65, dw * 0.7, c.ink, a * 0.8);
    }
    ink.text(`市場 DNA 檔案 × 48${narrow ? '' : '（每個市場一份）'}`, cx, dy + dw * 1.3 + 22, { size: fs, align: 'center', alpha: a });
    ink.arrow(dx0 + (sel + 0.5) * (dw + 3), dy + dw * 1.3 + 30, cx, iy - 18, { seed: 72, alpha: 0.5 * a, w: 1, head: 7 });
    // the master prompt
    const pw = narrow ? 92 : clamp(C.w * 0.2, 120, 190);
    const px = C.x;
    const py = iy - 10;
    const ph = 34 + LAYERS.length * (fs + 10);
    const g = env.g;
    g.save();
    g.globalAlpha *= 0.9 * a;
    g.fillStyle = c.sheet;
    g.fillRect(px, py, pw, ph);
    g.restore();
    ink.rect(px, py, pw, ph, { seed: 80, alpha: 0.85 * a, w: 1.1, passes: 1 });
    ink.text('母提示詞', px + 10, py + 22, { size: fs, weight: 700, alpha: a });
    LAYERS.forEach((l, i) => {
      const y = py + 26 + (i + 1) * (fs + 10);
      ink.text(l, px + 10, y, { size: 13, color: c.ink2, alpha: a });
      if (!narrow) ascii.text('{ … }', px + pw - 46, y - 4, 11, c.ink2, a);
    });
    ink.arrow(px + pw + 6, py + ph / 2, ix - 30, iy + ih / 2, { seed: 81, alpha: 0.5 * a, w: 1, head: 7 });
    // thousands out
    const ox = ix + iw + iw * 0.45;
    const ow = C.x + C.w - ox;
    if (ow > 40) {
      ink.arrow(ix + iw + 28, iy + ih / 2, ox - 6, iy + ih / 2, { seed: 82, alpha: 0.5 * a, w: 1, head: 7 });
      const cols = Math.max(3, Math.floor(ow / 13));
      const rows = Math.max(3, Math.floor((ih + 30) / 13));
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const id = r * cols + q;
        const v = 0.25 + (dnaOf(id % 48) % 8) * 0.08;
        ascii.glyph(v, ox + q * 13 + 6, iy - 15 + r * 13 + 6, 10, c.ink, a * 0.7);
      }
      ink.text('數千件素材', ox + ow / 2, iy - 40, { size: fs, align: 'center', alpha: a });
    }
  }

  // ── step 3: building the boat ──
  function scene3(a, T, still) {
    const { c } = env;
    const { C, cx, cy, narrow } = G;
    const fs = narrow ? 13 : 16;
    const bw = clamp(C.w * 0.5, 210, 470);
    const bh = clamp(C.h * 0.19, 52, 116);
    const ground = cy + bh * 1.25;
    const keel = ground - 24; // the hull sits on two trestles
    const deck = keel - bh;
    const bx = cx - bw / 2 + (narrow ? 30 : 56);
    // hull edges at height y: the stern is nearly straight, the bow sweeps forward
    const left = (y) => lerp(bx + bw * 0.08, bx, (keel - y) / bh);
    const right = (y) => lerp(bx + bw * 0.76, bx + bw * 0.98, Math.pow((keel - y) / bh, 0.55));
    const rows = 6;
    const cyc = T % 10;
    const built = still ? rows : Math.min(rows, Math.floor(cyc / 1.05));
    const cell = clamp((bh / rows) * 0.95, 6, 14);
    for (let k = 0; k < built; k++) {
      const y = keel - (k + 0.5) * (bh / rows);
      const x0 = left(y) + 3;
      const x1 = right(y) - 3;
      const n = Math.floor((x1 - x0) / (cell * 0.8));
      for (let i = 0; i < n; i++) ascii.glyph(k % 2 ? '=' : '#', x0 + (i + 0.5) * ((x1 - x0) / n), y, cell, c.ink, a * 0.85);
    }
    // the hull and deck in pencil
    const hull = [[bx, deck]];
    for (let i = 0; i <= 8; i++) hull.push([left(lerp(deck, keel, i / 8)), lerp(deck, keel, i / 8)]);
    for (let i = 0; i <= 10; i++) hull.push([right(lerp(keel, deck, i / 10)), lerp(keel, deck, i / 10)]);
    hull.push([bx + bw, deck - bh * 0.12]);
    ink.path(hull, { seed: 90, alpha: 0.9 * a, w: 1.5 });
    ink.line(bx, deck, right(deck), deck, { seed: 91, alpha: 0.8 * a, w: 1.2 });
    // trestles and the ground: built on dry land
    ink.line(C.x, ground, C.x + C.w, ground, { seed: 92, alpha: 0.6 * a, w: 1.1 });
    for (const f of [0.28, 0.62]) {
      const x = bx + bw * f;
      ink.path([[x - 16, ground], [x, keel], [x + 16, ground]], { seed: 93 + f * 10, alpha: 0.8 * a, w: 1.2 });
    }
    // the plank on its way in
    const hx = bx - (narrow ? 34 : 64);
    const hs = clamp(bh * 1.25, 70, 140);
    if (!still && built < rows) {
      const e = easeInOut((cyc % 1.05) / 1.05);
      const y = keel - (built + 0.5) * (bh / rows);
      const px = lerp(hx + hs * 0.3, left(y) + 3, e);
      const py = lerp(ground - hs * 0.62, y, e);
      for (let i = 0; i < 7; i++) ascii.glyph(built % 2 ? '=' : '#', px + i * cell * 0.8, py, cell, c.ink, a);
    }
    // mast and sail: the sail is a market tile
    const mx = bx + bw * 0.48;
    const mastTop = deck - bh * 1.85;
    ink.line(mx, deck, mx, mastTop, { seed: 95, alpha: 0.9 * a, w: 1.6 });
    const sw = bh * 1.25;
    const sh = bh * 1.1;
    tile(mx + 6, mastTop + 6, sw, sh, 97, a, { dna: featDNA(), flip: featFlip() });
    hot.push([mx + 6, mastTop + 6, sw, sh, -1]);
    // the helm
    const wx = bx + bw * 0.16;
    const wy = deck - 30;
    ink.line(wx, wy, wx, deck, { seed: 96, alpha: 0.85 * a, w: 1.3 });
    ink.circle(wx, wy, 15, { seed: 97, alpha: 0.9 * a, w: 1.3 });
    for (let i = 0; i < 6; i++) {
      const q = (i / 6) * Math.PI * 2 + env.t * 0.3;
      ink.line(wx + Math.cos(q) * 3, wy + Math.sin(q) * 3, wx + Math.cos(q) * 21, wy + Math.sin(q) * 21, { seed: 98 + i, alpha: 0.7 * a, w: 1, passes: 1 });
    }
    // the AI producer on the ground, lifting the next plank
    const s = hs;
    ink.circle(hx, ground - s * 0.88, s * 0.09, { seed: 110, alpha: 0.9 * a, w: 1.4 });
    ink.line(hx, ground - s * 0.78, hx, ground - s * 0.42, { seed: 111, alpha: 0.9 * a, w: 1.4 });
    ink.path([[hx - s * 0.1, ground], [hx, ground - s * 0.42], [hx + s * 0.1, ground]], { seed: 112, alpha: 0.9 * a, w: 1.4 });
    ink.path([[hx, ground - s * 0.72], [hx + s * 0.16, ground - s * 0.66], [hx + s * 0.3, ground - s * 0.64]], { seed: 113, alpha: 0.9 * a, w: 1.3 });
    ink.path([[hx, ground - s * 0.72], [hx - s * 0.1, ground - s * 0.58], [hx + s * 0.06, ground - s * 0.5]], { seed: 114, alpha: 0.9 * a, w: 1.3 });
    ink.text('AI 製作人', hx, ground + 24, { size: narrow ? 13 : 15, align: 'center', alpha: a });
    if (!narrow) ink.text('掌舵', wx, wy - 30, { size: 14, align: 'center', color: c.ink2, alpha: a });
    tag('不只掌舵，更親手造船', cx, C.y + 18, fs + 2, a, { align: 'center', seed: 105 });
    const ly = C.y + C.h - 4;
    if (narrow) ink.text('56% 亞太企業開始招募提示詞工程師', C.x + C.w / 2, ly, { size: 13, align: 'center', alpha: a });
    else {
      const t2 = '亞太企業開始招募提示詞工程師等 AI 人才';
      const w2 = tw(t2, 15);
      ink.text('56%', C.x + C.w / 2 - w2 / 2 - 8, ly, { font: 'mono', size: 22, align: 'right', alpha: a });
      ink.text(t2, C.x + C.w / 2 - w2 / 2, ly, { size: 15, alpha: a });
    }
  }

  // ── step 4: the local content engine ──
  function scene4(a, T, still) {
    const { c } = env;
    const { C, narrow } = G;
    const fs = narrow ? 13 : 15;
    // tiers: one big, a few medium, many small
    const ex = C.x + (narrow ? 0 : 6);
    const ew = narrow ? C.w * 0.4 : C.w * 0.36;
    const tiers = [
      ['Tier 1', '最高規格', 1, 0.5],
      ['Tier 2', '', 3, 0.28],
      ['Tier 3', '自動化產出', 8, 0.11],
    ];
    let y = C.y + 30;
    const rowsH = C.h - 70;
    tiers.forEach(([name, sub, n, k], ti) => {
      const w1 = ew * k;
      const h1 = w1 * 0.75;
      const perRow = Math.min(n, Math.floor(ew / (w1 + 5)));
      const rows = Math.ceil(n / perRow);
      for (let i = 0; i < n; i++) {
        const q = i % perRow;
        const r = Math.floor(i / perRow);
        const x = ex + q * (w1 + 5);
        const yy = y + r * (h1 + 5);
        tile(x, yy, w1, h1, 10 + ti * 8 + i, a, { ball: w1 > 26 });
        hot.push([x, yy, w1, h1, 10 + ti * 8 + i]);
      }
      const ly = y + 14;
      ink.text(name, ex + perRow * (w1 + 5) + 6, ly, { font: 'latin', size: fs, weight: 700, alpha: a });
      if (sub && !narrow) ink.text(sub, ex + perRow * (w1 + 5) + 6, ly + 20, { size: 13, color: c.ink2, alpha: a });
      y += rows * (h1 + 5) + Math.min(28, rowsH * 0.06);
    });
    // channels: five lanes, each taking tiles in its own format
    const lx0 = C.x + C.w * (narrow ? 0.46 : 0.5);
    const lw = (C.x + C.w - lx0) / CHANNELS.length;
    const top = C.y + 34;
    const bot = C.y + C.h - 30;
    CHANNELS.forEach((ch, i) => {
      const x = lx0 + i * lw;
      ink.line(x + lw * 0.08, top + 10, x + lw * 0.08, bot, { seed: 110 + i, alpha: 0.3 * a, w: 0.9, passes: 1 });
      ink.text(ch, x + lw / 2, top - (narrow && i % 2 ? 14 : 0), { font: 'latin', size: narrow ? 12 : 13, weight: 500, align: 'center', alpha: a });
      const [fw, fh] = FORMAT[i];
      const tW = Math.min(lw * 0.66, 70) * fw;
      const tH = Math.min(lw * 0.66, 70) * fh;
      const gapY = Math.max(tH * 0.7, (bot - top - 20 - tH * 5) / 4);
      // the lane runs slowly downward: new pieces arrive at the top
      const ph = still ? 0.5 : env.t * 0.22 + i * 0.37;
      const base = Math.floor(ph);
      const fr = ph - base;
      for (let k = -1; k < 6; k++) {
        const yy = top + 16 + (k + fr) * (tH + gapY);
        const al = a * clamp((yy - top - 6) / (tH * 0.6)) * clamp((bot - yy - tH) / (tH * 0.6));
        if (al <= 0.01) continue;
        const id = 20 + ((((i * 7 + k - base) % 28) + 28) % 28);
        tile(x + (lw - tW) / 2, yy, tW, tH, id, al, { ball: tW > 30 });
        hot.push([x + (lw - tW) / 2, yy, tW, tH, id]);
      }
    });
    ink.text('理解在地通路，看起來像為通路量身訂做', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 13 : 15, align: 'center', color: c.ink2, alpha: a * (narrow ? 0 : 1) });
  }

  // ── step 5: four parts, one engine ──
  function gear(x, y, r, teeth, rot, a, seed, glyph) {
    const { c } = env;
    if (glyph) {
      const n = Math.round(r * 0.7);
      for (let i = 0; i < n; i++) {
        const q = rot + (i / n) * Math.PI * 2;
        ascii.glyph('#', x + Math.cos(q) * r * 0.86, y + Math.sin(q) * r * 0.86, 9, c.ink, a);
      }
      for (let i = 0; i < teeth; i++) {
        const q = rot + (i / teeth) * Math.PI * 2;
        ascii.glyph('@', x + Math.cos(q) * r * 1.04, y + Math.sin(q) * r * 1.04, 11, c.ink, a);
      }
      ascii.glyph('@', x, y, 14, c.ink, a);
      return;
    }
    const pts = [];
    for (let i = 0; i <= teeth * 4; i++) {
      const q = rot + (i / (teeth * 4)) * Math.PI * 2;
      const rr = i % 4 < 2 ? r * 1.08 : r * 0.9;
      pts.push([x + Math.cos(q) * rr, y + Math.sin(q) * rr]);
    }
    ink.poly(pts, { seed, alpha: 0.9 * a, w: 1.3, closed: true, passes: 1 });
    ink.circle(x, y, r * 0.3, { seed: seed + 1, alpha: 0.8 * a, w: 1.2 });
  }
  function scene5(a, T, still) {
    const { c } = env;
    const { C, cx, cy, narrow } = G;
    const items = env.data?.article?.framework?.items || [];
    const fs = narrow ? 14 : 17;
    const r = clamp(Math.min(C.w * 0.1, C.h * 0.15), 34, 90);
    const by = cy + r * 0.9; // the base: 成效
    const gys = cy - r * 0.35;
    const xs = [cx - r * 2.05, cx, cx + r * 2.05];
    const spin = still ? 0.3 : env.t * 0.5;
    xs.forEach((x, i) => gear(x, gys, r, 10, (i % 2 ? -spin : spin) + (i % 2 ? Math.PI / 10 : 0), a, 120 + i * 5, i === 2));
    // the base that drives all three
    const bx0 = xs[0] - r * 1.4;
    const bx1 = xs[2] + r * 1.4;
    ink.marker(bx0, by + r * 0.35, bx1 - bx0, 30, { seed: 130, alpha: c.hlAlpha * a });
    ink.rect(bx0, by + r * 0.35, bx1 - bx0, 30, { seed: 131, alpha: 0.85 * a, w: 1.2, passes: 1 });
    ink.text(items[3]?.[0] || '成效', cx, by + r * 0.35 + 21, { size: fs, weight: 700, align: 'center', alpha: a });
    xs.forEach((x, i) => ink.line(x, gys + r * 1.08, x, by + r * 0.35, { seed: 132 + i, alpha: 0.5 * a, w: 1, passes: 1 }));
    // names above, meanings below
    xs.forEach((x, i) => {
      const nl = narrow ? 0 : Math.min(2, ink.wrap(items[i]?.[1] || '', r * 1.9, { size: 13 }).length);
      ink.text(items[i]?.[0] || '', x, gys - r * 1.2 - (narrow ? 12 : 16 + nl * 18), { size: fs, weight: 700, align: 'center', alpha: a });
      if (!narrow) {
        const ls = ink.wrap(items[i]?.[1] || '', r * 1.9, { size: 13 });
        ls.slice(0, 2).forEach((l, j) => ink.text(l, x, gys - r * 1.2 - 12 - (Math.min(2, ls.length) - 1 - j) * 18, { size: 13, align: 'center', color: c.ink2, alpha: a }));
      }
    });
    if (!narrow) ink.text(items[3]?.[1] || '', cx, by + r * 0.35 + 54, { size: 13, align: 'center', color: c.ink2, alpha: a });
    // what comes out: tiles for every channel
    const ox = xs[2] + r * 1.6;
    if (C.x + C.w - ox > 50) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const k = still ? i / n : ((env.t * 0.2 + i / n) % 1);
        const x = lerp(ox, C.x + C.w - 34, k);
        const s = 30;
        tile(x, gys - s / 2 + Math.sin(k * 6) * 6, s, s * 0.75, 40 + i, a * Math.min(1, (1 - k) * 4), { ball: false });
        hot.push([x, gys - s / 2, s, s * 0.75, 40 + i]);
      }
    }
    ink.text('讓影響力無處不在', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  const scenes = [scene0, scene1, scene2, scene3, scene4, scene5];

  return {
    resize: geom,
    click(x, y) {
      for (let i = hot.length - 1; i >= 0; i--) {
        const [hx, hy, w, h, id] = hot[i];
        if (x >= hx - 3 && x <= hx + w + 3 && y >= hy - 3 && y <= hy + h + 3) {
          if (id < 0) {
            feat++;
            featAt = env.t;
          } else {
            variant[id]++;
            flipAt[id] = env.t;
          }
          return;
        }
      }
      // anywhere else: the featured market changes
      feat++;
      featAt = env.t;
    },
    frame(t, dt) {
      const s = env.step;
      const still = dt === 0;
      if (s !== cur) {
        t0[s] = t;
        cur = s;
      }
      hot = [];
      for (let i = 0; i < 6; i++) mix[i] = still ? (i === s ? 1 : 0) : approach(mix[i], i === s ? 1 : 0, dt, 0.18);
      for (let i = 0; i < 6; i++) {
        if (mix[i] < 0.02) continue;
        scenes[i](mix[i] * mix[i], t - t0[i], still, dt);
      }
    },
  };
}
