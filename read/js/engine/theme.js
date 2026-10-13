// Canvas colors come from the page's CSS tokens, so drawings follow light / dark.
const listeners = new Set();
let colors = null;

function read() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  colors = {
    paper: v('--paper'),
    sheet: v('--sheet'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    pencil: v('--pencil'),
    faint: v('--faint'),
    people: v('--people'),
    model: v('--model'),
    ai: v('--ai'),
    intro: v('--intro-mark'),
    hlAlpha: parseFloat(v('--hl-alpha')) || 0.6,
    dark: v('--is-dark') === '1',
  };
  return colors;
}

export function theme() {
  return colors || read();
}

export function onTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  read();
  listeners.forEach((fn) => fn(colors));
}

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', changed);
new MutationObserver(changed).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

export const sectionColor = (id) => {
  const c = theme();
  return { intro: c.intro, people: c.people, model: c.model, ai: c.ai }[id] || c.people;
};

// apply an rgba alpha to a #rrggbb color
export function alpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
