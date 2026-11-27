// Fisch-Schatten (Objekt-Pool, max. VIEW.shadows.max), gehakter Fisch im Drill (dunkle Silhouette, zappelnd),
// Krümelwolke des Futterplatzes. Arten bleiben geheim: Schatten sind generische Formen je Größenklasse.
import Phaser from 'phaser';
import { CANVAS_BY_SIZE, SIZE_CLASSES, type FishData, type SizeClass } from '../../data/types';
import type { DrillState } from '../../game/drill';
import type { ShadowView } from '../../game/shadows';
import { HUD_ATLAS, worldAtlasKey } from '../keys';
import { VIEW } from '../sceneConfig';
import { depthToY, distanceToX, hexToInt, type WorldSee } from '../worldSee';
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

export class FishLayer {
  private pool: { sprite: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image }[] = [];
  private hooked!: Phaser.GameObjects.Sprite;
  private hookedKey = '';
  private crumbs!: Phaser.GameObjects.Sprite;
  private reveal = 0;

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
    this.layer.add([this.hooked, this.crumbs]);
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

  /** Gehakter Fisch: zwischen Wurfstelle (Distanz 1) und Boot/Steg (0), Sprung über die Oberfläche. Liefert das Maul. */
  updateHooked(h: HookedView | null, rodTip: Pt): Pt | null {
    if (!h) { this.hooked.setVisible(false); this.hookedKey = ''; return null; }
    const d = h.drill;
    const f = Math.max(0, Math.min(1.5, d.distance));
    const surf = this.art.oberflaecheY;
    let x = rodTip.x + (h.startX - rodTip.x) * f;
    let y = surf + (h.startY - surf) * Math.min(1, f);
    if (d.stage.kind === 'dive') y += (h.startY - surf) * 0.25;
    if (d.stage.kind === 'jump') y = surf - VIEW.jumpPx;
    const key = `${h.fish.assetKey}_struggle`;
    if (this.hookedKey !== key) {
      this.hookedKey = key;
      pin(this.hooked.setTexture(h.fish.atlasKey, `${h.fish.assetKey}_struggle_0`));
      if (this.scene.anims.exists(key)) this.hooked.play(key);
      // Art bleibt bis zum Fang verborgen: dunkle Silhouette
      this.hooked.setTint(hexToInt(VIEW.colors.shadow)).setTintMode(Phaser.TintModes.FILL);
    }
    // Blickrichtung = Zugrichtung (Sprites schauen nach rechts); beim Tauchen zum Boot hin
    const left = d.pullDir !== 'right';
    x = Math.round(x);
    y = Math.round(Math.min(y, this.art.grundTiefsterY));
    this.hooked.setVisible(true).setPosition(x, y).setFlipX(left).setAlpha(d.invisible ? d.visibility : 1);
    // Maul an der Seite, in die der Fisch schaut
    const mouthDx = Math.round(this.hooked.width / 2) * (left ? -1 : 1);
    return { x: x + mouthDx, y };
  }

  updateFeeding(spot: { x: number } | null, tint: number): void {
    this.crumbs.setVisible(!!spot);
    if (spot) this.crumbs.setPosition(Math.round(spot.x), this.art.oberflaecheY + Math.round(this.crumbs.height / 2) + 2).setTint(tint);
  }
}
