// src/ui/lexicon.ts – Fischlexikon (D 1.12): Raster aller Arten einer Welt, Zustände unbekannt / gesichtet / gefangen,
// Sterne, Schillernd-Stern, Weltfortschritt-Kreis, Rahmen in Seltenheitsfarbe, Pergament-Look.
import { t } from '../i18n';
import type { FishData, FishId } from '../data/types';
import { gearKey } from '../data/gear';
import { Dialog, focusVisible } from './dialog';
import { button, h, icon, rarityChip } from './dom';
import { formatDepthRange, formatLength, formatLexNr, formatList, formatWeight } from './format';
import { RARITY_STYLE } from './rarity';
import { renderSprite, hexToRgb } from './sprite';
import { computeStars, ringMask, worldProgress } from './stars';
import type { LexiconEntryState, LexiconStateMap, SpriteResolver, UiComponent } from './types';
import './styles';

export interface LexiconData {
  /** Weltnummer 1–5 (für Wetter-Anzeigenamen `weather.<n>.<Wetter>` und den Weltnamen). */
  worldIndex: number;
  /** Arten dieser Welt (Phase 1: die 20 aus W1). Sortiert wird nach Lexikonnummer. */
  fish: FishData[];
  entries: LexiconStateMap;
  /** Fang-Sprite je Fisch (Farbe; Silhouette wird daraus erzeugt). */
  getSprite: SpriteResolver;
  /** Gleich diesen Eintrag öffnen. */
  selectId?: FishId;
}

export interface LexiconCallbacks {
  onClose?(): void;
  onSelect?(id: FishId): void;
}

const NARROW = '(max-width: 759px)';
const UNKNOWN: LexiconEntryState = { state: 'unknown', count: 0 };

export class Lexicon implements UiComponent<LexiconData> {
  private readonly dlg: Dialog;
  private data: LexiconData | null = null;
  private selected: FishId | null = null;
  private readonly root = h('div', { class: 'lx' });
  private readonly ringCanvas = h('canvas', { class: 'lx__ring', 'aria-hidden': 'true' });
  private readonly ringLabel = h('span', { class: 'lx__ring-label' });
  private readonly worldName = h('p', { class: 'lx__world' });
  private readonly progressText = h('p', { class: 'lx__progress' });
  private readonly grid = h('ul', { class: 'lx__grid', role: 'list' });
  private readonly detail = h('section', { class: 'lx__detail', 'aria-live': 'polite' });
  private readonly onResize = () => this.renderSprites();

  constructor(private readonly cb: LexiconCallbacks = {}) {
    this.dlg = new Dialog({
      title: t('lexicon.title'),
      className: 'lexicon',
      frame: 'parchment',
      closeOnBackdrop: true,
      onBack: () => this.backToGrid(),
      onClose: () => {
        window.removeEventListener('resize', this.onResize);
        this.cb.onClose?.();
      },
    });
    const ring = h('div', { class: 'lx__ringbox' }, [this.ringCanvas, this.ringLabel]);
    const top = h('div', { class: 'lx__top' }, [ring, h('div', { class: 'lx__top-text' }, [this.worldName, this.progressText])]);
    this.root.append(top, h('div', { class: 'lx__main' }, [this.grid, this.detail]));
    this.dlg.body.append(this.root);
  }

  get visible(): boolean {
    return this.dlg.isOpen;
  }

  mount(parent: HTMLElement): void {
    this.dlg.mount(parent);
  }

  show(data: LexiconData): void {
    this.data = { ...data, fish: [...data.fish].sort((a, b) => a.lexiconNumber - b.lexiconNumber) };
    const first = this.data.fish[0];
    this.selected = data.selectId ?? this.selected ?? (first ? first.id : null);
    if (this.selected && !this.data.fish.some((f) => f.id === this.selected)) this.selected = first?.id ?? null;
    this.root.classList.toggle('is-detail', !!data.selectId);
    this.render();
    this.dlg.open();
    this.renderSprites();
    window.addEventListener('resize', this.onResize);
  }

  update(patch: Partial<LexiconData>): void {
    if (!this.data) return;
    this.data = { ...this.data, ...patch };
    if (patch.fish) this.data.fish = [...patch.fish].sort((a, b) => a.lexiconNumber - b.lexiconNumber);
    if (patch.selectId) this.selected = patch.selectId;
    this.render();
    this.renderSprites();
  }

  hide(): void {
    this.dlg.close('api');
  }

  destroy(): void {
    this.dlg.destroy();
  }

