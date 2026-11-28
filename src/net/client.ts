// src/net/client.ts – Client-Seite eines Raums (B4). Schickt Absichten, zeigt Entscheidungen des Hosts.
// Der Drill läuft lokal mit dem vorhandenen src/game/drill.ts (anonymer Fisch aus `bite`), alle 0,5 s geht `reel`
// an den Host, am Ende `reelResult`; der Host entscheidet über den Fang. Kein Phaser, kein DOM.
//
// API für die Szene (wie FishingSession): `step(dt, input)` mit derselben `SessionInput`; Ereignisse kommen als Liste
// zurück. Zustand zum Zeichnen: `own`, `rods`, `scores`, `feed`, `shadows`, `round`, `roundData`, `results`.
import { Rng } from '../core/random';
import type { FishData } from '../data/types';
import { castPower, resolveCast } from '../game/cast';
import { sinkStep, twitchDepth } from '../game/depth';
import { createDrill, stepDrill, type DrillEvent, type DrillState } from '../game/drill';
import type { LoadoutIds } from '../game/save';
import type { RodState, SessionInput } from '../game/session';
import { byId, worldById, type GameData, type Loadout, type WorldDbEntry } from '../game/types';
import { ClockSync } from './clockOffset';
import { netConfigFrom, type NetConfig } from './config';
import { fishFromSpec } from './drillSpec';
import {
  HOST_ONLY, Outbox, isForMe,
  type CatchData, type DataOf, type DrillSpec, type EmoteId, type JoinData, type MessageOf, type MessageType, type NetMessage,
  type PlayerId, type ResultsData, type RodReason, type RoundData, type ScoresData,
} from './messages';
import { abortRound, applyRemotePhase, canCast, createRound, fishingRemainingS, type PhaseChange, type RoundState } from './round';
import type { PresenceState, Transport, Unsubscribe } from './transport';

/** Was der Client von seinem Profil mitbringt (Teil B: aus `profiles`/`progress`). */
export type ClientProfile = Omit<JoinData, 'aktiv'>;

export interface ClientOptions {
  transport: Transport;
  data: GameData;
  profile: ClientProfile;
  /** lokale Uhr in ms */
  now: () => number;
  cfg?: NetConfig;
}

export type ClientEvent =
  | { type: 'synced' }
  | { type: 'denied'; grund: DataOf<'deny'>['grund'] }
  | { type: 'phase'; change: PhaseChange }
  | { type: 'aborted'; reason: 'hostWeg' | 'hostBeendet' }
  | { type: 'round' }
  | { type: 'scores' }
  | { type: 'results' }
  | { type: 'catch'; data: CatchData; mine: boolean }
  | { type: 'rodState'; spieler: PlayerId; zustand: RodState; grund?: RodReason }
  | { type: 'bite'; spieler: PlayerId }
  | { type: 'emote'; from: PlayerId; id: EmoteId }
  | { type: 'drill'; e: DrillEvent }
  | { type: 'resync' };

export interface ShadowView { id: number; sizeClass: string; xM: number; depthM: number; speedMs: number; known: boolean }

/** Eigene Rute aus Client-Sicht. `rod` ist der Host-Stand, außer beim lokalen Aufladen (Casting). */
export interface OwnLine {
  rod: RodState;
  castHoldS: number;
  castPower: number;
  /** Wurf gesendet, Antwort steht aus (ms) */
  pendingSince: number | null;
  distanceM: number;
  depthM: number;
  lineTooShort: boolean;
  biteSeenAt: number | null;
  struck: boolean;
  bite: { verhalten: DataOf<'bite'>['verhalten']; spec: DrillSpec; seed: number; schutz: { anfaenger: number; kescher: number } } | null;
  drill: DrillState | null;
  drillSinceReel: number;
  drillStartSaves: { anfaenger: number; kescher: number };
  resultSent: boolean;
  lastGrund: RodReason | null;
}

const freshOwn = (): OwnLine => ({
  rod: 'Idle', castHoldS: 0, castPower: 0, pendingSince: null, distanceM: 0, depthM: 0, lineTooShort: false,
  biteSeenAt: null, struck: false, bite: null, drill: null, drillSinceReel: 0, drillStartSaves: { anfaenger: 0, kescher: 0 },
  resultSent: false, lastGrund: null,
});

