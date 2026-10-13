// 13 重建 SOV — when every brand can find the high-intent buyer, the buyer is surrounded and the brand is forgotten.
// step 0  one consumer with an intent (pencil); ~20 identical ads (glyphs) chase her; your brand is one of them
// step 1  從曝光稀釋到選擇稀釋: an outer ring of content scatters attention, the inner swarm of rivals shakes the choice
// step 2  效率悖論: she buys (a box), the box is thrown away, and the brand's name fades from her memory
// step 3  越往 lower funnel 越要小心: CPM → CPC (5–10×) → CPA (up to 100×), and fewer people see the brand
// step 4  Full funnel 是診斷地圖: one 主攻場域 carries the SOV; the others amplify, give trust, catch demand, convert
// step 5  Share of Choice Context: three rings — System, Consumer & Community, Attention & Memory
// Drag the consumer: she runs, the ads follow.
import { ARTICLES } from '../content.js';
import { rng, clamp, lerp, smooth, approach, noise2 } from '../engine/noise.js';

export const hint = '拖著消費者逃跑';

const ART = ARTICLES.find((a) => a.no === 13);
const NADS = 20;
const NOISE = ['短影音', '社群貼文', 'KOL / KOC', '電商推薦', '搜尋結果', 'AI 摘要', '再行銷', '站內廣告', '即時訊息', '平台演算法'];
const ROLES = ['主攻場域', '放大', '提供信任', '承接需求', '轉換'];
const TIERS = [
  ['CPM', '買接觸面', 1, 1, '1×'],
  ['CPC', '買有反應的人', 5, 10, '5–10×'],
  ['CPA', '買轉換', 10, 100, '可達 100×'],
];

