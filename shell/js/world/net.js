import * as THREE from 'three';
import { rng, GLSL_NOISE, COLORS, FOG_ADD } from '../core/util.js';
import { textPlaneTexture } from '../core/textures.js';
import { voxelShell } from './headfield.js';
import { HEAD, HEAD_S, NET_FLOOR, SEA_FLOOR, VORTEX } from './layout.js';
import { shared } from './city.js';
import { glowTexture } from './sea.js';

// 03 A.I · the Net. Below the sea floor the world turns into data: a grid to the
// horizon, towers of falling glyphs — and in the middle a shell being built.
// Each A.I article assembles one part of the voxel head from the book's divider:
// eyes, nerves, face, skin, voice, and the four locks on its mind.

export const PARTS = [
  { no: 17, zh: '眼睛', en: 'EYES', line: '看懂顧客為何猶豫' },
  { no: 18, zh: '神經', en: 'NERVES', line: '六個 AX 信任模式' },
  { no: 19, zh: '臉', en: 'FACE', line: '被 AI 看見，被人記住' },
  { no: 20, zh: '皮膚', en: 'SKIN', line: '拒絕平均的表面' },
  { no: 21, zh: '聲音', en: 'VOICE', line: '說在地的語言' },
  { no: 22, zh: '心智之鎖', en: 'LOCKS', line: '四層權限，一層一層開' },
];

