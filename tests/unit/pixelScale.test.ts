import { describe, it, expect } from 'vitest';
import { computeLayout } from '../../src/core/pixelScale';

describe('computeLayout (B3: ganzzahlige Skalierung)', () => {
  it('Querformat 1280×720 bei DPR 1 → 640×360, Zoom 2', () => {
    const l = computeLayout(1280, 720, 1);
    expect(l).toMatchObject({ orientation: 'landscape', gameWidth: 640, gameHeight: 360, deviceZoom: 2, cssZoom: 2 });
  });

  it('Full-HD 1920×1080 → Zoom 3, Rand bleibt 0', () => {
    expect(computeLayout(1920, 1080, 1).deviceZoom).toBe(3);
  });

  it('ungerade Fenstergröße wählt den größten passenden Faktor', () => {
    const l = computeLayout(1366, 768, 1);
    expect(l.deviceZoom).toBe(2);
    expect(l.cssWidth).toBeLessThanOrEqual(1366);
    expect(l.cssHeight).toBeLessThanOrEqual(768);
  });

  it('Handy hochkant (390×844, DPR 3) → 360×640 intern, ganzzahlig in Gerätepixeln', () => {
    const l = computeLayout(390, 844, 3);
    expect(l).toMatchObject({ orientation: 'portrait', gameWidth: 360, gameHeight: 640, deviceZoom: 3 });
    expect(l.cssZoom * 3).toBe(3);
    expect(l.cssWidth).toBeLessThanOrEqual(390);
  });

  it('Handy quer (844×390, DPR 3) → 640×360, Zoom 3 Gerätepixel', () => {
    const l = computeLayout(844, 390, 3);
    expect(l).toMatchObject({ orientation: 'landscape', gameWidth: 640, gameHeight: 360, deviceZoom: 3 });
    expect(l.cssHeight).toBeLessThanOrEqual(390);
  });

  it('Android mit DPR 2.625 bleibt ganzzahlig in Gerätepixeln', () => {
    const l = computeLayout(412, 915, 2.625);
    expect(Number.isInteger(l.deviceZoom)).toBe(true);
    expect(l.cssWidth * 2.625).toBeCloseTo(360 * l.deviceZoom, 6);
  });

  it('winzige Fenster fallen nie unter Faktor 1', () => {
    expect(computeLayout(200, 100, 1).deviceZoom).toBe(1);
  });

  it('ungültige DPR wird als 1 behandelt', () => {
    expect(computeLayout(1280, 720, Number.NaN).deviceZoom).toBe(2);
  });
});
