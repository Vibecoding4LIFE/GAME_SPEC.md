// tests/balancing.test.ts – Phase 1: Data/balancing.csv → public/data/balancing.json (Teil D, „Daten statt Code“).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BALANCING_GROUPS, REQUIRED_EFFECT_KEYS, eventEffect, loadBalancing, nestBalancing, validateBalancing, weatherEffect,
} from '../src/data/balancing';
import { RARITIES, SIZE_GRADES } from '../src/data/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = JSON.parse(readFileSync(join(ROOT, 'public/data/balancing.json'), 'utf8')) as Record<string, unknown>;
const b = loadBalancing(json);

describe('balancing.json', () => {
  it('hat alle Gruppen', () => {
    for (const g of ['cast', 'depth', 'bite', 'drill', 'spawn', 'size', 'shiny', 'score', 'time', 'weather', 'xp', 'sell']) {
      expect(BALANCING_GROUPS).toContain(g);
      expect(json[g], g).toBeTypeOf('object');
    }
  });

  it('Wurf (D 1.3)', () => {
    expect(b.cast.cycleS).toBe(1.2);
    expect(b.cast.perfect.windowMinDefault).toBe(0.92);
    expect(b.cast.perfect.biteRateBonus).toBe(0.1);
    expect(b.cast.miss.below).toBe(0.1);
    expect(b.cast.wind).toMatchObject({ Gewitter: 0.1, Schneesturm: 0.15 });
  });

  it('Biss (D 1.5): Anschlagfenster linear von +0,2 bis −0,15', () => {
    expect(b.bite.window.baseS).toBe(0.6);
    const steps = RARITIES.map((r) => b.bite.window.rarityBonusS[r]);
    expect(steps[0]).toBe(0.2);
    expect(steps[4]).toBe(-0.15);
    for (let i = 1; i < steps.length; i++) expect((steps[i - 1] ?? 0) - (steps[i] ?? 0)).toBeCloseTo(0.0875, 10);
    expect(b.bite.perfect).toEqual({ windowFraction: 0.4, staminaReduction: 0.15 });
    expect(b.bite.earlyStrike.penaltyS).toBe(5);
    expect(b.bite.toothedCutChance).toBe(0.15);
    expect(b.bite.curioShare).toBe(0.04);
  });

  it('Drill (D 1.6/1.7)', () => {
    expect(b.drill.counterBonus).toBe(0.3);
    expect([b.drill.crankFactor, b.drill.reliefFactor, b.drill.fishPullFactor]).toEqual([60, 60, 10]);
    expect(b.drill.progress).toEqual({ belowZone: 0.3, aboveZone: 0.6 });
    expect(b.drill.break.baseS).toBe(0.35);
    expect(b.drill.unhook).toEqual({ tension: 0.05, durationS: 1.5 });
    expect(b.drill.zone.strengthPenalty).toBe(0.015);
    expect(b.drill.zone.minWidth).toBe(0.1);
    expect(b.drill.stamina.baseS).toEqual({ Gewoehnlich: 6, Ungewoehnlich: 9, Selten: 13, Episch: 20, Legendaer: 45 });
    expect(b.drill.stamina.legendaerMaxS).toBe(70);
    expect(b.drill.stamina.scale).toBe(1.5);
    expect(b.drill.behavior.Springer.tensionLimit).toBe(0.4);
    expect(b.drill.behavior.Trickser.telegraphS).toBe(0.4);
    expect(b.drill.behavior.Aufblaeher).toMatchObject({ intervalMinS: 5, intervalMaxS: 7, durationS: 3 });
    expect(b.drill.behavior.Stromer.invertS).toBe(1.5);
  });

  it('Spawn (D 1.9, E W1)', () => {
    expect(b.spawn.base).toEqual({ Gewoehnlich: 100, Ungewoehnlich: 35, Selten: 12, Episch: 3, Legendaer: 0.6 });
    expect(b.spawn.zoneMismatch).toBe(0.3);
    expect(b.spawn.bait).toEqual({ favorite: 2, neutral: 1, disliked: 0.3 });
    expect(b.spawn.pity).toEqual({ step: 0.08, max: 0.8 });
    expect(weatherEffect(b, 'Sonnig').tags).toEqual({ oberflaeche: 1.3, raubfisch: 0.8 });
    expect(weatherEffect(b, 'Gewitter').rarity).toEqual({ Episch: 2, Legendaer: 2 });
    expect(weatherEffect(b, 'Regen').biteRate).toBe(0.15);
    expect(weatherEffect(b, 'Duenung')).toEqual({});
    expect(eventEffect(b, 'Vollmond').rarity?.Episch).toBe(1.5);
    expect(eventEffect(b, 'Mueckenschwarm').fish).toEqual({ F005: 1.5, F006: 1.5 });
    expect(b.spawn.futterplatz).toMatchObject({ durationS: 30, tags: { friedfisch: 1.5 } });
    expect(b.spawn.haenger.chance).toBe(0.08);
  });

  it('Größe, Schillernd, Punkte, Zeit, Wetter, Ruf (D 1.10, 1.11, 2.3, 1.9, 3.1)', () => {
    expect([b.size.mu, b.size.sigma]).toEqual([0.45, 0.18]);
    expect(SIZE_GRADES.map((g) => b.size.grade[g].upTo)).toEqual([0.15, 0.7, 0.88, 0.97, 1]);
    expect(SIZE_GRADES.map((g) => b.size.grade[g].factor)).toEqual([0.8, 1, 1.2, 1.35, 1.5]);
    expect(b.shiny).toMatchObject({ baseOneIn: 250, badgeOneIn: 200, capOneIn: 60, pointsMultiplier: 3, competitionBonusCap: 600 });
    expect(b.score.quality).toEqual({ masterDrill: 0.2, perfectCast: 0.1, perfectStrike: 0.05 });
    expect(b.score.variety).toEqual({ first: 1.25, second: 1, third: 0.85, later: 0.7 });
    expect(b.score.finale.multiplier).toBe(1.5);
    expect(b.time).toEqual({ dayLengthS: 960, phaseLengthS: 240 });
    expect([b.weather.changeMinS, b.weather.changeMaxS]).toEqual([180, 300]);
    expect(b.xp.catch).toEqual({ Gewoehnlich: 5, Ungewoehnlich: 12, Selten: 30, Episch: 80, Legendaer: 250 });
    expect(b.xp.level).toMatchObject({ base: 100, exponent: 1.4 });
  });

  it('Lexikon-Sterne (D 1.12) und kurze Verhaltens-Pausen (Abnahme Phase 1)', () => {
    expect(b.lexicon.twoStarCatches).toBe(5);
    for (const k of ['Sprinter', 'Taucher', 'Springer', 'Trickser', 'Blinker', 'Versteckspieler', 'Stromer'] as const) {
      expect([b.drill.behavior[k].intervalMinS, b.drill.behavior[k].intervalMaxS], k).toEqual([2.5, 4]);
    }
    expect([b.drill.behavior.Aufblaeher.intervalMinS, b.drill.behavior.Aufblaeher.intervalMaxS]).toEqual([5, 7]); // Spec D 1.7
    const B = b.drill.behavior;
    for (const x of [B.Zappler, B.Sprinter, B.Taucher, B.Springer, B.Zickzack, B.Trickser, B.Versteckspieler, B.Aufblaeher, B.Stromer, B.Blinker]) {
      expect(x.firstActionMaxS).toBeLessThanOrEqual(2);
    }
    expect(json.cast).not.toHaveProperty('zone');
  });

  it('Beispiel D 2.3: Hecht Prächtig, Meisterdrill + perfekter Wurf, erster der Runde = 234 Punkte', () => {
    const q = 1 + b.score.quality.masterDrill + b.score.quality.perfectCast;
    expect(Math.round(120 * b.size.grade.Praechtig.factor * q * b.score.variety.first)).toBe(234);
  });
});

