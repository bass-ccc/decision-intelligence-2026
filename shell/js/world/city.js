import * as THREE from 'three';
import { rng, GLSL_NOISE, COLORS, FOG_ADD } from '../core/util.js';
import { ROOF, CANAL, BILL1, BILL2, COVER_HOLO } from './layout.js';

// The city: one instanced mesh of towers whose windows are drawn per pixel,
// Kowloon-dense along the canal, a forest of towers beyond, and a far shore
// across the harbour. Holographic ads show pages of the book itself.

export const shared = {
  uTime: { value: 0 },
  uDawn: { value: 0 },
  uDawnDir: { value: new THREE.Vector3(0, 0.1, -1) },
  uGhost: { value: 0 },
};

function fogUniforms(extra) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra || {}]);
  return Object.assign(u, shared);
}

const TOWER_VERT = /* glsl */ `
attribute vec4 aInfo; // seed, style, lit ratio, tint
varying vec3 vW; varying vec3 vN; varying vec4 vInfo; varying vec3 vScale;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normal;
  vInfo = aInfo;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const TOWER_FRAG = /* glsl */ `
uniform float uTime; uniform float uDawn; uniform vec3 uDawnDir;
varying vec3 vW; varying vec3 vN; varying vec4 vInfo; varying vec3 vScale;
#include <fog_pars_fragment>
${GLSL_NOISE}
void main() {
  vec3 n = normalize(vN);
  float seed = vInfo.x * 97.0;
  float style = vInfo.y;
  float top = step(0.5, n.y);
  vec2 f = abs(n.x) > 0.5 ? vec2(vW.z * sign(n.x), vW.y) : vec2(-vW.x * sign(n.z), vW.y);
  vec2 cs = style > 0.5 ? vec2(1.9, 2.9) : (vInfo.w > 0.6 ? vec2(1.4, 3.6) : vec2(2.6, 3.4));
  vec2 g = f / cs;
  vec2 id = floor(g);
  vec2 fr = fract(g);
  float win = step(0.2, fr.x) * step(fr.x, 0.8) * step(0.3, fr.y) * step(fr.y, 0.8);
  float r = hash21(id + seed + n.x * 13.0 + n.z * 29.0);
  float lit = step(1.0 - vInfo.z, r);
  // some whole floors are dark, some towers have lit bands
  lit *= step(0.18, hash21(vec2(id.y, seed)));
  float r2 = hash21(id * 1.37 + seed);
  vec3 warm = vec3(1.0, 0.52, 0.22);
  vec3 cool = vec3(0.42, 0.66, 1.0);
  vec3 teal = vec3(0.25, 1.0, 0.75);
  vec3 wc = r2 < 0.55 ? warm : (r2 < 0.85 ? cool : teal);
  if (style > 0.5 && r2 > 0.93) wc = vec3(1.0, 0.3, 0.55);
  float flick = 1.0;
  if (r2 > 0.985) flick = step(0.35, hash11(floor(uTime * 7.0) + r * 50.0));
  float r3 = hash21(id * 2.71 + seed * 0.3);
  float inten = (0.12 + 0.45 * r3 * r3 + step(0.93, r3) * 0.9) * flick;
  // blinds: light falls off toward the top of the window
  inten *= 0.55 + 0.45 * smoothstep(0.8, 0.35, fr.y + 0.25 * hash11(r3 * 13.0));
  // window glass is faintly reflective even when dark
  vec3 glass = vec3(0.012, 0.018, 0.024) * win;
  vec3 em = win * lit * wc * inten * (1.0 - top);

  // canal shops: bright shopfronts on the ground floor
  if (style > 0.5 && vW.y > 2.2 && vW.y < 5.6 && top < 0.5) {
    float bay = floor(f.x / 4.2);
    float h = hash21(vec2(bay, seed));
    vec3 sc = h < 0.4 ? vec3(1.0, 0.5, 0.22) : (h < 0.7 ? vec3(0.3, 1.0, 0.8) : vec3(1.0, 0.3, 0.55));
    float fx = fract(f.x / 4.2);
    float shutter = step(0.12, fx) * step(fx, 0.92);
    float open = step(0.45, h);
    // lit interior below, a glowing strip of signage above
    float strip = step(4.9, vW.y) * step(vW.y, 5.35);
    float inner = step(vW.y, 4.6) * (0.55 + 0.45 * smoothstep(2.2, 4.6, vW.y));
    vec3 room = mix(vec3(1.0, 0.72, 0.45), sc, 0.35);
    em = shutter * open * (sc * strip * (1.2 + 1.0 * h) + room * inner * (0.18 + 0.3 * h));
  }
  // bands of LED on some tall towers
  if (style < 0.5 && vInfo.w > 0.86 && top < 0.5) {
    float band = step(0.965, fract(vW.y / 30.0 + vInfo.x));
    em += band * mix(vec3(0.3, 1.0, 0.9), vec3(1.0, 0.3, 0.6), step(0.93, vInfo.w)) * 1.1;
  }

  // concrete with grime streaks
  float grime = vnoise(vec2(f.x * 0.35, vW.y * 0.05) + seed) * 0.6 + vnoise(f * 0.9) * 0.4;
  vec3 base = vec3(0.022, 0.026, 0.03) * (0.6 + 0.8 * grime);
  if (top > 0.5) base = vec3(0.014, 0.016, 0.018);
  // bounce light from the streets below, and the sky above
  float street = exp(-max(vW.y, 0.0) / 26.0);
  vec3 lightCol = vec3(0.35, 0.18, 0.3) * street * (1.0 - top) + vec3(0.05, 0.07, 0.09) * (0.5 + 0.5 * n.y);
  vec3 col = base * lightCol * 6.0 + glass + em;

  // dawn: windows fade, the sun paints the facades
  float sunL = max(dot(n, -uDawnDir * vec3(1.0, -1.0, 1.0)), 0.0);
  vec3 dawnCol = (vec3(0.07, 0.065, 0.07) + vec3(0.7, 0.42, 0.35) * sunL * 0.5) * (0.55 + 0.45 * grime) + glass * 4.0 * vec3(1.0, 0.7, 0.6);
  col = mix(col, dawnCol + em * 0.12, uDawn);

  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function towerMaterial() {
  return new THREE.ShaderMaterial({ uniforms: fogUniforms(), vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG, fog: true });
}

// A holographic panel: page image with scanlines, flicker and a glowing frame.
const HOLO_VERT = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const HOLO_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform vec4 uRect; uniform vec3 uTint; uniform float uGain; uniform float uSeed; uniform float uInk;
uniform float uTime; uniform float uDawn; uniform float uOn;
varying vec2 vUv;
#include <fog_pars_fragment>
float h1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  vec2 uv = vUv;
  float t = uTime + uSeed * 10.0;
  float gl = step(0.965, h1(floor(t * 9.0) + uSeed));
  uv.x += gl * (h1(floor(uv.y * 20.0) + floor(t * 30.0)) - 0.5) * 0.06;
  vec2 tuv = uRect.xy + clamp(uv, 0.0, 1.0) * uRect.zw;
  vec3 c = texture2D(tMap, tuv).rgb;
  if (uInk > 0.5) {
    // a printed page as light: the paper turns to air, ink and colour glow
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
    c = uTint * pow(1.0 - lum, 1.4) * 1.25 + c * smoothstep(0.08, 0.4, sat) * 1.3;
  }
  float scan = 0.72 + 0.28 * sin(vUv.y * 420.0 + t * 6.0);
  float band = 0.85 + 0.15 * smoothstep(0.0, 0.02, abs(fract(vUv.y * 0.7 - t * 0.12) - 0.5));
  float flick = 0.9 + 0.1 * h1(floor(t * 24.0));
  vec2 e = min(vUv, 1.0 - vUv);
  float frame = 1.0 - smoothstep(0.0, 0.012, min(e.x, e.y * 0.75));
  vec3 col = c * mix(uTint, vec3(1.0), uInk * 0.6) * scan * band * flick * uGain + uTint * frame * 1.6;
  col *= uOn * (1.0 - uDawn * 0.75);
  gl_FragColor = vec4(col, 1.0);
  ${FOG_ADD}
}`;

export function holoMaterial(tex, rect, tint, gain, seed, ink = 1) {
  return new THREE.ShaderMaterial({
    uniforms: fogUniforms({
      tMap: { value: tex },
      uRect: { value: new THREE.Vector4(...rect) },
      uTint: { value: new THREE.Color(tint) },
      uGain: { value: gain },
      uSeed: { value: seed },
      uOn: { value: 1 },
      uInk: { value: ink },
    }),
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    fog: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function atlasRect(atlas, page) {
  const i = page - 1;
  const col = i % atlas.cols;
  const row = Math.floor(i / atlas.cols);
  return [col / atlas.cols, 1 - (row + 1) / atlas.rows, 1 / atlas.cols, 1 / atlas.rows];
}

export function buildCity({ tier, atlasTex, atlas, openerTex, coverTex }) {
  const group = new THREE.Group();
  const r = rng(2026);
  const boxes = []; // [cx, cz, w, d, h, seed, style, lit, tint]
  const add = (cx, cz, w, d, h, style, lit, tint) => boxes.push([cx, cz, w, d, h, r(), style, lit, tint ?? r()]);

  // --- canal rows (Kowloon)
  const C = CANAL;
  for (const side of [-1, 1]) {
    let z = C.z0 - 6;
    while (z > C.z1 + 4) {
      const w = 6 + r() * 8;
      const d = 9 + r() * 9;
      const tall = r() < 0.12;
      let h = tall ? 60 + r() * 40 : 16 + r() * 36;
      // keep the view from the roof open down the canal
      if (z > -70) h = Math.min(h, 22 + r() * 18);
      if (!(side < 0 && z > ROOF.z - ROOF.d / 2 - 2)) add(side * (C.walk + d / 2), z - w / 2, d, w, h, 1, 0.2 + r() * 0.2);
      // second row
      const d2 = 12 + r() * 14;
      add(side * (C.walk + d + 3 + d2 / 2), z - w / 2 - r() * 3, d2, w + r() * 4, z > -60 ? 24 + r() * 26 : 30 + r() * 70, r() < 0.5 ? 1 : 0, 0.2 + r() * 0.2);
      z -= w + 0.4 + r() * 1.2;
    }
  }
  // --- the roof we start on
  add(ROOF.x, ROOF.z, ROOF.w, ROOF.d, ROOF.top + 2, 1, 0.3, 0.2);
  // --- towers holding the two opening holograms
  add(BILL1.x + 12, BILL1.z - 10, 16, 16, 150, 0, 0.35, 0.9);
  add(BILL2.x - 14, BILL2.z - 6, 18, 18, 162, 0, 0.35, 0.95);

  // --- the forest of towers
  const nMid = Math.round(760 * tier.city);
  let tries = 0;
  const ok = (x, z, rad) => {
    if (Math.abs(x) < 52 + rad && z > C.z1 - 10 && z < C.z0 + 40) return false; // canal district
    if (z < C.z1 + 10 && z > -860 && Math.abs(x) < 300) return false; // harbour
    if (Math.hypot(x - ROOF.x, z - ROOF.z) < 34 + rad) return false;
    if (Math.hypot(x - BILL1.x, z - BILL1.z) < 18 + rad) return false;
    if (Math.hypot(x - BILL2.x, z - BILL2.z) < 18 + rad) return false;
    return true;
  };
  let placed = 0;
  while (placed < nMid && tries++ < 20000) {
    const a = r() * Math.PI * 2;
    const dist = 60 + Math.pow(r(), 0.8) * 620;
    const x = Math.cos(a) * dist;
    const z = -120 + Math.sin(a) * dist;
    const w = 10 + r() * 22;
    if (!ok(x, z, w * 0.7)) continue;
    const far = Math.min(1, dist / 600);
    const h = 30 + Math.pow(r(), 1.6) * (110 + 150 * far) + (r() < 0.05 ? 140 : 0);
    add(x, z, w, 10 + r() * 22, h, 0, 0.18 + r() * 0.3);
    placed++;
  }
  // --- the far shore across the harbour
  for (let i = 0; i < Math.round(340 * tier.city); i++) {
    const x = (r() - 0.5) * 1500;
    const z = -880 - r() * 420;
    add(x, z, 16 + r() * 30, 16 + r() * 30, 40 + Math.pow(r(), 1.4) * 240 + (Math.abs(x) < 200 ? r() * 120 : 0), 0, 0.2 + r() * 0.25);
  }
  // --- a few megastructures
  [[-190, -300], [230, -180], [140, 60], [-260, 40], [-120, -980], [260, -1040], [30, -1150]].forEach(([x, z], i) => add(x, z, 36 + r() * 16, 36 + r() * 16, 300 + r() * 160, 0, 0.32, 0.85 + i * 0.02));

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const info = new Float32Array(boxes.length * 4);
  const mesh = new THREE.InstancedMesh(geo, towerMaterial(), boxes.length);
  const m = new THREE.Matrix4();
  boxes.forEach(([cx, cz, w, d, h, seed, style, lit, tint], i) => {
    m.makeScale(w, h, d);
    m.setPosition(cx, -2, cz);
    mesh.setMatrixAt(i, m);
    info.set([seed, style, lit, tint], i * 4);
  });
  // extend the canal buildings below the water line so they meet the embankment
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  mesh.frustumCulled = false;
  group.add(mesh);

  // --- aviation lights on the tallest roofs
  const tall = boxes.filter((b) => b[4] > 150);
  const lp = new Float32Array(tall.length * 3);
  const ls = new Float32Array(tall.length);
  tall.forEach((b, i) => {
    lp.set([b[0], b[4] - 2 + 1.5, b[1]], i * 3);
    ls[i] = r();
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
  const lights = new THREE.Points(
    lg,
    new THREE.ShaderMaterial({
      uniforms: shared,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vOn;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vOn = step(0.55, fract(uTime * 0.55 + aSeed));
          gl_PointSize = clamp(900.0 / -mv.z, 2.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vOn; uniform float uDawn;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(3.0, 0.25, 0.15) * a * vOn * (1.0 - uDawn * 0.6), 1.0); }`,
    })
  );
  lights.frustumCulled = false;
  group.add(lights);

  // --- rooftop details
  const roof = buildRoof(r);
  group.add(roof);

  // --- ambient holograms: pages of the book floating among the towers
  const holoPages = [19, 95, 151, 18, 94, 150, 20, 36, 58, 72, 96, 116, 136, 160, 168, 182, 188, 28, 44, 66, 80, 128, 144, 176];
  const holoSpots = [];
  for (let i = 0; i < holoPages.length; i++) {
    let tries2 = 0;
    while (tries2++ < 200) {
      const b = boxes[Math.floor(r() * boxes.length)];
      const [cx, cz, w, d, h] = b;
      const dist = Math.hypot(cx, cz + 100);
      if (h < 70 || dist > 520 || dist < 60) continue;
      if (Math.abs(cx) < 40 && cz > -300) continue;
      // face toward the canal axis
      const face = Math.abs(cx) > Math.abs(cz + 150) ? (cx > 0 ? -1 : 1) : 0;
      const hs = 14 + r() * 22;
      const y = h * (0.45 + r() * 0.4);
      const pos = face !== 0 ? new THREE.Vector3(cx + face * (w / 2 + 1.5), y, cz) : new THREE.Vector3(cx, y, cz + d / 2 + 1.5);
      const rotY = face !== 0 ? (face > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      holoSpots.push({ pos, rotY, hs });
      break;
    }
  }
  const holos = [];
  holoSpots.forEach((s, i) => {
    const page = holoPages[i];
    const tints = ['#9ff7ff', '#ffc0e0', '#e0ffb0', '#ffffff', '#ffd7a8'];
    const mat = holoMaterial(atlasTex, atlasRect(atlas, page), tints[i % tints.length], 0.8, r());
    const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(s.hs * atlas.aspect, s.hs), mat);
    mesh2.position.copy(s.pos);
    mesh2.rotation.y = s.rotY;
    group.add(mesh2);
    holos.push(mesh2);
  });

  // --- the two opening holograms (articles 01 and 02), facing the roof
  const billboards = [];
  [[BILL1, 6, '#bff8ff'], [BILL2, 12, '#ffe6d0']].forEach(([pos, page, tint], i) => {
    const H = 26;
    const tex = openerTex(page);
    const mat = holoMaterial(tex, [0, 0, 1, 1], tint, 1.15, i * 0.37);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(H * 0.75, H), mat);
    pl.position.copy(pos);
    const to = new THREE.Vector3(ROOF.x + 8, pos.y, ROOF.z - 6).sub(pos);
    pl.rotation.y = Math.atan2(to.x, to.z);
    group.add(pl);
    // projector beam from the tower roof
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, H * 0.45, 40, 24, 1, true),
      new THREE.ShaderMaterial({
        uniforms: fogUniforms({ uTint: { value: new THREE.Color(tint) } }),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        vertexShader: `varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
        fragmentShader: `uniform vec3 uTint; uniform float uTime; uniform float uDawn; varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){ float a = pow(1.0 - vUv.y, 1.5) * 0.022 * (0.8 + 0.2 * sin(vUv.x * 60.0 + uTime * 2.0)); gl_FragColor = vec4(uTint * a * (1.0 - uDawn), 1.0);\n${FOG_ADD}\n}`,
      })
    );
    beam.position.copy(pos).add(new THREE.Vector3(0, 24, 0));
    group.add(beam);
    billboards.push({ plane: pl, mat });
  });

  // --- the book itself: its real cover as the city's biggest hologram.
  // The jacket's chimp is half pencil, half ASCII — a ghost half-way into its shell.
  if (coverTex) {
    const ch = 30;
    const cm = holoMaterial(coverTex, [0, 0, 1, 1], '#eaf8ff', 1.05, 0.71, 0);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(ch * 0.74, ch), cm);
    cover.position.copy(COVER_HOLO);
    const to = new THREE.Vector3(-20.6, COVER_HOLO.y + 6, 52.6).sub(COVER_HOLO);
    cover.rotation.y = Math.atan2(to.x, to.z);
    group.add(cover);
    billboards.push({ plane: cover, mat: cm });
  }

  return {
    group,
    boxes,
    billboards,
    update(t, env) {
      group.visible = env.cityVis;
    },
  };
}

function buildRoof(r) {
  const g = new THREE.Group();
  const top = ROOF.top;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.85, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.6, metalness: 0.4 });
  const x0 = ROOF.x - ROOF.w / 2;
  const x1 = ROOF.x + ROOF.w / 2;
  const z0 = ROOF.z - ROOF.d / 2;
  const z1 = ROOF.z + ROOF.d / 2;
  // wet roof surface with a subtle sheen
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOF.w, ROOF.d), new THREE.MeshStandardMaterial({ color: 0x0b0d0f, roughness: 0.18, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOF.x, top + 0.02, ROOF.z);
  g.add(floor);
  // parapet
  const par = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), mat);
    m.position.set(x, top + 0.55, z);
    g.add(m);
  };
  par(ROOF.w, 0.4, ROOF.x, z0);
  par(ROOF.w, 0.4, ROOF.x, z1);
  par(0.4, ROOF.d, x0, ROOF.z);
  par(0.4, ROOF.d, x1, ROOF.z);
  // water tank on legs, AC units, a stair hut, an antenna mast
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 20), mat);
  tank.position.set(x0 + 6, top + 4.6, z1 - 6);
  g.add(tank);
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), dark);
    leg.position.set(x0 + 6 + dx, top + 1.5, z1 - 6 + dz);
    g.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), mat);
  hut.position.set(x0 + 5, top + 1.6, z0 + 6);
  g.add(hut);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.5) }));
  door.position.set(x0 + 7.51, top + 1.05, z0 + 6);
  door.rotation.y = Math.PI / 2;
  g.add(door);
  for (let i = 0; i < 7; i++) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), dark);
    ac.position.set(x0 + 12 + (i % 4) * 2.4, top + 0.55, z1 - 3 - Math.floor(i / 4) * 2.2);
    g.add(ac);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 18, 6), dark);
  mast.position.set(x0 + 3, top + 9, z0 + 3);
  g.add(mast);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) }));
  tip.position.set(x0 + 3, top + 18.2, z0 + 3);
  g.add(tip);
  // a thin neon rim along the parapet facing the city
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, ROOF.d * 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.ghost).multiplyScalar(0.9) }));
  rim.position.set(x0 + 0.25, top + 1.12, ROOF.z + 4);
  g.add(rim);
  return g;
}
