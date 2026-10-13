// 15 生成式體驗來臨 — a straight journey map turns out to be a map of decisions; the customer stops at every fork.
// step 0  旅程地圖 (dashed) vs 決策地圖 (forks): a pencil customer hesitates with "?", glyph carts drift away (70.2%)
// step 1  the three decision breakpoints marked on the map (決策節點 · 決策支援 · 服務延續)
// step 2  ANA × Hitachi: the path breaks, three glyph options are generated at once, one is taken, he walks on
// step 3  momo: a glyph spec sheet gains pencil context tags (應用場景 · 可解決的問題 · 使用效益) so AI can read it
// step 4  靜態 CX → 適應式 CX → 生成式 CX, under "You can automate commerce, but you can’t automate trust."
// step 5  five pillars (透明度 控制權 安全網 隱私力 治理力) hold a roof of trust over the whole map
// Click near a branch while he hesitates: you give him the next step. Wait too long and he may leave.
import { ARTICLES } from '../content.js';
import { rng, hash, noise2, smooth, lerp, approach, clamp, easeOut } from '../engine/noise.js';

export const hint = '點分岔，幫他選下一步';

const STAGES = ['認知', '興趣', '比較', '轉換', '售後'];
// how each branch bows out (× amplitude), packed with where it bends (0 = right at the fork)
const FORKS = [
  [[-0.75, 0.4], [0.6, 0.55]],
  [[-1.05, 0.3], [0.05, 0.5], [0.95, 0.38]],
  [[-0.6, 0.45], [0.3, 0.3], [1.15, 0.5]],
  [[-0.85, 0.35], [0.7, 0.6]],
];
const GEN = [[-1.35, 0.5], [0.05, 0.5], [1.35, 0.5]]; // the three generated options in step 2
const MAP_Y = [0.56, 0.4, 0.6, 0.76, 0.68, 0.62]; // where the map sits in each step (share of the height)
const BREAKS = [
  ['企業設計旅程', '顧客面對決策節點', '決策節點'],
  ['企業做個人化', '顧客要決策支援', '決策支援'],
  ['企業導入 AI 功能', '顧客在意服務延續', '服務延續'],
];
const TAGS = ['應用場景', '可解決的問題', '使用效益'];
const CX = [
  ['靜態 CX', '固定流程'],
  ['適應式 CX', '依情境調整'],
  ['生成式 CX', '即時組合下一步'],
];

