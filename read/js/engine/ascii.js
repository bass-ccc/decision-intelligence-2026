// The "AI" half of every picture: monospace glyphs on a grid, from empty to dense,
// like the ASCII half of the book's cover chimp. Glyphs are pre-drawn into a small
// sprite canvas per color/size so thousands of them stay cheap to draw.
import { FONTS, ensureFont } from './ink.js';

export const RAMP = ' .·:-;=+i1$S0D#@'; // same ramp as film/js/glyphs.js
const EXTRA = '01<>/\\|[]{}()AIX*?!%&';
const CHARS = RAMP + EXTRA;
const cache = new Map();

function sheet(color, px) {
  const key = color + '|' + px;
  let s = cache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = px * CHARS.length;
  c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = `500 ${Math.round(px * 0.82)}px ${FONTS.mono}`;
  ensureFont(g.font, CHARS);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...CHARS].forEach((ch, i) => g.fillText(ch, i * px + px / 2, px / 2 + px * 0.04));
  s = { c, px };
  cache.set(key, s);
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  return s;
}
// fonts may arrive late: drop sprites so they redraw with the real face
if (document.fonts) document.fonts.addEventListener?.('loadingdone', () => cache.clear());

export function makeAscii(env) {
  const px = (cell) => Math.max(4, Math.round(cell * env.dpr));

  // one glyph centred at x,y. `v` is 0..1 density, or a character.
  function glyph(v, x, y, cell = 10, color = env.c.ink, alpha = 1) {
    const i = typeof v === 'string' ? Math.max(0, CHARS.indexOf(v)) : Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)));
    if (i === 0 && typeof v !== 'string') return;
    const s = sheet(color, px(cell));
    const g = env.g;
    const base = g.globalAlpha; // multiply, so a caller can fade a whole group
    if (alpha !== 1) g.globalAlpha = base * alpha;
    g.drawImage(s.c, i * s.px, 0, s.px, s.px, x - cell / 2, y - cell / 2, cell, cell);
    if (alpha !== 1) g.globalAlpha = base;
  }

  // fill a box with glyphs sampled from fn(x, y) -> 0..1 (return <0 to skip)
  function field(x0, y0, w, h, cell, fn, color = env.c.ink, alpha = 1) {
    const s = sheet(color, px(cell));
    const g = env.g;
    g.save();
    g.globalAlpha *= alpha;
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * cell + cell / 2;
      for (let q = 0; q < cols; q++) {
        const x = x0 + q * cell + cell / 2;
        const v = fn(x, y, q, r);
        if (!(v > 0)) continue;
        const i = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
        if (i <= 0) continue;
        g.drawImage(s.c, i * s.px, 0, s.px, s.px, x - cell / 2, y - cell / 2, cell, cell);
      }
    }
    g.restore();
  }

  // a monospace string, left-aligned at x (baseline middle)
  function text(str, x, y, cell = 10, color = env.c.ink, alpha = 1) {
    const g = env.g;
    g.save();
    g.globalAlpha *= alpha;
    g.font = `500 ${cell}px ${FONTS.mono}`;
    ensureFont(g.font, str);
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
    g.restore();
  }

  // a dotted "machine" line made of glyphs between two points
  function line(x1, y1, x2, y2, cell = 10, color = env.c.ink, alpha = 1, ch = '·') {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.floor(len / (cell * 0.9)));
    for (let i = 0; i <= n; i++) glyph(ch, x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, cell, color, alpha);
  }

  return { glyph, field, text, line, RAMP };
}

// random glyph for scramble effects
export const randomGlyph = (r) => CHARS[Math.floor(r * CHARS.length)];
