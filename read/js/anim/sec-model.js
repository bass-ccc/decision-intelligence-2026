// 02 Model — the sunflower turns into a data spiral. 5,045 seeds (the CCS sample) turn slowly;
// near the cursor they become glyphs, as if the model were reading that part of the flower.
import { approach } from '../engine/noise.js';

export const hint = '移動游標，讓模型讀一讀';

const GOLD = Math.PI * (3 - Math.sqrt(5));

export default function make(env) {
  const N = env.mini ? 1200 : 5045;
  let P = { x: -1e4, y: -1e4 };
  return {
    frame(t, dt) {
      const { g, w, h, ascii, ink, c, pointer } = env;
      const cx = w * 0.6;
      const cy = h * 0.45;
      const R = Math.min(w * 0.38, h * 0.44);
      const sc = R / Math.sqrt(N);
      const want = pointer.in ? pointer : { x: cx + Math.cos(t * 0.3) * R * 0.55, y: cy + Math.sin(t * 0.3) * R * 0.55 };
      P.x = dt > 0 && P.x > -9e3 ? approach(P.x, want.x, dt, 0.12) : want.x;
      P.y = dt > 0 && P.y > -9e3 ? approach(P.y, want.y, dt, 0.12) : want.y;
      const L = R * 0.42;
      const rot = t * 0.04;
      ink.blob(cx, cy, R * 0.26, { color: c.model, seed: 6, alpha: c.hlAlpha * 0.55 });
      g.save();
      g.strokeStyle = c.pencil;
      g.lineCap = 'round';
      g.lineWidth = 1.1;
      g.globalAlpha = 0.78;
      g.beginPath();
      const cell = env.mini ? 5 : 7;
      for (let i = 0; i < N; i++) {
        const a = i * GOLD + rot * (1 - i / N);
        const rr = Math.sqrt(i + 0.5) * sc * (1 + Math.sin(t * 0.6 + i * 0.37) * 0.012);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        const d = Math.hypot(x - P.x, y - P.y);
        if (d < L) {
          const k = 1 - d / L;
          ascii.glyph(0.3 + k * 0.65, x, y, cell + k * 3, k > 0.6 ? c.ink : c.ink2, 0.95);
        } else {
          const s = 1.3 + (i / N) * 0.8;
          g.moveTo(x - Math.cos(a + 1.3) * s, y - Math.sin(a + 1.3) * s);
          g.lineTo(x + Math.cos(a + 1.3) * s, y + Math.sin(a + 1.3) * s);
        }
      }
      g.stroke();
      g.restore();
      if (!env.mini) ascii.text(`n = ${N.toLocaleString()}`, cx + R * 0.7, cy + R + 8, 11, c.ink2);
    },
  };
}
