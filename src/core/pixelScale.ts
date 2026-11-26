/**
 * Pixel-Perfect-Grundlage (GAME_SPEC B3).
 * Interne Auflösung 640×360 (quer) bzw. 360×640 (hoch) – nie ändern.
 * Gewählt wird der größte ganzzahlige Faktor in GERÄTE-Pixeln, damit jedes
 * Spielpixel exakt n×n echte Bildschirmpixel belegt (auch bei devicePixelRatio 2 oder 3).
 */
export const BASE_LANDSCAPE = { width: 640, height: 360 } as const;
export const BASE_PORTRAIT = { width: 360, height: 640 } as const;

export type Orientation = 'landscape' | 'portrait';

export interface PixelLayout {
  orientation: Orientation;
  /** interne Spielgröße in Spielpixeln */
  gameWidth: number;
  gameHeight: number;
  /** ganzzahliger Faktor: Gerätepixel pro Spielpixel */
  deviceZoom: number;
  /** Zoom in CSS-Pixeln (= deviceZoom / devicePixelRatio), geht an Phaser */
  cssZoom: number;
  /** angezeigte Canvas-Größe in CSS-Pixeln */
  cssWidth: number;
  cssHeight: number;
}

export function computeLayout(viewWidth: number, viewHeight: number, devicePixelRatio = 1): PixelLayout {
  const dpr = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const orientation: Orientation = viewHeight > viewWidth ? 'portrait' : 'landscape';
  const base = orientation === 'portrait' ? BASE_PORTRAIT : BASE_LANDSCAPE;
  const fit = Math.min((viewWidth * dpr) / base.width, (viewHeight * dpr) / base.height);
  // Kleine Toleranz gegen Rundungsfehler (z. B. 2.9999999)
  const deviceZoom = Math.max(1, Math.floor(fit + 1e-6));
  const cssZoom = deviceZoom / dpr;
  return {
    orientation,
    gameWidth: base.width,
    gameHeight: base.height,
    deviceZoom,
    cssZoom,
    cssWidth: base.width * cssZoom,
    cssHeight: base.height * cssZoom,
  };
}

/** Rundet Positionen auf ganze Spielpixel (Sprites und Kamera-Scroll). */
export function snap(value: number): number {
  return Math.round(value);
}
