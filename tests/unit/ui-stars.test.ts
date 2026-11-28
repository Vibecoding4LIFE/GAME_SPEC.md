// tests/unit/ui-stars.test.ts – Sterne pro Art, Weltfortschritt, Fortschritts-Kreis, Verkaufs-Nachfrage (D 1.12, D 3.2).
import { describe, expect, it } from 'vitest';
import { computeStars, ringMask, worldProgress } from '../../src/ui/stars';
import { needsSellConfirm, RARITY_STYLE, SIZE_TIER_STYLE } from '../../src/ui/rarity';
import { RARITIES } from '../../src/data/types';
import { SIZE_TIERS, type LexiconStateMap } from '../../src/ui/types';

describe('computeStars', () => {
  it('0 ohne Fang, ★ ab dem ersten Fang', () => {
    expect(computeStars(undefined)).toBe(0);
    expect(computeStars({ state: 'seen', count: 0 })).toBe(0);
    expect(computeStars({ state: 'caught', count: 1 })).toBe(1);
    expect(computeStars({ state: 'caught', count: 4, bestTier: 'Praechtig' })).toBe(1);
  });
  it('★★ bei 5 Fängen oder einmal Kapital', () => {
    expect(computeStars({ state: 'caught', count: 5 })).toBe(2);
    expect(computeStars({ state: 'caught', count: 1, bestTier: 'Kapital' })).toBe(2);
  });
  it('★★★ bei Riesig oder Schillernd', () => {
    expect(computeStars({ state: 'caught', count: 1, bestTier: 'Riesig' })).toBe(3);
    expect(computeStars({ state: 'caught', count: 1, shiny: true })).toBe(3);
  });
  it('gespeicherter Wert gilt, wenn er höher ist, senkt aber nie', () => {
    expect(computeStars({ state: 'caught', count: 1, stars: 3 })).toBe(3);
    expect(computeStars({ state: 'caught', count: 9, stars: 1 })).toBe(2);
  });
});

describe('worldProgress', () => {
  it('zählt gefangene und gesichtete Arten', () => {
    const fish = Array.from({ length: 20 }, (_, i) => ({ id: `F${String(i + 1).padStart(3, '0')}` as const }));
    const entries: LexiconStateMap = {
      F001: { state: 'caught', count: 3 },
      F002: { state: 'caught', count: 1 },
      F003: { state: 'seen', count: 0 },
      F099: { state: 'caught', count: 1 },
    };
    expect(worldProgress(fish, entries)).toEqual({ caught: 2, seen: 1, total: 20, ratio: 0.1 });
    expect(worldProgress([], {}).ratio).toBe(0);
  });
});

describe('ringMask', () => {
  it('hat 20 Segmente, davon die ersten n erreicht', () => {
    const m = ringMask(36, 20, 7, 4);
    const lit = m.filter((v) => v === 2).length;
    const open = m.filter((v) => v === 1).length;
    expect(lit).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(lit);
    expect(lit / (lit + open)).toBeCloseTo(7 / 20, 1);
    expect(ringMask(36, 20, 20).every((v) => v !== 1)).toBe(true);
    expect(ringMask(36, 20, 0).every((v) => v !== 2)).toBe(true);
  });
  it('Mitte bleibt frei (Platz für „x/20“)', () => {
    const m = ringMask(36, 20, 20, 4);
    expect(m[18 * 36 + 18]).toBe(0);
  });
});

describe('Seltenheit + Größenklassen', () => {
  it('jede Seltenheit hat Farbe aus B5, eigenes Symbol und Namen', () => {
    expect(RARITY_STYLE.Gewoehnlich.color).toBe('#B0B7C3');
    expect(RARITY_STYLE.Legendaer.color).toBe('#FFC83D');
    const icons = new Set(RARITIES.map((r) => RARITY_STYLE[r].icon));
    expect(icons.size).toBe(RARITIES.length);
    RARITIES.forEach((r, i) => expect(RARITY_STYLE[r].rank).toBe(i));
  });
  it('Größenklassen: Faktoren laut D 1.10, Riesig +1 Zoomstufe', () => {
    expect(SIZE_TIERS.map((s) => SIZE_TIER_STYLE[s].factor)).toEqual([0.8, 1, 1.2, 1.35, 1.5]);
    expect(SIZE_TIER_STYLE.Riesig.extraZoom).toBe(1);
    expect(SIZE_TIER_STYLE.Normal.labelKey).toBeNull();
  });
  it('„Alles verkaufen“ fragt bei wertvollen Fängen nach', () => {
    const f = (rarity: (typeof RARITIES)[number], shiny = false, tier: (typeof SIZE_TIERS)[number] = 'Normal') => ({ fish: { rarity }, shiny, tier });
    expect(needsSellConfirm([f('Gewoehnlich'), f('Selten', false, 'Praechtig')])).toBe(false);
    expect(needsSellConfirm([f('Gewoehnlich'), f('Episch')])).toBe(true);
    expect(needsSellConfirm([f('Gewoehnlich', true)])).toBe(true);
    expect(needsSellConfirm([f('Gewoehnlich', false, 'Kapital')])).toBe(true);
  });
});
