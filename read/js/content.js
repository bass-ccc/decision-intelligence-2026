// Reading layer on top of the book digest in assets/js/data.js:
// an opening question and one "guess first" per article, plus reading-time helpers.
export { BOOK, SECTIONS, THEMES, ARTICLES, PEOPLE_MODEL, sectionOf, themesFor } from '../../assets/js/data.js';
import { ARTICLES, THEMES } from '../../assets/js/data.js';

// guess.kind: 'num' (slider) or 'pick' (choose one)
export const HOOKS = {
  1: {
    hook: '面對 AI，你的公司是先知先覺、後知後覺，還是不知不覺？',
    guess: { kind: 'pick', q: '真正拉開企業差距的，是哪一件事？', options: ['用了多少 AI 工具', 'AI 預算有多大', '學習循環有多快'], answer: 2 },
  },
  2: {
    hook: '品牌離 AI 越近，會不會反而離人越遠？',
    guess: { kind: 'num', q: 'AI Persona 的回答，和真人調查的吻合度（相關係數）有多高？', min: 0, max: 1, step: 0.01, answer: 0.89, unit: '' },
  },
  3: {
    hook: '五十個人拍了好幾個月的廣告，第一則留言卻是「AI 做的吧」？',
    guess: { kind: 'num', q: '現在的台灣，每幾個人裡就有一位 65 歲以上？', min: 2, max: 12, step: 1, answer: 5, unit: '人' },
  },
  4: {
    hook: '當 AI 代理替消費者做決定，品牌要先說服誰？',
    guess: { kind: 'num', q: '多少比例的行銷長同意：代理型 AI 將重大影響業務？', min: 0, max: 100, step: 1, answer: 89, unit: '%' },
  },
  5: {
    hook: '看起來是聲量不足，背後會不會其實是定位不清？',
    guess: { kind: 'pick', q: '台灣人講英文卡住，最大的原因是什麼？', options: ['文法不熟', '單字量不夠', '開口前那一秒的心理壓力'], answer: 2 },
  },
  6: {
    hook: '當內容都能被生成，你還相信眼前的人真的存在嗎？',
    guess: { kind: 'num', q: '世壯運上，擲出標槍拿下金牌的爺爺幾歲？', min: 60, max: 110, step: 1, answer: 105, unit: '歲' },
  },
  7: {
    hook: 'AI 能幫你挑到最划算的，但它能讓你「特別想要」嗎？',
    guess: { kind: 'num', q: '多少比例的消費者，曾經直接在社群上完成購買？', min: 0, max: 100, step: 1, answer: 70, unit: '%' },
  },
  8: {
    hook: '你的注意力，能在一個螢幕上停留多久？',
    guess: { kind: 'num', q: '2004 年，人在單一螢幕上平均停留約 150 秒。現在呢？', min: 0, max: 150, step: 1, answer: 47, unit: '秒' },
  },
  9: {
    hook: '消費者問 AI「哪個牌子好」，AI 讀的是你的官網，還是別人怎麼說你？',
    guess: { kind: 'pick', q: 'AI 最常拿來當推薦依據的是？', options: ['品牌官網', '新聞稿', 'PTT、Dcard、評論裡的真實討論'], answer: 2 },
  },
  10: {
    hook: '廣告「被看見」，就等於「被注意」嗎？',
    guess: { kind: 'num', q: '自願注視廣告 10 秒以上，品牌回想會增加多少？', min: 0, max: 200, step: 1, answer: 79, unit: '%', prefix: '+' },
  },
  11: {
    hook: '沒有新集數的《甄嬛傳》，為什麼每年春節還有人一起追？',
    guess: { kind: 'num', q: '多少比例的 Z 世代，會懷念自己出生之前的年代？', min: 0, max: 100, step: 1, answer: 65, unit: '%' },
  },
  12: {
    hook: '如果你的消費者，隨時都能被追問「為什麼」？',
    guess: { kind: 'num', q: 'People Model 背後，有多少位真實受訪者？', min: 500, max: 10000, step: 5, answer: 5045, unit: '位' },
  },
  13: {
    hook: '你上次買的手機支架，是哪個牌子？',
    guess: { kind: 'num', q: '買磁吸支架那幾天，大約有幾個相似的廣告同時在追你？', min: 1, max: 50, step: 1, answer: 20, unit: '個' },
  },
  14: {
    hook: '當每家公司都用同一個 AI，差距還剩在哪裡？',
    guess: { kind: 'pick', q: '生成式 AI 的任務是什麼？', options: ['Generate：生成最合理的答案', 'Verify：保證答案正確'], answer: 0 },
  },
  15: {
    hook: '顧客卡住，是找不到入口，還是不確定下一步？',
    guess: { kind: 'num', q: '全球平均的購物車放棄率是多少？', min: 0, max: 100, step: 0.1, answer: 70.2, unit: '%' },
  },
  16: {
    hook: 'AI 每週幫員工省下一整天，那一天拿去做什麼了？',
    guess: { kind: 'num', q: '多少比例的員工，從沒收到「省下的時間該怎麼用」的指引？', min: 0, max: 100, step: 1, answer: 66, unit: '%' },
  },
  17: {
    hook: '按電梯沒反應的時候，你會怎麼做？',
    guess: { kind: 'num', q: '依版位任務重新設計推薦後，推薦互動率提升多少？', min: 0, max: 300, step: 1, answer: 132, unit: '%', prefix: '+' },
  },
  18: {
    hook: '如果使用者不是人，而是 AI Agent，你的體驗設計還成立嗎？',
    guess: { kind: 'num', q: '原本 30 個選項，Agent 可能只呈現幾個給消費者？', min: 1, max: 30, step: 1, answer: 3, unit: '個' },
  },
  19: {
    hook: '如果所有品牌都被 AI 引用了，接下來呢？',
    guess: { kind: 'pick', q: '看完 AI 的推薦之後，很多消費者接著做什麼？', options: ['直接下單', '轉身去 Dcard、Threads 找缺點', '再問 AI 一次'], answer: 1 },
  },
  20: {
    hook: 'AI 最大的風險，是犯錯，還是變得平均？',
    guess: { kind: 'num', q: 'Vanguard 把社群素材從 Brief 到交付，從 5.5 天縮短到幾天？', min: 0, max: 5.5, step: 0.05, answer: 0.25, unit: '天' },
  },
  21: {
    hook: '一個大創意，怎麼變成 48 個市場都說得通的內容？',
    guess: { kind: 'num', q: '多少比例的台灣員工，已經在工作中使用生成式 AI？', min: 0, max: 100, step: 0.1, answer: 31.8, unit: '%' },
  },
  22: {
    hook: '你敢讓 AI 替你的顧客下單嗎？',
    guess: { kind: 'num', q: 'Olive Young 做過膚質檢測的顧客，購買轉換率是多少？（沒做的是 53%）', min: 0, max: 100, step: 1, answer: 73, unit: '%' },
  },
};

