// src/ui/debugMenu.ts – Debug-Menü für die Phase-1-Abnahme (Teil H).
// Öffnen: F1 oder ^/` (Backquote), 3-Finger-Tipp, oder dreimal schnell in die linke obere Ecke tippen.
import { t } from '../i18n';
import { FIGHT_BEHAVIORS, type FightBehavior, type FishData, type FishId, type TimeOfDay, type Weather } from '../data/types';
import { Dialog } from './dialog';
import { button, h } from './dom';
import { formatLexNr } from './format';
import type { UiComponent } from './types';
import './styles';

export type DebugTime = Exclude<TimeOfDay, 'Immer'>;

export interface DebugMenuData {
  /** Fische der aktuellen Welt (für „Fisch erzwingen“). */
  fish: FishData[];
  /** Weltnummer für die Wetter-Anzeigenamen. */
  worldIndex: number;
  /** Wetter dieser Welt (aus worlds.json). */
  weathers: Weather[];
  /** Aktuelle Werte (null = automatisch). */
  forcedFish?: FishId | null;
  forcedBehavior?: FightBehavior | null;
  time?: DebugTime | null;
  weather?: Weather | null;
  showFps?: boolean;
  /** Einstellungen (Nutzer-Feedback): Vibration, Bildschirm wackeln */
  vibration?: boolean;
  shake?: boolean;
  /** Debug: jeder Fang schillernd */
  forceShiny?: boolean;
}

export interface DebugMenuCallbacks {
  onForceFish(id: FishId | null): void;
  onForceBehavior(b: FightBehavior | null): void;
  onSetTime(time: DebugTime | null): void;
  onSetWeather(w: Weather | null): void;
  onResetSave(): void;
  onToggleFps?(on: boolean): void;
  onToggleVibration?(on: boolean): void;
  onToggleShake?(on: boolean): void;
  onForceShiny?(on: boolean): void;
  onShowIntro?(): void;
  onOpen?(): void;
  onClose?(): void;
}

export interface DebugMenuOptions {
  /** Tastenkürzel, 3-Finger-Tipp und Ecke aktiv (Standard: ja). */
  enableShortcuts?: boolean;
}

const TIMES: DebugTime[] = ['Morgen', 'Tag', 'Abend', 'Nacht'];
const CORNER_TAPS = 3;
const CORNER_WINDOW_MS = 1200;
const RESET_CONFIRM_MS = 4000;

export class DebugMenu implements UiComponent<DebugMenuData> {
  private readonly dlg: Dialog;
  private data: DebugMenuData | null = null;
  private readonly form = h('div', { class: 'dbg' });
  private readonly fishSel = h('select', { class: 'dbg__select', id: 'dbg-fish' });
  private readonly behSel = h('select', { class: 'dbg__select', id: 'dbg-beh' });
  private readonly timeSel = h('select', { class: 'dbg__select', id: 'dbg-time' });
  private readonly weatherSel = h('select', { class: 'dbg__select', id: 'dbg-weather' });
  private readonly fpsBox = h('input', { type: 'checkbox', class: 'dbg__check', id: 'dbg-fps' });
  private readonly vibBox = h('input', { type: 'checkbox', class: 'dbg__check', id: 'dbg-vib' });
  private readonly shakeBox = h('input', { type: 'checkbox', class: 'dbg__check', id: 'dbg-shake' });
  private readonly shinyBox = h('input', { type: 'checkbox', class: 'dbg__check', id: 'dbg-shiny' });
  private readonly resetBtn: HTMLButtonElement;
  private readonly fpsEl = h('div', { class: 'ui-fps', hidden: true, 'aria-hidden': 'true' });
  private readonly hotspot = h('div', { class: 'dbg-hotspot', 'aria-hidden': 'true' });
  private resetArmed = false;
  private resetTimer = 0;
  private cornerTaps: number[] = [];
  private fpsRaf = 0;

