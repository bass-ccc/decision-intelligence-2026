import * as THREE from 'three';
import { rng, GLSL_NOISE, COLORS, FOG_ADD } from '../core/util.js';
import { textPlaneTexture } from '../core/textures.js';
import { SUN, SUN_N, SHOAL, CLAM, CORAL, BERG, VORTEX, SEA_FLOOR } from './layout.js';
import { shared } from './city.js';

// 02 MODEL · under the harbour.
// A sunflower of 5,045 glowing seeds — one per real CCS respondent behind People Model;
// three shoals for Share of Choice Context; a pearl of judgment in its shell; a coral that
// is a decision map; and the iceberg whose hidden bulk is the culture undercurrent.

const SEEDS = 5045;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const HEAD_R = 21;

function fogMat(opts) {
  return new THREE.ShaderMaterial({
    ...opts,
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog, opts.uniforms || {}]), shared, opts.shareUniforms || {}),
    fog: true,
  });
}

// Illustrative scatter rebuilt from the published validation (r 0.89, MAE 9.4, RMSE 13.1).
function validationPoints(n) {
  const r = rng(889);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = Math.min(99, Math.max(0.5, 100 * Math.pow(r(), 1.45) * (0.35 + 0.65 * r()) + 2));
    const heavy = r() < 0.12 ? 2.1 : 0.82;
    const y = Math.min(100, Math.max(0, x + gauss() * 11.2 * heavy));
    pts.push([x, y]);
  }
  return pts;
}

function petalGeometry(len, wid, curl) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i);
    const t = p.getY(i) + 0.5;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.96 + 0.04)), 0.62) * (1 - 0.3 * t);
    p.setXYZ(i, sx * w, t * len, (sx * 2) ** 2 * 0.45 * wid * 0.3 - t * t * curl + Math.sin(t * Math.PI) * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

function leafGeometry(len, wid) {
  const g = new THREE.PlaneGeometry(1, 1, 8, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i) * 2;
    const t = p.getY(i) + 0.5;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9) * (t < 0.12 ? 0.6 + t * 3.3 : 1);
    const droop = t * t * len * 0.42;
    p.setXYZ(i, sx * w * 0.5, t * len * 0.92 - droop * 0.2, Math.abs(sx) * w * 0.22 - droop + Math.sin(t * 9 + sx * 2) * 0.12 * Math.abs(sx));
  }
  g.computeVertexNormals();
  return g;
}

function sprite(text, sub, color, scale = 1) {
  const tex = textPlaneTexture(text, { w: 640, h: 150, color, sub, font: '700 46px "Noto Sans TC", sans-serif' });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, color: new THREE.Color(1.05, 1.05, 1.05) }));
  s.scale.set(12 * scale, 12 * scale * (150 / 640), 1);
  return s;
}

