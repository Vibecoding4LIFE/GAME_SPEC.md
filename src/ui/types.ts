// src/ui/types.ts – gemeinsame Typen der HTML-Overlays (ohne DOM-Zugriff, testbar).
import type { FishData, FishId, Rarity } from '../data/types';

/** Größenklasse eines Fangs nach x (Teil D 1.10). Nicht zu verwechseln mit der Canvas-Klasse S…Boss. */
export const SIZE_TIERS = ['Winzling', 'Normal', 'Praechtig', 'Kapital', 'Riesig'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

/** Rechteck eines Frames im Atlas (Bildpixel). */
export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bildquelle + Frame-Rechteck. Wird nie geglättet und nur ganzzahlig skaliert gezeichnet. */
export interface SpriteSource {
  image: CanvasImageSource;
  frame: SpriteFrame;
}

/** Liefert zu einem Fisch das Fang-Sprite (oder null, solange der Atlas fehlt). */
export type SpriteResolver = (fish: FishData) => SpriteSource | null;

/** Grundform jeder Overlay-Komponente. */
export interface UiComponent<TShow, TUpdate = Partial<TShow>> {
  mount(parent: HTMLElement): void;
  show(data: TShow): void;
  update(data: TUpdate): void;
  hide(): void;
  destroy(): void;
  readonly visible: boolean;
}

// ------------------------------------------------------------------ Lexikon (D 1.12)

export type LexiconState = 'unknown' | 'seen' | 'caught';

export interface LexiconEntryState {
  state: LexiconState;
  /** Anzahl der Fänge dieser Art. */
  count: number;
  recordLengthCm?: number;
  recordWeightG?: number;
  /** Größte je gefangene Größenklasse (für ★★ Kapital / ★★★ Riesig). */
  bestTier?: SizeTier;
  /** Mindestens einmal schillernd gefangen (eigener Stern, zählt auch als ★★★). */
  shiny?: boolean;
  /** Optional vom Spielstand vorgegeben; sonst berechnet über `computeStars`. */
  stars?: 0 | 1 | 2 | 3;
}

export type LexiconStateMap = Partial<Record<FishId, LexiconEntryState>>;

// ------------------------------------------------------------------ Fang & Eimer (D 1.10, 1.11, 3.2)

export interface CatchInfo {
  fish: FishData;
  lengthCm: number;
  weightG: number;
  tier: SizeTier;
  shiny: boolean;
}

export interface CatchCardData extends CatchInfo {
  /** Erster Fang dieser Art → „NEU!“. */
  isNew: boolean;
  /** Neue Rekordlänge oder -gewicht für diese Art. */
  isRecord?: boolean;
  points: number;
  sprite: SpriteSource | null;
  /** Aquarium voll oder in Phase 1 noch nicht da → „Behalten“ gesperrt. */
  keepDisabled?: boolean;
}

export interface BucketItem extends CatchInfo {
  /** Eindeutige ID dieses einen Fangs (nicht der Art). */
  uid: string;
  /** Verkaufswert in Münzen (Basispunkte × Größenfaktor, Schillernd ×3 – rechnet die Spiellogik). */
  value: number;
  sprite?: SpriteSource | null;
}

export type { FishData, FishId, Rarity };
