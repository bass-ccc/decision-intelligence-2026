// 終章 — the two dots. 品牌 (glyphs) on the left, 人 (pencil) on the right, as far apart as the
// articles you have not read yet (env.data.k = read / 22). Glyphs flow from the brand toward the
// person and turn into pencil as they cross: AI used to understand people. At k = 1 the two
// meet and become one disc, half glyph and half pencil, like the cover.
import { rng, noise3, smooth, lerp, approach } from '../engine/noise.js';

export const hint = '';

const GOLD = Math.PI * (3 - Math.sqrt(5));

export default function make(env) {
  const k = Math.max(0, Math.min(1, env.data?.k ?? 0));
  const N = env.mini ? 600 : 1600;
  const r = rng(5);
  const flow = Array.from({ length: env.mini ? 40 : 120 }, () => ({ p: r(), s: 0.05 + r() * 0.08, y: (r() - 0.5) * 2, v: r() }));
  let shown = 0; // the distance animates from far to the reader's real distance
  return {
    warm() {
      shown = k;
    },
    frame(t, dt) {
      const { g, w, h, ink, ascii, c } = env;
      shown = dt > 0 ? approach(shown, k, dt, 1.2) : k;
      const cy = h * 0.4;
      const R = Math.min(w, h) * 0.13;
      const far = w * 0.34;
      const gap = lerp(far, 0, smooth(shown));
      const bx = w / 2 - gap;
      const px = w / 2 + gap;
      const merged = shown > 0.995;
      const cell = env.mini ? 6 : 8;
      // brand disc (glyphs) and person disc (pencil)
      g.save();
      g.strokeStyle = c.pencil;
      g.lineCap = 'round';
      g.lineWidth = 1.1;
      g.globalAlpha = 0.8;
      g.beginPath();
      for (let i = 0; i < N; i++) {
        const rad = R * Math.sqrt((i + 0.5) / N);
        const a = i * GOLD + t * 0.05;
        const left = i % 2 === 0;
        let x = (left ? bx : px) + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad + noise3(i * 0.1, 0, t * 0.3) * 0.8;
        if (merged) x = w / 2 + Math.cos(a) * rad;
        const glyph = merged ? x < w / 2 : left;
        if (glyph) ascii.glyph(0.3 + ((i * 13) % 7) / 12, x, y, cell, c.ink, 0.9);
        else {
          g.moveTo(x - 2, y + 1.5);
          g.lineTo(x + 2, y - 1.5);
        }
      }
      g.stroke();
      g.restore();
      // the flow between them: glyphs leaving the brand become pencil past the middle
      if (!merged && gap > R * 0.5) {
        const x0 = bx + R * 1.05;
        const x1 = px - R * 1.05;
        for (const f of flow) {
          const p = (f.p + t * f.s) % 1;
          const x = lerp(x0, x1, p);
          const y = cy + f.y * R * 0.35 * Math.sin(p * Math.PI) + noise3(f.v * 9, p * 3, t * 0.4) * 6;
          if (p < 0.5) ascii.glyph(0.35 + f.v * 0.5, x, y, cell + 1, c.ink, 0.8);
          else ink.line(x - 3, y + 2, x + 3, y - 2, { w: 1.1, seed: Math.floor(f.v * 999), passes: 1, boil: false });
        }
        ink.line(w / 2, cy - R * 0.7, w / 2, cy + R * 0.7, { w: 0.8, alpha: 0.35, seed: 3, passes: 1 });
      }
      if (merged) {
        ink.circle(w / 2, cy, R * 1.08, { seed: 8, w: 1.4 });
        ink.blob(w / 2 + R * 0.8, cy - R * 0.85, 12, { color: c.people, seed: 1, alpha: 0.95 });
        ink.blob(w / 2 - R * 0.85, cy - R * 0.7, 10, { color: c.ai, seed: 2, alpha: 0.95 });
        ink.blob(w / 2 + R * 0.1, cy + R * 1.08, 9, { color: c.model, seed: 3, alpha: 0.95 });
      }
      if (!env.mini) {
        ink.text('品牌', merged ? w / 2 - R * 0.5 : bx, cy + R + 32, { size: 18, align: 'center', color: c.ink });
        ink.text('人', merged ? w / 2 + R * 0.5 : px, cy + R + 32, { size: 18, align: 'center', color: c.ink });
      }
    },
  };
}
