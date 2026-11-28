// src/net/host.ts – Host-Logik „Wettangeln“ (B4, D 2.1–2.6). Läuft im Browser des Gastgebers, reine Logik:
// kein Phaser, kein DOM; Zeit kommt über `now()`, Netz über das `Transport`-Interface.
//
// Der Host nimmt Absichten an (`cast`, `lure`, `strike`, `retrieve`, `reel`, `reelResult`), prüft Phase,
// Abklingzeit, Reichweite und Plausibilität und würfelt Spawn, Biss, Größe und Schillernd mit seedbarem Zufall über
// die vorhandenen src/game-Funktionen. Clients erfahren die Fischart erst mit `catch`.
import { Rng, hashSeed } from '../core/random';
import type { FishData, FishId, WorldId } from '../data/types';
import { createBite, judgeStrike, stepBite, toothedCut, type BiteDeps, type BiteState } from '../game/bite';
import { resolveCast, type CastResult } from '../game/cast';
import { activeEvents, createClock, phaseAt, stepClock, type ClockState } from '../game/clock';
import { depthLimitM, sinkSpeedMs, twitchDepth } from '../game/depth';
import type { LoadoutIds } from '../game/save';
import { scorePoints } from '../game/score';
import type { RodState } from '../game/session';
import { createShadowSim, stepShadows, type ShadowParams, type ShadowSim } from '../game/shadows';
import { rollShiny, shinyChance } from '../game/shiny';
import { rollSize, type SizeRoll } from '../game/size';
import { biteRateBonus, nextPityCount, rollSpawn, type SpawnContext } from '../game/spawn';
import {
  byId, rodSizeMuBonus, worksInWorld, worldById, accessoryValue,
  type ActiveWeather, type DayPhase, type GameData, type Loadout, type WorldDbEntry, type Zone,
} from '../game/types';
import { netConfigFrom, type NetConfig } from './config';
import { minDrillS, specFromFish } from './drillSpec';
import {
  applyEquipmentRule, allReady, checkSettings, decideJoin, defaultSettings, unlockedUnion, type SettingsProblem,
} from './lobby';
import {
  Outbox, isForMe,
  type CatchData, type DataOf, type DrillSpec, type JoinData, type LobbySettings, type MessageOf, type MessageType,
  type NetMessage, type PlayerId, type RodReason, type RoundData, type ScoresData, type ResultsData, type PhaseEndData,
} from './messages';
import { roundResults, tailwindEffect, tailwindLevel, type PlayerTally, type TailwindLevel } from './results';
import {
  abortRound, canCast, canReel, cancelCountdown, createRound, finaleActive, scoresHidden, startCountdown, tickRound,
  type PhaseChange, type RoundState, type RoundTimings,
} from './round';
import type { PresenceState, Transport, Unsubscribe } from './transport';

// ------------------------------------------------------------------ Typen

export interface HostOptions {
  transport: Transport;
  data: GameData;
  /** Saat aller Würfe dieses Raums (Determinismus) */
  seed: number;
  /** Host-Uhr in ms */
  now: () => number;
  /** Schatten-Simulation (Bereich in Metern, Tempo, Lebenszeit) – kommt aus der Welt-Szene */
  shadows: ShadowParams;
  cfg?: NetConfig;
  world?: WorldId;
  settings?: Partial<LobbySettings>;
  /** Ausrüstungsregel: Deckel-Stufe je Welt und Leih-Set (fehlen noch in den Daten) */
  equipment?: { tierCap?: (w: WorldId) => number | null; loan?: LoadoutIds | null };
  /** Grund an einer Wurfweite (m), falls die Szene eine Karte hat */
  bottomDepthAt?: (distanceM: number) => number;
  /** zusätzlich erlaubte Rundendauern (nur Tests/Debug, z. B. `?testdauer=90`) */
  extraDurationsS?: readonly number[];
}

interface Hooked {
  fish: FishData;
  size: SizeRoll;
  spec: DrillSpec;
  seed: number;
  perfectStrike: boolean;
  startAt: number;
  reelCount: number;
  lastReelAt: number;
}

interface Line {
  rod: RodState;
  cast: CastResult | null;
  castAt: number;
  depthM: number;
  depthAt: number;
  twitchUntil: number;
  penalty: { zone: Zone; until: number } | null;
  bite: BiteState | null;
  biteAt: number;
  hooked: Hooked | null;
}

interface HostPlayer {
  id: PlayerId;
  join: JoinData;
  order: number;
  ready: boolean;
  connected: boolean;
  seenInPresence: boolean;
  ids: LoadoutIds;
  loadout: Loadout;
  // Rundenstand (gehört zur Spieler-ID, nicht zur Verbindung)
  points: number;
  catches: CatchData[];
  species: Partial<Record<FishId, number>>;
  caughtNow: Set<FishId>;
  lineBreaks: number;
  pity: number;
  beginnerSaves: number;
  netSaves: number;
  tailwind: TailwindLevel;
  line: Line;
  rngFish: Rng;
  rngDrill: Rng;
}

