import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import type { FishId, WorldEvent } from '../../src/data/types';
import {
  biteRateBonus, effectFactor, fishWeight, nextPityCount, pityBonus, rollSpawn, spawnTable, type SpawnContext,
} from '../../src/game/spawn';
import { byId } from '../../src/game/types';
import { b, data, fishById, startLoadout, W1, w1Fish } from './helpers/gameData';

const bait = (id: string) => byId(data.gear.baits, id, 'Köder');
const lo = startLoadout();

function ctx(over: Partial<SpawnContext> = {}): SpawnContext {
  return {
    b, world: W1, fish: w1Fish, curios: data.gear.curios, phase: 'Tag', weather: 'Sonnig', events: [],
    depthM: 2, zone: 'Ufer', bait: lo.bait, line: lo.line, leader: null, twitching: false, feedingSpot: false, pityCount: 0,
    ...over,
  };
}
const w = (id: FishId, over: Partial<SpawnContext> = {}) => fishWeight(fishById(id), ctx(over)).weight;

describe('Spawn – Pflichtbedingungen (D 1.9, Teil E)', () => {
  it('F017 Glühwürmchen-Barsch: nur nachts und ohne Regen/Gewitter', () => {
    const base = { phase: 'Nacht' as const, depthM: 2, zone: 'Ufer' as const };
    expect(w('F017', { ...base, weather: 'Sonnig' })).toBeGreaterThan(0);
    expect(w('F017', { ...base, weather: 'Bewoelkt' })).toBeGreaterThan(0);
    expect(w('F017', { ...base, weather: 'Nebel' })).toBeGreaterThan(0);
    expect(w('F017', { ...base, weather: 'Regen' })).toBe(0);
    expect(w('F017', { ...base, weather: 'Gewitter' })).toBe(0);
    expect(w('F017', { ...base, weather: 'Sonnig', phase: 'Tag' })).toBe(0);
  });

  it('F020 Barnabas: nur Nacht + (Gewitter oder Vollmond), 15–25 m', () => {
    const base = { phase: 'Nacht' as const, depthM: 20, zone: 'Kante' as const };
    expect(w('F020', { ...base, weather: 'Gewitter' })).toBeGreaterThan(0);
    expect(w('F020', { ...base, weather: 'Sonnig', events: ['Vollmond'] })).toBeGreaterThan(0);
    expect(w('F020', { ...base, weather: 'Sonnig' })).toBe(0);
    expect(w('F020', { ...base, weather: 'Regen' })).toBe(0);
    expect(w('F020', { ...base, weather: 'Gewitter', phase: 'Abend' })).toBe(0);
    expect(w('F020', { ...base, weather: 'Gewitter', depthM: 10 })).toBe(0);
  });

  it('Gewitter verdoppelt Episch/Legendär, Vollmond Episch ×1,5', () => {
    const night = { phase: 'Nacht' as const, depthM: 20, zone: 'Kante' as const };
    const wels = fishById('F018');
    expect(effectFactor({ rarity: { Episch: 2 } }, wels)).toBe(2);
    const plain = fishWeight(wels, ctx({ ...night, weather: 'Bewoelkt' })).weight;
    const moon = fishWeight(wels, ctx({ ...night, weather: 'Bewoelkt', events: ['Vollmond'] })).weight;
    expect(moon / plain).toBeCloseTo(b.spawn.event.Vollmond?.rarity?.Episch ?? NaN, 10);
  });
});

describe('Spawn – Tiefe, Zone, Zeit', () => {
  it('Tiefen-Treffer 1/0 an den Grenzen', () => {
    expect(w('F001', { depthM: 0 })).toBeGreaterThan(0);
    expect(w('F001', { depthM: 8 })).toBeGreaterThan(0);
    expect(w('F001', { depthM: 8.01 })).toBe(0);
  });
  it('Zonen-Treffer: falsche Zone × spawn.zoneMismatch', () => {
    const hechtCtx = { phase: 'Morgen' as const, weather: 'Bewoelkt' as const, depthM: 10 };
    const ok = fishWeight(fishById('F014'), ctx({ ...hechtCtx, zone: 'Freiwasser' }));
    const bad = fishWeight(fishById('F014'), ctx({ ...hechtCtx, zone: 'Ufer' }));
    expect(ok.factors.zone).toBe(1);
    expect(bad.factors.zone).toBe(b.spawn.zoneMismatch);
  });
  it('Zeitfaktor 0 außerhalb der Tageszeit, „Immer“ = 1', () => {
    expect(w('F002', { phase: 'Nacht', depthM: 5 })).toBe(0);
    expect(w('F001', { phase: 'Nacht' })).toBeGreaterThan(0);
  });
});

