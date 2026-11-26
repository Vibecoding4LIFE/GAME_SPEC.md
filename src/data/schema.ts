// src/data/schema.ts – Zod-Schemas (zod 4) für die CSV-Zeilen in Data/ und für die erzeugten JSON-Dateien.
// Regeln aus GAME_SPEC.md Teil G 6.1/6.6/6.8 und docs/datenvertrag.md:
//   Trennzeichen ";" (macht csv-parse), Mehrfachwerte "|", Dezimalpunkt ".", leere Zelle = Standardwert.
// Keine Node-APIs: Die Schemas laufen auch im Browser und in Deno (Edge Functions).
import { z } from 'zod';
import * as T from './types';

// ---------------------------------------------------------------- Bausteine

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Leere Zelle → Standardwert `def` (Ausgabetyp des Schemas). */
export function opt<S extends z.ZodType>(schema: S, def: z.output<S>) {
  return z
    .preprocess((v) => (isBlank(v) ? undefined : v), schema.optional())
    .transform((v): z.output<S> => (v === undefined ? def : (v as z.output<S>)));
}

const EMPTY = 'Pflichtfeld ist leer';

/** Pflicht-Text (nicht leer). */
export const text = z.string({ error: EMPTY }).trim().min(1, EMPTY);

/** Pflicht-Zahl; eine leere Zelle ist ein Fehler (nicht 0). */
export const num = z.string({ error: EMPTY }).trim().min(1, EMPTY).transform(Number).pipe(z.number({ error: 'Zahl erwartet' }));
export const int = num.pipe(z.number().int('ganze Zahl erwartet'));

/** 0/1 → boolean */
export const bool = z.enum(['0', '1'], { error: 'erwartet 0 oder 1' }).transform((v) => v === '1');

const splitList = (s: string): string[] => s.split('|').map((x) => x.trim()).filter((x) => x.length > 0);

/** Flags/Mehrfachwerte "A|B" gegen ein Enum. */
export const flags = <const E extends readonly [string, ...string[]]>(vals: E) =>
  z.string().transform(splitList).pipe(z.array(z.enum(vals)));

/** "3-6" oder "2" → {min,max} */
export const range = z
  .string()
  .trim()
  .regex(/^\d+(-\d+)?$/, 'Format "min-max" erwartet')
  .transform((s) => {
    const [a, b] = s.split('-').map(Number);
    return { min: a ?? 0, max: b ?? a ?? 0 };
  })
  .refine((r) => r.min <= r.max, 'min ist größer als max');

/** "96x48" → {w,h} */
export const canvas = z
  .string()
  .trim()
  .regex(/^\d+x\d+$/, 'Format "BxH" erwartet')
  .transform((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w: w ?? 0, h: h ?? 0 };
  });

/** "#RRGGBB" (Großbuchstaben), kein Reinschwarz/Reinweiß (Style Guide). */
export const hex = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex-Farbe "#RRGGBB" erwartet')
  .transform((s) => s.toUpperCase())
  .refine((s) => s !== '#000000' && s !== '#FFFFFF', 'kein #000000/#FFFFFF erlaubt');
export const hexList = (min: number, max: number) =>
  z.string().transform(splitList).pipe(z.array(hex).min(min).max(max));

/** Wetter- oder Ereignis-Schlüssel für Pflicht-/ODER-Bedingungen ("Alle"/"Keins" sind dort sinnlos). */
export const spawnCondition = z
  .union([z.enum(T.WEATHERS), z.enum(T.WORLD_EVENTS)])
  .refine((v) => v !== 'Alle' && v !== 'Keins', '"Alle"/"Keins" ist als Bedingung nicht erlaubt');

/** DNF: "A|B+C" → [["A"],["B","C"]] (| = ODER, + = UND). */
export const dnf = z
  .string()
  .transform((s) => splitList(s).map((term) => term.split('+').map((x) => x.trim())))
  .pipe(z.array(z.array(spawnCondition).min(1)));

