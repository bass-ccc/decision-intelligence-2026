// 決策智慧 2026 · The New Distance
// Six films made with Higgsfield (GPT Image 2.5 keyframes → Kling 3.0), played through a live shader.
// Flow: boot → intro film → hub (three lights) → chapter film → chapter cards → … → explore map.
import { Screen } from './screen.js';
import { Sound } from './sound.js';
import { FILMS, SECTION_LOOK, HUB_LIGHTS } from './films.js';
import { ARTICLES, sectionOf } from '../../assets/js/data.js';
import { Captions, buildHub, layoutHub, buildRail, ExploreMap, articleHTML, buildIndex, PageViewer } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const body = document.body;
const SCENES = ['intro', 'hub', 'people', 'model', 'ai', 'explore'];
const CHAPTERS = ['people', 'model', 'ai'];
const QUALITY = innerWidth * Math.min(devicePixelRatio || 1, 2) >= 1280 && !navigator.connection?.saveData ? '1080' : '720';

const sound = new Sound();
const captions = new Captions();
const pages = new PageViewer();
let scr;
const st = { scene: 'boot', mode: 'rest', film: null, fx: [], busy: false, reader: null, watched: new Set(), space: false };

// ---------- videos ----------
const shelf = document.createElement('div');
shelf.className = 'shelf';
body.appendChild(shelf);
const videos = {};
function video(id) {
  if (!videos[id]) {
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.loop = !!FILMS[id].loop;
    v.src = `${FILMS[id].src}-${QUALITY}.mp4`;
    shelf.appendChild(v);
    videos[id] = v;
  }
  return videos[id];
}
function ready(v, timeout = 10000) {
  if (v.readyState >= 3) return Promise.resolve();
  return new Promise((res) => {
    const done = () => {
      v.removeEventListener('canplay', done);
      res();
    };
    v.addEventListener('canplay', done);
    setTimeout(done, timeout);
  });
}
function pauseAll(except) {
  Object.entries(videos).forEach(([id, v]) => id !== except && !v.paused && v.pause());
}

// ---------- layers ----------
function setLayer(name) {
  body.dataset.layer = name || '';
}

// ---------- scenes ----------
async function go(scene, origin, { push = true } = {}) {
  if (st.busy || !SCENES.includes(scene)) return;
  if (scene === st.scene && st.mode === 'rest') return;
  st.busy = true;
  closeReader(false);
  closeIndex();
  if (push) history.pushState({ scene }, '', `#${scene}`);
  sound.whoosh();
  setLayer(null);
  captions.clear();
  st.film = null;
  await scr.shatter(origin || [innerWidth / 2, innerHeight / 2], () => enter(scene));
  st.busy = false;
}

async function replay() {
  if (st.busy) return;
  st.busy = true;
  sound.whoosh();
  setLayer(null);
  await scr.shatter([innerWidth / 2, innerHeight * 0.4], () => enter(st.scene));
  st.busy = false;
}

async function enter(scene) {
  st.scene = scene;
  body.dataset.scene = scene;
  const look = SECTION_LOOK[scene] || SECTION_LOOK.intro;
  scr.setTint(look.tint);
  sound.key(look.root);
  scr.set('uCodeBand', 0);
  scr.glow(0.5, 0.2, look.tint, false);
  pauseAll(scene);

  if (scene === 'hub') return rest('hub');

  if (scene === 'explore') {
    const v = video('explore');
    await ready(v);
    v.currentTime = 0;
    v.play().catch(() => {});
    scr.show(scr.videoTexture(v), { focus: 0.5, contain: innerWidth / innerHeight < 1.15 });
    st.mode = 'rest';
    setLayer('explore');
    scr.setDust(true);
    return;
  }

  // a film: intro or a chapter
  const v = video(scene);
  await ready(v);
  v.currentTime = 0;
  scr.show(scr.videoTexture(v), { focus: FILMS[scene].focus });
  captions.load(scene);
  st.film = scene;
  st.mode = 'film';
  st.fx = [...(FILMS[scene].fx || [])];
  setLayer('film');
  scr.setDust(false);
  v.onended = () => endFilm(scene);
  v.play().catch(() => {});
  scr.imageTexture(FILMS[scene].rest); // warm up the sharp still the film ends on
  preloadNext();
}

// The film's last frame swaps to the sharp keyframe it was generated from, hidden by a flash of code.
function endFilm(id, flash = 0.6) {
  if (st.film !== id) return;
  pulse(flash);
  st.film = null;
  st.watched.add(id);
  document.querySelectorAll(`[data-go="${id}"], .door[data-id="${id}"]`).forEach((b) => b.classList.add('seen'));
  const v = videos[id];
  v.onended = null;
  v.pause();
  captions.clear();
  if (id === 'intro') {
    history.replaceState({ scene: 'hub' }, '', '#hub');
    st.scene = 'hub';
    body.dataset.scene = 'hub';
  }
  rest(st.scene);
}

