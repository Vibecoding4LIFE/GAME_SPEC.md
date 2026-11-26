// src/data/types.ts – übernommen aus GAME_SPEC.md Teil G 6.2–6.5 (Vertrag zwischen Spiel, Daten-Pipeline und Edge Functions)
export const RARITIES = ['Gewoehnlich', 'Ungewoehnlich', 'Selten', 'Episch', 'Legendaer'] as const;
export type Rarity = (typeof RARITIES)[number];

export const SIZE_CLASSES = ['S', 'M', 'L', 'XL', 'Boss'] as const;   // 32x16, 64x32, 96x48, 128x64, 256x128
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const FIGHT_BEHAVIORS = [
  'Ruhig', 'Zappler', 'Sprinter', 'Taucher', 'Springer', 'Zickzack', 'Brocken',
  'Trickser', 'Versteckspieler', 'Aufblaeher', 'Stromer', 'Blinker', 'Hitzkopf',
] as const;
export type FightBehavior = (typeof FIGHT_BEHAVIORS)[number];

export const TIMES_OF_DAY = ['Morgen', 'Tag', 'Abend', 'Nacht', 'Immer'] as const;   // Flags
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

// Generische Wetter-Schlüssel. Jede Welt gibt ihnen eigene Anzeigenamen
// (z. B. Sonnig = "Klar" im Frostfjord, "Ruhige See" in der Tiefe, "Ruhig" in der Glutgrotte).
export const WEATHERS = [
  'Sonnig', 'Bewoelkt', 'Regen', 'Gewitter', 'Nebel',
  'Schnee', 'Schneesturm', 'Sturm', 'Duenung',
  'Aschenregen', 'Dampfnebel', 'Erdbeben', 'Alle',
] as const;                                                                          // Flags
export type Weather = (typeof WEATHERS)[number];

export const WORLD_EVENTS = [
  'Keins', 'Vollmond', 'Sommergewitter', 'Mueckenschwarm',                 // W1
  'Flut', 'Ebbe', 'Korallenbluete', 'DelfinBesuch',                        // W2
  'Polarlicht', 'Walgesang', 'Eisbergkalbung',                             // W3
  'Meeresschnee', 'BiolumineszenzWelle', 'SchwarzerRaucher', 'Walfall',    // W4
  'Ausbruch', 'GrosserAusbruch', 'Runennacht',                             // W5
] as const;
export type WorldEvent = (typeof WORLD_EVENTS)[number];

export const HORIZONTAL_ZONES = ['Ufer', 'Freiwasser', 'Kante', 'Alle'] as const;    // Flags
export type HorizontalZone = (typeof HORIZONTAL_ZONES)[number];

export const LINE_PROTECTIONS = ['Kaelte', 'Druck', 'Hitze'] as const;              // Flags
export type LineProtection = (typeof LINE_PROTECTIONS)[number];

export const WORLD_MECHANICS = [
  'HaengerUndFutterplatz', 'StroemungUndGezeiten', 'EisloecherUndFrost', 'DunkelheitUndDruck', 'HitzeUndAusbrueche',
] as const;
export type WorldMechanic = (typeof WORLD_MECHANICS)[number];

export const BOSS_SPECIALS = [
  'Keine', 'KrautHaenger', 'Blitzsprung',                 // Barnabas
  'StroemungsWirbel', 'WanderndeZone', 'Salto',           // Coralina
  'EislochZufrieren', 'Tiefensog', 'Frostatem',           // Grimmbart
  'DreiZonen', 'Lichtblitz', 'Schlund',                   // Lumina
  'Feuerodem', 'Lavabomben', 'Drachenzorn',               // Ignaris
] as const;
export type BossSpecial = (typeof BOSS_SPECIALS)[number];

export const ROD_ABILITIES = [
  'Keine', 'TaucherKonter', 'WindImmun', 'StarkerKonter', 'HaengerLeicht', 'StroemungHalb',
  'KaelteImmun', 'LampePlusEins', 'HitzeMinus30', 'SchillerndGlobal',
] as const;
export type RodAbility = (typeof ROD_ABILITIES)[number];

export const UNLOCK_SOURCES = ['Start', 'Shop', 'Sammlung', 'Komplett'] as const;
export type UnlockSource = (typeof UNLOCK_SOURCES)[number];

// ID-Typen
export type FishId = `F${string}`;   export type WorldId = `W${1 | 2 | 3 | 4 | 5}`;
export type RodId = string;          export type LineId = string;
export type ReelId = string;         export type BaitId = string;
export type Size = { w: number; h: number };
export type Range = { min: number; max: number };

export interface FishData {
  // Identität
  id: FishId;                     // "F001"
  lexiconNumber: number;          // 1..100
  nameKey: string;                // "fish.001.name"  → "Rotauge"
  displayNameDe: string;          // Fallback / Debug-Anzeige
  speciesBasis: string;           // "Rutilus rutilus" oder "Riesenhecht"
  isFantasy: boolean;
  world: WorldId;
  rarity: Rarity;
  isBoss: boolean;
  lexiconKey: string;             // "fish.001.lexicon" (Witz-/Infotext)
  hintKey: string;                // "fish.001.hint"   ("Gesichtet"-Hinweis)

