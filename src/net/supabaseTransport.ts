// src/net/supabaseTransport.ts – Transport über Supabase Realtime (B4): Kanal `raum:<CODE>`, Broadcast + Presence.
//
// API geprüft an @supabase/realtime-js 2.119.0 (dist/main/RealtimeChannel.d.ts):
//   client.channel(name, { config: { broadcast: { self, ack }, presence: { key, enabled }, private } })
//   channel.on('broadcast', { event }, cb) · channel.on('presence', { event: 'sync' }, cb) · channel.presenceState()
//   channel.subscribe((status, err) => …)  status ∈ SUBSCRIBED | TIMED_OUT | CLOSED | CHANNEL_ERROR
//   channel.send({ type: 'broadcast', event, payload }) · channel.track(payload) · channel.untrack() · client.removeChannel(ch)
//
// Eigenschaften:
//  - `self: false`: eigene Nachrichten kommen nicht zurück (wie LocalTransport).
//  - Puffer: Was vor SUBSCRIBED gesendet wird, geht nach dem Beitritt raus (in Reihenfolge, gedeckelt).
//  - Wiederverbindung: Nach erneutem SUBSCRIBED (realtime-js tritt nach Netzabbruch selbst wieder bei
//    [UNGEPRÜFT: genaues Rejoin-Verhalten]) wird die Presence neu gesetzt und `onReconnect` gemeldet → Client holt `sync`.
//    Meldet der Kanal CLOSED/CHANNEL_ERROR ohne eigenes `close()`, wird er nach kurzer Pause neu angelegt.
//  - Absender: `from` jeder gesendeten Nachricht muss die eigene User-ID sein (sonst Fehler). Fremde Nachrichten mit
//    der eigenen ID als `from` werden verworfen. Echte Prüfung des Absenders bräuchte einen Server: Broadcast-Inhalte
//    sind vom Client frei wählbar (Risiko dokumentiert).
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { parseMessage, type NetMessage, type PlayerId } from './messages';
import { roomChannel } from './roomCode';
import type { PresenceState, Transport, Unsubscribe } from './transport';

export interface SupabaseTransportOptions {
  client: SupabaseClient;
  roomCode: string;
  /** Supabase-User-ID (anonyme Anmeldung) = Spieler-ID */
  userId: PlayerId;
  /** Privater Kanal mit RLS (supabase/migrations); braucht einen angemeldeten Nutzer */
  privateChannel?: boolean;
  /** höchstens so viele Nachrichten puffern, solange der Kanal nicht steht */
  maxQueue?: number;
  /** Pause vor dem Neuaufbau nach CLOSED/CHANNEL_ERROR (ms) */
  retryMs?: number;
  /** Statusmeldungen (Debug-Anzeige) */
  onStatus?: (status: string, detail?: string) => void;
}

const EVENT = 'm';

class Listeners<T> {
  private list: ((v: T) => void)[] = [];
  add(cb: (v: T) => void): Unsubscribe { this.list.push(cb); return () => { this.list = this.list.filter((x) => x !== cb); }; }
  emit(v: T): void { for (const cb of [...this.list]) cb(v); }
  clear(): void { this.list = []; }
}

export class SupabaseTransport implements Transport {
  readonly selfId: PlayerId;
  private ch: RealtimeChannel | null = null;
  private msgs = new Listeners<NetMessage>();
  private syncs = new Listeners<PresenceState[]>();
  private reconnects = new Listeners<void>();
  private queue: NetMessage[] = [];
  private own: PresenceState | null = null;
  private subscribed = false;
  private everSubscribed = false;
  private isClosed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** zuletzt gemeldeter Kanalstatus (Debug) */
  status = 'neu';
  readonly stats = { sent: 0, received: 0, queued: 0, dropped: 0, invalid: 0, rejoins: 0 };

  constructor(private readonly o: SupabaseTransportOptions) {
    this.selfId = o.userId;
    this.open();
  }

  get closed(): boolean { return this.isClosed; }

  private open(): void {
    const ch = this.o.client.channel(roomChannel(this.o.roomCode), {
      config: { broadcast: { self: false }, presence: { key: this.selfId, enabled: true }, private: this.o.privateChannel ?? false },
    });
    ch.on('broadcast', { event: EVENT }, (p) => this.onBroadcast((p as { payload?: unknown }).payload));
    ch.on('presence', { event: 'sync' }, () => this.emitPresence());
    ch.subscribe((status, err) => this.onStatus(status, err));
    this.ch = ch;
  }

  private onStatus(status: string, err?: Error): void {
    if (this.isClosed) return;
    this.status = status;
    this.o.onStatus?.(status, err?.message);
    if (status === 'SUBSCRIBED') {
      const again = this.everSubscribed;
      this.subscribed = true;
      this.everSubscribed = true;
      if (this.own) void this.ch?.track({ ...this.own });
      const q = this.queue;
      this.queue = [];
      for (const m of q) this.sendNow(m);
      if (again) { this.stats.rejoins++; this.reconnects.emit(); }
      return;
    }
    this.subscribed = false;
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') this.scheduleReopen();
  }

  private scheduleReopen(): void {
    if (this.isClosed || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.isClosed) return;
      const old = this.ch;
      this.ch = null;
      if (old) void this.o.client.removeChannel(old);
      this.open();
    }, this.o.retryMs ?? 2000);
  }

  private onBroadcast(payload: unknown): void {
    const m = parseMessage(payload);
    if (!m) { this.stats.invalid++; return; }
    if (m.from === this.selfId) { this.stats.invalid++; return; } // jemand gibt sich als ich aus (self: false)
    this.stats.received++;
    this.msgs.emit(m);
  }

  private emitPresence(): void {
    const st = this.ch?.presenceState<Record<string, unknown>>() ?? {};
    const list: PresenceState[] = [];
    for (const [key, entries] of Object.entries(st)) {
      const first = entries[0] as Record<string, unknown> | undefined;
      if (!first) continue;
      const rest: Record<string, unknown> = { ...first };
      delete rest.presence_ref;
      list.push({ ...(rest as Partial<PresenceState>), id: key });
    }
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.syncs.emit(list);
  }

  private sendNow(m: NetMessage): void {
    this.stats.sent++;
    void this.ch?.send({ type: 'broadcast', event: EVENT, payload: m });
  }

  broadcast(msg: NetMessage): void {
    if (this.isClosed) return;
    if (msg.from !== this.selfId) throw new Error(`Absender ${msg.from} ist nicht der angemeldete Nutzer`);
    if (this.subscribed) { this.sendNow(msg); return; }
    if (this.queue.length >= (this.o.maxQueue ?? 500)) { this.queue.shift(); this.stats.dropped++; }
    this.queue.push(msg);
    this.stats.queued++;
  }

  onMessage(cb: (msg: NetMessage) => void): Unsubscribe { return this.msgs.add(cb); }
  onSync(cb: (peers: PresenceState[]) => void): Unsubscribe { return this.syncs.add(cb); }
  onReconnect(cb: () => void): Unsubscribe { return this.reconnects.add(cb); }

  track(state: PresenceState): void {
    this.own = { ...state, id: this.selfId };
    if (this.subscribed) void this.ch?.track({ ...this.own });
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const ch = this.ch;
    this.ch = null;
    if (ch) {
      void ch.untrack().catch(() => undefined).finally(() => { void this.o.client.removeChannel(ch); });
    }
    this.msgs.clear();
    this.syncs.clear();
    this.reconnects.clear();
  }
}
