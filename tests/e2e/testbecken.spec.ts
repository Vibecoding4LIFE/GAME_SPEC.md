import { test, expect } from '@playwright/test';

interface DebugState {
  layout: { orientation: string; gameWidth: number; gameHeight: number; deviceZoom: number; cssZoom: number };
  renderer: string;
  ready: boolean;
  fishOnScreen: number;
  errors: string[];
}

test('Testbecken zeigt die 20 Fische von Welt 1 pixelgenau', async ({ page }, info) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __KK?: DebugState }).__KK?.ready === true, null, {
    timeout: 30_000,
  });
  const state = await page.evaluate(() => (window as unknown as { __KK: DebugState }).__KK);
  expect(state.fishOnScreen).toBe(20);
  expect(Number.isInteger(state.layout.deviceZoom)).toBe(true);
  expect(state.layout.deviceZoom).toBeGreaterThanOrEqual(1);

  const viewport = page.viewportSize();
  if (viewport) {
    expect(state.layout.orientation).toBe(viewport.height > viewport.width ? 'portrait' : 'landscape');
  }

  // Canvas: interne Größe exakt 640×360 bzw. 360×640, Anzeige = intern × cssZoom
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, cssW: r.width, cssH: r.height, rendering: getComputedStyle(c).imageRendering };
  });
  expect([canvas.w, canvas.h]).toEqual([state.layout.gameWidth, state.layout.gameHeight]);
  expect(canvas.cssW).toBeCloseTo(state.layout.gameWidth * state.layout.cssZoom, 1);
  expect(canvas.rendering).toMatch(/pixelated|crisp-edges/);

  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/testbecken-${info.project.name}.png` });
  expect(consoleErrors).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('Drehen aufs Querformat ordnet neu an (Handy)', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'nur Handy-Profile');
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __KK?: DebugState }).__KK?.ready === true);
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForFunction(
    () => (window as unknown as { __KK: DebugState }).__KK.layout.orientation === 'landscape',
  );
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    return [c.width, c.height];
  });
  expect(canvas).toEqual([640, 360]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/testbecken-${info.project.name}-quer.png` });
});
