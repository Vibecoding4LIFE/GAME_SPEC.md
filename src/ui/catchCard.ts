// src/ui/catchCard.ts – Fang-Präsentation (D 1.10 Größenklassen, D 1.11 Schillernd, D 3.2 Behalten/Eimer).
import { t } from '../i18n';
import { Dialog, type CloseReason } from './dialog';
import { button, h, icon, rarityChip } from './dom';
import { formatCoins, formatLength, formatWeight } from './format';
import { RARITY_STYLE, SIZE_TIER_STYLE } from './rarity';
import { renderSprite } from './sprite';
import type { CatchCardData, UiComponent } from './types';
import './styles';

export interface CatchCardCallbacks {
  /** „Behalten“ → Aquarium. */
  onKeep(data: CatchCardData): void;
  /** „In den Eimer“ (auch Escape / B). */
  onBucket(data: CatchCardData): void;
}

export class CatchCard implements UiComponent<CatchCardData> {
  private readonly dlg: Dialog;
  private data: CatchCardData | null = null;
  private decided = false;
  private readonly card = h('div', { class: 'cc' });
  private readonly banners = h('div', { class: 'cc__banners' });
  private readonly stage = h('div', { class: 'cc__stage' });
  private readonly canvas = h('canvas', { class: 'cc__sprite', 'aria-hidden': 'true' });
  private readonly stamps = h('div', { class: 'cc__stamps' });
  private readonly kicker = h('p', { class: 'cc__kicker' });
  private readonly name = h('p', { class: 'cc__name' });
  private readonly meta = h('div', { class: 'cc__meta' });
  private readonly stats = h('dl', { class: 'cc__stats' });
  private readonly keepBtn: HTMLButtonElement;
  private readonly bucketBtn: HTMLButtonElement;
  private readonly onResize = () => this.drawSprite();

  constructor(private readonly cb: CatchCardCallbacks) {
    this.dlg = new Dialog({
      title: t('catch.kicker'),
      className: 'catch-card',
      hideTitle: true,
      showCloseButton: false,
      onClose: (r) => this.closed(r),
    });
    this.stage.append(this.canvas, this.stamps);
    this.card.append(this.banners, this.stage, this.kicker, this.name, this.meta, this.stats);
    this.dlg.body.append(this.card);

    this.keepBtn = button(t('catch.keep'), { variant: 'wood', cls: 'cc__keep' });
    this.keepBtn.title = t('catch.keepHint');
    this.bucketBtn = button(t('catch.bucket'), { variant: 'brass', icon: 'bucket', cls: 'cc__bucket' });
    this.bucketBtn.setAttribute('data-autofocus', '');
    this.keepBtn.addEventListener('click', () => this.decide('keep'));
    this.bucketBtn.addEventListener('click', () => this.decide('bucket'));
    this.dlg.foot.append(this.keepBtn, this.bucketBtn);
  }

  get visible(): boolean {
    return this.dlg.isOpen;
  }

  mount(parent: HTMLElement): void {
    this.dlg.mount(parent);
  }

  show(data: CatchCardData): void {
    this.data = data;
    this.decided = false;
    this.render();
    this.dlg.open();
    this.drawSprite();
    window.addEventListener('resize', this.onResize);
  }

  update(patch: Partial<CatchCardData>): void {
    if (!this.data) return;
    this.data = { ...this.data, ...patch };
    this.render();
    this.drawSprite();
  }

  hide(): void {
    this.decided = true; // von außen geschlossen: keine Entscheidung melden
    this.dlg.close('api');
  }

  destroy(): void {
    this.hide();
    this.dlg.destroy();
  }

  private decide(choice: 'keep' | 'bucket'): void {
    const d = this.data;
    if (!d || this.decided) return;
    this.decided = true;
    this.dlg.close('button');
    if (choice === 'keep') this.cb.onKeep(d);
    else this.cb.onBucket(d);
  }

