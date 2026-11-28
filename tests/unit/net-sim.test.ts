// Simulation über LocalHub (B4/H Phase 2): 4 Bot-Spieler × 5 min, Punkte überall gleich, Nachrichten-Budget,
// Art geheim bis Fang, Finale/verdeckte Punkte, Determinismus, Reconnect, Host weg, schlechtes Netz.
import { describe, expect, it } from 'vitest';
import { MessageBudget, countingTransport } from '../../src/net/budget';
import { netConfigFrom } from '../../src/net/config';
import type { NetMessage } from '../../src/net/messages';
import { RoomSim, type RoomSimOptions } from '../../src/net/sim';
import { b, data } from './helpers/gameData';

const CFG = netConfigFrom(b);

const SHADOWS = { max: 40, minXM: 0, maxXM: 30, speedMs: [0.15, 0.7] as [number, number], ttlS: [14, 32] as [number, number], spawnPerS: 0.5 };
const SKEW = [0, 1500, -800, 30000];

function makeSim(o: Partial<RoomSimOptions> = {}) {
  return new RoomSim({ data, seed: 7, players: 4, shadows: SHADOWS, hub: { latencyMs: 40 }, skewMs: (i) => SKEW[i] ?? 0, ...o });
}

function startRound(sim: RoomSim): void {
  sim.runFor(1);
  for (const c of sim.clients.values()) expect(c.synced).toBe(true);
  sim.readyAll();
  expect(sim.runUntil(() => sim.host.phase === 'Fishing', 10)).toBe(true);
}

const finalScores = (sim: RoomSim) => [...sim.clients.values()].map((c) => c.scores?.liste.map((x) => `${x.spieler}:${x.punkte}`).join(','));

