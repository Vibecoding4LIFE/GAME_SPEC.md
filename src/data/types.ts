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
  // Ergänzung Phase 1 (Zweitfähigkeiten aus D 3.3, datenvertrag.md §5)
  'EislochLangsamer', 'BlinkerHalbSichtbar',
] as const;
export type RodAbility = (typeof ROD_ABILITIES)[number];

export const UNLOCK_SOURCES = ['Start', 'Shop', 'Sammlung', 'Komplett'] as const;
export type UnlockSource = (typeof UNLOCK_SOURCES)[number];

// ---- Ergänzungen aus docs/datenvertrag.md (daten-designer) ----
export const WORLD_IDS = ['W1', 'W2', 'W3', 'W4', 'W5'] as const;

/** Kürzel je Welt für Asset-Pfade und Asset-Keys (datenvertrag.md §3/§4). */
export const WORLD_KUERZEL = { W1: 'see', W2: 'riff', W3: 'fjord', W4: 'tiefe', W5: 'grotte' } as const;
export type WorldKuerzel = (typeof WORLD_KUERZEL)[keyof typeof WORLD_KUERZEL];

export const BODY_SHAPES = [
  'schlank', 'normal', 'hochrueckig', 'rund', 'torpedo', 'aal', 'scheibe', 'rochen', 'plattfisch',
  'seepferdchen', 'kugel', 'band', 'kopflastig',
] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

export const TAIL_SHAPES = ['gegabelt', 'rund', 'sichel', 'gerade', 'hai', 'saum', 'spitz', 'dreiteilig'] as const;
export type TailShape = (typeof TAIL_SHAPES)[number];

export const PATTERNS = [
  'keins', 'querstreifen', 'laengsband', 'punkte', 'flecken', 'netz', 'sattel', 'marmor', 'ringe',
  'schuppen', 'platten', 'leuchtpunkte', 'risse', 'hexagon', 'wellen',
] as const;
export type Pattern = (typeof PATTERNS)[number];

/** Bevorzugte Merkmal-Tags (frei erweiterbar, siehe datenvertrag.md §1). */
export const PREFERRED_FEATURES = [
  'barteln', 'zaehne', 'horn', 'schnauze_lang', 'maul_gross', 'stacheln', 'segel', 'kristalle', 'flammen',
  'leuchtangel', 'glupschaugen', 'krone', 'moos', 'fettflosse', 'haken', 'froschbeine', 'blume', 'tentakel',
  'kuppel', 'hauer',
] as const;

/** Köder-IDs aus Teil D 3.3. */
export const BAIT_IDS = [
  'K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'K13', 'K14',
] as const;

// ---- Ergänzungen Phase 1 (docs/datenvertrag.md §5) ----

/**
 * Verhaltens-Tags je Fisch (Spalte `tags` in fish.csv). Sie steuern Wetter-, Ereignis-, Zucken- und Köderregeln.
 * `leucht`, `zahnfisch`, `schwarm` werden vom Build aus `leuchtet`, `zahnfisch`, `schwarm` abgeleitet
 * und dürfen nicht von Hand in der Spalte stehen.
 */
export const FISH_TAGS = [
  'raubfisch', 'friedfisch',                 // genau einer von beiden je Fisch
  'oberflaeche', 'grund',                    // Lebensraum (Sonnig +30 %, Meeresschnee +50 %)
  'aal', 'forelle', 'lachs',                 // Regen +50 %
  'mystisch',                                // Nebel / Runennacht +50 %
  'kristall', 'glut',                        // Kristallköder K11 / Glutwurm K10
  'riff', 'lagune',                          // Garnele K06 / Flut +30 %
  'scheu',                                   // Stahlvorfach: −5 % Bissrate
  'leucht', 'zahnfisch', 'schwarm',          // abgeleitet
] as const;
export type FishTag = (typeof FISH_TAGS)[number];
export const DERIVED_FISH_TAGS = ['leucht', 'zahnfisch', 'schwarm'] as const satisfies readonly FishTag[];

/** Größenklassen nach dem Größenwurf x (D 1.10). */
export const SIZE_GRADES = ['Winzling', 'Normal', 'Praechtig', 'Kapital', 'Riesig'] as const;
export type SizeGrade = (typeof SIZE_GRADES)[number];

