// src/ui/loadingScreen.ts – Ladebildschirm: kleine Seeszene aus den echten Welt-Ebenen (Himmel, Wald, Ufer, Wasser,
// ganzzahlig gezoomt), darüber der Titel als mehrlagiger Pixel-Schriftzug, auf der Wasserlinie eine wippende Pose,
// darunter der Hecht; Ladebalken auf einer Holztafel, danach „Tippe, um zu starten“ / „Klicke oder drücke eine Taste“.
// Der erste Tipp/Klick/Tastendruck holt den Fokus ins Spiel (eingebettete Vorschauen) und entsperrt Vibration und Ton.
import { t } from '../i18n';
import { h } from './dom';
import { focusGame } from './input';
import { renderPixelTitle } from './pixelTitle';
import { renderSprite } from './sprite';
import type { SpriteSource } from './types';
import './styles';

/** Waagerechte Lage der Wasserlinie (Anteil der Höhe) und Zoom der Szene (ganzzahlig). */
export function loadingLayout(width: number, height: number): { z: number; waterline: number } {
  const z = Math.max(1, Math.min(6, Math.round(height / 230)));
  const waterline = Math.round(height * (width > height ? 0.56 : 0.5));
  return { z, waterline };
}

export class LoadingScreen {
  private readonly root = h('div', { class: 'ui-loading', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-loading-title' });
  private readonly scene = h('div', { class: 'ld__scene', 'aria-hidden': 'true' });
  private readonly title = h('h1', { class: 'ld__title', id: 'ui-loading-title' });
  private readonly titleText = h('span', { class: 'ld__title-text', text: t('app.title') });
  private readonly logo = h('canvas', { class: 'ld__logo', 'aria-hidden': 'true' });
  private readonly fish = h('canvas', { class: 'ld__fish', 'aria-hidden': 'true' });
  private readonly bar = h('div', { class: 'ld__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': t('boot.loading') });
  private readonly fill = h('div', { class: 'ld__fill' });
  private readonly pct = h('p', { class: 'ld__pct', text: '0 %' });
  private readonly prompt = h('button', { type: 'button', class: 'ld__prompt', hidden: true });
  private fishSrc: SpriteSource | null = null;
  private resolveStart: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (this.prompt.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    this.start();
  };
  private readonly onResize = (): void => this.layout();

  constructor(parent: HTMLElement) {
    for (const layer of ['sky', 'far', 'mid', 'water', 'surface']) this.scene.append(h('div', { class: `ld__layer ld__layer--${layer}` }));
    this.scene.append(h('div', { class: 'ld__line' }), h('div', { class: 'ld__bobber' }), h('div', { class: 'ld__fishbox' }, [this.fish]));
    this.title.append(this.titleText, this.logo);
    this.bar.append(this.fill);
    const board = h('div', { class: 'ld__board' }, [this.bar, this.pct, this.prompt]);
    this.root.append(this.scene, h('div', { class: 'ld__head' }, [this.title]), board);
    this.prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); this.start(); });
    this.root.addEventListener('pointerdown', () => { if (!this.prompt.hidden) this.start(); });
    parent.append(this.root);
    window.addEventListener('resize', this.onResize);
    this.layout();
    // Schriftzug erst zeichnen, wenn die Pixel-Schrift da ist (bis dahin steht der Titel als Text)
    void document.fonts?.load(`700 11px 'Pixelify Sans'`, t('app.title')).then(() => this.drawLogo()).catch(() => undefined);
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
    this.fishSrc = src;
    this.drawFish();
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

  private layout(): void {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const { z, waterline } = loadingLayout(w, hgt);
    this.root.style.setProperty('--z', String(z));
    this.root.style.setProperty('--wl', `${waterline}px`);
    this.drawLogo();
    this.drawFish();
  }

  private drawLogo(): void {
    if (!document.fonts?.check(`700 11px 'Pixelify Sans'`)) return;
    const w = window.innerWidth;
    const { waterline } = loadingLayout(w, window.innerHeight);
    const ok = renderPixelTitle(this.logo, t('app.title'), {
      maxCssWidth: Math.min(w - 32, 720),
      maxCssHeight: Math.max(48, Math.round(waterline * 0.42)),
    });
    this.title.classList.toggle('has-logo', ok);
  }

  private drawFish(): void {
    const { z } = loadingLayout(window.innerWidth, window.innerHeight);
    // Fisch in Welt-Zoom (wie im Spiel), höchstens halbe Bildschirmbreite
    renderSprite(this.fish, this.fishSrc, { maxCssWidth: Math.min(window.innerWidth / 2, 96 * z), maxCssHeight: 48 * z, maxScale: 6 });
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
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  }
}
