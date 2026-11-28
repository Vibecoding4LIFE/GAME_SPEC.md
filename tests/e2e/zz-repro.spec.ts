import { test } from '@playwright/test';
test('repro iframe', async ({ page, isMobile }, info) => {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await page.route('http://127.0.0.1:4173/__harness.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0;height:100vh;overflow:auto"><div style="height:30px">Artifact-Leiste</div><iframe id="f" src="http://localhost:4173/" sandbox="allow-scripts allow-same-origin" style="border:0;width:100%;height:calc(100vh - 30px)"></iframe><div style="height:2000px"></div></body></html>` }));
  await page.goto('http://127.0.0.1:4173/__harness.html');
  const frame = page.frameLocator('#f');
  const f = (await (await page.waitForSelector('#f')).contentFrame())!;
  await f.waitForFunction(() => (window as any).__KK?.welt, null, { timeout: 8000 }).catch(async () => {
    console.log('NOT READY', JSON.stringify(await f.evaluate(() => ({ kk: (window as any).__KK && { ...(window as any).__KK, welt: undefined }, body: document.body.innerText.slice(0, 200), canvas: !!document.querySelector('canvas') }))), JSON.stringify(errs));
    await page.screenshot({ path: `test-results/repro-notready-${info.project.name}.png` });
  });
  const st = () => f.evaluate(() => { const w = (window as any).__KK.welt; return `${w.rodState} power? depth ${w.depthM}`; });
  const box = (await page.locator('#f').boundingBox())!;
  if (!isMobile) {
    await page.mouse.click(box.x + box.width / 2, box.y + 200);
    console.log(info.project.name, 'after click', await st(), 'active', await page.evaluate(() => document.activeElement?.tagName), 'scrollY', await page.evaluate(() => scrollY));
    await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space');
    await page.waitForTimeout(300);
    console.log(info.project.name, 'after space', await st(), 'scrollY', await page.evaluate(() => scrollY));
  } else {
    const cdp = await page.context().newCDPSession(page);
    const b = await frame.locator('.touch__cast').boundingBox();
    console.log('btn', JSON.stringify(b));
    if (b) {
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await page.waitForTimeout(500);
      console.log(info.project.name, 'holding', await st());
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      console.log(info.project.name, 'after touch', await st());
    }
  }
  await page.screenshot({ path: `test-results/repro-${info.project.name}.png` });
  console.log('ERRS', JSON.stringify(errs));
});
