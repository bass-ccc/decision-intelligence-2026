// Makes assets/models/bust.bin, the marble head of the Net (shell/js/world/net.js reads it in loadBust).
//   node tools/bust-bake/bake.mjs <path to marble_bust_01_1k.gltf> assets/models/bust.bin
// The source is not kept in this repo. Download these two into one folder (CC0):
//   https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/marble_bust_01/marble_bust_01_1k.gltf
//   https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/marble_bust_01/marble_bust_01.bin
// The detail map is used as it comes, saved as assets/img/bust/normal.jpg:
//   https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/marble_bust_01/marble_bust_01_nor_gl_1k.jpg
// orient.mjs found the turn (YAW, ROLL) and hslices.mjs the landmarks written below.
// Poly Haven "Marble Bust 01" (CC0, Rico Cilliers) -> the head only, in the site's head frame:
// turned to face +z, cut at the neck and capped, with per-vertex occlusion, packed small.
import fs from 'node:fs';
import { readMesh, raster, ascii } from './gltf.mjs';
import { rotate, noseTip, toHead } from './frame.mjs';

const [, , SRC, OUT] = process.argv;
const D = Math.PI / 180;
const YAW = 11 * D, ROLL = 4.75 * D; // from orient.mjs: the turn that makes the face symmetric about x = 0
const CUT = -1.12; // head units: through the neck, above where the shoulder starts

// Landmarks in head units, read off the depth maps printed by orient.mjs / hslices.mjs.
const LANDMARKS = {
  nose: [0, -0.35, 1.12],
  eyeL: [-0.27, -0.03, 0.77],
  eyeR: [0.27, -0.03, 0.77],
  mouth: [0, -0.55, 0.97],
  chin: [0, -1.0, 0.86],
  crown: [0, 1.08, 0],
  brow: 0.14, // y of the brow ridge
  cap: 0.5, // y above which it is hair: the "mind"
  ear: 0.83, // half width of the head
  cut: CUT,
};

const rot = rotate(readMesh(SRC), YAW, ROLL);
const src = toHead(rot, noseTip(rot));

// ---------------------------------------------------------------- 1. clip at the neck
const P = [], N = [], U = [], F = []; // positions, normals, uvs, flags (1 = the cut face)
const I = [];
const keep = new Map(); // old vertex -> new
const onCut = new Map(); // "a|b" edge -> new vertex on the plane
const cutSet = new Set();
const vOld = (i) => {
  if (!keep.has(i)) {
    keep.set(i, P.length / 3);
    P.push(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]);
    N.push(src.nor[i * 3], src.nor[i * 3 + 1], src.nor[i * 3 + 2]);
    U.push(src.uv[i * 2], src.uv[i * 2 + 1]);
    F.push(0);
  }
  return keep.get(i);
};
const vCut = (a, b) => {
  // a is above the plane, b below
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (!onCut.has(key)) {
    const ya = src.pos[a * 3 + 1], yb = src.pos[b * 3 + 1];
    const f = (CUT - ya) / (yb - ya);
    const mix = (arr, n, k) => arr[a * n + k] + (arr[b * n + k] - arr[a * n + k]) * f;
    onCut.set(key, P.length / 3);
    cutSet.add(P.length / 3);
    P.push(mix(src.pos, 3, 0), CUT, mix(src.pos, 3, 2));
    const n = [mix(src.nor, 3, 0), mix(src.nor, 3, 1), mix(src.nor, 3, 2)];
    const l = Math.hypot(...n) || 1;
    N.push(n[0] / l, n[1] / l, n[2] / l);
    U.push(mix(src.uv, 2, 0), mix(src.uv, 2, 1));
    F.push(0);
  }
  return onCut.get(key);
};
const cutEdges = []; // [from, to] along the plane, in the winding of the kept surface
for (let t = 0; t < src.idx.length; t += 3) {
  const tri = [src.idx[t], src.idx[t + 1], src.idx[t + 2]];
  const up = tri.map((i) => src.pos[i * 3 + 1] >= CUT);
  const n = up.filter(Boolean).length;
  if (n === 0) continue;
  if (n === 3) {
    I.push(vOld(tri[0]), vOld(tri[1]), vOld(tri[2]));
    continue;
  }
  // walk the triangle keeping its winding, replacing what is below by points on the plane
  const poly = [];
  for (let e = 0; e < 3; e++) {
    const a = tri[e], b = tri[(e + 1) % 3];
    if (up[e]) poly.push(vOld(a));
    if (up[e] !== up[(e + 1) % 3]) poly.push(up[e] ? vCut(a, b) : vCut(b, a));
  }
  for (let k = 1; k + 1 < poly.length; k++) I.push(poly[0], poly[k], poly[k + 1]);
  // the two plane points of this triangle, in order: leaving the surface then re-entering it
  const cuts = poly.filter((v) => cutSet.has(v));
  if (cuts.length === 2) {
    const ia = poly.indexOf(cuts[0]), ib = poly.indexOf(cuts[1]);
    // consecutive in the polygon (ia -> ib) means the edge runs along the plane
    cutEdges.push((ib - ia + poly.length) % poly.length === 1 ? [cuts[0], cuts[1]] : [cuts[1], cuts[0]]);
  }
}

