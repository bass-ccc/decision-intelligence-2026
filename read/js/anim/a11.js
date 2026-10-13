// 11 從金曲獎到甄嬛傳 — shared memory as fireflies that fall into step (Kuramoto, mean field).
//    dθ/dt = ω + K·R·sin(ψ − θ); a flash is θ passing 0. Flash = highlighter blob + pencil core; idle = a graphite dot.
// step 0  分眾: fireflies everywhere, each blinking on its own rhythm
// step 1  借用式懷舊: one past pulses in the middle; 30 代 answer it as 懷念, 10 代 later, as emo (65% of them)
// step 2  熟悉 × 新鮮: two audiences joined by a bridge; their rhythms begin to line up
// step 3  共同儀式: everyone gathers round one screen and flashes together
// step 4  Memory → Participation → Community: every shared flash leaves pencil lines — a constellation
// step 5  品牌記憶策略五階段: a wave of light travels 記憶 → 共同時刻 → 參與 → 橋接 → 新記憶
// Click: a 共同時刻 — a ring spreads and everyone it touches flashes at the same instant.
import { ARTICLES } from '../content.js';
import { rng, clamp, lerp, smooth, approach, noise2 } from '../engine/noise.js';

export const hint = '點一下，製造共同時刻';

const ART = ARTICLES.find((a) => a.no === 11);
const TAU = Math.PI * 2;
const GOLD = Math.PI * (3 - Math.sqrt(5));
const SRC = TAU / 1.9; // the rhythm of "the same past" and of the stage wave

