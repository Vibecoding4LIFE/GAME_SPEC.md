// Angler am Steg (Platz 1), Rute mit 4 Biegestufen, Schnur als Verlet-Seil (harte Pixel-Linie), Pose und Köder,
// Zupfer-„…“, Biss-„!“ und Schein-„!“ über der Pose.
import Phaser from 'phaser';
import { createRope, rasterLine, rasterPolyline, stepRope, type Rope } from '../../core/rope';
import { FIGURES_ATLAS, HUD_ATLAS } from '../keys';
import { VIEW } from '../sceneConfig';
import { hexToInt, type WorldSee } from '../worldSee';
import { anchorOf, originAt, pin, type Pt } from './assets';

export type BobberMode = 'hidden' | 'dangle' | 'flight' | 'idle' | 'nibble' | 'bite';

export interface AnglerFrame {
  dt: number;
  /** Rutenbiegung 0…3 */
  bend: number;
  bobber: BobberMode;
  /** Landepunkt der Pose (Welt-x) und Köder-y */
  baitX: number;
  baitY: number;
  /** Ende der Schnur im Drill (Fischmaul), sonst null */
  fishMouth: Pt | null;
  /** Flugfortschritt 0…1 bei 'flight' */
  flight: number;
  /** Pose zittert (Hänger) */
  shake: boolean;
  tint: number;
  marker: 'none' | 'nibble' | 'bite' | 'fake';
  /** Hitzkopf: Hitze 0…1 → Schnur glüht orange (D 1.7) */
  lineGlow?: number;
}