// ---------------------------------------------------------------- 2. cap the cut
const canonOf = new Map();
const canon = (v) => {
  const k = `${Math.round(P[v * 3] * 2e4)}|${Math.round(P[v * 3 + 2] * 2e4)}`;
  if (!canonOf.has(k)) canonOf.set(k, v);
  return canonOf.get(k);
};
const next = new Map();
for (const [a, b] of cutEdges) if (canon(a) !== canon(b)) next.set(canon(a), canon(b));
const loops = [];
const seen = new Set();
for (const start of next.keys()) {
  if (seen.has(start)) continue;
  const loop = [];
  let v = start;
  while (v !== undefined && !seen.has(v)) {
    seen.add(v);
    loop.push(v);
    v = next.get(v);
  }
  loops.push({ loop, closed: v === start });
}
for (const { loop, closed } of loops) {
  if (!closed || loop.length < 3) throw new Error(`open or tiny cut loop (${loop.length} points)`);
  let cx = 0, cz = 0;
  for (const v of loop) {
    cx += P[v * 3];
    cz += P[v * 3 + 2];
  }
  cx /= loop.length;
  cz /= loop.length;
  const centre = P.length / 3;
  P.push(cx, CUT, cz);
  N.push(0, -1, 0);
  U.push(0, 0);
  F.push(1);
  const ring = loop.map((v) => {
    P.push(P[v * 3], CUT, P[v * 3 + 2]);
    N.push(0, -1, 0);
    U.push(0, 0);
    F.push(1);
    return P.length / 3 - 1;
  });
  // which way round faces down? test one triangle and keep that order for the fan
  const a = ring[0], b = ring[1];
  const ny = (P[a * 3 + 2] - cz) * (P[b * 3] - cx) - (P[a * 3] - cx) * (P[b * 3 + 2] - cz);
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length];
    if (ny < 0) I.push(centre, p, q);
    else I.push(centre, q, p);
  }
}

const nv = P.length / 3;
if (nv > 65535) throw new Error('too many vertices for 16-bit indices');

