// src/net/sim.ts – Bot-Spieler und Raum-Simulation über LocalHub (virtuelle Zeit). Für Vitest-Simulationen
// (4 Bots × 5 min, Reconnect, Host weg, Nachrichten-Budget) und später für Bot-Tabs im Playwright-Test.
// Die Schwellen der Bots sind Spielerverhalten, keine Spielwerte.
import { Rng } from '../core/random';
import type { DrillState } from '../game/drill';
import { holdTimeForPower } from '../game/cast';
import type { LoadoutIds } from '../game/save';
import { IDLE_INPUT, type SessionInput } from '../game/session';
import type { ShadowParams } from '../game/shadows';
import type { GameData } from '../game/types';
import { NetClient, type ClientProfile } from './client';
import type { NetConfig } from './config';
import { NetHost } from './host';
import type { LobbySettings, PlayerId } from './messages';
import { canCast } from './round';
import { LocalHub, splitTransport, type LocalHubOptions, type Transport } from './transport';

/** Guter Drill: Spannung mittig in der Zone, Konter, auf Vorwarnungen reagieren (wie tests/unit/helpers/bots.ts). */
export function drillBotInput(s: DrillState, mem: { lastTapS: number; lastDir: DrillState['pullDir'] }): Pick<SessionInput, 'reel' | 'steer' | 'rodUp' | 'reelPressed'> {
  const { lo, hi } = s.zone;
  const B = s.b.drill.behavior;
  const stage = s.stage.kind;
  const next = stage === 'telegraph' ? s.stage.next : undefined;
  let target = (lo + hi) / 2;
  if (stage === 'jump' || next === 'jump') target = Math.min(target, B.Springer.tensionLimit * 0.6);
  if (stage === 'fake' || next === 'flee' || stage === 'flee') target = lo * 0.7;
  if (stage === 'inflate' || next === 'inflate') target = lo;
  if (stage === 'sprint' || stage === 'dive') target = (lo + target) / 2;
  if (s.behavior === 'Hitzkopf' && s.heat > B.Hitzkopf.breakAt * 0.5) target = lo * 0.8;
  if (stage === 'snag') target = Math.max(0.25, lo * 0.8);
  if (!s.invisible) mem.lastDir = s.pullDir;
  const dir = s.invisible ? mem.lastDir : s.pullDir;
  let steer = 0;
  let rodUp = false;
  if (dir === 'down') rodUp = true;
  else steer = dir === 'left' ? 1 : -1;
  if (s.inverted) steer = -steer;
  let tap = false;
  if (s.snag && s.elapsedS - mem.lastTapS >= B.Versteckspieler.tapIntervalS - 1e-9) { tap = true; mem.lastTapS = s.elapsedS; }
  return { reel: s.tension < target, steer, rodUp, reelPressed: tap };
}

/** Bot, der über `NetClient.step` spielt wie ein Mensch: werfen, sinken, anschlagen, drillen. */
export class NetBot {
  private rng: Rng;
  private holdTarget = 0;
  private targetDepth = 0;
  private prevCast = false;
  private mem = { lastTapS: -Infinity, lastDir: 'left' as DrillState['pullDir'] };

  constructor(seed: number, private readonly reactionS = 0.25) { this.rng = new Rng(seed); }

  input(c: NetClient, dt: number): SessionInput {
    const o = c.own;
    const inp: SessionInput = { ...IDLE_INPUT };
    switch (o.rod) {
      case 'Idle': case 'Caught': case 'Escaped':
        if (canCast(c.round.phase) && !this.prevCast) {
          inp.castHeld = true;
          const rod = c.loadout().rod;
          this.holdTarget = holdTimeForPower(this.rng.range(0.2, 1), rod.castCycleS);
          this.targetDepth = this.rng.range(0, c.world().maxTiefeM);
        }
        break;
      case 'Casting':
        inp.castHeld = o.pendingSince === null && o.castHoldS + dt < this.holdTarget;
        break;
      case 'Waiting': case 'Sinking':
        inp.sink = o.depthM < this.targetDepth && !o.lineTooShort;
        break;
      case 'Bite':
        if (o.biteSeenAt !== null && c.now - o.biteSeenAt >= this.reactionS * 1000) inp.strike = true;
        break;
      case 'Reeling':
        if (o.drill) Object.assign(inp, drillBotInput(o.drill, this.mem));
        break;
      default: break;
    }
    if (o.rod !== 'Reeling') this.mem.lastTapS = -Infinity;
    this.prevCast = inp.castHeld;
    return inp;
  }
}

