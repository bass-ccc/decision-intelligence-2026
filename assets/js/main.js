import * as THREE from 'three';
import { BOOK, SECTIONS, ARTICLES, THEMES, PEOPLE_MODEL, sectionOf, articleForPage, sectionForPage, themesFor } from './data.js';
import { World, buildLayout } from './world.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad3 = (n) => String(n).padStart(3, '0');
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// All markup below is built from the book's own static data (data.js); every text field passes through esc().
const setHTML = (el, html) => el.replaceChildren(document.createRange().createContextualFragment(html));
const params = new URLSearchParams(location.search);
const body = document.body;
// Motion follows the system setting, but people can switch it on or off (remembered on this device).
let motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const m = localStorage.getItem('di-motion'); if (m) motion = m === 'on'; } catch (e) { /* storage unavailable */ }
if (params.get('motion') === 'full') motion = true;
let reduced = !motion;
function applyMotion() {
  reduced = !motion;
  body.classList.toggle('calm', !motion);
  $$('[data-motion] b').forEach((b) => (b.textContent = motion ? 'ON' : 'OFF'));
  if (window.__world) window.__world.reduced = !motion;
}
applyMotion();
$$('[data-motion]').forEach((b) => b.addEventListener('click', () => {
  motion = !motion;
  try { localStorage.setItem('di-motion', motion ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
  applyMotion();
}));
const THEME_COLORS = ['#C5D96B', '#F2A9A7', '#6FCDE2', '#ECE4D4'];

// pixel numbers "decode" into place, like the book's ASCII dissolve
function scramble(el) {
  const final = el.textContent;
  if (reduced || !final) return;
  const glyphs = ':;+nde#0123456789';
  let n = 0;
  const id = setInterval(() => {
    n++;
    el.textContent = [...final].map((c, i) => (n > 3 + i * 2 ? c : glyphs[(Math.random() * glyphs.length) | 0])).join('');
    if (n > 3 + final.length * 2) { clearInterval(id); el.textContent = final; }
  }, 45);
}
THEMES.forEach((t, i) => (t.color = THEME_COLORS[i % 4]));

const authors = new Set();
ARTICLES.forEach((a) => a.authors.forEach((x) => authors.add(x.zh + x.en)));
$('#hero-authors').textContent = authors.size;

// ------------------------------------------------------------------ loading
const ldBar = $('#ld-bar'), ldPct = $('#ld-pct'), ldNote = $('#ld-note');
let shown = 0;
function setProgress(f, note) {
  const target = Math.round(f * 100);
  shown = Math.max(shown, target);
  const W = 32, filled = Math.round((shown / 100) * W);
  ldBar.textContent = '[' + '#'.repeat(filled) + '.'.repeat(W - filled) + ']';
  ldPct.textContent = pad3(shown) + '%';
  if (note) ldNote.textContent = note;
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) { const b = await res.blob(); onProgress(1); return b; }
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(got / total);
  }
  return new Blob(chunks, { type: 'image/jpeg' });
}

async function boot() {
  setProgress(0.02, 'LOADING TYPE');
  const fontLoads = Promise.race([
    Promise.all([
      document.fonts.load('900 40px "Noto Sans TC"', '決策智慧'),
      document.fonts.load('700 20px Silkscreen', 'A'),
      document.fonts.load('500 20px "IBM Plex Mono"', ':'),
      document.fonts.load('700 20px Montserrat', 'd'),
    ]),
    new Promise((r) => setTimeout(r, 3500)),
  ]).catch(() => {});
  const metaP = fetch('assets/img/atlas.json').then((r) => r.json());
  await fontLoads;
  setProgress(0.18, 'LOADING 196 PAGES');
  const blob = await fetchWithProgress('assets/img/atlas.jpg', (f) => setProgress(0.18 + f * 0.72));
  const url = URL.createObjectURL(blob);
  const atlas = await new THREE.TextureLoader().loadAsync(url);
  const meta = await metaP;
  setProgress(0.95, 'BUILDING THE SPIRAL');

  const layout = buildLayout(meta.pages, ARTICLES, SECTIONS, sectionForPage);
  const world = new World($('#gl'), { atlas, meta, layout, articles: ARTICLES, sections: SECTIONS, articleForPage, reducedMotion: reduced });
  window.__world = world;
  const ui = new UI(world, layout);
  window.__ui = ui;
  setProgress(1, 'READY');
  setTimeout(() => {
    body.classList.remove('is-loading');
    $('#enter').disabled = false;
    if (params.has('skip')) ui.enter();
  }, 350);
}

// ------------------------------------------------------------------ UI
class UI {
  constructor(world, layout) {
    this.world = world;
    this.layout = layout;
    this.zone = null;
    this.page = 1;
    this.overlay = null;
    this.theme = null;
    this.buildTimeline();
    this.buildIndex();
    this.renderChips();
    this.buildLabels();
    this.bind();
  }

  // ---------------------------------------------------------------- lifecycle
  enter() {
    if (this.entered) return;
    this.entered = true;
    body.classList.add('is-journey');
    this.world.unfold();
  }