// ---------------------------------------------------------------- 3. occlusion per vertex
// The head is filled into a grid of small cells; a vertex is occluded by however much of the
// space just outside it, on its own side, is solid. Gives the sockets, nostrils, ears and the
// underside of the hair their shade.
const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
  min[k] = Math.min(min[k], P[i + k]);
  max[k] = Math.max(max[k], P[i + k]);
}
const CELL = 0.028;
const g0 = min.map((v) => v - CELL * 3);
const dim = max.map((v, k) => Math.ceil((v - g0[k]) / CELL) + 3);
const solid = new Uint8Array(dim[0] * dim[1] * dim[2]);
{
  // z-crossings of every (x, y) column
  const cols = Array.from({ length: dim[0] * dim[1] }, () => []);
  for (let t = 0; t < I.length; t += 3) {
    const v = [0, 1, 2].map((k) => I[t + k] * 3);
    const X = v.map((o) => (P[o] - g0[0]) / CELL), Y = v.map((o) => (P[o + 1] - g0[1]) / CELL), Z = v.map((o) => P[o + 2]);
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]);
    if (Math.abs(den) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...X))), x1 = Math.min(dim[0] - 1, Math.ceil(Math.max(...X)));
    const y0 = Math.max(0, Math.floor(Math.min(...Y))), y1 = Math.min(dim[1] - 1, Math.ceil(Math.max(...Y)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const w0 = ((Y[1] - Y[2]) * (cx - X[2]) + (X[2] - X[1]) * (cy - Y[2])) / den;
        const w1 = ((Y[2] - Y[0]) * (cx - X[2]) + (X[0] - X[2]) * (cy - Y[2])) / den;
        const w2 = 1 - w0 - w1;
        // half-open so a point on a shared edge is counted once
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        cols[y * dim[0] + x].push(w0 * Z[0] + w1 * Z[1] + w2 * Z[2]);
      }
  }
  let odd = 0;
  for (let y = 0; y < dim[1]; y++)
    for (let x = 0; x < dim[0]; x++) {
      const zs = cols[y * dim[0] + x].sort((a, b) => a - b);
      if (zs.length % 2) odd++;
      for (let k = 0; k + 1 < zs.length; k += 2) {
        const a = Math.max(0, Math.ceil((zs[k] - g0[2]) / CELL - 0.5)), b = Math.min(dim[2] - 1, Math.floor((zs[k + 1] - g0[2]) / CELL - 0.5));
        for (let z = a; z <= b; z++) solid[x + dim[0] * (y + dim[1] * z)] = 1;
      }
    }
  console.log(`grid ${dim.join(' x ')}, columns with an odd number of crossings: ${odd} of ${dim[0] * dim[1]}`);
}
const isSolid = (x, y, z) => {
  const i = Math.floor((x - g0[0]) / CELL), j = Math.floor((y - g0[1]) / CELL), k = Math.floor((z - g0[2]) / CELL);
  return i >= 0 && j >= 0 && k >= 0 && i < dim[0] && j < dim[1] && k < dim[2] && solid[i + dim[0] * (j + dim[1] * k)] === 1;
};
// directions spread over the sphere
const DIRS = Array.from({ length: 96 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 96, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});
const STEPS = [0.06, 0.12, 0.2, 0.32];
const AO = new Float32Array(nv);
for (let v = 0; v < nv; v++) {
  if (F[v]) {
    AO[v] = 1;
    continue;
  }
  const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
  const p = [P[v * 3] + n[0] * CELL * 1.2, P[v * 3 + 1] + n[1] * CELL * 1.2, P[v * 3 + 2] + n[2] * CELL * 1.2];
  let occ = 0, tot = 0;
  for (const d of DIRS) {
    const c = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    if (c < 0.1) continue;
    let hit = 0;
    for (let s = 0; s < STEPS.length; s++)
      if (isSolid(p[0] + d[0] * STEPS[s], p[1] + d[1] * STEPS[s], p[2] + d[2] * STEPS[s])) {
        hit = 1 - s * 0.2; // nearer blockers shade more
        break;
      }
    occ += hit * c;
    tot += c;
  }
  AO[v] = Math.max(0, Math.min(1, 1 - (occ / tot) * 1.15));
}

