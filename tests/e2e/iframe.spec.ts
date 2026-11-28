// Nutzer-Feedback Phase 1: „Die Tasten funktionieren nicht.“ Die Vorschau läuft in einem sandboxed iframe eines
// fremden Origins (claude.ai-Artifact). Nachbau: tests/e2e/harness/iframe-harness.html auf Port 4174 lädt das Spiel
// (Port 4173). Geprüft werden Tastatur nach dem ersten Klick (inkl. Fokus raus und wieder rein, keine scrollende
// Elternseite) und Touch mit echten Touch-Ereignissen (CDP) auf allen sichtbaren Knöpfen.
import { test, expect, type Frame, type Page } from '@playwright/test';
import { startGame, tapAt, touch, watchConsole } from './helpers';

const HARNESS = 'http://127.0.0.1:4174/iframe-harness.html';

interface WeltView {
  rodState: string; depthM: number; snag: unknown; input: { mode: string; steer: number; reeling: boolean; sinking: boolean };
  feedback: Record<string, number>;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

async function gameFrame(page: Page): Promise<Frame> {
  await page.goto(HARNESS);
  const el = await page.waitForSelector('#game');
  const f = await el.contentFrame();
  if (!f) throw new Error('kein iframe');
  return f;
}
const welt = (f: Frame) => f.evaluate(() => {
  const w = (window as unknown as { __KK: { welt: WeltView } }).__KK.welt;
  return { rodState: w.rodState, depthM: w.depthM, snag: w.snag, input: { ...w.input }, feedback: { ...w.feedback } } as WeltView;
});
const hook = (f: Frame, name: string, ...args: unknown[]) =>
  f.evaluate(([n, a]) => ((window as unknown as { __KK: { welt: { hooks: Hooks } } }).__KK.welt.hooks[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const);
const waitState = (f: Frame, states: string[], timeout = 20_000) =>
  f.waitForFunction((s) => s.includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), states, { timeout });
const relevant = (errors: string[]) => errors.filter((e) => !/GL Driver|GPU stall/.test(e));

test('iframe (Tastatur): erster Klick holt den Fokus, Tasten steuern das Spiel, die Elternseite scrollt nicht', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tastatur nur auf dem Desktop');
  test.setTimeout(90_000);
  const errors = watchConsole(page);
  const f = await gameFrame(page);
  await startGame(f);
  await hook(f, 'setPhase', 'Tag');
  await hook(f, 'setWeather', 'Sonnig');
  expect(await f.evaluate(() => document.hasFocus())).toBe(true);

  // Auswerfen: Leertaste halten → Kraftbalken, loslassen → Wurf
  await page.keyboard.down('Space');
  await waitState(f, ['Casting'], 5_000);
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await waitState(f, ['Sinking', 'Waiting']);
  // Pfeil runter = Sinken
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowDown');
  const w = await welt(f);
  if (!w.snag) expect(w.depthM).toBeGreaterThan(0);
  // R = Einholen
  await page.keyboard.press('KeyR');
  await waitState(f, ['Idle']);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Fokus geht nach außen (Knopf der Elternseite) – Leertaste gehört dann der Elternseite
  await page.click('#outside');
  expect(await f.evaluate(() => document.hasFocus())).toBe(false);
  // Ein Klick ins Spiel holt den Fokus zurück (der Klick selbst wirft im Ziel-Modus kurz aus)
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('iframe ohne Fläche');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await f.evaluate(() => document.hasFocus())).toBe(true);
  // (ein kurzer Klick ohne Halten wirft nicht aus – Wurfkraft 0)
  await waitState(f, ['Idle']);
  await page.keyboard.down('Space');
  await waitState(f, ['Casting'], 5_000);
  await page.keyboard.up('Space');
  await page.screenshot({ path: `test-results/feedback-iframe-${info.project.name}.png` });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(relevant(errors)).toEqual([]);
});

