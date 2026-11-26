/**
 * Senkrechter Farbverlauf mit geordnetem 2×2-Bayer-Dithering (Style Guide F1: nur Bayer, nie Fehlerdiffusion).
 * Liefert RGBA-Pixel; reine Logik ohne Browser-API.
 */
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
] as const;

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const v = Number.parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Farbe an Zeile y (0..height-1) mit Bayer-Schwelle an Spalte x. */
export function gradientColorAt(x: number, y: number, height: number, stops: readonly Rgb[]): Rgb {
  if (stops.length === 0) throw new Error('mindestens eine Farbe nötig');
  if (stops.length === 1 || height <= 1) return stops[0] as Rgb;
  const pos = (y / (height - 1)) * (stops.length - 1);
  const seg = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - seg;
  const threshold = (BAYER_2X2[y & 1]![x & 1]! + 0.5) / 4;
  return (f > threshold ? stops[seg + 1] : stops[seg]) as Rgb;
}

export function ditherGradient(width: number, height: number, stops: readonly Rgb[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = gradientColorAt(x, y, height, stops);
      const i = (y * width + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}
