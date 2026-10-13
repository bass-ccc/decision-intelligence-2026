// 16 看見「文化暗流」 — AI transformation is an iceberg: neat glyph tools on top, pencil currents of culture below.
// step 0  the waterline: AI 算力 · 軟體 · 課程 as tidy glyph bars; below, slow pencil currents around a huge hidden mass
// step 1  高層火熱，基層徬徨: leaders sit warm near the surface, staff drift deep down; 19% between them
// step 2  a day saved by AI (42%) drops out of the week and floats with no direction (66% got no guidance)
// step 3  導入很多，整合很少: the hidden mass as 500 cells, 47.8% lit with AI projects, only 6.6% reach the core
// step 4  把願景變成 KPI: Sanrio Time and Walmart's Ask Sam drop measuring lines into the water; currents line up
// step 5  3C: Check finds six named undercurrents (eddies); Connect and Cultivate head the picture
// Drag under the water: you stir the currents, and they push back on the iceberg.
import { ARTICLES } from '../content.js';
import { rng, hash, noise3, smooth, lerp, approach, clamp, easeOut } from '../engine/noise.js';

export const hint = '在水面下拖曳，攪動暗流';

// the hidden mass, in units of half its width (u) and its depth (v)
const BODY = [
  [-0.36, 0], [-0.52, 0.06], [-0.68, 0.11], [-0.76, 0.21], [-0.92, 0.31], [-0.97, 0.43], [-0.86, 0.51], [-0.93, 0.63],
  [-0.75, 0.73], [-0.62, 0.85], [-0.4, 0.9], [-0.22, 0.99], [0.02, 0.94], [0.2, 1], [0.42, 0.9], [0.6, 0.83],
  [0.8, 0.7], [0.92, 0.57], [1, 0.43], [0.88, 0.31], [0.8, 0.18], [0.62, 0.1], [0.48, 0.04], [0.38, 0],
];
// a few facet lines inside the mass (from, to), same units
const FACETS = [[[-0.76, 0.21], [-0.3, 0.42]], [[-0.86, 0.51], [-0.38, 0.6]], [[0.8, 0.18], [0.35, 0.38]], [[0.92, 0.57], [0.4, 0.66]], [[0.02, 0.94], [0.05, 0.7]]];
const TOOLS = ['AI 算力', '軟體', '課程'];
const FEARS = ['員工對失業的恐懼', '中階主管的焦慮', '部門穀倉'];
const EDDY_AT = [[-1.32, 0.2], [-1.36, 0.62], [-1.0, 0.94], [1.06, 0.92], [1.4, 0.62], [1.32, 0.22]];