export class Angler {
  readonly spot: { x: number; y: number };
  private figure!: Phaser.GameObjects.Image;
  private rod!: Phaser.GameObjects.Image;
  private bobber!: Phaser.GameObjects.Sprite;
  private bait!: Phaser.GameObjects.Sprite;
  private marker!: Phaser.GameObjects.Sprite;
  private line!: Phaser.GameObjects.Graphics;
  private rope!: Rope;
  private hand: Pt = { x: 0, y: 0 };
  private bend = -1;
  private lastMarker: AnglerFrame['marker'] = 'none';
  private readonly lineColor: number;

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer, private readonly art: WorldSee, lineColor: string) {
    const s = art.spielerplaetze[0];
    this.spot = { x: s?.x ?? 0, y: s?.y ?? art.oberflaecheY };
    this.lineColor = hexToInt(lineColor || VIEW.fallbackLineColor);
  }

  create(): void {
    const { scene, art } = this;
    const d = art.tiefenOrdnung;
    const figFrame = 'angler_a_sit_still_0';
    this.figure = scene.add.image(this.spot.x, this.spot.y, FIGURES_ATLAS, figFrame).setDepth(d.spieler ?? 32);
    originAt(this.figure, anchorOf(scene, FIGURES_ATLAS, figFrame, 'sitz'));
    const sitz = anchorOf(scene, FIGURES_ATLAS, figFrame, 'sitz') ?? { x: 0, y: 0 };
    const hand = anchorOf(scene, FIGURES_ATLAS, figFrame, 'hand') ?? sitz;
    this.hand = { x: this.spot.x - sitz.x + hand.x, y: this.spot.y - sitz.y + hand.y };
    this.rod = scene.add.image(this.hand.x, this.hand.y, FIGURES_ATLAS, 'rod_bend_0').setDepth(d.rute ?? 33);
    this.line = scene.add.graphics().setDepth(d.schnur ?? 21);
    this.bobber = scene.add.sprite(0, 0, FIGURES_ATLAS, 'pose_idle_0').setDepth((d.schnur ?? 21) + 1);
    originAt(this.bobber, anchorOf(scene, FIGURES_ATLAS, 'pose_idle_0', 'wasserlinie'));
    this.bait = scene.add.sprite(0, 0, FIGURES_ATLAS, 'bait_wurm_wiggle_0').setDepth(d.schnur ?? 21).play('bait_wurm_wiggle');
    originAt(this.bait, anchorOf(scene, FIGURES_ATLAS, 'bait_wurm_wiggle_0', 'schnur'));
    this.marker = pin(scene.add.sprite(0, 0, HUD_ATLAS, 'hud_nibble_dots_0'), 1 / 2, 1).setDepth(d.dekoUeberWasser ?? 35).setVisible(false);
    for (const o of [this.figure, this.rod, this.line, this.bobber, this.bait, this.marker]) this.layer.add(o);
    this.setBend(0);
    const tip = this.tip();
    this.rope = createRope(tip.x, tip.y, tip.x, tip.y + VIEW.idleDanglePx, { ...VIEW.rope, waterY: art.oberflaecheY });
  }

  private setBend(n: number): void {
    if (n === this.bend) return;
    this.bend = n;
    const frame = `rod_bend_${n}`;
    this.rod.setFrame(frame);
    originAt(this.rod, anchorOf(this.scene, FIGURES_ATLAS, frame, 'griff'));
  }

  /** Rutenspitze in Weltkoordinaten (Anker 'spitze' der aktuellen Biegestufe). */
  tip(): Pt {
    const frame = `rod_bend_${Math.max(0, this.bend)}`;
    const g = anchorOf(this.scene, FIGURES_ATLAS, frame, 'griff') ?? { x: 0, y: 0 };
    const s = anchorOf(this.scene, FIGURES_ATLAS, frame, 'spitze') ?? g;
    return { x: this.hand.x - g.x + s.x, y: this.hand.y - g.y + s.y };
  }

  update(f: AnglerFrame): void {
    this.setBend(f.bend);
    const surf = this.art.oberflaecheY;
    const tip = this.tip();
    for (const o of [this.figure, this.rod]) o.setTint(f.tint);

    // Pose
    let bob: Pt;
    let slack: number = VIEW.rope.slackWater;
    switch (f.bobber) {
      case 'flight': {
        const t = f.flight;
        bob = { x: tip.x + (f.baitX - tip.x) * t, y: tip.y + (surf - tip.y) * t - VIEW.castArcPx * 4 * t * (1 - t) };
        slack = VIEW.rope.slackIdle;
        break;
      }
      case 'dangle': case 'hidden':
        bob = { x: tip.x, y: tip.y + VIEW.idleDanglePx };
        slack = VIEW.rope.slackIdle;
        break;
      default:
        bob = { x: f.baitX + (f.shake ? (Math.floor(this.scene.time.now / 60) % 2 ? 1 : -1) : 0), y: surf };
    }
    const fighting = f.fishMouth !== null;
    this.bobber.setVisible(!fighting && f.bobber !== 'hidden');
    const anim = f.bobber === 'nibble' ? 'pose_nibble' : f.bobber === 'bite' ? 'pose_bite' : 'pose_idle';
    if (this.bobber.anims.currentAnim?.key !== anim) this.bobber.play(anim);
    this.bobber.setPosition(Math.round(bob.x), Math.round(bob.y));

    // Köder unter der Pose
    const inWater = !fighting && (f.bobber === 'idle' || f.bobber === 'nibble' || f.bobber === 'bite');
    this.bait.setVisible(inWater || f.bobber === 'dangle');
    const baitPos = inWater ? { x: Math.round(bob.x), y: Math.round(Math.max(surf, f.baitY)) } : { x: Math.round(bob.x), y: Math.round(bob.y) + 4 };
    this.bait.setPosition(baitPos.x, baitPos.y).setTint(inWater ? f.tint : 0xffffff);

    // Schnur: Rutenspitze → Pose (bzw. Fisch), Verlet-Seil
    const end = f.fishMouth ?? bob;
    stepRope(this.rope, f.dt, tip.x, tip.y, end.x, end.y, fighting ? VIEW.rope.slackFight : slack);
    const pts = this.rope.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    this.line.clear();
    const g = f.lineGlow ?? 0;
    const glow = g >= 2 / 3 ? VIEW.lineGlow[1] : g >= 1 / 3 ? VIEW.lineGlow[0] : null;
    this.line.fillStyle(glow ? hexToInt(glow) : this.lineColor, 1);
    for (const p of rasterPolyline(pts)) this.line.fillRect(p.x, p.y, 1, 1);
    if (inWater && baitPos.y > bob.y) rasterLine(bob.x, bob.y, baitPos.x, baitPos.y, (x, y) => this.line.fillRect(x, y, 1, 1));

    // Zupfer / Biss / Schein: Biss- und Schein-„!“ doppelt so groß (ganzzahlig) und blinkend
    if (f.marker !== this.lastMarker) {
      this.lastMarker = f.marker;
      this.marker.setVisible(f.marker !== 'none');
      if (f.marker === 'nibble') this.marker.play('hud_nibble_dots');
      if (f.marker === 'bite') this.marker.play('hud_bite_pop');
      if (f.marker === 'fake') this.marker.play('hud_fake_pop');
      this.marker.setScale(f.marker === 'bite' || f.marker === 'fake' ? VIEW.bitePopScale : 1);
      pin(this.marker, 1 / 2, 1);
    }
    if (f.marker === 'bite') this.marker.setVisible(Math.floor(this.scene.time.now / VIEW.bitePopBlinkMs) % 4 !== 3);
    const top = anchorOf(this.scene, FIGURES_ATLAS, 'pose_idle_0', 'wasserlinie')?.y ?? 0;
    this.marker.setPosition(Math.round(bob.x), Math.round(bob.y) - top - 2);
  }
}
