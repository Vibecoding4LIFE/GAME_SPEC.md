// src/game/depth.ts – Ködertiefe (D 1.4): Sinken/Stoppen, Sinkgeschwindigkeit, Schnurkapazität, Zucken.
import type { Balancing } from '../data/balancing';
import type { BaitData, ReelData } from '../data/types';
import { clamp, type WorldDbEntry } from './types';

/** Die Tiefseewinde wirkt nur in der Welt mit Druck-Mechanik (W4), sonst gilt ihre Ersatz-Kapazität. */
const winchActive = (reel: ReelData, world: WorldDbEntry): boolean =>
  reel.isDeepSeaWinch && world.mechanik === 'DunkelheitUndDruck';

/** Schnurkapazität der Rolle in dieser Welt (= max. erreichbare Tiefe). */
export const lineCapacityM = (reel: ReelData, world: WorldDbEntry): number =>
  reel.isDeepSeaWinch && !winchActive(reel, world) ? reel.fallbackCapacityM : reel.lineCapacityM;

/** Tiefste erreichbare Stelle: Grund der Welt oder Ende der Schnur. */
export const depthLimitM = (reel: ReelData, world: WorldDbEntry): number =>
  Math.min(world.maxTiefeM, lineCapacityM(reel, world));

/** Sinkgeschwindigkeit in m/s (Köder, in W4 plus Abstieg der Tiefseewinde). */
export const sinkSpeedMs = (bait: BaitData, reel: ReelData, world: WorldDbEntry): number =>
  bait.sinkSpeedMs + (winchActive(reel, world) ? reel.descentSpeedMs : 0);

export interface SinkResult {
  depthM: number;
  /** Köder steht am Grund oder am Schnurende. */
  atLimit: boolean;
  /** Spieler will tiefer, aber die Schnur reicht nicht bis zum Grund („Schnur zu kurz!“). */
  lineTooShort: boolean;
}

/** Ein Zeitschritt Sinken (nur solange „Sinken“ gehalten wird). */
export function sinkStep(depthM: number, dt: number, bait: BaitData, reel: ReelData, world: WorldDbEntry): SinkResult {
  const limit = depthLimitM(reel, world);
  const next = Math.min(limit, depthM + sinkSpeedMs(bait, reel, world) * dt);
  const atLimit = next >= limit;
  return { depthM: next, atLimit, lineTooShort: atLimit && limit < world.maxTiefeM };
}

/** Zucken: der Köder steigt um `depth.twitch.liftM`. */
export const twitchDepth = (depthM: number, b: Balancing): number => Math.max(0, depthM - b.depth.twitch.liftM);

/** Name der Tiefenschicht (worlds.json `schichten`) oder null. */
export function layerAt(world: WorldDbEntry, depthM: number): string | null {
  const d = clamp(depthM, 0, world.maxTiefeM);
  const l = world.schichten.find((s) => d >= s.minM && d <= s.maxM);
  return l ? l.name : null;
}
