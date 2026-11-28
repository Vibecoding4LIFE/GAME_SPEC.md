// Wertung (D 2.2 A, 2.5, 2.6), Lobby-Regeln, Drill-Spec ohne Art, Mindestdrilldauer.
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import { createDrill, stepDrill } from '../../src/game/drill';
import { netConfigFrom } from '../../src/net/config';
import { fishFromSpec, minDrillS, specFromFish } from '../../src/net/drillSpec';
import { allReady, applyEquipmentRule, checkSettings, decideJoin, defaultSettings, readyCount } from '../../src/net/lobby';
import { placeBase, rankPlayers, roundResults, roundReward, specialAwards, tailwindEffect, tailwindLevel, type PlayerTally } from '../../src/net/results';
import { runDrill } from './helpers/bots';
import { b, data, fishById, startLoadout, w1Fish } from './helpers/gameData';

const CFG = netConfigFrom(b);

const tally = (id: string, points: number, weights: number[], extra: Partial<PlayerTally> = {}): PlayerTally => ({
  id, points, lineBreaks: 0, itemHits: 0, guest: false,
  catches: weights.map((w, i) => ({ fishId: `F00${(i % 9) + 1}` as `F${string}`, weightG: w, points: 0, masterDrill: false })),
  ...extra,
});

describe('Rückenwind (D 2.5)', () => {
  it('mehr als 25 % hinter dem Ersten → Stufe 1, ab 50 % → Stufe 2', () => {
    expect(tailwindLevel(1000, 1000, b)).toBe(0);
    expect(tailwindLevel(750, 1000, b)).toBe(0);
    expect(tailwindLevel(749, 1000, b)).toBe(1);
    expect(tailwindLevel(500, 1000, b)).toBe(2);
    expect(tailwindLevel(0, 0, b)).toBe(0);
    expect(tailwindEffect(1, b)).toEqual({ biteRate: 0.15, nibbleReduction: 1 });
    expect(tailwindEffect(2, b)).toEqual({ biteRate: 0.25, nibbleReduction: 1 });
  });
});

describe('Platzierung, Belohnung, Sonderauszeichnungen', () => {
  it('Gleichstand: der schwerere Einzelfang gewinnt; völlig gleich teilt den Platz', () => {
    const r = rankPlayers([tally('a', 500, [100]), tally('b', 500, [900]), tally('c', 800, [1]), tally('d', 500, [100])]);
    expect(r).toEqual([{ id: 'c', place: 1 }, { id: 'b', place: 2 }, { id: 'a', place: 3 }, { id: 'd', place: 3 }]);
  });
  it('Belohnung = Weltfaktor × Platzbasis + 10 % der Punkte (D 2.6)', () => {
    expect([1, 2, 3, 4, 5].map((p) => placeBase(p, b))).toEqual([200, 150, 120, 100, 100]);
    expect(roundReward(1, 1234, 1, b)).toBe(323);
    expect(roundReward(2, 1000, 2.6, b)).toBe(490);
  });
  it('Sonderauszeichnungen nur bei Wert > 0, Gleichauf bekommen alle', () => {
    const t = [
      tally('a', 10, [500, 200], { lineBreaks: 2 }),
      tally('b', 20, [500], { lineBreaks: 2 }),
      tally('c', 30, [], {}),
    ];
    t[1] = { ...(t[1] as PlayerTally), catches: [{ fishId: 'F001', weightG: 500, points: 0, masterDrill: true }] };
    const aw = specialAwards(t);
    expect(aw.get('a')).toEqual(['SchwersterBrocken', 'Sammler', 'Pechvogel']);
    expect(aw.get('b')).toEqual(['SchwersterBrocken', 'Meisterdrill', 'Pechvogel']);
    expect(aw.get('c')).toEqual([]);
    const res = roundResults(t, 1, b);
    const a = res.find((x) => x.id === 'a');
    expect(a).toMatchObject({ place: 3, coins: 120 + 1 + 3 * 50, catches: 2, species: 2, heaviestG: 500, xp: b.xp.roundPlayed });
    expect(res.find((x) => x.id === 'c')?.xp).toBe(b.xp.roundPlayed + b.xp.roundWon);
  });
});

