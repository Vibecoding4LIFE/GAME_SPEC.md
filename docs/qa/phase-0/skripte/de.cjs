const { chromium, devices } = require('/home/user/GAME_SPEC.md/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const [name, opts] of [['de-desktop-1280x720', { viewport: { width: 1280, height: 720 }, locale: 'de-DE' }], ['de-pixel7-hoch', { ...devices['Pixel 7'], locale: 'de-DE' }]]) {
    const c = await b.newContext(opts); const p = await c.newPage(); const errs=[];
    p.on('console', m => m.type()==='error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__KK?.ready);
    await p.waitForTimeout(500);
    const t = await p.evaluate(() => [document.title, document.documentElement.lang, document.querySelector('.overlay-badge')?.innerText, document.querySelector('.overlay-button')?.getAttribute('aria-label')]);
    await p.screenshot({ path: `docs/qa/phase-0/${name}.png` });
    console.log(name, JSON.stringify(t), 'errors', errs);
    await c.close();
  }
  await b.close();
})();
