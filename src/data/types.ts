// Alle Typen des Datenschemas (Spec Teil G 6.2-6.5). Enum-Werte ohne Umlaute.
// Client (Phaser/Vite) und spaeter Edge Functions (Deno) nutzen dieselben Typen.

export const RARITIES = ['Gewoehnlich', 'Ungewoehnlich', 'Selten', 'Episch', 'Legendaer'] as const;
export type Rarity = (typeof RARITIES)[number];

export const SIZE_CLASSES = ['S', 'M', 'L', 'XL', 'Boss'] as const; // 32x16, 64x32, 96x48, 128x64, 256x128
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const FIGHT_BEHAVIORS = [
  'Ruhig', 'Zappler', 'Sprinter', 'Taucher', 'Springer', 'Zickzack', 'Brocken',
  'Trickser', 'Versteckspieler', 'Aufblaeher', 'Stromer', 'Blinker', 'Hitzkopf',
] as const;
export type FightBehavior = (typeof FIGHT_BEHAVIORS)[number];

export const TIMES_OF_DAY = ['Morgen', 'Tag', 'Abend', 'Nacht', 'Immer'] as const; // Flags
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

// Generische Wetter-Schluessel; jede Welt gibt ihnen eigene Anzeigenamen.
export const WEATHERS = [
  'Sonnig', 'Bewoelkt', 'Regen', 'Gewitter', 'Nebel',
  'Schnee', 'Schneesturm', 'Sturm', 'Duenung',
  'Aschenregen', 'Dampfnebel', 'Erdbeben', 'Alle',
] as const; // Flags
export type Weather = (typeof WEATHERS)[number];

export const WORLD_EVENTS = [
  'Keins', 'Vollmond', 'Sommergewitter', 'Mueckenschwarm', // W1
  'Flut', 'Ebbe', 'Korallenbluete', 'DelfinBesuch', // W2
  'Polarlicht', 'Walgesang', 'Eisbergkalbung', // W3
  'Meeresschnee', 'BiolumineszenzWelle', 'SchwarzerRaucher', 'Walfall', // W4
  'Ausbruch', 'GrosserAusbruch', 'Runennacht', // W5
] as const;
export type WorldEvent = (typeof WORLD_EVENTS)[number];

export const HORIZONTAL_ZONES = ['Ufer', 'Freiwasser', 'Kante', 'Alle'] as const; // Flags
export type HorizontalZone = (typeof HORIZONTAL_ZONES)[number];

export const LINE_PROTECTIONS = ['Kaelte', 'Druck', 'Hitze'] as const; // Flags
export type LineProtection = (typeof LINE_PROTECTIONS)[number];

export const WORLD_MECHANICS = [
  'HaengerUndFutterplatz', 'StroemungUndGezeiten', 'EisloecherUndFrost', 'DunkelheitUndDruck', 'HitzeUndAusbrueche',
] as const;
export type WorldMechanic = (typeof WORLD_MECHANICS)[number];

export const BOSS_SPECIALS = [
  'Keine', 'KrautHaenger', 'Blitzsprung', // Barnabas
  'StroemungsWirbel', 'WanderndeZone', 'Salto', // Coralina
  'EislochZufrieren', 'Tiefensog', 'Frostatem', // Grimmbart
  'DreiZonen', 'Lichtblitz', 'Schlund', // Lumina
  'Feuerodem', 'Lavabomben', 'Drachenzorn', // Ignaris
] as const;
export type BossSpecial = (typeof BOSS_SPECIALS)[number];

export const ROD_ABILITIES = [
  'Keine', 'TaucherKonter', 'WindImmun', 'StarkerKonter', 'HaengerLeicht', 'StroemungHalb',
  'KaelteImmun', 'LampePlusEins', 'HitzeMinus30', 'SchillerndGlobal',
] as const;
export type RodAbility = (typeof ROD_ABILITIES)[number];

export const UNLOCK_SOURCES = ['Start', 'Shop', 'Sammlung', 'Komplett'] as const;
export type UnlockSource = (typeof UNLOCK_SOURCES)[number];

export const WORLD_IDS = ['W1', 'W2', 'W3', 'W4', 'W5'] as const;

// ID-Typen
export type FishId = `F${string}`;
export type WorldId = `W${1 | 2 | 3 | 4 | 5}`;
export type RodId = string;
export type LineId = string;
export type ReelId = string;
export type BaitId = string;
export type Size = { w: number; h: number };
export type Range = { min: number; max: number };

// ---------------------------------------------------------------- 6.3 FishData
export interface BossPhase {
  nameKey: string; // "boss.020.phase1" -> "Kraftprobe"
  hpFrom: number; // 0..1, Phase gilt von hpFrom bis hpTo
  hpTo: number;
  behaviors: FightBehavior[];
  special: BossSpecial;
  strength: number; // Standard 8
  telegraphKey: string; // Ansage-Text
}

export interface FishData {
  // Identitaet
  id: FishId;
  lexiconNumber: number; // 1..100
  nameKey: string; // "fish.001.name"
  displayNameDe: string;
  speciesBasis: string;
  isFantasy: boolean;
  world: WorldId;
  rarity: Rarity;
  isBoss: boolean;
  lexiconKey: string; // "fish.001.lexicon"
  hintKey: string; // "fish.001.hint"

