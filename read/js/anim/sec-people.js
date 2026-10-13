// 01 People — a fingerprint drawn in pencil: no two people alike. Under the cursor an AI lens
// reads the same ridges as glyphs (it can measure them; it did not live them).
import { noise2, rng, approach } from '../engine/noise.js';

export const hint = '移動游標，用 AI 的眼睛看';

export default function make(env) {
  let ridges = [];
  let lens = { x: -999, y: -999, r: 0 };
  const layer = document.createElement('canvas');
  let layerKey = '';
  function build() {
    const { w, h } = env;
    const cx = w * 0.62;
    const cy = h * 0.46;
    const R = Math.min(w * 0.36, h * 0.42);
    const n = env.mini ? 16 : 30;
    ridges = [];
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const pts = [];
      const steps = 120;
      // a whorl: ellipses whose centre drifts and whose radius is bent by noise
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const bend = noise2(Math.cos(a) * 1.3 + k * 2, Math.sin(a) * 1.3) * 0.12 + noise2(k * 6, a) * 0.03;
        const rr = R * k * (1 + bend) * (1 - 0.18 * Math.max(0, Math.sin(a)) * (1 - k));
        const ox = Math.sin(k * 3) * R * 0.05;
        pts.push([cx + ox + Math.cos(a) * rr * 0.82, cy + Math.sin(a) * rr * 1.06 - (1 - k) * R * 0.12]);
      }
      // open the loop a little (a ridge ending), like a real print
      const cut = Math.floor(rng(i * 7)() * steps);
      const gap = 3 + Math.floor(rng(i * 9)() * 8);
      ridges.push(pts.slice(cut + gap).concat(pts.slice(0, cut)));
    }
  }
  build();
  return {
    resize: build,
    frame(t, dt) {
      const { g, w, h, ink, ascii, c, pointer } = env;
      const want = pointer.in ? { x: pointer.x, y: pointer.y, r: Math.min(w, h) * 0.17 } : { x: w * 0.62 + Math.cos(t * 0.4) * w * 0.12, y: h * 0.46 + Math.sin(t * 0.55) * h * 0.14, r: Math.min(w, h) * 0.15 };
      if (dt > 0) {
        lens.x = approach(lens.x < -900 ? want.x : lens.x, want.x, dt, 0.15);
        lens.y = approach(lens.y < -900 ? want.y : lens.y, want.y, dt, 0.15);
        lens.r = approach(lens.r, want.r, dt, 0.3);
      } else lens = want;
      // ridges drawn progressively the first time; once complete they are cached and only
      // redrawn at the 6 fps pencil "boil" rate
      const reveal = Math.min(1, t / 3.2);
      const drawRidges = () =>
        ridges.forEach((pts, i) => {
          const upto = Math.max(2, Math.floor(pts.length * Math.min(1, reveal * 1.6 - (i / ridges.length) * 0.6)));
          if (upto < 3) return;
          ink.path(pts.slice(0, upto), { w: 1.15, seed: i + 1, wobble: 1.1, alpha: 0.85 });
        });
      if (reveal < 1) {
        layerKey = '';
        drawRidges();
      } else {
        const key = [env.boil, w, h, env.dpr, c.pencil].join('|');
        if (key !== layerKey) {
          layer.width = Math.round(w * env.dpr);
          layer.height = Math.round(h * env.dpr);
          const lg = layer.getContext('2d');
          lg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
          env.g = lg;
          drawRidges();
          env.g = g;
          layerKey = key;
        }
        g.drawImage(layer, 0, 0, w, h);
      }
      // the AI lens: paper inside, ridges re-read as glyphs
      g.save();
      g.beginPath();
      g.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2);
      g.fillStyle = c.paper;
      g.globalAlpha = 0.94;
      g.fill();
      g.globalAlpha = 1;
      g.clip();
      const cell = env.mini ? 7 : 9;
      ridges.forEach((pts) => {
        for (let s = 0; s < pts.length; s += 1) {
          const [x, y] = pts[s];
          if (Math.abs(x - lens.x) > lens.r + 8 || Math.abs(y - lens.y) > lens.r + 8) continue;
          ascii.glyph(((s * 7) % 5) / 10 + 0.45, x, y, cell, c.ink, 0.9);
        }
      });
      g.restore();
      ink.circle(lens.x, lens.y, lens.r, { seed: 3, w: 1.4, color: c.ink });
      ink.blob(lens.x + lens.r * 0.72, lens.y - lens.r * 0.72, 9, { color: c.people, seed: 5, alpha: 0.95 });
      if (!env.mini) ascii.text('AI', lens.x + lens.r * 0.72 - 7, lens.y - lens.r * 0.72, 10, c.ink);
    },
  };
}
