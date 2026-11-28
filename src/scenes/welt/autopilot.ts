// Autopilot für Tests und Vorführung (window.__KK.hooks.autopilot): wirft, sinkt, schlägt an und drillt wie ein guter
// Spieler (Spannung mittig, Konter, auf Telegraph reagieren). Die Schwellen sind Spielerverhalten, keine Spielwerte.
import type { DrillState } from '../../game/drill';
import { holdTimeForPower } from '../../game/cast';
import type { FishingSession, SessionInput } from '../../game/session';
import { IDLE_INPUT } from '../../game/session';

const POWER = 0.6;
const TARGET_DEPTH_SHARE = 0.5;
const REACTION_S = 0.2;

export class Autopilot {
  private biteAt = -1;
  private lastTap = -Infinity;
  private drillTap = -Infinity;
  private lastDir: DrillState['pullDir'] = 'left';
  private prevReel = false;

  input(sess: FishingSession): SessionInput {
    const s = sess.state;
    const out: SessionInput = { ...IDLE_INPUT };
    switch (s.rodState) {
      case 'Idle': out.castHeld = true; break;
      case 'Casting': out.castHeld = s.castHoldS < holdTimeForPower(POWER, sess.loadout().rod.castCycleS); break;
      case 'Sinking': case 'Waiting': {
        if (s.snag) {
          if (s.snag.count === 0 || s.timeS - this.lastTap >= sess.b.spawn.haenger.tapIntervalS) {
            out.reel = true; out.reelPressed = true; this.lastTap = s.timeS;
          }
          break;
        }
        const floor = Math.min(sess.floorM(), sess.world.maxTiefeM);
        out.sink = s.bite?.stage === 'wait' && s.baitDepthM < floor * TARGET_DEPTH_SHARE && !s.lineTooShort;
        this.biteAt = -1;
        break;
      }
      case 'Nibble': this.biteAt = -1; break;
      case 'Bite':
        if (this.biteAt < 0) this.biteAt = s.timeS;
        out.strike = s.timeS - this.biteAt >= REACTION_S;
        break;
      case 'Reeling': if (s.drill) Object.assign(out, this.drill(s.drill)); break;
      default: break;
    }
    out.reelPressed = out.reelPressed || (out.reel && !this.prevReel && s.rodState !== 'Reeling');
    this.prevReel = out.reel;
    return out;
  }

  private drill(d: DrillState): Partial<SessionInput> {
    const { lo, hi } = d.zone;
    const k = d.stage.kind;
    const next = k === 'telegraph' ? d.stage.next : undefined;
    let target = (lo + hi) / 2;
    if (k === 'jump' || next === 'jump') target = Math.min(target, d.b.drill.behavior.Springer.tensionLimit * 0.6);
    if (k === 'fake' || next === 'flee' || k === 'flee') target = lo * 0.7;
    if (k === 'inflate' || next === 'inflate') target = lo;
    if (k === 'sprint' || k === 'dive') target = (lo + target) / 2;
    if (d.behavior === 'Hitzkopf' && d.heat > d.b.drill.behavior.Hitzkopf.breakAt / 2) target = lo * 0.8;
    if (k === 'snag') target = Math.max(0.25, lo * 0.8);
    if (!d.invisible) this.lastDir = d.pullDir;
    const dir = d.invisible ? this.lastDir : d.pullDir;
    let steer = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    if (d.inverted) steer = -steer;
    let tap = false;
    if (this.drillTap > d.elapsedS) this.drillTap = -Infinity; // neuer Drill
    if (d.snag && d.elapsedS - this.drillTap >= d.b.drill.behavior.Versteckspieler.tapIntervalS) { tap = true; this.drillTap = d.elapsedS; }
    return { reel: d.tension < target, steer, rodUp: dir === 'down', reelPressed: tap };
  }
}
