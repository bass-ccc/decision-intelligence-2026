import * as THREE from 'three';
import { N, sphere, orbits, fingerprint, sunflower, voxels, scatter, nebula } from './formations.js';

THREE.ColorManagement.enabled = false;

// ---------------------------------------------------------------------------
// Geometry of the book spiral
// ---------------------------------------------------------------------------
export const R = 18;            // spiral radius
const PITCH = 7.6;              // vertical drop per turn
const ASPECT = 0.75;            // page width / height (trim size)
const TAU = Math.PI * 2;
const SIZES = { body: 2.3, front: 3.6, opener: 4.4, gate: 5.0 };
const BG = new THREE.Vector3(0.1, 0.09, 0.082);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const hexv = (h) => new THREE.Vector3(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export const thetaAt = (s) => -s / R;
export const yAt = (s) => (-s * PITCH) / (TAU * R);
export function helixPoint(s, v = new THREE.Vector3()) {
  const t = thetaAt(s);
  return v.set(R * Math.cos(t), yAt(s), R * Math.sin(t));
}
function normalAt(s, v = new THREE.Vector3()) {
  const t = thetaAt(s);
  return v.set(Math.cos(t), 0, Math.sin(t));
}
function rightAt(s, v = new THREE.Vector3()) {
  const t = thetaAt(s);
  return v.set(Math.sin(t), 0, -Math.cos(t));
}

export function buildLayout(pages, articles, sections, sectionForPage) {
  const openers = new Map(articles.map((a) => [a.start, a]));
  const gateStart = new Map();
  sections.forEach((s) => s.divider && gateStart.set(s.divider[0], s));
  const slots = new Array(pages + 1);
  const anchors = [];
  let s = 0;
  for (let p = 1; p <= pages; p++) {
    if (gateStart.has(p)) {
      const sec = gateStart.get(p);
      s += 5.5;
      const h = SIZES.gate, w = h * ASPECT;
      slots[p] = { p, kind: 'gate', w, h, s: s + w / 2, sec: sec.id };
      slots[p + 1] = { p: p + 1, kind: 'gate', w, h, s: s + w * 1.5, sec: sec.id };
      anchors.push({ type: 'gate', s: s + w, section: sec.id, page: p });
      s += 2 * w + 4.5;
      p++;
      continue;
    }
    const art = openers.get(p);
    let kind = 'body', h = SIZES.body;
    if (p === 1 || p === pages) { kind = 'front'; h = SIZES.front; }
    if (art) { kind = 'opener'; h = SIZES.opener; s += 3.2; }
    if (p === pages) s += 4;
    const w = h * ASPECT;
    slots[p] = { p, kind, w, h, s: s + w / 2, sec: sectionForPage(p) };
    if (p === 1) anchors.push({ type: 'start', s: slots[p].s, page: 1 });
    if (art) anchors.push({ type: 'article', s: slots[p].s, article: art.no, page: p });
    if (p === pages) anchors.push({ type: 'end', s: slots[p].s, page: p });
    s += w + (art ? 2.0 : kind === 'front' ? 1.4 : 0.32);
  }
  for (let p = 1; p <= pages; p++) slots[p].sec = slots[p].sec || sectionForPage(p);

  // zones: stretches of the spiral the HUD describes
  const zones = [];
  const first = articles[0];
  zones.push({ type: 'start', a: -1e9, b: slots[first.start].s - 3.6 });
  for (const a of articles) zones.push({ type: 'article', article: a.no, a: slots[a.start].s - 3.6, b: slots[a.end].s + 1.4 });
  for (const an of anchors.filter((x) => x.type === 'gate')) zones.push({ type: 'gate', section: an.section, a: an.s - 7, b: an.s + 6.5 });
  zones.push({ type: 'end', a: slots[pages].s - 5, b: 1e9 });
  zones.sort((x, y) => x.a - y.a);
  return { slots, anchors, zones, length: s, start: slots[1].s, end: slots[pages].s };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const pageVert = /* glsl */ `
  attribute vec2 aCell;
  attribute float aDim;
  attribute float aLift;
  attribute float aS;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFocus;
  uniform float uFocusAmt;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vDim;
  varying float vLift;
  varying float vFog;
  void main() {
    vUv = uv; vCell = aCell; vLift = aLift;
    vDim = max(aDim, smoothstep(2.1, 5.2, abs(aS - uFocus)) * 0.82 * uFocusAmt);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const pageFrag = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform vec3 uBg;
  uniform vec3 uBack;
  uniform float uGlobalDim;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vDim;
  varying float vLift;
  varying float vFog;
  void main() {
    vec3 col;
    if (gl_FrontFacing) {
      vec2 uv = clamp(vUv, 0.006, 0.994);
      vec2 t = vec2((vCell.x + uv.x) / uGrid.x, 1.0 - (vCell.y + 1.0 - uv.y) / uGrid.y);
      col = texture2D(uAtlas, t).rgb;
    } else {
      col = uBack * (0.8 + 0.2 * vUv.y);
    }
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    col *= 0.9 + 0.1 * smoothstep(0.0, 0.04, e);
    col *= 1.0 + vLift * 0.1;
    float dim = clamp(max(vDim, uGlobalDim), 0.0, 1.0);
    col = mix(col, uBg, dim * 0.84);
    col = mix(col, uBg, vFog);
    gl_FragColor = vec4(col, 1.0);
  }`;

const hiVert = /* glsl */ `
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const hiFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uBg;
  uniform float uOpacity;
  uniform float uDim;
  uniform float uLift;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vec3 col = texture2D(uMap, vUv).rgb;
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    col *= 0.9 + 0.1 * smoothstep(0.0, 0.03, e);
    col *= 1.0 + uLift * 0.1;
    col = mix(col, uBg, uDim * 0.84);
    col = mix(col, uBg, vFog);
    gl_FragColor = vec4(col, uOpacity);
  }`;

const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vec2 p = vUv - 0.5;
    p.x *= 1.15;
    float d = length(p) * 2.0;
    float a = pow(1.0 - clamp(d, 0.0, 1.0), 2.2);
    gl_FragColor = vec4(uColor * a * uOpacity * (1.0 - vFog), 1.0);
  }`;

const swarmVert = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColFrom;
  attribute vec3 aColTo;
  attribute vec4 aRand;
  attribute float aGlyph;
  uniform float uMorph;
  uniform float uTime;
  uniform float uSize;
  uniform float uSizeMul;
  uniform float uScale;
  uniform float uScatter;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uWobble;
  varying vec3 vColor;
  varying float vGlyph;
  varying float vFade;
  void main() {
    float d = aRand.x * 0.45;
    float m = clamp((uMorph - d) / 0.55, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(aFrom, aTo, m);
    p += (aRand.yzw - 0.5) * sin(m * 3.14159) * uScatter;
    p += vec3(sin(uTime * 0.7 + aRand.y * 40.0), cos(uTime * 0.6 + aRand.z * 40.0), sin(uTime * 0.5 + aRand.w * 40.0)) * uWobble;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = clamp(uSize * uSizeMul * (0.75 + aRand.w * 0.7) * uScale / dist, 1.0, 64.0);
    vColor = mix(aColFrom, aColTo, m);
    vGlyph = aGlyph;
    vFade = (1.0 - smoothstep(uFogNear, uFogFar, dist)) * smoothstep(0.6, 2.5, dist);
    gl_Position = projectionMatrix * mv;
  }`;
const swarmFrag = /* glsl */ `
  uniform sampler2D uGlyphs;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vGlyph;
  varying float vFade;
  void main() {
    vec2 uv = vec2((vGlyph + gl_PointCoord.x) / 8.0, 1.0 - gl_PointCoord.y);
    float a = texture2D(uGlyphs, uv).r;
    if (a < 0.04) discard;
    gl_FragColor = vec4(vColor * a * uOpacity * vFade, 1.0);
  }`;

const dustVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.15 + aSeed * 30.0) * 0.6;
    p.x += cos(uTime * 0.1 + aSeed * 20.0) * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((0.06 + aSeed * 0.08) * uScale / -mv.z, 1.0, 6.0);
    vA = (0.25 + 0.5 * fract(aSeed * 13.7)) * (1.0 - smoothstep(40.0, 120.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }`;
const dustFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(vec3(0.93, 0.89, 0.83) * a, 1.0);
  }`;

const threadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const threadFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReveal;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uReveal) discard;
    float flow = fract(vUv.x * 7.0 - uTime * 0.3);
    float a = 0.28 + 0.72 * smoothstep(0.8, 1.0, flow);
    gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
  }`;

// ---------------------------------------------------------------------------
// Textures made on the fly
// ---------------------------------------------------------------------------
function glyphTexture() {
  const chars = ['.', ':', '·', ';', '+', 'n', 'e', 'd'];
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S * 8; c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, S);
  x.fillStyle = '#fff';
  x.font = `500 ${Math.round(S * 0.8)}px "IBM Plex Mono", ui-monospace, monospace`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  chars.forEach((ch, i) => x.fillText(ch, i * S + S / 2, S * 0.5));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// The real cover: a scan of the printed jacket, cut into front / spine / back.
const COVER = 'assets/img/cover/';
const KRAFT = '#dbc4aa';
// Material that shows kraft until the scan arrives, then the scan itself.
// (A texture's size is fixed once uploaded, so the loaded image gets a texture of its own.)
function coverScan(file) {
  const mat = new THREE.MeshBasicMaterial({ color: KRAFT, transparent: true });
  new THREE.TextureLoader().load(COVER + file, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; // true kraft colour
    t.anisotropy = 8;
    mat.map = t;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  });
  return mat;
}

// The spine strip is narrow; centre it on a kraft-coloured face so its type keeps its shape.
function spineTexture(faceW, faceH) {
  const c = document.createElement('canvas');
  c.height = 1024;
  c.width = Math.max(8, Math.round((c.height * faceW) / faceH));
  const g = c.getContext('2d');
  g.fillStyle = KRAFT;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; // true kraft colour
  t.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const w = (img.width / img.height) * c.height;
    g.drawImage(img, (c.width - w) / 2, 0, w, c.height);
    t.needsUpdate = true;
  };
  img.src = COVER + 'spine.jpg';
  return t;
}

function edgeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#E6E0D4'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 256; i += 2) {
    x.fillStyle = `rgba(90,80,70,${0.05 + Math.random() * 0.12})`;
    x.fillRect(0, i, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Swarm — 9,221 ASCII glyphs that re-form for every section
// ---------------------------------------------------------------------------
class Swarm {
  constructor(glyphTex) {
    const g = new THREE.BufferGeometry();
    this.from = new Float32Array(N * 3);
    this.to = new Float32Array(N * 3);
    this.cfrom = new Float32Array(N * 3);
    this.cto = new Float32Array(N * 3);
    this.rand = new Float32Array(N * 4);
    const glyph = new Float32Array(N);
    const weights = [0.2, 0.17, 0.1, 0.12, 0.12, 0.1, 0.1, 0.09];
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 4; k++) this.rand[i * 4 + k] = Math.random();
      let r = Math.random(), gi = 0;
      while (gi < 7 && r > weights[gi]) { r -= weights[gi]; gi++; }
      glyph[i] = gi;
    }
    this.aFrom = new THREE.BufferAttribute(this.from, 3);
    this.aTo = new THREE.BufferAttribute(this.to, 3);
    this.aColFrom = new THREE.BufferAttribute(this.cfrom, 3);
    this.aColTo = new THREE.BufferAttribute(this.cto, 3);
    g.setAttribute('position', this.aTo);
    g.setAttribute('aFrom', this.aFrom);
    g.setAttribute('aTo', this.aTo);
    g.setAttribute('aColFrom', this.aColFrom);
    g.setAttribute('aColTo', this.aColTo);
    g.setAttribute('aRand', new THREE.BufferAttribute(this.rand, 4));
    g.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
    this.uniforms = {
      uMorph: { value: 1 }, uTime: { value: 0 }, uSize: { value: 0.2 }, uSizeMul: { value: 1 }, uScale: { value: 800 },
      uScatter: { value: 3 }, uGlyphs: { value: glyphTex }, uOpacity: { value: 0 },
      uFogNear: { value: 40 }, uFogFar: { value: 95 }, uWobble: { value: 0.035 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: swarmVert, fragmentShader: swarmFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.group = new THREE.Group();
    this.group.add(this.points);
    this.t = 1; this.dur = 2.2;
    this.name = null;
  }
  set(form, name) {
    this.from.set(form.pos); this.to.set(form.pos);
    this.cfrom.set(form.col); this.cto.set(form.col);
    [this.aFrom, this.aTo, this.aColFrom, this.aColTo].forEach((a) => (a.needsUpdate = true));
    this.uniforms.uMorph.value = 1; this.t = 1; this.name = name;
  }
  morphTo(form, name, dur = 2.4, scatterAmt = 3) {
    if (name && name === this.name) return;
    const m = this.uniforms.uMorph.value, sc = this.uniforms.uScatter.value;
    const { from, to, cfrom, cto, rand } = this;
    for (let i = 0; i < N; i++) {
      let k = Math.min(1, Math.max(0, (m - rand[i * 4] * 0.45) / 0.55));
      k = k * k * (3 - 2 * k);
      const s = Math.sin(k * Math.PI) * sc;
      for (let c = 0; c < 3; c++) {
        const j = i * 3 + c;
        from[j] = from[j] + (to[j] - from[j]) * k + (rand[i * 4 + 1 + c] - 0.5) * s;
        cfrom[j] = cfrom[j] + (cto[j] - cfrom[j]) * k;
      }
    }
    to.set(form.pos); cto.set(form.col);
    [this.aFrom, this.aTo, this.aColFrom, this.aColTo].forEach((a) => (a.needsUpdate = true));
    this.uniforms.uMorph.value = 0;
    this.uniforms.uScatter.value = scatterAmt;
    this.t = 0; this.dur = dur; this.name = name;
  }
  update(dt, time) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      this.uniforms.uMorph.value = this.t;
    }
    this.uniforms.uTime.value = time;
  }
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export class World extends EventTarget {
  constructor(canvas, { atlas, meta, layout, articles, sections, articleForPage, reducedMotion }) {
    super();
    this.canvas = canvas;
    this.meta = meta;
    this.layout = layout;
    this.articles = articles;
    this.sections = sections;
    this.articleForPage = articleForPage;
    this.reduced = reducedMotion;
    this.secColor = Object.fromEntries(sections.map((s) => [s.id, s.color]));

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x181614, 1);
    this.renderer = renderer;
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
    this.clock = new THREE.Clock();
    this.time = 0;

    this.atlas = atlas;
    atlas.colorSpace = THREE.NoColorSpace;
    atlas.anisotropy = this.maxAniso;
    atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;

    this.mode = 'hero';
    this.sCur = layout.start;
    this.sTarget = layout.start;
    this.lastInput = 0;
    this.inputEnabled = false;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.pointerNdc = new THREE.Vector2(-9, -9);
    this.hoverPage = null;
    this.mapAngle = 0.6;
    this.mapZoom = 1;
    this.theme = null;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.blend = null; // { fromPos, fromTarget, t, dur }
    this.zoneKey = '';
    this.pageNow = 1;
    this.dataMode = false;

    this.fog = { near: 34, far: 78 };
    this.bookPos = new THREE.Vector3(0, 7, 0);

    this.buildBackdrop();
    this.buildPages();
    this.buildBook();
    this.buildSwarm();
    this.buildDust();
    this.buildRings();
    this.buildAxes();

    this.raycaster = new THREE.Raycaster();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();

    // initial hero camera
    this.heroPose(this.camPos, this.camTarget);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // ------------------------------------------------------------------ backdrop
  buildBackdrop() {
    this.bgUniforms = { uTint: { value: new THREE.Vector3(0.93, 0.89, 0.83) }, uAspect: { value: 1 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.bgUniforms,
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint; uniform float uAspect; varying vec2 vUv;
        void main() {
          vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(uAspect, 1.0);
          float r = length(p);
          vec3 c = mix(vec3(0.132, 0.118, 0.106), vec3(0.052, 0.047, 0.043), smoothstep(0.0, 1.05, r));
          c += uTint * 0.018 * (1.0 - smoothstep(0.0, 0.9, r));
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthWrite: false, depthTest: false,
    }));
    m.frustumCulled = false;
    m.renderOrder = -10;
    this.scene.add(m);
  }
  setTint(hex) {
    const v = hexv(hex);
    this.tintTarget = v;
  }

  // ------------------------------------------------------------------ pages
  buildPages() {
    const { slots } = this.layout;
    const n = this.meta.pages;
    const geo = new THREE.PlaneGeometry(1, 1);
    const cell = new Float32Array(n * 2);
    this.dimArr = new Float32Array(n);
    this.liftArr = new Float32Array(n);
    this.dimTarget = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      cell[i * 2] = i % this.meta.cols;
      cell[i * 2 + 1] = Math.floor(i / this.meta.cols);
    }
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    this.aDim = new THREE.InstancedBufferAttribute(this.dimArr, 1);
    this.aLift = new THREE.InstancedBufferAttribute(this.liftArr, 1);
    this.aDim.setUsage(THREE.DynamicDrawUsage);
    this.aLift.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aDim', this.aDim);
    geo.setAttribute('aLift', this.aLift);
    const sArr = new Float32Array(n);
    for (let i = 0; i < n; i++) sArr[i] = slots[i + 1].s;
    geo.setAttribute('aS', new THREE.InstancedBufferAttribute(sArr, 1));

    this.pageUniforms = {
      uAtlas: { value: this.atlas }, uGrid: { value: new THREE.Vector2(this.meta.cols, this.meta.rows) },
      uBg: { value: BG }, uBack: { value: new THREE.Vector3(0.2, 0.19, 0.175) }, uGlobalDim: { value: 0 },
      uFogNear: { value: 34 }, uFogFar: { value: 78 }, uFocus: { value: 0 }, uFocusAmt: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.pageUniforms, vertexShader: pageVert, fragmentShader: pageFrag, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.pages = mesh;
    this.scene.add(mesh);

    // final (spiral) transforms
    this.finalPos = []; this.finalQuat = []; this.finalScale = []; this.normals = [];
    const q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1);
    for (let p = 1; p <= n; p++) {
      const sl = slots[p];
      const pos = helixPoint(sl.s);
      const nrm = normalAt(sl.s);
      const jitter = sl.kind === 'body' ? (Math.random() - 0.5) * 0.12 : 0;
      pos.addScaledVector(nrm, jitter);
      const quat = new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI / 2 - thetaAt(sl.s));
      if (sl.kind === 'body') quat.multiply(q.setFromAxisAngle(zAxis, (Math.random() - 0.5) * 0.035));
      this.finalPos.push(pos); this.finalQuat.push(quat); this.finalScale.push(new THREE.Vector3(sl.w, sl.h, 1)); this.normals.push(nrm);
    }

    // Sharp page images sit on top of the small atlas copies.
    // Openers, dividers, first and last page keep a medium (720px) image at all times;
    // any page close to the camera streams in the full 1200px scan and drops it again when far away.
    const hiPages = [1, n];
    this.articles.forEach((a) => hiPages.push(a.start));
    this.sections.forEach((s) => s.divider && hiPages.push(...s.divider));
    this.hi = new Map();
    this.texLoader = new THREE.TextureLoader();
    this.loadingCount = 0;
    for (const p of hiPages) {
      const e = this.overlay(p);
      this.loadTex(`assets/img/openers/p${String(p).padStart(3, '0')}.jpg`, (tex) => {
        e.low = tex;
        if (!e.high) e.uniforms.uMap.value = tex;
      });
    }

    // soft section-coloured halos behind openers & dividers
    this.glows = [];
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    for (const p of hiPages) {
      const sl = slots[p];
      if (sl.kind !== 'opener' && sl.kind !== 'gate') continue;
      const i = p - 1;
      const uniforms = {
        uColor: { value: hexv(this.secColor[sl.sec]) }, uOpacity: { value: 0 },
        uFogNear: this.pageUniforms.uFogNear, uFogFar: this.pageUniforms.uFogFar,
      };
      const g = new THREE.Mesh(glowGeo, new THREE.ShaderMaterial({
        uniforms, vertexShader: hiVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      g.position.copy(this.finalPos[i]).addScaledVector(this.normals[i], -0.5);
      g.quaternion.copy(this.finalQuat[i]);
      g.scale.set(sl.w * 2.3, sl.h * 1.7, 1);
      g.renderOrder = 0;
      g.visible = false;
      this.scene.add(g);
      this.glows.push({ mesh: g, uniforms, page: p });
    }
  }

  loadTex(url, done, fail) {
    this.texLoader.load(url, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = this.maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      done(tex);
    }, undefined, fail);
  }

  // the image layer that sits on a page; created on first need
  overlay(p) {
    let e = this.hi.get(p);
    if (e) return e;
    const i = p - 1;
    const uniforms = {
      uMap: { value: null }, uBg: { value: BG }, uOpacity: { value: 0 }, uDim: { value: 0 }, uLift: { value: 0 },
      uFogNear: this.pageUniforms.uFogNear, uFogFar: this.pageUniforms.uFogFar,
    };
    const m = new THREE.Mesh(this._overlayGeo || (this._overlayGeo = new THREE.PlaneGeometry(1, 1)), new THREE.ShaderMaterial({
      uniforms, vertexShader: hiVert, fragmentShader: hiFrag, transparent: true, depthWrite: true,
    }));
    m.position.copy(this.finalPos[i]).addScaledVector(this.normals[i], 0.012 + (this.liftArr[i] || 0) * 0.35);
    m.quaternion.copy(this.finalQuat[i]);
    m.scale.copy(this.finalScale[i]);
    m.visible = false;
    m.renderOrder = 1;
    this.scene.add(m);
    e = { mesh: m, uniforms, page: p, shown: 0, low: null, high: null, loading: false, wanted: false };
    this.hi.set(p, e);
    return e;
  }

  // stream full-resolution scans for the pages around the camera
  updateStreaming() {
    const { slots } = this.layout;
    const near = this.mode === 'journey' ? (this.view.mobile ? 5 : 9.5) : this.mode === 'data' ? 0 : -1;
    const far = 26;
    const want = [];
    for (let p = 1; p <= this.meta.pages; p++) {
      const d = Math.abs(slots[p].s - this.sCur);
      if (d < near) want.push([d, p]);
      else if (d > far) this.dropHigh(p);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, p] of want) {
      if (this.loadingCount >= 3) break;
      const e = this.overlay(p);
      e.wanted = true;
      if (e.high || e.loading) continue;
      e.loading = true;
      this.loadingCount++;
      this.loadTex(`assets/img/pages/p${String(p).padStart(3, '0')}.jpg`, (tex) => {
        this.loadingCount--;
        e.loading = false;
        if (!e.wanted) { tex.dispose(); return; }
        e.high = tex;
        e.uniforms.uMap.value = tex;
      }, () => { this.loadingCount--; e.loading = false; });
    }
  }

  dropHigh(p) {
    const e = this.hi.get(p);
    if (!e) return;
    e.wanted = false;
    if (!e.high) return;
    e.high.dispose();
    e.high = null;
    e.uniforms.uMap.value = e.low;
    if (!e.low) { e.shown = 0; e.mesh.visible = false; }
  }

  setPageMatrix(i, pos, quat, scale) {
    this._m = this._m || new THREE.Matrix4();
    this._m.compose(pos, quat, scale);
    this.pages.setMatrixAt(i, this._m);
  }

  // ------------------------------------------------------------------ book
  buildBook() {
    const W = 1.86, H = 2.46, T = 0.5;
    this.bookSize = { w: 1.8, h: 2.4, t: T };
    const book = new THREE.Group();
    book.position.copy(this.bookPos);
    const dark = new THREE.MeshBasicMaterial({ color: 0x2a2624, transparent: true });
    const coverMat = coverScan('front.jpg');
    const backMat = coverScan('back.jpg');
    const spineMat = new THREE.MeshBasicMaterial({ map: spineTexture(T + 0.08, H), transparent: true });
    const inside = new THREE.MeshBasicMaterial({ color: 0xd9d2c4, transparent: true });
    const coverGeo = new THREE.BoxGeometry(W, H, 0.035);
    coverGeo.translate(W / 2, 0, 0);
    const front = new THREE.Mesh(coverGeo, [dark, dark, dark, dark, coverMat, inside]);
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, T / 2 + 0.02);
    hinge.add(front);
    const back = new THREE.Mesh(coverGeo, [dark, dark, dark, dark, inside, backMat]);
    const hingeB = new THREE.Group();
    hingeB.position.set(-W / 2, 0, -T / 2 - 0.02);
    hingeB.add(back);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, T + 0.08), [dark, spineMat, dark, dark, dark, dark]);
    spine.position.set(-W / 2 - 0.01, 0, 0);
    const edgeMat = new THREE.MeshBasicMaterial({ map: edgeTexture(), transparent: true });
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.76, 2.36, T * 0.96), [edgeMat, dark, edgeMat, edgeMat, dark, dark]);
    this.bookBlock = block;
    book.add(hinge, hingeB, spine, block);
    this.book = book;
    this.bookHinge = hinge;
    this.bookMats = [dark, coverMat, backMat, spineMat, inside, edgeMat];
    this.scene.add(book);

    // pages start stacked inside the book
    this.stackPos = []; this.stackQuat = []; this.stackScale = new THREE.Vector3(1.78, 2.38, 1);
    this.updateStack();
  }

  updateStack() {
    const n = this.meta.pages;
    this.book.updateMatrixWorld(true);
    const bq = new THREE.Quaternion();
    this.book.getWorldQuaternion(bq);
    for (let i = 0; i < n; i++) {
      const local = new THREE.Vector3(0, 0, this.bookSize.t / 2 - 0.004 - (i / (n - 1)) * (this.bookSize.t - 0.01));
      this.stackPos[i] = local.applyMatrix4(this.book.matrixWorld);
      this.stackQuat[i] = bq.clone();
      if (this.mode === 'hero') this.setPageMatrix(i, this.stackPos[i], this.stackQuat[i], this.stackScale);
    }
    this.pages.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ swarm
  buildSwarm() {
    this.swarm = new Swarm(glyphTexture());
    this.forms = {};
    const S = this.sections;
    const col = (id) => S.find((s) => s.id === id).color;
    this.formMakers = {
      sphere: () => sphere('#C5D96B'),
      intro: () => orbits(col('intro')),
      people: () => fingerprint(col('people')),
      model: () => sunflower(col('model')),
      ai: () => voxels(col('ai')),
      scatter: () => scatter(this.scatterSize || 9),
      nebula: () => nebula(Math.abs(yAt(this.layout.length)) + 16, R),
    };
    this.swarm.set(this.form('sphere'), 'sphere');
    this.swarm.group.position.copy(this.bookPos);
    this.scene.add(this.swarm.group);
    this.swarmY = this.bookPos.y;
    this.swarmSpin = 0;
  }
  form(name) {
    if (!this.forms[name]) this.forms[name] = this.formMakers[name]();
    return this.forms[name];
  }

  buildDust() {
    const count = 1800, pos = new Float32Array(count * 3), seed = new Float32Array(count);
    const bottom = yAt(this.layout.length) - 20;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, r = 4 + Math.pow(Math.random(), 0.6) * 60;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = bottom + Math.random() * (Math.abs(bottom) + 34);
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustUniforms = { uTime: { value: 0 }, uScale: { value: 800 } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.dustUniforms, vertexShader: dustVert, fragmentShader: dustFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildRings() {
    this.rings = [];
    const starts = [{ id: 'intro', s: this.layout.slots[6].s - 3 }];
    this.layout.anchors.filter((a) => a.type === 'gate').forEach((a) => starts.push({ id: a.section, s: a.s }));
    for (const st of starts) {
      const pts = [];
      for (let i = 0; i <= 256; i++) {
        const a = (i / 256) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * (R + 3.6), 0, Math.sin(a) * (R + 3.6)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const c = hexv(this.secColor[st.id]);
      const mat = new THREE.LineDashedMaterial({ color: new THREE.Color(c.x, c.y, c.z), dashSize: 0.5, gapSize: 0.7, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      line.position.y = yAt(st.s) - 3.3;
      this.scene.add(line);
      this.rings.push({ line, mat, id: st.id, s: st.s });
    }
  }

  buildAxes() {
    // axes for the People Model validation view (drawn in swarm space)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2 * 16), 3));
    this.axesMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.93, 0.89, 0.83), transparent: true, opacity: 0, depthTest: false });
    this.axes = new THREE.LineSegments(g, this.axesMat);
    this.axes.frustumCulled = false;
    this.axes.renderOrder = 3;
    this.swarm.group.add(this.axes);
    this.diagMat = new THREE.LineDashedMaterial({ color: new THREE.Color(0.77, 0.85, 0.42), dashSize: 0.15, gapSize: 0.12, transparent: true, opacity: 0, depthTest: false });
    this.diag = new THREE.Line(new THREE.BufferGeometry(), this.diagMat);
    this.diag.renderOrder = 3;
    this.swarm.group.add(this.diag);
  }
  layoutAxes(size) {
    const h = size / 2, t = size * 0.018;
    const v = [];
    const seg = (a, b, c, d) => v.push(a, b, 0, c, d, 0);
    seg(-h, -h, h, -h); seg(-h, -h, -h, h);
    for (let k = 0; k <= 5; k++) {
      const x = -h + (k / 5) * size;
      seg(x, -h, x, -h - t); seg(-h, x, -h - t, x);
    }
    const arr = this.axes.geometry.attributes.position.array;
    arr.fill(0); arr.set(v);
    this.axes.geometry.attributes.position.needsUpdate = true;
    this.axes.geometry.setDrawRange(0, v.length / 3);
    this.diag.geometry.setFromPoints([new THREE.Vector3(-h, -h, 0), new THREE.Vector3(h, h, 0)]);
    this.diag.computeLineDistances();
  }

  // ------------------------------------------------------------------ view
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.bgUniforms.uAspect.value = w / h;
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const a = w / h, mobile = a < 0.95;
    const ow = SIZES.opener * ASPECT, gw = SIZES.gate * ASPECT * 2;
    const v = { mobile, a, tanH };
    if (!mobile) {
      v.D = Math.max(SIZES.opener / (0.7 * 2 * tanH), ow / (0.36 * 2 * tanH * a));
      v.lat = 0.43 * v.D * tanH * a; v.h = 0;
      v.Dg = Math.max(SIZES.gate / (0.72 * 2 * tanH), gw / (0.58 * 2 * tanH * a));
      v.latg = -0.3 * v.Dg * tanH * a; v.hg = 0;
    } else {
      v.D = ow / (0.8 * 2 * tanH * a);
      v.lat = 0; v.h = -0.3 * v.D * tanH;
      v.Dg = gw / (0.94 * 2 * tanH * a);
      v.latg = 0; v.hg = -0.36 * v.Dg * tanH;
    }
    this.view = v;
    const scale = (h * this.renderer.getPixelRatio()) / (2 * tanH);
    this.swarm.uniforms.uScale.value = scale;
    this.dustUniforms.uScale.value = scale;
    this.scatterSize = mobile ? 7 : 9;
    this.swarm.uniforms.uSizeMul.value = mobile ? 0.62 : 1;
    if (this.forms.scatter) { delete this.forms.scatter; }
    this.layoutAxes(this.scatterSize);
  }

  heroPose(pos, target) {
    const b = this.bookPos, v = this.view;
    if (v.mobile) {
      const d = 13.5;
      pos.set(b.x, b.y - 2.1, b.z + d);
      target.set(b.x, b.y - 2.1, b.z);
    } else {
      const off = v.a > 1.5 ? -0.4 : 0;
      pos.set(b.x + off, b.y + 0.1, b.z + 11.5);
      target.set(b.x + off, b.y, b.z);
    }
  }

  journeyPose(s, pos, target) {
    const v = this.view;
    const P = helixPoint(s, this._P || (this._P = new THREE.Vector3()));
    const Nn = normalAt(s, this._N || (this._N = new THREE.Vector3()));
    const Rt = rightAt(s, this._Rt || (this._Rt = new THREE.Vector3()));
    // blend towards divider framing when near a section gate
    let wg = 0;
    for (const a of this.layout.anchors) if (a.type === 'gate') wg = Math.max(wg, 1 - smooth(2.2, 7.5, Math.abs(s - a.s)));
    const D = v.D + (v.Dg - v.D) * wg;
    const lat = v.lat + (v.latg - v.lat) * wg;
    const h = v.h + (v.hg - v.h) * wg;
    const px = this.pointerSmooth.x, py = this.pointerSmooth.y;
    pos.copy(P).addScaledVector(Nn, D).addScaledVector(Rt, lat + px * 0.45).y += h + py * 0.3;
    target.copy(P).addScaledVector(Rt, lat * 0.92 + px * 0.15);
    target.y += h * 0.92 + py * 0.1;
  }

  mapPose(pos, target) {
    const bottom = yAt(this.layout.length);
    const mid = bottom / 2;
    const v = this.view;
    const height = Math.abs(bottom) + 12;
    const fit = Math.max(height / (0.74 * 2 * v.tanH), ((R + 6) * 2) / (0.9 * 2 * v.tanH * v.a));
    const d = fit * this.mapZoom;
    const a = this.mapAngle;
    pos.set(Math.sin(a) * d, mid + d * 0.3, Math.cos(a) * d);
    target.set(0, mid - fit * 0.1 * v.tanH * 2.2, 0);
  }

  dataPose(pos, target) {
    const s = this.sCur, v = this.view;
    const Nn = normalAt(s, new THREE.Vector3());
    const size = this.scatterSize;
    const d = Math.max(size / (0.62 * 2 * v.tanH), size / (0.82 * 2 * v.tanH * v.a));
    const k = R - 1.2 - d;
    const C = new THREE.Vector3(0, yAt(s), 0).addScaledVector(Nn, k);
    this.dataCenter = C;
    const shift = v.mobile ? 0 : size * 0.36;
    const Rt = rightAt(s, new THREE.Vector3());
    pos.copy(C).addScaledVector(Nn, d).addScaledVector(Rt, shift);
    target.copy(C).addScaledVector(Rt, shift);
    if (v.mobile) { pos.y -= size * 0.62; target.y -= size * 0.62; }
    pos.x += this.pointerSmooth.x * 0.4; pos.y += this.pointerSmooth.y * 0.3;
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const el = this.canvas;
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / this.w) * 2 - 1, -(e.clientY / this.h) * 2 + 1);
      this.pointerNdc.copy(this.pointer);
      if (this.drag && this.mode === 'map') {
        this.mapAngle -= (e.clientX - this.drag.x) * 0.005;
        this.drag.moved += Math.abs(e.clientX - this.drag.x) + Math.abs(e.clientY - this.drag.y);
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      } else if (this.drag && this.mode === 'journey' && this.drag.touch) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        const delta = (Math.abs(dx) > Math.abs(dy) ? -dx : -dy) * 0.045;
        this.nudge(delta);
        this.drag.vel = delta;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      }
    });
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, touch: e.pointerType !== 'mouse', vel: 0 };
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.moved < 8) this.click(e);
      else if (d.touch && this.mode === 'journey') this.nudge(d.vel * 6);
    });
    window.addEventListener('wheel', (e) => {
      if (e.target.closest && e.target.closest('#digest, #index, #reader')) return;
      e.preventDefault();
      if (!this.inputEnabled) return;
      if (this.mode === 'map') {
        this.mapZoom = THREE.MathUtils.clamp(this.mapZoom * (1 + e.deltaY * 0.0008), 0.55, 1.5);
        return;
      }
      if (this.mode !== 'journey') return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.nudge((e.deltaY + e.deltaX) * unit * 0.014);
    }, { passive: false });
  }

  nudge(ds) {
    if (!this.inputEnabled || this.mode !== 'journey') return;
    this.sTarget = THREE.MathUtils.clamp(this.sTarget + ds, this.layout.start, this.layout.end);
    this.lastInput = this.time;
    this.snapped = false;
  }

  click() {
    if (!this.inputEnabled) return;
    const p = this.pick();
    if (p) this.emit('pick', { page: p, mode: this.mode });
  }

  pick() {
    if (this.mode === 'hero' || this.mode === 'unfold') return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.pages, false);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.face && h.face.normal) {
      // ignore clicks on the back of pages
      const nrm = this.normals[h.instanceId];
      const toCam = this.camera.position.clone().sub(h.point);
      if (nrm.dot(toCam) < 0) return null;
    }
    return h.instanceId + 1;
  }

  // ------------------------------------------------------------------ navigation API
  anchorIndexNear(s) {
    let best = 0, bd = 1e9;
    this.layout.anchors.forEach((a, i) => { const d = Math.abs(a.s - s); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  goToS(s, instant = false) {
    this.sTarget = THREE.MathUtils.clamp(s, this.layout.start, this.layout.end);
    if (instant) this.sCur = this.sTarget;
    this.lastInput = this.time;
    this.snapped = true;
  }
  goToAnchor(i) { const a = this.layout.anchors[i]; if (a) this.goToS(a.s); }
  goToArticle(no) { const a = this.layout.anchors.find((x) => x.article === no); if (a) this.goToS(a.s); }
  goToPage(p) {
    const art = this.articleForPage(p);
    const sl = this.layout.slots[p];
    this.goToS(sl ? sl.s : this.layout.start);
    return art;
  }
  step(dir) {
    const { anchors } = this.layout;
    const s = this.sTarget;
    if (dir > 0) { const a = anchors.find((x) => x.s > s + 0.5); if (a) this.goToS(a.s); }
    else { const a = [...anchors].reverse().find((x) => x.s < s - 0.5); if (a) this.goToS(a.s); }
  }
  progress() { return (this.sCur - this.layout.start) / (this.layout.end - this.layout.start); }
  scrubTo(f) { this.goToS(this.layout.start + f * (this.layout.end - this.layout.start)); this.snapped = false; this.lastInput = this.time; }

  setMode(mode) {
    if (mode === this.mode) return;
    const prev = this.mode;
    this.blend = { fromPos: this.camera.position.clone(), fromTarget: this.camTarget.clone(), t: 0, dur: mode === 'data' || prev === 'data' ? 1.8 : 2.0, lift: prev === 'map' || mode === 'map' ? 0 : 1 };
    this.mode = mode;
    if (mode === 'map') {
      this.swarm.morphTo(this.form('nebula'), 'nebula', 2.6, 6);
      this.mapAngle = thetaAt(this.sCur) + Math.PI / 2 + 0.4;
      this.mapZoom = 1;
    }
    if (mode === 'data') {
      this.swarm.morphTo(this.form('scatter'), 'scatter', 2.4, 4);
    }
    if (prev === 'data' || prev === 'map') this.currentSectionForm = null;
    this.emit('mode', { mode, prev });
  }

  setTheme(theme) {
    this.theme = theme;
    const n = this.meta.pages;
    if (this.thread) { this.scene.remove(this.thread.mesh); this.thread.mesh.geometry.dispose(); this.thread = null; }
    if (!theme) { this.dimTarget.fill(0); return; }
    const set = new Set(theme.articles);
    for (let p = 1; p <= n; p++) {
      const a = this.articleForPage(p);
      this.dimTarget[p - 1] = a && set.has(a.no) ? 0 : 1;
    }
    // a thread through the heart of the spiral, stitching the articles together
    const pts = [];
    const opens = theme.articles.map((no) => {
      const a = this.articles.find((x) => x.no === no);
      return helixPoint(this.layout.slots[a.start].s).addScaledVector(normalAt(this.layout.slots[a.start].s), 0.6);
    });
    opens.forEach((p, i) => {
      pts.push(p);
      if (i < opens.length - 1) {
        const m = p.clone().lerp(opens[i + 1], 0.5);
        m.x *= 0.32; m.z *= 0.32;
        pts.push(m);
      }
    });
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, pts.length * 40, 0.075, 6, false);
    const c = hexv(theme.color || '#ECE4D4');
    const uniforms = { uColor: { value: c }, uTime: { value: 0 }, uOpacity: { value: 1 }, uReveal: { value: 0 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: threadVert, fragmentShader: threadFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.thread = { mesh, uniforms };
  }

  // screen position of a page (for HTML labels)
  projectPage(p, lift = 0) {
    const i = p - 1;
    const v = this.finalPos[i].clone();
    v.y += this.finalScale[i].y / 2 + lift;
    return this.project(v);
  }
  project(v) {
    const c = v.clone().project(this.camera);
    return { x: (c.x * 0.5 + 0.5) * this.w, y: (-c.y * 0.5 + 0.5) * this.h, visible: c.z < 1 && c.z > -1 };
  }
  projectScatter(x, y) {
    const v = new THREE.Vector3(x, y, 0);
    this.swarm.group.updateMatrixWorld();
    v.applyMatrix4(this.swarm.group.matrixWorld);
    return this.project(v);
  }

  // ------------------------------------------------------------------ intro
  unfold() {
    if (this.mode !== 'hero') return;
    this.mode = 'unfold';
    this.unfoldT = 0;
    this.unfoldDur = this.reduced ? 0.01 : 6.2;
    this.flyRand = Array.from({ length: this.meta.pages }, () => [Math.random(), Math.random(), Math.random()]);
    this.bookStart = { rotY: this.book.rotation.y, rotX: this.book.rotation.x };
    this.camStart = { pos: this.camera.position.clone(), target: this.camTarget.clone() };
    const jp = new THREE.Vector3(), jt = new THREE.Vector3();
    this.journeyPose(this.layout.start, jp, jt);
    const b = this.bookPos;
    this.camCurve = new THREE.CatmullRomCurve3([
      this.camStart.pos.clone(),
      new THREE.Vector3(b.x + 3, b.y + 3, b.z + 22),
      new THREE.Vector3(34, b.y + 6, 44),
      new THREE.Vector3(jp.x + 14, jp.y + 5, jp.z + 16),
      jp.clone(),
    ], false, 'centripetal');
    this.tgtCurve = new THREE.CatmullRomCurve3([
      this.camStart.target.clone(), b.clone(), new THREE.Vector3(0, -8, 0), new THREE.Vector3(jt.x * 0.6, jt.y - 2, jt.z * 0.6), jt.clone(),
    ], false, 'centripetal');
    this.swarm.morphTo(this.form('intro'), 'intro', 4.2, 9);
    this.emit('unfold-start');
  }

  updateUnfold(dt) {
    this.unfoldT = Math.min(1, this.unfoldT + dt / this.unfoldDur);
    const t = this.unfoldT;
    const n = this.meta.pages;
    // book squares up to the camera and opens its cover
    const settle = easeInOut(clamp01(t / 0.12));
    this.book.rotation.y = this.bookStart.rotY * (1 - settle);
    this.book.rotation.x = this.bookStart.rotX * (1 - settle);
    this.bookHinge.rotation.y = -easeInOut(clamp01((t - 0.05) / 0.14)) * 2.6;
    if (t < 0.16) this.updateStack();
    // pages fly out to the spiral
    const m = this._um || (this._um = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Vector3(), f: new THREE.Quaternion(), e: new THREE.Euler() });
    let remaining = 0;
    for (let i = 0; i < n; i++) {
      const d = 0.14 + (i / (n - 1)) * 0.5;
      const k = clamp01((t - d) / 0.26);
      if (k <= 0) { remaining++; this.setPageMatrix(i, this.stackPos[i], this.stackQuat[i], this.stackScale); continue; }
      const e = easeInOut(k);
      const S = this.stackPos[i], E = this.finalPos[i], r = this.flyRand[i];
      m.c.copy(S).lerp(E, 0.5).addScaledVector(this.normals[i], 6 + r[0] * 5);
      m.c.y += 3 + r[1] * 4;
      // quadratic bezier
      const a = (1 - e) * (1 - e), b2 = 2 * (1 - e) * e, c2 = e * e;
      m.p.set(S.x * a + m.c.x * b2 + E.x * c2, S.y * a + m.c.y * b2 + E.y * c2, S.z * a + m.c.z * b2 + E.z * c2);
      m.q.copy(this.stackQuat[i]).slerp(this.finalQuat[i], e);
      const fl = Math.sin(e * Math.PI);
      m.f.setFromEuler(m.e.set(fl * (0.8 + r[2]) , fl * (r[0] - 0.5) * 1.4, fl * (r[1] - 0.5) * 0.9));
      m.q.multiply(m.f);
      m.s.copy(this.stackScale).lerp(this.finalScale[i], e);
      this.setPageMatrix(i, m.p, m.q, m.s);
    }
    this.pages.instanceMatrix.needsUpdate = true;
    this.bookBlock.scale.z = Math.max(0.02, remaining / n);
    this.bookBlock.position.z = -(1 - remaining / n) * this.bookSize.t * 0.45;
    const fade = 1 - smooth(0.62, 0.8, t);
    this.bookMats.forEach((mm) => (mm.opacity = fade));
    this.book.visible = fade > 0.01;
    // swarm drifts from the book to the spiral's heart
    const sw = easeInOut(clamp01((t - 0.2) / 0.7));
    this.swarm.group.position.set(0, this.bookPos.y + (yAt(this.layout.start) - this.bookPos.y) * sw, 0);
    // camera flight
    const ct = easeInOut(clamp01((t - 0.04) / 0.96));
    this.camCurve.getPoint(ct, this.camPos);
    this.tgtCurve.getPoint(ct, this.camTarget);
    if (t >= 1) {
      this.mode = 'journey';
      this.sCur = this.sTarget = this.layout.start;
      this.book.visible = false;
      this.pages.boundingSphere = null;
      this.pages.computeBoundingSphere();
      this.emit('unfold-end');
    }
  }

  // ------------------------------------------------------------------ frame
  loop() {
    requestAnimationFrame(this.loop);
    this.tick(Math.min(0.05, this.clock.getDelta()));
  }

  // advance time by hand (used for testing when the tab is in the background)
  fastForward(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) this.tick(step);
  }

  tick(dt) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));

    // --- navigation physics
    if (this.mode === 'journey' || this.mode === 'data') {
      if (!this.snapped && this.time - this.lastInput > 0.25 && this.mode === 'journey') {
        const a = this.layout.anchors[this.anchorIndexNear(this.sTarget)];
        if (Math.abs(a.s - this.sTarget) < 4.5) this.sTarget = a.s;
        this.snapped = true;
      }
      this.sCur += (this.sTarget - this.sCur) * (1 - Math.exp(-dt * (this.reduced ? 12 : 3.6)));
    }

    // --- camera pose by mode
    const pos = this._pos || (this._pos = new THREE.Vector3());
    const tgt = this._tgt || (this._tgt = new THREE.Vector3());
    if (this.mode === 'hero') {
      this.heroPose(pos, tgt);
      pos.x += this.pointerSmooth.x * 0.6; pos.y += this.pointerSmooth.y * 0.4;
      this.book.rotation.y = -0.38 + Math.sin(this.time * 0.35) * 0.12 + this.pointerSmooth.x * 0.2;
      this.book.rotation.x = 0.06 + Math.sin(this.time * 0.27) * 0.04 - this.pointerSmooth.y * 0.12;
      this.book.position.y = this.bookPos.y + Math.sin(this.time * 0.8) * 0.06;
      this.updateStack();
      this.camPos.copy(pos); this.camTarget.copy(tgt);
    } else if (this.mode === 'unfold') {
      this.updateUnfold(dt);
    } else {
      if (this.mode === 'journey') this.journeyPose(this.sCur, pos, tgt);
      else if (this.mode === 'map') { if (!this.drag) this.mapAngle += dt * 0.035; this.mapPose(pos, tgt); }
      else if (this.mode === 'data') this.dataPose(pos, tgt);
      if (this.blend) {
        this.blend.t = Math.min(1, this.blend.t + dt / this.blend.dur);
        const e = easeInOut(this.blend.t);
        this.camPos.copy(this.blend.fromPos).lerp(pos, e);
        this.camPos.y += Math.sin(e * Math.PI) * 3 * this.blend.lift;
        this.camTarget.copy(this.blend.fromTarget).lerp(tgt, e);
        if (this.blend.t >= 1) this.blend = null;
      } else {
        this.camPos.copy(pos); this.camTarget.copy(tgt);
      }
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // --- fog by mode
    const mapW = this.mode === 'map' ? 1 : 0;
    this.fogMix = (this.fogMix ?? 0) + (mapW - (this.fogMix ?? 0)) * k;
    this.pageUniforms.uFogNear.value = 34 + this.fogMix * 40;
    this.pageUniforms.uFogFar.value = 78 + this.fogMix * 90;
    this.swarm.uniforms.uFogNear.value = 40 + this.fogMix * 40;
    this.swarm.uniforms.uFogFar.value = 95 + this.fogMix * 90;

    const post = this.mode !== 'hero' && this.mode !== 'unfold';
    if (post) this.updateJourneyState(dt, k);
    this.updateSwarm(dt, k);
    this.dustUniforms.uTime.value = this.time;
    if (this.tintTarget) this.bgUniforms.uTint.value.lerp(this.tintTarget, 1 - Math.exp(-dt * 1.5));
    if (this.thread) {
      this.thread.uniforms.uTime.value = this.time;
      this.thread.uniforms.uReveal.value = Math.min(1, this.thread.uniforms.uReveal.value + dt * 0.6);
    }
    this.renderer.render(this.scene, this.camera);
    this.emit('frame');
  }

  updateJourneyState(dt, k) {
    const n = this.meta.pages;
    const { slots } = this.layout;
    // current page & zone
    let best = 1, bd = 1e9;
    for (let p = 1; p <= n; p++) { const d = Math.abs(slots[p].s - this.sCur); if (d < bd) { bd = d; best = p; } }
    if (best !== this.pageNow) { this.pageNow = best; this.emit('page', { page: best }); }
    const z = this.zoneAt(this.sCur);
    const key = z.type + (z.article || z.section || '');
    if (key !== this.zoneKey) { this.zoneKey = key; this.emit('zone', z); }
    this.emit('progress', { f: this.progress(), s: this.sCur });

    // hover
    const hov = this.inputEnabled && !this.drag && this.mode !== 'data' ? this.pick() : null;
    if (hov !== this.hoverPage) { this.hoverPage = hov; this.emit('hover', { page: hov }); }

    // dim & lift
    const dataDim = this.mode === 'data' ? 1 : 0;
    this.pageUniforms.uGlobalDim.value += (dataDim * 0.9 - this.pageUniforms.uGlobalDim.value) * k;
    const pu = this.pageUniforms;
    pu.uFocus.value = this.sCur;
    pu.uFocusAmt.value += ((this.mode === 'journey' ? 1 : 0) - pu.uFocusAmt.value) * k;
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const dt0 = this.dimTarget[i];
      if (Math.abs(this.dimArr[i] - dt0) > 0.002) { this.dimArr[i] += (dt0 - this.dimArr[i]) * k; dirty = true; }
      const lt = this.hoverPage === i + 1 ? 1 : 0;
      if (Math.abs(this.liftArr[i] - lt) > 0.002) {
        this.liftArr[i] += (lt - this.liftArr[i]) * (1 - Math.exp(-dt * 10));
        const p = this._lp || (this._lp = new THREE.Vector3());
        p.copy(this.finalPos[i]).addScaledVector(this.normals[i], this.liftArr[i] * 0.35);
        this.setPageMatrix(i, p, this.finalQuat[i], this.finalScale[i]);
        this.pages.instanceMatrix.needsUpdate = true;
        const hi = this.hi.get(i + 1);
        if (hi) hi.mesh.position.copy(p).addScaledVector(this.normals[i], 0.012);
        dirty = true;
      }
    }
    if (dirty) { this.aDim.needsUpdate = true; this.aLift.needsUpdate = true; }

    // sharp page images fade in over the small copies once loaded
    this.updateStreaming();
    for (const e of this.hi.values()) {
      if (!e.uniforms.uMap.value) continue;
      e.mesh.visible = true;
      e.shown = Math.min(1, e.shown + dt * 2.5);
      const i = e.page - 1;
      e.uniforms.uOpacity.value = e.shown;
      const fd = smooth(2.1, 5.2, Math.abs(slots[e.page].s - this.sCur)) * 0.82 * pu.uFocusAmt.value;
      e.uniforms.uDim.value = Math.max(this.dimArr[i], pu.uGlobalDim.value, fd);
      e.uniforms.uLift.value = this.liftArr[i];
    }
    const focus = this.mode === 'journey' ? 1 : this.mode === 'map' ? 0.55 : 0.15;
    for (const g of this.glows) {
      g.mesh.visible = true;
      const i = g.page - 1;
      const near = 1 - smooth(4, 26, Math.abs(slots[g.page].s - this.sCur));
      const target = (0.1 + near * 0.28) * focus * (1 - this.dimArr[i]);
      g.uniforms.uOpacity.value += (target - g.uniforms.uOpacity.value) * k;
    }
    for (const r of this.rings) {
      const target = this.mode === 'map' ? 0.55 : 0.22 * (1 - smooth(6, 30, Math.abs(r.s - this.sCur)));
      r.mat.opacity += (target - r.mat.opacity) * k;
    }
    const ax = this.mode === 'data' && this.swarm.t > 0.6 ? 0.55 : 0;
    this.axesMat.opacity += (ax - this.axesMat.opacity) * k;
    this.diagMat.opacity += (ax * 1.2 - this.diagMat.opacity) * k;
  }

  zoneAt(s) {
    const zs = this.layout.zones;
    let best = null, bd = 1e9;
    for (const z of zs) {
      if (s >= z.a && s <= z.b) { const d = 0; if (d < bd || (z.type === 'gate')) { bd = d; best = z; } }
    }
    if (best) return best;
    for (const z of zs) { const d = Math.min(Math.abs(s - z.a), Math.abs(s - z.b)); if (d < bd) { bd = d; best = z; } }
    return best;
  }

  sectionAt(s) {
    const z = this.zoneAt(s);
    if (z.type === 'gate') return z.section;
    if (z.type === 'article') return this.articles.find((a) => a.no === z.article).section;
    if (z.type === 'end') return 'ai';
    return 'intro';
  }

  updateSwarm(dt, k) {
    const sw = this.swarm;
    sw.update(dt, this.time);
    const on = this.mode === 'hero' ? 1 : this.mode === 'unfold' ? 1 : 1;
    sw.uniforms.uOpacity.value += (on * (this.mode === 'map' ? 0.7 : 0.95) - sw.uniforms.uOpacity.value) * (1 - Math.exp(-dt * 1.2));
    if (this.mode === 'hero') {
      sw.group.position.copy(this.book.position);
      sw.group.rotation.y += dt * 0.08;
      sw.group.rotation.x = this.pointerSmooth.y * 0.2;
      sw.uniforms.uSize.value = 0.13;
      return;
    }
    if (this.mode === 'unfold') { sw.group.rotation.y += dt * 0.12; sw.uniforms.uSize.value += (0.2 - sw.uniforms.uSize.value) * k; return; }
    if (this.mode === 'journey') {
      const sec = this.sectionAt(this.sCur);
      if (sec !== this.currentSectionForm) {
        this.currentSectionForm = sec;
        sw.morphTo(this.form(sec), sec, 2.6, 5);
        this.emit('section', { section: sec });
      }
      const y = yAt(this.sCur);
      sw.group.position.x += (0 - sw.group.position.x) * k;
      sw.group.position.z += (0 - sw.group.position.z) * k;
      sw.group.position.y += (y - sw.group.position.y) * k;
      const face = Math.PI / 2 - thetaAt(this.sCur);
      this.swarmSpin += dt * 0.05;
      const flat = sec === 'people' || sec === 'model';
      const ry = face + (flat ? Math.sin(this.time * 0.18) * 0.35 : this.swarmSpin * 2.2);
      sw.group.rotation.y = lerpAngle(sw.group.rotation.y, ry, k);
      sw.group.rotation.x += ((flat ? Math.sin(this.time * 0.13) * 0.12 : 0.1) - sw.group.rotation.x) * k;
      sw.group.rotation.z += (0 - sw.group.rotation.z) * k;
      sw.uniforms.uSize.value += (0.21 - sw.uniforms.uSize.value) * k;
      sw.uniforms.uWobble.value = 0.035;
    } else if (this.mode === 'map') {
      const mid = yAt(this.layout.length) / 2;
      sw.group.position.lerp(new THREE.Vector3(0, mid, 0), k);
      sw.group.rotation.y += dt * 0.02;
      sw.group.rotation.x += (0 - sw.group.rotation.x) * k;
      sw.uniforms.uSize.value += (0.26 - sw.uniforms.uSize.value) * k;
    } else if (this.mode === 'data') {
      if (this.dataCenter) sw.group.position.lerp(this.dataCenter, k);
      const face = Math.PI / 2 - thetaAt(this.sCur);
      sw.group.rotation.y = lerpAngle(sw.group.rotation.y, face, k);
      sw.group.rotation.x += (0 - sw.group.rotation.x) * k;
      sw.group.rotation.z += (0 - sw.group.rotation.z) * k;
      sw.uniforms.uSize.value += (0.075 - sw.uniforms.uSize.value) * k;
      sw.uniforms.uWobble.value = 0.006;
    }
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