export class NetClient {
  readonly cfg: NetConfig;
  readonly id: PlayerId;
  private t: Transport;
  private out: Outbox;
  private readonly data: GameData;
  private readonly opts: ClientOptions;
  private subs: Unsubscribe[] = [];
  private ev: ClientEvent[] = [];
  private template: FishData;

  round: RoundState = createRound();
  roundData: RoundData | null = null;
  scores: ScoresData | null = null;
  results: ResultsData | null = null;
  feed: CatchData[] = [];
  rods = new Map<PlayerId, RodState>();
  shadows: ShadowView[] = [];
  own: OwnLine = freshOwn();
  hostId: PlayerId | null = null;
  readonly clock = new ClockSync();
  synced = false;
  private everSynced = false;
  denied: DataOf<'deny'>['grund'] | null = null;
  /** letzte angewandte Nummer vom Host (Lücken → neu synchronisieren) */
  private hostSeq = 0;
  private pending = new Map<number, NetMessage>();
  private preSync: NetMessage[] = [];
  private gapSince: number | null = null;
  private lastJoinAt = -Infinity;
  private hostMissingSince: number | null = null;
  private pingsLeft = 0;
  private lastPingAt = -Infinity;
  private lastLureAt = -Infinity;
  private sentDepth = 0;
  private prevInput: SessionInput | null = null;
  private leftRoom = false;
  /** Zähler für Tests/Debug */
  readonly stats = { resyncs: 0, gapsDetected: 0, ignored: 0 };

  constructor(opts: ClientOptions) {
    this.opts = opts;
    this.data = opts.data;
    this.cfg = opts.cfg ?? netConfigFrom(opts.data.balancing);
    this.t = opts.transport;
    this.id = opts.transport.selfId;
    this.out = new Outbox(this.id, opts.now);
    const tpl = opts.data.fish[0];
    if (!tpl) throw new Error('Keine Fischdaten geladen');
    this.template = tpl;
    this.attach();
  }

  private attach(): void {
    this.subs.push(this.t.onMessage((m) => this.receive(m)));
    this.subs.push(this.t.onSync((p) => this.onPresence(p)));
    const re = this.t.onReconnect?.(() => { if (this.everSynced && !this.leftRoom) { this.stats.resyncs++; this.sendJoin(); } });
    if (re) this.subs.push(re);
  }

  get b() { return this.data.balancing; }
  get now(): number { return this.opts.now(); }
  /** Host-Uhr jetzt (ms) */
  hostNow(): number { return this.clock.hostNow(this.now); }
  /** Restzeit der aktuellen Phase (s) */
  phaseRemainingS(): number { return this.round.phaseEnd === null ? 0 : Math.max(0, (this.round.phaseEnd - this.hostNow()) / 1000); }
  /** Restzeit der Angelzeit bis Rundenende (s) */
  fishingRemainingS(): number { return fishingRemainingS(this.round, this.hostNow()); }

  /** Ereignisse seit dem letzten Abruf (Nachrichten kommen auch zwischen zwei `step`-Aufrufen). */
  drainEvents(): ClientEvent[] { const e = this.ev; this.ev = []; return e; }

  private send<T extends MessageType>(type: T, data: DataOf<T>, to?: PlayerId): void {
    if (this.leftRoom) return;
    this.t.broadcast(this.out.make(type, data, to));
  }

  // ---------------------------------------------------------------- Beitritt

  /** Presence setzen und beitreten (wiederholt sich, bis `sync` kommt). */
  join(): void {
    this.t.track({ id: this.id, name: this.opts.profile.name, hut: this.opts.profile.hut, boot: this.opts.profile.boot });
    this.sendJoin();
  }

  private sendJoin(): void {
    this.lastJoinAt = this.now;
    // aktiv: null = frisch geladen (Host setzt eine laufende Angel zurück); sonst unser Stand (Resync, Reconnect)
    const aktiv = !this.everSynced ? null : this.own.rod === 'Reeling' && !this.own.drill ? null : this.own.rod === 'Casting' ? 'Idle' : this.own.rod;
    this.send('join', { ...this.opts.profile, aktiv });
  }

  /** Neue Verbindung, gleiche Spieler-ID (Handy war gesperrt, Netz weg). Lokaler Drill läuft weiter. */
  reconnect(transport: Transport): void {
    if (transport.selfId !== this.id) throw new Error('Reconnect muss dieselbe Spieler-ID nutzen');
    for (const u of this.subs) u();
    this.subs = [];
    if (!this.t.closed) this.t.close();
    this.t = transport;
    // Neue Verbindung = neuer Zähler beim Host ist egal; wir setzen nur unsere Erwartung zurück
    this.synced = false;
    this.hostSeq = 0;
    this.pending.clear();
    this.preSync = [];
    this.gapSince = null;
    this.attach();
    this.join();
  }

