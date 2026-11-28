// Host-Plausibilität (B4): Absichten in falscher Phase, Abklingzeit, Reichweite, Tiefe, zu kurzer Drill, zu wenige
// reel-Nachrichten, zu früh/zu spät, Raum gesperrt/voll, Art geheim bis zum Fang.
import { describe, expect, it } from 'vitest';
import { PROPOSED_NET_CONFIG as CFG } from '../../src/net/config';
import { minDrillS } from '../../src/net/drillSpec';
import { NetHost } from '../../src/net/host';
import { Outbox, type DataOf, type MessageOf, type MessageType, type NetMessage } from '../../src/net/messages';
import { startLoadoutIds } from '../../src/net/sim';
import { LocalHub } from '../../src/net/transport';
import { b, data } from './helpers/gameData';

const SHADOWS = { max: 40, minXM: 0, maxXM: 30, speedMs: [0.15, 0.7] as [number, number], ttlS: [14, 32] as [number, number], spawnPerS: 0.5 };
const TICK = 50;

function room(seed = 11) {
  const hub = new LocalHub({ latencyMs: 20 });
  const host = new NetHost({ transport: hub.connect('h'), data, seed, now: () => hub.now, shadows: SHADOWS });
  const run = (ms: number) => { for (let t = 0; t < ms; t += TICK) { hub.advanceTo(hub.now + TICK); host.tick(); } hub.flush(); };
  const raw = (id: string) => {
    const t = hub.connect(id);
    const o = new Outbox(id, () => hub.now);
    const inbox: NetMessage[] = [];
    t.onMessage((m) => { if (m.to === undefined || m.to === id) inbox.push(m); });
    t.track({ id });
    const send = <T extends MessageType>(type: T, d: DataOf<T>) => t.broadcast(o.make(type, d));
    const join = () => send('join', {
      name: id, hut: '', boot: '', ruf: 1, welten: ['W1'], bekannt: [], abzeichen: [], pity: 0, ausruestung: startLoadoutIds(data), aktiv: null,
    });
    const mine = <T extends MessageType>(type: T) =>
      inbox.filter((m): m is MessageOf<T> => m.type === type && (!('spieler' in m.data) || (m.data as { spieler: string }).spieler === id));
    const last = <T extends MessageType>(type: T) => mine(type).at(-1);
    return { id, t, send, join, inbox, mine, last };
  };
  return { hub, host, run, raw };
}

/** Zwei Spieler, beide bereit, Countdown abgelaufen → Fishing. */
function fishingRoom(seed = 11) {
  const r = room(seed);
  const a = r.raw('a');
  const c = r.raw('c');
  a.join(); c.join();
  r.run(100);
  a.send('ready', { bereit: true }); c.send('ready', { bereit: true });
  r.run(CFG.round.countdownS * 1000 + 200);
  expect(r.host.phase).toBe('Fishing');
  return { ...r, a, c };
}

type Raw = ReturnType<ReturnType<typeof room>['raw']>;

/** Werfen, auf 2 m sinken, warten bis `bite` (oder Abbruch). */
function waitForBite(r: ReturnType<typeof fishingRoom>, p: Raw, maxMs = 90000): MessageOf<'bite'> {
  for (let tries = 0; tries < 20; tries++) {
    const before = p.mine('bite').length;
    r.run(CFG.host.castCooldownS * 1000 + 100);
    p.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(1000);
    expect(p.last('rodState')?.data.zustand).toBe('Waiting');
    p.send('lure', { tiefe: 2, zucken: false });
    for (let t = 0; t < maxMs; t += 200) {
      r.run(200);
      if (p.mine('bite').length > before) return p.last('bite') as MessageOf<'bite'>;
    }
    p.send('retrieve', {});
  }
  throw new Error('kein Biss');
}

const rejected = (host: NetHost, type: string) => host.rejections.filter((x) => x.type === type).map((x) => String(x.reason));

