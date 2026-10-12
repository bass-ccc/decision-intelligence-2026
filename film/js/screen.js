// The film screen: every video and still is drawn through one shader, so the page can bend it live.
//  - the "AI lens": a circle under the cursor where the film turns into ASCII
//  - full-screen ASCII (hold Space, and during transitions)
//  - shatter: the frame breaks into glyph particles that blow away while the next film resolves underneath
//  - floating glyph dust, grain, vignette, a soft chromatic edge
import * as THREE from 'three';
import { glyphAtlas } from './glyphs.js';

const VIDEO_ASPECT = 16 / 9;

const GLSL_COMMON = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec3 sampleFit(sampler2D t, vec4 fit, vec2 p) {
    vec2 q = p * fit.xy + fit.zw;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec3(0.0);
    return texture2D(t, vec2(q.x, 1.0 - q.y)).rgb;
  }
  // The same colour rule for the ASCII shader and the particles, so a shatter starts seamlessly.
  float glyphIndex(vec3 c, float n) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return floor(clamp(pow(l, 0.72) * 1.25, 0.0, 0.999) * n);
  }
  vec3 glyphColour(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 hue = c / max(max(c.r, max(c.g, c.b)), 0.05);
    return mix(c * 1.6, hue * (0.3 + l * 1.2), 0.4) + 0.03;
  }
