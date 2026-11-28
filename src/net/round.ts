// src/net/round.ts – Runden-State-Machine (B4), reine Logik ohne Phaser/DOM.
//
//   Lobby → Countdown (5 s) → Fishing (Dauer − Finale) → Finale (letzte 60 s, ×1,5)
//         → LastCast (keine neuen Würfe, gehakte Fische 5 s fertig drillen) → Results (15 s) → Lobby
//   Jede Phase → Aborted (Host weg). Aborted ist endgültig (→ Hafen; Revanche = neuer Raum mit neuem Host).
//
// Der Host hält den Zustand und schickt nur EINEN Zeitwert: `phaseEnd` (Host-Uhr in ms). Clients rechnen lokal
// mit ihrem Uhrzeit-Versatz (clockOffset.ts). Übergänge passieren zum geplanten Zeitpunkt, nicht zum Tick-Zeitpunkt:
// Ein gedrosselter Host-Tab, der 20 s später tickt, durchläuft alle fälligen Phasen in einem Aufruf, ohne dass sich
// der Plan verschiebt.

export const ROUND_PHASES = ['Lobby', 'Countdown', 'Fishing', 'Finale', 'LastCast', 'Results', 'Aborted'] as const;
export type RoundPhase = (typeof ROUND_PHASES)[number];

/** Phasendauern in Sekunden (aus NetConfig + Balancing, siehe `roundTimings`). */
export interface RoundTimings {
  countdownS: number;
  /** Gesamtdauer der Angelzeit inkl. Finale (3/5/8 min) */
  durationS: number;
  /** Finale = letzte n s der Angelzeit (`score.finale.lastS`) */
  finaleS: number;
  lastCastS: number;
  resultsS: number;
}

export interface RoundState {
  phase: RoundPhase;
  /** Ende der aktuellen Phase (Host-Uhr, ms); null in Lobby und Aborted */
  phaseEnd: number | null;
  /** laufende Rundennummer (1 = erste Runde im Raum) */
  round: number;
  /** Beginn der Angelzeit (ms) der aktuellen Runde */
  fishingStart: number | null;
  /** Ende der Angelzeit = Ende des Finales (ms) */
  fishingEnd: number | null;
  timings: RoundTimings | null;
  /** Phase vor dem Abbruch (Anzeige „letzter Stand“) */
  abortedFrom: RoundPhase | null;
}

export interface PhaseChange { from: RoundPhase; to: RoundPhase; at: number }
export interface RoundStep { state: RoundState; changes: PhaseChange[] }

export function validateTimings(t: RoundTimings): void {
  for (const [k, v] of Object.entries(t)) if (!Number.isFinite(v) || v < 0) throw new Error(`RoundTimings.${k} ungültig: ${v}`);
  if (t.durationS <= 0) throw new Error('RoundTimings.durationS muss > 0 sein');
  if (t.finaleS > t.durationS) throw new Error('Finale länger als die Runde');
}

export const createRound = (): RoundState => ({
  phase: 'Lobby', phaseEnd: null, round: 0, fishingStart: null, fishingEnd: null, timings: null, abortedFrom: null,
});

const ms = (s: number): number => Math.round(s * 1000);

/** Lobby → Countdown. Ungültig in anderen Phasen (state bleibt gleich, changes leer). */
export function startCountdown(s: RoundState, now: number, timings: RoundTimings): RoundStep {
  if (s.phase !== 'Lobby') return { state: s, changes: [] };
  validateTimings(timings);
  const phaseEnd = now + ms(timings.countdownS);
  const fishingStart = phaseEnd;
  const fishingEnd = fishingStart + ms(timings.durationS);
  const state: RoundState = { ...s, phase: 'Countdown', phaseEnd, round: s.round + 1, fishingStart, fishingEnd, timings, abortedFrom: null };
  return { state, changes: [{ from: 'Lobby', to: 'Countdown', at: now }] };
}

/** Countdown → Lobby (jemand ist nicht mehr bereit). Die Rundennummer wird zurückgenommen. */
export function cancelCountdown(s: RoundState, now: number): RoundStep {
  if (s.phase !== 'Countdown') return { state: s, changes: [] };
  return {
    state: { ...s, phase: 'Lobby', phaseEnd: null, round: s.round - 1, fishingStart: null, fishingEnd: null, timings: null },
    changes: [{ from: 'Countdown', to: 'Lobby', at: now }],
  };
}

/** Jede Phase → Aborted (Host weg). Aborted bleibt Aborted. */
export function abortRound(s: RoundState, now: number): RoundStep {
  if (s.phase === 'Aborted') return { state: s, changes: [] };
  return { state: { ...s, phase: 'Aborted', phaseEnd: null, abortedFrom: s.phase }, changes: [{ from: s.phase, to: 'Aborted', at: now }] };
}