  private closed(_r: CloseReason): void {
    window.removeEventListener('resize', this.onResize);
    // Escape / B ohne Wahl = sicherer Standard: ab in den Eimer (dort kann man noch behalten oder verkaufen)
    if (!this.decided && this.data) {
      this.decided = true;
      this.cb.onBucket(this.data);
    }
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const fishName = t(d.fish.nameKey);
    const tierStyle = SIZE_TIER_STYLE[d.tier];
    this.dlg.setTitle(t('catch.dialogTitle', { name: fishName }));
    this.card.dataset.rarity = d.fish.rarity;
    this.card.dataset.tier = d.tier;
    this.card.dataset.frame = tierStyle.frame;
    this.card.toggleAttribute('data-shiny', d.shiny);

    // Banner: Schillernd (D 1.11) und RIESIG! (D 1.10)
    this.banners.replaceChildren();
    if (d.shiny) {
      this.banners.append(h('p', { class: 'cc__banner cc__banner--shiny' }, [icon('shiny', 2), h('span', { text: t('catch.shiny') }), icon('shiny', 2)]));
    }
    if (d.tier === 'Riesig') {
      this.banners.append(h('p', { class: 'cc__banner cc__banner--giant', text: t('size.Riesig') }));
      this.banners.append(confetti());
    }

    // Stempel: NEU!, Rekord, „klein“
    this.stamps.replaceChildren();
    if (d.isNew) this.stamps.append(h('span', { class: 'cc__stamp cc__stamp--new', text: t('catch.new') }));
    if (d.isRecord && !d.isNew) this.stamps.append(h('span', { class: 'cc__stamp cc__stamp--record', text: t('catch.record') }));
    if (d.tier === 'Winzling') this.stamps.append(h('span', { class: 'cc__tag-small', text: t('size.Winzling') }));

    this.kicker.textContent = d.shiny ? t('catch.kickerShiny') : t('catch.kicker');
    this.name.textContent = fishName;

    this.meta.replaceChildren(rarityChip(d.fish.rarity));
    if (tierStyle.frame === 'silver' || tierStyle.frame === 'gold') {
      this.meta.append(h('span', { class: `cc__tier cc__tier--${tierStyle.frame}`, text: t(tierStyle.labelKey ?? '') }));
    }

    const stat = (label: string, value: string, cls = '') =>
      h('div', { class: `cc__stat ${cls}` }, [h('dt', { text: label }), h('dd', { text: value })]);
    this.stats.replaceChildren(
      stat(t('catch.length'), formatLength(d.lengthCm)),
      stat(t('catch.weight'), formatWeight(d.weightG)),
      stat(t('catch.points'), t('catch.pointsValue', { points: formatCoins(d.points) }), 'cc__stat--points'),
    );

    this.keepBtn.disabled = !!d.keepDisabled;
    this.keepBtn.title = d.keepDisabled ? t('catch.keepDisabled') : t('catch.keepHint');
    this.keepBtn.setAttribute('aria-label', `${t('catch.keep')} – ${this.keepBtn.title}`);
    this.card.setAttribute('aria-label', `${fishName}, ${t(RARITY_STYLE[d.fish.rarity].nameKey)}`);
  }

  private drawSprite(): void {
    const d = this.data;
    if (!d || !this.dlg.isOpen) return;
    const w = Math.max(64, this.stage.clientWidth - 24);
    const hgt = Math.max(48, this.stage.clientHeight - 24);
    const scale = renderSprite(this.canvas, d.sprite, {
      maxCssWidth: w,
      maxCssHeight: hgt,
      extraZoom: SIZE_TIER_STYLE[d.tier].extraZoom,
      maxScale: 16,
    });
    this.stage.classList.toggle('cc__stage--empty', scale === 0);
  }
}

/** Ein paar Pixel-Konfetti für „RIESIG!“ (bei „weniger Bewegung“ per CSS aus). */
function confetti(): HTMLElement {
  const colors = ['#ffc83d', '#5bd16b', '#3fa9f5', '#a86bff', '#ff6b6b', '#f8eed4'];
  const box = h('div', { class: 'cc__confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 18; i++) {
    const s = h('i');
    s.style.left = `${(i * 37) % 100}%`;
    s.style.background = colors[i % colors.length] ?? '#fff';
    s.style.animationDelay = `${(i % 6) * 120}ms`;
    s.style.animationDuration = `${1100 + (i % 5) * 160}ms`;
    box.append(s);
  }
  return box;
}