  ready(bereit: boolean): void { this.send('ready', { bereit }); }
  emote(id: EmoteId): void { this.send('emote', { id }); }
  sendPos(x: number): void { this.send('pos', { spieler: this.id, x }); }

  /** Raum verlassen. */
  leave(): void {
    this.send('leave', {});
    this.leftRoom = true;
    this.close();
  }

  close(): void {
    for (const u of this.subs) u();
    this.subs = [];
    this.t.close();
  }

  // ---------------------------------------------------------------- Empfang

  private onPresence(peers: PresenceState[]): void {
    if (!this.hostId) {
      const h = peers.find((p) => p.host);
      if (h) this.hostId = h.id;
    }
    if (!this.hostId) return;
    const present = peers.some((p) => p.id === this.hostId);
    if (present) this.hostMissingSince = null;
    else if (this.hostMissingSince === null) this.hostMissingSince = this.now;
  }

  private isFromHost(m: NetMessage): boolean {
    if (this.hostId) return m.from === this.hostId;
    // vor dem ersten sync: der erste, der uns gezielt antwortet, ist der Host
    if ((m.type === 'sync' || m.type === 'deny') && m.to === this.id) { this.hostId = m.from; return true; }
    return false;
  }

  receive(m: NetMessage): void {
    if (HOST_ONLY.has(m.type)) {
      const mine = isForMe(m, this.id);
      if (m.type === 'deny' && mine && !this.synced) { if (this.isFromHost(m)) this.onHostMessage(m); return; }
      if (!this.synced && !(m.type === 'sync' && mine)) {
        // Vor dem eigenen Stand: sammeln (Absender erst mit dem sync sicher bekannt), danach einsortieren
        if (this.preSync.length < 1000) this.preSync.push(m);
        return;
      }
      if (!this.isFromHost(m)) { this.stats.ignored++; return; }
      // Nummernfolge des Hosts – auch gezielte Nachrichten an andere zählen mit (sonst falsche Lücken).
      // Supabase stellt Nachrichten nicht immer in Reihenfolge zu: kurz puffern und sortiert anwenden.
      if (m.type === 'sync' && mine) {
        this.hostSeq = Math.max(this.hostSeq, m.seq);
        this.onHostMessage(m);
        for (const p of this.preSync) if (p.from === this.hostId && p.seq > this.hostSeq) this.pending.set(p.seq, p);
        this.preSync = [];
        for (const k of [...this.pending.keys()]) if (k <= this.hostSeq) this.pending.delete(k);
        this.drainPending();
        return;
      }
      if (m.seq <= this.hostSeq || this.pending.has(m.seq)) { this.stats.ignored++; return; }
      if (this.pending.size > 1000) this.pending.clear();
      this.pending.set(m.seq, m);
      this.drainPending();
      return;
    }
    if (!isForMe(m, this.id)) return;
    if (m.type === 'emote') this.ev.push({ type: 'emote', from: m.from, id: m.data.id });
  }

  /** Gepufferte Host-Nachrichten in Nummernfolge anwenden. */
  private drainPending(): void {
    for (let next = this.pending.get(this.hostSeq + 1); next; next = this.pending.get(this.hostSeq + 1)) {
      this.pending.delete(next.seq);
      this.hostSeq = next.seq;
      if (isForMe(next, this.id)) this.onHostMessage(next);
    }
    this.gapSince = this.pending.size > 0 ? (this.gapSince ?? this.now) : null;
  }

  /** Fehlt eine Nummer länger als das Umsortier-Fenster: als verloren werten, Rest anwenden, Stand neu holen. */
  private checkGap(now: number): void {
    if (this.gapSince === null || now - this.gapSince < this.cfg.client.reorderWindowS * 1000) return;
    this.stats.gapsDetected++;
    this.hostSeq = Math.min(...this.pending.keys()) - 1;
    this.gapSince = null;
    this.drainPending();
    this.requestResync();
  }

  private requestResync(): void {
    if (this.now - this.lastJoinAt < this.cfg.client.joinRetryS * 1000) return;
    this.stats.resyncs++;
    this.ev.push({ type: 'resync' });
    this.sendJoin();
  }

