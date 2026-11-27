// src/game/pending.ts – Regeln/Zahlen aus GAME_SPEC.md, die (noch) in keiner CSV stehen.
// Teil I Nr. 4 verlangt „Daten statt Code“. Diese Datei ist die EINZIGE Stelle in src/game, an der solche Werte stehen.
// Jeder Eintrag nennt die Spec-Stelle und den vorgeschlagenen Ort in Data/*.csv. Sobald der daten-designer die Spalte
// bzw. den balancing-Schlüssel anlegt, wird der Eintrag hier gelöscht und die Logik liest die Daten.
import type { WorldEvent } from '../data/types';
import type { ActiveWeather, DayPhase } from './types';

export const PENDING_DATA = {
  /** D 1.12 „★★ 5× gefangen“ → vorgeschlagen `balancing.csv: lexicon.twoStarCatches;5`. */
  lexiconTwoStarCatches: 5,
  /** Teil E W1 „Mückenschwarm am Abend“ → vorgeschlagen `events.csv` Spalte `zeit` (TimeOfDay-Flags). */
  eventAllowedTimes: { Mueckenschwarm: ['Abend'] } as Partial<Record<WorldEvent, readonly DayPhase[]>>,
  /**
   * Teil E W1 „Sommergewitter: Barnabas-Bedingung“ – das Ereignis ist an das Wetter Gewitter gekoppelt
   * (entscheidungen.md, Unstimmigkeit 6) → vorgeschlagen `events.csv` Spalte `wetter`.
   */
  eventFromWeather: { Sommergewitter: 'Gewitter' } as Partial<Record<WorldEvent, ActiveWeather>>,
} as const;
