// The line between 品牌 and 人: pencil on the brand's side, glyphs on the person's side.
// k = 0 → far apart, k = 1 → the two dots meet. Used in the top bar and at the end of each article.
import { approach } from '../engine/noise.js';

export function distanceLine(getK, { label = false } = {}) {
  return function make(env) {
    let k = getK();
    let pulse = 0;
    return {
      frame(t, dt) {
        const target = getK();
        if (Math.abs(target - k) > 0.001 && dt > 0) pulse = 1;
        k = dt > 0 ? approach(k, target, dt, 0.35) : target;
        pulse = Math.max(0, pulse - dt * 0.8);
        const { w, h, ink, ascii, c } = env;
        const cy = h / 2 + (label ? 6 : 0);
        const pad = label ? 22 : 8;
        const gap = Math.max(10, (w - pad * 2) * (1 - k));
        const xl = w / 2 - gap / 2;
        const xr = w / 2 + gap / 2;
        const mid = (xl + xr) / 2;
        if (gap > 14) {
          ink.line(xl + 5, cy, mid, cy, { w: 1.1, seed: 3, wobble: 0.8 });
          const cell = Math.max(7, Math.min(10, h * 0.42));
          ascii.line(mid + cell * 0.6, cy, xr - 6, cy, cell, c.ink, 0.75, (Math.floor(t * 3) & 1) ? '·' : '-');
        }
        const r = Math.max(3, Math.min(5.5, h * 0.2)) * (1 + pulse * 0.4);
        ink.dot(xl, cy, r, { seed: 1 });
        ink.circle(xr, cy, r, { seed: 2, w: 1.4, wobble: 0.6 });
        ink.dot(xr, cy, r * 0.55, { seed: 4 });
        if (label) {
          ink.text('品牌', xl, cy - 12, { size: 13, align: 'center', color: c.ink2 });
          ink.text('人', xr, cy - 12, { size: 13, align: 'center', color: c.ink2 });
        }
      },
    };
  };
}
