// src/data/balancing.ts – Typ, Zod-Schema und Lader für public/data/balancing.json (aus Data/balancing.csv).
// Das Schema ist die Liste der Pflicht-Schlüssel: Jeder Blattwert unten muss als Zeile in balancing.csv stehen,
// unbekannte Schlüssel sind ein Fehler (strictObject). Ausnahme: die Effekt-Tabellen (Wetter, Ereignisse, Wind, Kälte)
// sind Teil-Records, damit die Spiellogik generisch über `Weather`/`WorldEvent` nachschlagen kann; ihre
// Pflicht-Einträge stehen in REQUIRED_EFFECT_KEYS.
// Keine Node-APIs (läuft auch im Browser und in Deno).
import { z } from 'zod';
import * as T from './types';

const n = z.number({ error: 'Zahl erwartet' }).finite();
const pos = n.positive('muss > 0 sein');
const nonNeg = n.min(0, 'muss ≥ 0 sein');
const frac = n.min(0, 'muss zwischen 0 und 1 liegen').max(1, 'muss zwischen 0 und 1 liegen');
const obj = z.strictObject;

const byRarity = <S extends z.ZodType>(s: S) =>
  obj({ Gewoehnlich: s, Ungewoehnlich: s, Selten: s, Episch: s, Legendaer: s });

const WEATHER_KEYS = T.WEATHERS.filter((w): w is Exclude<T.Weather, 'Alle'> => w !== 'Alle') as [
  Exclude<T.Weather, 'Alle'>, ...Exclude<T.Weather, 'Alle'>[],
];
const EVENT_KEYS = T.WORLD_EVENTS.filter((e): e is Exclude<T.WorldEvent, 'Keins'> => e !== 'Keins') as [
  Exclude<T.WorldEvent, 'Keins'>, ...Exclude<T.WorldEvent, 'Keins'>[],
];
const weatherRecord = <S extends z.ZodType>(s: S) => z.partialRecord(z.enum(WEATHER_KEYS), s);
const eventRecord = <S extends z.ZodType>(s: S) => z.partialRecord(z.enum(EVENT_KEYS), s);

/** Wirkung eines Wetters, Ereignisses oder des Futterplatzes auf Spawn-Gewichte und Bissrate. */
export const SpawnEffectSchema = obj({
  /** additiver Bissraten-Bonus (+0.15 = Wartezeit / 1.15) */
  biteRate: n.optional(),
  /** Multiplikator je Seltenheit */
  rarity: z.partialRecord(z.enum(T.RARITIES), pos).optional(),
  /** Multiplikator je Fisch-Tag (mehrere passende Tags werden multipliziert) */
  tags: z.partialRecord(z.enum(T.FISH_TAGS), pos).optional(),
  /** Multiplikator je Fisch-ID */
  fish: z.record(z.string().regex(/^F\d{3}$/, 'Fisch-ID F001 erwartet'), pos).optional(),
});
export type SpawnEffect = z.output<typeof SpawnEffectSchema>;

const intervalS = { intervalMinS: pos, intervalMaxS: pos };
/** Größenklasse: gilt für x < upTo (Riesig bis 1.0), Punkte-/Verkaufsfaktor. Schlüssel = SIZE_GRADES. */
const sizeGrade = obj({ upTo: frac, factor: pos });

