import { BOOK, SECTIONS, THEMES, ARTICLES, PEOPLE_MODEL, themesFor } from '../../../assets/js/data.js';
import { COLORS, setMarkup, esc, pad2, pad3 } from '../core/util.js';
import { THEME_COLORS } from '../world/threads.js';
import { BEATS, hasBeats, beatName, beatTab, beatHTML, themesHTML } from './beats.js';

const $ = (s, el = document) => el.querySelector(s);
const CH = {
  intro: { no: '00', name: 'INTRO', zh: '序章', place: '屋頂', en: 'ROOF' },
  people: { no: '01', name: 'PEOPLE', zh: '人', place: '運河', en: 'CANAL' },
  model: { no: '02', name: 'MODEL', zh: '模型', place: '水下', en: 'UNDER THE HARBOUR' },
  ai: { no: '03', name: 'A.I', zh: '行動', place: '深網', en: 'THE NET' },
};
export const pageUrl = (p) => `../assets/img/pages/p${pad3(p)}.jpg`;
export const openerUrl = (p) => `../assets/img/openers/p${pad3(p)}.jpg`;
const NOISE = '01#%&*+=<>/\\|決策智慧人心網潛';

const authorsLine = (a) => a.authors.map((x) => `<b>${esc(x.zh)}</b>${x.en ? ' ' + esc(x.en) : ''}`).join('、');
export const depthText = (y) => (y >= 0 ? '+' : '−') + Math.abs(y).toFixed(1).padStart(5, '0');

// text that resolves out of noise, like data arriving over the Net
function decode(el, text, ms = 700) {
  const chars = [...text];
  const now = () => (window.__vclock ? window.__vclock() : performance.now());
  const t0 = now();
  clearInterval(el._dec);
  const step = () => {
    const k = Math.min(1, (now() - t0) / ms);
    const n = Math.floor(chars.length * k);
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      if (i < n || chars[i] === ' ') out += esc(chars[i]);
      else if (i < n + 4) out += `<span class="g">${esc(NOISE[Math.floor(Math.random() * NOISE.length)])}</span>`;
    }
    setMarkup(el, out);
    if (k >= 1) clearInterval(el._dec);
  };
  el._dec = setInterval(step, 32);
  step();
}

// The book's credits as on its own credits page: every role with its people, then the publisher.
const creditsMarkup = () =>
  (BOOK.credits || []).map(([role, names]) => `<span>${esc(role)}${names.map((n) => `<b>${esc(n)}</b>`).join('、')}</span>`).join('') + `<span>出版<b>${esc(BOOK.publisher)}</b></span>`;

export class UI {
  constructor(actions) {
    this.actions = actions;
    this.card = $('#card');
    this.gate = $('#gate');
    this.finale = $('#finale');
    this.digest = $('#digest');
    this.reader = $('#reader');
    this.index = $('#index');
    this.toastEl = $('#toast');
    this.labelsEl = $('#labels');
    this.pmEl = $('#pm');
    this.zoneEl = $('#zone');
    this.cardKey = null;
    this.panel = null;
    this.beat = 0;
    this.capH = 0;
    this.capMax = 0;
    this.pmSide = [-1, -1];
    this.buildIndex();
    this.buildGhost();
    this.buildPM();
    this.bind();
  }

  // ---------------------------------------------------------------- boot log
  static bootLog(lines, pct) {
    setMarkup($('#ld-log'), lines.map((l) => `&gt; ${esc(l[0])}${l[1] ? ` <b>${esc(l[1])}</b>` : ''}`).join('\n'));
    $('#ld-pct').textContent = String(Math.round(pct * 100)).padStart(3, '0') + '%';
    $('#ld-bar').style.width = `${Math.round(pct * 100)}%`;
  }

  // ---------------------------------------------------------------- depth gauge
  buildGauge(keys, stops) {
    const wrap = $('#gg-ticks');
    wrap.replaceChildren();
    this.ticks = new Map();
    this.gaugeStops = stops;
    this.keys = keys;
    stops.forEach((k, i) => {
      const key = keys[k];
      const el = document.createElement('button');
      el.className = 'gg-tick';
      el.style.top = `${(i / (stops.length - 1)) * 100}%`;
      el.style.setProperty('--c', COLORS[key.chapter || 'intro']);
      let tip;
      if (key.kind === 'station') {
        const a = ARTICLES.find((x) => x.no === key.no);
        tip = `<b>${pad2(a.no)}</b>${esc(a.title)}`;
      } else {
        el.classList.add('gate');
        if (key.kind === 'gate') tip = `<b>${CH[key.chapter].no}</b>${CH[key.chapter].name} ${CH[key.chapter].zh} · ${CH[key.chapter].place}`;
        else if (key.kind === 'finale') tip = '<b>END</b>浮出水面 · 黎明';
        else tip = '<b>00</b>屋頂 · 封面';
      }
      setMarkup(el, `<span class="tip">${tip}</span>`);
      el.setAttribute('aria-label', el.textContent);
      el.addEventListener('click', () => this.actions.goKey(k));
      wrap.appendChild(el);
      this.ticks.set(k, el);
    });
  }