/** Merkmal-Tags: frei, aber Kleinbuchstaben/Unterstrich. */
export const tags = z.string().transform(splitList).pipe(z.array(z.string().regex(/^[a-z_]+$/, 'Tag nur a–z und _')));

const kuerzelValues = Object.values(T.WORLD_KUERZEL) as [T.WorldKuerzel, ...T.WorldKuerzel[]];

// ---------------------------------------------------------------- Data/fish.csv

export const FishRow = z.strictObject({
  id: z.string().trim().regex(/^F\d{3}$/, 'ID im Format F001 erwartet'),
  nr: int.pipe(z.number().min(1).max(100)),
  name_de: text,
  basis: text,
  fantasie: bool,
  welt: z.enum(T.WORLD_IDS),
  seltenheit: z.enum(T.RARITIES),
  boss: bool,
  groesse: z.enum(T.SIZE_CLASSES),
  canvas,
  laenge_min_cm: num.pipe(z.number().positive()),
  laenge_max_cm: num.pipe(z.number().positive()),
  k: opt(num.pipe(z.number().positive()), 0.011),
  tiefe_min_m: num.pipe(z.number().min(0)),
  tiefe_max_m: num.pipe(z.number().min(0)),
  zonen: opt(flags(T.HORIZONTAL_ZONES), ['Alle']),
  zeit: opt(flags(T.TIMES_OF_DAY), ['Immer']),
  wetter_pflicht: opt(flags(T.WEATHERS), ['Alle']),
  wetter_bevorzugt: opt(flags(T.WEATHERS), []),
  ereignis_pflicht: opt(z.enum(T.WORLD_EVENTS), 'Keins'),
  ereignis_bevorzugt: opt(z.enum(T.WORLD_EVENTS), 'Keins'),
  koeder_mag: opt(flags(T.BAIT_IDS), []),
  koeder_mag_nicht: opt(flags(T.BAIT_IDS), []),
  schwarm: opt(range, { min: 0, max: 0 }),
  zupfer: opt(range, { min: 0, max: 2 }),
  scheinbisse: opt(bool, false),
  zahnfisch: opt(bool, false),
  verhalten: z.enum(T.FIGHT_BEHAVIORS),
  verhalten2: opt(z.enum(T.FIGHT_BEHAVIORS).nullable(), null),
  verhalten2_ab: opt(num.pipe(z.number().min(0).max(1)), 0.5),
  kraft: opt(int.pipe(z.number().min(1).max(10)), 3),
  zone_mod: opt(num.pipe(z.number().min(-1).max(1)), 0),
  punkte: int.pipe(z.number().min(0)),
  leuchtet: opt(bool, false),
  art_text: text,
  schillernd_text: text,
  lexikon_text: text,
  hinweis_text: text,
  // Zusatzspalten docs/datenvertrag.md §1
  pflicht_oder: opt(dnf, []),
  koerperform: z.enum(T.BODY_SHAPES),
  schwanz: z.enum(T.TAIL_SHAPES),
  muster: z.enum(T.PATTERNS),
  farben: hexList(4, 5),
  schillernd_farben: hexList(4, 5),
  merkmale: opt(tags, []),
  name_en: text,
  lexikon_text_en: text,
  hinweis_text_en: text,
});
export type FishRowT = z.output<typeof FishRow>;

// ---------------------------------------------------------------- Data/boss_phases.csv

