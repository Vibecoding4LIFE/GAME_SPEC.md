// Gemeinsame Helfer für die Welt-E2E-Tests: Konsole beobachten, Ladebildschirm durchtippen, Einführung schließen.
import type { CDPSession, Frame, Page } from '@playwright/test';

export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Echte Touch-Ereignisse über CDP (Seitenkoordinaten, auch für Elemente in iframes). */
export async function touch(cdp: CDPSession, type: 'touchStart' | 'touchEnd', x = 0, y = 0, id = 1): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
}

export async function tapAt(cdp: CDPSession, x: number, y: number): Promise<void> {
  await touch(cdp, 'touchStart', x, y);
  await touch(cdp, 'touchEnd');
}

/** Wartet auf den Ladebildschirm, startet per Klick bzw. Touch und schließt die Einführung. */
export async function startGame(frame: Frame, cdp: CDPSession | null = null): Promise<void> {
  const prompt = frame.locator('.ld__prompt');
  await prompt.waitFor({ state: 'visible', timeout: 30_000 });
  if (cdp) {
    const b = await prompt.boundingBox();
    if (!b) throw new Error('Start-Knopf ohne Fläche');
    await tapAt(cdp, b.x + b.width / 2, b.y + b.height / 2);
  } else await prompt.click();
  await frame.waitForFunction(() => (window as unknown as { __KK?: { welt?: unknown } }).__KK?.welt !== undefined, null, { timeout: 30_000 });
  await closeIntro(frame, cdp);
}

export async function closeIntro(frame: Frame, cdp: CDPSession | null = null): Promise<void> {
  const go = frame.locator('.intro__go');
  if (await go.isVisible().catch(() => false)) {
    if (cdp) {
      const b = await go.boundingBox();
      if (b) await tapAt(cdp, b.x + b.width / 2, b.y + b.height / 2);
    } else await go.click();
    await go.waitFor({ state: 'hidden' });
  }
}
