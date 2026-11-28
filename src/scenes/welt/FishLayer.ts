// Fisch-Schatten (Objekt-Pool, max. VIEW.shadows.max), gehakter Fisch im Drill (dunkle Silhouette, zappelnd),
// Krümelwolke des Futterplatzes. Arten bleiben geheim: Schatten sind generische Formen je Größenklasse.
import Phaser from 'phaser';
import { CANVAS_BY_SIZE, SIZE_CLASSES, type FishData, type SizeClass } from '../../data/types';
import type { DrillState } from '../../game/drill';
import type { ShadowView } from '../../game/shadows';
import { HUD_ATLAS, worldAtlasKey } from '../keys';
import { VIEW } from '../sceneConfig';
import { depthToY, distanceToX, hexToInt, seabedY, type WorldSee } from '../worldSee';
import { pin, type Pt } from './assets';

const shadowKey = (c: SizeClass) => `shadow_${c}`;

/** Erzeugt pro Größenklasse eine harte Pixel-Silhouette (Ellipse + Schwanz), binäres Alpha. */
function makeShadowTextures(scene: Phaser.Scene, color: string): void {
  for (const c of SIZE_CLASSES) {
    const key = shadowKey(c);
    if (scene.textures.exists(key)) continue;
    const { w: cw, h: ch } = CANVAS_BY_SIZE[c];
    const w = Math.max(8, Math.round(cw * 3 / 4));
    const h = Math.max(4, Math.round(ch / 2));
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    const bodyW = Math.round(w * 3 / 4);
    const rx = bodyW / 2;
    const ry = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inBody = ((x + 0.5 - (w - rx)) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2 <= 1;
        const tailX = w - bodyW;
        const inTail = x < tailX && Math.abs(y + 0.5 - ry) <= (ry * (tailX - x)) / Math.max(1, tailX);
        if (inBody || inTail) ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
  }
}

export interface HookedView { fish: FishData; drill: DrillState; startX: number; startY: number }

interface Bubble { sprite: Phaser.GameObjects.Sprite; life: number; vy: number }

/**
 * Vorwarnungen (Telegraph) aus D 1.7 als Bild, alle auf ganzen Pixeln:
 * Zappler Schatten zittert · Sprinter Schatten dreht sich + Wasserstreifen · Taucher Blasen steigen auf ·
 * Springer Wasser wölbt sich, Schatten steigt · Trickser einzelnes Flossenzucken · Versteckspieler Schatten steuert
 * auf Deckung zu, Deckung blinkt · Aufbläher Fisch wird rund · Stromer blaue Funken · Blinker wird durchsichtig.
 * (Zickzack „Pfeil blinkt“, Stromer „Balken flackert“ und Hitzkopf „Schnur glüht“ zeichnen HUD bzw. Angler.)
 */
export class FishLayer {
  private pool: { sprite: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image }[] = [];
  private hooked!: Phaser.GameObjects.Sprite;
  private hookedKey = '';
  private crumbs!: Phaser.GameObjects.Sprite;
  private fx!: Phaser.GameObjects.Graphics;
  private bubbles: Bubble[] = [];
  private bubbleAcc = 0;
  private reveal = 0;
  private lastFace: 'left' | 'right' = 'left';
  private coverOffset = 0;
  /** aktuell sichtbare Vorwarnung (für Tests/QA) */
  telegraphShown: string | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer, private readonly art: WorldSee, private readonly originX: number) {}

  create(): void {
    makeShadowTextures(this.scene, VIEW.colors.shadow);
    const d = this.art.tiefenOrdnung.fische ?? 20;
    for (let i = 0; i < VIEW.shadows.max; i++) {
      const sprite = pin(this.scene.add.image(0, 0, shadowKey('S'))).setDepth(d).setVisible(false);
      const icon = pin(this.scene.add.image(0, 0, HUD_ATLAS, 'hud_icon_fisch_still_0'), 1 / 2, 1).setDepth(d).setVisible(false);
      this.layer.add([sprite, icon]);
      this.pool.push({ sprite, icon });
    }
    this.hooked = pin(this.scene.add.sprite(0, 0, HUD_ATLAS, 'hud_icon_fisch_still_0')).setDepth(d + 1).setVisible(false);
    this.crumbs = this.scene.add.sprite(0, 0, worldAtlasKey(this.art.kuerzel), `${this.art.futterplatz.anim}_0`).setDepth(d - 1).setVisible(false);
    pin(this.crumbs);
    if (this.scene.anims.exists(this.art.futterplatz.anim)) this.crumbs.play(this.art.futterplatz.anim);
    this.fx = this.scene.add.graphics().setDepth(d + 2);
    for (let i = 0; i < VIEW.telegraph.bubbles; i++) {
      const b = pin(this.scene.add.sprite(0, 0, worldAtlasKey(this.art.kuerzel), 'see_blase_m_wobble_0')).setDepth(d + 2).setVisible(false);
      if (this.scene.anims.exists('see_blase_m_wobble')) b.play({ key: 'see_blase_m_wobble', startFrame: i % 4 });
      this.bubbles.push({ sprite: b, life: 0, vy: 0 });
      this.layer.add(b);
    }
    this.layer.add([this.hooked, this.crumbs, this.fx]);
  }

  /** Blitz enthüllt alle Schatten für `s` Sekunden (D 1.9). */
  revealFor(s: number): void { this.reveal = Math.max(this.reveal, s); }

  updateShadows(dt: number, views: readonly ShadowView[], visibility: number, hideAll: boolean): void {
    this.reveal = Math.max(0, this.reveal - dt);
    const alpha = this.reveal > 0 ? 1 : VIEW.shadows.alpha * visibility;
    this.pool.forEach((p, i) => {
      const v = views[i];
      const on = !!v && !hideAll && alpha > 0;
      p.sprite.setVisible(on);
      p.icon.setVisible(on && !!v?.known);
      if (!v || !on) return;
      const x = Math.round(distanceToX(this.art, this.originX, v.xM));
      const y = Math.round(depthToY(this.art, v.depthM));
      pin(p.sprite.setTexture(shadowKey(v.sizeClass))).setPosition(x, y).setFlipX(v.dir < 0).setAlpha(alpha);
      p.icon.setPosition(x, y - Math.round(p.sprite.height / 2) - 1).setAlpha(alpha);
    });
  }

  /** Nächste Deckung (Seerosen, Kraut, Wurzelstock) zur Fischposition. */
  private nearestCover(x: number, y: number) {
    let best = this.art.deckung[0];
    let bestD = Infinity;
    for (const c of this.art.deckung) {
      const d = Math.abs(c.x + c.w / 2 - x) + Math.abs(c.y + c.h / 2 - y) / 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /** Gehakter Fisch: zwischen Wurfstelle (Distanz 1) und Boot/Steg (0), mit Vorwarnungen. Liefert das Maul. */
  updateHooked(h: HookedView | null, rodTip: Pt, dt: number): Pt | null {
    this.fx.clear();
    this.telegraphShown = null;
    if (!h) {
      this.hooked.setVisible(false);
      this.hookedKey = '';
      this.coverOffset = 0;
      for (const b of this.bubbles) b.sprite.setVisible(false);
      return null;
    }
    const d = h.drill;
    const T = VIEW.telegraph;
    const now = this.scene.time.now;
    const f = Math.max(0, Math.min(1.5, d.distance));
    const surf = this.art.oberflaecheY;
    let x = rodTip.x + (h.startX - rodTip.x) * f;
    let y = surf + (h.startY - surf) * Math.min(1, f);
    const st = d.stage;
    const tele = st.kind === 'telegraph' ? st.next ?? null : null;
    const prog = st.total > 0 && Number.isFinite(st.total) ? Math.min(1, Math.max(0, 1 - st.left / st.total)) : 0;
    if (st.kind === 'dive') y += (h.startY - surf) * T.diveDepthShare;
    if (st.kind === 'jump') y = surf - VIEW.jumpPx;
    const key = `${h.fish.assetKey}_struggle`;
    if (this.hookedKey !== key) {
      this.hookedKey = key;
      pin(this.hooked.setTexture(h.fish.atlasKey, `${h.fish.assetKey}_struggle_0`));
      if (this.scene.anims.exists(key)) this.hooked.play(key);
      // Art bleibt bis zum Fang verborgen: dunkle Silhouette
      this.hooked.setTint(hexToInt(VIEW.colors.shadow)).setTintMode(Phaser.TintModes.FILL);
    }
    const halfH = Math.round(this.hooked.height / 2);
    let face: 'left' | 'right' = d.pullDir === 'right' ? 'right' : d.pullDir === 'left' ? 'left' : this.lastFace;
    let scaleY = 1;
    let alpha = d.invisible ? d.visibility : 1;

    // Versteckspieler: zur Deckung hin ziehen (Vorwarnung + Aktion), Deckung blinkt
    const cover = this.nearestCover(x, y);
    const toCover = tele === 'cover' || st.kind === 'cover';
    const coverTarget = cover ? cover.x + cover.w / 2 - x : 0;
    const want = toCover ? Math.sign(coverTarget) * Math.min(Math.abs(coverTarget), T.coverPullPx) : 0;
    this.coverOffset += (want - this.coverOffset) * Math.min(1, dt * T.coverPullPerS);
    x += this.coverOffset;

    if (tele) this.telegraphShown = tele;
    switch (tele) {
      case 'spike': // Schatten zittert
        x += Math.floor(now / T.jitterMs) % 2 ? T.jitterPx : -T.jitterPx;
        y += Math.floor(now / (T.jitterMs * 1.5)) % 2 ? T.jitterPx / 2 : 0;
        break;
      case 'sprint': // Schatten dreht sich (zur kommenden Fluchtrichtung), Wasserstreifen
        if (prog > 1 / 2 && st.dir && st.dir !== 'down') face = st.dir;
        else if (prog > 1 / 4) face = face === 'left' ? 'right' : 'left';
        break;
      case 'jump': { // Schatten steigt, Wasser wölbt sich
        y = y + (surf + halfH - y) * prog;
        const w = T.bulgeW;
        const hgt = Math.max(1, Math.round(T.bulgeH * Math.max(prog, 1 / 2)));
        this.fx.fillStyle(hexToInt(VIEW.colors.foam), 1);
        for (let i = 0; i < w; i++) {
          const u = (i / (w - 1)) * 2 - 1;
          const top = Math.round(surf - hgt * (1 - u * u));
          this.fx.fillRect(Math.round(x - w / 2 + i), top, 1, surf - top + 1);
        }
        break;
      }
      case 'flee': // einzelnes Flossenzucken direkt zu Beginn der Vorwarnung
        if (prog < T.finFlickShare) { face = face === 'left' ? 'right' : 'left'; y -= 1; }
        break;
      case 'inflate': // Fisch wird rund (pulsierend)
        scaleY = Math.floor(now / T.inflatePulseMs) % 2 ? 2 : 1;
        break;
      case 'invisible': // Fisch wird durchsichtig (sofort halb, dann weiter)
        alpha = Math.max(T.fadeMin, T.fadeStart - Math.round(prog * 4) / 4 * (T.fadeStart - T.fadeMin));
        break;
      default: break;
    }
    if (st.kind === 'inflate') scaleY = 2;

    // Am Wasser- und Bodenprofil klemmen (beim Tauchen nicht im Uferhang)
    x = Math.round(x);
    const bottom = seabedY(this.art, x) - halfH * scaleY - 1;
    if (st.kind !== 'jump') y = Math.min(y, bottom);
    y = Math.round(Math.min(y, this.art.grundTiefsterY));
    this.lastFace = face;
    const left = face === 'left';
    this.hooked.setVisible(true).setPosition(x, y).setFlipX(left).setAlpha(alpha).setScale(1, scaleY);

    // Wasserstreifen (Sprinter: Vorwarnung + Flucht)
    if (tele === 'sprint' || st.kind === 'sprint') {
      this.fx.fillStyle(hexToInt(VIEW.colors.foam), 1);
      const back = left ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const len = T.streakLen - i * 4 + (Math.floor(now / 90 + i) % 3) * 2;
        const sx = x + back * (Math.round(this.hooked.width / 2) + 2);
        const sy = y - 5 + i * 5;
        this.fx.fillRect(back > 0 ? sx : sx - len, sy, len, 2);
      }
    }
    // Blasen (Taucher: Vorwarnung + Tauchgang)
    this.bubbleAcc += tele === 'dive' || st.kind === 'dive' ? dt * T.bubblesPerS : 0;
    for (const b of this.bubbles) {
      if (b.life <= 0 && this.bubbleAcc >= 1) {
        this.bubbleAcc -= 1;
        b.life = T.bubbleLifeS;
        b.vy = T.bubbleRisePxS;
        const k = (Math.floor(now / 37) + this.bubbles.indexOf(b) * 5) % 9;
        b.sprite.setPosition(x + Math.round((k / 8 - 1 / 2) * this.hooked.width * 0.6), y + halfH - (k % 3) * 2);
      }
      if (b.life > 0) {
        b.life -= dt;
        const ny = b.sprite.y - b.vy * dt;
        if (ny <= surf + 2) b.life = 0;
        b.sprite.setVisible(b.life > 0).setPosition(Math.round(b.sprite.x), Math.round(ny));
      } else b.sprite.setVisible(false);
    }
    // Blaue Funken (Stromer: Vorwarnung + Stromstoß)
    if (tele === 'shock' || st.kind === 'shock') {
      const seed = Math.floor(now / T.sparkMs);
      const cols = [hexToInt(VIEW.colors.spark), hexToInt(VIEW.colors.sparkLight)];
      for (let i = 0; i < T.sparks; i++) {
        // auf einer Ellipse knapp außerhalb des Umrisses, jede Funke ein kleiner Zickzack (3 Pixel-Stufen à 2×2)
        const a = ((seed * 37 + i * (360 / T.sparks)) % 360) * (Math.PI / 180);
        const j = (seed + i * 7) % 4;
        const px = Math.round(x + Math.cos(a) * (this.hooked.width / 2 + 3 + j));
        const py = Math.round(y + Math.sin(a) * (halfH * scaleY + 3 + j));
        this.fx.fillStyle(cols[i % 2] ?? 0xffffff, 1)
          .fillRect(px, py, 2, 2).fillRect(px + 2, py - 2, 2, 2).fillRect(px + 4, py, 2, 2);
      }
    }
    // Deckung blinkt (Versteckspieler)
    if (toCover && cover && Math.floor(now / T.coverBlinkMs) % 4 !== 3) {
      // 2-px-Rahmen als gefüllte Rechtecke (ganze Pixel, keine Linienglättung)
      this.fx.fillStyle(hexToInt(VIEW.colors.warn), 1)
        .fillRect(cover.x, cover.y, cover.w, 2).fillRect(cover.x, cover.y + cover.h - 2, cover.w, 2)
        .fillRect(cover.x, cover.y, 2, cover.h).fillRect(cover.x + cover.w - 2, cover.y, 2, cover.h);
    }

    // Maul an der Seite, in die der Fisch schaut
    const mouthDx = Math.round(this.hooked.width / 2) * (left ? -1 : 1);
    return { x: x + mouthDx, y };
  }

  updateFeeding(spot: { x: number } | null, tint: number): void {
    this.crumbs.setVisible(!!spot);
    if (spot) this.crumbs.setPosition(Math.round(spot.x), this.art.oberflaecheY + Math.round(this.crumbs.height / 2) + 2).setTint(tint);
  }
}
