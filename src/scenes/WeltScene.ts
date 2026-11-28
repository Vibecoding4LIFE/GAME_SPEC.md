// src/scenes/WeltScene.ts – spielbare Welt (B2 „Welt“): verbindet Spiellogik (src/game), Grafik (Atlanten, world_<k>.json)
// und UI (src/ui). Die Logik bestimmt alles; die Szene zeichnet nur und leitet Eingaben weiter.
import Phaser from 'phaser';
import { bus } from '../core/events';
import type { PixelLayout } from '../core/pixelScale';
import { Rng, hashSeed } from '../core/random';
import { createStore, type KeyValueStore } from '../core/storage';
import { loadBalancing } from '../data/balancing';
import { loadFishData, loadWorldDb } from '../data/db';
import { loadGear } from '../data/gear';
import type { FightBehavior, FishData, FishId, Weather, WorldId } from '../data/types';
import { perfectWindowMin, windShare } from '../game/cast';
import { phaseAt } from '../game/clock';
import { depthLimitM } from '../game/depth';
import { rodBendStage } from '../game/drill';
import type { Profile, Settings } from '../game/save';
import { newProfile } from '../game/save';
import { FishingSession, InputCollector, type SessionEvent, type SessionInput } from '../game/session';
import { createShadowSim, shadowViews, stepShadows, type ShadowSim } from '../game/shadows';
import { DAY_PHASES, type DayPhase, type GameData } from '../game/types';
import { t } from '../i18n';
import {
  Bucket, CatchCard, DebugMenu, Feedback, HudOverlay, Intro, Lexicon, TouchControls, createInput, enableFrameImages,
  spriteFromTexture, type BucketItem, type FeedbackKind, type InputController, type InputMode, type TextureLike,
} from '../ui';
import { sfx } from './welt/sfx';
import { CACHE, FIGURES_ATLAS, HUD_ATLAS, SCENES, fishAtlasKey, worldAtlasKey } from './keys';
import { applyPixelCamera } from './pixelCamera';
import { hudSubLayout, hudZoom } from './hudLayout';
import { VIEW } from './sceneConfig';
import { bottomDepthAt, cameraView, depthToY, distanceToX, type WorldSee } from './worldSee';
import { Angler, type BobberMode } from './welt/Angler';
import { createAtlasAnims, createFishAnims } from './welt/assets';
import { Autopilot } from './welt/autopilot';
import { Backdrop } from './welt/Backdrop';
import { FishLayer } from './welt/FishLayer';
import { Hud } from './welt/Hud';
import { loadSave, writeSave, SAVE_KEY } from './welt/saveStore';
import type { DebugState } from '../main';

/** Test-Sicht auf die Welt-Szene (window.__KK.welt) – keine Geheimnisse, nur Anzeige-Zustand und Debug-Hooks. */
export interface WeltDebug {
  rodState: string;
  phase: string;
  weather: string;
  tension: number;
  zone: { lo: number; hi: number } | null;
  behavior: string | null;
  /** Zugrichtung des Fisches (sichtbar über den Richtungspfeil), null wenn unsichtbar/kein Drill */
  pullDir: string | null;
  depthM: number;
  /** Hänger im Wasser (E W1) */
  snag: { count: number; needed: number } | null;
  catches: number;
  escapes: number;
  coins: number;
  lastCatch: { fishId: string; points: number; value: number; grade: string } | null;
  lastEscape: string | null;
  /** letzte Drill-Ereignisse (`telegraph:jump`, `action:sprint`, …) */
  drillLog: string[];
  hookedBehaviors: string[];
  catchCardOpen: boolean;
  introOpen: boolean;
  /** ausgelöste Rückmeldungen (Vibration bzw. Rand-Puls) je Art */
  feedback: Partial<Record<FeedbackKind, number>>;
  /** Bildschirm wackelt gerade */
  shaking: boolean;
  /** im Bild gezeigte Vorwarnung (z. B. 'jump') bzw. null */
  telegraph: string | null;
  /** Logik angehalten (Hook freezeAtTelegraph) */
  frozen: boolean;
  /** Eingabezustand (Modus der Knöpfe, Lenken −1…1, Kurbeln, Sinken) */
  input: { mode: string; steer: number; reeling: boolean; sinking: boolean };
  fps: number;
  /** Zoom der HUD-Kamera (Gerätepixel je HUD-Pixel) */
  hudZoom: number;
  /** mittlere Rechenzeit von update() in ms (gleitender Mittelwert) */
  updateMs: number;
  camera: { x: number; y: number };
  hooks: {
    forceFish(id: string | null): void;
    forceBehavior(b: string | null): void;
    forceShiny(on: boolean): void;
    /** Logik anhalten, sobald die Vorwarnung `action` ('jump', 'dive' …, 'heat' für Hitzkopf) sichtbar ist */
    freezeAtTelegraph(action: string | null): void;
    resume(): void;
    setWeather(w: string | null): void;
    setPhase(p: string): void;
    skipWait(): void;
    autopilot(on: boolean): void;
    closeCatchCard(): void;
    resetSave(): Promise<void>;
  };
}

