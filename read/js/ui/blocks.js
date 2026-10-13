// Reading blocks: guess-first widget, counting numbers, the framework drawn as pencil marks,
// and the full-text reader.
import { rng } from '../engine/noise.js';

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const fmt = (v, step) => {
  const d = step < 1 ? Math.max(0, Math.min(2, Math.ceil(-Math.log10(step)))) : 0;
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// ── guess first, then see the answer ──
export function guessHTML(no, gs) {
  if (!gs) return '';
  if (gs.kind === 'pick') {
    return `<div class="guess" data-guess="${no}">
      <p class="label">先猜猜看</p>
      <p class="guess-q">${esc(gs.q)}</p>
      <div class="guess-opts">${gs.options.map((o, i) => `<button type="button" class="guess-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>
      <p class="guess-result" hidden></p>
    </div>`;
  }
  const mid = gs.min + (gs.max - gs.min) / 2;
  const start = Math.round(mid / gs.step) * gs.step;
  return `<div class="guess" data-guess="${no}">
    <p class="label">先猜猜看</p>
    <p class="guess-q">${esc(gs.q)}</p>
    <div class="guess-row">
      <span class="guess-val num" aria-live="polite">${gs.prefix || ''}${fmt(start, gs.step)}<small>${esc(gs.unit)}</small></span>
      <input type="range" id="guess-${no}" min="${gs.min}" max="${gs.max}" step="${gs.step}" value="${start}" aria-label="你的猜測" />
      <button type="button" class="btn solid guess-go">揭曉</button>
    </div>
    <div class="guess-track" hidden><div class="axis"></div></div>
    <p class="guess-result" hidden></p>
  </div>`;
}

export function wireGuess(root, gs, onDone) {
  const box = root.querySelector('.guess');
  if (!box) return;
  const result = box.querySelector('.guess-result');
  if (gs.kind === 'pick') {
    box.querySelectorAll('.guess-opt').forEach((b) =>
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        box.querySelectorAll('.guess-opt').forEach((o) => {
          o.disabled = true;
          if (+o.dataset.i === gs.answer) o.classList.add('right');
          else if (o === b) o.classList.add('wrong');
        });
        result.hidden = false;
        result.textContent = i === gs.answer ? '答對了。往下讀，看作者怎麼說。' : `答案是「${gs.options[gs.answer]}」。往下讀，看作者怎麼說。`;
        onDone?.(i === gs.answer);
      }),
    );
    return;
  }
  const input = box.querySelector('input');
  const val = box.querySelector('.guess-val');
  const go = box.querySelector('.guess-go');
  const show = (v) => (val.innerHTML = `${gs.prefix || ''}${fmt(v, gs.step)}<small>${esc(gs.unit)}</small>`);
  input.addEventListener('input', () => show(+input.value));
  go.addEventListener('click', () => {
    const v = +input.value;
    input.disabled = true;
    go.disabled = true;
    go.hidden = true;
    const track = box.querySelector('.guess-track');
    track.hidden = false;
    const pct = (x) => ((x - gs.min) / (gs.max - gs.min)) * 100;
    const you = document.createElement('span');
    you.className = 'pin';
    you.textContent = '你猜';
    you.style.left = pct(v) + '%';
    const ans = document.createElement('span');
    ans.className = 'pin ans';
    ans.textContent = '答案';
    ans.style.left = pct(v) + '%';
    track.append(you, ans);
    requestAnimationFrame(() => requestAnimationFrame(() => (ans.style.left = pct(gs.answer) + '%')));
    // count the shown value to the answer
    const t0 = performance.now();
    const from = v;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      show(from + (gs.answer - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const off = Math.abs(v - gs.answer) / (gs.max - gs.min);
    result.hidden = false;
    const ansTxt = `<b>${gs.prefix || ''}${fmt(gs.answer, gs.step)}</b>${esc(gs.unit)}`;
    result.innerHTML = off < 0.04 ? `幾乎猜中！答案是 ${ansTxt}。` : off < 0.15 ? `很接近。答案是 ${ansTxt}。` : `答案是 ${ansTxt}。比你想的${v < gs.answer ? '更多' : '更少'}。`;
    onDone?.(off < 0.04);
  });
}

// ── numbers that count up when they come into view ──
export function statsHTML(stats) {
  return `<div class="stats">${stats
    .map(([v, l]) => `<div class="stat"><span class="stat-v" data-v="${esc(v)}">${esc(v)}</span><span class="stat-l">${esc(l)}</span></div>`)
    .join('')}</div>`;
}

export function countUp(root) {
  const els = [...root.querySelectorAll('.stat-v')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      animateNumber(e.target);
    }
  });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

function animateNumber(el) {
  const raw = el.dataset.v;
  const m = raw.match(/-?[\d,]*\.?\d+/);
  if (!m || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const numTxt = m[0];
  const target = parseFloat(numTxt.replace(/,/g, ''));
  const dec = (numTxt.split('.')[1] || '').length;
  const comma = numTxt.includes(',');
  const pre = raw.slice(0, m.index);
  const post = raw.slice(m.index + numTxt.length);
  const t0 = performance.now();
  const dur = 1300;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    let v = (target * e).toFixed(dec);
    if (comma) v = Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    el.textContent = pre + v + post;
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = raw;
  };
  requestAnimationFrame(step);
}

// ── framework: a list with hand-drawn numbered circles, or a 2×2 matrix ──
function wobblyCircle(seed) {
  const r = rng(seed * 97 + 5);
  const start = r() * Math.PI * 2;
  const n = 26;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = start + (Math.PI * 2 * 1.08 * i) / n;
    const rr = 16 + (r() - 0.5) * 1.6 + (i / n) * 1.2;
    const x = 20 + Math.cos(a) * rr;
    const y = 20 + Math.sin(a) * rr;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
}

export function frameworkHTML(fw, no) {
  if (!fw) return '';
  if (fw.grid) {
    return `<p class="label">框架</p><h3 class="frame-name">${esc(fw.name)}</h3>
      <div class="frame-grid">${fw.items.map(([k, v]) => `<div><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>`;
  }
  return `<p class="label">框架</p><h3 class="frame-name">${esc(fw.name)}</h3>
    <ol class="frame-list">${fw.items
      .map(([k, v], i) => {
        const lead = k.match(/^(\d{2}|[A-Z])(?:\s|—|$)/);
        const tag = lead ? lead[1] : String(i + 1);
        const title = lead ? k.slice(lead[0].length).replace(/^[—\s]+/, '') || k : k;
        return `<li><svg viewBox="0 0 40 40" aria-hidden="true"><path d="${wobblyCircle(no * 10 + i)}" fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round"/><text x="20" y="25" text-anchor="middle">${esc(tag)}</text></svg><span class="k">${esc(title)}</span><span class="v">${esc(v)}</span></li>`;
      })
      .join('')}</ol>`;
}

// ── full text ──
export function fullHTML(doc) {
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const body = doc.blocks
    .map((b) => (b.t === 'h' ? `<h3>${esc(b.x)}</h3>` : b.t === 'q' ? `<blockquote>${esc(b.x)}</blockquote>` : `<p>${esc(b.x)}</p>`))
    .join('');
  const notes = doc.notes?.length ? `<div class="full-notes"><p class="label">註解</p><ol>${doc.notes.map((n) => `<li>${linkify(n.replace(/^\d+\s*/, ''))}</li>`).join('')}</ol></div>` : '';
  return body + notes;
}

export const fullChars = (doc) => doc.blocks.reduce((n, b) => n + b.x.length, 0);