export const BossPhaseRow = z.strictObject({
  fisch_id: z.string().trim().regex(/^F\d{3}$/, 'ID im Format F001 erwartet'),
  phase: int.pipe(z.number().min(1).max(9)),
  name_de: text,
  hp_von: opt(num.pipe(z.number().min(0).max(1)), 1),
  hp_bis: opt(num.pipe(z.number().min(0).max(1)), 0.7),
  verhalten: z.string().transform(splitList).pipe(z.array(z.enum(T.FIGHT_BEHAVIORS)).min(1, 'mindestens ein Verhalten')),
  spezial: opt(z.enum(T.BOSS_SPECIALS), 'Keine'),
  kraft: opt(int.pipe(z.number().min(1).max(10)), 8),
  ansage_de: text,
  name_en: text,
  ansage_en: text,
});
export type BossPhaseRowT = z.output<typeof BossPhaseRow>;

// ---------------------------------------------------------------- Data/worlds.csv, weather.csv, events.csv

const layerList = z
  .string()
  .trim()
  .regex(/^[^:|]+:\d+-\d+(\|[^:|]+:\d+-\d+)*$/, 'Format "Name:min-max|…" erwartet')
  .transform((s) =>
    s.split('|').map((part) => {
      const idx = part.lastIndexOf(':');
      const [min, max] = part.slice(idx + 1).split('-').map(Number);
      return { name: part.slice(0, idx).trim(), minM: min ?? 0, maxM: max ?? 0 };
    }),
  );

export const WorldRow = z.strictObject({
  id: z.enum(T.WORLD_IDS),
  index: int.pipe(z.number().min(1).max(5)),
  kuerzel: z.enum(kuerzelValues),
  name_de: text,
  name_en: text,
  muenzfaktor: num.pipe(z.number().positive()),
  leitfarben: hexList(8, 8),
  min_tiefe_m: opt(num.pipe(z.number().min(0)), 0),
  max_tiefe_m: num.pipe(z.number().positive()),
  schichten: layerList,
  ufer_ende_m: opt(num.pipe(z.number().positive()), 6),
  freiwasser_ende_m: opt(num.pipe(z.number().positive()), 15),
  mechanik: z.enum(T.WORLD_MECHANICS),
  schillernd_regel: text,
});
export type WorldRowT = z.output<typeof WorldRow>;

export const WeatherRow = z.strictObject({
  welt: z.enum(T.WORLD_IDS),
  wetter: z.enum(T.WEATHERS).refine((w) => w !== 'Alle', '"Alle" ist kein Wetter'),
  gewicht: num.pipe(z.number().min(0)),
  anzeigename_de: text,
  anzeigename_en: text,
  nur_zeit: opt(z.enum(T.TIMES_OF_DAY).nullable(), null),
});
export type WeatherRowT = z.output<typeof WeatherRow>;

export const EventRow = z.strictObject({
  welt: z.enum(T.WORLD_IDS),
  ereignis: z.enum(T.WORLD_EVENTS).refine((e) => e !== 'Keins', '"Keins" ist kein Ereignis'),
  beschreibung_de: text,
});
export type EventRowT = z.output<typeof EventRow>;

// ---------------------------------------------------------------- public/data/fish_db.json (Teil G 6.7 + Vertrag §3)

const pair = z.tuple([z.number(), z.number()]);

export const BossPhaseDbSchema = z.object({
  phase: z.number().int(),
  nameKey: z.string(),
  name: z.string(),
  nameEn: z.string(),
  hpVon: z.number(),
  hpBis: z.number(),
  verhalten: z.array(z.enum(T.FIGHT_BEHAVIORS)),
  spezial: z.enum(T.BOSS_SPECIALS),
  kraft: z.number().int(),
  ansageKey: z.string(),
  ansage: z.string(),
});
export type BossPhaseDb = z.output<typeof BossPhaseDbSchema>;

