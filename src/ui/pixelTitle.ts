// src/ui/pixelTitle.ts – Titel-Schriftzug als echte Pixel-Grafik: Pixelify Sans in Grundgröße (1 Schriftpixel = 1 Bildpixel)
// wird zur 1-Bit-Maske, dann mehrlagig eingefärbt (Schlagschatten, Tinten-Kontur, Messing-Verlauf, Glanzkante) und
// ganzzahlig in Gerätepixeln hochskaliert. Farben aus art_src/palettes/hud.json (Messing, Holz, Tinte, Pergament).

/** Grundgröße: Pixelify Sans hat ~91 Einheiten pro Schriftpixel bei 1000 UPM → 11 px ≈ 1 Pixel pro Schriftpixel. */
const BASE_PX = 11;
const PAD = 4;

const INK = [42, 30, 26];
const SHADOW = [71, 28, 12];
const RAMP = [[255, 227, 141], [230, 198, 104], [212, 166, 64], [191, 136, 35]]; // oben hell → unten dunkel
const SHINE = [255, 241, 199];
const DEEP = [164, 109, 31];

export interface PixelTitleOptions {
  maxCssWidth: number;
  maxCssHeight: number;
  dpr?: number;
  /** Höchstens so viele Gerätepixel pro Bildpixel. */
  maxScale?: number;
}

/** Ganzzahliger Faktor (Gerätepixel pro Bildpixel), mindestens 1. */
export function titleScale(w: number, h: number, maxCssW: number, maxCssH: number, dpr: number, maxScale = 24): number {
  return Math.max(1, Math.min(maxScale, Math.floor(Math.min((maxCssW * dpr) / w, (maxCssH * dpr) / h))));
}

/**
 * Baut die eingefärbte Pixelgrafik aus einer 1-Bit-Maske (reine Logik, testbar).
 * `mask` hat die Größe w×h (1 = Schrift). Ergebnis: RGBA, Größe w×(h+2) (Platz für den Schatten).
 */
export function colorizeTitle(mask: Uint8Array, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const H = h + 2;
  const out = new Uint8ClampedArray(new ArrayBuffer(w * H * 4));
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? (mask[y * w + x] ?? 0) : 0);
  const outline = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) return true;
    return false;
  };
  // Zeilenbereich der Schrift für den Verlauf
  let top = h;
  let bottom = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const span = Math.max(1, bottom - top + 1);
  const put = (x: number, y: number, c: number[]): void => {
    const i = (y * w + x) * 4;
    out[i] = c[0] ?? 0; out[i + 1] = c[1] ?? 0; out[i + 2] = c[2] ?? 0; out[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y)) {
        const t = (y - top) / span;
        let c = RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))] ?? SHINE;
        if (!at(x, y - 1)) c = SHINE; // Glanzkante oben
        else if (!at(x, y + 1)) c = DEEP; // dunkle Unterkante
        put(x, y, c);
      } else if (outline(x, y)) put(x, y, INK);
      else if (outline(x, y - 2) || outline(x, y - 1)) put(x, y, SHADOW); // Schlagschatten 2 px nach unten
    }
  }
  return out;
}

/** Zeichnet `text` als Pixel-Schriftzug in `canvas`. Gibt false zurück, wenn kein 2D-Kontext da ist. */
export function renderPixelTitle(canvas: HTMLCanvasElement, text: string, o: PixelTitleOptions): boolean {
  const dpr = o.dpr ?? (window.devicePixelRatio || 1);
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return false;
  // Normalschnitt: Fett schließt bei 11 px die Öffnungen (C wird zu O); die Dicke kommt stattdessen aus der Verbreiterung unten.
  const font = `400 ${BASE_PX}px 'Pixelify Sans'`;
  probe.font = font;
  // Jedes Zeichen auf ganze Pixel setzen, damit die Strichstärken gleich bleiben
  // +1 px je Zeichen: Platz für die waagerechte Verbreiterung (2 px breite Senkrechte = kräftiger Schriftzug)
  const glyphs = [...text].map((ch) => ({ ch, adv: Math.max(1, Math.round(probe.measureText(ch).width)) + 1 }));
  const textW = glyphs.reduce((s, g) => s + g.adv, 0);
  const w = textW + PAD * 2;
  const h = BASE_PX + PAD * 2;
  const m = document.createElement('canvas');
  m.width = w;
  m.height = h;
  const mctx = m.getContext('2d', { willReadFrequently: true });
  if (!mctx) return false;
  mctx.font = font;
  mctx.textBaseline = 'alphabetic';
  mctx.fillStyle = '#000';
  let x = PAD;
  const baseline = PAD + Math.round(BASE_PX * 0.92);
  for (const g of glyphs) {
    mctx.fillText(g.ch, x, baseline);
    x += g.adv;
  }
  const a = mctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = (a[i * 4 + 3] ?? 0) >= 110 ? 1 : 0;
  // Senkrechte Striche um 1 px nach rechts verbreitern
  for (let y = 0; y < h; y++) for (let x = w - 1; x > 0; x--) if (mask[y * w + x - 1]) mask[y * w + x] = 1;
  const rgba = colorizeTitle(mask, w, h);
  const H = h + 2;
  const small = document.createElement('canvas');
  small.width = w;
  small.height = H;
  const sctx = small.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!sctx || !ctx) return false;
  sctx.putImageData(new ImageData(rgba, w, H), 0, 0);
  const z = titleScale(w, H, o.maxCssWidth, o.maxCssHeight, dpr, o.maxScale);
  canvas.width = w * z;
  canvas.height = H * z;
  canvas.style.width = `${(w * z) / dpr}px`;
  canvas.style.height = `${(H * z) / dpr}px`;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  return true;
}
