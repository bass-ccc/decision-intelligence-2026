// 12 People Model — 5,045 CCS respondents as the seeds of one sunflower.
// step 0  the sunflower: inner seeds pencil (people), outer seeds glyphs (their digital twins)
// step 1  WHY: the same people, always there — a question ripples through every seed
// step 2  HOW: the eight CCS dimensions become eight sectors of the flower
// step 3  驗證: seeds fly into a scatter plot, real vs simulated answers, r = 0.89 (illustration)
// step 4  邊界: answers outside what the data covers turn into "?" — evidence is insufficient
// step 5  Lisa and Cindy: two personas speak, each with her own order of priorities
// Click: ask all 5,045 at once.
import { PEOPLE_MODEL } from '../content.js';
import { rng, smooth, lerp, approach, clamp, noise3 } from '../engine/noise.js';

export const hint = '點一下，向 5,045 人同時發問';

const GOLD = Math.PI * (3 - Math.sqrt(5));
const TOTAL = 5045;

export default function make(env) {
  const N = env.mini ? 1400 : TOTAL;
  const r = rng(12);
  // scatter: x = real answer share, y = simulated, correlation ≈ 0.89
  const xs = [];
  const es = [];
  for (let i = 0; i < N; i++) {
    xs.push(Math.pow(r(), 1.7));
    const u = Math.max(1e-6, r());
    es.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()));
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const sx = Math.sqrt(mean(xs.map((v) => (v - mx) ** 2)));
  const se = sx * Math.sqrt(1 / 0.89 ** 2 - 1);
  // keep answers inside 0..100% by folding at the edges (no pile-up on the axes)
  const fold = (v) => (v < 0 ? -v * 0.6 : v > 1 ? 1 - (v - 1) * 0.6 : v);
  const ys = xs.map((x, i) => clamp(fold(x + es[i] * se), 0, 1));
  const seeds = Array.from({ length: N }, (_, i) => ({
    i,
    d: r(),
    sx: xs[i],
    sy: ys[i],
    out: xs[i] > 0.74 && r() < 0.55, // "beyond the data" answers for step 4
    x: 0,
    y: 0,
  }));

  let mix = { flower: 1, sectors: 0, scatter: 0, gap: 0, persona: 0 };
  const waves = [];
  let asked = 0;
  let hover = -1;
  let G = {};
  const layer = document.createElement('canvas');
  let layerKey = '';

  function geom() {
    const { w, h } = env;
    // leave room for the eight dimension labels at the sides and the caption strip at the bottom
    const R = Math.min(w * (env.mini ? 0.42 : 0.3), (h - 90) * 0.42);
    G = { cx: w / 2, cy: (h - 52) * 0.5 + 10, R, sc: R / Math.sqrt(N) };
    // persona layout: flower moves up and shrinks
    G.pcx = w / 2;
    G.pcy = h < 460 ? h * 0.2 : h * 0.3;
    G.pR = Math.min(w, h) * (h < 460 ? 0.13 : 0.18);
    // scatter box
    const s = Math.min(w * 0.7, (h - 52) * 0.68);
    G.box = { x: w / 2 - s / 2 + 18, y: (h - 52) / 2 - s / 2, s };
  }
  geom();

  const targets = (p, t) => {
    const ang = p.i * GOLD;
    const rad = Math.sqrt(p.i + 0.5);
    // flower
    let fx = G.cx + Math.cos(ang) * rad * G.sc;
    let fy = G.cy + Math.sin(ang) * rad * G.sc;
    // persona: smaller flower higher up
    const k = mix.persona;
    if (k > 0) {
      fx = lerp(fx, G.pcx + Math.cos(ang) * rad * (G.pR / Math.sqrt(N)), k);
      fy = lerp(fy, G.pcy + Math.sin(ang) * rad * (G.pR / Math.sqrt(N)), k);
    }
    // scatter
    const bx = G.box.x + p.sx * G.box.s;
    const by = G.box.y + G.box.s - p.sy * G.box.s;
    const a = smooth(mix.scatter * 1.4 - p.d * 0.4);
    return [lerp(fx, bx, a), lerp(fy, by, a), a];
  };

  const sectorOf = (p) => {
    const ang = ((p.i * GOLD) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(ang / (Math.PI / 4));
  };

  return {
    resize: geom,
    click(x, y) {
      waves.push({ x, y, t0: env.t });
      asked++;
    },
    frame(t, dt) {
      const { g, w, h, ink, ascii, c, acc, pointer } = env;
      const s = env.step;
      const want = {
        flower: 1,
        sectors: s === 2 ? 1 : 0,
        scatter: s === 3 || s === 4 ? 1 : 0,
        gap: s === 4 ? 1 : 0,
        persona: s === 5 ? 1 : 0,
      };
      for (const k in mix) mix[k] = dt > 0 ? approach(mix[k], want[k], dt, 0.45) : want[k];
      if (s === 1 && dt > 0 && (waves.length === 0 || t - waves[waves.length - 1].t0 > 2.6)) waves.push({ x: G.cx, y: G.cy, t0: t, auto: true });
      while (waves.length && t - waves[0].t0 > 4) waves.shift();

      // hover: nearest seed (flower only)
      hover = -1;
      if (pointer.in && mix.scatter < 0.1 && mix.persona < 0.1) {
        const dx = pointer.x - G.cx;
        const dy = pointer.y - G.cy;
        const rad = Math.hypot(dx, dy) / G.sc;
        if (rad < Math.sqrt(N)) {
          // search seeds near that radius
          let best = 1e9;
          const i0 = Math.max(0, Math.floor(rad * rad - 3 * rad - 10));
          const i1 = Math.min(N, Math.ceil(rad * rad + 3 * rad + 10));
          for (let i = i0; i < i1; i++) {
            const p = seeds[i];
            const d = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
            if (d < best) {
              best = d;
              hover = i;
            }
          }
          if (best > 80) hover = -1;
        }
      }

      // ── scatter furniture ──
      if (mix.scatter > 0.02) {
        const { x, y, s: S } = G.box;
        const a = mix.scatter;
        g.save();
        g.globalAlpha = a;
        ink.line(x, y + S, x + S, y + S, { seed: 1, w: 1.2 });
        ink.line(x, y + S, x, y, { seed: 2, w: 1.2 });
        ink.line(x, y + S, x + S, y, { seed: 3, w: 1, alpha: 0.5, wobble: 0.6 });
        for (const v of [0, 0.5, 1]) {
          ink.text(`${v * 100}%`, x + v * S, y + S + 18, { font: 'mono', size: 10, align: 'center', color: c.ink2 });
          ink.text(`${v * 100}%`, x - 8, y + S - v * S + 4, { font: 'mono', size: 10, align: 'right', color: c.ink2 });
        }
        ink.text('真人調查的回答比例', x + S / 2, y + S + 38, { size: 14, align: 'center', color: c.ink2 });
        ink.text('AI Persona 模擬', x - 40, y + S / 2, { size: 14, align: 'center', color: c.ink2, rotate: -Math.PI / 2 });
        ink.marker(x + 10, y + 6, 150, 34, { seed: 4, alpha: c.hlAlpha });
        ink.text('r = 0.89', x + 18, y + 31, { font: 'mono', size: 24, color: c.ink });
        ink.text('MAE 9.4% · RMSE 13.1%', x + 18, y + 52, { font: 'mono', size: 11, color: c.ink2 });
        ink.text('示意：每個點是一個回答選項', x + S, y - 10, { size: 12, align: 'right', color: c.ink2 });
        if (mix.gap > 0.02) {
          const gx = x + S * 0.74;
          g.globalAlpha = mix.gap;
          g.setLineDash([5, 5]);
          ink.rect(gx, y - 4, S * 0.27, S * 0.45, { seed: 7, w: 1.1, passes: 1 });
          g.setLineDash([]);
          ink.marker(gx + 6, y + S * 0.45 + 6, 110, 26, { seed: 8, color: c.model });
          ink.text('目前證據不足', gx + 12, y + S * 0.45 + 25, { size: 15, color: c.ink });
        }
        g.restore();
      }

      // ── sector labels (CCS dimensions) ──
      if (mix.sectors > 0.02) {
        g.save();
        g.globalAlpha = mix.sectors;
        PEOPLE_MODEL.ccs.forEach((name, k) => {
          const a = (k + 0.5) * (Math.PI / 4);
          const R = G.R * 1.13;
          const lx = G.cx + Math.cos(a) * R;
          const ly = G.cy + Math.sin(a) * R;
          ink.line(G.cx + Math.cos(k * Math.PI / 4) * G.R * 0.25, G.cy + Math.sin(k * Math.PI / 4) * G.R * 0.25, G.cx + Math.cos(k * Math.PI / 4) * G.R * 1.04, G.cy + Math.sin(k * Math.PI / 4) * G.R * 1.04, { w: 0.9, alpha: 0.6, seed: 20 + k, passes: 1 });
          if (!env.mini) ink.text(name, lx, ly + 5, { size: 14, align: Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center', color: c.ink });
        });
        if (!env.mini && h > 420) ink.text('CCS · 15–74 歲 · 每人約 6,900 個資料點', G.cx, G.cy + G.R * 1.13 + 30, { size: 13, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── seeds ── (5,045 marks: when nothing is moving they are redrawn only at the 6 fps
      // pencil "boil" rate into a cached layer, so a still flower costs one drawImage per frame)
      const settled = waves.length === 0 && hover < 0 && Object.keys(mix).every((k) => Math.abs(mix[k] - want[k]) < 0.003);
      const key = settled ? [env.boil, s, w, h, env.dpr, c.ink, c.pencil, pointer.in].join('|') : '';
      if (settled && key === layerKey) {
        g.drawImage(layer, 0, 0, w, h);
      } else if (settled) {
        layer.width = Math.round(w * env.dpr);
        layer.height = Math.round(h * env.dpr);
        const lg = layer.getContext('2d');
        lg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
        env.g = lg;
        drawSeeds(env.boil / 6);
        env.g = g;
        layerKey = key;
        g.drawImage(layer, 0, 0, w, h);
      } else {
        layerKey = '';
        drawSeeds(t);
      }

      function drawSeeds(tt) {
        const cell = env.mini ? 5 : Math.max(5, Math.min(7.5, G.sc * 1.05));
        const pencil = [];
        for (let i = 0; i < N; i++) {
          const p = seeds[i];
          let [x, y, sa] = targets(p, tt);
          x += noise3(i * 0.05, 0, tt * 0.4) * 0.8;
          y += noise3(0, i * 0.05, tt * 0.4) * 0.8;
          // ripples: a question travelling through the crowd
          let lit = 0;
          for (const wv of waves) {
            const dd = Math.hypot(x - wv.x, y - wv.y);
            const front = (t - wv.t0) * Math.max(w, h) * 0.38;
            const k = 1 - Math.abs(dd - front) / 26;
            if (k > 0) {
              lit = Math.max(lit, k);
              const push = k * 3;
              x += ((x - wv.x) / (dd || 1)) * push;
              y += ((y - wv.y) / (dd || 1)) * push;
            }
          }
          p.x = x;
          p.y = y;
          const inner = p.i < N * 0.42;
          const sector = sectorOf(p);
          const dim = mix.sectors > 0.5 && pointer.in && hover >= 0 && sectorOf(seeds[hover]) !== sector ? 0.35 : 1;
          if (mix.gap > 0.5 && p.out) {
            ascii.glyph('?', x, y, cell + 2, c.ink, 0.85);
            continue;
          }
          if (lit > 0.05 || i === hover) {
            ink.dot(x, y, i === hover ? 4 : 1.6 + lit * 1.6, { color: acc, alpha: 0.95, boil: false, seed: i });
            continue;
          }
          if (inner && sa < 0.5) pencil.push(x, y, dim);
          else {
            const v = sa > 0.5 ? 0.42 : 0.25 + (p.i / N) * 0.6;
            ascii.glyph(v, x, y, cell, mix.sectors > 0.5 && sector % 2 ? c.ink2 : c.ink, 0.9 * dim);
          }
        }
        // pencil seeds in one batch
        const gg = env.g;
        gg.save();
        gg.strokeStyle = c.pencil;
        gg.lineCap = 'round';
        gg.lineWidth = env.mini ? 1 : 1.2;
        gg.globalAlpha = 0.8;
        gg.beginPath();
        for (let k = 0; k < pencil.length; k += 3) {
          const x = pencil[k];
          const y = pencil[k + 1];
          const a = Math.atan2(y - G.cy, x - G.cx) + 1.2;
          const L = 1.6;
          gg.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
          gg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
        }
        gg.stroke();
        gg.restore();
      }

      // hover card
      if (hover >= 0 && !env.mini) {
        const p = seeds[hover];
        const txt = `第 ${(Math.floor((hover / N) * TOTAL) + 1).toLocaleString()} 位受訪者`;
        const sub = mix.sectors > 0.5 ? PEOPLE_MODEL.ccs[sectorOf(p)] : '約 6,900 個資料點';
        const bx = Math.min(w - 190, p.x + 14);
        const by = Math.max(10, p.y - 58);
        g.save();
        g.fillStyle = c.sheet;
        g.globalAlpha = 0.94;
        g.fillRect(bx, by, 176, 48);
        g.restore();
        ink.rect(bx, by, 176, 48, { seed: 31, w: 1, passes: 1 });
        ink.text(txt, bx + 10, by + 21, { size: 15 });
        ink.text(sub, bx + 10, by + 40, { size: 12, color: c.ink2 });
      }

      // ── personas ──
      if (mix.persona > 0.02 && !env.mini) {
        const a = mix.persona;
        g.save();
        g.globalAlpha = a;
        const ps = PEOPLE_MODEL.personas;
        // narrow panes show one persona at a time (they take turns; a click also switches)
        const compact = w < 560 || h < 460;
        const bw = compact ? Math.min(w - 32, 360) : Math.min(330, w * 0.42);
        const shown = compact ? [ps[Math.floor(t / 4.5 + asked) % 2]] : ps;
        shown.forEach((pp, j) => {
          const k = compact ? ps.indexOf(pp) : j;
          const bx = compact ? (w - bw) / 2 : k === 0 ? w * 0.06 : w * 0.94 - bw;
          const by = compact ? G.pcy + G.pR + 22 : h * 0.52 + (k ? 18 : 0);
          const size = compact ? 14 : 16;
          const lh = compact ? 20 : 24;
          const lines = ink.wrap(`「${pp.voice}」`, bw - 36, { size });
          const bh = 56 + lines.length * lh + (compact ? 8 : 26);
          // speech tail toward the flower
          const tx = compact ? bx + bw / 2 : k === 0 ? bx + bw * 0.6 : bx + bw * 0.4;
          ink.line(tx, by, lerp(tx, G.pcx, 0.35), by - (compact ? 14 : 40), { seed: 40 + k, w: 1.1 });
          g.save();
          g.fillStyle = c.sheet;
          g.globalAlpha = a * 0.9;
          g.fillRect(bx, by, bw, bh);
          g.restore();
          ink.rect(bx, by, bw, bh, { seed: 44 + k, w: 1.2 });
          g.save();
          g.font = env.font('latin', 20, 700);
          const nw = g.measureText(pp.name).width;
          g.restore();
          ink.marker(bx + 12, by + 14, nw + 14, 28, { seed: 48 + k });
          ink.text(pp.name, bx + 18, by + 35, { font: 'latin', size: 20, weight: 700 });
          ink.text(`${pp.age} · ${pp.bought}`, bx + 18 + nw + 16, by + 34, { size: 13, color: c.ink2 });
          lines.forEach((l, i) => ink.text(l, bx + 18, by + 60 + i * lh, { size }));
          if (!compact) ascii.text(pp.order.map((o, i) => `${i + 1}.${o}`).join('  '), bx + 18, by + 66 + lines.length * lh + 6, 11, c.ink2);
        });
        if (h > 520) ink.text('同樣的產品，不同的人，問的第一個問題不一樣。', w / 2, h - 66, { size: 15, align: 'center', color: c.ink2 });
        g.restore();
      }

      // counter
      if (asked && !env.mini) ascii.text(`已發問 ${asked} 次 · ${TOTAL.toLocaleString()} 位同時回答`, w - 16 - 7 * 26, 46, 11, c.ink2, 0.9);
      if (s === 0 && !env.mini && mix.scatter < 0.1 && h > 420) ink.text('5,045 位真實受訪者，一人一顆種子', G.cx, G.cy + G.R + 28, { size: 15, align: 'center', color: c.ink2 });
    },
  };
}
