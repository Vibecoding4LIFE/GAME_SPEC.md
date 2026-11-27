// src/game/types.ts – gemeinsame Typen und kleine Helfer der reinen Spiellogik.
// Kein Phaser, keine Browser- oder Node-APIs (läuft im Host-Browser, in Tests und in Edge Functions, B4).
import type { Balancing } from '../data/balancing';
import type { GearDb } from '../data/gear';
import type { WorldDbEntry } from '../data/schema';
import {
  RARITIES, TIMES_OF_DAY,
  type AccessoryData, type AccessoryEffect, type BaitData, type FishData, type HorizontalZone, type LineData,
  type LineProtection, type Rarity, type ReelData, type RodAbility, type RodData, type TimeOfDay, type Weather, type WorldId,
} from '../data/types';

/** Tageszeit-Phasen in Reihenfolge (Morgen → Tag → Abend → Nacht), ohne das Flag „Immer“. */
export type DayPhase = Exclude<TimeOfDay, 'Immer'>;
export const DAY_PHASES = TIMES_OF_DAY.filter((t): t is DayPhase => t !== 'Immer');

/** Horizontale Zone eines Wurfs (ohne das Flag „Alle“). */
export type Zone = Exclude<HorizontalZone, 'Alle'>;

/** Ein tatsächlich herrschendes Wetter (ohne das Flag „Alle“). */
export type ActiveWeather = Exclude<Weather, 'Alle'>;

/** Alle geladenen Spieldaten (aus public/data/*.json über die Lader in src/data). */
export interface GameData {
  fish: readonly FishData[];
  worlds: readonly WorldDbEntry[];
  gear: GearDb;
  balancing: Balancing;
}

/** Angelegte Ausrüstung. `leader` = Stahlvorfach (Aufsatz zusätzlich zur Schnur) oder null. */
export interface Loadout {
  rod: RodData;
  line: LineData;
  leader: LineData | null;
  reel: ReelData;
  bait: BaitData;
  accessories: readonly AccessoryData[];
}

export type { WorldDbEntry };

/** Rang einer Seltenheit (Gewöhnlich = 0 … Legendär = 4). */
export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);

/** Gilt ein Teil mit Welt-Liste in dieser Welt? Leere Liste = überall. */
export const worksInWorld = (worlds: readonly WorldId[], world: WorldId): boolean =>
  worlds.length === 0 || worlds.includes(world);

/** Wert einer Ruten-Fähigkeit in dieser Welt oder null (fehlt bzw. auf andere Welt begrenzt). */
export function rodAbilityValue(rod: RodData, ability: RodAbility, world: WorldId): number | null {
  if (rod.abilityWorld !== null && rod.abilityWorld !== world) return null;
  const a = rod.abilities.find((x) => x.ability === ability);
  return a ? a.value : null;
}

/** Größen-μ-Bonus der Rute (Welt-Ruten nur in ihrer Welt). */
export const rodSizeMuBonus = (rod: RodData, world: WorldId): number =>
  rod.abilityWorld !== null && rod.abilityWorld !== world ? 0 : rod.sizeMuBonus;

/** Schützt Schnur oder Vorfach vor Kälte / Druck / Hitze? */
export const lineProtects = (l: Pick<Loadout, 'line' | 'leader'>, p: LineProtection): boolean =>
  l.line.protection.includes(p) || (l.leader?.protection.includes(p) ?? false);

/** Schützt Schnur oder Vorfach vor dem Abbiss durch Zahnfische? */
export const toothProtected = (l: Pick<Loadout, 'line' | 'leader'>): boolean =>
  l.line.protectsToothed || (l.leader?.protectsToothed ?? false);

/** Höchster Wert eines Zubehör-Effekts in dieser Welt oder null. */
export function accessoryValue(acc: readonly AccessoryData[], effect: AccessoryEffect, world: WorldId): number | null {
  let best: number | null = null;
  for (const a of acc) {
    if (a.effect !== effect || !worksInWorld(a.worlds, world)) continue;
    best = best === null ? a.value : Math.max(best, a.value);
  }
  return best;
}

/** Findet eine Welt oder wirft. */
export function worldById(worlds: readonly WorldDbEntry[], id: WorldId): WorldDbEntry {
  const w = worlds.find((x) => x.id === id);
  if (!w) throw new Error(`Welt ${id} fehlt in worlds.json`);
  return w;
}

/** Findet ein Ausrüstungsteil per ID oder wirft. */
export function byId<T extends { id: string }>(list: readonly T[], id: string, what: string): T {
  const x = list.find((e) => e.id === id);
  if (!x) throw new Error(`${what} ${id} fehlt in gear.json`);
  return x;
}

/** Wert auf [lo, hi] begrenzen. */
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
