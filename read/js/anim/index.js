// Loads a drawing by key ('a01'…'a22', 'book', 'sec-people', 'end', …) and mounts it on a canvas.
import { mount } from '../engine/stage.js';

const cache = new Map();
// only these names can be loaded (no paths: keeps import() inside this folder)
const KEYS = /^(a(0[1-9]|1\d|2[0-2])|book|end|placeholder|sec-(intro|people|model|ai))$/;

export function load(key) {
  if (!KEYS.test(key)) key = 'placeholder';
  if (!cache.has(key)) {
    cache.set(
      key,
      import(`./${key}.js`).catch((e) => {
        console.warn('[closer] drawing not ready:', key, e);
        return import('./placeholder.js');
      }),
    );
  }
  return cache.get(key);
}

export async function stageFor(canvas, key, opts = {}) {
  const mod = await load(key);
  if (!canvas.isConnected) return null;
  const stage = mount(canvas, mod.default, opts);
  stage.hint = mod.hint || '';
  return stage;
}

export const keyFor = (no) => 'a' + String(no).padStart(2, '0');
