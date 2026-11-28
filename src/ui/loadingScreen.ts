// src/ui/loadingScreen.ts – Ladebildschirm (Nutzer-Feedback Phase 1): Spieltitel groß in Pixelify Sans, Ladebalken mit
// Prozent, danach „Tippe, um zu starten“ / „Klicke oder drücke eine Taste“. Der erste Tipp/Klick/Tastendruck holt den
// Fokus ins Spiel (nötig in eingebetteten Vorschauen) und entsperrt Vibration und Ton (Nutzeraktivierung).
import { t } from '../i18n';
import { h } from './dom';
import { focusGame } from './input';
import { renderSprite } from './sprite';
import type { SpriteSource } from './types';
import './styles';

export class LoadingScreen {
  private readonly root = h('div', { class: 'ui-loading', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-loading-title' });
  private readonly title = h('h1', { class: 'ld__title', id: 'ui-loading-title', text: t('app.title') });
  private readonly fish = h('canvas', { class: 'ld__fish', 'aria-hidden': 'true' });
  private readonly bar = h('div', { class: 'ld__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' });
  private readonly fill = h('div', { class: 'ld__fill' });
  private readonly pct = h('p', { class: 'ld__pct', text: '0 %' });
  private readonly prompt = h('button', { type: 'button', class: 'ld__prompt', hidden: true });
  private resolveStart: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (this.prompt.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    this.start();
  };

  constructor(parent: HTMLElement) {
    this.bar.append(this.fill);
    this.root.append(this.title, this.fish, this.bar, this.pct, this.prompt);
    this.prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); this.start(); });
    this.root.addEventListener('pointerdown', () => { if (!this.prompt.hidden) this.start(); });
    parent.append(this.root);
  }

  /** Fortschritt 0…1 */
  progress(p: number): void {
    const v = Math.max(0, Math.min(100, Math.round(p * 100)));
    this.fill.style.width = `${v}%`;
    this.bar.setAttribute('aria-valuenow', String(v));
    this.pct.textContent = `${v} %`;
  }

  /** Deko-Fisch (Fang-Sprite), ganzzahlig skaliert */
  setFish(src: SpriteSource | null): void {
    renderSprite(this.fish, src, { maxCssWidth: 192, maxCssHeight: 96, maxScale: 4 });
  }

  /** Fertig geladen: Aufforderung zeigen und auf den ersten Tipp/Klick/Tastendruck warten. */
  waitForStart(): Promise<void> {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.prompt.textContent = t(coarse ? 'boot.tapToStart' : 'boot.clickToStart');
    this.prompt.hidden = false;
    this.pct.hidden = true;
    this.root.classList.add('is-ready');
    window.addEventListener('keydown', this.onKey, true);
    return new Promise((res) => { this.resolveStart = res; });
  }

  get waiting(): boolean {
    return !this.prompt.hidden;
  }

  private start(): void {
    if (!this.resolveStart) return;
    focusGame();
    // Vibration/Audio brauchen eine Nutzeraktivierung: jetzt ist sie da (Ton entsperrt der audio-designer über dieses Ereignis)
    window.dispatchEvent(new CustomEvent('ctd:unlock'));
    const r = this.resolveStart;
    this.resolveStart = null;
    window.removeEventListener('keydown', this.onKey, true);
    this.destroy();
    r();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
  }
}
