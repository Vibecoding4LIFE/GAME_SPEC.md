import { describe, expect, it } from 'vitest';
import {
  catchXp, levelForXp, qualityFactor, scorePoints, sellValue, varietyFactor, xpForLevel, type ScoreInput,
} from '../../src/game/score';
import { b, fishById } from './helpers/gameData';

const base: ScoreInput = {
  basePoints: 120, grade: 'Praechtig', shiny: false, masterDrill: true, perfectCast: true, perfectStrike: false,
  nthOfSpecies: 1, finale: false, competition: false,
};

describe('Punkteformel (D 2.3)', () => {
  it('Beispiel aus der Spec: Hecht, Prächtig, Meisterdrill + Perfekter Wurf, erster Hecht = 234', () => {
    expect(scorePoints(base, b)).toBe(234);
  });
  it('Q maximal 1,35', () => {
    expect(qualityFactor({ masterDrill: true, perfectCast: true, perfectStrike: true }, b)).toBeCloseTo(1.35, 10);
    expect(qualityFactor({ masterDrill: false, perfectCast: false, perfectStrike: false }, b)).toBe(1);
  });
  it('Vielfalt: 1. ×1,25 · 2. ×1,0 · 3. ×0,85 · ab 4. ×0,7', () => {
    expect([1, 2, 3, 4, 9].map((n) => varietyFactor(n, b))).toEqual([1.25, 1, 0.85, 0.7, 0.7]);
    const p = (n: number) => scorePoints({ ...base, masterDrill: false, perfectCast: false, grade: 'Normal', basePoints: 100, nthOfSpecies: n }, b);
    expect([1, 2, 3, 4].map(p)).toEqual([125, 100, 85, 70]);
  });
  it('Finale ×1,5', () => {
    expect(scorePoints({ ...base, finale: true }, b)).toBe(Math.round(120 * 1.2 * 1.3 * 1.25 * 1.5));
  });
  it('Schillernd ×3; im Wettkampf Bonus auf +600 gedeckelt', () => {
    const boss = { ...base, basePoints: 1000, grade: 'Normal' as const, masterDrill: false, perfectCast: false, shiny: true };
    expect(scorePoints({ ...boss, competition: false }, b)).toBe(1000 * 1.25 * 3);
    expect(scorePoints({ ...boss, competition: true }, b)).toBe(1000 * 1.25 + 600);
    const small = { ...boss, basePoints: 10 };
    expect(scorePoints({ ...small, competition: true }, b)).toBe(scorePoints({ ...small, competition: false }, b));
  });
});

describe('Verkauf, Ruf und Stufen (D 3.1, 3.2)', () => {
  it('Verkaufspreis = Basispunkte × Größenfaktor (Schillernd ×3)', () => {
    expect(sellValue(120, 'Praechtig', false, b)).toBe(144);
    expect(sellValue(10, 'Winzling', false, b)).toBe(8);
    expect(sellValue(120, 'Normal', true, b)).toBe(360);
  });
  it('XP je Seltenheit, neue Art ×2', () => {
    expect(catchXp(fishById('F001'), false, b)).toBe(5);
    expect(catchXp(fishById('F001'), true, b)).toBe(10);
    expect(catchXp(fishById('F020'), false, b)).toBe(250);
  });
  it('Stufen: kumulativ base × (n−1)^exp, Stufe 1 ab 0, Deckel 50', () => {
    expect(xpForLevel(1, b)).toBe(0);
    expect(xpForLevel(2, b)).toBe(100);
    expect(xpForLevel(3, b)).toBeCloseTo(100 * 2 ** 1.4, 6);
    expect(levelForXp(0, b)).toBe(1);
    expect(levelForXp(99, b)).toBe(1);
    expect(levelForXp(100, b)).toBe(2);
    expect(levelForXp(1e12, b)).toBe(b.xp.level.max);
  });
});
