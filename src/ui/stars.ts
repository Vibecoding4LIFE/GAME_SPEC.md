// src/ui/stars.ts – Sterne pro Art und Weltfortschritt (D 1.12). Reine Logik, testbar.
import type { FishData } from '../data/types';
import type { LexiconEntryState, LexiconStateMap } from './types';

/**
 * ★ gefangen · ★★ 5× gefangen oder einmal „Kapital“ · ★★★ „Riesig“ oder Schillernd gefangen.
 * Ein vom Spielstand gesetzter Wert (`stars`) hat Vorrang, wird aber nie unter das Berechnete gesenkt.
 */
export function computeStars(e: LexiconEntryState | undefined): 0 | 1 | 2 | 3 {
  if (!e || e.state !== 'caught' || e.count < 1) return 0;
  let s: 0 | 1 | 2 | 3 = 1;
  if (e.count >= 5 || e.bestTier === 'Kapital') s = 2;
  if (e.bestTier === 'Riesig' || e.shiny) s = 3;
  return e.stars !== undefined && e.stars > s ? e.stars : s;
}

export interface WorldProgress {
  caught: number;
  seen: number;
  total: number;
  /** 0…1 */
  ratio: number;
}

/** Zählt gefangene und gesichtete Arten einer Fischliste (z. B. die 20 einer Welt). */
export function worldProgress(fish: readonly Pick<FishData, 'id'>[], entries: LexiconStateMap): WorldProgress {
  let caught = 0;
  let seen = 0;
  for (const f of fish) {
    const s = entries[f.id]?.state;
    if (s === 'caught') caught++;
    else if (s === 'seen') seen++;
  }
  const total = fish.length;
  return { caught, seen, total, ratio: total ? caught / total : 0 };
}

/**
 * Pixelmaske für den Fortschritts-Kreis (quadratisch, `size`×`size`):
 * 0 = leer, 1 = Segment offen, 2 = Segment erreicht. Ein Segment pro Fisch, mit 1-px-Fugen.
 */
export function ringMask(size: number, segments: number, lit: number, thickness = 3): Uint8Array {
  const out = new Uint8Array(size * size);
  const c = (size - 1) / 2;
  const outer = size / 2 - 0.5;
  const inner = outer - thickness;
  const segAngle = (Math.PI * 2) / Math.max(1, segments);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > outer + 0.25 || r < inner - 0.25) continue;
      // 0 rad = oben, im Uhrzeigersinn
      let a = Math.atan2(dx, -dy);
      if (a < 0) a += Math.PI * 2;
      const idx = Math.min(segments - 1, Math.floor(a / segAngle));
      const within = (a - idx * segAngle) * r; // Bogenlänge in px innerhalb des Segments
      if (segments > 1 && within < 0.9) continue; // Fuge
      out[y * size + x] = idx < lit ? 2 : 1;
    }
  }
  return out;
}