describe('Pflicht-Schlüssel und Prüfungen', () => {
  const rows = (o: Record<string, unknown>, prefix = ''): { schluessel: string; wert: number }[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'number' ? [{ schluessel: prefix + k, wert: v }] : v && typeof v === 'object' ? rows(v as Record<string, unknown>, `${prefix}${k}.`) : []);
  const all = rows(json).filter((r) => r.schluessel !== 'version');

  it('fehlender Schlüssel ist ein Fehler mit Schlüsselnamen', () => {
    const { tree } = nestBalancing(all.filter((r) => r.schluessel !== 'drill.counterBonus'));
    const res = validateBalancing({ version: 1, ...tree });
    expect(res.data).toBeNull();
    expect(res.issues).toContainEqual({ key: 'drill.counterBonus', msg: 'Pflicht-Schlüssel fehlt' });
  });

  it('fehlender Spec-Effekt (Teil-Record) ist ein Fehler', () => {
    const { tree } = nestBalancing(all.filter((r) => r.schluessel !== 'spawn.weather.Nebel.tags.mystisch'));
    const res = validateBalancing({ version: 1, ...tree });
    expect(res.issues.map((i) => i.key)).toContain('spawn.weather.Nebel.tags.mystisch');
    expect(REQUIRED_EFFECT_KEYS).toContain('spawn.weather.Nebel.tags.mystisch');
  });

  it('unbekannter, doppelter oder widersprüchlicher Schlüssel ist ein Fehler', () => {
    const extra = nestBalancing([...all, { schluessel: 'drill.gibtsNicht', wert: 1 }]);
    expect(validateBalancing({ version: 1, ...extra.tree }).issues.map((i) => i.key)).toContain('drill.gibtsNicht');
    expect(nestBalancing([...all, { schluessel: 'drill.counterBonus', wert: 1 }]).issues).toContainEqual({ key: 'drill.counterBonus', msg: 'Schlüssel doppelt' });
    expect(nestBalancing([...all, { schluessel: 'drill.counterBonus.x', wert: 1 }]).issues.length).toBe(1);
  });

  it('min > max wird erkannt', () => {
    const swapped = all.map((r) => (r.schluessel === 'bite.nibble.intervalMinS' ? { ...r, wert: 9 } : r));
    const res = validateBalancing({ version: 1, ...nestBalancing(swapped).tree });
    expect(res.issues.map((i) => i.key)).toContain('bite.nibble.intervalMinS');
  });
});