  private onHostMessage(m: NetMessage): void {
    switch (m.type) {
      case 'sync': this.applySync(m); break;
      case 'deny': this.denied = m.data.grund; this.ev.push({ type: 'denied', grund: m.data.grund }); break;
      case 'pong': this.clock.add(m.data.t0, m.data.t1, this.now); break;
      case 'phaseEnd': this.applyPhase(m.data); break;
      case 'round': this.roundData = m.data; this.ev.push({ type: 'round' }); break;
      case 'scores': if (m.data.runde >= this.round.round) { this.scores = m.data; this.ev.push({ type: 'scores' }); } break;
      case 'results': this.results = m.data; this.ev.push({ type: 'results' }); break;
      case 'catch': this.applyCatch(m.data); break;
      case 'rodState': this.applyRod(m.data); break;
      case 'bite': this.applyBite(m); break;
      case 'shadows': this.applyShadows(m.data); break;
      default: break;
    }
  }

  private applySync(m: MessageOf<'sync'>): void {
    const d = m.data;
    const wasSynced = this.synced;
    this.synced = true;
    this.roundData = d.round;
    this.scores = d.scores;
    this.results = d.results;
    this.feed = d.feed.map((c) => ({ ...c }));
    this.rods = new Map(d.rods.map((r) => [r.spieler, r.zustand]));
    const before = this.round.phase;
    this.round = applyRemotePhase(this.round.phase === 'Aborted' ? createRound() : this.round, d.phase).state;
    if (before !== this.round.phase) this.ev.push({ type: 'phase', change: { from: before, to: this.round.phase, at: d.phase.ende ?? 0 } });
    // Eigene Rute: lokaler Stand bleibt, wenn der Host denselben Zustand meldet (Drill nur mit lokalem Drill)
    const same = this.own.rod === d.ich.zustand || (this.own.rod === 'Sinking' && d.ich.zustand === 'Waiting');
    if (!same || (d.ich.zustand === 'Reeling' && !this.own.drill)) {
      this.own = { ...freshOwn(), rod: d.ich.zustand === 'Reeling' ? 'Idle' : d.ich.zustand };
    }
    this.everSynced = true;
    if (!wasSynced) {
      this.pingsLeft = this.cfg.msg.clockSamples;
      this.ev.push({ type: 'synced' });
    }
  }

  private applyPhase(d: DataOf<'phaseEnd'>): void {
    if (d.phase === 'Aborted') { this.abort('hostBeendet'); return; }
    const newRound = d.runde > this.round.round && d.phase === 'Countdown';
    const step = applyRemotePhase(this.round, d);
    this.round = step.state;
    if (newRound) {
      this.feed = [];
      this.results = null;
      this.scores = null;
      this.own = freshOwn();
      for (const k of this.rods.keys()) this.rods.set(k, 'Idle');
    }
    if (step.state.phase === 'LastCast' && this.own.rod === 'Casting') this.own = freshOwn();
    for (const c of step.changes) this.ev.push({ type: 'phase', change: c });
  }

  private abort(reason: 'hostWeg' | 'hostBeendet'): void {
    if (this.round.phase === 'Aborted') return;
    const step = abortRound(this.round, this.hostNow());
    this.round = step.state;
    this.own = { ...freshOwn(), rod: 'Idle' };
    for (const c of step.changes) this.ev.push({ type: 'phase', change: c });
    this.ev.push({ type: 'aborted', reason });
  }

  private applyCatch(c: CatchData): void {
    this.feed.push(c);
    this.rods.set(c.spieler, 'Caught');
    const mine = c.spieler === this.id;
    if (mine) this.own = { ...freshOwn(), rod: 'Caught' };
    this.ev.push({ type: 'catch', data: c, mine });
  }

