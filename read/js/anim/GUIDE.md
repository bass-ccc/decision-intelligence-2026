# Drawing guide (read/js/anim)

Every article in CLOSER has one live drawing, made only with code (Canvas 2D). No images, no video,
no external libraries. `a12.js` (People Model) and `book.js` are the reference implementations.

## The idea every drawing shares
- **Pencil = people.** Wobbly graphite strokes from `env.ink` (they "boil" slightly at 6 fps, like hand animation).
- **ASCII glyphs = AI.** Monospace characters on a grid from `env.ascii` (ramp ` .·:-;=+i1$S0D#@`).
- **Highlighter = the section colour** (`env.acc`: Intro cream, People lime, Model pink, A.I cyan), used as a
  fill behind things (`ink.marker`, `ink.blob`), never as a text colour.
- Kraft paper is the CSS background; the canvas is transparent. Never paint a full background.
- Labels are short, in Traditional Chinese, taken from the article (data in `assets/js/data.js`, full text in
  `read/data/text/aNN.json`). Never invent facts or numbers. Made-up data used only to illustrate an idea is
  labelled `示意` on the canvas.

## Module shape
```js
// NN Title — one line on what the picture says.
// step 0 … step 5: one line each.
export const hint = '拖曳三個消息來源';   // ≤ 14 characters, what the reader can do
export default function make(env) {
  // build state here (deterministic: use env.N.rng(seed), never Math.random)
  return {
    frame(t, dt) { /* draw everything, every frame */ },
    resize(w, h) {},          // optional: recompute layout (also called once after make)
    step(i, prev) {},         // optional: the text moved to step i
    click(x, y) {},           // optional
    down(x, y) {}, up(x, y) {}, drag(x, y, dx, dy) {}, // optional
    warm(seconds) {},         // optional: fast-forward a simulation without drawing
  };
}
```
The stage clears the canvas before each `frame` and sets the transform, so draw in CSS pixels (`env.w × env.h`).

## Steps (scroll-driven)
The article text scrolls past: step 0 = TL;DR + quote, steps 1–4 = the four insights (in the order of
`article.insights`), step 5 = guess, numbers, framework, closing. Read `env.step` and `env.stepAt` (time the
step started) in `frame`. Ease between states with `env.N.approach(cur, target, dt, halfLife)`; when `dt === 0`
(still frame) jump straight to the target. Each step must look clearly different from the previous one.

## env
- `g` (2D context), `w`, `h`, `dpr`, `t`, `boil`, `mini` (small card on the home page), `reduced` (reduced motion),
  `step`, `prevStep`, `stepAt`, `pointer {x, y, in, down}`, `section`, `data.article` (the article object).
- `c` colours: `paper sheet ink ink2 pencil faint people model ai intro hlAlpha dark`. `acc` = section colour.
- `N`: `rng(seed)`, `hash(...)`, `noise2`, `noise3`, `clamp`, `lerp`, `smooth`, `easeOut`, `easeInOut`, `approach`.
- `font(kind, size, weight)` → CSS font string. Kinds: `hand` (LXGW WenKai TC, the human voice), `body`
  (Noto Sans TC), `mono` (IBM Plex Mono), `pixel` (Pixelify Sans, numbers/labels), `latin` (Montserrat).

### env.ink (pencil)
`line(x1,y1,x2,y2,o)`, `path(pts,o)`, `circle(cx,cy,r,o)`, `rect(x,y,w,h,o)`, `poly(pts,o)`, `arrow(x1,y1,x2,y2,o)`,
`hatch({x,y,w,h}|{x,y,r}, o)`, `dot(x,y,r,o)`, `text(str,x,y,o)`, `para(str,x,y,maxW,o)` (wrapped, returns height),
`wrap(str,maxW,o)` (→ lines), `marker(x,y,w,h,o)` (highlighter swipe), `blob(x,y,r,o)` (round highlighter).
Options: `w` width, `color`, `alpha`, `seed` (keep each stroke's seed stable!), `wobble`, `passes`, `boil:false`;
text: `font`, `size`, `weight`, `align`, `baseline`, `rotate`.

### env.ascii (glyphs)
`glyph(v|char, x, y, cell, color, alpha)` (v = density 0..1), `field(x0,y0,w,h,cell,fn(x,y,col,row)→0..1, color, alpha)`,
`text(str,x,y,cell,color,alpha)`, `line(x1,y1,x2,y2,cell,color,alpha,char)`.

## Layout rules
- Works from 320×300 to 1400×900. Desktop pane ≈ 640–760 × 700–850; phone ≈ 375 × 340.
- Keep the top 34 px and the bottom 52 px free of important content (step dots and caption sit there).
- Text in the canvas: ≥ 13 px; main labels 15–20 px in `hand`. Not too many words: the article text is next to it.
- `mini` mode (home cards, about 280×210): show the core idea only, no text smaller than 12 px, fewer elements.
  Cards show a **still** frame (`frame(3.5, 0)`) and animate only on hover, so the still must look finished.
- Reduced motion: the stage draws `frame(stillT, 0)` once and animates briefly after a step change or touch.

## Performance
- One frame ≲ 4 ms on a laptop: at most ~3,000 glyph draws, a few hundred pencil strokes (`ink.line` is the
  expensive one: batch tiny marks into one `beginPath()` like `a12.js` does).
- No `shadowBlur`, no `filter`, no `getImageData` per frame, no big allocations per frame.
- Use only `env.c` / `env.acc` colours (they follow light / dark).

## Testing
`read/dev.html?a=a06&step=2` (desktop), add `&mini=1&t=3.5` for the card still, `&theme=dark` for dark.
Headless screenshots: `node <scratchpad>/tools/cdp.mjs <outdir> 1100x760 3500 "dev.html?a=a06&step=0" …`
(`RM=1` env = reduced motion, `DARK=1` = dark). Fix every console error it prints.
