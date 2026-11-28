import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import { createStore, memoryStore } from '../../src/core/storage';
import { createBite, judgeStrike, planApproach, stepBite, strikeWindowS, toothedCut, waitTimeS, type BiteDeps } from '../../src/game/bite';
import { castPower, holdTimeForPower, perfectWindowMin, resolveCast, windShare, zoneAt } from '../../src/game/cast';
import { activeEvents, createClock, forceEvent, phaseAt, setPhase, setWeather, stepClock } from '../../src/game/clock';
import { depthLimitM, layerAt, lineCapacityM, sinkStep, twitchDepth } from '../../src/game/depth';
import { markSeen, recordCatch, starsFor, worldProgress, type Lexicon } from '../../src/game/lexicon';
import { newProfile, parseSave, serializeSave } from '../../src/game/save';
import { shinyChance } from '../../src/game/shiny';
import { InputCollector } from '../../src/game/session';
import { byId, worldById } from '../../src/game/types';
import { b, data, fishById, startLoadout, W1 } from './helpers/gameData';

const lo = startLoadout();
const rod = (id: string) => byId(data.gear.rods, id, 'Rute');
const reel = (id: string) => byId(data.gear.reels, id, 'Rolle');
const bait = (id: string) => byId(data.gear.baits, id, 'Köder');

describe('Wurf (D 1.3)', () => {
  it('Ping-Pong: 0 → 1 → 0 in einem Durchlauf', () => {
    const c = lo.rod.castCycleS;
    expect(castPower(0, c)).toBe(0);
    expect(castPower(c / 4, c)).toBeCloseTo(0.5, 10);
    expect(castPower(c / 2, c)).toBeCloseTo(1, 10);
    expect(castPower((3 * c) / 4, c)).toBeCloseTo(0.5, 10);
    expect(castPower(c, c)).toBeCloseTo(0, 10);
    expect(castPower(holdTimeForPower(0.8, c), c)).toBeCloseTo(0.8, 10);
    expect(castPower(c / 4, c, 1.3)).toBeCloseTo(0.65, 10);
  });
  it('Weite = Kraft × MaxWurfweite; Zonen nach worlds.json (Ufer < 6 m, Freiwasser < 15 m, sonst Kante)', () => {
    const r = resolveCast({ power: 0.5, rod: lo.rod, world: W1, weather: 'Sonnig', windDir: 1, b });
    expect(r.distanceM).toBe(10);
    expect(r.zone).toBe('Freiwasser');
    expect(zoneAt(5.9, W1)).toBe('Ufer');
    expect(zoneAt(15, W1)).toBe('Kante');
  });
  it('Perfekt ab 92 % (Rute bis 86 %), Fehlwurf unter 10 % plumpst ins Ufer', () => {
    expect(resolveCast({ power: 0.93, rod: lo.rod, world: W1, weather: 'Sonnig', windDir: 1, b }).perfect).toBe(true);
    expect(resolveCast({ power: 0.91, rod: lo.rod, world: W1, weather: 'Sonnig', windDir: 1, b }).perfect).toBe(false);
    expect(perfectWindowMin(rod('R06'), b)).toBe(0.86);
    const miss = resolveCast({ power: 0.05, rod: lo.rod, world: W1, weather: 'Sonnig', windDir: 1, b });
    expect(miss.miss).toBe(true);
    expect(miss.zone).toBe('Ufer');
    expect(miss.distanceM).toBeCloseTo(b.cast.miss.landingPower * lo.rod.castMaxDistanceM, 10);
  });
  it('Wind bei Gewitter ±10 % der Weite, Sturmbrecher ist immun', () => {
    const r = resolveCast({ power: 0.5, rod: lo.rod, world: W1, weather: 'Gewitter', windDir: -1, b });
    expect(r.windOffsetM).toBeCloseTo(-2, 10);
    expect(r.distanceM).toBeCloseTo(8, 10);
    expect(windShare('Gewitter', rod('R05'), 'W1', b)).toBe(0);
    expect(windShare('Sonnig', lo.rod, 'W1', b)).toBe(0);
  });
});

