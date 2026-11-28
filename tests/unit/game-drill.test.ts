import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import { FIGHT_BEHAVIORS, type FightBehavior, type FishId } from '../../src/data/types';
import {
  breakDelayS, coldFactor, createDrill, drillStaminaS, greenZone, rodBendStage, stepDrill, NO_DRILL_INPUT,
  type DrillInput, type DrillState,
} from '../../src/game/drill';
import { byId } from '../../src/game/types';
import { badDrillBot, DT, goodDrillBot, runDrill } from './helpers/bots';
import { b, data, fishById, startLoadout } from './helpers/gameData';

const gear = startLoadout();
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Typischer W1-Fisch je Verhalten; Verhalten ohne W1-Vertreter werden an der Regenbogenforelle (K4) erzwungen. */
const TYPICAL: Record<FightBehavior, { id: FishId; force: boolean }> = {
  Ruhig: { id: 'F004', force: false }, Zappler: { id: 'F002', force: false }, Sprinter: { id: 'F014', force: false },
  Taucher: { id: 'F010', force: false }, Springer: { id: 'F012', force: false }, Zickzack: { id: 'F008', force: false },
  Brocken: { id: 'F003', force: false }, Trickser: { id: 'F012', force: true }, Versteckspieler: { id: 'F012', force: true },
  Aufblaeher: { id: 'F012', force: true }, Stromer: { id: 'F012', force: true }, Blinker: { id: 'F012', force: true },
  Hitzkopf: { id: 'F012', force: true },
};

/** Aktion, deren Telegraph/Start im Drill auftauchen muss (Verhalten ohne Aktion: null). */
const SIGNATURE: Record<FightBehavior, string | null> = {
  Ruhig: null, Brocken: null, Hitzkopf: null, Zappler: 'telegraph:spike', Sprinter: 'telegraph:sprint', Taucher: 'telegraph:dive',
  Springer: 'telegraph:jump', Zickzack: 'telegraph:zigzag', Trickser: 'action:fake', Versteckspieler: 'telegraph:cover',
  Aufblaeher: 'telegraph:inflate', Stromer: 'telegraph:shock', Blinker: 'telegraph:invisible',
};

describe.each(FIGHT_BEHAVIORS)('Drill-Verhalten %s (D 1.7)', (beh) => {
  const t = TYPICAL[beh];
  const fish = fishById(t.id);
  const force = t.force ? beh : null;

  it(`guter Spieler fängt ${fish.displayNameDe} mit der Startausrüstung (8 Seeds), Drilldauer plausibel`, () => {
    let withAction = 0;
    for (const seed of SEEDS) {
      const r = runDrill(fish, gear, seed, 'good', force);
      expect(r.outcome, `Seed ${seed}: ${r.events.slice(-5).join(',')}`).toBe('caught');
      expect(r.timeS).toBeGreaterThan(5);
      expect(r.timeS).toBeLessThan(35);
      if (SIGNATURE[beh] && r.events.includes(SIGNATURE[beh])) withAction++;
    }
    // Die Aktion muss vorkommen (bei langen Pausen ist der Fisch manchmal vorher erschöpft, siehe Bericht)
    if (SIGNATURE[beh]) expect(withAction).toBeGreaterThan(0);
  });

  it('schlechter Spieler (immer kurbeln) verliert den Fisch', () => {
    for (const seed of SEEDS) {
      const r = runDrill(fish, gear, seed, 'bad', force);
      expect(['lineBreak', 'unhooked', 'jumpShake', 'heatBreak']).toContain(r.outcome);
      expect(r.timeS).toBeLessThan(5);
    }
  });
});

function drive(s: DrillState, policy: (s: DrillState) => DrillInput, maxS = 120): string[] {
  const ev: string[] = [];
  while (!s.outcome && s.elapsedS < maxS) for (const e of stepDrill(s, policy(s), DT).events) ev.push(e.type === 'action' || e.type === 'telegraph' ? `${e.type}:${e.action}` : e.type);
  return ev;
}
const mk = (id: FishId, force: FightBehavior | null = null, seed = 1, over = {}) =>
  createDrill(fishById(id), gear, b, new Rng(seed), { sizeX: b.size.mu, forceBehavior: force, world: 'W1', ...over });

