// src/game/session.ts – Einzelspieler-Ablauf (Freies Angeln, Welt 1): verbindet Wurf, Tiefe, Biss, Drill, Fang,
// Fangeimer, Münzen, Ruf, Pity, Lexikon und Uhr. Reiner Zustand + step(dt, input) + Ereignisliste: die Szene zeichnet nur.
// Phasen = B4 `rodState`: Idle → Casting → Sinking → Waiting → Nibble → Bite → Reeling → Caught | Escaped.
import { Rng, hashSeed } from '../core/random';
import type { CurioData, FightBehavior, FishData, FishId, WorldEvent, WorldId } from '../data/types';
import { createBite, fakeVisible, stepBite, toothedCut, type BiteDeps, type BiteEvent, type BiteState } from './bite';
import { castPower, resolveCast, type CastResult } from './cast';
import {
  activeEvents, createClock, forceEvent, phaseAt, setPhase, setWeather, stepClock, type ClockEvent, type ClockState,
} from './clock';
import { layerAt, sinkStep, twitchDepth } from './depth';
import { createDrill, stepDrill, type DrillEvent, type DrillOutcome, type DrillState } from './drill';
import { markSeen, recordCatch } from './lexicon';
import type { CatchRecord, Profile } from './save';
import { catchXp, levelForXp, scorePoints, sellValue } from './score';
import { rollShiny, shinyChance } from './shiny';
import { rollSize, type SizeRoll } from './size';
import { biteRateBonus, nextPityCount, rollSpawn, type SpawnContext } from './spawn';
import {
  accessoryValue, byId, rodSizeMuBonus, worksInWorld, worldById,
  type ActiveWeather, type DayPhase, type GameData, type Loadout, type WorldDbEntry, type Zone,
} from './types';

export const ROD_STATES = ['Idle', 'Casting', 'Sinking', 'Waiting', 'Nibble', 'Bite', 'Reeling', 'Caught', 'Escaped'] as const;
export type RodState = (typeof ROD_STATES)[number];

export type EscapeReason = 'late' | 'cut' | Exclude<DrillOutcome, 'caught'>;

// ------------------------------------------------------------------ Eingabe

/**
 * Eingabe je Zeitschritt. Gehaltene Werte (`castHeld`, `reel`, `sink`, `steer`) und Flanken (`strike`, `rodUp`,
 * `feed`, `reelPressed`), die nur für genau einen Schritt wahr sind. `InputCollector` baut sie aus den Aktionen von
 * src/ui/input.ts (castHold/castRelease/reelStart/reelStop/strike/sinkStart/sinkStop/steer/rodUp/item).
 */
export interface SessionInput {
  castHeld: boolean;
  reel: boolean;
  /** Kurbel in diesem Schritt neu gedrückt (Zucken, Hänger-Takt) */
  reelPressed: boolean;
  sink: boolean;
  steer: number;
  rodUp: boolean;
  strike: boolean;
  /** „Füttern“ (Item-Taste, solange es keine Schabernack-Items gibt) */
  feed: boolean;
}

export const IDLE_INPUT: SessionInput = Object.freeze({
  castHeld: false, reel: false, reelPressed: false, sink: false, steer: 0, rodUp: false, strike: false, feed: false,
});

/** Strukturell kompatibel zu `InputAction` aus src/ui/inputMap.ts (ohne Abhängigkeit von src/ui). */
export interface InputActionLike { type: string; value?: number }

/** Sammelt UI-Aktionen zwischen zwei Schritten und liefert daraus `SessionInput`. */
export class InputCollector {
  private held = { castHeld: false, reel: false, sink: false, steer: 0 };
  private edges = { reelPressed: false, rodUp: false, strike: false, feed: false };

  apply(a: InputActionLike): void {
    switch (a.type) {
      case 'castHold': this.held.castHeld = true; break;
      case 'castRelease': this.held.castHeld = false; break;
      case 'reelStart': this.held.reel = true; this.edges.reelPressed = true; break;
      case 'reelStop': this.held.reel = false; break;
      case 'strike': this.edges.strike = true; break;
      case 'sinkStart': this.held.sink = true; break;
      case 'sinkStop': this.held.sink = false; break;
      case 'steer': this.held.steer = a.value ?? 0; break;
      case 'rodUp': this.edges.rodUp = true; break;
      case 'item': this.edges.feed = true; break;
      default: break;
    }
  }