describe('Ködertiefe (D 1.4)', () => {
  // Werte aus gear.json / worlds.json statt fest (Startrolle RO1 und Weltgrund ändern sich mit dem Balancing)
  const cap = lo.reel.lineCapacityM;
  it('Sinkgeschwindigkeit nach Köder, Grenze = min(Grund, Schnur)', () => {
    expect(sinkStep(0, 1, bait('K01'), lo.reel, W1).depthM).toBe(b.depth.sinkSpeedMs.mittel);
    expect(sinkStep(0, 1, bait('K04'), lo.reel, W1).depthM).toBe(b.depth.sinkSpeedMs.schwer);
    const end = sinkStep(cap - 1, 10, bait('K01'), lo.reel, W1);
    expect(end.depthM).toBe(Math.min(cap, W1.maxTiefeM));
    expect(end.atLimit).toBe(true);
    expect(end.lineTooShort).toBe(cap < W1.maxTiefeM);
    // mit einer Rolle, die bis zum Grund reicht, ist die Schnur nie zu kurz
    const deep = sinkStep(W1.maxTiefeM - 1, 10, bait('K01'), reel('RO4'), W1);
    expect(deep.depthM).toBe(W1.maxTiefeM);
    expect(deep.lineTooShort).toBe(false);
  });
  it('Schnur zu kurz, wenn die Rolle nicht bis zum Grund reicht; Tiefseewinde nur in W4', () => {
    const W2 = worldById(data.worlds, 'W2');
    const r = sinkStep(cap - 1, 1, bait('K01'), lo.reel, W2);
    expect(r.depthM).toBe(cap);
    expect(r.lineTooShort).toBe(cap < W2.maxTiefeM);
    expect(lineCapacityM(reel('RO5'), W1)).toBe(80);
    expect(lineCapacityM(reel('RO5'), worldById(data.worlds, 'W4'))).toBe(2000);
    expect(depthLimitM(reel('RO4'), W1)).toBe(W1.maxTiefeM);
  });
  it('Zucken hebt den Köder, Schichten aus worlds.json', () => {
    expect(twitchDepth(5, b)).toBeCloseTo(5 - b.depth.twitch.liftM, 10);
    expect(twitchDepth(0.1, b)).toBe(0);
    expect(layerAt(W1, 10)).toBe('Krautfeld');
    expect(layerAt(W1, 20)).toBe('Tiefes Loch');
  });
});