  updateGauge(s, activeKey, y, seen, keys) {
    if (!this.ticks) return;
    const stops = this.gaugeStops;
    // position of the head: interpolate between stop indices
    let pos = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      if (s >= stops[i] && s <= stops[i + 1]) {
        pos = i + (s - stops[i]) / (stops[i + 1] - stops[i]);
        break;
      }
      if (s > stops[stops.length - 1]) pos = stops.length - 1;
    }
    $('#gg-head').style.transform = `translateY(${(pos / (stops.length - 1)) * $('#gg-track').clientHeight}px)`;
    $('#gg-depth').textContent = depthText(y);
    for (const [k, el] of this.ticks) {
      el.classList.toggle('now', k === activeKey);
      const key = keys[k];
      el.classList.toggle('seen', key.kind === 'station' && seen.has(key.no));
    }
  }

  // ---------------------------------------------------------------- zone + status
  setZone(ch, dawn) {
    const id = dawn ? 'dawn' : ch;
    if (id === this.zoneId) return;
    this.zoneId = id;
    const c = CH[ch];
    this.zoneEl.style.setProperty('--c', COLORS[ch]);
    setMarkup(this.zoneEl, dawn ? `<div class="zn-k">SURFACE · DAWN</div><div class="zn-n">黎明 · 浮出水面</div>` : `<div class="zn-k">ZONE ${c.no} · ${c.en}</div><div class="zn-n">${c.place}　${c.no === '00' ? '序章' : c.name + ' ' + c.zh}</div>`);
    $('#st-zone').textContent = dawn ? 'ZONE END' : `ZONE ${c.no}`;
  }

  setStatus(y, seen) {
    $('#st-depth').textContent = `DEPTH ${depthText(y)}m`;
    $('#st-sync').textContent = pad2(Math.round((seen.size / 22) * 100));
  }

  // ---------------------------------------------------------------- station card
  showCard(key) {
    const id = key ? key.kind + (key.no || key.chapter || '') : null;
    if (id === this.cardKey) return;
    this.cardKey = id;
    this.holdStepFocus(this.card);
    this.card.classList.remove('show');
    this.card.setAttribute('aria-hidden', 'true');
    this.card.inert = true;
    document.body.classList.remove('card-up');
    clearTimeout(this._cardT);
    if (!key || key.kind !== 'station') return;
    this._cardT = setTimeout(() => {
      const a = ARTICLES.find((x) => x.no === key.no);
      const ch = CH[a.section];
      const pm = a.no === 12;
      // what the stop before and after this one is, so the two step buttons can say where they go
      const at = this.gaugeStops.indexOf(this.keys.indexOf(key));
      const before = this.keys[this.gaugeStops[at - 1]];
      const after = this.keys[this.gaugeStops[at + 1]];
      const prevText = !before || before.kind === 'hero' ? '' : before.kind === 'gate' ? '↑ 章首' : '↑ 上一篇';
      const nextText = !after ? '' : after.kind === 'finale' ? '浮出水面 ↑' : after.kind === 'gate' ? `下一章 · ${CH[after.chapter].place} ↓` : '下一篇 ↓';
      this.card.style.setProperty('--c', COLORS[a.section]);
      // a stop that is read in place has no card to open: see buildBeats
      const beats = hasBeats(a.no);
      this.capMax = 0;
      this.card.classList.toggle('bt', beats);
      this.card.setAttribute('aria-live', beats ? 'off' : 'polite');
      if (beats) this.buildBeats(a, ch, prevText, nextText);
      else
        setMarkup(
          this.card,
          `<div class="cd${pm ? ' cd-tall' : ''}">
          <div class="cd-kick"><span><b>${ch.no} ${ch.name}</b> · ${pad2(a.no)} / 22</span><span>P.${pad3(a.start)}–${pad3(a.end)}</span></div>
          ${a.kicker ? `<span class="cd-special">〈${esc(a.kicker)}〉</span>` : ''}
          <h2 class="cd-title"></h2>
          ${a.subtitle ? `<p class="cd-sub">${esc(a.subtitle)}</p>` : ''}
          <p class="cd-auth">${authorsLine(a)}</p>
          <div class="cd-row"><img class="cd-thumb" alt="" src="${openerUrl(a.start)}" /><p class="cd-quote">${esc(a.quote)}</p></div>
          <div class="cd-actions">
            <button class="btn btn-solid" data-act="digest">閱讀重點 <span aria-hidden="true">→</span></button>
            <button class="btn btn-line" data-act="read">翻閱原文 <em>P.${a.start}–${a.end}</em></button>
          </div>
          ${
            pm
              ? `<div class="cd-pm"><span class="mono">TRY IT · 動手看看</span><div class="cd-pm-row">
                  <button class="pm-btn" data-pm="wave">5,045 個人</button>
                  <button class="pm-btn" data-pm="persona">遇見 Lisa 與 Cindy</button>
                  <button class="pm-btn" data-pm="morph">同步率 r = 0.89</button>
                </div></div>`
              : ''
          }
          <nav class="cd-nav" aria-label="上一站、下一站">
            <button class="cd-step" data-step="-1"${prevText ? '' : ' disabled'}>${prevText || '↑'}</button>
            <button class="cd-step next" data-step="1"${nextText ? '' : ' disabled'}>${nextText || '↓'}</button>
          </nav>
        </div>`
        );
      this.card.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => (b.dataset.step === '1' ? this.actions.next() : this.actions.prev())));
      decode(this.card.querySelector('.cd-title'), a.title);
      this.card.querySelector('[data-act="read"]').onclick = () => this.openReader(a.start, a.end, a.start, `${pad2(a.no)} ${a.title}`);
      if (!beats) {
        this.card.querySelector('[data-act="digest"]').onclick = () => this.openDigest(a.no);
        this.card.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => this.actions.peopleModel(b.dataset.pm)));
        const img = this.card.querySelector('.cd-thumb');
        img.onerror = () => img.remove();
      }
      requestAnimationFrame(() => {
        // the camera may already have moved on while this frame was waiting
        if (this.cardKey !== id) return;
        this.card.classList.add('show');
        this.card.setAttribute('aria-hidden', 'false');
        this.card.inert = false;
        document.body.classList.add('card-up');
        this.giveStepFocus(this.card.querySelector(`[data-step="${this._stepFocus}"]:not(:disabled)`));
        this.measureCard();
      });
    }, 240);
  }

  // ---------------------------------------------------------------- reading in place (ui/beats.js)
  // The article's digest stands on the scene in six beats; main.js owns which beat is open and
  // tells the worlds. On a wide screen the beats are one column that scrolls, and the open beat
  // is the one in view. On a narrow screen one beat shows at a time.
  beatsScroll() {
    return window.innerWidth > 820;
  }

  buildBeats(a, ch, prevText, nextText) {
    const each = (fn) => Array.from({ length: BEATS }, (_, i) => fn(i)).join('');
    const tab = (i) => {
      const [mark, words] = beatTab(a, i);
      return `<button role="tab" id="bt-t${i}" aria-controls="bt-p${i}" aria-label="${esc(words ? `${mark} ${words}` : mark)}" data-beat="${i}"><b>${esc(mark)}</b>${words ? `<span>${esc(words)}</span>` : ''}</button>`;
    };
    setMarkup(
      this.card,
      `<article class="bt-box" aria-labelledby="bt-title">
        <header class="bt-head">
          <div class="cd-kick"><span><b>${ch.no} ${ch.name}</b> · ${pad2(a.no)} / 22</span><span class="bt-where" aria-hidden="true"></span></div>
          ${a.kicker ? `<span class="cd-special">〈${esc(a.kicker)}〉</span>` : ''}
          <h2 class="cd-title" id="bt-title"></h2>
          ${a.subtitle ? `<p class="cd-sub">${esc(a.subtitle)}</p>` : ''}
          <p class="cd-auth">${authorsLine(a)}</p>
        </header>
        <p class="bt-sr" aria-live="polite"></p>
        <div class="bt-tabs" role="tablist" aria-label="這一篇的六格：開場、四個重點、框架">${each(tab)}</div>
        <div class="bt-panels">${each((i) => `<section class="bt-panel" role="tabpanel" id="bt-p${i}" aria-labelledby="bt-t${i}">${beatHTML(a, i)}</section>`)}</div>
        <div class="bt-more">
          <button class="bt-read" data-act="read" aria-label="閱讀全文：翻閱刊物第 ${a.start} 到 ${a.end} 頁"><span>閱讀全文</span><em>P.${a.start}–${a.end}</em><i aria-hidden="true">→</i></button>
          <div class="bt-themes">${themesHTML(a)}</div>
        </div>
        <nav class="cd-nav" aria-label="上一站、下一站，和這一篇的上一點、下一點">
          <button class="cd-step" data-step="-1"${prevText ? '' : ' disabled'}>${prevText || '↑'}</button>
          <span class="bt-turn">
            <button class="bt-arrow" data-turn="-1" aria-label="這一篇的上一點">‹</button>
            <button class="bt-arrow next" data-turn="1" aria-label="這一篇的下一點">›</button>
          </span>
          <button class="cd-step next" data-step="1"${nextText ? '' : ' disabled'}>${nextText || '↓'}</button>
        </nav>
      </article>`
    );
    this.card.querySelectorAll('[data-beat]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.beat);
        if (!this.actions.beat(i)) this.beatTop(i);
      };
    });
    this.card.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => this.actions.beatStep(Number(b.dataset.turn))));
    this.card.querySelectorAll('[data-theme]').forEach((b) => {
      b.onclick = () => {
        this.actions.toggleGhost(true);
        this.pickTheme(b.dataset.theme);
      };
    });
    // on a narrow screen the quote and the passages of the article are folded: a tap (or Enter) opens one
    this.card.querySelectorAll('[data-fold]').forEach((el) => {
      el.onclick = () => {
        if (this.beatsScroll()) return;
        el.classList.toggle('open');
        this.measureCard();
      };
      el.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        el.click();
      };
    });
    // on a wide screen the open beat is whichever part of the column is in view
    const sc = this.card.querySelector('.bt-panels');
    this._btGo = -1;
    sc.addEventListener(
      'scroll',
      () => {
        // a hidden card's column may still be coasting from a flick: it says nothing about the next stop
        if (!this.beatsScroll() || this.card.inert) return;
        this.actions.beatRead();
        const at = this.beatInView(sc);
        // while the column travels to a beat that was asked for, the ones it passes do not count
        if (this._btGo >= 0) {
          if (at === this._btGo) this._btGo = -1;
          return;
        }
        if (at !== this.beat) this.actions.beat(at, true);
      },
      { passive: true }
    );
    sc.addEventListener('scrollend', () => (this._btGo = -1));
    // ...and so does the reader's own hand on the column, at once
    for (const type of ['wheel', 'touchstart', 'pointerdown']) sc.addEventListener(type, () => (this._btGo = -1), { passive: true });
    this.setBeat(this.beat, { lead: `${pad2(a.no)} ${a.title}。`, jump: true });
  }

  // which beat the scrolling column shows: the last one whose top is above a line a third of the way down
  beatInView(sc) {
    const kids = sc.children;
    if (sc.scrollTop <= 2) return 0;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) return kids.length - 1;
    const line = sc.scrollTop + sc.clientHeight * 0.35;
    let at = 0;
    for (let k = 0; k < kids.length; k++) if (kids[k].offsetTop <= line) at = k;
    return at;
  }

  // Open one beat (0 開場, 1-4 the key points, 5 框架).
  // fromScroll: the column is already there (the reader scrolled to it). jump: go without gliding.
  setBeat(i, { lead = '', fromScroll = false, jump = false } = {}) {
    this.beat = i;
    const box = this.card.querySelector('.bt-box');
    if (!box) return;
    const had = document.activeElement;
    const paged = !this.beatsScroll();
    box.dataset.beat = i;
    box.querySelectorAll('.bt-panel').forEach((p, k) => (p.hidden = paged && k !== i));
    box.querySelectorAll('[data-beat]').forEach((b, k) => {
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    box.querySelector('.bt-where').textContent = beatName(i);
    box.querySelector('.bt-sr').textContent = fromScroll ? '' : lead + beatName(i);
    const back = box.querySelector('[data-turn="-1"]');
    const on = box.querySelector('[data-turn="1"]');
    back.disabled = i === 0;
    on.disabled = i === BEATS - 1;
    // a button that just switched itself off must not swallow the focus: hand it to the one that still works
    if (had === back && back.disabled) on.focus({ preventScroll: true });
    if (had === on && on.disabled) (box.querySelector('[data-step="1"]:not(:disabled)') || back).focus({ preventScroll: true });
    if (had && had.dataset.beat !== undefined && box.contains(had)) box.querySelector(`[data-beat="${i}"]`).focus({ preventScroll: true });
    if (!paged && !fromScroll) this.scrollToBeat(box, i, jump);
    this.measureCard();
  }

  scrollToBeat(box, i, jump) {
    const sc = box.querySelector('.bt-panels');
    // where the column can really go: the last beats cannot always reach the top
    const top = Math.max(0, Math.min(i === 0 ? 0 : sc.children[i].offsetTop - 6, sc.scrollHeight - sc.clientHeight));
    clearTimeout(this._btGoT);
    // already there: no scroll event will come, so there is nothing to wait for
    if (Math.abs(top - sc.scrollTop) < 1) {
      this._btGo = -1;
      return;
    }
    this._btGo = i;
    this._btGoT = setTimeout(() => (this._btGo = -1), 900);
    const calm = jump || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sc.scrollTo({ top, behavior: calm ? 'auto' : 'smooth' });
  }

  // the lit rail mark, or the number key of the open beat: back to the start of that beat
  beatTop(i) {
    const box = this.card.querySelector('.bt-box');
    if (box && this.beatsScroll() && i === this.beat) this.scrollToBeat(box, i, false);
  }

  // The wheel turned over another part of the block (the title, the buttons): the column still
  // scrolls, by no more than a page of its own at a time (a wheel set to pages sends window heights).
  scrollBeats(d) {
    const sc = this.card.querySelector('.bt-panels');
    if (!sc) return;
    this._btGo = -1;
    const page = sc.clientHeight * 0.9;
    sc.scrollTop += Math.max(-page, Math.min(page, d));
  }

  // The height of the text block is read once per change, never per frame. capMax is the tallest
  // it has been at this stop: the picture is placed for that, so turning a beat does not move it.
  measureCard() {
    cancelAnimationFrame(this._capRaf);
    this._capRaf = requestAnimationFrame(() => {
      this.capH = this.card.classList.contains('bt') ? this.card.offsetHeight : 0;
      // after the window changed width the old maximum belongs to another layout
      this.capMax = this._capFresh ? this.capH : Math.max(this.capMax, this.capH);
      this._capFresh = false;
      // what is folded on a narrow screen can take the focus there, so Enter can open it
      const paged = !this.beatsScroll();
      this.card.querySelectorAll('[data-fold]').forEach((el) => {
        if (paged) el.tabIndex = 0;
        else el.removeAttribute('tabindex');
      });
      // the column itself takes the focus where it scrolls, so the keyboard can scroll it (see main.js)
      const sc = this.card.querySelector('.bt-panels');
      if (sc) {
        if (paged) sc.removeAttribute('tabindex');
        else sc.tabIndex = 0;
      }
    });
  }

  // Where the text sits at the bottom of a narrow screen, the picture is lifted by this many pixels
  // so the thing the stop is about stands in the open part of the frame. 180 = what the top of the
  // screen already holds (the bar, the zone line) plus room for the label that floats over the object.
  cardLift() {
    return this.card.classList.contains('show') && this.card.classList.contains('bt') ? Math.max(0, this.capMax - 180) / 2 : 0;
  }

  // A hidden card or gate is made inert so its buttons cannot be reached while invisible. That drops
  // the focus, so a reader who was stepping with a focused button gets it back on the next one.
  holdStepFocus(el) {
    const f = document.activeElement;
    if (f && el.contains(f) && (f.dataset.step || f.classList.contains('gt-next'))) this._stepFocus = f.dataset.step || '1';
  }

  giveStepFocus(btn) {
    const free = !document.activeElement || document.activeElement === document.body;
    if (btn && this._stepFocus && free) btn.focus({ preventScroll: true });
    this._stepFocus = null;
  }

  setPMButtons(mode) {
    this.card.querySelectorAll('[data-pm]').forEach((b) => b.classList.toggle('on', b.dataset.pm === mode));
  }

  // ---------------------------------------------------------------- chapter gate
  showGate(chapter) {
    if (chapter === this.gateCh) return;
    this.gateCh = chapter;
    this.holdStepFocus(this.gate);
    this.gate.classList.remove('show');
    this.gate.setAttribute('aria-hidden', chapter ? 'false' : 'true');
    this.gate.inert = true;
    clearTimeout(this._gateT);
    if (!chapter) return;
    this._gateT = setTimeout(() => {
      const sec = SECTIONS.find((s) => s.id === chapter);
      const count = ARTICLES.filter((a) => a.section === chapter).length;
      const c = CH[chapter];
      const hint = { people: '跳進運河 ↓', model: '潛入水中 ↓', ai: '連上深網 ↓' }[chapter];
      setMarkup(
        this.gate,
        `<div class="gt" style="--c:${COLORS[chapter]}">
          <div class="gt-no">${c.no}</div>
          <div class="gt-kick">CHAPTER ${sec.no} · ${c.en} · ${count} 篇觀點</div>
          <h2>${esc(c.place)}<small>${esc(c.name)} ${esc(c.zh)}</small></h2>
          <p>${esc(sec.lead)}</p>
          <button class="gt-next">${hint}</button>
        </div>`
      );
      this.gate.querySelector('.gt-next').onclick = () => this.actions.next();
      requestAnimationFrame(() => {
        // the camera may already have left the gate while this frame was waiting
        if (this.gateCh !== chapter) return;
        this.gate.classList.add('show');
        this.gate.inert = false;
        this.giveStepFocus(this._stepFocus === '1' ? this.gate.querySelector('.gt-next') : null);
      });
    }, 150);
  }

  // ---------------------------------------------------------------- 3D labels
  buildLabels(stations) {
    this.labels = stations.map((st) => {
      const a = ARTICLES.find((x) => x.no === st.no);
      const el = document.createElement('button');
      el.className = 'lbl';
      el.style.setProperty('--c', COLORS[a.section]);
      setMarkup(el, `<b>${pad2(a.no)}</b><span>${esc(a.title)}</span>`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.actions.goStation(a.no);
      });
      this.labelsEl.appendChild(el);
      return { el, pos: st.anchor.clone(), no: a.no };
    });
  }

  updateLabels(camera, w, h, state) {
    if (!this.labels) return;
    const v = this._v || (this._v = camera.position.clone());
    for (const L of this.labels) {
      v.copy(L.pos).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.8;
      const d = camera.position.distanceTo(L.pos);
      let show = vis && !state.hero && !state.gate && !state.finale && d < (state.ghost ? 260 : 120) && L.no !== state.activeNo;
      if (!state.ghost && state.activeNo && Math.abs(L.no - state.activeNo) > 1) show = false;
      L.el.classList.toggle('dim', !!(state.theme && !state.theme.articles.includes(L.no)));
      L.el.classList.toggle('show', show);
      L.el.style.pointerEvents = show ? 'auto' : 'none';
      if (show) L.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -140%)`;
    }
  }

  // ---------------------------------------------------------------- People Model overlays
  buildPM() {
    const [lisa, cindy] = PEOPLE_MODEL.personas;
    const bubble = (p) => `<header><b>${esc(p.name)}</b><span>${esc(p.age)} · 剛買${esc(p.bought)}</span></header>
      <q>${esc(p.voice)}</q><div class="ord">在意順序 ${p.order.map((o, i) => `<i>${i + 1}</i>${esc(o)}`).join(' ')}</div>`;
    const v = PEOPLE_MODEL.validation;
    setMarkup(
      this.pmEl,
      `<div class="pm-bubble" id="pm-a">${bubble(lisa)}</div>
      <div class="pm-bubble" id="pm-b">${bubble(cindy)}</div>
      <div class="pm-count" id="pm-count"><b>5,045</b><span>顆發光的種子 = 5,045 位 CCS 真實受訪者</span></div>
      <div class="pm-stats" id="pm-stats">
        <span class="mono">PEOPLE MODEL · SYNC RATE</span>
        <h3>複製出來的人，<br />對得上真人嗎？</h3>
        <div class="grid">
          <div><b>${v.r}</b><span>相關係數 r</span></div>
          <div><b>${v.mae}%</b><span>MAE 平均落差</span></div>
          <div><b>${v.rmse}%</b><span>RMSE 含大誤差</span></div>
          <div><b>${v.points.toLocaleString()}</b><span>驗證點</span></div>
        </div>
        <p>種子飛成一張圖：橫軸是真人調查的回答比例，縱軸是 People Model 模擬的比例，越靠近虛線越一致。分布為依書中公布之驗證結果重建的示意。</p>
      </div>`
    );
    this.pm = { a: $('#pm-a'), b: $('#pm-b'), count: $('#pm-count'), stats: $('#pm-stats') };
  }

  // open: how many pixels of the window's width, from the left, the text of the stop leaves free
  // rest: where the two seeds come to rest (anchors are where they are this frame)
  updatePM(mode, anchors, camera, w, h, near, open = w, rest = anchors) {
    const { a, b, count, stats } = this.pm;
    count.classList.toggle('show', near && mode === 'wave');
    stats.classList.toggle('show', near && mode === 'morph');
    const per = near && mode === 'persona';
    [a, b].forEach((el, i) => {
      el.classList.toggle('show', per);
      if (!per || !anchors) {
        this.pmSide[i] = -1; // the side is chosen anew the next time the words come up
        return;
      }
      const v = anchors[i].clone().project(camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      // Lisa's words stand to the left of her seed and Cindy's to the right of hers (side 0 / 1);
      // where that side has no room (the window's edge, the text of the stop) they stand on the
      // other one. The side is chosen from where the seed comes to rest, not from where it is while
      // it slides out, and it is kept until it misses by more than the camera's sway moves the seed
      // (under 40px): words that changed sides while they are read would jump 300px.
      const rx = ((rest[i].clone().project(camera).x + 1) / 2) * w;
      const miss = (s) => (s ? rx + 274 - (open - 12) : 12 - (rx - 274)); // by how much side s has no room
      let side = this.pmSide[i];
      if (side < 0) side = miss(i) > 0 && miss(1 - i) < miss(i) ? 1 - i : i;
      else if (miss(side) > 40 && miss(1 - side) < miss(side)) side = 1 - side;
      else if (side !== i && miss(i) < -40) side = i;
      this.pmSide[i] = side;
      const bx = Math.max(12, Math.min(side ? x + 24 : x - 274, open - 262));
      el.style.transform = `translate(${Math.round(bx)}px, ${Math.round(y - 60)}px)`;
    });
  }

  // ---------------------------------------------------------------- digest
  openDigest(no) {
    const a = ARTICLES.find((x) => x.no === no);
    const ch = CH[a.section];
    this.digest.style.setProperty('--c', COLORS[a.section]);
    const fw = a.framework;
    const body = $('#dg-body');
    setMarkup(
      body,
      `<div class="dg-kick"><i></i>${ch.no} ${ch.name} · ${ch.place} · ${pad2(a.no)} / 22 · P.${a.start}–${a.end}</div>
      ${a.kicker ? `<div class="dg-kick" style="margin-top:6px">〈${esc(a.kicker)}〉</div>` : ''}
      <h2 class="dg-title">${esc(a.title)}</h2>
      ${a.subtitle ? `<p class="dg-sub">${esc(a.subtitle)}</p>` : ''}
      <div class="dg-auth">${a.authors.map((x) => `<span><b>${esc(x.zh)}${x.en ? ' ' + esc(x.en) : ''}</b>${esc(x.role)}</span>`).join('')}</div>
      <blockquote class="dg-quote">${esc(a.quote)}</blockquote>
      <section class="dg-sec"><h4>一句話看懂</h4><p class="dg-tldr">${esc(a.tldr)}</p></section>
      <section class="dg-sec"><h4>四個重點</h4><ol class="dg-ins">${a.insights.map(([t, d]) => `<li><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol></section>
      <section class="dg-sec"><h4>關鍵數字</h4><div class="dg-stats">${a.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div></section>
      ${
        fw
          ? `<section class="dg-sec"><h4>框架</h4><div class="dg-frame-name">${esc(fw.name)}</div>
              <div class="dg-frame ${fw.grid ? 'grid' : ''}">${fw.items.map(([t, d]) => `<div><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div></section>`
          : ''
      }
      ${a.closing ? `<p class="dg-closing">${esc(a.closing)}</p>` : ''}
      <section class="dg-sec"><h4>主題線 · 點一條順著讀</h4><div class="dg-themes">${themesFor(a.no).map((t) => `<button data-theme="${t.id}">${esc(t.zh)}</button>`).join('')}</div></section>
      <div class="dg-foot">
        <button class="btn btn-solid" data-dg="read">翻閱原文 P.${a.start}–${a.end}</button>
        ${a.no < 22 ? `<button class="btn btn-line" data-dg="next">下一篇 →</button>` : ''}
      </div>
      <p class="dg-note">重點摘要整理自《2026 決策智慧》原文，完整內容請翻閱原文頁面。</p>`
    );
    body.querySelector('[data-dg="read"]').onclick = () => this.openReader(a.start, a.end, a.start, `${pad2(a.no)} ${a.title}`);
    const nx = body.querySelector('[data-dg="next"]');
    if (nx)
      nx.onclick = () => {
        this.closePanels();
        this.actions.goStation(a.no + 1);
      };
    body.querySelectorAll('[data-theme]').forEach((b) => {
      b.onclick = () => {
        this.closePanels();
        this.actions.toggleGhost(true);
        this.pickTheme(b.dataset.theme);
      };
    });
    $('#dg-scroll').scrollTop = 0;
    this.openPanel('digest');
  }

  // ---------------------------------------------------------------- reader
  openReader(start, end, page, title) {
    $('#rd-kicker').textContent = `P.${start}–${end}`;
    $('#rd-title').textContent = title || '';
    this.zoomed = false;
    this.single = window.innerWidth <= 820;
    this.reader.classList.remove('zoom');
    this.showPage(page);
    this.zoomLabel();
    this.openPanel('reader');
  }

  // One page at reading size, in a stage that scrolls: a whole page on a phone is a picture of a
  // page (about 6px type). Turning the page keeps the zoom.
  setZoom(on, page = this.readerPage) {
    this.zoomed = on;
    this.single = on || window.innerWidth <= 820;
    this.reader.classList.toggle('zoom', on);
    this.showPage(page);
    this.zoomLabel();
    const st = $('#rd-stage');
    st.scrollTop = 0;
    st.scrollLeft = Math.max(0, (st.scrollWidth - st.clientWidth) / 2);
  }

  zoomLabel() {
    const b = $('#rd-zoom');
    b.textContent = this.zoomed ? '縮小' : '放大';
    b.setAttribute('aria-pressed', String(!!this.zoomed));
  }

  showPage(p) {
    const single = this.single;
    let left = Math.max(1, Math.min(196, p));
    if (!single && left % 2 === 1 && left > 1) left -= 1;
    this.readerPage = left;
    const set = (fig, n) => {
      const img = fig.querySelector('img');
      if (!n || n > 196) {
        fig.classList.add('blank');
        img.removeAttribute('src');
        return;
      }
      fig.classList.remove('blank');
      img.classList.remove('ok');
      img.onload = () => img.classList.add('ok');
      img.alt = `第 ${n} 頁`;
      img.src = pageUrl(n);
    };
    set($('#rd-l'), left);
    $('#rd-r').style.display = single ? 'none' : '';
    if (!single) set($('#rd-r'), left === 1 ? 0 : left + 1);
    $('#rd-range').value = left;
    $('#rd-count').textContent = `${pad3(left)} / 196`;
    [left + 2, left + 3].forEach((n) => n <= 196 && (new Image().src = pageUrl(n)));
    if (this.zoomed) $('#rd-stage').scrollTop = 0;
  }

  // ---------------------------------------------------------------- index
  buildIndex() {
    const secs = SECTIONS.map((s) => {
      const c = CH[s.id];
      const list = ARTICLES.filter((a) => a.section === s.id)
        .map(
          (a) =>
            `<li><button data-no="${a.no}"><b>${pad2(a.no)}</b><span>${a.kicker ? `〈${esc(a.kicker)}〉` : ''}${esc(a.title)}${a.subtitle ? `<small>${esc(a.subtitle)}</small>` : ''}</span><em>P.${a.start}</em></button></li>`
        )
        .join('');
      return `<section class="ix-sec" style="--c:${COLORS[s.id]}"><h3>${s.id === 'ai' ? 'A.I' : s.name}<small>${c.place} · ${c.en}</small></h3><ul class="ix-list">${list}</ul></section>`;
    }).join('');
    setMarkup(
      $('#ix-body'),
      `<div class="ix-head"><img class="ix-cover" src="../assets/img/cover/front.jpg" alt="《2026 決策智慧》封面" /><h2><b>I</b>NDEX</h2><p>《2026 決策智慧》4 章、22 篇觀點、196 頁，放在 4 個深度：屋頂、運河、水下、深網。點任一篇，直接潛到那裡。</p></div>
      <div class="ix-grid">${secs}</div>
      <div class="ix-credits">${creditsMarkup()}</div>`
    );
    $('#ix-body').querySelectorAll('[data-no]').forEach((b) => {
      b.onclick = () => {
        this.closePanels();
        this.actions.goStation(Number(b.dataset.no));
      };
    });
  }

  markIndex(seen) {
    $('#ix-body').querySelectorAll('[data-no]').forEach((b) => b.classList.toggle('seen', seen.has(Number(b.dataset.no))));
  }

  // ---------------------------------------------------------------- ghost panel
  buildGhost() {
    const chips = $('#gh-chips');
    setMarkup(chips, THEMES.map((t, i) => `<button class="chip" data-theme="${t.id}" style="--tc:${THEME_COLORS[i]}"><i></i>${esc(t.zh)}<em>${t.articles.length}</em></button>`).join(''));
    chips.querySelectorAll('.chip').forEach((b) => (b.onclick = () => this.pickTheme(b.dataset.theme)));
  }

  // the threads view has closed: no chip stays lit, no list stays behind
  clearTheme() {
    $('#gh-chips')
      .querySelectorAll('.chip')
      .forEach((x) => x.classList.remove('on'));
    setMarkup($('#gh-result'), '');
  }

  pickTheme(id) {
    const chips = $('#gh-chips');
    const b = chips.querySelector(`[data-theme="${id}"]`);
    const on = !b.classList.contains('on');
    chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
    b.classList.toggle('on', on);
    const theme = on ? THEMES.find((t) => t.id === id) : null;
    this.actions.setTheme(theme);
    const res = $('#gh-result');
    setMarkup(
      res,
      theme
        ? `<ol>${theme.articles
            .map((no) => {
              const a = ARTICLES.find((x) => x.no === no);
              return `<li><button style="--c:${COLORS[a.section]}" data-no="${no}"><b>${pad2(no)}</b><span>${esc(a.title)}<small>${CH[a.section].place} · ${CH[a.section].en}</small></span></button></li>`;
            })
            .join('')}</ol>`
        : ''
    );
    res.querySelectorAll('[data-no]').forEach((x) => (x.onclick = () => this.actions.goStation(Number(x.dataset.no))));
  }

  // ---------------------------------------------------------------- finale
  showFinale(on, seen, printCanvas) {
    if (on === this.finaleOn) return;
    this.finaleOn = on;
    if (on) {
      setMarkup(
        this.finale,
        `<div class="fn-print" id="fn-print"></div>
        <div class="fn">
          <span class="mono">SURFACE · DAWN · SYNC ${pad2(Math.round((seen.size / 22) * 100))}%</span>
          <h2>雨停了。<br />人，一直都在。</h2>
          <div class="fn-en">${esc(BOOK.mottoEn)}</div>
          <p>往下潛，你看見 AI 怎麼一層一層被造出來；浮上來，你帶回來的是人——<b>信任、真實、判斷</b>。AI 改變的是分工，沒改變的是判斷。</p>
          <p>這張圖是你的<b>閱讀指紋</b>：你停下來讀過的 ${seen.size} 篇文章，各在上面留下一道紋路。沒有兩個人會一樣。</p>
          <div class="fn-actions">
            <button class="btn btn-solid" data-fn="save" style="--c:var(--ghost)">下載我的閱讀指紋 ↓</button>
            <button class="btn btn-line" data-fn="again">再潛一次 ↺</button>
            <button class="btn btn-line" data-fn="index">目錄</button>
          </div>
          <div class="fn-credits">${creditsMarkup()}</div>
        </div>`
      );
      if (printCanvas) $('#fn-print').appendChild(printCanvas);
      this.fitFinale();
      this.finale.querySelector('[data-fn="save"]').onclick = () => this.actions.savePrint();
      this.finale.querySelector('[data-fn="again"]').onclick = () => this.actions.again();
      this.finale.querySelector('[data-fn="index"]').onclick = () => this.openPanel('index');
    }
    this.finale.classList.toggle('show', on);
    this.finale.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  // The finale scrolls only where the window cannot hold it. It is measured with the scrolling
  // off: a box that scrolls counts its bottom padding as content and would call itself too tall
  // when everything is on screen, and then the wheel and a swipe are taken from the dive for nothing.
  fitFinale() {
    const el = this.finale;
    el.classList.remove('scrolls');
    el.classList.toggle('scrolls', this.finaleOn && el.scrollHeight > el.clientHeight + 1);
  }

  // ---------------------------------------------------------------- panels
  openPanel(name) {
    this.closePanels(true);
    this.panel = name;
    const el = { digest: this.digest, reader: this.reader, index: this.index }[name];
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('panel-open');
    this.actions.panelChanged(true);
  }

  closePanels(silent) {
    for (const el of [this.digest, this.reader, this.index]) {
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
    }
    const was = this.panel;
    this.panel = null;
    document.body.classList.remove('panel-open');
    if (!silent && was) this.actions.panelChanged(false);
  }

  toast(msg, ms = 2800) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  hideToast() {
    clearTimeout(this._toastT);
    this.toastEl.classList.remove('show');
  }

  bind() {
    $('#dg-close').onclick = () => this.closePanels();
    $('#ix-close').onclick = () => this.closePanels();
    // the threads panel closes from its own corner too; the focus goes back to the button that opens it
    $('#gh-close').onclick = () => {
      this.actions.toggleGhost(false);
      $('#btn-ghost').focus({ preventScroll: true });
    };
    $('#rd-close').onclick = () => this.closePanels();
    $('#rd-prev').onclick = () => this.showPage(this.readerPage - (this.single ? 1 : 2));
    $('#rd-next').onclick = () => this.showPage(this.readerPage + (this.single ? 1 : 2));
    $('#rd-range').oninput = (e) => this.showPage(Number(e.target.value));
    $('#btn-index').onclick = () => this.openPanel('index');
    $('#btn-ghost').onclick = () => this.actions.toggleGhost();
    $('#btn-sound').onclick = () => this.actions.toggleSound();
    $('#brand').onclick = () => this.actions.home();
    $('#gg-prev').onclick = () => this.actions.prev();
    $('#gg-next').onclick = () => this.actions.next();
    let capW = window.innerWidth;
    let wide = this.beatsScroll();
    window.addEventListener('resize', () => {
      if (window.innerWidth !== capW) {
        capW = window.innerWidth;
        this._capFresh = true;
      }
      if (this.beatsScroll() !== wide) {
        wide = !wide;
        this.setBeat(this.beat, { jump: true });
      }
      this.measureCard();
      if (this.finaleOn) this.fitFinale();
    });
    let sx = null;
    let sy = 0;
    let dragged = 0;
    $('#rd-stage').addEventListener('pointerdown', (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    $('#rd-stage').addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      if (Math.hypot(dx, e.clientY - sy) > 10) dragged = performance.now();
      sx = null;
      // a zoomed page is dragged about to be read: there a sideways drag does not turn the page
      if (!this.zoomed && Math.abs(dx) > 50) (dx < 0 ? $('#rd-next') : $('#rd-prev')).click();
    });
    // a click on a page (not the end of a drag) zooms that page, or lets it go
    [$('#rd-l'), $('#rd-r')].forEach((fig, i) => {
      fig.onclick = () => {
        if (performance.now() - dragged < 350 || fig.classList.contains('blank')) return;
        this.setZoom(!this.zoomed, this.zoomed || this.single ? this.readerPage : this.readerPage + i);
      };
    });
    $('#rd-zoom').onclick = () => this.setZoom(!this.zoomed);
    window.addEventListener('keydown', (e) => {
      if (this.panel === 'reader' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        // (cancelled, so the page slider does not take the same key as well when it has the focus)
        e.preventDefault();
        (e.key === 'ArrowRight' ? $('#rd-next') : $('#rd-prev')).click();
      }
      if (e.key === 'Escape') {
        if (this.panel) this.closePanels();
        else this.actions.escape();
      }
    });
  }
}
