// 10 別買曝光了，開始買注意力吧 — exposure inflates; attention is rare, and the valuable kind is designed.
// step 0  a feed of glyph ad slots scrolls past; an eye-tracking scanpath (pencil) skims it — exposures pile up, attention barely grows
// step 1  The Doom Loop: report bars grow taller round a spiral while the brand's name shrinks toward the middle
// step 2  the feed stops: every slot is ticked 可視 (the ticket); only a few hold the gaze long enough to count (the asset)
// step 3  AISAS → AICAS: the journey now starts with Ask; a brand with nothing citable drops out before the comparison
// step 4  CeraVe on the Taipei metro: bottles hang from the hand-straps, hands take them, 2.4 萬 posts rise in a day
// step 5  the media matrix: 需求一致／分歧 × 主張易／難證明
// Hover (stare at) one slot: attention seconds build up there.
import { ARTICLES } from '../content.js';
import { hash, clamp, lerp, smooth, approach } from '../engine/noise.js';
import { randomGlyph } from '../engine/ascii.js';

export const hint = '盯著一格看';

const ART = ARTICLES.find((a) => a.no === 10);
const OLD = ['A', 'I', 'S', 'A', 'S'];
const NEW = ['A', 'I', 'C', 'A', 'S'];

// the eye's scanpath: mostly glances, now and then one long look
const durOf = (i) => (i % 5 === 4 ? 2.3 + hash(i, 3) * 0.7 : 0.22 + hash(i, 4) * 0.3);