describe('Biss & Anschlag (D 1.5)', () => {
  it('Wartezeit = Grundwert / (1 + Boni), mindestens floorS', () => {
    const a = waitTimeS(b, new Rng(1), 0);
    expect(a).toBeGreaterThanOrEqual(b.bite.wait.minS);
    expect(a).toBeLessThanOrEqual(b.bite.wait.maxS);
    expect(waitTimeS(b, new Rng(1), 0.25)).toBeCloseTo(Math.max(b.bite.wait.floorS, a / 1.25), 10);
    expect(waitTimeS(b, new Rng(1), 100)).toBe(b.bite.wait.floorS);
  });
  it('Anschlagfenster: 0,6 s + Seltenheit + Rute', () => {
    expect(strikeWindowS(fishById('F001'), lo.rod, b)).toBeCloseTo(0.8, 10);
    expect(strikeWindowS(fishById('F020'), lo.rod, b)).toBeCloseTo(0.45, 10);
    expect(strikeWindowS(fishById('F001'), rod('R03'), b)).toBeCloseTo(0.9, 10);
    expect(judgeStrike(0.3, 0.8, b)).toBe('perfect');
    expect(judgeStrike(0.5, 0.8, b)).toBe('ok');
    expect(judgeStrike(0.81, 0.8, b)).toBe('late');
  });
  it('Zupfer-Anzahl aus nibbleMin/Max, Scheinbisse nur bei Tricksern', () => {
    const hecht = fishById('F014');
    for (let s = 0; s < 50; s++) {
      const p = planApproach({ kind: 'fish', fish: hecht, weight: 1, total: 1 }, b, new Rng(s));
      expect(p.steps.length).toBeGreaterThanOrEqual(hecht.nibbleMin);
      expect(p.steps.length).toBeLessThanOrEqual(hecht.nibbleMax);
      expect(p.steps.every((x) => x.kind === 'nibble')).toBe(true);
    }
    const trick = { ...hecht, hasFakeBites: true };
    const fakes = Array.from({ length: 200 }, (_, s) => planApproach({ kind: 'fish', fish: trick, weight: 1, total: 1 }, b, new Rng(s)).steps.filter((x) => x.kind === 'fake').length);
    expect(Math.max(...fakes)).toBeLessThanOrEqual(b.bite.fakeBite.maxCount);
    expect(fakes.filter((n) => n > 0).length / 200).toBeGreaterThan(b.bite.fakeBite.chance * 0.6);
    const rueckenwind = planApproach({ kind: 'fish', fish: { ...hecht, nibbleMin: 1, nibbleMax: 1 }, weight: 1, total: 1 }, b, new Rng(1), 1);
    expect(rueckenwind.steps).toHaveLength(0);
  });
  const deps = (seed: number): BiteDeps => ({
    b, rng: new Rng(seed), rod: lo.rod, roll: () => ({ kind: 'fish', fish: fishById('F001'), weight: 1, total: 1 }),
    biteRate: () => ({ sum: 0, factor: 1 }),
  });
  function runBite(seed: number, strikeAt: (stage: string, t: number) => boolean) {
    const d = deps(seed);
    const s = createBite(d);
    const ev: string[] = [];
    for (let i = 0; i < 60 * 60 && s.stage !== 'done'; i++) for (const e of stepBite(s, 1 / 60, strikeAt(s.stage, s.t), d)) ev.push(e.type);
    return { s, ev };
  }
  it('zu früh (während der Zupfer) verscheucht, zu spät = Köder weg, rechtzeitig = Anschlag', () => {
    expect(runBite(1, (st) => st === 'approach').s.result?.type).toBe('early');
    expect(runBite(1, () => false).s.result?.type).toBe('late');
    const ok = runBite(1, (st, t) => st === 'bite' && t > 0.05);
    expect(ok.s.result).toMatchObject({ type: 'strike', quality: 'perfect' });
    expect(ok.ev).toEqual(expect.arrayContaining(['approach', 'bite', 'strike']));
  });
  it('Zahnfisch ohne Vorfach: Abbiss mit 15 %, mit Stahlvorfach nie', () => {
    const hecht = fishById('F014');
    const rng = new Rng(4);
    const n = 20000;
    let cut = 0;
    for (let i = 0; i < n; i++) if (toothedCut(hecht, lo, b, rng)) cut++;
    expect(cut / n).toBeGreaterThan(0.13);
    expect(cut / n).toBeLessThan(0.17);
    const leader = byId(data.gear.lines, 'Z-V', 'Vorfach');
    expect(Array.from({ length: 1000 }, () => toothedCut(hecht, { ...lo, leader }, b, rng)).some(Boolean)).toBe(false);
    expect(toothedCut(fishById('F001'), lo, b, new Rng(1))).toBe(false);
  });
});

describe('Schillernd (D 1.11)', () => {
  const ctx = { b, world: 'W1' as const, bait: lo.bait, rod: lo.rod, hasWorldBadge: false };
  it('1:250, Glücksköder 1:125, Abzeichen 1:200, beides 1:100, Grenze 1:60', () => {
    expect(shinyChance(ctx)).toBeCloseTo(1 / 250, 12);
    expect(shinyChance({ ...ctx, bait: bait('K13') })).toBeCloseTo(1 / 125, 12);
    expect(shinyChance({ ...ctx, hasWorldBadge: true })).toBeCloseTo(1 / 200, 12);
    expect(shinyChance({ ...ctx, hasWorldBadge: true, bait: bait('K13') })).toBeCloseTo(1 / 100, 12);
    expect(shinyChance({ ...ctx, bait: { ...bait('K13'), shinyMultiplier: 10 } })).toBeCloseTo(1 / 60, 12);
    expect(shinyChance({ ...ctx, rod: rod('RG') })).toBeCloseTo(1 / 200, 12);
  });
});

