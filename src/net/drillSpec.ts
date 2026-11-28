// src/net/drillSpec.ts – Brücke Host ↔ Client-Drill ohne Fischart (B4: „bite {schwierigkeit, verhalten} – nicht die Art“).
// Host: `specFromFish` macht aus dem gewürfelten Fisch nur die Drill-Werte. Client: `fishFromSpec` baut daraus einen
// anonymen FishData-Ersatz für das vorhandene src/game/drill.ts. `minDrillS` ist die Plausibilitätsgrenze des Hosts.
import type { Balancing } from '../data/balancing';
import type { FishData, FightBehavior, ReelData } from '../data/types';
import { drillStaminaS } from '../game/drill';
import type { DrillSpec } from './messages';

/** Drill-Werte eines Fisches (Ausdauer schon mit Größe, Seltenheit und Brocken-Faktor). */
export function specFromFish(fish: FishData, sizeX: number, b: Balancing): DrillSpec {
  const behaviors: FightBehavior[] = [fish.primaryBehavior, ...(fish.secondaryBehavior ? [fish.secondaryBehavior] : [])];
  return {
    kraft: fish.strength,
    ausdauer: drillStaminaS(fish, sizeX, b, behaviors),
    zone: fish.greenZoneModifier,
    zweit: fish.hasSecondaryBehavior && fish.secondaryBehavior ? { verhalten: fish.secondaryBehavior, ab: fish.secondaryAtStamina } : null,
    phasen: fish.bossPhases.map((p) => ({ von: p.hpFrom, bis: p.hpTo, kraft: p.strength, verhalten: [...p.behaviors] })),
  };
}

/**
 * Anonymer Fisch für den Client-Drill. `template` = irgendein Fisch aus fish_db.json (liefert nur die Form des
 * Objekts); alle Identitäts- und Darstellungsfelder werden geleert, alle Drill-Felder kommen aus der Spec.
 * `staminaOverrideS` trägt die fertige Ausdauer (drillStaminaS gibt sie dann unverändert zurück).
 */
export function fishFromSpec(spec: DrillSpec, verhalten: FightBehavior, template: FishData): FishData {
  return {
    ...template,
    id: 'F000', lexiconNumber: 0, nameKey: '', displayNameDe: '?', speciesBasis: '', lexiconKey: '', hintKey: '',
    slug: '', assetKey: '', isBoss: spec.phasen.length > 0,
    primaryBehavior: verhalten,
    hasSecondaryBehavior: spec.zweit !== null,
    secondaryBehavior: spec.zweit?.verhalten,
    secondaryAtStamina: spec.zweit?.ab ?? template.secondaryAtStamina,
    strength: spec.kraft,
    staminaOverrideS: spec.ausdauer,
    greenZoneModifier: spec.zone,
    bossPhases: spec.phasen.map((p) => ({
      nameKey: '', telegraphKey: '', special: 'Keine', hpFrom: p.von, hpTo: p.bis, behaviors: [...p.verhalten], strength: p.kraft,
    })),
  };
}

/** Alle Verhalten, die im Drill vorkommen können. */
const specBehaviors = (spec: DrillSpec, verhalten: FightBehavior): FightBehavior[] =>
  [verhalten, ...(spec.zweit ? [spec.zweit.verhalten] : []), ...spec.phasen.flatMap((p) => p.verhalten)];

/**
 * Theoretische Mindestdauer eines erfolgreichen Drills (s) nach den Regeln aus drill.ts:
 *  - Solange der Fisch Ausdauer hat, kommt er nicht näher als `distance.minWhileFresh`.
 *  - Ausdauer sinkt höchstens mit `stamina.counterMultiplier` je s (Springer-Erschöpfung ggf. schneller).
 *  - Die Distanz sinkt höchstens mit `Rolle.Einholtempo × distance.retrievePerS` je s.
 * → max(Ausdauer / Abbau, (Start − Rest) / Tempo) + Rest / Tempo.
 */
export function minDrillS(spec: DrillSpec, verhalten: FightBehavior, perfectStrike: boolean, reel: Pick<ReelData, 'retrieveSpeed'>, b: Balancing): number {
  const D = b.drill;
  const stamina = spec.ausdauer * (perfectStrike ? 1 - b.bite.perfect.staminaReduction : 1);
  const springer = specBehaviors(spec, verhalten).includes('Springer');
  const drain = D.stamina.counterMultiplier * (springer ? Math.max(1, D.behavior.Springer.exhaustStaminaMultiplier) : 1);
  const rate = Math.max(Number.EPSILON, reel.retrieveSpeed * D.distance.retrievePerS);
  const rest = Math.min(D.distance.minWhileFresh, D.distance.start);
  return Math.max(stamina / drain, (D.distance.start - rest) / rate) + rest / rate;
}
