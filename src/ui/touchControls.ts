// src/ui/touchControls.ts – Touch-Steuerung (D 1.2) mit sichtbaren, beschrifteten Knöpfen (Nutzer-Feedback Phase 1):
// großer Aktionsknopf unten rechts (Beschriftung je Phase: Auswerfen / Sinken / Anschlagen / Kurbeln), daneben Zucken,
// Einholen und Item; unten links ◀ ▶ (Rute führen, sofort ohne Haltezeit) und „Hochreißen“ gegen Taucher.
// Die freie Fläche bleibt zusätzlich für Gesten (Wisch hoch/runter, Hälfte halten, Tippen) und die Maus aktiv.
import { t } from '../i18n';
import { h, icon } from './dom';
import { focusGame, type InputController } from './input';
import { GestureTracker, type InputMode, type InputSource } from './inputMap';
import type { UiComponent } from './types';
import './styles';

export interface TouchControlsData {
  mode: InputMode;
  /** Item-Knopf aktiv (Item im Slot bzw. Füttern möglich). */
  itemAvailable?: boolean;
  /** Kurze Gesten-Hinweise einblenden (z. B. beim ersten Start). */
  showHints?: boolean;
  /** Knöpfe auch bei Maus/Trackpad zeigen. */
  forceButtons?: boolean;
  /** Freie Fläche lässt Zeiger zum Phaser-Canvas durch (Knöpfe bleiben aktiv). */
  passThrough?: boolean;
  /** „Hochreißen“ anbieten (Taucher zieht nach unten bzw. kündigt es an). */
  rodUp?: boolean;
}

/** Beschriftung des Aktionsknopfs je Phase; im Warten zeigt der gedrückte Knopf „Stopp“. */
const MAIN_LABEL: Record<InputMode, string> = {
  menu: 'touch.main.aim',
  aim: 'touch.main.aim',
  wait: 'touch.main.wait',
  bite: 'touch.main.bite',
  fight: 'touch.main.fight',
};

const HINT_MS = 4500;

type Holder = { pointer: number; release: () => void };

export class TouchControls implements UiComponent<TouchControlsData> {
  private readonly root = h('div', { class: 'ui-touch', hidden: true });
  private readonly area = h('div', { class: 'touch__area', 'aria-hidden': 'true' });
  private readonly btns = h('div', { class: 'touch__btns' });
  private readonly leftBtns = h('div', { class: 'touch__btns touch__btns--left' });
  private readonly castBtn = h('button', { type: 'button', class: 'touch__cast', tabindex: '-1' });
  private readonly castLabel = h('span', { class: 'touch__cast-label' });
  private readonly itemBtn = h('button', { type: 'button', class: 'touch__item touch__small', tabindex: '-1' });
  private readonly twitchBtn = h('button', { type: 'button', class: 'touch__small touch__twitch', tabindex: '-1' });
  private readonly retrieveBtn = h('button', { type: 'button', class: 'touch__small touch__retrieve', tabindex: '-1' });
  private readonly leftBtn = h('button', { type: 'button', class: 'touch__small touch__steer touch__left', tabindex: '-1' });
  private readonly rightBtn = h('button', { type: 'button', class: 'touch__small touch__steer touch__right', tabindex: '-1' });
  private readonly rodUpBtn = h('button', { type: 'button', class: 'touch__small touch__rodup', tabindex: '-1' });
  private readonly hints = h('div', { class: 'touch__hints', 'aria-hidden': 'true' });
  private readonly gestures: GestureTracker;
  private data: TouchControlsData = { mode: 'menu' };
  private _visible = false;
  private tickRaf = 0;
  private hintTimer = 0;
  private mousePointer: number | null = null;
  private areaPointers = new Set<number>();
  private holders = new Map<HTMLElement, Holder>();
  private readonly offMode: () => void;

