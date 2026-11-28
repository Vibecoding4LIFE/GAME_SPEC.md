// src/scenes/hudLayout.ts – Lage der Phaser-HUD-Elemente je Format, mit Safe-Areas und Platz für die HTML-Leisten.
// Rein rechnerisch (testbar). Alle Rückgaben sind ganze Spielpixel.
import type { PixelLayout } from '../core/pixelScale';

/** Was HTML belegt bzw. was das Gerät abdeckt – in CSS-Pixeln. */
export interface ScreenReserve {
  dpr: number;
  safe: { top: number; right: number; bottom: number; left: number };
  /** Höhe der HTML-Leiste oben (Münzen, Knöpfe) */
  topBarCss: number;
  /** Platz für den Touch-Knopf unten rechts (0, wenn keine Touch-Knöpfe) */
  touchButtonCss: number;
  /** Tastenhinweise oben links (PC) */
  keyHints?: boolean;
}

export interface Insets { top: number; right: number; bottom: number; left: number }

/** CSS-Abstand vom Fensterrand → Abstand vom Rand der Spielfläche in Spielpixeln (Rand außerhalb zählt mit). */
export function cssInsetToGame(cssFromEdge: number, dpr: number, offsetDevice: number, zoom: number): number {
  return Math.max(0, Math.ceil((cssFromEdge * dpr - offsetDevice) / zoom));
}

export function hudInsets(l: PixelLayout, r: ScreenReserve): Insets {
  const offR = l.bufferWidth - l.offsetX - l.gameWidth * l.deviceZoom;
  const offB = l.bufferHeight - l.offsetY - l.gameHeight * l.deviceZoom;
  return {
    top: cssInsetToGame(r.safe.top + r.topBarCss, r.dpr, l.offsetY, l.deviceZoom),
    right: cssInsetToGame(r.safe.right, r.dpr, offR, l.deviceZoom),
    bottom: cssInsetToGame(r.safe.bottom, r.dpr, offB, l.deviceZoom),
    left: cssInsetToGame(r.safe.left, r.dpr, l.offsetX, l.deviceZoom),
  };
}

export interface Box { x: number; y: number }

export interface HudLayout {
  /** links mittig: Wurfkraft bzw. Tiefe (obere linke Ecke) */
  gauge: Box;
  /** oben rechts: Uhr, Wetter, Fridolin, Wind (rechte obere Ecke) */
  weather: Box;
  /** unten mittig: Spannung (obere linke Ecke des Rahmens) */
  tension: Box;
  /** über der Spannung: Distanz */
  distance: Box;
  /** Ausdauer-Flossen (linker Rand) */
  stamina: Box;
  /** Richtungspfeil (Mitte) */
  arrow: Box;
  /** Meldungen (Mitte oben) */
  banner: Box;
}

export interface HudSizes {
  gaugeW: number; gaugeH: number; tensionW: number; tensionH: number; distanceW: number; distanceH: number;
  staminaW: number; staminaH: number; iconH: number; arrowW: number; gap: number; touchButtonGame: number;
  /** Höhe der Beschriftungszeile über dem Spannungsbalken („Spannung“); 0 = keine */
  labelH?: number;
  /** oben links reservierte Zeile (Tastenhinweise), damit die Anzeige links nicht darunter rutscht */
  topLineH?: number;
}

/** Querformat: Spannung unten mittig. Hochformat: Spannung über dem Touch-Knopf, Anzeigen kompakter. */
export function hudLayout(l: PixelLayout, ins: Insets, s: HudSizes): HudLayout {
  const W = l.gameWidth;
  const H = l.gameHeight;
  const g = s.gap;
  const portrait = l.orientation === 'portrait';
  const bottomFree = portrait ? Math.max(ins.bottom, s.touchButtonGame) : ins.bottom;
  const tensionY = H - bottomFree - g - s.tensionH;
  const tensionX = Math.round((W - s.tensionW) / 2);
  // von unten gestapelt: Spannung → Beschriftung → Distanz (Fisch-Symbol darüber) → Ausdauer → Richtungspfeil
  const distanceY = tensionY - g - (s.labelH ?? 0) - s.distanceH;
  const staminaY = distanceY - g - s.iconH - g - s.staminaH;
  return {
    gauge: { x: ins.left + g, y: Math.max(ins.top + g + (s.topLineH ?? 0), Math.round((H - s.gaugeH) / 2)) },
    weather: { x: W - ins.right - g, y: ins.top + g },
    tension: { x: tensionX, y: tensionY },
    distance: { x: Math.round((W - s.distanceW) / 2), y: distanceY },
    stamina: { x: Math.round((W - s.staminaW) / 2), y: staminaY },
    arrow: { x: Math.round(W / 2), y: staminaY - g - Math.ceil(s.arrowW / 2) },
    banner: { x: Math.round(W / 2), y: ins.top + g * 2 + (portrait ? s.gaugeW : 0) },
  };
}

/**
 * Zoom der HUD-Kamera (QA M-3): ein ganzzahliges Vielfaches des Weltzooms, damit HUD-Pixel exakt auf dem Weltraster
 * liegen (B3), mindestens 2 Gerätepixel und mindestens `minCssPx` CSS-Pixel je HUD-Pixel – solange die HUD-Fläche
 * nicht kleiner als `min` (Spielpixel) wird. Bei normalen Zoomstufen gleich dem Weltzoom.
 */
export function hudZoom(
  l: PixelLayout, dpr: number, minCssPx: number, min: { landscape: { w: number; h: number }; portrait: { w: number; h: number } },
): number {
  const dz = l.deviceZoom;
  const devW = l.gameWidth * dz;
  const devH = l.gameHeight * dz;
  const want = Math.max(dz, 2, Math.ceil(minCssPx * dpr - 1e-9));
  const m = l.orientation === 'portrait' ? min.portrait : min.landscape;
  let k = Math.max(1, Math.ceil(want / dz));
  while (k > 1 && (devW / (dz * k) < m.w || devH / (dz * k) < m.h)) k--;
  return dz * k;
}

/**
 * Layout der HUD-Kamera bei Zoom `hz`: gleiche Fläche in Gerätepixeln wie die Welt, aber weniger (größere) HUD-Pixel.
 * Breite/Höhe gerade (Kamera-Mitte auf ganzen Pixeln), Rest mittig und auf das Weltraster ausgerichtet.
 */
export function hudSubLayout(l: PixelLayout, hz: number): PixelLayout {
  if (hz === l.deviceZoom) return l;
  const dz = l.deviceZoom;
  const devW = l.gameWidth * dz;
  const devH = l.gameHeight * dz;
  const gw = Math.floor(devW / hz / 2) * 2;
  const gh = Math.floor(devH / hz / 2) * 2;
  const padX = Math.floor((devW - gw * hz) / 2 / dz) * dz;
  const padY = Math.floor((devH - gh * hz) / 2 / dz) * dz;
  return { ...l, gameWidth: gw, gameHeight: gh, deviceZoom: hz, offsetX: l.offsetX + padX, offsetY: l.offsetY + padY };
}
