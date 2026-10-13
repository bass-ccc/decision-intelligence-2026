// Pencil drawing for the "human" half of every picture: wobbly, slightly overshooting,
// graphite strokes that boil a little (re-drawn on twos, like hand animation).
import { rng, noise2 } from './noise.js';

export const FONTS = {
  hand: '"LXGW WenKai TC","Kaiti TC","BiauKai","DFKai-SB",serif',
  body: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
  mono: '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace',
  pixel: '"Pixelify Sans","IBM Plex Mono",monospace',
  latin: '"Montserrat","Noto Sans TC",sans-serif',
};
export const font = (kind = 'body', size = 14, weight = 400) => `${weight} ${size}px ${FONTS[kind] || kind}`;

// Canvas text never asks the browser to fetch a web font (and Chinese web fonts come in many
// small pieces), so ask for the exact characters we draw; stages redraw when they arrive.
const asked = new Set();
export function ensureFont(f, str) {
  const k = f + '|' + str;
  if (asked.has(k) || !document.fonts) return;
  asked.add(k);
  if (asked.size > 4000) asked.clear();
  document.fonts.load(f, str).catch(() => {});
}

// Build the pencil kit bound to one stage. `env` supplies g (2D context), c (colors), boil (frame seed).
export function makeInk(env) {
  const P = (o) => ({
    w: 1.3,
    color: env.c.pencil,
    alpha: 0.9,
    seed: 1,
    wobble: 1,
    passes: 2,
    boil: true,
    ...o,
  });
  const seedOf = (o) => (o.boil ? o.seed * 31 + env.boil * 7 : o.seed * 31);

  // a pencil path through points (open)
  function path(pts, o = {}) {
    o = P(o);
    const g = env.g;
    if (pts.length < 2) return;
    const base = g.globalAlpha; // a caller may fade a whole group with globalAlpha
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = o.color;
    for (let p = 0; p < o.passes; p++) {
      const r = rng(seedOf(o) + p * 101);
      g.globalAlpha = base * o.alpha * (p === 0 ? 0.8 : 0.45);
      g.lineWidth = o.w * (p === 0 ? 1 : 0.7);
      g.beginPath();
      const j = o.wobble * (p === 0 ? 0.6 : 1.1);
      let px = pts[0][0] + (r() - 0.5) * j;
      let py = pts[0][1] + (r() - 0.5) * j;
      g.moveTo(px, py);
      for (let i = 1; i < pts.length; i++) {
        const x = pts[i][0] + (r() - 0.5) * j;
        const y = pts[i][1] + (r() - 0.5) * j;
        g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        px = x;
        py = y;
      }
      g.lineTo(px, py);
      g.stroke();
    }
    g.restore();
  }

  // straight-ish pencil line with a little overshoot at both ends
  function line(x1, y1, x2, y2, o = {}) {
    o = P(o);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const r = rng(seedOf(o) + 7);
    const over = Math.min(4, len * 0.04) * o.wobble;
    const a = -over * r();
    const b = 1 + (over * r()) / len;
    const n = Math.max(2, Math.min(14, Math.round(len / 26)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = a / len + (b - a / len) * (i / n);
      const bend = Math.sin((i / n) * Math.PI) * (r() - 0.5) * 1.6 * o.wobble;
      pts.push([x1 + dx * k + nx * bend, y1 + dy * k + ny * bend]);
    }
    path(pts, o);
  }

  // hand-drawn circle: radius breathes, the end overshoots the start
  function circle(cx, cy, rad, o = {}) {
    o = P(o);
    const r = rng(seedOf(o) + 3);
    const start = r() * Math.PI * 2;
    const turn = Math.PI * 2 * (1.04 + r() * 0.08);
    const n = Math.max(12, Math.min(64, Math.round(rad * 0.9)));
    const pts = [];
    const sq = 1 + (r() - 0.5) * 0.06 * o.wobble;
    for (let i = 0; i <= n; i++) {
      const a = start + turn * (i / n);
      const rr = rad * (1 + noise2(Math.cos(a) * 0.9 + o.seed, Math.sin(a) * 0.9) * 0.035 * o.wobble) + (i / n) * 1.5 * o.wobble;
      pts.push([cx + Math.cos(a) * rr * sq, cy + Math.sin(a) * rr / sq]);
    }
    path(pts, o);
  }

  function rect(x, y, w, h, o = {}) {
    const s = (o.seed || 1) * 5;
    line(x, y, x + w, y, { ...o, seed: s + 1 });
    line(x + w, y, x + w, y + h, { ...o, seed: s + 2 });
    line(x + w, y + h, x, y + h, { ...o, seed: s + 3 });
    line(x, y + h, x, y, { ...o, seed: s + 4 });
  }

  function poly(pts, o = {}) {
    const s = (o.seed || 1) * 7;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!o.closed && i === pts.length - 1) break;
      line(a[0], a[1], b[0], b[1], { ...o, seed: s + i });
    }
  }

  // parallel hatching inside a clip (rect or circle)
  function hatch(shape, o = {}) {
    o = { angle: -0.9, gap: 5, alpha: 0.45, w: 0.9, ...o };
    const g = env.g;
    g.save();
    g.beginPath();
    let x0, y0, x1, y1;
    if (shape.r != null) {
      g.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      [x0, y0, x1, y1] = [shape.x - shape.r, shape.y - shape.r, shape.x + shape.r, shape.y + shape.r];
    } else {
      g.rect(shape.x, shape.y, shape.w, shape.h);
      [x0, y0, x1, y1] = [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h];
    }
    g.clip();
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
    const ca = Math.cos(o.angle);
    const sa = Math.sin(o.angle);
    let k = 0;
    for (let d = -R; d <= R; d += o.gap) {
      const px = cx - sa * d;
      const py = cy + ca * d;
      line(px - ca * R, py - sa * R, px + ca * R, py + sa * R, { ...o, passes: 1, seed: (o.seed || 1) * 13 + k++ });
    }
    g.restore();
  }

  // a filled graphite dot (scribbled)
  function dot(x, y, rad, o = {}) {
    const g = env.g;
    g.save();
    g.globalAlpha *= o.alpha ?? 0.9;
    g.fillStyle = o.color || env.c.ink;
    g.beginPath();
    const r = rng(seedOf(P(o)) + 11);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = rad * (0.88 + r() * 0.24);
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
    g.restore();
  }

  // arrow head at the end of a line
  function arrow(x1, y1, x2, y2, o = {}) {
    line(x1, y1, x2, y2, o);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const s = o.head || 8;
    line(x2, y2, x2 - Math.cos(a - 0.45) * s, y2 - Math.sin(a - 0.45) * s, { ...o, seed: (o.seed || 1) + 50 });
    line(x2, y2, x2 - Math.cos(a + 0.45) * s, y2 - Math.sin(a + 0.45) * s, { ...o, seed: (o.seed || 1) + 51 });
  }

  // handwritten / typeset text
  function text(str, x, y, o = {}) {
    const g = env.g;
    g.save();
    g.font = font(o.font || 'hand', o.size || 16, o.weight || 400);
    ensureFont(g.font, str);
    g.fillStyle = o.color || env.c.ink;
    g.globalAlpha *= o.alpha ?? 1;
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'alphabetic';
    if (o.rotate) {
      g.translate(x, y);
      g.rotate(o.rotate);
      g.fillText(str, 0, 0);
    } else g.fillText(str, x, y);
    g.restore();
  }

  // highlighter swipe (the book's lime / pink / cyan), drawn under things
  function marker(x, y, w, h, o = {}) {
    const g = env.g;
    g.save();
    g.globalAlpha *= o.alpha ?? env.c.hlAlpha;
    g.fillStyle = o.color || env.acc;
    const r = rng((o.seed || 1) * 17);
    g.beginPath();
    g.moveTo(x + r() * 3, y + r() * 2);
    g.lineTo(x + w - r() * 3, y + r() * 2);
    g.lineTo(x + w + r() * 2, y + h - r() * 2);
    g.lineTo(x - r() * 2, y + h - r() * 1);
    g.closePath();
    g.fill();
    g.restore();
  }

  // a round highlighter blob (soft wobbly disc)
  function blob(x, y, rad, o = {}) {
    const g = env.g;
    g.save();
    g.globalAlpha *= o.alpha ?? env.c.hlAlpha;
    g.fillStyle = o.color || env.acc;
    const r = rng((o.seed || 1) * 23);
    const n = 18;
    const ph = r() * 6.28;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ph + (i / n) * Math.PI * 2;
      const rr = rad * (0.94 + 0.12 * noise2(Math.cos(a) + (o.seed || 1), Math.sin(a)));
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  // wrap text to lines that fit maxW (CJK-aware: breaks between any characters, keeps latin words)
  function wrap(str, maxW, o = {}) {
    const g = env.g;
    g.save();
    g.font = font(o.font || 'hand', o.size || 16, o.weight || 400);
    ensureFont(g.font, str);
    const tokens = str.match(/[A-Za-z0-9.,%+\-'’]+\s?|\s|./gu) || [];
    const lines = [];
    let cur = '';
    for (const tk of tokens) {
      const next = cur + tk;
      if (g.measureText(next).width > maxW && cur) {
        // keep closing punctuation on the line
        if (/^[，。、；：！？」』）]/.test(tk)) {
          lines.push(next);
          cur = '';
          continue;
        }
        lines.push(cur);
        cur = tk.trimStart();
      } else cur = next;
    }
    if (cur) lines.push(cur);
    g.restore();
    return lines;
  }

  // draw wrapped text; returns the height used
  function para(str, x, y, maxW, o = {}) {
    const size = o.size || 16;
    const lh = o.lineHeight || size * 1.5;
    const lines = wrap(str, maxW, o);
    lines.forEach((l, i) => text(l, x, y + i * lh, o));
    return lines.length * lh;
  }

  return { path, line, circle, rect, poly, hatch, dot, arrow, text, marker, blob, wrap, para };
}
