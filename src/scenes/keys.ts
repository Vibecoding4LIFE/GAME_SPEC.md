/** Zentrale Schlüssel für Szenen, Cache und Texturen. */
export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  testbecken: 'Testbecken',
} as const;

export const CACHE = {
  fishDb: 'fish_db',
  worlds: 'worlds',
} as const;

export const fishAtlasKey = (kuerzel: string): string => `atlas_fish_${kuerzel}`;
