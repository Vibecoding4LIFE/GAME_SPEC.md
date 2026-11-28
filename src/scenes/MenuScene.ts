// src/scenes/MenuScene.ts – Startmenü (B4/H Phase 2): „Allein angeln“ / „Raum erstellen“ / „Raum beitreten (Code)“.
// `?raum=ABC234` tritt direkt bei. URL-Parameter für Tests: `netz=lokal|supabase`, `name=…`, `testdauer=…`, `bot=1`.
import Phaser from 'phaser';
import { createStore } from '../core/storage';
import { loadBalancing } from '../data/balancing';
import { loadFishData, loadWorldDb } from '../data/db';
import { loadGear } from '../data/gear';
import type { FishId, WorldId } from '../data/types';
import { levelForXp } from '../game/score';
import type { GameData } from '../game/types';
import { t } from '../i18n';
import type { ClientProfile } from '../net/client';
import { parseRoomParam } from '../net/roomCode';
import { RoomSession, type NetBackend } from '../net/room';
import { supabaseEnv } from '../net/supabaseEnv';
import { StartMenu, netToast } from '../ui/netScreens';
import type { DebugState } from '../main';
import { CACHE, SCENES } from './keys';
import { RaumScene } from './RaumScene';
import { VIEW } from './sceneConfig';
import { bottomDepthAt, distanceToX, type WorldSee } from './worldSee';
import { loadSave } from './welt/saveStore';

const NAME_KEY = 'ctd.name';

/** Menü- und Raum-Szene einmalig anmelden (main.ts kennt nur die Einzelspieler-Szenen). */
export function registerNetScenes(scene: Phaser.Scene): void {
  if (!scene.scene.get(SCENES.menu)) scene.scene.add(SCENES.menu, MenuScene, false);
  if (!scene.scene.get(SCENES.raum)) scene.scene.add(SCENES.raum, RaumScene, false);
}

export interface NetUrlParams { backend: NetBackend; code: string | null; name: string | null; testDurationS: number | null; bot: boolean }

export function netParams(search: string): NetUrlParams {
  const q = new URLSearchParams(search);
  const n = q.get('netz');
  const backend: NetBackend = n === 'lokal' ? 'lokal' : n === 'supabase' ? 'supabase' : supabaseEnv() ? 'supabase' : 'lokal';
  const td = Number(q.get('testdauer'));
  return {
    backend, code: parseRoomParam(search), name: q.get('name'),
    testDurationS: Number.isFinite(td) && td > 0 ? td : null, bot: q.get('bot') === '1',
  };
}

export class MenuScene extends Phaser.Scene {
  private menu: StartMenu | null = null;
  private worldId: WorldId = 'W1';
  private message: string | null = null;
  private gd!: GameData;
  private busy = false;
  private static autoJoined = false;

  constructor() { super(SCENES.menu); }

  init(d: { worldId?: WorldId; message?: string }): void {
    this.worldId = d.worldId ?? 'W1';
    this.message = d.message ?? null;
    this.busy = false;
  }

  create(): void {
    this.gd = {
      fish: loadFishData(this.cache.json.get(CACHE.fishDb)),
      worlds: loadWorldDb(this.cache.json.get(CACHE.worlds)).worlds,
      gear: loadGear(this.cache.json.get(CACHE.gear)),
      balancing: loadBalancing(this.cache.json.get(CACHE.balancing)),
    };
    const overlay = document.getElementById('overlay') as HTMLElement;
    const p = netParams(window.location.search);
    this.menu = new StartMenu({
      onSolo: () => this.solo(),
      onCreate: (name) => void this.open(null, name),
      onJoin: (name, code) => void this.open(code, name),
    });
    this.menu.mount(overlay);
    const name = p.name ?? localStorage.getItem(NAME_KEY) ?? t('net.menu.defaultName', { n: 100 + Math.floor(Math.random() * 900) });
    this.menu.show({ name, code: p.code, status: null });
    if (this.message) netToast(overlay, this.message);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.menu?.destroy(); this.menu = null; });
    const debug = this.registry.get('debug') as DebugState | undefined;
    if (debug) { debug.scene = 'menu'; debug.ready = true; }
    // Einladungslink: einmal pro Seitenaufruf direkt beitreten
    if (p.code && !MenuScene.autoJoined) {
      MenuScene.autoJoined = true;
      void this.open(p.code, name);
    }
  }

  private solo(): void {
    if (this.busy) return;
    this.menu?.hide();
    this.scene.start(SCENES.welt, { worldId: this.worldId });
  }

  private async profile(name: string): Promise<ClientProfile> {
    const { profile } = await loadSave(createStore(), this.gd.gear);
    const bekannt = Object.entries(profile.lexicon).filter(([, e]) => e?.state === 'caught').map(([id]) => id as FishId);
    return {
      name: name || t('net.menu.defaultName', { n: 1 }), hut: (profile.hats[0] ?? '').slice(0, 16), boot: '',
      ruf: levelForXp(profile.xp, this.gd.balancing),
      // Welt-Freischaltung kommt mit Phase 3 (Hafen); bis dahin ist W1 offen
      welten: ['W1'], bekannt, abzeichen: [...profile.badges], pity: profile.pityCount, ausruestung: { ...profile.loadout, accessories: [...profile.loadout.accessories] },
    };
  }

  private async open(code: string | null, name: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { localStorage.setItem(NAME_KEY, name); } catch { /* privates Fenster */ }
    const p = netParams(window.location.search);
    this.menu?.setStatus(t('net.menu.connecting'), true);
    const w = this.gd.worlds.find((x) => x.id === this.worldId);
    const art = w ? (this.cache.json.get(CACHE.worldArt(w.kuerzel)) as WorldSee | undefined) : undefined;
    const spotX = art?.spielerplaetze[0]?.x ?? 0;
    const maxXM = art ? (art.groesse.w - spotX) / art.pixelProMeter : 30;
    const minDuration = this.gd.balancing.score.finale.lastS;
    const res = await RoomSession.open({
      backend: p.backend, code, profile: await this.profile(name), data: this.gd,
      shadows: { max: VIEW.shadows.max, minXM: 0, maxXM, speedMs: VIEW.shadows.speedMs, ttlS: VIEW.shadows.ttlS, spawnPerS: VIEW.shadows.spawnPerS },
      bottomDepthAt: art ? (dM) => bottomDepthAt(art, distanceToX(art, spotX, dM)) : undefined,
      testDurationS: p.testDurationS !== null && p.testDurationS >= minDuration ? p.testDurationS : null,
    });
    this.busy = false;
    if (!res.ok) {
      console.warn(`Raum: ${res.reason} – ${res.detail}`);
      this.menu?.setStatus(t(`net.err.${res.reason}`), false, true);
      return;
    }
    this.menu?.hide();
    this.scene.start(SCENES.raum, { room: res.room, worldId: this.worldId, bot: p.bot });
  }
}
