import { BOOK, SECTIONS, THEMES, ARTICLES, PEOPLE_MODEL, themesFor } from '../../../assets/js/data.js';
import { COLORS, setMarkup, esc, pad2, pad3 } from '../core/util.js';
import { THEME_COLORS } from '../world/threads.js';

const $ = (s, el = document) => el.querySelector(s);
const CH = {
  intro: { no: '00', name: 'INTRO', zh: '序章', place: '屋頂', en: 'ROOF' },
  people: { no: '01', name: 'PEOPLE', zh: '人', place: '運河', en: 'CANAL' },
  model: { no: '02', name: 'MODEL', zh: '模型', place: '水下', en: 'UNDER THE HARBOUR' },
  ai: { no: '03', name: 'A.I', zh: '行動', place: '深網', en: 'THE NET' },
};
export const pageUrl = (p) => `../assets/img/pages/p${pad3(p)}.jpg`;
export const openerUrl = (p) => `../assets/img/openers/p${pad3(p)}.jpg`;
const NOISE = '01#%&*+=<>/\\|決策智慧魂殼網潛';

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
    this.card.classList.remove('show');
    this.card.setAttribute('aria-hidden', 'true');
    clearTimeout(this._cardT);
    if (!key || key.kind !== 'station') return;
    this._cardT = setTimeout(() => {
      const a = ARTICLES.find((x) => x.no === key.no);
      const ch = CH[a.section];
      const pm = a.no === 12;
      this.card.style.setProperty('--c', COLORS[a.section]);
      setMarkup(
        this.card,
        `<div class="cd">
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
                  <button class="pm-btn" data-pm="wave">5,045 個魂</button>
                  <button class="pm-btn" data-pm="persona">遇見 Lisa 與 Cindy</button>
                  <button class="pm-btn" data-pm="morph">同步率 r = 0.89</button>
                </div></div>`
              : ''
          }
        </div>`
      );
      decode(this.card.querySelector('.cd-title'), a.title);
      this.card.querySelector('[data-act="digest"]').onclick = () => this.openDigest(a.no);
      this.card.querySelector('[data-act="read"]').onclick = () => this.openReader(a.start, a.end, a.start, `${pad2(a.no)} ${a.title}`);
      this.card.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => this.actions.peopleModel(b.dataset.pm)));
      const img = this.card.querySelector('.cd-thumb');
      img.onerror = () => img.remove();
      requestAnimationFrame(() => {
        this.card.classList.add('show');
        this.card.setAttribute('aria-hidden', 'false');
      });
    }, 240);
  }

  setPMButtons(mode) {
    this.card.querySelectorAll('[data-pm]').forEach((b) => b.classList.toggle('on', b.dataset.pm === mode));
  }

  // ---------------------------------------------------------------- chapter gate
  showGate(chapter) {
    if (chapter === this.gateCh) return;
    this.gateCh = chapter;
    this.gate.classList.remove('show');
    this.gate.setAttribute('aria-hidden', chapter ? 'false' : 'true');
    clearTimeout(this._gateT);
    if (!chapter) return;
    this._gateT = setTimeout(() => {
      const sec = SECTIONS.find((s) => s.id === chapter);
      const count = ARTICLES.filter((a) => a.section === chapter).length;
      const c = CH[chapter];
      const hint = { people: '往下滾動，跳進運河 ↓', model: '往下滾動，潛入水中 ↓', ai: '往下滾動，連上深網 ↓' }[chapter];
      setMarkup(
        this.gate,
        `<div class="gt" style="--c:${COLORS[chapter]}">
          <div class="gt-no">${c.no}</div>
          <div class="gt-kick">CHAPTER ${sec.no} · ${c.en} · ${count} 篇觀點</div>
          <h2>${esc(c.place)}<small>${esc(c.name)} ${esc(c.zh)}</small></h2>
          <p>${esc(sec.lead)}</p>
          <div class="gt-hint">${hint}</div>
        </div>`
      );
      requestAnimationFrame(() => this.gate.classList.add('show'));
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
        <h3>複製出來的魂，<br />對得上真人嗎？</h3>
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

  updatePM(mode, anchors, camera, w, h, near) {
    const { a, b, count, stats } = this.pm;
    count.classList.toggle('show', near && mode === 'wave');
    stats.classList.toggle('show', near && mode === 'morph');
    const per = near && mode === 'persona';
    [a, b].forEach((el, i) => {
      el.classList.toggle('show', per);
      if (!per || !anchors) return;
      const v = anchors[i].clone().project(camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      el.style.transform = `translate(${Math.round(x + (i ? 24 : -274))}px, ${Math.round(y - 60)}px)`;
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
      <section class="dg-sec"><h4>主題線 · 在魂視裡順著讀</h4><div class="dg-themes">${themesFor(a.no).map((t) => `<button data-theme="${t.id}">${esc(t.zh)}</button>`).join('')}</div></section>
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
    this.single = window.innerWidth < 820;
    this.showPage(page);
    this.openPanel('reader');
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
      <div class="ix-credits"><span>發行人<b>唐心慧</b></span><span>總編輯<b>邵懿文</b></span><span>副總編輯<b>陳介立</b></span><span>出版<b>${esc(BOOK.publisher)}</b></span></div>`
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
          <h2>雨停了。<br />魂，一直在殼裡。</h2>
          <div class="fn-en">${esc(BOOK.mottoEn)}</div>
          <p>往下潛，你看見 AI 這副殼怎麼一層一層被造出來；浮上來，你帶回來的是人——<b>信任、真實、判斷</b>。AI 改變的是分工，沒改變的是判斷。</p>
          <p>左邊是你的<b>魂紋</b>：你停下來讀過的 ${seen.size} 篇文章，各在上面留下一道紋路。沒有兩個人會一樣。</p>
          <div class="fn-actions">
            <button class="btn btn-solid" data-fn="save" style="--c:var(--ghost)">下載我的魂紋 ↓</button>
            <button class="btn btn-line" data-fn="again">再潛一次 ↺</button>
            <button class="btn btn-line" data-fn="index">目錄</button>
          </div>
          <div class="fn-credits"><span>發行人<b>唐心慧</b></span><span>總編輯<b>邵懿文</b></span><span>副總編輯<b>陳介立</b></span><span>出版<b>${esc(BOOK.publisher)}</b></span></div>
        </div>`
      );
      if (printCanvas) $('#fn-print').appendChild(printCanvas);
      this.finale.querySelector('[data-fn="save"]').onclick = () => this.actions.savePrint();
      this.finale.querySelector('[data-fn="again"]').onclick = () => this.actions.again();
      this.finale.querySelector('[data-fn="index"]').onclick = () => this.openPanel('index');
    }
    this.finale.classList.toggle('show', on);
    this.finale.setAttribute('aria-hidden', on ? 'false' : 'true');
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

  bind() {
    $('#dg-close').onclick = () => this.closePanels();
    $('#ix-close').onclick = () => this.closePanels();
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
    let sx = null;
    $('#rd-stage').addEventListener('pointerdown', (e) => (sx = e.clientX));
    $('#rd-stage').addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) (dx < 0 ? $('#rd-next') : $('#rd-prev')).click();
    });
    window.addEventListener('keydown', (e) => {
      if (this.panel === 'reader') {
        if (e.key === 'ArrowRight') $('#rd-next').click();
        if (e.key === 'ArrowLeft') $('#rd-prev').click();
      }
      if (e.key === 'Escape') {
        if (this.panel) this.closePanels();
        else this.actions.escape();
      }
    });
  }
}