  private applyRod(d: DataOf<'rodState'>): void {
    this.rods.set(d.spieler, d.zustand);
    this.ev.push({ type: 'rodState', spieler: d.spieler, zustand: d.zustand, grund: d.grund });
    if (d.spieler !== this.id) return;
    const o = this.own;
    o.lastGrund = d.grund ?? null;
    o.pendingSince = null;
    switch (d.zustand) {
      case 'Waiting':
        if (d.wurf) { o.distanceM = d.wurf.weite; o.depthM = 0; this.sentDepth = 0; o.biteSeenAt = null; o.struck = false; o.bite = null; }
        if (d.grund === 'zuFrueh') { o.biteSeenAt = null; o.struck = false; o.bite = null; }
        o.rod = 'Waiting';
        break;
      case 'Nibble': o.rod = 'Nibble'; break;
      case 'Reeling': {
        if (!o.bite) { o.rod = 'Reeling'; break; }
        const lo = this.loadout();
        const fish = fishFromSpec(o.bite.spec, o.bite.verhalten, this.template);
        o.drill = createDrill(fish, lo, this.b, new Rng(o.bite.seed), {
          sizeX: 0, perfectStrike: d.perfekt ?? false, weather: this.roundData?.wetter ?? undefined, depthM: o.depthM,
          world: this.roundData?.einstellungen.welt, beginnerSaves: o.bite.schutz.anfaenger, netSaves: o.bite.schutz.kescher,
        });
        o.drillStartSaves = { ...o.bite.schutz };
        o.drillSinceReel = 0;
        o.resultSent = false;
        o.rod = 'Reeling';
        break;
      }
      case 'Idle': case 'Escaped': case 'Caught':
        // Ablehnung eines Wurfs (grund phase/abklingzeit/reichweite) lässt die Rute im alten Zustand
        this.own = { ...freshOwn(), rod: d.zustand, lastGrund: d.grund ?? null };
        break;
      default: o.rod = d.zustand; break;
    }
  }

  private applyBite(m: MessageOf<'bite'>): void {
    const d = m.data;
    this.rods.set(d.spieler, 'Bite');
    this.ev.push({ type: 'bite', spieler: d.spieler });
    if (d.spieler !== this.id) return;
    const o = this.own;
    o.rod = 'Bite';
    o.biteSeenAt = this.now;
    o.struck = false;
    o.bite = { verhalten: d.verhalten, spec: d.schwierigkeit, seed: d.seed, schutz: { ...d.schutz } };
  }

  private applyShadows(d: DataOf<'shadows'>): void {
    const idx = this.roundData?.spieler.findIndex((p) => p.id === this.id) ?? -1;
    this.shadows = d.s.map(([id, sizeClass, xDm, dDm, v, mask]) => ({
      id, sizeClass, xM: xDm / 10, depthM: dDm / 10, speedMs: v / 100, known: idx >= 0 && (mask & (1 << idx)) !== 0,
    }));
  }

  /** aktuelle Welt des Raums */
  world(): WorldDbEntry { return worldById(this.data.worlds, this.roundData?.einstellungen.welt ?? 'W1'); }

  // ---------------------------------------------------------------- Ausrüstung

  /** Ausrüstung, die der Host für mich festgelegt hat (Regel „Ausgeglichen“ usw.), sonst die eigene. */
  loadout(): Loadout {
    const ids: LoadoutIds = this.roundData?.spieler.find((p) => p.id === this.id)?.ausruestung ?? this.opts.profile.ausruestung;
    const g = this.data.gear;
    return {
      rod: byId(g.rods, ids.rod, 'Rute'), line: byId(g.lines, ids.line, 'Schnur'),
      leader: ids.leader ? byId(g.lines, ids.leader, 'Vorfach') : null,
      reel: byId(g.reels, ids.reel, 'Rolle'), bait: byId(g.baits, ids.bait, 'Köder'),
      accessories: ids.accessories.map((id) => byId(g.accessories, id, 'Zubehör')),
    };
  }

  // ---------------------------------------------------------------- Schritt

  /** Ein lokaler Zeitschritt mit der Eingabe der Szene. Gibt alle Ereignisse seit dem letzten Abruf zurück. */
  step(dt: number, input: SessionInput): ClientEvent[] {
    const now = this.now;
    this.timers(now);
    if (this.synced && this.round.phase !== 'Aborted') this.stepOwn(dt, input, now);
    this.prevInput = input;
    return this.drainEvents();
  }

  private timers(now: number): void {
    if (this.leftRoom) return;
    this.checkGap(now);
    if (!this.synced && !this.denied && now - this.lastJoinAt >= this.cfg.client.joinRetryS * 1000) this.sendJoin();
    if (this.synced && this.pingsLeft > 0 && now - this.lastPingAt >= this.cfg.msg.clockSampleGapS * 1000) {
      this.pingsLeft--;
      this.lastPingAt = now;
      this.send('ping', { t0: now });
    }
    if (this.hostMissingSince !== null && now - this.hostMissingSince >= this.cfg.client.hostLostGraceS * 1000) this.abort('hostWeg');
  }