export interface RoomSimOptions {
  data: GameData;
  seed: number;
  players: number;
  shadows: ShadowParams;
  cfg?: NetConfig;
  hub?: LocalHubOptions;
  settings?: Partial<LobbySettings>;
  /** Uhr-Versatz je Client (ms), um die Ping-Pong-Messung zu prüfen */
  skewMs?: (index: number) => number;
  profile?: (id: PlayerId, index: number) => ClientProfile;
  /** Logik-Schritt der Clients (s) und Host-Takt (alle n Schritte) */
  dtS?: number;
  hostEvery?: number;
  /** Transport-Hülle je Endpunkt (z. B. Nachrichten-Zähler) */
  wrap?: (t: Transport, id: PlayerId) => Transport;
}

export const startLoadoutIds = (data: GameData): LoadoutIds => ({
  rod: (data.gear.rods[0] as { id: string }).id,
  line: (data.gear.lines.find((l) => !l.isLeader) as { id: string }).id,
  leader: null,
  reel: (data.gear.reels[0] as { id: string }).id,
  bait: (data.gear.baits.find((b) => b.infinite) as { id: string }).id,
  accessories: [],
});

/** Ein Raum mit Host-Tab (Host + eigener Client) und weiteren Clients in einem Prozess. */
export class RoomSim {
  readonly hub: LocalHub;
  host: NetHost;
  readonly clients = new Map<PlayerId, NetClient>();
  readonly bots = new Map<PlayerId, NetBot>();
  readonly ids: PlayerId[];
  private frame = 0;
  readonly dtS: number;
  private readonly hostEvery: number;
  private hostAlive = true;

  constructor(private readonly o: RoomSimOptions) {
    this.hub = new LocalHub(o.hub);
    this.dtS = o.dtS ?? 1 / 60;
    this.hostEvery = o.hostEvery ?? 3;
    this.ids = Array.from({ length: o.players }, (_, i) => `spieler-${i + 1}`);
    const hostId = this.ids[0] as PlayerId;
    const base = this.wrap(this.hub.connect(hostId), hostId);
    const [hostSide, clientSide] = splitTransport(base, (fn) => this.hub.defer(fn));
    this.host = new NetHost({
      transport: hostSide, data: o.data, seed: o.seed, now: () => this.hub.now, shadows: o.shadows, cfg: o.cfg, settings: o.settings,
    });
    this.addClient(hostId, 0, clientSide);
    this.ids.slice(1).forEach((id, i) => this.addClient(id, i + 1, this.wrap(this.hub.connect(id), id)));
  }

  private wrap(t: Transport, id: PlayerId): Transport { return this.o.wrap ? this.o.wrap(t, id) : t; }

  profileFor(id: PlayerId, i: number): ClientProfile {
    return this.o.profile?.(id, i) ?? {
      name: `Bot ${i + 1}`, hut: 'H00', boot: 'B00', ruf: 1, welten: ['W1'], bekannt: [], abzeichen: [], pity: 0,
      ausruestung: startLoadoutIds(this.o.data),
    };
  }

  private addClient(id: PlayerId, i: number, t: Transport): NetClient {
    const skew = this.o.skewMs?.(i) ?? 0;
    const c = new NetClient({ transport: t, data: this.o.data, profile: this.profileFor(id, i), now: () => this.hub.now + skew, cfg: this.o.cfg });
    this.clients.set(id, c);
    if (!this.bots.has(id)) this.bots.set(id, new NetBot(this.o.seed * 31 + i * 7 + 1));
    c.join();
    return c;
  }

  client(id: PlayerId): NetClient { return this.clients.get(id) as NetClient; }

  /** Einen Logik-Schritt weiter. */
  step(): void {
    const t = this.hub.now + this.dtS * 1000;
    this.hub.advanceTo(t);
    if (this.hostAlive && this.frame % this.hostEvery === 0) this.host.tick();
    this.frame++;
    for (const [id, c] of this.clients) c.step(this.dtS, (this.bots.get(id) as NetBot).input(c, this.dtS));
    this.hub.flush();
  }

  runFor(seconds: number): void {
    const n = Math.round(seconds / this.dtS);
    for (let i = 0; i < n; i++) this.step();
  }

  runUntil(pred: () => boolean, maxS: number): boolean {
    const n = Math.round(maxS / this.dtS);
    for (let i = 0; i < n; i++) { if (pred()) return true; this.step(); }
    return pred();
  }

  readyAll(): void { for (const c of this.clients.values()) c.ready(true); }

  /** Tab neu laden: alte Verbindung weg, neuer Client mit derselben ID und frischem Zustand. */
  reload(id: PlayerId): NetClient {
    const old = this.clients.get(id);
    old?.close();
    const i = this.ids.indexOf(id);
    return this.addClient(id, i, this.wrap(this.hub.connect(id), id));
  }

  /** Host schließt den Tab (mit Abschied) oder stürzt ab (ohne). */
  removeHost(mode: 'close' | 'crash'): void {
    const hostId = this.ids[0] as PlayerId;
    if (mode === 'close') this.host.close(); else this.host.crash();
    this.hostAlive = false;
    this.clients.get(hostId)?.close();
    this.clients.delete(hostId);
  }
}
