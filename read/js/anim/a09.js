// 09 討好演算法，還是打動人？ — AI reads what other people say about you, not what you say about yourself.
// step 0  an AI eye (glyphs) reads four pencil speech bubbles (PTT, Dcard, YouTube, Google 評論); the brand's site gets no line
// step 1  the site ranks #1 yet is cited 0 times; real discussions are cited again and again (counts are 示意)
// step 2  the eye becomes the circle of what AI cites, the bubbles the circle of what people retell; the overlap is the target
// step 3  a balance: a heap of mass-produced glyph posts vs one real pencil voice — three forces tip it toward the real
// step 4  efficiency scissors cut the community vine; the bubbles wither and the AI's citation lines vanish with them
// step 5  五大關鍵舉措 as a pencil checklist that ticks itself
// Click a bubble: the AI cites it and your brand appears in its answer.
import { ARTICLES } from '../content.js';
import { rng, hash, clamp, lerp, smooth, approach, noise3 } from '../engine/noise.js';

export const hint = '點泡泡，看 AI 引用誰';

const ART = ARTICLES.find((a) => a.no === 9);
const SOURCES = ['PTT', 'Dcard', 'YouTube', 'Google 評論'];
const RETOLD = ['情緒', '共鳴', '故事', '溫度']; // what people pass on
const CITED = ['規格', '優缺點', '使用情境', '條列式比較']; // what AI likes to quote
const FORCES = [
  ['成本崩跌', '產出不再是門檻'],
  ['技術變精', '分辨真實與業配腔'],
  ['閱聽眾進化', '太完美所以很假'],
];
const BASE = [38, 64, 27, 45]; // 示意 citation counts

