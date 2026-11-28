// src/net/budget.ts – Debug-Zähler: Realtime-Nachrichten pro Runde (B4: 4 Spieler × 5 min < 15.000).
// Zählt je Endpunkt gesendete und empfangene Nachrichten nach Typ. Eine Runde beginnt mit `phaseEnd` Countdown
// und endet mit `phaseEnd` Lobby/Aborted (automatisch, wenn der Zähler als Transport-Hülle läuft).
// Hinweis: Wie Supabase genau zählt (nur Senden oder Senden + jede Zustellung) ist [UNGEPRÜFT] → beide Werte.
import type { MessageType, NetMessage } from './messages';
import type { Transport } from './transport';

export interface RoundCount {
  round: number;
  sent: number;
  received: number;
  byType: Partial<Record<MessageType, { sent: number; received: number }>>;
  startedAt: number;
  endedAt: number | null;
}

export class MessageBudget {
  private cur: RoundCount;
  readonly history: RoundCount[] = [];
  /** alles seit dem Start (auch Lobby) */
  readonly total = { sent: 0, received: 0 };

  constructor(readonly limit: number, private readonly now: () => number = () => Date.now()) {
    this.cur = this.fresh(0);
  }

  private fresh(round: number): RoundCount {
    return { round, sent: 0, received: 0, byType: {}, startedAt: this.now(), endedAt: null };
  }

  record(dir: 'sent' | 'received', msg: NetMessage): void {
    if (msg.type === 'phaseEnd' && msg.data.phase === 'Countdown') this.startRound(msg.data.runde);
    this.total[dir]++;
    this.cur[dir]++;
    const t = (this.cur.byType[msg.type] ??= { sent: 0, received: 0 });
    t[dir]++;
    if (msg.type === 'phaseEnd' && (msg.data.phase === 'Lobby' || msg.data.phase === 'Aborted')) this.endRound();
  }

  /** Neue Runde zählen (eine laufende Runde wird vorher abgeschlossen). */
  startRound(round: number): void {
    if (this.cur.round === round && this.cur.endedAt === null) return;
    this.endRound();
    this.cur = this.fresh(round);
  }

  endRound(): void {
    if (this.cur.round > 0 && this.cur.endedAt === null) {
      this.cur.endedAt = this.now();
      this.history.push(this.cur);
    }
    this.cur = this.fresh(0);
  }

  get current(): RoundCount { return this.cur; }

  /** Endpunkt-Sicht: gesendet + empfangen ≈ alle Sendungen im Raum (jeder empfängt alle Broadcasts der anderen). */
  roomSends(c: RoundCount = this.cur): number { return c.sent + c.received; }

  overLimit(c: RoundCount = this.cur): boolean { return this.roomSends(c) >= this.limit; }

  summary(c: RoundCount = this.cur): string {
    const types = Object.entries(c.byType)
      .map(([k, v]) => [k, (v?.sent ?? 0) + (v?.received ?? 0)] as const)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    return `Runde ${c.round}: ${this.roomSends(c)} / ${this.limit} (gesendet ${c.sent}, empfangen ${c.received}) – ${types}`;
  }
}

/** Transport-Hülle, die jede Nachricht zählt. */
export function countingTransport(t: Transport, budget: MessageBudget): Transport {
  // Selbst gesendete phaseEnd-Nachrichten (Host) starten/enden die Runde ebenfalls
  return {
    get selfId() { return t.selfId; },
    get closed() { return t.closed; },
    broadcast(msg) { budget.record('sent', msg); t.broadcast(msg); },
    onMessage(cb) { return t.onMessage((m) => { budget.record('received', m); cb(m); }); },
    track: (s) => t.track(s),
    onSync: (cb) => t.onSync(cb),
    close: () => t.close(),
  };
}