  /** Eingabe für den nächsten Schritt; Flanken werden danach zurückgesetzt. */
  take(): SessionInput {
    const out: SessionInput = { ...this.held, ...this.edges };
    this.edges = { reelPressed: false, rodUp: false, strike: false, feed: false };
    return out;
  }
}

// ------------------------------------------------------------------ Ereignisse

export type CatchEvent = { type: 'caught'; record: CatchRecord; fish: FishData; levelUp: boolean; pearls: number };

export type SessionEvent =
  | { type: 'rodState'; state: RodState }
  | { type: 'cast'; result: CastResult }
  | { type: 'lineTooShort' }
  | { type: 'twitch' }
  | { type: 'retrieved' }
  | { type: 'snagged'; tapsNeeded: number }
  | { type: 'snagTap'; ok: boolean; count: number; needed: number }
  | { type: 'snagFreed' }
  | { type: 'baitLost'; baitId: string }
  | { type: 'baitEmpty'; baitId: string; switchedTo: string }
  | { type: 'feed'; untilS: number }
  | { type: 'scared'; penaltyS: number }
  | { type: 'hooked'; fish: FishData; behavior: FightBehavior; sizeX: number }
  | { type: 'curio'; curio: CurioData; coins: number }
  | CatchEvent
  | { type: 'escaped'; reason: EscapeReason; fish: FishData | null }
  | { type: 'sold'; coins: number; count: number }
  | { type: 'clock'; e: ClockEvent }
  | { type: 'bite'; e: BiteEvent }
  | { type: 'drill'; e: DrillEvent };

// ------------------------------------------------------------------ Zustand

export interface SessionOptions {
  world: WorldId;
  seed: number;
  startPhase?: DayPhase;
  startWeather?: ActiveWeather;
  /** Wettkampf (Schillernd-Deckel). Freies Angeln: false */
  competition?: boolean;
}

export interface SessionState {
  rodState: RodState;
  timeS: number;
  castHoldS: number;
  castPower: number;
  cast: CastResult | null;
  baitDepthM: number;
  lineTooShort: boolean;
  /** Köder zuckt bis (Sitzungszeit) */
  twitchUntilS: number;
  reelHeldS: number;
  snag: { count: number; needed: number; sinceTap: number } | null;
  snagChecked: boolean;
  feedingSpot: { distanceM: number; untilS: number } | null;
  /** Bissraten-Strafe nach zu frühem Anschlag (D 1.5) */
  penalty: { zone: Zone; untilS: number } | null;
  bite: BiteState | null;
  drill: DrillState | null;
  hooked: { fish: FishData; size: SizeRoll; perfectStrike: boolean } | null;
  lastCatch: CatchRecord | null;
  lastCurio: { curio: CurioData; coins: number } | null;
  lastEscape: { reason: EscapeReason; fish: FishData | null } | null;
  /** Anzahl Fänge je Art in dieser Sitzung (Vielfalt V) */
  speciesCount: Partial<Record<FishId, number>>;
  beginnerSaves: number;
  netSaves: number;
  stats: { catches: number; escapes: number; curios: number; points: number; casts: number };
  debug: { forceFish: FishId | null; forceBehavior: FightBehavior | null };
}

export class FishingSession {
  readonly world: WorldDbEntry;
  readonly worldFish: FishData[];
  readonly clock: ClockState;
  readonly state: SessionState;
  private readonly clockRng: Rng;
  private readonly fishRng: Rng;
  private readonly drillRng: Rng;
  private prev: SessionInput = IDLE_INPUT;
  private ev: SessionEvent[] = [];