  // Darstellung
  sizeClass: SizeClass;
  canvasSize: Size;
  swimFrames: string[];
  struggleFrames: string[];
  catchSprite: string;
  altSprite?: string;
  silhouette: string;
  shinyLut: string;
  emissionMask?: string;
  glowsInDark: boolean;
  artBriefDe: string;
  shinyBriefDe: string;

  // Groesse & Gewicht
  lengthMinCm: number;
  lengthMaxCm: number;
  weightFactorK: number; // Gewicht(g) = k * Laenge(cm)^3; Standard 0.011

  // Spawn
  depthMinM: number;
  depthMaxM: number;
  zones: HorizontalZone[];
  timeMask: TimeOfDay[];
  requiredWeather: Weather[];
  preferredWeather: Weather[];
  requiredEvent: WorldEvent;
  preferredEvent: WorldEvent;
  favoriteBaits: BaitId[];
  dislikedBaits: BaitId[];
  spawnWeightOverride: number; // <0 = Standard aus Seltenheit
  schooling: boolean;
  schoolSize: Range;

  // Biss
  nibbleMin: number;
  nibbleMax: number;
  biteWindowBonusS: number;
  hasFakeBites: boolean;
  isToothed: boolean;

  // Drill
  primaryBehavior: FightBehavior;
  hasSecondaryBehavior: boolean;
  secondaryBehavior?: FightBehavior;
  secondaryAtStamina: number; // 0..1
  strength: number; // 1..10
  staminaOverrideS: number; // <0 = aus Seltenheit x Groesse
  greenZoneModifier: number;
  bossPhases: BossPhase[];

  // Wert
  basePoints: number;
  xpOverride: number; // <0 = aus Seltenheit
}

// --------------------------------------------------------------- 6.4 WorldData
export interface DepthLayer {
  nameKey: string; minM: number; maxM: number;
  metersPerScreen: number;
  backgroundSlice: string;
}
export interface PlayerSpot { position: { x: number; y: number }; isBoat: boolean; iceHoles: number }
export interface WeatherEntry {
  weather: Weather[]; weight: number; displayNameKey: string;
  windStrength: number; biteRateMod: number;
}
export interface EventEntry {
  evt: WorldEvent; chancePerCheck: number; checkIntervalS: number;
  durationS: number;
  allowedTimes: TimeOfDay[];
  biteRateMod: number; epicMod: number; commonMod: number;
}
export interface CollectionReward {
  speciesRequired: number; // 5/10/15/20; 21 = "alle Schillernd"
  coins: number; pearls: number;
  items: string[];
  titleKey: string;
  shinyChanceBonus: number;
}
export interface WorldData {
  id: WorldId;
  index: number;
  nameKey: string;
  themeKey: string;
  coinFactor: number;

  leadPalette: string[];
  fullPalette: string;
  shinyRuleKey: string;
  depthLayers: DepthLayer[];
  maxDepthM: number;
  uferEndM: number;
  freiwasserEndM: number;
  background: string;
  ambient: string[];
  playerSpots: PlayerSpot[];

  weatherTable: WeatherEntry[];
  events: EventEntry[];

  mechanic: WorldMechanic;
  mechanicSettings: Record<string, number | boolean>;

  musicMorgen: string; musicTag: string; musicAbend: string; musicNacht: string;
  musicStorm: string; musicEvent: string; musicBoss: string; musicFinale: string;
  ambienceLoop: string;

  fish: FishId[];
  boss: FishId;
  worldRod: RodId;

  previousWorld: WorldId | null;
  requiredSpeciesFromPrevious: number;
  speciesInsteadOfBoss: number;
  requiredReputation: number;
  ticketPrice: number;
  requiredGear: string[];
  recommendedTier: number;

  collectionRewards: CollectionReward[];
}

// ------------------------------------------------ 6.5 RodData, Line, Reel, Bait
export interface RodData {
  id: RodId;
  nameKey: string;
  tier: number;
  source: UnlockSource;
  priceCoins: number;
  pricePearls: number;
  requiredReputation: number;

  castMaxDistanceM: number;
  castCycleS: number;
  perfectWindowMin: number;

  flexGreenZone: number;
  relief: number;
  reactionBonusS: number;
  counterBonus: number;
  sizeMuBonus: number;

  ability: RodAbility;
  abilityWorld: WorldId | null;
  abilityAffectsOnlyWorld: boolean;

  rodSprite: string;
  bendFrames: [string, string, string, string];
  lineColor: string;
  lineParticles: string | null;
}

export interface LineData {
  id: LineId; nameKey: string; priceCoins: number; requiredReputation: number;
  breakReserveS: number;
  biteRateBonus: number;
  protection: LineProtection[];
  heatMultiplier: number;
  maxDepthPressureM: number;
}

export interface ReelData {
  id: ReelId; nameKey: string; priceCoins: number; requiredReputation: number;
  crankPower: number;
  retrieveSpeed: number;
  lineCapacityM: number;
  isDeepSeaWinch: boolean;
  fallbackCapacityM: number;
  descentSpeedMs: number;
}

export interface BaitData {
  id: BaitId; nameKey: string;
  infinite: boolean; reusable: boolean; packSize: number; priceCoins: number; pricePearls: number;
  sinkSpeed: number;
  biteRateBonus: number;
  sizeMuBonus: number;
  commonMod: number;
  shinyMultiplier: number;
  twitchBonus: number;
  worlds: WorldId[];
  summonsBoss: FishId | null;
}
