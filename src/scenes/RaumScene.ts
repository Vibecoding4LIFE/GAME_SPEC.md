// src/scenes/RaumScene.ts – Mehrspieler-Welt (B4, D 2.2 A „Wettangeln“). Zeichnet mit denselben Bausteinen wie die
// WeltScene (Backdrop, Angler, FishLayer, Hud), aber die Logik kommt vom NetClient: Würfe, Biss und Fang entscheidet
// der Host, der Drill läuft lokal. Warteraum, HUD, Ergebnis und Emotes sind HTML-Overlays (src/ui/netScreens.ts).
// `?bot=1` lässt einen Bot spielen (Playwright-Abnahme mit 4 Spielern).
import Phaser from 'phaser';
import { bus } from '../core/events';
import type { PixelLayout } from '../core/pixelScale';
import { Rng, hashSeed } from '../core/random';
import { loadBalancing } from '../data/balancing';
import { loadFishData, loadWorldDb } from '../data/db';
import { loadGear } from '../data/gear';
import type { FishData, WorldId } from '../data/types';
import { perfectWindowMin, windShare } from '../game/cast';
import { depthLimitM } from '../game/depth';
import { rodBendStage } from '../game/drill';
import { InputCollector, type SessionInput } from '../game/session';
import type { ShadowView as GameShadowView } from '../game/shadows';
import type { ActiveWeather, DayPhase, GameData, WorldDbEntry } from '../game/types';
import { t } from '../i18n';
import type { ClientEvent } from '../net/client';
import { EQUIPMENT_RULES, EMOTES, type EmoteId, type LobbySettings } from '../net/messages';
import type { RoomSession } from '../net/room';
import { readyCount } from '../net/lobby';
import { NetBot } from '../net/sim';
import { Feedback, TouchControls, createInput, type FeedbackKind, type InputController, type InputMode } from '../ui';
import { LobbyScreen, NetHud, ResultsScreen, type LobbyView, type NetHudView, type ResultRow } from '../ui/netScreens';
import type { DebugState } from '../main';
import { CACHE, FIGURES_ATLAS, HUD_ATLAS, SCENES, fishAtlasKey, worldAtlasKey } from './keys';
import { applyPixelCamera } from './pixelCamera';
import { hudSubLayout, hudZoom } from './hudLayout';
import { VIEW } from './sceneConfig';
import { cameraView, depthToY, distanceToX, type WorldSee } from './worldSee';
import { Angler, type BobberMode } from './welt/Angler';
import { createAtlasAnims, createFishAnims } from './welt/assets';
import { Backdrop } from './welt/Backdrop';
import { FishLayer } from './welt/FishLayer';
import { Hud } from './welt/Hud';
import { sfx } from './welt/sfx';

const MODE_FOR: Record<string, InputMode> = {
  Idle: 'aim', Casting: 'aim', Sinking: 'wait', Waiting: 'wait', Nibble: 'bite', Bite: 'bite', Reeling: 'fight', Caught: 'aim', Escaped: 'aim',
};

/** Test-Sicht auf den Raum (window.__KK.net) – nur Anzeige-Zustand, keine Geheimnisse. */
export interface NetDebug {
  code: string;
  backend: string;
  userId: string;
  isHost: boolean;
  phase: string;
  round: number;
  synced: boolean;
  rodState: string;
  channel: string;
  /** Punkte je Spieler-ID (null = verdeckt) */
  scores: Record<string, number | null>;
  results: { id: string; place: number; points: number; coins: number }[] | null;
  feed: number;
  myCatches: number;
  aborted: string | null;
  budget: { round: number; roomSends: number; sent: number; received: number; history: { round: number; roomSends: number; sent: number; received: number }[]; summary: string };
  hooks: { ready(on: boolean): void; leave(): void; emote(id: string): void; setDuration(s: number): void };
}

