// What this reader has finished, kept in their own browser only. Works without storage too.
const KEY = 'closer.read.v1';
const listeners = new Set();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= 1 && n <= 22) : [];
  } catch {
    return [];
  }
}
const read = new Set(load());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...read]));
  } catch {
    /* private window or blocked storage: progress lasts for this visit only */
  }
}

export const TOTAL = 22;
export const isRead = (n) => read.has(n);
export const readSet = () => read;
export const readCount = () => read.size;
export const distance = () => TOTAL - read.size;

export function markRead(n) {
  if (read.has(n)) return false;
  read.add(n);
  save();
  listeners.forEach((fn) => fn(n));
  return true;
}

export function onRead(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// light / dark choice (empty = follow the system)
export function savedTheme() {
  try {
    return localStorage.getItem('closer.theme') || '';
  } catch {
    return '';
  }
}
export function saveTheme(v) {
  try {
    v ? localStorage.setItem('closer.theme', v) : localStorage.removeItem('closer.theme');
  } catch {
    /* ignore */
  }
}
