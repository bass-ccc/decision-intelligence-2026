// 14 衡斷力 Judgment — the character 衡 is a balance: AI piles up the answers, people do the weighing.
// step 0  a pencil balance: glyph answers pile onto the AI pan, the human pan rides up almost empty
// step 1  three generations: 放送 (waves from one tower) → 精準 (lines to individuals) → 演算法 (a glyph swarm in between)
// step 2  Generate ≠ Verify: plausible glyph answer cards; a pencil loupe checks each one, some are 幻覺
// step 3  People Intelligence: Sense 看見問題 · Connect 解決問題 · Judge 決定方向, three pencil marks on a sea of answers
// step 4  Apple × Gemini: AI does the work, the key to the final judgment stays on the human side
// step 5  the five sources of judgment drop onto the human pan one by one, and the beam tips back
// Click: drop one more option onto the scale. It tips, then a pencil has to weigh it: ✓ keep, ✗ 幻覺 falls off.
import { ARTICLES } from '../content.js';
import { rng, hash, noise2, smooth, lerp, approach, clamp } from '../engine/noise.js';

export const hint = '點一下，丟選項上秤';

const COLS = 4; // an answer card = 4 × 2 glyphs
const ROWS = 2;
const PILE = [5, 5, 4, 4, 4, 3, 3, 2, 2, 1, 1]; // the pile on the AI pan, bottom row first
const PILE_MINI = [3, 3, 2, 1];
const ERAS = [
  ['放送世代', '2008 年前'],
  ['精準世代', '2009–2020'],
  ['演算法世代', '後疫情'],
];
const APPLE = ['產品方向', '隱私規範', '使用者體驗'];