describe('Uhr, Wetter, Ereignisse (D 1.9, Teil E W1)', () => {
  it('16-min-Tag mit 4 Phasen à 4 min', () => {
    expect(phaseAt(0, b)).toBe('Morgen');
    expect(phaseAt(240, b)).toBe('Tag');
    expect(phaseAt(719, b)).toBe('Abend');
    expect(phaseAt(720, b)).toBe('Nacht');
    expect(phaseAt(960, b)).toBe('Morgen');
  });
  it('Wetterwechsel alle 3–5 min nach der Welttabelle; Morgennebel nur morgens; Vorhersage stimmt', () => {
    const rng = new Rng(3);
    const c = createClock({ world: W1, b, rng, startPhase: 'Morgen', startWeather: 'Sonnig' });
    const counts: Record<string, number> = {};
    let prevAt = c.dayTimeS;
    for (let i = 0; i < 4 * 60 * 600; i++) {
      const predicted = c.forecast[0];
      for (const e of stepClock(c, 0.25, W1, b, rng)) {
        if (e.type === 'weather') {
          counts[e.weather] = (counts[e.weather] ?? 0) + 1;
          if (e.weather === 'Nebel') expect(phaseAt(c.dayTimeS, b)).toBe('Morgen');
          if (predicted && Math.abs(c.dayTimeS - predicted.atS) < 0.3) expect(e.weather).toBe(predicted.weather);
        }
      }
      const head = c.forecast[0];
      if (predicted && head && head !== predicted) {
        // nächster Termin liegt 3–5 min nach dem vorigen (außer nach einem Zwangswechsel, z. B. Morgennebel-Ende)
        const gap = predicted.atS - prevAt;
        if (gap > 0) expect(gap).toBeLessThanOrEqual(b.weather.changeMaxS + 1e-6);
        prevAt = predicted.atS;
      }
      if (c.weather === 'Nebel') expect(phaseAt(c.dayTimeS, b)).toBe('Morgen');
    }
    expect(counts.Sonnig ?? 0).toBeGreaterThan(counts.Gewitter ?? 0);
    expect(counts.Nebel ?? 0).toBeGreaterThan(0);
  });
  it('Vollmond jede 3. Nacht, Sommergewitter = Gewitter, Mückenschwarm nur abends', () => {
    const rng = new Rng(5);
    const c = createClock({ world: W1, b, rng, startPhase: 'Morgen', startWeather: 'Sonnig' });
    c.weatherFixed = true;
    const moonNights = new Set<number>();
    let mosquitoOutsideEvening = false;
    let mosquito = false;
    for (let t = 0; t < 960 * 6; t += 1) {
      stepClock(c, 1, W1, b, rng);
      const ev = activeEvents(c, W1, b);
      if (ev.includes('Vollmond')) { expect(phaseAt(c.dayTimeS, b)).toBe('Nacht'); moonNights.add(Math.floor(c.dayTimeS / 960)); }
      if (ev.includes('Mueckenschwarm')) { mosquito = true; if (phaseAt(c.dayTimeS, b) !== 'Abend') mosquitoOutsideEvening = true; }
    }
    expect([...moonNights]).toEqual([2, 5]);
    expect(mosquito).toBe(true);
    expect(mosquitoOutsideEvening).toBe(false);
    setWeather(c, 'Gewitter', b, rng);
    expect(activeEvents(c, W1, b)).toContain('Sommergewitter');
    forceEvent(c, 'Vollmond', true);
    expect(activeEvents(c, W1, b)).toContain('Vollmond');
  });
  it('Blitze nur bei Gewitter; Debug: Tageszeit setzen', () => {
    const rng = new Rng(8);
    const c = createClock({ world: W1, b, rng, startPhase: 'Tag', startWeather: 'Gewitter' });
    c.weatherFixed = true;
    let flashes = 0;
    for (let t = 0; t < 120; t += 0.5) for (const e of stepClock(c, 0.5, W1, b, rng)) if (e.type === 'lightning') flashes++;
    expect(flashes).toBeGreaterThanOrEqual(Math.floor(120 / b.weather.lightning.intervalMaxS));
    setPhase(c, 'Nacht', b);
    expect(phaseAt(c.dayTimeS, b)).toBe('Nacht');
  });
});