/** Nächste Phase nach Ablauf von `phaseEnd` und deren Ende. */
function nextPhase(s: RoundState): { phase: RoundPhase; phaseEnd: number | null } {
  const t = s.timings as RoundTimings;
  const end = s.phaseEnd as number;
  switch (s.phase) {
    case 'Countdown': {
      // Finale direkt, falls die Runde nur aus Finale besteht
      const finaleStart = (s.fishingEnd as number) - ms(t.finaleS);
      return finaleStart > end ? { phase: 'Fishing', phaseEnd: finaleStart } : { phase: 'Finale', phaseEnd: s.fishingEnd };
    }
    case 'Fishing': return { phase: 'Finale', phaseEnd: s.fishingEnd };
    case 'Finale': return { phase: 'LastCast', phaseEnd: end + ms(t.lastCastS) };
    case 'LastCast': return { phase: 'Results', phaseEnd: end + ms(t.resultsS) };
    case 'Results': return { phase: 'Lobby', phaseEnd: null };
    default: return { phase: s.phase, phaseEnd: s.phaseEnd };
  }
}

/** Zeit fortschreiben: alle fälligen Übergänge (auch mehrere auf einmal). */
export function tickRound(s: RoundState, now: number): RoundStep {
  const changes: PhaseChange[] = [];
  let st = s;
  let guard = 0;
  while (st.phaseEnd !== null && now >= st.phaseEnd && st.phase !== 'Lobby' && st.phase !== 'Aborted' && guard++ < ROUND_PHASES.length) {
    const at = st.phaseEnd;
    const n = nextPhase(st);
    changes.push({ from: st.phase, to: n.phase, at });
    st = n.phase === 'Lobby'
      ? { ...st, phase: 'Lobby', phaseEnd: null, fishingStart: null, fishingEnd: null, timings: null }
      : { ...st, phase: n.phase, phaseEnd: n.phaseEnd };
  }
  return { state: st, changes };
}

// ------------------------------------------------------------------ Abfragen

/** Würfe erlaubt (B4: in LastCast keine neuen Würfe). */
export const canCast = (p: RoundPhase): boolean => p === 'Fishing' || p === 'Finale';
/** Drill darf weiterlaufen / Fang zählt. */
export const canReel = (p: RoundPhase): boolean => p === 'Fishing' || p === 'Finale' || p === 'LastCast';
/** Raum gesperrt: nach dem Start lehnt der Host neue Spieler ab (B4). Start = Countdown. */
export const isLocked = (p: RoundPhase): boolean => p !== 'Lobby';
/** Runde läuft (Punkte können sich ändern). */
export const isRunning = (p: RoundPhase): boolean => p === 'Countdown' || canReel(p);

/** Finale-Faktor gilt (D 2.2: Fänge in den letzten 60 s). Auch Fänge in LastCast wurden im Finale gehakt → ×1,5. */
export const finaleActive = (p: RoundPhase): boolean => p === 'Finale' || p === 'LastCast';

/** Verbleibende Angelzeit (s) bis zum Ende des Finales; 0 außerhalb. */
export function fishingRemainingS(s: RoundState, now: number): number {
  if (s.fishingEnd === null || (s.phase !== 'Fishing' && s.phase !== 'Finale' && s.phase !== 'Countdown')) return 0;
  return Math.max(0, (s.fishingEnd - Math.max(now, s.fishingStart ?? now)) / 1000);
}

/** Verdeckte Punkte (D 2.5): die letzten `hiddenS` der Angelzeit und LastCast; in Results wieder sichtbar. */
export function scoresHidden(s: RoundState, now: number, hiddenS: number): boolean {
  if (hiddenS <= 0) return false;
  if (s.phase === 'LastCast') return true;
  if (s.phase !== 'Fishing' && s.phase !== 'Finale') return false;
  return s.fishingEnd !== null && s.fishingEnd - now <= ms(hiddenS);
}

/**
 * Client-Seite: Rundenstand aus einer `phaseEnd`-Nachricht übernehmen (der Host ist die Autorität).
 * Aborted ist endgültig; ältere Nachrichten (kleinere Runde) werden ignoriert.
 */
export function applyRemotePhase(
  s: RoundState, msg: { phase: RoundPhase; ende: number | null; runde: number; angelEnde: number | null },
): RoundStep {
  if (s.phase === 'Aborted' || msg.runde < s.round) return { state: s, changes: [] };
  if (msg.phase === s.phase && msg.ende === s.phaseEnd && msg.runde === s.round) return { state: s, changes: [] };
  const state: RoundState = { ...s, phase: msg.phase, phaseEnd: msg.ende, round: msg.runde, fishingEnd: msg.angelEnde };
  return { state, changes: msg.phase === s.phase ? [] : [{ from: s.phase, to: msg.phase, at: msg.ende ?? 0 }] };
}