describe('Simulation: 4 Bots × 5 Minuten', () => {
  const budgets = new Map<string, MessageBudget>();
  const sim = makeSim({
    wrap: (t, id) => { const bud = new MessageBudget(CFG.budget.perRound); budgets.set(id, bud); return countingTransport(t, bud); },
  });
  startRound(sim);
  const roundStartSent = sim.hub.log.findIndex((e) => e.msg.type === 'phaseEnd' && e.msg.data.phase === 'Countdown');
  const phasesSeen = new Set<string>();
  sim.runUntil(() => { phasesSeen.add(sim.host.phase); return sim.host.phase === 'Lobby'; }, 400);
  sim.runFor(1); // letzte Nachrichten (phaseEnd Lobby) zustellen
  const log = sim.hub.log.slice(roundStartSent);
  const hostPts = sim.host.pointsById();

  it('durchläuft alle Phasen und jeder Bot fängt etwas', () => {
    expect([...phasesSeen]).toEqual(['Fishing', 'Finale', 'LastCast', 'Results', 'Lobby']);
    const results = sim.host.results;
    expect(results?.plaetze).toHaveLength(4);
    for (const p of results?.plaetze ?? []) expect(p.faenge).toBeGreaterThanOrEqual(5);
    console.info('Punkte', hostPts, 'Fänge', results?.plaetze.map((p) => p.faenge));
  });

  it('Punkte, Ergebnis und Fang-Feed sind bei allen Clients identisch mit dem Host', () => {
    const expected = sim.host.playerIds().map((id) => `${id}:${hostPts[id]}`).join(',');
    expect(finalScores(sim)).toEqual([expected, expected, expected, expected]);
    const res = JSON.stringify(sim.host.results);
    for (const c of sim.clients.values()) {
      expect(JSON.stringify(c.results)).toBe(res);
      expect(c.feed.length).toBe(sim.host.results?.plaetze.reduce((s, p) => s + p.faenge, 0));
      expect(c.stats.gapsDetected).toBe(0);
    }
    // Summe der Fangpunkte = Punktestand
    for (const pl of sim.host.lastReport?.spieler ?? []) expect(pl.faenge.reduce((s, c) => s + (c.punkte ?? 0), 0)).toBe(pl.punkte);
  });

  it('ehrliche Bots werden nie als unplausibel abgelehnt', () => {
    expect(sim.host.rejections.filter((r) => r.type === 'reelResult' || r.type === 'lure')).toEqual([]);
  });

  it('Nachrichten pro Runde < 15.000 (gesendet und zugestellt), Debug-Zähler stimmt mit dem Hub überein', () => {
    const sent = log.length;
    const perType: Record<string, number> = {};
    for (const e of log) perType[e.msg.type] = (perType[e.msg.type] ?? 0) + 1;
    const receivers = 3;
    const delivered = sent * receivers;
    console.info(`Nachrichten Runde 1: gesendet ${sent}, zugestellt ≈ ${delivered}`, JSON.stringify(perType));
    expect(sent).toBeLessThan(CFG.budget.perRound);
    expect(delivered).toBeLessThan(CFG.budget.perRound);
    const hostBudget = budgets.get('spieler-1') as MessageBudget;
    const r1 = hostBudget.history.find((h) => h.round === 1);
    expect(r1).toBeDefined();
    // Host-Endpunkt sieht alles: eigene Sendungen + alle Sendungen der anderen
    expect(hostBudget.roomSends(r1)).toBe(sent);
    const sumReceived = [...budgets.values()].reduce((s, bud) => s + (bud.history.find((h) => h.round === 1)?.received ?? 0), 0);
    expect(sumReceived).toBe(delivered);
    console.info(hostBudget.summary(r1));
  });

  it('die Fischart steht vor dem Fang in keiner Nachricht (außer catch, results und dem Feed in sync)', () => {
    const names = data.fish.filter((f) => f.world === 'W1').flatMap((f) => [f.displayNameDe, f.slug, f.assetKey, f.nameKey]);
    const leaks: string[] = [];
    for (const { msg } of sim.hub.log) {
      if (msg.type === 'catch' || msg.type === 'join') continue;
      const m = msg.type === 'sync' ? { ...msg, data: { ...msg.data, feed: [] } } : msg;
      const s = JSON.stringify(m);
      if (/"F\d{3}"/.test(s) || names.some((n) => n.length > 3 && s.includes(`"${n}"`))) leaks.push(s.slice(0, 120));
    }
    expect(leaks).toEqual([]);
    expect(log.filter((e) => e.msg.type === 'bite').length).toBeGreaterThan(20);
  });

  it('Finale ×1,5 und verdeckte Punkte in den letzten 30 s', () => {
    const fin = sim.host.lastReport as NonNullable<typeof sim.host.lastReport>;
    const finaleStart = fin.fishingEnd - b.score.finale.lastS * 1000;
    const hiddenFrom = fin.fishingEnd - b.catchup.hiddenScoreLastS * 1000;
    const catches = fin.spieler.flatMap((p) => p.faenge);
    expect(catches.some((c) => c.finale)).toBe(true);
    for (const c of catches) expect(c.finale).toBe(c.t >= finaleStart);
    const resultsAt = (sim.hub.log.find((e) => e.msg.type === 'results')?.at ?? 0);
    for (const { at, msg } of log) {
      if (msg.type === 'scores' && at > hiddenFrom && at < resultsAt) {
        expect(msg.data.verdeckt).toBe(true);
        expect(msg.data.liste.every((x) => x.punkte === null && x.rueckenwind === null)).toBe(true);
      }
      if (msg.type === 'catch' && at > hiddenFrom) expect(msg.data.punkte).toBeNull();
      if (msg.type === 'scores' && at < hiddenFrom) expect(msg.data.verdeckt).toBe(false);
    }
    expect(log.some((e) => e.msg.type === 'scores' && e.msg.data.verdeckt)).toBe(true);
  });

  it('Uhr-Versatz per Ping-Pong: jeder Client kennt die Host-Uhr auf wenige ms genau', () => {
    sim.ids.forEach((id, i) => {
      const c = sim.client(id);
      expect(Math.abs(c.clock.offsetMs + (SKEW[i] ?? 0))).toBeLessThan(5);
      expect(Math.abs(c.hostNow() - sim.hub.now)).toBeLessThan(5);
    });
  });

  it('Rückenwind wird vergeben, wenn jemand weit hinten liegt', () => {
    const tw = log.filter((e) => e.msg.type === 'scores').flatMap((e) => (e.msg as Extract<NetMessage, { type: 'scores' }>).data.liste.map((x) => x.rueckenwind));
    expect(tw.some((x) => x === 1 || x === 2)).toBe(true);
  });
});

