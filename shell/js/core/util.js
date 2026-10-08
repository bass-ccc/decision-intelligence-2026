import * as THREE from 'three';

export const COLORS = {
  intro: '#ECE4D4',
  people: '#C5D96B',
  model: '#F2A9A7',
  ai: '#6FCDE2',
  ghost: '#68F0C4',
};

// Deterministic PRNG (mulberry32)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function tier() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 560;
  const mobile = coarse || small;
  const dpr = window.devicePixelRatio || 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = new URLSearchParams(location.search);
  const t = mobile
    ? { name: 'low', mobile: true, reduced, dpr: Math.min(dpr, 1.5), msaa: 0, rain: 1800, snow: 900, reflect: 0.3, city: 0.6, cellCss: 7, voxel: 0.058 }
    : { name: 'high', mobile: false, reduced, dpr: Math.min(dpr, 1.75), msaa: 4, rain: 5200, snow: 2400, reflect: 0.5, city: 1, cellCss: 8, voxel: 0.046 };
  // testing overrides; values are clamped so a crafted link can't overload the visitor's GPU
  if (q.has('msaa')) t.msaa = [0, 2, 4].includes(Number(q.get('msaa'))) ? Number(q.get('msaa')) : t.msaa;
  if (q.has('dpr')) t.dpr = clamp(Number(q.get('dpr')) || t.dpr, 0.5, 2);
  if (q.has('fixed')) t.fixed = true;
  return t;
}

// A canvas texture that already has the sRGB flag and sane filtering.
export function canvasTexture(canvas, { mips = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}

// Wrap CJK/latin text to a max width on a 2D context.
export function wrapLines(g, text, maxW) {
  const out = [];
  let line = '';
  for (const ch of [...text]) {
    const test = line + ch;
    if (g.measureText(test).width > maxW && line) {
      out.push(line);
      line = ch.trim() ? ch : '';
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// Yield to the browser so the loader can repaint between heavy steps.
export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Replace an element's children with markup built from trusted, escaped book data.
export function setMarkup(el, markup) {
  el.replaceChildren(document.createRange().createContextualFragment(markup));
}

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const pad2 = (n) => String(n).padStart(2, '0');
export const pad3 = (n) => String(n).padStart(3, '0');

// Shared GLSL snippets
export const GLSL_NOISE = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

// Fog for additive materials: fade to black instead of adding the fog colour.
export const FOG_ADD = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
#endif`;
