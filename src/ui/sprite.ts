// src/ui/sprite.ts – Fisch-Frames pixelgenau in ein <canvas> zeichnen (B3: nie glätten, nur ganzzahlig skalieren).
import type { SpriteFrame, SpriteSource } from './types';

export interface RenderSpriteOptions {
  /** Verfügbare Fläche in CSS-Pixeln. */
  maxCssWidth: number;
  maxCssHeight: number;
  /** 'color' = Farbsprite, 'silhouette' = schwarz mit 1-px-Kontur (D 1.12). */
  mode?: 'color' | 'silhouette';
  /** Konturfarbe der Silhouette (Seltenheitsfarbe). */
  outline?: string;
  /** Zusätzliche ganze Zoomstufen (Riesig +1, D 1.10). */
  extraZoom?: number;
  /** Höchstens so groß skalieren (Gerätepixel pro Bildpixel). */
  maxScale?: number;
  /** Gerätepixel-Verhältnis (Tests / Screenshots). */
  dpr?: number;
  /** Schillernd (D 1.11): Grundfarben `from` → `to` (gleiche Reihenfolge wie `art.farben`/`art.schillerndFarben`). */
  palette?: { from: readonly string[]; to: readonly string[] };
}

/**
 * „Gebackener“ Palette-Swap ohne LUT: Jedes Pixel wird der nächstgelegenen Grundfarbe zugeordnet und erhält deren
 * Schillernd-Farbe, skaliert mit dem Helligkeitsverhältnis (Schatten/Lichter der Rampe bleiben erhalten).
 * Arbeitet direkt auf RGBA-Daten (testbar ohne DOM). Alpha bleibt unverändert.
 */
export function swapPalette(data: Uint8ClampedArray, from: readonly string[], to: readonly string[]): void {
  const n = Math.min(from.length, to.length);
  if (n === 0) return;
  const src = from.slice(0, n).map(hexToRgb);
  const dst = to.slice(0, n).map(hexToRgb);
  const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    let out = cache.get(key);
    if (!out) {
      let best = 0;
      let bestD = Infinity;
      src.forEach(([sr, sg, sb], k) => {
        const d = (sr - r) ** 2 + (sg - g) ** 2 + (sb - b) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      });
      const [sr, sg, sb] = src[best] as [number, number, number];
      const [dr, dg, db] = dst[best] as [number, number, number];
      const f = Math.min(1.8, Math.max(0.3, (lum(r, g, b) + 1) / (lum(sr, sg, sb) + 1)));
      out = [Math.min(255, Math.round(dr * f)), Math.min(255, Math.round(dg * f)), Math.min(255, Math.round(db * f))];
      cache.set(key, out);
    }
    data[i] = out[0];
    data[i + 1] = out[1];
    data[i + 2] = out[2];
  }
}

/** Ganzzahliger Faktor in Gerätepixeln, damit jedes Bildpixel exakt n×n Gerätepixel wird. */
export function integerScale(frameW: number, frameH: number, maxCssW: number, maxCssH: number, dpr: number, extra = 0, maxScale = 64): number {
  const fit = Math.floor(Math.min((maxCssW * dpr) / frameW, (maxCssH * dpr) / frameH));
  return Math.max(1, Math.min(maxScale, Math.max(1, fit) + extra));
}

/**
 * Passt der Frame selbst bei Faktor 1 nicht (z. B. Boss 256×128 in einer Lexikon-Kachel), wird um einen
 * ganzzahligen Teiler verkleinert (jedes n-te Pixel, nie geglättet). 1 = keine Verkleinerung.
 */
export function integerDivisor(frameW: number, frameH: number, maxCssW: number, maxCssH: number, dpr: number): number {
  const need = Math.max(frameW / (maxCssW * dpr), frameH / (maxCssH * dpr));
  return need > 1 ? Math.ceil(need) : 1;
}

const PAD = 1; // Platz für die 1-px-Kontur, damit Farbe und Silhouette gleich groß sind

