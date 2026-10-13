// 序章 Intro — 看懂世界. One turning globe, seen twice: to the left of the seam a person draws it
// (pencil meridians and hatching in its shadow), to the right an AI reads it (glyph density = light).
// The seam follows the cursor.
import { approach, rng } from '../engine/noise.js';

export const hint = '移動游標，換一雙眼睛';

export default function make(env) {
  let seam = env.w * 0.6;
  let hatch = [];
  function build() {
    const r = rng(3);
    hatch = Array.from({ length: env.mini ? 500 : 1600 }, () => [r() * 2 - 1, r() * 2 - 1, r()]);
  }
  build();
  return {
    resize: build,
    frame(t, dt) {
      const { g, w, h, ink, ascii, c, pointer } = env;
      const cx = w * 0.62;
      const cy = h * 0.46;
      const R = Math.min(w * 0.33, h * 0.38);
      const want = pointer.in ? pointer.x : cx + Math.sin(t * 0.3) * R * 0.7;
      seam = dt > 0 ? approach(seam, want, dt, 0.2) : want;
      // light from the upper left, slowly orbiting
      const la = t * 0.18 + 2.4;
      const L = [Math.cos(la), -0.45, Math.sin(la) * 0.6 + 0.7];
      const ln = Math.hypot(...L);
      const shade = (x, y) => {
        const nx = (x - cx) / R;
        const ny = (y - cy) / R;
        const d = nx * nx + ny * ny;
        if (d > 1) return -1;
        const nz = Math.sqrt(1 - d);
        return Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ln);
      };
      // AI half: glyph density follows the light
      const cell = env.mini ? 8 : 11;
      g.save();
      g.beginPath();
      g.rect(seam, 0, w - seam, h);
      g.clip();
      ascii.field(cx - R, cy - R, R * 2, R * 2, cell, (x, y) => {
        const s = shade(x, y);
        return s < 0 ? -1 : 0.14 + s * 0.84;
      }, c.ink, 0.9);
      g.restore();
      // human half: meridians and parallels, hatching where the shadow falls
      g.save();
      g.beginPath();
      g.rect(0, 0, seam, h);
      g.clip();
      const spin = t * 0.25;
      for (let m = 0; m < 12; m++) {
        const phi = spin + (m / 12) * Math.PI * 2;
        if (Math.cos(phi) <= 0.02) continue; // back of the globe
        const pts = [];
        for (let s = 0; s <= 36; s++) {
          const lat = -Math.PI / 2 + (s / 36) * Math.PI;
          pts.push([cx + Math.sin(phi) * Math.cos(lat) * R, cy + Math.sin(lat) * R]);
        }
        ink.path(pts, { w: 0.9, alpha: 0.3 + Math.cos(phi) * 0.35, seed: 10 + m, passes: 1 });
      }
      for (let p = 1; p < 6; p++) {
        const y = cy - R + (p / 6) * 2 * R;
        const rx = Math.sqrt(Math.max(0, R * R - (y - cy) ** 2));
        ink.line(cx - rx, y, cx + rx, y, { w: 0.8, alpha: 0.45, seed: 30 + p, passes: 1 });
      }
      g.strokeStyle = c.pencil;
      g.lineCap = 'round';
      g.lineWidth = 1;
      g.globalAlpha = 0.65;
      g.beginPath();
      for (const [u, v, k] of hatch) {
        const x = cx + u * R;
        const y = cy + v * R;
        const s = shade(x, y);
        if (s < 0 || k < s * 1.3) continue;
        const len = 3 + (1 - s) * 4;
        g.moveTo(x - len * 0.7, y + len * 0.7);
        g.lineTo(x + len * 0.7, y - len * 0.7);
      }
      g.stroke();
      g.restore();
      ink.circle(cx, cy, R, { seed: 4, w: 1.5 });
      // the seam
      ink.line(seam, cy - R * 1.12, seam, cy + R * 1.12, { w: 1, alpha: 0.7, seed: 7, wobble: 1.4, passes: 1 });
      if (!env.mini) {
        ink.text('人', seam - 12, cy + R * 1.12, { size: 16, align: 'right', color: c.ink });
        ascii.text('AI', seam + 10, cy + R * 1.12 - 6, 12, c.ink);
      }
    },
  };
}
