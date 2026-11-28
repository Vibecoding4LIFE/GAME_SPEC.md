// src/ui/input.ts – Tastatur und Gamepad (Gamepad-API) auf dieselben Spielaktionen wie Touch abbilden (D 1.2).
// Die Zuordnung selbst steckt testbar in inputMap.ts; hier nur das Einhängen der Browser-Ereignisse.
import { onModalChange } from './dialog';
import { InputMapper, readPad, type ActionType, type InputAction, type InputMode } from './inputMap';

export type { ActionType, InputAction, InputMode } from './inputMap';

export interface InputController {
  /** Interner Zustand; TouchControls füttert hierüber Gesten und Knöpfe ein. */
  readonly mapper: InputMapper;
  /** Aktuelle Phase der Szene (auch während ein Menü offen ist). */
  readonly mode: InputMode;
  /** Rute führen: −1 … +1 (alle Quellen zusammen). */
  readonly steer: number;
  readonly reeling: boolean;
  readonly sinking: boolean;
  /** Phase setzen: 'aim' (Wurf), 'wait' (Köder im Wasser), 'bite' (Biss!), 'fight' (Drill), 'menu' (keine Spieleingabe). */
  setMode(mode: InputMode): void;
  /** Alle Aktionen; Rückgabe = Abmelden. */
  onAction(fn: (a: InputAction) => void): () => void;
  /** Nur eine Aktionsart. */
  on(type: ActionType, fn: (a: InputAction) => void): () => void;
  /** Phase hat sich geändert (TouchControls passt damit die Knopf-Beschriftung an). */
  onMode(fn: (mode: InputMode) => void): () => void;
  dispose(): void;
}

/**
 * Holt den Tastatur-Fokus ins Spiel. Nötig in eingebetteten Vorschauen (sandboxed iframe): Ohne Fokus gehen
 * Tastendrücke an die Elternseite (Leertaste scrollt dort), und `preventDefault` auf `pointerdown` verhindert den
 * Fokuswechsel, den der Browser sonst beim Mausklick macht. Nur mit Nutzeraktivierung aufrufen (Klick/Tipp/Taste).
 */
export function focusGame(): void {
  try {
    window.focus();
  } catch {
    /* fremder Kontext: egal */
  }
  const stage = document.getElementById('stage');
  if (stage) {
    if (!stage.hasAttribute('tabindex')) stage.tabIndex = -1;
    const active = document.activeElement;
    // Knöpfe/Felder der Overlays behalten ihren Fokus (Tastaturbedienung der Menüs)
    if (!active || active === document.body || active === stage) stage.focus({ preventScroll: true });
  }
}

const isFormField = (el: EventTarget | null): boolean =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

/**
 * Erzeugt den Eingabe-Controller. Solange ein Overlay (Dialog) offen ist, ruht die Spiel-Eingabe automatisch
 * (intern Phase 'menu'); danach gilt wieder die zuletzt gesetzte Phase.
 */
export function createInput(): InputController {
  const listeners = new Set<(a: InputAction) => void>();
  const modeListeners = new Set<(m: InputMode) => void>();
  const mapper = new InputMapper((a) => listeners.forEach((fn) => fn(a)));
  let sceneMode: InputMode = 'menu';
  let modal = false;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isFormField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (mapper.key(e.code, true, e.repeat)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (mapper.key(e.code, false)) e.preventDefault();
  };
  const onBlur = (): void => mapper.reset();
  // Erster Zeiger-Druck irgendwo im Spiel → Fokus ins Spiel (Capture, damit auch Overlays mit preventDefault greifen)
  const onPointerDown = (): void => focusGame();
  const onVisibility = (): void => {
    if (document.hidden) mapper.reset();
  };

  // Gamepad: nur abfragen, solange eines verbunden ist
  let raf = 0;
  const poll = (): void => {
    raf = 0;
    const pads = navigator.getGamepads?.() ?? [];
    let any = false;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      any = true;
      mapper.pad(gp.index, readPad(gp));
    }
    if (any) raf = requestAnimationFrame(poll);
  };
  const onPadConnected = (): void => {
    if (!raf) raf = requestAnimationFrame(poll);
  };
  const onPadDisconnected = (e: GamepadEvent): void => mapper.padDisconnected(e.gamepad.index);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('gamepadconnected', onPadConnected);
  window.addEventListener('gamepaddisconnected', onPadDisconnected);
  onPadConnected(); // falls schon eines verbunden ist

  const offModal = onModalChange((open) => {
    modal = open;
    mapper.setMode(open ? 'menu' : sceneMode);
  });

  return {
    mapper,
    get mode() {
      return sceneMode;
    },
    get steer() {
      return mapper.steerValue;
    },
    get reeling() {
      return mapper.isReeling;
    },
    get sinking() {
      return mapper.isSinking;
    },
    setMode(mode) {
      if (mode === sceneMode) return;
      sceneMode = mode;
      if (!modal) mapper.setMode(mode);
      modeListeners.forEach((fn) => fn(mode));
    },
    onMode(fn) {
      modeListeners.add(fn);
      return () => modeListeners.delete(fn);
    },
    onAction(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    on(type, fn) {
      const wrapped = (a: InputAction) => {
        if (a.type === type) fn(a);
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('gamepadconnected', onPadConnected);
      window.removeEventListener('gamepaddisconnected', onPadDisconnected);
      cancelAnimationFrame(raf);
      offModal();
      listeners.clear();
      modeListeners.clear();
    },
  };
}
