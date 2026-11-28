// Abnahme-Screenshots zum Nutzer-Feedback Phase 1 → docs/qa/phase-1/feedback-<profil>-<n>.png
// (Ladebildschirm, Einführung, Wurf mit Perfekt-Bereich, Drill-HUD, schillernde Fang-Karte). Konsole fehlerfrei.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { closeIntro, watchConsole } from './helpers';

type Hooks = Record<string, (...a: unknown[]) => unknown>;
const hook = (page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => ((window as unknown as { __KK: { welt: { hooks: Hooks } } }).__KK.welt.hooks[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const);
const state = (page: Page) => page.evaluate(() => (window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState);
const waitState = (page: Page, states: string[], timeout = 30_000) =>
  page.waitForFunction((s) => s.includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), states, { timeout });

test('Abnahme-Screenshots (Nutzer-Feedback)', async ({ page }, info) => {
  test.setTimeout(150_000);
  mkdirSync('docs/qa/phase-1', { recursive: true });
  const shot = async (n: string) => page.screenshot({ path: `docs/qa/phase-1/feedback-${info.project.name}-${n}.png` });
  const errors = watchConsole(page);
  await page.goto('/');
  await page.locator('.ld__prompt').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(300);
  await shot('1-ladebildschirm');
  await page.locator('.ld__prompt').click();
  await page.waitForFunction(() => (window as unknown as { __KK?: { welt?: unknown } }).__KK?.welt !== undefined, null, { timeout: 30_000 });
  await page.locator('.intro__go').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await shot('2-einfuehrung');
  await closeIntro(page.mainFrame());
  await hook(page, 'setPhase', 'Tag');
  await hook(page, 'setWeather', 'Sonnig');

  // Wurfkraft im Perfekt-Bereich (Tastenhinweis am PC, Aktionsknopf am Handy)
  await page.keyboard.down('Space');
  await page.waitForTimeout(560);
  await shot('3-wurf');
  await page.keyboard.up('Space');
  await waitState(page, ['Sinking', 'Waiting']);

  // Drill (Autopilot) mit schillerndem Fang
  await hook(page, 'forceFish', 'F014');
  await hook(page, 'forceShiny', true);
  await hook(page, 'autopilot', true);
  for (let attempt = 0; attempt < 4; attempt++) {
    await hook(page, 'skipWait');
    await waitState(page, ['Reeling', 'Escaped'], 30_000);
    if ((await state(page)) === 'Reeling') {
      await page.waitForTimeout(1500);
      if ((await state(page)) === 'Reeling') await shot('4-drill');
      await waitState(page, ['Caught', 'Escaped'], 60_000);
      if ((await state(page)) === 'Caught') break;
    }
    await waitState(page, ['Sinking', 'Waiting'], 30_000);
  }
  await hook(page, 'autopilot', false);
  await expect(page.locator('.cc[data-shiny]')).toBeVisible();
  await page.waitForTimeout(700);
  await shot('5-schillernd');
  expect(errors).toEqual([]);
});