/** Ergebnis einer Runde für die Edge Function `submit-round` (Teil B). */
export interface RoundReport {
  runde: number;
  welt: WorldId;
  modus: LobbySettings['modus'];
  dauerS: number;
  fishingStart: number;
  fishingEnd: number;
  spieler: { id: PlayerId; gast: boolean; punkte: number; platz: number; muenzen: number; pity: number; faenge: CatchData[] }[];
}

/** Gründe, warum der Host eine Absicht abgelehnt hat (Debug/Tests). */
export interface Rejection { at: number; from: PlayerId; type: MessageType; reason: RodReason | SettingsProblem | string }

const freshLine = (): Line => ({
  rod: 'Idle', cast: null, castAt: -Infinity, depthM: 0, depthAt: 0, twitchUntil: -Infinity, penalty: null, bite: null, biteAt: 0, hooked: null,
});

const IN_WATER: ReadonlySet<RodState> = new Set<RodState>(['Sinking', 'Waiting', 'Nibble', 'Bite', 'Reeling']);
const CAN_CAST_FROM: ReadonlySet<RodState> = new Set<RodState>(['Idle', 'Caught', 'Escaped']);

// ------------------------------------------------------------------ Host

export class NetHost {
  readonly cfg: NetConfig;
  readonly id: PlayerId;
  private readonly out: Outbox;
  private readonly data: GameData;
  private readonly t: Transport;
  private readonly opts: HostOptions;
  private round: RoundState = createRound();
  private settings: LobbySettings;
  private players = new Map<PlayerId, HostPlayer>();
  private orderCounter = 0;
  private world: WorldDbEntry;
  private clock: ClockState | null = null;
  private clockRng = new Rng(1);
  private shadowSim: ShadowSim = createShadowSim();
  private shadowRng = new Rng(1);
  private shadowAcc = 0;
  private lastTick: number;
  private hiddenSent = false;
  private lastResults: ResultsData | null = null;
  private report: RoundReport | null = null;
  private subs: Unsubscribe[] = [];
  private isClosed = false;
  readonly rejections: Rejection[] = [];

  constructor(opts: HostOptions) {
    this.opts = opts;
    this.t = opts.transport;
    this.id = opts.transport.selfId;
    this.data = opts.data;
    this.cfg = opts.cfg ?? netConfigFrom(opts.data.balancing);
    this.out = new Outbox(this.id, opts.now);
    const w = opts.world ?? 'W1';
    this.settings = { ...defaultSettings(this.cfg, w), ...opts.settings };
    this.world = worldById(this.data.worlds, this.settings.welt);
    this.lastTick = opts.now();
    this.subs.push(this.t.onMessage((m) => this.receive(m)));
    this.subs.push(this.t.onSync((p) => this.onPresence(p)));
    this.t.track({ id: this.id, host: true });
  }

  get b() { return this.data.balancing; }
  get phase() { return this.round.phase; }
  get roundState(): Readonly<RoundState> { return this.round; }
  get lobbySettings(): Readonly<LobbySettings> { return this.settings; }
  get lastReport(): RoundReport | null { return this.report; }
  get results(): ResultsData | null { return this.lastResults; }
  get weather(): ActiveWeather | null { return this.clock?.weather ?? null; }

  /** Punkte je Spieler (Debug/Tests; immer unverdeckt). */
  pointsById(): Record<PlayerId, number> {
    return Object.fromEntries([...this.players.values()].map((p) => [p.id, p.points]));
  }

  playerIds(): PlayerId[] { return this.sortedPlayers().map((p) => p.id); }

  // ---------------------------------------------------------------- Senden

  private send<T extends MessageType>(type: T, data: DataOf<T>, to?: PlayerId): MessageOf<T> {
    const m = this.out.make(type, data, to);
    if (!this.isClosed) this.t.broadcast(m);
    return m;
  }

  private reject(from: PlayerId, type: MessageType, reason: Rejection['reason']): void {
    this.rejections.push({ at: this.opts.now(), from, type, reason });
  }

  private rodState(p: HostPlayer, zustand: RodState, extra: Partial<DataOf<'rodState'>> = {}): void {
    p.line.rod = zustand;
    this.send('rodState', { spieler: p.id, zustand, ...extra });
  }

  // ---------------------------------------------------------------- Einstellungen (Host-UI)

  /** Einstellung ändern; null = übernommen, sonst Grund der Ablehnung. */
  setSettings(patch: Partial<LobbySettings>): SettingsProblem | null {
    const next = { ...this.settings, ...patch };
    const problem = checkSettings(next, this.round.phase, this.cfg, this.unlockedWorlds(), this.opts.extraDurationsS);
    if (problem) { this.reject(this.id, 'round', problem); return problem; }
    this.settings = next;
    this.world = worldById(this.data.worlds, next.welt);
    for (const p of this.players.values()) this.applyLoadout(p);
    this.sendRound();
    return null;
  }

  private unlockedWorlds(): WorldId[] {
    const lists = [...this.players.values()].map((p) => p.join.welten);
    const u = unlockedUnion(lists);
    return u.length > 0 ? u : [this.settings.welt];
  }