  // Darstellung (Frame-Namen im Fisch-Atlas bzw. PNG-Pfade)
  sizeClass: SizeClass;
  canvasSize: Size;               // z. B. {w:32,h:16}; Boss {w:256,h:128}
  swimFrames: string[];           // fish_001_swim_0 … _5 (6 Frames)
  struggleFrames: string[];       // Drill-Zappeln
  catchSprite: string;            // Fang-Präsentation (Blobfisch: andere Form!)
  altSprite?: string;             // aufgeblasen / Segel hoch / Kiefer vor (optional)
  silhouette: string;             // automatisch aus Alpha erzeugt
  shinyLut: string;               // 256x1-PNG, Palette-Swap-LUT (Teil F)
  emissionMask?: string;          // nur Leuchtpixel (W4/W5, Glühwürmchen-Barsch …)
  glowsInDark: boolean;
  artBriefDe: string;             // Pixel-Art-Beschreibung aus der Tabelle
  shinyBriefDe: string;

  // Größe & Gewicht
  lengthMinCm: number;
  lengthMaxCm: number;
  weightFactorK: number;          // Gewicht(g) = k × Länge(cm)^3; Standard 0.011

  // Spawn
  depthMinM: number;
  depthMaxM: number;
  zones: HorizontalZone[];        // Standard ["Alle"]
  timeMask: TimeOfDay[];          // Standard ["Immer"]
  requiredWeather: Weather[];     // Pflicht (sonst Gewicht 0); Standard ["Alle"]
  preferredWeather: Weather[];    // ×2; Standard []
  requiredEvent: WorldEvent;      // Pflicht-Ereignis; Standard "Keins"
  preferredEvent: WorldEvent;     // ×2; Standard "Keins"
  favoriteBaits: BaitId[];        // ×2
  dislikedBaits: BaitId[];        // ×0,3
  spawnWeightOverride: number;    // <0 = Standard aus Seltenheit; Standard -1
  schooling: boolean;
  schoolSize: Range;              // Standard {min:1,max:1}

  // Biss
  nibbleMin: number;              // Standard 0
  nibbleMax: number;              // Standard 2
  biteWindowBonusS: number;       // zusätzlich zur Seltenheits-Regel; Standard 0
  hasFakeBites: boolean;          // Trickser / Täuschlichter
  isToothed: boolean;             // Stahlvorfach nötig

  // Drill
  primaryBehavior: FightBehavior;
  hasSecondaryBehavior: boolean;
  secondaryBehavior?: FightBehavior;
  secondaryAtStamina: number;     // 0..1; Standard 0.5
  strength: number;               // 1..10; Standard 3
  staminaOverrideS: number;       // <0 = aus Seltenheit × Größe; Standard -1
  greenZoneModifier: number;      // z. B. -0.3 beim Zuckerwatte-Seepferdchen; Standard 0
  bossPhases: BossPhase[];        // nur Bosse

  // Wert
  basePoints: number;             // = Basis-Verkaufswert
  xpOverride: number;             // <0 = aus Seltenheit; Standard -1
}

export interface BossPhase {
  nameKey: string;                // "boss.020.phase1" → "Kraftprobe"
  hpFrom: number;                 // 0..1, Phase gilt von hpFrom bis hpTo; Standard 1
  hpTo: number;                   // 0..1; Standard 0.7
  behaviors: FightBehavior[];
  special: BossSpecial;
  strength: number;               // Standard 8
  telegraphKey: string;           // Ansage-Text ("Barnabas zieht ins Kraut!")
}

export interface WorldData {
  // Identität
  id: WorldId;                    // "W1"
  index: number;                  // 1..5
  nameKey: string;                // "world.1.name" → "Sonnenspiegelsee"
  themeKey: string;
  coinFactor: number;             // 1.0 / 1.5 / 2.0 / 2.6 / 3.2

  // Optik
  leadPalette: string[];          // 8 Hex-Farben: die Leitfarben aus Abschnitt 4
  fullPalette: string;            // PNG-Pfad, 24–32 Farben, Rampen
  shinyRuleKey: string;           // "Mondlicht", "Neon", …
  depthLayers: DepthLayer[];
  maxDepthM: number;
  uferEndM: number;               // horizontale Zonen (Wurfweite); Standard 6
  freiwasserEndM: number;         // Standard 15
  background: string;             // Key der Parallax-Ebenen
  ambient: string[];              // Keys: Enten, Schildkröten, Robben …
  playerSpots: PlayerSpot[];      // genau 4

  // Wetter & Ereignisse
  weatherTable: WeatherEntry[];
  events: EventEntry[];

  // Spezialmechanik
  mechanic: WorldMechanic;
  mechanicSettings: Record<string, number | boolean>;   // z. B. Strömungs-, Eisloch-Einstellungen

  // Audio (Keys der Audiodateien)
  musicMorgen: string; musicTag: string; musicAbend: string; musicNacht: string;
  musicStorm: string; musicEvent: string; musicBoss: string; musicFinale: string;
  ambienceLoop: string;

