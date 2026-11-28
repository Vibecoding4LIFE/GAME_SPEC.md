// src/ui/netScreens.ts – HTML-Overlays für Mehrspieler (B4/B5, D 2.1–2.6): Startmenü, Warteraum, Mehrspieler-HUD
// (Timer, Mini-Rangliste, Fang-Feed, Finale, verdeckte Punkte, Emotes), Ergebnis-Bildschirm, Meldungen.
// Keine Netzlogik: Die Szene liefert fertige Ansichtsdaten und bekommt Rückrufe. Texte nur über t().
import { t } from '../i18n';
import { Dialog } from './dialog';
import { button, h, icon } from './dom';
import { formatCoins } from './format';
import './styles';
import './net.css';

/** Farbe für Hut/Boot aus einer ID (bis es Kosmetik gibt, Phase 3). Palette aus theme.css. */
const SWATCHES = ['#d9a441', '#1e5f5b', '#b0413e', '#4f7cac', '#7a9a3a', '#8a5a33', '#c96f9c', '#e8743c'];
export function swatchFor(id: string): string {
  let hsh = 0;
  for (let i = 0; i < id.length; i++) hsh = (hsh * 31 + id.charCodeAt(i)) >>> 0;
  return SWATCHES[hsh % SWATCHES.length] as string;
}

export const formatClock = (s: number): string => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

// ------------------------------------------------------------------ Startmenü

export interface StartMenuCallbacks {
  onSolo(): void;
  onCreate(name: string): void;
  onJoin(name: string, code: string): void;
}

export class StartMenu {
  private readonly dlg: Dialog;
  private readonly nameIn: HTMLInputElement;
  private readonly codeIn: HTMLInputElement;
  private readonly status = h('p', { class: 'net-status', role: 'status', 'aria-live': 'polite' });
  private readonly btns: HTMLButtonElement[];

  constructor(cb: StartMenuCallbacks) {
    this.dlg = new Dialog({ title: t('net.menu.title'), className: 'net-menu', closable: false });
    this.nameIn = h('input', { class: 'net-input', type: 'text', maxlength: 24, autocomplete: 'nickname', 'aria-label': t('net.menu.name') });
    this.codeIn = h('input', {
      class: 'net-input net-input--code', type: 'text', maxlength: 7, autocapitalize: 'characters', autocomplete: 'off',
      spellcheck: 'false', placeholder: 'ABC234', 'aria-label': t('net.menu.code'),
    });
    const solo = button(t('net.menu.solo'), { cls: 'net-solo', icon: 'hook' });
    solo.setAttribute('data-autofocus', '');
    const create = button(t('net.menu.create'), { variant: 'wood', cls: 'net-create' });
    const join = button(t('net.menu.joinGo'), { variant: 'wood', cls: 'net-join' });
    solo.addEventListener('click', () => cb.onSolo());
    create.addEventListener('click', () => cb.onCreate(this.name()));
    const doJoin = () => cb.onJoin(this.name(), this.codeIn.value);
    join.addEventListener('click', doJoin);
    this.codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
    this.btns = [solo, create, join];
    this.dlg.body.append(
      h('div', { class: 'net-menu__solo' }, [solo]),
      h('div', { class: 'net-menu__multi' }, [
        h('h3', { class: 'net-h', text: t('net.menu.friends') }),
        h('label', { class: 'net-field' }, [h('span', { text: t('net.menu.name') }), this.nameIn]),
        create,
        h('div', { class: 'net-row' }, [h('label', { class: 'net-field' }, [h('span', { text: t('net.menu.code') }), this.codeIn]), join]),
      ]),
      this.status,
    );
  }

  private name(): string { return this.nameIn.value.trim().slice(0, 24); }

  mount(parent: HTMLElement): void { this.dlg.mount(parent); }

  show(d: { name: string; code?: string | null; status?: string | null }): void {
    this.nameIn.value = d.name;
    if (d.code) this.codeIn.value = d.code;
    this.setStatus(d.status ?? null, false);
    this.dlg.open();
  }

  /** Statuszeile; `busy` sperrt die Knöpfe (Verbindungsaufbau). */
  setStatus(text: string | null, busy: boolean, error = false): void {
    this.status.textContent = text ?? '';
    this.status.classList.toggle('is-error', error);
    for (const b of this.btns) b.disabled = busy;
  }

  hide(): void { this.dlg.close('api'); }
  destroy(): void { this.dlg.close('api'); this.dlg.root.remove(); }
  get visible(): boolean { return this.dlg.isOpen; }
}

// ------------------------------------------------------------------ Warteraum

export interface LobbyPlayerView { id: string; name: string; ready: boolean; connected: boolean; host: boolean; me: boolean }

