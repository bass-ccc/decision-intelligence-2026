import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { rng, GLSL_NOISE, COLORS } from '../core/util.js';
import { signAtlas, fingerprintTexture } from '../core/textures.js';
import { CANAL, FP_POS, SIGN_Z, SIGN_SIDE, SUN, BERG } from './layout.js';
import { shared, holoMaterial } from './city.js';

// 01 PEOPLE · the canal. Nine neon signs hang over the water, one per article,
// among dozens of ordinary shop signs whose words are the book's themes.
// The water reflects all of it, broken by rain.

export const SIGN_TEXT = {
  3: ['真實的力量', 'AUTHENTIC'],
  4: ['增長推手', 'AGENTS'],
  5: ['增長架構師', 'ARCHITECT'],
  6: ['信任', 'TRUST'],
  7: ['讓人想買', 'DESIRE'],
  8: ['注意力稀缺', 'ATTENTION'],
  9: ['打動人', 'HUMAN'],
  10: ['別買曝光', 'MEMORY'],
  11: ['共同記憶', 'COMMON'],
};

const DECOR_WORDS = ['信任', '真實', '記憶', '代理', '衡斷', '文化', '情境', '體驗', '模擬', '治理', '注意力', '義體診所', '電腦修理', '記憶體', '網路咖啡', '茶餐廳', '港口', '旅店', '當舖', '藥行', '電子', '翻譯', '夜市', '冰室'];
const DECOR_COLS = ['#ff3d8b', '#ff8a3d', '#3de0ff', '#ff3a3a', '#f4f0e0', '#68f0c4', '#b18cff', '#ffd23d'];

