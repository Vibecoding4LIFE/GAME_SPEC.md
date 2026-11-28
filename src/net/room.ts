// src/net/room.ts – Browser-Verdrahtung eines Raums: Transport (Supabase Realtime oder BroadcastChannel), Spieler-ID,
// Host-Takt, Nachrichten-Zähler. Kein Phaser. Die Szene treibt den Client mit `client.step`; solange keine Szene
// läuft (Warteraum), pumpt `RoomSession` den Client selbst (Beitritt wiederholen, Ping-Pong, Host-Verlust).
import { IDLE_INPUT } from '../game/session';
import type { ShadowParams } from '../game/shadows';
import type { GameData } from '../game/types';
import { MessageBudget, countingTransport } from './budget';
import { NetClient, type ClientProfile } from './client';
import { netConfigFrom } from './config';
import { NetHost } from './host';
import type { LobbySettings } from './messages';
import { generateRoomCode, normalizeRoomCode } from './roomCode';
import { BroadcastChannelTransport, splitTransport, type Transport } from './transport';

export type NetBackend = 'supabase' | 'lokal';

export interface RoomOpenOptions {
  backend: NetBackend;
  /** null = neuen Raum erstellen (man wird Host) */
  code: string | null;
  profile: ClientProfile;
  data: GameData;
  shadows: ShadowParams;
  bottomDepthAt?: (distanceM: number) => number;
  /** nur Tests: zusätzliche Rundendauer in s (z. B. `?testdauer=90`), wird gleich eingestellt */
  testDurationS?: number | null;
  /** Host-Takt (ms); Technik, kein Spielwert */
  hostTickMs?: number;
  /** wie lange auf `sync`/`deny` gewartet wird (ms) */
  joinTimeoutMs?: number;
}

export type OpenFailure = 'auth' | 'anonymAus' | 'nichtKonfiguriert' | 'gesperrt' | 'voll' | 'zeit' | 'code' | 'netz';
export type OpenResult = { ok: true; room: RoomSession } | { ok: false; reason: OpenFailure; detail: string };

const random01 = (): number => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] as number) / 2 ** 32;
};

/** Spieler-ID ohne Server (BroadcastChannel): pro Tab, übersteht Neuladen (sessionStorage) → Reconnect klappt. */
export function localPlayerId(): string {
  const KEY = 'ctd.netId';
  try {
    const old = sessionStorage.getItem(KEY);
    if (old) return old;
    const id = `p-${crypto.randomUUID().slice(0, 12)}`;
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return `p-${crypto.randomUUID().slice(0, 12)}`;
  }
}

export class RoomSession {
  readonly budget: MessageBudget;
  private hostTimer: ReturnType<typeof setInterval> | null = null;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private lastPump = performance.now();
  /** true, solange eine Szene `client.step` aufruft */
  driven = false;
  private closedFlag = false;
  /** Status des Supabase-Kanals (Debug) */
  channelStatus = '';

  private constructor(
    readonly code: string, readonly backend: NetBackend, readonly userId: string, readonly client: NetClient,
    readonly host: NetHost | null, budget: MessageBudget, private readonly transport: Transport,
  ) {
    this.budget = budget;
  }

  get isHost(): boolean { return this.host !== null; }
  get closed(): boolean { return this.closedFlag; }

  static async open(o: RoomOpenOptions): Promise<OpenResult> {
    const code = o.code === null ? generateRoomCode(random01) : normalizeRoomCode(o.code);
    if (!code) return { ok: false, reason: 'code', detail: String(o.code) };
    const cfg = netConfigFrom(o.data.balancing);
    const budget = new MessageBudget(cfg.budget.perRound, () => performance.now());
    let base: Transport;
    let userId: string;
    let statusRef: { set: (s: string) => void } = { set: () => undefined };
    if (o.backend === 'lokal') {
      userId = localPlayerId();
      base = new BroadcastChannelTransport(code, userId);
    } else {
      const { ensureUser, getSupabase, supabaseEnv } = await import('./supabase');
      const auth = await ensureUser();
      if (!auth.ok) {
        const reason: OpenFailure = auth.code === 'anonymAus' ? 'anonymAus' : auth.code === 'nichtKonfiguriert' ? 'nichtKonfiguriert' : auth.code === 'netz' ? 'netz' : 'auth';
        return { ok: false, reason, detail: auth.detail };
      }
      userId = auth.userId;
      const { SupabaseTransport } = await import('./supabaseTransport');
      const client = await getSupabase();
      const holder: { status: string } = { status: '' };
      statusRef = { set: (s) => { holder.status = s; } };
      base = new SupabaseTransport({
        client, roomCode: code, userId, privateChannel: supabaseEnv()?.privateChannels ?? false, onStatus: (s) => statusRef.set(s),
      });
    }
    const counted = countingTransport(base, budget);
    let host: NetHost | null = null;
    let clientT: Transport = counted;
    if (o.code === null) {
      const [hostT, cT] = splitTransport(counted);
      clientT = cT;
      const extra = o.testDurationS ? [o.testDurationS] : [];
      const settings: Partial<LobbySettings> = o.testDurationS ? { dauerS: o.testDurationS } : {};
      host = new NetHost({
        transport: hostT, data: o.data, seed: Math.floor(random01() * 2 ** 31), now: () => performance.now(),
        shadows: o.shadows, bottomDepthAt: o.bottomDepthAt, extraDurationsS: extra, settings,
      });
    }
    const client = new NetClient({ transport: clientT, data: o.data, profile: o.profile, now: () => performance.now() });
    const room = new RoomSession(code, o.backend, userId, client, host, budget, base);
    statusRef.set = (s) => { room.channelStatus = s; };
    room.start(o.hostTickMs ?? 50);
    client.join();
    const deadline = performance.now() + (o.joinTimeoutMs ?? 15000);
    while (!client.synced && !client.denied && performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (client.synced) return { ok: true, room };
    room.close();
    if (client.denied) return { ok: false, reason: client.denied === 'voll' ? 'voll' : 'gesperrt', detail: client.denied };
    return { ok: false, reason: 'zeit', detail: `kein sync nach ${o.joinTimeoutMs ?? 15000} ms` };
  }

  private start(hostTickMs: number): void {
    // Hintergrund-Tabs drosseln Timer (Chrome: höchstens 1×/s) – siehe Hinweis an den Host (B4)
    if (this.host) this.hostTimer = setInterval(() => this.host?.tick(), hostTickMs);
    this.pumpTimer = setInterval(() => this.pump(), 100);
  }

  private pump(): void {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastPump) / 1000);
    this.lastPump = now;
    if (!this.driven && !this.closedFlag) this.client.step(dt, IDLE_INPUT);
  }

  /** Einladungslink (B4): aktuelle Adresse ohne Query + `?raum=CODE` (+ Netz-Parameter im Offline-Test). */
  link(base: string): string {
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    url.searchParams.set('raum', this.code);
    if (this.backend === 'lokal') url.searchParams.set('netz', 'lokal');
    return url.toString();
  }

  /** Raum verlassen. Host: Runde endet für alle (B4). */
  close(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    if (this.hostTimer) clearInterval(this.hostTimer);
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    if (this.host) this.host.close();
    this.client.leave();
    if (!this.transport.closed) this.transport.close();
  }
}