export class RaumScene extends Phaser.Scene {
  private room!: RoomSession;
  private worldId: WorldId = 'W1';
  private botMode = false;
  private bot: NetBot | null = null;
  private gd!: GameData;
  private world!: WorldDbEntry;
  private art!: WorldSee;
  private layout!: PixelLayout;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private backdrop!: Backdrop;
  private angler!: Angler;
  private fishLayer!: FishLayer;
  private hud!: Hud;
  private input2!: InputController;
  private collector = new InputCollector();
  private touch!: TouchControls;
  private feedback!: Feedback;
  private lobby!: LobbyScreen;
  private netHud!: NetHud;
  private results!: ResultsScreen;
  private silhouette!: FishData;
  private offs: (() => void)[] = [];
  private ready = false;
  private logicAcc = 0;
  private castFlight = 1;
  private cam = { x: 0, y: 0 };
  private marker: 'none' | 'nibble' | 'bite' | 'fake' = 'none';
  private fakeUntil = 0;
  private hookedStart = { x: 0, y: 0 };
  private carry: Pick<SessionInput, 'reelPressed' | 'rodUp' | 'strike' | 'feed' | 'retrieve'> = { reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
  private uiAcc = 1;
  private resultsShownFor = -1;
  private resultsDismissed = -1;
  private coarse = false;
  private lastTouch = { mode: '' as string, rodUp: false };
  private dbg!: NetDebug;
  private leaving = false;
  private shakeLeft = 0;
  private shakeAmp = 0;

  constructor() { super(SCENES.raum); }

  init(d: { room: RoomSession; worldId?: WorldId; bot?: boolean }): void {
    this.room = d.room;
    this.worldId = d.worldId ?? 'W1';
    this.botMode = !!d.bot;
    this.ready = false;
    this.leaving = false;
    this.offs = [];
    this.resultsShownFor = -1;
    this.resultsDismissed = -1;
  }

  create(): void {
    this.gd = {
      fish: loadFishData(this.cache.json.get(CACHE.fishDb)),
      worlds: loadWorldDb(this.cache.json.get(CACHE.worlds)).worlds,
      gear: loadGear(this.cache.json.get(CACHE.gear)),
      balancing: loadBalancing(this.cache.json.get(CACHE.balancing)),
    };
    const w = this.gd.worlds.find((x) => x.id === this.worldId);
    if (!w) throw new Error(`Welt ${this.worldId} fehlt`);
    this.world = w;
    this.art = this.cache.json.get(CACHE.worldArt(w.kuerzel)) as WorldSee;
    // Immer derselbe Umriss für den gehakten Fisch: die Form darf die Art nicht verraten (B4)
    const tpl = this.gd.fish.find((f) => f.world === w.id && !f.isBoss) as FishData;
    this.silhouette = tpl;
    document.body.style.setProperty('--rand', w.leitfarben[3] ?? '#12342f');
    for (const a of [worldAtlasKey(w.kuerzel), FIGURES_ATLAS, HUD_ATLAS]) createAtlasAnims(this, a);
    createFishAnims(this, fishAtlasKey(w.kuerzel));

    this.layout = this.registry.get('layout') as PixelLayout;
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    this.hudCam = this.cameras.add(0, 0, 1, 1, false, 'hud');
    this.cameras.main.ignore(this.hudLayer);
    this.hudCam.ignore(this.worldLayer);

    const seed = hashSeed(`${this.room.code}:${this.room.userId}`);
    const spotX = this.art.spielerplaetze[0]?.x ?? 0;
    this.angler = new Angler(this, this.worldLayer, this.art, this.room.client.loadout().rod.lineColor);
    this.backdrop = new Backdrop(this, this.worldLayer, this.art, new Rng(hashSeed(`${seed}:deko`)));
    this.backdrop.create();
    this.fishLayer = new FishLayer(this, this.worldLayer, this.art, spotX);
    this.fishLayer.create();
    this.angler.create();
    this.hud = new Hud(this, this.hudLayer);
    this.hud.create();
    this.applyCameras();
    this.buildUi();
    this.relayoutHud();
    if (this.botMode) this.bot = new NetBot(seed);

    this.offs.push(bus.on('layout', (l) => { this.layout = l; this.applyCameras(); this.relayoutHud(); }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.room.driven = true;
    this.dbg = this.makeDebug();
    const debug = this.registry.get('debug') as (DebugState & { net?: NetDebug }) | undefined;
    if (debug) { debug.scene = 'raum'; debug.net = this.dbg; debug.ready = true; }
    this.ready = true;
    this.syncScreens(true);
  }

  // ------------------------------------------------------------------ UI

  private buildUi(): void {
    const overlay = document.getElementById('overlay') as HTMLElement;
    this.input2 = createInput();
    this.offs.push(this.input2.onAction((a) => this.collector.apply(a)));
    this.offs.push(() => this.input2.dispose());
    this.touch = new TouchControls(this.input2);
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    this.lobby = new LobbyScreen({
      onReady: (on) => this.room.client.ready(on),
      onSettings: (patch) => this.room.host?.setSettings(patch as Partial<LobbySettings>),
      onShare: () => void this.share(),
      onLeave: () => this.leave(null),
    });
    this.netHud = new NetHud({ onEmote: (id) => this.emote(id as EmoteId), onLeave: () => this.leave(null) }, EMOTES);
    this.results = new ResultsScreen({
      onClose: () => { this.resultsDismissed = this.room.client.round.round; this.results.hide(); },
      onLeave: () => this.leave(null),
    });
    this.touch.mount(overlay);
    this.netHud.mount(overlay);
    this.lobby.mount(overlay);
    this.results.mount(overlay);
    this.feedback = new Feedback({ vibration: true }, overlay);
    this.touch.show({ mode: 'aim', passThrough: false, showHints: false });
    this.offs.push(() => {
      this.feedback.destroy();
      for (const c of [this.touch, this.netHud, this.lobby, this.results]) c.destroy();
    });
  }

  private hostHint(): boolean { return this.room.isHost && this.coarse; }

  private async share(): Promise<void> {
    const url = this.room.link(window.location.href);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share && this.coarse) { await nav.share({ title: t('app.title'), text: t('net.lobby.shareText', { code: this.room.code }), url }); return; }
      await navigator.clipboard.writeText(url);
      this.lobby.say(t('net.lobby.copied'));
    } catch {
      this.lobby.say(url); // ohne Zwischenablage-Recht: Link anzeigen
    }
  }

  private emote(id: EmoteId): void {
    this.room.client.emote(id);
    this.netHud.pushEmote(this.nameOf(this.room.userId), id);
  }

  private nameOf(id: string): string {
    return this.room.client.roundData?.spieler.find((p) => p.id === id)?.name ?? '?';
  }

  private lobbyView(): LobbyView {
    const c = this.room.client;
    const rd = c.roundData;
    const players = (rd?.spieler ?? []).map((p) => ({ id: p.id, name: p.name, ready: p.bereit, connected: p.verbunden, host: p.id === rd?.host, me: p.id === c.id }));
    const durations = [...c.cfg.round.durationsS];
    const cur = rd?.einstellungen.dauerS ?? c.cfg.round.defaultDurationS;
    if (!durations.includes(cur)) durations.unshift(cur);
    return {
      code: this.room.code, isHost: this.room.isHost, players,
      ready: readyCount(players.map((p) => ({ ready: p.ready, connected: p.connected }))),
      meReady: players.find((p) => p.me)?.ready ?? false,
      worlds: (rd?.welten ?? [this.worldId]).map((id) => ({ id, name: t(this.gd.worlds.find((x) => x.id === id)?.nameKey ?? id) })),
      world: rd?.einstellungen.welt ?? this.worldId,
      durationsS: durations, durationS: cur,
      equipment: rd?.einstellungen.ausruestung ?? 'Ausgeglichen', equipments: EQUIPMENT_RULES,
      mode: rd?.einstellungen.modus ?? 'Wettangeln',
      countdownS: c.round.phase === 'Countdown' ? c.phaseRemainingS() : null,
      hostHint: this.hostHint(), offline: this.room.backend === 'lokal',
    };
  }

  private hudView(): NetHudView {
    const c = this.room.client;
    const ph = c.round.phase;
    const scores = c.scores;
    const rows = (c.roundData?.spieler ?? []).map((p) => {
      const sc = scores?.liste.find((x) => x.spieler === p.id);
      return {
        id: p.id, name: p.name, points: sc ? sc.punkte : 0, tailwind: (sc?.rueckenwind ?? 0) > 0, me: p.id === c.id,
        state: c.rods.get(p.id) ?? 'Idle',
      };
    });
    if (!scores?.verdeckt) rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const clockS = ph === 'Countdown' || ph === 'LastCast' || ph === 'Results' ? c.phaseRemainingS() : c.fishingRemainingS();
    return { phase: ph, clockS, finale: ph === 'Finale', hidden: !!scores?.verdeckt, rows };
  }

  private resultRows(): ResultRow[] {
    const c = this.room.client;
    return (c.results?.plaetze ?? []).map((r) => ({
      id: r.spieler, name: this.nameOf(r.spieler), place: r.platz, points: r.punkte, catches: r.faenge, species: r.arten,
      coins: r.muenzen, awards: r.auszeichnungen, me: r.spieler === c.id,
    }));
  }

  /** Overlays passend zur Phase zeigen/verstecken. */
  private syncScreens(force = false): void {
    const c = this.room.client;
    const ph = c.round.phase;
    const inLobby = ph === 'Lobby' || ph === 'Countdown';
    if (inLobby) {
      if (!this.lobby.visible) this.lobby.show(this.lobbyView());
      else if (force || this.uiAcc >= 0.2) this.lobby.update(this.lobbyView());
    } else if (this.lobby.visible) this.lobby.hide();
    const playing = ph === 'Countdown' || ph === 'Fishing' || ph === 'Finale' || ph === 'LastCast' || ph === 'Results';
    if (playing && !this.netHud.visible) this.netHud.show(this.hostHint());
    if (!playing && this.netHud.visible) this.netHud.hide();
    if (this.netHud.visible) this.netHud.update(this.hudView());
    if (ph === 'Results' && c.results && this.resultsShownFor !== c.round.round && this.resultsDismissed !== c.round.round) {
      this.resultsShownFor = c.round.round;
      this.results.show(this.resultRows(), t('net.results.backSoon'));
    }
    if (ph !== 'Results' && this.results.visible) this.results.hide();
  }

  private leave(message: string | null): void {
    if (this.leaving) return;
    this.leaving = true;
    this.room.close();
    this.scene.start(SCENES.menu, { worldId: this.worldId, message: message ?? undefined });
  }

  // ------------------------------------------------------------------ Kameras/HUD

  private hudLayoutNow(): PixelLayout {
    const hz = hudZoom(this.layout, window.devicePixelRatio || 1, VIEW.hud.minCssPx, VIEW.hud.minArea);
    return hudSubLayout(this.layout, hz);
  }

  private applyCameras(): void {
    applyPixelCamera(this.cameras.main, this.layout);
    applyPixelCamera(this.hudCam, this.hudLayoutNow());
    this.positionCamera(true);
  }

  private relayoutHud(): void {
    if (!this.hud) return;
    this.hud.relayout(this.hudLayoutNow(), {
      keyHints: !this.coarse, dpr: window.devicePixelRatio || 1, safe: { top: 0, right: 0, bottom: 0, left: 0 },
      // oben Platz für Uhr/Rangliste (HTML)
      topBarCss: VIEW.hud.topBarCss,
      touchButtonCss: this.coarse ? (this.layout.orientation === 'portrait' ? VIEW.hud.touchButtonCssPortrait : VIEW.hud.touchButtonCss) : 0,
    });
  }

  // ------------------------------------------------------------------ Schleife

  update(_time: number, delta: number): void {
    if (!this.ready || this.leaving) return;
    const raw = this.game.loop.rawDelta;
    const frameS = Math.min(VIEW.maxFrameS, (raw > 0 ? raw : delta) / 1000);
    const c = this.room.client;
    const taken = this.collector.take();
    const cr = this.carry;
    const human: SessionInput = {
      ...taken, reelPressed: taken.reelPressed || cr.reelPressed, rodUp: taken.rodUp || cr.rodUp, strike: taken.strike || cr.strike,
      feed: false, retrieve: taken.retrieve || cr.retrieve,
    };
    this.logicAcc += frameS;
    let first = true;
    while (this.logicAcc >= VIEW.logicStepS) {
      this.logicAcc -= VIEW.logicStepS;
      const input: SessionInput = this.bot ? this.bot.input(c, VIEW.logicStepS)
        : first ? human : { ...human, reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
      first = false;
      for (const e of c.step(VIEW.logicStepS, input)) this.onClientEvent(e);
      if (this.leaving) return;
    }
    this.carry = first
      ? { reelPressed: human.reelPressed, rodUp: human.rodUp, strike: human.strike, feed: false, retrieve: human.retrieve }
      : { reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
    this.uiAcc += frameS;
    this.syncScreens();
    if (this.uiAcc >= 0.2) this.uiAcc = 0;
    this.syncInputMode();
    this.drawShadows(frameS);
    this.draw(frameS);
    this.updateDebug();
  }

  private syncInputMode(): void {
    const o = this.room.client.own;
    const mode = MODE_FOR[o.rod] ?? 'aim';
    const d = o.drill;
    const rodUp = !!d && (d.pullDir === 'down' || (d.stage.kind === 'telegraph' && d.stage.next === 'dive'));
    if (this.lastTouch.mode !== mode || this.lastTouch.rodUp !== rodUp) {
      this.lastTouch = { mode, rodUp };
      this.touch.update({ mode, rodUp, itemAvailable: false });
    }
  }

  private fire(kind: FeedbackKind): void { this.feedback.fire(kind); }

  private shake(amp: number, s: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeLeft = Math.max(this.shakeLeft, s);
  }

  private onClientEvent(e: ClientEvent): void {
    const c = this.room.client;
    switch (e.type) {
      case 'aborted': this.dbg.aborted = e.reason; this.leave(t(`net.aborted.${e.reason}`)); return;
      case 'phase': this.syncScreens(true); break;
      case 'emote': this.netHud.pushEmote(this.nameOf(e.from), e.id); break;
      case 'catch': {
        const fish = this.gd.fish.find((f) => f.id === e.data.id);
        const name = this.nameOf(e.data.spieler);
        const fishName = fish ? t(fish.nameKey) : '?';
        const base = t(e.data.schillernd ? 'net.feed.shiny' : 'net.feed.catch', { name, fish: fishName });
        const text = e.data.punkte === null ? base : t('net.feed.points', { text: base, points: e.data.punkte });
        this.netHud.pushFeed(text, e.data.schillernd);
        if (e.mine) {
          this.fire('catch');
          sfx.emit('catch', { shiny: e.data.schillernd });
          this.hud.say(text);
          if (e.data.meister) this.hud.say(t('scene.masterDrill'));
          this.marker = 'none';
        }
        break;
      }
      case 'bite':
        if (e.spieler === c.id) { this.marker = 'bite'; this.fire('bite'); this.shake(2, 0.25); sfx.emit('bite', {}); }
        break;
      case 'rodState': {
        if (e.spieler !== c.id) break;
        if (e.wurf) {
          this.castFlight = 0;
          sfx.emit('cast', { perfect: e.wurf.perfekt });
          if (e.wurf.perfekt) { this.hud.say(t('scene.perfectCast')); sfx.emit('pling', {}); }
        }
        if (e.zustand === 'Nibble') {
          if (e.schein) { this.marker = 'fake'; this.fakeUntil = this.time.now + this.gd.balancing.bite.fakeBite.flashS * 1000; this.fire('fake'); sfx.emit('fakeBite', {}); }
          else { this.marker = 'nibble'; this.fire('nibble'); sfx.emit('nibble', {}); }
        }
        if (e.zustand === 'Reeling') {
          const spotX = this.art.spielerplaetze[0]?.x ?? 0;
          this.hookedStart = { x: distanceToX(this.art, spotX, c.own.distanceM), y: depthToY(this.art, c.own.depthM) };
          this.marker = 'none';
        }
        if (e.grund) {
          const loss = e.grund === 'lineBreak' || e.grund === 'heatBreak' || e.grund === 'abbiss';
          if (loss) { this.fire('lineBreak'); sfx.emit('lineBreak', {}); }
          this.hud.say(t(`net.reason.${e.grund}`), e.grund === 'eingeholt' ? VIEW.colors.text : VIEW.colors.warn);
        }
        if (e.zustand === 'Idle' || e.zustand === 'Escaped') this.marker = 'none';
        break;
      }
      case 'drill': {
        const d = e.e;
        if (d.type === 'beginnerSave') this.hud.say(t('scene.beginnerSave'));
        if (d.type === 'netSave') this.hud.say(t('scene.netSave'));
        if (d.type === 'snag') { this.hud.say(t('scene.snagDrillStart'), VIEW.colors.warn); this.fire('snag'); }
        if (d.type === 'telegraph') {
          sfx.emit('telegraph', { action: d.action });
          if (d.action === 'jump') this.fire('jump');
          if (d.action === 'invisible') this.fire('blinker');
          if (d.action === 'inflate') sfx.emit('squeak', {});
        }
        if (d.type === 'action' && d.action === 'jump') this.shake(2, 0.3);
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ Zeichnen

  private phase(): DayPhase { return (this.room.client.roundData?.tageszeit as DayPhase | null) ?? 'Tag'; }
  private weather(): ActiveWeather { return (this.room.client.roundData?.wetter as ActiveWeather | null) ?? 'Sonnig'; }

  private drawShadows(dt: number): void {
    const c = this.room.client;
    const since = Math.max(0, (c.now - c.shadowsAt) / 1000);
    const views: GameShadowView[] = c.shadows.map((s) => ({
      id: s.id, sizeClass: s.sizeClass as GameShadowView['sizeClass'], xM: s.xM + s.speedMs * since, depthM: s.depthM,
      dir: s.speedMs < 0 ? -1 : 1, known: s.known,
    }));
    const vis = this.gd.balancing.weather.shadowVisibility[this.weather()] ?? 1;
    this.fishLayer.updateShadows(dt, views, vis, false);
  }

  private draw(dt: number): void {
    const c = this.room.client;
    const o = c.own;
    const b = this.gd.balancing;
    const lo = c.loadout();
    const phase = this.phase();
    const weather = this.weather();
    const spotX = this.art.spielerplaetze[0]?.x ?? 0;
    this.castFlight = Math.min(1, this.castFlight + dt / VIEW.castFlightS);
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.shakeLeft === 0) this.shakeAmp = 0;
    const inWater = o.rod === 'Sinking' || o.rod === 'Waiting' || o.rod === 'Nibble' || o.rod === 'Bite';
    const castX = inWater || o.rod === 'Reeling' ? distanceToX(this.art, spotX, o.distanceM) : spotX;
    const baitY = depthToY(this.art, o.depthM);
    let bobber: BobberMode = 'dangle';
    if (inWater) bobber = this.castFlight < 1 ? 'flight' : o.rod === 'Bite' ? 'bite' : o.rod === 'Nibble' ? 'nibble' : 'idle';
    if (o.rod === 'Reeling' || o.rod === 'Caught') bobber = 'hidden';
    if (o.rod === 'Bite') this.marker = 'bite';
    if (this.marker === 'fake' && this.time.now > this.fakeUntil) this.marker = o.rod === 'Nibble' ? 'nibble' : 'none';
    if (!inWater) this.marker = 'none';

    const arc = 0.5;
    this.backdrop.update(dt, { scrollX: this.cam.x, viewW: this.layout.gameWidth, phase, arc, weather, events: c.roundData?.ereignisse ?? [] });
    const tip = this.angler.tip();
    const hooked = o.rod === 'Reeling' && o.drill ? { fish: this.silhouette, drill: o.drill, startX: this.hookedStart.x, startY: this.hookedStart.y } : null;
    const mouth = this.fishLayer.updateHooked(hooked, tip, dt);
    this.fishLayer.updateFeeding(null, this.backdrop.tintFor(phase, true));
    const bend = o.drill ? rodBendStage(o.drill.tension, 4) : o.rod === 'Bite' ? 2 : o.rod === 'Nibble' ? 1 : 0;
    this.angler.update({
      dt, bend, bobber, baitX: castX, baitY, fishMouth: mouth, flight: this.castFlight, shake: false,
      tint: this.backdrop.tintFor(phase, false), marker: this.marker,
      lineGlow: o.drill && o.drill.behavior === 'Hitzkopf' ? o.drill.heat / b.drill.behavior.Hitzkopf.breakAt : 0,
    });
    this.positionCamera(false);
    const windFrac = windShare(weather, lo.rod, this.worldId, b);
    this.hud.update(dt, {
      rodState: o.rod, castPower: o.castPower, perfectMin: perfectWindowMin(lo.rod, b), depthM: o.depthM,
      maxDepthM: Math.min(depthLimitM(lo.reel, this.world), this.world.maxTiefeM), lineTooShort: o.lineTooShort, drill: o.drill,
      redFrom: b.drill.zone.redFrom, heatBreakAt: b.drill.behavior.Hitzkopf.breakAt, snag: null,
      phase, weather, nextWeather: null, wind: windFrac > 0 ? (c.roundData?.wind ?? 1) : 0, worldIndex: this.world.index, keyHints: !this.coarse,
    });
  }

  private positionCamera(snap: boolean): void {
    if (!this.art || !this.room) return;
    const o = this.room.client.own;
    const spot = this.art.spielerplaetze[0] ?? { x: 0, y: this.art.oberflaecheY };
    let tx = spot.x;
    let ty = this.art.oberflaecheY;
    const inWater = o.rod === 'Sinking' || o.rod === 'Waiting' || o.rod === 'Nibble' || o.rod === 'Bite';
    if (inWater) {
      tx = distanceToX(this.art, spot.x, o.distanceM) * this.castFlight + spot.x * (1 - this.castFlight);
      ty = depthToY(this.art, o.depthM);
    }
    if (o.drill && o.rod === 'Reeling') {
      ty = this.hookedStart.y;
      const fishX = this.angler.tip().x + (this.hookedStart.x - this.angler.tip().x) * Math.min(1, o.drill.distance);
      tx = (fishX + spot.x) / 2;
    }
    let target = cameraView(this.art, this.layout.orientation, this.layout.gameWidth, this.layout.gameHeight, tx, ty);
    if (o.drill && o.rod === 'Reeling') {
      const keepX = spot.x - VIEW.anglerMarginPx;
      if (target.x > keepX) target = cameraView(this.art, this.layout.orientation, this.layout.gameWidth, this.layout.gameHeight, keepX + this.layout.gameWidth / 2, ty);
    }
    const k = snap ? 1 : VIEW.cameraLerp;
    this.cam.x = Math.round(this.cam.x + (target.x - this.cam.x) * k);
    this.cam.y = Math.round(this.cam.y + (target.y - this.cam.y) * k);
    if (Math.abs(target.x - this.cam.x) <= 1) this.cam.x = target.x;
    if (Math.abs(target.y - this.cam.y) <= 1) this.cam.y = target.y;
    const sh = this.shakeLeft > 0 ? (Math.floor(this.time.now / 40) % 2 === 0 ? this.shakeAmp : -this.shakeAmp) : 0;
    this.cameras.main.centerOn(this.cam.x + sh + this.layout.gameWidth / 2, this.cam.y + this.layout.gameHeight / 2);
  }

  // ------------------------------------------------------------------ Debug / Ende

  private makeDebug(): NetDebug {
    return {
      code: this.room.code, backend: this.room.backend, userId: this.room.userId, isHost: this.room.isHost, phase: '', round: 0,
      synced: false, rodState: '', channel: '', scores: {}, results: null, feed: 0, myCatches: 0, aborted: null,
      budget: { round: 0, roomSends: 0, sent: 0, received: 0, history: [], summary: '' },
      hooks: {
        ready: (on) => this.room.client.ready(on),
        leave: () => this.leave(null),
        emote: (id) => this.emote(id as EmoteId),
        setDuration: (s) => { this.room.host?.setSettings({ dauerS: s }); },
      },
    };
  }

  private updateDebug(): void {
    const c = this.room.client;
    const d = this.dbg;
    d.phase = c.round.phase;
    d.round = c.round.round;
    d.synced = c.synced;
    d.rodState = c.own.rod;
    d.channel = this.room.channelStatus;
    d.scores = Object.fromEntries((c.scores?.liste ?? []).map((x) => [x.spieler, x.punkte]));
    d.results = c.results ? c.results.plaetze.map((r) => ({ id: r.spieler, place: r.platz, points: r.punkte, coins: r.muenzen })) : null;
    d.feed = c.feed.length;
    d.myCatches = c.feed.filter((x) => x.spieler === c.id).length;
    const bud = this.room.budget;
    const cur = bud.current;
    d.budget = {
      round: cur.round, roomSends: bud.roomSends(cur), sent: cur.sent, received: cur.received,
      history: bud.history.map((h) => ({ round: h.round, roomSends: bud.roomSends(h), sent: h.sent, received: h.received })),
      summary: bud.summary(bud.history.at(-1) ?? cur),
    };
  }

  private teardown(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.ready = false;
    if (this.room && !this.room.closed) this.room.driven = false;
    const debug = this.registry.get('debug') as (DebugState & { net?: NetDebug }) | undefined;
    if (debug?.net && this.leaving && !debug.net.aborted) debug.net.aborted = 'verlassen';
  }
}