  private applyLoadout(p: HostPlayer): void {
    const eq = this.opts.equipment;
    p.ids = applyEquipmentRule(this.settings.ausruestung, p.join.ausruestung, this.data.gear, {
      tierCap: eq?.tierCap?.(this.settings.welt) ?? null, loan: eq?.loan ?? null,
    });
    const g = this.data.gear;
    p.loadout = {
      rod: byId(g.rods, p.ids.rod, 'Rute'), line: byId(g.lines, p.ids.line, 'Schnur'),
      leader: p.ids.leader ? byId(g.lines, p.ids.leader, 'Vorfach') : null,
      reel: byId(g.reels, p.ids.reel, 'Rolle'), bait: byId(g.baits, p.ids.bait, 'Köder'),
      accessories: p.ids.accessories.map((id) => byId(g.accessories, id, 'Zubehör')),
    };
  }

  // ---------------------------------------------------------------- Empfang

  /** Eine Nachricht verarbeiten (vom Transport oder direkt in Tests). */
  receive(m: NetMessage): void {
    // Der eigene Client im Host-Tab schickt mit derselben ID; er ist ein normaler Spieler (Beitritt per `join`).
    if (this.isClosed || !isForMe(m, this.id)) return;
    const now = this.opts.now();
    switch (m.type) {
      case 'join': this.onJoin(m, now); return;
      case 'ping': this.send('pong', { t0: m.data.t0, t1: now }, m.from); return;
      default: break;
    }
    const p = this.players.get(m.from);
    if (!p) return;
    switch (m.type) {
      case 'ready': this.onReady(p, m.data.bereit, now); break;
      case 'leave': this.onLeave(p, now); break;
      case 'cast': this.onCast(p, m.data, now); break;
      case 'lure': this.onLure(p, m.data, now); break;
      case 'strike': this.onStrike(p, m.data.reaktion, now); break;
      case 'retrieve': this.onRetrieve(p); break;
      case 'reel':
        if (p.line.rod === 'Reeling' && p.line.hooked) { p.line.hooked.reelCount++; p.line.hooked.lastReelAt = now; }
        break;
      case 'reelResult': this.onReelResult(p, m.data, now); break;
      case 'pos': this.onPos(p, m.data); break;
      default: break; // emote: nur Anzeige bei den Clients; Host-Nachrichten von anderen werden ignoriert
    }
  }

  private onPresence(peers: PresenceState[]): void {
    const ids = new Set(peers.map((p) => p.id));
    let changed = false;
    for (const p of this.players.values()) {
      if (ids.has(p.id)) {
        if (!p.seenInPresence || !p.connected) changed = true;
        p.seenInPresence = true;
        p.connected = true;
      } else if (p.seenInPresence && p.connected) {
        p.connected = false;
        if (this.round.phase === 'Lobby') p.ready = false;
        changed = true;
      }
    }
    if (changed) { this.sendRound(); this.checkAutoStart(this.opts.now()); }
  }

  private onJoin(m: MessageOf<'join'>, now: number): void {
    const known = new Set(this.players.keys());
    const d = decideJoin(m.from, known, this.round.phase, this.players.size, this.cfg);
    if (d === 'gesperrt' || d === 'voll') { this.send('deny', { grund: d }, m.from); this.reject(m.from, 'join', d); return; }
    let p = this.players.get(m.from);
    if (!p) {
      p = {
        id: m.from, join: m.data, order: this.orderCounter++, ready: false, connected: true, seenInPresence: false,
        ids: m.data.ausruestung, loadout: null as unknown as Loadout,
        points: 0, catches: [], species: {}, caughtNow: new Set(), lineBreaks: 0, pity: m.data.pity,
        beginnerSaves: 0, netSaves: 0, tailwind: 0, line: freshLine(),
        rngFish: new Rng(hashSeed(`${this.opts.seed}:${m.from}:fish`)), rngDrill: new Rng(hashSeed(`${this.opts.seed}:${m.from}:drill`)),
      };
      this.players.set(m.from, p);
      this.applyLoadout(p);
    } else {
      // Wiederkehr (Reconnect, B4): Punkte bleiben; Lobby-Angaben dürfen sich ändern, Rundenwerte nicht
      p.connected = true;
      if (this.round.phase === 'Lobby') { p.join = m.data; p.pity = m.data.pity; this.applyLoadout(p); }
      else p.join = { ...p.join, name: m.data.name, hut: m.data.hut, boot: m.data.boot };
      // Resync/Reconnect mit erhaltenem Client-Stand: Angel bleibt, Drill nur, wenn der Client ihn noch hat
      const keep = m.data.aktiv !== null && (p.line.rod !== 'Reeling' || m.data.aktiv === 'Reeling');
      if (IN_WATER.has(p.line.rod) && !keep) {
        p.line = { ...freshLine(), castAt: p.line.castAt };
        p.line.rod = 'Idle';
        this.send('rodState', { spieler: p.id, zustand: 'Idle', grund: 'neuVerbunden' });
      }
    }
    this.send('sync', this.snapshot(p), m.from);
    this.sendRound();
    this.checkAutoStart(now);
  }

