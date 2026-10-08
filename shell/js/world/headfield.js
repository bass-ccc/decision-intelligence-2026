// Pure maths for the shell (the voxel head). No three.js, so it can run in a worker.

const sdSphere = (x, y, z, r) => Math.hypot(x, y, z) - r;
function sdEllipsoid(x, y, z, a, b, c) {
  const k0 = Math.hypot(x / a, y / b, z / c);
  const k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c));
  return k0 < 1e-6 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
}
function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// Head in local units, face toward +z, y up. Chin ≈ -1.0, crown ≈ 1.1.
export function sdHead(x, y, z) {
  const ax = Math.abs(x);
  let d = sdEllipsoid(x, y - 0.26, z + 0.1, 0.72, 0.86, 0.93);
  d = smin(d, sdEllipsoid(x, y + 0.24, z - 0.1, 0.6, 0.66, 0.74), 0.28);
  d = smin(d, sdEllipsoid(x, y + 0.74, z - 0.42, 0.28, 0.22, 0.24), 0.2);
  d = smin(d, sdSphere(ax - 0.43, y + 0.02, z - 0.46, 0.22), 0.16);
  d = smin(d, sdCapsule(x, y, z, -0.34, 0.24, 0.72, 0.34, 0.24, 0.72, 0.1), 0.12);
  d = smax(d, -sdSphere(ax - 0.27, y - 0.1, z - 0.86, 0.15), 0.08);
  d = smin(d, sdSphere(ax - 0.27, y - 0.1, z - 0.74, 0.12), 0.02);
  d = smin(d, sdCapsule(x, y, z, 0, 0.18, 0.86, 0, -0.18, 1.03, 0.075), 0.1);
  d = smin(d, sdSphere(x, y + 0.2, z - 1.0, 0.1), 0.06);
  d = smin(d, sdSphere(ax - 0.1, y + 0.24, z - 0.92, 0.08), 0.05);
  d = smin(d, sdEllipsoid(x, y + 0.43, z - 0.88, 0.22, 0.055, 0.08), 0.05);
  d = smin(d, sdEllipsoid(x, y + 0.54, z - 0.86, 0.18, 0.055, 0.08), 0.05);
  d = smax(d, -sdEllipsoid(x, y + 0.485, z - 0.95, 0.2, 0.012, 0.06), 0.01);
  d = smin(d, sdEllipsoid(ax - 0.73, y - 0.04, z + 0.04, 0.08, 0.26, 0.16), 0.06);
  d = smin(d, sdCapsule(x, y, z, 0, -0.55, -0.12, 0, -1.55, -0.3, 0.37), 0.22);
  return d;
}

// Part of the shell each voxel belongs to — the order the A.I articles assemble it:
// 0 eyes (17) · 1 nerves (18) · 2 face (19) · 3 skin (20) · 4 voice (21) · 5 mind (22)
export function partOf(x, y, z, inner) {
  const ax = Math.abs(x);
  if (y > 0.62) return 5;
  if (z > 0.5 && ax > 0.1 && ax < 0.44 && y > -0.06 && y < 0.3) return 0;
  if (z > 0.55 && ax < 0.3 && y > -0.66 && y < -0.34) return 4;
  if (inner) return 1;
  if (z > 0.3 && y > -1.12) return 2;
  return 3;
}

// Returns Float32Array of [x, y, z, part] for the two outermost voxel layers.
export function voxelShell(cell) {
  const bounds = { x: [-0.92, 0.92], y: [-1.5, 1.18], z: [-1.12, 1.18] };
  const nx = Math.ceil((bounds.x[1] - bounds.x[0]) / cell);
  const ny = Math.ceil((bounds.y[1] - bounds.y[0]) / cell);
  const nz = Math.ceil((bounds.z[1] - bounds.z[0]) / cell);
  const inside = new Uint8Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    const z = bounds.z[0] + (k + 0.5) * cell;
    for (let j = 0; j < ny; j++) {
      const y = bounds.y[0] + (j + 0.5) * cell;
      for (let i = 0; i < nx; i++) {
        const x = bounds.x[0] + (i + 0.5) * cell;
        inside[idx(i, j, k)] = sdHead(x, y, z) < 0 ? 1 : 0;
      }
    }
  }
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : inside[idx(i, j, k)]);
  const shell1 = (i, j, k) => !at(i + 1, j, k) || !at(i - 1, j, k) || !at(i, j + 1, k) || !at(i, j - 1, k) || !at(i, j, k + 1) || !at(i, j, k - 1);
  const out = [];
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!at(i, j, k)) continue;
        const outer = shell1(i, j, k);
        const second = !outer && (shell1(i + 1, j, k) || shell1(i - 1, j, k) || shell1(i, j + 1, k) || shell1(i, j - 1, k) || shell1(i, j, k + 1) || shell1(i, j, k - 1));
        if (!outer && !second) continue;
        const x = bounds.x[0] + (i + 0.5) * cell;
        const y = bounds.y[0] + (j + 0.5) * cell;
        const z = bounds.z[0] + (k + 0.5) * cell;
        out.push(x, y, z, partOf(x, y, z, second));
      }
  return new Float32Array(out);
}