  constructor(readonly data: GameData, readonly profile: Profile, readonly opts: SessionOptions) {
    this.world = worldById(data.worlds, opts.world);
    this.worldFish = data.fish.filter((f) => f.world === opts.world);
    this.clockRng = new Rng(hashSeed(`${opts.seed}:clock`));
    this.fishRng = new Rng(hashSeed(`${opts.seed}:fish`));
    this.drillRng = new Rng(hashSeed(`${opts.seed}:drill`));
    const b = data.balancing;
    this.clock = createClock({
      world: this.world, b, rng: this.clockRng, startPhase: opts.startPhase, startWeather: opts.startWeather,
      forecastCount: this.forecastCount(),
    });
    const lvl = levelForXp(profile.xp, b);
    this.state = {
      rodState: 'Idle', timeS: 0, castHoldS: 0, castPower: 0, cast: null, baitDepthM: 0, lineTooShort: false,
      twitchUntilS: -1, reelHeldS: 0, snag: null, snagChecked: false, feedingSpot: null, penalty: null,
      bite: null, drill: null, hooked: null, lastCatch: null, lastCurio: null, lastEscape: null, speciesCount: {},
      beginnerSaves: lvl <= b.catchup.beginner.maxReputation ? b.catchup.beginner.saves : 0,
      netSaves: accessoryValue(this.loadout().accessories, 'KescherRettung', opts.world) ?? 0,
      stats: { catches: 0, escapes: 0, curios: 0, points: 0, casts: 0 },
      debug: { forceFish: null, forceBehavior: null },
    };
  }

  get b() { return this.data.balancing; }
  get phase(): DayPhase { return phaseAt(this.clock.dayTimeS, this.b); }
  get weather(): ActiveWeather { return this.clock.weather; }
  get events(): WorldEvent[] { return activeEvents(this.clock, this.world, this.b); }
  get level(): number { return levelForXp(this.profile.xp, this.b); }
  get twitching(): boolean { return this.state.timeS < this.state.twitchUntilS; }
  get fakeBiteVisible(): boolean { return this.state.bite ? fakeVisible(this.state.bite) : false; }

  private forecastCount(): number {
    return Math.max(this.b.weather.forecastCount, accessoryValue(this.loadout().accessories, 'WetterVorschau', this.opts.world) ?? 0);
  }

  /** Aufgelöste Ausrüstung aus den IDs im Profil. */
  loadout(): Loadout {
    const g = this.data.gear;
    const l = this.profile.loadout;
    return {
      rod: byId(g.rods, l.rod, 'Rute'),
      line: byId(g.lines, l.line, 'Schnur'),
      leader: l.leader ? byId(g.lines, l.leader, 'Vorfach') : null,
      reel: byId(g.reels, l.reel, 'Rolle'),
      bait: byId(g.baits, l.bait, 'Köder'),
      accessories: l.accessories.map((id) => byId(g.accessories, id, 'Zubehör')),
    };
  }

  private setRodState(s: RodState): void {
    if (this.state.rodState === s) return;
    this.state.rodState = s;
    this.ev.push({ type: 'rodState', state: s });
  }

  // ---------------------------------------------------------------- Schritt

  step(dt: number, input: SessionInput): SessionEvent[] {
    this.ev = [];
    const s = this.state;
    s.timeS += dt;
    for (const e of stepClock(this.clock, dt, this.world, this.b, this.clockRng, this.forecastCount())) this.ev.push({ type: 'clock', e });
    if (s.feedingSpot && s.feedingSpot.untilS <= s.timeS) s.feedingSpot = null;
    if (s.penalty && s.penalty.untilS <= s.timeS) s.penalty = null;
    const castPressed = input.castHeld && !this.prev.castHeld;

    switch (s.rodState) {
      case 'Idle':
        if (input.castHeld) {
          s.castHoldS = 0;
          s.castPower = 0;
          this.setRodState('Casting');
        }
        break;
      case 'Casting': this.stepCasting(dt, input); break;
      case 'Sinking': case 'Waiting': case 'Nibble': case 'Bite': this.stepInWater(dt, input); break;
      case 'Reeling': this.stepReeling(dt, input); break;
      case 'Caught': case 'Escaped':
        if (castPressed) this.acknowledge();
        break;
    }
    this.prev = input;
    return this.ev;
  }