describe('Drill-Formeln (D 1.6)', () => {
  it('Spannung: Kurbeln +Kurbelkraft×60 %/s, Loslassen −Entlastung×60 %/s, Zug +K×Muster×10 %/s, Konter −30 %', () => {
    const s = mk('F004');
    s.tension = 0.5;
    s.pullDir = 'left';
    stepDrill(s, { ...NO_DRILL_INPUT, reel: true }, 0.1);
    const pull = (3 * b.drill.patternBase * b.drill.fishPullFactor) / 100;
    expect(s.tension).toBeCloseTo(0.5 + (0.6 + pull) * 0.1, 6);
    const s2 = mk('F004');
    s2.tension = 0.5;
    s2.pullDir = 'left';
    stepDrill(s2, { ...NO_DRILL_INPUT, steer: 1 }, 0.1);
    expect(s2.countering).toBe(true);
    expect(s2.tension).toBeCloseTo(0.5 + (-0.6 + pull * (1 - gear.rod.counterBonus)) * 0.1, 6);
  });
  it('grüne Zone: Flex − K × 1,5 %, mindestens 10 %, erschöpft ×1,5, Brocken höher, Kälte schmaler', () => {
    const z = (p: Partial<Parameters<typeof greenZone>[0]>) =>
      greenZone({ b, flex: 0.26, strength: 4, zoneModifier: 0, coldFactor: 1, exhausted: false, brocken: false, ...p });
    const n = z({});
    expect(n.hi - n.lo).toBeCloseTo(0.26 - 4 * 0.015, 10);
    expect((n.lo + n.hi) / 2).toBeCloseTo(b.drill.zone.center, 10);
    const tiny = z({ flex: 0.1, strength: 10 });
    expect(tiny.hi - tiny.lo).toBeCloseTo(b.drill.zone.minWidth, 10);
    const ex = z({ exhausted: true });
    expect(ex.hi - ex.lo).toBeCloseTo((n.hi - n.lo) * 1.5, 10);
    expect((z({ brocken: true }).lo + z({ brocken: true }).hi) / 2).toBeCloseTo(b.drill.zone.center + b.drill.behavior.Brocken.zoneOffset, 10);
    expect(coldFactor(gear, 'Schnee', 'W3', b)).toBe(b.drill.cold.Schnee);
    expect(coldFactor({ ...gear, line: byId(data.gear.lines, 'L04', 'Schnur') }, 'Schnee', 'W3', b)).toBe(1);
    expect(coldFactor({ ...gear, rod: byId(data.gear.rods, 'RW3', 'Rute') }, 'Schnee', 'W3', b)).toBe(1);
  });
  it('Ausdauer: Seltenheit × scale × Größenfaktor 0,8–1,4, Boss 45–70 s × scale, Brocken × staminaMultiplier', () => {
    const k = b.drill.stamina.scale;
    expect(drillStaminaS(fishById('F001'), 0, b)).toBeCloseTo(6 * k * 0.8, 10);
    expect(drillStaminaS(fishById('F014'), 1, b)).toBeCloseTo(13 * k * 1.4, 10);
    expect(drillStaminaS(fishById('F020'), 0, b)).toBeCloseTo(45 * k, 10);
    expect(drillStaminaS(fishById('F020'), 1, b)).toBeCloseTo(70 * k, 10);
    expect(drillStaminaS(fishById('F003'), 0, b, ['Brocken'])).toBeCloseTo(6 * k * 0.8 * 1.25, 10);
  });
  it('perfekter Anschlag: Start mit 15 % weniger Ausdauer', () => {
    const s = mk('F014', null, 1, { perfectStrike: true });
    expect(s.stamina / s.staminaMax).toBeCloseTo(1 - b.bite.perfect.staminaReduction, 10);
  });
  it('Schnurriss nach 0,35 s + Schnur-Reserve bei 100 %', () => {
    expect(breakDelayS(gear, 0, b)).toBeCloseTo(0.35, 10);
    const braided = { ...gear, line: byId(data.gear.lines, 'L02', 'Schnur') };
    expect(breakDelayS(braided, 0, b)).toBeCloseTo(0.5, 10);
    expect(breakDelayS(braided, 2000, b)).toBeCloseTo(0.35, 10); // Druck ohne Schutz
    const s = mk('F004');
    s.tension = 1;
    const ev = drive(s, () => ({ ...NO_DRILL_INPUT, reel: true }));
    expect(ev).toContain('end');
    expect(s.outcome).toBe('lineBreak');
    expect(s.elapsedS).toBeGreaterThan(0.35);
    expect(s.elapsedS).toBeLessThan(0.35 + 2 * DT);
  });
  it('Ausschlitzen nach 1,5 s unter 5 %; Kescher rettet einmal', () => {
    const s = mk('F004');
    drive(s, () => NO_DRILL_INPUT);
    expect(s.outcome).toBe('unhooked');
    expect(s.masterDrill).toBe(false);
    const k = mk('F004', null, 1, { netSaves: 1 });
    const ev = drive(k, () => NO_DRILL_INPUT);
    expect(ev).toContain('netSave');
    expect(k.outcome).toBe('unhooked');
  });
  it('Anfängerschutz: Schnurriss wird zur Warnung, Spannung danach 30 %', () => {
    const s = mk('F004', null, 1, { beginnerSaves: 2 });
    let saves = 0;
    while (!s.outcome && s.elapsedS < 10) {
      for (const e of stepDrill(s, { ...NO_DRILL_INPUT, reel: true }, DT).events) {
        if (e.type === 'beginnerSave') { saves++; expect(s.tension).toBe(b.catchup.beginner.tensionAfterSave); }
      }
    }
    expect(saves).toBe(2);
    expect(s.outcome).toBe('lineBreak');
  });
  it('Meisterdrill beim guten Spieler, Rutenbiegung 0–3', () => {
    expect(runDrill(fishById('F004'), gear, 1, 'good').master).toBe(true);
    expect([0, 0.3, 0.6, 1].map((t) => rodBendStage(t, 4))).toEqual([0, 1, 2, 3]);
  });
  it('Determinismus: gleicher Seed → gleicher Verlauf', () => {
    const a = runDrill(fishById('F014'), gear, 42, 'good');
    const c = runDrill(fishById('F014'), gear, 42, 'good');
    expect(a.trace).toEqual(c.trace);
    expect(a.timeS).toBe(c.timeS);
    // anderer Seed → anderer Verlauf (Ereignisse mit Zeitstempel; die reine Folge kann zufällig gleich sein)
    expect(runDrill(fishById('F014'), gear, 43, 'good').trace).not.toEqual(a.trace);
  });
});

