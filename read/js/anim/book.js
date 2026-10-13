// The whole book in one drawing, driven by the home page's scroll (env.data.progress 0..1).
//  A  決策智慧 made of ~2,600 points. Left of the cursor they are pencil strokes, right of it
//     they are ASCII glyphs: the cover's half-pencil, half-ASCII idea, without the picture.
//  B  The points flow into two dots far apart: 品牌 (glyphs) and 人 (pencil), with the line between.
//  C  The line becomes a winding path of 22 small seed-heads, one per article, grouped by section.
//     Articles you have read are drawn in pencil; unread ones are still glyphs. Hover, then click.
import { SECTIONS, ARTICLES } from '../content.js';
import { rng, noise2, noise3, smooth, lerp, approach, clamp } from '../engine/noise.js';
import { RAMP } from '../engine/ascii.js';

export const hint = '移動游標，往下捲';

const GOLD = Math.PI * (3 - Math.sqrt(5));

export default function make(env) {
  const D = env.data || { progress: 0, read: new Set() };
  const N = env.mini ? 900 : Math.min(2800, Math.round((env.w * env.h) / 360));
  const r = rng(7);
  const P = Array.from({ length: N }, (_, i) => ({
    x: env.w / 2 + (r() - 0.5) * env.w,
    y: env.h / 2 + (r() - 0.5) * env.h,
    d: r(), // stagger
    v: r(), // glyph weight
    a: r() * Math.PI, // stroke angle
    role: i % 10 < 4 ? 0 : i % 10 < 8 ? 1 : 2, // brand disc / person disc / line between
    A: [0, 0],
    B: [0, 0],
    C: [0, 0],
    cl: -1, // cluster (article index) in layout C
  }));
  let title = [];
  let clusters = [];
  let seam = env.w * 0.5;
  let hoverIdx = -1;
  let prog = D.progress || 0;
  let fontReady = false;
  const layer = document.createElement('canvas');
  let layerKey = '';

  // ── layout A: sample the title from an offscreen canvas ──
  function sampleTitle() {
    const w = env.w;
    const h = env.h;
    const box = { x: w * 0.06, y: h * 0.24, w: w * 0.88, h: h * 0.5 };
    const c = document.createElement('canvas');
    const scale = 0.5;
    c.width = Math.max(1, Math.round(box.w * scale));
    c.height = Math.max(1, Math.round(box.h * scale));
    const g = c.getContext('2d');
    const size = Math.min(c.height * 0.92, (c.width / 4) * 0.98);
    g.font = `900 ${size}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('決策智慧', c.width / 2, c.height / 2 + size * 0.04);
    const img = g.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    const step = 2;
    for (let y = 0; y < c.height; y += step)
      for (let x = 0; x < c.width; x += step) if (img[(y * c.width + x) * 4 + 3] > 140) pts.push([box.x + x / scale, box.y + y / scale]);
    // shuffle so every point gets a spread-out target
    const rr = rng(11);
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rr() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    title = pts;
  }

  // ── layout C: a boustrophedon path of 22 clusters ──
  function layoutC() {
    const w = env.w;
    const h = env.h;
    const cols = w > 1100 ? 8 : w > 760 ? 6 : 4;
    const rows = Math.ceil(ARTICLES.length / cols);
    const top = h * 0.3;
    const bottom = h * 0.86;
    const left = w * 0.1;
    const right = w * 0.9;
    const dx = (right - left) / (cols - 1);
    const dy = rows > 1 ? (bottom - top) / (rows - 1) : 0;
    const rc = Math.min(dx * 0.32, dy * 0.3 || 40, 46);
    clusters = ARTICLES.map((a, i) => {
      const row = Math.floor(i / cols);
      let col = i % cols;
      if (row % 2) col = cols - 1 - col;
      const wob = noise2(i * 0.7, 3) * rc * 0.35;
      return { a, x: left + col * dx, y: top + row * dy + wob, r: rc, sec: a.section };
    });
    return { rc, cols, dx, dy };
  }

  function layout() {
    const w = env.w;
    const h = env.h;
    sampleTitle();
    layoutC();
    const bx = w * 0.16;
    const px = w * 0.84;
    const cy = h * 0.56;
    const R = Math.min(w, h) * 0.13;
    const perC = Math.floor(N / ARTICLES.length);
    P.forEach((p, i) => {
      // A
      const t = title.length ? title[i % title.length] : [w / 2, h / 2];
      p.A = [t[0] + (p.d - 0.5) * 1.5, t[1] + (p.v - 0.5) * 1.5];
      // B
      if (p.role === 2) {
        const k = (i / N) * 2.5 % 1;
        p.B = [lerp(bx + R * 1.15, px - R * 1.15, k), cy + noise2(k * 6, 1) * 6];
      } else {
        const j = Math.floor(i / 10) * 4 + (i % 10) % 4;
        const rad = R * Math.sqrt((j % 1100) / 1100);
        const ang = j * GOLD;
        const cx = p.role === 0 ? bx : px;
        p.B = [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
      }
      // C
      const ci = Math.floor(i / perC);
      if (ci < clusters.length) {
        const c = clusters[ci];
        const j = i % perC;
        const rad = c.r * Math.sqrt((j + 0.5) / perC);
        const ang = j * GOLD;
        p.C = [c.x + Math.cos(ang) * rad, c.y + Math.sin(ang) * rad];
        p.cl = ci;
      } else {
        // leftovers drift along the path between clusters
        const k = r();
        const s = Math.min(clusters.length - 2, Math.floor(k * (clusters.length - 1)));
        const f = k * (clusters.length - 1) - s;
        const a = clusters[s];
        const b = clusters[s + 1];
        p.C = [lerp(a.x, b.x, f), lerp(a.y, b.y, f) + (r() - 0.5) * 4];
        p.cl = -1;
      }
    });
  }

  layout();
  if (document.fonts) {
    document.fonts.load('900 120px "Noto Sans TC"', '決策智慧').then(() => {
      fontReady = true;
      layout();
    }).catch(() => {});
  }

  const sectionCol = (id) => ({ intro: env.c.intro, people: env.c.people, model: env.c.model, ai: env.c.ai }[id]);

  function nearestCluster(x, y) {
    let best = -1;
    let bd = 1e9;
    clusters.forEach((c, i) => {
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < c.r * 1.6 && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  return {
    resize() {
      layout();
    },
    warm() {
      prog = D.progress || 0;
    },
    click(x, y) {
      if (prog < 0.62) return;
      const i = nearestCluster(x, y);
      if (i >= 0) D.open?.(clusters[i].a.no);
    },
    frame(t, dt) {
      const { g, w, h, ink, ascii, c, pointer } = env;
      prog = dt > 0 ? approach(prog, D.progress || 0, dt, 0.12) : D.progress || 0;
      const k1 = smooth((prog - 0.1) / 0.24);
      const k2 = smooth((prog - 0.46) / 0.24);
      const dark = c.dark;

      // seam: follows the cursor, otherwise sweeps slowly
      const want = pointer.in ? pointer.x : w * (0.5 + 0.28 * Math.sin(t * 0.35));
      seam = dt > 0 ? approach(seam, want, dt, 0.18) : want;

      // hover in layout C
      let hi = -1;
      if (k2 > 0.9 && pointer.in) hi = nearestCluster(pointer.x, pointer.y);
      if (hi !== hoverIdx) {
        hoverIdx = hi;
        env.canvas.style.cursor = hi >= 0 ? 'pointer' : '';
        if (hi >= 0) {
          const cl = clusters[hi];
          D.hover?.(cl.a.no, cl.x, cl.y - cl.r - 4);
        } else D.hover?.(0);
      }
      const theme = D.theme;

      // ── layout C furniture: the path, section halos, numbers ──
      if (k2 > 0.02) {
        g.save();
        g.globalAlpha = k2;
        const pts = clusters.map((cl) => [cl.x, cl.y]);
        ink.path(pts, { w: 1, alpha: 0.35, seed: 5, wobble: 2, passes: 1 });
        clusters.forEach((cl, i) => {
          const on = !theme || theme.articles.includes(cl.a.no);
          ink.blob(cl.x, cl.y, cl.r * (i === hoverIdx ? 1.32 : 1.18), { color: sectionCol(cl.sec), alpha: (on ? c.hlAlpha * 0.7 : 0.08) * (i === hoverIdx ? 1.3 : 1), seed: i + 1 });
          ink.text(String(cl.a.no).padStart(2, '0'), cl.x - cl.r * 0.95, cl.y + cl.r + 16, { font: 'mono', size: 13, color: on ? c.ink : c.ink2, alpha: on ? 1 : 0.4 });
          if (D.read?.has(cl.a.no)) ink.text('✓', cl.x + cl.r * 0.7, cl.y + cl.r + 16, { font: 'body', size: 12, color: c.ink });
        });
        // section labels above their first cluster
        SECTIONS.forEach((s) => {
          const first = clusters.find((cl) => cl.sec === s.id);
          if (first) ink.text(`${s.no} ${s.name}`, first.x - first.r, first.y - first.r - 10, { font: 'mono', size: 14, color: c.ink });
        });
        // brand and person at the ends of the path
        const f = clusters[0];
        const l = clusters[clusters.length - 1];
        const ex = Math.min(70, w * 0.06);
        ink.dot(f.x - ex, f.y, 6, { seed: 2 });
        ink.text('品牌', f.x - ex, f.y + 26, { size: 14, align: 'center', color: c.ink2 });
        ink.circle(l.x + (l.x > w / 2 ? ex : -ex), l.y, 6, { seed: 3, w: 1.6 });
        ink.text('人', l.x + (l.x > w / 2 ? ex : -ex), l.y + 26, { size: 14, align: 'center', color: c.ink2 });
        g.restore();
      }

      // ── layout B furniture: labels under the two dots ──
      const kB = k1 * (1 - k2);
      if (kB > 0.02) {
        const cy = h * 0.56;
        const R = Math.min(w, h) * 0.13;
        ink.text('品牌', w * 0.16, cy + R + 34, { size: 20, align: 'center', alpha: kB, color: c.ink });
        ink.text('人', w * 0.84, cy + R + 34, { size: 20, align: 'center', alpha: kB, color: c.ink });
        ascii.text('AGENT', w * 0.5 - 22, cy - 24, 10, c.ink2, kB * 0.7);
      }

      // ── the points ── (once the map has settled they are drawn into a cached layer at the
      // 6 fps pencil "boil" rate; while things move they are drawn every frame)
      const drawPoints = (tt) => {
        const g = env.g;
        const glyphCell = env.mini ? 7 : Math.max(7, Math.min(11, w / 130));
        const strokes = [];
        const marks = [];
        const z = tt * 0.25;
        for (let i = 0; i < N; i++) {
          const p = P[i];
          const a1 = smooth(k1 * 1.35 - p.d * 0.35);
          const a2 = smooth(k2 * 1.35 - p.d * 0.35);
          let x = lerp(lerp(p.A[0], p.B[0], a1), p.C[0], a2);
          let y = lerp(lerp(p.A[1], p.B[1], a1), p.C[1], a2);
          // drift while travelling
          const travel = Math.sin(Math.PI * a1) + Math.sin(Math.PI * a2);
          if (travel > 0.01) {
            x += noise3(p.A[0] * 0.01, p.A[1] * 0.01, z) * 34 * travel;
            y += noise3(p.A[1] * 0.01, p.A[0] * 0.01, z + 9) * 34 * travel;
          }
          // breathe
          x += Math.sin(tt * 0.9 + p.d * 40) * 1.1;
          y += Math.cos(tt * 0.8 + p.v * 40) * 1.1;
          // the cursor pushes points aside in the title
          if (pointer.in && k1 < 0.5) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 3600) {
              const f = (1 - d2 / 3600) * 14;
              const d = Math.sqrt(d2) || 1;
              x += (dx / d) * f;
              y += (dy / d) * f;
            }
          }
          // pencil or glyph?
          let pencil;
          if (a2 > 0.5) pencil = p.cl >= 0 ? !!D.read?.has(clusters[p.cl].a.no) : true;
          else if (a1 > 0.5) pencil = p.role !== 0 && !(p.role === 2 && x > w / 2);
          else pencil = x < seam;
          let alpha = 1;
          if (a2 > 0.5 && theme && p.cl >= 0 && !theme.articles.includes(clusters[p.cl].a.no)) alpha = 0.18;
          if (a2 > 0.5 && p.cl === hoverIdx && hoverIdx >= 0) alpha = 1;
          if (pencil) strokes.push(x, y, -0.95 + (p.a - 1.57) * 0.22 + noise2(x * 0.008, y * 0.008) * 0.35, alpha);
          else marks.push(x, y, p.v, alpha);
        }

        // pencil strokes, batched
        g.save();
        g.strokeStyle = c.pencil;
        g.lineCap = 'round';
        const L = env.mini ? 2.2 : 3.4;
        for (const pass of [1, 0.35]) {
          g.globalAlpha = 0.75 * pass;
          g.lineWidth = pass === 1 ? 1.1 : 0.8;
          g.beginPath();
          for (let i = 0; i < strokes.length; i += 4) {
            if (strokes[i + 3] < 1 && pass === 1) continue;
            const x = strokes[i];
            const y = strokes[i + 1];
            const a = strokes[i + 2] + (pass === 1 ? 0 : 0.12);
            g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
            g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
          }
          g.stroke();
        }
        // faded strokes (filtered out by theme)
        g.globalAlpha = 0.14;
        g.beginPath();
        for (let i = 0; i < strokes.length; i += 4) {
          if (strokes[i + 3] >= 1) continue;
          const x = strokes[i];
          const y = strokes[i + 1];
          const a = strokes[i + 2];
          g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
          g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
        }
        g.stroke();
        g.restore();

        // glyphs, with a faint holographic offset like the cover's foil title
        const holo = [c.people, c.model, c.ai];
        const gi = (v) => RAMP[Math.min(RAMP.length - 1, 4 + Math.floor(v * (RAMP.length - 4)))];
        if (k1 < 0.6) {
          for (let i = 0; i < marks.length; i += 4) {
            const x = marks[i];
            const y = marks[i + 1];
            // diagonal foil bands drifting slowly, like the cover's iridescent title
            const band = (x * 0.0035 + y * 0.0025 + tt * 0.06) % 1;
            const hc = holo[Math.floor(band * 2.999)];
            ascii.glyph(gi(marks[i + 2]), x + 1.2, y + 1, glyphCell, hc, (dark ? 0.85 : 0.9) * marks[i + 3] * (1 - k1));
          }
        }
        for (let i = 0; i < marks.length; i += 4) ascii.glyph(gi(marks[i + 2]), marks[i], marks[i + 1], glyphCell, c.ink, 0.92 * marks[i + 3]);
      };
      const settled = Math.abs(prog - (D.progress || 0)) < 0.002 && k2 > 0.999 && !(pointer.in && k1 < 0.5);
      if (settled) {
        const key = [env.boil, hoverIdx, theme?.id || '', w, h, env.dpr, c.ink, c.pencil, D.read?.size || 0].join('|');
        if (key !== layerKey) {
          layer.width = Math.round(w * env.dpr);
          layer.height = Math.round(h * env.dpr);
          const lg = layer.getContext('2d');
          lg.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
          env.g = lg;
          drawPoints(env.boil / 6);
          env.g = g;
          layerKey = key;
        }
        g.drawImage(layer, 0, 0, w, h);
      } else {
        layerKey = '';
        drawPoints(t);
      }

      // seam marker in the title
      if (k1 < 0.3 && !env.mini) {
        const a = (1 - k1 / 0.3) * 0.5;
        ink.line(seam, h * 0.22, seam, h * 0.78, { w: 0.8, alpha: a, seed: 9, wobble: 1.5, passes: 1 });
        ink.text('人', seam - 14, h * 0.21, { size: 14, align: 'right', alpha: a * 1.6, color: c.ink2 });
        ascii.text('AI', seam + 10, h * 0.21 - 5, 11, c.ink2, a * 1.6);
      }
    },
  };
}