  private stepCasting(dt: number, input: SessionInput): void {
    const s = this.state;
    const lo = this.loadout();
    if (input.castHeld) {
      s.castHoldS += dt;
      s.castPower = castPower(s.castHoldS, lo.rod.castCycleS);
      return;
    }
    const result = resolveCast({ power: s.castPower, rod: lo.rod, world: this.world, weather: this.weather, windDir: this.clock.windDir, b: this.b });
    Object.assign(s, { cast: result, baitDepthM: 0, lineTooShort: false, twitchUntilS: -1, reelHeldS: 0, snag: null, snagChecked: false });
    s.stats.casts++;
    this.ev.push({ type: 'cast', result });
    s.bite = createBite(this.biteDeps());
    this.setRodState(input.sink ? 'Sinking' : 'Waiting');
  }

  private biteDeps(): BiteDeps {
    const lo = this.loadout();
    return {
      b: this.b, rng: this.fishRng, rod: lo.rod,
      roll: () => rollSpawn(this.spawnContext(), this.fishRng),
      biteRate: () => {
        const s = this.state;
        const sum = biteRateBonus({
          b: this.b, world: this.world, weather: this.weather, events: this.events, bait: lo.bait, line: lo.line, leader: lo.leader,
          perfectCast: s.cast?.perfect ?? false, feedingSpot: this.inFeedingSpot(),
        });
        const factor = s.penalty && s.cast && s.penalty.zone === s.cast.zone ? this.b.bite.earlyStrike.biteRateFactor : 1;
        return { sum, factor };
      },
    };
  }

  private inFeedingSpot(): boolean {
    const s = this.state;
    return !!s.feedingSpot && !!s.cast && Math.abs(s.cast.distanceM - s.feedingSpot.distanceM) <= this.b.spawn.futterplatz.radiusM;
  }

  /** Kontext der Spawn-Formel zum aktuellen Zeitpunkt (auch fürs Debug-Menü). */
  spawnContext(): SpawnContext {
    const s = this.state;
    const lo = this.loadout();
    return {
      b: this.b, world: this.world, fish: this.worldFish, curios: this.data.gear.curios,
      phase: this.phase, weather: this.weather, events: this.events,
      depthM: s.baitDepthM, zone: s.cast?.zone ?? 'Ufer', bait: lo.bait, line: lo.line, leader: lo.leader,
      twitching: this.twitching, feedingSpot: this.inFeedingSpot(), pityCount: this.profile.pityCount,
      forceFishId: s.debug.forceFish, allowCurios: s.debug.forceFish === null,
    };
  }

