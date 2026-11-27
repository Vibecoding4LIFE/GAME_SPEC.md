// Kulisse der Welt: Parallax-Ebenen, Tageszeit-Tönung, animierte Oberfläche, Deko, Umgebungsleben und Wetter-Effekte
// (alles aus world_<kuerzel>.json). Positionen immer ganze Spielpixel (B3).
import Phaser from 'phaser';
import type { Rng } from '../../core/random';
import type { WorldEvent } from '../../data/types';
import type { ActiveWeather, DayPhase } from '../../game/types';
import { layerKey, worldAtlasKey } from '../keys';
import { VIEW } from '../sceneConfig';
import {
  celestialPos, hexToInt, parallaxX, phaseKey, tileOffsets, type WorldLayer, type WorldSee, type WorldSpawnZone,
} from '../worldSee';
import { anchorOf, originAt, pin } from './assets';

type Img = Phaser.GameObjects.Image;
type Spr = Phaser.GameObjects.Sprite;

interface LayerView { def: WorldLayer; tiles: Img[] }
interface Ambient { zone: WorldSpawnZone; sprites: Spr[]; vy: number[] }
interface Mover { sprite: Spr; min: number; max: number; dir: 1 | -1; speed: number; x: number }

export interface BackdropState {
  scrollX: number;
  viewW: number;
  phase: DayPhase;
  /** Anteil 0…1 innerhalb der hellen bzw. dunklen Tageshälfte (Sonnen-/Mondbahn) */
  arc: number;
  weather: ActiveWeather;
  events: readonly WorldEvent[];
}

