// tests/unit/ui-nav.test.ts – räumliche Fokus-Navigation (Pfeiltasten / Steuerkreuz) und Pixel-Symbole.
import { describe, expect, it } from 'vitest';
import { pickNeighbor, type NavRect } from '../../src/ui/spatialNav';
import { ICONS, iconSize, iconSvg } from '../../src/ui/icons';
import { integerDivisor, integerScale } from '../../src/ui/sprite';

// 3×2-Raster aus 100×100-Kacheln mit 10 px Abstand
const grid: NavRect[] = [0, 1, 2, 3, 4, 5].map((i) => ({ x: (i % 3) * 110, y: Math.floor(i / 3) * 110, w: 100, h: 100 }));
const others = (i: number) => grid.filter((_, j) => j !== i);
const pick = (i: number, dir: 'up' | 'down' | 'left' | 'right') => {
  const o = others(i);
  const k = pickNeighbor(grid[i] as NavRect, o, dir);
  return k < 0 ? -1 : grid.indexOf(o[k] as NavRect);
};

describe('pickNeighbor', () => {
  it('bewegt sich im Raster', () => {
    expect(pick(0, 'right')).toBe(1);
    expect(pick(1, 'down')).toBe(4);
    expect(pick(4, 'left')).toBe(3);
    expect(pick(5, 'up')).toBe(2);
  });
  it('am Rand: nichts', () => {
    expect(pick(0, 'left')).toBe(-1);
    expect(pick(0, 'up')).toBe(-1);
    expect(pick(5, 'right')).toBe(-1);
  });
  it('bevorzugt dieselbe Zeile vor näheren Diagonalen', () => {
    const cur = { x: 0, y: 0, w: 50, h: 50 };
    const cands = [
      { x: 70, y: 60, w: 50, h: 50 }, // schräg darunter
      { x: 140, y: 0, w: 50, h: 50 }, // gleiche Zeile, weiter weg
    ];
    expect(pickNeighbor(cur, cands, 'right')).toBe(1);
  });
});

describe('Pixel-Symbole', () => {
  it('alle Zeilen eines Symbols sind gleich breit und enthalten nur X, o, .', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      const w = (rows as readonly string[])[0]?.length ?? 0;
      for (const r of rows as readonly string[]) {
        expect(r.length, name).toBe(w);
        expect(/^[Xo.]+$/.test(r), name).toBe(true);
      }
    }
  });
  it('SVG ist scharf, ganzzahlig skaliert und für Screenreader versteckt', () => {
    const svg = iconSvg('star', 3);
    const { w, h } = iconSize('star');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain(`width="${w * 3}" height="${h * 3}"`);
    expect(svg).toContain('aria-hidden="true"');
  });
});

describe('ganzzahlige Sprite-Skalierung (B3)', () => {
  it('größter ganzer Faktor in Gerätepixeln', () => {
    expect(integerScale(34, 18, 120, 60, 1)).toBe(3);
    expect(integerScale(34, 18, 120, 60, 3)).toBe(10);
    expect(integerScale(34, 18, 120, 60, 1, 1)).toBe(4); // Riesig +1
    expect(integerScale(258, 130, 100, 50, 1)).toBe(1);
  });
  it('zu große Frames werden um ganze Teiler verkleinert', () => {
    expect(integerDivisor(34, 18, 120, 60, 1)).toBe(1);
    expect(integerDivisor(258, 130, 100, 50, 1)).toBe(3);
  });
});