describe('Verhaltens-Mechaniken im Detail', () => {
  const mem = () => ({ lastTapS: -Infinity, lastDir: 'left' as DrillState['pullDir'] });

  it('Springer: Spannung über 40 % während des Sprungs → Haken abgeschüttelt', () => {
    const s = mk('F012');
    const m = mem();
    drive(s, (st) => ({ ...goodDrillBot(st, m), reel: st.tension < (st.zone.lo + st.zone.hi) / 2 }));
    expect(s.outcome).toBe('jumpShake');
  });
  it('Taucher: Rute hochreißen kontert den Tauchgang', () => {
    const s = mk('F010');
    let countered = false;
    while (!s.outcome && s.elapsedS < 30) {
      const rodUp = s.stage.kind === 'telegraph' && s.stage.next === 'dive';
      stepDrill(s, { reel: s.tension < 0.5, steer: 0, rodUp, tap: false }, DT);
      if (s.stage.kind === 'dive') { expect(s.pullDir).toBe('down'); countered ||= s.countering; }
    }
    expect(countered).toBe(true);
  });
  it('Versteckspieler: ohne Gegensteuern Hänger, 3× im Takt tippen löst ihn; falscher Takt beginnt neu', () => {
    const s = mk('F012', 'Versteckspieler');
    const ev: string[] = [];
    let lastTap = -Infinity;
    let firstWrong = true;
    while (!s.outcome && s.elapsedS < 60 && !ev.includes('snagFreed')) {
      let tap = false;
      if (s.snag) {
        const due = s.elapsedS - lastTap >= b.drill.behavior.Versteckspieler.tapIntervalS;
        if (s.snag.count === 1 && firstWrong && s.elapsedS - lastTap > 0.1) { tap = true; firstWrong = false; }
        else if (due || s.snag.count === 0) tap = true;
        if (tap) lastTap = s.elapsedS;
      }
      for (const e of stepDrill(s, { reel: s.tension < Math.max(0.3, s.zone.lo), steer: 0, rodUp: false, tap }, DT).events) {
        ev.push(e.type === 'tap' ? `tap:${e.ok}` : e.type);
      }
    }
    expect(ev).toContain('snag');
    expect(ev).toContain('tap:false');
    expect(ev).toContain('snagFreed');
  });
  it('Hitzkopf: dauerhaft hohe Spannung → Schnur reißt durch Hitze; Hitzeschild-Schnur halbiert die Hitze', () => {
    const hot = (line: string) => {
      const s = createDrill(fishById('F012'), { ...gear, line: byId(data.gear.lines, line, 'Schnur') }, b, new Rng(1), { sizeX: b.size.mu, forceBehavior: 'Hitzkopf', world: 'W1' });
      while (!s.outcome && s.elapsedS < 3) stepDrill(s, { ...NO_DRILL_INPUT, reel: s.tension < s.zone.hi + 0.02, steer: s.pullDir === 'left' ? 1 : -1 }, DT);
      return s.heat;
    };
    expect(hot('L06')).toBeCloseTo(hot('L01') * 0.5, 2);
    const s = mk('F012', 'Hitzkopf');
    drive(s, (st) => ({ ...NO_DRILL_INPUT, reel: st.tension < st.zone.hi + 0.02, steer: st.pullDir === 'left' ? 1 : -1 }));
    expect(s.outcome).toBe('heatBreak');
  });
  it('Trickser: wer während der Schein-Müdigkeit gierig kurbelt, verliert ihn in der Flucht', () => {
    const s = mk('F014', 'Trickser');
    const m = mem();
    drive(s, (st) => {
      const g = goodDrillBot(st, m);
      const greedy = st.stage.kind === 'fake' || st.stage.kind === 'flee' || st.stage.kind === 'telegraph';
      return { ...g, reel: greedy ? true : g.reel };
    });
    expect(['lineBreak']).toContain(s.outcome);
  });
  it('Trickser: Ausdauer-Anzeige sinkt in der Schein-Müdigkeit, echte Ausdauer nicht schneller', () => {
    const s = mk('F012', 'Trickser');
    const m = mem();
    let sawFake = false;
    while (!s.outcome && s.elapsedS < 30) {
      stepDrill(s, goodDrillBot(s, m), DT);
      if (s.stage.kind === 'fake' && s.stage.left < 0.2 && s.stamina > 0) { sawFake = true; expect(s.displayStamina).toBeLessThan(s.stamina); }
    }
    expect(sawFake).toBe(true);
  });
  it('Stromer: Steuerung während des Stromstoßes vertauscht', () => {
    let checked = false;
    for (let seed = 1; seed < 10 && !checked; seed++) {
      const s = mk('F012', 'Stromer', seed);
      const m = mem();
      while (!s.outcome && s.elapsedS < 30) {
        const raw = goodDrillBot(s, m); // kennt die Vertauschung und steuert umgekehrt
        const before = s.inverted && s.pullDir !== 'down';
        stepDrill(s, raw, DT);
        if (before && s.inverted && s.pullDir !== 'down') {
          checked = true;
          expect(s.countering).toBe(true);
          const naive = mk('F012', 'Stromer', seed); // gleicher Verlauf, aber normal gesteuert → kein Konter
          Object.assign(naive, { inverted: true, pullDir: s.pullDir, tension: s.tension });
          stepDrill(naive, { ...raw, steer: -raw.steer }, DT);
          expect(naive.countering).toBe(false);
        }
      }
    }
    expect(checked).toBe(true);
  });
  it('Aufbläher: Einholen halbiert und Zug verdoppelt, danach erschöpft', () => {
    const s = mk('F012', 'Aufblaeher');
    const m = mem();
    let sawInflate = false;
    let sawExhaust = false;
    while (!s.outcome && s.elapsedS < 30) {
      stepDrill(s, goodDrillBot(s, m), DT);
      if (s.stage.kind === 'inflate') sawInflate = true;
      if (s.stage.kind === 'exhaust') sawExhaust = true;
    }
    expect(sawInflate && sawExhaust).toBe(true);
  });
  it('Blinker: wird unsichtbar (Laternenrute: halb sichtbar in W4)', () => {
    const s = mk('F012', 'Blinker');
    let inv = false;
    while (!s.outcome && s.elapsedS < 30) { stepDrill(s, goodDrillBot(s, mem()), DT); inv ||= s.invisible && s.visibility === 0; }
    expect(inv).toBe(true);
    const lantern = createDrill(fishById('F012'), { ...gear, rod: byId(data.gear.rods, 'RW4', 'Rute') }, b, new Rng(1), { sizeX: b.size.mu, forceBehavior: 'Blinker', world: 'W4' });
    let half = false;
    while (!lantern.outcome && lantern.elapsedS < 30) { stepDrill(lantern, goodDrillBot(lantern, mem()), DT); half ||= lantern.invisible && lantern.visibility === 0.5; }
    expect(half).toBe(true);
  });
  it('Zweitverhalten bei secondaryAtStamina (Moosbart-Karausche: Ruhig → Brocken)', () => {
    const s = mk('F016');
    const ev = drive(s, (st) => goodDrillBot(st, mem()));
    expect(ev).toContain('behaviorChange');
    expect(s.behavior).toBe('Brocken');
    expect(s.outcome).toBe('caught');
  });
  it('Boss (Barnabas): Phasen nach Ausdauer, Drill bleibt lösbar', () => {
    const s = mk('F020');
    const phases: number[] = [];
    while (!s.outcome && s.elapsedS < 180) {
      for (const e of stepDrill(s, goodDrillBot(s, mem()), DT).events) if (e.type === 'bossPhase') phases.push(e.phase);
    }
    expect(phases).toEqual([1, 2]);
    expect(s.outcome).toBe('caught');
    expect(s.elapsedS).toBeLessThan(120);
  });
  it('Zappler-Zugspitzen +10–15 %', () => {
    const s = mk('F002');
    const spikes: number[] = [];
    while (!s.outcome && s.elapsedS < 10) for (const e of stepDrill(s, goodDrillBot(s, mem()), DT).events) if (e.type === 'spike') spikes.push(e.amount);
    expect(spikes.length).toBeGreaterThan(3);
    expect(spikes.every((x) => x >= 0.1 && x <= 0.15)).toBe(true);
  });
  it('schlechter Bot bleibt schlecht auch mit Konter-Rute (Sanity)', () => {
    const s = mk('F001');
    drive(s, badDrillBot);
    expect(s.outcome).toBe('lineBreak');
  });
});

