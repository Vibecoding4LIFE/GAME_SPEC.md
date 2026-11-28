// src/game/spawn.ts – Spawn-Formel (D 1.9) inkl. Pity (D 2.5), Fundstücke (D 3.7) und Bissraten-Boni (datenvertrag §5.3).
// Der Host würfelt hiermit Art und Wartezeit (B4); dieselbe Funktion nutzt der Simulationstest (6.9 Regel 7).
import { eventEffect, weatherEffect, type Balancing, type SpawnEffect } from '../data/balancing';
import type { Rng } from '../core/random';
import type { BaitData, CurioData, FishData, FishId, LineData, Rarity, SpawnCondition, WorldEvent } from '../data/types';
import { rarityRank, worksInWorld, type ActiveWeather, type DayPhase, type WorldDbEntry, type Zone } from './types';

export interface SpawnContext {
  b: Balancing;
  world: WorldDbEntry;
  /** Fische dieser Welt */
  fish: readonly FishData[];
  /** alle Fundstücke (gefiltert wird nach Welt) */
  curios: readonly CurioData[];
  phase: DayPhase;
  weather: ActiveWeather;
  /** aktive Weltereignisse */
  events: readonly WorldEvent[];
  depthM: number;
  zone: Zone;
  bait: BaitData;
  line: LineData;
  leader: LineData | null;
  /** Köder zuckt gerade (D 1.4) */
  twitching: boolean;
  /** Köder liegt im Futterplatz (E W1) */
  feedingSpot: boolean;
  /** Fänge in Folge ohne Selten oder besser (Glücksschimmer, pro Spieler) */
  pityCount: number;
  /** Debug: diese Art erzwingen (Bedingungen werden ignoriert) */
  forceFishId?: FishId | null;
  /** Fundstücke zulassen (Standard: ja) */
  allowCurios?: boolean;
}

export interface SpawnFactors {
  base: number; depth: number; zone: number; time: number; weather: number; bait: number; effects: number;
}
export interface SpawnWeight { fish: FishData; weight: number; factors: SpawnFactors }

export type SpawnResult =
  | { kind: 'fish'; fish: FishData; weight: number; total: number }
  | { kind: 'curio'; curio: CurioData; coins: number }
  | { kind: 'none' };

/** Glücksschimmer-Bonus auf die Basis von Selten/Episch: min(n × step, max). */
export const pityBonus = (count: number, b: Balancing): number => Math.min(count * b.spawn.pity.step, b.spawn.pity.max);

/** Pity-Zähler nach einem Fang: Selten oder besser setzt zurück, sonst +1. */
export const nextPityCount = (count: number, caught: Rarity): number =>
  rarityRank(caught) >= rarityRank('Selten') ? 0 : count + 1;

/** Seltenheiten, deren Basis der Glücksschimmer anhebt (D 1.9: „Selten/Episch“). */
const PITY_RARITIES: readonly Rarity[] = ['Selten', 'Episch'];

const conditionMet = (c: SpawnCondition, weather: ActiveWeather, events: readonly WorldEvent[]): boolean =>
  c === weather || (events as readonly string[]).includes(c);

/** Pflicht-Bedingungen: Wetter (UND-Liste mit „Alle“), Ereignis und DNF `requiredAny`. */
export function requirementsMet(f: FishData, weather: ActiveWeather, events: readonly WorldEvent[]): boolean {
  if (!f.requiredWeather.includes('Alle') && !f.requiredWeather.includes(weather)) return false;
  if (f.requiredEvent !== 'Keins' && !events.includes(f.requiredEvent)) return false;
  if (f.requiredAny.length > 0 && !f.requiredAny.some((and) => and.every((c) => conditionMet(c, weather, events)))) return false;
  return true;
}

/** Produkt einer Wirkung (Seltenheit × passende Tags × Fisch-ID). */
export function effectFactor(e: SpawnEffect, f: FishData): number {
  let m = e.rarity?.[f.rarity] ?? 1;
  if (e.tags) for (const t of f.tags) m *= e.tags[t] ?? 1;
  m *= e.fish?.[f.id] ?? 1;
  return m;
}

/** Alle Wirkungen auf das Spawn-Gewicht außer Basis/Tiefe/Zone/Zeit/Wetter-Pflicht/Köder-Vorliebe. */
function effectsFactor(f: FishData, ctx: SpawnContext): number {
  const { b } = ctx;
  let m = effectFactor(weatherEffect(b, ctx.weather), f);
  for (const e of ctx.events) m *= effectFactor(eventEffect(b, e), f);
  if (ctx.feedingSpot) m *= effectFactor(b.spawn.futterplatz, f);
  if (worksInWorld(ctx.bait.worlds, ctx.world.id)) {
    m *= ctx.bait.rarityMods[f.rarity] ?? 1;
    for (const t of f.tags) m *= ctx.bait.tagBonus[t] ?? 1;
  }
  if (ctx.twitching) {
    if (f.tags.includes('raubfisch')) m *= 1 + b.depth.twitch.raubfischBonus * ctx.bait.twitchBonus;
    if (f.tags.includes('friedfisch')) m *= 1 - b.depth.twitch.friedfischMalus;
  }
  if (f.tags.includes('scheu')) {
    m *= 1 + ctx.line.shyBiteRateMod + (ctx.leader?.shyBiteRateMod ?? 0);
  }
  return m;
}