export interface LobbyView {
  code: string;
  isHost: boolean;
  players: LobbyPlayerView[];
  ready: { ready: number; total: number };
  meReady: boolean;
  worlds: { id: string; name: string }[];
  world: string;
  durationsS: number[];
  durationS: number;
  equipment: string;
  equipments: readonly string[];
  mode: string;
  /** Restzeit des Countdowns in s oder null */
  countdownS: number | null;
  /** Host auf dem Handy: „Bleib in diesem Tab …“ */
  hostHint: boolean;
  offline: boolean;
}

export interface LobbyCallbacks {
  onReady(ready: boolean): void;
  onSettings(patch: { welt?: string; dauerS?: number; ausruestung?: string }): void;
  onShare(): void;
  onLeave(): void;
}

export class LobbyScreen {
  private readonly dlg: Dialog;
  private readonly codeEl = h('strong', { class: 'net-code' });
  private readonly list = h('ul', { class: 'net-players' });
  private readonly settingsBox = h('div', { class: 'net-settings' });
  private readonly readyBtn: HTMLButtonElement;
  private readonly countdown = h('p', { class: 'net-countdown', role: 'status', 'aria-live': 'polite' });
  private readonly hint = h('p', { class: 'net-hosthint', hidden: true, text: t('net.hostHint') });
  private readonly offline = h('p', { class: 'net-offline', hidden: true, text: t('net.lobby.offline') });
  private readonly msg = h('p', { class: 'net-status', role: 'status', 'aria-live': 'polite' });
  private readonly world: HTMLSelectElement;
  private readonly duration: HTMLSelectElement;
  private readonly equipment: HTMLSelectElement;
  private readonly modeEl = h('span', { class: 'net-value' });
  private view: LobbyView | null = null;

  constructor(cb: LobbyCallbacks) {
    this.dlg = new Dialog({ title: t('net.lobby.title'), className: 'net-lobby', closable: false });
    const share = button(t('net.lobby.share'), { variant: 'wood', cls: 'net-share' });
    share.addEventListener('click', () => cb.onShare());
    this.readyBtn = button('', { cls: 'net-ready' });
    this.readyBtn.setAttribute('data-autofocus', '');
    this.readyBtn.addEventListener('click', () => cb.onReady(!(this.view?.meReady ?? false)));
    const leave = button(t('net.lobby.leave'), { variant: 'ghost', cls: 'net-leave' });
    leave.addEventListener('click', () => cb.onLeave());
    const sel = (cls: string, label: string, on: (v: string) => void) => {
      const s = h('select', { class: `net-select ${cls}`, 'aria-label': label });
      s.addEventListener('change', () => on(s.value));
      return s;
    };
    this.world = sel('net-set-world', t('net.lobby.world'), (v) => cb.onSettings({ welt: v }));
    this.duration = sel('net-set-duration', t('net.lobby.duration'), (v) => cb.onSettings({ dauerS: Number(v) }));
    this.equipment = sel('net-set-equipment', t('net.lobby.equipment'), (v) => cb.onSettings({ ausruestung: v }));
    const row = (label: string, el: HTMLElement) => h('label', { class: 'net-field' }, [h('span', { text: label }), el]);
    this.settingsBox.append(
      row(t('net.lobby.world'), this.world), row(t('net.lobby.mode'), this.modeEl),
      row(t('net.lobby.duration'), this.duration), row(t('net.lobby.equipment'), this.equipment),
    );
    this.dlg.body.append(
      h('div', { class: 'net-row net-row--code' }, [h('span', { text: t('net.lobby.code') }), this.codeEl, share]),
      this.msg, this.offline, this.hint,
      h('h3', { class: 'net-h', text: t('net.lobby.players') }), this.list,
      this.settingsBox, this.countdown,
    );
    this.dlg.foot.append(leave, this.readyBtn);
  }

  mount(parent: HTMLElement): void { this.dlg.mount(parent); }

  show(v: LobbyView): void { this.update(v); this.dlg.open(); }

  /** Meldung im Warteraum (z. B. „Link kopiert“). */
  say(text: string): void { this.msg.textContent = text; }

