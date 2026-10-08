import * as THREE from 'three';

// One place for every coordinate in the world.
// y = 0 is the canal's water line. Up is the rain-soaked city, down is the sea,
// and below the sea floor lies the Net. The dive runs from the roof to the Net
// and the last flight surfaces back to the roof at dawn.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const WATER_Y = 0;
export const ROOF = { x: -34, z: 66, top: 90, w: 30, d: 30 };
export const CANAL = { half: 12, walk: 15, z0: 52, z1: -290 };
export const SEA_FLOOR = -168;
export const NET_FLOOR = -402;

export const BILL1 = V(28, 104, 26); // 01 hologram
export const BILL2 = V(-72, 108, 14); // 02 hologram
export const FP_POS = V(0, 52, -318); // People emblem: the fingerprint hologram at the canal mouth
export const COVER_HOLO = V(10, 70, -40); // the book itself, floating over the canal in the opening view

export const SIGN_Z = (i) => -24 - 28.5 * i;
export const SIGN_SIDE = (i) => (i % 2 === 0 ? -1 : 1);
export const signAnchor = (i) => V(SIGN_SIDE(i) * 11.4, 12.5, SIGN_Z(i));

export const SUN = V(0, -74, -418); // the ghost sunflower (People Model)
export const SUN_N = V(0, 0.52, 1).normalize();
export const SHOAL = V(-52, -100, -470);
export const CLAM = V(36, SEA_FLOOR + 5, -482);
export const CORAL = V(-40, SEA_FLOOR, -522);
export const BERG = V(58, -48, -560);
export const VORTEX = V(0, SEA_FLOOR, -590);

export const HEAD = V(0, -330, -640);
export const HEAD_S = 18;

// sun for the dawn at the end, far down the canal axis
export const DAWN_DIR = V(0.16, 0.34, -1).normalize();

// ---------------------------------------------------------------- stations
// anchor: where the thing is (label + ghost thread node); cam/look: the camera stop.
function st(no, chapter, anchor, cam, look) {
  return { no, chapter, anchor, cam, look: look || anchor.clone() };
}

export function stations() {
  const list = [];
  list.push(st(1, 'intro', BILL1.clone(), V(-12, 93, 60), BILL1.clone().add(V(0, -1, 0))));
  list.push(st(2, 'intro', BILL2.clone(), V(-26, 93.4, 54), BILL2.clone().add(V(0, -1, 0))));
  for (let i = 0; i < 9; i++) {
    const a = signAnchor(i);
    const s = SIGN_SIDE(i);
    list.push(st(3 + i, 'people', a, V(-s * 3.4, 5.2, a.z + 18.5), a.clone().add(V(-s * 0.6, -0.5, -1))));
  }
  const sunFace = SUN.clone().addScaledVector(SUN_N, 1.5);
  list.push(st(12, 'model', sunFace, SUN.clone().addScaledVector(SUN_N, 46).add(V(0, 2, 0)), SUN.clone().add(V(0, 1, 0))));
  list.push(st(13, 'model', SHOAL.clone(), SHOAL.clone().add(V(30, 12, 30)), SHOAL.clone().add(V(0, -2, 0))));
  list.push(st(14, 'model', CLAM.clone().add(V(0, 3, 0)), CLAM.clone().add(V(-16, 11, 22)), CLAM.clone().add(V(0, 2, 0))));
  list.push(st(15, 'model', CORAL.clone().add(V(0, 16, 0)), CORAL.clone().add(V(28, 24, 26)), CORAL.clone().add(V(0, 15, 0))));
  list.push(st(16, 'model', BERG.clone().add(V(-14, -10, 8)), BERG.clone().add(V(-52, -14, 44)), BERG.clone().add(V(-6, 2, 0))));
  const H = HEAD;
  const S = HEAD_S;
  const hp = (x, y, z) => V(H.x + x * S, H.y + y * S, H.z + z * S);
  list.push(st(17, 'ai', hp(0, 0.1, 0.9), hp(0.55, 0.2, 2.6), hp(0.06, 0.08, 0.8)));
  list.push(st(18, 'ai', hp(-0.75, 0.25, 0.1), hp(-2.9, 0.4, 0.35), hp(-0.2, 0.15, 0.1)));
  list.push(st(19, 'ai', hp(0.1, -0.2, 1.0), hp(1.4, 0.0, 2.3), hp(0.05, -0.1, 0.8)));
  list.push(st(20, 'ai', hp(0.75, 0.3, -0.3), hp(2.7, 0.1, -1.5), hp(0.2, 0.1, -0.2)));
  list.push(st(21, 'ai', hp(0, -0.49, 0.95), hp(-0.9, -0.75, 2.3), hp(0, -0.5, 0.8)));
  list.push(st(22, 'ai', hp(0, 1.25, 0), hp(0.2, 3.2, 2.2), hp(0, 0.6, 0)));
  return list;
}

// ---------------------------------------------------------------- the dive line
export function tourKeys(sts) {
  const by = (no) => sts.find((s) => s.no === no);
  const k = [];
  const stop = (s) => k.push({ cam: s.cam.clone(), look: s.look.clone(), stop: true, kind: 'station', no: s.no, chapter: s.chapter });
  const way = (cam, look, extra = {}) => k.push({ cam, look, ...extra });

  k.push({ cam: V(-20.6, 94.8, 52.6), look: V(5, 30, -90), stop: true, kind: 'hero', chapter: 'intro' });
  stop(by(1));
  stop(by(2));
  way(V(-18, 93, 44), V(0, 40, -120));
  k.push({ cam: V(-5, 44, 16), look: FP_POS.clone().add(V(0, -6, 0)), stop: true, kind: 'gate', chapter: 'people' });
  way(V(0, 9, -2), V(0, 10, -60));
  for (let i = 0; i < 9; i++) stop(by(3 + i));
  way(V(0, 6.5, -272), V(0, 2, -330));
  k.push({ cam: V(-2, 4.2, -298), look: V(8, -9, -400), stop: true, kind: 'gate', chapter: 'model' });
  way(V(0, -16, -336), V(0, -60, -410));
  for (let n = 12; n <= 16; n++) stop(by(n));
  way(V(8, -128, -560), V(0, SEA_FLOOR - 10, -588));
  k.push({ cam: V(0, SEA_FLOOR + 22, -572), look: VORTEX.clone().add(V(0, -40, -6)), stop: true, kind: 'gate', chapter: 'ai' });
  way(V(0, -250, -590), V(0, -330, -640));
  for (let n = 17; n <= 22; n++) stop(by(n));
  // surfacing: straight up through the Net, the sea and the canal, back to the roof
  way(V(0, -230, -600), V(0, 0, -560), { rise: 1 });
  way(V(0, -70, -520), V(0, 60, -400), { rise: 1 });
  way(V(0, 14, -330), V(0, 60, -100), { rise: 1 });
  way(V(-12, 70, -60), V(-20, 92, 40), { rise: 1 });
  k.push({ cam: V(-19.6, 93.8, 51.2), look: V(4, 80, -300), stop: true, kind: 'finale', chapter: 'intro', dawn: 1 });
  // dawn only on the very last stretch
  k.forEach((key, i) => {
    if (key.dawn === undefined) key.dawn = i >= k.length - 3 ? (i === k.length - 2 ? 0.6 : 0.25) : 0;
  });
  return k;
}