/** Ködergewicht → Sinkgeschwindigkeit aus balancing `depth.sinkSpeedMs.<klasse>` (D 1.4). */
export const SINK_CLASSES = ['leicht', 'mittel', 'schwer'] as const;
export type SinkClass = (typeof SINK_CLASSES)[number];

export const ACCESSORY_EFFECTS = [
  'KescherRettung',       // rettet n× pro Runde einen ausschlitzenden Fisch
  'EcholotRand',          // Schatten mit Rand in Seltenheitsfarbe
  'WetterVorschau',       // zeigt die nächsten n Wetterwechsel
  'FutterplatzUeberall',  // Futterplatz in jeder Welt
  'EislochTipps',         // Eisloch mit n Tipps freihacken
  'Lichtradius',          // Köderlampe: Lichtradius in px (W4)
] as const;
export type AccessoryEffect = (typeof ACCESSORY_EFFECTS)[number];

export const CURIO_REWARDS = ['Muenzen', 'Hinweis', 'Hut', 'Sammelteil'] as const;
export type CurioReward = (typeof CURIO_REWARDS)[number];

/** Pflicht-/ODER-Bedingungen dürfen Wetter- oder Ereignis-Schlüssel sein. */
export type SpawnCondition = Weather | WorldEvent;

/** Sprite-Clips je Fisch (datenvertrag.md §4). `framesS` gilt für Größenklasse S. */
export const SPRITE_CLIPS = {
  swim: { frames: 6, framesS: 4, fps: 10 },
  idle: { frames: 4, framesS: 4, fps: 6 },
  struggle: { frames: 4, framesS: 4, fps: 14 },
  caught: { frames: 3, framesS: 3, fps: 8 },
} as const;
export type SpriteClip = keyof typeof SPRITE_CLIPS;

/** Canvas-Größe je Größenklasse (Teil E 5.0). */
export const CANVAS_BY_SIZE: Record<SizeClass, Size> = {
  S: { w: 32, h: 16 }, M: { w: 64, h: 32 }, L: { w: 96, h: 48 }, XL: { w: 128, h: 64 }, Boss: { w: 256, h: 128 },
};

export interface FishArt {
  bodyShape: BodyShape;
  tailShape: TailShape;
  pattern: Pattern;
  colors: string[];               // Rücken/Haupt · Bauch · Muster/Akzent · Flossen · (Iris)
  shinyColors: string[];          // gleiche Reihenfolge
  features: string[];             // Merkmal-Tags
}

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

  // ---- Ergänzungen aus docs/datenvertrag.md ----
  slug: string;                   // "hecht", "der-alte-barnabas"
  worldKuerzel: WorldKuerzel;     // "see"
  assetKey: string;               // "fish_see_014_hecht" (Präfix aller Frame-Namen)
  atlasKey: string;               // "atlas_fish_see" (Phaser-Texture-Key des Welt-Atlas)
  idleFrames: string[];
  caughtFrames: string[];
  /** Alternative Pflicht-Bedingungen (DNF): äußeres Array = ODER, inneres = UND. [] = keine. */
  requiredAny: SpawnCondition[][];
  art: FishArt;
  /** Verhaltens-Tags inkl. abgeleiteter (`leucht`, `zahnfisch`, `schwarm`), siehe FISH_TAGS. */
  tags: FishTag[];
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
  ability: RodAbility;            // Hauptfähigkeit (= abilities[0] oder "Keine")
  abilityWorld: WorldId | null;   // null = überall; gilt auch für sizeMuBonus
  abilityAffectsOnlyWorld: boolean;   // bleibt im Ausgleichsmodus aktiv; Standard true

  // Optik
  rodSprite: string;
  bendFrames: [string, string, string, string];   // 4 Biegestufen
  lineColor: string;              // Standard "#FFFFFF"
  lineParticles: string | null;   // Partikel-Config-Key (Goldene Rute)

  // ---- Ergänzungen Phase 1 (datenvertrag.md §5) ----
  descKey: string;                // "rod.r01.desc"
  /** Alle Fähigkeiten mit Zahlenwert (Bedeutung je Fähigkeit siehe datenvertrag.md §5). */
  abilities: RodAbilityEntry[];
}

