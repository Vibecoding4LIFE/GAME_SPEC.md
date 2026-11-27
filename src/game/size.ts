// src/game/size.ts – Größenwurf, Länge, Gewicht und Größenklasse (D 1.10).
import type { Balancing } from '../data/balancing';
import type { Rng } from '../core/random';
import { SIZE_GRADES, type FishData, type SizeGrade } from '../data/types';
import { clamp } from './types';

/** Standardnormalverteilte Zahl (Box-Muller) aus dem seedbaren Zufall. */
export function normal(rng: Rng): number {
  const u1 = 1 - rng.next(); // (0, 1], damit log nie −∞ wird
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** x = clamp(Normal(μ + Bonus, σ), 0, 1). `muBonus` = Köder (Großköder) + Rute (Welt-Rute). */
export const rollSizeX = (b: Balancing, rng: Rng, muBonus = 0): number =>
  clamp(b.size.mu + muBonus + b.size.sigma * normal(rng), 0, 1);

/** Länge in cm aus x. */
export const lengthCm = (fish: Pick<FishData, 'lengthMinCm' | 'lengthMaxCm'>, x: number): number =>
  fish.lengthMinCm + x * (fish.lengthMaxCm - fish.lengthMinCm);

/** Gewicht in g = k × Länge³. */
export const weightG = (fish: Pick<FishData, 'weightFactorK'>, lenCm: number): number =>
  fish.weightFactorK * lenCm ** 3;

/** Größenklasse: erste Klasse mit x < upTo (die letzte Klasse nimmt alles bis einschließlich 1). */
export function sizeGrade(x: number, b: Balancing): SizeGrade {
  for (const g of SIZE_GRADES) if (x < b.size.grade[g].upTo) return g;
  return SIZE_GRADES[SIZE_GRADES.length - 1] as SizeGrade;
}

/** Punkte-/Verkaufsfaktor der Größenklasse. */
export const sizeFactor = (g: SizeGrade, b: Balancing): number => b.size.grade[g].factor;

export interface SizeRoll {
  x: number;
  lengthCm: number;
  weightG: number;
  grade: SizeGrade;
}

export function rollSize(fish: FishData, b: Balancing, rng: Rng, muBonus = 0): SizeRoll {
  const x = rollSizeX(b, rng, muBonus);
  const len = lengthCm(fish, x);
  return { x, lengthCm: len, weightG: weightG(fish, len), grade: sizeGrade(x, b) };
}