describe('Spawn – Köder, Wirkungen, Zucken, Futterplatz', () => {
  it('Lieblingsköder ×2, neutral ×1, mag-er-nicht ×0,3', () => {
    const f = fishById('F001');
    expect(fishWeight(f, ctx({ bait: bait('K01') })).factors.bait).toBe(b.spawn.bait.favorite);
    expect(fishWeight(f, ctx({ bait: bait('K05') })).factors.bait).toBe(b.spawn.bait.neutral);
    expect(fishWeight(f, ctx({ bait: bait('K04') })).factors.bait).toBe(b.spawn.bait.disliked);
  });
  it('Maden (K02) Gewöhnliche ×1,3 nur in ihrer Welt', () => {
    const f = fishById('F008');
    const neutral = fishWeight(f, ctx({ bait: bait('K05') }));
    const maden = fishWeight(f, ctx({ bait: bait('K02') }));
    expect(maden.factors.effects / neutral.factors.effects).toBeCloseTo(bait('K02').rarityMods.Gewoehnlich ?? NaN, 10);
  });
  it('Zucken: Raubfisch × (1 + Bonus × Köder-Zuckfaktor), Friedfisch × (1 − Malus)', () => {
    const tagCtx = { phase: 'Tag' as const, depthM: 5, weather: 'Bewoelkt' as const };
    const barsch = fishById('F002');
    const r0 = fishWeight(barsch, ctx(tagCtx)).factors.effects;
    expect(fishWeight(barsch, ctx({ ...tagCtx, twitching: true })).factors.effects / r0).toBeCloseTo(1 + b.depth.twitch.raubfischBonus, 10);
    const r4 = fishWeight(barsch, ctx({ ...tagCtx, bait: bait('K04') })).factors.effects;
    expect(fishWeight(barsch, ctx({ ...tagCtx, bait: bait('K04'), twitching: true })).factors.effects / r4)
      .toBeCloseTo(1 + b.depth.twitch.raubfischBonus * bait('K04').twitchBonus, 10);
    const rot = fishWeight(fishById('F001'), ctx(tagCtx)).factors.effects;
    expect(fishWeight(fishById('F001'), ctx({ ...tagCtx, twitching: true })).factors.effects / rot).toBeCloseTo(1 - b.depth.twitch.friedfischMalus, 10);
  });
  it('Mückenschwarm: Ukelei und Rotfeder ×1,5; Futterplatz: Friedfische ×1,5', () => {
    const ev: WorldEvent[] = ['Mueckenschwarm'];
    expect(w('F005', { events: ev }) / w('F005')).toBeCloseTo(1.5, 10);
    expect(w('F006', { events: ev }) / w('F006')).toBeCloseTo(1.5, 10);
    expect(w('F001', { feedingSpot: true }) / w('F001')).toBeCloseTo(b.spawn.futterplatz.tags?.friedfisch ?? NaN, 10);
  });
  it('Bissraten-Boni: Regen +0,15, perfekter Wurf +0,10', () => {
    const base = { b, world: W1, events: [], bait: lo.bait, line: lo.line, leader: null, feedingSpot: false };
    expect(biteRateBonus({ ...base, weather: 'Sonnig', perfectCast: false })).toBe(0);
    expect(biteRateBonus({ ...base, weather: 'Regen', perfectCast: true })).toBeCloseTo(0.25, 10);
  });
});

describe('Glücksschimmer (Pity, D 1.9 / 2.5)', () => {
  it('steigt additiv um step bis max und setzt nach Selten+ zurück', () => {
    expect(pityBonus(0, b)).toBe(0);
    expect(pityBonus(3, b)).toBeCloseTo(3 * b.spawn.pity.step, 10);
    expect(pityBonus(1000, b)).toBe(b.spawn.pity.max);
    expect(nextPityCount(4, 'Gewoehnlich')).toBe(5);
    expect(nextPityCount(4, 'Ungewoehnlich')).toBe(5);
    expect(nextPityCount(4, 'Selten')).toBe(0);
    expect(nextPityCount(4, 'Legendaer')).toBe(0);
  });
  it('hebt nur Selten/Episch an', () => {
    const c = { phase: 'Morgen' as const, weather: 'Bewoelkt' as const, depthM: 10, zone: 'Freiwasser' as const };
    expect(w('F014', { ...c, pityCount: 5 }) / w('F014', c)).toBeCloseTo(1 + 5 * b.spawn.pity.step, 10);
    expect(w('F009', { ...c, pityCount: 5 })).toBe(w('F009', c));
  });
});

describe('rollSpawn', () => {
  it('ist deterministisch und respektiert erzwungene Fische', () => {
    const a = new Rng(7);
    const c = new Rng(7);
    const seqA = Array.from({ length: 50 }, () => rollSpawn(ctx(), a));
    const seqC = Array.from({ length: 50 }, () => rollSpawn(ctx(), c));
    expect(seqA.map((r) => (r.kind === 'fish' ? r.fish.id : r.kind))).toEqual(seqC.map((r) => (r.kind === 'fish' ? r.fish.id : r.kind)));
    const forced = rollSpawn(ctx({ forceFishId: 'F020' }), new Rng(1));
    expect(forced.kind === 'fish' && forced.fish.id).toBe('F020');
  });
  it('Fundstücke ≈ bite.curioShare aller Bisse, nur Fundstücke dieser Welt', () => {
    const rng = new Rng(11);
    let curio = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const r = rollSpawn(ctx(), rng);
      if (r.kind === 'curio') {
        curio++;
        expect(r.curio.worlds.length === 0 || r.curio.worlds.includes('W1')).toBe(true);
      }
    }
    expect(curio / n).toBeGreaterThan(b.bite.curioShare * 0.8);
    expect(curio / n).toBeLessThan(b.bite.curioShare * 1.2);
  });
  it('kein passender Fisch → none', () => {
    expect(rollSpawn(ctx({ depthM: 999 }), new Rng(1)).kind).toBe('none');
    expect(spawnTable(ctx({ depthM: 999 })).every((x) => x.weight === 0)).toBe(true);
  });
});
