// QA K-1 (Phase 1): Jede Vorwarnung aus D 1.7 ist im Bild. Die Logik wird genau in der Vorwarnung angehalten
// (Hook freezeAtTelegraph), dann Screenshot nach docs/qa/phase-1/telegraph-<verhalten>.png. Konsole fehlerfrei.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startGame, watchConsole } from './helpers';

type Hooks = Record<string, (...a: unknown[]) => unknown>;
const hook = (page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => ((window as unknown as { __KK: { welt: { hooks: Hooks } } }).__KK.welt.hooks[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const);
const welt = (page: Page) => page.evaluate(() => {
  const w = (window as unknown as { __KK: { welt: { rodState: string; telegraph: string | null; frozen: boolean; catchCardOpen: boolean } } }).__KK.welt;
  return { rodState: w.rodState, telegraph: w.telegraph, frozen: w.frozen, catchCardOpen: w.catchCardOpen };
});

// Verhalten → Vorwarnung (Aktion), Fisch (W1-Vertreter oder Träger für erzwungenes Verhalten)
const CASES: [string, string, string, boolean][] = [
  ['Zappler', 'spike', 'F002', false], ['Sprinter', 'sprint', 'F014', false], ['Taucher', 'dive', 'F010', false],
  ['Springer', 'jump', 'F012', false], ['Zickzack', 'zigzag', 'F008', false], ['Trickser', 'flee', 'F016', true],
  ['Versteckspieler', 'cover', 'F016', true], ['Aufblaeher', 'inflate', 'F016', true], ['Stromer', 'shock', 'F016', true],
  ['Blinker', 'invisible', 'F016', true], ['Hitzkopf', 'heat', 'F016', true],
];

test('Vorwarnungen (D 1.7) sind im Bild', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Screenshots einmal (Desktop)');
  test.setTimeout(600_000);
  mkdirSync('docs/qa/phase-1', { recursive: true });
  const errors = watchConsole(page);
  await page.goto('/');
  await startGame(page.mainFrame());
  await hook(page, 'setPhase', 'Tag');
  await hook(page, 'setWeather', 'Sonnig');
  await hook(page, 'autopilot', true);
  for (const [beh, action, fish, force] of CASES) {
    await hook(page, 'forceFish', fish);
    await hook(page, 'forceBehavior', force ? beh : null);
    await hook(page, 'freezeAtTelegraph', action);
    let seen = false;
    for (let attempt = 0; attempt < 4 && !seen; attempt++) {
      await page.waitForFunction(() => ['Sinking', 'Waiting'].includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), null, { timeout: 30_000 });
      await hook(page, 'skipWait');
      await page.waitForFunction(() => {
        const w = (window as unknown as { __KK: { welt: { frozen: boolean; rodState: string } } }).__KK.welt;
        return w.frozen || ['Caught', 'Escaped'].includes(w.rodState);
      }, null, { timeout: 60_000 });
      const w = await welt(page);
      if (!w.frozen) console.info(`${beh} Versuch ${attempt + 1}: ${w.rodState} ${await page.evaluate(() => JSON.stringify({ esc: (window as unknown as { __KK: { welt: { lastEscape: string | null; drillLog: string[] } } }).__KK.welt.lastEscape, log: (window as unknown as { __KK: { welt: { drillLog: string[] } } }).__KK.welt.drillLog.slice(-6) }))}`);
      if (w.frozen) {
        await page.waitForTimeout(350); // Animation (Blinken, Blasen, Funken) läuft weiter
        expect((await welt(page)).telegraph).toBe(action);
        await page.screenshot({ path: `docs/qa/phase-1/telegraph-${beh.toLowerCase()}.png` });
        seen = true;
      }
      if (seen) await hook(page, 'freezeAtTelegraph', null); // diesen Drill normal zu Ende spielen
      await hook(page, 'resume');
      await page.waitForFunction(() => ['Caught', 'Escaped', 'Idle'].includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), null, { timeout: 90_000 });
      if ((await welt(page)).catchCardOpen) await hook(page, 'closeCatchCard');
    }
    await hook(page, 'freezeAtTelegraph', null);
    expect(seen, `${beh}: Vorwarnung nicht erreicht`).toBe(true);
  }
  expect(errors).toEqual([]);
});
