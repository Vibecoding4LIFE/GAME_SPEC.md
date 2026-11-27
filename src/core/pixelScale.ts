/**
 * Pixel-Perfect-Grundlage (GAME_SPEC B3).
 *
 * Interne Spielwelt 640×360 (quer) bzw. 360×640 (hoch) – nie ändern.
 * Der Canvas füllt das ganze Fenster und sein Puffer hat exakt die Größe in GERÄTE-Pixeln
 * (gemessen mit ResizeObserver/devicePixelContentBoxSize). Die Spielwelt wird mit einem
 * ganzzahligen Faktor `deviceZoom` hineingezeichnet und auf ganze Gerätepixel zentriert.
 * So belegt jedes Spielpixel genau deviceZoom × deviceZoom echte Bildschirmpixel – auch bei
 * krummen devicePixelRatio-Werten wie 2,625 (Android), wo eine CSS-Skalierung Spalten verschluckt.
 * Der Rest ist Rand in Weltfarbe (transparenter Canvas über dem Seitenhintergrund).
 */
export const BASE_LANDSCAPE = { width: 640, height: 360 } as const;
export const BASE_PORTRAIT = { width: 360, height: 640 } as const;

export type Orientation = 'landscape' | 'portrait';

export interface PixelLayout {
  orientation: Orientation;
  /** logische Spielgröße in Spielpixeln (Koordinatensystem aller Szenen) */
  gameWidth: number;
  gameHeight: number;
  /** ganzzahliger Faktor: Gerätepixel pro Spielpixel */
  deviceZoom: number;
  /** Canvas-Puffer in Gerätepixeln (= ganzes Fenster) */
  bufferWidth: number;
  bufferHeight: number;
  /** linke obere Ecke der Spielfläche im Puffer, ganze Gerätepixel */
  offsetX: number;
  offsetY: number;
}

/**
 * @param bufferWidth  Breite des Canvas in Gerätepixeln
 * @param bufferHeight Höhe des Canvas in Gerätepixeln
 */
export function computeLayout(bufferWidth: number, bufferHeight: number): PixelLayout {
  const bw = Math.max(1, Math.round(bufferWidth));
  const bh = Math.max(1, Math.round(bufferHeight));
  const orientation: Orientation = bh > bw ? 'portrait' : 'landscape';
  const base = orientation === 'portrait' ? BASE_PORTRAIT : BASE_LANDSCAPE;
  const deviceZoom = Math.max(1, Math.floor(Math.min(bw / base.width, bh / base.height)));
  return {
    orientation,
    gameWidth: base.width,
    gameHeight: base.height,
    deviceZoom,
    bufferWidth: bw,
    bufferHeight: bh,
    offsetX: Math.floor((bw - base.width * deviceZoom) / 2),
    offsetY: Math.floor((bh - base.height * deviceZoom) / 2),
  };
}

/** Fallback, wenn der Browser devicePixelContentBoxSize nicht kennt (z. B. Safari: dort ist DPR ganzzahlig). */
export function cssToDevicePixels(cssSize: number, devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  return Math.round(cssSize * dpr);
}

/** Rundet Positionen auf ganze Spielpixel (Sprites und Kamera-Scroll). */
export function snap(value: number): number {
  return Math.round(value);
}
