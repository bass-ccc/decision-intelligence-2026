import * as THREE from 'three';
import { GLSL_NOISE } from '../core/util.js';

// Night sky over the city: low cloud lit from below by the streets, a faint
// magenta haze on the horizon. At the end, dawn — the book's pink — rises down the canal.
export function buildSky(dawnDir) {
  const u = {
    uTime: { value: 0 },
    uDawn: { value: 0 },
    uDawnDir: { value: dawnDir.clone() },
    uFade: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uDawn; uniform vec3 uDawnDir; uniform float uFade;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // night
        vec3 zen = vec3(0.004, 0.008, 0.014);
        vec3 hor = vec3(0.05, 0.035, 0.06);
        vec3 glow = vec3(0.22, 0.07, 0.16);
        vec3 col = mix(hor, zen, smoothstep(-0.02, 0.45, h));
        col += glow * exp(-max(h, 0.0) * 14.0) * 0.6;
        // clouds lit from below
        vec2 cp = d.xz / max(h + 0.08, 0.05) * 1.2;
        float c = fbm(cp * 0.7 + vec2(uTime * 0.006, uTime * 0.002));
        c = smoothstep(0.42, 0.85, c);
        col += vec3(0.07, 0.05, 0.08) * c * smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.3, 0.9, h));

        // dawn
        float sd = max(dot(d, uDawnDir), 0.0);
        vec3 dz = vec3(0.30, 0.34, 0.44);
        vec3 dh = vec3(1.25, 0.72, 0.66);
        vec3 dawn = mix(dh, dz, smoothstep(-0.05, 0.5, h));
        dawn += vec3(1.9, 1.0, 0.7) * pow(sd, 28.0) * 2.2 + vec3(1.2, 0.62, 0.5) * pow(sd, 5.0) * 0.6;
        dawn += vec3(0.25, 0.14, 0.14) * c * smoothstep(0.0, 0.3, h);
        col = mix(col, dawn, uDawn);
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    update(t, env) {
      u.uTime.value = t;
      u.uDawn.value = env.dawn;
      mesh.visible = env.sky > 0.01;
      u.uFade.value = env.sky;
    },
  };
}
