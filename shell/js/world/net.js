import * as THREE from 'three';
import { rng, GLSL_NOISE, COLORS, FOG_ADD } from '../core/util.js';
import { textPlaneTexture } from '../core/textures.js';
import { HEAD, HEAD_S, NET_FLOOR, SEA_FLOOR, VORTEX } from './layout.js';
import { shared } from './city.js';
import { glowTexture } from './sea.js';

// 03 A.I · the Net. Below the sea floor the world turns into data: a grid to the
// horizon, towers of falling glyphs — and in the middle a shell being built.
// Each A.I article resolves one part of a marble head out of a hologram:
// eyes, nerves, face, skin, voice, and the four locks on its mind.

export const PARTS = [
  { no: 17, zh: '眼睛', en: 'EYES', line: '看懂顧客為何猶豫' },
  { no: 18, zh: '神經', en: 'NERVES', line: '六個 AX 信任模式' },
  { no: 19, zh: '臉', en: 'FACE', line: '被 AI 看見，被人記住' },
  { no: 20, zh: '皮膚', en: 'SKIN', line: '拒絕平均的表面' },
  { no: 21, zh: '聲音', en: 'VOICE', line: '說在地的語言' },
  { no: 22, zh: '心智之鎖', en: 'LOCKS', line: '四層權限，一層一層開' },
];

function glyphSheet() {
  const chars = '0123456789ABCDEF決策智慧人模型行動信任真實記憶代理衡斷文化情境體驗模擬治理注意力魂殼網潛入同步數據決定判斷選擇相信看見';
  const N = 16;
  const S = 32;
  const c = document.createElement('canvas');
  c.width = c.height = N * S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const list = [...chars];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const ch = list[(i * 7 + j * 13) % list.length];
      g.font = ch.charCodeAt(0) > 255 ? '500 26px "Noto Sans TC", sans-serif' : '500 26px "IBM Plex Mono", monospace';
      g.fillText(ch, i * S + S / 2, j * S + S / 2 + 1);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function fogMat(opts) {
  return new THREE.ShaderMaterial({ ...opts, uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog, opts.uniforms || {}]), shared), fog: true });
}

function sprite(text, sub, color, scale = 1) {
  const tex = textPlaneTexture(text, { w: 640, h: 150, color, sub, font: '700 46px "Noto Sans TC", sans-serif' });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, color: new THREE.Color(1.05, 1.05, 1.05) }));
  s.scale.set(12 * scale, 12 * scale * (150 / 640), 1);
  return s;
}

