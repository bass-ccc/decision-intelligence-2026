import * as THREE from 'three';
import { rng } from '../core/util.js';
import { shared } from './city.js';

// Rain: thin streaks in a box that travels with the camera.
// Particles (rain, marine snow) live on layer 1 so the water's reflection skips them.
export function buildRain(count) {
  const r = rng(4);
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) off.set([r(), r(), r(), r()], i * 4);
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;
  const u = Object.assign({ uAmount: { value: 1 }, uBox: { value: new THREE.Vector3(70, 50, 70) } }, shared);
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aOff; uniform float uTime; uniform vec3 uBox; uniform float uAmount;
      varying vec2 vUv; varying float vA;
      void main() {
        vec3 fall = vec3(0.12, -1.0, 0.05) * (26.0 + aOff.w * 10.0);
        vec3 p = aOff.xyz * uBox + fall * uTime;
        p = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
        // streak: a camera-facing quad stretched along the fall direction
        vec3 dir = normalize(fall);
        vec3 toCam = normalize(cameraPosition - p);
        vec3 side = normalize(cross(dir, toCam));
        float len = 0.9 + aOff.w * 0.7;
        vec3 wp = p + side * position.x * 0.025 + dir * position.y * len;
        vUv = uv;
        float d = length(cameraPosition - p);
        vA = uAmount * step(aOff.w, uAmount) * smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(20.0, 35.0, d)) * step(0.0, p.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vA; uniform float uDawn;
      void main() {
        float a = (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        gl_FragColor = vec4(vec3(0.55, 0.7, 0.78) * a * vA * 0.55, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(1);
  return {
    mesh,
    update(t, env) {
      u.uAmount.value = env.rain;
      mesh.visible = env.rain > 0.01;
    },
  };
}
