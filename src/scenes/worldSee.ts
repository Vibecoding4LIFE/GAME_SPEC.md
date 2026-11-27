// src/scenes/worldSee.ts – Typen und reine Geometrie-Helfer für public/assets/worlds/<kuerzel>/world_<kuerzel>.json
// (Maßstab, Grundlinie, Kamera, Tönung). Ohne Phaser, damit es in Vitest testbar ist.
import type { DayPhase } from '../game/types';

export interface WorldLayer {
  id: string; datei: string; x: number; y: number; w: number; h: number; parallaxX: number; parallaxY: number;
  kachelbar: boolean; tiefe: number; tintGruppe: 'himmel' | 'oben' | 'unter'; tageszeit?: string;
  nurTageszeit?: string[]; nurWetter?: string[]; animation?: { key: string; frame: number; frames: number; fps: number };
}
export interface WorldDeko {
  frame?: string; anim?: string; x: number; y: number; anker?: string; tiefe: number; flipX?: boolean;
  bahn?: [number, number]; regen?: string; nurTag?: boolean; zone?: string;
}
export interface WorldSpawnZone {
  anim?: string; frame?: string; rect: [number, number, number, number]; nur?: string[]; ereignis?: string;
  wetter?: string[]; anzahl: number; steigt?: boolean; faellt?: boolean;
}
export interface PhaseLook {
  himmel: string;
  tint: { oben: string; unter: string; himmel: string };
  sonne: boolean;
  mond: boolean;
}
export interface WorldSee {
  version: number; welt: string; kuerzel: string;
  groesse: { w: number; h: number };
  pixelProMeter: number;
  oberflaecheY: number;
  maxTiefeM: number;
  grundTiefsterY: number;
  kamera: Record<'quer' | 'hoch', { scrollX: [number, number]; scrollY: [number, number] }>;
  ebenen: WorldLayer[];
  tiefenOrdnung: Record<string, number>;
  tageszeiten: Record<'morgen' | 'tag' | 'abend' | 'nacht', PhaseLook>;
  sonnenbahn: { x: [number, number]; yHoch: number; yHorizont: number };
  tiefenschichten: { name: string; minM: number; maxM: number; yMin: number; yMax: number; hudFarbe: string }[];
  seegrund: { polyline: [number, number][] };
  spielerplaetze: { id: string; typ: string; x: number; y: number; blick: string }[];
  deckung: { id: string; typ: string; x: number; y: number; w: number; h: number; tiefeM: [number, number] }[];
  futterplatz: { anim: string; anker: string };
  deko: WorldDeko[];
  spawnZonen: WorldSpawnZone[];
}

/** Tageszeit der Spiellogik → Schlüssel in world_see.json */
export const phaseKey = (p: DayPhase): keyof WorldSee['tageszeiten'] =>
  p.toLowerCase() as keyof WorldSee['tageszeiten'];

/** Tiefe (m) → Welt-y */
export const depthToY = (w: WorldSee, depthM: number): number => w.oberflaecheY + depthM * w.pixelProMeter;

/** Wurfweite (m) → Welt-x relativ zum Spielerplatz */
export const distanceToX = (w: WorldSee, originX: number, distanceM: number): number => originX + distanceM * w.pixelProMeter;

/** y der Grundlinie an Welt-x (lineare Interpolation der Polylinie) */
export function seabedY(w: WorldSee, x: number): number {
  const pl = w.seegrund.polyline;
  if (pl.length === 0) return w.grundTiefsterY;
  const first = pl[0] as [number, number];
  if (x <= first[0]) return first[1];
  for (let i = 1; i < pl.length; i++) {
    const [x1, y1] = pl[i] as [number, number];
    const [x0, y0] = pl[i - 1] as [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0);
  }
  return (pl[pl.length - 1] as [number, number])[1];
}

/** Grundtiefe in Metern an Welt-x */
export const bottomDepthAt = (w: WorldSee, x: number): number =>
  Math.max(0, (seabedY(w, x) - w.oberflaecheY) / w.pixelProMeter);

/**
 * Kamera-Ausschnitt (linke obere Ecke, ganze Spielpixel): folgt dem Ziel, Grenzen aus world_see.json.
 * Querformat: senkrecht ab 0 m mitlaufen; Hochformat: ganze Höhe sichtbar.
 */
export function cameraView(
  w: WorldSee, orientation: 'landscape' | 'portrait', viewW: number, viewH: number, targetX: number, targetY: number,
): { x: number; y: number } {
  const k = w.kamera[orientation === 'portrait' ? 'hoch' : 'quer'];
  const cx = Math.min(k.scrollX[1], Math.max(k.scrollX[0], targetX - viewW / 2));
  const cy = Math.min(k.scrollY[1], Math.max(k.scrollY[0], targetY - viewH / 2));
  return { x: Math.round(cx), y: Math.round(cy) };
}

/** Parallax ohne Bruchteile: Ebenen-x so, dass Bildschirm-x = round(-scroll × parallax) (B3). */
export const parallaxX = (scrollX: number, factor: number, baseX = 0): number =>
  baseX + scrollX - Math.round(scrollX * factor);

/** Startpositionen für kachelbare Ebenen (Breite w), die den Ausschnitt [scrollX, scrollX + viewW] abdecken. */
export function tileOffsets(layerX: number, w: number, scrollX: number, viewW: number): number[] {
  let start = layerX - Math.ceil((layerX - scrollX) / w) * w;
  if (start > scrollX) start -= w;
  const out: number[] = [];
  for (let x = start; x < scrollX + viewW; x += w) out.push(x);
  return out;
}

/** '#RRGGBB' → 0xRRGGBB */
export const hexToInt = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

/** Sonnen-/Mondposition auf der Bahn für einen Anteil 0…1 der Tageszeit-Hälfte (Parabel). */
export function celestialPos(w: WorldSee, t: number): { x: number; y: number } {
  const f = Math.min(1, Math.max(0, t));
  const x = w.sonnenbahn.x[0] + (w.sonnenbahn.x[1] - w.sonnenbahn.x[0]) * f;
  const arc = 1 - (2 * f - 1) ** 2;
  const y = w.sonnenbahn.yHorizont - (w.sonnenbahn.yHorizont - w.sonnenbahn.yHoch) * arc;
  return { x: Math.round(x), y: Math.round(y) };
}