export const articleByNo = (no) => ARTICLES.find((a) => a.no === no);

// characters a reader actually reads in the digest
export function digestChars(a) {
  let n = (a.tldr || '').length + (a.quote || '').length + (a.closing || '').length;
  for (const [h, b] of a.insights || []) n += h.length + b.length;
  for (const [h, b] of a.framework?.items || []) n += h.length + b.length;
  return n;
}
// considered reading of Chinese: about 300 characters a minute for the dense digest (plus a minute
// for the guess and the drawing), about 400 a minute for running text
export const minutes = (chars, rate = 400) => Math.max(1, Math.round(chars / rate));
export const digestMinutes = (a) => minutes(digestChars(a), 300) + 1;

// next article: share the most themes, prefer one not read yet, then the next in book order
export function nextFor(no, readSet) {
  const mine = THEMES.filter((t) => t.articles.includes(no)).map((t) => t.id);
  const scored = ARTICLES.filter((a) => a.no !== no).map((a) => {
    const shared = THEMES.filter((t) => t.articles.includes(a.no) && mine.includes(t.id));
    return { a, shared, score: shared.length * 2 + (readSet.has(a.no) ? -10 : 0) + (a.no === no + 1 ? 1.5 : 0) };
  });
  scored.sort((x, y) => y.score - x.score);
  const seq = ARTICLES.find((a) => a.no === no + 1);
  const picks = scored.slice(0, 2);
  if (seq && !picks.some((p) => p.a.no === seq.no) && !readSet.has(seq.no)) picks[1] = scored.find((s) => s.a.no === seq.no);
  return picks.filter(Boolean);
}
