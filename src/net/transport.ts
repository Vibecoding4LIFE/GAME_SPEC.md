// src/net/transport.ts – Transport-Abstraktion für den Raumkanal (B4: Broadcast + Presence).
//
//   Transport            Interface (broadcast, onMessage, track/onSync, close)
//   LocalHub/-Transport  In-Memory-Hub für Tests: mehrere Clients in einem Prozess, virtuelle Zeit,
//                        optional Latenz, Schwankung (Reihenfolge je Verbindung bleibt erhalten) und Paketverlust
//   BroadcastChannelTransport  mehrere Browser-Tabs ohne Server (E2E-Tests); Presence per Herzschlag
//   splitTransport       Host und eigener Client teilen sich im Host-Tab EINE Verbindung
//   SupabaseTransport    folgt in Teil B: src/net/supabaseTransport.ts
//
// Semantik wie Supabase-Broadcast mit `self: false` [UNGEPRÜFT – in Teil B in der Doku der installierten
// supabase-js-Version prüfen]: Eine gesendete Nachricht erreicht alle ANDEREN Teilnehmer des Kanals, nie den Absender.
// Der Transport prüft keine Inhalte; das macht der Empfänger mit `parseMessage` (messages.ts).
import { Rng } from '../core/random';
import { parseMessage, type NetMessage, type PlayerId } from './messages';

export type Unsubscribe = () => void;

/** Presence-Zustand eines Teilnehmers (B4: wer ist da, Name, Hut/Boot, Bereit-Status). */
export interface PresenceState {
  id: PlayerId;
  name?: string;
  host?: boolean;
  hut?: string;
  boot?: string;
  bereit?: boolean;
}

export interface Transport {
  /** eigene Spieler-ID (= Supabase-User-ID in Teil B) */
  readonly selfId: PlayerId;
  /** an alle anderen im Kanal */
  broadcast(msg: NetMessage): void;
  onMessage(cb: (msg: NetMessage) => void): Unsubscribe;
  /** eigenen Presence-Zustand setzen/aktualisieren */
  track(state: PresenceState): void;
  /** vollständige Liste der Anwesenden (inkl. sich selbst) nach jeder Änderung */
  onSync(cb: (peers: PresenceState[]) => void): Unsubscribe;
  /** Kanal verlassen (Presence verschwindet bei den anderen) */
  close(): void;
  readonly closed: boolean;
}

/** Kleine Listener-Liste. */
class Listeners<T> {
  private list: ((v: T) => void)[] = [];
  add(cb: (v: T) => void): Unsubscribe {
    this.list.push(cb);
    return () => { this.list = this.list.filter((x) => x !== cb); };
  }
  emit(v: T): void { for (const cb of [...this.list]) cb(v); }
  clear(): void { this.list = []; }
}

// ------------------------------------------------------------------ LocalHub (Tests)

export interface LocalHubOptions {
  /** Grundlatenz je Zustellung (ms) */
  latencyMs?: number;
  /** zusätzliche zufällige Latenz 0…jitterMs (ms); Reihenfolge je Verbindung bleibt erhalten */
  jitterMs?: number;
  /** Anteil verlorener Nachrichten 0…1 (Presence geht nie verloren) */
  lossRate?: number;
  /** Saat für Schwankung/Verlust */
  seed?: number;
  /** Nachrichten zusätzlich durch Zod prüfen (deckt Schema-Fehler im Sender auf). Standard: true */
  validate?: boolean;
}

export interface HubStats {
  sent: number;
  delivered: number;
  dropped: number;
  sentByType: Record<string, number>;
  deliveredByType: Record<string, number>;
}

type QueueItem =
  | { kind: 'msg'; at: number; order: number; to: LocalTransport; msg: NetMessage }
  | { kind: 'presence'; at: number; order: number; to: LocalTransport }
  | { kind: 'task'; at: number; order: number; fn: () => void };

/**
 * In-Memory-Kanal mit virtueller Zeit. Nichts passiert von selbst: `advanceTo(t)` stellt alles zu, was bis `t`
 * fällig ist (auch Nachrichten, die dabei neu entstehen). So laufen Simulationen deterministisch und schnell.
 */
