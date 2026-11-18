// node hslices.mjs <gltf> yawDeg rollDeg y1 y2 ... : cross-sections in the HEAD frame, plus landmark estimates
import { readMesh, raster } from './gltf.mjs';
import { rotate, noseTip, toHead } from './frame.mjs';

const D = Math.PI / 180;
const rot = rotate(readMesh(process.argv[2]), Number(process.argv[3]) * D, Number(process.argv[4]) * D);
const nose = noseTip(rot);
const m = toHead(rot, nose);
const ys = process.argv.slice(5).map(Number);
const X0 = -1.3, X1 = 1.3, Z0 = -1.5, Z1 = 1.3, cols = 78, rows = 42;
for (const y of ys) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (let t = 0; t < m.idx.length; t += 3) {
    const v = [0, 1, 2].map((k) => { const i = m.idx[t + k] * 3; return [m.pos[i], m.pos[i + 1], m.pos[i + 2]]; });
    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      if ((a[1] - y) * (b[1] - y) < 0) { const f = (y - a[1]) / (b[1] - a[1]); pts.push([a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f]); }
    }
    if (pts.length === 2)
      for (let s = 0; s <= 4; s++) {
        const x = pts[0][0] + (pts[1][0] - pts[0][0]) * (s / 4), z = pts[0][1] + (pts[1][1] - pts[0][1]) * (s / 4);
        minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
        const c = Math.floor(((x - X0) / (X1 - X0)) * cols), r = Math.floor(((z - Z0) / (Z1 - Z0)) * rows);
        if (c >= 0 && r >= 0 && c < cols && r < rows) grid[r][c] = '#';
      }
  }
  console.log(`\n--- y' = ${y}   x ${minx.toFixed(2)}..${maxx.toFixed(2)}  z ${minz.toFixed(2)}..${maxz.toFixed(2)}   (x ${X0}..${X1} left to right; z ${Z0} top .. ${Z1} bottom = face side)`);
  console.log(grid.map((r) => r.join('').replace(/\s+$/, '')).filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n'));
}

// landmark estimates from a fine front depth image
const cols2 = 200, rows2 = 240, FX0 = -1, FX1 = 1, FY0 = -1.2, FY1 = 1.2;
const img = raster(m, { ax: 0, ay: 1, ad: 2, sign: 1, x0: FX0, x1: FX1, y0: FY0, y1: FY1, cols: cols2, rows: rows2 });
const z = (x, y) => { const c = Math.floor(((x - FX0) / (FX1 - FX0)) * cols2), r = Math.floor(((FY1 - y) / (FY1 - FY0)) * rows2); const d = img.depth[r * cols2 + c]; return d === -Infinity ? NaN : d; };
console.log('\nmid-line profile (x = 0): y, z');
let line = [];
for (let y = 1.05; y >= -1.15; y -= 0.05) line.push(`${y.toFixed(2)}:${z(0, y).toFixed(2)}`);
console.log(line.join('  '));
for (const side of [-1, 1]) {
  // the eye: deepest point of the socket beside the bridge of the nose
  let best = null;
  for (let y = -0.2; y <= 0.25; y += 0.01)
    for (let x = 0.12; x <= 0.45; x += 0.01) {
      const d = z(side * x, y);
      if (!Number.isNaN(d) && (!best || d < best[2])) best = [side * x, y, d];
    }
  console.log(`eye socket deepest (${side < 0 ? 'x<0' : 'x>0'}):`, best.map((v) => v.toFixed(2)));
}
console.log('rows across the eyes (z at x = -0.5..0.5 step 0.05):');
for (const y of [0.15, 0.1, 0.05, 0.0, -0.05, -0.1, -0.15]) {
  const r = [];
  for (let x = -0.5; x <= 0.501; x += 0.05) r.push(z(x, y).toFixed(2));
  console.log(y.toFixed(2).padStart(5), r.join(' '));
}
console.log('rows across the mouth (z at x = -0.3..0.3 step 0.05):');
for (const y of [-0.4, -0.45, -0.5, -0.55, -0.6, -0.65, -0.7]) {
  const r = [];
  for (let x = -0.3; x <= 0.301; x += 0.05) r.push(z(x, y).toFixed(2));
  console.log(y.toFixed(2).padStart(5), r.join(' '));
}
// widest points of the head (ears) and where the top of the forehead meets the hair
let ex0 = 1e9, ex1 = -1e9;
for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 1] > -0.5 && m.pos[i + 1] < 0.5) { ex0 = Math.min(ex0, m.pos[i]); ex1 = Math.max(ex1, m.pos[i]); }
console.log('head width between y -0.5 and 0.5:', ex0.toFixed(2), ex1.toFixed(2));
