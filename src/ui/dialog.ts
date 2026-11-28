// src/ui/dialog.ts – modale Overlays: role="dialog", Fokusfalle, Escape schließt, Fokus kehrt zurück,
// Pfeiltasten/Steuerkreuz bewegen den Fokus räumlich, A = auswählen, B = zurück (B5).
import { t } from '../i18n';
import { h, icon } from './dom';
import { readPad } from './inputMap';
import { KEY_TO_DIR, pickNeighbor, type NavDir } from './spatialNav';

export type CloseReason = 'escape' | 'button' | 'backdrop' | 'gamepad' | 'api';

export interface DialogOptions {
  /** Überschrift (bereits übersetzt). */
  title: string;
  /** Zusatzklasse am Panel, z. B. "catch-card". */
  className?: string;
  frame?: 'wood' | 'parchment';
  /** Escape / Schließen-Knopf / B erlaubt (Standard: ja). */
  closable?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  /** Überschrift nur für Screenreader (sichtbar ist dann z. B. ein eigener Kopf). */
  hideTitle?: boolean;
  /** Wird bei jedem Schließen gerufen (auch per API). */
  onClose?: (reason: CloseReason) => void;
  /** Escape/B ruft statt Schließen diese Funktion (z. B. Lexikon-Detail → zurück zum Raster). */
  onBack?: () => boolean;
  /** z-Ebene: Debug-Menü liegt über allem. */
  layer?: 'dialog' | 'debug';
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: Dialog[] = [];
const modalListeners = new Set<(open: boolean) => void>();
let idCounter = 0;

export const isModalOpen = (): boolean => stack.length > 0;
export const topDialog = (): Dialog | undefined => stack[stack.length - 1];

/** Meldet, wenn das erste Overlay aufgeht bzw. das letzte schließt (Spiel-Eingabe pausieren). */
export function onModalChange(fn: (open: boolean) => void): () => void {
  modalListeners.add(fn);
  return () => modalListeners.delete(fn);
}

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0);
}