export function buildNet({ tier }) {
  const group = new THREE.Group();
  const r = rng(303);
  const cyan = new THREE.Color(COLORS.ai);
  const glyphs = glyphSheet();

  // ------------------------------------------------------------ the tunnel down from the sea floor
  const tunnelH = 110;
  const tunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 30, tunnelH, 48, 1, true),
    fogMat({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { tGlyph: { value: glyphs } },
      vertexShader: `varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform sampler2D tGlyph; uniform float uTime; varying vec2 vUv;\n#include <fog_pars_fragment>\nfloat h1(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nvoid main(){
        float cols = 64.0; float col = floor(vUv.x * cols);
        float sp = 0.15 + h1(col) * 0.35;
        vec2 g = vec2(vUv.x * cols, vUv.y * 24.0 + uTime * sp * 6.0);
        vec2 cell = floor(g); vec2 f = fract(g);
        float ch = floor(h1(cell.x * 3.1 + cell.y * 7.7 + floor(uTime * 2.0 * h1(cell.y))) * 256.0);
        vec2 guv = (vec2(mod(ch, 16.0), floor(ch / 16.0)) + f) / 16.0;
        float gl = texture2D(tGlyph, guv).r;
        float head = fract(-uTime * sp * 0.4 + h1(col * 1.7));
        float trail = pow(fract(vUv.y + head), 6.0);
        vec3 c = mix(vec3(0.2, 1.0, 0.75), vec3(0.45, 0.85, 1.0), vUv.y) * gl * (0.12 + trail * 1.6);
        gl_FragColor = vec4(c, 1.0);
        ${FOG_ADD}
      }`,
    })
  );
  tunnel.position.set(VORTEX.x, SEA_FLOOR - tunnelH / 2 + 4, VORTEX.z);
  group.add(tunnel);

  // ------------------------------------------------------------ the grid to the horizon
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    fogMat({
      transparent: true,
      depthWrite: false,
      uniforms: { uC: { value: HEAD.clone() } },
      vertexShader: `varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `uniform float uTime; uniform vec3 uC; varying vec3 vW;\n#include <fog_pars_fragment>\nfloat line(float x, float w){ float f = abs(fract(x - 0.5) - 0.5); float d = fwidth(x); return 1.0 - smoothstep(w * d, (w + 1.0) * d, f); }\nvoid main(){
        vec2 p = vW.xz / 12.0;
        float l = max(line(p.x, 0.6), line(p.y, 0.6));
        float big = max(line(vW.x / 96.0, 1.0), line(vW.z / 96.0, 1.0));
        float d = length(vW.xz - uC.xz);
        float ring = smoothstep(4.0, 0.0, abs(mod(d - uTime * 18.0, 160.0) - 80.0));
        vec3 c = vec3(0.15, 0.7, 0.8) * l * 0.12 + vec3(0.3, 0.9, 1.0) * big * 0.22 + vec3(0.4, 1.0, 0.9) * ring * l * 0.9;
        c *= 1.0 - smoothstep(120.0, 900.0, d);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(HEAD.x, NET_FLOOR, HEAD.z);
  group.add(grid);

  // ------------------------------------------------------------ towers of falling glyphs
  const colN = Math.round(260 * tier.city + 60);
  const colGeo = new THREE.PlaneGeometry(1, 1);
  colGeo.translate(0, 0.5, 0);
  const colData = new Float32Array(colN * 4);
  const cols = new THREE.InstancedMesh(
    colGeo,
    fogMat({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { tGlyph: { value: glyphs } },
      vertexShader: `attribute vec4 aCol; varying vec2 vUv; varying vec4 vCol;\n#include <fog_pars_vertex>\nvoid main(){
        vUv = uv; vCol = aCol;
        vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), 1.0);
        vec3 toCam = cameraPosition - base; toCam.y = 0.0; toCam = normalize(toCam);
        vec3 side = vec3(toCam.z, 0.0, -toCam.x);
        vec3 wp = base + side * position.x * sc.x + vec3(0.0, 1.0, 0.0) * position.y * sc.y;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
      fragmentShader: `uniform sampler2D tGlyph; uniform float uTime; varying vec2 vUv; varying vec4 vCol;\n#include <fog_pars_fragment>\nfloat h1(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nvoid main(){
        float rows = vCol.y;
        vec2 g = vec2(vUv.x, vUv.y * rows + uTime * (1.0 + vCol.z * 3.0));
        vec2 cell = floor(g); vec2 f = fract(g);
        float ch = floor(h1(cell.y * 7.7 + vCol.x * 91.0 + floor(uTime * (0.5 + vCol.z))) * 256.0);
        float gl = texture2D(tGlyph, (vec2(mod(ch, 16.0), floor(ch / 16.0)) + f) / 16.0).r;
        float head = fract(vCol.x - uTime * (0.05 + vCol.z * 0.08));
        float trail = pow(fract(vUv.y + head), 5.0);
        vec3 c = mix(vec3(0.2, 1.0, 0.7), vec3(0.4, 0.8, 1.0), vCol.w) * gl * (0.08 + trail * 1.4);
        gl_FragColor = vec4(c, 1.0);
        ${FOG_ADD}
      }`,
    }),
    colN
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < colN; i++) {
    const a = r() * Math.PI * 2;
    const d = 70 + Math.pow(r(), 0.7) * 520;
    const h = 40 + r() * 220;
    m.makeScale(2.2, h, 1);
    m.setPosition(HEAD.x + Math.cos(a) * d, NET_FLOOR, HEAD.z + Math.sin(a) * d);
    cols.setMatrixAt(i, m);
    colData.set([r(), Math.round(h / 2.2), r(), r()], i * 4);
  }
  colGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(colData, 4));
  cols.frustumCulled = false;
  group.add(cols);

  // ------------------------------------------------------------ packets streaming toward the head
  const pkN = 900;
  const pk = new Float32Array(pkN * 4);
  for (let i = 0; i < pkN; i++) {
    const a = r() * Math.PI * 2;
    const el = (r() - 0.35) * 1.2;
    pk.set([a, el, r(), 120 + r() * 380], i * 4);
  }
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pkN * 3), 3));
  pkGeo.setAttribute('aPk', new THREE.BufferAttribute(pk, 4));
  const packets = new THREE.Points(
    pkGeo,
    new THREE.ShaderMaterial({
      uniforms: Object.assign({ uC: { value: HEAD.clone() }, uPx: { value: 1 } }, shared),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aPk; uniform float uTime; uniform vec3 uC; uniform float uPx; varying float vA;
        void main(){ float life = fract(aPk.z + uTime * 0.05);
          vec3 dir = vec3(cos(aPk.x) * cos(aPk.y), sin(aPk.y), sin(aPk.x) * cos(aPk.y));
          vec3 p = uC + dir * aPk.w * (1.0 - life);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.85, 1.0, life));
          gl_PointSize = clamp(uPx * 500.0 / -mv.z, 1.0, 5.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.5, 1.4, 1.6) * smoothstep(0.5, 0.0, d) * vA, 1.0); }`,
    })
  );
  packets.frustumCulled = false;
  group.add(packets);

  // ------------------------------------------------------------ the shell
  // A marble head in the classical manner: the scan of a real bust, cut at the neck
  // (Poly Haven "Marble Bust 01" by Rico Cilliers, CC0; tools/bust-bake/bake.mjs turns it into assets/models/bust.bin).
  // Each A.I article resolves one part of it. What is not built yet is a hologram of the statue;
  // where a part is arriving the surface breaks into glowing pixels; behind that front it is stone.
  // The material is made and compiled at boot against a stand-in sphere, and the scan is swapped in
  // when it has loaded, so the head never costs the reader a second of loading or a recompile.
  const S = HEAD_S;
  const motion = tier.reduced ? 0.45 : 1; // "reduce motion" keeps everything, smaller and slower
  // where things are on this head, in head units (the file carries the same numbers)
  const MARK = { eye: [0.27, -0.03, 0.77], mouth: [0, -0.55, 0.97], nose: [0, -0.35, 1.12], cap: 0.5 };
  const standIn = new THREE.IcosahedronGeometry(0.5, 1);
  standIn.setAttribute('aAo', new THREE.BufferAttribute(new Float32Array(standIn.attributes.position.count * 2).fill(1), 2));
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  flat.needsUpdate = true;
  const head = new THREE.Mesh(
    standIn,
    fogMat({
      uniforms: {
        tNormal: { value: flat },
        uReady: { value: 0 },
        uAsm: { value: [0, 0, 0, 0, 0, 0] },
        uFoc: { value: [0, 0, 0, 0, 0, 0] },
        uWake: { value: 0 },
        uMotion: { value: motion },
        uCamL: { value: new THREE.Vector3(0, 0, 4) },
        uEye: { value: new THREE.Vector3(...MARK.eye) },
        uMouth: { value: new THREE.Vector3(...MARK.mouth) },
        uNose: { value: new THREE.Vector3(...MARK.nose) },
        uCap: { value: MARK.cap },
      },
      vertexShader: `attribute vec2 aAo; // x: how open to the light this point is; y: 1 on the cut face of the neck
        varying vec3 vH; varying vec3 vN; varying vec2 vUv; varying vec2 vAo;
        #include <fog_pars_vertex>
        void main(){
          vH = position; vN = normal; vUv = uv; vAo = aAo;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D tNormal; uniform float uReady; uniform float uTime; uniform float uAsm[6]; uniform float uFoc[6];
        uniform float uWake; uniform float uMotion; uniform vec3 uCamL; uniform vec3 uEye; uniform vec3 uMouth; uniform vec3 uNose; uniform float uCap;
        varying vec3 vH; varying vec3 vN; varying vec2 vUv; varying vec2 vAo;
        #include <fog_pars_fragment>
        const vec3 KEY = vec3(0.381, 0.802, 0.461);
        const vec3 KEY_COL = vec3(0.92, 0.86, 0.76);
        const vec3 KICK = vec3(-0.7555, 0.2518, -0.6044);
        const vec3 KICK_COL = vec3(0.16, 0.42, 0.52);
        const vec3 SKY_COL = vec3(0.07, 0.12, 0.15);
        const vec3 GND_COL = vec3(0.03, 0.08, 0.09);
        const vec3 GLOW = vec3(0.35, 0.9, 1.1);
        const vec3 GHOST = vec3(1.0, 0.62, 0.28);
        const float CELL = 0.06; // size of a pixel of the arriving front, in head units
        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
        float vn3(vec3 p) {
          vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), u.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), u.x), u.y),
                     mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), u.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), u.x), u.y), u.z);
        }
        // distance to the nearest wall between cells of a 3D Voronoi pattern: 0 on a crack
        float cracks(vec3 p) {
          vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 g = vec3(float(x), float(y), float(z)); vec3 o = g + h33(i + g) - f; float d = dot(o, o);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return sqrt(d2) - sqrt(d1);
        }
        // The part of the shell a point belongs to (0 eyes, 2 face, 3 skin, 4 voice, 5 mind) and how
        // late in that part's arrival it comes (0 first, 1 last). Nerves (1) are not a place: they
        // are a pattern over all of it.
        vec2 partAt(vec3 h) {
          float ax = abs(h.x);
          if (h.y > uCap + 0.05 * sin(atan(h.x, h.z) * 6.0)) return vec2(5.0, clamp((h.y - uCap) / (1.08 - uCap), 0.0, 1.0));
          if (h.z > 0.3) {
            vec2 e = vec2((ax - uEye.x) / 0.27, (h.y - uEye.y) / 0.17);
            if (dot(e, e) < 1.0 || (ax < 0.14 && h.y > uEye.y - 0.08 && h.y < uEye.y + 0.24)) return vec2(0.0, clamp(ax / 0.55, 0.0, 1.0));
            vec2 m = vec2(h.x / 0.31, (h.y - uMouth.y) / 0.19);
            if (dot(m, m) < 1.0) return vec2(4.0, clamp(length(h - uMouth) / 0.36, 0.0, 1.0));
            return vec2(2.0, clamp(length(h - uNose) / 1.45, 0.0, 1.0));
          }
          return vec2(3.0, clamp((0.3 - h.z) / 1.5 - 0.12 * h.y + 0.1, 0.0, 1.0));
        }
        // A tangent-space normal map without a tangent attribute: the frame comes from how position
        // and uv change across the pixel (those four derivatives are taken once, outside any branch).
        vec3 perturb(vec3 N, vec3 q0, vec3 q1, vec2 st0, vec2 st1, vec3 mapN) {
          vec3 q1p = cross(q1, N), q0p = cross(N, q0);
          vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
          float det = max(dot(T, T), dot(B, B));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          return normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
        }
        void main(){
          if (uReady < 0.5) discard;
          vec3 h = vH;
          vec3 V = normalize(uCamL - h);
          vec3 Ng = normalize(vN + vec3(0.0, 1e-5, 0.0));
          float cap = step(0.5, vAo.y);
          // the texture and the derivatives first: neither may be taken inside the branches below
          vec3 mapN = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
          mapN.y = -mapN.y; // the scan's uv runs top-down
          vec3 q0 = dFdx(h), q1 = dFdy(h);
          vec2 st0 = dFdx(vUv), st1 = dFdy(vUv);
          float fres = clamp(1.0 - dot(Ng, V), 0.0, 1.0);
          fres = fres * fres * sqrt(fres);

          // Built or not is decided per small block of space, so the edge of a part and the front
          // that builds it are stepped like pixels.
          vec3 hq = (floor(h / CELL) + 0.5) * CELL;
          vec2 pa = partAt(hq);
          int part = int(pa.x + 0.5);
          float k = clamp((uAsm[part] - pa.y * 0.62) / 0.38, 0.0, 1.0);
          float foc = uFoc[part];

          // two samples of noise serve everything: the nerves, the grain of the stone, the wander of the cracks
          float n1 = vn3(h * 2.3 + 3.1), n2 = vn3(h * 4.9 + 7.1);
          // nerves: veins that climb from the neck over everything
          float aN = clamp((h.y + 1.12) / 2.2, 0.0, 1.0);
          float nk = clamp((uAsm[1] - aN * 0.62) / 0.38, 0.0, 1.0);
          float vein = (1.0 - smoothstep(0.0, 0.03, abs(0.62 * n1 + 0.38 * n2 - 0.5))) * nk;
          float pulse = smoothstep(0.7, 1.0, fract(aN * 3.0 - uTime * 0.22 * uMotion + n1 * 1.4));

          // ---- not built: a hologram of the statue (scan lines, its outline, the nerves)
          vec3 holo = vec3(0.0);
          if (k < 1.0) {
            float ln = 1.0 - smoothstep(0.02, 0.09, abs(fract(h.y * 17.0 - uTime * 0.12 * uMotion) - 0.5));
            holo = GLOW * (0.10 + 0.30 * ln + 0.45 * fres) + GLOW * vein * (0.35 + 0.55 * pulse) * (0.7 + 0.6 * uFoc[1]);
            float cover = clamp(0.07 + 0.55 * ln + 0.9 * fres + vein * (0.5 + 0.5 * pulse), 0.0, 1.0);
            cover = mix(cover, 1.0, smoothstep(0.0, 0.35, k));
            float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (cover < dith) discard;
          }

          // ---- built: marble
          vec3 marble = vec3(0.0);
          if (k > 0.0) {
            vec3 N = mix(perturb(Ng, q0, q1, st0, st1, mapN), Ng, cap);
            // a bad normal (a degenerate triangle, a uv seam) must never reach the frame: one broken
            // pixel is spread over the whole picture by the bloom
            if (!(dot(N, N) > 0.5 && dot(N, N) < 2.0)) N = Ng;
            float ao = mix(0.30, 1.0, vAo.x);
            float kd = clamp((dot(N, KEY) + 0.22) / 1.22, 0.0, 1.0); // wrapped: stone lets a little light through
            float kick = max(dot(N, KICK), 0.0);
            vec3 light = KEY_COL * kd * mix(0.55, 1.0, vAo.x) + KICK_COL * kick * sqrt(kick) * ao
                       + mix(GND_COL, SKY_COL, 0.5 + 0.5 * N.y) * (0.35 + 0.65 * ao);
            vec3 alb = mix(vec3(0.75, 0.72, 0.66), vec3(0.84, 0.81, 0.75), n2);
            alb *= 1.0 - 0.25 * vein; // the nerves stay in the stone as its veins
            alb = mix(alb, vec3(0.42, 0.40, 0.38), cap); // the cut face is rough stone
            float spec = pow(max(dot(N, normalize(KEY + V)), 0.0), 36.0) * 0.14 * kd * (1.0 - cap);
            marble = alb * light + KEY_COL * spec + vec3(0.10, 0.05, 0.025) * kd * (1.0 - kd) * 2.0 + vec3(0.14, 0.42, 0.52) * fres * 0.16;
            marble = min(marble, vec3(0.97)); // lit stone never reaches the bloom threshold
            // eyes: blank, as on any classical head, but they hold a little light once they are built
            float eye = (1.0 - smoothstep(0.03, 0.10, length(vec3(abs(h.x), h.yz) - uEye))) * clamp((uAsm[0] - 0.6) / 0.4, 0.0, 1.0);
            marble += mix(vec3(0.30, 0.75, 0.9) * 0.42, GHOST * 0.9, uWake) * eye;
            marble += GLOW * vein * 0.05 * (1.0 + 4.0 * uFoc[1]);
            // the part being read: a band of light sweeps it the way it was built
            float sw = pa.y - fract(uTime / 6.0) * 1.3 + 0.15;
            marble += GLOW * 0.30 * foc * exp(-sw * sw / 0.004) * uMotion;
            // the ghost: gold seams open from the crown down and light comes out of them
            if (uWake > 0.001) {
              float yf = 1.25 - uWake * 2.7;
              float p = smoothstep(yf - 0.12, yf + 0.25, h.y) * uWake * (1.0 - cap);
              if (p > 0.001) {
                // breaks that wander like breaks in stone, not the straight walls of a cell pattern
                vec3 wob = vec3(n1, n2, 0.5 + 0.5 * sin((n1 - n2) * 9.0)) - 0.5;
                float d = cracks(h * 2.1 + 11.0 + wob * 0.9);
                float wide = 0.6 + 0.8 * n1; // a break is not the same width all along
                // gold laid into the break: it replaces the stone there (added on top it reads white)
                marble = mix(marble, GHOST * 1.3, (1.0 - smoothstep(0.008 * wide, 0.032 * wide, d)) * p) + GHOST * (1.0 - smoothstep(0.0, 0.22, d)) * 0.14 * p;
              }
              marble += GHOST * 0.85 * uWake * cap; // and out of the cut in the neck
            }
          }

          // ---- on its way in: a glowing pixel
          float mid = sin(k * 3.14159);
          vec3 c = fract(h / CELL) - 0.5;
          float gap = smoothstep(0.40, 0.47, max(abs(c.x), max(abs(c.y), abs(c.z)))) * mid;
          vec3 col = mix(holo, marble, smoothstep(0.25, 0.85, k));
          col += GLOW * 0.55 * mid * mid * (0.6 + 0.4 * uMotion);
          col *= 1.0 - 0.6 * gap;
          gl_FragColor = vec4(clamp(col, 0.0, 8.0), 1.0);
          #include <fog_fragment>
        }`,
    })
  );
  head.scale.setScalar(S);
  head.frustumCulled = false;
  const hu = head.material.uniforms; // fogMat clones its uniforms: drive the live ones
  let vertices = 0;

  // everything that belongs to the head hangs on one rig, so it can turn toward the reader
  const rig = new THREE.Group();
  rig.position.copy(HEAD);
  rig.add(head);
  group.add(rig);

  // the ghost's aura: a wide soft light behind the head. The head hides the middle of it, so all
  // that shows is a warm edge around the silhouette. Drawn after the floor grid, which would
  // otherwise paint over it. Kept far below the bloom threshold.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: glowTexture(), color: new THREE.Color(0.4, 0.235, 0.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  halo.scale.set(2.8 * S, 2.8 * S, 1);
  halo.renderOrder = 5;
  rig.add(halo);

  // voice: rings pushing out from the mouth
  const voice = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.03, 6, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.38, 0.92, 1.04), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.set(MARK.mouth[0] * S, MARK.mouth[1] * S, (MARK.mouth[2] + 0.06) * S);
    rig.add(ring);
    voice.push(ring);
  }

  // four locks around the mind (22). They stay fixed in the world while the head turns under them.
  const lockNames = [['觀察／理解', 'OBSERVE'], ['推薦', 'RECOMMEND'], ['決策', 'DECIDE'], ['行動', 'ACT']];
  const locks = lockNames.map(([zh, en], i) => {
    const R = S * (0.62 + i * 0.17);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.05 + i * 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 0.38, 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.set(HEAD.x, HEAD.y + S * (0.98 + i * 0.12), HEAD.z);
    ring.rotation.x = Math.PI / 2 + (i - 1.5) * 0.12;
    ring.rotation.y = (i - 1.5) * 0.1;
    group.add(ring);
    // notches on each ring
    const notch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.5), ring.material);
    notch.position.set(R, 0, 0);
    ring.add(notch);
    const label = sprite(zh, `LAYER 0${i + 1} · ${en}`, '#d8f6ff', 0.62);
    group.add(label);
    return { ring, label, R, i, open: 0 };
  });

  // part labels
  const partPos = [
    [0.95, 0.05, 0.75],
    [-1.25, 0.45, 0.1],
    [0.95, -0.35, 0.85],
    [1.15, 0.5, -0.5],
    [-0.75, -0.62, 1.0],
    [0.65, 0.92, 0.44], // at the temple, under the column of lock labels: above the crown it leaves the top of a phone screen
  ];
  const partLabels = PARTS.map((p, i) => {
    const s = sprite(p.zh, `${p.no} · ${p.en}`, '#bff1ff', 0.75);
    s.position.set(HEAD.x + partPos[i][0] * S, HEAD.y + partPos[i][1] * S, HEAD.z + partPos[i][2] * S);
    group.add(s);
    return s;
  });

  const asm = [0, 0, 0, 0, 0, 0];
  const foc = [0, 0, 0, 0, 0, 0];
  const camL = new THREE.Vector3();
  let lockT = 0;
  let unlocked = 0;
  return {
    group,
    get count() {
      return vertices;
    },
    hu,
    rig,
    setPx(px) {
      packets.material.uniforms.uPx.value = px;
    },
    // The scan and its detail map arrive after the reader is already in. Until then the head is
    // simply not there; the locks, labels and cards work without it.
    async loadBust(url = '../assets/models/bust.bin', normalUrl = '../assets/img/bust/normal.jpg') {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      const buf = await res.arrayBuffer();
      if (new TextDecoder('latin1').decode(new Uint8Array(buf, 0, 4)) !== 'BUST') throw new Error(`${url}: not a bust file`);
      const jsonLen = new DataView(buf).getUint32(4, true);
      const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jsonLen)));
      const nv = info.vertices;
      const pad4 = (n) => (n + 3) & ~3;
      let o = 8 + jsonLen;
      const p16 = new Uint16Array(buf, o, nv * 3);
      o += pad4(nv * 6);
      const n8 = new Int8Array(buf, o, nv * 4);
      o += pad4(nv * 4);
      const uv16 = new Uint16Array(buf, o, nv * 2);
      o += pad4(nv * 4);
      const index = new Uint16Array(buf, o, info.indices);
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), ao = new Float32Array(nv * 2);
      for (let v = 0; v < nv; v++) {
        for (let k = 0; k < 3; k++) {
          pos[v * 3 + k] = info.min[k] + (p16[v * 3 + k] / 65535) * (info.max[k] - info.min[k]);
          nor[v * 3 + k] = n8[v * 4 + k] / 127;
        }
        uv[v * 2] = uv16[v * 2] / 65535;
        uv[v * 2 + 1] = uv16[v * 2 + 1] / 65535;
        const w = n8[v * 4 + 3]; // occlusion in 7 bits; negative marks the cut face of the neck
        ao[v * 2] = w < 0 ? 1 : w / 127;
        ao[v * 2 + 1] = w < 0 ? 1 : 0;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('aAo', new THREE.BufferAttribute(ao, 2));
      geo.setIndex(new THREE.BufferAttribute(index.slice(), 1));
      const tex = await new THREE.TextureLoader().loadAsync(normalUrl).catch(() => null);
      if (tex) {
        tex.flipY = false; // the uvs are glTF's: origin at the top
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        hu.tNormal.value = tex;
      }
      const L = info.landmarks || {};
      if (L.eyeR) hu.uEye.value.fromArray(L.eyeR);
      if (L.mouth) hu.uMouth.value.fromArray(L.mouth);
      if (L.nose) hu.uNose.value.fromArray(L.nose);
      if (L.cap !== undefined) hu.uCap.value = L.cap;
      head.geometry.dispose();
      head.geometry = geo;
      vertices = nv;
      hu.uReady.value = 1;
    },
    // progress: 0..6 along the A.I stations (fractional between); env.awake: the reader is leaving
    update(t, dt, env, progress, activeNo, camera) {
      group.visible = env.netVis;
      if (!group.visible) return;
      const ease = (l) => 1 - Math.exp(-dt * l);
      const focus = activeNo >= 17 && activeNo <= 22 ? activeNo - 17 : -1;
      for (let i = 0; i < 6; i++) {
        // a steady pace, so the front that sweeps each part finishes instead of creeping
        const want = Math.max(0, Math.min(1, progress - i));
        asm[i] += Math.max(-dt * 0.6, Math.min(dt * 0.6, want - asm[i]));
        hu.uAsm.value[i] = asm[i];
        foc[i] += ((focus === i ? 1 : 0) - foc[i]) * ease(3);
        hu.uFoc.value[i] = foc[i];
      }

      // The locks open one by one once the reader has arrived at 22, never before. Past the stop
      // (flying up, or coming back down from the finale) they are done for good, so the reader
      // never returns to a head that falls asleep and wakes a second time. Setting off counts as
      // past the stop at once, so a reader who turns back a second later finds it still awake.
      const gone = progress >= 6 && (focus !== 5 || (env.awake || 0) > 0);
      lockT = asm[5] > 0.9 && (focus === 5 || gone) ? Math.max(lockT + dt, gone ? 4.7 : 0) : 0;
      unlocked += ((lockT > 4.6 ? 1 : 0) - unlocked) * ease(1.1);
      if (gone) unlocked = Math.max(unlocked, env.awake || 0);
      // the ghost wakes when the last lock is open, or as the reader leaves for the surface
      const wake = Math.max(env.awake || 0, unlocked);
      hu.uWake.value += (wake - hu.uWake.value) * ease(2.6); // quick enough to be seen in the second before the reader is gone
      const lit = hu.uWake.value;
      halo.material.opacity = lit * (tier.reduced ? 0.8 : 0.8 + 0.2 * Math.sin(t * 0.9));

      // the head turns a little toward the reader, and most of the way when it wakes
      if (camera) {
        const dx = camera.position.x - HEAD.x;
        const dy = camera.position.y - HEAD.y;
        const dz = camera.position.z - HEAD.z;
        const follow = (0.18 + 0.6 * wake) * motion;
        const yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(dx, dz))) * follow;
        const pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(dy, Math.hypot(dx, dz)))) * follow;
        rig.rotation.y += (yaw - rig.rotation.y) * ease(1.6);
        rig.rotation.x += (pitch - rig.rotation.x) * ease(1.6);
        rig.updateMatrixWorld();
        head.worldToLocal(camL.copy(camera.position));
        hu.uCamL.value.copy(camL);
      }

      voice.forEach((ring, i) => {
        const life = tier.reduced ? (i + 0.5) / voice.length : (t * 0.35 + i / voice.length) % 1;
        ring.scale.setScalar(1 + life * 8);
        ring.material.opacity = asm[4] * (1 - life) * (focus === 4 ? 0.8 : 0.3);
      });
      locks.forEach((L) => {
        const want = focus === 5 ? (lockT > 1.0 + 0.9 * L.i ? 1 : 0) : asm[5] > 0.95 ? 1 : 0;
        L.open += (want - L.open) * ease(3);
        L.ring.material.color.setRGB(1.45 - L.open * 1.03, 0.38 + L.open * 0.82, 0.32 + L.open * 1.03);
        L.ring.material.opacity = asm[5] * (1 - 0.55 * lit);
        L.ring.visible = asm[5] > 0.01;
        L.ring.rotation.z = (tier.reduced ? 0 : t * (0.1 + L.i * 0.04) * (L.i % 2 ? -1 : 1)) + L.open * 1.2;
        // The labels circle their rings. With motion reduced they do not circle, so they are
        // stood in a short column on the reader's side instead of wherever they would have
        // stopped (one of them directly behind the head).
        const a = tier.reduced ? 0.6 : t * 0.08 + L.i * 1.57;
        const lr = (tier.reduced ? locks[0].R : L.R) + 3;
        L.label.position.set(HEAD.x + Math.cos(a) * lr, L.ring.position.y + 1.5, HEAD.z + Math.sin(a) * lr);
        L.label.material.opacity = asm[5] * (focus === 5 ? 1 : 0.45);
      });
      partLabels.forEach((s, i) => (s.material.opacity = (focus === i ? 1 : 0.28) * Math.min(1, asm[i] * 1.5 + 0.15)));
    },
  };
}