export class LocalHub {
  private endpoints = new Map<PlayerId, LocalTransport>();
  private queue: QueueItem[] = [];
  private order = 0;
  private linkLast = new Map<string, number>();
  private readonly rng: Rng;
  private readonly opts: Required<LocalHubOptions>;
  private time = 0;
  readonly stats: HubStats = { sent: 0, delivered: 0, dropped: 0, sentByType: {}, deliveredByType: {} };
  /** Mitschnitt aller gesendeten Nachrichten (für Tests, z. B. „Art geheim bis Fang“) */
  readonly log: { at: number; msg: NetMessage }[] = [];
  recordLog = true;
  /** Presence: verbundene Endpunkte mit Zustand */
  private presence = new Map<PlayerId, PresenceState>();

  constructor(opts: LocalHubOptions = {}) {
    this.opts = { latencyMs: 0, jitterMs: 0, lossRate: 0, seed: 1, validate: true, ...opts };
    this.rng = new Rng(this.opts.seed);
  }

  get now(): number { return this.time; }

  /** Latenz/Verlust zur Laufzeit ändern (z. B. Verbindung kurz schlecht). */
  setConditions(c: Partial<Pick<LocalHubOptions, 'latencyMs' | 'jitterMs' | 'lossRate'>>): void {
    Object.assign(this.opts, c);
  }

  connect(id: PlayerId): LocalTransport {
    const old = this.endpoints.get(id);
    if (old && !old.closed) old.close();
    const t = new LocalTransport(this, id);
    this.endpoints.set(id, t);
    return t;
  }

  /** Funktion zur virtuellen Zeit `now` (+ delayMs) ausführen (für splitTransport, Timer in Tests). */
  defer(fn: () => void, delayMs = 0): void {
    this.queue.push({ kind: 'task', at: this.time + delayMs, order: this.order++, fn });
  }

  /** @internal */
  send(from: LocalTransport, msg: NetMessage): void {
    if (this.opts.validate && !parseMessage(msg)) {
      throw new Error(`ungültige Nachricht von ${from.selfId}: ${JSON.stringify(msg).slice(0, 300)}`);
    }
    this.stats.sent++;
    this.stats.sentByType[msg.type] = (this.stats.sentByType[msg.type] ?? 0) + 1;
    if (this.recordLog) this.log.push({ at: this.time, msg });
    // Klon: Empfänger dürfen nie dieselbe Objekt-Referenz wie der Sender sehen (wie im echten Netz)
    const wire = JSON.stringify(msg);
    for (const to of this.endpoints.values()) {
      if (to === from || to.closed) continue;
      if (this.opts.lossRate > 0 && this.rng.next() < this.opts.lossRate) { this.stats.dropped++; continue; }
      const key = `${from.selfId}>${to.selfId}`;
      const jitter = this.opts.jitterMs > 0 ? this.rng.next() * this.opts.jitterMs : 0;
      const at = Math.max(this.time + this.opts.latencyMs + jitter, this.linkLast.get(key) ?? 0);
      this.linkLast.set(key, at);
      this.queue.push({ kind: 'msg', at, order: this.order++, to, msg: JSON.parse(wire) as NetMessage });
    }
  }

  /** @internal */
  setPresence(t: LocalTransport, state: PresenceState | null): void {
    if (state) this.presence.set(t.selfId, { ...state, id: t.selfId });
    else this.presence.delete(t.selfId);
    for (const to of this.endpoints.values()) {
      if (to.closed) continue;
      this.queue.push({ kind: 'presence', at: this.time + this.opts.latencyMs, order: this.order++, to });
    }
  }

  presenceList(): PresenceState[] { return [...this.presence.values()].map((p) => ({ ...p })); }