const SIGN_VERT = /* glsl */ `
attribute vec4 aRect; attribute vec4 aFx;
varying vec2 vUv; varying vec4 vRect; varying vec4 vFx;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vRect = aRect; vFx = aFx;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SIGN_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform float uTime; uniform float uDawn; uniform float uActive;
varying vec2 vUv; varying vec4 vRect; varying vec4 vFx;
#include <fog_pars_fragment>
float h1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  vec3 c = texture2D(tMap, vRect.xy + vUv * vRect.zw).rgb;
  float fl = 1.0;
  if (vFx.z > 0.5 && vFx.z < 1.5) fl = mix(0.15, 1.0, step(0.12, h1(floor(uTime * 9.0) + vFx.x * 91.0)));
  if (vFx.z > 1.5) fl = 0.85 + 0.15 * sin(uTime * 60.0 + vFx.x * 20.0);
  float act = vFx.w > 0.5 ? 1.0 + 0.9 * step(abs(vFx.w - uActive), 0.1) * (0.8 + 0.2 * sin(uTime * 3.0)) : 1.0;
  vec3 col = c * vFx.y * fl * act * (1.0 - uDawn * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

const WATER_VERT = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUvP; varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vUvP = textureMatrix * vec4(position, 1.0);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime; uniform float uRain; uniform float uDawn;
uniform vec3 uSunPos; uniform vec3 uBergPos;
varying vec4 vUvP; varying vec3 vW;
#include <fog_pars_fragment>
${GLSL_NOISE}
vec2 ripples(vec2 p, float t) {
  vec2 id = floor(p);
  vec2 acc = vec2(0.0);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 c = id + vec2(float(i), float(j));
      vec2 h = hash22(c);
      vec2 o = c + h;
      float ph = fract(t * 0.8 + h.x * 7.0 + h.y * 3.0);
      vec2 d = p - o;
      float r = length(d);
      float ring = ph * 1.1;
      float w = sin((r - ring) * 26.0) * smoothstep(0.22, 0.0, abs(r - ring)) * (1.0 - ph) * (1.0 - ph);
      acc += d / max(r, 1e-3) * w;
    }
  return acc;
}
void main() {
  vec2 p = vW.xz;
  float t = uTime;
  vec2 n = (vec2(fbm(p * 0.06 + vec2(t * 0.04, 0.0)), fbm(p * 0.06 + vec2(17.0, -t * 0.03))) - 0.5) * 0.9;
  n += ripples(p * 0.85, t) * 0.35 * uRain;
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.3 + 0.7 * pow(1.0 - max(V.y, 0.0), 4.0);
  vec4 uv = vUvP;
  uv.xy += n * 0.035 * uv.w;
  // neon smears vertically on wet water
  vec3 refl = vec3(0.0);
  refl += texture2DProj(tDiffuse, uv + vec4(0.0, -0.024, 0.0, 0.0) * uv.w).rgb * 0.16;
  refl += texture2DProj(tDiffuse, uv + vec4(0.0, -0.011, 0.0, 0.0) * uv.w).rgb * 0.22;
  refl += texture2DProj(tDiffuse, uv).rgb * 0.26;
  refl += texture2DProj(tDiffuse, uv + vec4(0.0, 0.011, 0.0, 0.0) * uv.w).rgb * 0.2;
  refl += texture2DProj(tDiffuse, uv + vec4(0.0, 0.024, 0.0, 0.0) * uv.w).rgb * 0.16;
  vec3 deep = mix(vec3(0.004, 0.012, 0.014), vec3(0.05, 0.05, 0.06), uDawn);
  vec3 col = deep + refl * fres * 0.9;
  // what glows beneath: the sunflower of ghosts, the iceberg
  float gs = exp(-dot(p - uSunPos.xz, p - uSunPos.xz) / 2600.0);
  float gb = exp(-dot(p - uBergPos.xz, p - uBergPos.xz) / 1800.0);
  col += vec3(0.95, 0.5, 0.52) * gs * 0.55 * (0.8 + 0.2 * sin(t * 1.3)) * (0.6 + 0.4 * fbm(p * 0.08 + t * 0.1)) + vec3(0.3, 0.8, 0.85) * gb * 0.1;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function buildCanal({ tier, boxes, W, H }) {
  const group = new THREE.Group();
  const r = rng(88);
  const C = CANAL;

  // ------------------------------------------------------------ water
  const reflector = new Reflector(new THREE.PlaneGeometry(1600, 1600), {
    textureWidth: Math.round(W * tier.reflect),
    textureHeight: Math.round(H * tier.reflect),
    clipBias: 0.003,
    multisample: 0,
  });
  const rmat = new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), shared, {
      tDiffuse: { value: reflector.getRenderTarget().texture },
      textureMatrix: reflector.material.uniforms.textureMatrix,
      uRain: { value: 1 },
      uSunPos: { value: SUN.clone() },
      uBergPos: { value: BERG.clone() },
    }),
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    fog: true,
  });
  reflector.material.dispose();
  reflector.material = rmat;
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0, -420);
  group.add(reflector);

  // the water seen from below: bright, broken, like a sky made of mercury
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), shared),
      fog: true,
      vertexShader: `varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform float uTime; varying vec3 vW;\n#include <fog_pars_fragment>\n${GLSL_NOISE}\nvoid main(){ vec3 V = normalize(cameraPosition - vW); float up = pow(max(-V.y, 0.0), 1.6); float n = fbm(vW.xz * 0.05 + vec2(uTime * 0.05, uTime * 0.03)); float c = smoothstep(0.35, 0.75, fbm(vW.xz * 0.12 - uTime * 0.07)); vec3 col = mix(vec3(0.02, 0.09, 0.09), vec3(0.35, 0.8, 0.75) * (0.7 + 0.6 * n), up) + vec3(0.5, 0.9, 0.85) * c * up * 0.6; gl_FragColor = vec4(col, 1.0);\n#include <fog_fragment>\n}`,
    })
  );
  under.rotation.x = Math.PI / 2;
  under.position.set(0, -0.05, -420);

  // ------------------------------------------------------------ embankments, walkways, lamps
  const stone = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.75, metalness: 0.1 });
  const len = C.z0 - C.z1;
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(C.walk - C.half, 12, len), stone);
    wall.position.set(s * (C.half + (C.walk - C.half) / 2), 2.2 - 6, (C.z0 + C.z1) / 2);
    group.add(wall);
  }
  // wet walkway sheen
  const walk = new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.25, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(C.walk - C.half, len), walk);
    w.rotation.x = -Math.PI / 2;
    w.position.set(s * (C.half + (C.walk - C.half) / 2), 2.22, (C.z0 + C.z1) / 2);
    group.add(w);
  }
  // lamps along the water: poles + warm globes (the globes are what the water reflects)
  const lampN = Math.floor(len / 14) * 2;
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 5), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.6 }), lampN);
  const globe = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 1.0) }), lampN);
  const m = new THREE.Matrix4();
  let li = 0;
  for (let z = C.z0 - 8; z > C.z1 && li < lampN; z -= 14) {
    for (const s of [-1, 1]) {
      if (li >= lampN) break;
      m.makeTranslation(s * (C.half + 0.5), 2.2 + 2.1, z + (s > 0 ? 7 : 0));
      pole.setMatrixAt(li, m);
      m.makeTranslation(s * (C.half + 0.5), 2.2 + 4.3, z + (s > 0 ? 7 : 0));
      globe.setMatrixAt(li, m);
      li++;
    }
  }
  pole.count = globe.count = li;
  group.add(pole, globe);

  // ------------------------------------------------------------ AC units, cages and pipes on the canal facades
  const facades = boxes.filter((b) => b[6] === 1 && Math.abs(Math.abs(b[0]) - b[2] / 2 - C.walk) < 0.01);
  const acN = Math.round(1500 * tier.city);
  const ac = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.6, metalness: 0.3 }), acN);
  let ai = 0;
  for (let k = 0; k < acN * 3 && ai < acN; k++) {
    const b = facades[Math.floor(r() * facades.length)];
    if (!b) break;
    const [cx, cz, w, d, h] = b;
    const s = Math.sign(cx);
    const y = 6 + r() * (h - 9);
    const z = cz + (r() - 0.5) * (d - 1.5);
    const cage = r() < 0.18;
    const sx = cage ? 1.4 : 0.55;
    const sy = cage ? 2.2 : 0.62;
    const sz = cage ? 2.6 : 0.95;
    m.makeScale(sx, sy, sz);
    m.setPosition(s * (C.walk - sx / 2 + 0.02), y, z);
    ac.setMatrixAt(ai++, m);
  }
  ac.count = ai;
  group.add(ac);

  // ------------------------------------------------------------ cables across the canal
  const pts = [];
  for (let i = 0; i < 70; i++) {
    const z = C.z0 - r() * (len - 10);
    const y0 = 8 + r() * 26;
    const y1 = y0 + (r() - 0.5) * 6;
    const sag = 1 + r() * 3;
    const dz = (r() - 0.5) * 6;
    let prev = null;
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const p = new THREE.Vector3(-C.walk + t * C.walk * 2, y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * sag, z + dz * t);
      if (prev) pts.push(prev, p);
      prev = p;
    }
  }
  const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x050607 }));
  group.add(cables);

  // ------------------------------------------------------------ neon signs
  const specs = [];
  const place = []; // { spec index, pos, side, w, h, station }
  for (let i = 0; i < 9; i++) {
    const no = 3 + i;
    const [text, sub] = SIGN_TEXT[no];
    specs.push({ text, sub, no, color: COLORS.people, w: 3.4, h: 12, vertical: true, station: true });
    place.push({ si: specs.length - 1, side: SIGN_SIDE(i), z: SIGN_Z(i), y: 12.5, w: 3.4, h: 12, no, out: 2.0 });
  }
  const decorN = Math.round(90 * Math.max(0.6, tier.city));
  for (let i = 0; i < decorN; i++) {
    const word = DECOR_WORDS[Math.floor(r() * DECOR_WORDS.length)];
    const col = DECOR_COLS[Math.floor(r() * DECOR_COLS.length)];
    const vertical = r() < 0.72;
    const w = vertical ? 1.5 + r() * 0.9 : Math.max(3.6, [...word].length * 1.6);
    const h = vertical ? Math.max(3.8, [...word].length * (w * 0.8) + 1.2) : 1.5 + r() * 0.4;
    specs.push({ text: word, color: col, w, h, vertical });
    let z;
    let tries = 0;
    // keep clear of the station signs
    do {
      z = C.z0 - 6 - r() * (len - 12);
      tries++;
    } while (tries < 30 && Array.from({ length: 9 }, (_, k) => SIGN_Z(k)).some((sz) => Math.abs(sz - z) < 5));
    const side = r() < 0.5 ? -1 : 1;
    const y = vertical ? 7 + r() * 24 : 6 + r() * 26;
    place.push({ si: specs.length - 1, side, z, y, w, h, flick: r() < 0.12 ? 1 : r() < 0.2 ? 2 : 0, out: vertical ? 0.8 + r() * 2.2 : 0, flat: !vertical });
  }
  const atlas = signAtlas(specs);
  const faceGeo = new THREE.PlaneGeometry(1, 1);
  const faces = new THREE.InstancedMesh(
    faceGeo,
    new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), shared, { tMap: { value: atlas.texture }, uActive: { value: 0 } }),
      vertexShader: SIGN_VERT,
      fragmentShader: SIGN_FRAG,
      fog: true,
    }),
    place.length * 2
  );
  const rect = new Float32Array(place.length * 2 * 4);
  const fx = new Float32Array(place.length * 2 * 4);
  const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.5, metalness: 0.5 }), place.length * 2);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  let fi = 0;
  let ci = 0;
  const stationSigns = [];
  place.forEach((p) => {
    const R = atlas.rects[p.si];
    if (p.flat) {
      // flat sign on the facade, facing the canal
      const x = p.side * (C.walk - 0.08);
      e.set(0, p.side < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      q.setFromEuler(e);
      m.compose(pos.set(x, p.y, p.z), q, sc.set(p.w, p.h, 1));
      faces.setMatrixAt(fi, m);
      rect.set(R, fi * 4);
      fx.set([r(), 2.3, p.flick || 0, 0], fi * 4);
      fi++;
      return;
    }
    // projecting sign: its faces look up and down the canal
    const x = p.side * (C.walk - p.out - p.w / 2);
    for (const face of [1, -1]) {
      e.set(0, face > 0 ? 0 : Math.PI, 0);
      q.setFromEuler(e);
      m.compose(pos.set(x, p.y, p.z + face * 0.16), q, sc.set(p.w, p.h, 1));
      faces.setMatrixAt(fi, m);
      rect.set(R, fi * 4);
      fx.set([r(), p.no ? 2.6 : 2.3, p.flick || 0, p.no || 0], fi * 4);
      fi++;
    }
    m.compose(pos.set(x, p.y, p.z), q.identity(), sc.set(p.w + 0.2, p.h + 0.2, 0.3));
    cab.setMatrixAt(ci++, m);
    // bracket back to the wall
    const bl = p.out + 0.1;
    m.compose(pos.set(p.side * (C.walk - bl / 2), p.y + p.h / 2 - 0.4, p.z), q.identity(), sc.set(bl, 0.12, 0.12));
    cab.setMatrixAt(ci++, m);
    if (p.no) stationSigns.push({ no: p.no, pos: new THREE.Vector3(x, p.y, p.z) });
  });
  faces.count = fi;
  cab.count = ci;
  faceGeo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
  faceGeo.setAttribute('aFx', new THREE.InstancedBufferAttribute(fx, 4));
  faces.frustumCulled = false;
  cab.frustumCulled = false;
  group.add(faces, cab);

  // ------------------------------------------------------------ the fingerprint over the canal mouth
  const fpTex = fingerprintTexture();
  const fpH = 64;
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(fpH * 0.8, fpH), holoMaterial(fpTex, [0, 0, 1, 1], '#e8ffc0', 1.25, 0.5, 0));
  fp.position.copy(FP_POS);
  group.add(fp);

  // a few sampans moored along the walls
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.8 });
  for (let i = 0; i < 7; i++) {
    const s = r() < 0.5 ? -1 : 1;
    const z = C.z0 - 20 - r() * (len - 40);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 7.5), hullMat);
    hull.position.y = 0.25;
    boat.add(hull);
    const roofB = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.2, 10, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.9, side: THREE.DoubleSide }));
    roofB.rotation.x = Math.PI / 2;
    roofB.position.set(0, 0.75, -0.5);
    boat.add(roofB);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.5) }));
    lantern.position.set(0, 1.9, 2.8);
    boat.add(lantern);
    boat.position.set(s * (C.half - 1.6), 0, z);
    boat.rotation.y = (r() - 0.5) * 0.12;
    boat.userData.phase = r() * 6;
    group.add(boat);
  }

  return {
    group,
    under,
    reflector,
    stationSigns,
    setActive(no) {
      faces.material.uniforms.uActive.value = no || 0;
    },
    resize(w, h) {
      reflector.getRenderTarget().setSize(Math.round(w * tier.reflect), Math.round(h * tier.reflect));
    },
    update(t, env) {
      group.visible = env.cityVis;
      reflector.visible = env.reflect;
      under.visible = env.under;
      rmat.uniforms.uRain.value = env.rain;
      fp.material.uniforms.uOn.value = 1 - env.dawn * 0.8;
    },
  };
}
