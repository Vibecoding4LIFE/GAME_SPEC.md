// tests/unit/ui-title.test.ts – Pixel-Schriftzug des Ladebildschirms: Ebenen und ganzzahlige Skalierung.
import { describe, expect, it } from 'vitest';
import { colorizeTitle, titleScale } from '../../src/ui/pixelTitle';

const px = (rgba: Uint8ClampedArray, w: number, x: number, y: number) => [...rgba.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

describe('colorizeTitle', () => {
  // 3×3-Block in einer 7×7-Maske
  const w = 7;
  const h = 7;
  const mask = new Uint8Array(w * h);
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) mask[y * w + x] = 1;
  const out = colorizeTitle(mask, w, h);

  it('legt Glanzkante, Verlauf, Tinten-Kontur und Schlagschatten an', () => {
    expect(out.length).toBe(w * (h + 2) * 4);
    expect(px(out, w, 3, 2)).toEqual([255, 241, 199, 255]); // Glanz oben
    expect(px(out, w, 3, 4)).toEqual([164, 109, 31, 255]); // dunkle Unterkante
    expect(px(out, w, 1, 3)).toEqual([42, 30, 26, 255]); // Kontur
    expect(px(out, w, 3, 7)).toEqual([71, 28, 12, 255]); // Schatten 2 px tiefer
    expect(px(out, w, 0, 0)[3]).toBe(0); // Rest durchsichtig
  });

  it('nur volle Deckkraft oder durchsichtig (keine Halbtöne)', () => {
    for (let i = 3; i < out.length; i += 4) expect([0, 255]).toContain(out[i]);
  });
});

describe('titleScale', () => {
  it('größter ganzer Faktor in Gerätepixeln, mindestens 1', () => {
    expect(titleScale(110, 21, 358, 160, 3)).toBe(9);
    expect(titleScale(110, 21, 1248, 160, 1)).toBe(7);
    expect(titleScale(110, 21, 50, 10, 1)).toBe(1);
    expect(titleScale(110, 21, 5000, 5000, 1, 12)).toBe(12);
  });
});