describe('Lexikon (D 1.12)', () => {
  it('unbekannt → gesichtet → gefangen, Rekorde, Sterne', () => {
    const lex: Lexicon = {};
    expect(markSeen(lex, 'F014')).toBe(true);
    expect(lex.F014?.state).toBe('seen');
    expect(starsFor(lex.F014, b)).toBe(0);
    const c = { fishId: 'F014' as const, lengthCm: 80, weightG: 4000, grade: 'Normal' as const, shiny: false };
    expect(recordCatch(lex, c)).toEqual({ isNew: true, isRecord: false });
    expect(starsFor(lex.F014, b)).toBe(1);
    expect(markSeen(lex, 'F014')).toBe(false);
    expect(recordCatch(lex, { ...c, lengthCm: 90, weightG: 5000 })).toEqual({ isNew: false, isRecord: true });
    expect(lex.F014?.recordLengthCm).toBe(90);
    for (let i = 0; i < 3; i++) recordCatch(lex, c);
    expect(lex.F014?.count).toBe(5);
    expect(starsFor(lex.F014, b)).toBe(2);
    recordCatch(lex, { ...c, fishId: 'F001', grade: 'Kapital' });
    expect(starsFor(lex.F001, b)).toBe(2);
    recordCatch(lex, { ...c, fishId: 'F002', shiny: true });
    expect(starsFor(lex.F002, b)).toBe(3);
    recordCatch(lex, { ...c, fishId: 'F003', grade: 'Riesig' });
    expect(starsFor(lex.F003, b)).toBe(3);
    expect(worldProgress(lex, W1.fish as never)).toEqual({ caught: 4, seen: 0, total: 20 });
  });
});

describe('Spielstand (save.ts) und Speicher', () => {
  it('Rundreise, Validierung, Version', () => {
    const p = newProfile(data.gear);
    expect(p.loadout).toMatchObject({ rod: 'R01', line: 'L01', reel: 'RO1', bait: 'K01' });
    p.coins = 123;
    recordCatch(p.lexicon, { fishId: 'F001', lengthCm: 20, weightG: 96, grade: 'Normal', shiny: false });
    const text = serializeSave(p, 1);
    const r = parseSave(text);
    expect(r.ok && r.save.profile).toEqual(p);
    expect(parseSave('{kaputt').ok).toBe(false);
    expect(parseSave(JSON.stringify({ version: 99, savedAt: 0, profile: p })).ok).toBe(false);
    expect(parseSave(JSON.stringify({ version: 1, savedAt: 0, profile: { ...p, coins: -5 } })).ok).toBe(false);
  });
  it('Speicher fällt ohne localStorage auf den Arbeitsspeicher zurück', async () => {
    const s = createStore();
    expect(s.persistent).toBe(false);
    await s.set('a', 'b');
    expect(await s.get('a')).toBe('b');
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
    expect(memoryStore().persistent).toBe(false);
  });
});

describe('Eingabe-Sammler (passt zu src/ui/input.ts)', () => {
  it('gehaltene Werte bleiben, Flanken gelten genau einen Schritt', () => {
    const c = new InputCollector();
    c.apply({ type: 'castHold' });
    c.apply({ type: 'reelStart' });
    c.apply({ type: 'steer', value: -0.7 });
    c.apply({ type: 'rodUp' });
    c.apply({ type: 'strike' });
    const a = c.take();
    expect(a).toMatchObject({ castHeld: true, reel: true, reelPressed: true, steer: -0.7, rodUp: true, strike: true });
    const b2 = c.take();
    expect(b2).toMatchObject({ castHeld: true, reel: true, reelPressed: false, rodUp: false, strike: false });
    c.apply({ type: 'castRelease' });
    c.apply({ type: 'reelStop' });
    c.apply({ type: 'item' });
    expect(c.take()).toMatchObject({ castHeld: false, reel: false, feed: true });
  });
});