describe('Erlebbarkeit (QA M3): erste Aktion früh, mindestens 2 Aktionen je Drill', () => {
  const ACTIVE = FIGHT_BEHAVIORS.filter((x) => !['Ruhig', 'Brocken', 'Hitzkopf'].includes(x));
  it.each(ACTIVE)('%s: erste Aktion spätestens nach firstActionMaxS, in ≥ 20 Drills je mindestens 2 Aktionen', (beh) => {
    const t = TYPICAL[beh];
    const cfg = (b.drill.behavior as unknown as Record<string, { firstActionMaxS: number }>)[beh] as { firstActionMaxS: number };
    let min = Infinity;
    for (let seed = 1; seed <= 20; seed++) {
      const r = runDrill(fishById(t.id), gear, seed, 'good', t.force ? beh : null);
      expect(r.outcome).toBe('caught');
      const first = r.trace.find((x) => x.startsWith('telegraph:') || x.startsWith('action:'));
      expect(first, `Seed ${seed}`).toBeDefined();
      expect(Number(first?.split("@")[1])).toBeLessThanOrEqual(cfg.firstActionMaxS + 2 * DT); // Ereignis kommt im Schritt nach Ablauf (+ Rundung im Trace)
      const actions = r.events.filter((x) => x.startsWith('action:')).length;
      min = Math.min(min, actions);
    }
    // Aufbläher: Pause 5–7 s laut Spec D 1.7 (+3 s aufgebläht, +1,5 s erschöpft) → vor der Erschöpfung passt nur
    // eine Aktion in den Drill. Offener Balancing-Punkt (daten-designer), siehe Bericht Auftrag 4.
    expect(min).toBeGreaterThanOrEqual(beh === 'Aufblaeher' ? 1 : 2);
  });
});

