// src/game/save.ts – Spielstand (Profil) serialisieren und prüfen: Zod-Schema, Versionsnummer, Migrationen.
// Schreiben/Lesen im Browser macht src/core/storage.ts; später prüft die Edge Function `save-progress` mit demselben Schema.
import { z } from 'zod';
import type { GearDb } from '../data/gear';
import { SIZE_GRADES, WORLD_IDS, type FishId, type SizeGrade, type WorldId } from '../data/types';
import type { Lexicon } from './lexicon';

export const SAVE_VERSION = 1 as const;

/** Ein Fang im Fangeimer (D 3.2), Felder wie `BucketItem` in src/ui/types.ts (ohne Sprite/FishData). */
export interface CatchRecord {
  uid: string;
  fishId: FishId;
  lengthCm: number;
  weightG: number;
  sizeX: number;
  grade: SizeGrade;
  shiny: boolean;
  points: number;
  /** Verkaufswert in Münzen */
  value: number;
  xp: number;
  isNew: boolean;
  isRecord: boolean;
  masterDrill: boolean;
  perfectCast: boolean;
  perfectStrike: boolean;
}

export interface LoadoutIds {
  rod: string; line: string; leader: string | null; reel: string; bait: string; accessories: string[];
}

export interface Profile {
  coins: number;
  pearls: number;
  xp: number;
  lexicon: Lexicon;
  /** Köder-Vorrat (unendliche Köder brauchen keinen Eintrag) */
  baits: Record<string, number>;
  owned: { rods: string[]; lines: string[]; reels: string[]; accessories: string[] };
  loadout: LoadoutIds;
  /** Fundstücke: ID → Anzahl */
  curios: Record<string, number>;
  hats: string[];
  /** vollständige Weltabzeichen (D 3.5) */
  badges: WorldId[];
  /** Glücksschimmer-Zähler (D 1.9) */
  pityCount: number;
  bucket: CatchRecord[];
  catchCounter: number;
}

const nonNeg = z.number().finite().min(0);
const int = z.number().int().min(0);
const fishId = z.custom<FishId>((v) => typeof v === 'string' && /^F\d{3}$/.test(v), { message: 'Fisch-ID F001 erwartet' });

const LexiconEntrySchema = z.object({
  state: z.enum(['unknown', 'seen', 'caught']),
  count: int,
  recordLengthCm: nonNeg.optional(),
  recordWeightG: nonNeg.optional(),
  bestTier: z.enum(SIZE_GRADES).optional(),
  shiny: z.boolean().optional(),
  shinyCount: int.optional(),
});

export const CatchRecordSchema = z.object({
  uid: z.string().min(1),
  fishId,
  lengthCm: nonNeg,
  weightG: nonNeg,
  sizeX: z.number().min(0).max(1),
  grade: z.enum(SIZE_GRADES),
  shiny: z.boolean(),
  points: int,
  value: int,
  xp: nonNeg,
  isNew: z.boolean(),
  isRecord: z.boolean(),
  masterDrill: z.boolean(),
  perfectCast: z.boolean(),
  perfectStrike: z.boolean(),
});

export const ProfileSchema = z.object({
  coins: int,
  pearls: int,
  xp: nonNeg,
  lexicon: z.record(z.string().regex(/^F\d{3}$/), LexiconEntrySchema),
  baits: z.record(z.string(), int),
  owned: z.object({ rods: z.array(z.string()), lines: z.array(z.string()), reels: z.array(z.string()), accessories: z.array(z.string()) }),
  loadout: z.object({
    rod: z.string(), line: z.string(), leader: z.string().nullable(), reel: z.string(), bait: z.string(), accessories: z.array(z.string()),
  }),
  curios: z.record(z.string(), int),
  hats: z.array(z.string()),
  badges: z.array(z.enum(WORLD_IDS)),
  pityCount: int,
  bucket: z.array(CatchRecordSchema),
  catchCounter: int,
});

/** Einstellungen, die mit dem Spielstand gespeichert werden (alle optional). */
export interface Settings { showFps?: boolean; touchHintsSeen?: boolean; introSeen?: boolean; vibration?: boolean; shake?: boolean }
export const SettingsSchema = z.object({
  showFps: z.boolean().optional(), touchHintsSeen: z.boolean().optional(), introSeen: z.boolean().optional(),
  vibration: z.boolean().optional(), shake: z.boolean().optional(),
});

export const SaveSchema = z.object({
  version: z.literal(SAVE_VERSION), savedAt: z.number(), profile: ProfileSchema, settings: SettingsSchema.optional(),
});
export type SaveGame = { version: typeof SAVE_VERSION; savedAt: number; profile: Profile; settings?: Settings };

/** Migrationen: alte Version n → n+1 (rohe Objekte). Leer, solange es nur Version 1 gibt. */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/** Startprofil: Ausrüstung mit Quelle „Start“ bzw. Preis 0, unendlicher Grundköder. */
export function newProfile(gear: GearDb): Profile {
  const rod = gear.rods.find((r) => r.source === 'Start') ?? gear.rods[0];
  const line = gear.lines.find((l) => l.priceCoins === 0 && !l.isLeader) ?? gear.lines[0];
  const reel = gear.reels.find((r) => r.priceCoins === 0) ?? gear.reels[0];
  const bait = gear.baits.find((x) => x.infinite) ?? gear.baits[0];
  if (!rod || !line || !reel || !bait) throw new Error('gear.json ohne Startausrüstung');
  return {
    coins: 0, pearls: 0, xp: 0, lexicon: {}, baits: {},
    owned: { rods: [rod.id], lines: [line.id], reels: [reel.id], accessories: [] },
    loadout: { rod: rod.id, line: line.id, leader: null, reel: reel.id, bait: bait.id, accessories: [] },
    curios: {}, hats: [], badges: [], pityCount: 0, bucket: [], catchCounter: 0,
  };
}

/** Profil → JSON-Text. `now` von außen (kein Date in der reinen Logik). */
export function serializeSave(profile: Profile, now: number, settings?: Settings): string {
  const save: SaveGame = { version: SAVE_VERSION, savedAt: now, profile, ...(settings ? { settings } : {}) };
  return JSON.stringify(save);
}

export type ParseResult = { ok: true; save: SaveGame } | { ok: false; error: string };

/** JSON-Text → geprüfter Spielstand (mit Migration). Wirft nie. */
export function parseSave(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'kein JSON' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'kein Objekt' };
  let obj = raw as Record<string, unknown>;
  let v = typeof obj.version === 'number' ? obj.version : NaN;
  if (!Number.isInteger(v)) return { ok: false, error: 'Versionsnummer fehlt' };
  if (v > SAVE_VERSION) return { ok: false, error: `Spielstand-Version ${v} ist neuer als das Spiel (${SAVE_VERSION})` };
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) return { ok: false, error: `keine Migration von Version ${v}` };
    obj = m(obj);
    v++;
    obj.version = v;
  }
  const res = SaveSchema.safeParse(obj);
  if (!res.success) return { ok: false, error: res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, save: res.data as SaveGame };
}