const MODE_FOR: Record<string, InputMode> = {
  Idle: 'aim', Casting: 'aim', Sinking: 'wait', Waiting: 'wait', Nibble: 'bite', Bite: 'bite', Reeling: 'fight', Caught: 'menu', Escaped: 'aim',
};

export class WeltScene extends Phaser.Scene {
  private worldId: WorldId = 'W1';
  private gd!: GameData;
  private art!: WorldSee;
  private store!: KeyValueStore;
  private profile!: Profile;
  private settings: Settings = {};
  private session!: FishingSession;
  private ready = false;
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
  private autopilot: Autopilot | null = null;
  private shadows!: ShadowSim;
  private shadowRng!: Rng;
  private logicAcc = 0;
  private castFlight = 1;
  private cam = { x: 0, y: 0 };
  private marker: 'none' | 'nibble' | 'bite' | 'fake' = 'none';
  private hookedStart = { x: 0, y: 0 };
  private escapeTimer = 0;
  private autosave = 0;
  private dirty = false;
  private debugTime: DayPhase | null = null;
  private debugWeather: Weather | null = null;
  private dbg!: WeltDebug;
  // UI
  private hudOverlay!: HudOverlay;
  private catchCard!: CatchCard;
  private bucket!: Bucket;
  private lexicon!: Lexicon;
  private debugMenu!: DebugMenu;
  private touch!: TouchControls;
  private intro!: Intro;
  private feedback!: Feedback;
  private offs: (() => void)[] = [];
  /** Flanken aus Frames ohne Logikschritt (90/120-Hz-Displays) für den nächsten Schritt aufheben */
  private carry: Pick<SessionInput, 'reelPressed' | 'rodUp' | 'strike' | 'feed' | 'retrieve'> = { reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
  private shakeLeft = 0;
  /** Debug/QA: Spiellogik anhalten, sobald diese Vorwarnung (oder 'heat') sichtbar ist; Zeichnen läuft weiter */
  private freezeOn: string | null = null;
  private frozen = false;
  private shakeAmp = 0;
  private lastSfxS = 0;
  private coarse = false;

  constructor() {
    super(SCENES.welt);
  }

  init(d: { worldId?: WorldId }): void {
    this.worldId = d.worldId ?? 'W1';
    this.ready = false;
    this.offs = [];
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
    this.art = this.cache.json.get(CACHE.worldArt(w.kuerzel)) as WorldSee;
    document.body.style.setProperty('--rand', w.leitfarben[3] ?? '#12342f');

    for (const a of [worldAtlasKey(w.kuerzel), FIGURES_ATLAS, HUD_ATLAS]) createAtlasAnims(this, a);
    createFishAnims(this, fishAtlasKey(w.kuerzel));

    this.layout = this.registry.get('layout') as PixelLayout;
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    this.hudCam = this.cameras.add(0, 0, 1, 1, false, 'hud');
    this.cameras.main.ignore(this.hudLayer);
    this.hudCam.ignore(this.worldLayer);
    this.applyCameras();

    const base = import.meta.env.BASE_URL;
    enableFrameImages({ wood: `${base}assets/ui/frame_wood.png`, parchment: `${base}assets/ui/frame_parchment.png` });

    this.store = createStore();
    void loadSave(this.store, this.gd.gear).then(({ profile, settings, warning }) => {
      if (warning) console.warn(`Spielstand verworfen: ${warning}`);
      this.profile = profile;
      this.settings = settings;
      this.build();
    });
  }

  // ------------------------------------------------------------------ Aufbau

  private build(): void {
    const seed = hashSeed(`${Date.now()}`);
    const spotX = this.art.spielerplaetze[0]?.x ?? 0;
    this.session = new FishingSession(this.gd, this.profile, {
      world: this.worldId, seed,
      bottomDepthAt: (dM) => bottomDepthAt(this.art, distanceToX(this.art, spotX, dM)),
    });
    const lineColor = this.session.loadout().rod.lineColor;
    this.angler = new Angler(this, this.worldLayer, this.art, lineColor);
    this.shadowRng = new Rng(hashSeed(`${seed}:shadows`));
    this.shadows = createShadowSim();
    this.backdrop = new Backdrop(this, this.worldLayer, this.art, new Rng(hashSeed(`${seed}:deko`)));
    this.backdrop.create();
    this.fishLayer = new FishLayer(this, this.worldLayer, this.art, spotX);
    this.fishLayer.create();
    this.angler.create();
    this.hud = new Hud(this, this.hudLayer);
    this.hud.create();
    this.buildUi();
    this.relayoutHud();

    this.offs.push(bus.on('layout', (l) => {
      this.layout = l;
      this.applyCameras();
      this.relayoutHud();
    }));
    const onHide = () => { if (document.visibilityState === 'hidden') void this.save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    this.offs.push(() => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    this.dbg = this.makeDebug();
    const debug = this.registry.get('debug') as DebugState | undefined;
    if (debug) {
      debug.scene = 'welt';
      debug.welt = this.dbg;
      debug.ready = true;
    }
    this.ready = true;
  }

  private buildUi(): void {
    const overlay = document.getElementById('overlay') as HTMLElement;
    this.input2 = createInput();
    this.offs.push(this.input2.onAction((a) => this.collector.apply(a)));
    this.offs.push(() => this.input2.dispose());

    this.hudOverlay = new HudOverlay({
      onLexicon: () => this.openLexicon(),
      onBucket: () => this.openBucket(),
      onSettings: () => this.openDebug(),
    });
    this.catchCard = new CatchCard({
      onKeep: () => this.closeCatch(),
      onBucket: () => this.closeCatch(),
    });
    this.bucket = new Bucket({
      onSell: (uid) => { this.session.sell(uid); this.afterSale(); },
      onSellAll: () => { this.session.sellAll(); this.afterSale(); },
    });
    this.lexicon = new Lexicon({});
    this.debugMenu = new DebugMenu({
      onForceFish: (id) => { this.session.debugForceFish(id); this.refreshDebug(); },
      onForceBehavior: (b) => { this.session.debugForceBehavior(b); this.refreshDebug(); },
      onSetTime: (p) => { this.debugTime = p; if (p) this.session.debugSetPhase(p); this.refreshDebug(); },
      onSetWeather: (w) => {
        this.debugWeather = w;
        if (w && w !== 'Alle') this.session.debugSetWeather(w);
        else this.session.debugReleaseWeather();
        this.refreshDebug();
      },
      onResetSave: () => void this.resetSave(),
      onToggleFps: (on) => { this.settings.showFps = on; this.dirty = true; },
      onToggleVibration: (on) => { this.settings.vibration = on; this.feedback.set({ vibration: on }); this.dirty = true; },
      onToggleShake: (on) => { this.settings.shake = on; this.dirty = true; },
      onForceShiny: (on) => { this.session.debugForceShiny(on); this.refreshDebug(); },
      onShowIntro: () => void this.showIntro(),
    });
    this.touch = new TouchControls(this.input2);
    this.intro = new Intro();
    for (const c of [this.hudOverlay, this.catchCard, this.bucket, this.lexicon, this.debugMenu, this.touch, this.intro]) c.mount(overlay);
    this.feedback = new Feedback({ vibration: this.settings.vibration !== false }, overlay);
    this.offs.push(() => this.feedback.destroy());
    this.hudOverlay.show({ coins: this.profile.coins, bucketCount: this.profile.bucket.length });
    // Touch-Fläche verarbeitet Gesten selbst; Phaser bekommt keine Zeiger-Eingaben (es gibt keine Phaser-Bedienelemente).
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    // Sichtbare Knöpfe statt Gesten-Hinweisen; Gesten bleiben als zweiter Weg aktiv
    this.touch.show({ mode: 'aim', passThrough: false, showHints: false });
    this.offs.push(() => { for (const c of [this.hudOverlay, this.catchCard, this.bucket, this.lexicon, this.debugMenu, this.touch, this.intro]) c.destroy(); });
    if (!this.settings.introSeen) void this.showIntro();
  }

  /** Einmalige Einführung „So angelst du“ (Touch- oder Tastatur-Variante). */
  private async showIntro(): Promise<void> {
    await this.intro.show(this.coarse ? 'touch' : 'keys');
    this.settings.introSeen = true;
    this.dirty = true;
    void this.save();
  }

  /** HUD-Layout mit eigener, ganzzahliger Zoomstufe (QA M-3: lesbar auch bei Weltzoom 1 im Vorschau-Rahmen). */
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
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
    const cs = getComputedStyle(probe);
    const safe = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
    probe.remove();
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.hud.relayout(this.hudLayoutNow(), {
      keyHints: !coarse,
      dpr: window.devicePixelRatio || 1, safe, topBarCss: VIEW.hud.topBarCss,
      touchButtonCss: coarse ? (this.layout.orientation === 'portrait' ? VIEW.hud.touchButtonCssPortrait : VIEW.hud.touchButtonCss) : 0,
    });
  }

  // ------------------------------------------------------------------ Schleife

  update(_time: number, delta: number): void {
    if (!this.ready) return;
    const t0 = performance.now();
    // Echte Zeit statt geglättetem delta: Phaser deckelt delta ohne Fensterfokus auf 1/60 s, dann liefe die Spielzeit
    // (Anschlagfenster, Drill) langsamer als die Uhr. Ruckler bleiben über VIEW.maxFrameS begrenzt.
    const raw = this.game.loop.rawDelta;
    const frameS = Math.min(VIEW.maxFrameS, (raw > 0 ? raw : delta) / 1000);
    const taken = this.collector.take();
    // Flanken aus Frames ohne Logikschritt nicht verlieren (bei 90/120 Hz hat nicht jeder Frame einen 1/60-s-Schritt)
    const c = this.carry;
    const human: SessionInput = {
      ...taken, reelPressed: taken.reelPressed || c.reelPressed, rodUp: taken.rodUp || c.rodUp, strike: taken.strike || c.strike,
      feed: taken.feed || c.feed, retrieve: taken.retrieve || c.retrieve,
    };
    const s = this.session;
    this.logicAcc += frameS;
    let first = true;
    if (this.frozen) this.logicAcc = 0;
    while (this.logicAcc >= VIEW.logicStepS) {
      this.logicAcc -= VIEW.logicStepS;
      // Flanken (Tippen, Anschlag, Wisch, Einholen) gelten nur im ersten Teilschritt
      const input: SessionInput = this.autopilot ? this.autopilot.input(s)
        : first ? human : { ...human, reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
      first = false;
      for (const e of s.step(VIEW.logicStepS, input)) this.onEvent(e);
      const dr = s.state.drill;
      if (this.freezeOn && dr && ((dr.stage.kind === 'telegraph' && dr.stage.next === this.freezeOn)
        || (this.freezeOn === 'heat' && dr.heat >= this.gd.balancing.drill.behavior.Hitzkopf.breakAt / 2))) {
        this.frozen = true;
        this.logicAcc = 0;
        break;
      }
    }
    this.carry = first
      ? { reelPressed: human.reelPressed, rodUp: human.rodUp, strike: human.strike, feed: human.feed, retrieve: human.retrieve }
      : { reelPressed: false, rodUp: false, strike: false, feed: false, retrieve: false };
    this.continuousFeedback(frameS);
    this.syncInputMode();
    this.shadowStep(frameS);
    this.draw(frameS);

    if (s.state.rodState === 'Escaped' || (s.state.rodState === 'Caught' && s.state.lastCurio)) {
      this.escapeTimer += frameS;
      if (this.escapeTimer >= VIEW.bannerS) { this.escapeTimer = 0; s.acknowledge(); }
    } else this.escapeTimer = 0;

    this.autosave += frameS;
    if (this.dirty && this.autosave >= VIEW.autosaveS) void this.save();
    this.updateDebug();
    this.dbg.updateMs += (performance.now() - t0 - this.dbg.updateMs) / 30;
  }

  private syncInputMode(): void {
    const st = this.session.state;
    const mode = MODE_FOR[st.rodState] ?? 'aim';
    const d = st.drill;
    const rodUp = !!d && (d.pullDir === 'down' || (d.stage.kind === 'telegraph' && d.stage.next === 'dive'));
    const lo = this.session.loadout();
    const itemAvailable = lo.bait.createsFeedingSpot && (st.rodState === 'Waiting' || st.rodState === 'Sinking');
    if (this.input2.mode !== mode || this.lastTouch.rodUp !== rodUp || this.lastTouch.item !== itemAvailable) {
      this.lastTouch = { rodUp, item: itemAvailable };
      this.touch.update({ mode, rodUp, itemAvailable });
    }
  }

  private lastTouch = { rodUp: false, item: false };

  private fire(kind: FeedbackKind): void {
    this.feedback.fire(kind);
  }

  private shake(amp: number, s: number): void {
    if (this.settings.shake === false) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeLeft = Math.max(this.shakeLeft, s);
  }

  /** Dauer-Rückmeldungen: rote Spannung (gedrosselt), Schnur-Ton-Hook (10 Hz) */
  private continuousFeedback(dt: number): void {
    const d = this.session.state.drill;
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.shakeLeft === 0) this.shakeAmp = 0;
    if (!d || this.session.state.rodState !== 'Reeling') return;
    if (d.tension >= this.gd.balancing.drill.zone.redFrom) this.fire('red');
    this.lastSfxS += dt;
    if (this.lastSfxS >= VIEW.sfxTensionEveryS) {
      this.lastSfxS = 0;
      sfx.emit('lineTension', { tension: d.tension, reeling: this.input2.reeling });
    }
  }

  private shadowStep(dt: number): void {
    const lexicon = this.profile.lexicon;
    stepShadows(this.shadows, dt, { ...this.session.spawnContext(), forceFishId: null }, {
      max: VIEW.shadows.max, minXM: 0, maxXM: (this.art.groesse.w - (this.art.spielerplaetze[0]?.x ?? 0)) / this.art.pixelProMeter,
      speedMs: VIEW.shadows.speedMs, ttlS: VIEW.shadows.ttlS, spawnPerS: VIEW.shadows.spawnPerS,
    }, this.shadowRng);
    const vis = this.gd.balancing.weather.shadowVisibility[this.session.weather] ?? 1;
    const views = shadowViews(this.shadows, (id) => lexicon[id]?.state === 'caught');
    this.fishLayer.updateShadows(dt, views, vis, false);
  }

  private onEvent(e: SessionEvent): void {
    const s = this.session;
    switch (e.type) {
      case 'cast':
        this.castFlight = 0;
        sfx.emit('cast', { perfect: e.result.perfect });
        if (e.result.perfect) { this.hud.say(t('scene.perfectCast')); sfx.emit('pling', {}); }
        break;
      case 'bite':
        if (e.e.type === 'nibble' || e.e.type === 'approach') this.marker = e.e.type === 'nibble' ? 'nibble' : this.marker;
        if (e.e.type === 'nibble') { this.fire('nibble'); sfx.emit('nibble', {}); }
        if (e.e.type === 'fakeBite') { this.marker = 'fake'; this.fire('fake'); sfx.emit('fakeBite', {}); }
        if (e.e.type === 'bite') { this.marker = 'bite'; this.fire('bite'); this.shake(2, 0.25); sfx.emit('bite', {}); }
        break;
      case 'scared': this.marker = 'none'; this.hud.say(t('scene.scared'), VIEW.colors.warn); break;
      case 'hooked': {
        this.marker = 'none';
        const spotX = this.art.spielerplaetze[0]?.x ?? 0;
        this.hookedStart = { x: distanceToX(this.art, spotX, s.state.cast?.distanceM ?? 0), y: depthToY(this.art, s.state.baitDepthM) };
        this.dbg.hookedBehaviors.push(e.behavior);
        this.dbg.drillLog = [];
        break;
      }
      case 'drill': {
        const d = e.e;
        const name = d.type === 'telegraph' || d.type === 'action' ? `${d.type}:${d.action}` : d.type;
        this.dbg.drillLog.push(name);
        if (this.dbg.drillLog.length > 300) this.dbg.drillLog.shift();
        if (d.type === 'beginnerSave') this.hud.say(t('scene.beginnerSave'));
        if (d.type === 'netSave') this.hud.say(t('scene.netSave'));
        if (d.type === 'snag') this.hud.say(t('scene.snagDrillStart'), VIEW.colors.warn);
        if (d.type === 'telegraph' && d.action === 'jump') { this.fire('jump'); sfx.emit('telegraph', { action: d.action }); }
        else if (d.type === 'telegraph') sfx.emit('telegraph', { action: d.action });
        if (d.type === 'action' && d.action === 'jump') this.shake(2, 0.3);
        if (d.type === 'telegraph' && d.action === 'invisible') this.fire('blinker'); // „nach Vibration und Ton spielen“ (D 1.7)
        if (d.type === 'telegraph' && d.action === 'inflate') sfx.emit('squeak', {}); // „Quietsch-Sound“ (D 1.7)
        if (d.type === 'snag') this.fire('snag');
        break;
      }
      case 'caught':
        this.fire('catch');
        sfx.emit('catch', { shiny: e.record.shiny });
        this.showCatch(e.record.uid, e.fish, e.levelUp);
        break;
      case 'curio':
        this.hud.say(t('scene.curio', { name: t(e.curio.nameKey), coins: e.coins }));
        this.markDirty();
        break;
      case 'escaped':
        this.marker = 'none';
        if (e.reason === 'lineBreak' || e.reason === 'heatBreak' || e.reason === 'cut') { this.fire('lineBreak'); sfx.emit('lineBreak', {}); }
        this.hud.say(t(`scene.escaped.${e.reason}`), VIEW.colors.warn);
        this.markDirty();
        break;
      case 'snagged': this.hud.say(t('scene.snagStart'), VIEW.colors.warn); break;
      case 'snagFreed': this.hud.say(t('scene.snagFreed')); break;
      case 'baitLost': this.hud.say(t('scene.baitLost'), VIEW.colors.warn); this.markDirty(); break;
      case 'feed': this.hud.say(t('scene.feed')); this.markDirty(); break;
      case 'retrieved': this.marker = 'none'; this.hud.say(t('scene.retrieved')); break;
      case 'rodState':
        if (e.state === 'Waiting' || e.state === 'Idle' || e.state === 'Sinking') { if (this.marker !== 'none' && e.state !== 'Waiting') this.marker = 'none'; }
        if (e.state === 'Idle') this.marker = 'none';
        break;
      case 'clock':
        if (e.e.type === 'lightning') {
          this.backdrop.lightning(this.cam.x, this.layout.gameWidth);
          this.fishLayer.revealFor(e.e.revealS);
        }
        if (e.e.type === 'eventStart') this.hud.say(t(`event.${e.e.evt}`));
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ Zeichnen

  private draw(dt: number): void {
    const s = this.session;
    const st = s.state;
    const b = this.gd.balancing;
    const phase = s.phase;
    const lo = s.loadout();
    const spotX = this.art.spielerplaetze[0]?.x ?? 0;
    this.castFlight = Math.min(1, this.castFlight + dt / VIEW.castFlightS);

    const castX = st.cast ? distanceToX(this.art, spotX, st.cast.distanceM) : spotX;
    const baitY = depthToY(this.art, st.baitDepthM);
    const inWater = ['Sinking', 'Waiting', 'Nibble', 'Bite'].includes(st.rodState);
    let bobber: BobberMode = 'dangle';
    if (inWater) bobber = this.castFlight < 1 ? 'flight' : st.rodState === 'Bite' ? 'bite' : st.rodState === 'Nibble' ? 'nibble' : 'idle';
    if (st.rodState === 'Reeling' || st.rodState === 'Caught') bobber = 'hidden';
    if (st.rodState === 'Bite' && this.marker !== 'bite') this.marker = 'bite';
    if (st.rodState === 'Nibble' && this.marker === 'fake' && !s.fakeBiteVisible) this.marker = 'nibble';
    if (!inWater) this.marker = 'none';

    const dayFrac = (s.clock.dayTimeS % b.time.dayLengthS) / b.time.dayLengthS;
    const nightStart = (DAY_PHASES.indexOf('Nacht') * b.time.phaseLengthS) / b.time.dayLengthS;
    const arc = phase === 'Nacht' ? (dayFrac - nightStart) / (1 - nightStart) : dayFrac / nightStart;
    this.backdrop.update(dt, { scrollX: this.cam.x, viewW: this.layout.gameWidth, phase, arc, weather: s.weather, events: s.events });

    const tipBefore = this.angler.tip();
    const hooked = st.rodState === 'Reeling' && st.drill && st.hooked ? { fish: st.hooked.fish, drill: st.drill, startX: this.hookedStart.x, startY: this.hookedStart.y } : null;
    const mouth = this.fishLayer.updateHooked(hooked, tipBefore, dt);
    this.fishLayer.updateFeeding(st.feedingSpot ? { x: distanceToX(this.art, spotX, st.feedingSpot.distanceM) } : null, this.backdrop.tintFor(phase, true));
    const bend = st.drill ? rodBendStage(st.drill.tension, 4) : st.rodState === 'Bite' ? 2 : st.rodState === 'Nibble' ? 1 : 0;
    this.angler.update({
      dt, bend, bobber, baitX: castX, baitY, fishMouth: mouth, flight: this.castFlight, shake: !!st.snag,
      tint: this.backdrop.tintFor(phase, false), marker: this.marker,
      lineGlow: st.drill && st.drill.behavior === 'Hitzkopf' ? st.drill.heat / b.drill.behavior.Hitzkopf.breakAt : 0,
    });

    this.positionCamera(false);

    const next = s.clock.forecast[0];
    const windFrac = windShare(s.weather, lo.rod, this.worldId, b);
    this.hud.update(dt, {
      rodState: st.rodState, castPower: st.castPower, perfectMin: perfectWindowMin(lo.rod, b), depthM: st.baitDepthM,
      maxDepthM: Math.min(depthLimitM(lo.reel, s.world), s.world.maxTiefeM), lineTooShort: st.lineTooShort, drill: st.drill,
      redFrom: b.drill.zone.redFrom, heatBreakAt: b.drill.behavior.Hitzkopf.breakAt, snag: st.snag,
      phase, weather: s.weather, nextWeather: next && next.weather !== s.weather ? next.weather : null,
      wind: windFrac > 0 ? s.clock.windDir : 0, worldIndex: s.world.index, keyHints: !this.coarse,
    });
    if (st.snag) this.hud.showSnag(st.snag);
  }

  private positionCamera(snap: boolean): void {
    if (!this.session || !this.art) return;
    const st = this.session.state;
    const spot = this.art.spielerplaetze[0] ?? { x: 0, y: this.art.oberflaecheY };
    let tx = spot.x;
    let ty = this.art.oberflaecheY;
    if (st.cast) {
      tx = distanceToX(this.art, spot.x, st.cast.distanceM) * this.castFlight + spot.x * (1 - this.castFlight);
      ty = depthToY(this.art, st.baitDepthM);
    }
    if (st.drill) {
      ty = this.hookedStart.y;
      // Im Drill Angler und Rute im Bild halten (Rutenbiegung = Rückmeldung zur Spannung): Mitte zwischen Fisch und Angler
      const fishX = this.angler.tip().x + (this.hookedStart.x - this.angler.tip().x) * Math.min(1, st.drill.distance);
      tx = (fishX + spot.x) / 2;
    }
    let target = cameraView(this.art, this.layout.orientation, this.layout.gameWidth, this.layout.gameHeight, tx, ty);
    if (st.drill) {
      const keepX = spot.x - VIEW.anglerMarginPx;
      if (target.x > keepX) target = cameraView(this.art, this.layout.orientation, this.layout.gameWidth, this.layout.gameHeight, keepX + this.layout.gameWidth / 2, ty);
    }
    const k = snap ? 1 : VIEW.cameraLerp;
    this.cam.x = Math.round(this.cam.x + (target.x - this.cam.x) * k);
    this.cam.y = Math.round(this.cam.y + (target.y - this.cam.y) * k);
    if (Math.abs(target.x - this.cam.x) <= 1) this.cam.x = target.x;
    if (Math.abs(target.y - this.cam.y) <= 1) this.cam.y = target.y;
    // Wackeln: ganze Pixel, abwechselnd links/rechts (abschaltbar)
    const sh = this.shakeLeft > 0 ? (Math.floor(this.time.now / 40) % 2 === 0 ? this.shakeAmp : -this.shakeAmp) : 0;
    this.cameras.main.centerOn(this.cam.x + sh + this.layout.gameWidth / 2, this.cam.y + this.layout.gameHeight / 2);
  }

  // ------------------------------------------------------------------ UI

  private sprite(fish: FishData) {
    return spriteFromTexture(this.textures.get(fish.atlasKey) as unknown as TextureLike, fish.catchSprite);
  }

  private fishById(id: FishId): FishData | undefined {
    return this.gd.fish.find((f) => f.id === id);
  }

  private showCatch(uid: string, fish: FishData, levelUp: boolean): void {
    const rec = this.profile.bucket.find((c) => c.uid === uid);
    if (!rec) return;
    if (rec.masterDrill) this.hud.say(t('scene.masterDrill'));
    if (levelUp) this.hud.say(t('scene.levelUp', { level: this.session.level }));
    this.catchCard.show({
      fish, lengthCm: rec.lengthCm, weightG: rec.weightG, tier: rec.grade, shiny: rec.shiny,
      isNew: rec.isNew, isRecord: rec.isRecord, points: rec.points, sprite: this.sprite(fish), keepDisabled: true,
    });
    this.hudOverlay.update({ coins: this.profile.coins, bucketCount: this.profile.bucket.length });
    this.markDirty();
    void this.save();
  }

  private closeCatch(): void {
    this.session.acknowledge();
    this.hudOverlay.update({ coins: this.profile.coins, bucketCount: this.profile.bucket.length });
  }

  private bucketItems(): BucketItem[] {
    return this.profile.bucket.flatMap((c) => {
      const fish = this.fishById(c.fishId);
      return fish ? [{ uid: c.uid, fish, lengthCm: c.lengthCm, weightG: c.weightG, tier: c.grade, shiny: c.shiny, value: c.value, sprite: this.sprite(fish) }] : [];
    });
  }

  private openBucket(): void {
    this.bucket.show({ items: this.bucketItems(), coins: this.profile.coins });
  }

  private afterSale(): void {
    this.bucket.update({ items: this.bucketItems(), coins: this.profile.coins });
    this.hudOverlay.update({ coins: this.profile.coins, bucketCount: this.profile.bucket.length });
    this.markDirty();
    void this.save();
  }

  private openLexicon(): void {
    this.lexicon.show({
      worldIndex: this.session.world.index, fish: this.session.worldFish, entries: this.profile.lexicon,
      getSprite: (f) => this.sprite(f),
    });
  }

  private debugData() {
    return {
      fish: this.session.worldFish, worldIndex: this.session.world.index,
      weathers: this.session.world.wetter.map((x) => x.wetter),
      forcedFish: this.session.state.debug.forceFish, forcedBehavior: this.session.state.debug.forceBehavior,
      time: this.debugTime, weather: this.debugWeather, showFps: !!this.settings.showFps,
      vibration: this.settings.vibration !== false, shake: this.settings.shake !== false, forceShiny: this.session.state.debug.forceShiny,
    };
  }

  private openDebug(): void { this.debugMenu.show(this.debugData()); }
  private refreshDebug(): void { if (this.debugMenu.visible) this.debugMenu.update(this.debugData()); }

  private markDirty(): void { this.dirty = true; }

  private async save(): Promise<void> {
    if (!this.profile) return;
    this.autosave = 0;
    this.dirty = false;
    await writeSave(this.store, this.profile, this.settings);
  }

  private async resetSave(): Promise<void> {
    await this.store.remove(SAVE_KEY);
    this.profile = newProfile(this.gd.gear);
    await writeSave(this.store, this.profile, this.settings);
    this.scene.restart({ worldId: this.worldId });
  }

  private teardown(): void {
    void this.save();
    for (const off of this.offs) off();
    this.offs = [];
    this.ready = false;
  }

  // ------------------------------------------------------------------ Test-Hooks

  private makeDebug(): WeltDebug {
    return {
      rodState: 'Idle', phase: '', weather: '', tension: 0, zone: null, behavior: null, pullDir: null, depthM: 0, snag: null, catches: 0, escapes: 0, coins: 0,
      lastCatch: null, lastEscape: null, drillLog: [], hookedBehaviors: [], catchCardOpen: false, introOpen: false, feedback: {}, shaking: false, telegraph: null, frozen: false, input: { mode: 'menu', steer: 0, reeling: false, sinking: false }, fps: 0, hudZoom: 1, updateMs: 0, camera: { x: 0, y: 0 },
      hooks: {
        forceFish: (id) => this.session.debugForceFish(id as FishId | null),
        forceBehavior: (b) => this.session.debugForceBehavior(b as FightBehavior | null),
        forceShiny: (on) => this.session.debugForceShiny(on),
        freezeAtTelegraph: (a) => { this.freezeOn = a; if (!a) this.frozen = false; },
        resume: () => { this.frozen = false; }, // Ziel bleibt gesetzt (freezeAtTelegraph(null) löscht es)
        setWeather: (w) => (w ? this.session.debugSetWeather(w as never) : this.session.debugReleaseWeather()),
        setPhase: (p) => this.session.debugSetPhase(p as DayPhase),
        skipWait: () => this.session.debugSkipWait(),
        autopilot: (on) => { this.autopilot = on ? new Autopilot() : null; },
        closeCatchCard: () => { if (this.catchCard.visible) this.catchCard.hide(); this.closeCatch(); },
        resetSave: () => this.resetSave(),
      },
    };
  }

  private updateDebug(): void {
    const s = this.session;
    const st = s.state;
    const d = this.dbg;
    d.rodState = st.rodState;
    d.phase = phaseAt(s.clock.dayTimeS, this.gd.balancing);
    d.weather = s.weather;
    d.tension = st.drill?.tension ?? 0;
    d.zone = st.drill ? { ...st.drill.zone } : null;
    d.behavior = st.drill?.behavior ?? null;
    d.pullDir = st.drill && !st.drill.invisible ? st.drill.pullDir : null;
    d.depthM = st.baitDepthM;
    d.snag = st.snag ? { count: st.snag.count, needed: st.snag.needed } : null;
    d.catches = st.stats.catches;
    d.escapes = st.stats.escapes;
    d.coins = this.profile.coins;
    d.lastCatch = st.lastCatch ? { fishId: st.lastCatch.fishId, points: st.lastCatch.points, value: st.lastCatch.value, grade: st.lastCatch.grade } : null;
    d.lastEscape = st.lastEscape?.reason ?? null;
    d.catchCardOpen = this.catchCard.visible;
    d.introOpen = this.intro.visible;
    d.feedback = { ...this.feedback.counts };
    d.shaking = this.shakeLeft > 0;
    d.telegraph = this.fishLayer.telegraphShown ?? (st.drill?.behavior === 'Hitzkopf' && st.drill.heat > 0 ? 'heat' : null);
    d.frozen = this.frozen;
    d.input = { mode: this.input2.mode, steer: this.input2.steer, reeling: this.input2.reeling, sinking: this.input2.sinking };
    d.fps = Math.round(this.game.loop.actualFps);
    d.hudZoom = this.hudCam.zoom;
    d.camera = { ...this.cam };
  }
}