async function rest(id) {
  const key = id === 'hub' ? 'intro' : id;
  const tex = await scr.imageTexture(FILMS[key].rest);
  scr.show(tex, { focus: FILMS[key].focus, drift: true });
  st.mode = 'rest';
  if (id === 'hub') {
    setLayer('hub');
    scr.setDust(true);
    body.classList.toggle('all-seen', CHAPTERS.every((c) => st.watched.has(c)));
  } else {
    buildRail(id, { onOpen: openReader, onGo: go, onReplay: replay });
    setLayer('rail');
    scr.set('uCodeBand', 1, 2.2);
    scr.setDust(true);
  }
}

function skip() {
  if (!st.film || st.busy) return;
  endFilm(st.film, 1);
}

function pulse(k) {
  if (st.space) return;
  scr.set('uAscii', k, 0.12, 'out').then(() => !st.space && scr.set('uAscii', 0, 0.8));
}

let preloaded = false;
function preloadNext() {
  if (preloaded) return;
  preloaded = true;
  // one at a time, so the film that is playing keeps the bandwidth
  const queue = ['people', 'model', 'ai', 'explore'];
  const next = () => {
    const id = queue.shift();
    if (!id) return;
    const v = video(id);
    if (v.readyState >= 4) next();
    else {
      v.addEventListener('canplaythrough', next, { once: true });
      setTimeout(next, 15000);
    }
  };
  setTimeout(next, 1500);
}

// ---------- every frame ----------
function onFrame() {
  if (st.film) {
    const v = videos[st.film];
    const t = v.currentTime;
    captions.update(t);
    $('#fb-prog').style.transform = `scaleX(${v.duration ? t / v.duration : 0})`;
    while (st.fx.length && t >= st.fx[0][0]) pulse(st.fx.shift()[1]);
  }
  const layer = body.dataset.layer;
  if (layer === 'hub') layoutHub(scr);
  else if (layer === 'explore') map.layout(scr);
}

// ---------- reader / index ----------
const reader = $('#reader');
function openReader(no, push = true) {
  const a = ARTICLES.find((x) => x.no === no);
  if (!a) return;
  closeIndex();
  const s = sectionOf(a.section);
  reader.style.setProperty('--c', s.color);
  $('.rd-body', reader).innerHTML = articleHTML(a);
  $('.rd-scroll', reader).scrollTop = 0;
  reader.querySelectorAll('.rd-thumbs button').forEach((b) => b.addEventListener('click', () => pages.open(+b.dataset.p, [a.start, a.end])));
  reader.querySelectorAll('.rd-nav [data-no]').forEach((b) => b.addEventListener('click', () => openReader(+b.dataset.no, false)));
  const wasOpen = !!st.reader;
  st.reader = no;
  reader.classList.add('on');
  reader.setAttribute('aria-hidden', 'false');
  body.classList.add('reading');
  scr.set('uDim', 1, 0.6);
  lensOn = false;
  scr.set('uLens', 0, 0.3);
  sound.bell(SECTION_LOOK[a.section].root * 4);
  if (push && !wasOpen) history.pushState({ scene: st.scene, a: no }, '', `#a-${no}`);
  else history.replaceState({ scene: st.scene, a: no }, '', `#a-${no}`);
  $('.rd-close', reader).focus({ preventScroll: true });
}

function closeReader(fix = true) {
  if (!st.reader) return;
  const no = st.reader;
  st.reader = null;
  reader.classList.remove('on');
  reader.setAttribute('aria-hidden', 'true');
  body.classList.remove('reading');
  if (!body.classList.contains('indexing')) scr.set('uDim', 0, 0.6);
  if (fix) history.replaceState({ scene: st.scene }, '', `#${st.scene}`);
  const spot = document.querySelector(`#map .spot[data-no="${no}"], #rail .card[data-no="${no}"]`);
  if (spot && getComputedStyle(spot).visibility !== 'hidden') spot.focus({ preventScroll: true });
}

const index = $('#index');
function openIndex() {
  index.classList.add('on');
  index.setAttribute('aria-hidden', 'false');
  body.classList.add('indexing');
  lensOn = false;
  scr.set('uLens', 0, 0.3);
  scr.set('uDim', 1, 0.5);
  $('.ix-close', index).focus({ preventScroll: true });
}
function closeIndex() {
  if (!body.classList.contains('indexing')) return;
  index.classList.remove('on');
  index.setAttribute('aria-hidden', 'true');
  body.classList.remove('indexing');
  if (!st.reader) scr.set('uDim', 0, 0.5);
}

// ---------- routing ----------
function target() {
  const h = location.hash.slice(1);
  const m = h.match(/^a-(\d+)$/);
  if (m) return { scene: 'explore', article: +m[1] };
  return { scene: SCENES.includes(h) ? h : 'intro' };
}
addEventListener('popstate', () => {
  if (st.scene === 'boot') return;
  pages.close();
  const t = target();
  if (t.article) return openReader(t.article, false);
  if (st.reader) closeReader(false);
  if (t.scene !== st.scene) go(t.scene, null, { push: false });
});