  private onReady(p: HostPlayer, ready: boolean, now: number): void {
    if (this.round.phase !== 'Lobby' && this.round.phase !== 'Countdown') return;
    if (p.ready === ready) return;
    p.ready = ready;
    if (!ready && this.round.phase === 'Countdown') this.applyChanges(cancelCountdown(this.round, now));
    this.sendRound();
    this.checkAutoStart(now);
  }

  private onLeave(p: HostPlayer, now: number): void {
    if (this.round.phase === 'Lobby') {
      this.players.delete(p.id);
    } else {
      p.connected = false;
    }
    this.sendRound();
    this.checkAutoStart(now);
  }

  private checkAutoStart(now: number): void {
    if (this.round.phase !== 'Lobby') return;
    const list = [...this.players.values()];
    if (!allReady(list, this.cfg)) return;
    this.applyChanges(startCountdown(this.round, now, this.timings()));
  }

  private timings(): RoundTimings {
    return {
      countdownS: this.cfg.round.countdownS, durationS: this.settings.dauerS, finaleS: this.b.score.finale.lastS,
      lastCastS: this.cfg.round.lastCastS, resultsS: this.cfg.round.resultsS,
    };
  }

  // ---------------------------------------------------------------- Absichten

  private onCast(p: HostPlayer, d: DataOf<'cast'>, now: number): void {
    if (!canCast(this.round.phase) || !this.clock) { this.reject(p.id, 'cast', 'phase'); return this.denyRod(p, 'phase'); }
    if (!CAN_CAST_FROM.has(p.line.rod)) { this.reject(p.id, 'cast', 'zustand'); return; }
    if (now - p.line.castAt < this.cfg.host.castCooldownS * 1000) { this.reject(p.id, 'cast', 'abklingzeit'); return this.denyRod(p, 'abklingzeit'); }
    const result = resolveCast({ power: d.kraft, rod: p.loadout.rod, world: this.world, weather: this.clock.weather, windDir: this.clock.windDir, b: this.b });
    if (d.ziel > result.maxDistanceM * (1 + this.cfg.host.castRangeTolerance)) { this.reject(p.id, 'cast', 'reichweite'); return this.denyRod(p, 'reichweite'); }
    p.line = { ...freshLine(), cast: result, castAt: now, depthAt: now };
    p.line.bite = createBite(this.biteDeps(p));
    this.rodState(p, 'Waiting', { wurf: { weite: result.distanceM, zone: result.zone, perfekt: result.perfect, fehl: result.miss } });
  }

  private denyRod(p: HostPlayer, grund: RodReason): void {
    // Rute bleibt, wo sie ist; der Client erfährt den Grund
    this.send('rodState', { spieler: p.id, zustand: p.line.rod, grund });
  }

  private onLure(p: HostPlayer, d: DataOf<'lure'>, now: number): void {
    const L = p.line;
    if (!L.cast || !L.bite || L.bite.stage !== 'wait' || (L.rod !== 'Waiting' && L.rod !== 'Sinking')) return;
    const limit = Math.min(depthLimitM(p.loadout.reel, this.world), this.opts.bottomDepthAt?.(L.cast.distanceM) ?? Infinity);
    const maxBySpeed = L.depthM + sinkSpeedMs(p.loadout.bait, p.loadout.reel, this.world) * Math.max(0, now - L.depthAt) / 1000 + this.cfg.host.depthToleranceM;
    let depth = Math.min(d.tiefe, limit, maxBySpeed);
    if (d.tiefe > maxBySpeed + 1e-9) this.reject(p.id, 'lure', 'unplausibel');
    if (d.zucken) {
      depth = Math.min(depth, twitchDepth(L.depthM, this.b) + this.cfg.host.depthToleranceM);
      L.twitchUntil = now + this.b.depth.twitch.activeS * 1000;
    }
    L.depthM = Math.max(0, depth);
    L.depthAt = now;
  }

  private onRetrieve(p: HostPlayer): void {
    if (!IN_WATER.has(p.line.rod) || p.line.rod === 'Reeling' || p.line.rod === 'Bite') return;
    p.line = { ...freshLine(), castAt: p.line.castAt };
    this.rodState(p, 'Idle', { grund: 'eingeholt' });
  }

  private onStrike(p: HostPlayer, reaction: number | null, now: number): void {
    const L = p.line;
    const bite = L.bite;
    if (!bite || !L.cast) return;
    if (bite.stage === 'wait' || bite.stage === 'approach') {
      // Zu früh (D 1.5): Fisch verscheucht, Bissrate in dieser Zone 5 s gesenkt
      if (bite.stage === 'wait') return; // noch gar nichts da → wirkungslos
      L.penalty = { zone: L.cast.zone, until: now + this.b.bite.earlyStrike.penaltyS * 1000 };
      L.bite = createBite(this.biteDeps(p));
      this.rodState(p, 'Waiting', { grund: 'zuFrueh' });
      return;
    }
    if (bite.stage !== 'bite' || L.rod !== 'Bite') return;
    const elapsed = (now - L.biteAt) / 1000;
    const window = bite.windowS;
    if (elapsed > window + this.cfg.host.strikeGraceS) return this.lateStrike(p);
    // Reaktion: nie schneller als minReaction, nie länger als der Host tatsächlich gewartet hat
    const r = Math.min(Math.max(reaction ?? elapsed, this.cfg.host.minReactionS), elapsed);
    const q = judgeStrike(r, window, this.b);
    if (q === 'late') return this.lateStrike(p);
    const target = bite.target;
    bite.stage = 'done';
    if (!target || target.kind !== 'fish' || !L.hooked) { L.bite = createBite(this.biteDeps(p)); this.rodState(p, 'Waiting'); return; }
    if (toothedCut(target.fish, p.loadout, this.b, p.rngFish)) {
      L.hooked = null;
      this.rodState(p, 'Escaped', { grund: 'abbiss' });
      return;
    }
    L.hooked.perfectStrike = q === 'perfect';
    L.hooked.startAt = now;
    L.hooked.lastReelAt = now;
    this.rodState(p, 'Reeling', { perfekt: q === 'perfect' });
  }

