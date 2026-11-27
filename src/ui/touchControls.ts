// src/ui/touchControls.ts – Touch-Steuerung (D 1.2) als große, durchsichtige Bereiche über dem Canvas:
// Wurf-/Kurbel-Knopf (halten), linke/rechte Hälfte halten (Rute führen), Wisch hoch (Rute hochreißen),
// Wisch runter + halten (sinken), Tippen (Anschlag), Item-Knopf. Maus: linke Taste = Haupttaste.
import { t } from '../i18n';
import { h, icon } from './dom';
import type { InputController } from './input';
import { GestureTracker, type InputMode } from './inputMap';
import type { UiComponent } from './types';
import './styles';

export interface TouchControlsData {
  mode: InputMode;
  /** Item-Knopf aktiv (Item im Slot). */
  itemAvailable?: boolean;
  /** Kurze Gesten-Hinweise einblenden (z. B. beim ersten Start). */
  showHints?: boolean;
  /** Knöpfe auch bei Maus/Trackpad zeigen. */
  forceButtons?: boolean;
  /** Freie Fläche lässt Zeiger zum Phaser-Canvas durch (Knöpfe bleiben aktiv). */
  passThrough?: boolean;
}

const PRIMARY_LABEL: Record<InputMode, string> = {
  menu: 'touch.cast',
  aim: 'touch.cast',
  wait: 'touch.reelIn',
  bite: 'touch.strike',
  fight: 'touch.reel',
};

const HINT_MS = 4500;

export class TouchControls implements UiComponent<TouchControlsData> {
  private readonly root = h('div', { class: 'ui-touch', hidden: true });
  private readonly area = h('div', { class: 'touch__area', 'aria-hidden': 'true' });
  private readonly btns = h('div', { class: 'touch__btns' });
  private readonly castBtn = h('button', { type: 'button', class: 'touch__cast', tabindex: '-1' });
  private readonly castLabel = h('span', { class: 'touch__cast-label' });
  private readonly itemBtn = h('button', { type: 'button', class: 'touch__item', tabindex: '-1' });
  private readonly hints = h('div', { class: 'touch__hints', 'aria-hidden': 'true' });
  private readonly gestures: GestureTracker;
  private data: TouchControlsData = { mode: 'menu' };
  private _visible = false;
  private tickRaf = 0;
  private hintTimer = 0;
  private castPointer: number | null = null;
  private mousePointer: number | null = null;
  private readonly offMode: () => void;

  constructor(private readonly input: InputController) {
    this.gestures = new GestureTracker((g) => this.input.mapper.gesture(g));
    this.castBtn.append(icon('hook', 3), this.castLabel);
    this.itemBtn.append(icon('item', 3));
    this.itemBtn.setAttribute('aria-label', t('touch.item'));
    this.btns.append(this.itemBtn, this.castBtn);
    this.hints.append(
      h('p', { class: 'touch__hint touch__hint--left' }, [icon('arrowLeft', 2), h('span', { text: t('touch.hintSteer') }), icon('arrowRight', 2)]),
      h('p', { class: 'touch__hint touch__hint--swipe' }, [icon('arrowUp', 2), h('span', { text: t('touch.hintSwipe') }), icon('arrowDown', 2)]),
      h('p', { class: 'touch__hint touch__hint--tap', text: t('touch.hintTap') }),
    );
    this.root.append(this.area, this.hints, this.btns);
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
    this.data = { ...this.data, ...patch };
    const d = this.data;
    if (patch.mode !== undefined) this.input.setMode(d.mode); // Quelle der Wahrheit bleibt der InputController
    this.root.dataset.mode = d.mode;
    this.castLabel.textContent = t(PRIMARY_LABEL[d.mode]);
    this.castBtn.setAttribute('aria-label', t(PRIMARY_LABEL[d.mode]));
    this.castBtn.hidden = d.mode === 'menu';
    this.itemBtn.disabled = !d.itemAvailable;
    this.btns.classList.toggle('is-forced', !!d.forceButtons);
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

  private releaseAll(): void {
    this.gestures.reset();
    if (this.castPointer !== null) this.input.mapper.primary('touch-cast', 'touch', false);
    if (this.mousePointer !== null) this.input.mapper.primary('mouse', 'mouse', false);
    this.castPointer = null;
    this.mousePointer = null;
    this.castBtn.classList.remove('is-pressed');
    cancelAnimationFrame(this.tickRaf);
    this.tickRaf = 0;
  }

  private bindArea(): void {
    const a = this.area;
    a.addEventListener('contextmenu', (e) => e.preventDefault());
    a.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      a.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'mouse') {
        if (e.button !== 0 || this.mousePointer !== null) return;
        this.mousePointer = e.pointerId;
        this.input.mapper.primary('mouse', 'mouse', true);
        return;
      }
      this.root.classList.add('has-touch');
      const r = a.getBoundingClientRect();
      this.gestures.down(e.pointerId, e.clientX - r.left, e.clientY - r.top, e.timeStamp, r.width);
      this.startTick();
    });
    a.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') return;
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
      const r = a.getBoundingClientRect();
      if (cancelled) this.gestures.cancel(e.pointerId);
      else this.gestures.up(e.pointerId, e.clientX - r.left, e.clientY - r.top, e.timeStamp);
    };
    a.addEventListener('pointerup', (e) => end(e, false));
    a.addEventListener('pointercancel', (e) => end(e, true));
    a.addEventListener('lostpointercapture', (e) => end(e, true));
  }

  private bindButtons(): void {
    const b = this.castBtn;
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.castPointer !== null) return;
      if (e.pointerType !== 'mouse') this.root.classList.add('has-touch');
      b.setPointerCapture?.(e.pointerId);
      this.castPointer = e.pointerId;
      b.classList.add('is-pressed');
      this.input.mapper.primary('touch-cast', e.pointerType === 'mouse' ? 'mouse' : 'touch', true);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.castPointer) return;
      this.castPointer = null;
      b.classList.remove('is-pressed');
      this.input.mapper.primary('touch-cast', e.pointerType === 'mouse' ? 'mouse' : 'touch', false);
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);

    this.itemBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.itemBtn.disabled) this.input.mapper.item(e.pointerType === 'mouse' ? 'mouse' : 'touch');
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