test('iframe (Touch): sichtbare Knöpfe – Auswerfen, Sinken, Zucken, Einholen, Anschlagen, Kurbeln, ◀ ▶', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Touch nur auf Handy-Profilen');
  test.setTimeout(120_000);
  const errors = watchConsole(page);
  const cdp = await page.context().newCDPSession(page);
  const f = await gameFrame(page);
  await startGame(f, cdp);
  await hook(f, 'setPhase', 'Tag');
  await hook(f, 'setWeather', 'Sonnig');
  await hook(f, 'forceFish', 'F004');
  const center = async (sel: string) => {
    const b = await f.locator(sel).boundingBox();
    if (!b) throw new Error(`${sel} nicht sichtbar`);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const shot = (n: string) => page.screenshot({ path: `test-results/feedback-touch-${info.project.name}-${n}.png` });

  // Auswerfen: großen Knopf halten
  const main = await center('.touch__cast');
  await expect(f.locator('.touch__cast-label')).toHaveText(/Auswerfen|cast/i);
  await shot('1-auswerfen');
  await touch(cdp, 'touchStart', main.x, main.y);
  await waitState(f, ['Casting'], 5_000);
  await page.waitForTimeout(450);
  await touch(cdp, 'touchEnd');
  await waitState(f, ['Sinking', 'Waiting']);
  await page.waitForTimeout(700);

  // Sinken: derselbe Knopf heißt jetzt „Halten: Sinken!“
  await expect(f.locator('.touch__cast-label')).toHaveText(/Sinken|sink/i);
  await shot('2-warten');
  if (!(await welt(f)).snag) {
    await touch(cdp, 'touchStart', main.x, main.y);
    await page.waitForTimeout(500);
    expect((await welt(f)).input.sinking).toBe(true);
    await expect(f.locator('.touch__cast-label')).toHaveText(/Stopp|stop/i);
    await touch(cdp, 'touchEnd');
    expect((await welt(f)).depthM).toBeGreaterThan(0);
    // Zucken
    await tapAt(cdp, ...Object.values(await center('.touch__twitch')) as [number, number]);
  }
  // Einholen
  await tapAt(cdp, ...Object.values(await center('.touch__retrieve')) as [number, number]);
  await waitState(f, ['Idle']);

  // Neu auswerfen, Biss abwarten, Anschlagen, Drill mit ◀ ▶
  await touch(cdp, 'touchStart', main.x, main.y);
  await page.waitForTimeout(450);
  await touch(cdp, 'touchEnd');
  await waitState(f, ['Sinking', 'Waiting']);
  await page.waitForTimeout(700);
  if ((await welt(f)).snag) {
    await tapAt(cdp, ...Object.values(await center('.touch__retrieve')) as [number, number]);
    await waitState(f, ['Idle']);
    await touch(cdp, 'touchStart', main.x, main.y);
    await page.waitForTimeout(450);
    await touch(cdp, 'touchEnd');
    await waitState(f, ['Sinking', 'Waiting']);
  }
  await hook(f, 'skipWait');
  await waitState(f, ['Bite'], 20_000);
  // sofort anschlagen (ein Screenshot dauert im emulierten Handy länger als das Anschlagfenster)
  await tapAt(cdp, main.x, main.y);
  await waitState(f, ['Reeling'], 5_000);
  await expect(f.locator('.touch__cast-label')).toHaveText(/Kurbeln|reel/i);
  await expect(f.locator('.touch__cast-label')).toHaveText(/Kurbeln|reel/i);
  // Der Autopilot hält den Fisch am Haken, damit die Lenk-Knöpfe in Ruhe geprüft werden können
  // (geprüft wird der Eingabezustand der Knöpfe, nicht die Session)
  await hook(f, 'autopilot', true);
  const left = await center('.touch__left');
  await touch(cdp, 'touchStart', left.x, left.y);
  await page.waitForTimeout(150);
  expect((await welt(f)).input.steer).toBe(-1); // sofort, ohne Haltezeit
  await shot('4-drill');
  await touch(cdp, 'touchEnd');
  await page.waitForTimeout(150);
  expect((await welt(f)).input.steer).toBe(0);
  const right = await center('.touch__right');
  await touch(cdp, 'touchStart', right.x, right.y);
  await page.waitForTimeout(150);
  expect((await welt(f)).input.steer).toBe(1);
  await touch(cdp, 'touchEnd');
  // Rückmeldung: Biss hat ausgelöst (Vibration oder – ohne Vibration – Rand-Puls)
  expect((await welt(f)).feedback.bite ?? 0).toBeGreaterThan(0);
  expect(relevant(errors)).toEqual([]);
});

test('Ladebildschirm: Titel groß, Ladebalken, dann „Tippe, um zu starten“', async ({ page, isMobile }, info) => {
  const errors = watchConsole(page);
  await page.goto('/');
  const title = page.locator('.ld__title');
  await expect(title).toHaveText('Catch that Dih!');
  expect(await page.title()).toBe('Catch that Dih!');
  const prompt = page.locator('.ld__prompt');
  await prompt.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(prompt).toHaveText(isMobile ? /Tippe|Tap/ : /Klicke|Click/);
  const size = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(Number.isInteger(size)).toBe(true);
  expect(size).toBeGreaterThanOrEqual(36);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/feedback-ladebildschirm-${info.project.name}.png` });
  // Taste startet auch (PC)
  if (!isMobile) {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as unknown as { __KK?: { welt?: unknown } }).__KK?.welt !== undefined, null, { timeout: 30_000 });
  }
  expect(errors).toEqual([]);
});
