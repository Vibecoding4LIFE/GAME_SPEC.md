// Raumcode, Uhrzeit-Versatz, Nachrichten-Schemas, Netz-Konfiguration, Nachrichten-Zähler.
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/random';
import { MessageBudget, countingTransport } from '../../src/net/budget';
import { ClockSync, estimateOffset } from '../../src/net/clockOffset';
import { PROPOSED_NET_CONFIG, netConfigFrom } from '../../src/net/config';
import { MESSAGE_TYPES, Outbox, parseMessage } from '../../src/net/messages';
import {
  ROOM_CODE_ALPHABET, generateRoomCode, isRoomCode, normalizeRoomCode, parseRoomParam, roomChannel, roomLink,
} from '../../src/net/roomCode';
import { LocalHub } from '../../src/net/transport';
import { b } from './helpers/gameData';

describe('Raumcode', () => {
  it('Alphabet ohne verwechselbare Zeichen', () => {
    for (const ch of '01OIL') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });
  it('erzeugt 6-stellige gültige Codes, seedbar', () => {
    const rng = new Rng(42);
    const codes = Array.from({ length: 500 }, () => generateRoomCode(rng));
    for (const c of codes) { expect(c).toMatch(/^[A-Z2-9]{6}$/); expect(isRoomCode(c)).toBe(true); }
    expect(new Set(codes).size).toBeGreaterThan(495);
    expect(generateRoomCode(new Rng(1))).toBe(generateRoomCode(new Rng(1)));
    expect(generateRoomCode(() => 0.999999)).toBe('999999');
  });
  it('normalisiert Eingaben und lehnt Verwechselbares ab', () => {
    expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234');
    expect(normalizeRoomCode('ABC1O2')).toBeNull();
    expect(normalizeRoomCode('ABCL23')).toBeNull();
    expect(normalizeRoomCode('ABC23')).toBeNull();
  });
  it('liest ?raum=ABC234 aus Query und URL, baut Link und Kanal', () => {
    expect(parseRoomParam('?raum=abc234')).toBe('ABC234');
    expect(parseRoomParam('https://x.dev/spiel/?foo=1&raum=XYZ789#top')).toBe('XYZ789');
    expect(parseRoomParam('?raum=ABCDE0')).toBeNull();
    expect(parseRoomParam('?foo=1')).toBeNull();
    expect(roomLink('https://x.dev/spiel/?alt=1#a', 'abc234')).toBe('https://x.dev/spiel/?raum=ABC234');
    expect(() => roomLink('https://x.dev/', 'O00000')).toThrow();
    expect(roomChannel('ABC234')).toBe('raum:ABC234');
  });
});

describe('Uhrzeit-Versatz (Ping-Pong)', () => {
  it('nimmt die Probe mit der kleinsten Laufzeit', () => {
    // Host-Uhr = lokal + 5000; Laufzeiten 100 (symmetrisch), 400 (asymmetrisch), 60 (symmetrisch)
    const samples = [
      { t0: 0, t1: 5050, t2: 100 },
      { t0: 1000, t1: 6350, t2: 1400 },
      { t0: 2000, t1: 7030, t2: 2060 },
    ];
    expect(estimateOffset(samples)).toEqual({ offsetMs: 5000, rttMs: 60, samples: 3 });
    expect(estimateOffset([])).toBeNull();
    const c = new ClockSync(2);
    for (const s of samples) c.add(s.t0, s.t1, s.t2);
    expect(c.count).toBe(2);
    expect(c.hostNow(10)).toBe(5010);
    expect(c.toLocal(5010)).toBe(10);
  });
});

