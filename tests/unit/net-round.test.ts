// Runden-State-Machine (B4): alle Übergänge, Aborted aus jeder Phase, verspäteter Tick, Abfragen.
import { describe, expect, it } from 'vitest';
import {
  ROUND_PHASES, abortRound, applyRemotePhase, canCast, canReel, cancelCountdown, createRound, finaleActive,
  fishingRemainingS, isLocked, scoresHidden, startCountdown, tickRound, type RoundState, type RoundTimings,
} from '../../src/net/round';

const T: RoundTimings = { countdownS: 5, durationS: 300, finaleS: 60, lastCastS: 5, resultsS: 15 };
const s = 1000;

function startAt(now = 0): RoundState { return startCountdown(createRound(), now, T).state; }

describe('Runden-State-Machine', () => {
  it('durchläuft Lobby → Countdown → Fishing → Finale → LastCast → Results → Lobby zu den geplanten Zeiten', () => {
    let st = createRound();
    expect(st.phase).toBe('Lobby');
    const c = startCountdown(st, 1000, T);
    st = c.state;
    expect(c.changes).toEqual([{ from: 'Lobby', to: 'Countdown', at: 1000 }]);
    expect(st).toMatchObject({ phase: 'Countdown', phaseEnd: 6000, round: 1, fishingStart: 6000, fishingEnd: 306000 });
    const seen: string[] = [];
    const ends: (number | null)[] = [];
    for (let now = 1000; now <= 400000; now += 50) {
      const r = tickRound(st, now);
      for (const ch of r.changes) { seen.push(`${ch.from}>${ch.to}@${ch.at}`); ends.push(r.state.phaseEnd); }
      st = r.state;
    }
    expect(seen).toEqual([
      'Countdown>Fishing@6000', 'Fishing>Finale@246000', 'Finale>LastCast@306000', 'LastCast>Results@311000', 'Results>Lobby@326000',
    ]);
    expect(ends).toEqual([246000, 306000, 311000, 326000, null]);
    expect(st.phase).toBe('Lobby');
    expect(st.round).toBe(1);
    expect(startCountdown(st, 500000, T).state.round).toBe(2);
  });

  it('ein verspäteter Tick (gedrosselter Tab) durchläuft alle fälligen Phasen, ohne den Plan zu verschieben', () => {
    const r = tickRound(startAt(0), 309999);
    expect(r.changes.map((c) => `${c.to}@${c.at}`)).toEqual(['Fishing@5000', 'Finale@245000', 'LastCast@305000']);
    expect(r.state).toMatchObject({ phase: 'LastCast', phaseEnd: 310000 });
    // genau auf phaseEnd: Übergang passiert
    expect(tickRound(r.state, 310000).state.phase).toBe('Results');
  });

  it.each(ROUND_PHASES.filter((p) => p !== 'Aborted'))('%s → Aborted bei Host-Verlust; Aborted bleibt endgültig', (phase) => {
    let st: RoundState = createRound();
    if (phase !== 'Lobby') {
      st = startAt(0);
      const at: Record<string, number> = { Countdown: 1, Fishing: 6 * s, Finale: 250 * s, LastCast: 306 * s, Results: 311 * s };
      st = tickRound(st, at[phase] as number).state;
    }
    expect(st.phase).toBe(phase);
    const a = abortRound(st, 999);
    expect(a.state.phase).toBe('Aborted');
    expect(a.state.abortedFrom).toBe(phase);
    expect(a.state.phaseEnd).toBeNull();
    expect(a.changes).toEqual([{ from: phase, to: 'Aborted', at: 999 }]);
    expect(tickRound(a.state, 10 ** 9).changes).toEqual([]);
    expect(abortRound(a.state, 1).changes).toEqual([]);
    expect(startCountdown(a.state, 1, T).state.phase).toBe('Aborted');
    expect(applyRemotePhase(a.state, { phase: 'Fishing', ende: 1, runde: 9, angelEnde: 2 }).state.phase).toBe('Aborted');
  });

  it('Countdown lässt sich abbrechen (jemand nicht mehr bereit), andere Phasen nicht', () => {
    const c = cancelCountdown(startAt(0), 100);
    expect(c.state).toMatchObject({ phase: 'Lobby', round: 0, phaseEnd: null });
    const fishing = tickRound(startAt(0), 6000).state;
    expect(cancelCountdown(fishing, 7000).changes).toEqual([]);
    expect(startCountdown(fishing, 7000, T).changes).toEqual([]);
  });

  it('Runde nur aus Finale (Dauer = Finale) springt direkt ins Finale', () => {
    const st = startCountdown(createRound(), 0, { ...T, durationS: 60 }).state;
    const r = tickRound(st, 5000);
    expect(r.changes.map((c) => c.to)).toEqual(['Finale']);
    expect(() => startCountdown(createRound(), 0, { ...T, durationS: 30 })).toThrow();
  });

  it('Abfragen: Würfe, Drill, Sperre, Finale, verdeckte Punkte, Restzeit', () => {
    expect(ROUND_PHASES.filter(canCast)).toEqual(['Fishing', 'Finale']);
    expect(ROUND_PHASES.filter(canReel)).toEqual(['Fishing', 'Finale', 'LastCast']);
    expect(ROUND_PHASES.filter((p) => !isLocked(p))).toEqual(['Lobby']);
    expect(ROUND_PHASES.filter(finaleActive)).toEqual(['Finale', 'LastCast']);
    let st = tickRound(startAt(0), 100 * s).state;
    expect(fishingRemainingS(st, 100 * s)).toBe(205);
    expect(scoresHidden(st, 100 * s, 30)).toBe(false);
    st = tickRound(st, 275 * s).state;
    expect(st.phase).toBe('Finale');
    expect(scoresHidden(st, 274.9 * s, 30)).toBe(false);
    expect(scoresHidden(st, 275 * s, 30)).toBe(true);
    st = tickRound(st, 306 * s).state;
    expect(scoresHidden(st, 306 * s, 30)).toBe(true);
    st = tickRound(st, 311 * s).state;
    expect(st.phase).toBe('Results');
    expect(scoresHidden(st, 311 * s, 30)).toBe(false);
  });

  it('Client übernimmt den Host-Stand und ignoriert alte Runden', () => {
    let st = createRound();
    st = applyRemotePhase(st, { phase: 'Fishing', ende: 50, runde: 2, angelEnde: 100 }).state;
    expect(st).toMatchObject({ phase: 'Fishing', round: 2, phaseEnd: 50, fishingEnd: 100 });
    expect(applyRemotePhase(st, { phase: 'Lobby', ende: null, runde: 1, angelEnde: null }).state).toBe(st);
  });
});