  private stepInWater(dt: number, input: SessionInput): void {
    const s = this.state;
    const lo = this.loadout();
    const bite = s.bite;
    if (!bite) return;
    const waiting = bite.stage === 'wait';

    // Hänger (E W1): Köder steckt fest, Lösen per Takt-Tippen
    if (s.snag) {
      this.stepSnag(dt, input);
      return;
    }

    if (waiting) {
      // Sinken
      if (input.sink) {
        const r = sinkStep(s.baitDepthM, dt, lo.bait, lo.reel, this.world);
        if (r.lineTooShort && !s.lineTooShort) this.ev.push({ type: 'lineTooShort' });
        s.baitDepthM = r.depthM;
        s.lineTooShort = r.lineTooShort;
        this.setRodState('Sinking');
      } else {
        s.lineTooShort = false;
        this.setRodState('Waiting');
        if (this.maybeSnag()) return;
      }
      // Zucken (kurz antippen) bzw. Einholen (gehalten)
      if (input.reelPressed) {
        s.baitDepthM = twitchDepth(s.baitDepthM, this.b);
        s.twitchUntilS = s.timeS + this.b.depth.twitch.activeS;
        this.ev.push({ type: 'twitch' });
      }
      s.reelHeldS = input.reel ? s.reelHeldS + dt : 0;
      if (s.reelHeldS >= this.b.depth.twitch.activeS) {
        this.ev.push({ type: 'retrieved' });
        this.resetLine();
        this.setRodState('Idle');
        return;
      }
      // Füttern (Brotflocke; Futterplatz nur in W1 oder mit Futterkelle)
      if (input.feed && lo.bait.createsFeedingSpot && s.cast && this.canFeed() && this.consumeBait('used')) {
        s.feedingSpot = { distanceM: s.cast.distanceM, untilS: s.timeS + this.b.spawn.futterplatz.durationS };
        this.ev.push({ type: 'feed', untilS: s.feedingSpot.untilS });
      }
    }

    const be = stepBite(bite, dt, input.strike, this.biteDeps());
    for (const e of be) this.ev.push({ type: 'bite', e });
    if (bite.stage === 'approach') this.setRodState('Nibble');
    if (bite.stage === 'bite') this.setRodState('Bite');
    const res = bite.result;
    if (!res) return;
    if (res.type === 'early') {
      s.penalty = s.cast ? { zone: s.cast.zone, untilS: s.timeS + this.b.bite.earlyStrike.penaltyS } : null;
      this.ev.push({ type: 'scared', penaltyS: this.b.bite.earlyStrike.penaltyS });
      s.bite = createBite(this.biteDeps());
      this.setRodState('Waiting');
      return;
    }
    if (res.type === 'late') {
      this.consumeBait('used');
      this.escape('late', bite.target?.kind === 'fish' ? bite.target.fish : null, false);
      return;
    }
    // Anschlag sitzt
    const target = bite.target;
    if (!target || target.kind === 'none') { this.setRodState('Waiting'); s.bite = createBite(this.biteDeps()); return; }
    if (target.kind === 'curio') {
      this.consumeBait('used');
      this.profile.coins += target.coins;
      this.profile.curios[target.curio.id] = (this.profile.curios[target.curio.id] ?? 0) + 1;
      if (target.curio.reward === 'Hut' && target.curio.rewardRef && !this.profile.hats.includes(target.curio.rewardRef)) {
        this.profile.hats.push(target.curio.rewardRef);
      }
      s.lastCurio = { curio: target.curio, coins: target.coins };
      s.lastCatch = null;
      s.stats.curios++;
      this.ev.push({ type: 'curio', curio: target.curio, coins: target.coins });
      this.setRodState('Caught');
      return;
    }
    const fish = target.fish;
    if (toothedCut(fish, lo, this.b, this.fishRng)) {
      this.consumeBait('lost');
      this.escape('cut', fish, true);
      return;
    }
    const muBonus = (worksInWorld(lo.bait.worlds, this.world.id) ? lo.bait.sizeMuBonus : 0) + rodSizeMuBonus(lo.rod, this.world.id);
    const size = rollSize(fish, this.b, this.fishRng, muBonus);
    const perfectStrike = res.quality === 'perfect';
    s.hooked = { fish, size, perfectStrike };
    s.drill = createDrill(fish, lo, this.b, this.drillRng, {
      sizeX: size.x, perfectStrike, weather: this.weather, depthM: s.baitDepthM, world: this.world.id,
      forceBehavior: s.debug.forceBehavior, beginnerSaves: s.beginnerSaves, netSaves: s.netSaves,
    });
    this.ev.push({ type: 'hooked', fish, behavior: s.drill.behavior, sizeX: size.x });
    this.setRodState('Reeling');
  }

  private canFeed(): boolean {
    return this.world.mechanik === 'HaengerUndFutterplatz'
      || accessoryValue(this.loadout().accessories, 'FutterplatzUeberall', this.world.id) !== null;
  }

  /** Einmal je Wurf, sobald der Köder in der Uferzone oder im Krautfeld ruht: Hänger-Chance (E W1). */
  private maybeSnag(): boolean {
    const s = this.state;
    if (s.snagChecked || !s.cast || this.world.mechanik !== 'HaengerUndFutterplatz') return false;
    const inPlace = s.cast.zone === 'Ufer' || layerAt(this.world, s.baitDepthM) === 'Krautfeld';
    if (!inPlace) return false;
    s.snagChecked = true;
    if (this.fishRng.next() >= this.b.spawn.haenger.chance) return false;
    const easy = this.loadout().rod;
    const needed = (easy.abilityWorld === null || easy.abilityWorld === this.world.id
      ? easy.abilities.find((a) => a.ability === 'HaengerLeicht')?.value
      : undefined) ?? this.b.spawn.haenger.taps;
    s.snag = { count: 0, needed, sinceTap: 0 };
    this.ev.push({ type: 'snagged', tapsNeeded: needed });
    return true;
  }

