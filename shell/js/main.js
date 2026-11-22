import * as THREE from 'three';
import { ARTICLES } from '../../assets/js/data.js';
import { Stage } from './core/stage.js';
import { Tour } from './core/tour.js';
import { createWheelStepper } from './core/wheel.js';
import { tier as detectTier, clamp, smooth, lerp, damp, frame as nextFrame } from './core/util.js';
import { DAWN_DIR, stations as buildStations, tourKeys } from './world/layout.js';
import { buildSky } from './world/sky.js';
import { buildCity, shared } from './world/city.js';
import { buildCanal, SIGN_TEXT } from './world/canal.js';
import { buildRain } from './world/rain.js';
import { buildSea } from './world/sea.js';
import { buildNet } from './world/net.js';
import { buildThreads } from './world/threads.js';
import { pickPoint } from './world/tap.js';
import { UI } from './ui/ui.js';
import { BEATS, hasBeats, PM_AT } from './ui/beats.js';
import { LIGHT } from './ui/beats-src.js';
import { ghostPrint } from './ui/print.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const C = (h) => new THREE.Color(h);

// ------------------------------------------------------------------ boot log
const log = [];
let pct = 0;
async function step(p, line, res) {
  if (line) log.push([line, res || '']);
  else if (res && log.length) log[log.length - 1][1] = res;
  pct = p;
  UI.bootLog(log, pct);
  await nextFrame();
}

// The one number of an article that reads by itself also stands in its scene as a figure of
// light: a neon blade on the canal, a glowing figure under water and in the Net.
// (None with ?beats=0, which shows the stops as they were.)
const LIGHTS = hasBeats(1) ? Object.fromEntries(Object.entries(LIGHT).map(([no, i]) => [no, ARTICLES.find((a) => a.no === Number(no)).stats[i][0]])) : {};

// every glyph the canvases will draw, so the right slices of Noto Sans TC arrive first
const CANVAS_TEXT =
  Object.values(LIGHTS).join('') +
  '0123456789%+.,秒' +
  Object.values(SIGN_TEXT).map((x) => x[0]).join('') +
  '信任真實記憶代理衡斷文化情境體驗模擬治理注意力眼鏡行電腦修理網路咖啡茶餐廳港口旅店當舖藥行電子翻譯夜市冰室' +
  '系統份額人心與社群注意力與記憶蚌裡的珍珠衡斷力下一步文化暗流願景幻覺沉默抗拒經驗倚賴創新落差中層阻塞工具孤兒' +
  '眼睛神經臉皮膚聲音心智之鎖觀察／理解推薦決策行動你的閱讀指紋AI越強，人在哪裡？讀過的每一篇，都在這裡留下一道紋路。《2026決策智慧》·電通行銷傳播集團' +
  '決策智慧人模型行動信任真實記憶代理衡斷文化情境體驗模擬治理注意力心距網潛入同步數據決定判斷選擇相信看見一入中心智';