describe('Host: Absichten prüfen', () => {
  it('Wurf in falscher Phase (Warteraum) wird abgelehnt', () => {
    const r = room();
    const a = r.raw('a');
    a.join();
    r.run(100);
    a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    expect(rejected(r.host, 'cast')).toEqual(['phase']);
    expect(a.last('rodState')?.data).toMatchObject({ spieler: 'a', zustand: 'Idle', grund: 'phase' });
  });

  it('Zustand, Abklingzeit und Reichweite', () => {
    const r = fishingRoom();
    const { a } = r;
    a.send('cast', { kraft: 0.5, ziel: 999 });
    r.run(100);
    expect(rejected(r.host, 'cast')).toEqual(['reichweite']);
    a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Waiting', wurf: { zone: expect.any(String) } });
    a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    a.send('retrieve', {});
    r.run(100);
    expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Idle', grund: 'eingeholt' });
    a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    expect(rejected(r.host, 'cast')).toEqual(['reichweite', 'zustand', 'abklingzeit']);
    r.run(CFG.host.castCooldownS * 1000);
    a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    expect(a.last('rodState')?.data.zustand).toBe('Waiting');
  });

  it('Köder schneller sinken lassen als möglich → unplausibel (Tiefe wird begrenzt)', () => {
    const r = fishingRoom();
    r.a.send('cast', { kraft: 0.5, ziel: 4 });
    r.run(100);
    r.a.send('lure', { tiefe: 15, zucken: false });
    r.run(100);
    expect(rejected(r.host, 'lure')).toEqual(['unplausibel']);
  });

  it('Biss nennt keine Art; zu kurzer Drill wird abgelehnt, ein echter Drill zählt', () => {
    const r = fishingRoom();
    const { a } = r;
    let bite = waitForBite(r, a);
    expect(JSON.stringify(bite)).not.toMatch(/F\d{3}/);
    a.send('strike', { reaktion: 0.2 });
    r.run(100);
    expect(a.last('rodState')?.data.zustand).toBe('Reeling');
    // sofort „gefangen“ melden
    a.send('reelResult', { ergebnis: 'caught', dauer: 30, meister: true, anfaenger: 0, kescher: 0 });
    r.run(100);
    expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Escaped', grund: 'unplausibel' });
    expect(rejected(r.host, 'reelResult')[0]).toMatch(/^zuKurz/);
    expect(a.mine('catch')).toHaveLength(0);

    // echter Drill: reel alle 0,5 s bis über die Mindestdauer
    bite = waitForBite(r, a);
    a.send('strike', { reaktion: 0.2 });
    r.run(100);
    const perfect = a.last('rodState')?.data.perfekt ?? false;
    const min = minDrillS(bite.data.schwierigkeit, bite.data.verhalten, perfect, data.gear.reels[0]!, b);
    const n = Math.ceil(min / CFG.msg.reelIntervalS) + 1;
    for (let i = 0; i < n; i++) { a.send('reel', { spannung: 0.5, fortschritt: i / n }); r.run(CFG.msg.reelIntervalS * 1000); }
    a.send('reelResult', { ergebnis: 'caught', dauer: n * CFG.msg.reelIntervalS, meister: false, anfaenger: 0, kescher: 0 });
    r.run(200);
    const c = a.mine('catch');
    expect(c).toHaveLength(1);
    expect(c[0]?.data.id).toMatch(/^F\d{3}$/);
    expect(r.c.inbox.filter((m) => m.type === 'catch')).toHaveLength(1); // alle sehen den Fang
    expect(r.host.pointsById().a).toBe(c[0]?.data.punkte);
    const sc = r.c.last('scores')?.data.liste.find((x) => x.spieler === 'a');
    expect(sc?.punkte).toBe(c[0]?.data.punkte);
  });

  it('zu wenige reel-Nachrichten und erfundene Rettungen werden abgelehnt; ohne reel entkommt der Fisch', () => {
    const r = fishingRoom(12);
    const { a } = r;
    let bite = waitForBite(r, a);
    a.send('strike', { reaktion: 0.3 });
    r.run(100);
    const min = minDrillS(bite.data.schwierigkeit, bite.data.verhalten, true, data.gear.reels[0]!, b);
    for (let t = 0; t < min + 1; t += 2.5) { a.send('reel', { spannung: 0.5, fortschritt: 0.5 }); r.run(2500); }
    a.send('reelResult', { ergebnis: 'caught', dauer: min + 1, meister: false, anfaenger: 0, kescher: 0 });
    r.run(100);
    expect(rejected(r.host, 'reelResult').at(-1)).toMatch(/^reel:/);

    bite = waitForBite(r, a);
    a.send('strike', { reaktion: 0.3 });
    r.run(100);
    for (let t = 0; t < min + 2; t += 0.5) { a.send('reel', { spannung: 0.5, fortschritt: 0.5 }); r.run(500); }
    a.send('reelResult', { ergebnis: 'caught', dauer: min + 2, meister: false, anfaenger: 0, kescher: 3 });
    r.run(100);
    expect(rejected(r.host, 'reelResult').at(-1)).toBe('rettungen');

    waitForBite(r, a);
    a.send('strike', { reaktion: 0.3 });
    r.run(CFG.host.reelTimeoutS * 1000 + 500);
    expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Escaped', grund: 'zeitUeberschritten' });
  });

  it('Anschlag zu spät → Escaped; zu früh (beim Zupfer) → Waiting, Fisch verscheucht', () => {
    const r = fishingRoom(13);
    const { a } = r;
    waitForBite(r, a);
    r.run(3000);
    expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Escaped', grund: 'zuSpaet' });
    // zu früh: warten, bis ein Zupfer kommt
    let early = false;
    for (let tries = 0; tries < 30 && !early; tries++) {
      r.run(CFG.host.castCooldownS * 1000 + 100);
      a.send('cast', { kraft: 0.5, ziel: 4 });
      r.run(1000);
      a.send('lure', { tiefe: 2, zucken: false });
      const nibbles = a.inbox.length;
      for (let t = 0; t < 60000; t += 100) {
        r.run(100);
        const st = a.last('rodState')?.data;
        if (a.inbox.length > nibbles && st?.zustand === 'Nibble') {
          a.send('strike', { reaktion: null });
          r.run(100);
          expect(a.last('rodState')?.data).toMatchObject({ zustand: 'Waiting', grund: 'zuFrueh' });
          early = true;
          break;
        }
        if (a.mine('bite').length > 0 && a.last('rodState')?.data.zustand !== 'Waiting') break;
      }
      if (!early) { a.send('retrieve', {}); r.run(3000); }
    }
    expect(early).toBe(true);
  });

  it('Raum nach dem Start gesperrt; Warteraum höchstens 4 Spieler; bekannte ID darf immer wieder rein', () => {
    const r = fishingRoom();
    const z = r.raw('z');
    z.join();
    r.run(100);
    expect(z.last('deny')?.data.grund).toBe('gesperrt');
    r.a.join();
    r.run(100);
    expect(r.a.last('sync')?.to).toBe('a');

    const r2 = room();
    const ps = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => r2.raw(id));
    for (const p of ps) p.join();
    r2.run(200);
    expect(ps[4]?.last('deny')?.data.grund).toBe('voll');
    expect(ps.slice(0, 4).every((p) => p.last('sync'))).toBe(true);
  });

  it('nicht mehr bereit im Countdown → zurück in den Warteraum; Einstellungen nur dort und nur gültige', () => {
    const r = room();
    const a = r.raw('a');
    const c = r.raw('c');
    a.join(); c.join();
    r.run(100);
    expect(r.host.setSettings({ dauerS: 480 })).toBeNull();
    expect(r.host.setSettings({ dauerS: 100 })).toBe('dauer');
    expect(r.host.setSettings({ modus: 'BossDuell' })).toBe('modus');
    a.send('ready', { bereit: true }); c.send('ready', { bereit: true });
    r.run(1000);
    expect(r.host.phase).toBe('Countdown');
    expect(r.host.setSettings({ dauerS: 180 })).toBe('gesperrt');
    c.send('ready', { bereit: false });
    r.run(100);
    expect(r.host.phase).toBe('Lobby');
    expect(r.host.roundState.round).toBe(0);
    c.send('ready', { bereit: true });
    r.run(CFG.round.countdownS * 1000 + 200);
    expect(r.host.phase).toBe('Fishing');
    expect(r.host.roundState.fishingEnd! - r.host.roundState.fishingStart!).toBe(480000);
  });
});
