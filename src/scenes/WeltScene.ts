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
  Bucket, CatchCard, DebugMenu, HudOverlay, Lexicon, TouchControls, createInput, enableFrameImages, spriteFromTexture,
  type BucketItem, type InputController, type InputMode, type TextureLike,
} from '../ui';
import { CACHE, FIGURES_ATLAS, HUD_ATLAS, SCENES, fishAtlasKey, worldAtlasKey } from './keys';
import { applyPixelCamera } from './pixelCamera';
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
  fps: number;
  /** mittlere Rechenzeit von update() in ms (gleitender Mittelwert) */
  updateMs: number;
  camera: { x: number; y: number };
  hooks: {
    forceFish(id: string | null): void;
    forceBehavior(b: string | null): void;
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
  private offs: (() => void)[] = [];

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
    });
    this.touch = new TouchControls(this.input2);
    for (const c of [this.hudOverlay, this.catchCard, this.bucket, this.lexicon, this.debugMenu, this.touch]) c.mount(overlay);
    this.hudOverlay.show({ coins: this.profile.coins, bucketCount: this.profile.bucket.length });
    // Touch-Fläche verarbeitet Gesten selbst; Phaser bekommt keine Zeiger-Eingaben (es gibt keine Phaser-Bedienelemente).
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.touch.show({ mode: 'aim', passThrough: false, showHints: coarse && !this.settings.touchHintsSeen });
    if (coarse && !this.settings.touchHintsSeen) { this.settings.touchHintsSeen = true; this.dirty = true; }
    this.offs.push(() => { for (const c of [this.hudOverlay, this.catchCard, this.bucket, this.lexicon, this.debugMenu, this.touch]) c.destroy(); });
  }

  private applyCameras(): void {
    applyPixelCamera(this.cameras.main, this.layout);
    applyPixelCamera(this.hudCam, this.layout);
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
    this.hud.relayout(this.layout, {
      dpr: window.devicePixelRatio || 1, safe, topBarCss: VIEW.hud.topBarCss, touchButtonCss: coarse ? VIEW.hud.touchButtonCss : 0,
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
    const human = this.collector.take();
    const s = this.session;
    this.logicAcc += frameS;
    let first = true;
    while (this.logicAcc >= VIEW.logicStepS) {
      this.logicAcc -= VIEW.logicStepS;
      // Flanken (Tippen, Anschlag, Wisch) gelten nur im ersten Teilschritt eines Frames
      const input: SessionInput = this.autopilot ? this.autopilot.input(s)
        : first ? human : { ...human, reelPressed: false, rodUp: false, strike: false, feed: false };
      first = false;
      for (const e of s.step(VIEW.logicStepS, input)) this.onEvent(e);
    }
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
    const mode = MODE_FOR[this.session.state.rodState] ?? 'aim';
    if (this.input2.mode !== mode) this.touch.update({ mode });
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
        if (e.result.perfect) this.hud.say(t('scene.perfectCast'));
        break;
      case 'bite':
        if (e.e.type === 'nibble' || e.e.type === 'approach') this.marker = e.e.type === 'nibble' ? 'nibble' : this.marker;
        if (e.e.type === 'fakeBite') this.marker = 'fake';
        if (e.e.type === 'bite') { this.marker = 'bite'; navigator.vibrate?.(60); }
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
        if (d.type === 'telegraph' && d.action === 'jump') navigator.vibrate?.(30);
        break;
      }
      case 'caught': this.showCatch(e.record.uid, e.fish, e.levelUp); break;
      case 'curio':
        this.hud.say(t('scene.curio', { name: t(e.curio.nameKey), coins: e.coins }));
        this.markDirty();
        break;
      case 'escaped':
        this.marker = 'none';
        this.hud.say(t(`scene.escaped.${e.reason}`), VIEW.colors.warn);
        this.markDirty();
        break;
      case 'snagged': this.hud.say(t('scene.snagStart'), VIEW.colors.warn); break;
      case 'snagFreed': this.hud.say(t('scene.snagFreed')); break;
      case 'baitLost': this.hud.say(t('scene.baitLost'), VIEW.colors.warn); this.markDirty(); break;
      case 'feed': this.hud.say(t('scene.feed')); this.markDirty(); break;
      case 'retrieved': this.marker = 'none'; break;
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
    const mouth = this.fishLayer.updateHooked(hooked, tipBefore);
    this.fishLayer.updateFeeding(st.feedingSpot ? { x: distanceToX(this.art, spotX, st.feedingSpot.distanceM) } : null, this.backdrop.tintFor(phase, true));
    const bend = st.drill ? rodBendStage(st.drill.tension, 4) : st.rodState === 'Bite' ? 2 : st.rodState === 'Nibble' ? 1 : 0;
    this.angler.update({
      dt, bend, bobber, baitX: castX, baitY, fishMouth: mouth, flight: this.castFlight, shake: !!st.snag,
      tint: this.backdrop.tintFor(phase, false), marker: this.marker,
    });

    this.positionCamera(false);

    const next = s.clock.forecast[0];
    const windFrac = windShare(s.weather, lo.rod, this.worldId, b);
    this.hud.update(dt, {
      rodState: st.rodState, castPower: st.castPower, perfectMin: perfectWindowMin(lo.rod, b), depthM: st.baitDepthM,
      maxDepthM: Math.min(depthLimitM(lo.reel, s.world), s.world.maxTiefeM), lineTooShort: st.lineTooShort, drill: st.drill,
      redFrom: b.drill.zone.redFrom, heatBreakAt: b.drill.behavior.Hitzkopf.breakAt, snag: st.snag,
      phase, weather: s.weather, nextWeather: next && next.weather !== s.weather ? next.weather : null,
      wind: windFrac > 0 ? s.clock.windDir : 0, worldIndex: s.world.index,
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
    if (st.drill) ty = this.hookedStart.y;
    const target = cameraView(this.art, this.layout.orientation, this.layout.gameWidth, this.layout.gameHeight, tx, ty);
    const k = snap ? 1 : VIEW.cameraLerp;
    this.cam.x = Math.round(this.cam.x + (target.x - this.cam.x) * k);
    this.cam.y = Math.round(this.cam.y + (target.y - this.cam.y) * k);
    if (Math.abs(target.x - this.cam.x) <= 1) this.cam.x = target.x;
    if (Math.abs(target.y - this.cam.y) <= 1) this.cam.y = target.y;
    this.cameras.main.centerOn(this.cam.x + this.layout.gameWidth / 2, this.cam.y + this.layout.gameHeight / 2);
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
      lastCatch: null, lastEscape: null, drillLog: [], hookedBehaviors: [], catchCardOpen: false, fps: 0, updateMs: 0, camera: { x: 0, y: 0 },
      hooks: {
        forceFish: (id) => this.session.debugForceFish(id as FishId | null),
        forceBehavior: (b) => this.session.debugForceBehavior(b as FightBehavior | null),
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
    d.fps = Math.round(this.game.loop.actualFps);
    d.camera = { ...this.cam };
  }
}