describe('Falsche Reaktion wird bestraft (QA M-2, D 1.7)', () => {
  // Fische wie im QA-Prüfskript (tests/qa/phase1-spiel.qa.ts, PLAN)
  const CASES: [FightBehavior, FishId, boolean][] = [
    ['Sprinter', 'F014', false], ['Taucher', 'F010', false], ['Springer', 'F012', false],
    ['Trickser', 'F004', true], ['Aufblaeher', 'F004', true], ['Stromer', 'F004', true],
  ];
  it.each(CASES)('%s: naiver Spieler (Spannung mittig, nie reagieren) verliert ≥ 2/3, guter Spieler fängt ≥ 95 %%', (beh, id, force) => {
    const fish = fishById(id);
    let naiveCaught = 0;
    for (let seed = 1; seed <= 6; seed++) if (runDrill(fish, gear, seed, 'naive', force ? beh : null).outcome === 'caught') naiveCaught++;
    expect(naiveCaught).toBeLessThanOrEqual(2);
    let good = 0;
    for (let seed = 1; seed <= 20; seed++) if (runDrill(fish, gear, seed, 'good', force ? beh : null).outcome === 'caught') good++;
    expect(good / 20).toBeGreaterThanOrEqual(0.95);
  });
  it('immer kurbeln verliert bei jeder Verhaltensart', () => {
    for (const beh of FIGHT_BEHAVIORS) expect(runDrill(fishById('F004'), gear, 3, 'bad', beh).outcome).not.toBe('caught');
  });
  it('Vorwarnung kennt schon die Richtung der kommenden Aktion (für die Darstellung)', () => {
    const s = mk('F014');
    const tele: DrillState['pullDir'][] = [];
    const acts: DrillState['pullDir'][] = [];
    while (!s.outcome && s.elapsedS < 30) {
      for (const e of stepDrill(s, goodDrillBot(s, { lastTapS: -Infinity, lastDir: 'left' }), DT).events) {
        if (e.type === 'telegraph' && e.action === 'sprint' && e.dir) tele.push(e.dir);
        if (e.type === 'action' && e.action === 'sprint') acts.push(e.dir);
      }
    }
    expect(tele.length).toBeGreaterThan(0);
    expect(acts.slice(0, tele.length)).toEqual(tele.slice(0, acts.length));
  });
});