// ---------- input ----------
let touchTimer;
// the lens steps aside over buttons and panels, so labels stay readable
const UI = 'button, #rail, #reader, #index, #top, .ex-themes, .hub-foot';
let lensOn = false;
addEventListener('pointermove', (e) => {
  scr?.setMouse(e.clientX, e.clientY);
  if (e.pointerType !== 'mouse') return;
  const on = !st.reader && !body.classList.contains('indexing') && !e.target.closest(UI);
  if (on !== lensOn) {
    lensOn = on;
    scr?.set('uLens', on ? 1 : 0, on ? 0.4 : 0.25);
  }
});
addEventListener('pointerdown', (e) => {
  scr?.setMouse(e.clientX, e.clientY);
  if (e.pointerType !== 'mouse' && !st.reader && !body.classList.contains('indexing')) {
    clearTimeout(touchTimer);
    scr?.set('uLens', 1, 0.2);
  }
});
addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') touchTimer = setTimeout(() => scr?.set('uLens', 0, 0.6), 700);
});
document.documentElement.addEventListener('pointerleave', () => {
  lensOn = false;
  scr?.set('uLens', 0, 0.4);
});

const spaceOK = () => !st.busy && !st.reader && !body.classList.contains('indexing') && st.scene !== 'boot' && (document.activeElement === body || !document.activeElement || document.activeElement.tagName === 'CANVAS');
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && spaceOK()) {
    e.preventDefault();
    if (e.repeat || st.space) return;
    st.space = true;
    body.classList.add('ghost');
    scr.set('uAscii', 1, 0.35, 'out');
    sound.tick(0.5);
  } else if (e.key === 'Escape') {
    if (pages.isOpen) pages.close();
    else if (st.reader) closeReader();
    else if (body.classList.contains('indexing')) closeIndex();
  } else if (pages.isOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) pages.go(e.key === 'ArrowLeft' ? -1 : 1);
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space' && st.space) {
    st.space = false;
    body.classList.remove('ghost');
    if (!st.busy) scr.set('uAscii', 0, 0.5);
  }
});

// ---------- wiring ----------
const map = new ExploreMap({ onOpen: (no) => openReader(no), onTick: (p) => sound.tick(p || 1) });
buildIndex((no) => openReader(no));
buildHub(go, (id, on) => {
  scr.glow(...HUB_LIGHTS[id], SECTION_LOOK[id].tint, on);
  body.dataset.hover = on ? id : '';
  if (on) sound.tick(1 + CHAPTERS.indexOf(id) * 0.25);
});
document.querySelectorAll('[data-go]').forEach((b) => {
  if (b.closest('.rail-nav')) return;
  b.addEventListener('click', (e) => {
    const r = b.getBoundingClientRect();
    go(b.dataset.go, e.clientX || e.clientY ? [e.clientX, e.clientY] : [r.left + r.width / 2, r.top + r.height / 2]);
  });
});
$('#hub .hub-intro').addEventListener('click', () => openReader(1));
$('#btn-skip').addEventListener('click', skip);
$('#btn-index').addEventListener('click', () => (body.classList.contains('indexing') ? closeIndex() : openIndex()));
$('.ix-close').addEventListener('click', closeIndex);
$('.rd-close').addEventListener('click', () => closeReader());
$('#btn-sound').addEventListener('click', (e) => {
  const on = !sound.on;
  sound.start();
  sound.setOn(on);
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.querySelector('b').textContent = on ? 'ON' : 'OFF';
});

// ---------- boot ----------
async function boot() {
  scr = await Screen.create($('#gl'));
  window.__film = { scr, st, videos, go };
  scr.onFrame = onFrame;
  const still = await scr.imageTexture(FILMS.intro.rest.replace('end', 'start'));
  scr.show(still, { focus: 0.6, drift: true });
  scr.set('uDim', 0.45);
  scr.setDust(true);
  body.classList.add('booted');

  const t = target();
  const first = video(t.scene === 'hub' ? 'intro' : t.scene);
  const pct = $('#boot-pct');
  const btn = $('#enter');
  const enable = () => {
    if (!btn.disabled) return;
    btn.disabled = false;
    pct.textContent = '100';
    $('#boot-msg').textContent = 'READY';
    body.classList.add('ready');
  };
  const tick = setInterval(() => {
    const d = first.duration;
    const b = first.buffered.length ? first.buffered.end(first.buffered.length - 1) : 0;
    if (d) pct.textContent = String(Math.min(99, Math.round((b / d) * 100))).padStart(3, '0');
    if (first.readyState >= 4 || (d && b >= d - 0.2)) {
      clearInterval(tick);
      enable();
    }
  }, 120);
  setTimeout(enable, 9000);

  const start = (scene, article) => {
    sound.start();
    body.classList.remove('is-boot');
    scr.set('uDim', 0, 0.8);
    const r = btn.getBoundingClientRect();
    go(scene, [r.left + r.width / 2, r.top + r.height / 2], { push: false }).then(() => {
      if (article) openReader(article);
    });
  };
  btn.addEventListener('click', () => start(t.scene, t.article));
  $('#boot-skip').addEventListener('click', () => {
    start('hub');
    setTimeout(openIndex, 2600);
  });
}

boot();