  private lateStrike(p: HostPlayer): void {
    p.line.hooked = null;
    if (p.line.bite) p.line.bite.stage = 'done';
    this.rodState(p, 'Escaped', { grund: 'zuSpaet' });
  }

  private onReelResult(p: HostPlayer, d: DataOf<'reelResult'>, now: number): void {
    const L = p.line;
    const h = L.hooked;
    if (L.rod !== 'Reeling' || !h) return;
    const usedBeginner = Math.min(d.anfaenger, p.beginnerSaves);
    const usedNet = Math.min(d.kescher, p.netSaves);
    if (d.ergebnis !== 'caught') {
      p.beginnerSaves -= usedBeginner;
      p.netSaves -= usedNet;
      if (d.ergebnis === 'lineBreak' || d.ergebnis === 'heatBreak') p.lineBreaks++;
      L.hooked = null;
      this.rodState(p, 'Escaped', { grund: d.ergebnis });
      return;
    }
    const why = this.implausible(p, h, d, now);
    if (why) {
      this.reject(p.id, 'reelResult', why);
      L.hooked = null;
      this.rodState(p, 'Escaped', { grund: 'unplausibel' });
      return;
    }
    p.beginnerSaves -= usedBeginner;
    p.netSaves -= usedNet;
    this.finishCatch(p, h, d.meister, now);
  }

  /** Plausibilität eines gemeldeten Fangs; null = in Ordnung, sonst Grund. */
  private implausible(p: HostPlayer, h: Hooked, d: DataOf<'reelResult'>, now: number): string | null {
    if (!canReel(this.round.phase)) return 'phase';
    const min = minDrillS(h.spec, h.fish.primaryBehavior, h.perfectStrike, p.loadout.reel, this.b) * this.cfg.host.drillMinFactor;
    const observed = (now - h.startAt) / 1000;
    if (observed < min) return `zuKurz:${observed.toFixed(2)}<${min.toFixed(2)}`;
    if (d.dauer < min) return `dauer:${d.dauer.toFixed(2)}<${min.toFixed(2)}`;
    const expected = Math.floor(min / this.cfg.msg.reelIntervalS);
    if (h.reelCount < Math.floor(expected * this.cfg.host.reelCountFactor)) return `reel:${h.reelCount}<${expected}`;
    if (d.anfaenger > p.beginnerSaves || d.kescher > p.netSaves) return 'rettungen';
    return null;
  }

  private onPos(p: HostPlayer, d: DataOf<'pos'>): void {
    if (d.spieler !== p.id) return;
    const s = this.opts.shadows;
    const x = Math.min(s.maxXM, Math.max(s.minXM, d.x));
    if (x !== d.x) this.send('pos', { spieler: p.id, x });
  }

  // ---------------------------------------------------------------- Biss & Fang

  private spawnContext(p: HostPlayer): SpawnContext {
    const c = this.clock as ClockState;
    const L = p.line;
    const now = this.opts.now();
    return {
      b: this.b, world: this.world, fish: this.worldFish(), curios: this.data.gear.curios,
      phase: phaseAt(c.dayTimeS, this.b), weather: c.weather, events: activeEvents(c, this.world, this.b),
      depthM: L.depthM, zone: L.cast?.zone ?? 'Ufer', bait: p.loadout.bait, line: p.loadout.line, leader: p.loadout.leader,
      twitching: now < L.twitchUntil, feedingSpot: false, pityCount: p.pity,
      // Fundstücke gibt es im Wettkampf nicht (eigene Wahl; Treibgut-Kisten kommen mit den Items in Phase 4)
      allowCurios: false,
    };
  }

  private fishCache: FishData[] | null = null;
  private fishCacheWorld: WorldId | null = null;
  private worldFish(): FishData[] {
    if (this.fishCacheWorld !== this.world.id || !this.fishCache) {
      this.fishCache = this.data.fish.filter((f) => f.world === this.world.id);
      this.fishCacheWorld = this.world.id;
    }
    return this.fishCache;
  }