// ---------------------------------------------------------------- 4. pack
let uvMin = [1e9, 1e9], uvMax = [-1e9, -1e9];
for (let i = 0; i < U.length; i += 2) for (let k = 0; k < 2; k++) {
  uvMin[k] = Math.min(uvMin[k], U[i + k]);
  uvMax[k] = Math.max(uvMax[k], U[i + k]);
}
if (uvMin[0] < 0 || uvMin[1] < 0 || uvMax[0] > 1 || uvMax[1] > 1) throw new Error('uvs outside 0..1: ' + uvMin + ' ' + uvMax);
const pos16 = new Uint16Array(nv * 3), nrm8 = new Int8Array(nv * 4), uv16 = new Uint16Array(nv * 2);
for (let v = 0; v < nv; v++) {
  for (let k = 0; k < 3; k++) pos16[v * 3 + k] = Math.round(((P[v * 3 + k] - min[k]) / (max[k] - min[k])) * 65535);
  for (let k = 0; k < 3; k++) nrm8[v * 4 + k] = Math.round(N[v * 3 + k] * 127);
  // occlusion in 7 bits, the top bit marks the cut face
  nrm8[v * 4 + 3] = Math.round(AO[v] * 127) * (F[v] ? -1 : 1) - (F[v] ? 1 : 0);
  uv16[v * 2] = Math.round(U[v * 2] * 65535);
  uv16[v * 2 + 1] = Math.round(U[v * 2 + 1] * 65535);
}
const idx16 = Uint16Array.from(I);
const header = {
  version: 1,
  source: 'Marble Bust 01, Rico Cilliers, polyhaven.com, CC0',
  vertices: nv,
  indices: I.length,
  min: min.map((v) => +v.toFixed(5)),
  max: max.map((v) => +v.toFixed(5)),
  landmarks: LANDMARKS,
};
let json = Buffer.from(JSON.stringify(header), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const head8 = Buffer.alloc(8);
head8.write('BUST', 0, 'latin1');
head8.writeUInt32LE(json.length, 4);
const file = Buffer.concat([head8, json, pad4(Buffer.from(pos16.buffer)), pad4(Buffer.from(nrm8.buffer)), pad4(Buffer.from(uv16.buffer)), pad4(Buffer.from(idx16.buffer))]);
fs.writeFileSync(OUT, file);

// ---------------------------------------------------------------- 5. report
const edges = new Map();
for (let t = 0; t < I.length; t += 3)
  for (let e = 0; e < 3; e++) {
    const a = I[t + e], b = I[t + ((e + 1) % 3)];
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(k, (edges.get(k) || 0) + 1);
  }
let open = 0;
for (const c of edges.values()) if (c === 1) open++;
const aoSorted = Float32Array.from(AO).sort();
console.log(`vertices ${nv} (was ${src.nv}), triangles ${I.length / 3} (was ${src.nt})`);
console.log(`cut loops: ${loops.length} (${loops.map((l) => l.loop.length + ' points').join(', ')}); edges used by only one triangle: ${open} (the cap is a separate skin, so its rim and the neck rim count: expect ${loops.reduce((s, l) => s + l.loop.length * 2, 0)})`);
console.log(`bounds ${min.map((v) => v.toFixed(2))} .. ${max.map((v) => v.toFixed(2))}`);
console.log(`occlusion: min ${aoSorted[0].toFixed(2)}, 10% ${aoSorted[Math.floor(nv * 0.1)].toFixed(2)}, median ${aoSorted[Math.floor(nv * 0.5)].toFixed(2)}, max ${aoSorted[nv - 1].toFixed(2)}`);
console.log(`file ${file.length} bytes -> ${OUT}`);
const out = { pos: Float32Array.from(P), nor: Float32Array.from(N), idx: Uint32Array.from(I), nv, nt: I.length / 3 };
console.log('\nfront');
console.log(ascii(raster(out, { ax: 0, ay: 1, ad: 2, sign: 1, x0: -1.05, x1: 1.05, y0: -1.2, y1: 1.15, cols: 84, rows: 47, light: [0.5, 0.6, 0.62] })));
console.log('\nfrom the +x side (face to the right)');
console.log(ascii(raster(out, { ax: 2, ay: 1, ad: 0, sign: 1, x0: -1.3, x1: 1.3, y0: -1.2, y1: 1.15, cols: 104, rows: 47, light: [0.5, 0.6, 0.62] })));
console.log('\nfrom below (x across, face toward the bottom of the page)');
console.log(ascii(raster(out, { ax: 0, ay: 2, ad: 1, sign: -1, x0: -1.05, x1: 1.05, y0: -1.3, y1: 1.3, cols: 84, rows: 52, light: [0.3, 0.3, 0.9] })));
