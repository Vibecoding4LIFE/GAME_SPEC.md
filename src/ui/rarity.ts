// src/ui/rarity.ts – Seltenheit (B5) und Größenklassen (D 1.10): Farbe + Symbol + Text, nie nur Farbe.
import { RARITIES, type Rarity } from '../data/types';
import type { IconName } from './icons';
import type { SizeTier } from './types';

export interface RarityStyle {
  /** Farbe aus B5 (Rahmen, Chip-Hintergrund). */
  color: string;
  /** Pixel-Symbol für Farbenblinde (●, ▲, ◆, Krone, ★). */
  icon: IconName;
  /** Unicode-Ersatz für reine Texte (Fang-Feed, Meldungen). */
  glyph: string;
  /** Rang 0–4, z. B. für Sortierung oder Nachfrage beim Verkaufen. */
  rank: number;
  nameKey: string;
}

export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  Gewoehnlich: { color: '#B0B7C3', icon: 'rarCommon', glyph: '●', rank: 0, nameKey: 'rarity.Gewoehnlich' },
  Ungewoehnlich: { color: '#5BD16B', icon: 'rarUncommon', glyph: '▲', rank: 1, nameKey: 'rarity.Ungewoehnlich' },
  Selten: { color: '#3FA9F5', icon: 'rarRare', glyph: '◆', rank: 2, nameKey: 'rarity.Selten' },
  Episch: { color: '#A86BFF', icon: 'rarEpic', glyph: '♛', rank: 3, nameKey: 'rarity.Episch' },
  Legendaer: { color: '#FFC83D', icon: 'rarLegendary', glyph: '★', rank: 4, nameKey: 'rarity.Legendaer' },
};

export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);

export interface SizeTierStyle {
  /** Etikett-Text oder null (Normal zeigt nichts). */
  labelKey: string | null;
  /** Rahmenart der Fang-Karte. */
  frame: 'none' | 'silver' | 'gold' | 'giant';
  /** Zusätzliche Zoomstufe in der Fang-Präsentation (Riesig +1, D 1.10). */
  extraZoom: number;
  /** Punktefaktor laut D 1.10 (nur zur Anzeige; rechnen tut die Spiellogik). */
  factor: number;
}

export const SIZE_TIER_STYLE: Record<SizeTier, SizeTierStyle> = {
  Winzling: { labelKey: 'size.Winzling', frame: 'none', extraZoom: 0, factor: 0.8 },
  Normal: { labelKey: null, frame: 'none', extraZoom: 0, factor: 1 },
  Praechtig: { labelKey: 'size.Praechtig', frame: 'silver', extraZoom: 0, factor: 1.2 },
  Kapital: { labelKey: 'size.Kapital', frame: 'gold', extraZoom: 0, factor: 1.35 },
  Riesig: { labelKey: 'size.Riesig', frame: 'giant', extraZoom: 1, factor: 1.5 },
};

/**
 * Soll „Alles verkaufen“ nachfragen? Ja, sobald ein wertvoller Fang dabei ist
 * (Episch/Legendär, Schillernd, Kapital oder Riesig) – damit niemand den Wels aus Versehen verkauft.
 */
export function needsSellConfirm(items: readonly { fish: { rarity: Rarity }; shiny: boolean; tier: SizeTier }[]): boolean {
  return items.some((i) => RARITY_STYLE[i.fish.rarity].rank >= 3 || i.shiny || i.tier === 'Kapital' || i.tier === 'Riesig');
}
