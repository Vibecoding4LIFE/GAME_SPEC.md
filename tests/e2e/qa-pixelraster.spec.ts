// QA Phase 0 (qa-pruefer): Pixel-Raster im echten Browser.
// GAME_SPEC B3: Jedes Spielpixel muss exakt n×n gleichfarbige GERÄTE-Pixel belegen (n = deviceZoom).
// Prüfung: Screenshot in Gerätepixeln (ohne HTML-Overlay), dann Farb-Läufe je Zeile und Spalte im Canvas-Bereich.
// Jeder innere Lauf (nicht am Rand) muss ein Vielfaches von n lang sein. Ein Lauf mit 1 oder 3 px bei n = 2
// bedeutet: eine Spielpixel-Spalte/-Zeile ist schmaler/breiter als die anderen (nicht pixelgenau).
import { test, expect } from '@playwright/test';

interface KK {
  ready: boolean;
  layout: { deviceZoom: number };
}

// Phase 0: Testbecken (?szene=testbecken). Phase 1: zusätzlich die Welt-Szene mit Parallax, HUD, Text und Schnur.
for (const [name, url] of [['Testbecken', '/?szene=testbecken'], ['Welt 1', '/']] as const) test(`${name}: jedes Spielpixel belegt exakt n×n Gerätepixel`, async ({ page, context }) => {
  await page.goto(url);
  // Welt: Ladebildschirm wartet auf den ersten Tipp (Nutzer-Feedback Phase 1); das Testbecken startet direkt
  if (url === '/') await page.locator('.ld__prompt').click({ timeout: 30_000 });
  await page.waitForFunction(() => (window as unknown as { __KK?: KK }).__KK?.ready === true, null, { timeout: 30_000 });
  await page.addStyleTag({ content: '#overlay{display:none !important}' });
  await page.waitForTimeout(300);

  const geo = await page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const z = (window as unknown as { __KK: KK }).__KK.layout.deviceZoom;
    return { x: r.x * dpr, y: r.y * dpr, w: r.width * dpr, h: r.height * dpr, z };
  });
  const png = (await page.screenshot({ scale: 'device' })).toString('base64');

  const analyse = await context.newPage();
  await analyse.setContent('<!doctype html><body></body>');
  const result = await analyse.evaluate(
    async ({ png, geo }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const { data, width } = ctx.getImageData(0, 0, cv.width, cv.height);
      const col = (x: number, y: number): number => {
        const i = (y * width + x) * 4;
        return (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      };
      const x0 = Math.ceil(geo.x) + 1;
      const x1 = Math.floor(geo.x + geo.w) - 1;
      const y0 = Math.ceil(geo.y) + 1;
      const y1 = Math.floor(geo.y + geo.h) - 1;
      let runs = 0;
      let bad = 0;
      const samples: string[] = [];
      const scan = (horizontal: boolean): void => {
        const lines = horizontal ? [y0, y1] : [x0, x1];
        const span = horizontal ? [x0, x1] : [y0, y1];
        for (let l = lines[0]!; l < lines[1]!; l += 5) {
          let prev = -1;
          let start = span[0]!;
          let first = true;
          for (let t = span[0]!; t < span[1]!; t += 1) {
            const c = horizontal ? col(t, l) : col(l, t);
            if (c === prev) continue;
            if (prev !== -1) {
              if (!first) {
                runs += 1;
                const len = t - start;
                if (len % geo.z !== 0) {
                  bad += 1;
                  if (samples.length < 5) samples.push(`${horizontal ? 'Zeile' : 'Spalte'} ${l}: Lauf ${len} px bei ${start}`);
                }
              }
              first = false;
            }
            prev = c;
            start = t;
          }
        }
      };
      scan(true);
      scan(false);
      return { runs, bad, samples };
    },
    { png, geo },
  );
  await analyse.close();

  expect(result.runs).toBeGreaterThan(1000);
  expect(result.bad, `${result.bad} von ${result.runs} Läufen kein Vielfaches von ${geo.z}: ${result.samples.join('; ')}`).toBe(0);
});