export const BalancingSchema = obj({
  version: z.literal(1),
  cast: obj({
    cycleS: pos,
    zone: obj({ uferMax: frac, freiwasserMax: frac }),
    perfect: obj({ windowMinDefault: frac, windowMinFloor: frac, biteRateBonus: nonNeg }),
    miss: obj({ below: frac, landingPower: frac }),
    /** Wind: Landepunkt ± Anteil der max. Wurfweite je Wetter */
    wind: weatherRecord(frac),
  }),
  depth: obj({
    sinkSpeedMs: obj({ leicht: pos, mittel: pos, schwer: pos }),
    twitch: obj({ raubfischBonus: nonNeg, friedfischMalus: frac, activeS: pos, liftM: nonNeg }),
  }),
  bite: obj({
    wait: obj({ minS: pos, maxS: pos, floorS: pos, noFishRetryS: pos }),
    nibble: obj(intervalS),
    window: obj({ baseS: pos, rarityBonusS: byRarity(n) }),
    perfect: obj({ windowFraction: frac, staminaReduction: frac }),
    earlyStrike: obj({ penaltyS: nonNeg, biteRateFactor: frac }),
    toothedCutChance: frac,
    curioShare: frac,
    fakeBite: obj({ chance: frac, maxCount: nonNeg, flashS: pos }),
  }),
  drill: obj({
    tensionScale: pos,
    crankFactor: pos,
    reliefFactor: pos,
    fishPullFactor: pos,
    patternBase: pos,
    counterBonus: frac,
    progress: obj({ belowZone: frac, aboveZone: frac }),
    stamina: obj({
      counterMultiplier: pos,
      baseS: byRarity(pos),
      legendaerMaxS: pos,
      sizeFactorMin: pos,
      sizeFactorMax: pos,
    }),
    exhausted: obj({ zoneMultiplier: pos, pullFactor: nonNeg }),
    break: obj({ tension: frac, baseS: nonNeg }),
    unhook: obj({ tension: frac, durationS: pos }),
    zone: obj({ strengthPenalty: nonNeg, minWidth: frac, center: frac, redFrom: frac }),
    distance: obj({ start: pos, retrievePerS: pos, minWhileFresh: frac, fleePerS: nonNeg, max: pos }),
    /** Faktor auf die Breite der grünen Zone bei Kälte ohne Kälteschutz, je Wetter */
    cold: weatherRecord(frac),
    pressure: obj({ fromM: pos }),
    telegraph: obj({ defaultS: nonNeg }),
    behavior: obj({
      Ruhig: obj({ pull: pos }),
      Zappler: obj({ ...intervalS, spikeMin: frac, spikeMax: frac, telegraphS: nonNeg }),
      Sprinter: obj({ durationMinS: pos, durationMaxS: pos, pullBonus: nonNeg, ...intervalS, telegraphS: nonNeg }),
      Taucher: obj({ durationMinS: pos, durationMaxS: pos, pullBonus: nonNeg, distanceFactor: pos, ...intervalS, telegraphS: nonNeg }),
      Springer: obj({ jumpMaxS: pos, tensionLimit: frac, ...intervalS, telegraphS: nonNeg, exhaustS: nonNeg, exhaustStaminaMultiplier: pos }),
      Zickzack: obj({ ...intervalS, telegraphS: nonNeg }),
      Brocken: obj({ pullBonus: nonNeg, zoneOffset: frac, staminaMultiplier: pos }),
      Trickser: obj({ telegraphS: nonNeg, fakeTiredMinS: pos, fakeTiredMaxS: pos, fleeS: pos, fleePullBonus: nonNeg, ...intervalS }),
      Versteckspieler: obj({ coverReachS: pos, ...intervalS, telegraphS: nonNeg, haengerTaps: pos, tapIntervalS: pos, tapToleranceS: nonNeg }),
      Aufblaeher: obj({ ...intervalS, durationS: pos, pullMultiplier: pos, retrieveMultiplier: pos, telegraphS: nonNeg, exhaustS: nonNeg }),
      Stromer: obj({ invertS: pos, ...intervalS, telegraphS: nonNeg }),
      Blinker: obj({ invisibleMinS: pos, invisibleMaxS: pos, ...intervalS, telegraphS: nonNeg }),
      Hitzkopf: obj({ heatPerS: pos, highTensionMultiplier: pos, coolPerS: nonNeg, breakAt: pos }),
    }),
  }),
  spawn: obj({
    base: byRarity(pos),
    zoneMismatch: frac,
    weatherPreferred: pos,
    eventPreferred: pos,
    bait: obj({ favorite: pos, neutral: pos, disliked: nonNeg }),
    pity: obj({ step: nonNeg, max: nonNeg }),
    weather: weatherRecord(SpawnEffectSchema),
    event: eventRecord(SpawnEffectSchema),
    futterplatz: SpawnEffectSchema.extend({ durationS: pos, radiusM: pos }),
    haenger: obj({ chance: frac, taps: pos, tapIntervalS: pos, tapToleranceS: nonNeg }),
  }),
  /** Taktung der Weltereignisse (Wirkung steht in spawn.event) */
  event: eventRecord(
    obj({ everyNthNight: pos.optional(), chancePerCheck: frac.optional(), checkIntervalS: pos.optional(), durationS: pos.optional() }),
  ),
  lexicon: obj({ twoStarCatches: pos }),
  size: obj({
    mu: frac,
    sigma: pos,
    grade: obj({ Winzling: sizeGrade, Normal: sizeGrade, Praechtig: sizeGrade, Kapital: sizeGrade, Riesig: sizeGrade }),
    display: obj({ winzlingShrinkPx: nonNeg, riesigZoomSteps: nonNeg }),
  }),
  shiny: obj({
    baseOneIn: pos,
    badgeOneIn: pos,
    capOneIn: pos,
    pointsMultiplier: pos,
    competitionBonusCap: nonNeg,
    pearls: nonNeg,
    sparkleIntervalS: pos,
  }),
  score: obj({
    quality: obj({ masterDrill: nonNeg, perfectCast: nonNeg, perfectStrike: nonNeg }),
    variety: obj({ first: pos, second: pos, third: pos, later: pos }),
    finale: obj({ multiplier: pos, lastS: pos }),
  }),
  time: obj({ dayLengthS: pos, phaseLengthS: pos }),
  weather: obj({
    changeMinS: pos,
    changeMaxS: pos,
    forecastCount: nonNeg,
    shadowVisibility: weatherRecord(frac),
    lightning: obj({ revealS: pos, ...intervalS }),
  }),
  xp: obj({
    catch: byRarity(nonNeg),
    newSpeciesMultiplier: pos,
    roundPlayed: nonNeg,
    roundWon: nonNeg,
    dailyQuest: nonNeg,
    level: obj({ base: pos, exponent: pos, max: pos }),
  }),
  sell: obj({ baseFactor: pos, shinyMultiplier: pos }),
  gear: obj({ accessorySlots: pos, secondSlotReputation: pos }),
  catchup: obj({
    tailwind: obj({ behind1: frac, bonus1: nonNeg, behind2: frac, bonus2: nonNeg, nibbleReduction: nonNeg }),
    hiddenScoreLastS: nonNeg,
    beginner: obj({ maxReputation: nonNeg, saves: nonNeg, tensionAfterSave: frac }),
    specialAwardCoins: nonNeg,
  }),
  reward: obj({
    placeBase: obj({ first: nonNeg, second: nonNeg, third: nonNeg, fourth: nonNeg }),
    pointsShare: frac,
  }),
});