export class Backdrop {
  private layers: LayerView[] = [];
  private surface: LayerView[] = [];
  private ambients: Ambient[] = [];
  private movers: Mover[] = [];
  private frogs: { sprite: Spr; idle: string; rain: string }[] = [];
  private dayOnly: Spr[] = [];
  private clouds: { img: Img; x: number }[] = [];
  private sun!: Img;
  private moon!: Img;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private bolt!: Img;
  private flashLeft = 0;
  private surfaceT = 0;
  private lastPhase: DayPhase | null = null;
  private readonly atlas: string;

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer, private readonly art: WorldSee, private readonly rng: Rng) {
    this.atlas = worldAtlasKey(art.kuerzel);
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.add(o);
    return o;
  }

  create(): void {
    const { art, scene } = this;
    const depth = art.tiefenOrdnung;
    for (const def of art.ebenen) {
      const key = layerKey(art.kuerzel, def.id);
      const count = def.kachelbar ? 3 : 1;
      const tiles = Array.from({ length: count }, () =>
        this.add(scene.add.image(def.x, def.y, key).setOrigin(0, 0).setDepth(def.tiefe)));
      const view = { def, tiles };
      if (def.animation) this.surface.push(view);
      this.layers.push(view);
    }
    this.surface.sort((a, b) => (a.def.animation?.frame ?? 0) - (b.def.animation?.frame ?? 0));

    this.sun = this.add(pin(scene.add.image(0, 0, this.atlas, 'see_sonne_still_0')).setDepth(depth.sonneMond ?? 1));
    this.moon = this.add(pin(scene.add.image(0, 0, this.atlas, 'see_mond_voll_still_0')).setDepth(depth.sonneMond ?? 1));
    const maxClouds = Math.max(...Object.values(VIEW.clouds));
    for (let i = 0; i < maxClouds; i++) {
      const frame = i % 2 === 0 ? 'see_wolke_a_still_0' : 'see_wolke_b_still_0';
      const x = this.rng.range(0, art.groesse.w);
      const img = this.add(scene.add.image(0, Math.round(this.rng.range(4, art.oberflaecheY / 2)), this.atlas, frame).setOrigin(0).setDepth(depth.wolken ?? 2));
      this.clouds.push({ img, x });
    }

    for (const d of art.deko) {
      const frame = d.frame ?? `${d.anim}_0`;
      const s = this.add(scene.add.sprite(d.x, d.y, this.atlas, frame).setDepth(d.tiefe));
      originAt(s, d.anker ? anchorOf(scene, this.atlas, frame, d.anker) : null);
      if (!d.anker) pin(s);
      if (d.flipX) s.setFlipX(true);
      if (d.anim && scene.anims.exists(d.anim)) s.play({ key: d.anim, startFrame: 0 });
      if (d.bahn) this.movers.push({ sprite: s, min: d.bahn[0], max: d.bahn[1], dir: 1, speed: d.anim?.includes('libelle') ? 30 : 6, x: d.x });
      if (d.regen && d.anim) this.frogs.push({ sprite: s, idle: d.anim, rain: d.regen });
      if (d.nurTag) this.dayOnly.push(s);
    }

    for (const z of art.spawnZonen) {
      const sprites: Spr[] = [];
      const vy: number[] = [];
      for (let i = 0; i < z.anzahl; i++) {
        const frame = z.frame ?? `${z.anim}_0`;
        const s = this.add(pin(scene.add.sprite(0, 0, this.atlas, frame)).setDepth(this.zoneDepth(z)));
        this.placeInZone(s, z);
        if (z.anim && scene.anims.exists(z.anim)) {
          s.play({ key: z.anim, startFrame: this.rng.int(0, 1) });
          if (z.anim.includes('regenring')) {
            s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { this.placeInZone(s, z); s.play(z.anim as string); });
          }
        }
        sprites.push(s);
        vy.push(z.steigt ? -this.rng.range(6, 14) : z.faellt ? this.rng.range(140, 200) : 0);
      }
      this.ambients.push({ zone: z, sprites, vy });
    }

    this.bolt = this.add(pin(scene.add.image(0, 0, this.atlas, 'see_blitz_a_still_0'), 1 / 2, 0).setDepth(depth.wolken ?? 2).setVisible(false));
    this.flashRect = this.add(scene.add.rectangle(0, 0, art.groesse.w, art.groesse.h, 0xffffff, VIEW.flash.alpha).setOrigin(0).setDepth(depth.nebel ?? 41).setVisible(false));
  }

  private zoneDepth(z: WorldSpawnZone): number {
    const d = this.art.tiefenOrdnung;
    const underwater = z.rect[1] >= this.art.oberflaecheY + 2;
    return underwater ? (d.dekoUnterWasser ?? 16) : (d.dekoUeberWasser ?? 35);
  }

  private placeInZone(s: Spr, z: WorldSpawnZone): void {
    const [x, y, w, h] = z.rect;
    s.setPosition(Math.round(x + this.rng.next() * w), Math.round(y + this.rng.next() * h));
  }

  /** Blitz: kurzer weißer Schein + Blitzbild (Schatten-Enthüllung macht die Fisch-Ebene). */
  lightning(scrollX: number, viewW: number): void {
    this.flashLeft = VIEW.flash.s;
    this.bolt.setFrame(this.rng.next() < 1 / 2 ? 'see_blitz_a_still_0' : 'see_blitz_b_still_0');
    this.bolt.setPosition(Math.round(scrollX + this.rng.range(0, viewW)), 0).setVisible(true);
  }

  update(dt: number, st: BackdropState): void {
    const look = this.art.tageszeiten[phaseKey(st.phase)];
    const tint = { himmel: hexToInt(look.tint.himmel), oben: hexToInt(look.tint.oben), unter: hexToInt(look.tint.unter) };
    const phaseLower = phaseKey(st.phase);

    // Ebenen: Sichtbarkeit, Parallax ohne Bruchteile, Kacheln
    this.surfaceT += dt;
    const surfaceFrame = this.surface.length
      ? Math.floor(this.surfaceT * (this.surface[0]?.def.animation?.fps ?? 1)) % this.surface.length : 0;
    for (const lv of this.layers) {
      const d = lv.def;
      let visible = true;
      if (d.tageszeit) visible = d.tageszeit === phaseLower;
      if (d.nurTageszeit) visible = visible && d.nurTageszeit.includes(phaseLower) && !['Bewoelkt', 'Regen', 'Gewitter'].includes(st.weather);
      if (d.nurWetter) visible = visible && d.nurWetter.includes(st.weather);
      if (d.animation) visible = visible && d.animation.frame === surfaceFrame;
      const x0 = parallaxX(st.scrollX, d.parallaxX, d.x);
      const xs = d.kachelbar ? tileOffsets(x0, d.w, st.scrollX, st.viewW) : [d.x];
      lv.tiles.forEach((img, i) => {
        const x = xs[i];
        img.setVisible(visible && x !== undefined);
        if (x !== undefined) img.x = x;
        if (this.lastPhase !== st.phase) img.setTint(tint[d.tintGruppe]);
      });
    }

    // Sonne / Mond
    const sunUp = look.sonne && !['Regen', 'Gewitter', 'Nebel'].includes(st.weather);
    const pos = celestialPos(this.art, st.arc);
    const sx = parallaxX(st.scrollX, this.skyParallax(), pos.x);
    this.sun.setVisible(sunUp).setPosition(sx, pos.y);
    this.moon.setVisible(look.mond && !['Regen', 'Gewitter'].includes(st.weather)).setPosition(sx, pos.y)
      .setFrame(st.events.includes('Vollmond') ? 'see_mond_voll_still_0' : 'see_mond_sichel_still_0');

    // Wolken je Wetter
    const n = VIEW.clouds[st.weather] ?? 0;
    this.clouds.forEach((c, i) => {
      c.x = (c.x + VIEW.cloudSpeedPx * dt) % this.art.groesse.w;
      c.img.setVisible(i < n).setTint(tint.oben);
      c.img.x = parallaxX(st.scrollX, this.skyParallax(), Math.round(c.x));
    });

    // Deko
    for (const m of this.movers) {
      m.x += m.dir * m.speed * dt;
      if (m.x > m.max) { m.x = m.max; m.dir = -1; }
      if (m.x < m.min) { m.x = m.min; m.dir = 1; }
      m.sprite.x = Math.round(m.x);
      m.sprite.setFlipX(m.dir < 0);
    }
    const raining = st.weather === 'Regen' || st.weather === 'Gewitter';
    for (const f of this.frogs) {
      const want = raining ? f.rain : f.idle;
      if (f.sprite.anims.currentAnim?.key !== want && this.scene.anims.exists(want)) f.sprite.play(want);
    }
    for (const s of this.dayOnly) s.setVisible(st.phase !== 'Nacht');

    // Umgebungsleben (Zeit, Wetter, Ereignis)
    for (const a of this.ambients) {
      const z = a.zone;
      let on = true;
      if (z.nur) on = z.nur.includes(phaseLower);
      if (z.wetter) on = on && z.wetter.includes(st.weather);
      if (z.ereignis) on = on && st.events.includes(z.ereignis as WorldEvent);
      if (z.frame?.startsWith('see_blitz')) on = false; // Blitz kommt über lightning()
      a.sprites.forEach((s, i) => {
        s.setVisible(on);
        if (!on) return;
        const vy = a.vy[i] ?? 0;
        if (vy !== 0) {
          s.y = Math.round(s.y + vy * dt);
          const [, y, , h] = z.rect;
          if (s.y < y || s.y > y + h) { this.placeInZone(s, z); s.y = vy < 0 ? y + h : y; }
        }
        if (this.lastPhase !== st.phase) s.setTint(s.y > this.art.oberflaecheY ? tint.unter : tint.oben);
      });
    }

    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      this.flashRect.setVisible(this.flashLeft > 0);
      this.bolt.setVisible(this.flashLeft > 0);
    }
    this.lastPhase = st.phase;
  }

  private skyParallax(): number {
    return this.art.ebenen.find((e) => e.tintGruppe === 'himmel')?.parallaxX ?? 0;
  }

  /** Tönung für Objekte anderer Ebenen (Fische, Figuren) zur aktuellen Tageszeit. */
  tintFor(phase: DayPhase, underwater: boolean): number {
    const t = this.art.tageszeiten[phaseKey(phase)].tint;
    return hexToInt(underwater ? t.unter : t.oben);
  }
}