export function buildSea({ tier }) {
  const group = new THREE.Group();
  const r = rng(52);
  const pink = new THREE.Color(COLORS.model);

  // ------------------------------------------------------------ sea floor
  const floorGeo = new THREE.PlaneGeometry(1400, 1400, 140, 140);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i) - 440;
      const dune = Math.sin(x * 0.045 + Math.sin(z * 0.02) * 2) * 1.6 + Math.sin(z * 0.07 + x * 0.01) * 0.8;
      const dv = Math.hypot(x - VORTEX.x, z - VORTEX.z);
      const bowl = -(Math.max(0, 1 - dv / 60) ** 2) * 14;
      p.setY(i, dune + bowl);
    }
    floorGeo.computeVertexNormals();
  }
  const floor = new THREE.Mesh(
    floorGeo,
    fogMat({
      uniforms: { uVortex: { value: VORTEX.clone() } },
      vertexShader: `varying vec3 vW; varying vec3 vN;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normal; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform float uTime; uniform vec3 uVortex; varying vec3 vW; varying vec3 vN;\n#include <fog_pars_fragment>\n${GLSL_NOISE}
      float caust(vec2 p, float t) { vec2 q = p; float c = 0.0; for (int i = 0; i < 3; i++) { q += vec2(sin(q.y * 1.3 + t), cos(q.x * 1.1 - t * 0.8)) * 0.6; c += abs(sin(q.x + q.y)); } return pow(1.0 - c / 3.0, 5.0); }
      void main(){
        float dv = length(vW.xz - uVortex.xz);
        if (dv < 22.0) discard;
        vec3 sand = vec3(0.05, 0.075, 0.075) * (0.7 + 0.5 * vnoise(vW.xz * 0.3));
        float c = caust(vW.xz * 0.12, uTime * 0.6) * 1.6 + caust(vW.xz * 0.21 + 3.0, -uTime * 0.5) * 0.9;
        vec3 col = sand * (0.5 + 0.5 * vN.y) + vec3(0.25, 0.55, 0.5) * c * 0.35;
        float ring = smoothstep(34.0, 22.0, dv);
        col += vec3(0.25, 0.9, 1.0) * ring * ring * (0.6 + 0.4 * sin(dv * 1.2 - uTime * 3.0));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    })
  );
  floor.position.set(0, SEA_FLOOR, -440);
  group.add(floor);

  // ------------------------------------------------------------ light shafts from the surface
  const shaftMat = fogMat({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uSeed: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vS;\nattribute float aSeed;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vS = aSeed; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vS;\n#include <fog_pars_fragment>\nvoid main(){ float a = pow(vUv.y, 2.2) * (1.0 - abs(vUv.x - 0.5) * 2.0); a *= 0.55 + 0.45 * sin(uTime * 0.4 + vS * 20.0); gl_FragColor = vec4(vec3(0.35, 0.75, 0.7) * a * 0.14, 1.0);\n${FOG_ADD}\n}`,
  });
  const shaftN = 34;
  const shaftGeo = new THREE.PlaneGeometry(1, 1);
  shaftGeo.translate(0, -0.5, 0);
  const shaftSeed = new Float32Array(shaftN);
  const shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, shaftN);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  for (let i = 0; i < shaftN; i++) {
    e.set((r() - 0.5) * 0.25, r() * Math.PI, (r() - 0.5) * 0.25);
    q.setFromEuler(e);
    m.compose(pv.set((r() - 0.5) * 220, -1, -320 - r() * 320), q, sv.set(6 + r() * 16, 110 + r() * 50, 1));
    shafts.setMatrixAt(i, m);
    shaftSeed[i] = r();
  }
  shaftGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(shaftSeed, 1));
  shafts.frustumCulled = false;
  group.add(shafts);

  // ------------------------------------------------------------ marine snow (moves with the camera)
  const snowN = tier.snow;
  const snowPos = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) snowPos.set([r(), r(), r()], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.ShaderMaterial({
      uniforms: Object.assign({ uBox: { value: new THREE.Vector3(60, 40, 60) }, uAmt: { value: 1 } }, shared),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform vec3 uBox; varying float vA;
        void main(){ vec3 p = position * uBox + vec3(sin(uTime * 0.1 + position.x * 30.0) * 0.8, uTime * 0.35, cos(uTime * 0.12 + position.z * 20.0) * 0.8);
          p = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
          vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; vA = smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(18.0, 28.0, d)) * step(p.y, -0.5);
          gl_PointSize = clamp(60.0 / d, 1.0, 5.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; uniform float uAmt; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.5, 0.8, 0.75) * smoothstep(0.5, 0.1, d) * vA * 0.5 * uAmt, 1.0); }`,
    })
  );
  snow.frustumCulled = false;
  snow.layers.set(1);

  // ------------------------------------------------------------ 12 · the sunflower of 5,045 ghosts
  const sun = new THREE.Group();
  sun.position.copy(SUN);
  sun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), SUN_N);
  group.add(sun);
  const val = validationPoints(SEEDS);
  const home = new Float32Array(SEEDS * 3);
  const scat = new Float32Array(SEEDS * 3);
  const sd = new Float32Array(SEEDS * 4);
  const c = HEAD_R / Math.sqrt(SEEDS);
  const LISA = 1603;
  const CINDY = 3418;
  for (let i = 0; i < SEEDS; i++) {
    const rad = c * Math.sqrt(i + 0.5);
    const th = i * GOLDEN;
    const dome = -Math.pow(rad / HEAD_R, 2) * 2.2 + 0.6;
    home.set([Math.cos(th) * rad, Math.sin(th) * rad, dome], i * 3);
    const [vx, vy] = val[i];
    scat.set([(vx / 100 - 0.5) * 36, (vy / 100 - 0.5) * 36, 6 + (r() - 0.5) * 0.6], i * 3);
    sd.set([r(), rad / HEAD_R, i === LISA ? 1 : i === CINDY ? 2 : 0, r()], i * 4);
  }
  const seedGeo = new THREE.BufferGeometry();
  seedGeo.setAttribute('position', new THREE.BufferAttribute(home, 3));
  seedGeo.setAttribute('aScat', new THREE.BufferAttribute(scat, 3));
  seedGeo.setAttribute('aSd', new THREE.BufferAttribute(sd, 4));
  const su = {
    uMorph: { value: 0 },
    uWave: { value: -10 },
    uPersona: { value: 0 },
    uActive: { value: 0 },
    uPx: { value: 1 },
  };
  const seeds = new THREE.Points(
    seedGeo,
    new THREE.ShaderMaterial({
      uniforms: Object.assign(su, shared),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aScat; attribute vec4 aSd;
        uniform float uTime; uniform float uMorph; uniform float uWave; uniform float uPersona; uniform float uActive; uniform float uPx;
        varying vec3 vC; varying float vA;
        void main(){
          float k = clamp(uMorph * 1.6 - aSd.w * 0.6, 0.0, 1.0);
          k = k * k * (3.0 - 2.0 * k);
          vec3 p = mix(position, aScat, k);
          p.z += sin(k * 3.14159) * (2.0 + aSd.x * 6.0);
          float per = aSd.z > 0.5 ? uPersona : 0.0;
          p.z += per * 7.0;
          p.x += per * (aSd.z > 1.5 ? 4.0 : -4.0);
          float w = exp(-pow((aSd.y * 21.0 - uWave) * 0.5, 2.0));
          p.z += w * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aSd.x * 2.2) + aSd.x * 40.0);
          vec3 warm = vec3(1.0, 0.86, 0.7);
          vec3 pk = vec3(0.95, 0.5, 0.52);
          vC = mix(warm, pk, smoothstep(0.35, 1.0, aSd.y) * 0.8 + k * 0.4) * (0.55 + 0.9 * tw * (0.5 + 0.5 * uActive)) * (1.0 + w * 3.0);
          vC = mix(vC, vec3(2.4, 1.2, 1.3) * 2.0, per);
          vA = 1.0;
          gl_PointSize = clamp((0.42 + per * 1.6 + w * 0.3) * uPx * 900.0 / -mv.z, 1.0, 40.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a; gl_FragColor = vec4(vC * a * 1.6, 1.0); }`,
    })
  );
  seeds.frustumCulled = false;
  sun.add(seeds);
  // dark bed behind the seeds + receptacle
  const bed = new THREE.Mesh(new THREE.CircleGeometry(HEAD_R * 1.03, 80), new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.9 }));
  bed.position.z = -0.9;
  sun.add(bed);
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x3c4440, roughness: 0.8 });
  const back = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.05, 48, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), plantMat.clone());
  back.material.side = THREE.DoubleSide;
  back.rotation.x = Math.PI / 2;
  back.scale.set(1, 0.3, 1);
  back.position.z = -0.95;
  sun.add(back);
  const petalMat = new THREE.MeshStandardMaterial({ color: 0x9fa19b, roughness: 0.62, side: THREE.DoubleSide, emissive: pink, emissiveIntensity: 0.05 });
  const rings = [
    { n: 34, len: 13, wid: 4.2, r: HEAD_R * 0.97, tilt: 0.25, lift: 0.2, curl: 1.8 },
    { n: 21, len: 11, wid: 3.8, r: HEAD_R * 0.92, tilt: 0.55, lift: -0.6, curl: 2.2 },
  ];
  rings.forEach((ring, ri) => {
    const im = new THREE.InstancedMesh(petalGeometry(ring.len, ring.wid, ring.curl), petalMat, ring.n);
    const basis = new THREE.Matrix4();
    for (let i = 0; i < ring.n; i++) {
      const a = ((i + ri * 0.5) / ring.n) * Math.PI * 2 + r() * 0.05;
      const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const tilt = ring.tilt + (r() - 0.5) * 0.25;
      const y = radial.clone().multiplyScalar(Math.cos(tilt)).add(new THREE.Vector3(0, 0, -Math.sin(tilt))).normalize();
      const z = new THREE.Vector3(0, 0, Math.cos(tilt)).addScaledVector(radial, Math.sin(tilt)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      basis.makeBasis(x, y, z);
      const s = 0.9 + r() * 0.2;
      basis.scale(sv.set(s, s, s));
      basis.setPosition(radial.clone().multiplyScalar(ring.r).add(new THREE.Vector3(0, 0, ring.lift)));
      im.setMatrixAt(i, basis);
    }
    sun.add(im);
  });
  // stem down to the sea floor
  const headBack = SUN.clone().addScaledVector(SUN_N, -6);
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(SUN.x + 3, SEA_FLOOR - 2, SUN.z - 18),
    new THREE.Vector3(SUN.x - 2, SEA_FLOOR + 30, SUN.z - 20),
    new THREE.Vector3(SUN.x + 1.5, SEA_FLOOR + 62, SUN.z - 16),
    new THREE.Vector3(SUN.x, headBack.y - 14, headBack.z - 5),
    headBack,
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 80, 1.6, 10, false), plantMat);
  group.add(stem);
  [[0.25, 2.6], [0.45, 0.4], [0.62, 4.2]].forEach(([t, a]) => {
    const leaf = new THREE.Mesh(leafGeometry(16, 11), plantMat.clone());
    leaf.material.side = THREE.DoubleSide;
    const base = stemCurve.getPointAt(t);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const y = dir.clone().multiplyScalar(0.9).add(new THREE.Vector3(0, 0.42, 0)).normalize();
    const z = new THREE.Vector3(0, 1, 0).sub(y.clone().multiplyScalar(y.y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    leaf.position.copy(base);
    group.add(leaf);
  });
  // the validation diagonal (shown while the seeds become the r = 0.89 chart)
  const diag = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-18, -18, 6), new THREE.Vector3(18, 18, 6)]),
    new THREE.LineDashedMaterial({ color: new THREE.Color(2.2, 1.1, 1.1), dashSize: 0.9, gapSize: 0.6, transparent: true, opacity: 0 })
  );
  diag.computeLineDistances();
  sun.add(diag);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(36, 36)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(0.9, 0.6, 0.6), transparent: true, opacity: 0 })
  );
  frame.position.z = 6;
  sun.add(frame);

  // ------------------------------------------------------------ 13 · three shoals = Share of Choice Context
  const fishGeo = new THREE.ConeGeometry(0.22, 1.1, 5);
  fishGeo.rotateZ(-Math.PI / 2);
  const shoalRings = [
    { rad: 8, y: 3, n: 140, speed: 0.22, col: '#f6f1ea', label: ['系統份額', 'SYSTEM SHARE'] },
    { rad: 14, y: -1, n: 200, speed: -0.15, col: COLORS.model, label: ['人心與社群份額', 'CONSUMER & COMMUNITY'] },
    { rad: 20, y: -5, n: 260, speed: 0.1, col: '#9fe7e0', label: ['注意力與記憶份額', 'ATTENTION & MEMORY'] },
  ];
  const fishN = shoalRings.reduce((a, s) => a + s.n, 0);
  const fishData = new Float32Array(fishN * 4);
  const fishCol = new Float32Array(fishN * 3);
  let fi = 0;
  shoalRings.forEach((ring, ri) => {
    const col = new THREE.Color(ring.col);
    for (let i = 0; i < ring.n; i++) {
      fishData.set([ri, (i / ring.n) * Math.PI * 2 + r() * 0.1, r(), r()], fi * 4);
      fishCol.set([col.r, col.g, col.b], fi * 3);
      fi++;
    }
  });
  fishGeo.setAttribute('aFish', new THREE.InstancedBufferAttribute(fishData, 4));
  fishGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(fishCol, 3));
  const fish = new THREE.InstancedMesh(
    fishGeo,
    fogMat({
      uniforms: { uCenter: { value: SHOAL.clone() }, uRads: { value: new THREE.Vector3(8, 14, 20) }, uYs: { value: new THREE.Vector3(3, -1, -5) }, uSpeeds: { value: new THREE.Vector3(0.22, -0.15, 0.1) }, uFocus: { value: -1 } },
      vertexShader: `attribute vec4 aFish; attribute vec3 aCol; uniform float uTime; uniform vec3 uCenter; uniform vec3 uRads; uniform vec3 uYs; uniform vec3 uSpeeds; uniform float uFocus;
        varying vec3 vCol; varying vec3 vN;
        #include <fog_pars_vertex>
        void main(){
          int ri = int(aFish.x + 0.5);
          float rad = ri == 0 ? uRads.x : (ri == 1 ? uRads.y : uRads.z);
          float yy = ri == 0 ? uYs.x : (ri == 1 ? uYs.y : uYs.z);
          float sp = ri == 0 ? uSpeeds.x : (ri == 1 ? uSpeeds.y : uSpeeds.z);
          float a = aFish.y + uTime * sp;
          float rr = rad + (aFish.z - 0.5) * 3.0 + sin(uTime * 0.7 + aFish.w * 20.0) * 0.6;
          vec3 c = uCenter + vec3(cos(a) * rr, yy + (aFish.w - 0.5) * 3.0 + sin(uTime + aFish.z * 30.0) * 0.4, sin(a) * rr);
          vec3 fwd = normalize(vec3(-sin(a), 0.0, cos(a)) * sign(sp));
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 side = normalize(cross(up, fwd));
          float wig = sin(uTime * 8.0 + aFish.w * 50.0) * 0.25 * position.x;
          vec3 lp = position;
          vec3 wp = c + fwd * lp.x + up * lp.y + side * (lp.z + wig);
          vN = normalize(fwd * normal.x + up * normal.y + side * normal.z);
          float hi = uFocus < -0.5 ? 1.0 : (abs(float(ri) - uFocus) < 0.1 ? 1.6 : 0.35);
          vCol = aCol * hi;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `varying vec3 vCol; varying vec3 vN;\n#include <fog_pars_fragment>\nvoid main(){ float l = 0.35 + 0.65 * max(vN.y, 0.0); float rim = pow(1.0 - abs(vN.z), 2.0); gl_FragColor = vec4(vCol * (l * 0.9 + rim * 0.6), 1.0);\n#include <fog_fragment>\n}`,
    }),
    fishN
  );
  fish.frustumCulled = false;
  group.add(fish);
  const shoalLabels = shoalRings.map((ring, i) => {
    const s = sprite(ring.label[0], ring.label[1], ring.col, 0.8);
    s.position.copy(SHOAL).add(new THREE.Vector3(ring.rad * 0.72, ring.y + 3.2, ring.rad * 0.72));
    group.add(s);
    return s;
  });

  // ------------------------------------------------------------ 14 · the pearl of judgment
  const clam = new THREE.Group();
  clam.position.copy(CLAM);
  group.add(clam);
  const shellGeo = new THREE.SphereGeometry(6, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  {
    const p = shellGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const rib = 1 + 0.05 * Math.cos(a * 22);
      p.setXYZ(i, x * rib, y * 0.36 * rib, z * 0.82 * rib);
    }
    shellGeo.computeVertexNormals();
  }
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
  const lower = new THREE.Mesh(shellGeo, shellMat);
  lower.scale.y = -1;
  clam.add(lower);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0, -4.8);
  clam.add(hinge);
  const upper = new THREE.Mesh(shellGeo, shellMat);
  upper.position.set(0, 0, 4.8);
  hinge.add(upper);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(1.0, 0.86, 0.84), emissiveIntensity: 0.9 }));
  pearl.position.set(0, 1.1, 0.6);
  clam.add(pearl);
  const pearlGlow = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: glowTexture(), color: new THREE.Color(1.1, 0.85, 0.85), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pearlGlow.scale.set(6, 6, 1);
  pearlGlow.position.copy(pearl.position);
  clam.add(pearlGlow);
  const clamLabel = sprite('殼裡的珍珠', 'JUDGMENT · 衡斷力', '#f6e7e4', 0.8);
  clamLabel.position.set(0, 9, 0);
  clam.add(clamLabel);

  // ------------------------------------------------------------ 15 · the decision coral
  const branches = [];
  const grow = (start, dir, len, depth, dist, path) => {
    const end = start.clone().addScaledVector(dir, len);
    branches.push({ start, end, depth, dist, len, path });
    if (depth >= 5) return;
    const kids = depth < 1 ? 3 : 2 + (r() < 0.35 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const a = (k / kids) * Math.PI * 2 + r() * 1.2 + depth;
      const spread = 0.45 + r() * 0.25;
      const nd = dir.clone().multiplyScalar(Math.cos(spread)).add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(Math.sin(spread))).normalize();
      nd.y = Math.max(nd.y, 0.25);
      nd.normalize();
      grow(end, nd, len * (0.72 + r() * 0.12), depth + 1, dist + len, path + (k === 0 ? '0' : '1'));
    }
  };
  grow(CORAL.clone(), new THREE.Vector3(0, 1, 0), 9, 0, 0, '');
  const coralGeos = [];
  const tips = [];
  branches.forEach((b) => {
    const tube = new THREE.TubeGeometry(new THREE.LineCurve3(b.start, b.end), 4, Math.max(0.12, 0.9 * Math.pow(0.66, b.depth)), 6, false);
    const n = tube.attributes.position.count;
    const aD = new Float32Array(n);
    const aP = new Float32Array(n);
    const uvs = tube.attributes.uv;
    const chosen = /^0*$/.test(b.path) ? 1 : 0; // the one lit path: always the first branch
    for (let i = 0; i < n; i++) {
      aD[i] = b.dist + uvs.getX(i) * b.len;
      aP[i] = chosen;
    }
    tube.setAttribute('aD', new THREE.BufferAttribute(aD, 1));
    tube.setAttribute('aP', new THREE.BufferAttribute(aP, 1));
    coralGeos.push(tube);
    if (b.depth === 5) tips.push({ pos: b.end, chosen });
  });
  const coralGeo = mergeGeos(coralGeos);
  const coral = new THREE.Mesh(
    coralGeo,
    fogMat({
      uniforms: { uHi: { value: 0 } },
      vertexShader: `attribute float aD; attribute float aP; varying float vD; varying float vP; varying vec3 vN;\n#include <fog_pars_vertex>\nvoid main(){ vD = aD; vP = aP; vN = normal; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform float uTime; uniform float uHi; varying float vD; varying float vP; varying vec3 vN;\n#include <fog_pars_fragment>\nvoid main(){
        float l = 0.3 + 0.7 * max(vN.y * 0.5 + 0.5, 0.0);
        vec3 base = vec3(0.075, 0.05, 0.058) * l;
        float pulse = fract(vD / 60.0 - uTime * 0.22);
        float front = smoothstep(0.0, 0.015, pulse) * (1.0 - smoothstep(0.015, 0.09, pulse));
        vec3 glowAll = vec3(0.95, 0.45, 0.5) * front * 0.45 * (0.3 + 0.7 * uHi);
        vec3 glowPath = vec3(1.3, 0.85, 0.6) * vP * (0.25 + 2.2 * front) * (0.35 + 0.65 * uHi);
        gl_FragColor = vec4(base + glowAll + glowPath, 1.0);
        #include <fog_fragment>
      }`,
    })
  );
  group.add(coral);
  const tipMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), tips.length);
  tips.forEach((tp, i) => {
    m.makeTranslation(tp.pos.x, tp.pos.y, tp.pos.z);
    tipMesh.setMatrixAt(i, m);
    tipMesh.setColorAt(i, tp.chosen ? new THREE.Color(4, 2.8, 2) : new THREE.Color(0.42, 0.2, 0.24));
  });
  group.add(tipMesh);
  const chosenTip = tips.find((tp) => tp.chosen);
  const coralLabel = sprite('下一步', 'THE NEXT STEP', '#ffe0c8', 0.7);
  coralLabel.position.copy(chosenTip ? chosenTip.pos : CORAL).add(new THREE.Vector3(0, 3, 0));
  group.add(coralLabel);

  // ------------------------------------------------------------ 16 · the iceberg and its six undercurrents
  const bergGeo = new THREE.IcosahedronGeometry(1, 4);
  {
    const p = bergGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 5.1 + v.y * 2.3) * 0.08 + Math.sin(v.z * 6.3 - v.y * 4.1) * 0.07 + Math.sin(v.x * 11 + v.z * 9) * 0.03;
      const top = Math.max(0, v.y);
      v.multiplyScalar(1 + n);
      // narrow, jagged crown; broad, heavy body under the water
      v.x *= 1 - top * 0.72;
      v.z *= 1 - top * 0.72;
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  const bergFlat = bergGeo.index ? bergGeo.toNonIndexed() : bergGeo;
  bergFlat.computeVertexNormals();
  const berg = new THREE.Mesh(
    bergFlat,
    fogMat({
      vertexShader: `varying vec3 vN; varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform float uTime; uniform float uDawn; varying vec3 vN; varying vec3 vW;\n#include <fog_pars_fragment>\n${GLSL_NOISE}\nvoid main(){
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(V, vN)), 2.5);
        float above = step(0.0, vW.y);
        float l = 0.25 + 0.75 * max(vN.y, 0.0);
        vec3 body = mix(vec3(0.05, 0.16, 0.19), vec3(0.55, 0.62, 0.68), above) * l;
        float strata = smoothstep(0.92, 1.0, sin(vW.y * 0.9 + vnoise(vW.xz * 0.1) * 4.0));
        vec3 col = body + vec3(0.3, 0.9, 0.95) * fres * (0.6 - above * 0.35) + vec3(0.2, 0.6, 0.65) * strata * 0.25 * (1.0 - above);
        col += vec3(0.9, 0.55, 0.5) * uDawn * above * max(vN.z * -0.5 + 0.5, 0.0) * 0.8;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    })
  );
  berg.scale.set(32, 62, 30);
  berg.position.copy(BERG);
  // the tip of the iceberg is visible from the canal, so it lives outside the sea group
  const bergHolder = new THREE.Group();
  bergHolder.add(berg);
  const currents = ['願景幻覺', '沉默抗拒', '經驗依賴', '創新落差', '中層阻塞', '工具孤兒'];
  const curMat = fogMat({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uHi: { value: 0 } },
    vertexShader: `varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `uniform float uTime; uniform float uHi; varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){ float s = fract(vUv.x * 18.0 - uTime * 0.5); float a = smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(0.2, 0.9, s)); a *= sin(vUv.y * 3.14159); a *= smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.9, vUv.x); gl_FragColor = vec4(mix(vec3(0.95, 0.5, 0.52), vec3(0.4, 0.95, 1.0), vUv.x) * a * (0.35 + 0.65 * uHi), 1.0);\n${FOG_ADD}\n}`,
  });
  const curLabels = [];
  currents.forEach((name, i) => {
    const y0 = BERG.y - 48 + i * 11;
    const pts = [];
    const turns = 0.62;
    const a0 = i * 1.1 + 0.6;
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const a = a0 + t * Math.PI * 2 * turns;
      const rad = 36 + Math.sin(t * Math.PI) * 6 - (y0 > BERG.y ? 8 : 0);
      pts.push(new THREE.Vector3(BERG.x + Math.cos(a) * rad, y0 + t * 7 + Math.sin(t * 6 + i) * 1.2, BERG.z + Math.sin(a) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const ribbon = ribbonGeometry(curve, 120, 2.6);
    const mesh = new THREE.Mesh(ribbon, curMat);
    group.add(mesh);
    const s = sprite(name, 'UNDERCURRENT 0' + (i + 1), '#ffd6d2', 0.7);
    s.position.copy(curve.getPointAt(0.22)).add(new THREE.Vector3(0, 2.4, 0));
    group.add(s);
    curLabels.push(s);
  });
  const bergLabel = sprite('文化暗流', 'ONLY THE TIP SHOWS', '#bff4f6', 1.2);
  bergLabel.position.copy(BERG).add(new THREE.Vector3(-30, -6, 30));
  group.add(bergLabel);

  // ------------------------------------------------------------ the vortex into the Net
  const vortexN = 1600;
  const vp = new Float32Array(vortexN * 3);
  for (let i = 0; i < vortexN; i++) vp.set([r(), r(), r()], i * 3);
  const vGeo = new THREE.BufferGeometry();
  vGeo.setAttribute('position', new THREE.BufferAttribute(vp, 3));
  const vortex = new THREE.Points(
    vGeo,
    new THREE.ShaderMaterial({
      uniforms: Object.assign({ uC: { value: VORTEX.clone() } }, shared),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform vec3 uC; varying float vA;
        void main(){ float life = fract(position.x + uTime * 0.12 * (0.5 + position.z));
          float rad = mix(34.0, 3.0, life) * (0.8 + position.y * 0.4);
          float a = position.y * 6.2831 + life * 9.0 + uTime * 0.4;
          vec3 p = uC + vec3(cos(a) * rad, 16.0 - life * 90.0, sin(a) * rad);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.7, 1.0, life));
          gl_PointSize = clamp(260.0 / -mv.z, 1.0, 6.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.4, 1.3, 1.6) * smoothstep(0.5, 0.0, d) * vA, 1.0); }`,
    })
  );
  vortex.frustumCulled = false;
  group.add(vortex);

  // ------------------------------------------------------------ bubbles rising from the flower and the clam
  const bubN = 500;
  const bp = new Float32Array(bubN * 3);
  const bs = new Float32Array(bubN);
  for (let i = 0; i < bubN; i++) {
    const src = i % 2 ? CLAM : SUN;
    bp.set([src.x + (r() - 0.5) * 30, src.y, src.z + (r() - 0.5) * 30], i * 3);
    bs[i] = r();
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bGeo.setAttribute('aS', new THREE.BufferAttribute(bs, 1));
  const bubbles = new THREE.Points(
    bGeo,
    new THREE.ShaderMaterial({
      uniforms: shared,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aS; uniform float uTime; varying float vA;
        void main(){ float life = fract(uTime * (0.03 + aS * 0.04) + aS * 13.0); vec3 p = position + vec3(sin(uTime * 2.0 + aS * 40.0) * 0.4, life * 120.0, 0.0);
          vec4 mv = viewMatrix * vec4(p, 1.0); vA = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.8, 1.0, life)) * step(p.y, -0.5);
          gl_PointSize = clamp((0.3 + aS * 0.4) * 500.0 / -mv.z, 1.0, 14.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.25, 0.42, d); gl_FragColor = vec4(vec3(0.6, 0.95, 0.9) * (ring * 0.9 + smoothstep(0.5, 0.0, d) * 0.1) * vA, 1.0); }`,
    })
  );
  bubbles.frustumCulled = false;
  group.add(bubbles);

  // ------------------------------------------------------------ People Model modes
  const pm = { mode: null, morph: 0, persona: 0, waveT: -1 };
  const lisaW = new THREE.Vector3();
  const cindyW = new THREE.Vector3();

  return {
    group,
    snow,
    bergHolder,
    pm,
    seedsLocal: (i) => new THREE.Vector3(home[i * 3], home[i * 3 + 1], home[i * 3 + 2]),
    personaAnchors() {
      const l = new THREE.Vector3(home[LISA * 3] - 4 * pm.persona, home[LISA * 3 + 1], home[LISA * 3 + 2] + 7 * pm.persona);
      const c2 = new THREE.Vector3(home[CINDY * 3] + 4 * pm.persona, home[CINDY * 3 + 1], home[CINDY * 3 + 2] + 7 * pm.persona);
      sun.updateMatrixWorld();
      return [lisaW.copy(l).applyMatrix4(sun.matrixWorld), cindyW.copy(c2).applyMatrix4(sun.matrixWorld)];
    },
    setMode(mode) {
      pm.mode = pm.mode === mode ? null : mode;
      if (pm.mode === 'wave') pm.waveT = 0;
      return pm.mode;
    },
    setPx(px) {
      su.uPx.value = px;
    },
    update(t, dt, env, activeNo) {
      group.visible = env.seaVis;
      bergHolder.visible = env.bergVis;
      snow.visible = env.seaVis && env.under;
      // modes
      const wantMorph = pm.mode === 'morph' ? 1 : 0;
      const wantPer = pm.mode === 'persona' ? 1 : 0;
      pm.morph += (wantMorph - pm.morph) * (1 - Math.exp(-dt * 1.6));
      pm.persona += (wantPer - pm.persona) * (1 - Math.exp(-dt * 2.2));
      su.uMorph.value = pm.morph;
      su.uPersona.value = pm.persona;
      if (pm.mode === 'wave') {
        pm.waveT += dt;
        su.uWave.value = (pm.waveT % 4) * 8 - 3;
      } else su.uWave.value = -10;
      su.uActive.value += ((activeNo === 12 ? 1 : 0) - su.uActive.value) * (1 - Math.exp(-dt * 2));
      diag.material.opacity = frame.material.opacity = Math.max(0, pm.morph * 1.4 - 0.4) * 0.85;
      // shoals: highlight follows time when at the station
      fish.material.uniforms.uFocus.value = activeNo === 13 ? Math.floor(t / 3) % 3 : -1;
      shoalLabels.forEach((s) => (s.material.opacity = activeNo === 13 ? 1 : 0.35));
      // clam opens when you arrive
      const open = activeNo === 14 ? 0.62 : 0.3;
      hinge.rotation.x = THREE.MathUtils.lerp(hinge.rotation.x, -(open + Math.sin(t * 0.6) * 0.05), 1 - Math.exp(-dt * 1.5));
      pearl.material.emissiveIntensity = activeNo === 14 ? 1.3 + Math.sin(t * 2) * 0.25 : 0.7;
      clamLabel.material.opacity = activeNo === 14 ? 1 : 0.4;
      coral.material.uniforms.uHi.value += ((activeNo === 15 ? 1 : 0) - coral.material.uniforms.uHi.value) * (1 - Math.exp(-dt * 2));
      coralLabel.material.opacity = activeNo === 15 ? 1 : 0.35;
      curMat.uniforms.uHi.value += ((activeNo === 16 ? 1 : 0.2) - curMat.uniforms.uHi.value) * (1 - Math.exp(-dt * 2));
      curLabels.forEach((s) => (s.material.opacity = activeNo === 16 ? 1 : 0.3));
      bergLabel.material.opacity = activeNo === 16 ? 1 : 0.5;
    },
  };
}

