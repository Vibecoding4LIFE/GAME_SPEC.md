// src/data/gear.ts – Data/{rods,lines,reels,baits,accessories,curios}.csv → public/data/gear.json (Typen aus Teil G 6.5
// plus docs/datenvertrag.md §5) und Lader für das Spiel. Keine Node-APIs.
import type { Balancing } from './balancing';
import {
  GearDbSchema,
  type AccessoryRowT, type BaitRowT, type CurioRowT, type LineRowT, type ReelRowT, type RodRowT,
} from './schema';
import type { AccessoryData, BaitData, CurioData, LineData, ReelData, RodData } from './types';

export const GEAR_VERSION = 1 as const;

export interface GearDb {
  version: typeof GEAR_VERSION;
  rods: RodData[];
  lines: LineData[];
  reels: ReelData[];
  baits: BaitData[];
  accessories: AccessoryData[];
  curios: CurioData[];
}

export type GearCategory = 'rod' | 'line' | 'reel' | 'bait' | 'accessory' | 'curio';

/** "Z-V" → "zv", "RW1" → "rw1" */
export const gearSlug = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]/g, '');

/** i18n-Schlüssel: `rod.r01.name`, `line.zv.desc`, `curio.c01.text` … */
export const gearKey = (cat: GearCategory, id: string, field: 'name' | 'desc' | 'text'): string => `${cat}.${gearSlug(id)}.${field}`;

/** Sprite-Namen der Rute (Vertrag §5): `rod_<slug>` und `rod_<slug>_bend_<0..3>`. */
export const rodSpriteFor = (id: string): string => `rod_${gearSlug(id)}`;

export interface GearRows {
  rods: readonly RodRowT[];
  lines: readonly LineRowT[];
  reels: readonly ReelRowT[];
  baits: readonly BaitRowT[];
  accessories: readonly AccessoryRowT[];
  curios: readonly CurioRowT[];
}

export function toRodData(r: RodRowT): RodData {
  const sprite = rodSpriteFor(r.id);
  return {
    id: r.id,
    nameKey: gearKey('rod', r.id, 'name'),
    descKey: gearKey('rod', r.id, 'desc'),
    tier: r.stufe,
    source: r.quelle,
    priceCoins: r.preis_muenzen,
    pricePearls: r.preis_perlen,
    requiredReputation: r.ruf,
    castMaxDistanceM: r.wurfweite_m,
    castCycleS: r.wurf_zyklus_s,
    perfectWindowMin: r.perfekt_ab,
    flexGreenZone: r.flex,
    relief: r.entlastung,
    reactionBonusS: r.reaktion_s,
    counterBonus: r.konter,
    sizeMuBonus: r.groessen_mu,
    ability: r.faehigkeiten[0]?.ability ?? 'Keine',
    abilities: r.faehigkeiten.map((a) => ({ ability: a.ability, value: a.value })),
    abilityWorld: r.faehigkeit_welt,
    abilityAffectsOnlyWorld: r.nur_welt,
    rodSprite: sprite,
    bendFrames: [`${sprite}_bend_0`, `${sprite}_bend_1`, `${sprite}_bend_2`, `${sprite}_bend_3`],
    lineColor: r.schnurfarbe,
    lineParticles: r.schnur_partikel,
  };
}

export function toLineData(r: LineRowT): LineData {
  return {
    id: r.id,
    nameKey: gearKey('line', r.id, 'name'),
    descKey: gearKey('line', r.id, 'desc'),
    priceCoins: r.preis_muenzen,
    requiredReputation: r.ruf,
    breakReserveS: r.reserve_s,
    biteRateBonus: r.bissrate_bonus,
    protection: r.schutz,
    heatMultiplier: r.hitze_faktor,
    maxDepthPressureM: r.druck_max_m,
    isLeader: r.vorfach,
    protectsToothed: r.zahnschutz,
    shyBiteRateMod: r.scheu_mod,
  };
}