  private biteDeps(p: HostPlayer): BiteDeps {
    const tw = tailwindEffect(p.tailwind, this.b);
    return {
      b: this.b, rng: p.rngFish, rod: p.loadout.rod, nibbleReduction: tw.nibbleReduction,
      roll: () => rollSpawn(this.spawnContext(p), p.rngFish),
      biteRate: () => {
        const c = this.clock as ClockState;
        const L = p.line;
        const sum = biteRateBonus({
          b: this.b, world: this.world, weather: c.weather, events: activeEvents(c, this.world, this.b),
          bait: p.loadout.bait, line: p.loadout.line, leader: p.loadout.leader,
          perfectCast: L.cast?.perfect ?? false, feedingSpot: false, extra: tw.biteRate,
        });
        const pen = L.penalty && L.cast && L.penalty.zone === L.cast.zone && this.opts.now() < L.penalty.until;
        return { sum, factor: pen ? this.b.bite.earlyStrike.biteRateFactor : 1 };
      },
    };
  }

  private stepLine(p: HostPlayer, dt: number, now: number): void {
    const L = p.line;
    if (L.rod === 'Bite' && L.bite) {
      if ((now - L.biteAt) / 1000 > L.bite.windowS + this.cfg.host.strikeGraceS) this.lateStrike(p);
      return;
    }
    if (L.rod === 'Reeling' && L.hooked) {
      if (now - L.hooked.lastReelAt > this.cfg.host.reelTimeoutS * 1000) {
        L.hooked = null;
        this.rodState(p, 'Escaped', { grund: 'zeitUeberschritten' });
      }
      return;
    }
    if (!L.bite || (L.rod !== 'Waiting' && L.rod !== 'Sinking' && L.rod !== 'Nibble') || !canCast(this.round.phase)) return;
    if (L.penalty && now >= L.penalty.until) L.penalty = null;
    const ev = stepBite(L.bite, dt, false, this.biteDeps(p));
    for (const e of ev) {
      if (e.type === 'nibble') this.rodState(p, 'Nibble', { n: e.index });
      else if (e.type === 'fakeBite') this.rodState(p, 'Nibble', { schein: true });
      else if (e.type === 'bite') this.sendBite(p, now);
    }
  }

  private sendBite(p: HostPlayer, now: number): void {
    const L = p.line;
    const target = L.bite?.target;
    if (!L.bite || !target || target.kind !== 'fish') { L.bite = createBite(this.biteDeps(p)); return; }
    const fish = target.fish;
    const lo = p.loadout;
    const mu = (worksInWorld(lo.bait.worlds, this.world.id) ? lo.bait.sizeMuBonus : 0) + rodSizeMuBonus(lo.rod, this.world.id);
    const size = rollSize(fish, this.b, p.rngFish, mu);
    const spec = specFromFish(fish, size.x, this.b);
    const seed = Math.floor(p.rngDrill.next() * 2 ** 31);
    L.hooked = { fish, size, spec, seed, perfectStrike: false, startAt: now, reelCount: 0, lastReelAt: now };
    L.biteAt = now;
    L.rod = 'Bite';
    this.send('bite', {
      spieler: p.id, verhalten: fish.primaryBehavior, schwierigkeit: spec, seed,
      schutz: { anfaenger: p.beginnerSaves, kescher: p.netSaves },
    });
  }

  private finishCatch(p: HostPlayer, h: Hooked, master: boolean, now: number): void {
    const b = this.b;
    const lo = p.loadout;
    const fish = h.fish;
    const shiny = rollShiny(shinyChance({ b, world: this.world.id, bait: lo.bait, rod: lo.rod, hasWorldBadge: p.join.abzeichen.includes(this.world.id) }), p.rngFish);
    const nth = (p.species[fish.id] ?? 0) + 1;
    p.species[fish.id] = nth;
    const finale = finaleActive(this.round.phase);
    const perfectCast = p.line.cast?.perfect ?? false;
    const points = scorePoints({
      basePoints: fish.basePoints, grade: h.size.grade, shiny, masterDrill: master, perfectCast, perfectStrike: h.perfectStrike,
      nthOfSpecies: nth, finale, competition: true,
    }, b);
    p.points += points;
    p.pity = nextPityCount(p.pity, fish.rarity);
    p.caughtNow.add(fish.id);
    const c: CatchData = {
      spieler: p.id, id: fish.id, nr: fish.lexiconNumber, laenge: round1(h.size.lengthCm), gewicht: Math.round(h.size.weightG),
      groesse: h.size.grade, schillernd: shiny, punkte: points, finale, meister: master, perfekterWurf: perfectCast,
      perfekterAnschlag: h.perfectStrike, t: now,
    };
    p.catches.push(c);
    p.line.hooked = null;
    p.line.rod = 'Caught';
    const hidden = this.hidden(now);
    this.send('catch', hidden ? { ...c, punkte: null } : c);
    this.updateTailwind();
    this.sendScores(now);
  }

  private hidden(now: number): boolean { return scoresHidden(this.round, now, this.b.catchup.hiddenScoreLastS); }

  private updateTailwind(): void {
    const lead = Math.max(0, ...[...this.players.values()].map((p) => p.points));
    for (const p of this.players.values()) p.tailwind = tailwindLevel(p.points, lead, this.b);
  }