export const FishDbEntrySchema = z.object({
  id: z.string().regex(/^F\d{3}$/),
  nr: z.number().int(),
  name: z.string(),
  nameEn: z.string(),
  basis: z.string(),
  fantasie: z.boolean(),
  welt: z.enum(T.WORLD_IDS),
  weltKuerzel: z.enum(kuerzelValues),
  slug: z.string(),
  assetKey: z.string(),
  seltenheit: z.enum(T.RARITIES),
  boss: z.boolean(),
  groesse: z.object({
    klasse: z.enum(T.SIZE_CLASSES),
    canvas: pair,
    laengeCm: pair,
    k: z.number(),
  }),
  spawn: z.object({
    tiefeM: pair,
    zonen: z.array(z.enum(T.HORIZONTAL_ZONES)),
    zeit: z.array(z.enum(T.TIMES_OF_DAY)),
    wetterPflicht: z.array(z.enum(T.WEATHERS)),
    wetterBevorzugt: z.array(z.enum(T.WEATHERS)),
    ereignisPflicht: z.enum(T.WORLD_EVENTS),
    ereignisBevorzugt: z.enum(T.WORLD_EVENTS),
    pflichtOder: z.array(z.array(z.union([z.enum(T.WEATHERS), z.enum(T.WORLD_EVENTS)]))),
    koederMag: z.array(z.string()),
    koederMagNicht: z.array(z.string()),
    schwarm: pair.nullable(),
  }),
  biss: z.object({ zupfer: pair, scheinbisse: z.boolean(), zahnfisch: z.boolean() }),
  drill: z.object({
    verhalten: z.enum(T.FIGHT_BEHAVIORS),
    verhalten2: z.enum(T.FIGHT_BEHAVIORS).nullable(),
    verhalten2Ab: z.number(),
    kraft: z.number().int(),
    zoneMod: z.number(),
  }),
  punkte: z.number().int(),
  art: z.object({
    koerperform: z.enum(T.BODY_SHAPES),
    schwanz: z.enum(T.TAIL_SHAPES),
    muster: z.enum(T.PATTERNS),
    farben: z.array(z.string()),
    schillerndFarben: z.array(z.string()),
    merkmale: z.array(z.string()),
    text: z.string(),
    schillernd: z.string(),
    leuchtet: z.boolean(),
  }),
  texte: z.object({ lexikon: z.string(), hinweis: z.string() }),
  bossPhasen: z.array(BossPhaseDbSchema).optional(),
});
export type FishDbEntry = z.output<typeof FishDbEntrySchema>;

export const FishDbSchema = z.object({ version: z.literal(1), fish: z.array(FishDbEntrySchema) });
export type FishDb = z.output<typeof FishDbSchema>;

// ---------------------------------------------------------------- public/data/worlds.json

export const WorldDbEntrySchema = z.object({
  id: z.enum(T.WORLD_IDS),
  index: z.number().int(),
  kuerzel: z.enum(kuerzelValues),
  nameKey: z.string(),
  name: z.string(),
  nameEn: z.string(),
  muenzfaktor: z.number(),
  leitfarben: z.array(z.string()),
  minTiefeM: z.number(),
  maxTiefeM: z.number(),
  schichten: z.array(z.object({ name: z.string(), minM: z.number(), maxM: z.number() })),
  uferEndeM: z.number(),
  freiwasserEndeM: z.number(),
  mechanik: z.enum(T.WORLD_MECHANICS),
  schillerndRegel: z.string(),
  wetter: z.array(
    z.object({
      wetter: z.enum(T.WEATHERS),
      gewicht: z.number(),
      anzeigename: z.string(),
      anzeigenameEn: z.string(),
      displayNameKey: z.string(),
      nurZeit: z.enum(T.TIMES_OF_DAY).nullable(),
    }),
  ),
  ereignisse: z.array(z.object({ ereignis: z.enum(T.WORLD_EVENTS), beschreibung: z.string() })),
  fish: z.array(z.string()),
  boss: z.string().nullable(),
});
export type WorldDbEntry = z.output<typeof WorldDbEntrySchema>;

export const WorldDbSchema = z.object({ version: z.literal(1), worlds: z.array(WorldDbEntrySchema) });
export type WorldDb = z.output<typeof WorldDbSchema>;
