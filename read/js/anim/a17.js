// 17 顧客為何停下來？ — a pencil cursor (the customer) in front of a glyph interface: why does it stop?
// step 0  the cursor circles a "下一步" button and backs off; the restaurant doubts float beside it
// step 1  pushed vs understood: glyph urgency (現在點最划算) drives it away, a pencil note (辣度可以調整) brings it closer
// step 2  the elevator button: no answer, so it clicks again and again; ripples pile up, a glyph heat map grows
// step 3  four placements, four tasks (打開探索 · 協助比較 · 補強信心 · 最後提醒), then +132% / +210%
// step 4  conversion climbs as a glyph line, but pencil weights hang under it: 退款率 客服量 假帳號率 長期回訪
// step 5  the closed loop 看見問題 → 理解問題 → 驗證決策 → 沉澱學習; every lap adds a layer of organisational skill
// Click, and click again: ripples, a counter, a heat map; after a while the system finally answers.
import { ARTICLES } from '../content.js';
import { hash, smooth, lerp, approach, clamp, easeOut, easeInOut } from '../engine/noise.js';

export const hint = '連點看看';

const DOUBTS = ['份量夠嗎？', '會不會太辣？', '是否可以客製？', '如果不合胃口怎麼辦？'];
const PUSH = ['現在點最划算', '今天只剩最後幾份'];
const PAGES = [
  ['首頁', '打開探索'],
  ['品類頁', '協助比較'],
  ['商品頁', '補強信心'],
  ['購物車', '最後提醒'],
];
const RISK = ['退款率', '客服量', '假帳號率', '長期回訪'];
// the cursor: a pencil arrow pointer
const ARROW = [[0, 0], [0, 17], [4.4, 13.2], [7.4, 19.6], [10, 18.5], [7.1, 12.3], [12.6, 12.3]];

