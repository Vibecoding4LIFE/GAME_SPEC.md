/** Zentrale Schlüssel für Szenen, Cache und Texturen. */
export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  testbecken: 'Testbecken',
  welt: 'Welt',
} as const;

export const CACHE = {
  fishDb: 'fish_db',
  worlds: 'worlds',
  gear: 'gear',
  balancing: 'balancing',
  worldArt: (kuerzel: string) => `world_${kuerzel}`,
} as const;

export const fishAtlasKey = (kuerzel: string): string => `atlas_fish_${kuerzel}`;
export const worldAtlasKey = (kuerzel: string): string => `atlas_world_${kuerzel}`;
export const FIGURES_ATLAS = 'atlas_figures';
export const HUD_ATLAS = 'atlas_hud';
export const layerKey = (kuerzel: string, id: string): string => `layer_${kuerzel}_${id}`;

/** Startszene aus der Adresse: `?szene=testbecken` öffnet die Phase-0-Testszene, sonst die Welt. */
export function startSceneFromUrl(search: string): typeof SCENES.testbecken | typeof SCENES.welt {
  return new URLSearchParams(search).get('szene') === 'testbecken' ? SCENES.testbecken : SCENES.welt;
}
