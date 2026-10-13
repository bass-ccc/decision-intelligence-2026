// CLOSER — 《2026 決策智慧》 reading site. Hash routes:
//   #/        home: the whole-book drawing, then all 22 articles
//   #/map     same page, scrolled to the articles
//   #/s/<id>  a section opener (intro | people | model | ai)
//   #/a/<n>   an article spread
//   #/end     the finale
import { SECTIONS, THEMES, ARTICLES, sectionOf, HOOKS, articleByNo, digestMinutes, minutes, nextFor } from './content.js';
import { stageFor, keyFor } from './anim/index.js';
import { mount } from './engine/stage.js';
import { distanceLine } from './ui/distance.js';
import * as store from './ui/store.js';
import { esc, guessHTML, wireGuess, statsHTML, countUp, frameworkHTML, fullHTML, fullChars } from './ui/blocks.js';

const view = document.getElementById('view');
const root = document.documentElement;
const pad = (n) => String(n).padStart(2, '0');
let scope = [];
const on = (fn) => scope.push(fn);
function clearScope() {
  for (const fn of scope) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
  scope = [];
}

// ───────── theme toggle ─────────
{
  const saved = store.savedTheme();
  if (saved) root.dataset.theme = saved;
  document.getElementById('theme-btn').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    store.saveTheme(next);
  });
}

// ───────── top bar: the distance line ─────────
const hudK = () => store.readCount() / store.TOTAL;
const hudStage = mount(document.getElementById('hud-line'), distanceLine(hudK), { section: 'people', maxDpr: 2, stillT: 0.01, hoverOnly: true });
const hudNum = document.getElementById('hud-num');
const hudLink = document.getElementById('hud-distance');
function paintHud() {
  hudNum.textContent = store.distance();
  hudLink.setAttribute('aria-label', `品牌與人的距離：還有 ${store.distance()} 步。已讀 ${store.readCount()} 篇。`);
  hudStage.redraw();
}
paintHud();
store.onRead(() => {
  paintHud();
  hudStage.setStep(store.readCount()); // wakes the line so the dots glide closer
});

// ───────── toast ─────────
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(html, ms = 4200) {
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), ms);
}

