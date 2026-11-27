import { describe, it, expect } from 'vitest';
import { integerZoom, pickLayout } from '../../src/core/scale';

describe('scale', () => {
  it('wählt ganzzahligen Faktor', () => {
    expect(integerZoom(1920, 1080, 640, 360)).toBe(3);
    expect(integerZoom(390, 844, 360, 640)).toBe(1);
    expect(integerZoom(100, 100, 640, 360)).toBe(1);
  });
  it('wählt Layout nach Ausrichtung', () => {
    expect(pickLayout(800, 400).w).toBe(640);
    expect(pickLayout(400, 800).w).toBe(360);
  });
});