/** Spawn-Gewicht eines Fisches mit allen Einzelfaktoren (für Debug-Menü und Tests). */
export function fishWeight(f: FishData, ctx: SpawnContext): SpawnWeight {
  const { b } = ctx;
  let base = f.spawnWeightOverride >= 0 ? f.spawnWeightOverride : b.spawn.base[f.rarity];
  if (PITY_RARITIES.includes(f.rarity)) base *= 1 + pityBonus(ctx.pityCount, b);
  const depth = ctx.depthM >= f.depthMinM && ctx.depthM <= f.depthMaxM ? 1 : 0;
  const zone = f.zones.includes('Alle') || f.zones.includes(ctx.zone) ? 1 : b.spawn.zoneMismatch;
  const time = f.timeMask.includes('Immer') || f.timeMask.includes(ctx.phase) ? 1 : 0;
  let weather = requirementsMet(f, ctx.weather, ctx.events) ? 1 : 0;
  if (weather > 0) {
    if (f.preferredWeather.includes(ctx.weather)) weather *= b.spawn.weatherPreferred;
    if (f.preferredEvent !== 'Keins' && ctx.events.includes(f.preferredEvent)) weather *= b.spawn.eventPreferred;
  }
  const bait = f.favoriteBaits.includes(ctx.bait.id)
    ? b.spawn.bait.favorite
    : f.dislikedBaits.includes(ctx.bait.id) ? b.spawn.bait.disliked : b.spawn.bait.neutral;
  const effects = effectsFactor(f, ctx);
  const factors = { base, depth, zone, time, weather, bait, effects };
  return { fish: f, weight: base * depth * zone * time * weather * bait * effects, factors };
}

/** Gewichte aller Fische der Welt. */
export const spawnTable = (ctx: SpawnContext): SpawnWeight[] => ctx.fish.map((f) => fishWeight(f, ctx));

/** Gewichtete Auswahl; null bei Summe 0. */
export function weightedPick<T>(items: readonly T[], weightOf: (t: T) => number, rng: Rng): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r < 0) return it;
  }
  return items[items.length - 1] ?? null;
}

/** Fundstück dieser Welt würfeln (Gewicht aus curios.csv, Münzen min–max, Schatzkiste × Weltfaktor). */
export function rollCurio(world: WorldDbEntry, curios: readonly CurioData[], rng: Rng): { curio: CurioData; coins: number } | null {
  const pool = curios.filter((c) => worksInWorld(c.worlds, world.id));
  const curio = weightedPick(pool, (c) => c.weight, rng);
  if (!curio) return null;
  const raw = rng.int(curio.coinsMin, curio.coinsMax);
  return { curio, coins: Math.round(raw * (curio.coinsTimesWorldFactor ? world.muenzfaktor : 1)) };
}

/**
 * Ein Biss: zuerst Fundstück (Anteil `bite.curioShare`), sonst Fisch nach Spawn-Gewicht.
 * Bosslocker (Köder `summonsWorldBoss`): der Boss kommt garantiert, wenn sein Gewicht > 0 ist.
 */
export function rollSpawn(ctx: SpawnContext, rng: Rng): SpawnResult {
  if (ctx.forceFishId) {
    const f = ctx.fish.find((x) => x.id === ctx.forceFishId);
    if (f) return { kind: 'fish', fish: f, weight: 1, total: 1 };
  }
  const table = spawnTable(ctx);
  const total = table.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) return { kind: 'none' };
  if (ctx.allowCurios !== false && rng.next() < ctx.b.bite.curioShare) {
    const c = rollCurio(ctx.world, ctx.curios, rng);
    if (c) return { kind: 'curio', ...c };
  }
  if (ctx.bait.summonsWorldBoss && worksInWorld(ctx.bait.worlds, ctx.world.id)) {
    const boss = table.find((w) => w.fish.isBoss && w.weight > 0);
    if (boss) return { kind: 'fish', fish: boss.fish, weight: boss.weight, total };
  }
  const pick = weightedPick(table, (w) => w.weight, rng);
  return pick ? { kind: 'fish', fish: pick.fish, weight: pick.weight, total } : { kind: 'none' };
}

export interface BiteRateContext {
  b: Balancing;
  world: WorldDbEntry;
  weather: ActiveWeather;
  events: readonly WorldEvent[];
  bait: BaitData;
  line: LineData;
  leader: LineData | null;
  perfectCast: boolean;
  feedingSpot: boolean;
  /** weitere additive Boni (Rückenwind, Lockfutter … ab Phase 2) */
  extra?: number;
}

/** Summe der additiven Bissraten-Boni (Wartezeit = Grundwert / (1 + Summe)). */
export function biteRateBonus(c: BiteRateContext): number {
  let s = c.extra ?? 0;
  if (c.perfectCast) s += c.b.cast.perfect.biteRateBonus;
  s += weatherEffect(c.b, c.weather).biteRate ?? 0;
  for (const e of c.events) s += eventEffect(c.b, e).biteRate ?? 0;
  if (c.feedingSpot) s += c.b.spawn.futterplatz.biteRate ?? 0;
  s += c.line.biteRateBonus + (c.leader?.biteRateBonus ?? 0);
  if (worksInWorld(c.bait.worlds, c.world.id)) s += c.bait.biteRateBonus;
  return s;
}
