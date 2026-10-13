// 19 GEO 時代 — AI is only a mirror: whatever the brand feeds it, it hands back.
// step 0  a reader takes the AI answer, then walks off to Dcard / Threads / PTT to look for the flaws
// step 1  AI 只是鏡子: a spec sheet in front of a glyph mirror comes back as rows of the same grey
// step 2  《超完美嬌妻》: identical glyph faces that all say 修護、保濕、抗老 — efficient invisibility
// step 3  從關鍵字到語境: 「抗老精華」 gives way to 「最近熬夜膚況變差怎麼辦？」 and the 7W radar fills
// step 4  新指標: is the brand the answer? citation share, where citations come from, time to first citation
// step 5  i-Proof: five stairs up to a person who either walks off to the forums or remembers the brand
// Click: swap the brand's content (標準公版 ↔ 生活情境) and watch what comes back.
import { hash, lerp, approach, clamp, noise3, easeInOut } from '../engine/noise.js';

export const hint = '換一種內容照照看';

// which content each step starts with: the problem first, the way out last
const START = [0, 0, 0, 1, 0, 1];
const W7 = [
  ['Why', '動機'],
  ['What with', '搭配'],
  ['When', '時機'],
  ['For whom', '對象'],
  ['Where', '地點'],
  ['How feeling', '情緒'],
  ['While', '同時情境'],
];
// radar shape for each kind of content (illustration only)
const R_FLAT = [0.18, 0.42, 0.14, 0.12, 0.16, 0.1, 0.12];
const R_WARM = [0.8, 0.52, 0.92, 0.62, 0.58, 0.95, 0.74];
const SOURCES = ['官網', '媒體', '論壇', '社群', '影音'];
const S_FLAT = [0.72, 0.12, 0.06, 0.06, 0.04];
const S_WARM = [0.26, 0.2, 0.2, 0.2, 0.14];
const STAIRS = [
  ['01 可抓取 & 可拆解', 'Crawlability & Chunkability'],
  ['02 可教化的答案內容', 'LLM-Teachable Content'],
  ['03 AI 答案能見度', 'AI Answer Visibility'],
  ['04 實體與信任圖譜', 'Entity & Trust Graph'],
  ['05 持續量測', 'Always-on Measurement'],
];
const FORUMS = ['Dcard', 'Threads', 'PTT'];
const REMEMBER = '專為熬夜上班族設計的急救精華';