// ───────── full text (fetched once per article) ─────────
const texts = new Map();
const getText = (no) => {
  if (!texts.has(no)) texts.set(no, fetch(`data/text/${keyFor(no)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return texts.get(no);
};

// ───────── cards with small live drawings ─────────
function cardHTML(a, extra = '') {
  const H = HOOKS[a.no];
  return `<a class="card${store.isRead(a.no) ? ' read' : ''}" href="#/a/${a.no}" data-sec="${a.section}" data-no="${a.no}">
    <div class="card-art"><canvas aria-hidden="true"></canvas><span class="card-no">${pad(a.no)}</span><span class="card-read">✓ 讀過</span></div>
    <div class="card-body">
      <h3 class="card-title">${esc(a.title)}</h3>
      ${a.subtitle ? `<p class="card-sub">${esc(a.subtitle)}</p>` : ''}
      <p class="card-hook">${esc(H.hook)}</p>
      ${extra}
      <p class="card-meta"><span>精華 ${digestMinutes(a)} 分鐘</span><span>原書 p.${a.start}–${a.end}</span></p>
    </div>
  </a>`;
}

function wireCards(rootEl) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        mountCard(e.target);
      }
    },
    { rootMargin: '240px' },
  );
  rootEl.querySelectorAll('.card').forEach((c) => io.observe(c));
  on(() => io.disconnect());
}

async function mountCard(card) {
  const no = +card.dataset.no;
  const a = articleByNo(no);
  const st = await stageFor(card.querySelector('canvas'), keyFor(no), { section: a.section, mini: true, hoverOnly: true, stillT: 3.5 });
  if (!st) return;
  on(() => st.destroy());
  const live = (v) => () => st.setHover(v);
  card.addEventListener('pointerenter', live(true));
  card.addEventListener('pointerleave', live(false));
  card.addEventListener('focus', live(true));
  card.addEventListener('blur', live(false));
}

function firstUnread() {
  return ARTICLES.find((a) => !store.isRead(a.no))?.no || 1;
}

// ───────── home ─────────
function renderHome(toMap) {
  document.title = 'CLOSER · 2026 決策智慧';
  delete view.dataset.sec;
  const n = firstUnread();
  const started = store.readCount() > 0;
  view.innerHTML = `
  <section class="hero" aria-label="整本書的動畫">
    <div class="hero-stage" data-sec="people">
      <canvas id="book" aria-label="「決策智慧」四個字由點組成；往下捲，它們變成品牌與人兩個點，再變成 22 篇文章的地圖。"></canvas>
      <div class="hero-cap top" data-phase="0" data-on="1">
        <div class="hero-kicker"><span class="label">dentsu Taiwan · 2026</span><span class="hero-en">DECISION INTELLIGENCE</span></div>
        <p class="hero-sub">Agentic 時代：重塑品牌與人的真實距離</p>
      </div>
      <div class="hero-cap bottom" data-phase="0" data-on="1"><p class="hero-scroll">移動游標：左邊是鉛筆，右邊是 AI。往下捲</p></div>
      <div class="hero-cap top" data-phase="1" data-on="0"><p class="hero-q">品牌離 AI 越近，會不會反而離人越遠？<small>這本書用 22 篇觀點，回答這個問題。</small></p></div>
      <div class="hero-cap top" data-phase="2" data-on="0"><p class="hero-q">22 篇，就是 22 步。<small>每讀完一篇，品牌與人就近一步。點一顆星，開始讀。</small></p></div>
      <div class="hero-tip" hidden></div>
    </div>
  </section>

  <section class="lede">
    <h2>讀一篇，<br />近一步。<span class="hand">《2026 決策智慧》互動閱讀版</span></h2>
    <div class="lede-body">
      <p>這是電通台灣《2026 決策智慧》的閱讀版。序章加上 People、Model、A.I 三個章節，一共 22 篇觀點。</p>
      <p>每一篇都有一張會動的圖、一個開場問題，和一題先讓你猜的數字。往下捲，圖會跟著文字一步步改變。精華大約 3 分鐘，想讀完整的，就展開全文。</p>
      <p>畫面上方那條線，是品牌與人的距離。現在還有 <b class="num">${store.distance()}</b> 步。</p>
      <div class="lede-actions">
        <a class="btn solid" href="#/a/${n}">${started ? `繼續讀：${pad(n)} ${esc(articleByNo(n).title)}` : '從第 1 篇開始'}</a>
        <a class="btn" href="#/s/intro">從序章看起</a>
      </div>
    </div>
  </section>

  <div class="themes" id="themes" role="group" aria-label="用主題找文章">
    <span class="label">主題線</span>
    ${THEMES.map((t) => `<button type="button" class="chip" data-theme-id="${t.id}" aria-pressed="false">${esc(t.zh)}<small>${t.articles.length}</small></button>`).join('')}
  </div>

  ${SECTIONS.map(
    (s) => `<section class="shelf" data-sec="${s.id}" id="shelf-${s.id}">
      <header class="shelf-head">
        <span class="shelf-no">${s.no}</span>
        <h2 class="shelf-name"><a href="#/s/${s.id}">${esc(s.name)}</a><span class="zh">${esc(s.zh)}</span></h2>
        <p class="shelf-lead">${esc(s.lead)}</p>
      </header>
      <div class="cards">${ARTICLES.filter((a) => a.section === s.id).map((a) => cardHTML(a)).join('')}</div>
    </section>`,
  ).join('')}

  <footer class="foot">
    <p>內容來自電通行銷傳播集團《2026 決策智慧》（共 196 頁）。這個網站的每一張圖都是程式即時畫出來的，沒有使用任何圖片或影片。</p>
    <nav aria-label="其他版本"><span>其他版本：</span><a href="../shell/">DIVE</a><a href="../tower/">螺旋書塔</a><a href="../film/">The New Distance</a></nav>
    <p>© 電通行銷傳播集團。書中內容版權所有。</p>
  </footer>`;

  // the whole-book drawing, driven by scroll
  const hero = view.querySelector('.hero');
  const caps = [...hero.querySelectorAll('.hero-cap')];
  const tip = hero.querySelector('.hero-tip');
  const bookData = {
    progress: 0,
    theme: null,
    read: store.readSet(),
    open: (no) => (location.hash = `#/a/${no}`),
    hover(no, x, y) {
      if (!no) {
        tip.hidden = true;
        return;
      }
      const a = articleByNo(no);
      tip.hidden = false;
      tip.innerHTML = `${pad(no)} ${esc(a.title)}<small>${store.isRead(no) ? '✓ 讀過 · ' : ''}${esc(HOOKS[no].hook)}</small>`;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    },
  };
  stageFor(hero.querySelector('canvas'), 'book', { section: 'people', data: bookData, stillT: 6, maxDpr: 1.5 }).then((st) => st && on(() => st.destroy()));
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    const stageH = hero.querySelector('.hero-stage').offsetHeight;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - stageH)));
    bookData.progress = p;
    const phase = p < 0.26 ? 0 : p < 0.6 ? 1 : 2;
    caps.forEach((c) => (c.dataset.on = +c.dataset.phase === phase ? '1' : '0'));
  };
  addEventListener('scroll', onScroll, { passive: true });
  on(() => removeEventListener('scroll', onScroll));
  onScroll();

  // theme filter
  const chips = [...view.querySelectorAll('.chip')];
  chips.forEach((ch) =>
    ch.addEventListener('click', () => {
      const t = THEMES.find((x) => x.id === ch.dataset.themeId);
      const was = ch.getAttribute('aria-pressed') === 'true';
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      const active = was ? null : t;
      if (active) ch.setAttribute('aria-pressed', 'true');
      bookData.theme = active;
      view.querySelectorAll('.card').forEach((card) => card.classList.toggle('dim', !!active && !active.articles.includes(+card.dataset.no)));
    }),
  );

  wireCards(view);
  if (toMap) requestAnimationFrame(() => document.getElementById('themes').scrollIntoView());
}