  constructor(private readonly cb: DebugMenuCallbacks, private readonly opts: DebugMenuOptions = {}) {
    this.dlg = new Dialog({
      title: t('debug.title'),
      className: 'debug-menu',
      layer: 'debug',
      closeOnBackdrop: true,
      onClose: () => {
        this.disarmReset();
        this.cb.onClose?.();
      },
    });
    const field = (id: string, labelKey: string, control: HTMLElement) =>
      h('div', { class: 'dbg__field' }, [h('label', { for: id, text: t(labelKey) }), control]);

    this.resetBtn = button(t('debug.reset'), { variant: 'danger', cls: 'dbg__reset' });
    this.resetBtn.addEventListener('click', () => this.reset());

    this.form.append(
      field('dbg-fish', 'debug.forceFish', this.fishSel),
      field('dbg-beh', 'debug.forceBehavior', this.behSel),
      field('dbg-time', 'debug.time', this.timeSel),
      field('dbg-weather', 'debug.weather', this.weatherSel),
      h('div', { class: 'dbg__field dbg__field--check' }, [this.fpsBox, h('label', { for: 'dbg-fps', text: t('debug.fps') })]),
      h('div', { class: 'dbg__field dbg__field--check' }, [this.vibBox, h('label', { for: 'dbg-vib', text: t('debug.vibration') })]),
      h('div', { class: 'dbg__field dbg__field--check' }, [this.shakeBox, h('label', { for: 'dbg-shake', text: t('debug.shake') })]),
      h('div', { class: 'dbg__field dbg__field--check' }, [this.shinyBox, h('label', { for: 'dbg-shiny', text: t('debug.forceShiny') })]),
      h('p', { class: 'dbg__hint', text: t('debug.openHint') }),
    );
    this.dlg.body.append(this.form);
    const introBtn = button(t('debug.intro'), { variant: 'wood', cls: 'dbg__intro' });
    introBtn.addEventListener('click', () => { this.hide(); this.cb.onShowIntro?.(); });
    this.dlg.foot.append(introBtn, this.resetBtn);

    this.fishSel.addEventListener('change', () => this.cb.onForceFish((this.fishSel.value || null) as FishId | null));
    this.behSel.addEventListener('change', () => this.cb.onForceBehavior((this.behSel.value || null) as FightBehavior | null));
    this.timeSel.addEventListener('change', () => this.cb.onSetTime((this.timeSel.value || null) as DebugTime | null));
    this.weatherSel.addEventListener('change', () => this.cb.onSetWeather((this.weatherSel.value || null) as Weather | null));
    this.fpsBox.addEventListener('change', () => this.setFps(this.fpsBox.checked, true));
    this.vibBox.addEventListener('change', () => this.cb.onToggleVibration?.(this.vibBox.checked));
    this.shakeBox.addEventListener('change', () => this.cb.onToggleShake?.(this.shakeBox.checked));
    this.shinyBox.addEventListener('change', () => this.cb.onForceShiny?.(this.shinyBox.checked));
  }

  get visible(): boolean {
    return this.dlg.isOpen;
  }

  mount(parent: HTMLElement): void {
    this.dlg.mount(parent);
    parent.append(this.fpsEl);
    if (this.opts.enableShortcuts !== false) {
      parent.append(this.hotspot);
      window.addEventListener('keydown', this.onKey, true);
      window.addEventListener('touchstart', this.onTouch, { passive: true, capture: true });
      this.hotspot.addEventListener('pointerdown', this.onCorner);
    }
  }

  /** Daten setzen und öffnen. */
  show(data: DebugMenuData): void {
    this.data = data;
    this.render();
    this.dlg.open();
    this.cb.onOpen?.();
  }

  /** Daten aktualisieren, ohne zu öffnen (z. B. beim Weltwechsel). */
  update(patch: Partial<DebugMenuData>): void {
    this.data = { ...(this.data ?? { fish: [], worldIndex: 1, weathers: [] }), ...patch };
    this.render();
  }