export default function make(env) {
  let G = {};
  const mix = { feed: 1, speed: 1, tick: 0, loop: 0, aicas: 0, metro: 0, matrix: 0 };
  const sim = { t: 0, off: [], vmul: [], fi: 0, fixT0: 0, fix: null, hist: [] };
  const dwell = new Map(); // card id → seconds looked at
  let stare = null; // { id, c } the card under the reader's pointer
  const userTakes = []; // { k, t0 } straps the reader reached for
  const sprites = new Map();

  const measure = (str, kind, size, weight = 400) => {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size, weight);
    const m = g.measureText(str).width;
    g.restore();
    return m;
  };

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 8 : 40;
    const bot = mini ? h - 8 : h - 58;
    const H = bot - top;
    const narrow = w < 560;
    G = { top, bot, H, narrow, fs: narrow ? 14 : 16 };
    // feed
    G.fx0 = mini ? 10 : 22;
    const W = w - G.fx0 * 2;
    G.cols = mini ? 3 : clamp(Math.round(W / 165), 3, 5);
    G.gap = mini ? 8 : 18;
    G.cw = (W - G.gap * (G.cols - 1)) / G.cols;
    G.ch = G.cw * 0.7;
    G.ft = top + (mini ? 0 : 46);
    G.pitch = G.ch + G.gap;
    while (sim.off.length < G.cols) {
      sim.off.push(0);
      sim.vmul.push(1);
    }
    // loop
    G.lc = [w / 2, top + H * 0.53];
    G.lr = Math.min(w * 0.4, H * 0.42);
    // AICAS
    G.L = Math.min(w / 6.4, H * 0.2, 112);
    G.ly = top + H * 0.08 + G.L;
    // metro
    G.ry = top + H * (narrow ? 0.3 : 0.27);
    G.ns = clamp(Math.floor((w - 60) / (narrow ? 50 : 84)), 6, 10);
    G.sx = (k) => 30 + ((w - 60) * (k + 0.5)) / G.ns;
    G.sl = H * 0.12;
    // matrix
    G.S = Math.min(w - (narrow ? 70 : 150), H - (narrow ? 64 : 90), 540);
    G.mx = (w - G.S) / 2 + (narrow ? 14 : 20);
    G.my = top + (H - G.S) / 2 - 12;
    sprites.clear();
  }
  geom();

  // ── the feed ──
  const shiftOf = (c) => (c % 2) * G.ch * 0.46;
  const cardXY = (c, r) => [G.fx0 + c * (G.cw + G.gap), G.ft + r * G.pitch + shiftOf(c) - sim.off[c]];
  const idOf = (c, r) => c * 100000 + r + 50000;
  function visibleRows(c) {
    const r0 = Math.floor((sim.off[c] - shiftOf(c)) / G.pitch) - 1;
    const r1 = Math.ceil((sim.off[c] - shiftOf(c) + (G.bot - G.ft)) / G.pitch) + 1;
    return [r0, r1];
  }
  function pickFix(i) {
    const c = Math.floor(hash(i, 1) * G.cols);
    // a row whose card sits well inside the view
    const lo = Math.ceil((sim.off[c] - shiftOf(c) + G.ch * 0.2) / G.pitch);
    const hi = Math.floor((sim.off[c] - shiftOf(c) + (G.bot - G.ft) - G.ch * 1.6) / G.pitch);
    const r = lo + Math.floor(hash(i, 2) * Math.max(1, hi - lo + 1));
    return { c, r, u: 0.25 + hash(i, 5) * 0.5, v: 0.25 + hash(i, 6) * 0.45, d: 0, i };
  }

  function simStep(dt) {
    sim.t += dt;
    const sp = 96 * mix.speed;
    // a long look stops the scrolling under it (and so does the reader's own stare)
    const hold = sim.fix && durOf(sim.fi) > 1 ? sim.fix.c : -1;
    for (let c = 0; c < G.cols; c++) {
      sim.vmul[c] = approach(sim.vmul[c], (stare && stare.c === c) || hold === c ? 0 : 1, dt, 0.18);
      sim.off[c] += sp * sim.vmul[c] * dt;
    }
    if (!sim.fix) sim.fix = pickFix(0);
    sim.fix.d = sim.t - sim.fixT0;
    if (sim.fix.d > durOf(sim.fi)) {
      sim.hist.push(sim.fix);
      if (sim.hist.length > 5) sim.hist.shift();
      sim.fi++;
      sim.fixT0 = sim.t;
      sim.fix = pickFix(sim.fi);
    }
    if (mix.feed > 0.5) {
      const id = idOf(sim.fix.c, sim.fix.r);
      dwell.set(id, (dwell.get(id) || 0) + dt);
      if (stare) dwell.set(stare.id, (dwell.get(stare.id) || 0) + dt);
    }
    if (dwell.size > 160) dwell.delete(dwell.keys().next().value);
  }

  // one ad slot, drawn once in glyphs into a little sprite
  function sprite(v) {
    const { cw, ch } = G;
    const key = `${v}|${env.c.ink}|${env.dpr}`;
    let s = sprites.get(key);
    if (s) return s;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((cw + 6) * env.dpr);
    cv.height = Math.ceil((ch + 6) * env.dpr);
    const og = cv.getContext('2d');
    og.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    const keep = env.g;
    env.g = og;
    try {
      const { ascii, c } = env;
      const cell = env.mini ? 6 : 8;
      const x0 = 3;
      const y0 = 3;
      for (let x = x0; x <= x0 + cw + 0.1; x += cell) {
        ascii.glyph('-', x, y0, cell, c.ink, 0.7);
        ascii.glyph('-', x, y0 + ch, cell, c.ink, 0.7);
      }
      for (let y = y0 + cell; y < y0 + ch - 1; y += cell) {
        ascii.glyph('|', x0, y, cell, c.ink, 0.7);
        ascii.glyph('|', x0 + cw, y, cell, c.ink, 0.7);
      }
      // the "picture"
      const px = x0 + cell;
      const py = y0 + cell;
      const pw = cw - cell * 2;
      const ph = ch * 0.56;
      ascii.field(px, py, pw, ph, cell, (x, y) => {
        const u = (x - px) / pw - 0.5;
        const w2 = (y - py) / ph - 0.5;
        if (v === 0) return 0.95 - Math.hypot(u * 1.5, w2) * 1.6;
        if (v === 1) return ((x + y * 0.8) / cell) % 3 < 1.2 ? 0.55 : 0.12;
        if (v === 2) return Math.abs(u) < 0.12 + (w2 > -0.2 ? 0.1 : 0) && Math.abs(w2) < 0.42 ? 0.9 : 0.1;
        return 0.15 + (u + 0.5) * 0.7;
      }, c.ink, 0.85);
      // two lines of copy
      const ty = py + ph + cell * 0.9;
      for (let x = px; x < px + pw * 0.8; x += cell) ascii.glyph('=', x + cell / 2, ty, cell, c.ink, 0.7);
      if (ty + cell < y0 + ch - cell * 0.6) for (let x = px; x < px + pw * 0.5; x += cell) ascii.glyph('-', x + cell / 2, ty + cell, cell, c.ink, 0.6);
    } finally {
      env.g = keep;
    }
    s = cv;
    sprites.set(key, s);
    return s;
  }

  function cardAt(x, y) {
    for (let c = 0; c < G.cols; c++) {
      const [x0] = cardXY(c, 0);
      if (x < x0 || x > x0 + G.cw) continue;
      const r = Math.floor((y - G.ft - shiftOf(c) + sim.off[c]) / G.pitch);
      const [, y0] = cardXY(c, r);
      if (y >= y0 && y <= y0 + G.ch && y > G.ft && y < G.bot) return { c, r, id: idOf(c, r) };
    }
    return null;
  }

  // rounded speech bubble outline (centre x,y); tail -1 / 1 at the bottom
  function bubblePts(x, y, bw, bh, tail) {
    const rr = Math.min(10, bh * 0.4);
    const x0 = x - bw / 2;
    const x1 = x + bw / 2;
    const y0 = y - bh / 2;
    const y1 = y + bh / 2;
    const pts = [];
    const arc = (cx, cy, a0) => {
      for (let i = 0; i <= 3; i++) {
        const a = a0 + (i / 3) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
    };
    arc(x1 - rr, y0 + rr, -Math.PI / 2);
    arc(x1 - rr, y1 - rr, 0);
    if (tail) {
      const tx = x + tail * bw * 0.24;
      pts.push([tx + 5, y1], [tx + tail * 6, y1 + Math.min(10, bh * 0.35)], [tx - 5, y1]);
    }
    arc(x0 + rr, y1 - rr, Math.PI / 2);
    arc(x0 + rr, y0 + rr, Math.PI);
    pts.push(pts[0]);
    return pts;
  }
  function fillPts(pts, color, a) {
    const g = env.g;
    g.save();
    g.globalAlpha *= a;
    g.fillStyle = color;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.fill();
    g.restore();
  }
  function mono(str, x, y, size, color, a, align = 'left') {
    const wd = measure(str, 'mono', size, 500);
    env.ascii.text(str, align === 'center' ? x - wd / 2 : align === 'right' ? x - wd : x, y, size, color, a);
    return wd;
  }
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  function drawFeed(t, ph) {
    const { g, w, ink, c, mini } = env;
    const a = mix.feed;
    g.save();
    g.globalAlpha = a;
    g.save();
    g.beginPath();
    g.rect(0, G.ft - 4, w, G.bot - G.ft + 8);
    g.clip();
    const ticks = [];
    let n = 0;
    for (let col = 0; col < G.cols; col++) {
      const [r0, r1] = visibleRows(col);
      for (let r = r0; r <= r1; r++) {
        const [x, y] = cardXY(col, r);
        if (y > G.bot || y + G.ch < G.ft) continue;
        const id = idOf(col, r);
        const d = dwell.get(id) || 0;
        const mem = smooth((d - 0.9) / 0.8);
        if (mem > 0) ink.marker(x + 2, y + 2, G.cw - 4, G.ch - 4, { seed: id % 997, alpha: c.hlAlpha * mem });
        g.save();
        g.globalAlpha *= (env.mini ? 0.85 : 0.62) + 0.38 * mem;
        g.drawImage(sprite(Math.floor(hash(col, r) * 4)), x - 3, y - 3, G.cw + 6, G.ch + 6);
        g.restore();
        if (mem > 0.3 && !mini) ink.rect(x - 2, y - 2, G.cw + 4, G.ch + 4, { seed: id % 991, w: 1.2, alpha: mem, passes: 1 });
        if (d > 0.9 && !mini) {
          const lab = `${d.toFixed(1)} 秒`;
          const tw = measure(lab, 'mono', 13, 500);
          g.save();
          g.globalAlpha *= 0.9;
          g.fillStyle = c.sheet;
          g.fillRect(x + G.cw - tw - 12, y + G.ch - 24, tw + 8, 19);
          g.restore();
          ink.text(lab, x + G.cw - 8, y + G.ch - 10, { font: 'mono', size: 13, align: 'right' });
        }
        // the ticket: every fully visible slot is "viewable"
        if (mix.tick > 0.02 && y > G.ft && y + G.ch < G.bot) {
          const k = env.reduced || ph > 20 ? 1 : smooth((ph - 0.3 - n * 0.06) / 0.25);
          if (k > 0) ticks.push(x + G.cw - 18, y + 9, k);
          n++;
        }
      }
    }
    // ticks in one batch
    if (ticks.length) {
      g.save();
      g.strokeStyle = c.pencil;
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalAlpha *= mix.tick * 0.9;
      g.beginPath();
      for (let i = 0; i < ticks.length; i += 3) {
        const [x, y, k] = [ticks[i], ticks[i + 1], ticks[i + 2]];
        g.moveTo(x, y + 5);
        g.lineTo(x + 4 * Math.min(1, k * 2), y + 5 + 4 * Math.min(1, k * 2));
        if (k > 0.5) g.lineTo(x + 4 + 7 * (k - 0.5) * 2, y + 9 - 11 * (k - 0.5) * 2);
      }
      g.stroke();
      g.restore();
    }
    // the scanpath: fixations are circles sized by how long the eye stayed
    const path = [...sim.hist, sim.fix].filter(Boolean);
    let prev = null;
    path.forEach((f, i) => {
      const [x, y] = cardXY(f.c, f.r);
      const fx = x + f.u * G.cw;
      const fy = y + f.v * G.ch;
      const age = path.length - 1 - i;
      const fa = Math.max(0, 1 - age * 0.2);
      const rad = (mini ? 4 : 6) + (mini ? 7 : 13) * Math.sqrt(Math.min(f.d, 3.2));
      if (prev) ink.line(prev[0], prev[1], fx, fy, { seed: 300 + f.i, w: 1.1, alpha: fa * 0.8, passes: 1 });
      ink.circle(fx, fy, rad, { seed: 310 + f.i, w: age ? 1.2 : 1.8, alpha: fa });
      if (!age) ink.dot(fx, fy, 2.2, { seed: 320 });
      prev = [fx, fy];
    });
    // the reader's own gaze
    if (stare && !mini) {
      const d = dwell.get(stare.id) || 0;
      const { x, y } = env.pointer;
      ink.circle(x, y, 8 + 12 * Math.sqrt(Math.min(d, 4)), { seed: 330, w: 1.6 });
      const lab = `${d.toFixed(1)} 秒`;
      ink.text(lab, x + 16 + 12 * Math.sqrt(Math.min(d, 4)), y - 12, { font: 'mono', size: 14 });
    }
    g.restore();
    // header: what piles up vs what is actually looked at
    if (!mini) {
      const hy = G.top + 16;
      let imp = 0;
      for (let col = 0; col < G.cols; col++) imp += Math.max(0, Math.floor((sim.off[col] - shiftOf(col) + (G.bot - G.ft)) / G.pitch) + 1);
      let att = 0;
      dwell.forEach((d) => d >= 1 && (att += d));
      const fs = G.narrow ? 13 : 15;
      if (mix.tick < 0.5) {
        const x1 = G.fx0;
        const l1 = `曝光 ×${fmt(imp)}`;
        mono(l1, x1, hy, fs, c.ink, 1 - mix.tick * 2);
        const l2 = `看進去 ${att.toFixed(1)} 秒`;
        const x2 = x1 + measure(l1, 'mono', fs, 500) + 26;
        ink.marker(x2 - 5, hy - fs * 0.7, measure(l2, 'mono', fs, 500) + 10, fs * 1.4, { seed: 340, alpha: c.hlAlpha * (1 - mix.tick * 2) });
        mono(l2, x2, hy, fs, c.ink, 1 - mix.tick * 2);
        ink.text('示意', w - G.fx0, hy + 5, { size: 13, align: 'right', color: c.ink2, alpha: 1 - mix.tick * 2 });
      } else {
        // legend: ticket vs asset
        const k = (mix.tick - 0.5) * 2;
        g.save();
        g.globalAlpha *= k;
        const x1 = G.fx0 + 2;
        ink.path([[x1, hy - 2], [x1 + 4, hy + 2], [x1 + 12, hy - 8]], { seed: 350, w: 1.6 });
        ink.text('可視＝門票', x1 + 20, hy + 5, { size: fs + 1 });
        const x2 = x1 + 20 + measure('可視＝門票', 'hand', fs + 1) + 30;
        ink.circle(x2 + 7, hy - 1, 8, { seed: 351, w: 1.3 });
        ink.text('注視秒數＝資產', x2 + 22, hy + 5, { size: fs + 1 });
        ink.text('示意', w - G.fx0, hy + 5, { size: 13, align: 'right', color: c.ink2 });
        if (!G.narrow) ink.text('秒數更能預測回想', w - G.fx0 - 44, hy + 5, { size: 13, align: 'right', color: c.ink2 });
        g.restore();
      }
    }
    g.restore();
  }

  // ── The Doom Loop ──
  function drawLoop(t) {
    const { g, w, ink, ascii, c } = env;
    const a = mix.loop;
    const [cx, cy] = G.lc;
    const R = G.lr;
    const turns = 2.4;
    const at = (s) => {
      const th = -Math.PI / 2 + s * turns * Math.PI * 2;
      const r = R * (1 - 0.86 * s);
      return [cx + Math.cos(th) * r, cy + Math.sin(th) * r, th];
    };
    g.save();
    g.globalAlpha = a;
    const pts = [];
    for (let i = 0; i <= 140; i++) pts.push(at(i / 140));
    ink.path(pts.map((p) => [p[0], p[1]]), { seed: 400, w: 1.3 });
    // arrowheads: the loop only goes one way, inward
    [0.18, 0.52, 0.8].forEach((sa, i) => {
      const [x1, y1] = at(sa);
      const [x2, y2] = at(sa + 0.012);
      const an = Math.atan2(y2 - y1, x2 - x1);
      ink.line(x2, y2, x2 - Math.cos(an - 0.5) * 10, y2 - Math.sin(an - 0.5) * 10, { seed: 401 + i, w: 1.3 });
      ink.line(x2, y2, x2 - Math.cos(an + 0.5) * 10, y2 - Math.sin(an + 0.5) * 10, { seed: 404 + i, w: 1.3 });
    });
    // items flow inward along the loop: bars (reports) grow, the name (brand) shrinks
    const K = 26;
    const flow = (t * 0.018) % (1 / K);
    const cell = G.narrow ? 8 : 10;
    for (let i = 0; i < K; i++) {
      const s = i / K + flow;
      if (s > 0.98) continue;
      const [x, y] = at(s);
      const fade = smooth(s / 0.04) * (1 - smooth((s - 0.9) / 0.08));
      if (i % 2 === 0) {
        const n = Math.max(1, Math.round((1 + s * 8) * (G.narrow ? 0.7 : 1)));
        for (let j = 0; j < n; j++) {
          ascii.glyph('#', x - cell * 0.45, y - 6 - j * cell * 0.85, cell, c.ink, fade);
          ascii.glyph('#', x + cell * 0.45, y - 6 - j * cell * 0.85, cell, c.ink, fade);
        }
      } else {
        const size = Math.round(lerp(G.narrow ? 20 : 28, 6, Math.pow(s, 0.8)));
        ink.text('品牌', x, y + size * 0.36, { size, align: 'center', alpha: fade * (1 - s * 0.75), rotate: 0 });
      }
    }
    // labels
    if (!env.mini) {
      const fs = G.narrow ? 15 : 18;
      const ly = G.top + 18;
      ink.text('成效越優化', G.fx0, ly, { size: fs });
      ink.text('報表越來越漂亮', G.fx0, ly + 22, { size: 13, color: c.ink2 });
      for (let j = 0; j < 4; j++) ascii.glyph('#', G.fx0 + measure('成效越優化', 'hand', fs) + 14, ly - j * 7, 7, c.ink, 0.85);
      ink.text('品牌越萎縮', w - G.fx0, ly, { size: fs, align: 'right' });
      ink.text('指名度下滑', w - G.fx0, ly + 22, { size: 13, align: 'right', color: c.ink2 });
    }
    g.restore();
  }

  // ── AISAS → AICAS ──
  function drawAicas(t, ph) {
    const { g, w, ink, ascii, c } = env;
    const a = mix.aicas;
    const L = G.L;
    const mt = smooth((ph - 0.9) / 0.7);
    const sp = L * 1.02;
    const x0 = w / 2 - sp * 2;
    const by = G.ly;
    g.save();
    g.globalAlpha = a;
    OLD.forEach((ch, i) => {
      const x = x0 + i * sp;
      const changed = OLD[i] !== NEW[i] || i === 0;
      const bump = changed ? Math.sin(mt * Math.PI) : 0;
      if (changed && mt > 0.6) ink.marker(x - L * 0.38, by - L * 0.74, L * 0.76, L * 0.8, { seed: 410 + i, alpha: c.hlAlpha * smooth((mt - 0.6) / 0.4) });
      const letter = changed && mt > 0.5 ? NEW[i] : ch;
      ink.text(letter, x, by, { font: 'latin', size: L, weight: 700, align: 'center', alpha: 1 - bump });
      if (bump > 0.02) {
        const cell = Math.max(8, L / 7);
        for (let yy = by - L * 0.72; yy < by; yy += cell) {
          for (let xx = x - L * 0.36; xx < x + L * 0.36; xx += cell) {
            const q = hash(Math.round(xx), Math.round(yy), env.boil);
            if (q < 0.45) ascii.glyph(randomGlyph(q * 2), xx + cell / 2, yy + cell / 2, cell, c.ink, bump * 0.9);
          }
        }
      }
    });
    mono(mt > 0.5 ? 'AISAS → AICAS' : 'AISAS', x0 - L * 0.4, by - L - 12, G.narrow ? 13 : 14, c.ink2, 1);
    // the first letter changes meaning
    const fs = G.narrow ? 13 : 15;
    const lx = x0;
    const ly = by + (G.narrow ? 22 : 30);
    const oa = 1 - smooth((mt - 0.5) * 3) * 0.55;
    ink.text('Attention', lx, ly, { font: 'latin', size: fs, align: 'center', alpha: oa });
    ink.text('被動接收', lx, ly + 19, { size: 13, align: 'center', color: c.ink2, alpha: oa });
    if (mt > 0.5) {
      const k = smooth((mt - 0.5) * 2);
      const tw = measure('Attention', 'latin', fs);
      ink.line(lx - tw / 2 - 3, ly - fs * 0.32, lx - tw / 2 - 3 + (tw + 6) * k, ly - fs * 0.36, { seed: 420, w: 1.4 });
      const [ax0, ay0] = G.narrow ? [lx + tw / 2 + 44, ly] : [lx, ly + 44];
      ink.text('Ask', ax0, ay0, { font: 'latin', size: fs + 3, weight: 700, align: 'center', alpha: k });
      ink.text('主動發出', ax0, ay0 + 19, { size: 13, align: 'center', alpha: k });
      if (G.narrow) ink.arrow(lx + tw / 2 + 6, ly - 5, ax0 - 18, ly - 5, { seed: 421, w: 1, head: 5, alpha: k });
    }
    // what Ask does to a brand without citable content (示意)
    const fy = G.top + G.H * (G.narrow ? 0.64 : 0.7);
    const qfs = G.narrow ? 13 : 16;
    const q = '哪個品牌適合我？';
    const qw = measure(q, 'hand', qfs) + 20;
    const qx = Math.max(qw / 2 + 8, w * 0.22);
    const pts = bubblePts(qx, fy, qw, qfs + 18, 1);
    fillPts(pts, c.sheet, 0.85);
    ink.path(pts, { seed: 430, w: 1.2 });
    ink.text(q, qx, fy + qfs * 0.36, { size: qfs, align: 'center' });
    if (mt > 0.5) {
      const ax1 = G.narrow ? lx + measure('Attention', 'latin', fs) / 2 + 44 : lx;
      const ay1 = G.narrow ? ly + 28 : ly + 72;
      ink.arrow(ax1, ay1, qx - qw * 0.1, fy - (qfs + 18) / 2 - 4, { seed: 431, w: 1, head: 6, alpha: smooth((mt - 0.5) * 2) * 0.8 });
    }
    // the AI in the middle
    const ax = w * 0.5 + (G.narrow ? 6 : 0);
    const ar = G.narrow ? 22 : 34;
    ascii.field(ax - ar, fy - ar, ar * 2, ar * 2, G.narrow ? 7 : 8, (x, y) => {
      const d = Math.hypot(x - ax, y - fy) / ar;
      return d < 1 ? 0.25 + 0.6 * (1 - d) + 0.1 * Math.sin(t * 3 + x * 0.2) : -1;
    }, c.ink, 0.9);
    ink.arrow(qx + qw / 2 + 6, fy, ax - ar - 8, fy, { seed: 432, w: 1, head: 6 });
    // the answer: two brands with something citable
    const rx = Math.min(w - 16 - (G.narrow ? 70 : 96), w * 0.72);
    ink.arrow(ax + ar + 8, fy, rx - 10, fy, { seed: 433, w: 1, head: 6 });
    ink.text('答案', rx, fy - (G.narrow ? 22 : 28), { size: 13, color: c.ink2 });
    ['品牌 A', '品牌 B'].forEach((b, i) => {
      const yy = fy - 4 + i * (G.narrow ? 20 : 24);
      ink.text(b, rx, yy, { size: qfs - 1 });
      mono(`[${i + 1}]`, rx + measure(b, 'hand', qfs - 1) + 6, yy - 5, 13, c.ink2, 1);
    });
    // the third brand never makes it to the comparison
    const fall = env.reduced || ph > 20 ? 1 : smooth((ph - 1.8) / 1.1);
    const bx = G.narrow ? lerp(ax, ax - 30, fall) : lerp(ax + ar * 1.6, ax + ar * 2.2, fall);
    const byy = lerp(fy + ar + 16, fy + ar + (G.narrow ? 30 : 66), fall);
    const bw = measure('品牌 C', 'hand', qfs - 1) + 16;
    g.save();
    g.translate(bx, byy);
    g.rotate(0.25 * fall);
    g.setLineDash([4, 4]);
    ink.rect(-bw / 2, -13, bw, 24, { seed: 434, w: 1, alpha: 0.8, passes: 1 });
    g.setLineDash([]);
    ink.text('品牌 C', 0, 4, { size: qfs - 1, align: 'center', alpha: 0.75 });
    g.restore();
    if (fall > 0.5) {
      const k = smooth((fall - 0.5) * 2);
      if (G.narrow) {
        ink.text('沒有可被引用的內容', bx + bw / 2 + 12, byy + 4, { size: 13, alpha: k });
        ink.text('還沒進入比較，就被排除在答案之外', w / 2, byy + 34, { size: 13, align: 'center', color: c.ink2, alpha: k });
      } else {
        const tx = Math.min(bx + bw / 2 + 16, w - 12 - measure('還沒進入比較，就被排除在答案之外', 'hand', 13));
        ink.text('沒有可被引用的內容', tx, byy - 4, { size: 14, alpha: k });
        ink.text('還沒進入比較，就被排除在答案之外', tx, byy + 15, { size: 13, color: c.ink2, alpha: k });
      }
    }
    ink.text('示意', w - 14, G.narrow ? G.top + 10 : G.bot - 4, { size: 13, align: 'right', color: c.ink2 });
    g.restore();
  }

  // ── CeraVe: media as an experience ──
  function drawMetro(t, ph) {
    const { g, w, ink, ascii, c } = env;
    const a = mix.metro;
    const { ry, ns, sl } = G;
    g.save();
    g.globalAlpha = a;
    // the grab rail, held up from the ceiling
    ink.line(18, ry, w - 18, ry, { seed: 500, w: 1.6 });
    ink.line(18, ry + 5, w - 18, ry + 5, { seed: 501, w: 1, alpha: 0.6 });
    [0.1, 0.5, 0.9].forEach((k, i) => ink.line(w * k, ry, w * k, ry - (G.narrow ? 18 : 28), { seed: 502 + i, w: 1.2 }));
    // who takes what, and when: a stateless schedule, so any frame can be drawn on its own
    const every = 0.55;
    const events = [];
    const jNow = Math.floor((ph - 0.3) / every);
    for (let j = Math.max(0, jNow - 8); j <= jNow; j++) events.push({ k: Math.floor(hash(j, 11) * ns), t0: 0.3 + j * every, j });
    for (const u of userTakes) if (t - u.t0 < 4) events.push({ k: u.k, t0: ph - (t - u.t0), j: 1000 + u.k, user: true });
    const takenAt = new Array(ns).fill(-1);
    const busy = new Array(ns).fill(null);
    const bubbles = [];
    for (const e of events) {
      const age = ph - e.t0;
      if (age < 0 || age > 3.8) continue;
      if (age > 0.6) takenAt[e.k] = takenAt[e.k] < 0 ? age - 0.6 : Math.min(takenAt[e.k], age - 0.6);
      if (age < 1.4 && (!busy[e.k] || e.user)) busy[e.k] = e;
      if (age > 1.2) bubbles.push(e);
    }
    // straps and bottles
    const bottleAt = (k) => {
      const an = Math.sin(t * 1.4 + k * 1.7) * 0.05;
      return [G.sx(k) + Math.sin(an) * sl, ry + 5 + Math.cos(an) * sl, an];
    };
    for (let k = 0; k < ns; k++) {
      const [x, y, an] = bottleAt(k);
      ink.line(G.sx(k), ry + 5, x, y - 12, { seed: 510 + k, w: 1.2 });
      ink.path([[x, y - 12], [x - 10, y + 5], [x + 10, y + 5], [x, y - 12]], { seed: 530 + k, w: 1.3 });
      const gone = takenAt[k];
      if (gone < 0 || gone > 2.4) {
        // a 30 ml bottle: highlighter body, pencil outline
        g.save();
        g.translate(x, y + 9);
        g.rotate(an);
        ink.marker(-6, 6, 12, 20, { seed: 550 + k });
        ink.rect(-6, 6, 12, 20, { seed: 560 + k, w: 1, passes: 1 });
        ink.rect(-3, 1, 6, 5, { seed: 570 + k, w: 1, passes: 1 });
        g.restore();
      }
    }
    // passengers under the straps; whoever is up next reaches for a bottle
    const hr = G.narrow ? 8 : 12;
    for (let k = 0; k < ns; k++) {
      const hx = G.sx(k) + (hash(k, 21) - 0.5) * 18;
      const hy = G.top + G.H * 0.77 + (hash(k, 22) - 0.5) * 22;
      ink.circle(hx, hy, hr, { seed: 580 + k, w: 1.2, passes: 1 });
      ink.path([[hx - hr * 2.3, hy + hr * 4.2], [hx - hr * 2, hy + hr * 2.4], [hx - hr * 0.8, hy + hr * 1.5], [hx + hr * 0.8, hy + hr * 1.5], [hx + hr * 2, hy + hr * 2.4], [hx + hr * 2.3, hy + hr * 4.2]], { seed: 600 + k, w: 1.2, passes: 1 });
      const e = busy[k];
      if (!e) continue;
      const age = ph - e.t0;
      const [bx, by] = bottleAt(k);
      const side = hash(k, 23) < 0.5 ? -1 : 1;
      const shx = hx + side * hr * 1.6;
      const shy = hy + hr * 1.9;
      const reach = age < 0.6 ? smooth(age / 0.6) : 1 - smooth((age - 0.7) / 0.6);
      const rest = [hx + side * hr * 0.6, hy - hr * 1.2];
      const hx2 = lerp(rest[0], bx, reach);
      const hy2 = lerp(rest[1], by + 30, reach);
      const ex = (shx + hx2) / 2 + side * hr * 1.4;
      const ey = (shy + hy2) / 2 + hr * 0.6;
      ink.path([[shx, shy], [ex, ey], [hx2, hy2]], { seed: 620 + (e.j % 40), w: 1.6 });
      ink.circle(hx2, hy2, 4.5, { seed: 660 + (e.j % 40), w: 1.1, passes: 1 });
      if (age > 0.6) {
        ink.marker(hx2 - 5, hy2 - 21, 10, 17, { seed: 700 + (e.j % 30) });
        ink.rect(hx2 - 5, hy2 - 21, 10, 17, { seed: 720 + (e.j % 30), w: 1, passes: 1 });
      }
    }
    // talk rises: every bottle taken becomes a post
    for (const e of bubbles) {
      const age = ph - e.t0 - 1.2;
      if (age > 2.4) continue;
      const k = age / 2.4;
      const hx = G.sx(e.k) + (hash(e.k, 21) - 0.5) * 18;
      const hy = G.top + G.H * 0.77 + (hash(e.k, 22) - 0.5) * 22;
      const x = hx + (hash(e.j, 13) - 0.5) * 30 + Math.sin(age * 2 + e.j) * 5;
      const y = lerp(hy - hr - 22, ry + sl + 64, smooth(k));
      const bw = e.user ? 46 : 38;
      const pts = bubblePts(x, y, bw, bw * 0.58, hash(e.j, 14) < 0.5 ? -1 : 1);
      const ba = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.95;
      fillPts(pts, c.sheet, ba * 0.85);
      ink.path(pts, { seed: 800 + (e.j % 40), w: 1, alpha: ba, passes: 1 });
      ascii.text('···', x - bw * 0.24, y, 10, c.ink, ba);
    }
    // the count: one day of posts
    if (!env.mini) {
      const n = env.reduced || ph > 20 ? 24000 : 24000 * smooth((ph - 0.3) / 3.4);
      const fs = G.narrow ? 22 : 30;
      const lab = n >= 10000 ? `${(Math.floor(n / 1000) / 10).toFixed(1)} 萬` : fmt(n);
      const ly = G.top + 4 + fs * 0.7;
      const tw = measure(lab, 'mono', fs, 500);
      ink.marker(G.fx0 - 4, ly - fs * 0.85, tw + 10, fs * 1.15, { seed: 900 });
      ink.text(lab, G.fx0, ly, { font: 'mono', size: fs, weight: 500 });
      ink.text('篇社群討論，單日', G.fx0 + tw + 12, ly - 2, { size: G.narrow ? 14 : 17 });
      const cap = 'CeraVe：上萬份 30ml 潔膚露掛上捷運吊環，乘客伸手就帶走';
      const cfs = G.narrow ? 13 : 15;
      ink.wrap(cap, w - G.fx0 * 2, { size: cfs }).forEach((l, i) => ink.text(l, G.fx0, ly + 26 + i * (cfs + 6), { size: cfs, color: c.ink2 }));
    }
    g.restore();
  }

  // ── the media matrix ──
  function drawMatrix(t) {
    const { g, ink, c, pointer } = env;
    const a = mix.matrix;
    const { S, mx, my } = G;
    g.save();
    g.globalAlpha = a;
    const items = ART.framework.items.map(([name, desc]) => {
      const [cond, act] = desc.split('——');
      return { name, cond, act, col: cond.includes('需求一致') ? 1 : 0, row: cond.includes('易證明') ? 1 : 0 };
    });
    // which cell is looked at: the reader's pointer, or a slow tour
    let on = -1;
    if (pointer.in) {
      const cx = Math.floor((pointer.x - mx) / (S / 2));
      const cy = Math.floor((pointer.y - my) / (S / 2));
      if (cx >= 0 && cx < 2 && cy >= 0 && cy < 2) on = items.findIndex((it) => it.col === cx && it.row === cy);
    }
    if (on < 0) on = [0, 1, 3, 2][Math.floor(t / 2.4) % 4];
    items.forEach((it, i) => {
      const x = mx + it.col * (S / 2);
      const y = my + it.row * (S / 2);
      if (i === on) ink.marker(x + 8, y + 8, S / 2 - 16, S / 2 - 16, { seed: 950 + i, alpha: c.hlAlpha * 0.8 });
      const fs = G.narrow ? 17 : 22;
      ink.text(it.name, x + S / 4, y + S / 4 + (G.narrow ? 6 : -10), { size: fs, align: 'center', weight: 700 });
      const lines = G.narrow ? [] : ink.wrap(it.act, S / 2 - 30, { size: 13 });
      lines.slice(0, 3).forEach((l, j) => ink.text(l, x + S / 4, y + S / 4 + 18 + j * 18, { size: 13, align: 'center', color: c.ink2 }));
    });
    // the cross and the axes
    ink.line(mx + S / 2, my - 4, mx + S / 2, my + S + 4, { seed: 960, w: 1.2 });
    ink.line(mx - 4, my + S / 2, mx + S + 4, my + S / 2, { seed: 961, w: 1.2 });
    ink.rect(mx, my, S, S, { seed: 962, w: 1, alpha: 0.5, passes: 1 });
    const fs = G.narrow ? 13 : 15;
    ink.text('需求分歧', mx + S / 4, my + S + 22, { size: fs, align: 'center' });
    ink.text('需求一致', mx + (S * 3) / 4, my + S + 22, { size: fs, align: 'center' });
    ink.text('消費者問題一致性', mx + S / 2, my + S + 42, { size: 13, align: 'center', color: c.ink2 });
    ink.text('主張難證明', mx - 12, my + S / 4, { size: fs, align: 'center', rotate: -Math.PI / 2 });
    ink.text('主張易證明', mx - 12, my + (S * 3) / 4, { size: fs, align: 'center', rotate: -Math.PI / 2 });
    if (!G.narrow) ink.text('主張驗證門檻', mx - 34, my + S / 2, { size: 13, align: 'center', color: c.ink2, rotate: -Math.PI / 2 });
    g.restore();
  }

  return {
    resize: geom,
    warm(sec) {
      for (let k = 0; k < sec; k += 1 / 30) simStep(1 / 30);
    },
    click(x) {
      if (mix.metro > 0.5) {
        const k = clamp(Math.floor(((x - 30) / (env.w - 60)) * G.ns), 0, G.ns - 1);
        userTakes.push({ k, t0: env.t });
        if (userTakes.length > 6) userTakes.shift();
      }
    },
    frame(t, dt) {
      const { w, pointer, mini } = env;
      const s = mini ? 0 : env.step;
      const still = dt === 0 || env.reduced;
      const ph = still ? 30 : t - env.stepAt;
      const want = {
        feed: s === 0 || s === 2 ? 1 : 0,
        speed: s === 0 ? 1 : 0,
        tick: s === 2 ? 1 : 0,
        loop: s === 1 ? 1 : 0,
        aicas: s === 3 ? 1 : 0,
        metro: s === 4 ? 1 : 0,
        matrix: s === 5 ? 1 : 0,
      };
      for (const k in mix) mix[k] = dt > 0 ? approach(mix[k], want[k], dt, k === 'speed' ? 0.6 : 0.4) : want[k];

      // the reader stares at a slot
      stare = null;
      if (pointer.in && mix.feed > 0.5 && !mini) {
        const hit = cardAt(pointer.x, pointer.y);
        if (hit) stare = hit;
      }
      // hovering a strap reaches for it
      if (pointer.in && mix.metro > 0.5 && dt > 0 && pointer.y > G.ry) {
        const k = clamp(Math.floor(((pointer.x - 30) / (w - 60)) * G.ns), 0, G.ns - 1);
        if (!userTakes.some((u) => u.k === k && t - u.t0 < 3)) userTakes.push({ k, t0: t });
        if (userTakes.length > 8) userTakes.shift();
      }
      if (dt > 0) simStep(dt);

      if (mix.feed > 0.02) drawFeed(t, ph);
      if (mix.loop > 0.02 && !mini) drawLoop(t);
      if (mix.aicas > 0.02 && !mini) drawAicas(t, ph);
      if (mix.metro > 0.02 && !mini) drawMetro(t, ph);
      if (mix.matrix > 0.02 && !mini) drawMatrix(t);
    },
  };
}
