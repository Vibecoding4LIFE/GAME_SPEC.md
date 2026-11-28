// src/net/results.ts – Wettkampf-Wertung (D 2.2 A, 2.5, 2.6): Rückenwind, Platzierung mit Gleichstand-Regel,
// Rundenbelohnung, Sonderauszeichnungen. Reine Funktionen; alle Zahlen aus dem Balancing.
import type { Balancing } from '../data/balancing';
import type { FishId } from '../data/types';
import type { Award, PlayerId } from './messages';

export type TailwindLevel = 0 | 1 | 2;

/** Rückenwind (D 2.5): mehr als 25 % hinter dem Ersten → Stufe 1, ab 50 % → Stufe 2. */
export function tailwindLevel(points: number, leaderPoints: number, b: Balancing): TailwindLevel {
  if (leaderPoints <= 0 || points >= leaderPoints) return 0;
  const behind = (leaderPoints - points) / leaderPoints;
  const t = b.catchup.tailwind;
  if (behind >= t.behind2) return 2;
  if (behind > t.behind1) return 1;
  return 0;
}

/** Bissraten-Bonus und Zupfer-Abzug je Stufe. */
export function tailwindEffect(level: TailwindLevel, b: Balancing): { biteRate: number; nibbleReduction: number } {
  const t = b.catchup.tailwind;
  if (level === 0) return { biteRate: 0, nibbleReduction: 0 };
  return { biteRate: level === 2 ? t.bonus2 : t.bonus1, nibbleReduction: t.nibbleReduction };
}

export interface TallyCatch { fishId: FishId; weightG: number; points: number; masterDrill: boolean }

/** Rundenbilanz eines Spielers (Host). */
export interface PlayerTally {
  id: PlayerId;
  points: number;
  catches: readonly TallyCatch[];
  /** Schnurrisse (inkl. Hitze) – „Pechvogel“ */
  lineBreaks: number;
  /** Schabernack-Treffer (Phase 4; bis dahin 0) */
  itemHits: number;
  guest: boolean;
}

export const heaviestG = (t: PlayerTally): number => t.catches.reduce((m, c) => Math.max(m, c.weightG), 0);
export const speciesCount = (t: PlayerTally): number => new Set(t.catches.map((c) => c.fishId)).size;
export const masterDrills = (t: PlayerTally): number => t.catches.filter((c) => c.masterDrill).length;

/**
 * Platzierung (D 2.2 A): meiste Punkte; bei Gleichstand der schwerere Einzelfang. Wer in beidem gleich ist, teilt
 * den Platz (Plätze danach rücken wie im Sport: 1, 1, 3). Reihenfolge innerhalb eines Platzes nach ID (stabil).
 */
export function rankPlayers(tallies: readonly PlayerTally[]): { id: PlayerId; place: number }[] {
  const sorted = [...tallies].sort((a, b) =>
    b.points - a.points || heaviestG(b) - heaviestG(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: { id: PlayerId; place: number }[] = [];
  sorted.forEach((t, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.points === t.points && heaviestG(prev) === heaviestG(t);
    out.push({ id: t.id, place: tied ? (out[i - 1] as { place: number }).place : i + 1 });
  });
  return out;
}

/** Platzbasis (D 2.6); ab Platz 4 gilt der Wert für Platz 4. */
export function placeBase(place: number, b: Balancing): number {
  const p = b.reward.placeBase;
  return [p.first, p.second, p.third][place - 1] ?? p.fourth;
}

/** Belohnung = Weltfaktor × Platzbasis + 10 % der eigenen Rundenpunkte (D 2.6), gerundet. */
export const roundReward = (place: number, points: number, worldFactor: number, b: Balancing): number =>
  Math.round(worldFactor * placeBase(place, b) + b.reward.pointsShare * points);

/**
 * Sonderauszeichnungen (D 2.5), je +`catchup.specialAwardCoins`. Vergeben nur bei Wert > 0; bei Gleichstand
 * bekommen alle Gleichauf die Auszeichnung (eigene Wahl, Spec sagt nichts).
 */
export function specialAwards(tallies: readonly PlayerTally[]): Map<PlayerId, Award[]> {
  const out = new Map<PlayerId, Award[]>(tallies.map((t) => [t.id, []]));
  const give = (award: Award, value: (t: PlayerTally) => number) => {
    const best = Math.max(0, ...tallies.map(value));
    if (best <= 0) return;
    for (const t of tallies) if (value(t) === best) out.get(t.id)?.push(award);
  };
  give('SchwersterBrocken', heaviestG);
  give('Sammler', speciesCount);
  give('Meisterdrill', masterDrills);
  give('Pechvogel', (t) => t.lineBreaks);
  give('SchabernackKoenig', (t) => t.itemHits);
  return out;
}

export interface PlayerResult {
  id: PlayerId;
  place: number;
  points: number;
  catches: number;
  species: number;
  heaviestG: number;
  coins: number;
  awards: Award[];
  xp: number;
}

/** Komplette Rundenauswertung. `worldFactor` = worlds.json `muenzfaktor` (W1 1,0 … W5 3,2). */
export function roundResults(tallies: readonly PlayerTally[], worldFactor: number, b: Balancing): PlayerResult[] {
  const ranks = rankPlayers(tallies);
  const awards = specialAwards(tallies);
  return ranks.map(({ id, place }) => {
    const t = tallies.find((x) => x.id === id) as PlayerTally;
    const aw = awards.get(id) ?? [];
    return {
      id, place, points: t.points, catches: t.catches.length, species: speciesCount(t), heaviestG: heaviestG(t),
      coins: roundReward(place, t.points, worldFactor, b) + aw.length * b.catchup.specialAwardCoins,
      awards: aw,
      xp: b.xp.roundPlayed + (place === 1 && tallies.length > 1 ? b.xp.roundWon : 0),
    };
  });
}
