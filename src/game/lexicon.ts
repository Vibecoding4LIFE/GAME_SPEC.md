// src/game/lexicon.ts – Fischlexikon (D 1.12): unbekannt → gesichtet → gefangen, Anzahl, Rekorde, Sterne, Weltfortschritt.
// Zustandswerte wie in src/ui/types.ts (`LexiconEntryState`), damit die Overlays den Spielstand direkt anzeigen können.
import { SIZE_GRADES, type FishId, type SizeGrade } from '../data/types';
import { PENDING_DATA } from './pending';

export type LexiconState = 'unknown' | 'seen' | 'caught';

export interface LexiconEntry {
  state: LexiconState;
  count: number;
  recordLengthCm?: number;
  recordWeightG?: number;
  /** größte je gefangene Größenklasse */
  bestTier?: SizeGrade;
  /** mindestens einmal schillernd gefangen */
  shiny?: boolean;
  shinyCount?: number;
}

export type Lexicon = Partial<Record<FishId, LexiconEntry>>;

const gradeRank = (g: SizeGrade | undefined): number => (g ? SIZE_GRADES.indexOf(g) : -1);

/** „Gesichtet“ (im Drill verloren). Gefangene Arten bleiben gefangen. */
export function markSeen(lex: Lexicon, id: FishId): boolean {
  const e = lex[id];
  if (e && e.state !== 'unknown') return false;
  lex[id] = { ...(e ?? { count: 0 }), state: 'seen', count: e?.count ?? 0 };
  return true;
}

export interface CatchForLexicon { fishId: FishId; lengthCm: number; weightG: number; grade: SizeGrade; shiny: boolean }

/** Fang eintragen. Rückgabe: neue Art? neuer Längen- oder Gewichtsrekord? */
export function recordCatch(lex: Lexicon, c: CatchForLexicon): { isNew: boolean; isRecord: boolean } {
  const e = lex[c.fishId];
  const isNew = !e || e.state !== 'caught';
  const isRecord = !isNew && ((e?.recordLengthCm ?? 0) < c.lengthCm || (e?.recordWeightG ?? 0) < c.weightG);
  lex[c.fishId] = {
    state: 'caught',
    count: (e?.count ?? 0) + 1,
    recordLengthCm: Math.max(e?.recordLengthCm ?? 0, c.lengthCm),
    recordWeightG: Math.max(e?.recordWeightG ?? 0, c.weightG),
    bestTier: gradeRank(c.grade) > gradeRank(e?.bestTier) ? c.grade : e?.bestTier ?? c.grade,
    shiny: (e?.shiny ?? false) || c.shiny,
    shinyCount: (e?.shinyCount ?? 0) + (c.shiny ? 1 : 0),
  };
  return { isNew, isRecord };
}

/** ★ gefangen · ★★ n× gefangen oder einmal Kapital (oder größer) · ★★★ Riesig oder Schillernd. */
export function starsFor(e: LexiconEntry | undefined): 0 | 1 | 2 | 3 {
  if (!e || e.state !== 'caught' || e.count < 1) return 0;
  if (e.bestTier === 'Riesig' || e.shiny) return 3;
  if (e.count >= PENDING_DATA.lexiconTwoStarCatches || gradeRank(e.bestTier) >= gradeRank('Kapital')) return 2;
  return 1;
}

/** Weltfortschritt: gefangene und gesichtete Arten einer Fischliste. */
export function worldProgress(lex: Lexicon, fishIds: readonly FishId[]): { caught: number; seen: number; total: number } {
  let caught = 0;
  let seen = 0;
  for (const id of fishIds) {
    const s = lex[id]?.state;
    if (s === 'caught') caught++;
    else if (s === 'seen') seen++;
  }
  return { caught, seen, total: fishIds.length };
}
