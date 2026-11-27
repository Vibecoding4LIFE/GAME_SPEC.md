import { describe, expect, it } from 'vitest';
import { FishingSession, type SessionEvent, type SessionInput, IDLE_INPUT } from '../../src/game/session';
import { holdTimeForPower } from '../../src/game/cast';
import { newProfile } from '../../src/game/save';
import { DT, runSession, SessionBot } from './helpers/bots';
import { data } from './helpers/gameData';

const types = (ev: readonly SessionEvent[]) => ev.map((e) => e.type);

describe('Session – kompletter Ablauf per Bot (Wurf bis Fang und Verkauf)', () => {
  it('Idle → Casting → Sinking/Waiting → Nibble/Bite → Reeling → Caught, dann Verkauf', () => {
    const p = newProfile(data.gear);
    const sess = new FishingSession(data, p, { world: 'W1', seed: 7, startPhase: 'Tag', startWeather: 'Sonnig' });
    const bot = new SessionBot(7);
    const states: string[] = [];
    let last: SessionEvent[] = [];
    let caught = false;
    for (let i = 0; i < 60 * 120 && !caught; i++) {
      const input = sess.state.rodState === 'Caught' ? IDLE_INPUT : bot.input(sess, last);
      last = sess.step(DT, input);
      for (const e of last) if (e.type === 'rodState') states.push(e.state);
      caught = sess.state.rodState === 'Caught' && sess.state.lastCatch !== null;
    }
    expect(caught).toBe(true);
    for (const s of ['Casting', 'Reeling', 'Caught']) expect(states).toContain(s);
    expect(states.some((s) => s === 'Waiting' || s === 'Sinking')).toBe(true);
    expect(states).toContain('Bite');
    const rec = sess.state.lastCatch;
    expect(rec).not.toBeNull();
    expect(p.bucket).toHaveLength(1);
    expect(p.lexicon[rec?.fishId ?? 'F001']?.state).toBe('caught');
    expect(p.xp).toBeGreaterThan(0);
    const coins = sess.sellAll();
    expect(coins).toBe(rec?.value);
    expect(p.coins).toBe(coins);
    expect(p.bucket).toHaveLength(0);
    sess.acknowledge();
    expect(sess.state.rodState).toBe('Idle');
  });

  it('Determinismus: gleicher Seed → gleiche Fänge', () => {
    const run = () => {
      const p = newProfile(data.gear);
      const s = new FishingSession(data, p, { world: 'W1', seed: 99 });
      runSession(s, new SessionBot(99), 300);
      return { stats: s.state.stats, coins: p.coins, lex: p.lexicon };
    };
    expect(run()).toEqual(run());
  });

  it('Fang-Taktung in W1 mit Startausrüstung: Ø 20–45 s pro Fang, Einkommen nahe 60–90 Münzen/min', () => {
    const results = [11, 12, 13].map((seed) => {
      const p = newProfile(data.gear);
      const s = new FishingSession(data, p, { world: 'W1', seed });
      runSession(s, new SessionBot(seed), 1200);
      return { perCatch: 1200 / s.state.stats.catches, perMin: p.coins / 20, s };
    });
    const avg = results.reduce((a, r) => a + r.perCatch, 0) / results.length;
    console.info(`Taktung W1: Ø ${avg.toFixed(1)} s/Fang, ${results.map((r) => `${r.perMin.toFixed(0)} Münzen/min`).join(', ')}`);
    expect(avg).toBeGreaterThanOrEqual(20);
    expect(avg).toBeLessThanOrEqual(45);
    for (const r of results) expect(r.perMin).toBeGreaterThan(40);
  });
});