export default function make(env) {
  const A = ARTICLES.find((a) => a.no === 15);
  const PILLARS = A
    ? A.framework.items.map(([zh, d]) => [zh, d.split('——')[0]])
    : [['透明度', 'Credibility'], ['控制權', 'Reversibility'], ['安全網', 'Escalation'], ['隱私力', 'Compliance'], ['治理力', 'Auditing']];
  const r = rng(15);
  const mix = { journey: 1, breaks: 0, ana: 0, sheet: 0, cx: 0, roof: 0 };
  let G = {};
  let first = true;
  let helped = 0;
  let left = 0;
  let flash = null; // the branch you just chose, highlighted for a moment
  const carts = [];

  // the one customer we follow (still frames always show him hesitating at 興趣)
  const cust = { st: 'wait', k: 1, b: FORKS[0][0], gen: false, u: 0, wt: 0, pat: 3.8, ab: -1, id: 0, g: 0, pick: -1, pickAt: 0, lu: 0, gt: 0 };
  function spawn() {
    cust.id++;
    cust.st = 'walk';
    cust.k = 0;
    cust.b = FORKS[0][Math.floor(hash(cust.id, 1) * 2)];
    cust.gen = false;
    cust.u = 0;
    cust.wt = 0;
    cust.pat = 3.2 + hash(cust.id, 2) * 1.3;
    // left alone, about seven in ten never reach the end (70.2% cart abandonment)
    cust.ab = hash(cust.id, 3) < 0.702 ? 1 + Math.floor(hash(cust.id, 4) * 3) : -1;
  }

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 8 : 34;
    const bot = mini ? h - 8 : h - 52;
    const H = bot - top;
    G = { ...G, w, h, top, bot, H };
    G.mx0 = w * (mini ? 0.1 : 0.08);
    G.mx1 = w * (mini ? 0.9 : 0.92);
    G.amp = mini ? H * 0.16 : clamp(H * 0.12, 20, 84);
    G.small = H < 380 || w < 560;
    G.cartCell = mini ? 9 : clamp(w / 90, 9, 12);
    if (G.my == null) G.my = top + H * (mini ? 0.6 : MAP_Y[env.step] ?? 0.56);
  }
  geom();

  // seed a few carts already drifting away, so the still frame tells the story
  for (let i = 0; i < (env.mini ? 3 : 5); i++) {
    const k = 1 + (i % 3);
    carts.push({ x: lerp(G.mx0, G.mx1, k / 4) + (r() - 0.3) * 50, y: G.my - G.amp * (1.6 + i * 0.5), vx: 6 + r() * 10, vy: -9 - r() * 6, age: 1 + i * 1.3, seed: i });
  }

  const nodeX = (k) => lerp(G.mx0, G.mx1, k / 4);
  // a point on branch b = [bow, bend] of segment k (quadratic), u in 0..1
  function bpt(k, b, u) {
    const x0 = nodeX(k);
    const x1 = nodeX(k + 1);
    const cx = lerp(x0, x1, b[1]);
    const cy = G.my + b[0] * G.amp * 2;
    const v = 1 - u;
    return [v * v * x0 + 2 * u * v * cx + u * u * x1, v * v * G.my + 2 * u * v * cy + u * u * G.my];
  }
  const bpts = (k, b, u0 = 0, u1 = 1, n = 16) => Array.from({ length: n + 1 }, (_, i) => bpt(k, b, lerp(u0, u1, i / n)));

  // glyphs along a branch: the machine's generated option
  function glyphPath(k, b, cell, alpha, u1 = 1) {
    const len = nodeX(k + 1) - nodeX(k) + Math.abs(b[0]) * G.amp * 1.2;
    const n = Math.max(4, Math.floor((len / (cell * 1.25)) * u1));
    for (let i = 1; i < n; i++) {
      const [x, y] = bpt(k, b, (i / n) * u1);
      env.ascii.glyph(i % 3 ? ':' : '+', x, y, cell, env.c.ink, alpha);
    }
  }

  function custPos() {
    if (cust.st === 'walk') return bpt(cust.k, cust.b, smooth(cust.u) * 0.94 + cust.u * 0.06);
    if (cust.st === 'leave') {
      const e = easeOut(cust.lu);
      return [nodeX(cust.k) + e * G.amp * 0.9, G.my - e * G.amp * 1.7];
    }
    if (cust.st === 'done') return [nodeX(4), G.my];
    return [nodeX(cust.k), G.my];
  }

  // nearest forward branch to a point, for the clicked or hovered fork
  function nearest(x, y, opts, k) {
    let best = 0;
    let bd = 1e9;
    opts.forEach((b, j) => {
      for (const u of [0.35, 0.5, 0.65]) {
        const [px, py] = bpt(k, b, u);
        const d = Math.hypot(px - x, py - y);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
    });
    return best;
  }

  function update(dt) {
    const s = env.step;
    if (cust.st === 'walk') {
      cust.u += dt / 1.5;
      if (cust.u >= 1) {
        cust.k++;
        cust.u = 0;
        if (cust.k >= 4) {
          cust.st = 'done';
          cust.gt = 0;
        } else {
          cust.st = s === 2 ? 'gen' : 'wait';
          cust.wt = 0;
          cust.g = 0;
          cust.pick = -1;
        }
      }
    } else if (cust.st === 'wait') {
      cust.wt += dt;
      if (s === 2) {
        cust.st = 'gen';
        cust.g = 0;
        cust.pick = -1;
      } else if (cust.wt > cust.pat) {
        if (cust.ab === cust.k) {
          cust.st = 'leave';
          cust.lu = 0;
        } else {
          const opts = FORKS[cust.k];
          go(opts[Math.floor(hash(cust.id, cust.k, 5) * opts.length)], false, false);
        }
      }
    } else if (cust.st === 'gen') {
      cust.g += dt;
      if (s !== 2) cust.st = 'wait';
      else {
        if (cust.pick < 0 && cust.g > 1.9) {
          cust.pick = Math.floor(hash(cust.id, cust.k, 6) * 3);
          cust.pickAt = cust.g;
        }
        if (cust.pick >= 0 && cust.g > cust.pickAt + 0.55) go(GEN[cust.pick], true, false);
      }
    } else if (cust.st === 'leave') {
      cust.lu += dt / 1.1;
      if (cust.lu >= 1) {
        const [x, y] = custPos();
        carts.push({ x, y, vx: 8 + hash(cust.id, 7) * 10, vy: -16, age: 0, seed: cust.id + 10 });
        left++;
        cust.st = 'gone';
        cust.gt = 0;
      }
    } else if (cust.st === 'gone' || cust.st === 'done') {
      cust.gt += dt;
      if (cust.gt > (cust.st === 'done' ? 1.3 : 0.7)) spawn();
    }
    for (const ct of carts) {
      ct.age += dt;
      ct.x += (ct.vx + noise2(ct.seed, ct.age * 0.3) * 8) * dt;
      ct.y += ct.vy * dt;
    }
    for (let i = carts.length - 1; i >= 0; i--) if (carts[i].age > 11 || carts[i].y < G.top - 20) carts.splice(i, 1);
  }

  function go(b, gen, byYou) {
    cust.st = 'walk';
    cust.b = b;
    cust.gen = gen;
    cust.u = 0;
    if (byYou) {
      helped++;
      flash = { k: cust.k, b, gen, t0: env.t };
    }
  }

  // tiny pencil person
  function person(x, y, sc, alpha) {
    const { ink } = env;
    ink.dot(x, y - 9 * sc, 4.6 * sc, { seed: 3, alpha: 0.9 * alpha });
    ink.path([[x - 7 * sc, y + 4 * sc], [x - 4 * sc, y - 2 * sc], [x, y - 3 * sc], [x + 4 * sc, y - 2 * sc], [x + 7 * sc, y + 4 * sc]], { seed: 4, w: 1.6, alpha });
  }

  function cart(x, y, cell, alpha) {
    const { ascii, c } = env;
    ascii.text('\\___/', x - cell * 1.5, y, cell, c.ink, alpha);
    ascii.text(' o o', x - cell * 1.5, y + cell * 0.95, cell, c.ink, alpha);
  }

  function box(x, y, w, h, seed, fill = true) {
    const { g, ink, c } = env;
    if (fill) {
      g.save();
      g.globalAlpha *= 0.86;
      g.fillStyle = c.sheet;
      g.fillRect(x, y, w, h);
      g.restore();
    }
    ink.rect(x, y, w, h, { seed, w: 1.1, passes: 1 });
  }

  return {
    resize: geom,
    click(x, y) {
      if (cust.st === 'wait') {
        const opts = FORKS[cust.k];
        go(opts[nearest(x, y, opts, cust.k)], false, true);
      } else if (cust.st === 'gen') {
        cust.g = Math.max(cust.g, 0.9);
        cust.pick = nearest(x, y, GEN, cust.k);
        cust.pickAt = cust.g;
        helped++;
        flash = { k: cust.k, b: GEN[cust.pick], gen: true, t0: env.t };
      }
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c, pointer } = env;
      const s = env.step;
      const still = dt === 0;
      const since = still ? 30 : t - env.stepAt;
      const want = { journey: s === 0 ? 1 : 0, breaks: s === 1 ? 1 : 0, ana: s === 2 ? 1 : 0, sheet: s === 3 ? 1 : 0, cx: s === 4 ? 1 : 0, roof: s === 5 ? 1 : 0 };
      for (const k in mix) mix[k] = still || first ? want[k] : approach(mix[k], want[k], dt, 0.3);
      const myT = G.top + G.H * (env.mini ? 0.6 : MAP_Y[s]);
      G.my = still || first ? myT : approach(G.my, myT, dt, 0.35);
      first = false;
      if (!still) update(dt);
      const { my, amp } = G;
      const fs = G.small ? 13 : 15;

      // ── 5 · the roof and pillars stand behind the map ──
      if (mix.roof > 0.02) {
        const a = mix.roof;
        g.save();
        g.globalAlpha = a;
        const eave = my - amp - (G.small ? 30 : 48);
        const ground = my + amp + 14;
        const apex = Math.max(G.top + 14, eave - (G.small ? 46 : 84));
        const rx0 = G.mx0 - 22;
        const rx1 = G.mx1 + 22;
        const pw = clamp(w / 48, 12, 24);
        PILLARS.forEach(([zh, en], k) => {
          const x = nodeX(k);
          const rise = still ? 1 : easeOut((since - 0.15 - k * 0.16) / 0.6);
          if (rise <= 0) return;
          const y1 = ground - (ground - eave - 12) * rise;
          ink.marker(x - pw / 2, y1, pw, ground - y1, { seed: 300 + k, alpha: c.hlAlpha * 0.55 });
          ink.line(x - pw / 2, ground, x - pw / 2, y1, { seed: 310 + k, w: 1.2 });
          ink.line(x + pw / 2, ground, x + pw / 2, y1, { seed: 320 + k, w: 1.2 });
          ink.line(x - pw * 0.8, y1, x + pw * 0.8, y1, { seed: 330 + k, w: 1.2 });
          ink.line(x - pw * 0.8, ground, x + pw * 0.8, ground, { seed: 340 + k, w: 1.2 });
          if (!env.mini) {
            ink.text(zh, x, ground + 24, { size: G.small ? 13 : 16, align: 'center', alpha: rise });
            if (!G.small) ink.text(en, x, ground + 42, { font: 'latin', size: 12, align: 'center', color: c.ink2, alpha: rise });
          }
        });
        const rk = still ? 1 : smooth((since - 0.9) / 0.6);
        if (rk > 0) {
          g.globalAlpha = a * rk;
          ink.line(rx0, eave, rx1, eave, { seed: 350, w: 1.5 });
          ink.line(rx0 + 6, eave + 12, rx1 - 6, eave + 12, { seed: 351, w: 1.1 });
          ink.poly([[rx0, eave], [w / 2, apex], [rx1, eave]], { seed: 352, w: 1.5 });
          if (!env.mini) {
            const tw = G.small ? 96 : 150;
            ink.marker(w / 2 - tw / 2, eave - (G.small ? 22 : 34), tw, G.small ? 18 : 24, { seed: 353 });
            ink.text('信任與安全感', w / 2, eave - (G.small ? 8 : 16), { size: G.small ? 14 : 18, align: 'center' });
          }
        }
        ink.line(G.mx0 - 30, ground, G.mx1 + 30, ground, { seed: 360, w: 1, alpha: 0.6 });
        if (!env.mini && !G.small) {
          g.globalAlpha = a;
          ink.text('看得懂、能確認、可選擇', w / 2, G.bot - 10, { size: 15, align: 'center', color: c.ink2 });
        }
        g.restore();
      }

      // ── 0 · the company's straight journey, dashed ──
      if (mix.journey > 0.02) {
        g.save();
        g.globalAlpha = mix.journey;
        g.setLineDash([5, 7]);
        ink.line(G.mx0, my, G.mx1, my, { seed: 20, w: 1, alpha: 0.75, passes: 1 });
        g.setLineDash([]);
        if (!env.mini && !G.small) {
          const lx = G.mx0;
          const ly = G.bot - 12;
          g.setLineDash([5, 7]);
          ink.line(lx, ly - 5, lx + 34, ly - 5, { seed: 21, w: 1, passes: 1 });
          g.setLineDash([]);
          ink.text('旅程地圖：企業設計的路', lx + 44, ly, { size: 14, color: c.ink2 });
          ink.path([[lx + 230, ly - 1], [lx + 245, ly - 11], [lx + 262, ly - 1]], { seed: 22, w: 1.3 });
          ink.text('決策地圖：顧客面對的岔路', lx + 272, ly, { size: 14, color: c.ink2 });
        }
        g.restore();
      }

      // ── the decision map: forks between the five stages ──
      if (still && s === 2 && cust.st === 'wait') {
        // a still frame of step 2 shows the moment after the break: three options, one being taken
        cust.st = 'gen';
        cust.g = 2.1;
        cust.pick = 1;
        cust.pickAt = 2;
      }
      const cur = mix.ana > 0.3 && (cust.st === 'gen' || (cust.st === 'walk' && cust.gen)) ? cust.k : -1;
      const gk = cust.st === 'gen' ? cust.g : 3;
      let hov = -1;
      if (cust.st === 'wait' && pointer.in && !env.mini) {
        const opts = FORKS[cust.k];
        hov = nearest(pointer.x, pointer.y, opts, cust.k);
      }
      for (let k = 0; k < 4; k++) {
        FORKS[k].forEach((b, j) => {
          const seed = 30 + k * 5 + j;
          let alpha = 0.9;
          if (k === cur) alpha = 0.22;
          const isHov = cust.st === 'wait' && k === cust.k && j === hov;
          if (cust.st === 'wait' && k === cust.k) {
            ink.path(bpts(k, b, 0, 1, 14), { seed: seed + 100, w: isHov ? 9 : 6, color: c.faint, alpha: 1, passes: 1, wobble: 0.3 });
          }
          // breakpoint 3: the service does not carry over between touchpoints
          if (k === 3 && mix.breaks > 0.02) {
            const gap = 0.12 * mix.breaks;
            ink.path(bpts(k, b, 0, 0.5 - gap, 8), { seed, w: 1.3, alpha });
            ink.path(bpts(k, b, 0.5 + gap, 1, 8), { seed: seed + 1, w: 1.3, alpha });
          } else ink.path(bpts(k, b), { seed, w: isHov ? 1.9 : 1.3, alpha });
        });
      }
      // the branch you chose glows for a moment
      if (flash && t - flash.t0 < 2.4) {
        const k = 1 - smooth((t - flash.t0 - 1.4) / 1);
        ink.path(bpts(flash.k, flash.b, 0, 1, 14), { seed: 90, w: 7, color: env.acc, alpha: c.hlAlpha * k, passes: 1, wobble: 0.4 });
      }
      // nodes and stage names
      for (let k = 0; k <= 4; k++) {
        const x = nodeX(k);
        ink.circle(x, my, 5.5, { seed: 60 + k, w: 1.3 });
        ink.dot(x, my, 1.8, { seed: 65 + k });
        if (!env.mini) ink.text(STAGES[k], x, my + amp + 24, { size: fs, align: 'center', color: c.ink2, alpha: 1 - mix.roof });
      }

      // ── 1 · three decision breakpoints ──
      if (mix.breaks > 0.02 && !env.mini) {
        g.save();
        g.globalAlpha = mix.breaks;
        BREAKS.forEach(([a1, a2, short], i) => {
          const k = i + 1;
          const x = nodeX(k);
          const kk = still ? 1 : smooth((since - 0.2 - i * 0.35) / 0.5);
          g.globalAlpha = mix.breaks * kk;
          ink.circle(x, my, 17, { seed: 70 + i, w: 1.5 });
          const num = '①②③'[i];
          if (G.small) {
            ink.text(num, x, my - amp - 12, { size: 16, align: 'center' });
            ink.text(short, x, my + amp + 44, { size: 13, align: 'center' });
          } else {
            const bw = Math.min(176, (G.mx1 - G.mx0) / 4 - 8);
            const f1 = bw < 165 ? 12.5 : 14;
            const by = my + amp + 40;
            ink.line(x, my + amp + 32, x, by - 2, { seed: 75 + i, w: 0.9, alpha: 0.6, passes: 1 });
            box(x - bw / 2, by, bw, 62, 80 + i);
            ink.marker(x - bw / 2 + 8, by + 8, 26, 22, { seed: 85 + i });
            ink.text(num, x - bw / 2 + 21, by + 25, { size: 16, align: 'center' });
            ink.text(a1, x - bw / 2 + 38, by + 25, { size: f1, color: c.ink2 });
            ink.text(a2, x - bw / 2 + 12, by + 50, { size: f1 + 1 });
          }
        });
        // personalisation is not decision support: more glyph options crowd around 比較
        const x2 = nodeX(2);
        for (let q = 0; q < 14; q++) {
          const a = q * 2.4 + t * 0.2;
          const rr = 28 + hash(q, 1) * 26;
          ascii.glyph(hash(q, 2) < 0.5 ? '+' : '*', x2 + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.75, 10, c.ink2, 0.7 * mix.breaks);
        }
        g.restore();
        if (!G.small) ink.text('看見顧客在哪裡猶豫、需要什麼支援', w / 2, G.top + 30, { size: 17, align: 'center', alpha: mix.breaks });
      }

      // ── 2 · the path breaks, options are generated at once ──
      if (cur >= 0) {
        const a = mix.ana;
        const [bx, by] = bpt(cur, [0, 0.5], 0.22);
        g.save();
        g.globalAlpha = a * clamp(gk / 0.3);
        // a pencil zigzag across the broken path
        ink.path([[bx - 4, by - amp * 1.1], [bx + 6, by - amp * 0.4], [bx - 5, by + amp * 0.1], [bx + 6, by + amp * 0.7], [bx - 3, by + amp * 1.2]], { seed: 110, w: 1.6 });
        if (!env.mini) ink.text('路徑被打斷', bx, by - amp * 1.1 - 10, { size: 14, align: 'center', color: c.ink2 });
        g.restore();
        GEN.forEach((b, j) => {
          const grow = clamp((gk - 0.35 - j * 0.12) / 0.45);
          if (grow <= 0) return;
          const chosen = cust.st === 'gen' ? cust.pick === j : cust.b === b;
          if (chosen) ink.path(bpts(cur, b, 0, 1, 14), { seed: 120 + j, w: 7, color: env.acc, alpha: c.hlAlpha * a, passes: 1, wobble: 0.4 });
          glyphPath(cur, b, G.small ? 8 : 10, a * ((cust.st === 'gen' ? cust.pick >= 0 : true) && !chosen ? 0.35 : 0.95), grow);
          if (grow > 0.9 && !env.mini) {
            const [ox, oy] = bpt(cur, b, 0.62);
            ascii.text('ABC'[j], ox + 6, oy - 10, 12, c.ink, a);
          }
        });
      }
      if (mix.ana > 0.02 && !env.mini) {
        g.save();
        g.globalAlpha = mix.ana;
        const ty = G.top + (G.small ? 24 : 34);
        ink.text('ANA × Hitachi · Operations Brain', w / 2, ty, { font: 'latin', size: G.small ? 13 : 16, weight: 500, align: 'center' });
        ink.text('自動產生航班異常的修正方案', w / 2, ty + (G.small ? 20 : 26), { size: fs, align: 'center', color: c.ink2 });
        if (!G.small) {
          const bx = w / 2 - 105;
          const by = ty + 46;
          ink.marker(bx, by, 74, 32, { seed: 130 });
          ink.text('70%', bx + 37, by + 24, { font: 'mono', size: 22, align: 'center' });
          ink.text('修訂審議時間最多縮短', bx + 84, by + 22, { size: 15 });
          ink.text('重點不是用了 AI，而是立刻給出可行的下一步', w / 2, G.bot - 10, { size: 15, align: 'center', color: c.ink2 });
        }
        g.restore();
      }

      // ── 3 · product data that AI can read ──
      if (mix.sheet > 0.02 && !env.mini) {
        const a = mix.sheet;
        g.save();
        g.globalAlpha = a;
        const bw = Math.min(w * 0.8, 560);
        const bx = w / 2 - bw / 2;
        const bh = G.small ? 150 : 222;
        const by = Math.max(G.top + 8, (G.top + my - amp - 30) / 2 - bh / 2);
        const x2 = nodeX(2);
        ink.line(x2, my - 18, clamp(x2, bx + 20, bx + bw - 20), by + bh, { seed: 140, w: 0.9, alpha: 0.6, passes: 1 });
        box(bx, by, bw, bh, 141);
        const pad = G.small ? 12 : 18;
        const lh = G.small ? 18 : 26;
        let y = by + pad + 12;
        if (!G.small) {
          ink.text('顧客問：「哪一款適合露營、防水、好攜帶？」', bx + pad, y, { size: 15 });
          y += 34;
        }
        ink.text('momo 商品資料', bx + pad, y, { size: G.small ? 13 : 15, color: c.ink2 });
        y += lh * 0.9;
        // the spec sheet: glyph rows
        const rows = G.small ? 3 : 5;
        const cell = G.small ? 8 : 11;
        const specW = bw * 0.44;
        for (let q = 0; q < rows; q++) {
          const n = Math.floor((specW / cell) * (0.55 + 0.4 * hash(q, 3)));
          for (let i = 0; i < n; i++) ascii.glyph(i < 3 ? 0.85 : 0.25 + hash(q, i) * 0.5, bx + pad + i * cell, y + q * (cell + 6), cell, c.ink, 0.9);
        }
        ascii.text('規格參數', bx + pad, y + rows * (cell + 6) + 6, 11, c.ink2, 0.9);
        // pencil context tags, one by one
        const tx = bx + pad + specW + (G.small ? 14 : 30);
        const tw = bx + bw - pad - tx;
        TAGS.forEach((tag, i) => {
          const k = still ? 1 : smooth((since - 0.5 - i * 0.45) / 0.45);
          if (k <= 0) return;
          const ty = y - 8 + i * (G.small ? 22 : 32);
          g.globalAlpha = a * k;
          ink.marker(tx, ty - 4, Math.min(tw, (G.small ? 13 : 15) * tag.length + 16), G.small ? 18 : 24, { seed: 150 + i });
          ink.text(tag, tx + 8, ty + (G.small ? 10 : 14), { size: G.small ? 13 : 15 });
          ink.line(tx - 6, ty + 6, tx - (G.small ? 12 : 24), ty + 6, { seed: 155 + i, w: 0.9, passes: 1 });
        });
        // the AI reads it: a glyph scan line, then it understands
        const done = still ? 1 : smooth((since - 2) / 0.5);
        g.globalAlpha = a;
        const sy = by + bh - (G.small ? 14 : 22);
        if (!still && since > 1.9) {
          const sx = bx + pad + ((since * 0.45) % 1) * (bw - pad * 2);
          for (let q = 0; q < 6; q++) ascii.glyph('|', sx, y - 10 + q * ((bh - (y - by) - 20) / 6), 10, c.ink2, 0.5);
        }
        ascii.text(done > 0.5 ? 'AI ▸ 情境 · 問題 · 效益' : 'AI ▸ ? ? ?', bx + pad, sy, G.small ? 10 : 12, c.ink, 0.9);
        if (done > 0.5) ink.path([[bx + bw - pad - 22, sy], [bx + bw - pad - 15, sy + 6], [bx + bw - pad, sy - 9]], { seed: 160, w: 1.8, alpha: done });
        if (!G.small) ink.text('讓商品資訊能被 AI 正確理解與索引', w / 2, G.bot - 10, { size: 15, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── 4 · static → adaptive → generative CX, and the line about trust ──
      if (mix.cx > 0.02 && !env.mini) {
        const a = mix.cx;
        g.save();
        g.globalAlpha = a;
        const qs = G.small ? 14 : clamp(w / 48, 15, 20);
        const l1 = 'You can automate commerce,';
        const l2 = "but you can't automate trust.";
        const y1 = G.top + qs + 6;
        ink.text(l1, w / 2, y1, { font: 'latin', size: qs, weight: 500, align: 'center' });
        g.save();
        g.font = env.font('latin', qs, 500);
        const w2 = g.measureText(l2).width;
        const wt = g.measureText('trust.').width;
        g.restore();
        ink.marker(w / 2 + w2 / 2 - wt - 4, y1 + qs * 0.45, wt + 8, qs * 1.15, { seed: 170 });
        ink.text(l2, w / 2, y1 + qs * 1.45, { font: 'latin', size: qs, weight: 500, align: 'center' });
        if (!G.small) ink.text('Mastercard', w / 2 + w2 / 2, y1 + qs * 1.45 + 20, { font: 'latin', size: 12, align: 'right', color: c.ink2 });
        // three small diagrams
        const iy = G.small ? y1 + qs * 1.45 + 34 : G.top + (my - amp - G.top) * 0.62;
        const iw = Math.min(w * 0.22, 190);
        CX.forEach(([name, sub], i) => {
          const cx = w * (0.2 + 0.3 * i);
          const x0 = cx - iw / 2;
          const x1 = cx + iw / 2;
          const p = (t * 0.25 + i * 0.3) % 1;
          if (i === 0) {
            ink.line(x0, iy, x1, iy, { seed: 180, w: 1.3 });
            for (let q = 0; q < 4; q++) ink.rect(lerp(x0, x1, (q + 0.5) / 4) - 4, iy - 4, 8, 8, { seed: 181 + q, w: 0.9, passes: 1 });
            ink.dot(lerp(x0, x1, p), iy - 10, 3, { seed: 186 });
          } else if (i === 1) {
            const bend = Math.sin(t * 0.9) * 14;
            const pts = Array.from({ length: 13 }, (_, q) => [lerp(x0, x1, q / 12), iy + Math.sin((q / 12) * Math.PI) * bend]);
            ink.path(pts, { seed: 190, w: 1.3 });
            const q = p * 12;
            ink.dot(lerp(x0, x1, p), iy + Math.sin((q / 12) * Math.PI) * bend - 8, 3, { seed: 191 });
          } else {
            const hx = x0 + iw * 0.3;
            ink.line(x0, iy, hx, iy, { seed: 195, w: 1.3 });
            ink.dot(hx, iy - 8, 3, { seed: 196 });
            const beat = Math.floor(t / 1.6);
            [-0.5, 0, 0.5].forEach((an, j) => {
              const L = iw * 0.62;
              const on = hash(beat, j) < 0.6 || j === beat % 3;
              if (!on) return;
              ascii.line(hx + 6, iy, hx + 6 + Math.cos(an) * L, iy + Math.sin(an) * L * 0.6, 9, c.ink, j === beat % 3 ? 0.9 : 0.45, ':');
            });
          }
          ink.text(name, cx, iy + (G.small ? 26 : 38), { size: G.small ? 13 : 16, align: 'center' });
          if (!G.small) ink.text(sub, cx, iy + 58, { size: 13, align: 'center', color: c.ink2 });
          if (i < 2) ink.arrow(x1 + 10, iy, w * (0.2 + 0.3 * (i + 1)) - iw / 2 - 10, iy, { seed: 199 + i, w: 1, alpha: 0.6, head: 6 });
        });
        if (!G.small) ink.text('體驗越順暢，信任越不能省略', w / 2, G.bot - 10, { size: 15, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── carts drifting away (people who left) ──
      const cartA = 1 - Math.max(mix.ana, mix.sheet, mix.cx, mix.roof) - mix.breaks * 0.45;
      for (const ct of carts) {
        const al = clamp(ct.age / 0.6) * (1 - smooth((ct.age - 7) / 4)) * cartA;
        if (al > 0.02) cart(ct.x, ct.y, G.cartCell, 0.85 * al);
      }
      if (mix.journey > 0.02 && !env.mini) {
        g.save();
        g.globalAlpha = mix.journey;
        const lx = w - (G.small ? 16 : 28);
        const ly = G.top + (G.small ? 24 : w < 960 ? 86 : 46);
        ink.text('70.2%', lx, ly, { font: 'mono', size: G.small ? 18 : 26, align: 'right' });
        ink.text('全球平均購物車放棄率', lx, ly + (G.small ? 20 : 26), { size: G.small ? 13 : 15, align: 'right', color: c.ink2 });
        g.restore();
      }

      // ── the customer ──
      const [px, py] = custPos();
      const sc = env.mini ? 0.8 : G.small ? 0.85 : 1;
      let pa = 1;
      if (cust.st === 'gone') pa = 0;
      if (cust.st === 'leave') pa = 1 - cust.lu * 0.6;
      if (cust.st === 'done') pa = 1 - smooth((cust.gt - 0.6) / 0.6);
      if (pa > 0.02) {
        const sway = cust.st === 'wait' && !still ? Math.sin(t * 2.4) * 2.2 : 0;
        ink.blob(px + sway, py - 6 * sc, 17 * sc, { seed: 5, alpha: c.hlAlpha * pa });
        person(px + sway, py, sc, pa);
        if (cust.st === 'wait' || (cust.st === 'gen' && cust.g < 0.5)) {
          const grow = cust.st === 'wait' ? clamp(0.75 + cust.wt / cust.pat) : 0.8;
          const nervous = cust.st === 'wait' && cust.wt > cust.pat * 0.7 && !still ? Math.sin(t * 18) * 1.5 : 0;
          ink.text('?', px + sway + nervous, py - 24 * sc, { size: (env.mini ? 20 : 26) * grow, align: 'center', weight: 700 });
        }
        if (cust.st === 'done') ink.path([[px - 6, py - 30], [px - 1, py - 25], [px + 8, py - 36]], { seed: 8, w: 1.8, alpha: pa });
      }

      // counters
      if (!env.mini && (helped || left)) ink.text(`你幫了 ${helped} 位 · ${left} 位離開`, w - 18, G.top + (s === 0 && !G.small ? (w < 960 ? 144 : 104) : 14), { font: 'mono', size: 12, align: 'right', color: c.ink2 });
      if (!env.mini && s === 0 && !G.small) ink.text('示意', G.mx1, my - amp - 10, { size: 13, align: 'right', color: c.ink2 });
      if (!env.mini && s === 0 && !G.small) ink.text('顧客卡住，往往不是找不到入口，而是不確定下一步', w / 2, G.top + 30, { size: 16, align: 'center', alpha: mix.journey });
    },
  };
}