describe('Nachrichten', () => {
  it('Outbox nummeriert je Absender, Schemas prüfen streng', () => {
    let t = 1000;
    const o = new Outbox('a', () => t);
    const m1 = o.make('cast', { kraft: 0.5, ziel: 7 });
    t = 2000;
    const m2 = o.make('pong', { t0: 1, t1: 2 }, 'b');
    expect(m1).toEqual({ type: 'cast', from: 'a', seq: 1, ts: 1000, data: { kraft: 0.5, ziel: 7 } });
    expect(m2).toMatchObject({ seq: 2, to: 'b', ts: 2000 });
    expect(parseMessage(m1)).toEqual(m1);
    expect(parseMessage({ ...m1, data: { kraft: 1.5, ziel: 7 } })).toBeNull();
    expect(parseMessage({ ...m1, data: { kraft: 0.5, ziel: 7, art: 'F014' } })).toBeNull();
    expect(parseMessage({ ...m1, type: 'gibtsnicht' })).toBeNull();
    expect(MESSAGE_TYPES).toEqual(expect.arrayContaining([
      'pos', 'cast', 'rodState', 'shadows', 'bite', 'reel', 'reelResult', 'catch', 'scores', 'round', 'phaseEnd', 'emote',
      'sync', 'join', 'leave', 'ready', 'ping', 'pong',
    ]));
  });

  it('bite hat kein Feld für die Art (strenges Schema lehnt id/nr/name ab)', () => {
    const o = new Outbox('h', () => 0);
    const bite = o.make('bite', {
      spieler: 'a', verhalten: 'Zappler', seed: 1, schutz: { anfaenger: 2, kescher: 0 },
      schwierigkeit: { kraft: 3, ausdauer: 9, zone: 0, zweit: null, phasen: [] },
    });
    expect(parseMessage(bite)).not.toBeNull();
    for (const extra of [{ id: 'F014' }, { nr: 14 }, { name: 'Hecht' }]) {
      expect(parseMessage({ ...bite, data: { ...bite.data, ...extra } })).toBeNull();
      expect(parseMessage({ ...bite, data: { ...bite.data, schwierigkeit: { ...bite.data.schwierigkeit, ...extra } } })).toBeNull();
    }
  });
});

describe('Netz-Konfiguration', () => {
  it('Vorschlag ist gültig und wird genutzt, solange balancing.net fehlt', () => {
    expect(netConfigFrom(b)).toEqual(PROPOSED_NET_CONFIG);
    expect(() => netConfigFrom(b, { ...PROPOSED_NET_CONFIG, round: { ...PROPOSED_NET_CONFIG.round, defaultDurationS: 200 } })).toThrow();
    expect(() => netConfigFrom(b, { ...PROPOSED_NET_CONFIG, extra: 1 })).toThrow();
  });
});

describe('Nachrichten-Zähler', () => {
  it('zählt gesendet/empfangen je Runde, Runde beginnt mit phaseEnd Countdown', () => {
    const hub = new LocalHub();
    const budget = new MessageBudget(15000, () => hub.now);
    const a = countingTransport(hub.connect('a'), budget);
    const bT = hub.connect('b');
    a.onMessage(() => {});
    const oa = new Outbox('a', () => hub.now);
    const ob = new Outbox('b', () => hub.now);
    a.broadcast(oa.make('ready', { bereit: true }));
    bT.broadcast(ob.make('phaseEnd', { runde: 1, phase: 'Countdown', ende: 5000, angelEnde: 305000 }));
    hub.flush();
    a.broadcast(oa.make('emote', { id: 'petriHeil' }));
    bT.broadcast(ob.make('reel', { spannung: 0.5, fortschritt: 0.1 }));
    bT.broadcast(ob.make('phaseEnd', { runde: 1, phase: 'Lobby', ende: null, angelEnde: null }));
    hub.flush();
    expect(budget.history).toHaveLength(1);
    const r = budget.history[0];
    expect(r).toMatchObject({ round: 1, sent: 1, received: 3 });
    expect(budget.roomSends(r)).toBe(4);
    expect(budget.total).toEqual({ sent: 2, received: 3 });
    expect(budget.summary(r)).toContain('Runde 1: 4 / 15000');
  });
});
