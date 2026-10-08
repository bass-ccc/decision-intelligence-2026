import * as THREE from 'three';
import { ARTICLES } from '../../assets/js/data.js';
import { Stage } from './core/stage.js';
import { Tour } from './core/tour.js';
import { tier as detectTier, clamp, smooth, lerp, damp, frame as nextFrame } from './core/util.js';
import { DAWN_DIR, stations as buildStations, tourKeys } from './world/layout.js';
import { buildSky } from './world/sky.js';
import { buildCity, shared } from './world/city.js';
import { buildCanal, SIGN_TEXT } from './world/canal.js';
import { buildRain } from './world/rain.js';
import { buildSea } from './world/sea.js';
import { buildNet, computeShell } from './world/net.js';
import { buildThreads } from './world/threads.js';
import { UI } from './ui/ui.js';
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

// every glyph the canvases will draw, so the right slices of Noto Sans TC arrive first
const CANVAS_TEXT =
  Object.values(SIGN_TEXT).map((x) => x[0]).join('') +
  '信任真實記憶代理衡斷文化情境體驗模擬治理注意力義體診所電腦修理網路咖啡茶餐廳港口旅店當舖藥行電子翻譯夜市冰室' +
  '系統份額人心與社群注意力與記憶殼裡的珍珠衡斷力下一步文化暗流願景幻覺沉默抗拒經驗依賴創新落差中層阻塞工具孤兒' +
  '眼睛神經臉皮膚聲音心智之鎖觀察／理解推薦決策行動你的魂紋殼越強，魂在哪裡？讀過的每一篇，都在這裡留下一道紋路。《2026決策智慧》·電通行銷傳播集團' +
  '決策智慧人模型行動信任真實記憶代理衡斷文化情境體驗模擬治理注意力魂殼網潛入同步數據決定判斷選擇相信看見一入中心智';

