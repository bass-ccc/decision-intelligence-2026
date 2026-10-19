// The five Higgsfield films — four chapters plus the explore map (Kling 3.0, from GPT Image 2.5 keyframes) — and what the page does around them.
// All positions are in video space: x, y from 0 to 1, measured from the top-left of the 16:9 frame.

export const SECTION_LOOK = {
  intro: { tint: [0.93, 0.89, 0.83], root: 110 },
  people: { tint: [0.77, 0.85, 0.42], root: 110, font: 'script' },
  model: { tint: [0.95, 0.66, 0.65], root: 130.81, font: 'type' },
  ai: { tint: [0.44, 0.8, 0.89], root: 146.83, font: 'pixel' },
};

export const FILMS = {
  intro: {
    src: 'media/intro',
    rest: 'media/still/intro-end.jpg',
    focus: 0.55,
    // [time, strength]: a quick flash of full-screen ASCII, timed to the film's own dissolves
    fx: [[4.15, 0.75], [7.85, 0.55]],
    // [start, end, class, html]
    captions: [
      [0.6, 6.4, 'kicker', 'DENTSU · 決策智慧 2026'],
      [1.6, 7.0, 'line', '當 AI 從工具<br>變成代理人——'],
      [8.4, 13.2, 'line', '品牌與人的距離，<br>決定了誰真正贏。'],
      [13.4, 99, 'title', ''],
    ],
  },
  people: {
    src: 'media/people',
    rest: 'media/still/people-end.jpg',
    focus: 0.5,
    fx: [[5.5, 0.6]],
    captions: [
      [0.5, 99, 'chapter', 'people'],
      [3.2, 99, 'lead', 'people'],
    ],
  },
  model: {
    src: 'media/model',
    rest: 'media/still/model-end.jpg',
    focus: 0.42,
    captions: [
      [0.5, 99, 'chapter', 'model'],
      [3.2, 99, 'lead', 'model'],
    ],
  },
  ai: {
    src: 'media/ai',
    rest: 'media/still/ai-end.jpg',
    focus: 0.6,
    captions: [
      [0.5, 99, 'chapter', 'ai'],
      [3.2, 99, 'lead', 'ai'],
    ],
  },
  explore: {
    src: 'media/explore',
    rest: 'media/still/explore.jpg',
    focus: 0.5,
    loop: true,
    captions: [],
  },
};

// Hub: the three lights at the end of the intro film (people, model, ai).
export const HUB_LIGHTS = {
  people: [0.39, 0.218],
  model: [0.499, 0.218],
  ai: [0.607, 0.218],
};

// Explore: where the three objects float in the loop film, and how far their article rings reach.
export const EXPLORE_ANCHORS = {
  people: { at: [0.143, 0.483], r: [0.08, 0.21] },
  model: { at: [0.485, 0.459], r: [0.075, 0.2] },
  ai: { at: [0.838, 0.477], r: [0.07, 0.2] },
  intro: { at: [0.485, 0.17], r: [0.05, 0] },
};
