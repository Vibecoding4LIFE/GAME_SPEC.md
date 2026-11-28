// tests/unit/ui-input.test.ts – Eingabe-Zuordnung (D 1.2): Tastatur, Gamepad, Touch-Gesten → dieselben Aktionen.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  axisValue, EMPTY_PAD, GestureTracker, InputMapper, readPad,
  type Gesture, type InputAction, type PadSnapshot,
} from '../../src/ui/inputMap';

let got: InputAction[];
let m: InputMapper;
const types = () => got.map((a) => (a.type === 'steer' ? `steer:${a.value}` : a.type));

beforeEach(() => {
  got = [];
  m = new InputMapper((a) => got.push(a));
});

describe('Haupttaste je Phase', () => {
  it('aim: Leertaste halten/loslassen = castHold/castRelease', () => {
    m.setMode('aim');
    expect(m.key('Space', true)).toBe(true);
    m.key('Space', true, true); // Tastenwiederholung ignorieren
    m.key('Space', false);
    expect(types()).toEqual(['castHold', 'castRelease']);
  });

  it('bite: Drücken = strike, beim Wechsel in fight wird weitergekurbelt', () => {
    m.setMode('bite');
    m.key('Space', true);
    m.setMode('fight');
    m.key('Space', false);
    expect(types()).toEqual(['strike', 'reelStart', 'reelStop']);
  });

  it('wait/fight: halten = kurbeln; RT und Leertaste zusammen ergeben genau ein Paar', () => {
    m.setMode('fight');
    m.key('Space', true);
    m.pad(0, { ...EMPTY_PAD, rt: 1 });
    m.key('Space', false);
    expect(types()).toEqual(['reelStart']);
    m.pad(0, { ...EMPTY_PAD, rt: 0 });
    expect(types()).toEqual(['reelStart', 'reelStop']);
  });

  it('Kurbeln stoppt, wenn die Phase kein Kurbeln mehr erlaubt', () => {
    m.setMode('wait');
    m.primary('mouse', 'mouse', true);
    m.setMode('bite');
    expect(types()).toEqual(['reelStart', 'reelStop']);
  });

  it('menu: keine Spielaktionen, Taste wird nicht abgefangen; Wechsel ins Menü lässt alles los', () => {
    m.setMode('fight');
    m.key('KeyS', true);
    m.key('KeyA', true);
    m.setMode('menu');
    expect(types()).toEqual(['sinkStart', 'steer:-1', 'sinkStop', 'steer:0']);
    got = [];
    expect(m.key('Space', true)).toBe(false);
    expect(m.key('KeyS', false)).toBe(false);
    expect(got).toEqual([]);
  });

  it('kein castRelease beim Wechsel ins Menü (nichts wird ungewollt ausgeworfen)', () => {
    m.setMode('aim');
    m.key('Space', true);
    m.setMode('menu');
    expect(types()).toEqual(['castHold']);
  });
});

describe('Tastatur', () => {
  beforeEach(() => m.setMode('fight'));

  it('A/D und Pfeile führen die Rute, beide gleichzeitig = 0', () => {
    m.key('KeyA', true);
    m.key('ArrowRight', true);
    m.key('KeyA', false);
    m.key('ArrowRight', false);
    expect(types()).toEqual(['steer:-1', 'steer:0', 'steer:1', 'steer:0']);
  });

  it('W = rodUp, E = item, S halten = sinken, Esc = pause', () => {
    m.key('KeyW', true);
    m.key('KeyW', false);
    m.key('KeyE', true);
    m.key('KeyS', true);
    m.key('KeyS', false);
    m.key('Escape', true);
    expect(types()).toEqual(['rodUp', 'item', 'sinkStart', 'sinkStop', 'pause']);
  });

  it('unbekannte Tasten gehören nicht dem Spiel', () => {
    expect(m.key('KeyQ', true)).toBe(false);
    expect(got).toEqual([]);
  });
});

