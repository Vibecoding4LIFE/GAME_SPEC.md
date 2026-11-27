import Phaser from 'phaser';
import { CACHE, SCENES, fishAtlasKey } from './keys';
import { worldById, type WorldsJson } from './worldsJson';
import { groupFishFrames } from './fishFrames';
import { ditherGradient, hexToRgb } from '../core/dither';
import { Rng, hashSeed } from '../core/random';
import { bus } from '../core/events';
import type { PixelLayout } from '../core/pixelScale';
import { applyPixelCamera } from './pixelCamera';
import type { DebugState } from '../main';
import { t } from '../i18n';

/** Nur für die Testszene: Schwimmtempo in Spielpixeln pro Sekunde je Größenklasse. */
const TEST_SPEED: Record<string, number> = { S: 22, M: 17, L: 13, XL: 10, Boss: 7 };
const SKY_SHARE = 0.18;
const BG_KEY = 'testbecken_bg';

interface FishEntry {
  id: string;
  nr: number;
  welt: string;
  assetKey: string;
  groesse: { klasse: string; canvas: [number, number] };
}

interface Swimmer {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  dir: 1 | -1;
  speed: number;
  w: number;
  h: number;
}

/**
 * Phase-0-Testszene: alle 20 Fische einer Welt schwimmen pixelgenau im Querschnitt.
 * Prüft ganzzahlige Skalierung, Atlas, Animationen und Hoch-/Querformat.
 */
export class TestbeckenScene extends Phaser.Scene {
  private worldId = 'W1';
  private swimmers: Swimmer[] = [];
  private leadColors: string[] = [];
  private badge?: HTMLDivElement;
  private offLayout?: () => void;
  private layout!: PixelLayout;

  constructor() {
    super(SCENES.testbecken);
  }

  init(data: { worldId?: string }): void {
    this.worldId = data.worldId ?? 'W1';
  }

  create(): void {
    const worlds = this.cache.json.get(CACHE.worlds) as WorldsJson;
    const world = worldById(worlds, this.worldId);
    const db = this.cache.json.get(CACHE.fishDb) as { fish: FishEntry[] };
    if (!world) throw new Error(`Welt ${this.worldId} fehlt in worlds.json`);
    this.leadColors = world.leitfarben;
    document.body.style.setProperty('--rand', world.leitfarben[3] ?? '#12342f');

    this.layout = this.registry.get('layout') as PixelLayout;
    applyPixelCamera(this.cameras.main, this.layout);

    const atlasKey = fishAtlasKey(world.kuerzel);
    this.createAnimations(atlasKey);
    this.drawBackground();

    const fish = db.fish.filter((f) => f.welt === this.worldId).sort((a, b) => b.groesse.canvas[1] - a.groesse.canvas[1]);
    const rng = new Rng(hashSeed(`testbecken-${this.worldId}`));
    const width = this.layout.gameWidth;
    fish.forEach((f, i) => {
      const [w, h] = f.groesse.canvas;
      const sprite = this.add.sprite(0, 0, atlasKey, `${f.assetKey}_swim_0`);
      sprite.setOrigin(0.5).setDepth(i);
      sprite.play({ key: `${f.assetKey}_swim`, startFrame: rng.int(0, 3) });
      const dir: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
      sprite.setFlipX(dir < 0);
      const swimmer: Swimmer = {
        sprite,
        x: rng.range(w / 2, width - w / 2),
        dir,
        speed: (TEST_SPEED[f.groesse.klasse] ?? 12) * rng.range(0.8, 1.2),
        w,
        h,
      };
      sprite.setData('laneSeed', rng.next());
      this.swimmers.push(swimmer);
    });
    this.placeLanes();

    this.badge = document.createElement('div');
    this.badge.className = 'overlay-badge';
    document.getElementById('overlay')?.prepend(this.badge);
    this.updateBadge(this.layout);

    this.offLayout = bus.on('layout', (l) => {
      this.layout = l;
      applyPixelCamera(this.cameras.main, l);
      this.drawBackground();
      this.placeLanes();
      this.updateBadge(l);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offLayout?.();
      this.badge?.remove();
    });

    const debug = this.registry.get('debug') as DebugState | undefined;
    if (debug) {
      debug.fishOnScreen = this.swimmers.length;
      debug.ready = true;
    }
  }