/** Alle Spielkonstanten, z. B. `balancing.drill.counterBonus`. */
export type Balancing = z.output<typeof BalancingSchema>;

/** Gruppen der obersten Ebene (für Tests und Debug-Menü). */
export const BALANCING_GROUPS = Object.keys(BalancingSchema.shape).filter((k) => k !== 'version') as Exclude<
  keyof Balancing,
  'version'
>[];

/**
 * Pflicht-Einträge in den Teil-Records (Spec-Werte aus D 1.3, D 1.9, D 3.3, Teil E W1).
 * Alles andere in diesen Records ist optional.
 */
export const REQUIRED_EFFECT_KEYS = [
  'cast.wind.Gewitter', 'cast.wind.Sturm', 'cast.wind.Schneesturm',
  'drill.cold.Schnee', 'drill.cold.Schneesturm',
  'spawn.weather.Sonnig.tags.oberflaeche', 'spawn.weather.Sonnig.tags.raubfisch',
  'spawn.weather.Bewoelkt.tags.raubfisch',
  'spawn.weather.Regen.biteRate', 'spawn.weather.Regen.tags.aal', 'spawn.weather.Regen.tags.forelle', 'spawn.weather.Regen.tags.lachs',
  'spawn.weather.Gewitter.rarity.Episch', 'spawn.weather.Gewitter.rarity.Legendaer',
  'spawn.weather.Nebel.tags.mystisch',
  'spawn.event.Vollmond.rarity.Episch', 'spawn.event.Mueckenschwarm.fish.F005', 'spawn.event.Mueckenschwarm.fish.F006',
  'spawn.futterplatz.tags.friedfisch',
  'event.Vollmond.everyNthNight',
  'weather.shadowVisibility.Nebel',
] as const;

/** Leere Wirkung (für Wetter/Ereignisse ohne Eintrag). */
export const NO_EFFECT: SpawnEffect = Object.freeze({});

/** Wirkung eines Wetters auf Spawn/Bissrate (leer, wenn es keine hat). */
export function weatherEffect(b: Balancing, w: T.Weather): SpawnEffect {
  return w === 'Alle' ? NO_EFFECT : (b.spawn.weather[w] ?? NO_EFFECT);
}

/** Wirkung eines Weltereignisses auf Spawn/Bissrate (leer, wenn es keine hat). */
export function eventEffect(b: Balancing, e: T.WorldEvent): SpawnEffect {
  return e === 'Keins' ? NO_EFFECT : (b.spawn.event[e] ?? NO_EFFECT);
}

// ------------------------------------------------------------------ CSV-Zeilen → verschachteltes Objekt

export interface BalancingIssue { key: string; msg: string }

/** "a.b.c" = 1 → { a: { b: { c: 1 } } }. Doppelte Schlüssel und Blatt/Ast-Konflikte werden gemeldet. */
export function nestBalancing(rows: readonly { schluessel: string; wert: number }[]): { tree: Record<string, unknown>; issues: BalancingIssue[] } {
  const tree: Record<string, unknown> = {};
  const issues: BalancingIssue[] = [];
  const seen = new Set<string>();
  for (const { schluessel: key, wert } of rows) {
    if (seen.has(key)) { issues.push({ key, msg: 'Schlüssel doppelt' }); continue; }
    seen.add(key);
    const parts = key.split('.');
    let node: Record<string, unknown> = tree;
    let ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i] as string;
      const next = node[p];
      if (next === undefined) node[p] = {};
      else if (typeof next !== 'object' || next === null) {
        issues.push({ key, msg: `"${parts.slice(0, i + 1).join('.')}" ist schon ein Zahlenwert` });
        ok = false;
        break;
      }
      node = node[p] as Record<string, unknown>;
    }
    if (!ok) continue;
    const leaf = parts[parts.length - 1] as string;
    if (node[leaf] !== undefined) { issues.push({ key, msg: 'ist schon eine Gruppe' }); continue; }
    node[leaf] = wert;
  }
  return { tree, issues };
}