describe('Gamepad', () => {
  const pad = (p: Partial<PadSnapshot>): PadSnapshot => ({ ...EMPTY_PAD, ...p });

  it('readPad liest das Standard-Mapping (A=0, X=2, RT=7, Steuerkreuz 12–15)', () => {
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0 || i === 2 || i === 13, value: i === 7 ? 0.8 : 0 }));
    const s = readPad({ buttons, axes: [0.5, -0.2] });
    expect(s).toMatchObject({ a: true, x: true, down: true, rt: 0.8, lx: 0.5, ly: -0.2 });
  });

  it('Totzone und Rundung des Sticks', () => {
    expect(axisValue(0.2)).toBe(0);
    expect(axisValue(1)).toBe(1);
    expect(axisValue(-1)).toBe(-1);
    expect(axisValue(0.65)).toBe(0.5);
  });

  it('A = Haupttaste, Stick = führen/sinken, Stick hoch = rodUp nur einmal, X = item', () => {
    m.setMode('aim');
    m.pad(0, pad({ a: true }));
    m.pad(0, pad({}));
    m.setMode('fight');
    m.pad(0, pad({ lx: 1 }));
    m.pad(0, pad({ ly: 0.9 }));
    m.pad(0, pad({ ly: -0.9 }));
    m.pad(0, pad({ ly: -0.95 }));
    m.pad(0, pad({ x: true }));
    expect(types()).toEqual(['castHold', 'castRelease', 'steer:1', 'steer:0', 'sinkStart', 'sinkStop', 'rodUp', 'item']);
  });

  it('RT mit Hysterese (kein Flattern um 0,5)', () => {
    m.setMode('wait');
    m.pad(0, pad({ rt: 0.6 }));
    m.pad(0, pad({ rt: 0.5 }));
    m.pad(0, pad({ rt: 0.4 }));
    expect(types()).toEqual(['reelStart', 'reelStop']);
  });

  it('A, das im Menü gedrückt wurde, löst danach nichts aus', () => {
    m.setMode('menu');
    m.pad(0, pad({ a: true }));
    m.setMode('aim');
    m.pad(0, pad({ a: true }));
    expect(got).toEqual([]);
  });

  it('getrenntes Gamepad lässt alles los', () => {
    m.setMode('fight');
    m.pad(1, pad({ rt: 1, lx: -1 }));
    m.padDisconnected(1);
    expect(types()).toEqual(['reelStart', 'steer:-1', 'reelStop', 'steer:0']);
  });
});

describe('Touch-Gesten', () => {
  let g: Gesture[];
  let tr: GestureTracker;
  beforeEach(() => {
    g = [];
    tr = new GestureTracker((x) => g.push(x));
  });
  const kinds = () => g.map((x) => (x.kind === 'steer' ? `steer:${x.value}` : x.kind));

  it('kurzes Tippen = press + tap', () => {
    tr.down(1, 100, 300, 0, 400);
    tr.up(1, 101, 300, 90);
    expect(kinds()).toEqual(['press', 'tap']);
  });

  it('linke Hälfte halten = steer −1, rechte = +1, beide = 0', () => {
    tr.down(1, 50, 300, 0, 400);
    tr.tick(200);
    tr.down(2, 350, 300, 210, 400);
    tr.tick(400);
    tr.up(1, 50, 300, 500);
    tr.up(2, 350, 300, 600);
    expect(kinds()).toEqual(['press', 'steer:-1', 'press', 'steer:0', 'steer:1', 'steer:0']);
  });

  it('Wisch hoch = swipeUp, Wisch runter + halten = sinken bis Loslassen', () => {
    tr.down(1, 200, 300, 0, 400);
    tr.move(1, 202, 250, 120);
    tr.up(1, 202, 250, 160);
    tr.down(2, 200, 300, 1000, 400);
    tr.move(2, 200, 360, 1100);
    tr.tick(1600);
    tr.up(2, 200, 360, 2000);
    expect(kinds()).toEqual(['press', 'swipeUp', 'press', 'sinkStart', 'sinkStop']);
  });

  it('zu langsames Ziehen ist kein Wisch, sondern Führen', () => {
    tr.down(1, 300, 300, 0, 400);
    tr.move(1, 300, 260, 600);
    expect(kinds()).toEqual(['press', 'steer:1']);
  });

  it('InputMapper: press im Biss = strike, Gesten werden zu Aktionen', () => {
    const t2 = new GestureTracker((x) => m.gesture(x));
    m.setMode('bite');
    t2.down(1, 10, 10, 0, 400);
    t2.up(1, 10, 10, 50);
    m.setMode('fight');
    t2.down(2, 10, 300, 100, 400);
    t2.move(2, 10, 250, 200);
    expect(types()).toEqual(['strike', 'rodUp']);
  });
});
