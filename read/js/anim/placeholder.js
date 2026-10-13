// Shown only if an article's own drawing failed to load.
export const hint = '';
export default function make(env) {
  return {
    frame(t) {
      const { w, h, ink, ascii, c } = env;
      const r = Math.min(w, h) * 0.28;
      ascii.field(0, 0, w, h, env.mini ? 12 : 14, (x, y) => {
        const d = Math.hypot(x - w / 2, y - h / 2) / r;
        return d < 1 ? 0.15 + 0.5 * (1 - d) * (0.6 + 0.4 * Math.sin(t * 2 + d * 6)) : -1;
      }, c.ink, 0.5);
      ink.circle(w / 2, h / 2, r, { seed: 9, w: 1.6 });
    },
  };
}
