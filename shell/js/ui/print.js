import { ARTICLES } from '../../../assets/js/data.js';
import { drawPrint } from '../core/textures.js';
import { COLORS } from '../core/util.js';

// Ghost Print: a fingerprint that only your reading path could have made.
// Every article you stopped at bends the ridges with one minutia; the colours
// are the chapters you spent your time in.

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function ghostPrint(seen) {
  const list = [...seen].sort((a, b) => a - b);
  const mins = list.map((no, i) => {
    const a = no * 2.39996 + 0.4;
    const rad = 0.18 + ((no * 37) % 11) / 11 * 0.62;
    return { u: rad * Math.cos(a), v: rad * Math.sin(a) * 1.24, s: (no + i) % 2 ? 1 : -1 };
  });
  let h = 7;
  for (const no of list) h = (h * 31 + no * 17) % 1000;
  const core = [((h % 13) - 6) * 0.012, -0.16 + ((h % 7) - 3) * 0.02];
  const F = 23 + (list.length % 6);

  const count = { intro: 0, people: 0, model: 0, ai: 0 };
  for (const no of list) count[ARTICLES.find((a) => a.no === no).section]++;
  const total = Math.max(1, list.length);
  const order = ['people', 'model', 'ai', 'intro'];
  const sectors = [];
  let acc = 0;
  for (const ch of order) {
    const w = list.length ? count[ch] / total : 0.25;
    if (w > 0) sectors.push({ from: acc, to: acc + w, col: hex(COLORS[ch]) });
    acc += w;
  }
  const colAt = (u, v) => {
    const a = (Math.atan2(v, u) / (Math.PI * 2) + 1.25) % 1;
    for (let i = 0; i < sectors.length; i++) {
      const s = sectors[i];
      if (a >= s.from && a < s.to) {
        // soften the seams between chapters
        const n = sectors[(i + 1) % sectors.length];
        const k = Math.max(0, (a - (s.to - 0.04)) / 0.08);
        return s.col.map((c, j) => c + (n.col[j] - c) * Math.min(1, k) * 0.5);
      }
    }
    return sectors[0] ? sectors[0].col : [104, 240, 196];
  };
  const pr = drawPrint(640, 800, mins, (u, v, t) => {
    const c = colAt(u, v);
    return [c[0] * t, c[1] * t, c[2] * t, 255 * Math.min(1, t * 1.6)];
  }, { F, core, wob: h * 0.01, scale: 1.06 });

  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#07090b';
  g.fillRect(0, 0, W, H);
  // faint cyberbrain grid
  g.strokeStyle = 'rgba(104,240,196,0.06)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 36) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, H);
    g.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();
  }
  g.shadowColor = 'rgba(104,240,196,0.35)';
  g.shadowBlur = 30;
  g.drawImage(pr, (W - 640) / 2, 250);
  g.shadowBlur = 0;

  g.fillStyle = '#68f0c4';
  g.font = '500 24px "IBM Plex Mono", monospace';
  g.fillText('GHOST PRINT', 80, 110);
  g.fillStyle = '#d9efe9';
  g.font = '900 64px "Noto Sans TC", sans-serif';
  g.fillText('你的魂紋', 80, 190);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(217,239,233,0.55)';
  g.font = '400 22px "IBM Plex Mono", monospace';
  g.fillText('DECISION INTELLIGENCE 2026', W - 80, 110);
  g.fillText(new Date().toISOString().slice(0, 10), W - 80, 146);
  g.textAlign = 'left';

  // the articles that shaped it
  const y0 = 1120;
  g.fillStyle = 'rgba(217,239,233,0.55)';
  g.font = '400 22px "IBM Plex Mono", monospace';
  g.fillText(`SYNC ${String(Math.round((list.length / 22) * 100)).padStart(2, '0')}% · ${list.length} / 22`, 80, y0);
  const chipW = (W - 160) / 22;
  for (let i = 1; i <= 22; i++) {
    const a = ARTICLES.find((x) => x.no === i);
    const on = seen.has(i);
    g.fillStyle = on ? COLORS[a.section] : 'rgba(255,255,255,0.08)';
    g.fillRect(80 + (i - 1) * chipW, y0 + 26, chipW - 4, 18);
  }
  g.fillStyle = '#d9efe9';
  g.font = '500 30px "Noto Sans TC", sans-serif';
  g.fillText('殼越強，魂在哪裡？讀過的每一篇，都在這裡留下一道紋路。', 80, y0 + 110);
  g.fillStyle = 'rgba(217,239,233,0.45)';
  g.font = '400 20px "IBM Plex Mono", monospace';
  g.fillText('《2026 決策智慧》 · 電通行銷傳播集團', 80, y0 + 160);
  return c;
}