  private stepOwn(dt: number, input: SessionInput, now: number): void {
    const o = this.own;
    const castPressed = input.castHeld && !(this.prevInput?.castHeld ?? false);
    const fishing = canCast(this.round.phase);
    switch (o.rod) {
      case 'Idle': case 'Caught': case 'Escaped':
        if (fishing && castPressed && o.pendingSince === null) {
          this.own = { ...freshOwn(), rod: 'Casting' };
        }
        break;
      case 'Casting': {
        if (o.pendingSince !== null) {
          // Antwort bleibt aus (Verlust) → zurück, damit man neu werfen kann
          if (now - o.pendingSince > this.cfg.client.joinRetryS * 1000) this.own = freshOwn();
          break;
        }
        const rod = this.loadout().rod;
        if (input.castHeld) {
          o.castHoldS += dt;
          o.castPower = castPower(o.castHoldS, rod.castCycleS);
          break;
        }
        const rd = this.roundData;
        const world = worldById(this.data.worlds, rd?.einstellungen.welt ?? 'W1');
        const preview = resolveCast({ power: o.castPower, rod, world, weather: rd?.wetter ?? 'Sonnig', windDir: rd?.wind ?? 1, b: this.b });
        o.pendingSince = now;
        this.send('cast', { kraft: o.castPower, ziel: preview.distanceM });
        break;
      }
      case 'Waiting': case 'Sinking': case 'Nibble': case 'Bite':
        this.stepWater(dt, input, now);
        break;
      case 'Reeling': this.stepReel(dt, input); break;
      default: break;
    }
  }

  private stepWater(dt: number, input: SessionInput, now: number): void {
    const o = this.own;
    if (input.retrieve && o.rod !== 'Bite') { this.send('retrieve', {}); return; }
    if (input.strike && !o.struck) {
      o.struck = true;
      const reaction = o.rod === 'Bite' && o.biteSeenAt !== null ? (now - o.biteSeenAt) / 1000 : null;
      this.send('strike', { reaktion: reaction });
      if (o.rod !== 'Bite') o.struck = false; // zu früh: Host antwortet mit Waiting/zuFrueh
      return;
    }
    if (o.rod !== 'Waiting' && o.rod !== 'Sinking') return;
    const lo = this.loadout();
    const world = worldById(this.data.worlds, this.roundData?.einstellungen.welt ?? 'W1');
    let twitch = false;
    if (input.sink) {
      const r = sinkStep(o.depthM, dt, lo.bait, lo.reel, world);
      o.depthM = r.depthM;
      o.lineTooShort = r.lineTooShort;
      o.rod = 'Sinking';
    } else {
      o.lineTooShort = false;
      if (o.rod === 'Sinking') o.rod = 'Waiting';
    }
    if (input.reelPressed) { o.depthM = twitchDepth(o.depthM, this.b); twitch = true; }
    // höchstens posMaxPerS je s (B4 wie `pos`); nach dem Loslassen geht die Endtiefe mit der nächsten freien Lücke raus
    const due = now - this.lastLureAt >= 1000 / this.cfg.msg.posMaxPerS;
    if (twitch || (o.depthM !== this.sentDepth && due)) {
      this.lastLureAt = now;
      this.sentDepth = o.depthM;
      this.send('lure', { tiefe: o.depthM, zucken: twitch });
    }
  }

  private stepReel(dt: number, input: SessionInput): void {
    const o = this.own;
    const d = o.drill;
    if (!d || o.resultSent) return;
    const { events } = stepDrill(d, { reel: input.reel, steer: input.steer, rodUp: input.rodUp, tap: input.reelPressed }, dt);
    for (const e of events) this.ev.push({ type: 'drill', e });
    o.drillSinceReel += dt;
    if (d.outcome) {
      o.resultSent = true;
      this.send('reelResult', {
        ergebnis: d.outcome, dauer: d.elapsedS, meister: d.masterDrill,
        anfaenger: o.drillStartSaves.anfaenger - d.beginnerSaves, kescher: o.drillStartSaves.kescher - d.netSaves,
      });
      return;
    }
    if (o.drillSinceReel >= this.cfg.msg.reelIntervalS) {
      o.drillSinceReel -= this.cfg.msg.reelIntervalS;
      const start = this.b.drill.distance.start;
      this.send('reel', { spannung: clamp01(d.tension), fortschritt: clamp01(1 - d.distance / start) });
    }
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
