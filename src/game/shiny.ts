// src/game/shiny.ts – Schillernd-Chance (D 1.11).
import type { Balancing } from '../data/balancing';
import type { Rng } from '../core/random';
import type { BaitData, RodData, WorldId } from '../data/types';
import { rodAbilityValue, worksInWorld } from './types';

export interface ShinyContext {
  b: Balancing;
  world: WorldId;
  bait: BaitData;
  rod: RodData;
  /** vollständiges Weltabzeichen dieser Welt (D 3.5) */
  hasWorldBadge: boolean;
}

/**
 * Chance je Fang: 1 : baseOneIn; Weltabzeichen 1 : badgeOneIn; Goldene Rute (`SchillerndGlobal`, Wert = 1 : n) wie ein
 * Abzeichen in jeder Welt. Der Köder-Multiplikator (Glücksköder ×2) wirkt multiplikativ, Grenze 1 : capOneIn.
 */
export function shinyChance({ b, world, bait, rod, hasWorldBadge }: ShinyContext): number {
  let oneIn = b.shiny.baseOneIn;
  if (hasWorldBadge) oneIn = Math.min(oneIn, b.shiny.badgeOneIn);
  const global = rodAbilityValue(rod, 'SchillerndGlobal', world);
  if (global !== null) oneIn = Math.min(oneIn, global);
  const mult = worksInWorld(bait.worlds, world) ? bait.shinyMultiplier : 1;
  return Math.min(mult / oneIn, 1 / b.shiny.capOneIn);
}

export const rollShiny = (chance: number, rng: Rng): boolean => rng.next() < chance;
