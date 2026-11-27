// src/ui/bucket.ts – Fangeimer (D 3.2): einzeln verkaufen, „Alles verkaufen“, fürs Aquarium behalten, Münzanzeige.
import { t } from '../i18n';
import { Dialog } from './dialog';
import { animateNumber, button, h, icon, rarityChip } from './dom';
import { formatCoins, formatLength, formatWeight } from './format';
import { needsSellConfirm, SIZE_TIER_STYLE } from './rarity';
import { renderSprite } from './sprite';
import type { BucketItem, UiComponent } from './types';
import './styles';

export interface BucketData {
  items: BucketItem[];
  coins: number;
  /** Platz im Eimer (optional, z. B. 10). */
  capacity?: number;
}

export interface BucketCallbacks {
  onSell(uid: string): void;
  onSellAll(): void;
  /** Optional: Knopf „Behalten“ pro Fisch (Aquarium). Fehlt er, gibt es den Knopf nicht. */
  onKeep?(uid: string): void;
  onClose?(): void;
}

const CONFIRM_MS = 3500;

export class Bucket implements UiComponent<BucketData> {
  private readonly dlg: Dialog;
  private data: BucketData = { items: [], coins: 0 };
  private readonly coinsEl = h('span', { class: 'bk__coins-value' });
  private readonly coinsBox = h('p', { class: 'bk__coins' });
  private readonly summary = h('p', { class: 'bk__summary' });
  private readonly list = h('ul', { class: 'bk__list' });
  private readonly empty = h('div', { class: 'bk__empty' });
  private readonly sellAllBtn: HTMLButtonElement;
  private confirmTimer = 0;
  private confirming = false;
  private shownCoins = 0;

  constructor(private readonly cb: BucketCallbacks) {
    this.dlg = new Dialog({
      title: t('bucket.title'),
      className: 'bucket',
      closeOnBackdrop: true,
      onClose: () => {
        this.resetConfirm();
        this.cb.onClose?.();
      },
    });
    this.coinsBox.append(icon('coin', 2), this.coinsEl);
    this.coinsBox.setAttribute('aria-live', 'polite');
    const top = h('div', { class: 'bk__top' }, [this.summary, this.coinsBox]);
    this.empty.append(icon('bucket', 4), h('p', { class: 'bk__empty-title', text: t('bucket.empty') }), h('p', { text: t('bucket.emptyHint') }));
    this.dlg.body.append(top, this.list, this.empty);

    this.sellAllBtn = button(t('bucket.sellAll'), { variant: 'brass', icon: 'coin', cls: 'bk__sellall' });
    this.sellAllBtn.addEventListener('click', () => this.sellAll());
    this.dlg.foot.append(this.sellAllBtn);
  }

  get visible(): boolean {
    return this.dlg.isOpen;
  }

  mount(parent: HTMLElement): void {
    this.dlg.mount(parent);
  }

  show(data: BucketData): void {
    this.shownCoins = data.coins;
    this.data = data;
    this.render(false);
    this.dlg.open();
  }