describe('Simulation: Determinismus, Reconnect, Host weg, schlechtes Netz', () => {
  const play = (seed: number) => {
    const sim = makeSim({ seed });
    startRound(sim);
    sim.runUntil(() => sim.host.phase === 'Lobby', 400);
    return { results: JSON.stringify(sim.host.results), msgs: sim.hub.stats.sent };
  };

  it('gleiche Saat → identischer Rundenverlauf; andere Saat → anderer', () => {
    const a = play(21);
    expect(play(21)).toEqual(a);
    expect(play(22).results).not.toBe(a.results);
  });

  it('Client lädt mitten in der Runde neu (auch im Drill) und spielt mit derselben ID weiter', () => {
    const sim = makeSim({ seed: 31 });
    startRound(sim);
    sim.runFor(100);
    const id = 'spieler-3';
    // während eines Drills neu laden
    expect(sim.runUntil(() => sim.client(id).own.rod === 'Reeling', 60)).toBe(true);
    const pointsBefore = sim.host.pointsById()[id];
    const feedBefore = sim.client('spieler-2').feed.length;
    const fresh = sim.reload(id);
    expect(fresh.synced).toBe(false);
    sim.runFor(1);
    expect(fresh.synced).toBe(true);
    expect(fresh.feed.length).toBeGreaterThanOrEqual(feedBefore);
    expect(fresh.scores?.liste.find((x) => x.spieler === id)?.punkte).toBe(pointsBefore);
    expect(sim.host.rejections.filter((r) => r.type === 'join')).toEqual([]);
    const catchesBefore = fresh.feed.filter((c) => c.spieler === id).length;
    sim.runUntil(() => sim.host.phase === 'Lobby', 400);
    expect(sim.host.results?.plaetze.find((p) => p.spieler === id)?.faenge).toBeGreaterThan(catchesBefore);
    const expected = finalScores(sim)[0];
    expect(new Set(finalScores(sim))).toEqual(new Set([expected]));
  });

  it('Verbindung kurz weg (gleicher Client, neue Verbindung): laufender Drill bleibt erhalten', () => {
    const sim = makeSim({ seed: 32 });
    startRound(sim);
    const id = 'spieler-2';
    expect(sim.runUntil(() => sim.client(id).own.rod === 'Reeling' && (sim.client(id).own.drill?.elapsedS ?? 0) > 1, 120)).toBe(true);
    const c = sim.client(id);
    c.reconnect(sim.hub.connect(id));
    sim.runFor(0.5);
    expect(c.synced).toBe(true);
    expect(c.own.rod).toBe('Reeling');
    expect(c.own.drill).not.toBeNull();
  });

  it('Host schließt den Tab → alle anderen sofort Aborted, letzter Stand bleibt sichtbar', () => {
    const sim = makeSim({ seed: 41 });
    startRound(sim);
    sim.runFor(60);
    const before = finalScores(sim)[1];
    sim.removeHost('close');
    sim.runFor(0.5);
    for (const c of sim.clients.values()) {
      expect(c.round.phase).toBe('Aborted');
      expect(c.round.abortedFrom).toBe('Fishing');
    }
    expect(finalScores(sim)[0]).toBe(before);
  });

  it('Host stürzt ab (keine Abschiedsnachricht) → Aborted nach der Wartezeit aus der Presence', () => {
    const sim = makeSim({ seed: 42 });
    startRound(sim);
    sim.runFor(30);
    sim.removeHost('crash');
    sim.runFor(CFG.client.hostLostGraceS - 1);
    for (const c of sim.clients.values()) expect(c.round.phase).not.toBe('Aborted');
    sim.runFor(1.5);
    for (const c of sim.clients.values()) expect(c.round.phase).toBe('Aborted');
  });

  it('Nachrichten überholen sich (wie bei Supabase beobachtet): Umsortier-Puffer, keine Lücken, Endstand gleich', () => {
    const sim = makeSim({ seed: 52, hub: { latencyMs: 60, jitterMs: 200, fifo: false, seed: 4 } });
    startRound(sim);
    sim.runUntil(() => sim.host.phase === 'Lobby', 420);
    sim.runFor(3);
    const hostPts = sim.host.pointsById();
    const expected = sim.host.playerIds().map((id) => `${id}:${hostPts[id]}`).join(',');
    expect(new Set(finalScores(sim))).toEqual(new Set([expected]));
    for (const c of sim.clients.values()) expect(c.stats.gapsDetected).toBe(0);
  });

  it('schlechtes Netz (80 ± 60 ms, 3 % Verlust): Lücken werden erkannt und per sync geheilt, Endstand überall gleich', () => {
    const sim = makeSim({ seed: 51, hub: { latencyMs: 80, jitterMs: 60, lossRate: 0.03, seed: 5 } });
    startRound(sim);
    sim.runUntil(() => sim.host.phase === 'Lobby', 420);
    sim.runFor(5);
    const hostPts = sim.host.pointsById();
    const expected = sim.host.playerIds().map((id) => `${id}:${hostPts[id]}`).join(',');
    expect(new Set(finalScores(sim))).toEqual(new Set([expected]));
    const resyncs = [...sim.clients.values()].reduce((s, c) => s + c.stats.resyncs, 0);
    expect(resyncs).toBeGreaterThan(0);
    console.info('schlechtes Netz: resyncs', resyncs, 'verloren', sim.hub.stats.dropped, 'Ablehnungen', sim.host.rejections.length);
  });
});