// ───────── section opener ─────────
function renderSection(id) {
  const s = sectionOf(id);
  if (!s) return renderHome();
  document.title = `${s.name} ${s.zh} · CLOSER`;
  view.dataset.sec = id;
  const list = ARTICLES.filter((a) => a.section === id);
  const i = SECTIONS.indexOf(s);
  const nextS = SECTIONS[i + 1];
  view.innerHTML = `
  <section class="sec-hero">
    <canvas aria-label="${esc(s.name)} 章節的開場動畫"></canvas>
    <div class="sec-hero-text">
      <div class="sec-hero-no">${s.no}</div>
      <h1 class="sec-hero-name">${esc(s.name)}<span class="zh">${esc(s.zh)}</span></h1>
      <p class="sec-hero-lead"><span>${esc(s.lead)}</span></p>
    </div>
  </section>
  <section class="shelf">
    <header class="shelf-head"><span class="shelf-no">${list.length}</span><h2 class="shelf-name">篇觀點</h2><p class="shelf-lead">原書 p.${list[0].start}–${list[list.length - 1].end}${s.divider ? `，章名頁 p.${s.divider[0]}–${s.divider[1]}` : ''}</p></header>
    <div class="cards">${list.map((a) => cardHTML(a)).join('')}</div>
    <div class="pager">
      <a class="btn solid" href="#/a/${(list.find((a) => !store.isRead(a.no)) || list[0]).no}">開始讀這一章</a>
      ${nextS ? `<a class="btn" href="#/s/${nextS.id}">下一章：${esc(nextS.name)} ${esc(nextS.zh)} →</a>` : `<a class="btn" href="#/end">終章 →</a>`}
    </div>
  </section>`;
  stageFor(view.querySelector('.sec-hero canvas'), `sec-${id}`, { section: id, stillT: 6 }).then((st) => st && on(() => st.destroy()));
  wireCards(view);
}