  hide(): void {
    this.dlg.close('api');
  }

  toggle(): void {
    if (this.dlg.isOpen) this.hide();
    else if (this.data) this.show(this.data);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('touchstart', this.onTouch, true);
    this.setFps(false, false);
    this.hotspot.remove();
    this.fpsEl.remove();
    this.dlg.destroy();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'F1' || e.code === 'Backquote') {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }
  };

  private onTouch = (e: TouchEvent): void => {
    if (e.touches.length === 3 && !this.dlg.isOpen) this.toggle();
  };

  private onCorner = (e: PointerEvent): void => {
    e.stopPropagation();
    const now = performance.now();
    this.cornerTaps = [...this.cornerTaps.filter((x) => now - x < CORNER_WINDOW_MS), now];
    if (this.cornerTaps.length >= CORNER_TAPS) {
      this.cornerTaps = [];
      this.toggle();
    }
  };

  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.classList.add('is-confirm');
      this.setResetLabel(t('debug.resetConfirm'));
      this.resetTimer = window.setTimeout(() => this.disarmReset(), RESET_CONFIRM_MS);
      return;
    }
    this.disarmReset();
    this.cb.onResetSave();
    this.setResetLabel(t('debug.resetDone'));
    window.setTimeout(() => this.setResetLabel(t('debug.reset')), 1500);
  }

  private disarmReset(): void {
    window.clearTimeout(this.resetTimer);
    this.resetArmed = false;
    this.resetBtn.classList.remove('is-confirm');
    this.setResetLabel(t('debug.reset'));
  }

  private setResetLabel(text: string): void {
    const l = this.resetBtn.querySelector('.ui-btn__label');
    if (l) l.textContent = text;
  }

  private setFps(on: boolean, notify: boolean): void {
    this.fpsEl.hidden = !on;
    cancelAnimationFrame(this.fpsRaf);
    if (on) {
      this.fpsEl.textContent = t('debug.fpsValue', { fps: '–' });
      let frames = 0;
      let t0 = performance.now();
      const loop = (now: number): void => {
        frames++;
        if (now - t0 >= 500) {
          this.fpsEl.textContent = t('debug.fpsValue', { fps: Math.round((frames * 1000) / (now - t0)) });
          frames = 0;
          t0 = now;
        }
        this.fpsRaf = requestAnimationFrame(loop);
      };
      this.fpsRaf = requestAnimationFrame(loop);
    }
    if (notify) this.cb.onToggleFps?.(on);
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const opt = (value: string, label: string, selected: boolean) => h('option', { value, selected, text: label });
    const auto = t('debug.auto');

    this.fishSel.replaceChildren(
      opt('', auto, !d.forcedFish),
      ...[...d.fish].sort((a, b) => a.lexiconNumber - b.lexiconNumber).map((f) => opt(f.id, `${formatLexNr(f.lexiconNumber)} ${t(f.nameKey)}`, d.forcedFish === f.id)),
    );
    this.behSel.replaceChildren(opt('', auto, !d.forcedBehavior), ...FIGHT_BEHAVIORS.map((b) => opt(b, t(`behavior.${b}`), d.forcedBehavior === b)));
    this.timeSel.replaceChildren(opt('', auto, !d.time), ...TIMES.map((x) => opt(x, t(`time.${x}`), d.time === x)));
    this.weatherSel.replaceChildren(
      opt('', auto, !d.weather),
      ...d.weathers.filter((w) => w !== 'Alle').map((w) => opt(w, t(`weather.${d.worldIndex}.${w}`), d.weather === w)),
    );
    this.vibBox.checked = d.vibration ?? true;
    this.shakeBox.checked = d.shake ?? true;
    this.shinyBox.checked = !!d.forceShiny;
    if (d.showFps !== undefined && d.showFps !== this.fpsBox.checked) {
      this.fpsBox.checked = d.showFps;
      this.setFps(d.showFps, false);
    }
  }
}
