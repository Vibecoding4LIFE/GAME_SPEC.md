// QA Phase 0: Pixel-Perfect im echten Chromium (Playwright). Schreibt Screenshots + JSON nach docs/qa/phase-0/.
const { chromium, devices } = require('/home/user/GAME_SPEC.md/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/user/GAME_SPEC.md/docs/qa/phase-0';
const profiles = [
  { name: 'desktop-1280x720', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
  { name: 'desktop-1920x1080', opts: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  { name: 'desktop-1366x768-dpr1.25', opts: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.25 } },
  { name: 'iphone13-hoch', opts: { ...devices['iPhone 13'], browserName: undefined } },
  { name: 'iphone13-quer', opts: { ...devices['iPhone 13 landscape'] } },
  { name: 'pixel7-hoch', opts: { ...devices['Pixel 7'] } },
  { name: 'pixel7-quer', opts: { ...devices['Pixel 7 landscape'] } },
];
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const p of profiles) {
    const { defaultBrowserType, ...opts } = p.opts;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errs = [], warns = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
    await page.goto('http://localhost:4173/');
    await page.waitForFunction(() => window.__KK && window.__KK.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const c = document.querySelector('#game canvas');
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return { kk: JSON.parse(JSON.stringify(window.__KK)), dpr: devicePixelRatio, inner: [innerWidth, innerHeight],
        canvas: { w: c.width, h: c.height, x: r.x, y: r.y, cssW: r.width, cssH: r.height, styleW: c.style.width, styleH: c.style.height, imageRendering: cs.imageRendering },
        ctxType: window.__KK.renderer };
    });
    const s1 = `${OUT}/${p.name}-a.png`, s2 = `${OUT}/${p.name}-b.png`;
    await page.screenshot({ path: s1 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: s2 });
    // Für die Rasterprüfung: HTML-Overlay (Systemschrift, Knopf) ausblenden, nur Canvas bewerten
    await page.addStyleTag({ content: '#overlay{display:none !important}' });
    await page.waitForTimeout(100);
    const s3 = `${OUT}/raster/${p.name}-ohne-overlay.png`;
    await page.screenshot({ path: s3 });
    const d = info.dpr;
    info.devicePx = { x: info.canvas.x * d, y: info.canvas.y * d, w: info.canvas.cssW * d, h: info.canvas.cssH * d };
    results.push({ profile: p.name, ...info, consoleErrors: errs, consoleWarnings: warns, shots: [s1, s2, s3] });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  for (const r of results) console.log(r.profile, 'dpr', r.dpr, 'inner', r.inner, 'canvas', r.canvas.w + 'x' + r.canvas.h, 'zoom dev', r.kk.layout.deviceZoom, 'css', r.kk.layout.cssZoom.toFixed(4), 'devicePx', JSON.stringify(r.devicePx), r.canvas.imageRendering, 'fish', r.kk.fishOnScreen, r.kk.renderer, 'errors', r.consoleErrors.length, r.consoleErrors.slice(0,2), 'warn', r.consoleWarnings.length);
})();
