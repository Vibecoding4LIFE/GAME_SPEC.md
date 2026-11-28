// src/game/shadows.ts – Fisch-Schatten im Wasser (D 1.4, B4 `shadows`): Position + Größenklasse, die Art bleibt geheim.
// Der Host würfelt sie; die Szene zeichnet nur dunkle Silhouetten (gefangene Arten mit Lexikon-Symbol).
// Arten nach Spawn-Gewicht in ihrer eigenen Tiefe – so zeigen Schatten ehrlich, was gerade beißen könnte.
import type { Rng } from '../core/random';
import type { FishData, FishId, SizeClass } from '../data/types';
import { spawnTable, weightedPick, type SpawnContext } from './spawn';

export interface Shadow {
  id: number;
  fishId: FishId;
  sizeClass: SizeClass;
  /** Welt-Koordinaten in Metern: x = Abstand vom Spielerplatz, y = Tiefe */
  xM: number;
  depthM: number;
  /** m/s, Vorzeichen = Richtung */
  speedMs: number;
  /** verbleibende Lebenszeit (s) */
  ttlS: number;
}

export interface ShadowParams {
  /** höchstens so viele gleichzeitig (Objekt-Pool der Szene) */
  max: number;
  /** waagerechter Bereich in Metern */
  minXM: number;
  maxXM: number;
  /** Schwimmtempo m/s (min, max) */
  speedMs: [number, number];
  /** Lebenszeit s (min, max) */
  ttlS: [number, number];
  /** neue Schatten je s */
  spawnPerS: number;
}

export interface ShadowSim { shadows: Shadow[]; nextId: number; acc: number }

export const createShadowSim = (): ShadowSim => ({ shadows: [], nextId: 1, acc: 0 });

/**
 * Wählt eine Art nach Spawn-Gewicht, wobei jede Art in der Mitte ihrer Tiefe gewertet wird (Zone/Köder neutral).
 * Gibt null zurück, wenn gerade nichts im Wasser sein kann.
 */
export function pickShadowFish(ctx: SpawnContext, rng: Rng): { fish: FishData; depthM: number } | null {
  const rows = ctx.fish.map((f) => {
    const depthM = rng.range(f.depthMinM, f.depthMaxM);
    const w = spawnTable({ ...ctx, fish: [f], depthM, twitching: false, feedingSpot: false })[0];
    return { fish: f, depthM, weight: w ? w.weight / Math.max(Number.EPSILON, w.factors.bait * w.factors.zone) : 0 };
  });
  const pick = weightedPick(rows, (r) => r.weight, rng);
  return pick ? { fish: pick.fish, depthM: pick.depthM } : null;
}

/** Ein Zeitschritt: bewegen, altern, neue Schatten erzeugen. `ctx` = aktuelle Bedingungen (Zeit, Wetter …). */
export function stepShadows(sim: ShadowSim, dt: number, ctx: SpawnContext, p: ShadowParams, rng: Rng): void {
  for (const s of sim.shadows) {
    s.xM += s.speedMs * dt;
    s.ttlS -= dt;
    if (s.xM < p.minXM || s.xM > p.maxXM) s.speedMs = -s.speedMs;
  }
  sim.shadows = sim.shadows.filter((s) => s.ttlS > 0);
  sim.acc += dt * p.spawnPerS;
  while (sim.acc >= 1) {
    sim.acc -= 1;
    if (sim.shadows.length >= p.max) continue;
    const pick = pickShadowFish(ctx, rng);
    if (!pick) continue;
    const dir = rng.next() < 1 / 2 ? -1 : 1;
    sim.shadows.push({
      id: sim.nextId++, fishId: pick.fish.id, sizeClass: pick.fish.sizeClass,
      xM: rng.range(p.minXM, p.maxXM), depthM: pick.depthM,
      speedMs: dir * rng.range(p.speedMs[0], p.speedMs[1]), ttlS: rng.range(p.ttlS[0], p.ttlS[1]),
    });
  }
}

/** Sichtbare Sicht auf einen Schatten für Clients: ohne Art (B4). `known` = Art schon gefangen. */
export interface ShadowView { id: number; sizeClass: SizeClass; xM: number; depthM: number; dir: -1 | 1; known: boolean }

export const shadowViews = (sim: ShadowSim, isKnown: (id: FishId) => boolean): ShadowView[] =>
  sim.shadows.map((s) => ({ id: s.id, sizeClass: s.sizeClass, xM: s.xM, depthM: s.depthM, dir: s.speedMs < 0 ? -1 : 1, known: isKnown(s.fishId) }));
