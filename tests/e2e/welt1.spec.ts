// Phase 1: Welt 1 spielbar – Wurf per Tastatur bzw. Touch, Sinken, Biss, Drill per Bot bis zum Fang, Fang-Karte,
// alle 13 Verhaltensarten mit Telegraph, Drill-Video, FPS-Messung. Konsole muss fehlerfrei bleiben.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startGame, touch, watchConsole } from './helpers';

interface Welt {
  rodState: string; tension: number; zone: { lo: number; hi: number } | null; behavior: string | null; pullDir: string | null;
  catches: number; lastCatch: { fishId: string } | null; lastEscape: string | null; drillLog: string[]; hookedBehaviors: string[];
  catchCardOpen: boolean; fps: number; depthM: number; snag: { count: number; needed: number } | null;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;
const welt = (page: Page) => page.evaluate(() => {
  const w = (window as unknown as { __KK: { welt: Welt & { hooks: unknown } } }).__KK.welt;
  return { ...w, hooks: undefined, drillLog: [...w.drillLog], hookedBehaviors: [...w.hookedBehaviors] } as Welt;
});
const hook = (page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => ((window as unknown as { __KK: { welt: { hooks: Hooks } } }).__KK.welt.hooks[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const);

async function openWorld(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page.mainFrame());
  await hook(page, 'resetSave');
  await page.waitForFunction(() => (window as unknown as { __KK?: { welt?: { rodState: string } } }).__KK?.welt?.rodState === 'Idle', null, { timeout: 30_000 });
  await hook(page, 'setPhase', 'Tag');
  await hook(page, 'setWeather', 'Sonnig');
}

const waitState = (page: Page, states: string[], timeout = 20_000) =>
  page.waitForFunction((s) => s.includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), states, { timeout });

test('Welt 1: auswerfen, sinken, Biss, Drill bis zum Fang, Fang-Karte (Tastatur bzw. Touch)', async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const errors = watchConsole(page);
  await openWorld(page);
  await hook(page, 'forceFish', 'F004'); // Schleie: Ruhig, kein Zahnfisch
  const cdp = isMobile ? await page.context().newCDPSession(page) : null;
  const btn = isMobile ? await page.locator('.touch__cast').boundingBox() : null;
  const bx = btn ? btn.x + btn.width / 2 : 0;
  const by = btn ? btn.y + btn.height / 2 : 0;
  const press = async (down: boolean) => {
    if (cdp) await touch(cdp, down ? 'touchStart' : 'touchEnd', bx, by);
    else if (down) await page.keyboard.down('Space');
    else await page.keyboard.up('Space');
  };

  // Wurf: halten (Kraftbalken), loslassen. Verhakt sich der Köder am Ufer (Hänger, E W1), einmal tippen und warten:
  // der verpatzte Takt kostet den (unendlichen) Wurm, dann neu auswerfen.
  for (let attempt = 0; ; attempt++) {
    await press(true);
    await page.waitForTimeout(450);
    await press(false);
    await waitState(page, ['Sinking', 'Waiting']);
    // Sinken: Taste S bzw. großer Knopf (im Warten = „Halten: Sinken“)
    if (!isMobile) await page.keyboard.down('KeyS');
    else await press(true);
    await page.waitForTimeout(700);
    if (!isMobile) await page.keyboard.up('KeyS');
    else await press(false);
    await page.waitForTimeout(300);
    const w = await welt(page);
    if (!w.snag) {
      expect(w.depthM, JSON.stringify(w)).toBeGreaterThan(0);
      break;
    }
    expect(attempt, 'Hänger bei jedem Wurf').toBeLessThan(4);
    await page.keyboard.press('KeyR'); // Einholen: der verhakte Köder reißt ab
    await waitState(page, ['Idle'], 10_000);
  }
  await page.waitForTimeout(900); // Pose ist gelandet, Kamera nachgezogen
  await page.screenshot({ path: `test-results/welt1-${info.project.name}-wasser.png` });

  // Biss: Wartezeit überspringen, beim „!“ anschlagen
  await hook(page, 'skipWait');
  await waitState(page, ['Bite']).catch(async (e) => { throw new Error(`${String(e)} – ${JSON.stringify(await welt(page))}`); });
  await press(true);
  await press(false);
  await waitState(page, ['Reeling'], 5_000);

  // Drill: einfacher Bot (Spannung in die Mitte der grünen Zone, gegen die Zugrichtung führen)
  let held = false;
  let steer = '';
  const t0 = Date.now();
  let shot = false;
  for (;;) {
    const w = await welt(page);
    if (w.rodState !== 'Reeling') break;
    if (Date.now() - t0 > 60_000) throw new Error('Drill dauert zu lange');
    if (!shot && Date.now() - t0 > 2500) { shot = true; await page.screenshot({ path: `test-results/welt1-${info.project.name}-drill.png` }); }
    const z = w.zone ?? { lo: 0.4, hi: 0.6 };
    const want = w.tension < (z.lo + z.hi) / 2;
    if (want !== held) { await press(want); held = want; }
    if (!isMobile) {
      const key = w.pullDir === 'left' ? 'KeyD' : w.pullDir === 'right' ? 'KeyA' : '';
      if (key !== steer) {
        if (steer) await page.keyboard.up(steer);
        if (key) await page.keyboard.down(key);
        steer = key;
      }
    }
  }
  if (held) await press(false);
  if (steer) await page.keyboard.up(steer);
  const end = await welt(page);
  expect(end.lastEscape, `Drill verloren: ${end.drillLog.slice(-5).join(',')}`).toBeNull();
  expect(end.rodState).toBe('Caught');
  expect(end.lastCatch?.fishId).toBe('F004');
  await expect(page.locator('.catch-card')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/welt1-${info.project.name}-fang.png` });
  await page.locator('.cc__bucket').click();
  await waitState(page, ['Idle', 'Casting']);

  // Spielstand überlebt Neuladen
  await page.waitForTimeout(300);
  await page.reload();
  await startGame(page.mainFrame());
  const bucketBadge = await page.locator('.hud__badge').textContent();
  expect(bucketBadge?.trim()).toBe('1');
  expect(errors).toEqual([]);
});

const SIGNATURE: Record<string, string | null> = {
  Ruhig: null, Brocken: null, Hitzkopf: null, Zappler: 'telegraph:spike', Sprinter: 'telegraph:sprint', Taucher: 'telegraph:dive',
  Springer: 'telegraph:jump', Zickzack: 'telegraph:zigzag', Trickser: 'action:fake', Versteckspieler: 'telegraph:cover',
  Aufblaeher: 'telegraph:inflate', Stromer: 'telegraph:shock', Blinker: 'telegraph:invisible',
};
const W1_NATIVE: Record<string, string> = {
  Ruhig: 'F004', Zappler: 'F002', Sprinter: 'F014', Taucher: 'F010', Springer: 'F012', Zickzack: 'F008', Brocken: 'F003',
};

test('alle 13 Verhaltensarten: Drill startet, Telegraph-Ereignisse kommen', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'einmal reicht (Logik ist geräteunabhängig, Touch prüft der erste Test)');
  test.setTimeout(600_000);
  const errors = watchConsole(page);
  await openWorld(page);
  await hook(page, 'autopilot', true);
  const seen: Record<string, string[]> = {};
  for (const [beh, sig] of Object.entries(SIGNATURE)) {
    const native = W1_NATIVE[beh];
    // Verhalten ohne W1-Vertreter: an der Moosbart-Karausche (Selten, ≈9 s Ausdauer mit Konter, kein Zahnfisch),
    // damit auch Verhalten mit langen Pausen (Aufbläher 5–7 s) im Drill vorkommen
    await hook(page, 'forceFish', native ?? 'F016');
    await hook(page, 'forceBehavior', native ? null : beh);
    let found = false;
    for (let attempt = 0; attempt < 4 && !found; attempt++) {
      await waitState(page, ['Sinking', 'Waiting'], 30_000);
      await hook(page, 'skipWait');
      await waitState(page, ['Reeling', 'Escaped'], 30_000);
      const t0 = Date.now();
      for (;;) {
        const w = await welt(page);
        if (w.behavior === beh && (sig === null || w.drillLog.includes(sig))) { found = true; seen[beh] = w.drillLog.slice(0, 6); }
        if (w.rodState !== 'Reeling' || Date.now() - t0 > 40_000) break;
        await page.waitForTimeout(100);
      }
      await waitState(page, ['Caught', 'Escaped', 'Idle', 'Casting', 'Sinking', 'Waiting'], 60_000);
      if ((await welt(page)).catchCardOpen) await hook(page, 'closeCatchCard');
    }
    expect(found, `${beh}: kein Telegraph gesehen`).toBe(true);
  }
  console.info(`Telegraph je Verhalten: ${JSON.stringify(seen)}`);
  expect(errors).toEqual([]);
});

test('Video eines Drills (docs/qa/phase-1/drill.webm)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'Video nur einmal');
  test.setTimeout(120_000);
  // Eigener Ausgabeordner des Tests (wird nicht von anderen Workern geleert); Datei erst nach page.close() fertig
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: info.outputPath('video'), size: { width: 1280, height: 720 } } });
  const page = await context.newPage();
  const errors = watchConsole(page);
  await openWorld(page);
  await hook(page, 'forceFish', 'F012'); // Regenbogenforelle: Springer
  await hook(page, 'autopilot', true);
  await waitState(page, ['Sinking', 'Waiting'], 30_000);
  await page.waitForTimeout(800);
  await hook(page, 'skipWait');
  await waitState(page, ['Caught', 'Escaped'], 90_000);
  await page.waitForTimeout(2500);
  const video = page.video();
  await page.close();
  mkdirSync('docs/qa/phase-1', { recursive: true });
  await video?.saveAs('docs/qa/phase-1/drill.webm');
  await context.close();
  expect(errors).toEqual([]);
});

test('Leistung: FPS über 10 s während des Angelns', async ({ page }, info) => {
  test.skip(!['desktop', 'iphone'].includes(info.project.name), 'Desktop und ein Handy-Profil');
  test.setTimeout(90_000);
  await openWorld(page);
  await hook(page, 'autopilot', true);
  await page.waitForTimeout(1500);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    samples.push((await welt(page)).fps);
    if ((await welt(page)).catchCardOpen) await hook(page, 'closeCatchCard');
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/fps-${info.project.name}.json`, JSON.stringify({ avg, samples }));
  console.info(`FPS ${info.project.name}: Ø ${avg.toFixed(1)} (min ${Math.min(...samples)}, max ${Math.max(...samples)})`);
  expect(avg).toBeGreaterThan(0);
});
