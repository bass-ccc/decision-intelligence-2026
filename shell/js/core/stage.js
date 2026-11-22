import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { buildGlyphAtlas } from './glyphs.js';
import { rng } from './util.js';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb;
  c = min(c, vec3(40.0));
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold + 0.9, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  s += texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  s += texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  s += texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  gl_FragColor = vec4(s * 0.25, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tMap, vUv).rgb * 0.2270270270;
  s += texture2D(tMap, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture2D(tMap, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture2D(tMap, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  s += texture2D(tMap, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;

// Everything that makes the picture feel like it comes through a cyberbrain:
// optical-camouflage reveal, rain on the lens, underwater wobble, glitch slices,
// chromatic fringe, colour grade per depth — and Ghost Vision, which redraws
// the world as glyphs and depth edges.
const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform sampler2D tBloom2;
uniform sampler2D tGlyph; uniform sampler2D tLens;
uniform vec2 uRes; uniform float uCell; uniform float uTime;
uniform float uNear; uniform float uFar;
uniform float uExposure; uniform float uBloom; uniform float uBloom2;
uniform vec3 uLift; uniform vec3 uGain; uniform float uSat;
uniform float uCA; uniform float uWater; uniform float uGlitch; uniform float uCamo; uniform float uLensRain;
uniform float uGhost; uniform float uDigit; uniform vec3 uGhostCol; uniform float uGlyphRow; uniform float uGlyphRows; uniform float uGlyphCount;
uniform float uFade; uniform float uFlash; uniform vec3 uFlashCol; uniform float uScan; uniform float uPitch;
uniform vec4 uPing; uniform float uPingK; uniform vec4 uPingProj; uniform vec4 uPingFx; uniform vec3 uPingCol; uniform vec2 uPingGeo; uniform float uPingSeed;
varying vec2 vUv;

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float linDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec3 grade(vec3 c) {
  c = aces(c * uExposure);
  c = uLift + (uGain - uLift) * c;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(l), c, uSat), 0.0);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 q = vUv - 0.5;

  // glitch slices
  if (uGlitch > 0.001) {
    float tt = floor(uTime * 20.0);
    float band = floor(uv.y * 28.0);
    float on = step(1.0 - uGlitch * 0.55, h1(band * 1.7 + tt * 3.1));
    uv.x += (h1(band * 7.3 + tt) - 0.5) * 0.09 * uGlitch * on;
  }
  // underwater wobble
  uv += uWater * 0.0022 * vec2(sin(uv.y * 38.0 + uTime * 1.7), cos(uv.x * 31.0 + uTime * 1.3));
  // rain on the lens
  float lensMask = 0.0;
  if (uLensRain > 0.001) {
    vec2 luv = vec2(uv.x * aspect, uv.y) * 1.35;
    vec4 L = texture2D(tLens, luv + vec2(0.0, uTime * 0.004));
    vec4 L2 = texture2D(tLens, luv * 0.63 + vec2(0.37, uTime * 0.011));
    vec3 drop = L.b > L2.b ? L.rgb : L2.rgb;
    lensMask = drop.b * uLensRain;
    uv += (drop.rg - 0.5) * 0.06 * lensMask;
  }
  // optical camouflage: the world is still hidden where the noise field is above uCamo
  float camoRim = 0.0;
  if (uCamo > 0.001) {
    vec2 cp = vec2(q.x * aspect, q.y) * 2.6;
    float n = fbm(cp + vec2(uTime * 0.05, -uTime * 0.08));
    float thr = 1.0 - uCamo * 1.25;
    float hidden = smoothstep(thr - 0.06, thr + 0.06, n);
    float e = 0.02;
    vec2 gr = vec2(fbm(cp + vec2(e, 0.0)) - n, fbm(cp + vec2(0.0, e)) - n) / e;
    uv += gr * 0.018 * hidden;
    camoRim = (1.0 - smoothstep(0.0, 0.07, abs(n - thr))) * step(0.02, uCamo);
  }
  // The ping: one click sends one pulse out from the clicked point (main.js). uPing is that point
  // in view space and the pulse's radius; the front is where that sphere meets the picture's own
  // depth, so it runs over walls, fish and stone. Everything deeper than the point is taken as one
  // flat sheet at the point's depth (uPingGeo.x): there is always a clean ring round the cursor,
  // on empty space too, and things that write no depth cannot break it.
  float pF = 0.0; // the front: a line
  float pG = 0.0; // a soft glow round the line
  float pB = 0.0; // the wake behind it
  float pD = 0.0; // this pixel's own depth
  if (uPingK > 0.001) {
    pD = linDepth(texture2D(tDepth, vUv).x);
    float dz = min(pD, uPingGeo.x);
    vec3 rel = vec3((vUv * 2.0 - 1.0) * uPingProj.xy + uPingProj.zw, -1.0) * dz - uPing.xyz;
    float dist = length(rel);
    float lag = uPing.w - dist; // above 0 behind the front
    // The line is two to three pixels wide at any distance. A slope widens it in world units so
    // that it stays that wide on screen (water seen at a low angle: up to 24 pixel-widths of
    // distance). A jump in depth does not: or every silhouette near the front would light up.
    float pxw = dz * 2.0 * uPingProj.y / uRes.y;
    float hw = clamp(fwidth(dist) * 1.2, pxw * 1.2, pxw * (fwidth(dz) > 0.12 * dz ? 1.5 : 24.0));
    pF = 1.0 - smoothstep(hw * 0.4, hw, abs(lag));
    float gw = min(hw, pxw * 6.0);
    pG = exp(-lag * lag / (gw * gw * 40.0));
    // an echo: a fainter front at six tenths of the radius
    pF += uPingFx.w * 0.5 * (1.0 - smoothstep(hw * 0.4, hw, abs(lag - 0.4 * uPing.w)));
    pB = smoothstep(0.0, hw, lag) * (1.0 - smoothstep(0.0, uPingGeo.y, lag));
    // the picture bends where the front passes, like air over something hot
    float bx = lag / (uPingGeo.y * 0.3);
    uv += normalize(rel.xy + 1e-5) * vec2(1.0 / aspect, 1.0) * (uPingFx.x * uPingK * 0.011 * 2.33 * bx * exp(-bx * bx));
  }

  // chromatic fringe (stronger toward the edges)
  vec2 dir = uv - 0.5;
  float ca = uCA * (0.25 + dot(dir, dir) * 2.0) * 0.006;
  vec3 sc;
  sc.r = texture2D(tScene, uv + dir * ca).r;
  sc.g = texture2D(tScene, uv).g;
  sc.b = texture2D(tScene, uv - dir * ca).b;
  vec3 bl = texture2D(tBloom, uv).rgb * uBloom + texture2D(tBloom2, uv).rgb * uBloom2;
  vec3 col = grade(sc + bl);
  col += lensMask * 0.03;
  // under water the light comes from above: brighter up, darker toward the deep
  float up = smoothstep(-0.35, 1.25, vUv.y + uPitch * 0.9);
  col *= mix(1.0, mix(0.45, 1.4, up), uWater);

  // ---------------------------------------------------------------- ghost vision
  if (uGhost > 0.001 || uDigit > 0.001) {
    vec2 frag = vUv * uRes;
    vec2 cell = floor(frag / uCell);
    vec2 cuv = (cell + 0.5) * uCell / uRes;
    vec2 px = 1.0 / uRes;
    float hh = uCell * 0.3;
    vec3 cc = texture2D(tScene, cuv).rgb;
    cc += texture2D(tScene, cuv + vec2(hh, hh) * px).rgb;
    cc += texture2D(tScene, cuv + vec2(-hh, hh) * px).rgb;
    cc += texture2D(tScene, cuv + vec2(hh, -hh) * px).rgb;
    cc += texture2D(tScene, cuv + vec2(-hh, -hh) * px).rgb;
    cc = grade(cc * 0.2 + texture2D(tBloom, cuv).rgb * 1.2);
    float lum = dot(cc, vec3(0.299, 0.587, 0.114));
    float lm = clamp(pow(lum * 2.2, 0.7), 0.0, 0.999);
    vec2 local = fract(frag / uCell);
    float gi = floor(lm * uGlyphCount);
    // cells flicker between neighbouring glyphs like live data
    gi = clamp(gi + step(0.93, hash(cell + floor(uTime * 6.0))) * (hash(cell * 1.3) > 0.5 ? 1.0 : -1.0), 0.0, uGlyphCount - 1.0);
    vec2 guv = vec2((gi + local.x) / uGlyphCount, 1.0 - (uGlyphRow + 1.0 - local.y) / uGlyphRows);
    float g = texture2D(tGlyph, guv).r;
    float mx = max(max(cc.r, cc.g), cc.b);
    vec3 hue = mx > 0.001 ? cc / mx : vec3(1.0);
    float chroma = mx - min(min(cc.r, cc.g), cc.b);
    hue = mix(uGhostCol, hue, smoothstep(0.08, 0.35, chroma));
    vec3 gcol = hue * g * (0.18 + 1.05 * lm);

    float d0 = linDepth(texture2D(tDepth, vUv).x);
    float dl = linDepth(texture2D(tDepth, vUv - vec2(px.x, 0.0)).x);
    float dr = linDepth(texture2D(tDepth, vUv + vec2(px.x, 0.0)).x);
    float du = linDepth(texture2D(tDepth, vUv + vec2(0.0, px.y)).x);
    float dd = linDepth(texture2D(tDepth, vUv - vec2(0.0, px.y)).x);
    float lap = abs(dl + dr + du + dd - 4.0 * d0) / max(d0, 0.001);
    float edge = smoothstep(0.015, 0.08, lap) * (1.0 - smoothstep(300.0, 900.0, d0));
    vec3 gv = gcol + uGhostCol * edge * 0.55 + col * 0.08;
    // grid of the cyberbrain
    gv += uGhostCol * 0.035 * step(0.96, fract(frag.x / (uCell * 6.0))) ;

    float rad = length(vec2(q.x * aspect, q.y));
    float reach = uGhost * 1.35;
    float inside = 1.0 - smoothstep(reach - 0.04, reach, rad);
    float ring = (1.0 - smoothstep(0.0, 0.05, abs(rad - reach))) * (1.0 - step(0.999, uGhost)) * step(0.001, uGhost);
    col = mix(col, gv, max(inside * step(0.001, uGhost), uDigit));
    col += uGhostCol * ring * 0.7;
  }

  // camouflage rim light
  col += vec3(0.55, 0.95, 0.85) * camoRim * 0.25;

  // the ping's own light: the front; the outlines of what its wake is passing over (depth edges);
  // and, in the Net, the wake as a ring of the book's glyph cells.
  // (Texture reads inside the wake are textureLod: they sit behind a test that differs per pixel.)
  if (uPingK > 0.001) {
    vec3 add = uPingCol * (pF * 0.75 + pG * 0.14);
    if (pB > 0.004) {
      vec2 px = 1.0 / uRes;
      if (uPingFx.z > 0.001) {
        // (at uv, where the picture itself was read: the bend above moves both, so an outline
        // stays on its thing)
        float d0 = linDepth(textureLod(tDepth, uv, 0.0).x);
        float dl = linDepth(textureLod(tDepth, uv - vec2(px.x, 0.0), 0.0).x);
        float dr = linDepth(textureLod(tDepth, uv + vec2(px.x, 0.0), 0.0).x);
        float du = linDepth(textureLod(tDepth, uv + vec2(0.0, px.y), 0.0).x);
        float dd = linDepth(textureLod(tDepth, uv - vec2(0.0, px.y), 0.0).x);
        float lap = abs(dl + dr + du + dd - 4.0 * d0) / max(d0, 0.001);
        add += uPingCol * (smoothstep(0.015, 0.08, lap) * (1.0 - smoothstep(300.0, 900.0, d0)) * pB * uPingFx.z * 0.8);
      }
      if (uPingFx.y > 0.001) {
        vec2 frag = vUv * uRes;
        vec2 cell = floor(frag / uCell);
        vec2 cuv = (cell + 0.5) * uCell / uRes;
        vec3 cc = grade(textureLod(tScene, cuv, 0.0).rgb + textureLod(tBloom, cuv, 0.0).rgb * 1.2);
        float lm = clamp(pow(dot(cc, vec3(0.299, 0.587, 0.114)) * 2.2, 0.7), 0.0, 0.999);
        // Every cell of the ring holds a glyph, also where the picture behind it is dark; and never
        // the heaviest ones, which on something bright (the marble head) would close into a solid disc.
        float gi = floor(clamp(0.22 + 0.3 * lm + 0.34 * hash(cell + uPingSeed), 0.0, 0.78) * uGlyphCount);
        vec2 local = fract(frag / uCell);
        float g = textureLod(tGlyph, vec2((gi + local.x) / uGlyphCount, 1.0 - (uGlyphRow + 1.0 - local.y) / uGlyphRows), 0.0).r;
        col *= 1.0 - 0.55 * pB * uPingFx.y * uPingK;
        add += uPingCol * (g * (0.4 + 0.45 * lm) * pB * uPingFx.y);
      }
    }
    col += add * uPingK;
  }

  // scanlines, vignette, grain
  col *= 1.0 - uScan * 0.08 * step(0.5, fract(gl_FragCoord.y * 0.5));
  col *= 1.0 - dot(q, q) * 0.62;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.018;
  col = mix(col, uFlashCol, uFlash);
  col *= uFade;
  gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
}`;

// Water drops on the lens: RG = refraction offset, B = mask. Tiles seamlessly.
function lensTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,0)';
  g.fillRect(0, 0, S, S);
  const r = rng(77);
  // each drop is a little dome: its offset points away from the centre
  const drop = (x, y, rad) => {
    const im = g.getImageData(Math.floor(x - rad), Math.floor(y - rad), Math.ceil(rad * 2), Math.ceil(rad * 2));
    const d = im.data;
    const w = im.width;
    for (let j = 0; j < im.height; j++)
      for (let i = 0; i < w; i++) {
        const dx = (i - rad) / rad;
        const dy = (j - rad) / rad;
        const rr = dx * dx + dy * dy * 1.1;
        if (rr > 1) continue;
        const o = (j * w + i) * 4;
        d[o] = 128 + dx * 110;
        d[o + 1] = 128 - dy * 110;
        d[o + 2] = 255 * Math.min(1, (1 - rr) * 3);
      }
    g.putImageData(im, Math.floor(x - rad), Math.floor(y - rad));
  };
  for (let i = 0; i < 70; i++) {
    const rad = 1.5 + Math.pow(r(), 3) * 7;
    const x = rad + r() * (S - rad * 2);
    const y = rad + r() * (S - rad * 2);
    drop(x, y, rad);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class Stage {
  constructor(canvas, tier) {
    this.tier = tier;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.NoToneMapping;
    this.renderer = renderer;
    this.dprScale = 1;
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    } catch (e) {
      this.gpu = '';
    }
    if (!tier.fixed && /Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(this.gpu)) {
      tier.msaa = 0;
      tier.dpr = Math.min(tier.dpr, 1.1);
      tier.rain = Math.min(tier.rain, 3000);
      tier.reflect = Math.min(tier.reflect, 0.35);
      tier.weak = true;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    this.scene.fog = new THREE.FogExp2(0x05080a, 0.004);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 2400);

    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: tier.msaa,
      depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType),
    });
    this.sceneRT.depthTexture.format = THREE.DepthFormat;
    const bo = { type: THREE.HalfFloatType, depthBuffer: false };
    this.bloomA = new THREE.WebGLRenderTarget(4, 4, bo);
    this.bloomB = new THREE.WebGLRenderTarget(4, 4, bo);
    this.bloomC = new THREE.WebGLRenderTarget(4, 4, bo);
    this.bloomD = new THREE.WebGLRenderTarget(4, 4, bo);

    const pm = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.brightMat = pm(BRIGHT_FRAG, { tMap: { value: null }, uThreshold: { value: 1.1 } });
    this.copyMat = pm(COPY_FRAG, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.blurMat = pm(BLUR_FRAG, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.u = {
      tScene: { value: this.sceneRT.texture },
      tDepth: { value: this.sceneRT.depthTexture },
      tBloom: { value: this.bloomA.texture },
      tBloom2: { value: this.bloomC.texture },
      tGlyph: { value: null },
      tLens: { value: lensTexture() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uCell: { value: 12 },
      uTime: { value: 0 },
      uNear: { value: this.camera.near },
      uFar: { value: this.camera.far },
      uExposure: { value: 1 },
      uBloom: { value: 0.7 },
      uBloom2: { value: 0.5 },
      uLift: { value: new THREE.Vector3(0.01, 0.018, 0.02) },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 1 },
      uCA: { value: 0.4 },
      uWater: { value: 0 },
      uGlitch: { value: 0 },
      uCamo: { value: 0 },
      uLensRain: { value: 0 },
      uGhost: { value: 0 },
      uDigit: { value: 0 },
      uGhostCol: { value: new THREE.Color('#68F0C4') },
      uGlyphRow: { value: 0 },
      uGlyphRows: { value: 2 },
      uGlyphCount: { value: 10 },
      uFade: { value: 1 },
      uFlash: { value: 0 },
      uFlashCol: { value: new THREE.Color(0.8, 1, 0.95) },
      uScan: { value: 1 },
      uPitch: { value: 0 },
      // the ping (main.js writes these; uPingK is 0 while there is none, the others keep their last values)
      uPing: { value: new THREE.Vector4() }, // xyz: the clicked point in view space; w: the radius now
      uPingK: { value: 0 }, // strength
      uPingProj: { value: new THREE.Vector4(1, 1, 0, 0) }, // rebuilds a view ray from a uv (lens shift and view offset included)
      uPingFx: { value: new THREE.Vector4() }, // bend, glyph cells, outlines, echo
      uPingCol: { value: new THREE.Color('#68F0C4') },
      uPingGeo: { value: new THREE.Vector2(100, 6) }, // the point's depth, the wake's width
      uPingSeed: { value: 0 }, // reshuffles the glyph cells
    };
    this.compMat = pm(COMPOSITE_FRAG, this.u);
    this.quad = new FullScreenQuad(null);

    this._frameTimes = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = this.tier.dpr * this.dprScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const W = Math.max(1, Math.floor(w * dpr));
    const H = Math.max(1, Math.floor(h * dpr));
    this.W = W;
    this.H = H;
    this.sceneRT.setSize(W, H);
    const bw = Math.max(1, Math.floor(W / 4));
    const bh = Math.max(1, Math.floor(H / 4));
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    const cw = Math.max(1, Math.floor(W / 12));
    const ch = Math.max(1, Math.floor(H / 12));
    this.bloomC.setSize(cw, ch);
    this.bloomD.setSize(cw, ch);
    this.bloomSize = [bw, bh, cw, ch];
    this.u.uRes.value.set(W, H);
    const cell = Math.max(6, Math.round(this.tier.cellCss * Math.min(dpr, 2)));
    if (cell !== this.cellPx) {
      this.cellPx = cell;
      if (this.glyphs) this.glyphs.texture.dispose();
      this.glyphs = buildGlyphAtlas(cell);
      this.u.tGlyph.value = this.glyphs.texture;
      this.u.uGlyphCount.value = this.glyphs.count;
      this.u.uGlyphRows.value = this.glyphs.rows;
    }
    this.u.uCell.value = cell;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize?.(w, h);
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render(time) {
    const { renderer, scene, camera, u } = this;
    camera.updateMatrixWorld();
    u.uTime.value = time;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;

    renderer.setRenderTarget(this.sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    const [bw, bh, cw, ch] = this.bloomSize;
    this.brightMat.uniforms.tMap.value = this.sceneRT.texture;
    this._pass(this.brightMat, this.bloomA);
    for (let i = 0; i < 2; i++) {
      const r = 1 + i;
      this.blurMat.uniforms.tMap.value = this.bloomA.texture;
      this.blurMat.uniforms.uDir.value.set(r / bw, 0);
      this._pass(this.blurMat, this.bloomB);
      this.blurMat.uniforms.tMap.value = this.bloomB.texture;
      this.blurMat.uniforms.uDir.value.set(0, r / bh);
      this._pass(this.blurMat, this.bloomA);
    }
    // wide halo for the neon
    this.copyMat.uniforms.tMap.value = this.bloomA.texture;
    this.copyMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    this._pass(this.copyMat, this.bloomC);
    for (let i = 0; i < 2; i++) {
      const r = 1 + i * 1.5;
      this.blurMat.uniforms.tMap.value = this.bloomC.texture;
      this.blurMat.uniforms.uDir.value.set(r / cw, 0);
      this._pass(this.blurMat, this.bloomD);
      this.blurMat.uniforms.tMap.value = this.bloomD.texture;
      this.blurMat.uniforms.uDir.value.set(0, r / ch);
      this._pass(this.blurMat, this.bloomC);
    }

    this._pass(this.compMat, null);
  }

  // Compile every shader before the visitor starts moving.
  warm(cam) {
    this.renderer.compile(this.scene, cam || this.camera);
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(this.scene, cam || this.camera);
    this.renderer.setRenderTarget(null);
  }

  // If the device struggles: first turn off MSAA, then lower the pixel ratio (not below 0.7).
  adapt(dt) {
    if (this.tier.fixed || dt > 0.1) return;
    const f = this._frameTimes;
    f.push(dt);
    if (f.length < 120) return;
    f.sort((x, y) => x - y);
    const med = f[Math.floor(f.length / 2)];
    f.length = 0;
    if (med > 1 / 36) {
      if (this.sceneRT.samples > 0) {
        this.sceneRT.dispose();
        this.sceneRT.samples = 0;
      } else if (this.dprScale > 0.7) {
        this.dprScale = Math.max(0.7, this.dprScale * 0.9);
        this.resize();
      }
    } else if (med < 1 / 57 && this.dprScale < 1) {
      this.dprScale = Math.min(1, this.dprScale / 0.9);
      this.resize();
    }
  }
}
