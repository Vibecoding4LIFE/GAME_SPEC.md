// Transporte: LocalHub (Latenz, Reihenfolge, Verlust, Presence), splitTransport (Host-Tab), BroadcastChannel (Tabs).
import { afterEach, describe, expect, it } from 'vitest';
import { Outbox, type NetMessage } from '../../src/net/messages';
import { BroadcastChannelTransport, LocalHub, splitTransport, type PresenceState, type Transport } from '../../src/net/transport';

const emote = (o: Outbox) => o.make('emote', { id: 'fisch' });

describe('LocalHub', () => {
  it('stellt an alle anderen zu (nie an sich selbst), mit Latenz und erhaltener Reihenfolge trotz Schwankung', () => {
    const hub = new LocalHub({ latencyMs: 50, jitterMs: 40, seed: 3 });
    const a = hub.connect('a');
    const b = hub.connect('b');
    const c = hub.connect('c');
    const got: Record<string, number[]> = { a: [], b: [], c: [] };
    for (const [id, t] of [['a', a], ['b', b], ['c', c]] as const) t.onMessage((m) => got[id]?.push(m.seq));
    const o = new Outbox('a', () => hub.now);
    for (let i = 0; i < 20; i++) a.broadcast(emote(o));
    hub.advanceTo(49);
    expect(got.b).toEqual([]);
    hub.advanceTo(200);
    const seqs = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(got.b).toEqual(seqs);
    expect(got.c).toEqual(seqs);
    expect(got.a).toEqual([]);
    expect(hub.stats).toMatchObject({ sent: 20, delivered: 40, dropped: 0 });
  });

  it('Paketverlust ist seedbar und wird gezählt; ungültige Nachrichten werfen beim Sender', () => {
    const run = () => {
      const hub = new LocalHub({ lossRate: 0.3, seed: 9 });
      const a = hub.connect('a');
      const b = hub.connect('b');
      const got: number[] = [];
      b.onMessage((m) => got.push(m.seq));
      const o = new Outbox('a', () => 0);
      for (let i = 0; i < 200; i++) a.broadcast(emote(o));
      hub.flush();
      return { got, dropped: hub.stats.dropped };
    };
    const r1 = run();
    expect(r1.dropped).toBeGreaterThan(30);
    expect(r1.dropped).toBeLessThan(90);
    expect(r1.got.length + r1.dropped).toBe(200);
    expect(run()).toEqual(r1);
    const hub = new LocalHub();
    const a = hub.connect('a');
    expect(() => a.broadcast({ type: 'cast', from: 'a', seq: 1, ts: 0, data: { kraft: 2, ziel: 1 } } as NetMessage)).toThrow();
  });

  it('Presence: track/close melden allen die vollständige Liste; neue Verbindung mit gleicher ID ersetzt die alte', () => {
    const hub = new LocalHub({ latencyMs: 10 });
    const a = hub.connect('a');
    const b = hub.connect('b');
    let lastA: PresenceState[] = [];
    a.onSync((p) => { lastA = p; });
    a.track({ id: 'a', host: true });
    b.track({ id: 'b', name: 'Bea' });
    hub.advanceTo(20);
    expect(lastA.map((p) => p.id).sort()).toEqual(['a', 'b']);
    b.close();
    hub.advanceTo(40);
    expect(lastA.map((p) => p.id)).toEqual(['a']);
    const a2 = hub.connect('a');
    expect(a.closed).toBe(true);
    expect(a2.closed).toBe(false);
  });
});

describe('splitTransport (Host + eigener Client im Host-Tab)', () => {
  it('beide Seiten bekommen Netz-Nachrichten; was eine Seite sendet, sieht die andere (verzögert) und das Netz', () => {
    const hub = new LocalHub();
    const base = hub.connect('h');
    const [host, client] = splitTransport(base, (fn) => hub.defer(fn));
    const other = hub.connect('x');
    const seen = { host: [] as string[], client: [] as string[], other: [] as string[] };
    host.onMessage((m) => seen.host.push(`${m.from}:${m.type}`));
    client.onMessage((m) => seen.client.push(`${m.from}:${m.type}`));
    other.onMessage((m) => seen.other.push(`${m.from}:${m.type}`));
    const oh = new Outbox('h', () => 0);
    const ox = new Outbox('x', () => 0);
    client.broadcast(oh.make('ready', { bereit: true }));
    expect(seen.host).toEqual([]); // nie re-entrant
    host.broadcast(oh.make('emote', { id: 'lachen' }));
    other.broadcast(ox.make('emote', { id: 'fisch' }));
    hub.flush();
    expect(seen.host).toEqual(['h:ready', 'x:emote']);
    expect(seen.client).toEqual(['h:emote', 'x:emote']);
    expect(seen.other).toEqual(['h:ready', 'h:emote']);
    // Presence wird zusammengeführt
    host.track({ id: 'h', host: true });
    client.track({ id: 'h', name: 'Hanna' });
    hub.flush();
    expect(hub.presenceList()).toEqual([{ id: 'h', host: true, name: 'Hanna' }]);
    host.close();
    expect(base.closed).toBe(false);
    client.close();
    expect(base.closed).toBe(true);
  });
});

describe('BroadcastChannelTransport (Tabs ohne Server)', () => {
  const open: Transport[] = [];
  afterEach(() => { for (const t of open) t.close(); open.length = 0; });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('Nachrichten und Presence zwischen zwei Endpunkten, Abmeldung und Zeitüberschreitung', async () => {
    const room = `test-${Math.random()}`;
    const a = new BroadcastChannelTransport(room, 'a', { heartbeatMs: 20, timeoutMs: 80 });
    const b = new BroadcastChannelTransport(room, 'b', { heartbeatMs: 20, timeoutMs: 80 });
    open.push(a, b);
    const got: NetMessage[] = [];
    let peersA: string[] = [];
    b.onMessage((m) => got.push(m));
    a.onSync((p) => { peersA = p.map((x) => x.id); });
    a.track({ id: 'a', host: true });
    b.track({ id: 'b' });
    const o = new Outbox('a', () => 0);
    a.broadcast(o.make('emote', { id: 'petriHeil' }));
    await wait(60);
    expect(got.map((m) => m.type)).toEqual(['emote']);
    expect(peersA).toEqual(['a', 'b']);
    b.close();
    await wait(40);
    expect(peersA).toEqual(['a']);
    // „eingefrorener“ Tab: Herzschlag bleibt aus → nach timeoutMs weg
    const c = new BroadcastChannelTransport(room, 'c', { heartbeatMs: 20, timeoutMs: 80 });
    c.track({ id: 'c' });
    await wait(50);
    expect(peersA).toEqual(['a', 'c']);
    (c as unknown as { timer: ReturnType<typeof setInterval> }).timer && clearInterval((c as unknown as { timer: ReturnType<typeof setInterval> }).timer);
    await wait(200);
    expect(peersA).toEqual(['a']);
    c.close();
  });
});
