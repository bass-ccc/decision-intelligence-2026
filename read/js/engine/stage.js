// One canvas + one drawing ("anim") = a stage. All stages share a single animation loop,
// and a stage only runs while it is on screen. With reduced motion, a stage shows a still
// frame and only moves for a moment after you touch it or the text moves to a new step.
//
// An anim module is `export default function make(env) { return { frame(t, dt), ... } }`.
// Optional hooks: resize(w, h), step(i, prev), down(x, y), up(x, y), drag(x, y, dx, dy),
// click(x, y), warm(seconds) (fast-forward a simulation without drawing), noClear.
import { makeInk, font } from './ink.js';
import { makeAscii } from './ascii.js';
import { theme, onTheme, sectionColor, alpha } from './theme.js';
import * as N from './noise.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
let raf = 0;
let last = 0;
let fpsAcc = 0;
let fpsN = 0;

function tick(now) {
  raf = 0;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 1) {
    window.__fps = Math.round(fpsN / fpsAcc);
    fpsAcc = fpsN = 0;
  }
  for (const s of [...running]) s._tick(dt);
  if (running.size) raf = requestAnimationFrame(tick);
  else last = 0;
}
const wake = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};

export function mount(canvas, make, opts = {}) {
  const g = canvas.getContext('2d');
  const mini = !!opts.mini;
  const stillT = Math.min(60, Math.max(0, Number.isFinite(opts.stillT) ? opts.stillT : 4));
  const env = {
    g,
    canvas,
    w: 1,
    h: 1,
    dpr: 1,
    mini,
    reduced: REDUCED.matches,
    c: theme(),
    acc: sectionColor(opts.section),
    section: opts.section || 'people',
    pointer: { x: -1e4, y: -1e4, in: false, down: false },
    step: opts.step ?? 0,
    prevStep: 0,
    stepAt: 0,
    t: 0,
    boil: 0,
    font,
    alpha,
    N,
    data: opts.data || null,
  };
  env.ink = makeInk(env);
  env.ascii = makeAscii(env);

  let inst = null;
  let visible = false;
  let hover = false;
  let burst = 0; // seconds of motion allowed in reduced-motion / hover-only mode
  let destroyed = false;

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, mini ? 1.25 : opts.maxDpr || 1.5);
    if (w === env.w && h === env.h && dpr === env.dpr && inst) return false;
    env.w = w;
    env.h = h;
    env.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return true;
  }

  function draw(dt) {
    env.boil = Math.floor(env.t * 6);
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    g.globalAlpha = 1;
    if (!inst.noClear) g.clearRect(0, 0, env.w, env.h);
    try {
      inst.frame(env.t, dt);
    } catch (e) {
      console.error(e);
      running.delete(stage);
    }
  }

  function wantsRun() {
    if (destroyed || !visible) return false;
    if (env.reduced || (opts.hoverOnly && !hover)) return burst > 0;
    return true;
  }

  function update() {
    if (wantsRun()) {
      running.add(stage);
      wake();
    } else running.delete(stage);
  }

  function still() {
    if (!inst || destroyed) return;
    if (env.t === 0) {
      env.t = stillT;
      inst.warm?.(stillT);
    }
    draw(0);
  }

  const stage = {
    env,
    _tick(dt) {
      if (burst > 0) burst -= dt;
      env.t += dt;
      draw(dt);
      if (!wantsRun()) running.delete(stage);
    },
    setStep(i) {
      if (i === env.step) return;
      env.prevStep = env.step;
      env.step = i;
      env.stepAt = env.t;
      inst?.step?.(i, env.prevStep);
      kick(2.5);
    },
    setHover(v) {
      hover = v;
      if (v) burst = Math.max(burst, 0.1);
      update();
      if (!v) still();
    },
    redraw: () => still(),
    destroy() {
      destroyed = true;
      running.delete(stage);
      io.disconnect();
      ro.disconnect();
      offTheme();
      ac.abort();
    },
  };

  // motion for a few seconds (reduced motion: only after the reader acts)
  function kick(sec = 2) {
    burst = Math.max(burst, sec);
    update();
  }

  size();
  inst = make(env);
  inst.resize?.(env.w, env.h);

  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      update();
      if (visible && !running.has(stage)) still();
    },
    { rootMargin: '80px' },
  );
  io.observe(canvas);

  const ro = new ResizeObserver(() => {
    if (size()) {
      inst.resize?.(env.w, env.h);
      if (!running.has(stage)) still();
    }
  });
  ro.observe(canvas);

  const offTheme = onTheme((c) => {
    env.c = c;
    env.acc = sectionColor(opts.section);
    if (!running.has(stage)) still();
  });

  // pointer
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const P = env.pointer;
  let downAt = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const [x, y] = pos(e);
      const dx = x - P.x;
      const dy = y - P.y;
      P.x = x;
      P.y = y;
      P.in = true;
      if (P.down) inst.drag?.(x, y, dx, dy);
      if (env.reduced || opts.hoverOnly) kick(1.2);
    },
    sig,
  );
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      const [x, y] = pos(e);
      P.x = x;
      P.y = y;
      P.in = true;
      P.down = true;
      downAt = { x, y, t: performance.now() };
      if (e.pointerType === 'mouse') canvas.setPointerCapture?.(e.pointerId);
      inst.down?.(x, y);
      kick(2);
    },
    sig,
  );
  const up = (e) => {
    if (!P.down) return;
    const [x, y] = pos(e);
    P.down = false;
    inst.up?.(x, y);
    if (downAt && Math.hypot(x - downAt.x, y - downAt.y) < 8 && performance.now() - downAt.t < 500) inst.click?.(x, y);
    downAt = null;
    kick(2.5);
  };
  canvas.addEventListener('pointerup', up, sig);
  canvas.addEventListener('pointercancel', () => (P.down = false), sig);
  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (P.down && e.pointerType !== 'mouse') up(e);
      P.in = false;
    },
    sig,
  );
  // late-arriving web fonts: redraw still frames with the real faces
  document.fonts?.addEventListener('loadingdone', () => {
    if (!running.has(stage)) still();
  }, sig);
  REDUCED.addEventListener?.('change', () => {
    env.reduced = REDUCED.matches;
    update();
  }, sig);

  return stage;
}
