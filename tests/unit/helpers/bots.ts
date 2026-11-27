// Bot-Strategien für Drill- und Session-Tests. Die Schwellen hier sind Spielerverhalten, keine Spielwerte.
import { Rng } from '../../../src/core/random';
import type { FightBehavior, FishData } from '../../../src/data/types';
import { createDrill, stepDrill, type DrillInput, type DrillOutcome, type DrillState } from '../../../src/game/drill';
import { holdTimeForPower } from '../../../src/game/cast';
import type { FishingSession, SessionEvent, SessionInput } from '../../../src/game/session';
import type { Loadout } from '../../../src/game/types';
import { b } from './gameData';

export const DT = 1 / 60;

/** Guter Spieler: Spannung mittig in der Zone, Konter, auf Telegraph korrekt reagieren. */
export function goodDrillBot(s: DrillState, mem: { lastTapS: number; lastDir: DrillState['pullDir'] }): DrillInput {
  const { lo, hi } = s.zone;
  const stage = s.stage.kind;
  const next = s.stage.kind === 'telegraph' ? s.stage.next : undefined;
  let target = (lo + hi) / 2;
  const limit = b.drill.behavior.Springer.tensionLimit;
  if (stage === 'jump' || next === 'jump') target = Math.min(target, limit * 0.6);
  if (stage === 'fake' || next === 'flee' || stage === 'flee') target = lo * 0.7;
  if (stage === 'inflate' || next === 'inflate') target = lo;
  if (stage === 'sprint' || stage === 'dive') target = (lo + target) / 2;
  if (s.behavior === 'Hitzkopf' && s.heat > b.drill.behavior.Hitzkopf.breakAt * 0.5) target = lo * 0.8;
  if (stage === 'snag') target = Math.max(0.25, lo * 0.8);
  // Unsichtbar: Richtung nicht erkennbar → letzte bekannte Richtung halten
  if (!s.invisible) mem.lastDir = s.pullDir;
  const dir = s.invisible ? mem.lastDir : s.pullDir;
  let steer = 0;
  let rodUp = false;
  if (dir === 'down') rodUp = true;
  else steer = dir === 'left' ? 1 : -1;
  if (s.inverted) steer = -steer;
  let tap = false;
  if (s.snag && s.elapsedS - mem.lastTapS >= b.drill.behavior.Versteckspieler.tapIntervalS - 1e-9) {
    tap = true;
    mem.lastTapS = s.elapsedS;
  }
  return { reel: s.tension < target, steer, rodUp, tap };
}

/** Schlechter Spieler: kurbelt immer, lenkt nie. */
export const badDrillBot = (): DrillInput => ({ reel: true, steer: 0, rodUp: false, tap: false });

export interface DrillRun { outcome: DrillOutcome | null; timeS: number; master: boolean; state: DrillState; events: string[]; trace: string[] }

export function runDrill(
  fish: FishData, gear: Loadout, seed: number, bot: 'good' | 'bad', behavior: FightBehavior | null = null, maxS = 240,
): DrillRun {
  const s = createDrill(fish, gear, b, new Rng(seed), { sizeX: b.size.mu, forceBehavior: behavior, world: 'W1', weather: 'Sonnig' });
  const mem = { lastTapS: -Infinity, lastDir: s.pullDir };
  const events: string[] = [];
  const trace: string[] = [];
  while (!s.outcome && s.elapsedS < maxS) {
    const input = bot === 'good' ? goodDrillBot(s, mem) : badDrillBot();
    for (const e of stepDrill(s, input, DT).events) {
      const name = e.type === 'action' || e.type === 'telegraph' ? `${e.type}:${e.action}` : e.type;
      events.push(name);
      trace.push(`${name}@${s.elapsedS.toFixed(3)}`);
    }
  }
  return { outcome: s.outcome, timeS: s.elapsedS, master: s.masterDrill, state: s, events, trace };
}

/**
 * Session-Bot: wirft mit zufälliger Kraft, sinkt auf eine zufällige Tiefe, reagiert auf den Biss nach `reactionS`,
 * drillt wie der gute Drill-Bot und verkauft nach jedem Fang.
 */
export class SessionBot {
  private targetDepth = 0;
  private holdTarget = 0;
  private biteSeenAt = -1;
  private mem = { lastTapS: -Infinity, lastDir: 'left' as DrillState['pullDir'] };
  private lastSnagTap = -Infinity;
  private prevReel = false;
  readonly rng: Rng;

  constructor(seed: number, private readonly reactionS = 0.25) { this.rng = new Rng(seed); }

  input(sess: FishingSession, events: readonly SessionEvent[]): SessionInput {
    const s = sess.state;
    const out: SessionInput = { castHeld: false, reel: false, reelPressed: false, sink: false, steer: 0, rodUp: false, strike: false, feed: false };
    for (const e of events) if (e.type === 'bite' && e.e.type === 'bite') this.biteSeenAt = s.timeS;
    switch (s.rodState) {
      case 'Idle': {
        const lo = sess.loadout();
        this.holdTarget = holdTimeForPower(this.rng.range(0.15, 1), lo.rod.castCycleS);
        this.targetDepth = this.rng.range(0, sess.world.maxTiefeM);
        out.castHeld = true;
        break;
      }
      case 'Casting':
        out.castHeld = s.castHoldS + DT < this.holdTarget;
        out.sink = true;
        break;
      case 'Sinking': case 'Waiting':
        if (s.snag) {
          if (s.timeS - this.lastSnagTap >= b.spawn.haenger.tapIntervalS - 1e-9 || s.snag.count === 0) {
            out.reel = true;
            out.reelPressed = !this.prevReel;
            if (out.reelPressed) this.lastSnagTap = s.timeS;
          }
          break;
        }
        out.sink = s.bite?.stage === 'wait' && s.baitDepthM < this.targetDepth && !s.lineTooShort;
        break;
      case 'Bite':
        if (this.biteSeenAt >= 0 && s.timeS - this.biteSeenAt >= this.reactionS) out.strike = true;
        break;
      case 'Reeling':
        if (s.drill) {
          const d = goodDrillBot(s.drill, this.mem);
          out.reel = d.reel;
          out.steer = d.steer;
          out.rodUp = d.rodUp;
          out.reelPressed = d.tap;
        }
        break;
      case 'Caught':
        sess.sellAll();
        sess.acknowledge();
        break;
      case 'Escaped':
        sess.acknowledge();
        break;
      default: break;
    }
    if (s.rodState === 'Idle' || s.rodState === 'Reeling') this.biteSeenAt = -1;
    this.prevReel = out.reel;
    return out;
  }
}

/** Lässt eine Session `seconds` lang mit dem Bot laufen. */
export function runSession(sess: FishingSession, bot: SessionBot, seconds: number): SessionEvent[] {
  const all: SessionEvent[] = [];
  let last: SessionEvent[] = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    last = sess.step(DT, bot.input(sess, last));
    for (const e of last) all.push(e);
  }
  return all;
}
