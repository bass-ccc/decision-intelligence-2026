import * as THREE from 'three';
import { CANAL, WATER_Y, SEA_FLOOR, NET_FLOOR, SUN, SUN_N, SHOAL, CLAM, CORAL, BERG, HEAD, HEAD_S, SIGN_Z, SIGN_SIDE } from './layout.js';

// Where a click on the scene lands in the world.
// Pure geometry on the layout's own numbers: a few planes, discs, spheres. No mesh is raycast and
// nothing is read back from the GPU. The point always lies on the click's own ray, so whatever is
// drawn round it is centred on the cursor; a stand-in that is a little off only shifts when the
// pulse reaches the thing, never where it is seen to start.

// the canal's banks: the walkway's top (canal.js), and the nine article signs that hang over the
// water (canal.js: 3.4 wide, 12 tall, 2 out from the wall, faces looking up and down the canal)
const BANK_Y = 2.2;
const SIGN = { x: CANAL.walk - 2.0 - 3.4 / 2, y: 12.5, w: 3.4, h: 12 };
// the sea's things, as stand-ins (sea.js): the sunflower's face with its petals (a disc), the
// shoal (three flat rings of fish: [height above SHOAL, radius], each about 3 either way; and
// round them a sphere, for a ray that threads between the rings), the clam, the coral tree above
// its root, the iceberg (an ellipsoid)
const SUN_R = 34;
const SHOAL_RINGS = [
  [3, 8],
  [-1, 14],
  [-5, 20],
];
const SHOAL_R = 21;
const CLAM_R = 7;
const CORAL_C = CORAL.clone().add(new THREE.Vector3(0, 15, 0));
const CORAL_R = 16;
const BERG_R = [32, 62, 30];
// the head in the Net (net.js): taller than wide and with a chin and a neck below its centre, so
// an ellipsoid a little lower than HEAD, not a sphere (which let clicks on the jaw fall through
// to the floor far behind)
const HEAD_C = HEAD.clone().add(new THREE.Vector3(0, -0.1 * HEAD_S, 0));
const HEAD_R = [1.2 * HEAD_S, 1.3 * HEAD_S, 1.2 * HEAD_S];
// with nothing under the cursor, the point is this far out along the ray
const VOID = { people: 60, model: 22, ai: 60 };

const INF = Infinity;
const _p = new THREE.Vector3();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

// distance along the ray to the plane <axis> = value (ahead of the origin only)
function plane(ray, axis, value) {
  const d = ray.direction[axis];
  if (Math.abs(d) < 1e-6) return INF;
  const t = (value - ray.origin[axis]) / d;
  return t > 0.01 ? t : INF;
}

// ...to an ellipsoid of radii (rx, ry, rz) round c: the near side, or from inside it the far one
function ellipsoid(ray, c, rx, ry, rz) {
  _o.subVectors(ray.origin, c);
  _o.set(_o.x / rx, _o.y / ry, _o.z / rz);
  _d.set(ray.direction.x / rx, ray.direction.y / ry, ray.direction.z / rz);
  const a = _d.lengthSq();
  const b = _o.dot(_d);
  const h = b * b - a * (_o.lengthSq() - 1);
  if (h < 0) return INF;
  const s = Math.sqrt(h);
  const near = (-b - s) / a;
  const far = (-b + s) / a;
  return near > 0.01 ? near : far > 0.01 ? far : INF;
}
const sphere = (ray, c, r) => ellipsoid(ray, c, r, r, r);

// ...to a disc of radius r round c, facing n
function disc(ray, c, n, r) {
  const dn = ray.direction.dot(n);
  if (Math.abs(dn) < 1e-6) return INF;
  const t = _o.subVectors(c, ray.origin).dot(n) / dn;
  if (t <= 0.01) return INF;
  return ray.at(t, _p).distanceToSquared(c) <= r * r ? t : INF;
}

// ray: a THREE.Ray in world space (direction normalised). chapter: 'people' (the canal), 'model'
// (the sea) or 'ai' (the Net). The point is written to out.
// Returns { hit, dist }: what was struck ('water', 'wall', 'sign', 'floor', 'sun', 'shoal', 'clam',
// 'coral', 'berg', 'head' or 'void') and how far along the ray.
export function pickPoint(ray, chapter, out) {
  let best = INF;
  let hit = 'void';
  const take = (t, name, ok = true) => {
    if (ok && t < best) {
      best = t;
      hit = name;
    }
  };
  const at = (t) => ray.at(t, _p);
  let t;
  if (chapter === 'people') {
    // between the banks the water is 2 x CANAL.half wide; past the canal's mouth it is open harbour
    const inCanal = (z) => z <= CANAL.z0 && z >= CANAL.z1;
    t = plane(ray, 'y', WATER_Y);
    if (t < 400) take(t, 'water', !inCanal(at(t).z) || Math.abs(_p.x) < CANAL.half);
    t = plane(ray, 'y', BANK_Y);
    if (t < INF) take(t, 'wall', inCanal(at(t).z) && Math.abs(_p.x) >= CANAL.half && Math.abs(_p.x) <= CANAL.walk);
    for (const s of [-1, 1]) {
      t = plane(ray, 'x', s * CANAL.half); // the face of the embankment
      if (t < INF) take(t, 'wall', inCanal(at(t).z) && _p.y >= WATER_Y && _p.y <= BANK_Y);
      t = plane(ray, 'x', s * CANAL.walk); // the facades
      if (t < INF) take(t, 'wall', inCanal(at(t).z) && _p.y >= BANK_Y && _p.y < 140);
    }
    for (let i = 0; i < 9; i++) {
      t = plane(ray, 'z', SIGN_Z(i));
      if (t < INF) take(t, 'sign', Math.abs(at(t).x - SIGN_SIDE(i) * SIGN.x) <= SIGN.w / 2 && Math.abs(_p.y - SIGN.y) <= SIGN.h / 2);
    }
  } else if (chapter === 'model') {
    t = plane(ray, 'y', SEA_FLOOR);
    if (t < 160) take(t, 'floor');
    take(disc(ray, SUN, SUN_N, SUN_R), 'sun');
    // the shoal: the nearest of its rings of fish, so that the fish under the cursor are the ones
    // that move; else the sphere round them
    let ring = INF;
    for (const [y, rad] of SHOAL_RINGS) {
      t = plane(ray, 'y', SHOAL.y + y);
      if (t < ring && Math.abs(Math.hypot(at(t).x - SHOAL.x, _p.z - SHOAL.z) - rad) <= 3) ring = t;
    }
    take(ring < INF ? ring : sphere(ray, SHOAL, SHOAL_R), 'shoal');
    take(sphere(ray, CLAM, CLAM_R), 'clam');
    take(sphere(ray, CORAL_C, CORAL_R), 'coral');
    take(ellipsoid(ray, BERG, BERG_R[0], BERG_R[1], BERG_R[2]), 'berg');
  } else {
    take(ellipsoid(ray, HEAD_C, HEAD_R[0], HEAD_R[1], HEAD_R[2]), 'head');
    t = plane(ray, 'y', NET_FLOOR);
    if (t < 500) take(t, 'floor');
  }
  if (best === INF) best = VOID[chapter] || 60;
  ray.at(best, out);
  return { hit, dist: best };
}