  private stepSnag(dt: number, input: SessionInput): void {
    const s = this.state;
    const sn = s.snag;
    if (!sn) return;
    sn.sinceTap += dt;
    const H = this.b.spawn.haenger;
    const tooLate = sn.count > 0 && sn.sinceTap > H.tapIntervalS + H.tapToleranceS;
    if (input.reelPressed || tooLate) {
      const ok = !tooLate && (sn.count === 0 || Math.abs(sn.sinceTap - H.tapIntervalS) <= H.tapToleranceS);
      if (!ok) {
        // Fehlschlag kostet den Köder
        this.ev.push({ type: 'snagTap', ok: false, count: sn.count, needed: sn.needed });
        this.consumeBait('lost');
        this.resetLine();
        this.setRodState('Idle');
        return;
      }
      sn.count++;
      sn.sinceTap = 0;
      this.ev.push({ type: 'snagTap', ok: true, count: sn.count, needed: sn.needed });
      if (sn.count >= sn.needed) {
        s.snag = null;
        this.ev.push({ type: 'snagFreed' });
      }
    }
  }

  private stepReeling(dt: number, input: SessionInput): void {
    const s = this.state;
    const d = s.drill;
    if (!d || !s.hooked) return;
    const { events } = stepDrill(d, { reel: input.reel, steer: input.steer, rodUp: input.rodUp, tap: input.reelPressed }, dt);
    for (const e of events) this.ev.push({ type: 'drill', e });
    s.beginnerSaves = d.beginnerSaves;
    s.netSaves = d.netSaves;
    if (!d.outcome) return;
    if (d.outcome === 'caught') {
      this.consumeBait('used');
      this.finishCatch(d);
      return;
    }
    const lost = d.outcome === 'lineBreak' || d.outcome === 'heatBreak';
    this.consumeBait(lost ? 'lost' : 'used');
    this.escape(d.outcome, s.hooked.fish, true);
  }

  private finishCatch(d: DrillState): void {
    const s = this.state;
    const h = s.hooked;
    if (!h) return;
    const b = this.b;
    const lo = this.loadout();
    const fish = h.fish;
    const { size } = h;
    const grade = size.grade;
    const shiny = rollShiny(shinyChance({ b, world: this.world.id, bait: lo.bait, rod: lo.rod, hasWorldBadge: this.profile.badges.includes(this.world.id) }), this.fishRng);
    const nth = (s.speciesCount[fish.id] ?? 0) + 1;
    s.speciesCount[fish.id] = nth;
    const perfectCast = s.cast?.perfect ?? false;
    const points = scorePoints({
      basePoints: fish.basePoints, grade, shiny, masterDrill: d.masterDrill, perfectCast, perfectStrike: h.perfectStrike,
      nthOfSpecies: nth, finale: false, competition: this.opts.competition ?? false,
    }, b);
    const lex = recordCatch(this.profile.lexicon, { fishId: fish.id, lengthCm: size.lengthCm, weightG: size.weightG, grade, shiny });
    const xp = catchXp(fish, lex.isNew, b);
    const levelBefore = this.level;
    this.profile.xp += xp;
    const pearls = shiny ? b.shiny.pearls : 0;
    this.profile.pearls += pearls;
    this.profile.pityCount = nextPityCount(this.profile.pityCount, fish.rarity);
    this.profile.catchCounter++;
    const record: CatchRecord = {
      uid: `c${this.profile.catchCounter}`, fishId: fish.id, lengthCm: size.lengthCm, weightG: size.weightG, sizeX: size.x, grade,
      shiny, points, value: sellValue(fish.basePoints, grade, shiny, b), xp, isNew: lex.isNew, isRecord: lex.isRecord,
      masterDrill: d.masterDrill, perfectCast, perfectStrike: h.perfectStrike,
    };
    this.profile.bucket.push(record);
    s.lastCatch = record;
    s.lastCurio = null;
    s.stats.catches++;
    s.stats.points += points;
    this.ev.push({ type: 'caught', record, fish, levelUp: this.level > levelBefore, pearls });
    this.setRodState('Caught');
  }