  bind() {
    const w = this.world;
    $('#enter').addEventListener('click', () => this.enter());
    w.addEventListener('unfold-end', () => {
      body.classList.add('is-ready', 'mode-journey');
      w.inputEnabled = true;
      const touch = window.matchMedia('(hover: none)').matches;
      this.toast(touch ? '左右滑動前進　點頁面閱讀' : '滾動或拖曳前進　<kbd>←</kbd><kbd>→</kbd> 切換文章　點頁面閱讀');
    });
    w.addEventListener('zone', (e) => this.onZone(e.detail));
    w.addEventListener('page', (e) => this.onPage(e.detail.page));
    w.addEventListener('progress', (e) => this.onProgress(e.detail.f));
    w.addEventListener('hover', (e) => this.onHover(e.detail.page));
    w.addEventListener('pick', (e) => this.onPick(e.detail));
    w.addEventListener('section', (e) => this.setSec(e.detail.section));
    w.addEventListener('mode', (e) => {
      body.classList.remove('mode-journey', 'mode-map', 'mode-data');
      body.classList.add('mode-' + e.detail.mode);
      $('#btn-map').classList.toggle('on', e.detail.mode === 'map');
    });
    w.addEventListener('frame', () => this.onFrame());

    $('#btn-index').addEventListener('click', () => this.openIndex());
    $('#btn-map').addEventListener('click', () => (w.mode === 'map' ? this.closeMap() : this.openMap()));
    $('#brand').addEventListener('click', () => { this.closeAll(); if (w.mode !== 'journey') this.setMode('journey'); w.goToAnchor(0); });
    $('#tl-prev').addEventListener('click', () => w.step(-1));
    $('#tl-next').addEventListener('click', () => w.step(1));
    $('#dg-close').addEventListener('click', () => this.closeDigest());
    $('#dv-close').addEventListener('click', () => this.setMode('journey'));
    $$('#index [data-close]').forEach((b) => b.addEventListener('click', () => this.closeIndex()));
    $('#rd-close').addEventListener('click', () => this.closeReader());
    $('#rd-prev').addEventListener('click', () => this.readerStep(-1));
    $('#rd-next').addEventListener('click', () => this.readerStep(1));
    $('#rd-range').addEventListener('input', (e) => this.showPages(+e.target.value, 0));
    $('#hud').addEventListener('click', (e) => this.onAction(e));
    $('#digest').addEventListener('click', (e) => this.onAction(e));
    $('#map-result').addEventListener('click', (e) => this.onAction(e));

    // reader swipe
    let sx = null;
    $('#rd-stage').addEventListener('pointerdown', (e) => (sx = e.clientX));
    $('#rd-stage').addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) this.readerStep(dx < 0 ? 1 : -1);
    });

    window.addEventListener('keydown', (e) => this.onKey(e));
    // on the cover, a scroll or an upward swipe opens the book
    window.addEventListener('wheel', (e) => {
      if (!this.entered && !$('#enter').disabled && e.deltaY > 12) this.enter();
    }, { passive: true });
    let ty = null;
    window.addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (ty !== null && !this.entered && !$('#enter').disabled && ty - e.touches[0].clientY > 50) { ty = null; this.enter(); }
    }, { passive: true });
    this.bindCursor();
  }

  onKey(e) {
    const w = this.world;
    if (e.key === 'Escape') {
      if (this.overlay === 'reader') return this.closeReader();
      if (this.overlay) return this.closeAll();
      if (w.mode === 'map') return this.closeMap();
      if (w.mode === 'data') return this.setMode('journey');
      return;
    }
    if (this.overlay === 'reader') {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.readerStep(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.readerStep(-1);
      return;
    }
    if (this.overlay) return;
    if (!this.entered) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.enter(); } return; }
    if (w.mode !== 'journey' || !w.inputEnabled) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); w.step(1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); w.step(-1); }
    if (e.key === 'Home') w.goToAnchor(0);
    if (e.key === 'End') w.goToAnchor(this.layout.anchors.length - 1);
    if (e.key === 'Enter' && this.zone && this.zone.type === 'article') this.openDigest(this.zone.article);
  }

  setMode(m) {
    if (m !== 'map' && this.world.mode === 'map') {
      this.world.setTheme(null);
      this.theme = null;
      this.renderChips();
      $('#map-result').replaceChildren();
    }
    this.world.setMode(m);
    if (m === 'journey') this.setSec(this.world.sectionAt(this.world.sTarget));
  }

  closeAll() { this.closeDigest(); this.closeIndex(); this.closeReader(); }
  lockInput() { this.world.inputEnabled = !this.overlay; }

  toast(html, ms = 5200) {
    const t = $('#toast');
    setHTML(t, html);
    t.classList.add('on');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('on'), ms);
  }

  setSec(id) {
    const s = sectionOf(id);
    if (s) { document.documentElement.style.setProperty('--sec', s.color); this.world.setTint(s.color); }
    $$('.tl-seg').forEach((el) => el.classList.toggle('on', el.dataset.sec === id));
  }

  // ---------------------------------------------------------------- actions
  onAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const w = this.world;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === 'digest') this.openDigest(+v);
    if (act === 'read') this.openReader(+v);
    if (act === 'data') { this.closeDigest(); w.goToArticle(12); w.sCur = w.sTarget; this.setMode('data'); }
    if (act === 'next') w.step(1);
    if (act === 'index') this.openIndex();
    if (act === 'map') this.openMap(v || null);
    if (act === 'top') { this.closeAll(); w.goToAnchor(0); }
    if (act === 'goart') { this.closeAll(); if (w.mode !== 'journey') this.setMode('journey'); w.goToArticle(+v); }
    if (act === 'gosec') {
      this.closeAll();
      const a = this.layout.anchors.find((x) => x.type === 'gate' && x.section === v)
        || this.layout.anchors.find((x) => x.type === 'article' && ARTICLES.find((y) => y.no === x.article).section === v);
      if (a) w.goToS(a.s);
    }
    if (act === 'theme') this.openMap(v);
  }

  // ---------------------------------------------------------------- HUD
  onZone(z) {
    this.zone = z;
    const hud = $('#hud');
    const html = this.hudHTML(z);
    const old = hud.firstElementChild;
    const swap = () => {
      hud.classList.toggle('left', z.type === 'gate' && !this.world.view.mobile);
      setHTML(hud, html);
      const card = hud.firstElementChild;
      $$('.num, .sec-no', hud).forEach((el) => scramble(el));
      if (card) { void card.offsetWidth; setTimeout(() => card.classList.add('in'), 30); }
      this.onPage(this.page);
    };
    if (old) { old.classList.remove('in'); old.classList.add('out'); clearTimeout(this._swap); this._swap = setTimeout(swap, 240); }
    else swap();
    if (z.type === 'article') this.setSec(ARTICLES.find((a) => a.no === z.article).section);
    if (z.type === 'gate') this.setSec(z.section);
    if (z.type === 'start') this.setSec('intro');
    $$('.tl-tick').forEach((t) => t.classList.toggle('on', z.type === 'article' && +t.dataset.article === z.article));
  }

  splitTitle(t) {
    let i = 0;
    return [...t].map((c) => (c === ' ' ? ' ' : `<span class="ch" style="--i:${i++}">${esc(c)}</span>`)).join('');
  }

  hudHTML(z) {
    if (z.type === 'article') {
      const a = ARTICLES.find((x) => x.no === z.article);
      const s = sectionOf(a.section);
      const tags = themesFor(a.no).map((t) => `<button class="tag" data-act="theme" data-v="${t.id}">${esc(t.zh)}</button>`).join('');
      const au = a.authors.map((x) => `<b>${esc(x.zh)}</b>${x.en ? ' ' + esc(x.en) : ''}`).join('　');
      return `<div class="hud-card">
        <div class="hud-meta"><span class="px">ARTICLE</span><span class="px num">${pad2(a.no)}</span><span class="px">/ 22</span><span class="chip-sec">${esc(s.name)}</span><span class="px" id="hud-pg"></span></div>
        <h2 class="hud-title">${a.kicker ? `<span class="hud-kicker">〈${esc(a.kicker)}〉</span><br>` : ''}${this.splitTitle(a.title)}${a.subtitle ? `<span class="hud-sub">${esc(a.subtitle)}</span>` : ''}</h2>
        <div class="hud-authors">${au}</div>
        <blockquote class="hud-quote">${esc(a.quote)}</blockquote>
        <div class="hud-tags">${tags}</div>
        <div class="hud-actions">
          <button class="btn btn-primary" data-act="digest" data-v="${a.no}" data-cursor="OPEN">閱讀重點 <span class="px">DIGEST</span></button>
          <button class="btn btn-ghost" data-act="read" data-v="${a.start}" data-cursor="READ">翻閱原文 <span class="px">P.${a.start}–${a.end}</span></button>
          ${a.special === 'peopleModel' ? `<button class="btn btn-data" data-act="data" data-cursor="DIVE">◉ 走進 9,221 個驗證點</button>` : ''}
        </div>
      </div>`;
    }
    if (z.type === 'gate') {
      const s = sectionOf(z.section);
      const arts = ARTICLES.filter((a) => a.section === s.id);
      const list = arts.map((a) => `<li><button data-act="goart" data-v="${a.no}"><span class="px">${pad2(a.no)}</span><span>${esc(a.title)}</span><em>P.${a.start}</em></button></li>`).join('');
      return `<div class="hud-card hud-section">
        <div class="hud-meta"><span class="px">SECTION</span><span class="chip-sec">${esc(s.name)}</span><span class="px" id="hud-pg"></span></div>
        <div class="sec-no px">${s.no}</div>
        <div class="sec-name">${esc(s.name)}<small>${esc(s.zh)}</small></div>
        <p class="sec-lead">${esc(s.lead)}</p>
        <ul class="hud-list">${list}</ul>
        <div class="hud-actions"><button class="btn btn-primary" data-act="next">進入章節 <span class="px">ENTER →</span></button></div>
      </div>`;
    }
    if (z.type === 'end') {
      return `<div class="hud-card">
        <div class="hud-meta"><span class="px">EPILOGUE</span><span class="chip-sec">196 / 196</span></div>
        <h2 class="hud-title">${this.splitTitle('謝謝閱讀')}<span class="hud-sub">科技給了我們計算的速度，但唯有人類，能賦予它前行的溫度。</span></h2>
        <div class="hud-authors">—— 周麗君〈真實的力量〉</div>
        <div class="hud-actions">
          <button class="btn btn-primary" data-act="map">看全景 <span class="px">OVERVIEW</span></button>
          <button class="btn btn-ghost" data-act="index">目錄</button>
          <button class="btn btn-ghost" data-act="top">回到開頭</button>
        </div>
      </div>`;
    }
    const secs = SECTIONS.map((s) => {
      const n = ARTICLES.filter((a) => a.section === s.id).length;
      return `<li><button data-act="gosec" data-v="${s.id}" style="--sec:${s.color}"><span class="px">${s.no}</span><span>${esc(s.name)}　${esc(s.zh)}</span><em>${n} 篇</em></button></li>`;
    }).join('');
    return `<div class="hud-card">
      <div class="hud-meta"><span class="px">PROLOGUE</span><span class="chip-sec">${BOOK.year}</span><span class="px" id="hud-pg"></span></div>
      <h2 class="hud-title">${this.splitTitle(BOOK.title)}<span class="hud-sub">${esc(BOOK.motto)}　${esc(BOOK.mottoEn)}</span></h2>
      <blockquote class="hud-quote">當 AI 越來越會做決定，品牌要怎麼更懂人？${authors.size} 位作者、22 篇觀點，從「人」、「模型」到「行動」，回答同一個問題。</blockquote>
      <ul class="hud-list">${secs}</ul>
      <div class="hud-actions">
        <button class="btn btn-primary" data-act="next">開始閱讀 <span class="px">SCROLL →</span></button>
        <button class="btn btn-ghost" data-act="map">全景</button>
      </div>
    </div>`;
  }

  onPage(p) {
    this.page = p;
    $('#tl-page').textContent = 'P.' + pad3(p);
    const el = $('#hud-pg');
    if (el) el.textContent = '· P.' + pad3(p);
  }

  // ---------------------------------------------------------------- timeline
  buildTimeline() {
    const L = this.layout;
    const f = (s) => ((s - L.start) / (L.end - L.start)) * 100;
    const gates = L.anchors.filter((a) => a.type === 'gate');
    const bounds = [L.start, ...gates.map((g) => g.s - 6), L.end];
    setHTML($('#tl-segs'), SECTIONS.map((s, i) => {
      const a = f(bounds[i]), b = f(bounds[i + 1]);
      return `<div class="tl-seg" data-sec="${s.id}" style="left:${a}%;width:${b - a - 0.4}%;--c:${s.color}"><span>${esc(s.name)}</span></div>`;
    }).join(''));
    setHTML($('#tl-ticks'), L.anchors.map((a, i) => {
      if (a.type === 'article') {
        const art = ARTICLES.find((x) => x.no === a.article);
        return `<button class="tl-tick" data-i="${i}" data-article="${a.article}" style="left:${f(a.s)}%;--c:${sectionOf(art.section).color}" aria-label="${esc(art.title)}"></button>`;
      }
      if (a.type === 'gate') return `<button class="tl-tick gate" data-i="${i}" style="left:${f(a.s)}%;--c:${sectionOf(a.section).color}" aria-label="${esc(sectionOf(a.section).name)}"></button>`;
      return '';
    }).join(''));
    const track = $('#tl-track');
    let dragging = false;
    const scrub = (e) => {
      const r = track.getBoundingClientRect();
      this.world.scrubTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    };
    track.addEventListener('pointerdown', (e) => {
      const tick = e.target.closest('.tl-tick');
      if (tick) { this.world.goToAnchor(+tick.dataset.i); return; }
      dragging = true; track.setPointerCapture(e.pointerId); scrub(e);
    });
    track.addEventListener('pointermove', (e) => {
      if (dragging) scrub(e);
      const tick = e.target.closest('.tl-tick');
      if (tick) {
        const a = this.layout.anchors[+tick.dataset.i];
        const label = a.type === 'article'
          ? `<span class="px">${pad2(a.article)}</span>${esc(ARTICLES.find((x) => x.no === a.article).title)}`
          : `<span class="px">SECTION</span>${esc(sectionOf(a.section).name)}`;
        this.showTip(label, e.clientX, e.clientY - 44);
      } else if (!this.hoverPage) this.hideTip();
    });
    track.addEventListener('pointerleave', () => { if (!this.hoverPage) this.hideTip(); });
    track.addEventListener('pointerup', () => { dragging = false; });
  }
  onProgress(f) { $('#tl-head').style.left = f * 100 + '%'; }

  // ---------------------------------------------------------------- hover / pick / cursor
  showTip(html, x, y) {
    const t = $('#tip');
    setHTML(t, html);
    t.style.left = x + 'px'; t.style.top = y + 'px';
    t.classList.add('on');
  }
  hideTip() { $('#tip').classList.remove('on'); }

  pageAction(p) {
    const sl = this.layout.slots[p];
    const w = this.world;
    if (w.mode === 'map') return 'GO';
    if (sl.kind === 'opener' && Math.abs(sl.s - w.sCur) < 3) return 'OPEN';
    if (Math.abs(sl.s - w.sCur) < (sl.kind === 'gate' ? 5 : 3)) return 'READ';
    return 'GO';
  }

  onHover(p) {
    this.hoverPage = p;
    const c = $('#cursor');
    if (!p) { this.hideTip(); c.classList.remove('hot'); return; }
    const a = articleForPage(p);
    this.tipHTML = a
      ? `<span class="px">P.${pad3(p)}</span>${esc(a.title)}`
      : `<span class="px">P.${pad3(p)}</span>${p <= 5 ? '序' : esc(sectionOf(sectionForPage(p)).name)}`;
    c.classList.add('hot');
    c.querySelector('span').textContent = this.pageAction(p);
    if (this.cur) this.showTip(this.tipHTML, this.cur.tx, this.cur.ty);
  }

  onPick({ page, mode }) {
    const w = this.world;
    const sl = this.layout.slots[page];
    if (mode === 'map') {
      this.closeMap();
      const a = articleForPage(page);
      if (a && a.start === page) w.goToArticle(a.no); else w.goToS(sl.s);
      return;
    }
    if (mode === 'data') return;
    const act = this.pageAction(page);
    if (act === 'OPEN') return this.openDigest(articleForPage(page).no);
    if (act === 'READ') return this.openReader(page);
    if (sl.kind === 'opener') w.goToArticle(articleForPage(page).no); else w.goToS(sl.s);
  }

  bindCursor() {
    const c = $('#cursor');
    this.cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
    window.addEventListener('pointermove', (e) => {
      this.cur.tx = e.clientX; this.cur.ty = e.clientY;
      if (this.hoverPage && this.tipHTML && !e.target.closest('#timeline')) this.showTip(this.tipHTML, e.clientX, e.clientY);
    });
    window.addEventListener('pointerdown', () => c.classList.add('down'));
    window.addEventListener('pointerup', () => c.classList.remove('down'));
    document.addEventListener('pointerover', (e) => {
      const b = e.target.closest('button, a, input, summary');
      if (b && !this.hoverPage) { c.classList.add('hot'); c.querySelector('span').textContent = b.dataset.cursor || ''; }
    });
    document.addEventListener('pointerout', (e) => {
      const b = e.target.closest('button, a, input, summary');
      if (b && !this.hoverPage) c.classList.remove('hot');
    });
    const tick = () => {
      this.cur.x += (this.cur.tx - this.cur.x) * 0.25;
      this.cur.y += (this.cur.ty - this.cur.y) * 0.25;
      c.style.transform = `translate(${this.cur.x}px, ${this.cur.y}px)`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------------------------------------------------------------- digest
  openDigest(no) {
    const a = ARTICLES.find((x) => x.no === no);
    if (!a) return;
    const s = sectionOf(a.section);
    const dg = $('#digest');
    dg.style.setProperty('--sec', s.color);
    setHTML($('#dg-body'), this.digestHTML(a, s));
    $('#dg-scroll').scrollTop = 0;
    dg.classList.add('open');
    dg.setAttribute('aria-hidden', 'false');
    this.overlay = 'digest';
    this.lockInput();
    this.setSec(a.section);
  }
  closeDigest() {
    const dg = $('#digest');
    if (!dg.classList.contains('open')) return;
    dg.classList.remove('open');
    dg.setAttribute('aria-hidden', 'true');
    if (this.overlay === 'digest') this.overlay = null;
    this.lockInput();
  }

  thumb(p) {
    const i = p - 1, col = i % 14, row = Math.floor(i / 14);
    return `background-position:${(col / 13) * 100}% ${(row / 13) * 100}%`;
  }

  digestHTML(a, s) {
    const prev = ARTICLES.find((x) => x.no === a.no - 1), next = ARTICLES.find((x) => x.no === a.no + 1);
    const au = a.authors.map((x) => `<div><b>${esc(x.zh)}</b>${x.en ? ' ' + esc(x.en) : ''}　<span>${esc(x.role)}</span></div>`).join('');
    const ins = a.insights.map(([h, p]) => `<li><b>${esc(h)}</b><p>${esc(p)}</p></li>`).join('');
    const stats = a.stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
    const fw = a.framework;
    const fwHTML = fw
      ? `<div class="dg-fw ${fw.grid ? 'grid' : ''}">${fw.items.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>${fw.grid ? '<div class="dg-axes"><span>↑ 上排：主張難證明　下排：主張易證明</span><span>左：需求分歧　右：需求一致 →</span></div>' : ''}`
      : '';
    const tags = themesFor(a.no).map((t) => `<button data-act="theme" data-v="${t.id}">#${esc(t.zh)}<small>${t.articles.length}</small></button>`).join('');
    const pages = [];
    for (let p = a.start; p <= a.end; p++) pages.push(`<button data-act="read" data-v="${p}" data-cursor="READ"><div class="th" style="${this.thumb(p)}"></div><span>P.${pad3(p)}</span></button>`);
    const pm = a.special === 'peopleModel' ? this.pmHTML() : '';
    return `
      <header class="dg-hero">
        <div class="dg-meta"><span class="px">${s.no} · ${esc(s.name)}</span><span class="px">ARTICLE ${pad2(a.no)} / 22 · P.${a.start}–${a.end}</span></div>
        ${a.kicker ? `<div class="dg-kicker">〈${esc(a.kicker)}〉</div>` : ''}
        <h2 class="dg-title">${esc(a.title)}</h2>
        ${a.subtitle ? `<div class="dg-sub">${esc(a.subtitle)}</div>` : ''}
        <div class="dg-authors">${au}</div>
      </header>
      <section class="dg-sec"><div class="dg-h">一句話看懂 · TL;DR</div><p class="dg-tldr">${esc(a.tldr)}</p></section>
      <section class="dg-sec"><div class="dg-h">作者觀點 · QUOTE</div><p class="dg-quote">「${esc(a.quote)}」</p></section>
      <section class="dg-sec"><div class="dg-h">關鍵洞察 · KEY INSIGHTS</div><ol class="dg-ins">${ins}</ol></section>
      <section class="dg-sec"><div class="dg-h">關鍵數字 · BY THE NUMBERS</div><div class="dg-stats">${stats}</div></section>
      ${fw ? `<section class="dg-sec"><div class="dg-h">框架 · FRAMEWORK</div><div class="dg-fw-name">${esc(fw.name)}</div>${fwHTML}${a.closing ? `<p class="dg-closing">${esc(a.closing)}</p>` : ''}</section>` : ''}
      ${pm}
      <section class="dg-sec"><div class="dg-h">主題線索 · THREADS</div><div class="dg-tags">${tags}</div></section>
      <section class="dg-sec"><div class="dg-h">原文頁面 · PAGES</div><div class="dg-thumbs">${pages.join('')}</div>
        <div class="dg-cta" style="margin-top:20px"><button class="btn" data-act="read" data-v="${a.start}">翻閱原文 <span class="px">READ</span></button>${a.special ? '<button class="btn alt" data-act="data">走進 9,221 個驗證點</button>' : ''}</div>
      </section>
      <nav class="dg-foot">
        ${prev ? `<button data-act="goart" data-v="${prev.no}"><span class="px">← PREV ${pad2(prev.no)}</span><b>${esc(prev.title)}</b></button>` : '<span></span>'}
        ${next ? `<button data-act="goart" data-v="${next.no}"><span class="px">NEXT ${pad2(next.no)} →</span><b>${esc(next.title)}</b></button>` : '<span></span>'}
      </nav>`;
  }

  pmHTML() {
    const P = PEOPLE_MODEL;
    const ccs = P.ccs.map((x) => `<span>${esc(x)}</span>`).join('');
    const personas = P.personas.map((p) => `<div class="pm-persona"><h4>${esc(p.name)}<small>台北女性上班族 · ${esc(p.age)}</small></h4><div class="bought">最近買了：${esc(p.bought)}</div><ol>${p.order.map((o) => `<li>${esc(o)}</li>`).join('')}</ol><q>${esc(p.voice)}</q><p>${esc(p.insight)}</p></div>`).join('');
    const cases = P.cases.map(([h, t], i) => `<details ${i === 0 ? 'open' : ''}><summary>${pad2(i + 1)}　${esc(h)}</summary><p>${esc(t)}</p></details>`).join('');
    const experts = P.experts.map((x) => `<li>${esc(x)}</li>`).join('');
    return `
      <section class="dg-sec"><div class="dg-h">CCS 消費者調查八大構面</div><div class="pm-ccs">${ccs}</div>
        <p class="dg-tldr" style="margin-top:14px;font-size:14.5px">全台 15–74 歲、依性別／年齡／地區配額抽樣，每人約 60 分鐘、數百道題。每位真實受訪者展開約 6,900 個資料點，一比一捏塑成 AI Persona。</p></section>
      <section class="dg-sec"><div class="dg-h">每個分身背後，都有一支顧問團隊</div>
        <div class="pm-flow">
          <div class="node"><b>使用者提問</b><span>複合式的商業問題</span></div>
          <div class="arrow">↓ 拆解問題 · 分派任務</div>
          <div class="node super"><b>Super Agent</b><span>專案負責人：拆解、分派、檢核答案品質</span></div>
          <div class="row">
            <div class="node"><b>People Model</b><span>基於 CCS 的消費者模擬</span></div>
            <div class="node"><b>CCS Agent</b><span>回頭檢索原始調查驗證</span></div>
            <div class="node"><b>Deep Research</b><span>網路即時搜索補充脈絡</span></div>
          </div>
          <div class="arrow">↓ 比對・彙整成可追問的回答</div>
          <div class="node"><b>回答使用者</b><span>區分資料支持、模型估計、情境模擬</span></div>
        </div></section>
      <section class="dg-sec"><div class="dg-h">同一件事，兩種決策邏輯</div><div class="pm-personas">${personas}</div>
        <p class="dg-tldr" style="margin-top:14px;font-size:14.5px">十歲之差，一個算值不值，一個避險導向——這就是 People Model 模擬出的「信任門檻」：在行銷動作開始之前，就先看見。</p></section>
      <section class="dg-sec"><div class="dg-h">五個模擬案例 · WHAT IT CAN DO</div><div class="pm-cases">${cases}</div></section>
      <section class="dg-sec"><div class="dg-h">專家看法</div><ul class="pm-experts">${experts}</ul></section>`;
  }

  // ---------------------------------------------------------------- index
  buildIndex() {
    const secs = SECTIONS.map((s) => {
      const items = ARTICLES.filter((a) => a.section === s.id).map((a) => `<li><button data-go="${a.no}"><span class="n">${pad2(a.no)}</span><span class="t">${a.kicker ? `<span class="sp">${esc(a.kicker)}</span>` : ''}${esc(a.title)}${a.subtitle ? `<small>${esc(a.subtitle)}</small>` : ''}</span><span class="pg">${a.start}</span></button></li>`).join('');
      return `<div class="ix-sec" style="--c:${s.color}"><h3><i></i>${esc(s.name)}<span class="px">${s.no} · ${esc(s.zh)}</span></h3><ol>${items}</ol></div>`;
    }).join('');
    setHTML($('#ix-body'), `
      <div class="ix-title"><h2><span>C</span>ONTENT</h2><p>《${BOOK.year} ${esc(BOOK.title)}》· ${esc(BOOK.motto)}<br>點任何一篇，直接飛過去。</p></div>
      <div class="ix-grid">${secs}</div>`);
    $('#ix-body').addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      this.closeIndex();
      if (this.world.mode !== 'journey') this.setMode('journey');
      this.world.goToArticle(+b.dataset.go);
    });
  }
  openIndex() {
    this.closeDigest(); this.closeReader();
    const ix = $('#index');
    ix.classList.add('open'); ix.setAttribute('aria-hidden', 'false');
    this.overlay = 'index'; this.lockInput();
    $('#btn-index').classList.add('on');
  }
  closeIndex() {
    const ix = $('#index');
    if (!ix.classList.contains('open')) return;
    ix.classList.remove('open'); ix.setAttribute('aria-hidden', 'true');
    if (this.overlay === 'index') this.overlay = null;
    this.lockInput();
    $('#btn-index').classList.remove('on');
  }

  // ---------------------------------------------------------------- reader
  openReader(p) {
    this.closeIndex();
    this.readerSingle = this.world.view.mobile;
    const rd = $('#reader');
    rd.classList.add('open'); rd.setAttribute('aria-hidden', 'false');
    this.prevOverlay = this.overlay === 'digest' ? 'digest' : null;
    this.overlay = 'reader'; this.lockInput();
    this.showPages(p, 0);
  }
  closeReader() {
    const rd = $('#reader');
    if (!rd.classList.contains('open')) return;
    rd.classList.remove('open'); rd.setAttribute('aria-hidden', 'true');
    this.overlay = this.prevOverlay && $('#digest').classList.contains('open') ? 'digest' : null;
    this.lockInput();
  }
  spreadFor(p) {
    if (this.readerSingle) return [null, p];
    const left = p % 2 === 0 ? p : p - 1;
    return [left >= 1 ? left : null, left + 1 <= 196 ? left + 1 : null];
  }
  readerStep(d) {
    const [l, r] = this.spreadFor(this.readerPage);
    const p = this.readerSingle ? this.readerPage + d : d > 0 ? (r || l) + 1 : (l || r) - 1;
    if (p < 1 || p > 196) return;
    this.showPages(p, d);
  }
  showPages(p, dir) {
    p = Math.max(1, Math.min(196, p));
    this.readerPage = p;
    const [l, r] = this.spreadFor(p);
    const spread = $('#rd-spread');
    const apply = () => {
      this.fillPage($('#rd-l'), l);
      this.fillPage($('#rd-r'), r);
      $('#rd-l').style.display = this.readerSingle ? 'none' : '';
      spread.style.aspectRatio = this.readerSingle ? '3 / 4' : '1.5 / 1';
      spread.classList.remove('turn-next', 'turn-prev');
    };
    if (dir && !reduced) { spread.classList.add(dir > 0 ? 'turn-next' : 'turn-prev'); setTimeout(apply, 180); } else apply();
    const a = articleForPage(p);
    const sec = sectionOf(a ? a.section : sectionForPage(p));
    $('#reader').style.setProperty('--sec', sec.color);
    $('#rd-kicker').textContent = a ? `${sec.name} · ${pad2(a.no)}` : p <= 5 ? 'PROLOGUE' : p === 196 ? 'CONTACT' : sec.name;
    $('#rd-title').textContent = a ? `${a.title}${a.subtitle ? '　' + a.subtitle : ''}` : `${BOOK.year} ${BOOK.title}`;
    $('#rd-range').value = p;
    $('#rd-count').textContent = (l && r && !this.readerSingle ? `${pad3(l)}–${pad3(r)}` : pad3(r || l)) + ' / 196';
  }
  fillPage(fig, p) {
    const img = fig.querySelector('img');
    fig.classList.toggle('blank', !p);
    img.classList.remove('ok');
    if (!p) { img.removeAttribute('src'); fig.style.backgroundImage = 'none'; return; }
    fig.style.backgroundImage = '';
    const [x, y] = this.thumb(p).replace('background-position:', '').split(' ');
    fig.style.backgroundPosition = `${x} ${y}`;
    img.alt = `第 ${p} 頁`;
    img.onload = () => img.classList.add('ok');
    img.src = `assets/img/pages/p${pad3(p)}.jpg`;
    // warm the next spread
    [p + 2, p + 3].forEach((q) => { if (q <= 196) { const i = new Image(); i.src = `assets/img/pages/p${pad3(q)}.jpg`; } });
  }

  // ---------------------------------------------------------------- map / threads
  renderChips() {
    setHTML($('#map-chips'), THEMES.map((t) => `<button class="map-chip ${this.theme === t.id ? 'on' : ''}" data-theme="${t.id}" style="--c:${t.color}">${esc(t.zh)}<span class="px">${esc(t.en)}</span><small>${t.articles.length}</small></button>`).join(''));
    $$('#map-chips .map-chip').forEach((b) => b.addEventListener('click', () => this.selectTheme(this.theme === b.dataset.theme ? null : b.dataset.theme)));
  }
  openMap(themeId = null) {
    this.closeAll();
    if (this.world.mode === 'data') this.world.setMode('journey');
    this.setMode('map');
    this.selectTheme(themeId);
  }
  closeMap() { this.setMode('journey'); }
  selectTheme(id) {
    this.theme = id;
    const t = THEMES.find((x) => x.id === id) || null;
    this.world.setTheme(t);
    this.renderChips();
    const res = $('#map-result');
    if (!t) { res.replaceChildren(); return; }
    document.documentElement.style.setProperty('--sec', t.color);
    setHTML(res, t.articles.map((no) => {
      const a = ARTICLES.find((x) => x.no === no);
      return `<button data-act="goart" data-v="${no}" style="--c:${sectionOf(a.section).color}"><span class="px">${pad2(no)}</span>${esc(a.title)}</button>`;
    }).join(''));
  }

  buildLabels() {
    const box = $('#labels');
    this.labels = [];
    const gates = [{ id: 'intro', page: 6 }, ...this.layout.anchors.filter((a) => a.type === 'gate').map((a) => ({ id: a.section, page: a.page }))];
    for (const g of gates) {
      const s = sectionOf(g.id);
      const el = document.createElement('div');
      el.className = 'lbl lbl-sec';
      el.style.setProperty('--c', s.color);
      el.style.opacity = 0;
      el.append(`${s.no} · ${s.zh}`);
      const b = document.createElement('b');
      b.textContent = s.name;
      el.append(b);
      box.appendChild(el);
      this.labels.push({ el, page: g.page, lift: 1.4, kind: 'sec' });
    }
    for (const a of ARTICLES) {
      const el = document.createElement('button');
      el.className = 'lbl lbl-art';
      el.style.setProperty('--c', sectionOf(a.section).color);
      el.style.opacity = 0;
      el.textContent = pad2(a.no);
      el.setAttribute('aria-label', a.title);
      el.addEventListener('click', () => { this.closeMap(); this.world.goToArticle(a.no); });
      el.addEventListener('pointerenter', (e) => this.showTip(`<span class="px">${pad2(a.no)}</span>${esc(a.title)}`, e.clientX, e.clientY));
      el.addEventListener('pointerleave', () => this.hideTip());
      box.appendChild(el);
      this.labels.push({ el, page: a.start, lift: 0.35, kind: 'art', no: a.no });
    }
  }

  onFrame() {
    const w = this.world;
    const map = w.mode === 'map';
    if (map || this._labelsOn) {
      this._labelsOn = map;
      const cam = w.camera.position;
      const t = this.theme && THEMES.find((x) => x.id === this.theme);
      for (const l of this.labels) {
        if (!map) { l.el.style.opacity = 0; l.el.style.pointerEvents = 'none'; continue; }
        const pr = w.projectPage(l.page, l.lift);
        const i = l.page - 1;
        const facing = w.normals[i].dot(cam.clone().sub(w.finalPos[i])) > 0;
        let op = pr.visible ? (facing ? 1 : 0.18) : 0;
        if (l.kind === 'art' && t && !t.articles.includes(l.no)) op *= 0.15;
        l.el.style.opacity = op;
        l.el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
        l.el.style.transform = l.kind === 'sec'
          ? `translate(${pr.x + 18}px, ${pr.y - 30}px)`
          : `translate(${pr.x}px, ${pr.y}px) translate(-50%, -100%)`;
      }
    }
    if (w.mode === 'data') {
      const h = w.scatterSize / 2;
      const x = w.projectScatter(0, -h - 0.55), y = w.projectScatter(-h - 0.55, 0), d = w.projectScatter(h * 0.5, h * 0.62);
      $('#dv-x').style.transform = `translate(${x.x}px, ${x.y}px) translate(-50%, 0)`;
      $('#dv-y').style.transform = `translate(${y.x}px, ${y.y}px) translate(-50%, -50%) rotate(-90deg)`;
      $('#dv-d').style.transform = `translate(${d.x}px, ${d.y}px)`;
      const o = w.projectScatter(-h - 0.25, -h - 0.25), tx = w.projectScatter(h, -h - 0.3), ty = w.projectScatter(-h - 0.3, h);
      $('#dv-t0').style.transform = `translate(${o.x}px, ${o.y}px) translate(-100%, 0)`;
      $('#dv-tx').style.transform = `translate(${tx.x}px, ${tx.y}px) translate(-50%, 0)`;
      $('#dv-ty').style.transform = `translate(${ty.x}px, ${ty.y}px) translate(-100%, -50%)`;
    }
  }
}

boot().catch((err) => {
  console.error(err);
  $('#ld-note').textContent = 'COULD NOT LOAD — PLEASE REFRESH';
});