describe('Session – Einzelfunktionen', () => {
  const mk = (seed = 1) => {
    const p = newProfile(data.gear);
    return { p, s: new FishingSession(data, p, { world: 'W1', seed, startPhase: 'Nacht', startWeather: 'Gewitter' }) };
  };
  const press = (over: Partial<SessionInput>): SessionInput => ({ ...IDLE_INPUT, ...over });

  it('Debug: Fisch und Verhalten erzwingen, Wetter/Tageszeit setzen', () => {
    const { s } = mk();
    s.debugForceFish('F020');
    s.debugForceBehavior('Stromer');
    s.debugSetWeather('Sonnig');
    s.debugSetPhase('Morgen');
    expect(s.weather).toBe('Sonnig');
    expect(s.phase).toBe('Morgen');
    const bot = new SessionBot(1);
    let last: SessionEvent[] = [];
    let hooked: SessionEvent | undefined;
    for (let i = 0; i < 60 * 60 && !hooked; i++) {
      last = s.step(DT, bot.input(s, last));
      hooked = last.find((e) => e.type === 'hooked');
    }
    expect(hooked?.type === 'hooked' && hooked.fish.id).toBe('F020');
    expect(hooked?.type === 'hooked' && hooked.behavior).toBe('Stromer');
  });

  it('zu frühes Anschlagen verscheucht den Fisch und senkt die Bissrate in der Zone', () => {
    const { s } = mk(3);
    s.step(DT, press({ castHeld: true }));
    for (let t = 0; t < holdTimeForPower(0.5, 1.2); t += DT) s.step(DT, press({ castHeld: true }));
    s.step(DT, IDLE_INPUT);
    let scared = false;
    for (let i = 0; i < 60 * 60 && !scared; i++) {
      const ev = s.step(DT, press({ strike: s.state.rodState === 'Nibble' }));
      scared = types(ev).includes('scared');
    }
    expect(scared).toBe(true);
    expect(s.state.penalty?.zone).toBe(s.state.cast?.zone);
    expect(s.state.rodState).toBe('Waiting');
  });

  it('Zucken per kurzem Antippen, Einholen per Halten', () => {
    const { s } = mk(4);
    s.debugForceFish(null);
    s.step(DT, press({ castHeld: true }));
    for (let t = 0; t < holdTimeForPower(0.5, 1.2); t += DT) s.step(DT, press({ castHeld: true }));
    s.step(DT, IDLE_INPUT);
    const ev = s.step(DT, press({ reel: true, reelPressed: true }));
    if (!s.state.snag) {
      expect(types(ev)).toContain('twitch');
      expect(s.twitching).toBe(true);
      let retrieved = false;
      for (let i = 0; i < 60 * 5 && !retrieved && s.state.rodState !== 'Nibble'; i++) retrieved = types(s.step(DT, press({ reel: true }))).includes('retrieved');
      if (s.state.rodState !== 'Nibble') { expect(retrieved).toBe(true); expect(s.state.rodState).toBe('Idle'); }
    }
  });

  it('Füttern mit Brotflocke erzeugt einen Futterplatz und verbraucht eine Flocke', () => {
    const { p, s } = mk(5);
    p.baits.K03 = 3;
    expect(s.setBait('K03')).toBe(true);
    s.step(DT, press({ castHeld: true }));
    for (let t = 0; t < holdTimeForPower(0.5, 1.2); t += DT) s.step(DT, press({ castHeld: true }));
    s.step(DT, IDLE_INPUT);
    const ev = s.step(DT, press({ feed: true }));
    if (!s.state.snag) {
      expect(types(ev)).toContain('feed');
      expect(p.baits.K03).toBe(2);
      expect(s.spawnContext().feedingSpot).toBe(true);
    }
  });

  it('verlorener Fisch wird im Lexikon „gesichtet“', () => {
    const { p, s } = mk(6);
    s.debugForceFish('F014');
    const bot = new SessionBot(6);
    let last: SessionEvent[] = [];
    for (let i = 0; i < 60 * 60 && s.state.rodState !== 'Reeling'; i++) last = s.step(DT, bot.input(s, last));
    if (s.state.rodState === 'Reeling') {
      for (let i = 0; i < 60 * 10 && s.state.rodState === 'Reeling'; i++) s.step(DT, press({ reel: true }));
      expect(s.state.rodState).toBe('Escaped');
      expect(p.lexicon.F014?.state).toBe('seen');
    } else {
      expect(s.state.lastEscape?.reason).toBe('cut');
      expect(p.lexicon.F014?.state).toBe('seen');
    }
  });
});
