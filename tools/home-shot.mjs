// Retakes the picture of DIVE shown on the homepage menu (assets/home/dive.webp and dive-640.webp).
// Start the local server first (python -m http.server 8765 in the repo root), then:
//   node tools/home-shot.mjs <path to msedge.exe or chrome.exe> <an empty folder for the browser profile> assets/home/dive.webp assets/home/dive-640.webp 8
// 8 is the tour key of article 05 on the canal. Set Q (default 80; 58 was used) for the webp quality.
// Opens the local DIVE site in a headless browser, goes to one stop, and saves the picture
// used on the homepage menu.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [, , exe, profile, out1200, out640, key = '8'] = process.argv;
const port = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  exe,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--window-size=1200,675',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--ignore-gpu-blocklist',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

try {
  let tabs = [];
  for (let i = 0; i < 75; i++) {
    try {
      tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (tabs.some((t) => t.type === 'page')) break;
    } catch {}
    await sleep(200);
  }
  const page = tabs.find((t) => t.type === 'page');
  if (!page) throw new Error('the browser did not open a page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d);
      pending.delete(d.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
    return r.result?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 675, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/shell/' });

  let booted = false;
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    try {
      if (await ev('!!window.__shell')) {
        booted = true;
        break;
      }
    } catch {}
  }
  if (!booted) throw new Error('the site did not finish booting');

  await ev(`(() => { const sh = window.__shell; sh.stage.tier.fixed = true; sh.stage.dprScale = 1; if (sh.stage.resize) sh.stage.resize(); sh.actions.goKey(${Number(key)}); })()`);
  await sleep(3500);
  // the entry flight can override the first request: ask again once it is over
  await ev(`window.__shell.tour.jumpKey(${Number(key)})`);
  await sleep(8000);
  console.log(
    await ev(`JSON.stringify({ key: window.__shell.tour.activeKey, card: document.querySelector('#card').className, dpr: window.__shell.stage.dprScale,
      gl: (() => { const g = window.__shell.stage.renderer.getContext(); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })(),
      button: document.querySelector('#btn-ghost').textContent, toast: (document.querySelector('#toast') || {}).className, size: [innerWidth, innerHeight] })`)
  );

  const shot = async (scale, quality) =>
    (await send('Page.captureScreenshot', { format: 'webp', quality, clip: { x: 0, y: 0, width: 1200, height: 675, scale } })).result.data;
  const Q = Number(process.env.Q || 80);
  fs.writeFileSync(out1200, Buffer.from(await shot(1, Q), 'base64'));
  fs.writeFileSync(out640, Buffer.from(await shot(640 / 1200, Q + 4), 'base64'));
  console.log('saved', fs.statSync(out1200).size, fs.statSync(out640).size);
  await Promise.race([send('Browser.close'), sleep(1500)]);
  ws.close();
} finally {
  child.kill();
}