  update(_time: number, delta: number): void {
    const width = this.layout.gameWidth;
    const dt = delta / 1000;
    for (const s of this.swimmers) {
      s.x += s.dir * s.speed * dt;
      const half = s.w / 2;
      if (s.x > width - half) {
        s.x = width - half;
        s.dir = -1;
      } else if (s.x < half) {
        s.x = half;
        s.dir = 1;
      }
      s.sprite.setFlipX(s.dir < 0);
      // Immer auf ganze Spielpixel runden (B3)
      s.sprite.x = Math.round(s.x);
    }
  }

  private createAnimations(atlasKey: string): void {
    const texture = this.textures.get(atlasKey);
    const meta = (texture.customData as { meta?: { clips?: Record<string, number> } }).meta;
    const rates = meta?.clips ?? {};
    for (const g of groupFishFrames(texture.getFrameNames())) {
      const key = `${g.assetKey}_${g.clip}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: g.frames.map((frame) => ({ key: atlasKey, frame })),
        frameRate: rates[g.clip] ?? 8,
        repeat: g.clip === 'caught' ? 0 : -1,
      });
    }
  }

  private drawBackground(): void {
    const { gameWidth: width, gameHeight: height } = this.layout;
    const skyH = Math.round(height * SKY_SHARE);
    const [sky = '#8FD3F4', surface = '#3FA7A3', deep = '#1E5F5B', ground = '#12342F'] = this.leadColors;
    if (this.textures.exists(BG_KEY)) this.textures.remove(BG_KEY);
    const tex = this.textures.createCanvas(BG_KEY, width, height);
    if (!tex) return;
    const ctx = tex.getContext();
    const img = ctx.createImageData(width, height);
    const skyPx = ditherGradient(width, skyH, [hexToRgb(sky), hexToRgb(sky)]);
    img.data.set(skyPx, 0);
    const waterPx = ditherGradient(width, height - skyH, [hexToRgb(surface), hexToRgb(deep), hexToRgb(ground)]);
    img.data.set(waterPx, skyH * width * 4);
    // 1-px-Glanzlinie an der Wasseroberfläche (Sonnengelb aus der Palette, falls vorhanden)
    const shine = hexToRgb(this.leadColors[7] ?? '#FFE066');
    for (let x = 0; x < width; x += 1) {
      if ((x >> 2) % 3 === 0) continue;
      const i = (skyH * width + x) * 4;
      img.data[i] = shine[0];
      img.data[i + 1] = shine[1];
      img.data[i + 2] = shine[2];
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    const existing = this.children.getByName(BG_KEY) as Phaser.GameObjects.Image | null;
    if (existing) existing.setTexture(BG_KEY);
    else this.add.image(0, 0, BG_KEY).setOrigin(0).setName(BG_KEY).setDepth(-100);
  }

  /** Verteilt die Fische auf Bahnen im Wasser – passend zum aktuellen Format. */
  private placeLanes(): void {
    const { gameWidth: width, gameHeight: height } = this.layout;
    const waterTop = Math.round(height * SKY_SHARE) + 4;
    for (const s of this.swimmers) {
      const seed = s.sprite.getData('laneSeed') as number;
      const minY = waterTop + s.h / 2;
      const maxY = height - 2 - s.h / 2;
      s.sprite.y = Math.round(minY + seed * Math.max(0, maxY - minY));
      s.x = Math.min(Math.max(s.x, s.w / 2), width - s.w / 2);
      s.sprite.x = Math.round(s.x);
    }
  }

  private updateBadge(l: PixelLayout | undefined): void {
    if (!this.badge) return;
    const world = t(`world.${this.worldId.slice(1)}.name`);
    this.badge.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = `${t('test.title', { world })} · ${t('test.fishCount', { count: this.swimmers.length })}`;
    const hint = document.createElement('small');
    hint.textContent = t('test.hint', { zoom: l?.deviceZoom ?? 1 });
    this.badge.append(title, hint);
  }
}
