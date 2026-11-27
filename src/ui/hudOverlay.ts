// src/ui/hudOverlay.ts – HTML-Teil des HUD: Knopfleiste oben (Lexikon, Eimer, Einstellungen, Vollbild) und Münzen.
// Wurfkraft, Spannung, Tiefe usw. zeichnet die Szene pixelgenau in Phaser (B5).
import { t } from '../i18n';
import { animateNumber, h, icon } from './dom';
import { formatCoins } from './format';
import { canFullscreen, isFullscreen, toggleFullscreen } from './fullscreen';
import type { UiComponent } from './types';
import './styles';

export interface HudData {
  coins: number;
  /** Fische im Eimer (Abzeichen am Eimer-Knopf). */
  bucketCount: number;
  /** Eimer voll → Abzeichen rot. */
  bucketFull?: boolean;
}

export interface HudCallbacks {
  onLexicon(): void;
  onBucket(): void;
  onSettings(): void;
}

export class HudOverlay implements UiComponent<HudData> {
  private readonly root = h('div', { class: 'ui-hud', hidden: true });
  private readonly coinsEl = h('span', { class: 'hud__coins-value' });
  private readonly coins = h('div', { class: 'hud__coins', role: 'status' });
  private readonly badge = h('span', { class: 'hud__badge', 'aria-hidden': 'true' });
  private readonly bucketBtn: HTMLButtonElement;
  private readonly fsBtn: HTMLButtonElement;
  private data: HudData = { coins: 0, bucketCount: 0 };
  private _visible = false;
  private readonly onFsChange = () => this.syncFullscreen();

  constructor(cb: HudCallbacks) {
    this.coins.append(icon('coin', 2), this.coinsEl);
    const mk = (name: Parameters<typeof icon>[0], labelKey: string, fn: () => void) => {
      const b = h('button', { type: 'button', class: 'ui-btn ui-btn--wood hud__btn', 'aria-label': t(labelKey), title: t(labelKey) }, [icon(name, 2)]);
      b.addEventListener('click', fn);
      return b;
    };
    const lex = mk('book', 'hud.lexicon', () => cb.onLexicon());
    this.bucketBtn = mk('bucket', 'hud.bucket', () => cb.onBucket());
    this.bucketBtn.append(this.badge);
    const settings = mk('gear', 'hud.settings', () => cb.onSettings());
    this.fsBtn = mk('fullscreen', 'ui.fullscreen', () => toggleFullscreen());
    this.fsBtn.hidden = !canFullscreen();
    const bar = h('nav', { class: 'hud__bar', 'aria-label': t('hud.menu') }, [lex, this.bucketBtn, settings, this.fsBtn]);
    this.root.append(this.coins, bar);
  }

  get visible(): boolean {
    return this._visible;
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root);
    document.addEventListener('fullscreenchange', this.onFsChange);
  }

  show(data: HudData): void {
    this.data = data;
    this.coinsEl.textContent = formatCoins(data.coins);
    this.render();
    this.root.hidden = false;
    this._visible = true;
  }

  update(patch: Partial<HudData>): void {
    const before = this.data.coins;
    this.data = { ...this.data, ...patch };
    if (patch.coins !== undefined) animateNumber(this.coinsEl, before, this.data.coins, formatCoins);
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    this._visible = false;
  }

  destroy(): void {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    this.root.remove();
  }

  private render(): void {
    const { coins, bucketCount, bucketFull } = this.data;
    this.coins.setAttribute('aria-label', t('hud.coins', { count: coins }));
    this.badge.textContent = String(bucketCount);
    this.badge.hidden = bucketCount <= 0;
    this.badge.classList.toggle('is-full', !!bucketFull);
    const label = bucketCount > 0 ? t('hud.bucketCount', { count: bucketCount }) : t('hud.bucket');
    this.bucketBtn.setAttribute('aria-label', label);
    this.bucketBtn.title = label;
    this.syncFullscreen();
  }

  private syncFullscreen(): void {
    const on = isFullscreen();
    this.fsBtn.replaceChildren(icon(on ? 'fullscreenExit' : 'fullscreen', 2));
    this.fsBtn.setAttribute('aria-pressed', String(on));
  }
}
