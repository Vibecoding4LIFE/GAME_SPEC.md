// src/ui/dom.ts – kleine DOM-Helfer. Texte immer über textContent (nie innerHTML mit Daten).
import { iconSvg, type IconName } from './icons';
import { RARITY_STYLE } from './rarity';
import type { Rarity } from '../data/types';
import { t } from '../i18n';

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Pixel-Symbol als Element (festes, eigenes SVG-Markup). */
export function icon(name: IconName, px = 2, extraClass = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'px-icon-wrap';
  span.innerHTML = iconSvg(name, px, extraClass);
  return span;
}

/** Seltenheits-Chip: Farbe + Symbol + Name (B5: nie nur Farbe). */
export function rarityChip(rarity: Rarity, small = false): HTMLSpanElement {
  const st = RARITY_STYLE[rarity];
  return h('span', { class: `ui-rarity${small ? ' ui-rarity--s' : ''}`, 'data-rarity': rarity }, [
    icon(st.icon, small ? 1 : 2),
    h('span', { text: t(st.nameKey) }),
  ]);
}

/** Knopf mit Mindestgröße 44×44 (B5). */
export function button(label: string, opts: { variant?: 'brass' | 'wood' | 'danger' | 'ghost'; icon?: IconName; ariaLabel?: string; cls?: string } = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `ui-btn ui-btn--${opts.variant ?? 'brass'}${opts.cls ? ` ${opts.cls}` : ''}`, 'aria-label': opts.ariaLabel });
  if (opts.icon) b.append(icon(opts.icon, 2));
  if (label) b.append(h('span', { class: 'ui-btn__label', text: label }));
  return b;
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Zahl sanft hochzählen (bei „weniger Bewegung“ sofort). */
const animTokens = new WeakMap<HTMLElement, number>();

export function animateNumber(el: HTMLElement, from: number, to: number, fmt: (n: number) => string, ms = 450): void {
  const token = (animTokens.get(el) ?? 0) + 1;
  animTokens.set(el, token);
  if (from === to || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now: number): void => {
    if (animTokens.get(el) !== token) return; // neuere Animation hat übernommen
    const k = Math.min(1, (now - t0) / ms);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = fmt(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