export default function make(env) {
  const { ink, ascii } = env;
  const mix = [1, 0, 0, 0, 0, 0];
  const t0 = [0, 0, 0, 0, 0, 0];
  let cur = -1;
  let G = {};
  let warm = 0; // 0 = 標準公版, 1 = 生活情境
  let wv = 0;

  function geom() {
    const { w, h, mini } = env;
    const pad = mini ? 10 : w < 520 ? 16 : 28;
    const top = mini ? 8 : 44;
    const bot = mini ? h - 8 : h - 60;
    const B = { x: pad, y: top, w: w - pad * 2, h: bot - top };
    // content sits under the little content switch
    const C = mini ? B : { x: B.x, y: B.y + 34, w: B.w, h: B.h - 34 };
    G = { w, h, B, C, cx: w / 2, cy: C.y + C.h / 2, narrow: w < 560, tall: C.h > C.w * 0.95 };
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
    g.globalAlpha = 0.88 * a;
    g.fillStyle = env.c.sheet;
    g.fillRect(x, y, w, h);
    g.restore();
    ink.rect(x, y, w, h, { seed, alpha: 0.85 * a, w: 1.1, passes: 1 });
  }
  // a pencil reader, standing or walking (feet at y, height s, gait phase ph)
  function walker(x, y, s, ph, moving, a, seed = 1) {
    const sw = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.cos(ph)) * s * 0.02 : 0;
    const hy = y - s * 0.86 - bob;
    const hip = [x, y - s * 0.42 - bob];
    const neck = [x + (moving ? s * 0.03 : 0), y - s * 0.74 - bob];
    ink.circle(neck[0], hy, s * 0.1, { seed, alpha: 0.9 * a, w: 1.4 });
    ink.line(neck[0], neck[1], hip[0], hip[1], { seed: seed + 1, alpha: 0.9 * a, w: 1.4 });
    ink.path([[hip[0] + sw * s * 0.14, y], [hip[0] + sw * s * 0.06, y - s * 0.2], hip], { seed: seed + 2, alpha: 0.9 * a, w: 1.4 });
    ink.path([[hip[0] - sw * s * 0.14, y], [hip[0] - sw * s * 0.04, y - s * 0.2], hip], { seed: seed + 3, alpha: 0.9 * a, w: 1.4 });
    const sh = [neck[0], neck[1] + s * 0.06];
    ink.path([sh, [sh[0] - sw * s * 0.1 - (moving ? 0 : s * 0.05), sh[1] + s * 0.14], [sh[0] - sw * s * 0.14 + (moving ? 0 : s * 0.04), sh[1] + s * 0.27]], { seed: seed + 4, alpha: 0.85 * a, w: 1.3 });
    ink.path([sh, [sh[0] + sw * s * 0.1 + (moving ? 0 : s * 0.08), sh[1] + s * 0.12], [sh[0] + sw * s * 0.14 + (moving ? 0 : s * 0.16), sh[1] + s * 0.06]], { seed: seed + 5, alpha: 0.85 * a, w: 1.3 });
  }
  // a thought bubble (pencil ellipse + two little puffs toward the head)
  function bubble(x, y, lines, size, a, seed, tx, ty, hl = false) {
    const wMax = Math.max(...lines.map((l) => tw(l, size)));
    const rw = wMax / 2 + 20;
    const rh = (lines.length * size * 1.4) / 2 + 14;
    const g = env.g;
    g.save();
    g.globalAlpha = 0.85 * a;
    g.fillStyle = env.c.sheet;
    g.beginPath();
    g.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const k = (i / 28) * Math.PI * 2.05;
      pts.push([x + Math.cos(k) * rw, y + Math.sin(k) * rh]);
    }
    ink.path(pts, { seed, alpha: 0.8 * a, w: 1.1 });
    ink.circle(lerp(x, tx, 0.62), lerp(y + rh * 0.7, ty, 0.62), 4, { seed: seed + 1, alpha: 0.7 * a, w: 1 });
    ink.circle(lerp(x, tx, 0.84), lerp(y + rh * 0.7, ty, 0.84), 2.5, { seed: seed + 2, alpha: 0.7 * a, w: 1 });
    lines.forEach((l, i) => {
      const ly = y - ((lines.length - 1) * size * 1.4) / 2 + i * size * 1.4 + size * 0.35;
      if (hl) tag(l, x, ly, size, a, { align: 'center', seed: seed + 3 + i });
      else ink.text(l, x, ly, { size, align: 'center', alpha: a });
    });
  }
  // a run of glyphs that reads like machine text
  function glyphLine(x, y, len, cell, a, seed, dens = 0.5, gaps = 0.14) {
    const n = Math.max(1, Math.floor(len / (cell * 0.8)));
    for (let i = 0; i < n; i++) {
      const hv = hash(seed, i);
      if (hv < gaps) continue;
      ascii.glyph(clamp(dens + (hv - 0.5) * 0.3, 0.1, 0.99), x + i * cell * 0.8 + cell / 2, y, cell, env.c.ink, a);
    }
  }
  const wrap2 = (s, size, maxW) => (tw(s, size) > maxW ? [s.slice(0, Math.ceil(s.length / 2)), s.slice(Math.ceil(s.length / 2))] : [s]);

  // ── the content switch (top left): 標準公版 | 生活情境 ──
  function contentSwitch(a) {
    const { c } = env;
    const { B } = G;
    const fs = G.narrow ? 13 : 14;
    const x = B.x;
    const y = B.y + 14;
    const l1 = '標準公版';
    const l2 = '生活情境';
    const w1 = tw(l1, fs);
    const w2 = tw(l2, fs);
    ink.text('品牌內容', x, y, { size: 13, color: c.ink2, alpha: a });
    const x1 = x + tw('品牌內容', 13) + 14;
    const x2 = x1 + w1 + 40;
    ink.marker(lerp(x1, x2, wv) - 6, y - fs, lerp(w1, w2, wv) + 12, fs * 1.4, { seed: 7, alpha: c.hlAlpha * a });
    ink.text(l1, x1, y, { size: fs, alpha: a * (1 - wv * 0.5) });
    ink.text('⇄', x1 + w1 + 20, y, { size: fs, align: 'center', color: c.ink2, alpha: a });
    ink.text(l2, x2, y, { size: fs, alpha: a * (0.5 + wv * 0.5) });
  }

  // ── step 0: AI answer → the forums ──
  function scene0(a, T, still) {
    const { c, mini } = env;
    const { C, narrow } = G;
    const u = clamp(Math.min(C.w / 700, C.h / 440), 0.42, 1.4);
    const cw = clamp(260 * u, 110, 340);
    const ch = clamp(176 * u, 80, 230);
    const s = clamp(130 * u, 56, 180);
    const small = mini || narrow;
    const bfs = mini ? 12 : clamp(15 * u, 13, 17);
    const postH = Math.max(clamp(180 * u, 80, 240), s * 1.08 + 3 * (bfs + 14));
    // the whole group sits in the middle of the space above the caption
    const H0 = Math.max(ch + 40 * u, postH);
    const gy = mini ? C.y + C.h - 6 : C.y + (C.h - 30 + H0) / 2;
    const cx0 = C.x + (mini ? 0 : C.w * 0.02);
    const cy0 = gy - ch - (mini ? 26 : 40 * u);
    const postX = C.x + C.w - (small ? 8 : 70 * u);
    const atCard = cx0 + cw + s * 0.35;
    const atForum = postX - s * 0.55;
    // the AI answer: a card of glyph lines
    card(cx0, cy0, cw, ch, a, 11);
    ink.text(mini ? 'AI 推薦' : 'AI 整理的推薦', cx0 + 14, cy0 + (mini ? 18 : 26), { size: mini ? 13 : 15, alpha: a });
    const cell = clamp(10 * u, 5, 11);
    const rows = mini ? 3 : 4;
    for (let i = 0; i < rows; i++) {
      const y = cy0 + (mini ? 36 : 52 * u + 6) + i * ((ch - (mini ? 44 : 64 * u)) / rows);
      ascii.glyph('>', cx0 + 18, y, cell, c.ink, a);
      if (i === 1 && wv > 0.02) ink.marker(cx0 + 26, y - cell * 0.7, (cw - 50) * 0.8, cell * 1.4, { seed: 12, alpha: c.hlAlpha * a * wv });
      glyphLine(cx0 + 28, y, (cw - 50) * (0.55 + hash(i, 3) * 0.4), cell, a, 20 + i, 0.5);
    }
    // the ground and the forum signpost
    ink.line(C.x, gy, C.x + C.w, gy, { seed: 13, alpha: 0.5 * a, w: 1 });
    const fA = a * (1 - wv * 0.55);
    ink.line(postX, gy, postX, gy - postH, { seed: 14, alpha: 0.9 * fA, w: 1.5 });
    FORUMS.forEach((f, i) => {
      const fs = bfs;
      const bw = tw(f, fs, 'latin') + 22;
      const by = gy - postH + 6 + i * (fs + 14);
      const dir = small || i % 2 === 0 ? -1 : 1;
      const bx = dir > 0 ? postX : postX - bw;
      ink.poly([[bx, by], [bx + bw, by], [bx + bw + dir * 8 * (dir > 0 ? 1 : 0), by + (fs + 8) / 2], [bx + bw, by + fs + 8], [bx, by + fs + 8], [bx - (dir < 0 ? 8 : 0), by + (fs + 8) / 2]], { seed: 15 + i, alpha: 0.8 * fA, w: 1.1, closed: true });
      ink.text(f, bx + bw / 2, by + fs + 1, { font: 'latin', size: fs, weight: 500, align: 'center', alpha: fA });
    });
    // the reader: reads, then walks off to look for the flaws (unless the content stays with them)
    const P = 7.4;
    const ph = still ? 5.2 : T % P;
    let k = ph < 1.6 ? 0 : ph < 4.2 ? easeInOut((ph - 1.6) / 2.6) : ph < 6.7 ? 1 : 1 - easeInOut((ph - 6.7) / 0.7);
    k *= 1 - wv;
    const moving = !still && wv < 0.5 && ((ph > 1.6 && ph < 4.2) || ph > 6.7);
    const x = lerp(atCard, atForum, k);
    walker(x, gy, s, ph * 7, moving, a, 30);
    if (mini) return;
    const headY = gy - s * 0.95;
    const flaw = clamp((ph - 4.3) / 0.3) * (ph < 6.6 ? 1 : 0) * (1 - wv);
    if (flaw > 0) bubble(x - s * 0.3 - 74, headY - 26, ['缺點呢？', '真實評價？'], narrow ? 14 : 15, a * flaw, 40, x - s * 0.08, headY);
    const mem = clamp((wv - 0.3) / 0.7) * (still ? 1 : clamp((ph % P) / 0.8 + 0.3));
    if (mem > 0.02) {
      const lines = wrap2(REMEMBER, 16, C.w * 0.5);
      bubble(Math.min(atCard + s * 0.7, C.x + C.w - 130), headY - 62 * u, lines, 16, a * mem, 50, atCard + s * 0.1, headY, true);
    }
    const cap = wv < 0.5 ? '相信 AI 的效率，卻不完全相信 AI 的答案' : '被記住的，是帶著溫度的情境';
    ink.text(cap, C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 1: the mirror ──
  function scene1(a, T, still) {
    const { g, c, acc } = env;
    const { C, narrow } = G;
    const cw = clamp(C.w * 0.32, 120, 270);
    const ch = clamp(C.h * 0.5, 130, 300);
    const kx = C.x + C.w * (narrow ? 0 : 0.04);
    const ky = C.y + (C.h - 30 - ch) / 2;
    const mx = C.x + C.w * (narrow ? 0.72 : 0.7);
    const my = ky + ch / 2;
    const rx = clamp(Math.min(C.w * 0.2, C.h * 0.27), 60, 170);
    const ry = rx * 1.32;
    // the brand's content
    card(kx, ky, cw, ch, a, 60);
    const fs = narrow ? 14 : 16;
    const aF = a * (1 - wv);
    const aW = a * wv;
    if (aF > 0.01) {
      ink.text('標準公版', kx + 16, ky + 30, { size: fs + 1, alpha: aF });
      const gapR = (ch - 64) / 3;
      ['產品規格', '成分比例', '法務聲明'].forEach((r, i) => {
        const y = ky + 62 + i * gapR;
        ink.text(r, kx + 16, y, { size: fs - 1, color: c.ink2, alpha: aF });
        for (let k = 0; k < (gapR > 44 ? 2 : gapR > 30 ? 1 : 0); k++) ink.line(kx + 16, y + 14 + k * 11, kx + cw - 18 - k * 30, y + 14 + k * 11, { seed: 61 + i * 3 + k, alpha: 0.5 * aF, w: 0.9, passes: 1, wobble: 0.4 });
      });
    }
    if (aW > 0.01) {
      ink.text('生活情境', kx + 16, ky + 30, { size: fs + 1, alpha: aW });
      // a small moon: late nights
      const mcx = kx + cw * 0.5;
      const mcy = ky + ch * 0.38;
      const mr = Math.min(cw, ch) * 0.16;
      const moon = [];
      for (let i = 0; i <= 18; i++) {
        const q = -Math.PI * 0.62 + (i / 18) * Math.PI * 1.24;
        moon.push([mcx + Math.cos(q + Math.PI) * mr, mcy + Math.sin(q + Math.PI) * mr]);
      }
      for (let i = 18; i >= 0; i--) {
        const q = -Math.PI * 0.62 + (i / 18) * Math.PI * 1.24;
        moon.push([mcx - mr * 0.42 + Math.cos(q + Math.PI) * mr * 0.78, mcy + Math.sin(q + Math.PI) * mr * 0.92]);
      }
      ink.blob(mcx - mr * 0.4, mcy, mr * 1.1, { seed: 66, alpha: c.hlAlpha * 0.8 * aW });
      ink.path(moon, { seed: 67, alpha: 0.9 * aW, w: 1.4 });
      wrap2(REMEMBER, fs, cw - 30).forEach((l, i) => ink.text(l, kx + 16, ky + ch * 0.66 + i * (fs + 9), { size: fs, alpha: aW }));
    }
    // feed → mirror
    const ax0 = kx + cw + 12;
    const ax1 = mx - rx - 14;
    ink.arrow(ax0, my - 16, ax1, my - 16, { seed: 70, alpha: 0.8 * a, w: 1.1, head: 9 });
    ink.arrow(ax1, my + 16, ax0, my + 16, { seed: 72, alpha: 0.5 * a, w: 1, head: 8 });
    if (!narrow) {
      ink.text('餵給它', (ax0 + ax1) / 2, my - 26, { size: 14, align: 'center', color: c.ink2, alpha: a });
      ink.text('照出來', (ax0 + ax1) / 2, my + 40, { size: 14, align: 'center', color: c.ink2, alpha: a });
    }
    // the mirror: pencil frame, glyph glass that shows the content back (flipped)
    if (wv > 0.02) {
      g.save();
      g.globalAlpha = c.hlAlpha * 0.55 * a * wv;
      g.fillStyle = acc;
      g.beginPath();
      g.ellipse(mx, my, rx * 0.94, ry * 0.94, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    const cell = clamp(rx / 13, 6, 11);
    const mr = Math.min(rx, ry) * 0.3;
    ascii.field(mx - rx, my - ry, rx * 2, ry * 2, cell, (x, y, q, r) => {
      const ex = (x - mx) / rx;
      const ey = (y - my) / ry;
      if (ex * ex + ey * ey > 0.86) return -1;
      // flat: tidy rows of the same grey
      const row = Math.round((y - my + ry) / cell);
      const flat = row % 3 === 1 && Math.abs(ex) < 0.72 ? 0.45 : 0.08;
      // warm: the moon (flipped) and two lively lines
      const dx = -(x - mx);
      const inMoon = Math.hypot(dx, y - (my - ry * 0.3)) < mr && Math.hypot(dx + mr * 0.42, y - (my - ry * 0.3)) > mr * 0.82;
      const line = (Math.abs(y - (my + ry * 0.25)) < cell * 0.6 || Math.abs(y - (my + ry * 0.42)) < cell * 0.6) && Math.abs(ex) < 0.6;
      const n = noise3(q * 0.4, r * 0.4, env.t * 0.3);
      const lively = inMoon ? 0.92 : line ? 0.55 + n * 0.3 : 0.12 + n * 0.1;
      return lerp(flat, lively, wv);
    }, c.ink, a);
    const fr = [];
    const fr2 = [];
    for (let i = 0; i <= 40; i++) {
      const k = (i / 40) * Math.PI * 2;
      fr.push([mx + Math.cos(k) * rx, my + Math.sin(k) * ry]);
      fr2.push([mx + Math.cos(k) * (rx + 7), my + Math.sin(k) * (ry + 7)]);
    }
    ink.path(fr, { seed: 74, alpha: 0.9 * a, w: 1.4 });
    ink.path(fr2, { seed: 75, alpha: 0.6 * a, w: 1, passes: 1 });
    ink.line(mx, my + ry + 7, mx, my + ry + 28, { seed: 76, alpha: 0.8 * a, w: 1.4 });
    ink.line(mx - rx * 0.45, my + ry + 30, mx + rx * 0.45, my + ry + 30, { seed: 77, alpha: 0.8 * a, w: 1.4 });
    ink.text('AI', mx + rx + 14, my - ry * 0.7, { font: 'latin', size: 16, weight: 700, alpha: a });
    const cap = wv < 0.5 ? '毫無破綻，也毫無情緒' : '品牌餵給它什麼，它就吐出什麼';
    ink.text(cap, C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 2: the Stepford brands ──
  // the identical faces really are copies: one is drawn into a small canvas, then stamped
  const faceC = document.createElement('canvas');
  let faceKey = '';
  function face(x, y, s, a) {
    const W = Math.ceil(s * 0.9);
    const H = Math.ceil(s * 1.12);
    const key = [Math.round(s), env.c.ink, env.dpr].join('|');
    if (key !== faceKey) {
      faceKey = key;
      faceC.width = Math.ceil(W * env.dpr);
      faceC.height = Math.ceil(H * env.dpr);
      const fg = faceC.getContext('2d');
      fg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
      const keep = env.g;
      env.g = fg;
      faceGlyphs(W / 2, H / 2, s);
      env.g = keep;
    }
    const g = env.g;
    g.save();
    g.globalAlpha *= a;
    g.drawImage(faceC, x - W / 2, y - H / 2, W, H);
    g.restore();
  }
  function faceGlyphs(x, y, s) {
    const a = 1;
    const cell = clamp(s / 11, 5, 8);
    const n = Math.ceil(s / cell);
    const rx = s * 0.4;
    const ry = s * 0.5;
    for (let r = 0; r < n + 1; r++) {
      const py = y - ry + (r + 0.5) * cell;
      for (let q = 0; q < n; q++) {
        const px = x - rx + (q + 0.5) * cell * (rx * 2 / (n * cell));
        const ex = (px - x) / rx;
        const ey = (py - y) / ry;
        const d = ex * ex + ey * ey;
        if (d > 1) continue;
        let v = d > 0.7 ? 0.8 : 0.22;
        if (Math.hypot(ex - 0.36, ey + 0.16) < 0.17 || Math.hypot(ex + 0.36, ey + 0.16) < 0.17) v = 0.97;
        const sm = 0.36 + 0.12 * (1 - ex * ex * 4);
        if (Math.abs(ey - sm) < 0.1 && Math.abs(ex) < 0.42) v = 0.9;
        ascii.glyph(v, px, py, cell, env.c.ink, a);
      }
    }
  }
  function myFace(x, y, s, a, t) {
    const { c } = env;
    ink.blob(x, y, s * 0.62, { seed: 90, alpha: c.hlAlpha * a });
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const k = (i / 30) * Math.PI * 2.03;
      pts.push([x + Math.cos(k) * s * 0.4, y + Math.sin(k) * s * 0.5]);
    }
    ink.path(pts, { seed: 91, alpha: 0.95 * a, w: 1.5 });
    // a loose fringe, one winking eye, a lopsided smile: someone in particular
    ink.path([[x - s * 0.38, y - s * 0.2], [x - s * 0.2, y - s * 0.46], [x + s * 0.05, y - s * 0.3], [x + s * 0.22, y - s * 0.5], [x + s * 0.4, y - s * 0.18]], { seed: 92, alpha: 0.85 * a, w: 1.3 });
    ink.dot(x - s * 0.15, y - s * 0.05, s * 0.04, { seed: 93, alpha: a, color: c.ink });
    ink.path([[x + s * 0.08, y - s * 0.05], [x + s * 0.15, y - s * 0.09], [x + s * 0.22, y - s * 0.05]], { seed: 94, alpha: 0.9 * a, w: 1.4 });
    ink.path([[x - s * 0.18, y + s * 0.17], [x - s * 0.02, y + s * 0.27], [x + s * 0.2, y + s * 0.14]], { seed: 95, alpha: 0.9 * a, w: 1.5 });
  }
  function scene2(a, T, still) {
    const { c } = env;
    const { C, narrow, tall } = G;
    const cols = narrow || tall ? 4 : 5;
    const rows = tall && !narrow ? 3 : 2;
    const top = C.y + 40;
    const bottom = C.y + C.h - (narrow ? 96 : 104);
    const s = clamp(Math.min((C.w * 0.86) / cols / 1.35, (bottom - top) / rows / 1.5), 34, 124);
    const gx = C.x + C.w / 2 - ((cols - 1) * s * 1.35) / 2;
    const gyy = (top + bottom) / 2 - ((rows - 1) * s * 1.55) / 2;
    const mine = cols + 1;
    const bob = still ? 0 : Math.sin(env.t * 1.6) * 2;
    ink.text('AI：這是「眾多相似競品」之一', C.x + C.w / 2, C.y + 16, { size: narrow ? 14 : 16, align: 'center', alpha: a });
    for (let i = 0; i < cols * rows; i++) {
      const x = gx + (i % cols) * s * 1.35;
      const y = gyy + Math.floor(i / cols) * s * 1.55 + bob;
      if (i === mine) {
        if (wv < 0.98) face(x, y, s, a * (1 - wv));
        if (wv > 0.02) myFace(x, y - s * 0.06 * wv, s * (1 + 0.14 * wv), a * wv, env.t);
        // the arrow to "your brand"
        const ty = y + s * 0.56 + 6;
        ink.arrow(x + s * 0.62, ty + 16, x + s * 0.24, ty, { seed: 96, alpha: 0.8 * a, w: 1.1, head: 7 });
        ink.text('你的品牌', x + s * 0.68, ty + 21, { size: 14, alpha: a });
      } else face(x, y, s, a);
    }
    const said = '都在談「修護、保濕、抗老」';
    ink.text(said, C.x + C.w / 2, C.y + C.h - (narrow ? 32 : 38), { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a * (1 - wv * 0.4) });
    if (wv < 0.5) tag('有效率的隱形', C.x + C.w / 2, C.y + C.h - 4, narrow ? 15 : 18, a * (1 - wv * 2), { align: 'center', seed: 97 });
    else ink.text('在對的情境下，被第一個想起', C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 15 : 17, align: 'center', alpha: a * (wv * 2 - 1) });
  }

  // ── step 3: from keyword to context ──
  function scene3(a, T, still, dt) {
    const { g, c, acc } = env;
    const { C, narrow } = G;
    const fs = narrow ? 13 : 16;
    const kw = '抗老精華';
    const q = '最近熬夜膚況變差怎麼辦？';
    const kwW = tw(kw, fs, 'mono') + 40;
    const qW = tw(q, fs);
    // top row: keyword box → the real question
    const rowY = C.y + 22;
    const kx = narrow ? C.x : C.x + C.w / 2 - (kwW + 50 + qW + 24) / 2;
    const ky = rowY - fs;
    ink.rect(kx, ky - 4, kwW, fs + 14, { seed: 100, alpha: 0.85 * a * (1 - wv * 0.55), w: 1.1, passes: 1 });
    ink.circle(kx + 13, ky + 3 + fs * 0.3, 5, { seed: 101, alpha: 0.8 * a * (1 - wv * 0.55), w: 1 });
    ink.line(kx + 17, ky + 7 + fs * 0.3, kx + 21, ky + 11 + fs * 0.3, { seed: 102, alpha: 0.8 * a * (1 - wv * 0.55), w: 1.2 });
    ink.text(kw, kx + 28, rowY + 2, { font: 'mono', size: fs - 1, alpha: a * (1 - wv * 0.55) });
    if (wv > 0.02) ink.line(kx + 24, rowY - fs * 0.3, kx + 24 + (kwW - 30) * wv, rowY - fs * 0.3, { seed: 103, alpha: 0.8 * a * wv, w: 1.2 });
    const qx = narrow ? C.x : kx + kwW + 50;
    const qy = narrow ? rowY + fs + 26 : rowY + 2;
    if (!narrow) ink.arrow(kx + kwW + 10, rowY - fs * 0.3, qx - 12, rowY - fs * 0.3, { seed: 104, alpha: 0.7 * a, w: 1.1, head: 7 });
    if (wv > 0.02) ink.marker(qx - 6, qy - fs, qW + 12, fs * 1.4, { seed: 105, alpha: c.hlAlpha * a * wv });
    ink.text(q, qx, qy, { size: fs, alpha: a * (0.45 + 0.55 * wv) });
    // the 7W radar of contexts
    const top = narrow ? qy + 20 : rowY + 34;
    const bot = C.y + C.h - (narrow ? 4 : 30);
    const R = clamp(Math.min((bot - top) / 2 - (narrow ? 22 : 34), C.w * (narrow ? 0.24 : 0.28)), 46, 200);
    const rcx = C.x + C.w / 2;
    const rcy = (top + bot) / 2 + 6;
    const ang = (i) => -Math.PI / 2 + (i / 7) * Math.PI * 2;
    for (const k of [0.33, 0.66, 1]) {
      const ring = [];
      for (let i = 0; i <= 7; i++) ring.push([rcx + Math.cos(ang(i % 7)) * R * k, rcy + Math.sin(ang(i % 7)) * R * k]);
      ink.path(ring, { seed: 106 + k * 10, alpha: 0.35 * a, w: 0.9, passes: 1, wobble: 0.5 });
    }
    const poly = [];
    for (let i = 0; i < 7; i++) {
      const x = rcx + Math.cos(ang(i)) * R;
      const y = rcy + Math.sin(ang(i)) * R;
      ink.line(rcx, rcy, x, y, { seed: 110 + i, alpha: 0.45 * a, w: 0.9, passes: 1 });
      const v = lerp(R_FLAT[i], R_WARM[i], wv) * (still ? 1 : 0.97 + 0.03 * Math.sin(env.t * 2 + i));
      poly.push([rcx + Math.cos(ang(i)) * R * v, rcy + Math.sin(ang(i)) * R * v]);
      const lx = rcx + Math.cos(ang(i)) * (R + 16);
      const ly = rcy + Math.sin(ang(i)) * (R + 16);
      const al = Math.cos(ang(i)) > 0.3 ? 'left' : Math.cos(ang(i)) < -0.3 ? 'right' : 'center';
      const lyy = ly + (Math.sin(ang(i)) > 0.5 ? 14 : Math.sin(ang(i)) < -0.5 ? -4 : 5);
      ink.text(W7[i][1], lx, lyy, { size: narrow ? 13 : 15, align: al, alpha: a });
      if (!narrow) ink.text(W7[i][0], lx, lyy + 16, { font: 'mono', size: 11, align: al, color: c.ink2, alpha: a });
    }
    g.save();
    g.globalAlpha = c.hlAlpha * a * (0.25 + 0.6 * wv);
    g.fillStyle = wv > 0.5 ? acc : c.ink2;
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.restore();
    ink.poly(poly, { seed: 118, alpha: 0.9 * a, w: 1.3, closed: true });
    ink.text('示意', C.x + C.w, narrow ? top + 4 : rcy + R * 0.9, { size: 13, align: 'right', color: c.ink2, alpha: a });
    if (!narrow) ink.text('CEPs 七個 W', rcx - R - 10, rcy + R * 0.9, { size: 13, align: 'right', color: c.ink2, alpha: a });
    const cap = wv < 0.5 ? '只佔了一個關鍵字' : '語境佔位 Context Ownership';
    if (!narrow) ink.text(cap, C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 14 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 4: measuring whether you are the answer ──
  function scene4(a, T, still) {
    const { c } = env;
    const { C, narrow } = G;
    const capH = narrow ? 0 : 34;
    const rowH = (C.h - capH) / 3;
    const vx = narrow ? C.x : C.x + Math.min(250, C.w * 0.32);
    const vw = C.x + C.w - vx;
    // each row: a name on the left (or above, on phones) and its picture
    const row = (i, en, zh) => {
      const y0 = C.y + i * rowH + (narrow ? 14 : rowH * 0.3);
      ink.text(zh, C.x, y0, { size: narrow ? 14 : 17, alpha: a });
      if (!narrow) ink.text(en, C.x, y0 + 21, { font: 'mono', size: 12, color: c.ink2, alpha: a });
      return narrow ? y0 + 14 : y0 - 16;
    };
    // 1. citation share: ten AI answers; the ones that name the brand are marked
    let y = row(0, 'AI Citation Share of Voice', 'AI 引用佔有率');
    const n = 10;
    const gap = narrow ? 5 : 8;
    const cw = Math.min(46, (vw - gap * (n - 1)) / n);
    const chh = narrow ? 30 : 48;
    const cited = Math.round(lerp(2, 6, wv));
    const order = [3, 7, 1, 5, 8, 0, 9, 2, 6, 4];
    for (let i = 0; i < n; i++) {
      const x = vx + i * (cw + gap);
      const lit = order[i] < cited;
      for (let r = 0; r < (narrow ? 2 : 4); r++) glyphLine(x + 2, y + 8 + r * 9, cw - 6, 7, a * 0.8, 200 + i * 5 + r, 0.4, 0.2);
      if (lit) {
        ink.marker(x - 2, y - 2, cw + 4, chh + 4, { seed: 210 + i, alpha: c.hlAlpha * a });
        ink.circle(x + cw / 2, y + chh / 2, Math.min(cw, chh) * 0.36, { seed: 220 + i, alpha: 0.8 * a, w: 1.1 });
      }
      ink.rect(x, y, cw, chh, { seed: 230 + i, alpha: 0.55 * a, w: 0.9, passes: 1 });
    }
    const note = `${cited} / 10 個答案提到你`;
    ink.text('三項皆為示意', C.x + C.w, narrow ? C.y + 2 * rowH + 14 : C.y + C.h - 30, { size: 13, align: 'right', color: c.ink2, alpha: a });
    if (narrow) ink.text(note, C.x + C.w, y - 14, { size: 13, align: 'right', color: c.ink2, alpha: a });
    else ink.text(note, vx, y + chh + 24, { size: 13, color: c.ink2, alpha: a });
    // 2. where the citations come from (illustration)
    y = row(1, 'Citation sources', '引用來源分布');
    const bh = narrow ? 18 : 30;
    let x = vx;
    SOURCES.forEach((src, i) => {
      const wseg = (vw - 2) * lerp(S_FLAT[i], S_WARM[i], wv);
      ascii.field(x + 1, y, Math.max(1, wseg - 3), bh, 7, () => 0.2 + i * 0.15, c.ink, a * 0.85);
      if (i === 2 || i === 3) ink.marker(x, y - 2, wseg - 2, bh + 4, { seed: 240 + i, alpha: c.hlAlpha * 0.6 * a * wv });
      ink.rect(x, y - 2, wseg - 2, bh + 4, { seed: 250 + i, alpha: 0.6 * a, w: 0.9, passes: 1 });
      if (wseg > 30) ink.text(src, x + wseg / 2, y + bh + 20, { size: 13, align: 'center', color: c.ink2, alpha: a });
      x += wseg;
    });
    // 3. time to the first citation (illustration)
    y = row(2, 'Time-to-Citation', '多快被 AI 引用');
    const ly = y + 12;
    const tEnd = vx + 14 + (vw - 28) * lerp(0.92, 0.38, wv);
    ink.line(vx, ly, vx + vw - 4, ly, { seed: 260, alpha: 0.4 * a, w: 1, passes: 1 });
    ink.dot(vx + 6, ly, 5, { seed: 261, alpha: a, color: c.ink });
    ink.text('發布', vx + 6, ly + 26, { size: 13, align: narrow ? 'left' : 'center', color: c.ink2, alpha: a });
    ink.line(vx + 6, ly, tEnd, ly, { seed: 262, alpha: 0.9 * a, w: 2 });
    ink.blob(tEnd, ly, 11, { seed: 263, alpha: c.hlAlpha * a });
    ink.circle(tEnd, ly, 7, { seed: 264, alpha: 0.9 * a, w: 1.2 });
    ink.text('第一次被引用', Math.min(tEnd, C.x + C.w - 40), ly + 26, { size: 13, align: 'center', color: c.ink2, alpha: a });
    if (!narrow) ink.text('流量只說明多少人來過；這三個指標說明 AI 是否把你當成答案', C.x + C.w / 2, C.y + C.h - 4, { size: 15, align: 'center', color: c.ink2, alpha: a });
  }

  // ── step 5: the i-Proof staircase ──
  function scene5(a, T, still) {
    const { c } = env;
    const { C, narrow } = G;
    const fs = narrow ? 13 : 16;
    const n = 5;
    const sx0 = C.x + C.w * (narrow ? 0.5 : 0.46);
    const sx1 = C.x + C.w - (narrow ? 70 : 160);
    const ps = narrow ? 56 : clamp(C.h * 0.2, 70, 120);
    const sb = C.y + C.h - 40;
    const st = C.y + ps + 34;
    const tw_ = (sx1 - sx0) / n;
    const th = (sb - st) / n;
    const climb = still ? n : clamp((T - 0.4) / 0.7, 0, n);
    const cell = clamp(th / 6, 5, 9);
    for (let i = 0; i < n; i++) {
      const x = sx0 + i * tw_;
      const yTop = sb - (i + 1) * th;
      const lit = clamp(climb - i);
      // the stair is a block of glyphs: the technical side
      ascii.field(x + 1, yTop + 1, tw_ - 2, sb - yTop - 2, cell, (px, py, q, r) => 0.18 + (r === 0 ? 0.5 : 0.08) + lit * 0.12 + i * 0.03, c.ink, a * (0.5 + 0.5 * lit));
      ink.line(x, yTop, x + tw_, yTop, { seed: 300 + i, alpha: 0.9 * a, w: 1.3 });
      ink.line(x, yTop, x, yTop + th, { seed: 310 + i, alpha: 0.9 * a, w: 1.3 });
      // its name on the left, with a leader line
      const ly = yTop + 6;
      ink.line(C.x + (narrow ? 0 : 6) + Math.min(narrow ? 170 : 250, sx0 - C.x - 20), ly - 4, x - 6, ly - 4, { seed: 320 + i, alpha: 0.25 * a, w: 0.9, passes: 1, wobble: 0.3 });
      if (lit > 0.5) ink.marker(C.x - 4, ly - fs - 4, tw(STAIRS[i][0], fs) + 10, fs * 1.4, { seed: 330 + i, alpha: c.hlAlpha * a * Math.min(1, (lit - 0.5) * 2) });
      ink.text(STAIRS[i][0], C.x, ly - 4, { size: fs, alpha: a });
      if (!narrow) ink.text(STAIRS[i][1], C.x, ly + 14, { font: 'mono', size: 11, color: c.ink2, alpha: a });
    }
    ink.line(sx0 - 10, sb, sx1 + 30, sb, { seed: 340, alpha: 0.7 * a, w: 1.2 });
    // the brand climbing (a small pencil flag)
    const k = Math.min(n - 1, Math.floor(climb));
    const f = climb - k;
    const fx = sx0 + (Math.min(climb, n) - 0.5) * tw_ + (climb >= n ? 0 : 0);
    const fy = sb - (k + 1) * th - (climb < n ? Math.sin(f * Math.PI) * th * 0.3 : 0);
    ink.line(fx, fy, fx, fy - 30, { seed: 341, alpha: 0.9 * a, w: 1.3 });
    ink.poly([[fx, fy - 30], [fx + 18, fy - 25], [fx, fy - 19]], { seed: 342, alpha: 0.9 * a, w: 1.1, closed: true });
    ink.marker(fx + 1, fy - 29, 14, 9, { seed: 343, alpha: c.hlAlpha * a });
    // at the top, a person: remembers, or goes to the forums
    const landY = sb - n * th;
    ink.line(sx1, landY, C.x + C.w, landY, { seed: 344, alpha: 0.8 * a, w: 1.2 });
    const top = clamp(climb - n + 0.6);
    if (top > 0) {
      const P = 6;
      const ph = still ? 4 : (T - n * 0.7) % P;
      // generic content: they leave for the forums; warm content: they stay
      const go = (1 - wv) * clamp((ph - 1.2) / 2.2);
      const px = sx1 + (C.x + C.w - sx1) * 0.35 + go * ((C.x + C.w - sx1) * 0.65 - 50);
      walker(px, landY, ps, ph * 7, !still && go > 0 && go < 1, a * top * (1 - go * 0.6), 350);
      if (!narrow) {
        if (wv > 0.5) tag('記住了', px, landY - ps - 16, 15, a * top * (wv * 2 - 1), { align: 'center', seed: 351 });
        else ink.text('去論壇找缺點', px, landY - ps - 16, { size: 14, align: 'center', color: c.ink2, alpha: a * top * (1 - wv * 2) });
      }
    }
    const cap = '被 AI 看見是技術，被消費者記住才是本事';
    ink.text(cap, C.x + C.w / 2, C.y + C.h - 4, { size: narrow ? 13 : 16, align: 'center', color: c.ink2, alpha: a });
  }

  const scenes = [scene0, scene1, scene2, scene3, scene4, scene5];

  return {
    resize: geom,
    click() {
      warm = warm ? 0 : 1;
    },
    frame(t, dt) {
      const s = env.step;
      const still = dt === 0;
      if (s !== cur) {
        t0[s] = t;
        warm = START[s];
        if (cur < 0 || still) wv = warm;
        cur = s;
      }
      wv = still ? warm : approach(wv, warm, dt, 0.16);
      for (let i = 0; i < 6; i++) mix[i] = still ? (i === s ? 1 : 0) : approach(mix[i], i === s ? 1 : 0, dt, 0.18);
      if (!env.mini) contentSwitch(1);
      for (let i = 0; i < 6; i++) {
        if (mix[i] < 0.02) continue;
        scenes[i](mix[i] * mix[i], t - t0[i], still, dt);
      }
    },
  };
}