  /** Alles zustellen, was bis `t` fällig ist; Zeit steht danach auf `t`. Gibt die Anzahl Zustellungen zurück. */
  advanceTo(t: number): number {
    let n = 0;
    for (;;) {
      let idx = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i] as QueueItem;
        if (q.at > t) continue;
        const best = idx >= 0 ? (this.queue[idx] as QueueItem) : null;
        if (!best || q.at < best.at || (q.at === best.at && q.order < best.order)) idx = i;
      }
      if (idx < 0) break;
      const item = this.queue.splice(idx, 1)[0] as QueueItem;
      this.time = Math.max(this.time, item.at);
      if (item.kind === 'task') item.fn();
      else if (item.kind === 'presence') { if (!item.to.closed) item.to.deliverPresence(this.presenceList()); }
      else if (!item.to.closed) {
        this.stats.delivered++;
        this.stats.deliveredByType[item.msg.type] = (this.stats.deliveredByType[item.msg.type] ?? 0) + 1;
        item.to.deliver(item.msg);
        n++;
      }
    }
    this.time = Math.max(this.time, t);
    return n;
  }

  /** Alles sofort Fällige zustellen. */
  flush(): number { return this.advanceTo(this.time); }

  /** @internal */
  detach(t: LocalTransport): void {
    if (this.endpoints.get(t.selfId) === t) this.endpoints.delete(t.selfId);
    this.setPresence(t, null);
  }

  resetStats(): void {
    Object.assign(this.stats, { sent: 0, delivered: 0, dropped: 0, sentByType: {}, deliveredByType: {} });
    this.log.length = 0;
  }
}

export class LocalTransport implements Transport {
  private msgs = new Listeners<NetMessage>();
  private syncs = new Listeners<PresenceState[]>();
  private isClosed = false;

  constructor(private readonly hub: LocalHub, readonly selfId: PlayerId) {}

  get closed(): boolean { return this.isClosed; }

  broadcast(msg: NetMessage): void { if (!this.isClosed) this.hub.send(this, msg); }
  onMessage(cb: (msg: NetMessage) => void): Unsubscribe { return this.msgs.add(cb); }
  track(state: PresenceState): void { if (!this.isClosed) this.hub.setPresence(this, state); }
  onSync(cb: (peers: PresenceState[]) => void): Unsubscribe { return this.syncs.add(cb); }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.hub.detach(this);
    this.msgs.clear();
    this.syncs.clear();
  }

  /** @internal */ deliver(msg: NetMessage): void { this.msgs.emit(msg); }
  /** @internal */ deliverPresence(peers: PresenceState[]): void { this.syncs.emit(peers); }
}

// ------------------------------------------------------------------ splitTransport (Host-Tab)

/**
 * Zwei logische Teilnehmer (Host-Logik + eigener Client) auf einer Verbindung: Was die eine Seite sendet, geht ins
 * Netz UND (verzögert über `defer`, nie re-entrant) an die andere Seite. Presence wird zusammengeführt.
 */
export function splitTransport(base: Transport, defer: (fn: () => void) => void = (fn) => queueMicrotask(fn)): [Transport, Transport] {
  const msgs = [new Listeners<NetMessage>(), new Listeners<NetMessage>()] as const;
  const syncs = [new Listeners<PresenceState[]>(), new Listeners<PresenceState[]>()] as const;
  let shared: PresenceState = { id: base.selfId };
  let open = 2;
  base.onMessage((m) => { msgs[0].emit(m); msgs[1].emit(m); });
  base.onSync((p) => { syncs[0].emit(p); syncs[1].emit(p); });
  const side = (i: 0 | 1): Transport => {
    let closed = false;
    const other = (1 - i) as 0 | 1;
    return {
      selfId: base.selfId,
      get closed() { return closed || base.closed; },
      broadcast(msg) {
        if (closed) return;
        base.broadcast(msg);
        const copy = JSON.parse(JSON.stringify(msg)) as NetMessage;
        defer(() => msgs[other].emit(copy));
      },
      onMessage: (cb) => msgs[i].add(cb),
      track(state) {
        shared = { ...shared, ...state, id: base.selfId };
        base.track(shared);
      },
      onSync: (cb) => syncs[i].add(cb),
      close() {
        if (closed) return;
        closed = true;
        msgs[i].clear();
        syncs[i].clear();
        if (--open === 0) base.close();
      },
    };
  };
  return [side(0), side(1)];
}

// ------------------------------------------------------------------ BroadcastChannel (mehrere Tabs, E2E)

/** Rahmen auf dem BroadcastChannel (Transport-intern, zählt nicht als Spielnachricht). */
type BcFrame =
  | { k: 'm'; from: PlayerId; msg: NetMessage }
  | { k: 'p'; state: PresenceState }
  | { k: 'bye'; id: PlayerId }
  | { k: 'hello'; id: PlayerId };

