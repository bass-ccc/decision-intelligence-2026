// Minimal reader for the one-mesh glTF this bake works on (separate .bin, no sparse, no stride).
import fs from 'node:fs';
import path from 'node:path';

export function readMesh(gltfPath) {
  const j = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  const bin = fs.readFileSync(path.join(path.dirname(gltfPath), j.buffers[0].uri));
  const prim = j.meshes[0].primitives[0];
  const view = (acc) => {
    const a = j.accessors[acc];
    const v = j.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
    const off = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    const buf = bin.buffer.slice(off, off + a.count * n * (a.componentType === 5126 ? 4 : a.componentType === 5125 ? 4 : 2));
    if (a.componentType === 5126) return new Float32Array(buf);
    if (a.componentType === 5123) return new Uint16Array(buf);
    if (a.componentType === 5125) return new Uint32Array(buf);
    throw new Error('component type ' + a.componentType);
  };
  const pos = view(prim.attributes.POSITION);
  const nor = view(prim.attributes.NORMAL);
  const uv = view(prim.attributes.TEXCOORD_0);
  const idx = view(prim.indices);
  const t = (j.nodes[0] && j.nodes[0].translation) || [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] += t[0];
    pos[i + 1] += t[1];
    pos[i + 2] += t[2];
  }
  return { pos, nor, uv, idx, nv: pos.length / 3, nt: idx.length / 3 };
}

// Orthographic depth + shade raster. axes: which components are screen x, screen y, depth
// (depth sign +1 keeps the largest value, i.e. looks from +depth toward -depth).
export function raster(m, { ax, ay, ad, sign = 1, x0, x1, y0, y1, cols, rows, light = [0.4, 0.5, 0.75] }) {
  const depth = new Float32Array(cols * rows).fill(-Infinity);
  const shade = new Float32Array(cols * rows).fill(-1);
  const ll = Math.hypot(...light);
  const L = light.map((v) => v / ll);
  const { pos, nor, idx } = m;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const X = [pos[a + ax], pos[b + ax], pos[c + ax]].map((v) => ((v - x0) / (x1 - x0)) * cols);
    const Y = [pos[a + ay], pos[b + ay], pos[c + ay]].map((v) => ((y1 - v) / (y1 - y0)) * rows);
    const D = [pos[a + ad] * sign, pos[b + ad] * sign, pos[c + ad] * sign];
    const minx = Math.max(0, Math.floor(Math.min(...X))), maxx = Math.min(cols - 1, Math.ceil(Math.max(...X)));
    const miny = Math.max(0, Math.floor(Math.min(...Y))), maxy = Math.min(rows - 1, Math.ceil(Math.max(...Y)));
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]);
    if (Math.abs(den) < 1e-12) continue;
    for (let py = miny; py <= maxy; py++)
      for (let px = minx; px <= maxx; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const w0 = ((Y[1] - Y[2]) * (cx - X[2]) + (X[2] - X[1]) * (cy - Y[2])) / den;
        const w1 = ((Y[2] - Y[0]) * (cx - X[2]) + (X[0] - X[2]) * (cy - Y[2])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const d = w0 * D[0] + w1 * D[1] + w2 * D[2];
        const q = py * cols + px;
        if (d <= depth[q]) continue;
        depth[q] = d;
        const n = [0, 1, 2].map((k) => w0 * nor[a + k] + w1 * nor[b + k] + w2 * nor[c + k]);
        const nl = Math.hypot(...n) || 1;
        // light given in (screen x, screen y, toward viewer) terms
        const nv = [n[ax], n[ay], n[ad] * sign].map((v) => v / nl);
        shade[q] = Math.max(0, nv[0] * L[0] + nv[1] * L[1] + nv[2] * L[2]);
      }
  }
  return { depth, shade, cols, rows };
}

export function ascii(img, ramp = ' .:-=+*#%@') {
  const out = [];
  for (let y = 0; y < img.rows; y++) {
    let line = '';
    for (let x = 0; x < img.cols; x++) {
      const s = img.shade[y * img.cols + x];
      line += s < 0 ? ' ' : ramp[Math.min(ramp.length - 1, 1 + Math.floor(s * (ramp.length - 1)))];
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
}