export function computeShell(cell) {
  return new Promise((resolve) => {
    let worker = null;
    try {
      worker = new Worker(new URL('./headworker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      worker = null;
    }
    const local = () => resolve(voxelShell(cell));
    if (!worker) return local();
    worker.onmessage = (e) => {
      resolve(e.data.res);
      worker.terminate();
    };
    worker.onerror = () => {
      worker.terminate();
      local();
    };
    worker.postMessage({ cell });
  });
}

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

export function buildNet({ tier, shell }) {
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
  const n = shell.length / 4;
  const cell = tier.voxel;
  const S = HEAD_S;
  const boxGeo = new THREE.BoxGeometry(cell * S * 0.92, cell * S * 0.92, cell * S * 0.92);
  const aHome = new Float32Array(n * 3);
  const aScat = new Float32Array(n * 3);
  const aInfo = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = shell[i * 4];
    const y = shell[i * 4 + 1];
    const z = shell[i * 4 + 2];
    const part = shell[i * 4 + 3];
    aHome.set([x * S, y * S, z * S], i * 3);
    // unassembled voxels drift in a loose cloud around where they belong
    const a = r() * Math.PI * 2;
    const el = (r() - 0.5) * 2.4;
    const d = S * (1.6 + r() * 2.4);
    aScat.set([Math.cos(a) * d * Math.cos(el) + x * S * 0.6, Math.sin(el) * d * 0.6 + y * S * 0.6, Math.sin(a) * d * Math.cos(el) + z * S * 0.6], i * 3);
    aInfo.set([part, r(), r(), r()], i * 4);
  }
  boxGeo.setAttribute('aHome', new THREE.InstancedBufferAttribute(aHome, 3));
  boxGeo.setAttribute('aScat', new THREE.InstancedBufferAttribute(aScat, 3));
  boxGeo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(aInfo, 4));
  const huInit = {
    uAsm: { value: [0, 0, 0, 0, 0, 0] },
    uFocus: { value: -1 },
    uSkin: { value: 0 },
    uEyes: { value: 0 },
    uAwake: { value: 0 },
  };
  const head = new THREE.InstancedMesh(
    boxGeo,
    fogMat({
      uniforms: huInit,
      vertexShader: `attribute vec3 aHome; attribute vec3 aScat; attribute vec4 aInfo;
        uniform float uTime; uniform float uAsm[6]; uniform float uFocus; uniform float uSkin; uniform float uAwake;
        varying vec3 vN; varying vec3 vCol; varying float vEm; varying vec3 vW;
        #include <fog_pars_vertex>
        mat3 rotAxis(vec3 a, float t) { float c = cos(t), s = sin(t), k = 1.0 - c;
          return mat3(c + a.x*a.x*k, a.y*a.x*k + a.z*s, a.z*a.x*k - a.y*s, a.x*a.y*k - a.z*s, c + a.y*a.y*k, a.z*a.y*k + a.x*s, a.x*a.z*k + a.y*s, a.y*a.z*k - a.x*s, c + a.z*a.z*k); }
        void main(){
          int part = int(aInfo.x + 0.5);
          float prog = uAsm[part];
          float k = clamp((prog - aInfo.y * 0.45) / 0.55, 0.0, 1.0);
          k = k * k * (3.0 - 2.0 * k);
          // before a part is built it is a faint hologram of dots in the shape of the head;
          // while it builds, each cube swings out and settles into place, full size
          vec3 outw = normalize(aHome + vec3(0.0, 2.0, 0.0));
          float swing = sin(k * 3.14159) * (5.0 + aInfo.z * 9.0);
          vec3 c = aHome + outw * swing + vec3(0.0, sin(uTime * 0.8 + aInfo.w * 30.0) * 0.25 * (1.0 - k), 0.0);
          mat3 R = rotAxis(normalize(vec3(aInfo.z - 0.5, 1.0, aInfo.w - 0.5)), sin(k * 3.14159) * (2.0 + aInfo.y * 4.0));
          float s = mix(0.2, 1.0, k);
          vec3 wp = (modelMatrix * vec4(c + R * position * s, 1.0)).xyz;
          vW = wp;
          vN = normalize(mat3(modelMatrix) * (R * normal));
          // colour: pale stone like the divider head; the focused part glows cyan
          float shade = 0.72 + aInfo.w * 0.2;
          vec3 stone = vec3(shade, shade * 0.985, shade * 0.96);
          if (part == 3) {
            // skin: from mannequin-flat to a pattern that is its own
            vec3 own = mix(vec3(0.9, 0.9, 0.88), vec3(0.35, 0.8, 0.9), step(0.82, aInfo.z)) * (0.8 + 0.3 * aInfo.w);
            stone = mix(vec3(0.62), own, uSkin);
          }
          float foc = step(abs(float(part) - uFocus), 0.1);
          vCol = stone * k;
          vEm = (1.0 - k) * (0.28 + 0.2 * step(0.9, fract(aInfo.y * 7.0 + uTime * 0.2))) + foc * (0.3 + 0.3 * sin(uTime * 3.0 + aInfo.y * 6.0)) * k;
          if (part == 0) vEm += k * 1.2;
          if (part == 1) vEm += k * 0.5 * (0.5 + 0.5 * sin(aHome.y * 0.8 - uTime * 4.0));
          vEm += uAwake * 0.3 * k;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `varying vec3 vN; varying vec3 vCol; varying float vEm; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec3 L = normalize(vec3(0.3, 0.8, 0.6));
          float d = max(dot(vN, L), 0.0);
          float rim = pow(1.0 - max(dot(normalize(cameraPosition - vW), vN), 0.0), 3.0);
          vec3 col = vCol * (0.12 + 0.58 * d) + vec3(0.25, 0.75, 0.9) * rim * 0.3;
          col += vec3(0.35, 0.9, 1.1) * vEm;
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    }),
    n
  );
  head.position.copy(HEAD);
  head.frustumCulled = false;
  group.add(head);
  const hu = head.material.uniforms; // fogMat clones its uniforms: drive the live ones

  // eyes that open
  const eyeGlow = [-1, 1].map((sx) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: glowTexture(), color: new THREE.Color(0.8, 2.0, 2.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(HEAD.x + sx * 0.27 * S, HEAD.y + 0.1 * S, HEAD.z + 0.9 * S);
    s.scale.set(4, 4, 1);
    group.add(s);
    return s;
  });

  // voice: rings pushing out from the mouth
  const voice = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.03, 6, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 2.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.set(HEAD.x, HEAD.y - 0.49 * S, HEAD.z + 1.0 * S);
    group.add(ring);
    voice.push(ring);
  }

  // four locks around the mind (22)
  const lockNames = [['觀察／理解', 'OBSERVE'], ['推薦', 'RECOMMEND'], ['決策', 'DECIDE'], ['行動', 'ACT']];
  const locks = lockNames.map(([zh, en], i) => {
    const R = S * (0.62 + i * 0.17);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.05 + i * 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
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
    [0.55, 0.3, 1.0],
    [-1.25, 0.45, 0.1],
    [0.7, -0.2, 1.1],
    [1.15, 0.5, -0.5],
    [-0.65, -0.7, 1.1],
    [0, 1.9, 0.3],
  ];
  const partLabels = PARTS.map((p, i) => {
    const s = sprite(p.zh, `${p.no} · ${p.en}`, '#bff1ff', 0.75);
    s.position.set(HEAD.x + partPos[i][0] * S, HEAD.y + partPos[i][1] * S, HEAD.z + partPos[i][2] * S);
    group.add(s);
    return s;
  });

  const asm = [0, 0, 0, 0, 0, 0];
  return {
    group,
    count: n,
    setPx(px) {
      packets.material.uniforms.uPx.value = px;
    },
    // progress: 0..6 along the A.I stations (fractional between), awake: finale
    update(t, dt, env, progress, activeNo) {
      group.visible = env.netVis;
      if (!group.visible) return;
      for (let i = 0; i < 6; i++) {
        const want = Math.max(0, Math.min(1, progress - i));
        asm[i] += (want - asm[i]) * (1 - Math.exp(-dt * 1.4));
        hu.uAsm.value[i] = asm[i];
      }
      const focus = activeNo >= 17 && activeNo <= 22 ? activeNo - 17 : -1;
      hu.uFocus.value = focus;
      hu.uSkin.value += ((asm[3] > 0.9 && (focus === 3 || focus > 3) ? 1 : 0) - hu.uSkin.value) * (1 - Math.exp(-dt * 1.2));
      hu.uAwake.value = env.awake || 0;
      const blink = Math.sin(t * 0.7) > 0.985 ? 0.2 : 1;
      eyeGlow.forEach((s) => {
        const k = asm[0] * blink * (focus === 0 ? 1.3 : 0.85) + (env.awake || 0);
        s.material.opacity = Math.min(1, k);
        s.scale.setScalar(1.6 + k * 1.6);
      });
      voice.forEach((ring, i) => {
        const life = (t * 0.35 + i / voice.length) % 1;
        ring.scale.setScalar(1 + life * 8);
        ring.material.opacity = asm[4] * (1 - life) * (focus === 4 ? 0.8 : 0.3);
      });
      locks.forEach((L) => {
        const want = focus === 5 ? Math.max(0, Math.min(1, (t % 12) / 2.2 - L.i * 0.6)) : asm[5] > 0.95 ? 1 : 0;
        L.open += (want - L.open) * (1 - Math.exp(-dt * 3));
        L.ring.material.color.setRGB(2.4 - L.open * 1.8, 0.7 + L.open * 1.4, 0.6 + L.open * 1.8);
        L.ring.material.opacity = asm[5];
        L.ring.visible = asm[5] > 0.01;
        L.ring.rotation.z = t * (0.1 + L.i * 0.04) * (L.i % 2 ? -1 : 1) + L.open * 1.2;
        const a = t * 0.08 + L.i * 1.57;
        L.label.position.set(HEAD.x + Math.cos(a) * (L.R + 3), L.ring.position.y + 1.5, HEAD.z + Math.sin(a) * (L.R + 3));
        L.label.material.opacity = asm[5] * (focus === 5 ? 1 : 0.45);
      });
      partLabels.forEach((s, i) => (s.material.opacity = (focus === i ? 1 : 0.28) * Math.min(1, asm[i] * 1.5 + 0.15)));
    },
  };
}