// ───────── article spread ─────────
function renderArticle(no) {
  const a = articleByNo(no);
  if (!a) return renderHome();
  const s = sectionOf(a.section);
  const H = HOOKS[no];
  const idx = ARTICLES.indexOf(a);
  const prev = ARTICLES[idx - 1];
  const next = ARTICLES[idx + 1];
  const steps = ['開場', ...a.insights.map((x) => x[0]), a.framework?.name || '整體'];
  document.title = `${a.title}｜CLOSER · 2026 決策智慧`;
  view.dataset.sec = a.section;
  const authorLine = a.authors.map((p) => p.zh).join('、');
  const dMin = digestMinutes(a);

  view.innerHTML = `
  <div class="progress" aria-hidden="true"></div>
  <article class="spread" aria-labelledby="a-title">
    <div class="drawing">
      <canvas aria-label="${esc(a.title)} 的互動圖，會跟著右邊的文字改變"></canvas>
      <div class="steps-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="drawing-cap"><p class="step-name"><b>STEP 0/${steps.length - 1}</b><span>${esc(steps[0] === '開場' ? a.subtitle || a.title : steps[0])}</span></p><p class="hint"></p></div>
    </div>
    <div class="text">
      <header>
        <div class="kicker"><a class="sec-tag" href="#/s/${s.id}">${s.no} ${esc(s.name)}</a><span class="label">${pad(no)} / 22 · 原書 p.${a.start}–${a.end}</span></div>
        <h1 class="a-title" id="a-title">${a.kicker ? `<span class="kick">${esc(a.kicker)}</span>` : ''}${esc(a.title)}</h1>
        ${a.subtitle ? `<p class="a-sub">${esc(a.subtitle)}</p>` : ''}
        <div class="authors">${a.authors.map((p) => `<p><b>${esc(p.zh)}</b>${p.en ? `<i>${esc(p.en)}</i>` : ''}<span>${esc(p.role)}</span></p>`).join('')}</div>
      </header>
      <p class="hook">${esc(H.hook)}</p>
      <p class="readtime"><span>精華 ${dMin} 分鐘</span><span class="full-time"></span>${store.isRead(no) ? '<span>✓ 你讀過這篇</span>' : ''}</p>

      <section class="beat" data-step="0"><span class="beat-no">TL;DR</span><p class="tldr">${esc(a.tldr)}</p></section>
      <section class="beat" data-step="0"><blockquote class="quote">${esc(a.quote)}<cite>${esc(authorLine)}</cite></blockquote></section>
      ${a.insights
        .map(
          ([h, b], i) => `<section class="beat" data-step="${i + 1}">
        <span class="beat-no">${pad(i + 1)} / ${pad(a.insights.length)}</span>
        <h2>${esc(h)}</h2><p>${esc(b)}</p></section>`,
        )
        .join('')}
      <section class="beat" data-step="5">${guessHTML(no, H.guess)}</section>
      <section class="beat" data-step="5"><p class="label">數字</p>${statsHTML(a.stats)}</section>
      <section class="beat" data-step="5">${frameworkHTML(a.framework, no)}</section>
      ${a.closing ? `<section class="beat" data-step="5"><p class="closing">${esc(a.closing)}</p></section>` : ''}

      <section class="finish" aria-live="polite">
        <p class="label">讀完精華</p>
        <canvas aria-hidden="true"></canvas>
        <p class="finish-line"></p>
        <button type="button" class="btn solid" data-go-full>讀全文</button>
      </section>
    </div>
  </article>

  <section class="full" id="full" aria-labelledby="full-h">
    <div class="full-head">
      <p class="label">全文 · 原書 p.${a.start}–${a.end}</p>
      <h2 id="full-h">${esc(a.title)}${a.subtitle ? `：${esc(a.subtitle)}` : ''}</h2>
      <p>${esc(authorLine)}</p>
    </div>
    <div class="full-body"><p class="full-loading">載入全文…</p></div>
  </section>

  <section class="next" aria-label="接著讀">
    <h2>接著讀</h2>
    <div class="cards next-cards"></div>
    <div class="pager">
      ${prev ? `<a class="btn" href="#/a/${prev.no}">← ${pad(prev.no)} ${esc(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="btn" href="#/a/${next.no}">${pad(next.no)} ${esc(next.title)} →</a>` : `<a class="btn" href="#/end">終章 →</a>`}
    </div>
  </section>`;

  // the drawing
  const canvas = view.querySelector('.drawing canvas');
  const stepName = view.querySelector('.step-name');
  const dots = [...view.querySelectorAll('.steps-dots i')];
  let stage = null;
  let current = 0;
  stageFor(canvas, keyFor(no), { section: a.section, stillT: 5, data: { article: a } }).then((st) => {
    if (!st) return;
    stage = st;
    on(() => st.destroy());
    view.querySelector('.hint').textContent = st.hint || '';
    st.setStep(current);
  });
  const setStep = (i) => {
    if (i === current) return;
    current = i;
    stage?.setStep(i);
    dots.forEach((d, k) => d.classList.toggle('on', k <= i));
    stepName.innerHTML = `<b>STEP ${i}/${steps.length - 1}</b><span>${esc(i === 0 ? a.subtitle || a.title : steps[i])}</span>`;
  };
  const beatIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setStep(+e.target.dataset.step);
    },
    { rootMargin: '-46% 0px -46% 0px' },
  );
  view.querySelectorAll('.beat').forEach((b) => beatIO.observe(b));
  on(() => beatIO.disconnect());

  // reading progress bar
  const bar = view.querySelector('.progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true });
  on(() => removeEventListener('scroll', onScroll));

  // guess + numbers
  if (H.guess) wireGuess(view, H.guess);
  on(countUp(view));

  // finishing the digest closes the distance by one step
  const finish = view.querySelector('.finish');
  const finishTxt = finish.querySelector('.finish-line');
  const finishStage = mount(finish.querySelector('canvas'), distanceLine(hudK, { label: true }), { section: a.section, stillT: 0.01, hoverOnly: true });
  on(() => finishStage.destroy());
  const t0 = performance.now();
  const NEED = 30; // seconds on the page before a read counts
  let timer = 0;
  const paintFinish = () => {
    const d = store.distance();
    finishTxt.innerHTML = store.isRead(no)
      ? d === 0
        ? '22 篇都讀完了。品牌與人，終於靠在一起。<a href="#/end">去看終章 →</a>'
        : `這篇讀完了。距離還有 <b>${d}</b> 步。`
      : '慢慢讀。再停留一下，這一步就算數。';
  };
  paintFinish();
  const complete = () => {
    if (!store.markRead(no)) return;
    paintFinish();
    finishStage.setStep(store.readCount());
    const d = store.distance();
    toast(d === 0 ? '22 篇都讀完了。<a href="#/end">去看終章 →</a>' : `近了一步。品牌與人的距離：<b class="num">${d}</b>`);
  };
  const fio = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || store.isRead(no)) return;
    const spent = (performance.now() - t0) / 1000;
    if (spent >= NEED) complete();
    else {
      clearTimeout(timer);
      timer = setTimeout(complete, (NEED - spent) * 1000);
    }
  });
  fio.observe(finish);
  on(() => {
    fio.disconnect();
    clearTimeout(timer);
  });

  // full text
  const fullBody = view.querySelector('.full-body');
  const fullBtn = finish.querySelector('[data-go-full]');
  fullBtn.addEventListener('click', () => view.querySelector('#full').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  getText(no).then((doc) => {
    if (!fullBody.isConnected) return;
    if (!doc) {
      fullBody.innerHTML = '<p>全文暫時載不進來。請重新整理一次。</p>';
      return;
    }
    fullBody.innerHTML = fullHTML(doc);
    const m = minutes(fullChars(doc));
    view.querySelector('.full-time').textContent = `全文 ${m} 分鐘`;
    fullBtn.textContent = `讀全文（約 ${m} 分鐘）`;
  });

  // ← → move between articles in book order
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') location.hash = next ? `#/a/${next.no}` : '#/end';
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/a/${prev.no}`;
  };
  addEventListener('keydown', onKey);
  on(() => removeEventListener('keydown', onKey));

  // what to read next
  const nextBox = view.querySelector('.next-cards');
  nextBox.innerHTML = nextFor(no, store.readSet())
    .map(({ a: n, shared }) => cardHTML(n, shared.length ? `<p class="why">共同主題：${shared.map((t) => esc(t.zh)).join('、')}</p>` : ''))
    .join('');
  wireCards(nextBox);
}

// ───────── finale ─────────
function renderEnd() {
  document.title = '終章｜CLOSER · 2026 決策智慧';
  view.dataset.sec = 'intro';
  const d = store.distance();
  const unread = ARTICLES.filter((a) => !store.isRead(a.no));
  view.innerHTML = `
  <section class="end">
    <canvas aria-label="品牌與人兩個點慢慢靠近，中間的 AI 字元變成手寫字。"></canvas>
    <div class="end-text">
      <p class="count">${d === 0 ? '22 篇都讀完了。' : `你讀了 ${store.readCount()} 篇，還有 ${d} 步。`}</p>
      <p>只要 AI 做的是幫品牌更懂人，品牌與人之間的距離，才會是真實的靠近。</p>
      <p class="label">邵懿文 · Agentic 時代：品牌與人的真實距離（原書 p.12–17）</p>
    </div>
  </section>
  ${
    unread.length
      ? `<section class="end-todo" data-sec="people"><header class="shelf-head"><span class="shelf-no">${unread.length}</span><h2 class="shelf-name">篇還沒讀</h2><p class="shelf-lead">讀完它們，兩個點就會真的靠在一起。</p></header><div class="cards">${unread.map((a) => cardHTML(a)).join('')}</div></section>`
      : ''
  }`;
  view.querySelectorAll('.end-todo .card').forEach((c) => (c.dataset.sec = articleByNo(+c.dataset.no).section));
  stageFor(view.querySelector('.end canvas'), 'end', { section: 'intro', data: { k: store.readCount() / store.TOTAL }, stillT: 9 }).then((st) => st && on(() => st.destroy()));
  wireCards(view);
}

// ───────── router ─────────
function route() {
  clearScope();
  const h = location.hash || '#/';
  let m;
  if ((m = h.match(/^#\/a\/(\d+)/))) renderArticle(+m[1]);
  else if ((m = h.match(/^#\/s\/(\w+)/))) renderSection(m[1]);
  else if (h.startsWith('#/end')) renderEnd();
  else renderHome(h.startsWith('#/map'));
  if (!h.startsWith('#/map')) scrollTo(0, 0);
  view.classList.remove('view-in');
  void view.offsetWidth;
  view.classList.add('view-in');
}
addEventListener('hashchange', route);
route();
