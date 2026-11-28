// src/ui/inputMap.ts – Zuordnung Tastatur / Maus / Touch / Gamepad → Spielaktionen (D 1.2).
// Reine Logik ohne DOM: input.ts und touchControls.ts füttern nur Rohereignisse hinein.

/** Spielphase, die die Szene setzt. Davon hängt ab, was die Haupttaste (Leertaste/Klick/A/Wurf-Knopf) tut. */
export const INPUT_MODES = ['menu', 'aim', 'wait', 'bite', 'fight'] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const ACTION_TYPES = [
  'castHold', 'castRelease', 'reelStart', 'reelStop', 'strike',
  'sinkStart', 'sinkStop', 'steer', 'rodUp', 'item', 'pause', 'retrieve',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type InputSource = 'keyboard' | 'mouse' | 'touch' | 'gamepad';

export interface InputAction {
  type: ActionType;
  source: InputSource;
  /** Nur bei `steer`: −1 (links) … 0 … +1 (rechts). */
  value?: number;
}

export type ActionSink = (a: InputAction) => void;

/** In diesen Phasen bedeutet „halten“ kurbeln. */
export const isReelMode = (m: InputMode): boolean => m === 'wait' || m === 'fight';

/** Tastenbelegung (KeyboardEvent.code). Auch für die Anzeige in den Einstellungen. */
export const KEY_BINDINGS = {
  primary: ['Space'],
  sink: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  rodUp: ['KeyW', 'ArrowUp'],
  item: ['KeyE'],
  /** Schnur ohne Fisch einholen (neu auswerfen) */
  retrieve: ['KeyR', 'Backspace'],
  pause: ['Escape', 'KeyP'],
} as const;
type Binding = keyof typeof KEY_BINDINGS;

export function bindingForKey(code: string): Binding | null {
  for (const [b, codes] of Object.entries(KEY_BINDINGS) as [Binding, readonly string[]][]) {
    if (codes.includes(code)) return b;
  }
  return null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ Gamepad (Standard-Mapping)

export interface PadSnapshot {
  a: boolean;
  b: boolean;
  x: boolean;
  start: boolean;
  /** Rechter Trigger 0…1 */
  rt: number;
  /** Linker Stick −1…1 (y: −1 = oben) */
  lx: number;
  ly: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const EMPTY_PAD: PadSnapshot = {
  a: false, b: false, x: false, start: false, rt: 0, lx: 0, ly: 0, up: false, down: false, left: false, right: false,
};

interface PadLike {
  buttons: ArrayLike<{ pressed: boolean; value: number }>;
  axes: ArrayLike<number>;
}

/** Gamepad-API (mapping "standard") → Schnappschuss. */
export function readPad(gp: PadLike): PadSnapshot {
  const btn = (i: number): boolean => gp.buttons[i]?.pressed ?? false;
  const rtBtn = gp.buttons[7];
  return {
    a: btn(0),
    b: btn(1),
    x: btn(2),
    start: btn(9),
    rt: rtBtn ? Math.max(rtBtn.value, rtBtn.pressed ? 1 : 0) : 0,
    lx: gp.axes[0] ?? 0,
    ly: gp.axes[1] ?? 0,
    up: btn(12),
    down: btn(13),
    left: btn(14),
    right: btn(15),
  };
}

/** Totzone + Neuskalierung, gerundet auf 0,05 (verhindert Ereignis-Flut bei Stick-Rauschen). */
export function axisValue(v: number, deadzone = 0.3): number {
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  const scaled = clamp((a - deadzone) / (1 - deadzone), 0, 1);
  return Math.sign(v) * Math.round(scaled * 20) / 20;
}

interface PadState {
  prev: PadSnapshot;
  rtOn: boolean;
  sinkOn: boolean;
  upArmed: boolean;
}

// ------------------------------------------------------------------ Touch-Gesten

export interface GestureConfig {
  /** Mindestweg für einen Wisch (CSS-px). */
  swipePx: number;
  /** Ein Wisch muss innerhalb dieser Zeit passieren (ms). */
  swipeMs: number;
  /** Ab dieser Haltedauer ohne Wisch wird „Rute führen“ daraus (ms). */
  holdMs: number;
}

export const DEFAULT_GESTURES: GestureConfig = { swipePx: 28, swipeMs: 400, holdMs: 180 };

export type Gesture =
  | { kind: 'press' }
  | { kind: 'tap' }
  | { kind: 'swipeUp' }
  | { kind: 'sinkStart' }
  | { kind: 'sinkStop' }
  | { kind: 'steer'; value: number };

interface Pointer {
  x0: number;
  y0: number;
  t0: number;
  side: -1 | 1;
  state: 'pending' | 'steer' | 'sink' | 'done';
}

/**
 * Erkennt auf der freien Spielfläche: Antippen (press sofort, tap beim Loslassen),
 * Wisch hoch (Rute hochreißen), Wisch runter + halten (sinken), linke/rechte Hälfte halten (Rute führen).
 */
export class GestureTracker {
  private pointers = new Map<number, Pointer>();
  private steer = 0;
  private sinking = 0;

  constructor(private readonly out: (g: Gesture) => void, private readonly cfg: GestureConfig = DEFAULT_GESTURES) {}

  down(id: number, x: number, y: number, t: number, width: number): void {
    this.pointers.set(id, { x0: x, y0: y, t0: t, side: x < width / 2 ? -1 : 1, state: 'pending' });
    this.out({ kind: 'press' });
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    if (p.state === 'pending') {
      const dx = x - p.x0;
      const dy = y - p.y0;
      const isSwipe = Math.abs(dy) >= this.cfg.swipePx && Math.abs(dy) > Math.abs(dx) * 1.2 && t - p.t0 <= this.cfg.swipeMs;
      if (isSwipe) {
        if (dy < 0) {
          p.state = 'done';
          this.out({ kind: 'swipeUp' });
        } else {
          p.state = 'sink';
          this.setSinking(this.sinking + 1);
        }
        return;
      }
    }
    this.tick(t);
  }

  /** Regelmäßig aufrufen (pro Frame oder bei move), damit Halten ohne Bewegung erkannt wird. */
  tick(t: number): void {
    let changed = false;
    for (const p of this.pointers.values()) {
      if (p.state === 'pending' && t - p.t0 >= this.cfg.holdMs) {
        p.state = 'steer';
        changed = true;
      }
    }
    if (changed) this.syncSteer();
  }

  up(id: number, _x: number, _y: number, t: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    if (p.state === 'pending' && t - p.t0 < this.cfg.holdMs) this.out({ kind: 'tap' });
    this.finish(p);
  }

  cancel(id: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    this.finish(p);
  }

  /** Alles loslassen (z. B. wenn ein Menü aufgeht). */
  reset(): void {
    const all = [...this.pointers.values()];
    this.pointers.clear();
    all.forEach((p) => this.finish(p));
  }

  get activePointers(): number {
    return this.pointers.size;
  }

  private finish(p: Pointer): void {
    if (p.state === 'sink') this.setSinking(this.sinking - 1);
    if (p.state === 'steer') this.syncSteer();
  }

  private setSinking(n: number): void {
    const was = this.sinking > 0;
    this.sinking = Math.max(0, n);
    const is = this.sinking > 0;
    if (is !== was) this.out({ kind: is ? 'sinkStart' : 'sinkStop' });
  }

  private syncSteer(): void {
    let sum = 0;
    for (const p of this.pointers.values()) if (p.state === 'steer') sum += p.side;
    const v = clamp(sum, -1, 1);
    if (v !== this.steer) {
      this.steer = v;
      this.out({ kind: 'steer', value: v });
    }
  }
}

// ------------------------------------------------------------------ Zuordnung

/**
 * Hält den Zustand aller Eingabequellen und meldet daraus eindeutige Aktionen.
 * Start/Stop-Paare (reel, sink) werden über alle Quellen zusammengefasst: Wer gleichzeitig
 * Leertaste und RT hält, bekommt genau ein `reelStart` und ein `reelStop`.
 */
export class InputMapper {
  private _mode: InputMode = 'menu';
  private primaryHolders = new Set<string>();
  private holderSource = new Map<string, InputSource>();
  private primaryStart: 'cast' | 'reel' | 'strike' | null = null;
  private rtHolders = new Set<string>();
  private reeling = false;
  private sinkHolders = new Set<string>();
  private steerBy = new Map<string, number>();
  private steer = 0;
  private keysDown = new Set<string>();
  private pads = new Map<number, PadState>();

  constructor(private readonly emit: ActionSink) {}

  get mode(): InputMode {
    return this._mode;
  }

  get steerValue(): number {
    return this.steer;
  }

  get isReeling(): boolean {
    return this.reeling;
  }

  get isSinking(): boolean {
    return this.sinkHolders.size > 0;
  }

  setMode(next: InputMode): void {
    if (next === this._mode) return;
    this._mode = next;
    if (next === 'menu') {
      this.reset();
      return;
    }
    // Anschlag gehalten → Drill beginnt: direkt weiterkurbeln.
    if (next === 'fight' && this.primaryHolders.size > 0 && this.primaryStart === 'strike') this.primaryStart = 'reel';
    this.syncReel(this.lastPrimarySource());
  }

  /** Alles loslassen; meldet passende Stop-Aktionen (kein `castRelease`, damit nichts ungewollt ausgeworfen wird). */
  reset(source: InputSource = 'keyboard'): void {
    this.primaryHolders.clear();
    this.primaryStart = null;
    this.rtHolders.clear();
    this.syncReel(source);
    if (this.sinkHolders.size > 0) {
      this.sinkHolders.clear();
      this.emit({ type: 'sinkStop', source });
    }
    this.steerBy.clear();
    this.syncSteer(source);
    this.keysDown.clear();
    for (const s of this.pads.values()) {
      s.rtOn = false;
      s.sinkOn = false;
    }
  }

  // ---- Haupttaste (Leertaste, linke Maustaste, Wurf-/Kurbel-Knopf, A)

  primary(holder: string, source: InputSource, down: boolean): void {
    if (down) {
      if (this.primaryHolders.has(holder)) return;
      const first = this.primaryHolders.size === 0;
      this.primaryHolders.add(holder);
      this.holderSource.set(holder, source);
      if (!first || this._mode === 'menu') return;
      switch (this._mode) {
        case 'aim':
          this.primaryStart = 'cast';
          this.emit({ type: 'castHold', source });
          break;
        case 'bite':
          this.primaryStart = 'strike';
          this.emit({ type: 'strike', source });
          break;
        default:
          this.primaryStart = 'reel';
          this.syncReel(source);
      }
    } else {
      if (!this.primaryHolders.delete(holder)) return;
      if (this.primaryHolders.size > 0) return;
      if (this.primaryStart === 'cast') this.emit({ type: 'castRelease', source });
      this.primaryStart = null;
      this.syncReel(source);
    }
  }

  // ---- Einzelne Aktionen

  /** RT (Kurbeln, nur in wait/fight). */
  reelTrigger(holder: string, source: InputSource, down: boolean): void {
    if (down) this.rtHolders.add(holder);
    else this.rtHolders.delete(holder);
    this.syncReel(source);
  }

  sink(holder: string, source: InputSource, down: boolean): void {
    if (this._mode === 'menu' && down) return;
    const was = this.sinkHolders.size > 0;
    if (down) this.sinkHolders.add(holder);
    else this.sinkHolders.delete(holder);
    const is = this.sinkHolders.size > 0;
    if (is !== was) this.emit({ type: is ? 'sinkStart' : 'sinkStop', source });
  }

  setSteer(holder: string, source: InputSource, value: number): void {
    if (this._mode === 'menu' && value !== 0) return;
    if (value === 0) this.steerBy.delete(holder);
    else this.steerBy.set(holder, clamp(value, -1, 1));
    this.syncSteer(source);
  }

  rodUp(source: InputSource): void {
    if (this._mode !== 'menu') this.emit({ type: 'rodUp', source });
  }

  item(source: InputSource): void {
    if (this._mode !== 'menu') this.emit({ type: 'item', source });
  }

  /** Schnur einholen (nur im Wasser sinnvoll; die Spiellogik entscheidet). */
  retrieve(source: InputSource): void {
    if (this._mode === 'wait' || this._mode === 'bite') this.emit({ type: 'retrieve', source });
  }

  pause(source: InputSource): void {
    if (this._mode !== 'menu') this.emit({ type: 'pause', source });
  }

  // ---- Tastatur

  /** KeyboardEvent → Aktion. Rückgabe: true = Taste gehört dem Spiel (preventDefault). */
  key(code: string, down: boolean, repeat = false): boolean {
    const b = bindingForKey(code);
    if (!b) return false;
    if (down && this._mode === 'menu') return false;
    if (down && repeat) return true;
    if (down) this.keysDown.add(code);
    else if (!this.keysDown.delete(code)) return false; // Loslassen ohne Drücken (z. B. aus Menü heraus)
    switch (b) {
      case 'primary':
        this.primary(`key:${code}`, 'keyboard', down);
        break;
      case 'sink':
        this.sink(`key:${code}`, 'keyboard', down);
        break;
      case 'left':
      case 'right': {
        const l = KEY_BINDINGS.left.some((c) => this.keysDown.has(c)) ? 1 : 0;
        const r = KEY_BINDINGS.right.some((c) => this.keysDown.has(c)) ? 1 : 0;
        this.setSteer('keyboard', 'keyboard', r - l);
        break;
      }
      case 'rodUp':
        if (down) this.rodUp('keyboard');
        break;
      case 'item':
        if (down) this.item('keyboard');
        break;
      case 'retrieve':
        if (down) this.retrieve('keyboard');
        break;
      case 'pause':
        if (down) this.pause('keyboard');
        break;
    }
    return true;
  }

  // ---- Touch-Gesten (freie Fläche)

  gesture(g: Gesture): void {
    switch (g.kind) {
      case 'press':
        if (this._mode === 'bite') this.emit({ type: 'strike', source: 'touch' });
        break;
      case 'swipeUp':
        this.rodUp('touch');
        break;
      case 'sinkStart':
        this.sink('touch-swipe', 'touch', true);
        break;
      case 'sinkStop':
        this.sink('touch-swipe', 'touch', false);
        break;
      case 'steer':
        this.setSteer('touch', 'touch', g.value);
        break;
      case 'tap':
        break;
    }
  }

  // ---- Gamepad

  pad(index: number, s: PadSnapshot): void {
    let st = this.pads.get(index);
    if (!st) {
      st = { prev: EMPTY_PAD, rtOn: false, sinkOn: false, upArmed: true };
      this.pads.set(index, st);
    }
    const p = st.prev;
    st.prev = s;
    const id = `pad${index}`;
    const src: InputSource = 'gamepad';
    if (this._mode === 'menu') return;

    if (s.a !== p.a) this.primary(`${id}:a`, src, s.a);

    const rtOn = st.rtOn ? s.rt > 0.45 : s.rt > 0.55;
    if (rtOn !== st.rtOn) {
      st.rtOn = rtOn;
      this.reelTrigger(`${id}:rt`, src, rtOn);
    }

    const dpadX = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    this.setSteer(id, src, dpadX !== 0 ? dpadX : axisValue(s.lx));

    const sinkOn = s.down || (st.sinkOn ? s.ly > 0.4 : s.ly > 0.6);
    if (sinkOn !== st.sinkOn) {
      st.sinkOn = sinkOn;
      this.sink(`${id}:down`, src, sinkOn);
    }

    const upNow = s.up || s.ly < -0.6;
    if (upNow && st.upArmed) {
      st.upArmed = false;
      this.rodUp(src);
    } else if (!s.up && s.ly > -0.4) st.upArmed = true;

    if (s.x && !p.x) this.item(src);
    if (s.start && !p.start) this.pause(src);
  }

  /** Gamepad getrennt → alles von ihm loslassen. */
  padDisconnected(index: number): void {
    const id = `pad${index}`;
    this.primary(`${id}:a`, 'gamepad', false);
    this.reelTrigger(`${id}:rt`, 'gamepad', false);
    this.sink(`${id}:down`, 'gamepad', false);
    this.setSteer(id, 'gamepad', 0);
    this.pads.delete(index);
  }

  // ---- intern

  private lastPrimarySource(): InputSource {
    const last = [...this.primaryHolders].pop();
    return (last !== undefined ? this.holderSource.get(last) : undefined) ?? 'keyboard';
  }

  private syncReel(source: InputSource): void {
    const want = isReelMode(this._mode) && ((this.primaryHolders.size > 0 && this.primaryStart === 'reel') || this.rtHolders.size > 0);
    if (want !== this.reeling) {
      this.reeling = want;
      this.emit({ type: want ? 'reelStart' : 'reelStop', source });
    }
  }

  private syncSteer(source: InputSource): void {
    let sum = 0;
    for (const v of this.steerBy.values()) sum += v;
    const v = round2(clamp(sum, -1, 1));
    if (v !== this.steer) {
      this.steer = v;
      this.emit({ type: 'steer', source, value: v });
    }
  }
}
