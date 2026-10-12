// Everything drawn in HTML on top of the film: captions, hub doors, chapter cards, the explore map,
// the article reader, the index and the page viewer. Text stays real text — sharp and searchable.
import { ARTICLES, SECTIONS, THEMES, PEOPLE_MODEL, sectionOf, themesFor } from '../../assets/js/data.js';
import { FILMS, HUB_LIGHTS, EXPLORE_ANCHORS } from './films.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pad = (n, w = 2) => String(n).padStart(w, '0');
const PAGES = '../assets/img/pages/';
const CHAPTERS = ['people', 'model', 'ai'];
const SCRAMBLE = '.:-=+*#%@$01SD';

export const inSection = (id) => ARTICLES.filter((a) => a.section === id);

// Characters flicker through random glyphs before settling — text "decoding" out of the film.
export function decode(el, text, dur = 900) {
  const chars = [...text];
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const shown = Math.floor(k * chars.length);
    el.textContent = chars
      .map((c, i) => (i < shown || c === ' ' || c === '\n' ? c : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0]))
      .join('');
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

function chapterName(s, cls = '') {
  return `<span class="cn cn-${s.id} ${cls}">${esc(s.name)}</span>`;
}

// ---------------- captions ----------------
export class Captions {
  constructor() {
    this.root = $('#cap');
    this.items = [];
  }

  load(id) {
    this.root.dataset.film = id;
    this.items = FILMS[id].captions.map(([a, b, kind, arg]) => {
      const el = document.createElement('div');
      el.className = `cap cap-${kind}`;
      if (kind === 'title') {
        el.innerHTML = `<div class="ct-year">2026</div><div class="ct-title foil">決策智慧</div>
          <div class="ct-sub">Agentic Era：重塑品牌與人的真實距離<span>The New Distance.</span></div>`;
      } else if (kind === 'chapter') {
        const s = sectionOf(arg);
        el.style.setProperty('--c', s.color);
        el.innerHTML = `<div class="cc-no mono">${s.no} / 03</div>${chapterName(s, 'cc-name')}<div class="cc-zh">${esc(s.zh)} · ${inSection(s.id).length} 篇</div>`;
      } else if (kind === 'lead') {
        const s = sectionOf(arg);
        el.style.setProperty('--c', s.color);
        el.innerHTML = `<p>${esc(s.lead)}</p>`;
      } else el.innerHTML = arg;
      this.root.appendChild(el);
      return { a, b, kind, el, on: false, text: kind === 'kicker' ? arg : null };
    });
  }

  update(t) {
    for (const it of this.items) {
      const on = t >= it.a && t < it.b;
      if (on === it.on) continue;
      it.on = on;
      it.el.classList.toggle('on', on);
      if (on && it.text) decode(it.el, it.text, 1100);
    }
  }

  clear() {
    const old = this.items;
    this.items = [];
    old.forEach((it) => it.el.classList.remove('on'));
    setTimeout(() => old.forEach((it) => it.el.remove()), 1300);
  }
}

// ---------------- hub ----------------
export function buildHub(onGo, onHover) {
  const box = $('#hub .hub-doors');
  box.innerHTML = CHAPTERS.map((id) => {
    const s = sectionOf(id);
    return `<button class="door door-${id}" data-id="${id}" style="--c:${s.color}">
      <i class="door-dot" aria-hidden="true"></i>
      <i class="door-line" aria-hidden="true"></i>
      <span class="door-label">
        <span class="door-no mono">${s.no}</span>
        ${chapterName(s, 'door-name')}
        <span class="door-zh">${esc(s.zh)} · ${inSection(id).length} 篇</span>
        <span class="door-lead">${esc(s.lead)}</span>
      </span>
    </button>`;
  }).join('');
  box.querySelectorAll('.door').forEach((b) => {
    b.addEventListener('pointerenter', () => onHover(b.dataset.id, true));
    b.addEventListener('pointerleave', () => onHover(b.dataset.id, false));
    b.addEventListener('focus', () => onHover(b.dataset.id, true));
    b.addEventListener('blur', () => onHover(b.dataset.id, false));
    b.addEventListener('click', () => {
      const r = b.querySelector('.door-dot').getBoundingClientRect();
      onGo(b.dataset.id, [r.left + r.width / 2, r.top + r.height / 2]);
    });
  });
}

