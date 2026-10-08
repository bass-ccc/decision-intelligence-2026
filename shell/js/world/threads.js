import * as THREE from 'three';
import { THEMES } from '../../../assets/js/data.js';
import { COLORS } from '../core/util.js';
import { shared } from './city.js';

// Ghost Vision: the book's 12 themes become threads of light that stitch the
// articles together across every depth — roof, canal, sea and Net.

export const THEME_COLORS = ['#ffd23d', '#ff6fb1', '#6fb8ff', '#ff9a4d', '#b99bff', '#ff5a5a', '#4de6ff', '#9dff6a', '#ffb3e6', '#f2f2f2', '#a0ffe0', '#68f0c4'];

export function buildThreads(stations) {
  const group = new THREE.Group();
  group.renderOrder = 20;
  const anchorOf = (no) => stations.find((s) => s.no === no).anchor;
  const threads = THEMES.map((theme, ti) => {
    const pts = theme.articles.map((no) => anchorOf(no).clone().add(new THREE.Vector3(0, (ti - 6) * 0.35, 0)));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const segs = Math.max(60, pts.length * 60);
    const geo = new THREE.TubeGeometry(curve, segs, 0.45, 6, false);
    const u = {
      uColor: { value: new THREE.Color(THEME_COLORS[ti]) },
      uOn: { value: 0 },
      uHi: { value: 1 },
      uSeed: { value: ti * 0.37 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign(u, shared),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOn; uniform float uHi; uniform float uTime; uniform float uSeed; varying vec2 vUv;
        void main(){
          float pulse = fract(vUv.x * 6.0 - uTime * 0.18 - uSeed);
          float p = smoothstep(0.0, 0.03, pulse) * (1.0 - smoothstep(0.03, 0.25, pulse));
          vec3 c = uColor * (0.9 + 3.0 * p) * uOn * uHi;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    group.add(mesh);
    return { theme, mesh, u };
  });

  // a node at every article
  const nodes = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    stations.length
  );
  nodes.renderOrder = 21;
  const m = new THREE.Matrix4();
  stations.forEach((s, i) => {
    m.makeTranslation(s.anchor.x, s.anchor.y, s.anchor.z);
    nodes.setMatrixAt(i, m);
    nodes.setColorAt(i, new THREE.Color(COLORS[s.chapter]).multiplyScalar(2.2));
  });
  nodes.frustumCulled = false;
  group.add(nodes);

  let on = 0;
  let theme = null;
  return {
    group,
    setTheme(t) {
      theme = t;
    },
    update(t, dt, ghost) {
      on = ghost;
      group.visible = on > 0.01;
      if (!group.visible) return;
      nodes.material.opacity = on;
      nodes.rotation.y = 0;
      threads.forEach((th) => {
        th.u.uOn.value = on;
        const want = !theme ? 0.8 : th.theme.id === theme.id ? 1.6 : 0.12;
        th.u.uHi.value += (want - th.u.uHi.value) * (1 - Math.exp(-dt * 4));
      });
    },
  };
}