  /** Neue Liste und/oder Münzen (z. B. nach dem Verkaufen). Der Münzzähler zählt hoch. */
  update(patch: Partial<BucketData>): void {
    const focusedUid = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-uid]')?.dataset.uid;
    this.data = { ...this.data, ...patch };
    this.render(true, focusedUid);
  }

  hide(): void {
    this.dlg.close('api');
  }

  destroy(): void {
    this.dlg.destroy();
  }

  private sellAll(): void {
    if (!this.data.items.length) return;
    if (needsSellConfirm(this.data.items) && !this.confirming) {
      // Zweistufig: wertvolle Fische nicht aus Versehen verkaufen
      this.confirming = true;
      this.sellAllBtn.classList.add('is-confirm');
      this.setSellAllLabel();
      this.confirmTimer = window.setTimeout(() => this.resetConfirm(), CONFIRM_MS);
      return;
    }
    this.resetConfirm();
    this.cb.onSellAll();
  }

  private resetConfirm(): void {
    window.clearTimeout(this.confirmTimer);
    this.confirming = false;
    this.sellAllBtn.classList.remove('is-confirm');
    this.setSellAllLabel();
  }

  private setSellAllLabel(): void {
    const total = this.data.items.reduce((s, i) => s + i.value, 0);
    const label = this.sellAllBtn.querySelector('.ui-btn__label');
    if (label) label.textContent = this.confirming ? t('bucket.sellAllConfirm') : t('bucket.sellAllFor', { coins: formatCoins(total) });
    this.sellAllBtn.setAttribute('aria-label', this.confirming ? t('bucket.sellAllConfirm') : t('bucket.sellAllAria', { coins: formatCoins(total), count: this.data.items.length }));
  }

  private render(animate: boolean, focusUid?: string): void {
    const { items, coins, capacity } = this.data;
    if (animate) animateNumber(this.coinsEl, this.shownCoins, coins, formatCoins);
    else this.coinsEl.textContent = formatCoins(coins);
    this.shownCoins = coins;
    this.coinsBox.setAttribute('aria-label', t('hud.coins', { count: coins }));

    this.summary.textContent =
      capacity !== undefined ? t('bucket.capacity', { count: items.length, max: capacity }) : t('bucket.count', { count: items.length });
    this.summary.classList.toggle('is-full', capacity !== undefined && items.length >= capacity);

    this.list.replaceChildren(...items.map((it) => this.row(it)));
    this.list.hidden = items.length === 0;
    this.empty.hidden = items.length > 0;
    this.sellAllBtn.disabled = items.length === 0;
    this.resetConfirm();

    if (focusUid !== undefined) {
      // Fokus nach dem Verkauf auf die nächste Zeile setzen (sonst landet er im Nichts)
      const idx = Math.max(0, items.findIndex((i) => i.uid === focusUid));
      const target =
        this.list.querySelector<HTMLElement>(`[data-uid="${CSS.escape(focusUid)}"] .bk__sell`) ??
        this.list.querySelectorAll<HTMLElement>('.bk__sell')[Math.min(idx, items.length - 1)] ??
        this.dlg.panel.querySelector<HTMLElement>('.ui-dialog__close');
      target?.focus({ preventScroll: true });
    }
  }

  private row(it: BucketItem): HTMLLIElement {
    const name = t(it.fish.nameKey);
    const canvas = h('canvas', { class: 'bk__sprite', 'aria-hidden': 'true' });
    renderSprite(canvas, it.sprite ?? null, { maxCssWidth: 72, maxCssHeight: 36, maxScale: 6 });
    const tierKey = SIZE_TIER_STYLE[it.tier].labelKey;
    const tags = h('span', { class: 'bk__tags' }, [rarityChip(it.fish.rarity, true)]);
    if (tierKey) tags.append(h('span', { class: `bk__tier bk__tier--${it.tier}`, text: t(tierKey) }));
    if (it.shiny) tags.append(h('span', { class: 'bk__shiny' }, [icon('shiny', 1), h('span', { text: t('catch.shiny') })]));

    const sell = button(formatCoins(it.value), { variant: 'brass', icon: 'coin', cls: 'bk__sell', ariaLabel: t('bucket.sellAria', { name, coins: formatCoins(it.value) }) });
    sell.addEventListener('click', () => this.cb.onSell(it.uid));
    const actions = h('div', { class: 'bk__actions' });
    if (this.cb.onKeep) {
      const keep = button(t('bucket.keep'), { variant: 'wood', cls: 'bk__keep', ariaLabel: t('bucket.keepAria', { name }) });
      keep.addEventListener('click', () => this.cb.onKeep?.(it.uid));
      actions.append(keep);
    }
    actions.append(sell);

    return h('li', { class: 'bk__row', 'data-uid': it.uid, 'data-rarity': it.fish.rarity }, [
      h('div', { class: 'bk__thumb' }, [canvas]),
      h('div', { class: 'bk__info' }, [
        h('span', { class: 'bk__name', text: name }),
        h('span', { class: 'bk__size', text: `${formatLength(it.lengthCm)} · ${formatWeight(it.weightG)}` }),
        tags,
      ]),
      actions,
    ]);
  }
}