export default function make(env) {
  const A = ARTICLES.find((a) => a.no === 17);
  const LOOP = A
    ? A.framework.items.map(([zh, d]) => [zh, d.split('——')[0]])
    : [['看見問題', '追蹤提供可觀測性'], ['理解問題', '分析提供線索'], ['驗證決策', '實驗驗證'], ['沉澱學習', '知識庫累積']];
  const mix = { hes: 1, push: 0, lift: 0, reco: 0, risk: 0, loop: 0 };
  let G = {};
  let first = true;
  // rage-click state, shared by every step
  const clicks = [];
  let burst = -9;
  let count = 0;
  let answered = -9;
  let lastClick = -9;
  let total = 0;
  let autoNext = 0;
  let autoLeft = 0;
  const trail = [];

  function geom() {
    const { w, h, mini } = env;
    const top = mini ? 8 : 34;
    const bot = mini ? h - 8 : h - 52;
    const H = bot - top;
    G = { w, h, top, bot, H, cx: w / 2 };
    G.small = H < 380 || w < 560;
    G.sc = mini ? 1 : clamp(Math.min(w * 1.25, H * 1.4) / 700, 0.75, 1.3);
    // step 0: a product card with its next-step button
    G.card = { x: w * (mini ? 0.5 : G.small ? 0.68 : 0.56), y: top + H * (mini ? 0.38 : 0.36), w: 150 * G.sc, h: 96 * G.sc };
    G.btn = { x: G.card.x, y: G.card.y + G.card.h / 2 + 40 * G.sc, w: 128 * G.sc, h: 40 * G.sc };
    // step 2: the elevator
    G.lift = { x: w / 2 - 70 * G.sc, y: top + H * 0.5, dw: 64 * G.sc, dh: Math.min(H * 0.52, 230 * G.sc) };
    G.call = { x: G.lift.x + G.lift.dw + 60 * G.sc, y: G.lift.y + 10 * G.sc, r: 20 * G.sc };
  }
  geom();

  function press(x, y, t) {
    if (t - lastClick > 1.4 || answered > burst) {
      if (t - answered > 0.4 || answered < burst) {
        burst = t;
        count = 0;
        clicks.length = 0;
      }
    }
    count++;
    total++;
    lastClick = t;
    clicks.push({ x, y, t });
    if (clicks.length > 40) clicks.shift();
  }

  // pencil cursor at (x, y), pressed = slightly smaller
  function cursor(x, y, sc, alpha, pressed) {
    const { g, ink, c } = env;
    const k = sc * (pressed ? 1.15 : 1.3);
    const pts = ARROW.map(([u, v]) => [x + u * k, y + v * k]);
    g.save();
    g.globalAlpha *= alpha;
    g.fillStyle = c.sheet;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
    g.restore();
    ink.poly(pts, { seed: 3, closed: true, w: 1.3, alpha });
  }

  // a button made of glyphs (the interface is the machine)
  function gbutton(x, y, bw, bh, label, alpha, lit) {
    const { ascii, ink, c } = env;
    const cell = clamp(bh / 4, 7, 11);
    const cols = Math.round(bw / cell);
    const rows = Math.round(bh / cell);
    if (lit > 0.01) ink.marker(x - bw / 2 - 3, y - bh / 2 - 3, bw + 6, bh + 6, { seed: 7, alpha: env.c.hlAlpha * lit * alpha });
    for (let q = 0; q < cols; q++) {
      ascii.glyph('=', x - bw / 2 + (q + 0.5) * cell, y - bh / 2 + cell / 2, cell, c.ink, 0.8 * alpha);
      ascii.glyph('=', x - bw / 2 + (q + 0.5) * cell, y + bh / 2 - cell / 2, cell, c.ink, 0.8 * alpha);
    }
    for (let q = 1; q < rows - 1; q++) {
      ascii.glyph('|', x - bw / 2 + cell / 2, y - bh / 2 + (q + 0.5) * cell, cell, c.ink, 0.8 * alpha);
      ascii.glyph('|', x + bw / 2 - cell / 2, y - bh / 2 + (q + 0.5) * cell, cell, c.ink, 0.8 * alpha);
    }
    if (label) {
      const { g } = env;
      g.save();
      g.globalAlpha *= alpha;
      g.font = env.font('mono', Math.round(cell * 1.35), 500);
      g.fillStyle = c.ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, x, y + 1);
      g.restore();
    }
  }

  // a block of glyphs standing for a product picture or a row of text
  function gblock(x, y, bw, bh, cell, seed, alpha, dens = 0.5) {
    const cols = Math.max(1, Math.round(bw / cell));
    const rows = Math.max(1, Math.round(bh / cell));
    for (let q = 0; q < rows; q++)
      for (let p = 0; p < cols; p++) {
        const v = dens * (0.55 + 0.6 * hash(seed, q, p));
        env.ascii.glyph(v, x + (p + 0.5) * (bw / cols), y + (q + 0.5) * (bh / rows), cell, env.c.ink, alpha);
      }
  }

  function weight(x, y, ww, wh, label, seed, fs) {
    const { ink, c } = env;
    const inset = wh * 0.28;
    ink.marker(x - ww / 2 + inset * 0.6, y - wh / 2 + 2, ww - inset * 1.2, wh - 4, { seed: seed + 3 });
    ink.poly([[x - ww / 2 + inset, y - wh / 2], [x + ww / 2 - inset, y - wh / 2], [x + ww / 2, y + wh / 2], [x - ww / 2, y + wh / 2]], { seed, closed: true, w: 1.2 });
    ink.text(label, x, y + fs * 0.36, { size: fs, align: 'center', color: c.ink });
  }

  function cap(str) {
    if (env.mini || G.H < 300) return;
    env.ink.text(str, G.w / 2, G.bot - 8, { size: clamp(G.w / 26, 13, 15), align: 'center', color: env.c.ink2 });
  }

  return {
    resize: geom,
    click(x, y) {
      press(x, y, env.t);
      autoLeft = 0;
      autoNext = env.t + 4;
    },
    frame(t, dt) {
      const { g, w, ink, ascii, c } = env;
      const s = env.step;
      const still = dt === 0;
      const since = still ? 30 : t - env.stepAt;
      const want = { hes: s === 0 ? 1 : 0, push: s === 1 ? 1 : 0, lift: s === 2 ? 1 : 0, reco: s === 3 ? 1 : 0, risk: s === 4 ? 1 : 0, loop: s === 5 ? 1 : 0 };
      for (const k in mix) mix[k] = still || first ? want[k] : approach(mix[k], want[k], dt, 0.3);
      first = false;
      const fs = G.small ? 13 : 15;
      const sc = G.sc;

      // the system answers late: after ~2 s, or after the eighth click
      if (count > 0 && answered < burst && (t - burst > 2.2 || count >= 8)) answered = t;
      // the elevator scene rage-clicks by itself when you leave it alone
      if (s === 2 && !still && !env.mini) {
        if (autoLeft === 0 && t > autoNext && t - answered > 2.4 && t - lastClick > 2) {
          autoLeft = 7;
          autoNext = t + 0.5;
        }
        if (autoLeft > 0 && t > autoNext) {
          press(G.call.x + (hash(autoLeft, 1) - 0.5) * 10, G.call.y + (hash(autoLeft, 2) - 0.5) * 10, t);
          autoLeft--;
          autoNext = autoLeft ? t + 0.2 + hash(autoLeft, 3) * 0.12 : t + 4.5;
        }
      }
      const fade = answered >= burst && count ? 1 - smooth((t - answered - 0.6) / 0.8) : 1;
      const lit = answered >= burst && count ? (1 - smooth((t - answered - 1.6) / 0.6)) : 0;

      // ── 0 · the cursor hesitates in front of the next step ──
      if (mix.hes > 0.02) {
        const a = mix.hes;
        g.save();
        g.globalAlpha = a;
        const { card, btn } = G;
        gblock(card.x - card.w / 2, card.y - card.h / 2, card.w, card.h * 0.62, env.mini ? 8 : 9, 1, 0.75, 0.6);
        gblock(card.x - card.w / 2, card.y + card.h * 0.18, card.w * 0.8, 10 * sc, 7, 2, 0.8, 0.45);
        gblock(card.x - card.w / 2, card.y + card.h * 0.18 + 14 * sc, card.w * 0.5, 10 * sc, 7, 3, 0.8, 0.45);
        gbutton(btn.x, btn.y, btn.w, btn.h, env.mini ? '下一步' : '下一步 →', 1, 0);
        // the hesitating path: closer, stop, back off, circle
        const ph = still ? 2.1 : t * 0.75;
        const d = (env.mini ? 50 + 25 * (0.5 + 0.5 * Math.sin(ph * 1.3)) : 70 + 55 * (0.5 + 0.5 * Math.sin(ph * 1.3))) * sc;
        const an = Math.PI * 0.95 + Math.sin(ph * 0.7) * 0.5;
        const cx = btn.x + Math.cos(an) * d;
        const cy = btn.y + Math.sin(an) * d * 0.7;
        if (!still) {
          trail.push([cx, cy]);
          if (trail.length > 90) trail.shift();
        }
        if (trail.length > 3) ink.path(trail.filter((_, i) => i % 3 === 0), { seed: 11, w: 1, alpha: 0.35, boil: false, wobble: 0.3 });
        cursor(cx, cy, sc, 1, false);
        if (env.mini) ink.text('?', cx - 8, cy - 6, { size: 22, align: 'center', weight: 700 });
        if (!env.mini) {
          const n = still ? DOUBTS.length : Math.min(DOUBTS.length, 1 + Math.floor(since / 1.1));
          DOUBTS.slice(0, n).forEach((q, i) => {
            const x = G.small ? 12 + (i % 2) * 14 : Math.max(16, G.card.x - G.card.w / 2 - 40 * sc - 210) + (i % 2) * 22;
            const y = G.small ? G.top + 18 + i * 21 : G.card.y - G.card.h / 2 + 8 + i * 30;
            ink.text(q, x, y, { size: G.small ? 13 : 16, color: i === n - 1 ? c.ink : c.ink2 });
          });
          cap('顧客不是不知道下一步在哪，而是不確定會不會後悔');
        }
        g.restore();
      }

      // ── 1 · pushed away vs understood ──
      if (mix.push > 0.02 && !env.mini) {
        const a = mix.push;
        g.save();
        g.globalAlpha = a;
        const cyc = still ? 2.6 : since % 5;
        const k = smooth(cyc / 2.4);
        const hy = G.top + (G.small ? 22 : 34);
        [0, 1].forEach((side) => {
          const ox = w * (side ? 0.75 : 0.25);
          const by = G.top + G.H * 0.5;
          const bw = Math.min(w * 0.18, 120);
          gbutton(ox + bw * 0.25, by, bw, 34 * sc, '下一步', 1, side && k > 0.95 ? 1 : 0);
          ink.text(side ? '被理解' : '被推一把', ox, hy, { size: G.small ? 15 : 19, align: 'center' });
          let px;
          let py;
          if (side === 0) {
            // glyph urgency pushes toward the cursor; the cursor backs away
            for (let q = 0; q < 9; q++) {
              const f = ((still ? 0.4 : t * 0.6) + q / 9 + hash(q, 1) * 0.1) % 1;
              const x = ox + bw * 0.25 - bw * 0.6 - f * w * 0.14;
              const y = by - 22 + (q % 3) * 22;
              ascii.text('<<<', x, y, G.small ? 12 : 16, c.ink, 0.9 * (1 - f * 0.8));
            }
            PUSH.forEach((p, i) => {
              const tx = ox + bw * 0.25 + (G.small ? -bw * 0.4 : bw * 0.1);
              const ty = by - 44 * sc - i * 22 - 10;
              ascii.text(`[ ${p} ]`, tx - (G.small ? 50 : 80), ty, G.small ? 11 : 14, c.ink, 0.9);
            });
            px = ox - w * 0.1 - k * w * 0.08;
            py = by + 28 + k * 18;
          } else {
            // a person's note: it answers the doubt, and the cursor comes closer
            const nw = Math.min(w * 0.36, 260);
            const nx = ox - nw / 2;
            const ny = by + 40 * sc;
            g.save();
            g.fillStyle = c.sheet;
            g.globalAlpha *= 0.9;
            const note = '「辣度可以調整。第一次來，我會建議選小辣。」';
            const nfs = G.small ? 13 : 15;
            const nh = ink.wrap(note, nw - 20, { size: nfs }).length * nfs * 1.5 + 14;
            g.fillRect(nx, ny, nw, nh);
            g.restore();
            ink.rect(nx, ny, nw, nh, { seed: 30, w: 1.1, passes: 1 });
            ink.para(note, nx + 10, ny + nfs + 6, nw - 20, { size: nfs });
            px = lerp(ox - w * 0.14, ox + bw * 0.25 - 6, k);
            py = lerp(by + 34, by + 4, k);
            if (k > 0.97 && !still) {
              const e = (cyc - 2.4) / 0.6;
              if (e < 1) ink.circle(px, py, 6 + e * 22, { seed: 31, w: 1.2, alpha: 1 - e, passes: 1 });
            }
          }
          cursor(px, py, sc, 1, side === 1 && k > 0.97);
        });
        ink.line(w / 2, G.top + 14, w / 2, G.bot - 30, { seed: 33, w: 0.8, alpha: 0.35, passes: 1 });
        cap('被推一把讓人想離開；被理解，才願意往前');
        g.restore();
      }

      // ── 2 · the elevator button ──
      if (mix.lift > 0.02) {
        const a = mix.lift;
        g.save();
        g.globalAlpha = a;
        const L = G.lift;
        const open = lit * 0.12 * L.dw;
        ink.rect(L.x - L.dw - 6, L.y - L.dh / 2 - 6, L.dw * 2 + 12, L.dh + 6, { seed: 40, w: 1.3 });
        ink.rect(L.x - L.dw - open, L.y - L.dh / 2, L.dw, L.dh, { seed: 41, w: 1.1, passes: 1 });
        ink.rect(L.x + open, L.y - L.dh / 2, L.dw, L.dh, { seed: 42, w: 1.1, passes: 1 });
        const C = G.call;
        ink.rect(C.x - C.r * 1.4, C.y - C.r * 2.2, C.r * 2.8, C.r * 4.4, { seed: 43, w: 1, passes: 1 });
        if (lit > 0.01) ink.blob(C.x, C.y, C.r * 1.25, { seed: 44, alpha: c.hlAlpha * lit });
        ink.circle(C.x, C.y, C.r, { seed: 45, w: 1.5 });
        ink.poly([[C.x, C.y - C.r * 0.45], [C.x - C.r * 0.42, C.y + C.r * 0.3], [C.x + C.r * 0.42, C.y + C.r * 0.3]], { seed: 46, closed: true, w: 1.3 });
        if (!env.mini) {
          ink.text('按了沒反應，就會再按、連按', w / 2, G.top + (G.small ? 22 : 34), { size: G.small ? 15 : 18, align: 'center' });
          cap('問題不是按鈕不夠大，而是不相信系統收到了訊號');
        }
        // the cursor sits on the button while the scene clicks by itself
        const pressed = clicks.length && t - clicks[clicks.length - 1].t < 0.08;
        cursor(C.x + 4, C.y + 6, sc, 1, pressed);
        g.restore();
      }

      // ── 3 · four placements, four different jobs ──
      if (mix.reco > 0.02 && !env.mini) {
        const a = mix.reco;
        g.save();
        g.globalAlpha = a;
        const gap = G.small ? 8 : 16;
        const pw = Math.min((w * 0.92 - gap * 3) / 4, 190);
        const ph = Math.min(pw * 1.35, G.H * 0.42);
        const x0 = w / 2 - (pw * 4 + gap * 3) / 2;
        const py = G.top + G.H * 0.18;
        const k = still ? 1 : easeInOut((since - 0.8) / 1.2);
        const cell = G.small ? 6 : 8;
        PAGES.forEach(([page, task], i) => {
          const px = x0 + i * (pw + gap);
          ink.text(page, px + pw / 2, py - 10, { size: fs + 1, align: 'center' });
          ink.rect(px, py, pw, ph, { seed: 50 + i, w: 1.1, passes: 1 });
          ink.line(px, py + 14, px + pw, py + 14, { seed: 55 + i, w: 0.8, alpha: 0.6, passes: 1 });
          const ix = px + 8;
          const iy = py + 22;
          const iw = pw - 16;
          const ih = ph - 30;
          // before: the same crammed grid everywhere
          if (k < 0.99) {
            g.save();
            g.globalAlpha *= 1 - k;
            for (let q = 0; q < 4; q++) for (let p = 0; p < 3; p++) gblock(ix + p * (iw / 3) + 2, iy + q * (ih / 4) + 2, iw / 3 - 6, ih / 4 - 8, cell, i * 20 + q * 3 + p, 0.8, 0.55);
            g.restore();
          }
          if (k > 0.01) {
            g.save();
            g.globalAlpha *= k;
            if (i === 0) {
              // open up exploration: a loose spread of different things
              [[0.05, 0.05, 0.42, 0.3], [0.55, 0.12, 0.38, 0.22], [0.12, 0.48, 0.3, 0.2], [0.5, 0.45, 0.42, 0.34], [0.2, 0.76, 0.25, 0.16]].forEach(([u, v, uw, vh], q) => gblock(ix + u * iw, iy + v * ih, uw * iw, vh * ih, cell, 70 + q, 0.85, 0.5 + q * 0.06));
            } else if (i === 1) {
              // help compare: two side by side, pencil marks between
              gblock(ix, iy + ih * 0.12, iw * 0.42, ih * 0.4, cell, 80, 0.85, 0.6);
              gblock(ix + iw * 0.58, iy + ih * 0.12, iw * 0.42, ih * 0.4, cell, 81, 0.85, 0.6);
              for (let q = 0; q < 3; q++) ink.line(ix + iw * 0.06, iy + ih * (0.62 + q * 0.11), ix + iw * 0.94, iy + ih * (0.62 + q * 0.11), { seed: 82 + q, w: 0.9, alpha: 0.7, passes: 1 });
              ink.text('vs', ix + iw / 2, iy + ih * 0.34, { font: 'latin', size: 13, align: 'center', color: c.ink2 });
            } else if (i === 2) {
              // build confidence: one product, checked
              gblock(ix + iw * 0.15, iy + ih * 0.08, iw * 0.7, ih * 0.5, cell, 90, 0.85, 0.6);
              ink.path([[ix + iw * 0.3, iy + ih * 0.76], [ix + iw * 0.44, iy + ih * 0.88], [ix + iw * 0.72, iy + ih * 0.66]], { seed: 91, w: 2 });
            } else {
              // last reminder: the cart, plus one small add-on
              for (let q = 0; q < 3; q++) gblock(ix, iy + q * ih * 0.16, iw, ih * 0.11, cell, 95 + q, 0.6, 0.35);
              ink.rect(ix + iw * 0.1, iy + ih * 0.58, iw * 0.8, ih * 0.3, { seed: 98, w: 1, passes: 1 });
              gblock(ix + iw * 0.16, iy + ih * 0.62, iw * 0.3, ih * 0.22, cell, 99, 0.85, 0.6);
              ink.text('+', ix + iw * 0.68, iy + ih * 0.8, { size: 22, align: 'center' });
            }
            g.restore();
          }
          const tw = (G.small ? 13 : 15) * task.length + 12;
          g.save();
          g.globalAlpha *= 0.35 + 0.65 * k;
          ink.marker(px + pw / 2 - tw / 2, py + ph + 10, tw, G.small ? 20 : 24, { seed: 100 + i });
          ink.text(task, px + pw / 2, py + ph + (G.small ? 25 : 28), { size: G.small ? 13 : 15, align: 'center' });
          g.restore();
        });
        const nk = still ? 1 : smooth((since - 2.4) / 0.6);
        if (nk > 0) {
          g.globalAlpha = a * nk;
          const ny = py + ph + (G.small ? 62 : 86);
          [['+132%', '推薦互動率'], ['+210%', '推薦相關收益']].forEach(([n, l], i) => {
            const x = w / 2 + (i ? 1 : -1) * Math.min(w * 0.2, 150);
            ink.text(n, x, ny, { font: 'mono', size: G.small ? 22 : 32, align: 'center' });
            ink.text(l, x, ny + (G.small ? 20 : 26), { size: fs, align: 'center', color: c.ink2 });
          });
          if (!G.small) cap('依版位任務優化，推薦才從塞商品變成幫顧客少想一步');
        }
        g.restore();
      }

      // ── 4 · conversion goes up, the weights hang underneath ──
      if (mix.risk > 0.02 && !env.mini) {
        const a = mix.risk;
        g.save();
        g.globalAlpha = a;
        const x0 = w * 0.1;
        const x1 = w * 0.9;
        const base = G.top + G.H * 0.46;
        const rise = still ? 1 : easeOut((since - 0.2) / 2.2);
        const yAt = (u) => base - 12 - G.H * 0.3 * rise * Math.pow(u, 1.6) - Math.sin(u * 13) * 5 * rise;
        // the glyph line climbs
        const n = Math.floor((x1 - x0) / 9);
        for (let i = 0; i <= n; i++) ascii.glyph(i % 3 ? ':' : '+', lerp(x0, x1, i / n), yAt(i / n), 12, c.ink, 0.95);
        ascii.text('▲', x1 - 6, yAt(1) - 9, 12, c.ink, 0.9);
        ink.text('轉換率', x1 - 6, yAt(1) - 22, { size: fs + 2, align: 'right' });
        ink.line(x0, base, x1, base, { seed: 110, w: 1.1, alpha: 0.7 });
        // under the line: the cost of moving fast
        const ww = Math.min((x1 - x0) / 4 - 14, 120);
        const wh = G.small ? 22 : 30;
        const zoneY = base + 10;
        g.save();
        g.beginPath();
        g.rect(x0, zoneY, x1 - x0, G.bot - 30 - zoneY);
        g.clip();
        g.globalAlpha *= 0.14;
        g.strokeStyle = c.pencil;
        g.lineWidth = 1;
        g.beginPath();
        for (let d = 0; d < x1 - x0 + G.H; d += 10) {
          g.moveTo(x0 + d, zoneY);
          g.lineTo(x0 + d - G.H * 0.6, zoneY + G.H * 0.6);
        }
        g.stroke();
        g.restore();
        ink.text('風險控管指標', x0 + 4, zoneY + 20, { size: fs, color: c.ink2 });
        RISK.forEach((lab, i) => {
          const u = (i + 0.7) / 4.2;
          const lx = lerp(x0, x1, u);
          const ly = yAt(u);
          const drop = (G.bot - 50 - zoneY) * (0.45 + 0.4 * rise) * (0.85 + 0.15 * hash(i, 1));
          const wy = zoneY + drop;
          const sway = still ? 0 : Math.sin(t * 1.1 + i) * 3;
          ink.line(lx, ly + 4, lx + sway, wy - wh / 2, { seed: 120 + i, w: 0.9, alpha: 0.75, passes: 1 });
          weight(lx + sway, wy, ww * (0.8 + 0.3 * rise), wh, lab, 130 + i * 5, G.small ? 12 : 15);
        });
        cap('Agent 時代的風險，是把還沒想清楚的流程，自動化得更快');
        g.restore();
      }

      // ── 5 · the optimisation loop ──
      if (mix.loop > 0.02) {
        const a = mix.loop;
        g.save();
        g.globalAlpha = a;
        const cx = w / 2;
        const cy = G.top + G.H * (env.mini ? 0.5 : G.small ? 0.55 : 0.52);
        const R = Math.min(w * 0.28, G.H * (env.mini ? 0.4 : 0.32));
        ink.circle(cx, cy, R, { seed: 140, w: 1.4 });
        for (let i = 0; i < 4; i++) {
          const an = -Math.PI / 2 + (i + 0.5) * (Math.PI / 2);
          const ax = cx + Math.cos(an) * R;
          const ay = cy + Math.sin(an) * R;
          const tan = an + Math.PI / 2;
          ink.line(ax, ay, ax - Math.cos(tan - 0.5) * 9, ay - Math.sin(tan - 0.5) * 9, { seed: 141 + i, w: 1.3 });
          ink.line(ax, ay, ax - Math.cos(tan + 0.5) * 9, ay - Math.sin(tan + 0.5) * 9, { seed: 145 + i, w: 1.3 });
        }
        // glyph data running around the loop
        const lapT = 4;
        const run = still ? 0.15 : since / lapT;
        for (let q = 0; q < 10; q++) {
          const an = -Math.PI / 2 + (run % 1) * Math.PI * 2 - q * 0.07;
          ascii.glyph(q ? 0.3 + (10 - q) * 0.06 : '@', cx + Math.cos(an) * R, cy + Math.sin(an) * R, 11, c.ink, 1 - q * 0.08);
        }
        // each lap leaves a layer of learning in the middle
        const laps = still ? 4 : Math.min(7, 1 + Math.floor(run));
        const sw = R * 0.62;
        for (let l = 0; l < laps; l++) {
          const y = cy + R * 0.32 - l * (env.mini ? 5 : 9);
          ink.marker(cx - sw / 2, y - 3, sw, env.mini ? 4 : 6, { seed: 150 + l, alpha: c.hlAlpha * 0.7 });
          ink.line(cx - sw / 2, y, cx + sw / 2, y, { seed: 160 + l, w: 1.2 });
        }
        if (!env.mini) {
          ink.text('組織能力', cx, cy + R * 0.32 + 28, { size: fs, align: 'center', color: c.ink2 });
          if (!G.small) ink.text('顧客體驗優化閉環', cx, G.top + 30, { size: 18, align: 'center' });
          LOOP.forEach(([zh, sub], i) => {
            const an = -Math.PI / 2 + i * (Math.PI / 2);
            const nx = cx + Math.cos(an) * R;
            const ny = cy + Math.sin(an) * R;
            const hot = Math.floor((run % 1) * 4) === i;
            ink.dot(nx, ny, 5, { seed: 170 + i });
            const al = i === 1 ? 'left' : i === 3 ? 'right' : 'center';
            const ox = i === 1 ? 16 : i === 3 ? -16 : 0;
            const oy = i === 0 ? -30 : i === 2 ? 30 : -4;
            const tw = (G.small ? 14 : 17) * zh.length;
            const mx = al === 'left' ? nx + ox : al === 'right' ? nx + ox - tw : nx - tw / 2;
            if (hot) ink.marker(mx - 4, ny + oy - (G.small ? 15 : 18), tw + 8, G.small ? 20 : 24, { seed: 175 + i });
            ink.text(zh, nx + ox, ny + oy, { size: G.small ? 14 : 17, align: al });
            if (!G.small) ink.text(sub, nx + ox, ny + oy + 20, { size: 13, align: al, color: c.ink2 });
          });
          cap('把每一次優化，沉澱成下一次決策的基礎');
        }
        g.restore();
      }

      // ── the rage-click overlay (every step) ──
      if (clicks.length && fade > 0.01) {
        // heat: glyph density around the clicks
        let x0 = 1e9;
        let y0 = 1e9;
        let x1 = -1e9;
        let y1 = -1e9;
        for (const ck of clicks) {
          x0 = Math.min(x0, ck.x);
          y0 = Math.min(y0, ck.y);
          x1 = Math.max(x1, ck.x);
          y1 = Math.max(y1, ck.y);
        }
        const pad = 56;
        const heat = (x, y) => {
          let v = 0;
          for (const ck of clicks) {
            const d2 = (x - ck.x) ** 2 + (y - ck.y) ** 2;
            if (d2 < 3600) v += Math.exp(-d2 / 1000) * 0.3;
          }
          return v > 0.05 ? Math.min(0.95, v) * fade : -1;
        };
        if ((x1 - x0 + pad * 2) * (y1 - y0 + pad * 2) < 260000) ascii.field(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, 10, heat, c.ink, 0.85);
        for (const ck of clicks) {
          const e = (t - ck.t) / 0.7;
          if (e < 1) ink.circle(ck.x, ck.y, 6 + e * 34, { seed: 200 + (ck.t * 100) % 50, w: 1.3, alpha: (1 - e) * fade, passes: 1 });
          ink.circle(ck.x, ck.y, 7, { seed: 260, w: 0.9, alpha: 0.45 * fade, passes: 1 });
        }
        const last = clicks[clicks.length - 1];
        if (count > 1 && !env.mini) {
          const lx = Math.min(w - 70, last.x + 26);
          const ly = last.y + 8;
          if (count >= 3) ink.marker(lx - 4, ly - 20, count >= 10 ? 52 : 42, 26, { seed: 270, alpha: c.hlAlpha * fade });
          ink.text(`×${count}`, lx, ly, { font: 'mono', size: 18, alpha: fade });
          if (count >= 4) ink.text('憤怒點擊', lx, ly + 22, { size: 14, color: c.ink2, alpha: fade });
        }
      }
      // the system finally answers
      if (answered >= burst && count && t - answered < 2.2 && clicks.length) {
        const k = smooth((t - answered) / 0.25) * (1 - smooth((t - answered - 1.6) / 0.6));
        const last = clicks[clicks.length - 1];
        const bx = clamp(last.x - 46, 10, w - 110);
        const by = Math.max(G.top + 6, last.y - 70);
        g.save();
        g.globalAlpha = k;
        g.fillStyle = c.sheet;
        g.fillRect(bx, by, 96, 34);
        g.restore();
        ink.marker(bx + 6, by + 6, 84, 22, { seed: 280, alpha: c.hlAlpha * k });
        ink.rect(bx, by, 96, 34, { seed: 281, w: 1.1, alpha: k, passes: 1 });
        ink.text('收到了', bx + 48, by + 23, { size: 16, align: 'center', alpha: k });
      }
      if (!env.mini && total && s !== 2) ink.text(`已點 ${total} 下`, w - 18, G.top + 14, { font: 'mono', size: 12, align: 'right', color: c.ink2 });
    },
  };
}
