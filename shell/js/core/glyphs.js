import * as THREE from 'three';

// Ghost-vision glyph ramps. Each ramp is re-sorted by measured ink coverage,
// so brightness always maps to the right glyph whichever font renders it.
export const RAMPS = [
  [' ', '.', ':', '-', '1', '7', '+', '4', '0', '8'], // code
  [' ', '.', '一', '人', '入', '中', '心', '信', '智', '魂'], // the book's own words
];

const FONT = (px) => `500 ${px}px "IBM Plex Mono", "Noto Sans TC", Consolas, monospace`;

function coverage(ch, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = FONT(Math.round(px * 0.9));
  g.fillText(ch, px / 2, px * 0.54);
  const d = g.getImageData(0, 0, px, px).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s += d[i];
  return s;
}

// cellPx is in device pixels; the atlas is drawn at exactly that size so the
// post pass can sample it 1:1 with nearest filtering (crisp terminal glyphs).
export function buildGlyphAtlas(cellPx) {
  const n = RAMPS[0].length;
  const c = document.createElement('canvas');
  c.width = cellPx * n;
  c.height = cellPx * RAMPS.length;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = FONT(Math.round(cellPx * 0.9));
  RAMPS.forEach((ramp, r) => {
    const sorted = ramp.map((ch) => ({ ch, cov: coverage(ch, 32) })).sort((a, b) => a.cov - b.cov);
    sorted.forEach((gl, i) => g.fillText(gl.ch, i * cellPx + cellPx / 2, r * cellPx + cellPx * 0.54));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { texture: tex, count: n, rows: RAMPS.length };
}