  update(v: LobbyView): void {
    const prev = this.view;
    this.view = v;
    this.codeEl.textContent = v.code;
    this.hint.hidden = !v.hostHint;
    this.offline.hidden = !v.offline;
    if (!prev || JSON.stringify(prev.players) !== JSON.stringify(v.players)) {
      this.list.replaceChildren(...v.players.map((p) => h('li', { class: `net-player${p.connected ? '' : ' is-away'}${p.me ? ' is-me' : ''}`, 'data-id': p.id }, [
        h('span', { class: 'net-swatch', style: `background:${swatchFor(p.id)}`, 'aria-hidden': 'true' }),
        h('span', { class: 'net-player__name', text: p.name }),
        p.host ? h('span', { class: 'net-tag', text: t('net.lobby.host') }) : null,
        h('span', { class: `net-player__ready${p.ready ? ' is-ready' : ''}`, text: p.ready ? t('net.lobby.isReady') : t('net.lobby.notReady') }),
      ])));
    }
    const fill = (s: HTMLSelectElement, items: { v: string; label: string }[], value: string) => {
      const sig = items.map((i) => i.v).join('|');
      if (s.dataset.sig !== sig) {
        s.replaceChildren(...items.map((i) => h('option', { value: i.v, text: i.label })));
        s.dataset.sig = sig;
      }
      s.value = value;
      s.disabled = !v.isHost || v.countdownS !== null;
    };
    fill(this.world, v.worlds.map((w) => ({ v: w.id, label: w.name })), v.world);
    fill(this.duration, v.durationsS.map((d) => ({ v: String(d), label: d % 60 === 0 ? t('net.lobby.minutes', { n: d / 60 }) : t('net.lobby.seconds', { n: d }) })), String(v.durationS));
    fill(this.equipment, v.equipments.map((e) => ({ v: e, label: t(`net.equip.${e}`) })), v.equipment);
    this.modeEl.textContent = t(`net.mode.${v.mode}`);
    const label = t('net.lobby.ready', { ready: v.ready.ready, total: v.ready.total });
    this.readyBtn.replaceChildren(h('span', { class: 'ui-btn__label', text: v.meReady ? t('net.lobby.unready', { ready: v.ready.ready, total: v.ready.total }) : label }));
    this.readyBtn.classList.toggle('is-ready', v.meReady);
    this.readyBtn.setAttribute('aria-pressed', String(v.meReady));
    this.countdown.textContent = v.countdownS !== null ? t('net.lobby.countdown', { s: Math.ceil(v.countdownS) })
      : v.ready.total < 2 ? t('net.lobby.waitPlayers') : '';
  }

  hide(): void { this.dlg.close('api'); }
  destroy(): void { this.dlg.close('api'); this.dlg.root.remove(); }
  get visible(): boolean { return this.dlg.isOpen; }
}

// ------------------------------------------------------------------ Mehrspieler-HUD

export interface RankRow { id: string; name: string; points: number | null; tailwind: boolean; me: boolean; state: string }
export interface NetHudView {
  phase: string;
  /** Hauptuhr in s (Angelzeit, Countdown oder Restphase) */
  clockS: number;
  finale: boolean;
  hidden: boolean;
  rows: RankRow[];
}

export class NetHud {
  private readonly root = h('div', { class: 'net-hud', hidden: true });
  private readonly clock = h('div', { class: 'net-clock', role: 'timer' });
  private readonly badge = h('div', { class: 'net-badge', hidden: true });
  private readonly rank = h('ol', { class: 'net-rank', 'aria-label': t('net.hud.ranking') });
  private readonly feed = h('ul', { class: 'net-feed', 'aria-live': 'polite' });
  private readonly bubbles = h('div', { class: 'net-bubbles', 'aria-live': 'polite' });
  private readonly hint = h('p', { class: 'net-hosthint net-hosthint--hud', hidden: true, text: t('net.hostHint') });
  private readonly sky = h('div', { class: 'net-sky', hidden: true, 'aria-hidden': 'true' });
  private sig = '';

  constructor(cb: { onEmote(id: string): void; onLeave(): void }, emotes: readonly string[]) {
    const emoteBar = h('div', { class: 'net-emotes', role: 'group', 'aria-label': t('net.hud.emotes') });
    for (const id of emotes) {
      const b = h('button', { type: 'button', class: `ui-btn ui-btn--wood net-emote net-emote--${id}`, text: t(`net.emote.${id}`), 'aria-label': t(`net.emote.${id}`) });
      b.addEventListener('click', () => cb.onEmote(id));
      emoteBar.append(b);
    }
    const leave = h('button', { type: 'button', class: 'ui-btn ui-btn--ghost net-hud__leave', 'aria-label': t('net.hud.leave'), title: t('net.hud.leave') }, [icon('close', 2)]);
    leave.addEventListener('click', () => cb.onLeave());
    this.root.append(
      this.sky,
      h('div', { class: 'net-hud__top' }, [this.clock, this.badge, leave]),
      this.rank, this.feed, this.bubbles, emoteBar, this.hint,
    );
  }

  mount(parent: HTMLElement): void { parent.append(this.root); }
  show(hostHint: boolean): void { this.root.hidden = false; this.hint.hidden = !hostHint; }
  hide(): void { this.root.hidden = true; }
  destroy(): void { this.root.remove(); }
  get visible(): boolean { return !this.root.hidden; }