export interface RodAbilityEntry { ability: RodAbility; value: number }

export interface LineData {
  id: LineId; nameKey: string; priceCoins: number; requiredReputation: number;
  breakReserveS: number;          // +s vor Schnurriss
  biteRateBonus: number;          // Fluorocarbon +0.10
  protection: LineProtection[];   // Kaelte | Druck | Hitze
  heatMultiplier: number;         // Hitzeschild 0.5; Standard 1
  maxDepthPressureM: number;      // Standard 1000
  // ---- Ergänzungen Phase 1 ----
  descKey: string;
  isLeader: boolean;              // Stahlvorfach Z-V: Aufsatz, an/aus, zusätzlich zur Schnur
  protectsToothed: boolean;       // kein Abbiss durch Zahnfische
  shyBiteRateMod: number;         // Bissrate-Änderung bei Fischen mit Tag "scheu" (Z-V −0.05)
}

export interface ReelData {
  id: ReelId; nameKey: string; priceCoins: number; requiredReputation: number;
  crankPower: number;             // Spannungsaufbau; Standard 1
  retrieveSpeed: number;          // Einholtempo; Standard 1
  lineCapacityM: number;          // max. Tiefe; Standard 25
  isDeepSeaWinch: boolean;        // Kapazität nur in W4, sonst fallbackCapacityM
  fallbackCapacityM: number;      // Standard 80
  descentSpeedMs: number;         // Winde: schneller Abstieg; Standard 0
  // ---- Ergänzungen Phase 1 ----
  descKey: string;
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
  summonsBoss: FishId | null;     // Bosslocker mit festem Boss (K14 nutzt summonsWorldBoss)
  // ---- Ergänzungen Phase 1 (datenvertrag.md §5) ----
  descKey: string;
  sinkClass: SinkClass;
  /** Sinkgeschwindigkeit in m/s, beim Build aus balancing depth.sinkSpeedMs.<sinkClass> aufgelöst. */
  sinkSpeedMs: number;
  /** Seltenheits-Multiplikatoren auf das Spawn-Gewicht (K02 Gewöhnlich 1.3, K07 Selten 1.2, K12 Gewöhnlich 0.5). */
  rarityMods: Partial<Record<Rarity, number>>;
  /** Tag-Multiplikatoren auf das Spawn-Gewicht (K05 raubfisch 1.4, K06 riff 1.4, K09 leucht 1.5 …). */
  tagBonus: Partial<Record<FishTag, number>>;
  /** Zielgruppe für Shop/Lexikon (beschreibend). */
  targetTags: FishTag[];
  retrieveDiveM: number;          // Wobbler: taucht beim Einholen n m tiefer
  createsFeedingSpot: boolean;    // Brotflocke: "Füttern" (balancing spawn.futterplatz)
  glowsInDark: boolean;           // Leuchtköder: weit sichtbar in der Dunkelheit
  heatproof: boolean;             // Glutwurm
  summonsWorldBoss: boolean;      // Bosslocker: Boss der aktuellen Welt
  priceCoinsPerWorldFactor: number; // Bosslocker: + n × Weltfaktor Münzen
  unlockSpeciesInWorld: number;   // Verkauf erst ab n/20 Arten der Welt (0 = immer)
}

export interface AccessoryData {
  id: string;                     // "Z01"
  nameKey: string; descKey: string;
  priceCoins: number; requiredReputation: number;
  tier: number;                   // Köderlampe I–IV = 1–4, sonst 1
  effect: AccessoryEffect;
  value: number;                  // Bedeutung je Effekt (Rettungen, Wetterwechsel, Tipps, px)
  worlds: WorldId[];              // wo er wirkt (leer = überall)
}

export interface CurioData {
  id: string;                     // "C01"
  nameKey: string; textKey: string;
  worlds: WorldId[];              // leer = alle Welten
  weight: number;                 // relatives Gewicht innerhalb der Fundstücke einer Welt
  coinsMin: number; coinsMax: number;
  coinsTimesWorldFactor: boolean; // Schatzkiste: 100–500 × Weltfaktor
  reward: CurioReward;
  rewardRef: string | null;       // Hut-/Kosmetik-ID
  collectCount: number;           // Sammelteil: so viele ergeben rewardRef (0 = sofort)
}