export function layoutHub(screen) {
  const hub = $('#hub');
  const doors = [...hub.querySelectorAll('.door')];
  const pts = doors.map((d) => screen.toScreen(...HUB_LIGHTS[d.dataset.id]));
  // labels fan out from the lights on leader lines; on narrow screens they stack instead
  const anchored = innerWidth > 860 && pts[0][0] > 300 && pts[2][0] < innerWidth - 300;
  hub.classList.toggle('stacked', !anchored);
  doors.forEach((d, i) => (d.style.transform = anchored ? `translate(${pts[i][0]}px, ${pts[i][1]}px)` : ''));
}

// ---------------- chapter rail ----------------
export function buildRail(id, { onOpen, onGo, onReplay }) {
  const s = sectionOf(id);
  const rail = $('#rail');
  rail.style.setProperty('--c', s.color);
  rail.dataset.section = id;
  const list = inSection(id);
  $('.rail-head', rail).innerHTML = `
    <div class="rh-no mono">${s.no} / 03 · ${list.length} 篇</div>
    ${chapterName(s, 'rh-name')}
    <div class="rh-zh">${esc(s.zh)}</div>
    <p class="rh-lead">${esc(s.lead)}</p>`;
  $('.rail-cards', rail).innerHTML = list
    .map(
      (a, i) => `<button class="card" role="listitem" data-no="${a.no}" style="--i:${i}">
      <span class="card-no mono">${pad(a.no)}${a.kicker ? ` · ${esc(a.kicker)}` : ''}</span>
      <span class="card-t">${esc(a.title)}</span>
      <span class="card-s">${esc(a.subtitle)}</span>
      <span class="card-a">${a.authors.map((p) => esc(p.zh)).join('、')}</span>
      <span class="card-go mono">READ →</span>
    </button>`,
    )
    .join('');
  const i = CHAPTERS.indexOf(id);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  $('.rail-nav', rail).innerHTML = `
    ${prev ? `<button data-go="${prev}" class="rn-prev">‹ ${sectionOf(prev).no} ${esc(sectionOf(prev).name)}</button>` : '<span></span>'}
    <button class="rn-replay mono">↺ 重播影片</button>
    ${next ? `<button data-go="${next}" class="rn-next">${sectionOf(next).no} ${esc(sectionOf(next).name)} ›</button>` : '<button data-go="explore" class="rn-next rn-explore">✦ 探索全部 22 篇 ›</button>'}`;
  rail.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => onOpen(+c.dataset.no)));
  rail.querySelectorAll('.rail-nav [data-go]').forEach((b) =>
    b.addEventListener('click', (e) => onGo(b.dataset.go, [e.clientX, e.clientY])),
  );
  $('.rn-replay', rail).addEventListener('click', onReplay);
}

// ---------------- explore map ----------------
export class ExploreMap {
  constructor({ onOpen, onTick }) {
    this.root = $('#map');
    this.svg = $('#threads');
    this.tip = $('#ex-tip');
    this.theme = null;
    this.spots = [];
    this.onOpen = onOpen;
    this.onTick = onTick;
    this.build();
  }

