// src/game/bite.ts – Warten → Zupfer → Biss → Anschlagfenster (D 1.5), Scheinbisse, zu früh/zu spät,
// Perfekter Anschlag, Zahnfisch-Abbiss ohne Vorfach (D 1.8).
import type { Balancing } from '../data/balancing';
import type { Rng } from '../core/random';
import type { FishData, RodData } from '../data/types';
import type { SpawnResult } from './spawn';
import { toothProtected, type Loadout } from './types';

/** Wartezeit bis zur Annäherung: Zufall(min, max) / (1 + Boni) × Faktor⁻¹, mindestens `bite.wait.floorS`. */
export function waitTimeS(b: Balancing, rng: Rng, biteRateSum: number, rateFactor = 1): number {
  const raw = rng.range(b.bite.wait.minS, b.bite.wait.maxS);
  const rate = Math.max(Number.EPSILON, (1 + biteRateSum) * rateFactor);
  return Math.max(b.bite.wait.floorS, raw / rate);
}

/** Länge des Anschlagfensters: Grundwert + Seltenheit + Rute „Reaktion“ + Fisch-Bonus (Fundstück: ohne Seltenheit). */
export function strikeWindowS(fish: Pick<FishData, 'rarity' | 'biteWindowBonusS'> | null, rod: RodData, b: Balancing): number {
  const rarity = fish ? b.bite.window.rarityBonusS[fish.rarity] : 0;
  return Math.max(0, b.bite.window.baseS + rarity + rod.reactionBonusS + (fish?.biteWindowBonusS ?? 0));
}

export type StrikeQuality = 'perfect' | 'ok' | 'late';

/** Anschlag nach `elapsedS` Sekunden im Fenster: perfekt in den ersten `bite.perfect.windowFraction`. */
export function judgeStrike(elapsedS: number, windowS: number, b: Balancing): StrikeQuality {
  if (elapsedS > windowS) return 'late';
  return elapsedS <= windowS * b.bite.perfect.windowFraction ? 'perfect' : 'ok';
}

/** Zahnfisch ohne Vorfach beißt mit `bite.toothedCutChance` die Schnur durch. */
export const toothedCut = (fish: FishData, gear: Pick<Loadout, 'line' | 'leader'>, b: Balancing, rng: Rng): boolean =>
  fish.isToothed && !toothProtected(gear) && rng.next() < b.bite.toothedCutChance;

export type ApproachStep = { kind: 'nibble' | 'fake'; atS: number };

/**
 * Plant die Annäherung: n Zupfer (nibbleMin…nibbleMax, minus Rückenwind-Reduktion), bei Tricksern ggf. Scheinbisse,
 * dazwischen je ein Abstand aus `bite.nibble`; danach der Biss. Zeiten relativ zum Beginn der Annäherung.
 */
export function planApproach(
  target: SpawnResult, b: Balancing, rng: Rng, nibbleReduction = 0,
): { steps: ApproachStep[]; biteAtS: number } {
  const fish = target.kind === 'fish' ? target.fish : null;
  const nibbles = fish ? Math.max(0, rng.int(fish.nibbleMin, fish.nibbleMax) - nibbleReduction) : 0;
  let fakes = 0;
  if (fish?.hasFakeBites && rng.next() < b.bite.fakeBite.chance) fakes = rng.int(1, Math.max(1, b.bite.fakeBite.maxCount));
  const kinds: ApproachStep['kind'][] = [...Array<'nibble'>(nibbles).fill('nibble'), ...Array<'fake'>(fakes).fill('fake')];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [kinds[i], kinds[j]] = [kinds[j] as ApproachStep['kind'], kinds[i] as ApproachStep['kind']];
  }
  const gap = () => rng.range(b.bite.nibble.intervalMinS, b.bite.nibble.intervalMaxS);
  let t = 0;
  const steps: ApproachStep[] = [];
  for (const kind of kinds) {
    t += gap();
    steps.push({ kind, atS: t });
  }
  return { steps, biteAtS: t + gap() };
}

export type BiteStage = 'wait' | 'approach' | 'bite' | 'done';

export interface BiteState {
  stage: BiteStage;
  /** Zeit im aktuellen Abschnitt (s) */
  t: number;
  waitS: number;
  target: SpawnResult | null;
  steps: ApproachStep[];
  stepIdx: number;
  biteAtS: number;
  windowS: number;
  /** Scheinbiss sichtbar bis (Zeit im Abschnitt) */
  fakeUntil: number;
  result: null | { type: 'strike'; quality: Exclude<StrikeQuality, 'late'>; elapsedS: number } | { type: 'early' } | { type: 'late' };
}