  // ---------------------------------------------------------------- Zeit

  /** Regelmäßig aufrufen (z. B. alle 50 ms). */
  tick(): void {
    if (this.isClosed) return;
    const now = this.opts.now();
    const dt = Math.max(0, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.applyChanges(tickRound(this.round, now));
    const ph = this.round.phase;
    if (ph === 'Fishing' || ph === 'Finale' || ph === 'LastCast') {
      this.stepWorld(dt);
      for (const p of this.sortedPlayers()) this.stepLine(p, dt, now);
      if (!this.hiddenSent && this.hidden(now)) { this.hiddenSent = true; this.sendScores(now); }
    }
  }

  private stepWorld(dt: number): void {
    const c = this.clock;
    if (!c) return;
    let changed = false;
    for (const e of stepClock(c, dt, this.world, this.b, this.clockRng)) if (e.type !== 'lightning') changed = true;
    if (changed) this.sendRound();
    const ref = this.sortedPlayers()[0];
    if (!ref) return;
    stepShadows(this.shadowSim, dt, { ...this.spawnContext(ref), forceFishId: null }, this.opts.shadows, this.shadowRng);
    this.shadowAcc += dt;
    if (this.shadowAcc >= this.cfg.msg.shadowsIntervalS) {
      this.shadowAcc %= this.cfg.msg.shadowsIntervalS;
      this.sendShadows();
    }
  }

  private sendShadows(): void {
    const players = this.sortedPlayers();
    const s = this.shadowSim.shadows.slice(0, 64).map((sh) => {
      let mask = 0;
      players.forEach((p, i) => { if (p.join.bekannt.includes(sh.fishId) || p.caughtNow.has(sh.fishId)) mask |= 1 << i; });
      return [sh.id, sh.sizeClass, Math.round(sh.xM * 10), Math.round(sh.depthM * 10), Math.round(sh.speedMs * 100), mask] as [number, typeof sh.sizeClass, number, number, number, number];
    });
    this.send('shadows', { s });
  }

  private applyChanges(step: { state: RoundState; changes: PhaseChange[] }): void {
    this.round = step.state;
    for (const ch of step.changes) this.onPhase(ch);
    if (step.changes.length > 0) this.sendPhase();
  }

  private onPhase(ch: PhaseChange): void {
    const now = ch.at;
    switch (ch.to) {
      case 'Countdown': this.resetRoundStats(); this.sendRound(); break;
      case 'Fishing': case 'Finale':
        if (ch.from === 'Countdown') this.startFishing();
        break;
      case 'LastCast':
        for (const p of this.sortedPlayers()) {
          if (p.line.rod !== 'Reeling' && IN_WATER.has(p.line.rod)) {
            p.line = { ...freshLine(), castAt: p.line.castAt };
            this.rodState(p, 'Idle', { grund: 'rundenende' });
          }
        }
        break;
      case 'Results': {
        for (const p of this.sortedPlayers()) {
          if (IN_WATER.has(p.line.rod)) { p.line = { ...freshLine() }; this.rodState(p, 'Escaped', { grund: 'rundenende' }); }
        }
        this.finishRound(now);
        break;
      }
      case 'Lobby':
        if (ch.from === 'Countdown') break;
        for (const p of [...this.players.values()]) {
          p.ready = false;
          p.line = freshLine();
          if (!p.connected) this.players.delete(p.id);
        }
        this.clock = null;
        this.sendRound();
        break;
      default: break;
    }
  }

  private resetRoundStats(): void {
    const r = this.round.round;
    for (const p of this.players.values()) {
      // Ruf-Stufe meldet der Client (`join.ruf`); Teil B prüft sie gegen `progress` in der Datenbank
      const rep = p.join.ruf;
      Object.assign(p, {
        points: 0, catches: [], species: {}, caughtNow: new Set(), lineBreaks: 0, tailwind: 0, line: freshLine(),
        beginnerSaves: rep <= this.b.catchup.beginner.maxReputation ? this.b.catchup.beginner.saves : 0,
        netSaves: accessoryValue(p.loadout.accessories, 'KescherRettung', this.world.id) ?? 0,
        rngFish: new Rng(hashSeed(`${this.opts.seed}:${r}:${p.id}:fish`)),
        rngDrill: new Rng(hashSeed(`${this.opts.seed}:${r}:${p.id}:drill`)),
      });
    }
    this.hiddenSent = false;
    this.lastResults = null;
    this.report = null;
  }

  private startFishing(): void {
    const r = this.round.round;
    this.clockRng = new Rng(hashSeed(`${this.opts.seed}:${r}:clock`));
    this.shadowRng = new Rng(hashSeed(`${this.opts.seed}:${r}:shadows`));
    this.shadowSim = createShadowSim();
    this.shadowAcc = 0;
    const s = this.settings;
    this.clock = createClock({
      world: this.world, b: this.b, rng: this.clockRng,
      startPhase: s.tageszeit === 'Zufall' ? this.clockRng.pick(['Morgen', 'Tag', 'Abend', 'Nacht'] as DayPhase[]) : s.tageszeit,
      startWeather: s.wetter === 'Zufall' ? undefined : s.wetter,
    });
    if (s.wetter !== 'Zufall') this.clock.weatherFixed = true;
    this.sendRound();
    this.sendScores(this.opts.now());
  }

  private finishRound(now: number): void {
    const tallies: PlayerTally[] = this.sortedPlayers().map((p) => ({
      id: p.id, points: p.points, lineBreaks: p.lineBreaks, itemHits: 0, guest: !p.join.welten.includes(this.world.id),
      catches: p.catches.map((c) => ({ fishId: c.id as FishId, weightG: c.gewicht, points: c.punkte ?? 0, masterDrill: c.meister })),
    }));
    const res = roundResults(tallies, this.world.muenzfaktor, this.b);
    const byId = new Map(this.sortedPlayers().map((p) => [p.id, p]));
    this.lastResults = {
      runde: this.round.round,
      plaetze: res.map((r) => {
        const p = byId.get(r.id) as HostPlayer;
        return {
          spieler: r.id, platz: r.place, punkte: r.points, faenge: r.catches, arten: r.species, schwersterG: r.heaviestG,
          muenzen: r.coins, auszeichnungen: r.awards, xp: r.xp, pity: p.pity, gast: !p.join.welten.includes(this.world.id),
        };
      }),
    };
    this.report = {
      runde: this.round.round, welt: this.world.id, modus: this.settings.modus, dauerS: this.settings.dauerS,
      fishingStart: this.round.fishingStart ?? now, fishingEnd: this.round.fishingEnd ?? now,
      spieler: this.lastResults.plaetze.map((r) => ({
        id: r.spieler, gast: r.gast, punkte: r.punkte, platz: r.platz, muenzen: r.muenzen, pity: r.pity,
        faenge: (byId.get(r.spieler) as HostPlayer).catches.map((c) => ({ ...c })),
      })),
    };
    this.sendScores(now);
    this.send('results', this.lastResults);
  }

  // ---------------------------------------------------------------- Zustandsnachrichten

  private sortedPlayers(): HostPlayer[] { return [...this.players.values()].sort((a, b) => a.order - b.order); }

  private roundData(): RoundData {
    const c = this.clock;
    return {
      runde: this.round.round,
      host: this.id,
      einstellungen: { ...this.settings },
      spieler: this.sortedPlayers().map((p) => ({
        id: p.id, name: p.join.name, hut: p.join.hut, boot: p.join.boot, bereit: p.ready, verbunden: p.connected,
        gast: !p.join.welten.includes(this.settings.welt), ausruestung: { ...p.ids, accessories: [...p.ids.accessories] },
      })),
      gesperrt: this.round.phase !== 'Lobby',
      welten: this.unlockedWorlds(),
      wetter: c?.weather ?? null,
      wind: c?.windDir ?? 1,
      tageszeit: c ? phaseAt(c.dayTimeS, this.b) : null,
      ereignisse: c ? activeEvents(c, this.world, this.b) : [],
    };
  }

  private phaseData(): PhaseEndData {
    return { runde: this.round.round, phase: this.round.phase, ende: this.round.phaseEnd, angelEnde: this.round.fishingEnd };
  }

  private scoresData(now: number): ScoresData {
    const hidden = this.hidden(now);
    return {
      runde: this.round.round,
      verdeckt: hidden,
      liste: this.sortedPlayers().map((p) => ({
        spieler: p.id, punkte: hidden ? null : p.points, faenge: p.catches.length, rueckenwind: hidden ? null : p.tailwind,
      })),
    };
  }

  private sendRound(): void { this.send('round', this.roundData()); }
  private sendPhase(): void { this.send('phaseEnd', this.phaseData()); }
  private sendScores(now: number): void { this.send('scores', this.scoresData(now)); }

  private snapshot(p: HostPlayer): DataOf<'sync'> {
    const now = this.opts.now();
    const hidden = this.hidden(now);
    return {
      round: this.roundData(),
      phase: this.phaseData(),
      scores: this.scoresData(now),
      rods: this.sortedPlayers().map((x) => ({ spieler: x.id, zustand: x.line.rod })),
      feed: this.sortedPlayers().flatMap((x) => x.catches).sort((a, b) => a.t - b.t).map((c) => (hidden ? { ...c, punkte: null } : { ...c })),
      results: this.lastResults,
      ich: { zustand: p.line.rod, anfaenger: p.beginnerSaves, kescher: p.netSaves },
    };
  }

  // ---------------------------------------------------------------- Ende

  /** Host verlässt den Raum (Tab zu, „Verlassen“): alle sehen Aborted und den letzten Stand (B4). */
  close(): void {
    if (this.isClosed) return;
    const now = this.opts.now();
    this.round = abortRound(this.round, now).state;
    this.sendPhase();
    this.isClosed = true;
    for (const u of this.subs) u();
    this.t.close();
  }

  /** Host-Absturz simulieren: keine Abschiedsnachricht, nur die Verbindung reißt ab (Tests). */
  crash(): void {
    this.isClosed = true;
    for (const u of this.subs) u();
    this.t.close();
  }

  get closed(): boolean { return this.isClosed; }
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
