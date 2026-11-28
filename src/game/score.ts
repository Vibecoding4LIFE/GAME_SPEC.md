// src/game/score.ts – Punkteformel (D 2.3), Verkaufswert (D 3.2), Ruf/XP und Stufen (D 3.1).
import type { Balancing } from '../data/balancing';
import type { FishData, SizeGrade } from '../data/types';
import { sizeFactor } from './size';

/** Q = 1 + Meisterdrill + Perfekter Wurf + Perfekter Anschlag. */
export function qualityFactor(q: { masterDrill: boolean; perfectCast: boolean; perfectStrike: boolean }, b: Balancing): number {
  const s = b.score.quality;
  return 1 + (q.masterDrill ? s.masterDrill : 0) + (q.perfectCast ? s.perfectCast : 0) + (q.perfectStrike ? s.perfectStrike : 0);
}

/** V nach dem wievielten Fang dieser Art in der Runde (1-basiert, inkl. dieses Fangs). */
export function varietyFactor(nth: number, b: Balancing): number {
  const v = b.score.variety;
  const order = [v.first, v.second, v.third];
  return order[nth - 1] ?? v.later;
}

export interface ScoreInput {
  basePoints: number;
  grade: SizeGrade;
  shiny: boolean;
  masterDrill: boolean;
  perfectCast: boolean;
  perfectStrike: boolean;
  /** wievielter Fang dieser Art in der Runde (1 = erster) */
  nthOfSpecies: number;
  finale: boolean;
  /** Wettkampf: Schillernd-Bonus gedeckelt (`shiny.competitionBonusCap`) */
  competition: boolean;
}

/** Punkte = runden(B × G × S × Q × V × F); im Wettkampf ist der Schillernd-Bonus auf +cap gedeckelt. */
export function scorePoints(i: ScoreInput, b: Balancing): number {
  const F = i.finale ? b.score.finale.multiplier : 1;
  const raw = i.basePoints * sizeFactor(i.grade, b) * qualityFactor(i, b) * varietyFactor(i.nthOfSpecies, b) * F;
  if (!i.shiny) return Math.round(raw);
  const bonus = raw * (b.shiny.pointsMultiplier - 1);
  return Math.round(raw + (i.competition ? Math.min(bonus, b.shiny.competitionBonusCap) : bonus));
}

/** Verkaufspreis = Basispunkte × baseFactor × Größenfaktor (Schillernd ×shinyMultiplier), gerundet. */
export const sellValue = (basePoints: number, grade: SizeGrade, shiny: boolean, b: Balancing): number =>
  Math.round(basePoints * b.sell.baseFactor * sizeFactor(grade, b) * (shiny ? b.sell.shinyMultiplier : 1));

/** Ruf je Fang (neue Art × newSpeciesMultiplier). `xpOverride` ≥ 0 ersetzt den Seltenheitswert. */
export function catchXp(fish: Pick<FishData, 'rarity' | 'xpOverride'>, isNewSpecies: boolean, b: Balancing): number {
  const base = fish.xpOverride >= 0 ? fish.xpOverride : b.xp.catch[fish.rarity];
  return base * (isNewSpecies ? b.xp.newSpeciesMultiplier : 1);
}

/**
 * Gesamt-XP, ab der Stufe `level` erreicht ist. Auslegung von D 3.1 „Stufe n braucht base × n^exp XP“:
 * kumulativ, Stufe 1 ab 0 XP, Stufe n+1 ab base × n^exp.
 */
export const xpForLevel = (level: number, b: Balancing): number =>
  level <= 1 ? 0 : b.xp.level.base * (level - 1) ** b.xp.level.exponent;

/** Ruf-Stufe zu einer XP-Summe (1 … xp.level.max). */
export function levelForXp(xp: number, b: Balancing): number {
  let lvl = 1;
  while (lvl < b.xp.level.max && xp >= xpForLevel(lvl + 1, b)) lvl++;
  return lvl;
}