/** Fokus setzen und ihn auch bei Gamepad-/Programm-Fokus sichtbar machen. */
export function focusVisible(el: HTMLElement): void {
  el.focus({ preventScroll: false, focusVisible: true } as FocusOptions);
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

export class Dialog {
  readonly root: HTMLDivElement;
  readonly panel: HTMLElement;
  readonly head: HTMLElement;
  readonly titleEl: HTMLHeadingElement;
  readonly body: HTMLDivElement;
  readonly foot: HTMLElement;
  private returnFocus: HTMLElement | null = null;
  private _open = false;

  constructor(private readonly opts: DialogOptions) {
    const id = `ui-dlg-${++idCounter}`;
    this.titleEl = h('h2', { id: `${id}-title`, class: `ui-dialog__title${opts.hideTitle ? ' ui-sr' : ''}`, text: opts.title });
    this.head = h('header', { class: 'ui-dialog__head' }, [this.titleEl]);
    if (opts.showCloseButton !== false && opts.closable !== false) {
      const close = h('button', { type: 'button', class: 'ui-btn ui-btn--ghost ui-dialog__close', 'aria-label': t('ui.close') }, [icon('close', 2)]);
      close.addEventListener('click', () => this.close('button'));
      this.head.append(close);
    }
    this.body = h('div', { class: 'ui-dialog__body' });
    this.foot = h('footer', { class: 'ui-dialog__foot' });
    this.panel = h(
      'section',
      {
        class: `ui-dialog frame-${opts.frame ?? 'wood'}${opts.className ? ` ${opts.className}` : ''}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': this.titleEl.id,
      },
      [this.head, this.body, this.foot],
    );
    this.root = h('div', { class: `ui-backdrop${opts.layer === 'debug' ? ' ui-backdrop--debug' : ''}`, hidden: true }, [this.panel]);
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root && opts.closeOnBackdrop && opts.closable !== false) this.close('backdrop');
    });
  }

  get isOpen(): boolean {
    return this._open;
  }

  mount(parent: HTMLElement): void {
    if (this.root.parentElement !== parent) parent.append(this.root);
  }

  setTitle(text: string): void {
    this.titleEl.textContent = text;
  }

  open(): void {
    if (this._open) {
      this.focusInitial();
      return;
    }
    this._open = true;
    const active = document.activeElement;
    this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    this.root.hidden = false;
    this.root.classList.remove('is-closing');
    stack.push(this);
    if (stack.length === 1) {
      installGlobalHandlers();
      modalListeners.forEach((fn) => fn(true));
    }
    // erst nach dem Layout fokussieren, sonst springt Safari
    requestAnimationFrame(() => this.focusInitial());
  }

  close(reason: CloseReason = 'api'): void {
    if (!this._open) return;
    this._open = false;
    const i = stack.indexOf(this);
    if (i >= 0) stack.splice(i, 1);
    this.root.hidden = true;
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
    if (stack.length === 0) {
      removeGlobalHandlers();
      modalListeners.forEach((fn) => fn(false));
    }
    this.opts.onClose?.(reason);
  }

  /** Escape / B: erst „zurück“ versuchen, dann schließen. */
  back(reason: CloseReason): void {
    if (this.opts.onBack?.()) return;
    if (this.opts.closable !== false) this.close(reason);
  }

  destroy(): void {
    this.close('api');
    this.root.remove();
  }

  focusInitial(): void {
    if (!this._open) return;
    const auto = this.panel.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
    const target = auto && !auto.closest('[hidden]') ? auto : visibleFocusables(this.body)[0] ?? visibleFocusables(this.panel)[0];
    if (target) target.focus({ preventScroll: true });
    else {
      this.panel.tabIndex = -1;
      this.panel.focus({ preventScroll: true });
    }
  }

  /** Fokus räumlich bewegen; true, wenn sich etwas bewegt hat. */
  move(dir: NavDir): boolean {
    const items = visibleFocusables(this.panel);
    if (!items.length) return false;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.panel.contains(active)) {
      const first = items[0];
      if (first) focusVisible(first);
      return true;
    }
    const others = items.filter((el) => el !== active);
    const rect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const idx = pickNeighbor(rect(active), others.map(rect), dir);
    const next = idx >= 0 ? others[idx] : undefined;
    if (next) {
      focusVisible(next);
      return true;
    }
    return false;
  }

  trapTab(backwards: boolean): void {
    const items = visibleFocusables(this.panel);
    if (!items.length) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? items.indexOf(active) : -1;
    const next = backwards ? items[(i <= 0 ? items.length : i) - 1] : items[(i + 1) % items.length];
    next?.focus();
  }
}

// ------------------------------------------------------------------ globale Tasten + Gamepad im Menü

const isTextField = (el: Element | null): boolean =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range'].includes(el.type)));

function onKeyDown(e: KeyboardEvent): void {
  const top = topDialog();
  if (!top) return;
  const active = document.activeElement;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.back('escape');
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    top.trapTab(e.shiftKey);
    return;
  }
  const dir = KEY_TO_DIR[e.key];
  if (dir) {
    // Auswahllisten und Textfelder behalten ihre eigenen Pfeiltasten
    if (active instanceof HTMLSelectElement && (dir === 'up' || dir === 'down')) return;
    if (isTextField(active)) return;
    if (top.move(dir)) e.preventDefault();
  }
  document.documentElement.classList.remove('ui-nav-pointer');
}

function onPointerDown(): void {
  document.documentElement.classList.add('ui-nav-pointer');
}

let padRaf = 0;
const padPrev = new Map<number, { dir: NavDir | null; a: boolean; b: boolean; next: number }>();

function padLoop(now: number): void {
  padRaf = requestAnimationFrame(padLoop);
  const top = topDialog();
  if (!top || typeof navigator.getGamepads !== 'function') return;
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const s = readPad(gp);
    const prev = padPrev.get(gp.index) ?? { dir: null, a: true, b: true, next: 0 }; // erst nach Loslassen reagieren
    const dir: NavDir | null =
      s.up || s.ly < -0.6 ? 'up' : s.down || s.ly > 0.6 ? 'down' : s.left || s.lx < -0.6 ? 'left' : s.right || s.lx > 0.6 ? 'right' : null;
    if (dir && (dir !== prev.dir || now >= prev.next)) {
      document.documentElement.classList.add('ui-nav-gamepad');
      const active = document.activeElement;
      if (active instanceof HTMLSelectElement && (dir === 'left' || dir === 'right')) {
        const n = active.options.length;
        active.selectedIndex = (active.selectedIndex + (dir === 'right' ? 1 : -1) + n) % n;
        active.dispatchEvent(new Event('change', { bubbles: true }));
      } else top.move(dir);
      prev.next = now + (dir !== prev.dir ? 380 : 120);
    }
    prev.dir = dir;
    if (s.a && !prev.a) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && top.panel.contains(active)) active.click();
    }
    if (s.b && !prev.b) top.back('gamepad');
    prev.a = s.a;
    prev.b = s.b;
    padPrev.set(gp.index, prev);
  }
}

function installGlobalHandlers(): void {
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  padPrev.clear();
  if (typeof requestAnimationFrame === 'function') padRaf = requestAnimationFrame(padLoop);
}

function removeGlobalHandlers(): void {
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('pointerdown', onPointerDown, true);
  cancelAnimationFrame(padRaf);
}