async function boot() {
  const T = detectTier();
  await step(0.04, '連線義體', '…');
  const stage = new Stage($('#gl'), T);
  const { scene, camera, renderer } = stage;
  camera.layers.enable(1);
  await step(0.08, null, stage.tier.weak ? 'OK · 省電模式' : 'OK');

  // heavy maths off the main thread right away
  const shellP = computeShell(T.voxel);

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
    loadTex('../assets/img/cover/front-holo.png').catch(() => null),
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

  await step(0.34, '城市 · 雨', '…');
  const sky = buildSky(DAWN_DIR);
  scene.add(sky.mesh);
  const city = buildCity({ tier: T, atlasTex, atlas, openerTex, coverTex });
  scene.add(city.group);
  const rain = buildRain(T.rain);
  scene.add(rain.mesh);
  await step(0.44, null, `${city.boxes.length} 棟`);

  await step(0.46, '運河 · 9 塊招牌', '…');
  const canal = buildCanal({ tier: T, boxes: city.boxes, W: stage.W, H: stage.H });
  scene.add(canal.group, canal.under);
  await step(0.56, null, 'OK');

  await step(0.58, '水下 · 5,045 個魂', '…');
  const sea = buildSea({ tier: T });
  scene.add(sea.group, sea.snow, sea.bergHolder);
  await step(0.68, null, 'OK');

  await step(0.7, '深網 · 組裝義體', '…');
  const shell = await shellP;
  const net = buildNet({ tier: T, shell });
  scene.add(net.group);
  await step(0.8, null, `${net.count.toLocaleString()} 塊`);

  const sts = buildStations();
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
  };

  const actions = {
    goKey: (k) => {
      if (S.hero) enter(false);
      tour.goKey(k);
    },
    goStation: (no) => {
      if (S.hero) enter(false);
      tour.goKey(keyOf(no));
    },
    next: () => (S.hero ? enter(true) : tour.next()),
    prev: () => tour.prev(),
    home: () => goHome(),
    again: () => goHome(),
    toggleSound: () => {
      sound.start();
      sound.set(!sound.on);
      $('#btn-sound').setAttribute('aria-pressed', String(sound.on));
      $('#sound-state').textContent = sound.on ? '開' : '關';
    },
    toggleGhost: (force) => {
      S.ghostOn = force === undefined ? !S.ghostOn : force;
      $('#btn-ghost').setAttribute('aria-pressed', String(S.ghostOn));
      sound.ghost(S.ghostOn);
      if (!S.ghostOn) {
        S.theme = null;
        threads.setTheme(null);
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
        a.download = 'ghost-print-決策智慧2026.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
    },
  };
  const ui = new UI(actions);
  ui.buildGauge(keys, tour.stops);
  ui.buildLabels(sts);

  function enter(fly = true) {
    if (!S.hero) return;
    S.hero = false;
    body.classList.add('in-world');
    sound.start();
    sound.whoosh();
    if (fly) tour.tween(1, 2.6);
    setTimeout(() => ui.toast('滾動往下潛 · 拖曳環顧 · 按住空白鍵開啟魂視'), 1400);
  }
  function goHome() {
    ui.closePanels(true);
    ui.showFinale(false);
    if (S.ghostOn) actions.toggleGhost(false);
    sea.setMode(null);
    tour.jumpKey(0);
    S.hero = true;
    S.camo = 1;
    body.classList.remove('in-world');
  }
  $('#enter').onclick = () => enter(true);

  // ------------------------------------------------------------------ input
  const canvas = $('#gl');
  window.addEventListener(
    'wheel',
    (e) => {
      if (S.panel || e.target.closest('#digest,#index,#reader,#ghost,#card,#finale')) return;
      e.preventDefault();
      if (S.hero) {
        if (e.deltaY > 0) enter(true);
        return;
      }
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      tour.nudge(clamp(d, -160, 160) * 0.0024);
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
  // drag to look around; on touch, vertical swipes dive
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: S.yawT, pitch: S.pitchT, touch: e.pointerType === 'touch', moved: 0, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.touch && Math.abs(dy) > Math.abs(dx) * 1.2) {
      if (S.hero) {
        if (dy < -40) enter(true);
        return;
      }
      tour.nudge(-(e.movementY || 0) * 0.012);
      return;
    }
    S.yawT = clamp(drag.yaw - dx * 0.0032, -0.75, 0.75);
    S.pitchT = clamp(drag.pitch - dy * 0.0026, -0.42, 0.42);
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

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
  };
  setPx();

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
  for (const c of warmCams) {
    renderer.compile(scene, c);
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
    }

    // lens shift: the article stays left of the card
    const wantShift = activeNo && !S.panel && W() > 820 ? 0.3 : 0;
    S.shift = damp(S.shift, wantShift, 3, dt);
    camera.filmOffset = 35 * S.shift * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    camera.updateProjectionMatrix();

    // environment
    const y = camera.position.y;
    const dawn = tour.param('dawn', 0);
    computeEnv(y, dawn);
    const netProg = clamp(tour.s - (gateAI + 1), 0, 6);
    env.awake = smooth(k22, k22 + 1.2, tour.s) * (1 - smooth(k22 + 1.2, k22 + 3, tour.s));

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
    sea.update(t, dt, env, activeNo);
    net.update(t, dt, env, netProg, activeNo);
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
    ui.updatePM(sea.pm.mode, sea.pm.mode === 'persona' ? sea.personaAnchors() : null, camera, w, h, activeNo === 12 && !S.panel);
    if (atFinale && !S.hero && S.dwell > 0.8) {
      if (!ui.finaleOn) ui.showFinale(true, seen, ghostPrint(seen));
    } else if (ui.finaleOn && !atFinale) ui.showFinale(false);
    sound.mix({ rain: env.rain, under: env.u, net: env.net, dawn: env.dawn });

    stage.render(t);
    if (!window.__timeScale && !window.__manual) stage.adapt(dt);
  }

  await step(1, '同步完成', '22 個魂');
  window.__shell = { tour, stage, keys, sts, seen, S, sea, net, ui, actions, bootMs: Math.round(performance.now()) };
  setTimeout(() => {
    body.classList.remove('is-loading');
    $('#enter').disabled = false;
  }, 450);
  loop();
}

boot().catch((err) => {
  console.error(err);
  log.push(['錯誤', String(err && err.message ? err.message : err)]);
  UI.bootLog(log, pct);
});
