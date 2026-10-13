// 03 A.I — voxels assemble into a head in profile, cube by cube: AI turned from generating into acting.
// Faces are shaded with glyphs (light top → dense side), edges are pencil. Click to scatter and rebuild.
import { rng, smooth, clamp } from '../engine/noise.js';

export const hint = '點一下，拆開再組回去';

// a head in profile, facing right (row 0 = top)
const PROFILE = [
  '....XXXXX....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXXX.',
  'XXXXXXXXXX.X.',
  'XXXXXXXXXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXX..',
  '..XXXXXXXXXX.',
  '..XXXXXXXXX..',
  '...XXXXXX....',
  '...XXXX......',
  '...XXXX......',
];
const DEPTH = 5;

export default function make(env) {
  const r = rng(31);
  const H = PROFILE.length;
  const solid = new Set();
  const vox = [];
  PROFILE.forEach((row, i) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'X') return;
      const y = H - 1 - i;
      for (let z = 0; z < DEPTH; z++) {
        // round the back of the skull a little
        if ((z === 0 || z === DEPTH - 1) && (x === 0 || y > 13)) continue;
        solid.add(`${x},${y},${z}`);
      }
    }),
  );
  for (const key of solid) {
    const [x, y, z] = key.split(',').map(Number);
    const top = !solid.has(`${x},${y + 1},${z}`);
    const left = !solid.has(`${x},${y},${z + 1}`);
    const right = !solid.has(`${x + 1},${y},${z}`);
    if (top || left || right) vox.push({ x, y, z, top, left, right, d: r(), sx: 0, sy: 0, sz: 0 });
  }
  const scatter = () =>
    vox.forEach((v) => {
      v.d = r();
      v.sx = (r() - 0.5) * 36;
      v.sy = (r() - 0.1) * 26;
      v.sz = (r() - 0.5) * 36;
    });
  scatter();
  // painter's order (far → near)
  vox.sort((a, b) => a.x - a.z - (b.x - b.z) || a.y - b.y || b.z - a.z);
  vox.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);
  let built = 0;
  return {
    click() {
      built = env.t;
      scatter();
    },
    frame(t) {
      const { g, w, h, ascii, ink, c } = env;
      // fit the head's projected bounds into the right part of the canvas
      const W0 = (13 + DEPTH) * 0.866;
      const H0 = 16 + (13 + DEPTH) * 0.5;
      const u = Math.min((w * (env.mini ? 0.6 : 0.42)) / W0, (h * 0.66) / H0);
      const ox = w * (env.mini ? 0.5 : 0.62) - ((13 - DEPTH) * 0.866 * u) / 2;
      const oy = h * 0.5 + (H0 * u) / 2 - (13 + DEPTH) * 0.5 * u;
      const iso = (x, y, z) => [ox + (x - z) * u * 0.866, oy + (x + z) * u * 0.5 - y * u];
      const age = t - built;
      const [hx, hy] = iso(6, 9, 2);
      ink.blob(hx, hy, u * 8.5, { color: c.ai, seed: 9, alpha: c.hlAlpha * 0.7 });
      const cell = Math.max(5, u * 0.6);
      g.lineWidth = 0.8;
      g.strokeStyle = c.pencil;
      for (const v of vox) {
        const k = smooth(clamp((age - v.d * 3) / 0.9));
        if (k <= 0) continue;
        const x = v.x + v.sx * (1 - k);
        const y = v.y + v.sy * (1 - k);
        const z = v.z + v.sz * (1 - k);
        const faces = [];
        if (v.top || k < 1) faces.push([[iso(x, y + 1, z), iso(x + 1, y + 1, z), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], 0.1]);
        if (v.left || k < 1) faces.push([[iso(x, y, z + 1), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], 0.3]);
        if (v.right || k < 1) faces.push([[iso(x + 1, y, z), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x + 1, y + 1, z)], 0.52]);
        g.globalAlpha = k;
        for (const [face, dens] of faces) {
          g.beginPath();
          face.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
          g.closePath();
          g.fillStyle = c.paper;
          g.fill();
          g.stroke();
          ascii.glyph(dens, (face[0][0] + face[2][0]) / 2, (face[0][1] + face[2][1]) / 2, cell, c.ink, 0.85 * k);
        }
      }
      g.globalAlpha = 1;
    },
  };
}