export default function make(env) {
  const r = rng(9);
  let G = {};
  const mix = { net: 1, count: 0, venn: 0, scale: 0, cut: 0, list: 0 };
  const cites = []; // { k, t0 } clicks on bubbles
  let note = null; // a click inside the Venn: { x, y, t0, msg }
  let extra = 0; // posts added by clicking the scale
  let tick0 = 0; // checklist restart
  let tilt = -0.16;

  // leaves along the community vine
  const leaves = Array.from({ length: 10 }, () => ({ u: 0.08 + r() * 0.9, s: r() < 0.5 ? -1 : 1, l: 7 + r() * 5 }));

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
    const top = mini ? 10 : 40;
    const bot = mini ? h - 10 : h - 58;
    const H = bot - top;
    const narrow = w < 560;
    G = { top, bot, H, narrow, fs: narrow ? 14 : 16 };
    // the eye and its fan of sources
    G.ew = clamp(Math.min(w * 0.19, H * 0.26), mini ? 30 : 40, 170);
    G.eh = G.ew * 0.52;
    G.rx = Math.min(w * 0.37, H * 0.85);
    G.ry = Math.min(bot - top - G.eh - (mini ? 26 : 70), G.rx * (mini ? 0.98 : 1.2));
    const comp = G.eh + G.ry + (mini ? 16 : 34);
    G.ex = w / 2;
    G.ey = top + Math.max(mini ? 4 : 24, (H - comp) / 2) + G.eh;
    const bh = mini ? clamp(w * 0.08, 18, 30) : clamp(w * 0.062, 40, 60);
    G.bub = [0.94, 0.72, 0.28, 0.06].map((k, i) => {
      const a = k * Math.PI;
      const bw = mini ? bh * 1.7 : Math.max(bh * 2.1, measure(SOURCES[i], 'hand', G.fs) + 28);
      const x = clamp(G.ex + Math.cos(a) * G.rx, bw / 2 + 6, w - bw / 2 - 6);
      return { x, y: G.ey + Math.sin(a) * G.ry, bw, bh, tail: i < 2 ? -1 : 1 };
    });
    G.sw = mini ? w * 0.16 : clamp(w * 0.15, 76, 138);
    G.sh = G.sw * 0.42;
    G.sx = G.ex;
    G.sy = G.ey + G.ry;
    // the vine (step 4): from the site up to a fork, then along the fan through every bubble
    G.jy = G.sy - G.sh / 2 - Math.max(30, H * 0.07);
    const k0 = (G.jy - G.ey) / G.ry;
    G.vine = [-1, 1].map((side) => {
      const pts = [[G.ex, G.jy]];
      for (let i = 1; i <= 26; i++) {
        const u = i / 26;
        const a = Math.PI * (0.5 - side * 0.5 * u);
        const kk = lerp(k0, 1, smooth(u * 2.2));
        pts.push([clamp(G.ex + Math.cos(a) * G.rx * Math.min(1, 0.25 + u * 1.2), 10, w - 10), G.ey + Math.sin(a) * G.ry * kk]);
      }
      return pts;
    });
    // Venn
    G.vr = Math.min(w * 0.25, H * 0.34);
    G.vd = G.vr * 0.58;
    G.vy = top + H * 0.47;
    // scale
    G.px = w / 2;
    G.py = top + H * 0.62;
    G.bl = Math.min(w * 0.31, H * 0.5, 240);
    G.pw = G.bl * 0.95;
    G.post = narrow ? 18 : Math.max(30, G.pw * 0.17);
    G.hh = Math.min(G.pw * 0.75, G.py - G.post - (top + (narrow ? 40 : 66)) - G.bl * 0.2);
    G.base = top + H * 0.95;
    // checklist
    // centre the list on its widest line
    const fsl = narrow ? 16 : 19;
    const lead = (narrow ? 18 + 12 + 24 : 22 + 18 + 30);
    const widest = Math.max(...ART.framework.items.map(([hd, sub]) => Math.max(measure(hd.slice(3), 'hand', fsl), narrow ? 0 : measure(sub, 'hand', 13))));
    G.cx0 = Math.max(16, (w - lead - widest) / 2);
    G.rh = Math.min(H / 5.4, narrow ? 54 : 96);
    G.cy0 = top + (H - G.rh * 5) / 2 + G.rh * 0.42;
  }
  geom();

  // rounded speech bubble outline (centre x,y); tail -1 = bottom-left, 1 = bottom-right
  function bubblePts(x, y, bw, bh, tail) {
    const rr = Math.min(12, bh * 0.4);
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
      pts.push([tx + 6, y1], [tx + tail * 7, y1 + Math.min(12, bh * 0.35)], [tx - 6, y1]);
    }
    arc(x0 + rr, y1 - rr, Math.PI / 2);
    arc(x0 + rr, y0 + rr, Math.PI);
    pts.push(pts[0]);
    return pts;
  }

  function fillPts(pts, color, a) {
    const g = env.g;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = color;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.fill();
    g.restore();
  }

  // the first k (0..1) of a polyline, by length
  function partial(pts, k) {
    if (k >= 1) return pts;
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let want = L * clamp(k);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d >= want) {
        const f = want / (d || 1);
        out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]);
        return out;
      }
      want -= d;
      out.push(pts[i]);
    }
    return out;
  }

  // one line of monospace (the AI's voice), with alignment
  function mono(str, x, y, size, color, a, align = 'left') {
    const wd = measure(str, 'mono', size, 500);
    env.ascii.text(str, align === 'center' ? x - wd / 2 : align === 'right' ? x - wd : x, y, size, color, a);
    return wd;
  }

  // AI: an eye of glyphs (m = 0) that becomes the "AI 會引用的" circle (m = 1)
  function drawAI(cx, cy, ax, ay, m, a, look, blink) {
    if (a < 0.02) return;
    const { ascii, c } = env;
    const cell = env.mini ? 7 : clamp(ax / 15, 8, 11);
    const lx = look ? clamp((look[0] - cx) / (ax * 2.2), -1, 1) * ax * 0.3 : 0;
    const ly = look ? clamp((look[1] - cy) / (ay * 4), -1, 1) * ay * 0.22 : 0;
    const ir = ay * 0.84;
    const pr = ir * 0.4;
    const cols = Math.ceil(ax / cell) + 1;
    const rows = Math.ceil(ay / cell) + 1;
    const tt = env.t;
    for (let j = -rows; j <= rows; j++) {
      const dy = j * cell;
      for (let i = -cols; i <= cols; i++) {
        const dx = i * cell;
        const u = dx / ax;
        const lid = ay * (1 - u * u) * blink;
        const eIn = Math.abs(u) < 1 && lid > 0.5 ? Math.abs(dy) / lid : 9;
        const e = lerp(eIn, Math.hypot(dx / ax, dy / ay), m);
        if (e > 1) continue;
        let ch;
        let al = 1;
        if (m < 0.5) {
          // lids, white, iris fibres, pupil with a catch-light
          const ix = dx - lx;
          const iy = dy - ly;
          const di = Math.hypot(ix, iy);
          if (e > 0.8) ch = '=';
          else if (di < pr) {
            if ((ix + pr * 0.38) ** 2 + (iy + pr * 0.42) ** 2 < (pr * 0.4) ** 2) continue;
            ch = '@';
          } else if (di < ir * 0.8) {
            const an = ((Math.atan2(iy, ix) % Math.PI) + Math.PI) % Math.PI;
            ch = '-\\|/'[Math.round(an / (Math.PI / 4)) % 4];
            al = 0.85;
          } else if (di < ir) ch = '0';
          else {
            ch = '·';
            al = 0.5;
          }
        } else if (e > 0.93) ch = ':';
        else {
          const v = noise3(dx * 0.014 + cx * 0.001, dy * 0.014, tt * 0.12);
          if (v < 0.05) continue;
          ch = v > 0.4 ? ':' : '·';
          al = 0.65;
        }
        ascii.glyph(ch, cx + dx, cy + dy, cell, c.ink, a * al);
      }
    }
  }

  // a dotted citation line from a source to the eye; `fall` breaks it apart (step 4)
  function ray(x1, y1, x2, y2, a, fall, seed) {
    if (a < 0.02) return;
    const cell = env.mini ? 6 : 10;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.floor(len / (cell * 1.25)));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const f = fall * (20 + ((i * 37 + seed * 11) % 50));
      env.ascii.glyph('·', lerp(x1, x2, k), lerp(y1, y2, k) + f, cell, env.c.ink, a * 0.95 * (1 - fall));
    }
  }

  // where a ray leaves a bubble and where it meets the eye
  function rayEnds(b, cx, cy, ax, ay) {
    const dx = cx - b.x;
    const dy = cy - b.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const tb = Math.min(b.bw / 2 / (Math.abs(ux) || 1e-3), b.bh / 2 / (Math.abs(uy) || 1e-3)) + 5;
    const te = 1 / Math.sqrt((ux / ax) ** 2 + (uy / ay) ** 2) + 4;
    return [b.x + ux * tb, b.y + uy * tb, cx - ux * te, cy - uy * te];
  }

  function scissors(x, y, open, a) {
    const { ink } = env;
    const L = env.mini ? 26 : 58;
    // two blades from the pivot to the left, two finger loops to the right
    for (const s of [-1, 1]) {
      const ang = Math.PI + s * open;
      const tx = x + Math.cos(ang) * L;
      const ty = y + Math.sin(ang) * L;
      const nx = -Math.sin(ang) * 5 * s;
      const ny = Math.cos(ang) * 5 * s;
      ink.path([[x, y], [lerp(x, tx, 0.45) + nx, lerp(y, ty, 0.45) + ny], [tx, ty], [lerp(x, tx, 0.5), lerp(y, ty, 0.5)], [x, y]], { seed: 70 + s, w: 1.3, alpha: a });
      const hx = x - Math.cos(ang) * 22;
      const hy = y - Math.sin(ang) * 22 * 1.4;
      ink.line(x, y, hx, hy, { seed: 72 + s, w: 1.3, alpha: a });
      ink.circle(hx + 9, hy + s * 4, 9, { seed: 74 + s, w: 1.3, alpha: a });
    }
    ink.dot(x, y, 2.4, { alpha: a, seed: 76 });
  }

  const sourceAt = (x, y) => G.bub.findIndex((b) => Math.abs(x - b.x) < b.bw / 2 + 8 && Math.abs(y - b.y) < b.bh / 2 + 10);

  return {
    resize: geom,
    step(i) {
      if (i === 5) tick0 = env.t;
    },
    click(x, y) {
      const s = env.step;
      if (mix.venn > 0.6) {
        const dl = Math.hypot(x - (env.w / 2 - G.vd), y - G.vy) < G.vr;
        const dr = Math.hypot(x - (env.w / 2 + G.vd), y - G.vy) < G.vr;
        if (dl || dr) note = { x, y, t0: env.t, msg: dl && dr ? '人說得出口，AI 也引用得到' : dl ? '人會轉述，AI 卻抓不到重點' : '精準完整，卻沒有人想轉述', both: dl && dr };
        return;
      }
      if (mix.scale > 0.6) {
        extra = Math.min(extra + 60, 600);
        return;
      }
      if (mix.list > 0.6) {
        tick0 = env.t;
        return;
      }
      if (s === 4) return;
      let k = sourceAt(x, y);
      if (k < 0) {
        // nearest bubble if the click was close to one
        let best = 1e9;
        G.bub.forEach((b, i) => {
          const d = Math.hypot(x - b.x, y - b.y);
          if (d < best) [best, k] = [d, i];
        });
        if (best > 120) return;
      }
      cites.push({ k, t0: env.t });
      if (cites.length > 8) cites.shift();
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c, acc, pointer, mini } = env;
      const s = mini ? 0 : env.step;
      const still = dt === 0 || env.reduced;
      const ph = still ? 30 : t - env.stepAt;
      const want = {
        net: s <= 1 || s === 4 ? 1 : 0,
        count: s === 1 ? 1 : 0,
        venn: s === 2 ? 1 : 0,
        scale: s === 3 ? 1 : 0,
        cut: s === 4 ? 1 : 0,
        list: s === 5 ? 1 : 0,
      };
      for (const k in mix) mix[k] = dt > 0 ? approach(mix[k], want[k], dt, 0.4) : want[k];
      const vw = mix.net + mix.venn;
      const m = vw > 0.01 ? mix.venn / vw : 0;

      // step 4 timeline: the vine grows, the scissors come in, snip, everything withers
      const grow = s === 4 ? smooth(ph / 0.9) : mix.cut > 0.02 ? 1 : 0;
      const slide = s === 4 ? smooth((ph - 0.9) / 0.8) : 1;
      const snip = s === 4 ? smooth((ph - 1.7) / 0.3) : 0;
      const wither = s === 4 ? smooth((ph - 2.0) / 1.2) : 0;

      // who is being cited right now
      let lit = -1;
      let litK = 0;
      for (const ct of cites) {
        const k = 1 - (t - ct.t0) / 3.2;
        if (k > litK) [lit, litK] = [ct.k, k];
      }
      const auto = Math.floor(t / 2.6) % 4;
      const reading = lit >= 0 ? lit : auto;

      // ── the network: rays, bubbles, the site, the eye ──
      const ex = lerp(G.ex, w / 2 + G.vd, m);
      const ey = lerp(G.ey, G.vy, m);
      const ax = lerp(G.ew, G.vr, m);
      const ay = lerp(G.eh, G.vr, m);
      if (vw > 0.02) {
        // the Venn's human circle (behind the bubbles)
        if (mix.venn > 0.02) {
          const lx = w / 2 - G.vd;
          const a = mix.venn;
          g.save();
          g.globalAlpha = a;
          // overlap: the target, in highlighter
          g.save();
          g.beginPath();
          g.arc(lx, G.vy, G.vr, 0, Math.PI * 2);
          g.clip();
          g.beginPath();
          g.arc(w / 2 + G.vd, G.vy, G.vr, 0, Math.PI * 2);
          g.fillStyle = acc;
          g.globalAlpha = a * c.hlAlpha;
          g.fill();
          g.restore();
          ink.circle(lx, G.vy, G.vr, { seed: 21, w: 1.4 });
          // light hatching for the human side, in one batch
          g.save();
          g.beginPath();
          g.arc(lx, G.vy, G.vr, 0, Math.PI * 2);
          g.clip();
          g.strokeStyle = c.pencil;
          g.lineWidth = 0.8;
          g.globalAlpha = a * 0.22;
          g.beginPath();
          const hr = rng(31 + env.boil);
          for (let d = -G.vr * 1.5; d < G.vr * 1.5; d += 9) {
            g.moveTo(lx + d - G.vr + hr() * 2, G.vy + G.vr);
            g.lineTo(lx + d + G.vr + hr() * 2, G.vy - G.vr);
          }
          g.stroke();
          g.restore();
          if (!mini) {
            const fs = G.narrow ? 15 : 18;
            ink.text('人會轉述的', lx - G.vr * 0.35, G.vy - G.vr - 14, { size: fs, align: 'center' });
            ink.text('AI 會引用的', w / 2 + G.vd + G.vr * 0.35, G.vy - G.vr - 14, { size: fs, align: 'center' });
            // the intersection
            const ly = G.vy + G.vr + (G.narrow ? 24 : 34);
            ink.arrow(w / 2, ly - (G.narrow ? 16 : 20), w / 2, G.vy + G.vr * 0.55, { seed: 23, w: 1.1, head: 7 });
            ink.text('真人願意說出口 × 具體到 AI 願意引用', w / 2, ly, { size: G.narrow ? 14 : 17, align: 'center' });
            // AI words, in its own voice
            CITED.forEach((wd, i) => {
              const yy = G.vy + (i - 1.5) * G.vr * 0.32;
              mono(wd, w / 2 + G.vd + G.vr * 0.47, yy, G.narrow ? 13 : 14, c.ink, smooth((a - 0.4) / 0.6), 'center');
            });
          }
          g.restore();
        }

        // rays (network only)
        const ends = G.bub.map((b) => rayEnds(b, G.ex, G.ey, G.ew, G.eh));
        if (mix.net > 0.02) {
          G.bub.forEach((b, k) => {
            const [x1, y1, x2, y2] = ends[k];
            const a = mix.net * (1 - wither);
            if (k === lit && litK > 0 && a > 0.1) {
              g.save();
              g.strokeStyle = acc;
              g.lineCap = 'round';
              g.lineWidth = mini ? 4 : 7;
              g.globalAlpha = c.hlAlpha * smooth(litK * 2) * a;
              g.beginPath();
              g.moveTo(x1, y1);
              g.lineTo(x2, y2);
              g.stroke();
              g.restore();
            }
            ray(x1, y1, x2, y2, mix.net * (k === reading ? 1 : 0.7), wither, k);
            // reading packets travelling to the eye
            if (wither < 0.5) {
              for (let j = 0; j < 2; j++) {
                const u = (t * (0.3 + k * 0.04) + k * 0.29 + j * 0.5) % 1;
                ascii.glyph('10#'[(j + k) % 3], lerp(x1, x2, u), lerp(y1, y2, u), mini ? 8 : 11, c.ink, a * Math.sin(u * Math.PI));
              }
              if (k === lit) {
                const u = clamp((3.2 - litK * 3.2) / 0.7);
                if (u < 1) ascii.glyph('#', lerp(x1, x2, u), lerp(y1, y2, u), mini ? 11 : 16, c.ink, a);
              }
            }
          });
        }

        // the vine of community (step 4)
        if (mix.cut > 0.02 && grow > 0.01) {
          const a = mix.cut;
          const cy = (G.sy - G.sh / 2 + G.jy) / 2;
          const trunkA = [[G.ex, G.sy - G.sh / 2], [G.ex, snip > 0.5 ? cy + 5 : G.jy]];
          ink.path(partial(trunkA, grow * 3), { seed: 50, w: 1.6, alpha: a });
          if (snip > 0.5) ink.path([[G.ex, cy - 5 - wither * 6], [G.ex, G.jy]], { seed: 51, w: 1.6, alpha: a * (1 - wither * 0.6) });
          G.vine.forEach((pts, side) => {
            const pp = partial(pts, (grow - 0.15) / 0.85);
            if (pp.length > 1) {
              const va = a * (1 - wither * 0.65);
              if (wither > 0.05) g.setLineDash([4, 5]);
              ink.path(pp, { seed: 52 + side, w: 1.4, alpha: va });
              g.setLineDash([]);
              leaves.forEach((lf, i) => {
                if ((i % 2) !== side || lf.u > (grow - 0.15) / 0.85) return;
                const q = pts[Math.floor(lf.u * (pts.length - 1))];
                const q2 = pts[Math.min(pts.length - 1, Math.floor(lf.u * (pts.length - 1)) + 1)];
                const an = Math.atan2(q2[1] - q[1], q2[0] - q[0]) + lf.s * 0.9;
                const droop = wither * 0.9 * lf.s;
                const tx = q[0] + Math.cos(an + droop) * lf.l;
                const ty = q[1] + Math.sin(an + droop) * lf.l + wither * 4;
                const nx = -Math.sin(an + droop) * 3;
                const ny = Math.cos(an + droop) * 3;
                ink.path([[q[0], q[1]], [lerp(q[0], tx, 0.5) + nx, lerp(q[1], ty, 0.5) + ny], [tx, ty], [lerp(q[0], tx, 0.5) - nx, lerp(q[1], ty, 0.5) - ny], [q[0], q[1]]], { seed: 60 + i, w: 1, alpha: va });
              });
            }
          });
          if (!mini && grow > 0.5 && snip < 0.5) ink.text('社群', G.ex + 10, G.jy - 8, { size: G.fs, color: c.ink2, alpha: a * smooth((grow - 0.5) * 2) });
          // the scissors
          if (slide > 0.01) {
            const sxp = G.ex + 34 + (1 - slide) * Math.min(220, w * 0.3);
            scissors(sxp, cy, lerp(0.42, 0.04, snip), a * slide);
            if (!mini) {
              const lx = Math.min(sxp + 64, w - measure('效率邏輯', 'hand', G.fs) - 8);
              ink.text('效率邏輯', lx, cy - 2, { size: G.fs, alpha: a * slide });
              if (!G.narrow) ink.text('只看最後一哩成效', lx, cy + 18, { size: 13, color: c.ink2, alpha: a * slide });
            }
          }
        }

        // bubbles: sources in the network, words in the Venn
        G.bub.forEach((b, k) => {
          const word = RETOLD[k];
          const lx = w / 2 - G.vd - G.vr * 0.45;
          const vx = lx;
          const vyy = G.vy + (k - 1.5) * G.vr * 0.36;
          const bw = lerp(b.bw, measure(word, 'hand', G.fs) + 22, m);
          const bh = lerp(b.bh, G.narrow ? 26 : 32, m);
          const x = lerp(b.x, vx, m);
          const y = lerp(b.y, vyy, m) + wither * 10;
          const a = vw * (1 - wither * 0.6);
          if (a < 0.02) return;
          const pts = bubblePts(x, y, bw, bh, m > 0.5 ? 0 : b.tail);
          fillPts(pts, c.sheet, a * 0.85);
          if (k === lit && litK > 0 && m < 0.5) ink.marker(x - bw / 2 + 4, y - bh / 2 + 4, bw - 8, bh - 8, { seed: 80 + k, alpha: c.hlAlpha * smooth(litK * 2) * a });
          if (wither > 0.05) g.setLineDash([5, 5]);
          ink.path(pts, { seed: 10 + k, w: 1.2, alpha: a });
          g.setLineDash([]);
          // a couple of handwritten lines: somebody's real experience
          const sa = a * (1 - m);
          if (sa > 0.02) {
            g.save();
            g.strokeStyle = c.pencil;
            g.globalAlpha = sa * 0.55;
            g.lineWidth = 1;
            g.lineCap = 'round';
            g.beginPath();
            const sr = rng(k * 13 + env.boil);
            for (let j = 0; j < 2; j++) {
              const yy = mini ? y - bh * 0.12 + j * bh * 0.3 : y + bh * 0.1 + j * 7;
              const x0 = x - bw * 0.32;
              const len = bw * (j ? 0.38 : 0.64);
              g.moveTo(x0, yy);
              for (let q = 1; q <= 8; q++) g.lineTo(x0 + (q / 8) * len, yy + (q % 2 ? -1.4 : 1.4) + sr() * 0.8);
            }
            g.stroke();
            g.restore();
            // the person who said it
            if (!mini) {
              const hx = x + b.tail * (bw * 0.24 + 10);
              const hy = y + bh / 2 + 20;
              g.save();
              g.globalAlpha = sa;
              ink.circle(hx, hy, 5.5, { seed: 30 + k, w: 1.1, passes: 1 });
              ink.path([[hx - 10, hy + 17], [hx - 8, hy + 10], [hx, hy + 7.5], [hx + 8, hy + 10], [hx + 10, hy + 17]], { seed: 34 + k, w: 1.1, passes: 1 });
              g.restore();
            }
          }
          if (mini) return;
          if (m < 0.98) ink.text(SOURCES[k], x, y + 5 - bh * 0.16 * (1 - m), { size: G.fs, align: 'center', alpha: a * (1 - smooth(m * 2)) });
          if (m > 0.02) ink.text(word, x, y + 5, { size: G.fs, align: 'center', alpha: a * smooth(m * 2 - 1) });
          // citation counts (示意)
          if (mix.count > 0.02) {
            const n = BASE[k] + Math.floor(Math.max(0, ph) * (0.6 + k * 0.17)) + cites.filter((ct) => ct.k === k).length;
            ink.text(`×${n}`, x + bw / 2 + 4, y - bh / 2 - 2, { font: 'mono', size: 16, alpha: mix.count });
          }
        });

        // the brand's own site: a neat glyph box, never cited
        const sa = mix.net;
        if (sa > 0.02) {
          const { sx, sy, sw, sh } = G;
          const cell = mini ? 6 : 8;
          g.save();
          g.globalAlpha = sa * 0.9;
          g.fillStyle = c.sheet;
          g.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
          g.restore();
          for (let x = sx - sw / 2; x <= sx + sw / 2 + 0.1; x += cell) {
            ascii.glyph('-', x, sy - sh / 2, cell, c.ink, sa * 0.8);
            ascii.glyph('-', x, sy + sh / 2, cell, c.ink, sa * 0.8);
          }
          for (let y = sy - sh / 2 + cell; y < sy + sh / 2 - 1; y += cell) {
            ascii.glyph('|', sx - sw / 2, y, cell, c.ink, sa * 0.8);
            ascii.glyph('|', sx + sw / 2, y, cell, c.ink, sa * 0.8);
          }
          if (!mini) {
            mono('品牌官網', sx, sy - sh * 0.08, 13, c.ink, sa, 'center');
            ascii.text('=========='.slice(0, Math.floor(sw / 9)), sx - sw * 0.34, sy + sh * 0.24, 8, c.ink2, sa * 0.8);
          } else {
            for (let j = 0; j < 2; j++) for (let x = sx - sw * 0.3; x < sx + sw * 0.3; x += cell) ascii.glyph('=', x, sy - 3 + j * 7, cell, c.ink, sa * 0.6);
          }
          if (mix.count > 0.02 && !mini) {
            const a = mix.count;
            const fs = G.narrow ? 13 : 15;
            const t1 = '搜尋排名 #1';
            ink.text(t1, sx - sw / 2 - 12, sy + 5, { size: fs, align: 'right', alpha: a });
            const t2 = 'AI 引用 ×0';
            const tw = measure(t2, 'hand', fs);
            ink.marker(sx + sw / 2 + 8, sy - 11, tw + 10, 22, { seed: 88, alpha: c.hlAlpha * a });
            ink.text(t2, sx + sw / 2 + 13, sy + 5, { size: fs, alpha: a });
            ink.text('示意', w - 14, G.bot - 4, { size: 13, align: 'right', color: c.ink2, alpha: a });
          }
        }

        // the eye (and, in the Venn, the AI circle)
        const blinkPh = (t % 4.7) / 4.7;
        const blink = still || m > 0.5 ? 1 : 1 - 0.92 * Math.max(0, 1 - Math.abs(blinkPh - 0.97) / 0.025);
        let look = G.bub[reading] ? [G.bub[reading].x, G.bub[reading].y] : null;
        if (lit < 0 && pointer.in) look = [pointer.x, pointer.y];
        if (wither > 0.5) look = [G.ex, G.ey + 200];
        const eyeA = vw * (1 - wither * 0.45);
        drawAI(ex, ey, ax, ay, m, eyeA, look, lerp(blink, 1, m) * (1 - wither * 0.5));

        // question (human) and answer (AI) on either side of the eye
        const qa = G.narrow ? 0 : mix.net * (1 - mix.count) * (1 - mix.cut);
        if (!mini && mix.net > 0.02) {
          const fs = G.narrow ? 14 : 16;
          const qy = G.ey - G.eh * 0.55;
          if (qa > 0.02) {
            const q = '哪個牌子好？';
            const bw = measure(q, 'hand', fs) + 22;
            const bx = G.ex - G.ew - 18 - bw / 2;
            const pts = bubblePts(bx, qy, bw, fs + 16, 1);
            fillPts(pts, c.sheet, qa * 0.85);
            ink.path(pts, { seed: 40, w: 1.2, alpha: qa });
            ink.text(q, bx, qy + fs * 0.35, { size: fs, align: 'center', alpha: qa });
          }
          // the AI's answer card
          const fsm = 13;
          const cut = wither > 0.5;
          const l1 = cut ? '推薦：——' : '推薦：你的品牌';
          const l2 = cut ? '沒有素材推薦你' : `依據：${SOURCES[reading]}`;
          const cw = Math.max(measure(l1, 'mono', fsm, 500), measure(l2, 'mono', fsm, 500)) + 20;
          // beside the eye; on a phone, tucked under it
          const cx0 = G.narrow ? G.ex - cw / 2 : Math.min(G.ex + G.ew + 16, w - cw - 6);
          const cy0 = G.narrow ? G.ey + G.eh + 8 : qy - fsm - 8;
          const ca = mix.net * (G.narrow ? 1 - mix.cut : 1);
          g.save();
          g.globalAlpha = ca * 0.9;
          g.fillStyle = c.sheet;
          g.fillRect(cx0, cy0, cw, fsm * 2 + 22);
          g.restore();
          ascii.line(cx0, cy0, cx0 + cw, cy0, 7, c.ink, ca * 0.7, '·');
          ascii.line(cx0, cy0 + fsm * 2 + 22, cx0 + cw, cy0 + fsm * 2 + 22, 7, c.ink, ca * 0.7, '·');
          if (lit >= 0 && litK > 0 && !cut) {
            const pre = measure('推薦：', 'mono', fsm, 500);
            ink.marker(cx0 + 10 + pre - 2, cy0 + 6, measure('你的品牌', 'mono', fsm, 500) + 4, fsm + 6, { seed: 89, alpha: c.hlAlpha * smooth(litK * 2) * ca });
          }
          mono(l1, cx0 + 10, cy0 + 8 + fsm * 0.6, fsm, c.ink, ca);
          mono(l2, cx0 + 10, cy0 + 14 + fsm * 1.6, fsm, cut ? c.ink : c.ink2, ca);
        }
      }

      // the Venn: a short verdict where the reader clicked
      if (note && mix.venn > 0.3 && !mini) {
        const k = 1 - (t - note.t0) / 2.8;
        if (k > 0) {
          const a = smooth(k * 3) * mix.venn;
          const fs = G.narrow ? 13 : 15;
          const tw = measure(note.msg, 'hand', fs) + 16;
          const nx = clamp(note.x, tw / 2 + 6, w - tw / 2 - 6);
          const ny = clamp(note.y - 26, G.top + 10, G.bot - 10);
          g.save();
          g.globalAlpha = a * 0.92;
          g.fillStyle = c.sheet;
          g.fillRect(nx - tw / 2, ny - fs, tw, fs + 12);
          g.restore();
          if (note.both) ink.marker(nx - tw / 2 + 3, ny - fs + 2, tw - 6, fs + 8, { seed: 91, alpha: c.hlAlpha * a });
          ink.text(note.msg, nx, ny + 2, { size: fs, align: 'center', alpha: a });
          ink.dot(note.x, note.y, 3, { alpha: a, seed: 92 });
        } else note = null;
      }

      // ── the balance: mass-produced vs real ──
      if (mix.scale > 0.02 && !mini) {
        const a = mix.scale;
        const forceAt = (k) => 0.6 + k * 1.0;
        const nForce = s === 3 ? [0, 1, 2].filter((k) => ph > forceAt(k)).length : 3;
        const target = [-0.16, -0.05, 0.07, 0.17][nForce];
        tilt = dt > 0 ? approach(tilt, target, dt, 0.35) : target;
        g.save();
        g.globalAlpha = a;
        // three forces
        const fs = G.narrow ? 14 : 17;
        FORCES.forEach(([name, sub], k) => {
          const fa = s === 3 ? smooth((ph - forceAt(k)) / 0.4) : 1;
          const fx = w * (0.2 + k * 0.3);
          const fy = G.top + 12;
          g.save();
          g.globalAlpha = a * (0.25 + 0.75 * fa);
          ink.circle(fx - measure(name, 'hand', fs) / 2 - 16, fy - fs * 0.35, 10, { seed: 100 + k, w: 1 });
          ink.text(String(k + 1), fx - measure(name, 'hand', fs) / 2 - 16, fy - fs * 0.35 + 5, { font: 'mono', size: 13, align: 'center' });
          ink.text(name, fx, fy, { size: fs, align: 'center' });
          if (!G.narrow) ink.text(sub, fx, fy + 21, { size: 13, align: 'center', color: c.ink2 });
          g.restore();
        });
        // stand and beam; the two plates ride on short posts, so they stay level
        const { px, py, bl, pw } = G;
        ink.line(px, py, px, G.base, { seed: 110, w: 1.5 });
        ink.path([[px - 46, G.base], [px - 14, G.base - 6], [px + 14, G.base - 6], [px + 46, G.base]], { seed: 111, w: 1.5 });
        const ca = Math.cos(tilt);
        const sa = Math.sin(tilt);
        const L = [px - bl * ca, py - bl * sa];
        const R = [px + bl * ca, py + bl * sa];
        ink.line(L[0], L[1], R[0], R[1], { seed: 112, w: 1.8 });
        ink.circle(px, py, 5, { seed: 113, w: 1.2 });
        const plate = (P, seed) => {
          const y0 = P[1] - G.post;
          ink.line(P[0], P[1], P[0], y0 + pw * 0.08, { seed, w: 1.4 });
          ink.path([[P[0] - pw / 2, y0 - 2], [P[0] - pw * 0.3, y0 + pw * 0.06], [P[0], y0 + pw * 0.08], [P[0] + pw * 0.3, y0 + pw * 0.06], [P[0] + pw / 2, y0 - 2]], { seed: seed + 2, w: 1.5 });
          return y0;
        };
        const ly0 = plate(L, 120);
        const ry0 = plate(R, 130);
        // the heap: posts keep coming, ever cheaper (clicks pile on more; the beam does not care)
        const cell = G.narrow ? 8 : 10;
        const nPosts = Math.floor((s === 3 ? Math.max(0, ph) : 30) * 110) + extra;
        const hw = pw * 0.48;
        const hh = G.hh * (1 + extra / 400);
        const rows = Math.max(3, Math.floor(hh / (cell * 0.85)));
        let n = 0;
        for (let j = 0; j < rows && n < nPosts; j++) {
          const half = hw * (1 - Math.pow(j / rows, 1.5));
          const y = ly0 - cell * 0.3 - j * cell * 0.85;
          for (let x = -half; x <= half && n < nPosts; x += cell * 0.78, n++) {
            const q = hash(j, Math.round(x * 3));
            const flagged = (q < 0.22 && nForce >= 2) || (q > 0.82 && nForce >= 3);
            const ch = flagged ? (q < 0.22 ? 'X' : '?') : '=#[]=1=0'[Math.floor(q * 97) % 8];
            ascii.glyph(ch, L[0] + x, y, cell, flagged ? c.ink2 : c.ink, flagged ? 0.5 : 0.85);
          }
        }
        // one real voice
        const vfs = G.narrow ? 13 : 16;
        const l1 = '真實的人，';
        const l2 = '具體地說你好';
        const bw = measure(l2, 'hand', vfs) + 24;
        const bh = vfs * 2 + 22;
        const by = ry0 - bh / 2 - 16;
        ink.blob(R[0], by, bh * 0.62, { seed: 140 });
        const pts = bubblePts(R[0], by, bw, bh, -1);
        ink.path(pts, { seed: 141, w: 1.3 });
        ink.text(l1, R[0], by - 3, { size: vfs, align: 'center' });
        ink.text(l2, R[0], by + vfs + 2, { size: vfs, align: 'center' });
        // verdicts under the pans
        const lfs = G.narrow ? 15 : 18;
        ink.text('量產變便宜', L[0], L[1] + lfs + 18, { size: lfs, align: 'center' });
        ink.text('真實變最貴', R[0], R[1] + lfs + 18, { size: lfs, align: 'center' });
        g.restore();
      }

      // ── 五大關鍵舉措: a checklist that ticks itself ──
      if (mix.list > 0.02 && !mini) {
        const a = mix.list;
        const { cx0, cy0, rh } = G;
        const lp = still ? 30 : t - tick0;
        const fs = G.narrow ? 16 : 19;
        ART.framework.items.forEach(([head, sub], k) => {
          const y = cy0 + k * rh;
          const num = head.slice(0, 2);
          const title = head.slice(3);
          const tk = clamp((lp - 0.5 - k * 0.55) / 0.35);
          const bx = cx0;
          const bs = G.narrow ? 18 : 22;
          g.save();
          g.globalAlpha = a;
          ink.rect(bx, y - bs + 4, bs, bs, { seed: 150 + k, w: 1.2, passes: 1 });
          const tx = bx + bs + (G.narrow ? 12 : 18);
          ink.text(num, tx, y, { font: 'mono', size: G.narrow ? 13 : 15, color: c.ink2 });
          const hx = tx + (G.narrow ? 24 : 30);
          if (tk > 0) {
            const tw = measure(title, 'hand', fs);
            ink.marker(hx - 4, y - fs + 1, (tw + 8) * smooth(tk), fs + 6, { seed: 160 + k });
            const tick = [[bx + 3, y - bs * 0.45], [bx + bs * 0.42, y + 1], [bx + bs + 6, y - bs - 4]];
            ink.path(partial(tick, tk), { seed: 170 + k, w: 2, boil: tk < 1 });
          }
          ink.text(title, hx, y, { size: fs });
          if (!G.narrow) ink.text(sub, hx, y + 22, { size: 13, color: c.ink2 });
          g.restore();
        });
      }
    },
  };
}
