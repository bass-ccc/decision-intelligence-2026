import * as THREE from 'three';
import { rng, canvasTexture, COLORS } from './util.js';

// ---------------------------------------------------------------- fingerprint
// The People divider: a whorl with nine minutiae (one per People article).
const FP = { OVAL: 1.24, F: 27 };
function minutiae(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = 0.8 - 0.083 * i;
    const th = 0.6 - 1.02 * i;
    out.push({ u: r * Math.cos(th), v: r * Math.sin(th) * FP.OVAL, s: i % 2 ? 1 : -1 });
  }
  return out;
}
export function fpPhase(u, v, mins, F = FP.F, core = [0.03, -0.16], wob = 0) {
  const { OVAL } = FP;
  const wu = u + 0.03 * Math.sin(3.1 * v + 1.3 + wob) + 0.015 * Math.sin(7.3 * v + 0.4);
  const wv = v + 0.03 * Math.sin(2.7 * u + 0.2 - wob) + 0.015 * Math.sin(6.1 * u + 2.1);
  const cx = wu - core[0];
  const cy = (wv - core[1]) / OVAL;
  const below = Math.max(0, cy);
  const sx = 0.74 * (1 + 1.6 * below * below + 0.5 * below);
  const sy = 0.95 * (1 - 0.18 * below);
  const th = Math.atan2(cy, cx);
  let rho = Math.sqrt((cx / sx) ** 2 + (cy / sy) ** 2);
  rho *= 1 + 0.045 * Math.cos(2 * th + 0.5) + 0.015 * Math.sin(5 * th + 2 * rho);
  let p = 2 * Math.PI * F * rho * 0.92 + th;
  for (let i = 0; i < mins.length; i++) {
    const m = mins[i];
    p += m.s * Math.atan2(v - m.v, u - m.u);
  }
  return p;
}