  build() {
    const groups = {};
    ARTICLES.forEach((a) => (groups[a.section] ||= []).push(a));
    this.root.innerHTML = '';
    for (const [sec, list] of Object.entries(groups)) {
      const { at, r } = EXPLORE_ANCHORS[sec];
      const color = sectionOf(sec).color;
      list.forEach((a, i) => {
        let v;
        if (sec === 'intro') v = [at[0] + (i ? 1 : -1) * r[0], at[1]];
        else {
          const ang = -Math.PI / 2 + (i / list.length) * Math.PI * 2 + 0.3;
          v = [at[0] + Math.cos(ang) * r[0], at[1] + Math.sin(ang) * r[1]];
        }
        const b = document.createElement('button');
        b.className = 'spot';
        b.style.setProperty('--c', color);
        b.style.setProperty('--d', `${(i * 0.11 + Math.random() * 0.2).toFixed(2)}s`);
        b.dataset.no = a.no;
        b.setAttribute('aria-label', `${pad(a.no)} ${a.title}：${a.subtitle}`);
        b.innerHTML = `<i></i><span class="mono">${pad(a.no)}</span>`;
        b.addEventListener('pointerenter', () => this.hover(a, b, true));
        b.addEventListener('pointerleave', () => this.hover(a, b, false));
        b.addEventListener('focus', () => this.hover(a, b, true));
        b.addEventListener('blur', () => this.hover(a, b, false));
        b.addEventListener('click', () => this.onOpen(a.no));
        this.root.appendChild(b);
        this.spots.push({ a, b, v, x: 0, y: 0 });
      });
    }
    const bar = $('#explore .ex-themes');
    bar.innerHTML =
      `<span class="mono">主題線索</span>` +
      THEMES.map((t) => `<button data-t="${t.id}">${esc(t.zh)}<i>${t.articles.length}</i></button>`).join('');
    bar.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => this.setTheme(this.theme === b.dataset.t ? null : b.dataset.t)),
    );
  }

  hover(a, b, on) {
    if (on) {
      const s = sectionOf(a.section);
      this.tip.style.setProperty('--c', s.color);
      this.tip.innerHTML = `<div class="mono">${pad(a.no)} · ${esc(s.name)} ${esc(s.zh)}</div>
        <b>${esc(a.title)}</b><span>${esc(a.subtitle)}</span><em>${a.authors.map((p) => esc(p.zh)).join('、')}</em>`;
      this.tipFor = b;
      this.onTick();
    } else if (this.tipFor === b) this.tipFor = null;
    this.tip.classList.toggle('on', !!this.tipFor);
  }

  setTheme(id) {
    this.theme = id;
    const t = THEMES.find((x) => x.id === id);
    document.querySelectorAll('#explore .ex-themes button').forEach((b) => b.classList.toggle('on', b.dataset.t === id));
    this.spots.forEach((s) => s.b.classList.toggle('dim', !!t && !t.articles.includes(s.a.no)));
    this.root.classList.toggle('themed', !!t);
    if (t) this.onTick(1.5);
  }

  layout(screen) {
    for (const s of this.spots) {
      [s.x, s.y] = screen.toScreen(...s.v);
      s.b.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
    if (this.tipFor) {
      const r = this.tipFor.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 150), innerWidth - 150);
      const below = r.top < innerHeight * 0.4;
      this.tip.style.transform = `translate(${x}px, ${below ? r.bottom + 14 : r.top - 14}px) translate(-50%, ${below ? 0 : -100}%)`;
    }
    const t = THEMES.find((x) => x.id === this.theme);
    if (!t) {
      this.svg.innerHTML = '';
      return;
    }
    const pts = t.articles.map((no) => this.spots.find((s) => s.a.no === no));
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.18 - 20;
      d += ` Q${mx},${my} ${b.x},${b.y}`;
    }
    this.svg.innerHTML = `<path d="${d}" class="th-glow"/><path d="${d}" class="th-line"/>`;
  }
}

// ---------------- reader ----------------
function pmExtras() {
  const P = PEOPLE_MODEL;
  return `<section class="rd-pm">
    <h3 class="mono">PEOPLE MODEL · 兩位 AI Persona</h3>
    <div class="pm-personas">${P.personas
      .map(
        (p) => `<div class="pm-p"><b>${esc(p.name)}</b><span class="mono">${esc(p.age)} · 買${esc(p.bought)}</span>
        <q>${esc(p.voice)}</q><p>${esc(p.insight)}</p><em class="mono">${p.order.map(esc).join(' › ')}</em></div>`,
      )
      .join('')}</div>
    <h3 class="mono">五個實戰模擬</h3>
    <dl class="pm-cases">${P.cases.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="pm-val mono">VALIDATION · r = ${P.validation.r} · MAE ${P.validation.mae}% · RMSE ${P.validation.rmse}% · ${P.validation.points.toLocaleString()} 個驗證點</div>
  </section>`;
}