  /** Eintrag öffnen (auch von außen, z. B. „Im Lexikon ansehen“ auf der Fang-Karte). */
  select(id: FishId, moveFocus = true): void {
    this.selected = id;
    this.root.classList.add('is-detail');
    this.grid.querySelectorAll<HTMLButtonElement>('.lx__cell').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)));
    this.renderDetail();
    this.renderSprites();
    this.cb.onSelect?.(id);
    if (moveFocus && matchMedia(NARROW).matches) {
      const back = this.detail.querySelector<HTMLElement>('.lx__back');
      if (back) focusVisible(back);
    }
  }

  private backToGrid(): boolean {
    if (!matchMedia(NARROW).matches || !this.root.classList.contains('is-detail')) return false;
    this.root.classList.remove('is-detail');
    const cell = this.grid.querySelector<HTMLElement>(`.lx__cell[data-id="${this.selected ?? ''}"]`);
    this.renderSprites();
    if (cell) focusVisible(cell);
    return true;
  }

  private entry(id: FishId): LexiconEntryState {
    return this.data?.entries[id] ?? UNKNOWN;
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const prog = worldProgress(d.fish, d.entries);
    this.worldName.textContent = t(`world.${d.worldIndex}.name`);
    this.progressText.textContent = t('lexicon.progressText', { caught: prog.caught, total: prog.total, seen: prog.seen });
    this.ringLabel.textContent = `${prog.caught}/${prog.total}`;
    this.ringCanvas.setAttribute('aria-label', t('lexicon.progressAria', { caught: prog.caught, total: prog.total }));
    drawRing(this.ringCanvas, prog.total, prog.caught, prog.caught === prog.total && prog.total > 0);

    this.grid.replaceChildren(...d.fish.map((f) => this.cell(f)));
    this.renderDetail();
  }

  private cell(f: FishData): HTMLLIElement {
    const e = this.entry(f.id);
    const st = RARITY_STYLE[f.rarity];
    const known = e.state === 'caught';
    const stars = computeStars(e);
    const name = known ? t(f.nameKey) : t('lexicon.unknown');
    const btn = h('button', {
      type: 'button',
      class: `lx__cell lx__cell--${e.state}`,
      'data-id': f.id,
      'data-rarity': f.rarity,
      'aria-current': String(f.id === this.selected),
      'aria-label': [
        formatLexNr(f.lexiconNumber),
        known ? name : t(e.state === 'seen' ? 'lexicon.seen' : 'lexicon.notCaught'),
        t(st.nameKey),
        known ? t('lexicon.stars', { count: stars }) : '',
        e.shiny ? t('lexicon.shinyStar') : '',
      ].filter(Boolean).join(', '),
    });
    const canvas = h('canvas', { class: 'lx__cell-sprite', 'aria-hidden': 'true' });
    btn.append(
      h('span', { class: 'lx__cell-rar', 'aria-hidden': 'true' }, [icon(st.icon, 1)]),
      h('span', { class: 'lx__cell-nr', 'aria-hidden': 'true', text: formatLexNr(f.lexiconNumber) }),
      h('span', { class: 'lx__cell-art' }, [canvas]),
      h('span', { class: 'lx__cell-name', 'aria-hidden': 'true', text: name }),
      known ? starRow(stars, !!e.shiny, 1) : h('span', { class: 'lx__cell-state', 'aria-hidden': 'true', text: e.state === 'seen' ? t('lexicon.seen') : '' }),
    );
    btn.addEventListener('click', () => this.select(f.id));
    return h('li', {}, [btn]);
  }

  private renderDetail(): void {
    const d = this.data;
    const f = d?.fish.find((x) => x.id === this.selected);
    if (!d || !f) {
      this.detail.replaceChildren(h('p', { class: 'lx__empty', text: t('lexicon.select') }));
      return;
    }
    const e = this.entry(f.id);
    const known = e.state === 'caught';
    const back = button(t('ui.back'), { variant: 'wood', icon: 'arrowLeft', cls: 'lx__back' });
    back.addEventListener('click', () => this.backToGrid());

    const head = h('div', { class: 'lx__d-head', 'data-rarity': f.rarity }, [
      h('div', { class: 'lx__d-art' }, [h('canvas', { class: 'lx__d-sprite', 'aria-hidden': 'true' })]),
      h('div', { class: 'lx__d-title' }, [
        h('p', { class: 'lx__d-nr', text: formatLexNr(f.lexiconNumber) }),
        h('h3', { class: 'lx__d-name', text: known ? t(f.nameKey) : t('lexicon.unknown') }),
        known ? h('p', { class: 'lx__d-basis', text: f.isFantasy ? t('lexicon.fantasy') : f.speciesBasis }) : null,
        rarityChip(f.rarity),
      ]),
    ]);

    const parts: (HTMLElement | null)[] = [back, head];
    if (known) {
      const stars = computeStars(e);
      parts.push(
        h('div', { class: 'lx__d-stars' }, [
          starRow(stars, !!e.shiny, 3),
          h('span', { class: 'lx__d-stars-text', text: t('lexicon.stars', { count: stars }) + (e.shiny ? ` · ${t('lexicon.shinyStar')}` : '') }),
        ]),
      );
      parts.push(this.facts(f, e, d.worldIndex));
      parts.push(h('blockquote', { class: 'lx__d-text', text: t(f.lexiconKey) }));
    } else if (e.state === 'seen') {
      parts.push(h('p', { class: 'lx__d-state', text: t('lexicon.seen') }));
      parts.push(h('blockquote', { class: 'lx__d-text lx__d-text--hint', text: t(f.hintKey) }));
    } else {
      parts.push(h('p', { class: 'lx__d-state', text: t('lexicon.notCaught') }));
      parts.push(h('p', { class: 'lx__d-text lx__d-text--muted', text: t('lexicon.unknownHint') }));
    }
    this.detail.replaceChildren(...parts.filter((p): p is HTMLElement => !!p));
    this.detail.dataset.state = e.state;
  }

  private facts(f: FishData, e: LexiconEntryState, worldIndex: number): HTMLElement {
    const zones = f.zones.includes('Alle') ? t('zone.Alle') : formatList(f.zones.map((z) => t(`zone.${z}`)), 'conjunction');
    const times = f.timeMask.includes('Immer') ? t('time.Immer') : formatList(f.timeMask.map((x) => t(`time.${x}`)), 'disjunction');
    const wName = (w: string) => t(`weather.${worldIndex}.${w}`);
    const req = f.requiredWeather.filter((w) => w !== 'Alle');
    const weatherParts: string[] = [];
    if (req.length) weatherParts.push(t('lexicon.weatherOnly', { list: formatList(req.map(wName), 'disjunction') }));
    if (f.preferredWeather.length) weatherParts.push(t('lexicon.weatherPrefers', { list: formatList(f.preferredWeather.map(wName), 'disjunction') }));
    const weather = weatherParts.length ? weatherParts.join(' · ') : t('lexicon.anyWeather');
    const baits = f.favoriteBaits.length ? formatList(f.favoriteBaits.map((b) => t(gearKey('bait', b, 'name'))), 'conjunction') : '–';

    const rows: [string, string][] = [
      [t('lexicon.location'), zones],
      [t('lexicon.depth'), formatDepthRange(f.depthMinM, f.depthMaxM)],
      [t('lexicon.time'), times],
      [t('lexicon.weather'), weather],
    ];
    if (f.requiredEvent !== 'Keins') rows.push([t('lexicon.event'), t(`event.${f.requiredEvent}`)]);
    rows.push(
      [t('lexicon.bait'), baits],
      [t('lexicon.recordLength'), e.recordLengthCm ? formatLength(e.recordLengthCm) : '–'],
      [t('lexicon.recordWeight'), e.recordWeightG ? formatWeight(e.recordWeightG) : '–'],
      [t('lexicon.count'), t('lexicon.countValue', { count: e.count })],
    );
    return h('dl', { class: 'lx__d-facts' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));
  }

  /** Sprites erst zeichnen, wenn die Größen feststehen (Dialog offen). */
  private renderSprites(): void {
    const d = this.data;
    if (!d || !this.dlg.isOpen) return;
    const cells = this.grid.querySelectorAll<HTMLButtonElement>('.lx__cell');
    cells.forEach((btn) => {
      const f = d.fish.find((x) => x.id === btn.dataset.id);
      const canvas = btn.querySelector('canvas');
      const box = btn.querySelector<HTMLElement>('.lx__cell-art');
      if (!f || !canvas || !box) return;
      const e = this.entry(f.id);
      renderSprite(canvas, d.getSprite(f), {
        maxCssWidth: Math.max(24, box.clientWidth),
        maxCssHeight: Math.max(16, box.clientHeight),
        mode: e.state === 'caught' ? 'color' : 'silhouette',
        outline: RARITY_STYLE[f.rarity].color,
        maxScale: 8,
      });
    });
    const f = d.fish.find((x) => x.id === this.selected);
    const dc = this.detail.querySelector<HTMLCanvasElement>('.lx__d-sprite');
    const box = this.detail.querySelector<HTMLElement>('.lx__d-art');
    if (f && dc && box && box.clientWidth > 0) {
      renderSprite(dc, d.getSprite(f), {
        maxCssWidth: box.clientWidth - 8,
        maxCssHeight: box.clientHeight - 8,
        mode: this.entry(f.id).state === 'caught' ? 'color' : 'silhouette',
        outline: RARITY_STYLE[f.rarity].color,
        maxScale: 12,
      });
    }
  }
}

function starRow(stars: number, shiny: boolean, px: number): HTMLElement {
  const row = h('span', { class: 'lx__stars', 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) row.append(icon('star', px, i < stars ? 'is-on' : 'is-off'));
  if (shiny) row.append(icon('shiny', px, 'is-shiny'));
  return row;
}

/** Fortschritts-Kreis als echte Pixel: Maske 36×36, ganzzahlig hochskaliert. */
function drawRing(canvas: HTMLCanvasElement, total: number, lit: number, complete: boolean): void {
  const size = 36;
  const mask = ringMask(size, Math.max(1, total), lit, 4);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.max(1, Math.round(2 * dpr));
  canvas.width = size * scale;
  canvas.height = size * scale;
  canvas.style.width = `${(size * scale) / dpr}px`;
  canvas.style.height = `${(size * scale) / dpr}px`;
  const small = document.createElement('canvas');
  small.width = size;
  small.height = size;
  const sctx = small.getContext('2d');
  if (!sctx) return;
  const img = sctx.createImageData(size, size);
  const on = hexToRgb(complete ? '#ffc83d' : '#3f9a4c');
  const off = hexToRgb('#cfb27a');
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i];
    if (!m) continue;
    const c = m === 2 ? on : off;
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
}
