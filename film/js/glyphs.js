// A strip of characters from empty to dense, like the ASCII half of the cover chimp.
// Drawn once into a canvas and used as a texture by the shaders.

export const RAMP = ' .·:-;=+i1$S0D#@';

export async function glyphAtlas(cell = 64) {
  const font = `500 ${Math.round(cell * 0.78)}px "IBM Plex Mono", monospace`;
  try {
    await document.fonts.load(font, RAMP);
  } catch (e) {
    /* fall back to whatever monospace is there */
  }
  const c = document.createElement('canvas');
  c.width = cell * RAMP.length;
  c.height = cell;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...RAMP].forEach((ch, i) => g.fillText(ch, i * cell + cell / 2, cell / 2 + cell * 0.04));
  return { canvas: c, count: RAMP.length };
}