export function articleHTML(a) {
  const s = sectionOf(a.section);
  const pages = [];
  for (let p = a.start; p <= a.end; p++) pages.push(p);
  const prev = ARTICLES.find((x) => x.no === a.no - 1);
  const next = ARTICLES.find((x) => x.no === a.no + 1);
  return `
    <header class="rd-h">
      <div class="rd-k mono"><b>${pad(a.no)}</b><span>${s.no} ${esc(s.name)} · ${esc(s.zh)}</span><span>pp. ${a.start}–${a.end}</span></div>
      ${a.kicker ? `<div class="rd-kicker">${esc(a.kicker)}</div>` : ''}
      <h2>${esc(a.title)}</h2>
      <p class="rd-sub">${esc(a.subtitle)}</p>
      <ul class="rd-authors">${a.authors.map((p) => `<li><b>${esc(p.zh)}</b> ${esc(p.en)}<span>${esc(p.role)}</span></li>`).join('')}</ul>
    </header>
    <blockquote class="rd-quote">${esc(a.quote)}</blockquote>
    <section class="rd-tldr"><h3 class="mono">一句話讀懂</h3><p>${esc(a.tldr)}</p></section>
    <section class="rd-stats">${a.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</section>
    <section class="rd-ins"><h3 class="mono">重點</h3><ol>${a.insights
      .map(([h, p], i) => `<li><span class="mono">${pad(i + 1)}</span><h4>${esc(h)}</h4><p>${esc(p)}</p></li>`)
      .join('')}</ol></section>
    <section class="rd-fw"><h3>${esc(a.framework.name)}</h3><dl>${a.framework.items
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join('')}</dl></section>
    ${a.special === 'peopleModel' ? pmExtras() : ''}
    ${a.closing ? `<p class="rd-closing">${esc(a.closing)}</p>` : ''}
    <section class="rd-pages"><h3 class="mono">翻開原文 · ${pages.length} 頁</h3>
      <div class="rd-thumbs">${pages
        .map((p) => `<button data-p="${p}" aria-label="第 ${p} 頁"><img loading="lazy" src="${PAGES}p${pad(p, 3)}.jpg" alt=""><span class="mono">${p}</span></button>`)
        .join('')}</div></section>
    <section class="rd-themes"><h3 class="mono">相關主題</h3><div>${themesFor(a.no)
      .map((t) => `<span>${esc(t.zh)} <i>${esc(t.en)}</i></span>`)
      .join('')}</div></section>
    <nav class="rd-nav">
      ${prev ? `<button data-no="${prev.no}">‹ ${pad(prev.no)} ${esc(prev.title)}</button>` : '<span></span>'}
      ${next ? `<button data-no="${next.no}">${pad(next.no)} ${esc(next.title)} ›</button>` : '<span></span>'}
    </nav>`;
}

export function buildIndex(onOpen) {
  const body = $('#index .ix-body');
  body.innerHTML =
    `<div class="ix-top"><div class="mono">CONTENTS · 目錄</div><h2 class="foil">決策智慧 2026</h2><p>Agentic Era：重塑品牌與人的真實距離</p></div>` +
    SECTIONS.map(
      (s) => `<section class="ix-sec" style="--c:${s.color}">
      <h3><span class="mono">${s.no}</span>${chapterName(s)}<em>${esc(s.zh)}</em></h3>
      <ol>${inSection(s.id)
        .map(
          (a) => `<li><button data-no="${a.no}"><span class="mono">${pad(a.no)}</span><b>${esc(a.title)}</b><i>${esc(a.subtitle)}</i><em>${a.authors
            .map((p) => esc(p.zh))
            .join('、')}</em><span class="mono ix-p">p.${a.start}</span></button></li>`,
        )
        .join('')}</ol></section>`,
    ).join('');
  body.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => onOpen(+b.dataset.no)));
}

// ---------------- page viewer ----------------
export class PageViewer {
  constructor() {
    this.root = $('#page');
    this.img = $('img', this.root);
    this.no = $('.pg-no', this.root);
    $('.pg-close', this.root).addEventListener('click', () => this.close());
    $('.pg-prev', this.root).addEventListener('click', () => this.go(-1));
    $('.pg-next', this.root).addEventListener('click', () => this.go(1));
    this.root.addEventListener('click', (e) => e.target === this.root && this.close());
  }

  open(p, range) {
    this.range = range;
    this.p = p;
    this.show();
    this.root.classList.add('on');
    this.root.setAttribute('aria-hidden', 'false');
  }

  show() {
    this.img.src = `${PAGES}p${pad(this.p, 3)}.jpg`;
    this.img.alt = `第 ${this.p} 頁`;
    this.no.textContent = `p. ${this.p} / ${this.range[0]}–${this.range[1]}`;
  }

  go(d) {
    this.p = Math.min(this.range[1], Math.max(this.range[0], this.p + d));
    this.show();
  }

  close() {
    this.root.classList.remove('on');
    this.root.setAttribute('aria-hidden', 'true');
  }

  get isOpen() {
    return this.root.classList.contains('on');
  }
}