  constructor(private readonly input: InputController) {
    this.gestures = new GestureTracker((g) => this.input.mapper.gesture(g));
    this.castBtn.append(icon('hook', 3), this.castLabel);
    const small = (b: HTMLButtonElement, ic: Parameters<typeof icon>[0] | null, key: string) => {
      if (ic) b.append(icon(ic, 2));
      b.append(h('span', { class: 'touch__small-label', text: t(key) }));
      b.setAttribute('aria-label', t(key));
    };
    small(this.itemBtn, 'item', 'touch.item');
    small(this.twitchBtn, null, 'touch.twitch');
    small(this.retrieveBtn, null, 'touch.retrieve');
    small(this.leftBtn, 'arrowLeft', 'touch.left');
    small(this.rightBtn, 'arrowRight', 'touch.right');
    small(this.rodUpBtn, 'arrowUp', 'touch.rodUp');
    this.btns.append(this.itemBtn, h('div', { class: 'touch__col' }, [this.retrieveBtn, this.twitchBtn]), this.castBtn);
    this.leftBtns.append(this.rodUpBtn, h('div', { class: 'touch__row' }, [this.leftBtn, this.rightBtn]));
    this.hints.append(
      h('p', { class: 'touch__hint touch__hint--left' }, [icon('arrowLeft', 2), h('span', { text: t('touch.hintSteer') }), icon('arrowRight', 2)]),
      h('p', { class: 'touch__hint touch__hint--swipe' }, [icon('arrowUp', 2), h('span', { text: t('touch.hintSwipe') }), icon('arrowDown', 2)]),
      h('p', { class: 'touch__hint touch__hint--tap', text: t('touch.hintTap') }),
    );
    this.root.append(this.area, this.hints, this.leftBtns, this.btns);
    this.bindArea();
    this.bindButtons();
    this.offMode = this.input.onMode((mode) => {
      if (mode !== this.data.mode) this.update({ mode });
    });
    this.data.mode = this.input.mode;
  }