export default function make(env) {
  const r = rng(13);
  let G = {};
  const mix = { chase: 1, noise: 0, buy: 0, funnel: 0, map: 0, rings: 0 };
  const me = { x: 0, y: 0, held: false, lastDrag: -10 };
  const ads = Array.from({ length: NADS }, (_, i) => ({
    i,
    x: r() * 400,
    y: r() * 400,
    vx: 0,
    vy: 0,
    a0: (i / NADS) * Math.PI * 2 + r() * 0.3,
    rr: 0.75 + r() * 0.5,
    sp: 0.5 + r() * 0.5,
  }));
  const BRAND = 7;
  // funnel walkers: how deep each one gets (示意)
  const walkers = Array.from({ length: 90 }, () => {
    const q = r();
    return { u: r() * 2 - 1, p0: r(), depth: q < 0.62 ? 1 : q < 0.88 ? 2 : 3 };
  });
  let mainIdx = 0;
  const fieldR = [1, 0, 0, 0, 0];
  let placed = false;

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
    G = { top, bot, H, narrow, cx: w / 2, cy: top + H * 0.52, fs: narrow ? 14 : 16 };
    G.orbit = Math.min(w, H) * (mini ? 0.28 : 0.25);
    // funnel
    G.fw = Math.min(w * (narrow ? 0.46 : 0.42), 340);
    G.fx = narrow ? w * 0.3 : w * 0.34;
    G.ft = top + H * 0.1;
    G.th = H * 0.24;
    // map: five fields
    const sx = narrow ? 0.22 : 0.2;
    G.fields = [
      [0.5, 0.5],
      [sx, 0.24],
      [1 - sx, 0.24],
      [1 - sx, 0.78],
      [sx, 0.78],
    ].map(([u, v]) => [w * u, top + H * v]);
    G.fbig = Math.min(w * 0.17, H * 0.2);
    G.fsmall = Math.min(w * 0.085, H * 0.1);
    // rings
    // rings on the left, their three labels on the right (stacked underneath on a phone)
    G.lw = 272;
    G.wide = w >= 640;
    G.r3 = G.wide ? Math.min(w * 0.3, H * 0.44, (w - 120 - G.lw) / 2) : Math.min(w * 0.4, H * 0.3);
    G.rcx = G.wide ? (w - (G.r3 * 2 + 40 + G.lw)) / 2 + G.r3 : w / 2;
    G.rcy = G.wide ? top + H * 0.5 : top + G.r3 + 14;
    if (!placed) {
      me.x = G.cx;
      me.y = G.cy;
      ads.forEach((a) => {
        a.x = G.cx + Math.cos(a.a0) * G.orbit * a.rr;
        a.y = G.cy + Math.sin(a.a0) * G.orbit * a.rr;
      });
      placed = true;
    }
  }
  geom();

  function mono(str, x, y, size, color, a, align = 'left') {
    const wd = measure(str, 'mono', size, 500);
    env.ascii.text(str, align === 'center' ? x - wd / 2 : align === 'right' ? x - wd : x, y, size, color, a);
    return wd;
  }

  // one ad: a tiny glyph banner, identical for every brand
  function ad(x, y, a, cell) {
    const { ascii, c, g } = env;
    g.save();
    g.globalAlpha *= a * 0.8;
    g.fillStyle = c.sheet;
    g.fillRect(x - cell * 1.7, y - cell * 1.1, cell * 3.4, cell * 2.2);
    g.restore();
    ascii.glyph('[', x - cell, y - cell * 0.45, cell, c.ink, a);
    ascii.glyph('#', x, y - cell * 0.45, cell, c.ink, a);
    ascii.glyph(']', x + cell, y - cell * 0.45, cell, c.ink, a);
    ascii.glyph('=', x - cell, y + cell * 0.45, cell, c.ink, a * 0.8);
    ascii.glyph('=', x, y + cell * 0.45, cell, c.ink, a * 0.8);
    ascii.glyph('=', x + cell, y + cell * 0.45, cell, c.ink, a * 0.8);
  }

  // the consumer: a pencil head and shoulders
  function person(x, y, s, a, seed = 1) {
    const { ink, g } = env;
    g.save();
    g.globalAlpha *= a;
    ink.circle(x, y - s * 0.9, s * 0.55, { seed, w: 1.4 });
    ink.path([[x - s * 1.1, y + s * 1.1], [x - s * 0.95, y + s * 0.2], [x - s * 0.35, y - s * 0.2], [x + s * 0.35, y - s * 0.2], [x + s * 0.95, y + s * 0.2], [x + s * 1.1, y + s * 1.1]], { seed: seed + 1, w: 1.4 });
    g.restore();
  }

  // a wobbly closed pencil blob (map fields)
  function blobPts(x, y, rad, seed) {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const k = 1 + noise2(Math.cos(a) * 0.9 + seed, Math.sin(a) * 0.9) * 0.18;
      pts.push([x + Math.cos(a) * rad * k * 1.15, y + Math.sin(a) * rad * k * 0.85]);
    }
    return pts;
  }

  function steer(dt, t) {
    const s = env.mini ? 0 : env.step;
    // where the consumer goes when nobody drags her
    if (!me.held && t - me.lastDrag > 2.5) {
      const wx = G.cx + Math.sin(t * 0.31) * env.w * 0.16;
      const wy = G.cy + Math.sin(t * 0.47 + 1) * G.H * 0.1;
      me.x = approach(me.x, wx, dt, 1.4);
      me.y = approach(me.y, wy, dt, 1.4);
    }
    // ads: orbit the consumer, keep a little apart, lag behind when she runs
    const ringC = s === 5 ? [G.rcx, G.rcy] : null;
    for (const a of ads) {
      let tx;
      let ty;
      if (ringC) {
        const an = a.a0 + t * 0.12;
        tx = ringC[0] + Math.cos(an) * G.r3;
        ty = ringC[1] + Math.sin(an) * G.r3;
      } else {
        const an = a.a0 + t * 0.5 * a.sp;
        const rad = G.orbit * a.rr * (s === 2 ? 1.25 : 1);
        tx = me.x + Math.cos(an) * rad;
        ty = me.y + Math.sin(an) * rad * 0.8;
      }
      let ax = (tx - a.x) * 9 - a.vx * 4.2;
      let ay = (ty - a.y) * 9 - a.vy * 4.2;
      for (const b of ads) {
        if (b === a) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1600 && d2 > 0.01) {
          ax += (dx / d2) * 1600;
          ay += (dy / d2) * 1600;
        }
      }
      a.vx += ax * dt;
      a.vy += ay * dt;
      const sp = Math.hypot(a.vx, a.vy);
      const max = 520;
      if (sp > max) {
        a.vx *= max / sp;
        a.vy *= max / sp;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    }
  }

  return {
    resize: geom,
    warm(sec) {
      for (let k = 0; k < sec; k += 1 / 30) steer(1 / 30, k);
    },
    down() {
      if (mix.chase > 0.5 || mix.rings > 0.5) {
        me.held = true;
        me.lastDrag = env.t;
      }
    },
    drag(x, y) {
      if (!me.held) return;
      me.x = clamp(x, 20, env.w - 20);
      me.y = clamp(y, G.top + 20, G.bot - 10);
      me.lastDrag = env.t;
    },
    up() {
      me.held = false;
      me.lastDrag = env.t;
    },
    click(x, y) {
      if (mix.map > 0.5) {
        const k = G.fields.findIndex(([fx, fy]) => Math.hypot(x - fx, y - fy) < (G.fsmall + G.fbig) * 0.7);
        if (k >= 0) mainIdx = k;
      }
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c, acc, mini } = env;
      const s = mini ? 0 : env.step;
      const still = dt === 0 || env.reduced;
      const ph = still ? 30 : t - env.stepAt;
      const want = {
        chase: s <= 2 || s === 5 ? 1 : 0,
        noise: s === 1 ? 1 : 0,
        buy: s === 2 ? 1 : 0,
        funnel: s === 3 ? 1 : 0,
        map: s === 4 ? 1 : 0,
        rings: s === 5 ? 1 : 0,
      };
      for (const k in mix) mix[k] = dt > 0 ? approach(mix[k], want[k], dt, 0.4) : want[k];
      if (dt > 0) steer(Math.min(dt, 0.04), t);
      // the rings follow the consumer when she is dragged there
      if (s === 5 && (me.held || t - me.lastDrag < 2.5)) {
        G.rcx = clamp(me.x, G.r3 + 10, env.w - G.r3 - 10 - (G.wide ? G.lw + 40 : 0));
        G.rcy = clamp(me.y, G.top + G.r3, G.bot - G.r3 - (G.wide ? 0 : 60));
      }
      const cell = mini ? 6 : G.narrow ? 9 : 12;

      // ── step 1: the outer ring of content ──
      if (mix.noise > 0.02 && !mini) {
        const a = mix.noise;
        const R = G.orbit * 2.05;
        const fs = G.narrow ? 13 : 14;
        const Rx = Math.min(R * 1.15, me.x - 34, w - me.x - 34);
        const Ry = Math.min(R * 0.78, me.y - G.top - (G.narrow ? 62 : 70), G.bot - 26 - me.y);
        NOISE.forEach((wd, k) => {
          const an = (k / NOISE.length) * Math.PI * 2 - t * 0.09;
          const x = me.x + Math.cos(an) * Math.max(Rx, G.orbit * 1.3);
          const y = me.y + Math.sin(an) * Math.max(Ry, G.orbit * 1.1);
          mono(wd, x, y, fs, c.ink2, a * 0.9, 'center');
        });
        g.save();
        g.globalAlpha *= a;
        g.setLineDash([3, 6]);
        ink.circle(me.x, me.y, G.orbit * 1.55, { seed: 20, w: 1, alpha: 0.5, passes: 1 });
        g.setLineDash([]);
        const lx = G.narrow ? 26 : 34;
        ink.text('內容 → 注意力分散', lx, G.top + 16, { size: G.fs + 1 });
        ink.text('競品在同一個意圖裡 → 選擇動搖', lx, G.top + 40, { size: G.fs + 1 });
        ascii.glyph('·', lx - 8, G.top + 10, 10, c.ink, 1);
        ad(lx - 10, G.top + 35, 1, 5);
        ink.text('這些干擾不一定出現在媒體報表裡', w / 2, G.bot - 4, { size: 13, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── the swarm of ads and the consumer ──
      if (mix.chase > 0.02) {
        const a = mix.chase;
        // step 2 timeline: buy, keep, throw, forget
        const buyK = s === 2 ? smooth((ph - 0.5) / 0.6) : 0;
        const throwK = s === 2 ? smooth((ph - 2.2) / 0.8) : 0;
        const forget = s === 2 ? smooth((ph - 3.0) / 1.4) : 0;
        ads.forEach((d, i) => {
          if (i === BRAND && buyK > 0.5 && mix.buy > 0.5) return;
          let x = d.x;
          let y = d.y;
          if (i === BRAND && buyK > 0) [x, y] = [lerp(d.x, me.x + 18, buyK), lerp(d.y, me.y - 4, buyK)];
          ad(x, y, a * (mix.buy > 0.5 ? 0.6 : 1), cell);
        });
        // the reader knows which one is the brand; she does not
        if (!mini && mix.buy < 0.5 && mix.rings < 0.5) {
          // label pushed outward, away from the consumer
          const b = ads[BRAND];
          const dx = b.x - me.x;
          const dy = b.y - me.y;
          const L = Math.hypot(dx, dy) || 1;
          const lx = b.x + (dx / L) * 46;
          const ly = b.y + (dy / L) * 40;
          ink.line(b.x + (dx / L) * cell * 1.8, b.y + (dy / L) * cell * 1.3, lx - (dx / L) * 6, ly - (dy / L) * 6 - 4, { seed: 30, w: 0.9, alpha: a * 0.8, passes: 1 });
          ink.text('你的品牌', lx, ly + (dy > 0 ? 10 : 0), { size: 14, align: dx > 0 ? 'left' : 'right', alpha: a });
        }
        if (mix.rings < 0.5) {
          const ps = mini ? 9 : G.narrow ? 13 : 17;
          person(me.x, me.y, ps, a * (1 - mix.rings), 40);
          if (!mini && mix.buy < 0.5) {
            const lab = '想買：手機磁吸支架';
            const tw = measure(lab, 'hand', G.fs);
            ink.marker(me.x - tw / 2 - 5, me.y - ps * 2.6 - G.fs, tw + 10, G.fs + 8, { seed: 41, alpha: c.hlAlpha * a });
            ink.text(lab, me.x, me.y - ps * 2.6, { size: G.fs, align: 'center', alpha: a });
            if (s === 0) ink.text('約 20 個相似廣告，同時追著同一個人', w / 2, G.bot - 4, { size: G.narrow ? 13 : 15, align: 'center', color: c.ink2, alpha: a });
          }
        }
        // the purchase and what is left of it
        if (mix.buy > 0.02 && !mini) {
          const ba = mix.buy;
          g.save();
          g.globalAlpha *= ba;
          const bw = 40;
          const bh = 28;
          const bin = [Math.min(w - 50, me.x + G.orbit * 2.1), Math.min(G.bot - 30, me.y + G.orbit * 0.9)];
          // the bin
          ink.path([[bin[0] - 30, bin[1] - 30], [bin[0] - 23, bin[1] + 28], [bin[0] + 23, bin[1] + 28], [bin[0] + 30, bin[1] - 30]], { seed: 50, w: 1.4 });
          ink.line(bin[0] - 35, bin[1] - 32, bin[0] + 35, bin[1] - 32, { seed: 51, w: 1.4 });
          if (buyK > 0.5) {
            const hx = me.x + 26;
            const hy = me.y - 6;
            const bx = lerp(hx, bin[0], throwK);
            const by = lerp(hy, bin[1] - 6, throwK) - Math.sin(throwK * Math.PI) * 90;
            g.save();
            g.translate(bx, by);
            g.rotate(throwK * 2.4);
            g.globalAlpha *= 1 - smooth((throwK - 0.85) / 0.15) * 0.7;
            ink.rect(-bw / 2, -bh / 2, bw, bh, { seed: 52, w: 1.3 });
            ink.line(-bw / 2, -bh / 2, -bw / 2 + 8, -bh / 2 - 7, { seed: 53, w: 1, passes: 1 });
            ink.line(bw / 2, -bh / 2, bw / 2 - 8, -bh / 2 - 7, { seed: 54, w: 1, passes: 1 });
            ink.text('品牌', 0, 5, { size: 14, align: 'center' });
            g.restore();
          }
          // her memory of it
          if (throwK > 0.2) {
            const k = smooth((throwK - 0.2) / 0.5);
            const tx = me.x - 10;
            const ty = me.y - 76;
            const bwq = 128;
            g.save();
            g.globalAlpha *= k;
            ink.circle(me.x - 4, me.y - 34, 3, { seed: 55, w: 1, passes: 1 });
            ink.circle(me.x - 9, me.y - 46, 5, { seed: 56, w: 1, passes: 1 });
            const pts = [];
            for (let i = 0; i <= 24; i++) {
              const an = (i / 24) * Math.PI * 2;
              pts.push([tx + Math.cos(an) * bwq * 0.5 * (1 + Math.sin(an * 7) * 0.04), ty + Math.sin(an) * 24 * (1 + Math.cos(an * 7) * 0.06)]);
            }
            ink.path(pts, { seed: 57, w: 1.2 });
            const name = '那個牌子叫';
            ink.text(name, tx - 18, ty + 6, { size: 15, align: 'center' });
            ink.text('品牌', tx + 34, ty + 6, { size: 15, align: 'center', alpha: 1 - forget });
            if (forget > 0.3) ink.text('？', tx + 34, ty + 6, { size: 18, align: 'center', alpha: smooth((forget - 0.3) / 0.5) });
            g.restore();
          }
          // sales vs marketing
          const fs = G.narrow ? 13 : 15;
          const y1 = G.narrow ? G.bot - 40 : G.top + 16;
          const lx = G.narrow ? 14 : 24;
          ink.text('Sales：這一次買不買', lx, y1, { size: fs + 1, alpha: smooth((buyK - 0.5) * 2) });
          if (buyK > 0.9) ink.path([[lx + measure('Sales：這一次買不買', 'hand', fs + 1) + 10, y1 - 6], [lx + measure('Sales：這一次買不買', 'hand', fs + 1) + 15, y1 - 1], [lx + measure('Sales：這一次買不買', 'hand', fs + 1) + 26, y1 - 14]], { seed: 58, w: 1.8 });
          const mk = smooth((forget - 0.4) / 0.5);
          if (mk > 0) {
            const lab = 'Marketing：下次會不會先想到你';
            const tw = measure(lab, 'hand', fs + 1);
            ink.marker(lx - 4, y1 + 10, tw + 8, fs + 10, { seed: 59, alpha: c.hlAlpha * mk });
            ink.text(lab, lx, y1 + 26, { size: fs + 1, alpha: mk });
          }
          if (!G.narrow) ink.text('買了、也好用，盒子丟掉後卻記不得品牌', w / 2, G.bot - 4, { size: fs, align: 'center', color: c.ink2 });
          g.restore();
        }
      }

      // ── step 3: the funnel ──
      if (mix.funnel > 0.02 && !mini) {
        const a = mix.funnel;
        g.save();
        g.globalAlpha *= a;
        const { fx, ft, th, fw } = G;
        const widths = [fw, fw * 0.6, fw * 0.32, fw * 0.12];
        for (let k = 0; k < 3; k++) {
          const y0 = ft + k * th;
          const y1 = y0 + th;
          ink.line(fx - widths[k] / 2, y0, fx - widths[k + 1] / 2, y1, { seed: 60 + k, w: 1.4 });
          ink.line(fx + widths[k] / 2, y0, fx + widths[k + 1] / 2, y1, { seed: 63 + k, w: 1.4 });
          ink.line(fx - widths[k] / 2 - 4, y0, fx + widths[k] / 2 + 4, y0, { seed: 66 + k, w: 1, alpha: 0.6, passes: 1 });
          const [name, sub] = TIERS[k];
          ink.text(name, fx, y0 + th * 0.42, { font: 'latin', size: G.narrow ? 15 : 18, weight: 700, align: 'center' });
          ink.text(sub, fx, y0 + th * 0.42 + 20, { size: 13, align: 'center', color: c.ink2 });
        }
        // people who still see the brand, fewer at every step down (示意)
        g.save();
        g.fillStyle = c.pencil;
        g.globalAlpha *= 0.75;
        g.beginPath();
        const leave = [];
        walkers.forEach((p) => {
          const q = (p.p0 + t * 0.05) % 1;
          const depth = q * 3;
          const k = Math.min(2, Math.floor(depth));
          const fy = ft + depth * th;
          const half = lerp(widths[k], widths[k + 1], depth - k) / 2 - 8;
          let x = fx + p.u * half;
          let y = fy;
          if (depth > p.depth) {
            // dropped out: drifts sideways and fades
            const out = (depth - p.depth) / 0.5;
            if (out > 1) return;
            x = fx + p.u * (half + out * 40) + Math.sign(p.u || 1) * out * 30;
            leave.push(x, y, out);
            return;
          }
          g.moveTo(x + 2, y);
          g.arc(x, y, 2, 0, Math.PI * 2);
        });
        g.fill();
        g.restore();
        for (let i = 0; i < leave.length; i += 3) ink.dot(leave[i], leave[i + 1], 1.6, { alpha: 0.6 * (1 - leave[i + 2]), seed: i, boil: false });
        // cost per thousand impressions, to scale
        const bx = fx + fw / 2 + (G.narrow ? 14 : 34);
        const bwMax = Math.max(50, w - bx - (G.narrow ? 92 : 110));
        const unit = bwMax / 100;
        const bcell = G.narrow ? 6 : 8;
        ink.text('換算每千次曝光成本', bx, ft - 10, { size: 13, color: c.ink2 });
        TIERS.forEach(([, , lo, hi, lab], k) => {
          const y = ft + k * th + th * 0.42;
          const solid = Math.max(1, Math.round((lo * unit) / bcell));
          const total = Math.max(solid, Math.round((hi * unit) / bcell));
          for (let j = 0; j < total; j++) ascii.glyph(j < solid ? '#' : ':', bx + j * bcell + bcell / 2, y - 4, bcell, c.ink, j < solid ? 1 : 0.6);
          ink.text(lab, bx + total * bcell + 8, y + 1, { font: 'mono', size: G.narrow ? 12 : 14 });
        });
        // the lesson
        const ly = ft + th * 3 + (G.narrow ? 20 : 28);
        const fs = G.narrow ? 14 : 16;
        ink.text('CPA 變漂亮了，看見品牌的人卻變少了', w / 2, Math.min(ly, G.bot - 4), { size: fs, align: 'center' });
        ink.arrow(fx - fw / 2 - (G.narrow ? 10 : 22), ft + 8, fx - fw / 2 - (G.narrow ? 10 : 22) + th * 0.5, ft + th * 2.6, { seed: 70, w: 1, head: 6, alpha: 0.7 });
        ink.text('示意', 14, G.bot - 4, { size: 13, color: c.ink2 });
        g.restore();
      }

      // ── step 4: the diagnostic map ──
      if (mix.map > 0.02 && !mini) {
        const a = mix.map;
        g.save();
        g.globalAlpha *= a;
        for (let k = 0; k < 5; k++) fieldR[k] = dt > 0 ? approach(fieldR[k], k === mainIdx ? 1 : 0, dt, 0.3) : k === mainIdx ? 1 : 0;
        const [mx, my] = G.fields[mainIdx];
        // routes from the main field to its helpers
        g.setLineDash([4, 6]);
        G.fields.forEach(([x, y], k) => {
          if (k === mainIdx) return;
          ink.line(mx, my, x, y, { seed: 80 + k, w: 1, alpha: 0.6, passes: 1 });
        });
        g.setLineDash([]);
        let role = 1;
        G.fields.forEach(([x, y], k) => {
          const rad = lerp(G.fsmall, G.fbig, fieldR[k]);
          const pts = blobPts(x, y, rad, k * 3.1);
          if (fieldR[k] > 0.05) {
            g.save();
            g.globalAlpha *= c.hlAlpha * fieldR[k];
            g.fillStyle = acc;
            g.beginPath();
            pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
            g.fill();
            g.restore();
          }
          ink.path(pts, { seed: 90 + k, w: 1.3 });
          // brand presence: dense where the SOV is built, sparse elsewhere
          const n = Math.round(lerp(4, 26, fieldR[k]));
          for (let j = 0; j < n; j++) {
            const an = j * 2.39996;
            const rr = Math.sqrt((j + 0.5) / 26) * rad * 0.62;
            ascii.glyph(j % 3 ? '#' : '=', x + Math.cos(an) * rr * 1.15, y + Math.sin(an) * rr * 0.85 - rad * 0.12, 10, c.ink, 0.9);
          }
          const name = k === mainIdx ? ROLES[0] : ROLES[role++];
          const fs = k === mainIdx ? (G.narrow ? 16 : 20) : G.narrow ? 14 : 16;
          const ty = y + rad * 0.85 + fs + 6;
          ink.text(name, x, ty, { size: fs, align: 'center', weight: k === mainIdx ? 700 : 400 });
          if (k === mainIdx) ink.text('承擔主要 SOV', x, ty + 19, { size: 13, align: 'center', color: c.ink2 });
        });
        // a compass: this is a map, not a checklist
        const cxp = w - (G.narrow ? 26 : 40);
        const cyp = G.bot - (G.narrow ? 24 : 34);
        ink.line(cxp, cyp - 16, cxp, cyp + 16, { seed: 95, w: 1, passes: 1 });
        ink.line(cxp - 16, cyp, cxp + 16, cyp, { seed: 96, w: 1, passes: 1 });
        ink.text('N', cxp, cyp - 20, { font: 'latin', size: 13, align: 'center' });
        if (!G.narrow) ink.text('品牌不可能每層都做滿：點一個場域，改由它主攻', 24, G.bot - 4, { size: 13, color: c.ink2 });
        g.restore();
      }

      // ── step 5: Share of Choice Context ──
      if (mix.rings > 0.02 && !mini) {
        const a = mix.rings;
        g.save();
        g.globalAlpha *= a;
        const { rcx, rcy, r3 } = G;
        const r2 = r3 * 0.68;
        const r1 = r3 * 0.36;
        // outer: the systems the ads live in (the ads themselves orbit it)
        for (let k = 0; k < 90; k++) {
          const an = (k / 90) * Math.PI * 2;
          ascii.glyph('·', rcx + Math.cos(an) * r3, rcy + Math.sin(an) * r3, 9, c.ink, 0.6);
        }
        // middle: people talking
        ink.circle(rcx, rcy, r2, { seed: 100, w: 1.2 });
        for (let k = 0; k < 9; k++) {
          const an = (k / 9) * Math.PI * 2 + t * 0.05;
          const x = rcx + Math.cos(an) * r2;
          const y = rcy + Math.sin(an) * r2;
          ink.circle(x, y - 3, 4.5, { seed: 101 + k, w: 1.1, passes: 1 });
          ink.path([[x - 7, y + 9], [x - 5, y + 3], [x + 5, y + 3], [x + 7, y + 9]], { seed: 111 + k, w: 1.1, passes: 1 });
        }
        // inner: attention and memory
        g.save();
        g.globalAlpha *= c.hlAlpha;
        g.fillStyle = acc;
        g.beginPath();
        g.arc(rcx, rcy, r1 * 0.97, 0, Math.PI * 2);
        g.fill();
        g.restore();
        ink.circle(rcx, rcy, r1, { seed: 121, w: 1.2 });
        person(rcx, rcy + 6, G.narrow ? 9 : 12, 1, 122);
        // labels
        const items = ART.framework.items;
        const radii = [r3, r2, r1];
        if (G.wide) {
          const lx = rcx + r3 + 40;
          const lw = Math.min(G.lw, w - lx - 12);
          items.forEach(([name, desc], k) => {
            const ly = rcy - r3 * 0.55 + k * r3 * 0.55;
            const an = -0.55 + k * 0.42;
            const px = rcx + Math.cos(an) * radii[k];
            const py = rcy + Math.sin(an) * radii[k];
            ink.line(px, py, lx - 8, ly - 5, { seed: 130 + k, w: 0.9, alpha: 0.7, passes: 1 });
            ink.dot(px, py, 2.4, { seed: 133 + k });
            ink.text(name, lx, ly, { font: 'latin', size: 16, weight: 700 });
            ink.para(desc, lx, ly + 22, lw, { size: 13, color: c.ink2, lineHeight: 19 });
          });
        } else {
          const ly0 = rcy + r3 + 26;
          items.forEach(([name], k) => {
            const ly = ly0 + k * 21;
            if (ly > G.bot) return;
            ascii.glyph(['·', 'o', '@'][k], w / 2 - measure(name, 'latin', 13, 700) / 2 - 12, ly - 5, 10, c.ink, 1);
            ink.text(name, w / 2, ly, { font: 'latin', size: 13, weight: 700, align: 'center' });
          });
        }
        g.restore();
      }
    },
  };
}