export type BiteEvent =
  | { type: 'approach'; target: SpawnResult }
  | { type: 'noFish'; retryS: number }
  | { type: 'nibble'; index: number }
  | { type: 'fakeBite'; flashS: number }
  | { type: 'bite'; windowS: number }
  | { type: 'strike'; quality: 'perfect' | 'ok'; elapsedS: number }
  | { type: 'early' }
  | { type: 'late' };

export interface BiteDeps {
  b: Balancing;
  rng: Rng;
  rod: RodData;
  /** würfelt die Art zum Zeitpunkt der Annäherung (aktuelle Tiefe, Zone, Zucken …) */
  roll: () => SpawnResult;
  /** Summe der Bissraten-Boni und Strafen-Faktor zum Zeitpunkt der (Neu-)Planung */
  biteRate: () => { sum: number; factor: number };
  nibbleReduction?: number;
}

export function createBite(d: BiteDeps): BiteState {
  const r = d.biteRate();
  return {
    stage: 'wait', t: 0, waitS: waitTimeS(d.b, d.rng, r.sum, r.factor), target: null, steps: [], stepIdx: 0,
    biteAtS: 0, windowS: 0, fakeUntil: -1, result: null,
  };
}

/** Ein Zeitschritt. `strike` = Anschlag-Taste in diesem Schritt gedrückt (Flanke). */
export function stepBite(s: BiteState, dt: number, strike: boolean, d: BiteDeps): BiteEvent[] {
  const ev: BiteEvent[] = [];
  if (s.stage === 'done') return ev;
  s.t += dt;
  if (s.stage === 'wait') {
    if (s.t < s.waitS) return ev;
    const target = d.roll();
    if (target.kind === 'none') {
      s.t = 0;
      s.waitS = d.b.bite.wait.noFishRetryS;
      ev.push({ type: 'noFish', retryS: s.waitS });
      return ev;
    }
    const plan = planApproach(target, d.b, d.rng, d.nibbleReduction ?? 0);
    Object.assign(s, { stage: 'approach', t: 0, target, steps: plan.steps, stepIdx: 0, biteAtS: plan.biteAtS, fakeUntil: -1 });
    ev.push({ type: 'approach', target });
    return ev;
  }
  if (s.stage === 'approach') {
    if (strike) {
      s.stage = 'done';
      s.result = { type: 'early' };
      ev.push({ type: 'early' });
      return ev;
    }
    while (s.stepIdx < s.steps.length && (s.steps[s.stepIdx] as ApproachStep).atS <= s.t) {
      const st = s.steps[s.stepIdx] as ApproachStep;
      if (st.kind === 'nibble') ev.push({ type: 'nibble', index: s.steps.slice(0, s.stepIdx + 1).filter((x) => x.kind === 'nibble').length });
      else {
        s.fakeUntil = st.atS + d.b.bite.fakeBite.flashS;
        ev.push({ type: 'fakeBite', flashS: d.b.bite.fakeBite.flashS });
      }
      s.stepIdx++;
    }
    if (s.t >= s.biteAtS) {
      const fish = s.target?.kind === 'fish' ? s.target.fish : null;
      s.windowS = strikeWindowS(fish, d.rod, d.b);
      s.stage = 'bite';
      s.t = 0;
      ev.push({ type: 'bite', windowS: s.windowS });
    }
    return ev;
  }
  // stage === 'bite'
  if (strike) {
    const elapsed = s.t - dt; // Taste kam in diesem Schritt, also spätestens zum Beginn des Schritts
    const q = judgeStrike(Math.max(0, elapsed), s.windowS, d.b);
    s.stage = 'done';
    if (q === 'late') {
      s.result = { type: 'late' };
      ev.push({ type: 'late' });
    } else {
      s.result = { type: 'strike', quality: q, elapsedS: Math.max(0, elapsed) };
      ev.push({ type: 'strike', quality: q, elapsedS: Math.max(0, elapsed) });
    }
    return ev;
  }
  if (s.t > s.windowS) {
    s.stage = 'done';
    s.result = { type: 'late' };
    ev.push({ type: 'late' });
  }
  return ev;
}

/** Scheinbiss gerade sichtbar (oranges „!“)? */
export const fakeVisible = (s: BiteState): boolean => s.stage === 'approach' && s.t < s.fakeUntil;