export interface BroadcastChannelOptions {
  /** Herzschlag der Presence (ms) */
  heartbeatMs?: number;
  /** ohne Herzschlag so lange → gilt als weg (ms) */
  timeoutMs?: number;
  /** Uhr (Tests) */
  now?: () => number;
  /** Kanal-Fabrik (Tests); Standard: globales BroadcastChannel */
  channel?: (name: string) => BroadcastChannel;
}

/**
 * Tabs desselben Browsers (gleicher Ursprung) bilden einen Raum. Presence: jeder Tab schickt alle `heartbeatMs`
 * seinen Zustand; fehlt er `timeoutMs` lang (Tab geschlossen, eingefroren), verschwindet er. `close()` meldet sich ab.
 * Die Werte sind Transport-Technik für Tests, keine Spielzahlen.
 */
export class BroadcastChannelTransport implements Transport {
  private readonly ch: BroadcastChannel;
  private msgs = new Listeners<NetMessage>();
  private syncs = new Listeners<PresenceState[]>();
  private peers = new Map<PlayerId, { state: PresenceState; seen: number }>();
  private own: PresenceState | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isClosed = false;
  private readonly heartbeatMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(readonly channelName: string, readonly selfId: PlayerId, opts: BroadcastChannelOptions = {}) {
    this.heartbeatMs = opts.heartbeatMs ?? 1000;
    this.timeoutMs = opts.timeoutMs ?? 3500;
    this.now = opts.now ?? (() => Date.now());
    this.ch = (opts.channel ?? ((n) => new BroadcastChannel(n)))(`ctd:${channelName}`);
    this.ch.onmessage = (ev: MessageEvent) => this.onFrame(ev.data as BcFrame);
    this.timer = setInterval(() => this.beat(), this.heartbeatMs);
    (this.timer as { unref?: () => void }).unref?.();
    this.post({ k: 'hello', id: selfId });
  }

  get closed(): boolean { return this.isClosed; }

  private post(f: BcFrame): void { if (!this.isClosed) this.ch.postMessage(f); }

  private onFrame(f: BcFrame): void {
    if (this.isClosed || !f || typeof f !== 'object') return;
    switch (f.k) {
      case 'm': {
        if (f.from === this.selfId) return;
        const m = parseMessage(f.msg);
        if (m) this.msgs.emit(m);
        return;
      }
      case 'p': {
        if (f.state.id === this.selfId) return;
        const prev = this.peers.get(f.state.id);
        this.peers.set(f.state.id, { state: f.state, seen: this.now() });
        if (!prev || JSON.stringify(prev.state) !== JSON.stringify(f.state)) this.emitSync();
        return;
      }
      case 'bye':
        if (this.peers.delete(f.id)) this.emitSync();
        return;
      case 'hello':
        // Neuer Tab: sofort eigenen Zustand schicken, damit er nicht einen ganzen Herzschlag warten muss
        if (f.id !== this.selfId && this.own) this.post({ k: 'p', state: this.own });
        return;
    }
  }

  private beat(): void {
    if (this.own) this.post({ k: 'p', state: this.own });
    const t = this.now();
    let changed = false;
    for (const [id, p] of this.peers) if (t - p.seen > this.timeoutMs) { this.peers.delete(id); changed = true; }
    if (changed) this.emitSync();
  }

  private emitSync(): void {
    const list = [...this.peers.values()].map((p) => p.state);
    if (this.own) list.push(this.own);
    this.syncs.emit(list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  }

  broadcast(msg: NetMessage): void { this.post({ k: 'm', from: this.selfId, msg }); }
  onMessage(cb: (msg: NetMessage) => void): Unsubscribe { return this.msgs.add(cb); }
  track(state: PresenceState): void {
    this.own = { ...state, id: this.selfId };
    this.post({ k: 'p', state: this.own });
    this.emitSync();
  }
  onSync(cb: (peers: PresenceState[]) => void): Unsubscribe { return this.syncs.add(cb); }

  close(): void {
    if (this.isClosed) return;
    this.post({ k: 'bye', id: this.selfId });
    this.isClosed = true;
    if (this.timer) clearInterval(this.timer);
    this.ch.onmessage = null;
    this.ch.close();
    this.msgs.clear();
    this.syncs.clear();
  }
}