// Draws ridges into an ImageData. colourAt(u, v, ridge) → [r, g, b, a] (0–255)
export function drawPrint(W, H, mins, colourAt, opts = {}) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const im = g.createImageData(W, H);
  const d = im.data;
  const scale = opts.scale || 1.05;
  for (let j = 0; j < H; j++) {
    const v = ((j / H) * 2 - 1) * FP.OVAL * scale;
    for (let i = 0; i < W; i++) {
      const u = ((i / W) * 2 - 1) * scale * (W / H) * FP.OVAL;
      const rr = Math.sqrt(u * u + (v / FP.OVAL) ** 2);
      const o = (j * W + i) * 4;
      if (rr > 1.0) {
        d[o + 3] = 0;
        continue;
      }
      const ph = fpPhase(u, v, mins, opts.F, opts.core, opts.wob);
      const cc = Math.cos(ph);
      let t = Math.min(1, Math.max(0, (cc + 0.3) / 1.05));
      t = t * t * (3 - 2 * t);
      const edge = 1 - Math.max(0, (rr - 0.86) / 0.14);
      const col = colourAt(u, v, t * edge, rr);
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = col[3];
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

export function fingerprintTexture() {
  const lime = new THREE.Color(COLORS.people);
  const L = [lime.r * 255, lime.g * 255, lime.b * 255];
  const c = drawPrint(560, 700, minutiae(9), (u, v, t) => {
    // the right side dissolves into a grid, like the divider art
    const grid = u > 0.1 ? Math.max(0, Math.min(1, (u - 0.1) * 2.2)) : 0;
    const k = t * (1 - grid * 0.55);
    return [L[0] * k + 30 * grid * t, L[1] * k + 60 * grid * t, L[2] * k + 50 * grid * t, 255];
  });
  // the "01" chip in the corner
  const g = c.getContext('2d');
  g.fillStyle = COLORS.people;
  g.fillRect(34, c.height - 150, 96, 110);
  g.fillStyle = '#0a0a0a';
  g.font = 'italic 300 84px "Chakra Petch", sans-serif';
  g.textAlign = 'center';
  g.fillText('01', 82, c.height - 62);
  g.fillStyle = '#e6f2c9';
  g.textAlign = 'left';
  g.font = '500 44px "Chakra Petch", sans-serif';
  g.fillText('PEOPLE  人', 150, c.height - 60);
  return canvasTexture(c);
}

// ---------------------------------------------------------------- neon signs
// All sign faces live in one atlas so every sign in the city is one draw call.
// spec: { text, sub?, no?, color, w, h (metres), vertical, style }
const PPM = 64; // pixels per metre

function neonText(g, ch, x, y, size, color, weight = 900) {
  g.font = `${weight} ${size}px "Noto Sans TC", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = size * 0.35;
  g.fillStyle = color;
  g.fillText(ch, x, y);
  g.shadowBlur = size * 0.12;
  g.fillText(ch, x, y);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.font = `${weight} ${size * 0.96}px "Noto Sans TC", sans-serif`;
  g.fillText(ch, x, y);
}

function drawSign(g, s, x0, y0, w, h) {
  g.save();
  g.translate(x0, y0);
  g.fillStyle = s.station ? '#07090a' : '#0b0c0d';
  g.fillRect(0, 0, w, h);
  const col = s.color;
  // tube frame
  g.strokeStyle = col;
  g.lineWidth = s.station ? 7 : 5;
  g.shadowColor = col;
  g.shadowBlur = 14;
  const inset = s.station ? 12 : 9;
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  let top = inset + 14;
  if (s.no) {
    // the chapter chip, like the book's dividers
    const bw = w - inset * 2 - 28;
    g.fillStyle = col;
    g.fillRect(inset + 14, top, bw, bw * 0.78);
    g.fillStyle = '#0a0a0a';
    g.font = `italic 300 ${bw * 0.62}px "Chakra Petch", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(s.no).padStart(2, '0'), w / 2, top + bw * 0.42);
    top += bw * 0.78 + 18;
  }
  const chars = [...s.text];
  if (s.vertical) {
    const avail = h - top - inset - (s.sub ? 70 : 20);
    const size = Math.min(w * 0.66, avail / chars.length);
    chars.forEach((ch, i) => neonText(g, ch, w / 2, top + size * (i + 0.5), size * 0.9, col));
    if (s.sub) {
      g.font = `500 ${Math.min(26, w * 0.14)}px "IBM Plex Mono", monospace`;
      g.fillStyle = col;
      g.textAlign = 'center';
      g.fillText(s.sub, w / 2, h - inset - 34);
    }
  } else {
    const size = Math.min(h * 0.62, (w - inset * 4) / chars.length);
    chars.forEach((ch, i) => neonText(g, ch, w / 2 + (i - (chars.length - 1) / 2) * size, h / 2, size * 0.9, col));
  }
  g.restore();
}

export function signAtlas(specs) {
  const W = 2048;
  // shelf packing
  const items = specs.map((s, i) => ({ s, i, w: Math.round(s.w * PPM), h: Math.round(s.h * PPM) }));
  const order = [...items].sort((a, b) => b.h - a.h);
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const it of order) {
    if (x + it.w > W) {
      x = 0;
      y += shelf + 2;
      shelf = 0;
    }
    it.x = x;
    it.y = y;
    x += it.w + 2;
    shelf = Math.max(shelf, it.h);
  }
  const H = Math.pow(2, Math.ceil(Math.log2(y + shelf)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  for (const it of items) drawSign(g, it.s, it.x, it.y, it.w, it.h);
  const rects = items.map((it) => [it.x / W, 1 - (it.y + it.h) / H, it.w / W, it.h / H]);
  return { texture: canvasTexture(c), rects };
}

// ---------------------------------------------------------------- small text labels (sprites / planes)
export function textPlaneTexture(lines, { w = 512, h = 128, color = '#fff', font = '500 44px "Noto Sans TC", sans-serif', sub, subFont = '400 24px "IBM Plex Mono", monospace', align = 'center' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 8;
  g.font = font;
  const x = align === 'center' ? w / 2 : 8;
  g.fillText(lines, x, sub ? h * 0.38 : h / 2);
  if (sub) {
    g.shadowBlur = 0;
    g.globalAlpha = 0.75;
    g.font = subFont;
    g.fillText(sub, x, h * 0.76);
  }
  return canvasTexture(c);
}

export { rng };