  private escape(reason: EscapeReason, fish: FishData | null, seen: boolean): void {
    const s = this.state;
    if (fish && seen) markSeen(this.profile.lexicon, fish.id);
    s.lastEscape = { reason, fish };
    s.stats.escapes++;
    this.ev.push({ type: 'escaped', reason, fish });
    this.setRodState('Escaped');
  }

  /**
   * Köder verbrauchen. 'used' (Fang, zu spät, Füttern): Verbrauchsköder −1. 'lost' (Schnurriss, Abbiss, Hänger):
   * auch Dauerköder (Blinker, Wobbler) −1. Unendliche Köder nie. Bei 0 → erster unendlicher Köder.
   */
  private consumeBait(kind: 'used' | 'lost'): boolean {
    const bait = this.loadout().bait;
    if (bait.infinite) return true;
    if (kind === 'used' && bait.reusable) return true;
    const have = this.profile.baits[bait.id] ?? 0;
    if (have <= 0) return false;
    this.profile.baits[bait.id] = have - 1;
    if (kind === 'lost') this.ev.push({ type: 'baitLost', baitId: bait.id });
    if (have - 1 <= 0) {
      const fallback = this.data.gear.baits.find((x) => x.infinite);
      if (fallback) {
        this.profile.loadout.bait = fallback.id;
        this.ev.push({ type: 'baitEmpty', baitId: bait.id, switchedTo: fallback.id });
      }
    }
    return true;
  }

  private resetLine(): void {
    const s = this.state;
    Object.assign(s, { cast: null, bite: null, drill: null, hooked: null, snag: null, baitDepthM: 0, lineTooShort: false, reelHeldS: 0, twitchUntilS: -1 });
  }

  // ---------------------------------------------------------------- Aktionen aus Menüs

  /** Fang-Karte / Verlust-Meldung geschlossen → Idle. */
  acknowledge(): void {
    if (this.state.rodState !== 'Caught' && this.state.rodState !== 'Escaped') return;
    this.resetLine();
    this.setRodState('Idle');
  }

  /** Alles aus dem Fangeimer verkaufen (D 3.2). */
  sellAll(): number {
    const coins = this.profile.bucket.reduce((sum, c) => sum + c.value, 0);
    const count = this.profile.bucket.length;
    this.profile.coins += coins;
    this.profile.bucket = [];
    this.ev.push({ type: 'sold', coins, count });
    return coins;
  }

  /** Einen Fang verkaufen. */
  sell(uid: string): number {
    const i = this.profile.bucket.findIndex((c) => c.uid === uid);
    if (i < 0) return 0;
    const [c] = this.profile.bucket.splice(i, 1);
    const coins = c?.value ?? 0;
    this.profile.coins += coins;
    this.ev.push({ type: 'sold', coins, count: 1 });
    return coins;
  }

  /** Köder wechseln (nur außerhalb des Wassers, nur vorhandene). */
  setBait(id: string): boolean {
    const bait = this.data.gear.baits.find((x) => x.id === id);
    if (!bait || (!bait.infinite && (this.profile.baits[id] ?? 0) <= 0)) return false;
    if (this.state.rodState !== 'Idle') return false;
    this.profile.loadout.bait = id;
    return true;
  }

  // ---------------------------------------------------------------- Debug-Hooks (Debug-Menü, Tests)

  debugForceFish(id: FishId | null): void { this.state.debug.forceFish = id; }
  debugForceBehavior(b: FightBehavior | null): void { this.state.debug.forceBehavior = b; }
  debugSetWeather(w: ActiveWeather, fixed = true): void {
    for (const e of setWeather(this.clock, w, this.b, this.clockRng, fixed)) this.ev.push({ type: 'clock', e });
  }
  debugSetPhase(p: DayPhase): void { for (const e of setPhase(this.clock, p, this.b)) this.ev.push({ type: 'clock', e }); }
  debugForceEvent(e: WorldEvent, on: boolean): void { forceEvent(this.clock, e, on); }
}