export default function make(env) {
  const A = ARTICLES.find((a) => a.no === 14);
  const SOURCES = A ? A.framework.items.map((it) => it[0]) : ['感受與感知', '數據基礎', '趨勢洞察', '經驗判斷', '組織協作'];
  const r = rng(14);
  const HALLU = new Set([2, 7, 9]); // the three plausible-looking answers that turn out to be hallucinations
  let made = 0;
  const newCard = (extra) => {
    const i = made++;
    return {
      d: Array.from({ length: COLS * ROWS }, (_, k) => 0.42 + r() * 0.55 - (k >= COLS ? 0.14 : 0)),
      hallu: extra ? r() < 0.3 : HALLU.has(i),
      seed: i,
      x: 0,
      y: 0,
      cell: 6,
      a: 1,
      extra,
      falling: false,
      vy: 0,
      landedAt: -1,
      off: false,
      offAt: 0,
      vx: 0,
    };
  };
  const SLOT_ROWS = env.mini ? PILE_MINI : PILE;
  const CAP = SLOT_ROWS.reduce((n, k) => n + k, 0);
  const cards = Array.from({ length: env.mini ? 9 : 26 }, () => newCard(false));
  const slots = [];
  SLOT_ROWS.forEach((n, row) => {
    for (let k = 0; k < n; k++) slots.push([k - (n - 1) / 2 + (hash(row, k) - 0.5) * 0.35, row]);
  });

  // crowd of 22 people, the same arrangement in each generation panel
  const crowd = Array.from({ length: 22 }, (_, i) => {
    const a = i * 2.39996;
    const d = Math.sqrt((i + 0.6) / 22);
    return [Math.cos(a) * d + (hash(i, 3) - 0.5) * 0.12, Math.sin(a) * d * 0.62 + (hash(i, 4) - 0.5) * 0.1];
  });
  const TARGETED = [1, 6, 10, 15, 19];

  const mix = { scale: 1, eras: 0, verify: 0, pi: 0, apple: 0, src: 0 };
  let tilt = -0.14;
  let tv = 0;
  let kept = 0;
  let dropped = 0;
  let fullAt = -9;
  let G = {};
  let first = true;

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 10 : 34;
    const bot = mini ? h - 8 : h - 52;
    const H = bot - top;
    G = { w, h, top, bot, H, cx: w / 2 };
    // the balance
    G.L = Math.min(w * (mini ? 0.33 : 0.31), H * (mini ? 0.75 : 0.56), 290);
    G.py = top + H * (mini ? 0.14 : 0.25);
    G.S = Math.min(H * (mini ? 0.44 : 0.34), G.L * 1.05);
    G.PW = G.L * (w < h || mini ? 0.78 : 0.84);
    G.pd = Math.max(5, G.PW * 0.06);
    G.cell = clamp(Math.min(G.PW / (mini ? 15.5 : 25.5), (G.S - 30) / (SLOT_ROWS.length * 2.35)), 3.6, 9);
    G.by = Math.min(bot - (mini ? 2 : 44), G.py + G.S + G.L * 0.42);
    G.bw = G.L * 0.55;
    // generations
    G.ex0 = w * 0.05;
    G.epw = (w * 0.9) / 3;
    G.ehead = top + 22;
    G.efs = clamp(G.epw / 7.5, 13, 19);
    G.esrc = Math.max(top + H * 0.25, G.ehead + G.efs + 62);
    G.ecrowd = top + H * 0.7;
    G.eR = Math.min(G.epw * 0.36, H * 0.13);
    G.eps = clamp(G.eR / 60, 0.6, 1); // people scale
    G.ecell = clamp(G.epw / 50, 3.5, 6.5);
    // verify grid
    G.vcell = clamp(Math.min(w / 34, H / 24), 6, 16);
    G.vmax = H < 420 ? 8 : 16;
    G.vcy = top + H * 0.47;
    // people intelligence band
    G.bandY = top + H * 0.42;
    G.bandH = H * 0.4;
    G.mx = [w * 0.2, w * 0.5, w * 0.8];
    G.pcell = clamp(G.cell * 0.85, 3.4, 6.5);
    // weights on the human pan
    G.wh = clamp((G.S - 26) / 5 - 4, 13, 27);
    G.ww = Math.min(G.PW * 0.86, 128);
  }
  geom();

  // beam ends and pans for the current tilt (negative tilt = AI side down)
  function beam() {
    const ca = Math.cos(tilt);
    const sa = Math.sin(tilt);
    const lx = G.cx - G.L * ca;
    const ly = G.py - G.L * sa;
    const rx = G.cx + G.L * ca;
    const ry = G.py + G.L * sa;
    return { lx, ly, rx, ry, lpx: lx, lpy: ly + G.S, rpx: rx, rpy: ry + G.S };
  }

  const onPan = () => cards.reduce((n, cd) => n + (!cd.off && !cd.falling ? 1 : 0), 0);

  // where card i wants to be in the current step
  function target(cd, i, B, t) {
    const s = env.step;
    if (s === 1) {
      const sx = G.ex0 + G.epw * 2.5;
      const sy = (G.esrc + G.ecrowd) / 2 - G.eR * 0.25;
      const R = Math.min(G.epw * 0.34, (G.ecrowd - G.esrc) * 0.3);
      const a = i * 2.39996 + t * (0.22 + 0.2 * hash(i, 9));
      const rr = R * (0.3 + 0.7 * Math.sqrt(hash(i, 1)));
      return [sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.55, G.ecell, 1];
    }
    if (s === 2) {
      const n = Math.min(G.vmax, cards.length);
      if (i >= G.vmax) return [G.cx + (hash(i, 2) - 0.5) * G.w * 0.5, G.h + 40, G.vcell, 0];
      const rows = Math.ceil(n / 4);
      const px = Math.min(G.w * 0.22, COLS * G.vcell + G.vcell * 4.6);
      const py = Math.min(G.vcell * 2 + 58, (G.H * 0.6) / rows);
      const q = i % 4;
      const row = Math.floor(i / 4);
      return [G.cx + (q - 1.5) * px, G.vcy + (row - (rows - 1) / 2) * py, G.vcell, 1];
    }
    if (s === 3) {
      const n = cards.length;
      const x = G.w * 0.06 + ((i + 0.5) / n) * G.w * 0.88 + (hash(i, 5) - 0.5) * 30;
      const y = G.bandY + (hash(i, 6) - 0.5) * G.bandH * 0.8;
      return [x, y, G.pcell, 0.5];
    }
    // on the AI pan
    const sl = slots[Math.min(i, CAP - 1)];
    const cw = COLS * G.cell + G.cell;
    const ch = ROWS * G.cell + 2.5;
    return [B.lpx + sl[0] * cw, B.lpy - 1 - ch * (sl[1] + 0.5), G.cell, 1];
  }

  // one answer card: 4 × 2 glyphs, optionally in [ brackets ], optionally scrambled to '?'
  function card(cd, x, y, cell, alpha, brackets, scr, t) {
    const { ascii, c } = env;
    if (alpha < 0.02) return;
    const fl = Math.floor(t * 2);
    for (let k = 0; k < COLS * ROWS; k++) {
      const q = k % COLS;
      const row = (k / COLS) | 0;
      const gx = x + (q - (COLS - 1) / 2) * cell;
      const gy = y + (row - (ROWS - 1) / 2) * cell;
      if (scr > 0.5) ascii.glyph(hash(cd.seed, k, fl) < 0.5 ? '?' : ':', gx, gy, cell, c.ink2, alpha * 0.8);
      else ascii.glyph(clamp(cd.d[k] + (hash(cd.seed, k, fl) - 0.5) * 0.12, 0.1, 0.99), gx, gy, cell, c.ink, alpha);
    }
    if (brackets > 0.02) {
      for (let row = 0; row < ROWS; row++) {
        const gy = y + (row - (ROWS - 1) / 2) * cell;
        ascii.glyph('[', x - (COLS / 2 + 0.6) * cell, gy, cell, c.ink2, alpha * brackets);
        ascii.glyph(']', x + (COLS / 2 + 0.6) * cell, gy, cell, c.ink2, alpha * brackets);
      }
    }
  }

  const check = (x, y, s, seed, a = 1) => env.ink.path([[x - s, y - s * 0.1], [x - s * 0.3, y + s * 0.65], [x + s, y - s * 0.9]], { seed, w: 1.7, color: env.c.ink, alpha: 0.95 * a });
  const cross = (x, y, s, seed, a = 1) => {
    env.ink.line(x - s, y - s, x + s, y + s, { seed, w: 1.6, color: env.c.ink, alpha: a });
    env.ink.line(x + s, y - s, x - s, y + s, { seed: seed + 1, w: 1.6, color: env.c.ink, alpha: a });
  };

  // a partial pencil circle (the pencil "weighing" an answer)
  function ring(x, y, rad, k, seed) {
    if (k <= 0) return;
    const n = 26;
    const pts = [];
    const a0 = -2.2;
    for (let i = 0; i <= n * k; i++) {
      const a = a0 + (i / n) * Math.PI * 2.08;
      pts.push([x + Math.cos(a) * rad * (1 + i * 0.002), y + Math.sin(a) * rad * 0.62]);
    }
    env.ink.path(pts, { seed, w: 1.2 });
  }

  // small pencil people: heads and shoulders, batched into two paths
  function people(list, alpha, k = 1) {
    const { g, c } = env;
    g.save();
    g.globalAlpha = alpha * 0.85;
    g.fillStyle = c.pencil;
    g.beginPath();
    for (const [x, y] of list) {
      g.moveTo(x + 2.6 * k, y);
      g.arc(x, y, 2.6 * k, 0, Math.PI * 2);
    }
    g.fill();
    g.strokeStyle = c.pencil;
    g.lineWidth = 1.2;
    g.lineCap = 'round';
    g.beginPath();
    for (const [x, y] of list) {
      g.moveTo(x - 5 * k, y + 9 * k);
      g.quadraticCurveTo(x, y + 2 * k, x + 5 * k, y + 9 * k);
    }
    g.stroke();
    g.restore();
  }

  function weight(x, y, ww, wh, label, seed, alpha, fs) {
    const { g, ink, c } = env;
    if (alpha < 0.02) return;
    g.save();
    g.globalAlpha = alpha;
    const inset = wh * 0.28;
    ink.marker(x - ww / 2 + inset * 0.6, y - wh / 2 + 2, ww - inset * 1.2, wh - 4, { seed: seed + 3 });
    ink.poly([[x - ww / 2 + inset, y - wh / 2], [x + ww / 2 - inset, y - wh / 2], [x + ww / 2, y + wh / 2], [x - ww / 2, y + wh / 2]], { seed, closed: true, w: 1.2 });
    ink.text(label, x, y + fs * 0.36, { size: fs, align: 'center', color: c.ink });
    g.restore();
  }

  // one quiet line of the article under the picture (skipped on tiny canvases)
  function cap(str) {
    if (env.mini || G.H < 230) return;
    env.ink.text(str, G.w / 2, G.bot - 10, { size: clamp(G.w / 26, 13, 15), align: 'center', color: env.c.ink2 });
  }

  function key(x, y, sc, seed) {
    const { ink } = env;
    ink.circle(x, y, 12 * sc, { seed, w: 1.8 });
    ink.circle(x, y, 4 * sc, { seed: seed + 1, w: 1.1, passes: 1 });
    ink.line(x, y + 12 * sc, x, y + 60 * sc, { seed: seed + 2, w: 2 });
    ink.line(x, y + 46 * sc, x + 10 * sc, y + 46 * sc, { seed: seed + 3, w: 1.7 });
    ink.line(x, y + 56 * sc, x + 13 * sc, y + 56 * sc, { seed: seed + 4, w: 1.7 });
  }

  return {
    resize: geom,
    click(x, y) {
      if (cards.length >= CAP) {
        fullAt = env.t;
        return;
      }
      const cd = newCard(true);
      cd.x = x;
      cd.y = y;
      cd.cell = env.step === 2 ? G.vcell : env.step === 1 ? G.ecell : G.cell;
      cd.falling = true;
      cd.vy = -120;
      cards.push(cd);
      dropped++;
    },
    frame(t, dt) {
      const { g, w, h, ink, ascii, c } = env;
      const s = env.step;
      const still = dt === 0;
      const since = still ? 30 : t - env.stepAt;
      const want = { scale: s === 0 || s >= 4 ? 1 : 0, eras: s === 1 ? 1 : 0, verify: s === 2 ? 1 : 0, pi: s === 3 ? 1 : 0, apple: s === 4 ? 1 : 0, src: s === 5 ? 1 : 0 };
      for (const k in mix) mix[k] = still || first ? want[k] : approach(mix[k], want[k], dt, 0.28);

      // ── the beam: answers on the left, judgment on the right ──
      const nW = s === 4 ? 3 : s === 5 ? 5 : 0;
      let human = 0;
      for (let k = 0; k < nW; k++) human += smooth((since - 0.45 - k * 0.38) / 0.3) * (s === 4 ? 0.046 : 0.056);
      const tiltT = clamp(-0.0055 * onPan() + human, -0.3, 0.26);
      if (still || first) {
        tilt = tiltT;
        tv = 0;
      } else {
        tv += ((tiltT - tilt) * 40 - tv * 6.5) * dt;
        tilt += tv * dt;
      }
      const B = beam();

      // ── cards move toward their places ──
      for (let i = 0; i < cards.length; i++) {
        const cd = cards[i];
        const [tx, ty, tc, ta] = target(cd, i, B, t);
        if (cd.off) {
          cd.vy += 1600 * dt;
          cd.y += cd.vy * dt;
          cd.x += cd.vx * dt;
          cd.a = Math.max(0, cd.a - dt * 0.9);
          continue;
        }
        if (cd.falling) {
          cd.vy += 2400 * dt;
          cd.y += cd.vy * dt;
          cd.x = approach(cd.x, tx, dt, 0.09);
          cd.cell = approach(cd.cell, tc, dt, 0.15);
          if (cd.y >= ty || still) {
            cd.y = ty;
            cd.falling = false;
            cd.landedAt = t;
            if (mix.scale > 0.5) tv -= 0.35; // the beam dips as it lands
          }
          continue;
        }
        if (still || first) {
          cd.x = tx;
          cd.y = ty;
          cd.cell = tc;
          cd.a = ta;
        } else {
          const near = Math.hypot(tx - cd.x, ty - cd.y) < 24;
          const hl = near ? 0.06 : 0.3 + hash(i, 7) * 0.25;
          cd.x = approach(cd.x, tx, dt, hl);
          cd.y = approach(cd.y, ty, dt, hl);
          cd.cell = approach(cd.cell, tc, dt, 0.3);
          cd.a = approach(cd.a, ta, dt, 0.25);
        }
        // the pencil weighs every option you drop: ✓ stays, ✗ (hallucination) slides off
        if (cd.extra && cd.landedAt >= 0 && mix.scale > 0.6 && t - cd.landedAt > 1.7 && cd.hallu) {
          cd.off = true;
          cd.vx = -60 - hash(i, 8) * 80;
          cd.vy = -80;
          cd.offAt = t;
        } else if (cd.extra && cd.landedAt >= 0 && t - cd.landedAt > 1.7 && !cd.hallu && !cd.kept) {
          cd.kept = true;
          kept++;
        }
      }
      for (let i = cards.length - 1; i >= 0; i--) if (cards[i].off && (cards[i].a <= 0 || cards[i].y > h + 40)) cards.splice(i, 1);
      first = false;

      // big faint 衡 behind the balance
      if (mix.scale > 0.02) ink.text('衡', G.cx, G.py + G.S * 0.95, { size: Math.min(G.H * 0.6, w * 0.4), align: 'center', color: c.ink, alpha: 0.05 * mix.scale });

      // ── 1 · three generations ──
      if (mix.eras > 0.02) {
        const a = mix.eras;
        g.save();
        g.globalAlpha = a;
        for (let i = 0; i < 3; i++) {
          const pcx = G.ex0 + G.epw * (i + 0.5);
          const fs = G.efs;
          ink.text(ERAS[i][0], pcx, G.ehead + fs, { size: fs, align: 'center' });
          ink.text(ERAS[i][1], pcx, G.ehead + fs + 20, { font: 'mono', size: 12, align: 'center', color: c.ink2 });
          if (i) ink.line(G.ex0 + G.epw * i, G.ehead + 6, G.ex0 + G.epw * i, G.ecrowd + G.eR * 0.8, { seed: 60 + i, w: 0.8, alpha: 0.3, passes: 1 });
          const pts = crowd.map(([u, v]) => [pcx + u * G.eR, G.ecrowd + v * G.eR]);
          const sx = pcx;
          const sy = G.esrc;
          if (i === 0) {
            // one tower, one-way waves over everyone
            ink.line(sx, sy - 16, sx - 10, sy + 14, { seed: 71, w: 1.3 });
            ink.line(sx, sy - 16, sx + 10, sy + 14, { seed: 72, w: 1.3 });
            ink.line(sx - 6, sy + 2, sx + 6, sy + 2, { seed: 73, w: 1 });
            ink.circle(sx, sy - 19, 3, { seed: 74, w: 1 });
            const maxR = G.ecrowd + G.eR * 0.7 - sy;
            g.save();
            g.beginPath();
            g.rect(G.ex0, G.ehead + 40, G.epw - 6, G.ecrowd + G.eR - G.ehead);
            g.clip();
            for (let k = 0; k < 3; k++) {
              const f = (t * 0.28 + k / 3) % 1;
              const rad = 18 + f * maxR;
              const arc = [];
              for (let q = 0; q <= 16; q++) {
                const an = Math.PI * (0.18 + 0.64 * (q / 16));
                arc.push([sx + Math.cos(an) * rad * 1.25, sy + Math.sin(an) * rad]);
              }
              ink.path(arc, { seed: 75 + k, w: 1, alpha: 0.75 * (1 - f) });
            }
            g.restore();
          } else {
            ink.circle(sx, sy, 6, { seed: 80 + i, w: 1.3 });
            ink.dot(sx, sy, 2.2, { seed: 82 + i });
          }
          if (i === 1) {
            for (const [j, p] of TARGETED.entries()) {
              const [px, py] = pts[p];
              ink.blob(px, py + 3, 10, { seed: 90 + j });
              ink.line(sx, sy + 7, px, py - 5, { seed: 95 + j, w: 0.9, alpha: 0.7, passes: 1 });
              const k = (t * 0.45 + j * 0.21) % 1;
              ink.dot(lerp(sx, px, k), lerp(sy + 7, py - 5, k), 1.8, { seed: 99 + j, boil: false });
            }
          }
          if (i === 2) {
            // brand → algorithm (pencil), algorithm → a few people (glyph dots), reshuffled every beat
            const swy = (G.esrc + G.ecrowd) / 2 - G.eR * 0.25;
            ink.line(sx, sy + 7, sx, swy - G.eR * 0.5, { seed: 101, w: 0.9, alpha: 0.6, passes: 1 });
            const beat = Math.floor(t / 1.3);
            for (let j = 0; j < 6; j++) {
              const p = Math.floor(hash(beat, j) * crowd.length);
              const [px, py] = pts[p];
              const ox = sx + (hash(beat, j, 2) - 0.5) * G.eR * 0.9;
              ascii.line(ox, swy + G.eR * 0.25, px, py - 6, 8, c.ink2, 0.8, '·');
              ink.blob(px, py + 3, 8, { seed: 110 + p, alpha: c.hlAlpha * 0.7 });
            }
          }
          people(pts, 1, G.eps);
          if (i === 0) ink.text('品牌', sx + 16, sy - 6, { size: 13, color: c.ink2 });
        }
        // time runs left to right
        const ty = G.ecrowd + G.eR * 0.85 + 22;
        ink.arrow(G.ex0 + 8, ty, G.ex0 + G.epw * 3 - 8, ty, { seed: 120, w: 1, alpha: 0.6, head: 7 });
        cap('工具門檻消失，差距回到使用工具的人身上');
        g.restore();
      }

      // ── 2 · Generate, but not Verify ──
      const nV = Math.min(G.vmax, cards.length);
      let vk = -1;
      let vp = 0;
      if (mix.verify > 0.02) {
        const per = 0.8;
        const p = still ? nV + 0.2 : ((since - 0.6) / per) % (nV + 3.5);
        vk = Math.floor(p);
        vp = p - vk;
        const a = mix.verify;
        g.save();
        g.globalAlpha = a;
        const t0 = target(cards[0], 0, B, t);
        const t3 = target(cards[Math.min(3, nV - 1)], Math.min(3, nV - 1), B, t);
        const gl = t0[0] - COLS * G.vcell;
        const gr = t3[0] + COLS * G.vcell;
        const gy = target(cards[0], 0, B, t)[1] - G.vcell * 2 - 26;
        ascii.text('AI · Generate', gl, gy, 13, c.ink, 0.9);
        ink.text('人 · Verify 核實', gr, gy + 5, { size: 16, align: 'right' });
        const last = target(cards[nV - 1], nV - 1, B, t);
        ink.text('示意', gr, last[1] + G.vcell * 2 + 20, { size: 13, align: 'right', color: c.ink2 });
        cap('能生成最合理的答案，卻無法保證正確');
        g.restore();
      }

      // ── 3 · Sense / Connect / Judge on a sea of answers ──
      if (mix.pi > 0.02) {
        const a = mix.pi;
        const bx0 = w * 0.04;
        const bw = w * 0.92;
        const y0 = G.bandY - G.bandH / 2;
        const lensR = Math.min(G.bandH * 0.32, w * 0.1);
        ascii.field(bx0, y0, bw, G.bandH, 12, (x, y) => {
          const ex = Math.min(1, (x - bx0) / 60, (bx0 + bw - x) / 60);
          const ey = 1 - Math.abs(y - G.bandY) / (G.bandH / 2);
          const n = noise2(x * 0.02, y * 0.03 + t * 0.15);
          const inLens = Math.hypot(x - G.mx[0], y - G.bandY) < lensR;
          // a person clears a little room in the noise around Connect and Judge
          const calm = Math.min(Math.hypot(x - G.mx[1], y - G.bandY), Math.hypot(x - G.mx[2], y - G.bandY)) < lensR * 1.25 ? 0.4 : 1;
          return ex * ey * (0.2 + 0.25 * n) * calm + (inLens ? 0.25 : 0);
        }, c.ink, 0.45 * a);
        g.save();
        g.globalAlpha = a;
        const k0 = still ? 1 : smooth((since - 0.2) / 0.6);
        const k1 = still ? 1 : smooth((since - 0.9) / 0.8);
        const k2 = still ? 1 : smooth((since - 1.7) / 0.6);
        // Sense: a lens that picks one signal out of the noise
        const [m0, m1, m2] = G.mx;
        const yc = G.bandY;
        ink.blob(m0, yc, lensR * 0.55 * k0, { seed: 130 });
        ring(m0, yc, lensR, k0, 131);
        ink.line(m0 + lensR * 0.72, yc + lensR * 0.45, m0 + lensR * 1.25, yc + lensR * 0.85, { seed: 132, w: 2.2, alpha: k0 });
        ascii.glyph('@', m0 - 4, yc - 2, 14, c.ink, k0);
        // Connect: the dots a person links into one line
        const cp = [[-0.95, 0.3], [-0.45, -0.55], [0.05, 0.25], [0.5, -0.45], [0.95, 0.15]].map(([u, v]) => [m1 + u * lensR * 1.2, yc + v * lensR * 0.9]);
        const nn = Math.max(1, Math.round(1 + k1 * (cp.length - 1)));
        if (k1 > 0) ink.path(cp.slice(0, nn), { seed: 140, w: 1.5 });
        cp.forEach(([x, y], j) => {
          if (j < nn) ink.blob(x, y, 7, { seed: 141 + j });
          ink.dot(x, y, 2.6, { seed: 146 + j, alpha: 0.4 + 0.6 * (j < nn ? 1 : 0) });
        });
        // Judge: many glyph directions, one pencil arrow
        const ox = m2 - lensR * 0.9;
        const oy = yc + lensR * 0.55;
        [-1.05, -0.62, 0.05, 0.42].forEach((an) => ascii.line(ox, oy, ox + Math.cos(an) * lensR * 1.5, oy + Math.sin(an) * lensR * 1.5, 9, c.ink2, 0.85, '+'));
        const ja = -0.3;
        const jl = lensR * 2.1 * k2;
        if (k2 > 0.02) {
          ink.marker(ox + Math.cos(ja) * jl - 16, oy + Math.sin(ja) * jl - 10, 30, 20, { seed: 150, alpha: c.hlAlpha * k2 });
          ink.arrow(ox, oy, ox + Math.cos(ja) * jl, oy + Math.sin(ja) * jl, { seed: 151, w: 2, head: 11 });
        }
        ink.dot(ox, oy, 3, { seed: 152 });
        const ly = G.bandY + G.bandH / 2 + 26;
        const fs = clamp(w / 50, 15, 19);
        [['Sense', '看見問題', k0], ['Connect', '解決問題', k1], ['Judge', '決定方向', k2]].forEach(([en, zh, k], j) => {
          ink.text(en, G.mx[j], ly, { font: 'latin', size: fs, weight: 600, align: 'center', alpha: 0.35 + 0.65 * k });
          ink.text(zh, G.mx[j], ly + fs + 6, { size: fs - 1, align: 'center', color: c.ink2, alpha: 0.35 + 0.65 * k });
        });
        if (!env.mini) {
          ink.text('People Intelligence 三核心', w / 2, G.top + 30, { size: 17, align: 'center' });
          cap('一旦放棄思考，人就淪為 AI 答案的接收端');
        }
        g.restore();
      }

      // ── the balance itself ──
      if (mix.scale > 0.02) {
        const a = mix.scale;
        g.save();
        g.globalAlpha = a;
        ink.line(G.cx, G.py + 6, G.cx, G.by, { seed: 1, w: 1.7 });
        ink.line(G.cx - G.bw / 2, G.by, G.cx + G.bw / 2, G.by, { seed: 2, w: 1.7 });
        ink.line(G.cx - G.bw * 0.22, G.by - 9, G.cx + G.bw * 0.22, G.by - 9, { seed: 3, w: 1.1, alpha: 0.7 });
        ink.line(B.lx, B.ly, B.rx, B.ry, { seed: 4, w: 2.2 });
        ink.poly([[G.cx, G.py - 10], [G.cx - 9, G.py + 7], [G.cx + 9, G.py + 7]], { seed: 5, closed: true, w: 1.3 });
        // the needle stands at right angles to the beam
        const na = tilt - Math.PI / 2;
        const nl = Math.min(G.H * 0.09, 50);
        ink.line(G.cx, G.py - 4, G.cx + Math.cos(na) * nl, G.py + Math.sin(na) * nl, { seed: 6, w: 1.2 });
        for (const [ex, ey, px, py, sd] of [[B.lx, B.ly, B.lpx, B.lpy, 10], [B.rx, B.ry, B.rpx, B.rpy, 20]]) {
          const hw = G.PW / 2;
          ink.circle(ex, ey, 3, { seed: sd + 5, w: 1, passes: 1 });
          ink.line(ex, ey + 3, px - hw + 5, py, { seed: sd, w: 0.9, alpha: 0.65, passes: 1 });
          ink.line(ex, ey + 3, px + hw - 5, py, { seed: sd + 1, w: 0.9, alpha: 0.65, passes: 1 });
          const bowl = [];
          for (let q = 0; q <= 12; q++) bowl.push([px - hw + (q / 12) * hw * 2, py + Math.sin((q / 12) * Math.PI) * G.pd]);
          ink.path(bowl, { seed: sd + 2, w: 1.6 });
          ink.line(px - hw, py, px + hw, py, { seed: sd + 3, w: 1, alpha: 0.55, passes: 1 });
        }
        // the human side
        const fs = clamp(G.wh * 0.58, 12, 16);
        const list = s === 5 || (s !== 4 && mix.src > 0.02) ? SOURCES : APPLE;
        const shown = mix.apple > 0.02 ? APPLE : mix.src > 0.02 ? SOURCES : [];
        const wa = mix.apple > 0.02 ? mix.apple : mix.src;
        shown.forEach((lab, k) => {
          const land = still ? 1 : smooth((since - 0.45 - k * 0.38) / 0.3);
          const yy = B.rpy - 2 - (k + 0.5) * (G.wh + 3) - (1 - land) * 90;
          const ww = G.ww * (1 - k * 0.07);
          weight(B.rpx, yy, ww, G.wh, lab, 160 + k * 5 + (list === APPLE ? 0 : 40), wa * clamp(land * 1.6, 0, 1), fs);
        });
        if (!env.mini) {
          const fl = clamp(G.L / 9, 13, 16);
          if (s !== 4) {
            ink.text('AI 生成的答案', B.lpx, B.lpy + G.pd + 24, { size: fl, align: 'center', color: c.ink2 });
            ink.text(s === 5 ? '衡斷力' : '人的衡斷', B.rpx, B.rpy + G.pd + 24, { size: fl, align: 'center', color: c.ink2, alpha: mix.apple > 0.5 ? 0 : 1 });
          }
          if (s === 0) cap('優勢不在誰擁有 AI，而在誰判斷得更好');
          if (mix.apple > 0.02) {
            g.globalAlpha = a * mix.apple;
            ink.text('Gemini', B.lpx, B.lpy + G.pd + 24, { font: 'latin', size: fl + 1, weight: 600, align: 'center' });
            ink.text('協助理解需求、生成內容', B.lpx, B.lpy + G.pd + 24 + fl + 6, { size: fl - 1, align: 'center', color: c.ink2 });
            ink.text('Apple', B.rpx, B.rpy + G.pd + 24, { font: 'latin', size: fl + 1, weight: 600, align: 'center' });
            // the key to the final call hangs on the human side of the pivot
            const kx = G.cx + G.L * 0.2;
            const ky = G.py + Math.sin(tilt) * G.L * 0.2;
            const ks = clamp(G.H / 520, 0.7, 1.2);
            ink.line(kx, ky + 2, kx, ky + 24 * ks, { seed: 170, w: 0.9, passes: 1 });
            const kk = still ? 1 : smooth((since - 0.3) / 0.5);
            g.globalAlpha = a * mix.apple * kk;
            const kb = ky + 24 * ks + 12 * ks;
            ink.blob(kx, kb, 18 * ks, { seed: 171 });
            key(kx, kb, ks, 172);
            ink.text('最終判斷權', kx + 22 * ks, kb + 6, { size: fl + 1, color: c.ink });
            g.globalAlpha = a * mix.apple;
            ink.text('Apple × Google Gemini · 2026 年初', w / 2, G.top + 28, { size: 15, align: 'center', color: c.ink2 });
            cap('企業面對的從來不是答案不夠，而是解法太多');
          }
          if (mix.src > 0.02) {
            g.globalAlpha = a * mix.src;
            ink.text('衡斷力的五大來源', w / 2, G.top + 28, { size: 18, align: 'center' });
            cap('無法用一次 Prompt 生成，要長時間累積與磨練');
          }
        }
        g.restore();
      }

      // ── cards (AI answers), drawn last so they sit on the pan ──
      for (let i = 0; i < cards.length; i++) {
        const cd = cards[i];
        let al = cd.a;
        if (s === 2 && i < nV && !cd.falling) al = cd.a;
        const scr = s === 2 && i < nV && cd.hallu && (vk > i || (vk === i && vp > 0.45)) ? 1 : 0;
        card(cd, cd.x, cd.y, cd.cell, al, s === 2 ? mix.verify : 0, scr, t);
        // the pencil weighing a dropped option on the pan
        if (cd.extra && cd.landedAt >= 0 && mix.scale > 0.6 && !cd.falling) {
          const e = t - cd.landedAt;
          const cw = COLS * cd.cell;
          if (e < 2.4 || cd.off) {
            ring(cd.x, cd.y, cw * 0.85, still ? 1 : clamp((e - 0.35) / 0.5), 300 + cd.seed);
            if (e > 0.9 || still) (cd.hallu ? cross : check)(cd.x + cw * 0.9, cd.y - cd.cell * 1.4, 5, 310 + cd.seed, cd.off ? cd.a : 1);
          }
        }
      }

      // ── 2 · the loupe and its verdicts ──
      if (mix.verify > 0.02) {
        g.save();
        g.globalAlpha = mix.verify;
        for (let i = 0; i < nV; i++) {
          const cd = cards[i];
          if (!(vk > i || (vk === i && vp > 0.45))) continue;
          const cw = COLS * cd.cell;
          if (cd.hallu) {
            cross(cd.x + cw * 0.75, cd.y - cd.cell * 1.2, 6, 200 + i);
            ink.marker(cd.x - 18, cd.y + cd.cell * 1.3 + 2, 36, 18, { seed: 210 + i });
            ink.text('幻覺', cd.x, cd.y + cd.cell * 1.3 + 16, { size: 14, align: 'center' });
          } else check(cd.x + cw * 0.75, cd.y - cd.cell * 1.2, 6, 220 + i);
        }
        if (vk >= 0 && vk < nV) {
          const a0 = cards[Math.max(0, vk - 1)];
          const a1 = cards[vk];
          const mv = smooth(vp / 0.35);
          const lx = vk === 0 ? a1.x : lerp(a0.x, a1.x, mv);
          const ly = vk === 0 ? a1.y : lerp(a0.y, a1.y, mv);
          const R = COLS * G.vcell * 0.72;
          ink.circle(lx, ly, R, { seed: 230, w: 1.6 });
          ink.line(lx + R * 0.7, ly + R * 0.7, lx + R * 1.35, ly + R * 1.35, { seed: 231, w: 2.6 });
        }
        g.restore();
      }

      // counters and notes
      if (!env.mini && dropped) ink.text(`丟上秤 ${dropped} 個選項 · 留下 ${kept} 個`, w - 18, G.top + 18, { font: 'mono', size: 12, align: 'right', color: c.ink2 });
      if (!env.mini && t - fullAt < 2.2) {
        const k = 1 - smooth((t - fullAt - 1.6) / 0.6);
        ink.marker(w / 2 - 100, G.top + 44, 200, 26, { seed: 240, alpha: c.hlAlpha * k });
        ink.text('不是答案不夠，是解法太多', w / 2, G.top + 63, { size: 16, align: 'center', alpha: k });
      }
    },
  };
}
