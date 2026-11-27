// Helfer für Atlanten: Animationen aus `meta.anims`/`meta.clips`, Anker aus `frame.customData.anchors`.
import Phaser from 'phaser';
import { groupFishFrames } from '../fishFrames';

type Anim = { frames: number; fps: number; loop: boolean; yoyo: boolean };

/** Legt alle Animationen eines Welt-/Figuren-/HUD-Atlas an (Key = Name ohne `_<n>`). */
export function createAtlasAnims(scene: Phaser.Scene, atlasKey: string): void {
  const tex = scene.textures.get(atlasKey);
  const meta = (tex.customData as { meta?: { anims?: Record<string, Anim> } }).meta;
  for (const [key, a] of Object.entries(meta?.anims ?? {})) {
    if (scene.anims.exists(key)) continue;
    const frames = Array.from({ length: a.frames }, (_, i) => ({ key: atlasKey, frame: `${key}_${i}` })).filter((f) => tex.has(f.frame));
    if (frames.length === 0) continue;
    scene.anims.create({ key, frames, frameRate: a.fps, repeat: a.loop ? -1 : 0, yoyo: a.yoyo });
  }
}

/** Fisch-Atlas: Clips je Fisch (`<assetKey>_<clip>`), Bildraten aus `meta.clips`. */
export function createFishAnims(scene: Phaser.Scene, atlasKey: string): void {
  const tex = scene.textures.get(atlasKey);
  const rates = (tex.customData as { meta?: { clips?: Record<string, number> } }).meta?.clips ?? {};
  for (const g of groupFishFrames(tex.getFrameNames())) {
    const key = `${g.assetKey}_${g.clip}`;
    if (scene.anims.exists(key)) continue;
    const rate = rates[g.clip];
    scene.anims.create({
      key, frames: g.frames.map((frame) => ({ key: atlasKey, frame })),
      ...(rate ? { frameRate: rate } : {}), repeat: g.clip === 'caught' ? 0 : -1,
    });
  }
}

export interface Pt { x: number; y: number }

/** Anker eines Frames (Pixel im Frame) oder null. */
export function anchorOf(scene: Phaser.Scene, atlasKey: string, frame: string, name: string): Pt | null {
  const f = scene.textures.getFrame(atlasKey, frame);
  const a = (f?.customData as { anchors?: Record<string, Pt> } | undefined)?.anchors?.[name];
  return a ? { x: a.x, y: a.y } : null;
}

/** Fenster (Innenbereich) eines HUD-Rahmens. */
export function windowOf(scene: Phaser.Scene, atlasKey: string, frame: string): { x: number; y: number; w: number; h: number } {
  const f = scene.textures.getFrame(atlasKey, frame);
  const w = (f?.customData as { anchors?: { fenster?: { x: number; y: number; w: number; h: number } } } | undefined)?.anchors?.fenster;
  return w ?? { x: 0, y: 0, w: f?.width ?? 0, h: f?.height ?? 0 };
}

/** Setzt den Ursprung eines Sprites auf einen Anker (ganze Pixel), sonst oben links. */
export function originAt(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, anchor: Pt | null): void {
  if (!anchor) { sprite.setOrigin(0, 0); return; }
  sprite.setOrigin(anchor.x / sprite.width, anchor.y / sprite.height);
}

/**
 * Ursprung als Anteil, aber auf ganze Pixel abgerundet (B3): Bei ungerader Breite würde `setOrigin(0.5)` das Sprite
 * auf einen halben Spielpixel setzen. Nach jedem Wechsel auf eine Textur anderer Größe erneut aufrufen.
 */
export function pin<T extends Phaser.GameObjects.Components.Origin & { width: number; height: number }>(o: T, fx = 1 / 2, fy = 1 / 2): T {
  const w = Math.max(1, o.width);
  const h = Math.max(1, o.height);
  o.setOrigin(Math.floor(w * fx) / w, Math.floor(h * fy) / h);
  return o;
}
