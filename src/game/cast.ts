// src/game/cast.ts – Auswerfen (D 1.3): Wurfkraft-Ping-Pong, Wurfweite, Zone, Perfekt/Fehlwurf, Wind.
import type { Balancing } from '../data/balancing';
import type { RodData, WorldId } from '../data/types';
import { clamp, rodAbilityValue, type ActiveWeather, type WorldDbEntry, type Zone } from './types';

/**
 * Wurfkraft 0…1 nach `holdS` Sekunden Halten. Ein Durchlauf 0 → 1 → 0 dauert `cycleS` (Rute `castCycleS`).
 * `speedFactor` > 1 lässt den Balken schneller laufen (z. B. Schabernack „Wellenmacher“, Phase 2).
 */
export function castPower(holdS: number, cycleS: number, speedFactor = 1): number {
  const t = Math.max(0, holdS * speedFactor) / cycleS;
  const frac = t - Math.floor(t);
  const up = frac * 2;
  return up <= 1 ? up : 2 - up;
}

/** Haltezeit für eine gewünschte Kraft im ersten Anstieg (für Bots/Tests). */
export const holdTimeForPower = (power: number, cycleS: number): number => (clamp(power, 0, 1) * cycleS) / 2;

/** Untergrenze des Perfekt-Fensters der Rute (nie unter `cast.perfect.windowMinFloor`). */
export const perfectWindowMin = (rod: RodData, b: Balancing): number =>
  Math.max(rod.perfectWindowMin, b.cast.perfect.windowMinFloor);

/** Horizontale Zone nach Wurfweite in Metern (worlds.json `uferEndeM` / `freiwasserEndeM`). */
export function zoneAt(distanceM: number, world: Pick<WorldDbEntry, 'uferEndeM' | 'freiwasserEndeM'>): Zone {
  if (distanceM < world.uferEndeM) return 'Ufer';
  if (distanceM < world.freiwasserEndeM) return 'Freiwasser';
  return 'Kante';
}

/** Windanteil (± Anteil der max. Wurfweite) bei diesem Wetter, nach Ruten-Fähigkeit `WindImmun` (Wert = Restanteil). */
export function windShare(weather: ActiveWeather, rod: RodData, worldId: WorldId, b: Balancing): number {
  const w = b.cast.wind[weather] ?? 0;
  const immun = rodAbilityValue(rod, 'WindImmun', worldId);
  return immun === null ? w : w * immun;
}

export interface CastResult {
  power: number;
  perfect: boolean;
  miss: boolean;
  maxDistanceM: number;
  /** Landepunkt in Metern vom Boot/Steg (inkl. Wind). */
  distanceM: number;
  windOffsetM: number;
  zone: Zone;
}

export interface CastInput {
  power: number;
  rod: RodData;
  world: WorldDbEntry;
  weather: ActiveWeather;
  /** Windrichtung aus dem Wetterzustand (clock.ts): −1 = zum Boot hin, +1 = vom Boot weg. */
  windDir: -1 | 1;
  b: Balancing;
}

/** Wertet einen losgelassenen Wurf aus (deterministisch, kein Zufall: Wind kommt aus dem Wetterzustand). */
export function resolveCast({ power, rod, world, weather, windDir, b }: CastInput): CastResult {
  const p = clamp(power, 0, 1);
  const maxDistanceM = rod.castMaxDistanceM;
  const miss = p < b.cast.miss.below;
  const perfect = !miss && p >= perfectWindowMin(rod, b);
  if (miss) {
    const d = b.cast.miss.landingPower * maxDistanceM;
    return { power: p, perfect: false, miss: true, maxDistanceM, distanceM: d, windOffsetM: 0, zone: 'Ufer' };
  }
  const windOffsetM = windDir * windShare(weather, rod, world.id, b) * maxDistanceM;
  const distanceM = clamp(p * maxDistanceM + windOffsetM, 0, maxDistanceM);
  return { power: p, perfect, miss: false, maxDistanceM, distanceM, windOffsetM, zone: zoneAt(distanceM, world) };
}