`;

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const QUAD_FRAG = /* glsl */ `
  uniform sampler2D uTex, uGlyph;
  uniform vec4 uFit;
  uniform vec2 uRes, uMouse;
  uniform float uGlyphN, uCell, uTime, uAscii, uFade, uDim, uLens, uLensR, uCodeBand;
  uniform vec3 uTint, uGlowCol;
  uniform vec3 uGlow; // xy = screen uv (top-down), z = strength
  varying vec2 vUv;
  ${GLSL_COMMON}

  vec3 frame(vec2 p) {
    vec2 d = p - 0.5;
    vec2 off = d * 0.0035 * length(d);
    return vec3(sampleFit(uTex, uFit, p + off).r, sampleFit(uTex, uFit, p).g, sampleFit(uTex, uFit, p - off).b);
  }

  // minG > 0 (inside the lens): even black cells get a faint dot, so the grid of code is always visible
  vec3 ascii(vec2 px, float minG) {
    vec2 cell = floor(px / uCell);
    vec3 c = sampleFit(uTex, uFit, (cell + 0.5) * uCell / uRes);
    float g = max(glyphIndex(c, uGlyphN), minG);
    vec2 lc = fract(px / uCell);
    float a = texture2D(uGlyph, vec2((g + lc.x) / uGlyphN, 1.0 - lc.y)).r;
    return glyphColour(c) * a + uTint * a * minG * 0.14;
  }

  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y);
    vec2 px = p * uRes;
    vec3 col = frame(p);
    float px1 = uRes.y / 900.0;
    float d = length(px - uMouse);
    float lens = (1.0 - smoothstep(uLensR - 1.5 * px1, uLensR + 1.5 * px1, d)) * uLens;
    vec3 asc = ascii(px, step(0.01, lens));
    float ring = (1.0 - smoothstep(0.0, 1.8 * px1, abs(d - uLensR))) * uLens;
    float band = uCodeBand * smoothstep(0.5, 1.05, p.y);
    float k = clamp(max(max(uAscii, lens), band), 0.0, 1.0);
    vec3 code = mix(asc, asc * (0.55 + uTint * 0.9), lens * 0.7);
    col = mix(col, code, k);
    // scan line inside the lens
    float scan = smoothstep(0.92, 1.0, fract(px.y / (uRes.y * 0.16) - uTime * 0.35));
    col += uTint * (ring * 0.55 + lens * scan * 0.06);

    // a light that answers the hovered door
    vec2 gq = (p - uGlow.xy) * vec2(uRes.x / uRes.y, 1.0);
    col += uGlowCol * uGlow.z * (0.5 * exp(-dot(gq, gq) * 260.0) + 0.16 * exp(-dot(gq, gq) * 18.0));

    vec2 q = (p - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    col *= mix(1.0, smoothstep(1.3, 0.25, length(q)), 0.5);
    col *= 1.0 - uDim * 0.64;
    col += (hash(px + fract(uTime * 7.31) * 917.0) - 0.5) * 0.045;
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

const SHARD_VERT = /* glsl */ `
  attribute vec2 aCell;
  attribute vec4 aRnd;
  uniform sampler2D uTex;
  uniform vec4 uFit;
  uniform vec2 uCellUv, uOrigin, uMouse;
  uniform float uProg, uAspect, uGlyphN;
  varying vec2 vLocal;
  varying float vG, vA;
  varying vec3 vCol;
  ${GLSL_COMMON}
  void main() {
    vec3 c = sampleFit(uTex, uFit, aCell);
    vG = glyphIndex(c, uGlyphN);
    vCol = glyphColour(c) * 1.8;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float delay = aRnd.x * 0.4 + length((aCell - uOrigin) * vec2(uAspect, 1.0)) * 0.22;
    float k = clamp((uProg - delay) / 0.6, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec2 away = (aCell - uOrigin) * vec2(uAspect, 1.0);
    vec2 dir = normalize(away + (aRnd.yz - 0.5) * 0.7) / vec2(uAspect, 1.0);
    vec2 pos = aCell + dir * k * (0.12 + aRnd.w * 0.55);
    pos.y -= k * k * (0.08 + aRnd.y * 0.35);
    float sw = k * (aRnd.z - 0.5) * 1.6;
    pos += vec2(-dir.y, dir.x) * sw * 0.08;
    vec2 m = (pos - uMouse) * vec2(uAspect, 1.0);
    float r = length(m);
    pos += (m / max(r, 1e-4)) / vec2(uAspect, 1.0) * 0.05 * exp(-r * r * 70.0);
    vec2 size = uCellUv * (1.0 + k * aRnd.w * 2.2);
    vec2 q = pos + vec2(position.x, -position.y) * size;
    gl_Position = vec4(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0, 0.0, 1.0);
    vLocal = vec2(position.x + 0.5, 0.5 - position.y);
    vA = (1.0 - k) * step(0.002, l);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute vec2 aCell;
  attribute vec4 aRnd;
  uniform vec2 uCellUv, uMouse;
  uniform float uTime, uAspect;
  varying vec2 vLocal;
  varying float vG, vA;
  varying vec3 vCol;
  uniform vec3 uTint;
  void main() {
    vec2 pos = aCell;
    pos.y = fract(pos.y - uTime * (0.004 + aRnd.w * 0.01));
    pos.x += sin(uTime * (0.2 + aRnd.x * 0.3) + aRnd.y * 40.0) * 0.012;
    vec2 m = (pos - uMouse) * vec2(uAspect, 1.0);
    float r = length(m);
    pos += (m / max(r, 1e-4)) / vec2(uAspect, 1.0) * 0.07 * exp(-r * r * 50.0);
    vec2 size = uCellUv * (0.7 + aRnd.z * 0.9);
    vec2 q = pos + vec2(position.x, -position.y) * size;
    gl_Position = vec4(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0, 0.0, 1.0);
    vLocal = vec2(position.x + 0.5, 0.5 - position.y);
    vG = floor(aRnd.x * 7.0) + 1.0;
    float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aRnd.y * 2.0) + aRnd.z * 30.0);
    vA = (0.18 + 0.5 * tw * aRnd.w) * smoothstep(0.0, 0.08, pos.y) * smoothstep(1.0, 0.9, pos.y);
    vCol = mix(vec3(0.9), uTint, 0.5 + 0.5 * aRnd.y);
  }
`;

const GLYPH_FRAG = /* glsl */ `
  uniform sampler2D uGlyph;
  uniform float uGlyphN, uAlpha;
  varying vec2 vLocal;
  varying float vG, vA;
  varying vec3 vCol;
  void main() {
    float a = texture2D(uGlyph, vec2((vG + vLocal.x) / uGlyphN, 1.0 - vLocal.y)).r;
    gl_FragColor = vec4(vCol * a * vA * uAlpha, 1.0);
  }
`;

const ease = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

export class Screen {
  static async create(canvas) {
    const s = new Screen(canvas);
    await s.init();
    return s;
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.tweens = [];
    this.textures = new Map();
    this.focus = 0.5;
    this.contain = false;
    this.zoom = { v: 1 };
    this.mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    this.onFrame = null;
    this.t0 = performance.now();
  }

  async init() {
    THREE.ColorManagement.enabled = false;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.setClearColor(0x030405, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();

    const atlas = await glyphAtlas(64);
    const glyph = new THREE.CanvasTexture(atlas.canvas);
    glyph.minFilter = THREE.LinearFilter;
    glyph.generateMipmaps = false;
    this.glyphN = atlas.count;
    const black = new THREE.DataTexture(new Uint8Array([3, 4, 5, 255]), 1, 1);
    black.needsUpdate = true;
    this.black = black;

    this.u = {
      uTex: { value: black },
      uGlyph: { value: glyph },
      uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-9999, -9999) },
      uGlyphN: { value: atlas.count },
      uCell: { value: 12 },
      uTime: { value: 0 },
      uAscii: { value: 0 },
      uFade: { value: 1 },
      uDim: { value: 0 },
      uLens: { value: 0 },
      uLensR: { value: 120 },
      uCodeBand: { value: 0 },
      uTint: { value: new THREE.Vector3(0.93, 0.89, 0.83) },
      uGlow: { value: new THREE.Vector3(0.5, 0.2, 0) },
      uGlowCol: { value: new THREE.Vector3(1, 1, 1) },
    };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG, depthTest: false, depthWrite: false }),
    );
    quad.frustumCulled = false;
    this.scene.add(quad);

    // shatter particles
    this.su = {
      uTex: { value: black },
      uGlyph: { value: glyph },
      uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
      uCellUv: { value: new THREE.Vector2(0.01, 0.01) },
      uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uMouse: { value: new THREE.Vector2(-9, -9) },
      uProg: { value: 0 },
      uAspect: { value: 1 },
      uGlyphN: { value: atlas.count },
      uAlpha: { value: 0 },
    };
    this.shards = new THREE.Mesh(
      new THREE.InstancedBufferGeometry(),
      new THREE.ShaderMaterial({
        uniforms: this.su, vertexShader: SHARD_VERT, fragmentShader: GLYPH_FRAG,
        blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
      }),
    );
    this.shards.frustumCulled = false;
    this.shards.visible = false;
    this.scene.add(this.shards);

    // ambient glyph dust
    this.du = {
      uGlyph: { value: glyph },
      uCellUv: { value: new THREE.Vector2(0.01, 0.01) },
      uMouse: { value: new THREE.Vector2(-9, -9) },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uGlyphN: { value: atlas.count },
      uAlpha: { value: 0 },
      uTint: { value: new THREE.Vector3(0.93, 0.89, 0.83) },
    };
    const dg = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    dg.index = base.index;
    dg.setAttribute('position', base.getAttribute('position'));
    const N = 900;
    const cell = new Float32Array(N * 2);
    const rnd = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      cell[i * 2] = Math.random();
      cell[i * 2 + 1] = Math.random();
      for (let j = 0; j < 4; j++) rnd[i * 4 + j] = Math.random();
    }
    dg.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    dg.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
    dg.instanceCount = N;
    this.dustMesh = new THREE.Mesh(
      dg,
      new THREE.ShaderMaterial({
        uniforms: this.du, vertexShader: DUST_VERT, fragmentShader: GLYPH_FRAG,
        blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
      }),
    );
    this.dustMesh.frustumCulled = false;
    this.scene.add(this.dustMesh);

    this.resize();
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const W = innerWidth;
    const H = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(W, H, false);
    this.W = W;
    this.H = H;
    this.u.uRes.value.set(W * this.dpr, H * this.dpr);
    this.u.uLensR.value = Math.min(130, Math.max(80, W * 0.075)) * this.dpr;
    const cssCell = Math.max(7, Math.min(12, W / 150));
    this.cellCss = cssCell;
    this.u.uCell.value = cssCell * this.dpr;
    const cuv = new THREE.Vector2(cssCell / W, cssCell / H);
    this.su.uCellUv.value.copy(cuv);
    this.du.uCellUv.value.copy(cuv).multiplyScalar(1.1);
    this.su.uAspect.value = this.du.uAspect.value = W / H;
    this.buildShards();
  }

  buildShards() {
    const cols = Math.ceil(this.W / this.cellCss);
    const rows = Math.ceil(this.H / this.cellCss);
    const n = cols * rows;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    const cell = new Float32Array(n * 2);
    const rnd = new Float32Array(n * 4);
    // cell centres in the same grid as the ASCII shader (floor(px / cell))
    const cw = (this.cellCss * this.dpr) / (this.W * this.dpr);
    const ch = (this.cellCss * this.dpr) / (this.H * this.dpr);
    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        cell[i * 2] = (x + 0.5) * cw;
        cell[i * 2 + 1] = (y + 0.5) * ch;
        for (let j = 0; j < 4; j++) rnd[i * 4 + j] = Math.random();
      }
    }
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
    g.instanceCount = n;
    this.shards.geometry.dispose();
    this.shards.geometry = g;
  }

  // ---------- sources ----------
  videoTexture(video) {
    if (!this.textures.has(video)) {
      const t = new THREE.VideoTexture(video);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      this.textures.set(video, t);
    }
    return this.textures.get(video);
  }

  imageTexture(url) {
    if (!this.textures.has(url)) {
      this.textures.set(
        url,
        new Promise((res) => {
          new THREE.TextureLoader().load(
            url,
            (t) => {
              t.minFilter = THREE.LinearFilter;
              t.generateMipmaps = false;
              res(t);
            },
            undefined,
            () => res(this.black),
          );
        }),
      );
    }
    return this.textures.get(url);
  }

  // Show a texture. focus = which x to keep on narrow screens; contain = letterbox instead of crop.
  show(tex, { focus = 0.5, contain = false, drift = false } = {}) {
    this.u.uTex.value = tex;
    this.focus = focus;
    this.contain = contain;
    this.zoom.v = 1;
    this.tweens = this.tweens.filter((t) => t.obj !== this.zoom);
    if (drift) this.tween(this.zoom, 'v', 1.07, 40, 'inOut');
  }

  fit() {
    const sa = this.W / this.H;
    const va = VIDEO_ASPECT;
    let sx, sy, ox, oy;
    const wide = sa > va;
    if (!this.contain) {
      if (wide) [sx, sy, ox, oy] = [1, va / sa, 0, (1 - va / sa) / 2];
      else {
        sx = sa / va;
        sy = 1;
        ox = Math.min(Math.max(this.focus - sx / 2, 0), 1 - sx);
        oy = 0;
      }
    } else if (wide) [sx, sy, ox, oy] = [sa / va, 1, (1 - sa / va) / 2, 0];
    else [sx, sy, ox, oy] = [1, va / sa, 0, (1 - va / sa) / 2];
    // slow push-in about the centre of what is visible
    const z = this.zoom.v;
    const cx = ox + sx / 2;
    const cy = oy + sy / 2;
    sx /= z;
    sy /= z;
    return [sx, sy, cx - sx / 2, cy - sy / 2];
  }

  // video space (0..1, top-left) -> CSS pixels
  toScreen(vx, vy) {
    const [sx, sy, ox, oy] = this.curFit || this.fit();
    return [((vx - ox) / sx) * this.W, ((vy - oy) / sy) * this.H];
  }

  // ---------- effects ----------
  setTint(rgb) {
    this.tween(this.u.uTint.value, 'x', rgb[0], 0.8);
    this.tween(this.u.uTint.value, 'y', rgb[1], 0.8);
    this.tween(this.u.uTint.value, 'z', rgb[2], 0.8);
    this.du.uTint.value.set(...rgb);
  }

  glow(vx, vy, rgb, on) {
    if (on) {
      const [x, y] = this.toScreen(vx, vy);
      this.u.uGlow.value.x = x / this.W;
      this.u.uGlow.value.y = y / this.H;
      this.u.uGlowCol.value.set(...rgb);
    }
    this.tween(this.u.uGlow.value, 'z', on ? 1 : 0, on ? 0.35 : 0.8, 'out');
  }

  set(name, v, dur = 0, e = 'inOut') {
    if (!dur) {
      this.tweens = this.tweens.filter((t) => !(t.obj === this.u[name] && t.key === 'value'));
      this.u[name].value = v;
      return Promise.resolve();
    }
    return this.tween(this.u[name], 'value', v, dur, e);
  }

  setDust(on) {
    this.tween(this.du.uAlpha, 'value', on ? 1 : 0, on ? 2.5 : 0.8);
  }

  // Break the current frame into glyphs that blow away from `origin` (CSS px).
  // `next()` is called once the frame is fully code; it should swap in the next source.
  async shatter(origin, next) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      await this.set('uFade', 0, 0.4);
      await next();
      return this.set('uFade', 1, 0.6);
    }
    await this.set('uAscii', 1, 0.45, 'out');
    this.su.uTex.value = this.u.uTex.value;
    this.su.uFit.value.set(...this.curFit);
    this.su.uOrigin.value.set(origin[0] / this.W, origin[1] / this.H);
    this.su.uProg.value = 0;
    this.su.uAlpha.value = 1;
    this.shards.visible = true;
    this.u.uFade.value = 0;
    const fly = this.tween(this.su.uProg, 'value', 1.6, 2.2, 'linear');
    await next();
    this.set('uFade', 1, 1.1, 'out');
    await new Promise((r) => setTimeout(r, 450));
    await this.set('uAscii', 0, 1.3, 'inOut');
    await fly;
    this.shards.visible = false;
  }

  tween(obj, key, to, dur, e = 'inOut') {
    this.tweens = this.tweens.filter((t) => !(t.obj === obj && t.key === key));
    return new Promise((resolve) => {
      this.tweens.push({ obj, key, from: obj[key], to, t0: performance.now(), dur: dur * 1000, e: ease[e], resolve });
    });
  }

  setMouse(x, y) {
    this.mouse.tx = x;
    this.mouse.ty = y;
    if (this.mouse.x < -999) {
      this.mouse.x = x;
      this.mouse.y = y;
    }
  }

  frame() {
    const now = performance.now();
    const time = (now - this.t0) / 1000;
    this.tweens = this.tweens.filter((t) => {
      const k = Math.min(1, (now - t.t0) / t.dur);
      t.obj[t.key] = t.from + (t.to - t.from) * t.e(k);
      if (k >= 1) t.resolve();
      return k < 1;
    });
    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.22;
    m.y += (m.ty - m.y) * 0.22;
    this.u.uMouse.value.set(m.x * this.dpr, m.y * this.dpr);
    this.su.uMouse.value.set(m.x / this.W, m.y / this.H);
    this.du.uMouse.value.copy(this.su.uMouse.value);
    this.u.uTime.value = time;
    this.du.uTime.value = time;
    this.curFit = this.fit();
    this.u.uFit.value.set(...this.curFit);
    this.dustMesh.visible = this.du.uAlpha.value > 0.001;
    if (this.onFrame) this.onFrame(time);
    this.renderer.render(this.scene, this.camera);
  }
}
