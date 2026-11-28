import { describe, it, expect } from 'vitest';
import { computeLayout, cssToDevicePixels } from '../../src/core/pixelScale';

describe('computeLayout (B3: ganzzahlige Skalierung in Gerätepixeln)', () => {
  it('1280×720 Gerätepixel → 640×360, Zoom 2, kein Rand', () => {
    expect(computeLayout(1280, 720)).toMatchObject({
      orientation: 'landscape', gameWidth: 640, gameHeight: 360, deviceZoom: 2, offsetX: 0, offsetY: 0,
    });
  });

  it('1920×1080 → Zoom 3', () => {
    expect(computeLayout(1920, 1080).deviceZoom).toBe(3);
  });

  it('ungerade Größe: größter passender Faktor, mittig auf ganzen Pixeln', () => {
    const l = computeLayout(1366, 768);
    expect(l.deviceZoom).toBe(2);
    expect(l.offsetX).toBe(43);
    expect(l.offsetY).toBe(24);
    expect(l.offsetX + 640 * 2).toBeLessThanOrEqual(1366);
  });

  it('iPhone hochkant (1170×2532) → 360×640, Zoom 3', () => {
    const l = computeLayout(1170, 2532);
    expect(l).toMatchObject({ orientation: 'portrait', gameWidth: 360, gameHeight: 640, deviceZoom: 3 });
    expect(Number.isInteger(l.offsetX) && Number.isInteger(l.offsetY)).toBe(true);
  });

  it('Android mit DPR 2,625 (1080×2402 Gerätepixel) bleibt ganzzahlig', () => {
    const l = computeLayout(1080, 2402);
    expect(l.deviceZoom).toBe(3);
    expect(l.offsetX).toBe(0);
    expect(360 * l.deviceZoom).toBe(1080);
  });

  it('winzige Fenster fallen nie unter Faktor 1', () => {
    expect(computeLayout(200, 100).deviceZoom).toBe(1);
  });

  it('rundet krumme Messwerte und verhindert 0', () => {
    expect(computeLayout(1279.6, 720.2)).toMatchObject({ bufferWidth: 1280, bufferHeight: 720 });
    expect(computeLayout(0, 0).bufferWidth).toBe(1);
  });
});

describe('cssToDevicePixels', () => {
  it('rechnet CSS-Pixel in Gerätepixel um', () => {
    expect(cssToDevicePixels(390, 3)).toBe(1170);
    expect(cssToDevicePixels(411.42857, 2.625)).toBe(1080);
    expect(cssToDevicePixels(100, Number.NaN)).toBe(100);
  });
});