export default function make(env) {
  const A = ARTICLES.find((a) => a.no === 16);
  const check = A ? A.framework.items[0][1] : '';
  const m = check.match(/：(.+)$/);
  const UNDER = m ? m[1].split('、') : ['願景幻覺', '沉默抗拒', '經驗倚賴', '創新落差', '中層阻塞', '工具孤兒'];
  const r = rng(16);
  const mix = { tools: 1, layers: 0, day: 0, cells: 0, kpi: 0, three: 0 };
  let G = {};
  let first = true;
  const NP = env.mini ? 150 : 360;
  const P = Array.from({ length: NP }, () => ({ x: 0, y: 0, vx: 0, vy: 0, s: r() }));
  const stirs = [];
  let rock = 0;
  let rockV = 0;
  let energy = 0;
  let cells = [];
  let staff = [];
  const day = { x: 0, y: 0 };

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 8 : 34;
    const bot = mini ? h - 6 : h - 52;
    const H = bot - top;
    G = { w, h, top, bot, H, cx: w / 2 };
    G.small = H < 380 || w < 560;
    G.wy = top + H * (mini ? 0.34 : G.small ? 0.33 : 0.3);
    G.D = bot - (mini ? 4 : H < 300 ? 10 : 30) - G.wy;
    G.bw = Math.min(w * (mini ? 0.56 : G.small ? 0.42 : w < h ? 0.58 : 0.5), G.D * 1.3);
    G.th = Math.min(G.wy - top - (mini ? 6 : G.small ? 22 : 64), G.D * 0.32);
    G.cell = clamp(G.bw / 60, 4.5, 9);
    G.poly = BODY.map(([u, v]) => [G.cx + (u * G.bw) / 2, G.wy + v * G.D]);
    // scatter particles over the water
    for (const p of P) {
      p.x = r() * w;
      p.y = G.wy + 6 + r() * (bot - G.wy - 6);
    }
    // 500 cells inside the hidden mass (step 3): find a spacing that gives at least 500, drop the deepest extras
    let sp = Math.sqrt((G.bw * G.D * 0.62) / 500);
    let pts = [];
    for (let tries = 0; tries < 30; tries++) {
      pts = [];
      for (let y = G.wy + sp * 0.7; y < G.wy + G.D; y += sp) for (let x = G.cx - G.bw / 2; x < G.cx + G.bw / 2; x += sp) if (inside(x, y, sp * 0.45)) pts.push([x, y]);
      if (pts.length >= 500 && pts.length < 560) break;
      sp *= pts.length < 500 ? 0.97 : 1.02;
    }
    pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    pts = pts.slice(0, 500);
    G.sp = sp;
    // lit = 47.8% (239 of 500) = 206 near the surface + the 33 (6.6%) that reach the core
    const core = [G.cx + G.bw * 0.04, G.wy + G.D * 0.74];
    const byCore = pts.map((p, i) => [Math.hypot(p[0] - core[0], (p[1] - core[1]) * 1.2), i]).sort((a, b) => a[0] - b[0]);
    const coreSet = new Set(byCore.slice(0, 33).map((e) => e[1]));
    let lit = 0;
    cells = pts.map((p, i) => {
      let kind = 0;
      if (coreSet.has(i)) kind = 2;
      else if (lit < 206) {
        kind = 1;
        lit++;
      }
      return { x: p[0], y: p[1], kind, d: hash(i, 7) };
    });
    // staff wandering deep in the mass (step 1)
    staff = [];
    const rr = rng(161);
    // margin scales with the canvas and the attempts are capped, so tiny canvases cannot hang
    const want = G.small ? 12 : 20;
    const pad = Math.min(14, Math.abs(G.bw) * 0.12, Math.abs(G.D) * 0.12);
    for (let tries = 0; staff.length < want && tries < 2000; tries++) {
      const x = G.cx + (rr() - 0.5) * G.bw * 0.9;
      const y = G.wy + G.D * (0.5 + rr() * 0.38);
      if (inside(x, y, pad)) staff.push([x, y, rr() * 10]);
    }
    G.core = core;
  }

  // point in the hidden mass (with a margin)
  function inside(x, y, pad = 0) {
    const poly = G.poly;
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    if (!c || !pad) return c;
    return inside(x - pad, y) && inside(x + pad, y) && inside(x, y - pad) && inside(x, y + pad);
  }

  const eddies = () => EDDY_AT.map(([u, v]) => [G.cx + (u * G.bw) / 2, G.wy + Math.min(v, 0.97) * G.D]);
  let EDD = [];

  // the current at a point: slow drift to the right, curling noise, eddies in step 5
  function field(x, y, t) {
    const calm = 1 - 0.7 * mix.kpi;
    const a = noise3(x * 0.004, y * 0.006, t * 0.05) * 2.6 * calm;
    let vx = 16 + 14 * mix.kpi + Math.cos(a) * 14 * calm;
    let vy = Math.sin(a) * 12 * calm;
    if (mix.three > 0.02) {
      for (const [ex, ey] of EDD) {
        const dx = x - ex;
        const dy = y - ey;
        const d2 = dx * dx + dy * dy;
        const f = Math.exp(-d2 / 2600) * 2.2 * mix.three;
        vx += -dy * f;
        vy += dx * f;
      }
    }
    return [vx, vy];
  }

  geom();

  // tidy glyph bars: the tools everyone can see and count
  function tools(t) {
    const { ascii, c } = env;
    const bh = G.th / 3;
    const widths = [0.34, 0.24, 0.14];
    const shift = [0, 0.025, 0.05];
    const cell = G.cell;
    const jit = Math.min(1, energy * 2);
    const fl = Math.floor(t * 8);
    const out = [];
    widths.forEach((wf, k) => {
      const bw = wf * G.bw;
      const x0 = G.cx + shift[k] * G.bw - bw / 2;
      const y0 = G.wy - (k + 1) * bh;
      const cols = Math.max(2, Math.round(bw / cell));
      const rows = Math.max(1, Math.round((bh - 2) / cell));
      for (let q = 0; q < rows; q++)
        for (let p = 0; p < cols; p++) {
          let v = 0.78 + 0.18 * hash(k, q, p);
          if (jit > 0.05 && hash(k, q, p, fl) < jit * 0.5) v = hash(k, q, p, fl + 1) * 0.6;
          ascii.glyph(v > 0.7 ? '#' : v, x0 + (p + 0.5) * (bw / cols), y0 + (q + 0.5) * ((bh - 2) / rows) + 1, cell * 1.1, c.ink, 0.9);
        }
      out.push([x0 + bw, y0 + bh / 2]);
    });
    return out;
  }

  function person(x, y, sc, alpha) {
    const { g, c } = env;
    g.save();
    g.globalAlpha *= alpha;
    g.fillStyle = c.pencil;
    g.beginPath();
    g.arc(x, y - 6 * sc, 3 * sc, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = c.pencil;
    g.lineWidth = 1.3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 5.5 * sc, y + 5 * sc);
    g.quadraticCurveTo(x, y - 3 * sc, x + 5.5 * sc, y + 5 * sc);
    g.stroke();
    g.restore();
  }

  function cap(str) {
    if (env.mini || G.H < 300) return;
    env.ink.text(str, G.w / 2, G.bot - 8, { size: clamp(G.w / 26, 13, 15), align: 'center', color: env.c.ink2 });
  }

  return {
    resize: geom,
    drag(x, y, dx, dy) {
      if (y < G.wy - 10) return;
      stirs.push({ x, y, vx: dx * 22, vy: dy * 22, t0: env.t });
      if (stirs.length > 40) stirs.shift();
      // currents shoved against the mass rock the whole iceberg
      const near = Math.hypot(x - G.cx, (y - G.wy - G.D * 0.4) * 0.8) < G.bw * 0.75;
      if (near) rockV += clamp(dx, -30, 30) * 0.0016;
      energy = Math.min(1.5, energy + Math.hypot(dx, dy) * 0.01);
    },
    down(x, y) {
      if (y > G.wy) stirs.push({ x, y, vx: 0, vy: 0, t0: env.t });
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c, pointer } = env;
      const s = env.step;
      const still = dt === 0;
      const since = still ? 30 : t - env.stepAt;
      const want = { tools: s === 0 ? 1 : 0, layers: s === 1 ? 1 : 0, day: s === 2 ? 1 : 0, cells: s === 3 ? 1 : 0, kpi: s === 4 ? 1 : 0, three: s === 5 ? 1 : 0 };
      for (const k in mix) mix[k] = still || first ? want[k] : approach(mix[k], want[k], dt, 0.35);
      first = false;
      const { cx, wy, D, bw } = G;
      EDD = eddies();

      // ── physics: particles, stirs, the rocking iceberg ──
      if (!still) {
        for (let i = stirs.length - 1; i >= 0; i--) if (t - stirs[i].t0 > 1.6) stirs.splice(i, 1);
        for (const p of P) {
          let [fx, fy] = field(p.x, p.y, t);
          for (const st of stirs) {
            const dx = p.x - st.x;
            const dy = p.y - st.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 9000) continue;
            const k = Math.exp(-d2 / 2400) * (1 - (t - st.t0) / 1.6);
            fx += st.vx * k + -dy * k * 1.2;
            fy += st.vy * k + dx * k * 1.2;
          }
          p.vx = approach(p.vx, fx, dt, 0.25);
          p.vy = approach(p.vy, fy, dt, 0.25);
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          if (inside(nx, ny)) {
            // slide around the hidden mass instead of through it
            const up = ny < wy + D * 0.5 ? -1 : 1;
            p.vy = Math.abs(p.vx) * 0.8 * (p.y < wy + D * 0.55 && p.y > wy + D * 0.1 ? up : 1);
            p.vx *= 0.3;
            p.y += p.vy * dt;
          } else {
            p.x = nx;
            p.y = ny;
          }
          if (p.x > w + 12) p.x = -12;
          if (p.x < -12) p.x = w + 12;
          if (p.y < wy + 4) p.y = wy + 4;
          if (p.y > G.bot + 6) p.y = wy + 8 + p.s * (G.bot - wy - 10);
        }
        rockV += (-rock * 9 - rockV * 2.2) * dt;
        rock = clamp(rock + rockV * dt, -0.13, 0.13);
        energy = Math.max(0, energy - dt * 0.8);
      }
      const bob = still ? 0 : Math.sin(t * 0.7) * 0.008;
      const ang = rock + bob;

      // ── the current: short pencil strokes, one path ──
      g.save();
      g.strokeStyle = c.pencil;
      g.lineCap = 'round';
      g.lineWidth = env.mini ? 1 : 1.15;
      g.globalAlpha = 0.5;
      g.beginPath();
      for (const p of P) {
        let vx = p.vx;
        let vy = p.vy;
        if (still || (vx === 0 && vy === 0)) [vx, vy] = field(p.x, p.y, t);
        const sp = Math.hypot(vx, vy) || 1;
        const L = clamp(3 + sp * 0.18, 3, 16);
        g.moveTo(p.x - (vx / sp) * L, p.y - (vy / sp) * L);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
      g.restore();

      // the stirring hand
      if (pointer.down && pointer.y > wy && !env.mini) ink.circle(pointer.x, pointer.y, 18, { seed: 9, w: 1, alpha: 0.5, passes: 1 });

      // ── the iceberg (rocks around the waterline) ──
      g.save();
      g.translate(cx, wy);
      g.rotate(ang);
      g.translate(-cx, -wy);
      // hidden mass: outline and light hatching
      const hatchA = 0.16 * (1 - mix.cells) * (1 - mix.layers * 0.6);
      if (hatchA > 0.01) {
        g.save();
        g.beginPath();
        G.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.clip();
        g.strokeStyle = c.pencil;
        g.globalAlpha = hatchA;
        g.lineWidth = 1;
        g.beginPath();
        for (let d = -D; d < bw + D; d += 9) {
          g.moveTo(cx - bw / 2 + d, wy);
          g.lineTo(cx - bw / 2 + d - D * 0.7, wy + D);
        }
        g.stroke();
        g.restore();
      }
      ink.poly(G.poly, { seed: 20, closed: true, w: 1.5 });
      FACETS.forEach(([[u0, v0], [u1, v1]], i) => ink.line(cx + (u0 * bw) / 2, wy + v0 * D, cx + (u1 * bw) / 2, wy + v1 * D, { seed: 25 + i, w: 0.9, alpha: 0.45 * (1 - mix.cells), passes: 1 }));
      const ends = tools(t);
      g.restore();

      // waterline
      {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const x = (i / 40) * w;
          pts.push([x, wy + Math.sin(x * 0.03 + t * 1.2) * 1.6]);
        }
        ink.path(pts, { seed: 30, w: 1.4 });
      }

      const fs = G.small ? 13 : 15;
      // ── 0 · what you can see vs what you can't ──
      if (mix.tools > 0.02 && !env.mini) {
        g.save();
        g.globalAlpha = mix.tools;
        if (G.small) ink.text(TOOLS.join('・'), ends[0][0] + 10, ends[1][1] + 4, { size: 13, color: c.ink2 });
        else
          ends.forEach(([x, y], k) => {
            ink.line(x + 6, y, x + 22, y, { seed: 40 + k, w: 0.9, alpha: 0.6, passes: 1 });
            ink.text(TOOLS[k], x + 28, y + 5, { size: fs, color: c.ink2 });
          });
        if (!G.small) {
          ink.text('看得見的：工具能力', 24, wy - 14, { size: 15, color: c.ink2 });
          ink.text('看不見的：文化暗流', 24, wy + 26, { size: 15, color: c.ink2 });
        }
        const at = [[-1.0, 0.3, 'right'], [1.0, 0.55, 'left'], [-0.55, 0.96, 'right']];
        FEARS.forEach((f, k) => {
          const [u, v, al] = at[k];
          let x = cx + (u * bw) / 2 + (al === 'right' ? -14 : 14);
          let a2 = al;
          if (G.small && k < 2) {
            x = k ? w - 8 : 8;
            a2 = k ? 'right' : 'left';
          }
          // keep the label inside the pane
          const tw = f.length * (fs + 1);
          if (a2 === 'right') x = Math.max(x, tw + 8);
          else if (a2 === 'left') x = Math.min(x, w - tw - 8);
          ink.text(f, x, wy + v * D, { size: fs + 1, align: a2 });
        });
        cap('不是技術軍備競賽，是組織文化的重塑戰役');
        g.restore();
      }

      // ── 1 · leaders warm near the top, staff adrift below ──
      if (mix.layers > 0.02 && !env.mini) {
        g.save();
        g.globalAlpha = mix.layers;
        const ly = wy + D * 0.12;
        const n = G.small ? 4 : 5;
        for (let i = 0; i < n; i++) {
          const x = cx + (i - (n - 1) / 2) * Math.min(34, bw * 0.08);
          ink.blob(x, ly - 2, 13, { seed: 50 + i });
          person(x, ly, 1.15, 1);
        }
        let sy = 0;
        staff.forEach(([x0, y0, ph], i) => {
          const x = x0 + Math.sin(t * 0.5 + ph) * 8;
          const y = y0 + Math.cos(t * 0.4 + ph * 1.3) * 5;
          sy += y0;
          person(x, y, 1, 0.85);
          if (i % 4 === 0) ink.text('?', x + 7, y - 8, { size: 13, color: c.ink2 });
        });
        sy = staff.length ? sy / staff.length : wy + D * 0.7;
        const bx = cx + bw * 0.2;
        ink.line(bx, ly + 14, bx, sy - 16, { seed: 60, w: 1.2 });
        ink.line(bx - 6, ly + 14, bx + 6, ly + 14, { seed: 61, w: 1.2 });
        ink.line(bx - 6, sy - 16, bx + 6, sy - 16, { seed: 62, w: 1.2 });
        const my = (ly + sy) / 2;
        ink.marker(bx + 10, my - 18, 66, 30, { seed: 63 });
        ink.text('19%', bx + 43, my + 4, { font: 'mono', size: 20, align: 'center' });
        if (!G.small) ink.text('正面感受落差', bx + 10, my + 30, { size: 13, color: c.ink2 });
        ink.text('高層火熱', cx - bw * 0.2 - 14, ly + 4, { size: fs + 1, align: 'right' });
        ink.text('基層徬徨', cx - bw * 0.36, sy - 30, { size: fs + 1, align: 'right' });
        cap('領導層的信心，沒有變成全體員工的共同語言');
        g.restore();
      }

      // ── 2 · the saved day drifts with no direction ──
      if (mix.day > 0.02 && !env.mini) {
        const a = mix.day;
        g.save();
        g.globalAlpha = a;
        const bs = clamp(w / 26, 26, 44);
        const sx = Math.max(16, cx - bw * 0.25 - bs * 5.6 - 24);
        const sy = wy - bs - 16;
        const days = '一二三四五';
        const lift = still ? 1 : smooth((since - 0.9) / 0.8);
        const fill = still ? 1 : smooth((since - 0.2) / 0.5);
        for (let i = 0; i < 5; i++) {
          const x = sx + i * (bs + 4);
          ink.rect(x, sy, bs, bs, { seed: 70 + i, w: 1.1, passes: 1, alpha: i === 4 ? 1 - lift * 0.7 : 1 });
          if (i < 4) ink.text(days[i], x + bs / 2, sy + bs / 2 + 5, { size: 14, align: 'center', color: c.ink2 });
        }
        // where it drifts: no current of its own, it just wanders
        const ax = Math.max(sx + bs, cx - bw / 2 - bs * 1.4);
        const ay = wy + D * 0.42;
        const wx = ax + noise3(t * 0.18, 1, 0) * bs * 1.2;
        const wyy = ay + noise3(2, t * 0.15, 0) * D * 0.14;
        const ox = sx + 4 * (bs + 4);
        day.x = lerp(ox, wx, easeOut(lift));
        day.y = lerp(sy, wyy - bs / 2, lift);
        const rot = lift * noise3(3, t * 0.2, 0) * 0.5;
        g.save();
        g.translate(day.x + bs / 2, day.y + bs / 2);
        g.rotate(rot);
        g.fillStyle = c.sheet;
        g.globalAlpha = a * 0.85;
        g.fillRect(-bs / 2, -bs / 2, bs, bs);
        g.globalAlpha = a;
        ink.marker(-bs / 2, -bs / 2, bs, bs, { seed: 75, alpha: c.hlAlpha * 0.6 });
        ink.rect(-bs / 2, -bs / 2, bs, bs, { seed: 76, w: 1.3 });
        ascii.field(-bs / 2 + 2, -bs / 2 + 2, bs - 4, bs - 4, bs / 5, (x, y) => fill * (0.5 + 0.4 * hash(Math.round(x), Math.round(y))), c.ink, 0.85);
        ink.text('五', 0, 5, { size: 15, align: 'center' });
        g.restore();
        // a compass that cannot settle
        if (lift > 0.5) {
          const kx = day.x + bs + 22;
          const ky = day.y + bs / 2;
          const na = still ? 2.2 : noise3(5, t * 0.6, 0) * 9;
          ink.circle(kx, ky, 13, { seed: 77, w: 1.1, passes: 1 });
          ink.line(kx - Math.cos(na) * 10, ky - Math.sin(na) * 10, kx + Math.cos(na) * 10, ky + Math.sin(na) * 10, { seed: 78, w: 1.4 });
          ink.text('?', kx + 18, ky - 8, { size: 16 });
        }
        // the numbers
        const tx = sx;
        const ty = Math.max(G.top + 26, sy - (G.small ? 30 : 56));
        const wide = !G.small && w > 960;
        ink.text('42%', tx, wide || G.small ? ty : ty - 26, { font: 'mono', size: G.small ? 18 : 24 });
        ink.text(G.small ? 'AI 每週至少省下一整天' : '基層員工：AI 每週至少省下一整天', tx + (wide ? 64 : G.small ? 50 : 0), ty - 2, { size: fs, color: c.ink2 });
        const qy = G.bot - (G.small ? 14 : 40);
        if (G.small) {
          g.save();
          g.fillStyle = c.sheet;
          g.globalAlpha *= 0.85;
          g.fillRect(8, qy - 26, Math.min(w - 16, 250), 34);
          g.restore();
        }
        ink.marker(14, qy - 24, G.small ? 54 : 70, G.small ? 26 : 32, { seed: 79 });
        ink.text('66%', 22, qy, { font: 'mono', size: G.small ? 18 : 24 });
        ink.text('從未收到管理階層任何指引', G.small ? 76 : 96, qy - 2, { size: fs, color: c.ink });
        if (!G.small) ink.text('BCG AI at Work 2026', 96, qy + 20, { font: 'latin', size: 12, color: c.ink2 });
        g.restore();
      }

      // ── 3 · 500 cells: 47.8% started, 6.6% reached the core ──
      if (mix.cells > 0.02) {
        const a = mix.cells;
        g.save();
        g.translate(cx, wy);
        g.rotate(ang);
        g.translate(-cx, -wy);
        const cl = G.sp * 0.95;
        const coreOn = still ? 1 : smooth((since - 1.4) / 0.6);
        const grow = still ? 1 : clamp((since - 0.2) / 1.4);
        for (const ce of cells) {
          const on = ce.kind > 0 && ce.d < grow * 1.05;
          if (ce.kind === 2 && on) continue;
          ascii.glyph(on ? '#' : '·', ce.x, ce.y, cl, on ? c.ink : c.ink2, a * (on ? 0.9 : 0.55));
        }
        if (coreOn > 0) {
          ink.blob(G.core[0], G.core[1], G.sp * 3.8, { seed: 80, alpha: c.hlAlpha * a * coreOn });
          g.save();
          g.globalAlpha = a * coreOn;
          g.fillStyle = c.pencil;
          g.beginPath();
          for (const ce of cells)
            if (ce.kind === 2) {
              g.moveTo(ce.x + G.sp * 0.3, ce.y);
              g.arc(ce.x, ce.y, G.sp * 0.3, 0, Math.PI * 2);
            }
          g.fill();
          g.restore();
        }
        g.restore();
        if (!env.mini) {
          g.save();
          g.globalAlpha = a;
          const lx = cx + bw * 0.5 + 16;
          const right = lx + 150 < w;
          const tx = right ? lx : w - 12;
          const al = right ? 'left' : 'right';
          ink.text('47.8%', tx, wy + D * 0.14, { font: 'mono', size: G.small ? 16 : 24, align: al });
          ink.text('已進行 AI 專案', tx, wy + D * 0.14 + (G.small ? 18 : 24), { size: fs, align: al, color: c.ink2 });
          ink.text('6.6%', tx, wy + D * 0.7, { font: 'mono', size: G.small ? 16 : 24, align: al, alpha: coreOn });
          const lines = G.small ? ['整合進核心'] : lx + 210 < w ? ['整合進核心流程、決策與文化'] : ['整合進核心流程、', '決策與文化'];
          lines.forEach((l, j) => ink.text(l, tx, wy + D * 0.7 + (G.small ? 18 : 24) + j * 20, { size: fs, align: al, color: c.ink2 }));
          ink.text('示意：一格 = 0.2% 的台灣企業', 16, wy - 12, { size: 13, color: c.ink2 });
          cap('導入很多，整合很少');
          g.restore();
        }
      }

      // ── 4 · vision turned into a number you can measure ──
      if (mix.kpi > 0.02 && !env.mini) {
        const a = mix.kpi;
        g.save();
        g.globalAlpha = a;
        const cases = [
          { x: Math.max(70, cx - bw / 2 - (G.small ? 40 : 90)), brand: 'Sanrio', vision: ['One World,', 'Connecting Smiles'], kpi: 'Sanrio Time', num: '227 億小時', what: '顧客體驗時間' },
          { x: Math.min(w - 70, cx + bw / 2 + (G.small ? 40 : 90)), brand: 'Walmart', vision: ['賦能員工', '而非取代員工'], kpi: 'Ask Sam', num: '90 萬名', what: '員工每週使用' },
        ];
        cases.forEach((cs, i) => {
          const drop = still ? 1 : easeOut((since - 0.3 - i * 0.4) / 0.9);
          const y0 = wy - (G.small ? 18 : 30);
          const y1 = y0 + (wy + D * 0.62 - y0) * drop;
          ink.text(cs.brand, cs.x, Math.max(G.top + 20, wy - (G.small ? 62 : 100)), { font: 'latin', size: G.small ? 13 : 16, weight: 600, align: 'center' });
          cs.vision.forEach((l, j) => ink.text(l, cs.x, Math.max(G.top + 38, wy - (G.small ? 46 : 78)) + j * (G.small ? 14 : 18), { font: i ? 'hand' : 'latin', size: G.small ? 12 : 14, align: 'center', color: c.ink2 }));
          // the measuring line
          ink.line(cs.x, y0, cs.x, y1, { seed: 90 + i, w: 1.4 });
          g.save();
          g.strokeStyle = c.pencil;
          g.lineWidth = 1;
          g.globalAlpha *= 0.8;
          g.beginPath();
          for (let y = y0 + 12, q = 0; y < y1; y += 12, q++) {
            const L = q % 5 === 0 ? 9 : 5;
            g.moveTo(cs.x - L, y);
            g.lineTo(cs.x, y);
          }
          g.stroke();
          g.restore();
          if (drop > 0.95) {
            const by = wy + D * 0.62;
            ink.circle(cs.x, by + 6, 5, { seed: 95 + i, w: 1.3 });
            ink.marker(cs.x - 54, by + 18, 108, G.small ? 22 : 28, { seed: 97 + i });
            ink.text(cs.kpi, cs.x, by + (G.small ? 34 : 38), { font: 'latin', size: G.small ? 13 : 16, weight: 600, align: 'center' });
            ink.text(cs.num, cs.x, by + (G.small ? 54 : 66), { font: 'mono', size: G.small ? 14 : 18, align: 'center' });
            if (!G.small) ink.text(cs.what, cs.x, by + 88, { size: 14, align: 'center', color: c.ink2 });
          }
        });
        cap('把抽象的文化願景，轉譯為可量化的商業指標');
        g.restore();
      }

      // ── 5 · 3C: check the undercurrents, connect, cultivate ──
      if (mix.three > 0.02) {
        const a = mix.three;
        g.save();
        g.globalAlpha = a;
        const E = eddies();
        const per = 0.8;
        const p = still ? E.length + 1 : (since - 0.4) / per;
        E.forEach(([ex, ey], i) => {
          const pts = [];
          const spin = still ? 0 : t * 0.9;
          for (let q = 0; q <= 22; q++) {
            const an = spin + q * 0.5;
            const rr = 4 + q * (G.small ? 0.8 : 1.25);
            pts.push([ex + Math.cos(an) * rr, ey + Math.sin(an) * rr * 0.7]);
          }
          ink.path(pts, { seed: 100 + i, w: 1.2, alpha: 0.85 });
          if (p > i + 0.4 && !env.mini) {
            ink.marker(ex - 32, ey + 18, 64, 22, { seed: 110 + i, alpha: c.hlAlpha * 0.8 });
            ink.text(UNDER[i], ex, ey + 34, { size: G.small ? 13 : 15, align: 'center' });
          }
        });
        // Check: a loupe visiting each undercurrent
        if (!env.mini && p < E.length + 0.5) {
          const i = clamp(Math.floor(p), 0, E.length - 1);
          const f = smooth((p - Math.floor(p)) / 0.4);
          const [x0, y0] = E[Math.max(0, i - 1)];
          const [x1, y1] = E[i];
          const lx = lerp(x0, x1, i ? f : 1);
          const ly = lerp(y0, y1, i ? f : 1);
          ink.circle(lx, ly, 26, { seed: 120, w: 1.6 });
          ink.line(lx + 19, ly + 19, lx + 34, ly + 34, { seed: 121, w: 2.4 });
        }
        if (!env.mini) {
          const words = [['Check', '健檢暗流'], ['Connect', '連結成果'], ['Cultivate', '有感行動']];
          const hy = G.top + (G.small ? 16 : 22);
          const sp = Math.min(w * 0.3, 200);
          ink.marker(w / 2 - sp - 40, hy - 18, 80, 26, { seed: 133 });
          words.forEach(([en, zh], k) => {
            const x = w / 2 + (k - 1) * sp;
            ink.text(en, x, hy, { font: 'latin', size: G.small ? 13 : 16, weight: 600, align: 'center' });
            if (!G.small) ink.text(zh, x, hy + 20, { size: 13, align: 'center', color: c.ink2 });
            if (k < 2) ink.arrow(x + sp * 0.3, hy - 5, x + sp * 0.7, hy - 5, { seed: 130 + k, w: 1, alpha: 0.6, head: 6 });
          });
          cap('把群體的恐懼，轉化為渴望');
        }
        g.restore();
      }
    },
  };

}