async function boot() {
  const T = detectTier();
  await step(0.04, '建立連線', '…');
  const stage = new Stage($('#gl'), T);
  const { scene, camera, renderer } = stage;
  camera.layers.enable(1);
  await step(0.08, null, stage.tier.weak ? 'OK · 省電模式' : 'OK');

  await step(0.12, '載入 196 頁與字型', '…');
  const tl = new THREE.TextureLoader();
  const loadTex = async (url) => {
    const t = await tl.loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const [atlasTex, atlas, bill1, bill2, coverTex] = await Promise.all([
    loadTex('../assets/img/atlas.jpg'),
    fetch('../assets/img/atlas.json').then((r) => r.json()),
    loadTex('../assets/img/openers/p006.jpg'),
    loadTex('../assets/img/openers/p012.jpg'),
    loadTex('../assets/img/cover/front.jpg').catch(() => null),
    Promise.all([
      document.fonts.load('900 40px "Noto Sans TC"', CANVAS_TEXT),
      document.fonts.load('700 40px "Noto Sans TC"', CANVAS_TEXT),
      document.fonts.load('500 40px "Noto Sans TC"', CANVAS_TEXT),
      document.fonts.load('300 40px "Chakra Petch"', '0123456789PEOPLE'),
      document.fonts.load('500 40px "Chakra Petch"', 'PEOPLE'),
      document.fonts.load('500 20px "IBM Plex Mono"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·%/'),
      document.fonts.load('400 20px "IBM Plex Mono"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·%/'),
    ]).catch(() => null),
  ]);
  const openerTex = (p) => (p === 6 ? bill1 : bill2);
  await step(0.3, null, 'OK');

  // lights: fixed count for the whole trip, so no shader ever recompiles on the way down
  const hemi = new THREE.HemisphereLight(0x8fa6b8, 0x1a1016, 0.9);
  const keyLight = new THREE.DirectionalLight(0xbfe8e0, 1.1);
  keyLight.position.set(0.3, 1, 0.4);
  scene.add(hemi, keyLight);
  shared.uDawnDir.value.copy(DAWN_DIR);
  shared.uPingM.value = T.reduced ? 0.45 : 1;

  await step(0.34, '城市 · 雨', '…');
  const sky = buildSky(DAWN_DIR);
  scene.add(sky.mesh);
  const city = buildCity({ tier: T, atlasTex, atlas, openerTex, coverTex });
  scene.add(city.group);
  const rain = buildRain(T.rain);
  scene.add(rain.mesh);
  await step(0.44, null, `${city.boxes.length} 棟`);

  await step(0.46, '運河 · 9 塊招牌', '…');
  const canal = buildCanal({ tier: T, boxes: city.boxes, W: stage.W, H: stage.H, lights: LIGHTS });
  scene.add(canal.group, canal.under);
  await step(0.56, null, 'OK');

  await step(0.58, '水下 · 5,045 個人', '…');
  const sea = buildSea({ tier: T, lights: LIGHTS });
  scene.add(sea.group, sea.snow, sea.bergHolder);
  await step(0.68, null, 'OK');

  await step(0.7, '深網 · 佈線', '…');
  const net = buildNet({ tier: T, lights: LIGHTS });
  scene.add(net.group);
  await step(0.8, null, 'OK');

  // Where the article card sits at the bottom (the same 820px rule as shell.css) it covers the lower
  // half, and on any tall screen the head is too wide for the frame: there the stops around the head
  // use cameras that stand further back and look lower. Checked again whenever the window changes.
  const tall = () => window.matchMedia('(max-width: 820px)').matches || window.innerWidth / window.innerHeight < 0.8;
  let portrait = tall();
  const sts = buildStations({ portrait });
  const keys = tourKeys(sts);
  const tour = new Tour(keys);
  const threads = buildThreads(sts);
  scene.add(threads.group);
  const keyOf = (no) => keys.findIndex((k) => k.kind === 'station' && k.no === no);
  const gateAI = keys.findIndex((k) => k.kind === 'gate' && k.chapter === 'ai');
  const k22 = keyOf(22);
  const finaleKey = keys.length - 1;

  // ------------------------------------------------------------------ state
  const sound = new Sound();
  // ?sound=0 opens the site with the sound switched off (for looking at it without noise)
  if (new URLSearchParams(location.search).get('sound') === '0') {
    sound.on = false;
    $('#btn-sound').setAttribute('aria-pressed', 'false');
    $('#sound-state').textContent = '關';
  }
  // the first click, tap or key lets the sound go where the browser was holding it (see Sound.wake)
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, () => sound.wake(true), { capture: true, passive: true });
  // ...and while it is held, the cover says what will let it go (css: body.sound-held .how-sound)
  const soundCue = () => body.classList.toggle('sound-held', sound.on && !!sound.ctx && sound.ctx.state !== 'running');
  sound.onstate = soundCue;
  const seen = new Set();
  const S = {
    hero: true,
    panel: false,
    ghostHeld: false,
    ghostOn: false,
    ghost: 0,
    theme: null,
    yaw: 0,
    pitch: 0,
    yawT: 0,
    pitchT: 0,
    shift: 0,
    flash: 0,
    glitch: 0,
    digit: 0,
    prevY: 100,
    lastKey: -1,
    dwell: 0,
    camo: 1,
    coach: false,
    // reading in place (ui/beats.js): the article whose beats are open (0 = none), and which beat
    beatNo: 0,
    beat: 0,
    beatCoach: 0, // 0 not shown yet, 1 on screen, 2 done
    lift: 0,
    wide: 0,
  };

  const actions = {
    goKey: (k) => {
      if (S.hero) enter(false);
      endCoach();
      wheelSteps.reset();
      tour.goKey(k);
    },
    goStation: (no) => {
      if (S.hero) enter(false);
      endCoach();
      wheelSteps.reset();
      tour.goKey(keyOf(no));
    },
    next: () => stepTour(1),
    prev: () => stepTour(-1),
    beat: (i, fromScroll) => setBeat(i, fromScroll),
    beatStep: (d) => setBeat(S.beat + d),
    beatRead: () => beatRead(),
    home: () => goHome(),
    again: () => goHome(),
    toggleSound: () => {
      sound.start();
      sound.set(!sound.on);
      $('#btn-sound').setAttribute('aria-pressed', String(sound.on));
      $('#sound-state').textContent = sound.on ? '開' : '關';
      soundCue();
    },
    toggleGhost: (force) => {
      S.ghostOn = force === undefined ? !S.ghostOn : force;
      $('#btn-ghost').setAttribute('aria-pressed', String(S.ghostOn));
      sound.ghost(S.ghostOn);
      if (!S.ghostOn) {
        S.theme = null;
        threads.setTheme(null);
        ui.clearTheme();
      }
    },
    setTheme: (theme) => {
      S.theme = theme;
      threads.setTheme(theme);
    },
    peopleModel: (mode) => {
      const m = sea.setMode(mode);
      ui.setPMButtons(m);
      if (m) sound.bell(m === 'wave' ? 2 : m === 'persona' ? 4 : 6);
    },
    panelChanged: (open) => {
      S.panel = open;
    },
    escape: () => {
      if (S.ghostOn) actions.toggleGhost(false);
    },
    savePrint: () => {
      const c = ghostPrint(seen);
      c.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'reading-print-決策智慧2026.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
    },
  };
  const ui = new UI(actions);
  ui.buildGauge(keys, tour.stops);
  ui.buildLabels(sts);

  // phones and tablets get their own words: there is no wheel and no space bar to hold
  const isTouch = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  function enter(fly = true) {
    if (!S.hero || body.classList.contains('is-loading')) return;
    S.hero = false;
    body.classList.add('in-world');
    sound.start();
    // (the cover lets the sound in slowly; if that has not finished, the dive brings it up at once)
    if (sound.on) sound.set(true);
    sound.whoosh();
    if (fly) tour.tween(1, 2.6);
    // the how-to stays on screen until the reader has taken one step, not for a fixed few seconds
    S.coach = fly;
    // (with a mouse, the wheel now means two things: over the scene it dives, over the text it reads.
    // The first hint says both, so the second one is not needed.)
    const both = !isTouch() && hasBeats(1);
    if (fly)
      setTimeout(() => {
        if (!S.coach) return;
        ui.toast(isTouch() ? '往上滑，潛到下一篇' : both ? '在場景上滾動，潛到下一篇 · 在文字上滾動，讀這一篇' : '滾動滑鼠，潛到下一篇 · 拖曳可以環顧', 60000);
        if (both) S.beatCoach = 2;
      }, 1400);
  }
  function endCoach() {
    if (!S.coach) return;
    S.coach = false;
    ui.hideToast();
  }
  // One step along the dive line. Wheel, swipe, keys and buttons all end up here,
  // so one gesture is always exactly one stop.
  function stepTour(dir) {
    if (S.hero) {
      if (dir > 0) enter(true);
      return;
    }
    // the jump off the roof always lands: the tail of the gesture that started it must not push on
    if (dir > 0 && tour.tw && tour.tw.to === tour.stops[1] && tour.tw.t < tour.tw.dur * 0.8) return;
    // the first article is the top of the dive; the cover is one tap away on the logo
    if (dir < 0 && tour.nearestStop(tour.target) <= tour.stops[1]) return;
    endCoach();
    if (dir > 0) tour.next();
    else tour.prev();
  }
  // Reading in place: turn to another beat of the article at this stop. It never moves along the
  // dive line. fromScroll: the reader scrolled the text there, so the text must not be moved again.
  // True if the beat changed.
  function setBeat(i, fromScroll = false) {
    if (!S.beatNo || S.hero) return false;
    const n = clamp(Math.round(i), 0, BEATS - 1);
    if (n === S.beat) return false;
    S.beat = n;
    ui.setBeat(n, { fromScroll });
    beatRead();
    return true;
  }
  // the reader has found how the article is read: the hint is no longer needed
  function beatRead() {
    if (S.beatCoach === 1) ui.hideToast();
    S.beatCoach = 2;
  }
  function goHome() {
    ui.closePanels(true);
    // closePanels(true) is silent, so the "a panel is open" flag is cleared here; left set, it
    // would keep wheel, keys and swipes switched off on the cover
    S.panel = false;
    endCoach();
    wheelSteps.reset();
    ui.showFinale(false);
    if (S.ghostOn) actions.toggleGhost(false);
    sea.setMode(null);
    tour.jumpKey(0);
    S.hero = true;
    S.camo = 1;
    // a ping that is still playing ends here: nothing of it is drawn on the cover
    pg.on = false;
    pg.k = 0;
    body.classList.remove('in-world');
  }
  $('#enter').onclick = () => enter(true);

  // ------------------------------------------------------------------ input
  const canvas = $('#gl');
  const finaleEl = $('#finale');
  const ghostEl = $('#ghost');
  // panels that scroll by themselves keep their own wheel and swipes; everything else dives
  const ownScroll = (t) => !!t.closest?.('#digest,#index,#reader,#ghost') || (!!t.closest?.('#finale') && finaleEl.scrollHeight > finaleEl.clientHeight + 1);

  // Stretches in which no frame was drawn (a shader compiling, a resize, a busy GPU). The wheel
  // logic needs them: a page that froze is not a reader who paused. Filled in by loop().
  let frameAt = performance.now();
  const hitches = []; // [from, to] on the performance.now() timeline
  const frozenIn = (from, to) => {
    const p = performance.now();
    let f = 0;
    let end = -Infinity;
    for (const h of hitches) {
      f += Math.max(0, Math.min(to, h[1]) - Math.max(from, h[0]));
      end = h[1];
    }
    // a freeze that is still going on
    if (p - frameAt > 100) f += Math.max(0, Math.min(to, p) - Math.max(from, frameAt, end));
    return f;
  };
  document.addEventListener('visibilitychange', () => (frameAt = performance.now()));

  // One wheel gesture = one stop: see core/wheel.js for how a gesture is told apart.
  const wheelSteps = createWheelStepper({ step: stepTour, blocked: () => S.panel, frozenIn });
  // At a stop that is read in place, the wheel over the text reads the article and the wheel over
  // the scene dives. Wide screen: the text is a column and it scrolls. Narrow: a gesture turns one beat.
  const beatSteps = createWheelStepper({ step: (dir) => setBeat(S.beat + dir), blocked: () => S.panel, frozenIn });
  // Which of the two a wheel event means is settled once per run of events, when the run begins:
  // a trackpad keeps sending for a second after the fingers lift, and the text of the next stop
  // appears under the pointer in that time. The tail of a dive must not scroll that text.
  let wheelAt = -Infinity;
  let wheelReads = false;
  let wheelNo = 0; // the stop a reading run began at: its tail never reads the next stop's text
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || S.panel || ownScroll(e.target)) return;
      const now = e.timeStamp || performance.now();
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      // On a narrow screen the docked text changes height as the beats turn. There "over the text"
      // is the band the tallest beat has filled, so a pointer that has not moved keeps reading.
      const onText =
        !!S.beatNo && !S.hero && (!!e.target.closest?.('#card') || (!ui.beatsScroll() && ui.card.classList.contains('show') && e.clientY >= window.innerHeight - ui.capMax));
      // (a stretch in which the page drew nothing is not a pause of the hand: see frozenIn)
      if (now - wheelAt - frozenIn(wheelAt, now) > 220) {
        wheelReads = onText;
        wheelNo = S.beatNo;
      }
      wheelAt = now;
      if (wheelReads) {
        // a run that began as reading never dives, and never reads another stop's text, not even
        // when the stop is left in the middle of it
        if (!S.beatNo || S.hero || S.beatNo !== wheelNo) {
          e.preventDefault();
          return;
        }
        // inside the column the browser scrolls it; anywhere else it is scrolled from here
        if (ui.beatsScroll() && e.target.closest?.('.bt-panels')) return;
        e.preventDefault();
        if (!d) return;
        if (ui.beatsScroll()) ui.scrollBeats(d);
        else beatSteps.wheel(d, now, e.deltaMode === 1);
        return;
      }
      e.preventDefault();
      if (d) wheelSteps.wheel(d, now, e.deltaMode === 1);
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    if (S.panel || e.target.closest?.('input')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) {
        S.ghostHeld = true;
        sound.ghost(true);
      }
      return;
    }
    // the text column has the focus (wide screen): the keys that scroll it are its own
    if (S.beatNo && !S.hero && ui.beatsScroll() && e.target.closest?.('.bt-panels') && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) return;
    // at a stop that is read in place, left / right turn the beats; past the last one, and back
    // before the first, they step along the dive line as they do everywhere else
    if (S.beatNo && !S.hero && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      if (!setBeat(S.beat + (e.key === 'ArrowRight' ? 1 : -1))) e.key === 'ArrowRight' ? actions.next() : actions.prev();
      return;
    }
    if (S.beatNo && !S.hero && !e.ctrlKey && !e.metaKey && !e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
      const n = Number(e.key);
      if (!setBeat(n)) ui.beatTop(n);
      return;
    }
    // the finale, where the window is too short for it: down and up scroll it first; at its top,
    // up steps back along the dive line as everywhere else
    if (ui.finaleOn && finaleEl.classList.contains('scrolls') && ['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp'].includes(e.key)) {
      const down = e.key === 'ArrowDown' || e.key === 'PageDown';
      const room = down ? finaleEl.scrollHeight - finaleEl.clientHeight - finaleEl.scrollTop : finaleEl.scrollTop;
      if (room > 1) {
        e.preventDefault();
        finaleEl.scrollBy({ top: (down ? 1 : -1) * finaleEl.clientHeight * (e.key.startsWith('Page') ? 0.85 : 0.3) });
        return;
      }
    }
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) {
      e.preventDefault();
      actions.next();
    }
    if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      if (!S.hero) actions.prev();
    }
    if (e.key === 'g' || e.key === 'G') actions.toggleGhost();
    if (e.key === 'Home') goHome();
    if (e.key === 'Enter' && S.hero) enter(true);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      S.ghostHeld = false;
      sound.ghost(false);
    }
  });
  // mouse: drag on the scene to look around
  const lookBy = (g, dx, dy) => {
    S.yawT = clamp(g.yaw - dx * 0.0032, -0.75, 0.75);
    S.pitchT = clamp(g.pitch - dy * 0.0026, -0.42, 0.42);
  };
  // The ping. One click on the scene (the canal, the sea, the Net) sends one pulse out from the
  // clicked point. The point is found by geometry (world/tap.js); the pulse is a sphere that grows
  // from it. The composite pass draws where that sphere meets the picture. The canal's signs and
  // first ring on the water, the sea's snow and fish answer to the same sphere (shared.uPing); the
  // Net's grid and towers and the water's strides follow the pulse's age (shared.uPingA) from the
  // point under the click.
  // The zones differ by numbers only: how long the pulse lives (s), how far it may reach (world
  // units), how wide its wake is (a share of its largest radius), its colour, and what the wake
  // does: [bend the picture, glyph cells, outlines, echo].
  const PING = {
    people: { life: 1.2, reach: 30, wake: 0.45, col: '#8ff5d2', fx: [1, 0, 0.4, 0] },
    model: { life: 1.5, reach: 36, wake: 0.8, col: '#a6efe6', fx: [0.7, 0, 1, 1] },
    ai: { life: 1.15, reach: 36, wake: 0.34, col: '#7fd8ea', fx: [0, 1, 0.5, 0] },
  };
  const pg = { on: false, p: new THREE.Vector3(), age: 0, life: 1, band: 1, rmax: 1, deep: 0, r: 0, k: 0, chapter: '', hit: '' };
  const caster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function ping(cx, cy) {
    // only at an article stop of those three zones, with the picture at rest and nothing over it
    // (the threads view redraws the whole picture as glyph cells: no ping into that either)
    if (S.hero || S.panel || S.camo > 0.05 || S.digit > 0.05 || S.ghost > 0.05) return false;
    const key = tour.activeKey >= 0 ? keys[tour.activeKey] : null;
    const z = key && key.kind === 'station' ? PING[key.chapter] : null;
    if (!z || Math.abs(tour.target - tour.s) > 0.05) return false;
    // one pulse at a time: the next one waits until this one has all but faded
    if (pg.on && pg.k > 0.15) return false;
    // Not where words stand on the scene and let the pointer through to it (the hint, the zone's
    // name, the status line, article 12's own figures and voices): a click there is on the words.
    for (const el of document.querySelectorAll('#pm .show, #toast.show, #zone, #status')) {
      const r = el.getBoundingClientRect();
      // (words that are not drawn or are faded out, as the zone's name is on a narrower window
      // while a stop is read, are not in the way)
      if (!r.width || +getComputedStyle(el).opacity < 0.05) continue;
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return false;
    }
    // (the canvas's own box, not the window's: on a phone the two can differ by the browser's bar)
    const box = canvas.getBoundingClientRect();
    ndc.set(((cx - box.left) / box.width) * 2 - 1, 1 - ((cy - box.top) / box.height) * 2);
    caster.setFromCamera(ndc, camera);
    const { hit, dist } = pickPoint(caster.ray, key.chapter, pg.p);
    Object.assign(pg, { on: true, age: 0, r: 0, k: 0, life: z.life, chapter: key.chapter, hit });
    // well short of the camera; smaller where motion is reduced; and smaller on a tall, narrow
    // screen, so that the ring fits its width
    pg.rmax = clamp(0.42 * dist, 5, z.reach) * (T.reduced ? 0.7 : 1) * clamp(camera.aspect * 1.3, 0.55, 1);
    pg.band = pg.rmax * z.wake;
    // The composite takes everything deeper than the point as one flat sheet (see stage.js), so
    // that there is always a ring round the cursor. The canal's water is the one thing that is
    // surely where the pick says it is: there the pulse keeps its true shape and its ring lies on
    // the water.
    pg.deep = hit === 'water' ? pg.rmax : 0;
    // the zone's own matter answers too: strides across the water where the water was clicked (in
    // a direction that only the spot decides), the sea's thing where one was clicked; and a note
    canal.tap(hit === 'water' ? (T.reduced ? 1 : 2) : 0, (pg.p.x * 12.9898 + pg.p.z * 78.233) % 6.2832);
    sea.tap(hit, T.reduced ? 0.5 : 1);
    sound.ping(key.chapter);
    // What each kind of machine draws. A phone: the line (with its echo in the sea, which costs
    // nothing) and the bend: one depth read per pixel, nothing else. Every desktop, the weak ones
    // too: all of it (measured on an integrated
    // GPU, the wake's cells cost what its outlines cost, about a millisecond while it plays).
    // Where motion is reduced: half the bend, and the cells stand still (uPingSeed, in tick).
    let [bend, cells, edge, echo] = z.fx;
    if (T.mobile) {
      bend = Math.max(bend, cells ? 0.6 : 0);
      cells = edge = 0;
    }
    if (T.reduced) bend *= 0.5;
    stage.u.uPingFx.value.set(bend, cells, edge, echo);
    stage.u.uPingCol.value.set(z.col);
    return true;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, y: e.clientY, yaw: S.yawT, pitch: S.pitchT, t: performance.now(), far: 0, btn: e.button };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.far = Math.max(drag.far, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    lookBy(drag, e.clientX - drag.x, e.clientY - drag.y);
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', (e) => {
    const g = drag;
    endDrag();
    // A press that went nowhere and was soon let go is a click, not a look: the few pixels it
    // did travel are given back to the camera, and the scene answers with a ping.
    if (g && g.btn === 0 && g.far < 5 && performance.now() - g.t < 400) {
      S.yawT = g.yaw;
      S.pitchT = g.pitch;
      ping(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointercancel', endDrag);

  // touch and pen: one swipe = one stop, started anywhere that does not scroll by itself
  // (the card included: on a phone it fills the thumb's half of the screen).
  // The first 12 px decide what the finger is doing: up / down dives, sideways looks around,
  // or, when it began on the text of a stop that is read in place, turns to the next beat.
  // Positions are tracked here by hand; movementY is not reliable for touch on every browser.
  let sw = null;
  let eatClick = 0;
  window.addEventListener('pointerdown', (e) => {
    eatClick = 0;
    if (e.pointerType === 'mouse') return;
    if (!e.isPrimary) {
      // a second finger: this is a pinch, not a swipe, and it must not turn into a step
      if (sw && sw.axis === 'y') tour.release();
      sw = null;
      return;
    }
    sw = null;
    if (S.panel || ownScroll(e.target) || (ui.beatsScroll() && !!e.target.closest?.('.bt-panels'))) return;
    const turn = !!S.beatNo && !!e.target.closest?.('#card');
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: '', look: e.target === canvas, turn, yaw: S.yawT, pitch: S.pitchT, done: false, reach: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x;
    const dy = e.clientY - sw.y;
    if (!sw.axis) {
      if (Math.hypot(dx, dy) < 12) return;
      sw.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
    }
    if (sw.axis === 'x') {
      if (sw.look) lookBy(sw, dx, dy);
      return;
    }
    sw.reach = Math.max(sw.reach, Math.abs(dy));
    if (sw.done) return;
    if (S.hero) {
      if (dy < -40) {
        sw.done = true;
        enter(true);
      }
      return;
    }
    // lean with the finger, but never far enough to leave the stop
    tour.peek(clamp(-dy / 500, -0.2, 0.2));
  });
  const endSwipe = (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const g = sw;
    sw = null;
    // An up / down swipe is never also a tap: if it began on a button, the click that some
    // browsers still send afterwards is dropped (see the click listener below). 24 px is the
    // shortest travel that can be a step; a thumb that only rolled less than that still taps.
    const reach = Math.max(g.reach, Math.abs(e.clientY - g.y));
    if (g.axis === 'y' && (g.done || reach >= 24)) eatClick = performance.now() + 400;
    const ms = Math.max(1, performance.now() - g.t);
    // sideways on the text: the next (or the previous) beat of this article. Same travel as a step.
    if (g.axis === 'x' && g.turn) {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) >= 24) eatClick = performance.now() + 400;
      if (e.type === 'pointerup' && (Math.abs(dx) >= 56 || (Math.abs(dx) >= 24 && Math.abs(dx) / ms > 0.45))) setBeat(S.beat + (dx < 0 ? 1 : -1));
      return;
    }
    // a tap on the scene (no travel, soon lifted) pings it, as a mouse click does
    if (!g.axis && g.look && e.type === 'pointerup' && ms < 300) ping(e.clientX, e.clientY);
    if (g.axis !== 'y' || g.done || S.hero) return;
    const dy = e.clientY - g.y;
    // far enough, or short but quick (a flick)
    const far = Math.abs(dy) >= 56 || (Math.abs(dy) >= 24 && Math.abs(dy) / ms > 0.45);
    tour.release();
    if (e.type === 'pointerup' && far) stepTour(dy < 0 ? 1 : -1);
  };
  window.addEventListener('pointerup', endSwipe);
  window.addEventListener('pointercancel', endSwipe);
  window.addEventListener(
    'click',
    (e) => {
      if (performance.now() >= eatClick) return;
      eatClick = 0;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );

  // ------------------------------------------------------------------ resize
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const setPx = () => {
    const px = renderer.getPixelRatio() * (H() / 900);
    sea.setPx(px);
    net.setPx(px);
  };
  stage.onResize = (w, h) => {
    canal.resize(stage.W, stage.H);
    setPx();
    city.fit(w / h);
    // a phone turned on its side (or a window dragged narrow): move the head's cameras to the
    // set made for that shape. The dive line reads these same vectors, so it follows at once.
    if (tall() !== portrait) {
      portrait = !portrait;
      tourKeys(buildStations({ portrait })).forEach((k, i) => {
        keys[i].cam.copy(k.cam);
        keys[i].look.copy(k.look);
      });
    }
  };
  setPx();
  city.fit(W() / H());

  // ------------------------------------------------------------------ environment by depth
  const col = {
    night: C('#070b10'),
    dawn: C('#a8898f'),
    seaTop: C('#0c4242'),
    seaDeep: C('#031519'),
    net: C('#010407'),
  };
  const fogC = new THREE.Color();
  const tmpC = new THREE.Color();
  const env = { dawn: 0, sky: 1, cityVis: true, reflect: true, under: false, rain: 1, seaVis: false, bergVis: true, netVis: false, awake: 0 };
  function computeEnv(y, dawn) {
    const u = smooth(0.4, -1.5, y);
    const deep = smooth(-8, -150, y);
    const nt = smooth(-172, -250, y);
    env.dawn = dawn;
    env.u = u;
    env.net = nt;
    env.under = y < 0;
    env.sky = y > -0.5 ? 1 : 0;
    env.cityVis = y > -1.5;
    env.reflect = y > 0.3;
    env.seaVis = y < 1 && y > -300;
    env.bergVis = y > -300;
    env.netVis = y < -110;
    env.rain = (1 - u) * (1 - smooth(0.05, 0.5, dawn));
    // fog colour + density
    fogC.copy(col.night).lerp(col.dawn, dawn);
    tmpC.copy(col.seaTop).lerp(col.seaDeep, deep);
    fogC.lerp(tmpC, u);
    fogC.lerp(col.net, nt);
    scene.fog.color.copy(fogC);
    scene.background.copy(fogC);
    scene.fog.density = lerp(lerp(lerp(0.0026, 0.0006, dawn), lerp(0.021, 0.015, deep), u), 0.0022, nt);
    // grade
    const U = stage.u;
    U.uExposure.value = lerp(lerp(lerp(1.0, 1.08, dawn), 1.25, u), 1.05, nt);
    U.uLift.value.set(lerp(lerp(lerp(0.012, 0.03, dawn), 0.0, u), 0.0, nt), lerp(lerp(lerp(0.02, 0.02, dawn), 0.035, u), 0.015, nt), lerp(lerp(lerp(0.028, 0.025, dawn), 0.04, u), 0.022, nt));
    U.uGain.value.set(lerp(lerp(lerp(1.0, 1.05, dawn), 0.82, u), 0.92, nt), lerp(lerp(0.99, 1.02, u), 1.0, nt), lerp(lerp(lerp(1.02, 0.97, dawn), 1.0, u), 1.05, nt));
    U.uSat.value = lerp(lerp(1.05, 0.85, u), 0.95, nt);
    U.uBloom.value = lerp(lerp(0.75, 0.6, u), 0.85, nt);
    U.uBloom2.value = lerp(lerp(0.55, 0.45, u), 0.6, nt);
    U.uWater.value = u * (1 - nt);
    U.uLensRain.value = env.rain * 0.5 * (S.hero ? 0.6 : 1);
    return env;
  }

  // ------------------------------------------------------------------ warm up: compile every shader with everything visible
  await step(0.86, '編譯著色器', '…');
  const warmCams = [keys[0], keys[keyOf(6)], keys[keyOf(12)], keys[keyOf(17)]].map((k) => {
    const c = camera.clone();
    c.position.copy(k.cam);
    c.lookAt(k.look);
    c.updateMatrixWorld();
    return c;
  });
  [city.group, canal.group, canal.under, sea.group, sea.snow, sea.bergHolder, net.group, threads.group, rain.mesh, sky.mesh].forEach((o) => (o.visible = true));
  // The scene is always drawn into the stage's own target, never straight to the screen, and three
  // keeps a different program for each (the output colour space is part of a program's key). So
  // the target is bound while compiling: otherwise these would be programs no frame ever uses, and
  // the real ones would compile one by one on the way down, each a hitch on first sight.
  for (const c of warmCams) {
    renderer.setRenderTarget(stage.sceneRT);
    renderer.compile(scene, c);
    renderer.setRenderTarget(null);
    await nextFrame();
  }
  await step(0.94, null, 'OK');

  // ------------------------------------------------------------------ loop
  tour.jumpKey(0);
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upV = new THREE.Vector3(0, 1, 0);
  let lastActiveNo = 0;
  let vt = 0;
  window.__vclock = () => vt * 1000;

  function loop() {
    requestAnimationFrame(loop);
    // note every stretch without a frame, for the wheel logic (see frozenIn)
    const p = performance.now();
    if (p - frameAt > 100) {
      hitches.push([frameAt, p]);
      if (hitches.length > 4) hitches.shift();
    }
    frameAt = p;
    const rawDt = clock.getDelta();
    // window.__manual hands the clock to a recorder that steps one exact frame at a time
    if (window.__manual) return;
    tick(Math.min(0.05, rawDt * (window.__timeScale || 1)));
  }
  window.__stepFrame = (dt) => tick(dt);

  function tick(dt) {
    vt += dt;
    const t = vt;
    // the surfacing is one long, unbroken flight up through every layer
    if (!tour.tw && tour.target === finaleKey && tour.s < k22 + 0.6 && tour.s > k22 - 0.6) tour.tween(finaleKey, 8.5);
    tour.update(dt);

    // camera: the dive line + look-around + a breath of sway
    const y0 = tour.pos.y;
    const underK = y0 < 0 ? 1 : 0;
    camera.position.copy(tour.pos);
    camera.position.x += Math.sin(t * 0.37) * (0.12 + underK * 0.5);
    camera.position.y += Math.sin(t * 0.51) * (0.08 + underK * 0.4);
    const moving = Math.abs(tour.target - tour.s) > 0.05;
    if (moving) {
      S.yawT = damp(S.yawT, 0, 1.2, dt);
      S.pitchT = damp(S.pitchT, 0, 1.2, dt);
    }
    S.yaw = damp(S.yaw, S.yawT, 6, dt);
    S.pitch = damp(S.pitch, S.pitchT, 6, dt);
    fwd.subVectors(tour.look, tour.pos);
    const dist = fwd.length();
    fwd.normalize();
    fwd.applyAxisAngle(upV, S.yaw);
    right.crossVectors(fwd, upV).normalize();
    fwd.applyAxisAngle(right, S.pitch);
    tmp.copy(camera.position).addScaledVector(fwd, dist);
    camera.lookAt(tmp);

    // which stop are we at?
    const ak = tour.activeKey;
    const key = ak >= 0 ? keys[ak] : null;
    const activeNo = key && key.kind === 'station' ? key.no : 0;
    const atFinale = key && key.kind === 'finale';
    if (ak !== S.lastKey) {
      S.lastKey = ak;
      S.dwell = 0;
      if (key && !S.hero) {
        if (key.kind === 'station') sound.bell(key.no);
        if (key.kind === 'gate') sound.drum(1);
      }
      if (activeNo !== 12 && sea.pm.mode) {
        sea.setMode(null);
        ui.setPMButtons(null);
      }
    }
    S.dwell += dt;
    if (activeNo && S.dwell > 0.6 && !seen.has(activeNo) && !S.hero) {
      seen.add(activeNo);
      ui.markIndex(seen);
    }
    if (activeNo !== lastActiveNo) {
      lastActiveNo = activeNo;
      canal.setActive(activeNo);
      city.setActive(hasBeats(activeNo) ? activeNo : 0);
    }
    // reading in place: every arrival starts at the opening beat
    const beatNo = activeNo && !S.hero && hasBeats(activeNo) ? activeNo : 0;
    if (beatNo !== S.beatNo) {
      S.beatNo = beatNo;
      S.beat = 0;
      // only the number: the text of the stop being left fades out as it was, and the next
      // arrival builds its text at this beat
      ui.beat = 0;
      if (S.beatCoach === 1) {
        S.beatCoach = 0;
        ui.hideToast();
      }
    }
    // article 12: reading a key point shows the mode of the scene that the point is about
    if (beatNo === 12) sea.setModeTo(PM_AT[S.beat]);
    // how to turn the beats, said once, after the reader has had a moment to look
    if (beatNo && S.beatCoach === 0 && !S.coach && !S.panel && S.dwell > 1.6) {
      S.beatCoach = 1;
      ui.toast(!isTouch() ? '滑鼠移到文字上，滾動讀這一篇' : ui.beatsScroll() ? '在文字上上下滑，讀這一篇' : '在文字上左右滑，讀這一篇', 60000);
    }

    // Where the text of a stop read in place sits at the bottom of a narrow screen, the open part
    // of the frame is small and the thing the stop is about is wide. The lens widens (that costs
    // no distance, so no fog, unlike stepping back) and the picture is lifted into the open part.
    // (Not at the head in the Net, stops 17-22: those have cameras of their own for this shape of
    // screen, which already stand back and look lower. See layout.js.)
    const docked = beatNo && beatNo < 17 && !S.panel && W() <= 820;
    S.wide = damp(S.wide, docked ? 1 : 0, 3, dt);
    S.lift = damp(S.lift, docked ? ui.cardLift() : 0, 3, dt);
    camera.fov = 50 + 18 * S.wide;
    // Lens shift: the thing the stop is about stays left of the text. Where the stop is read in
    // place the text block takes close to half of a wide window (shell.css: --bt-w and #card's
    // right, repeated here), so the shift follows the block's share of the width and the thing
    // stands in the middle of what is left open. 0.3 is the least, as it was for the old card.
    // (min(aspect, 1): three.js measures the film's width on the shorter side of a tall window.)
    const share = beatNo ? (Math.min(640, 0.45 * W()) + clamp(0.055 * W(), 52, 84)) / W() : 0;
    const wantShift = activeNo && !S.panel && W() > 820 ? clamp(0.9 * share * Math.min(camera.aspect, 1), 0.3, 0.5) : 0;
    S.shift = damp(S.shift, wantShift, 3, dt);
    camera.filmOffset = 35 * S.shift * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    if (S.lift > 0.5) camera.setViewOffset(W(), H(), 0, S.lift, W(), H());
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();

    // environment
    const y = camera.position.y;
    const dawn = tour.param('dawn', 0);
    computeEnv(y, dawn);
    const netProg = clamp(tour.s - (gateAI + 1), 0, 6);
    // The shell wakes as the reader leaves it. This has to happen in the first second of the
    // surfacing flight: after about 1.5 s the head has already slid out of the frame.
    // Only a real departure counts (the dive line is headed past the stop): a finger that leans
    // on the stop and lets go must not wake the head and drop it again.
    env.awake = tour.settled > k22 ? smooth(k22 + 0.002, k22 + 0.04, tour.s) : 0;

    // crossings: the water line, the Net
    if ((S.prevY > 0) !== (y > 0) && !S.hero) {
      S.flash = 0.55;
      S.glitch = Math.max(S.glitch, 0.35);
      sound.splash();
    }
    if ((S.prevY > -205) !== (y > -205) && !S.hero) {
      S.digit = 1;
      S.glitch = 1;
      sound.glitch();
    }
    S.prevY = y;
    S.flash = damp(S.flash, 0, 3.2, dt);
    S.glitch = damp(S.glitch, 0, 2.6, dt);
    S.digit = damp(S.digit, 0, 1.4, dt);

    // ghost vision
    const wantGhost = (S.ghostHeld || S.ghostOn) && !S.hero ? 1 : 0;
    S.ghost = damp(S.ghost, wantGhost, 3.5, dt);
    body.classList.toggle('ghost-on', wantGhost > 0.5);
    // a panel that is not shown takes no focus: its X and its chips are not tab stops
    if (ghostEl.inert === wantGhost > 0.5) {
      ghostEl.inert = !wantGhost;
      ghostEl.setAttribute('aria-hidden', String(!wantGhost));
    }

    // optical camouflage on arrival
    if (!body.classList.contains('is-loading')) S.camo = damp(S.camo, 0, 0.9, dt);

    // world
    shared.uTime.value = t;
    shared.uDawn.value = env.dawn;
    sky.mesh.position.copy(camera.position);
    sky.update(t, env);
    city.update(t, env);
    canal.update(t, env);
    rain.update(t, env);
    sea.update(t, dt, env, activeNo, S.beatNo ? S.beat : -1);
    net.update(t, dt, env, netProg, activeNo, camera);
    threads.update(t, dt, S.ghost);
    hemi.intensity = lerp(lerp(0.9, 1.6, env.dawn), 0.7, env.u);
    keyLight.intensity = lerp(1.1, 0.9, env.u) + env.dawn * 1.2;

    // post
    const U = stage.u;
    const speed = Math.abs(tour.target - tour.s);
    U.uCA.value = 0.35 + env.u * 0.35 + Math.min(1.2, speed * 0.5) + S.glitch * 1.5;
    U.uGlitch.value = S.glitch;
    U.uGhost.value = S.ghost;
    U.uDigit.value = S.digit * S.digit;
    U.uGhostCol.value.set(S.digit > S.ghost ? '#6fcde2' : '#68f0c4');
    U.uGlyphRow.value = env.net > 0.5 ? 1 : 0;
    U.uFlash.value = S.flash;
    U.uFlashCol.value.set(y > 0 ? '#d8fff6' : '#9fe8e0');
    U.uCamo.value = S.camo;
    U.uScan.value = 0.6 + env.net * 0.6;
    U.uPitch.value = Math.asin(clamp(camera.getWorldDirection(tmp).y, -1, 1));
    // The ping (here, after the line above: from there on the camera's matrices are this frame's).
    // It grows fast and slows; it fades over its last two fifths; a dive that begins hurries it out.
    if (pg.on) {
      pg.age += dt * (moving ? 4 : 1);
      const a = pg.age / pg.life;
      if (a >= 1) pg.on = false;
      pg.k = pg.on ? Math.min(1, pg.age / 0.08) * (1 - smooth(0.6, 1, a)) : 0;
      pg.r = pg.rmax * (1 - Math.exp(-3.4 * a));
    }
    shared.uPingK.value = U.uPingK.value = pg.k;
    if (pg.on) {
      shared.uPing.value.set(pg.p.x, pg.p.y, pg.p.z, pg.r);
      // (A click on the head in the Net: the ring on the floor starts under the head, far below
      // the frame of a wide screen, and would need most of the pulse's life to come into view. It
      // is given a head start there. The tall-screen cameras look down on that floor: none there.)
      shared.uPingA.value = pg.age + (pg.hit === 'head' && !portrait ? 0.7 : 0);
      tmp.copy(pg.p).applyMatrix4(camera.matrixWorldInverse);
      U.uPing.value.set(tmp.x, tmp.y, tmp.z, pg.r);
      const pe = camera.projectionMatrix.elements;
      U.uPingProj.value.set(1 / pe[0], 1 / pe[5], pe[8] / pe[0], pe[9] / pe[5]);
      U.uPingGeo.value.set(Math.max(1, -tmp.z) + pg.deep, pg.band);
      U.uPingSeed.value = T.reduced ? 0 : Math.floor(pg.age * 9);
    }

    // UI
    const w = W();
    const h = H();
    const gate = key && key.kind === 'gate' && !S.hero ? key.chapter : null;
    ui.showCard(S.hero || atFinale ? null : key);
    ui.showGate(gate);
    ui.setZone(y > 55 ? 'intro' : y > -1 ? 'people' : y > -190 ? 'model' : 'ai', env.dawn > 0.5);
    ui.setStatus(y, seen);
    ui.updateGauge(tour.s, ak, y, seen, keys);
    ui.updateLabels(camera, w, h, { hero: S.hero, gate, finale: atFinale, activeNo, ghost: S.ghost > 0.5, theme: S.theme });
    const persona = sea.pm.mode === 'persona';
    ui.updatePM(sea.pm.mode, persona ? sea.personaAnchors() : null, camera, w, h, activeNo === 12 && !S.panel, w > 820 ? w * (1 - share) : w, persona ? sea.personaAnchors(true) : null);
    if (atFinale && !S.hero && S.dwell > 0.8) {
      if (!ui.finaleOn) ui.showFinale(true, seen, ghostPrint(seen));
    } else if (ui.finaleOn && !atFinale) ui.showFinale(false);
    // (the rain is heard in full on the open roof and softer down in the canal, where nine
    // articles are read: 60 m and above = roof, 12 m and below = canal)
    sound.mix({ rain: env.rain * lerp(1, 0.6, smooth(60, 12, y)), under: env.u, net: env.net, dawn: env.dawn });

    stage.render(t);
    if (!window.__timeScale && !window.__manual) stage.adapt(dt);
  }

  await step(1, '同步完成', '22 篇觀點');
  window.__shell = { tour, stage, keys, sts, seen, S, sea, net, city, canal, ui, actions, ping, pg, sound, bootMs: Math.round(performance.now()) };
  setTimeout(() => {
    body.classList.remove('is-loading');
    $('#enter').disabled = false;
    // The city of the cover is on screen: its rain and its voices come in slowly. Where the browser
    // holds a page's sound until the reader's first click or key, they come in at that moment.
    sound.start(2.5);
    // (an engine that is allowed to run takes a moment to say so: the cue waits for that)
    setTimeout(soundCue, 700);
  }, 450);
  loop();
  // the marble head lives in the last zone, minutes away for a reader who starts at the cover:
  // it loads now, in the background. If it fails the Net simply has no head in it.
  net.loadBust().catch((err) => console.warn('The head in the Net could not be loaded.', err));
  // the back cover and the spine of the floating book are not needed to start: they come after
  Promise.all([loadTex('../assets/img/cover/back.jpg').catch(() => null), loadTex('../assets/img/cover/spine.jpg').catch(() => null)]).then(([back, spine]) => city.book.setMaps({ back, spine }));
}

boot().catch((err) => {
  console.error(err);
  log.push(['錯誤', String(err && err.message ? err.message : err)]);
  UI.bootLog(log, pct);
});