export function toReelData(r: ReelRowT): ReelData {
  return {
    id: r.id,
    nameKey: gearKey('reel', r.id, 'name'),
    descKey: gearKey('reel', r.id, 'desc'),
    priceCoins: r.preis_muenzen,
    requiredReputation: r.ruf,
    crankPower: r.kurbelkraft,
    retrieveSpeed: r.einholtempo,
    lineCapacityM: r.kapazitaet_m,
    isDeepSeaWinch: r.tiefseewinde,
    fallbackCapacityM: r.kapazitaet_sonst_m,
    descentSpeedMs: r.abstieg_ms,
  };
}

/** `sinkSpeedMs` kommt aus balancing (depth.sinkSpeedMs), `sinkSpeed` ist der Faktor relativ zu „mittel“ (6.5). */
export function toBaitData(r: BaitRowT, b: Balancing): BaitData {
  const ms = b.depth.sinkSpeedMs[r.gewicht];
  return {
    id: r.id,
    nameKey: gearKey('bait', r.id, 'name'),
    descKey: gearKey('bait', r.id, 'desc'),
    infinite: r.unendlich,
    reusable: r.dauerhaft,
    packSize: r.packung,
    priceCoins: r.preis_muenzen,
    pricePearls: r.preis_perlen,
    priceCoinsPerWorldFactor: r.preis_weltfaktor,
    sinkClass: r.gewicht,
    sinkSpeed: Math.round((ms / b.depth.sinkSpeedMs.mittel) * 1000) / 1000,
    sinkSpeedMs: ms,
    biteRateBonus: r.bissrate_bonus,
    sizeMuBonus: r.groessen_mu,
    commonMod: r.seltenheit_mods.Gewoehnlich ?? 1,
    shinyMultiplier: r.schillernd_mult,
    twitchBonus: r.zucken_mult,
    rarityMods: r.seltenheit_mods,
    tagBonus: r.tag_bonus,
    targetTags: r.wirkt_auf,
    worlds: r.welten,
    summonsBoss: null,
    summonsWorldBoss: r.bosslocker,
    retrieveDiveM: r.einhol_tiefe_m,
    createsFeedingSpot: r.futterplatz,
    glowsInDark: r.leuchtet_dunkel,
    heatproof: r.hitzefest,
    unlockSpeciesInWorld: r.ab_arten,
  };
}

export function toAccessoryData(r: AccessoryRowT): AccessoryData {
  return {
    id: r.id,
    nameKey: gearKey('accessory', r.id, 'name'),
    descKey: gearKey('accessory', r.id, 'desc'),
    priceCoins: r.preis_muenzen,
    requiredReputation: r.ruf,
    tier: r.stufe,
    effect: r.effekt,
    value: r.wert,
    worlds: r.welten,
  };
}

export function toCurioData(r: CurioRowT): CurioData {
  return {
    id: r.id,
    nameKey: gearKey('curio', r.id, 'name'),
    textKey: gearKey('curio', r.id, 'text'),
    worlds: r.welten,
    weight: r.gewicht,
    coinsMin: r.muenzen_min,
    coinsMax: r.muenzen_max,
    coinsTimesWorldFactor: r.mal_weltfaktor,
    reward: r.belohnung,
    rewardRef: r.belohnung_ref,
    collectCount: r.sammelzahl,
  };
}

export function toGearDb(rows: GearRows, b: Balancing): GearDb {
  return {
    version: GEAR_VERSION,
    rods: rows.rods.map(toRodData),
    lines: rows.lines.map(toLineData),
    reels: rows.reels.map(toReelData),
    baits: rows.baits.map((r) => toBaitData(r, b)),
    accessories: rows.accessories.map(toAccessoryData),
    curios: rows.curios.map(toCurioData),
  };
}

/** gear.json (z. B. aus `this.cache.json.get('gear')`) → typisierte Ausrüstung. Wirft bei kaputter Datei. */
export function loadGear(json: unknown): GearDb {
  const g: GearDb = GearDbSchema.parse(json);
  return g;
}
