// Reading in place. At an article stop there is no card to open: the article's digest stands on
// the scene in six beats.
//   0      開場  what the article says, in one breath
//   1 - 4        the four key points, each with the number that belongs to it
//   5      框架  the framework and the numbers left over
// On a wide screen the six beats are one column that scrolls (the wheel over the text reads the
// article; over the scene it dives). On a narrow screen one beat shows at a time, turned sideways.
// The digest comes from assets/js/data.js. Under each beat stands a passage of the article itself,
// copied word for word from read/data/text by tools/beats-src.mjs (see tools/beats-picks.json for
// which paragraphs, and which key point each number rides). Nothing is written here.
import { PEOPLE_MODEL, themesFor } from '../../../assets/js/data.js';
import { esc } from '../core/util.js';
import { STAT_AT, SRC, LIGHT } from './beats-src.js';

export const BEATS = 6;

// Every article stop reads this way. ?beats=0 brings back the old card and its drawer, to compare.
const off = new URLSearchParams(location.search).get('beats') === '0';
export const hasBeats = (no) => !off && no >= 1 && no <= 22;

// Article 12 is the one stop whose scene has modes of its own (sea.js). Each belongs to the key
// point that says it: WHY, people you can talk to (Lisa and Cindy); HOW, the 5,045 respondents;
// 驗證, simulated against real answers, r = 0.89. Reading that point shows that mode.
export const PM_AT = { 1: 'persona', 2: 'wave', 3: 'morph' };

// A number never stands apart from its label, and one that no key point states waits in 框架.
const statsAt = (a, i) => a.stats.filter((s, k) => ((STAT_AT[a.no] || [])[k] || 5) === i);

export const beatName = (i) => (i === 0 ? '開場' : i === BEATS - 1 ? '框架' : `重點 ${i} / 4`);
// what the rail calls each beat: [mark, words]
export const beatTab = (a, i) => (i === 0 ? ['開場', ''] : i === BEATS - 1 ? ['框架', a.framework.name] : [String(i), a.insights[i - 1][0]]);

const statRows = (list) => (list.length ? `<div class="bt-stats">${list.map(([n, l]) => `<p class="bt-stat"><b>${esc(n)}</b><span>${esc(l)}</span></p>`).join('')}</div>` : '');
const srcBlock = (a, i) => {
  const list = (SRC[a.no] || [])[i] || [];
  return list.length ? `<div class="bt-src" data-fold><span>原文</span>${list.map((x) => `<p>${esc(x)}</p>`).join('')}</div>` : '';
};
// On a wide screen Lisa and Cindy speak from bubbles in the scene. A narrow screen has no room
// for those, so there the same two voices stand in the text.
const personas = () =>
  `<div class="bt-pm" data-fold>${PEOPLE_MODEL.personas.map((p) => `<p><b>${esc(p.name)}</b><span>${esc(p.age)} · ${esc(p.bought)}</span><q>${esc(p.voice)}</q></p>`).join('')}</div>`;
// A framework's keys run from "01" to a whole English phrase. Short keys sit beside their words;
// long ones sit above them. (Width in ems: a CJK glyph is one, a Latin letter about half.)
const ems = (s) => [...s].reduce((n, c) => n + (c.codePointAt(0) > 0x2e7f ? 1 : 0.55), 0);
const stacked = (fw) => Math.max(...fw.items.map(([k]) => ems(k))) > 6;
// the theme threads this article is on: they sit beside the one button, under every beat
export const themesHTML = (a) => `<span>主題線</span>${themesFor(a.no).map((t) => `<button data-theme="${t.id}">${esc(t.zh)}</button>`).join('')}`;

// the inside of one beat
export function beatHTML(a, i) {
  if (i === 0) {
    // The number that also stands in the scene as a figure of light is named here, with its label,
    // so the figure the reader sees on arriving is never without its words.
    const lead = a.stats[LIGHT[a.no]];
    return `<p class="bt-tldr">${esc(a.tldr)}</p>${lead ? `<div class="bt-stats bt-lead"><p class="bt-stat"><b>${esc(lead[0])}</b><span>${esc(lead[1])}</span></p></div>` : ''}<blockquote class="bt-quote" data-fold>${esc(a.quote)}</blockquote>${srcBlock(a, i)}`;
  }
  if (i < BEATS - 1) {
    const [title, text] = a.insights[i - 1];
    const pm = a.no === 12 && PM_AT[i] === 'persona' ? personas() : '';
    return `<h3 class="bt-h"><b>${i}</b>${esc(title)}</h3><p class="bt-p">${esc(text)}</p>${pm}${statRows(statsAt(a, i))}${srcBlock(a, i)}`;
  }
  const fw = a.framework;
  return `<h3 class="bt-h"><b>◆</b>${esc(fw.name)}</h3>
    <ol class="bt-fw${stacked(fw) ? ' stack' : ''}"${stacked(fw) ? ' data-fold' : ''}>${fw.items.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
    ${statRows(statsAt(a, i))}
    ${a.closing ? `<p class="bt-closing">${esc(a.closing)}</p>` : ''}${srcBlock(a, i)}`;
}