// ---------------------------------------------------------------- helpers
let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

export function ribbonGeometry(curve, segs, width) {
  const pos = [];
  const uv = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tan);
    side.crossVectors(tan, up).normalize();
    const w = width * (0.4 + 0.6 * Math.sin(Math.PI * t));
    pos.push(p.x + up.x * w, p.y + up.y * w * 0.5 + side.y, p.z + up.z * w);
    pos.push(p.x - up.x * w, p.y - up.y * w * 0.5 - side.y, p.z - up.z * w);
    uv.push(t, 0, t, 1);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function mergeGeos(geos) {
  let n = 0;
  let ni = 0;
  for (const g of geos) {
    n += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  const names = Object.keys(geos[0].attributes);
  const arrays = {};
  for (const name of names) arrays[name] = new Float32Array(n * geos[0].attributes[name].itemSize);
  const index = new Uint32Array(ni);
  let off = 0;
  let ioff = 0;
  for (const g of geos) {
    for (const name of names) {
      const a = g.attributes[name];
      arrays[name].set(a.array, off * a.itemSize);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) index[ioff + i] = g.index.array[i] + off;
      ioff += g.index.count;
    }
    off += g.attributes.position.count;
  }
  for (const name of names) out.setAttribute(name, new THREE.BufferAttribute(arrays[name], geos[0].attributes[name].itemSize));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}
