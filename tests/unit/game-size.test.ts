import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import { lengthCm, normal, rollSize, rollSizeX, sizeFactor, sizeGrade, weightG } from '../../src/game/size';
import { b, fishById } from './helpers/gameData';

describe('Größenwurf (D 1.10)', () => {
  it('Normalverteilung: Mittelwert ≈ 0, Streuung ≈ 1', () => {
    const r = new Rng(3);
    const xs = Array.from({ length: 50000 }, () => normal(r));
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(sd - 1)).toBeLessThan(0.02);
  });
  it('x: Mittelwert ≈ 0,45, immer in [0, 1]; μ-Bonus verschiebt', () => {
    const r = new Rng(5);
    const xs = Array.from({ length: 50000 }, () => rollSizeX(b, r));
    expect(xs.every((x) => x >= 0 && x <= 1)).toBe(true);
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.44);
    expect(mean).toBeLessThan(0.46);
    const r2 = new Rng(5);
    const big = Array.from({ length: 50000 }, () => rollSizeX(b, r2, 0.08));
    expect(big.reduce((a, x) => a + x, 0) / big.length - mean).toBeGreaterThan(0.07);
  });
  it('Klassen-Grenzen: <0,15 Winzling · <0,70 Normal · <0,88 Prächtig · <0,97 Kapital · sonst Riesig', () => {
    expect(sizeGrade(0, b)).toBe('Winzling');
    expect(sizeGrade(0.1499, b)).toBe('Winzling');
    expect(sizeGrade(0.15, b)).toBe('Normal');
    expect(sizeGrade(0.6999, b)).toBe('Normal');
    expect(sizeGrade(0.7, b)).toBe('Praechtig');
    expect(sizeGrade(0.88, b)).toBe('Kapital');
    expect(sizeGrade(0.9699, b)).toBe('Kapital');
    expect(sizeGrade(0.97, b)).toBe('Riesig');
    expect(sizeGrade(1, b)).toBe('Riesig');
    expect(['Winzling', 'Normal', 'Praechtig', 'Kapital', 'Riesig'].map((g) => sizeFactor(g as never, b))).toEqual([0.8, 1, 1.2, 1.35, 1.5]);
  });
  it('Länge = min + x(max−min), Gewicht = k × L³ (Hecht 100 cm ≈ 9 kg)', () => {
    const hecht = fishById('F014');
    expect(lengthCm(hecht, 0)).toBe(50);
    expect(lengthCm(hecht, 1)).toBe(130);
    expect(weightG(hecht, 100)).toBeCloseTo(9000, 6);
    const s = rollSize(hecht, b, new Rng(9));
    expect(s.weightG).toBeCloseTo(hecht.weightFactorK * s.lengthCm ** 3, 6);
    expect(s.grade).toBe(sizeGrade(s.x, b));
  });
  it('Anteile passen zur Normalverteilung: Riesig ≈ 0,19 % (z ≥ 2,89), Winzling ≈ 4,8 % (z < −1,67)', () => {
    const r = new Rng(21);
    const n = 50000;
    const grades = Array.from({ length: n }, () => sizeGrade(rollSizeX(b, r), b));
    const share = (g: string) => grades.filter((x) => x === g).length / n;
    expect(share('Riesig')).toBeGreaterThan(0.001);
    expect(share('Riesig')).toBeLessThan(0.003);
    expect(share('Winzling')).toBeGreaterThan(0.04);
    expect(share('Winzling')).toBeLessThan(0.056);
  });
});