  update(v: NetHudView): void {
    this.clock.textContent = formatClock(v.clockS);
    this.clock.classList.toggle('is-urgent', v.finale);
    const badge = v.phase === 'Countdown' ? t('net.hud.countdown') : v.phase === 'LastCast' ? t('net.hud.lastCast') : v.finale ? t('net.hud.finale') : '';
    this.badge.textContent = badge;
    this.badge.hidden = badge === '';
    this.sky.hidden = !v.finale;
    this.root.classList.toggle('is-finale', v.finale);
    const sig = JSON.stringify(v.rows) + v.hidden;
    if (sig === this.sig) return;
    this.sig = sig;
    this.rank.replaceChildren(...v.rows.map((r) => h('li', { class: `net-rank__row${r.me ? ' is-me' : ''}`, 'data-id': r.id }, [
      h('span', { class: 'net-swatch', style: `background:${swatchFor(r.id)}`, 'aria-hidden': 'true' }),
      h('span', { class: 'net-rank__name', text: r.name }),
      r.tailwind ? h('span', { class: 'net-sail', title: t('net.hud.tailwind'), 'aria-label': t('net.hud.tailwind'), text: t('net.hud.sail') }) : null,
      h('span', { class: 'net-rank__pts', text: r.points === null ? t('net.hud.hidden') : formatCoins(r.points) }),
    ])));
  }

  /** Fang-Meldung oben im Feed (die neuesten 4 bleiben stehen). */
  pushFeed(text: string, shiny = false): void {
    const li = h('li', { class: `net-feed__item${shiny ? ' is-shiny' : ''}`, text });
    this.feed.prepend(li);
    while (this.feed.children.length > 4) this.feed.lastElementChild?.remove();
  }

  /** Emote eines Spielers als Sprechblase (verschwindet nach 3 s). */
  pushEmote(name: string, emoteId: string): void {
    const el = h('div', { class: 'net-bubble', text: `${name}: ${t(`net.emote.${emoteId}`)}` });
    this.bubbles.append(el);
    while (this.bubbles.children.length > 3) this.bubbles.firstElementChild?.remove();
    setTimeout(() => el.remove(), 3000);
  }
}

// ------------------------------------------------------------------ Ergebnis

export interface ResultRow {
  id: string; name: string; place: number; points: number; catches: number; species: number; coins: number; awards: string[]; me: boolean;
}

export class ResultsScreen {
  private readonly dlg: Dialog;
  private readonly table = h('ol', { class: 'net-results' });
  private readonly note = h('p', { class: 'net-status' });

  constructor(cb: { onClose(): void; onLeave(): void }) {
    this.dlg = new Dialog({ title: t('net.results.title'), className: 'net-results-dlg', closable: false });
    const ok = button(t('net.results.next'), { cls: 'net-results__ok' });
    ok.setAttribute('data-autofocus', '');
    ok.addEventListener('click', () => cb.onClose());
    const leave = button(t('net.lobby.leave'), { variant: 'ghost' });
    leave.addEventListener('click', () => cb.onLeave());
    this.dlg.body.append(this.table, this.note);
    this.dlg.foot.append(leave, ok);
  }

  mount(parent: HTMLElement): void { this.dlg.mount(parent); }

  show(rows: ResultRow[], note = ''): void {
    this.table.replaceChildren(...rows.map((r) => h('li', { class: `net-result${r.me ? ' is-me' : ''}${r.place === 1 ? ' is-winner' : ''}`, 'data-id': r.id }, [
      h('span', { class: 'net-result__place', text: t('net.results.place', { n: r.place }) }),
      h('span', { class: 'net-swatch', style: `background:${swatchFor(r.id)}`, 'aria-hidden': 'true' }),
      h('span', { class: 'net-result__name', text: r.name }),
      h('span', { class: 'net-result__pts', text: t('net.results.points', { n: formatCoins(r.points) }) }),
      h('span', { class: 'net-result__catches', text: t('net.results.catches', { count: r.catches, species: r.species }) }),
      h('span', { class: 'net-result__coins' }, [icon('coin', 2), h('span', { text: formatCoins(r.coins) })]),
      r.awards.length ? h('span', { class: 'net-result__awards', text: r.awards.map((a) => t(`net.award.${a}`)).join(' · ') }) : null,
    ])));
    this.note.textContent = note;
    this.dlg.open();
  }

  hide(): void { this.dlg.close('api'); }
  destroy(): void { this.dlg.close('api'); this.dlg.root.remove(); }
  get visible(): boolean { return this.dlg.isOpen; }
}

// ------------------------------------------------------------------ Meldung

/** Kurze Meldung oben in der Mitte (z. B. „Der Gastgeber hat die Runde beendet“). */
export function netToast(parent: HTMLElement, text: string, ms = 4000): HTMLElement {
  const el = h('div', { class: 'net-toast', role: 'alert', text });
  parent.append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}
