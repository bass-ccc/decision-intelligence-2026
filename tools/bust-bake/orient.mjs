// node orient.mjs <path to .gltf> [yawDeg rollDeg] : find the turn that makes the face look
// straight at +z, then print the head in head units so eyes, mouth and hairline can be read off.
import { readMesh, raster, ascii } from './gltf.mjs';
import { rotate, noseTip, asymmetry, toHead } from './frame.mjs';

const src = readMesh(process.argv[2]);
const D = Math.PI / 180;
let yaw, roll;
if (process.argv[3]) {
  yaw = Number(process.argv[3]) * D;
  roll = Number(process.argv[4] || 0) * D;
} else {
  let best = [1e9, 0, 0];
  for (let y = 8; y <= 36; y += 1)
    for (let r = -8; r <= 8; r += 1) {
      const a = asymmetry(rotate(src, y * D, r * D));
      if (a < best[0]) best = [a, y, r];
    }
  // refine
  const [, y0, r0] = best;
  for (let y = y0 - 1; y <= y0 + 1; y += 0.25)
    for (let r = r0 - 1; r <= r0 + 1; r += 0.25) {
      const a = asymmetry(rotate(src, y * D, r * D));
      if (a < best[0]) best = [a, y, r];
    }
  console.log(`best: yaw ${best[1]} deg, roll ${best[2]} deg, asymmetry ${(best[0] * 1000).toFixed(2)} mm (unturned: ${(asymmetry(src) * 1000).toFixed(2)} mm)`);
  yaw = best[1] * D;
  roll = best[2] * D;
}
const rot = rotate(src, yaw, roll);
const nose = noseTip(rot);
const h = toHead(rot, nose);
let b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
for (let i = 0; i < h.pos.length; i += 3) {
  if (h.pos[i + 1] < -1.2) continue;
  for (let k = 0; k < 3; k++) {
    b.min[k] = Math.min(b.min[k], h.pos[i + k]);
    b.max[k] = Math.max(b.max[k], h.pos[i + k]);
  }
}
console.log('nose tip (m, rotated)', nose.map((v) => v.toFixed(4)));
console.log('head bounds above the cut, head units', b.min.map((v) => v.toFixed(2)), b.max.map((v) => v.toFixed(2)));

const X0 = -1.0, X1 = 1.0, Y0 = -1.25, Y1 = 1.15, cols = 100, rows = 60;
const front = raster(h, { ax: 0, ay: 1, ad: 2, sign: 1, x0: X0, x1: X1, y0: Y0, y1: Y1, cols, rows });
console.log('\nfront, depth in steps of 0.05 head units behind the nose tip (0-9, then a-z; . beyond)');
console.log('      ' + Array.from({ length: cols }, (_, c) => (c % 10 === 0 ? '|' : ' ')).join('') + '   x: -1.0 at the first |, +0.2 per |');
for (let r = 0; r < rows; r++) {
  let line = '';
  for (let c = 0; c < cols; c++) {
    const d = front.depth[r * cols + c];
    if (d === -Infinity) line += ' ';
    else {
      const k = Math.floor((1.12 - d) / 0.05);
      line += k < 0 ? '0' : k < 10 ? String(k) : k < 36 ? String.fromCharCode(87 + k) : '.';
    }
  }
  console.log((Y1 - ((r + 0.5) / rows) * (Y1 - Y0)).toFixed(2).padStart(5) + ' ' + line.replace(/\s+$/, ''));
}
console.log('\nfront, shaded');
console.log(ascii(raster(h, { ax: 0, ay: 1, ad: 2, sign: 1, x0: X0, x1: X1, y0: Y0, y1: Y1, cols, rows, light: [0.5, 0.6, 0.62] })));
console.log('\nside (looking at the +x side: face to the right), shaded');
console.log(ascii(raster(h, { ax: 2, ay: 1, ad: 0, sign: 1, x0: -1.3, x1: 1.3, y0: Y0, y1: Y1, cols: 104, rows, light: [0.5, 0.6, 0.62] })));