  // Inhalt
  fish: FishId[];                 // genau 20
  boss: FishId;
  worldRod: RodId;                // Belohnung 20/20

  // Freischaltung
  previousWorld: WorldId | null;
  requiredSpeciesFromPrevious: number;   // Standard 12
  speciesInsteadOfBoss: number;          // Standard 16
  requiredReputation: number;
  ticketPrice: number;
  requiredGear: string[];         // IDs von Schnur / Rolle / Zubehör
  recommendedTier: number;        // Deckel im Modus "Ausgeglichen"

  // Sammlung
  collectionRewards: CollectionReward[];   // 5, 10, 15, 20, alle Schillernd
}

export interface DepthLayer {
  nameKey: string; minM: number; maxM: number;
  metersPerScreen: number;        // nicht-lineares Scrollen (Welt 4)
  backgroundSlice: string;        // Atlas-Frame
}

export interface PlayerSpot { position: { x: number; y: number }; isBoat: boolean; iceHoles: number }

export interface WeatherEntry {
  weather: Weather[]; weight: number; displayNameKey: string;
  windStrength: number; biteRateMod: number;   // Standard 1
}

export interface EventEntry {
  evt: WorldEvent; chancePerCheck: number; checkIntervalS: number;   // Standard 180
  durationS: number;                           // Standard 60
  allowedTimes: TimeOfDay[];                   // Standard ["Immer"]
  biteRateMod: number; epicMod: number; commonMod: number;           // je Standard 1
}

export interface CollectionReward {
  speciesRequired: number;        // 5/10/15/20; 21 = "alle Schillernd"
  coins: number; pearls: number;
  items: string[];                // IDs: Köder, Hut, Pose, Rute, Bootskin …
  titleKey: string;               // "title.w1" → "Seeflüsterer/in"
  shinyChanceBonus: number;       // Welt-Abzeichen: 1/200 statt 1/250
}

export interface RodData {
  id: RodId;                      // "R01", "RW1", "RG"
  nameKey: string;                // "rod.r01.name" → "Opas Bambusrute"
  tier: number;                   // 1..6 (Ausgleichsmodus deckelt hierauf)
  source: UnlockSource;
  priceCoins: number;
  pricePearls: number;
  requiredReputation: number;

  // Wurf
  castMaxDistanceM: number;       // Standard 20
  castCycleS: number;             // Ping-Pong-Dauer des Kraftbalkens; Standard 1.2
  perfectWindowMin: number;       // 0..1, bis 1.0; Standard 0.92

  // Drill
  flexGreenZone: number;          // 0..1, Grundbreite der grünen Zone; Standard 0.26
  relief: number;                 // Entlastung (Spannungsabbau); Standard 1.0
  reactionBonusS: number;         // Anschlagfenster +; Standard 0
  counterBonus: number;           // Konter gegen Zugrichtung; Standard 0.30
  sizeMuBonus: number;            // Größen-Würfel (Welt-Ruten); Standard 0

  // Spezial
  ability: RodAbility;
  abilityWorld: WorldId | null;   // null = überall
  abilityAffectsOnlyWorld: boolean;   // bleibt im Ausgleichsmodus aktiv; Standard true

  // Optik
  rodSprite: string;
  bendFrames: [string, string, string, string];   // 4 Biegestufen
  lineColor: string;              // Standard "#FFFFFF"
  lineParticles: string | null;   // Partikel-Config-Key (Goldene Rute)
}

export interface LineData {
  id: LineId; nameKey: string; priceCoins: number; requiredReputation: number;
  breakReserveS: number;          // +s vor Schnurriss
  biteRateBonus: number;          // Fluorocarbon +0.10
  protection: LineProtection[];   // Kaelte | Druck | Hitze
  heatMultiplier: number;         // Hitzeschild 0.5; Standard 1
  maxDepthPressureM: number;      // Standard 1000
}

export interface ReelData {
  id: ReelId; nameKey: string; priceCoins: number; requiredReputation: number;
  crankPower: number;             // Spannungsaufbau; Standard 1
  retrieveSpeed: number;          // Einholtempo; Standard 1
  lineCapacityM: number;          // max. Tiefe; Standard 25
  isDeepSeaWinch: boolean;        // Kapazität nur in W4, sonst fallbackCapacityM
  fallbackCapacityM: number;      // Standard 80
  descentSpeedMs: number;         // Winde: schneller Abstieg; Standard 0
}

export interface BaitData {
  id: BaitId; nameKey: string;
  infinite: boolean; reusable: boolean; packSize: number; priceCoins: number; pricePearls: number;
  sinkSpeed: number;              // leicht/mittel/schwer; Standard 1
  biteRateBonus: number;
  sizeMuBonus: number;            // Großköder +0.08
  commonMod: number;              // Großköder 0.5; Standard 1
  shinyMultiplier: number;        // Glücksköder 2; Standard 1
  twitchBonus: number;            // Blinker 1.5; Standard 1
  worlds: WorldId[];              // wo er wirkt (leer = überall)
  summonsBoss: FishId | null;     // Bosslocker
}