describe('Warteraum', () => {
  it('Einstellungen: nur Wettangeln, Dauer 3/5/8, freigeschaltete Welt, gesperrt nach Start', () => {
    const s = defaultSettings(CFG, 'W1');
    expect(s).toMatchObject({ modus: 'Wettangeln', dauerS: 300, ausruestung: 'Ausgeglichen', schabernack: true });
    expect(checkSettings(s, 'Lobby', CFG, ['W1'])).toBeNull();
    expect(checkSettings({ ...s, dauerS: 240 }, 'Lobby', CFG, ['W1'])).toBe('dauer');
    expect(checkSettings({ ...s, modus: 'Kapitalfang' }, 'Lobby', CFG, ['W1'])).toBe('modus');
    expect(checkSettings({ ...s, welt: 'W2' }, 'Lobby', CFG, ['W1'])).toBe('welt');
    expect(checkSettings(s, 'Countdown', CFG, ['W1'])).toBe('gesperrt');
  });
  it('Beitritt, Bereit-Status, Auto-Start', () => {
    const known = new Set(['a']);
    expect(decideJoin('a', known, 'Fishing', 4, CFG)).toBe('wieder');
    expect(decideJoin('b', known, 'Fishing', 1, CFG)).toBe('gesperrt');
    expect(decideJoin('b', known, 'Lobby', 4, CFG)).toBe('voll');
    expect(decideJoin('b', known, 'Lobby', 3, CFG)).toBe('neu');
    const p = [{ ready: true, connected: true }, { ready: false, connected: true }, { ready: false, connected: false }];
    expect(allReady(p, CFG)).toBe(false);
    expect(readyCount(p)).toEqual({ ready: 1, total: 2 });
    expect(allReady([{ ready: true, connected: true }], CFG)).toBe(false);
    expect(allReady([{ ready: true, connected: true }, { ready: true, connected: true }, { ready: false, connected: false }], CFG)).toBe(true);
  });
  it('Ausrüstungsregel: unbekannte IDs → Start-Teile; Ausgeglichen deckelt die Rute, wenn eine Stufe bekannt ist', () => {
    const ids = { rod: 'R06', line: 'XX', leader: 'L01', reel: 'RO1', bait: 'K01', accessories: ['nix'] };
    const clean = applyEquipmentRule('Eigene', ids, data.gear);
    expect(clean).toMatchObject({ rod: 'R06', line: data.gear.lines.find((l) => !l.isLeader)?.id, leader: null, accessories: [] });
    const capped = applyEquipmentRule('Ausgeglichen', ids, data.gear, { tierCap: 2 });
    expect(data.gear.rods.find((r) => r.id === capped.rod)?.tier).toBeLessThanOrEqual(2);
    expect(applyEquipmentRule('Ausgeglichen', ids, data.gear).rod).toBe('R06');
  });
});

describe('Drill-Spec ohne Art', () => {
  it('der anonyme Fisch drillt genau wie der echte (gleiche Saat, gleiche Eingaben)', () => {
    const lo = startLoadout();
    for (const f of w1Fish.filter((x) => !x.isBoss).slice(0, 8)) {
      const spec = specFromFish(f, 0.6, b);
      const anon = fishFromSpec(spec, f.primaryBehavior, data.fish[0]!);
      expect(JSON.stringify(anon)).not.toContain(f.id);
      expect(anon.nameKey).toBe('');
      const real = createDrill(f, lo, b, new Rng(5), { sizeX: 0.6, world: 'W1', weather: 'Sonnig' });
      const fake = createDrill(anon, lo, b, new Rng(5), { sizeX: 0, world: 'W1', weather: 'Sonnig' });
      for (let i = 0; i < 600; i++) {
        const input = { reel: i % 7 < 4, steer: i % 50 < 25 ? 1 : -1, rodUp: false, tap: false };
        stepDrill(real, input, 1 / 60);
        stepDrill(fake, input, 1 / 60);
      }
      expect(fake.tension).toBeCloseTo(real.tension, 12);
      expect(fake.distance).toBeCloseTo(real.distance, 12);
      expect(fake.outcome).toBe(real.outcome);
    }
  });

  it('kein echter Drill eines guten Bots ist kürzer als die Mindestdauer (Plausibilitätsgrenze des Hosts)', () => {
    const lo = startLoadout();
    let worst = Infinity;
    for (const f of w1Fish.filter((x) => !x.isBoss)) {
      for (let seed = 1; seed <= 6; seed++) {
        const run = runDrill(f, lo, seed, 'good');
        if (run.outcome !== 'caught') continue;
        const min = minDrillS(specFromFish(f, b.size.mu, b), f.primaryBehavior, false, lo.reel, b);
        worst = Math.min(worst, run.timeS / min);
        expect(run.timeS).toBeGreaterThanOrEqual(min);
      }
    }
    expect(worst).toBeGreaterThanOrEqual(1);
    expect(minDrillS(specFromFish(fishById('F001'), 0.5, b), 'Ruhig', true, lo.reel, b))
      .toBeLessThanOrEqual(minDrillS(specFromFish(fishById('F001'), 0.5, b), 'Ruhig', false, lo.reel, b));
    console.info(`knappster Drill / Mindestdauer: ${worst.toFixed(3)}`);
  });
});