/** Frame in Originalgröße (+1 px Rand) auf eine Arbeitsfläche kopieren; bei Silhouette Alpha → Schwarz + Kontur. */
function composeFrame(src: SpriteSource, mode: 'color' | 'silhouette', outline: string, palette?: RenderSpriteOptions['palette']): HTMLCanvasElement {
  const { x, y, w, h } = src.frame;
  const c = document.createElement('canvas');
  c.width = w + PAD * 2;
  c.height = h + PAD * 2;
  const ctx = c.getContext('2d', { willReadFrequently: mode === 'silhouette' || !!palette });
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src.image, x, y, w, h, PAD, PAD, w, h);
  if (palette && mode === 'color') {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    swapPalette(img.data, palette.from, palette.to);
    ctx.putImageData(img, 0, 0);
  }
  if (mode === 'silhouette') {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const W = c.width;
    const H = c.height;
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = (d[i * 4 + 3] ?? 0) > 24 ? 1 : 0;
    const [or, og, ob] = hexToRgb(outline);
    for (let yy = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++) {
        const i = yy * W + xx;
        const o = i * 4;
        if (solid[i]) {
          d[o] = 12; d[o + 1] = 12; d[o + 2] = 16; d[o + 3] = 255;
        } else {
          const n = (xx > 0 && solid[i - 1]) || (xx < W - 1 && solid[i + 1]) || (yy > 0 && solid[i - W]) || (yy < H - 1 && solid[i + W]);
          if (n) {
            d[o] = or; d[o + 1] = og; d[o + 2] = ob; d[o + 3] = 255;
          } else d[o + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m?.[1] ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Zeichnet `src` in `canvas`: Puffer = (Frame + 2 px) × Faktor Gerätepixel, CSS-Größe = Puffer / dpr.
 * Gibt den verwendeten Faktor zurück (0, wenn nichts zu zeichnen war; < 1 bei Verkleinerung).
 */
export function renderSprite(canvas: HTMLCanvasElement, src: SpriteSource | null, opts: RenderSpriteOptions): number {
  const dpr = opts.dpr ?? (window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  if (!src || src.frame.w <= 0 || src.frame.h <= 0) {
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    canvas.style.width = '0px';
    canvas.style.height = '0px';
    return 0;
  }
  const work = composeFrame(src, opts.mode ?? 'color', opts.outline ?? '#ffffff', opts.palette);
  const div = integerDivisor(work.width, work.height, opts.maxCssWidth, opts.maxCssHeight, dpr);
  const scale = div > 1 ? 1 / div : integerScale(work.width, work.height, opts.maxCssWidth, opts.maxCssHeight, dpr, opts.extraZoom ?? 0, opts.maxScale);
  canvas.width = Math.max(1, Math.round(work.width * scale));
  canvas.height = Math.max(1, Math.round(work.height * scale));
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(work, 0, 0, canvas.width, canvas.height);
  return scale;
}

// ------------------------------------------------------------------ Quellen

interface AtlasJson {
  frames: Record<string, { frame: SpriteFrame }> | { filename: string; frame: SpriteFrame }[];
}

/** Frame aus einem TexturePacker-/pack.py-Atlas (Hash- oder Array-Format). */
export function spriteFromAtlas(image: CanvasImageSource, atlas: AtlasJson, frameName: string): SpriteSource | null {
  const f = Array.isArray(atlas.frames) ? atlas.frames.find((x) => x.filename === frameName)?.frame : atlas.frames[frameName]?.frame;
  return f ? { image, frame: { x: f.x, y: f.y, w: f.w, h: f.h } } : null;
}

/** Strukturtyp für Phaser-Texturen (ohne Phaser zu importieren): `scene.textures.get(atlasKey)`. */
export interface TextureLike {
  getSourceImage(): unknown;
  has(name: string): boolean;
  get(name: string): { cutX: number; cutY: number; cutWidth: number; cutHeight: number };
}

/** Frame aus einer geladenen Phaser-Textur, z. B. `spriteFromTexture(this.textures.get(fish.atlasKey), fish.catchSprite)`. */
export function spriteFromTexture(texture: TextureLike, frameName: string): SpriteSource | null {
  if (!texture.has(frameName)) return null;
  const img = texture.getSourceImage();
  if (!(img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) return null;
  const f = texture.get(frameName);
  return { image: img, frame: { x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight } };
}

/** Bild laden (z. B. Atlas-PNG für Fang-Karte außerhalb von Phaser). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Bild nicht ladbar: ${url}`));
    img.src = url;
  });
}