export default function make(env) {
  const r = rng(11);
  const N = env.mini ? 70 : clamp(Math.round((env.w * env.h) / 3600), 90, 180);
  const flies = Array.from({ length: N }, (_, i) => {
    const w0 = TAU / (1.5 + r() * 0.8);
    return {
      i,
      w0,
      th: r() * TAU,
      grp: i % 2, // step 1 / 2: two audiences
      resp: r() < 0.65, // 65% of the younger ones borrow the nostalgia
      st: i % 5, // step 5 station
      jit: r(),
      x: r() * env.w,
      y: r() * env.h,
      hx: 0,
      hy: 0,
      lastWave: -1,
    };
  });
  // the card still: some of them flash together right at t = 3.5
  if (env.mini) flies.forEach((f) => f.jit < 0.45 && (f.th = (((-f.w0 * 3.42) % TAU) + TAU) % TAU));

  let G = {};
  const mix = { scatter: 1, gen: 0, bridge: 0, ritual: 0, comm: 0, stage: 0 };
  let K = 0;
  let R = 0;
  let psi = 0;
  let src = 0; // phase of the shared past / stage wave
  const waves = [];
  let moments = 0;
  let edges = [];
  let shown = 0;
  let prevPsi = 0;
  let laid = -1;

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 8 : 40;
    const bot = mini ? h - 8 : h - 58;
    const H = bot - top;
    const narrow = w < 560;
    G = { top, bot, H, narrow, cy: top + H * (mini ? 0.5 : 0.53) };
    G.rc = Math.min(w * 0.17, H * 0.3);
    G.rd = Math.min(w * 0.4, H * (narrow ? 0.38 : 0.44));
    G.rs = Math.min(w * 0.075, H * 0.16, 52);
    laid = -1;
  }
  geom();

  // homes for every layout
  function homes(s) {
    const { w } = env;
    const { top, bot, cy } = G;
    if (s === 0) {
      const cols = Math.ceil(Math.sqrt((N * (w - 40)) / (bot - top - 20)));
      const rows = Math.ceil(N / cols);
      flies.forEach((f, i) => {
        const c = i % cols;
        const rr = Math.floor(i / cols);
        f.hx = 20 + ((c + 0.15 + f.jit * 0.7) / cols) * (w - 40);
        f.hy = top + 22 + ((rr + 0.15 + ((f.jit * 7.3) % 1) * 0.7) / rows) * (bot - top - 30);
      });
    } else if (s === 1 || s === 2) {
      const gx = s === 1 ? [w * 0.24, w * 0.76] : [w * 0.2, w * 0.8];
      const yy = s === 2 ? cy + G.H * 0.08 : cy;
      const rc = s === 2 ? G.rc * 0.9 : G.rc;
      const cnt = [0, 0];
      const nb = s === 2 ? Math.round(N * 0.12) : 0;
      flies.forEach((f, i) => {
        if (s === 2 && i < nb) return; // these walk the bridge
        const k = cnt[f.grp]++;
        const a = k * GOLD;
        const rad = Math.sqrt((k + 0.5) / (N / 2)) * rc;
        f.hx = gx[f.grp] + Math.cos(a) * rad;
        f.hy = yy + Math.sin(a) * rad;
      });
    } else if (s === 3 || s === 4) {
      flies.forEach((f, i) => {
        const a = i * GOLD;
        const rad = G.rd * Math.sqrt(0.16 + 0.84 * ((i + 0.5) / N));
        f.hx = w / 2 + Math.cos(a) * rad;
        f.hy = cy + Math.sin(a) * rad * 0.82;
      });
    } else {
      const cnt = [0, 0, 0, 0, 0];
      flies.forEach((f) => {
        const k = cnt[f.st]++;
        const a = k * GOLD;
        const rad = Math.sqrt((k + 0.5) / (N / 5)) * G.rs;
        f.hx = w * (0.1 + f.st * 0.2) + Math.cos(a) * rad;
        f.hy = cy - G.H * 0.06 + Math.sin(a) * rad;
      });
    }
    if (s === 3 || s === 4) {
      // neighbours in the gathering: the lines a community can draw
      if (!edges.length) {
        const seen = new Set();
        flies.forEach((f) => {
          const near = flies
            .filter((q) => q !== f)
            .map((q) => [q.i, (q.hx - f.hx) ** 2 + (q.hy - f.hy) ** 2])
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3);
          near.forEach(([j]) => {
            const key = f.i < j ? `${f.i}-${j}` : `${j}-${f.i}`;
            if (!seen.has(key)) {
              seen.add(key);
              edges.push([f.i, j]);
            }
          });
        });
        // grow the lines outward from a few starting points, like a community does
        const adj = flies.map(() => []);
        edges.forEach(([a, b], k) => {
          adj[a].push(k);
          adj[b].push(k);
        });
        const order = [];
        const used = new Set();
        const seenN = new Set();
        const queue = [Math.floor(N * 0.15), Math.floor(N * 0.55), Math.floor(N * 0.9)];
        queue.forEach((q) => seenN.add(q));
        while (queue.length) {
          const n = queue.shift();
          for (const k of adj[n]) {
            if (used.has(k)) continue;
            used.add(k);
            order.push(edges[k]);
            const m = edges[k][0] === n ? edges[k][1] : edges[k][0];
            if (!seenN.has(m)) {
              seenN.add(m);
              queue.push(m);
            }
          }
        }
        edges.forEach((e, k) => used.has(k) || order.push(e));
        edges = order;
      }
    }
  }

  // the bridge: an arc between the two audiences (step 2)
  const bridgeAt = (u) => {
    const { w } = env;
    const x0 = w * 0.2 + G.rc * 0.6;
    const x1 = w * 0.8 - G.rc * 0.6;
    const y0 = G.cy + G.H * 0.08 - G.rc * 0.5;
    return [lerp(x0, x1, u), y0 - Math.sin(u * Math.PI) * G.H * 0.2];
  };

  function sim(dt, t) {
    const s = env.mini ? 0 : env.step;
    const wantK = [0, 0, 0.8, 4.2, 4.2, 0][s];
    K = approach(K, wantK, dt, 0.8);
    src = (src + SRC * dt) % TAU;
    // mean field (global and per audience)
    let cx = 0;
    let sx = 0;
    const gc = [0, 0];
    const gs = [0, 0];
    for (const f of flies) {
      cx += Math.cos(f.th);
      sx += Math.sin(f.th);
      gc[f.grp] += Math.cos(f.th);
      gs[f.grp] += Math.sin(f.th);
    }
    R = Math.hypot(cx, sx) / N;
    psi = Math.atan2(sx, cx);
    const Rg = gc.map((v, k) => Math.hypot(v, gs[k]) / (N / 2));
    const Pg = gc.map((v, k) => Math.atan2(gs[k], v));
    for (const f of flies) {
      let d = f.w0 + K * R * Math.sin(psi - f.th);
      if (s === 1) {
        // the same past drives both: the older answer at once, the younger later (only 65% of them)
        if (f.grp === 0) d += 2.4 * Math.sin(src - f.th);
        else if (f.resp) d += 2.4 * Math.sin(src - 1.5 - f.th);
      } else if (s === 2) d += 1 * Rg[f.grp] * Math.sin(Pg[f.grp] - f.th);
      else if (s === 5) d += 3 * Math.sin(src - f.st * 0.75 - f.th);
      f.th = (((f.th + d * dt) % TAU) + TAU) % TAU;
    }
    // a 共同時刻: the ring sets everyone it passes to flash when it stops growing
    for (const wv of waves) {
      const front = (t - wv.t0) * wv.v;
      if (front > wv.max + 30) continue;
      for (const f of flies) {
        if (f.lastWave === wv.id) continue;
        const dd = Math.hypot(f.x - wv.x, f.y - wv.y);
        if (dd < front && dd < wv.max) {
          f.lastWave = wv.id;
          const left = Math.max(0.05, wv.t0 + wv.max / wv.v - t);
          f.th = (((-f.w0 * left) % TAU) + TAU) % TAU;
        }
      }
    }
    // shared flashes (step 4) leave lines behind
    if (s === 4 && R > 0.7 && prevPsi < 0 && psi >= 0) shown = Math.min(edges.length, shown + Math.max(12, Math.round(edges.length / 9)));
    prevPsi = psi;
  }

  const glow = (th) => {
    // fast rise after crossing 0, slow fade
    const k = 1 - th / 1.7;
    return k > 0 ? k * k : 0;
  };

  return {
    resize: geom,
    warm(sec) {
      for (let k = 0; k < sec; k += 1 / 30) sim(1 / 30, k);
    },
    step(i) {
      if (i !== 4 && i !== 5) shown = Math.min(shown, edges.length);
    },
    click(x, y) {
      const max = Math.min(env.w, env.h) * 0.42;
      waves.push({ x, y, t0: env.t, v: max / 0.7, max, id: moments });
      moments++;
      if (waves.length > 4) waves.shift();
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c, mini } = env;
      const s = mini ? 0 : env.step;
      const want = {
        scatter: s === 0 ? 1 : 0,
        gen: s === 1 ? 1 : 0,
        bridge: s === 2 ? 1 : 0,
        ritual: s === 3 || s === 4 ? 1 : 0,
        comm: s === 4 ? 1 : 0,
        stage: s === 5 ? 1 : 0,
      };
      for (const k in mix) mix[k] = dt > 0 ? approach(mix[k], want[k], dt, 0.5) : want[k];
      if (laid !== s) {
        homes(s);
        if (laid < 0) flies.forEach((f) => ([f.x, f.y] = [f.hx, f.hy]));
        laid = s;
      }
      if (dt > 0) sim(Math.min(dt, 0.05), t);
      while (waves.length && t - waves[0].t0 > 3) waves.shift();

      // positions: glide home, drift a little like insects do
      const nb = s === 2 ? Math.round(N * 0.12) : 0;
      for (const f of flies) {
        let hx = f.hx;
        let hy = f.hy;
        if (f.i < nb) [hx, hy] = bridgeAt((t * 0.06 + f.jit) % 1);
        hx += noise2(f.i * 0.37, t * 0.25) * (mini ? 4 : 8);
        hy += noise2(t * 0.25, f.i * 0.37) * (mini ? 4 : 8);
        if (dt > 0) {
          f.x = approach(f.x, hx, dt, f.i < nb ? 0.2 : 0.7);
          f.y = approach(f.y, hy, dt, f.i < nb ? 0.2 : 0.7);
        } else [f.x, f.y] = [hx, hy];
      }

      // a still frame shows the instant just after the shared flash
      const ref = s === 1 || s === 5 ? src : psi;
      const shift = dt === 0 && !mini && (s === 1 || s === 5 || R > 0.45) ? 0.35 - ref : 0;
      const wrap = (v) => ((v % TAU) + TAU) % TAU;

      // ── furniture under the fireflies ──
      const fs = G.narrow ? 14 : 16;
      if (mix.gen > 0.02 && !mini) {
        g.save();
        g.globalAlpha = mix.gen;
        // the same past: a cassette in the middle that pulses
        const x = w / 2;
        const y = G.cy;
        const cw = G.narrow ? 54 : 74;
        const ch = cw * 0.62;
        const pulse = glow(wrap(src + shift));
        if (pulse > 0.02) ink.blob(x, y, cw * 0.75 * (0.8 + pulse * 0.4), { seed: 31, alpha: c.hlAlpha * pulse });
        ink.rect(x - cw / 2, y - ch / 2, cw, ch, { seed: 32, w: 1.3 });
        ink.circle(x - cw * 0.2, y - ch * 0.08, ch * 0.18, { seed: 33, w: 1.1, passes: 1 });
        ink.circle(x + cw * 0.2, y - ch * 0.08, ch * 0.18, { seed: 34, w: 1.1, passes: 1 });
        ink.line(x - cw * 0.3, y + ch * 0.28, x + cw * 0.3, y + ch * 0.28, { seed: 35, w: 1, passes: 1 });
        ink.text('同一個過去', x, y + ch / 2 + 24, { size: fs, align: 'center' });
        ink.text('平成 Retro', x, y + ch / 2 + 44, { size: 13, align: 'center', color: c.ink2 });
        const ly = G.cy + G.rc + 30;
        ink.text('30 代｜懷念', w * 0.24, ly, { size: fs + 1, align: 'center' });
        ink.text('10 代｜emo、新鮮', w * 0.76, ly, { size: fs + 1, align: 'center' });
        ink.text('65% Z 世代有借用式懷舊', w * 0.76, ly + 21, { size: 13, align: 'center', color: c.ink2 });
        g.restore();
      }
      if (mix.bridge > 0.02 && !mini) {
        g.save();
        g.globalAlpha = mix.bridge;
        const pts = [];
        for (let i = 0; i <= 30; i++) pts.push(bridgeAt(i / 30));
        ink.path(pts, { seed: 41, w: 1.5 });
        ink.path(pts.map(([x, y]) => [x, y + 7]), { seed: 42, w: 1, alpha: 0.6 });
        // planks
        g.save();
        g.strokeStyle = c.pencil;
        g.globalAlpha *= 0.55;
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 1; i < 30; i += 2) {
          const [x, y] = pts[i];
          g.moveTo(x, y);
          g.lineTo(x, y + 7);
        }
        g.stroke();
        g.restore();
        const [ax, ay] = bridgeAt(0.5);
        ink.text('熟悉 × 新鮮', ax, ay - 16, { size: fs + 2, align: 'center' });
        ink.text('先用「我認識」讓人進來，再遇見「我還不認識」', ax, ay - 38 - (G.narrow ? 0 : 0), { size: 13, align: 'center', color: c.ink2 });
        const ly = G.cy + G.H * 0.08 + G.rc * 0.9 + 30;
        ink.text('55–64 歲', w * 0.2, ly, { size: fs + 1, align: 'center' });
        ink.text('25–34 歲', w * 0.8, ly, { size: fs + 1, align: 'center' });
        ink.text('同步成長', w / 2, ly, { size: 13, align: 'center', color: c.ink2 });
        ink.text('2026 金曲獎收視 2.31 → 3.37（約 +46%）', w / 2, G.bot - 4, { size: 13, align: 'center', color: c.ink2 });
        g.restore();
      }
      if (mix.ritual > 0.02 && !mini) {
        g.save();
        g.globalAlpha = mix.ritual;
        // one screen everybody comes back to
        const sw = G.narrow ? 70 : 104;
        const sh = sw * 0.62;
        const x = w / 2;
        const y = G.cy - 4;
        const p = R > 0.6 ? glow(wrap(psi + shift)) * R : 0;
        if (p > 0.02) ink.blob(x, y, sw * 0.7, { seed: 51, alpha: c.hlAlpha * p * 0.8 });
        ink.rect(x - sw / 2, y - sh / 2, sw, sh, { seed: 52, w: 1.4 });
        ink.line(x - sw * 0.2, y + sh / 2 + 10, x + sw * 0.2, y + sh / 2 + 10, { seed: 53, w: 1.2, passes: 1 });
        ink.line(x, y + sh / 2, x, y + sh / 2 + 10, { seed: 54, w: 1.2, passes: 1 });
        ink.text('甄嬛傳', x, y + 6, { size: G.narrow ? 15 : 19, align: 'center' });
        const a3 = 1 - mix.comm;
        if (a3 > 0.02) {
          ink.text('春節馬拉松：沒有新集數，大家每年回來一起看', w / 2, G.bot - 22, { size: G.narrow ? 13 : 15, align: 'center', alpha: a3 });
          ink.text('2026 最高同時在線 72,475 人', w / 2, G.bot - 2, { size: 13, align: 'center', color: c.ink2, alpha: a3 });
        }
        g.restore();
      }
      // the constellation (step 4)
      if (mix.comm > 0.02 && shown > 0 && !mini) {
        g.save();
        g.strokeStyle = c.pencil;
        g.lineWidth = 1;
        g.lineCap = 'round';
        g.globalAlpha = mix.comm * 0.7;
        g.beginPath();
        const jr = rng(91 + env.boil);
        for (let k = 0; k < shown; k++) {
          const [a, b] = edges[k];
          const fa = flies[a];
          const fb = flies[b];
          g.moveTo(fa.x + jr() - 0.5, fa.y + jr() - 0.5);
          g.lineTo(fb.x + jr() - 0.5, fb.y + jr() - 0.5);
        }
        g.stroke();
        g.restore();
        g.save();
        g.globalAlpha = mix.comm;
        const words = ['Memory', 'Participation', 'Community'];
        const lfs = G.narrow ? 13 : 16;
        const ws = words.map((wd) => measure(wd, lfs, 'latin') * 1.06);
        const total = ws.reduce((a, b) => a + b, 0) + 2 * (G.narrow ? 30 : 44);
        let x = w / 2 - total / 2;
        words.forEach((wd, i) => {
          const lit = i <= Math.min(2, Math.floor((shown / Math.max(1, edges.length)) * 3.2));
          const hy = G.top + lfs + (w < 900 ? 30 : 4);
          if (lit && i === 2) ink.marker(x - 4, hy - lfs - 2, ws[i] + 8, lfs + 10, { seed: 61 });
          ink.text(wd, x, hy, { font: 'latin', size: lfs, weight: lit ? 700 : 400, alpha: lit ? 1 : 0.45 });
          x += ws[i];
          if (i < 2) {
            const gap = G.narrow ? 30 : 44;
            const ay = G.top + lfs * 0.7 + (w < 900 ? 29 : 3);
            ink.arrow(x + 6, ay, x + gap - 8, ay, { seed: 62 + i, w: 1, head: 5 });
            x += gap;
          }
        });
        ink.text('ORANGE RANGE：72 個平成梗，觀眾主動解碼', w / 2, G.bot - 22, { size: G.narrow ? 13 : 15, align: 'center' });
        ink.text('跨媒體累積逾 210 億次曝光', w / 2, G.bot - 2, { size: 13, align: 'center', color: c.ink2 });
        g.restore();
      }
      if (mix.stage > 0.02 && !mini) {
        g.save();
        g.globalAlpha = mix.stage;
        const items = ART.framework.items;
        const wide = w * 0.2 > 150;
        let active = 0;
        let best = -1;
        items.forEach((_, k) => {
          const v = glow(wrap(src - k * 0.75 + shift));
          if (v > best) [best, active] = [v, k];
        });
        const ny = G.cy - G.H * 0.06 + G.rs + 30;
        items.forEach(([name, q], k) => {
          const x = w * (0.1 + k * 0.2);
          if (k < 4) ink.arrow(x + G.rs + 8, G.cy - G.H * 0.06, x + w * 0.2 - G.rs - 8, G.cy - G.H * 0.06, { seed: 70 + k, w: 1, head: 5, alpha: 0.7 });
          const nfs = G.narrow ? 14 : 18;
          if (k === active) ink.marker(x - measure(name, nfs) / 2 - 5, ny - nfs, measure(name, nfs) + 10, nfs + 8, { seed: 75 + k });
          ink.text(name, x, ny, { size: nfs, align: 'center' });
          if (wide) ink.para(q, x - w * 0.09, ny + 24, w * 0.18, { size: 13, color: c.ink2, align: 'left', lineHeight: 19 });
        });
        if (!wide) ink.text(items[active][1], w / 2, ny + 34, { size: 14, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── the fireflies ──
      const idle = [];
      const big = [];
      for (const f of flies) {
        const v = glow((((f.th + shift) % TAU) + TAU) % TAU);
        if (v > 0.04) {
          const rad = (mini ? 2.5 : 3) + v * (mini ? 7 : 12);
          ink.blob(f.x, f.y, rad, { seed: f.i + 1, alpha: Math.min(1, c.hlAlpha * (0.4 + v * 0.9)) });
          if (s === 1 && f.grp === 1 && v > 0.3 && !mini) {
            // the younger flash differently: a little spark
            g.save();
            g.strokeStyle = c.pencil;
            g.globalAlpha = v * 0.8;
            g.lineWidth = 1;
            g.beginPath();
            for (let k = 0; k < 4; k++) {
              const an = k * (Math.PI / 4) + 0.4;
              g.moveTo(f.x + Math.cos(an) * rad * 0.7, f.y + Math.sin(an) * rad * 0.7);
              g.lineTo(f.x + Math.cos(an) * rad * 1.35, f.y + Math.sin(an) * rad * 1.35);
            }
            g.stroke();
            g.restore();
          }
          ink.dot(f.x, f.y, 1.7 + v * 0.8, { seed: f.i, color: c.pencil, alpha: 0.95 });
        } else if (f.i < nb) big.push(f.x, f.y);
        else idle.push(f.x, f.y);
      }
      g.save();
      g.fillStyle = c.pencil;
      g.globalAlpha = 0.55;
      g.beginPath();
      const dr = mini ? 1.1 : 1.3;
      for (let k = 0; k < idle.length; k += 2) {
        g.moveTo(idle[k] + dr, idle[k + 1]);
        g.arc(idle[k], idle[k + 1], dr, 0, TAU);
      }
      for (let k = 0; k < big.length; k += 2) {
        g.moveTo(big[k] + 2.6, big[k + 1]);
        g.arc(big[k], big[k + 1], 2.6, 0, TAU);
      }
      g.fill();
      g.restore();

      // the rings of a 共同時刻
      for (const wv of waves) {
        const front = (t - wv.t0) * wv.v;
        const k = front / wv.max;
        if (k > 1.25) continue;
        ink.circle(wv.x, wv.y, Math.min(front, wv.max), { seed: 80 + wv.id, w: 1.2, alpha: (1 - smooth((k - 0.8) / 0.45)) * 0.8, passes: 1 });
      }

      // ── the meter: how in step everybody is ──
      if (!mini) {
        const lab = '同步率';
        const cells = G.narrow ? 8 : 12;
        const cell = 9;
        const x1 = w - 18;
        const y = G.top + 10;
        const val = R.toFixed(2);
        const vw = measure(val, 13, 'mono');
        const bx = x1 - vw - 8 - cells * cell;
        ascii.text(val, x1 - vw, y, 13, c.ink, 1);
        for (let k = 0; k < cells; k++) ascii.glyph(k < Math.round(R * cells) ? '#' : '·', bx + k * cell + cell / 2, y, cell, c.ink, 0.9);
        ink.text(lab, bx - 8, y + 5, { size: 14, align: 'right' });
        if (moments) ink.text(`共同時刻 ×${moments}`, x1, y + 24, { size: 13, align: 'right', color: c.ink2 });
        if (s === 0) ink.text('分眾：每個人，各自的節奏', w / 2, G.bot - 4, { size: G.narrow ? 13 : 15, align: 'center', color: c.ink2 });
      }
    },
  };

  function measure(str, size, kind = 'hand') {
    const g = env.g;
    g.save();
    g.font = env.font(kind, size, 400);
    const m = g.measureText(str).width;
    g.restore();
    return m;
  }
}
