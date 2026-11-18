// The transform from the model's metres to the site's head frame (face toward +z, y up,
// chin about -1.0, crown about +1.1, nose tip at x = 0, z = NOSE_Z), shared by orient and bake.
import { raster } from './gltf.mjs';

export const Y_CUT = 0.252; // model metres: the neck at its narrowest, just above the shoulders
export const Y_CHIN = 0.272; // underside of the chin
export const Y_CROWN = 0.515; // top of the hair
export const NOSE_Z = 1.12;
export const SCALE = 2.1 / (Y_CROWN - Y_CHIN);

// yaw about y then roll about z (radians), applied to positions and normals
export function rotate(m, yaw, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  const R = (v, o) => {
    const x = v[o] * cy + v[o + 2] * sy;
    const z = -v[o] * sy + v[o + 2] * cy;
    const y = v[o + 1];
    v[o] = x * cr - y * sr;
    v[o + 1] = x * sr + y * cr;
    v[o + 2] = z;
  };
  const pos = Float32Array.from(m.pos), nor = Float32Array.from(m.nor);
  for (let i = 0; i < pos.length; i += 3) {
    R(pos, i);
    R(nor, i);
  }
  return { ...m, pos, nor };
}

export function noseTip(m, yLo = 0.3, yHi = 0.45) {
  let best = -1;
  for (let i = 0; i < m.nv; i++) {
    const y = m.pos[i * 3 + 1];
    if (y < yLo || y > yHi) continue;
    if (best < 0 || m.pos[i * 3 + 2] > m.pos[best * 3 + 2]) best = i;
  }
  return [m.pos[best * 3], m.pos[best * 3 + 1], m.pos[best * 3 + 2]];
}

// how unlike its own mirror image the face is, seen from +z (lower is more symmetric)
export function asymmetry(m) {
  const n = noseTip(m);
  const half = 0.055, cols = 44, rows = 48;
  const img = raster(m, { ax: 0, ay: 1, ad: 2, sign: 1, x0: n[0] - half, x1: n[0] + half, y0: n[1] - 0.05, y1: n[1] + 0.07, cols, rows });
  let sum = 0, cnt = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols / 2; c++) {
      const a = img.depth[r * cols + c], b = img.depth[r * cols + (cols - 1 - c)];
      if (a === -Infinity || b === -Infinity) { sum += 0.03; cnt++; continue; }
      sum += Math.abs(a - b);
      cnt++;
    }
  return sum / cnt;
}

// metres (already rotated) -> head units
export function toHead(m, nose) {
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (m.pos[i] - nose[0]) * SCALE;
    pos[i + 1] = (m.pos[i + 1] - Y_CHIN) * SCALE - 1.0;
    pos[i + 2] = (m.pos[i + 2] - nose[2]) * SCALE + NOSE_Z;
  }
  return { ...m, pos };
}