  get visible(): boolean {
    return this._visible;
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(data: TouchControlsData): void {
    this._visible = true;
    this.root.hidden = false;
    this.update(data);
  }

  update(patch: Partial<TouchControlsData>): void {
    const modeChanged = patch.mode !== undefined && patch.mode !== this.data.mode;
    this.data = { ...this.data, ...patch };
    const d = this.data;
    if (patch.mode !== undefined) this.input.setMode(d.mode); // Quelle der Wahrheit bleibt der InputController
    if (modeChanged) this.releaseButtons(); // Knopf wechselt die Bedeutung → nichts hängen lassen
    this.root.dataset.mode = d.mode;
    this.syncMainLabel();
    this.castBtn.hidden = d.mode === 'menu';
    this.twitchBtn.hidden = d.mode !== 'wait';
    this.retrieveBtn.hidden = d.mode !== 'wait' && d.mode !== 'bite';
    this.leftBtn.hidden = d.mode !== 'fight';
    this.rightBtn.hidden = d.mode !== 'fight';
    this.rodUpBtn.hidden = !(d.mode === 'fight' && d.rodUp);
    this.rodUpBtn.classList.toggle('is-alert', !!d.rodUp);
    this.itemBtn.disabled = !d.itemAvailable;
    this.btns.classList.toggle('is-forced', !!d.forceButtons);
    this.leftBtns.classList.toggle('is-forced', !!d.forceButtons);
    this.root.classList.toggle('is-pass', !!d.passThrough);
    if (patch.showHints) {
      this.hints.classList.add('is-on');
      window.clearTimeout(this.hintTimer);
      this.hintTimer = window.setTimeout(() => this.hints.classList.remove('is-on'), HINT_MS);
    } else if (patch.showHints === false) this.hints.classList.remove('is-on');
  }

  hide(): void {
    this.releaseAll();
    this.root.hidden = true;
    this._visible = false;
  }

  destroy(): void {
    this.hide();
    window.clearTimeout(this.hintTimer);
    this.offMode();
    this.root.remove();
  }

  private syncMainLabel(): void {
    const held = this.holders.has(this.castBtn);
    const key = this.data.mode === 'wait' && held ? 'touch.main.waitHeld' : MAIN_LABEL[this.data.mode];
    this.castLabel.textContent = t(key);
    this.castBtn.setAttribute('aria-label', t(key));
  }

  private releaseButtons(): void {
    for (const [btn, hold] of [...this.holders]) {
      hold.release();
      btn.classList.remove('is-pressed');
    }
    this.holders.clear();
    this.syncMainLabel();
  }

  private releaseAll(): void {
    this.gestures.reset();
    this.areaPointers.clear();
    this.releaseButtons();
    if (this.mousePointer !== null) this.input.mapper.primary('mouse', 'mouse', false);
    this.mousePointer = null;
    cancelAnimationFrame(this.tickRaf);
    this.tickRaf = 0;
  }

  private bindArea(): void {
    const a = this.area;
    a.addEventListener('contextmenu', (e) => e.preventDefault());
    a.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      focusGame();
      capture(a, e.pointerId);
      if (e.pointerType === 'mouse') {
        if (e.button !== 0 || this.mousePointer !== null) return;
        this.mousePointer = e.pointerId;
        this.input.mapper.primary('mouse', 'mouse', true);
        return;
      }
      this.root.classList.add('has-touch');
      this.areaPointers.add(e.pointerId);
      const r = a.getBoundingClientRect();
      this.gestures.down(e.pointerId, e.clientX - r.left, e.clientY - r.top, e.timeStamp, r.width);
      this.startTick();
    });
    a.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || !this.areaPointers.has(e.pointerId)) return;
      const r = a.getBoundingClientRect();
      this.gestures.move(e.pointerId, e.clientX - r.left, e.clientY - r.top, e.timeStamp);
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerType === 'mouse') {
        if (e.pointerId === this.mousePointer) {
          this.mousePointer = null;
          this.input.mapper.primary('mouse', 'mouse', false);
        }
        return;
      }
      // `lostpointercapture` folgt auf `pointerup`: denselben Zeiger nur einmal beenden
      if (!this.areaPointers.delete(e.pointerId)) return;
      const r = a.getBoundingClientRect();
      if (cancelled) this.gestures.cancel(e.pointerId);
      else this.gestures.up(e.pointerId, e.clientX - r.left, e.clientY - r.top, e.timeStamp);
    };
    a.addEventListener('pointerup', (e) => end(e, false));
    a.addEventListener('pointercancel', (e) => end(e, true));
    a.addEventListener('lostpointercapture', (e) => end(e, true));
  }

  /** Halte-Knopf: `press` beim Drücken, die zurückgegebene Funktion beim Loslassen (genau einmal). */
  private holdButton(btn: HTMLButtonElement, press: (src: InputSource) => () => void): void {
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusGame();
      if (this.holders.has(btn) || btn.disabled) return;
      if (e.pointerType !== 'mouse') this.root.classList.add('has-touch');
      capture(btn, e.pointerId);
      const src: InputSource = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      this.holders.set(btn, { pointer: e.pointerId, release: press(src) });
      btn.classList.add('is-pressed');
      this.syncMainLabel();
    });
    const release = (e: PointerEvent) => {
      const hold = this.holders.get(btn);
      if (!hold || hold.pointer !== e.pointerId) return;
      this.holders.delete(btn);
      btn.classList.remove('is-pressed');
      hold.release();
      this.syncMainLabel();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  private bindButtons(): void {
    const m = this.input.mapper;
    // Aktionsknopf: im Warten = Sinken (halten, loslassen = Stopp), sonst Haupttaste (Wurf / Anschlag / Kurbeln)
    this.holdButton(this.castBtn, (src) => {
      if (this.data.mode === 'wait') {
        m.sink('touch-main', src, true);
        return () => m.sink('touch-main', src, false);
      }
      m.primary('touch-main', src, true);
      return () => m.primary('touch-main', src, false);
    });
    // Zucken = kurz kurbeln
    this.holdButton(this.twitchBtn, (src) => {
      m.primary('touch-twitch', src, true);
      return () => m.primary('touch-twitch', src, false);
    });
    this.holdButton(this.leftBtn, (src) => {
      m.setSteer('btn-left', src, -1);
      return () => m.setSteer('btn-left', src, 0);
    });
    this.holdButton(this.rightBtn, (src) => {
      m.setSteer('btn-right', src, 1);
      return () => m.setSteer('btn-right', src, 0);
    });
    this.holdButton(this.rodUpBtn, (src) => {
      m.rodUp(src);
      return () => undefined;
    });
    this.holdButton(this.retrieveBtn, (src) => {
      m.retrieve(src);
      return () => undefined;
    });
    this.holdButton(this.itemBtn, (src) => {
      m.item(src);
      return () => undefined;
    });
  }

  private startTick(): void {
    if (this.tickRaf) return;
    const loop = (now: number): void => {
      this.gestures.tick(now);
      this.tickRaf = this.gestures.activePointers > 0 ? requestAnimationFrame(loop) : 0;
    };
    this.tickRaf = requestAnimationFrame(loop);
  }
}

/** Pointer-Capture, wo möglich (synthetische oder bereits beendete Zeiger werfen sonst eine Ausnahme). */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* Zeiger nicht mehr aktiv: ohne Capture weiter */
  }
}