const getPath = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o);

/** Prüft ein verschachteltes Balancing-Objekt: Schema (Pflicht-Schlüssel, Bereiche) plus Querregeln. */
export function validateBalancing(tree: unknown): { data: Balancing | null; issues: BalancingIssue[] } {
  const issues: BalancingIssue[] = [];
  const res = BalancingSchema.safeParse(tree);
  if (!res.success) {
    for (const i of res.error.issues) {
      const path = i.path.map(String).join('.');
      if (i.code === 'unrecognized_keys') {
        for (const k of i.keys) issues.push({ key: path ? `${path}.${k}` : k, msg: 'unbekannter Schlüssel (nicht im Schema src/data/balancing.ts)' });
      } else if (i.code === 'invalid_type' && getPath(tree, path) === undefined) {
        issues.push({ key: path, msg: 'Pflicht-Schlüssel fehlt' });
      } else {
        issues.push({ key: path, msg: i.message });
      }
    }
    return { data: null, issues };
  }
  const b = res.data;
  for (const k of REQUIRED_EFFECT_KEYS) if (getPath(b, k) === undefined) issues.push({ key: k, msg: 'Pflicht-Schlüssel fehlt' });

  // min ≤ max für alle Paare xMin/xMax, xMinS/xMaxS
  const walk = (o: Record<string, unknown>, path: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') walk(v as Record<string, unknown>, path ? `${path}.${k}` : k);
      const m = /^(.*)Min(S?)$/.exec(k);
      if (m && typeof v === 'number') {
        const maxKey = `${m[1]}Max${m[2]}`;
        const mx = o[maxKey];
        if (typeof mx === 'number' && v > mx) issues.push({ key: `${path}.${k}`, msg: `größer als ${maxKey} (${v} > ${mx})` });
      }
    }
  };
  walk(b as unknown as Record<string, unknown>, '');
  if (b.bite.wait.minS > b.bite.wait.maxS) issues.push({ key: 'bite.wait.minS', msg: 'größer als bite.wait.maxS' });
  if (b.cast.zone.uferMax >= b.cast.zone.freiwasserMax) issues.push({ key: 'cast.zone.uferMax', msg: 'muss kleiner als freiwasserMax sein' });
  if (b.cast.perfect.windowMinFloor > b.cast.perfect.windowMinDefault) issues.push({ key: 'cast.perfect.windowMinFloor', msg: 'größer als windowMinDefault' });
  if (b.drill.zone.redFrom <= b.drill.unhook.tension) issues.push({ key: 'drill.zone.redFrom', msg: 'muss über drill.unhook.tension liegen' });
  if (b.drill.stamina.baseS.Legendaer > b.drill.stamina.legendaerMaxS) issues.push({ key: 'drill.stamina.legendaerMaxS', msg: 'kleiner als baseS.Legendaer' });
  if (b.time.phaseLengthS * 4 !== b.time.dayLengthS) issues.push({ key: 'time.phaseLengthS', msg: '4 Phasen ergeben nicht dayLengthS' });
  if (b.shiny.capOneIn > b.shiny.badgeOneIn || b.shiny.badgeOneIn > b.shiny.baseOneIn) issues.push({ key: 'shiny', msg: 'erwartet capOneIn ≤ badgeOneIn ≤ baseOneIn' });
  let prev = 0;
  for (const g of T.SIZE_GRADES) {
    const up = b.size.grade[g].upTo;
    if (up <= prev) issues.push({ key: `size.grade.${g}.upTo`, msg: `muss größer als die vorige Grenze (${prev}) sein` });
    prev = up;
  }
  if (prev !== 1) issues.push({ key: 'size.grade.Riesig.upTo', msg: 'letzte Klasse muss bis 1.0 reichen' });
  return { data: issues.length ? null : b, issues };
}

/** balancing.json (z. B. aus `this.cache.json.get('balancing')`) → typisiertes Objekt. Wirft bei Fehlern. */
export function loadBalancing(json: unknown): Balancing {
  const { data, issues } = validateBalancing(json);
  if (!data) throw new Error(`balancing.json ungültig:\n${issues.map((i) => `${i.key}: ${i.msg}`).join('\n')}`);
  return data;
}
