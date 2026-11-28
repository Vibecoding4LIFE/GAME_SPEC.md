// src/net/messages.ts – alle Realtime-Nachrichten (B4-Tabelle) als Zod-Schemas mit Umschlag {type, from, seq, ts}.
//
// Grundsatz Host-Autorität: Clients schicken Absichten (`cast`, `lure`, `strike`, `retrieve`, `reel`, `reelResult`,
// `join`, `ready`, `leave`, `emote`, `pos`, `ping`), der Host schickt Entscheidungen.
// GEHEIMNIS: Vor dem Fang verlässt keine Fischart den Host. `bite` enthält nur Drill-Werte (Kraft, Verhalten,
// Ausdauer, Zonen-Modifikator, Bossphasen ohne Namen) – keine ID, keine Nummer, kein Name. Erst `catch` nennt die Art.
//
// Ergänzungen zur B4-Tabelle (nötig für Host-Autorität, im Bericht begründet):
//   lure {tiefe, zucken}   Ködertiefe/Zucken (der Host würfelt den Spawn nach Tiefe, D 1.9)
//   strike {reaktion}      Anschlag; der Host entscheidet perfekt/ok/zu früh/zu spät
//   retrieve {}            Schnur ohne Fisch einholen
//   results {…}            Platzierung, Münzen, Sonderauszeichnungen (D 2.5/2.6)
//   deny {grund}           Beitritt abgelehnt (Raum gesperrt/voll)
// Feldnamen folgen der Spec (deutsch, ohne Umlaute). Zeiten: `ts`, `ende`, `t0/t1` in ms; Dauern in s.
import { z } from 'zod';
import {
  FIGHT_BEHAVIORS, SIZE_CLASSES, SIZE_GRADES, TIMES_OF_DAY, WEATHERS, WORLD_EVENTS, WORLD_IDS,
} from '../data/types';
import { ROD_STATES } from '../game/session';
import { ROUND_PHASES } from './round';

// ------------------------------------------------------------------ Grundtypen

export const PlayerIdSchema = z.string().min(1).max(64);
export type PlayerId = string;

const num = z.number().finite();
const nonNeg = num.min(0);
const frac = num.min(0).max(1);
const int = z.number().int().min(0);
const obj = z.strictObject;

const worldId = z.enum(WORLD_IDS);
const fishId = z.string().regex(/^F\d{3}$/);
const activeWeather = z.enum(WEATHERS).exclude(['Alle']);
const worldEvent = z.enum(WORLD_EVENTS);
const dayPhase = z.enum(TIMES_OF_DAY).exclude(['Immer']);
const behavior = z.enum(FIGHT_BEHAVIORS);

export const GAME_MODES = ['Wettangeln', 'RaritaetenJagd', 'BossDuell', 'Kapitalfang', 'FangBingo', 'TeamAngeln', 'FreiesAngeln'] as const;
export type GameMode = (typeof GAME_MODES)[number];
/** In Phase 2 spielbar */
export const SUPPORTED_MODES: readonly GameMode[] = ['Wettangeln'];

export const EQUIPMENT_RULES = ['Ausgeglichen', 'Eigene', 'Leihausruestung'] as const;
export type EquipmentRule = (typeof EQUIPMENT_RULES)[number];

export const EMOTES = ['petriHeil', 'nichtSchonWieder', 'fisch', 'lachen'] as const;
export type EmoteId = (typeof EMOTES)[number];

export const AWARDS = ['SchwersterBrocken', 'Sammler', 'Meisterdrill', 'Pechvogel', 'SchabernackKoenig'] as const;
export type Award = (typeof AWARDS)[number];

/** Gründe in `rodState.grund`: abgelehnte Absichten und Verluste. */
export const ROD_REASONS = [
  // abgelehnt
  'phase', 'abklingzeit', 'reichweite', 'zustand', 'unplausibel',
  // Verlust / Ende
  'zuFrueh', 'zuSpaet', 'abbiss', 'lineBreak', 'heatBreak', 'unhooked', 'jumpShake',
  'zeitUeberschritten', 'rundenende', 'neuVerbunden', 'eingeholt',
] as const;
export type RodReason = (typeof ROD_REASONS)[number];

export const LoadoutIdsSchema = obj({
  rod: z.string().max(16), line: z.string().max(16), leader: z.string().max(16).nullable(), reel: z.string().max(16),
  bait: z.string().max(16), accessories: z.array(z.string().max(16)).max(4),
});

export const SettingsSchema = obj({
  welt: worldId,
  modus: z.enum(GAME_MODES),
  dauerS: num.positive(),
  ausruestung: z.enum(EQUIPMENT_RULES),
  /** Schabernack-Items an/aus (Items selbst: Phase 4) */
  schabernack: z.boolean(),
  tageszeit: z.union([z.literal('Zufall'), dayPhase]),
  wetter: z.union([z.literal('Zufall'), activeWeather]),
  teams: z.enum(['JederGegenJeden', 'ZweiGegenZwei']),
});
export type LobbySettings = z.output<typeof SettingsSchema>;

// ------------------------------------------------------------------ Nutzdaten je Typ

const PosData = obj({ spieler: PlayerIdSchema, x: num });
const CastData = obj({ kraft: frac, ziel: nonNeg });
const LureData = obj({ tiefe: nonNeg, zucken: z.boolean() });
const StrikeData = obj({ reaktion: nonNeg.nullable() });
const RetrieveData = obj({});
const RodStateData = obj({
  spieler: PlayerIdSchema,
  zustand: z.enum(ROD_STATES),
  grund: z.enum(ROD_REASONS).optional(),
  /** Zupfer-Nummer (Nibble) */
  n: int.optional(),
  /** Scheinbiss (Nibble) */
  schein: z.boolean().optional(),
  /** Anschlag perfekt (Reeling) */
  perfekt: z.boolean().optional(),
  /** Wurf (Waiting nach `cast`) */
  wurf: obj({ weite: nonNeg, zone: z.enum(['Ufer', 'Freiwasser', 'Kante']), perfekt: z.boolean(), fehl: z.boolean() }).optional(),
});
/** [id, Größenklasse, x in dm, Tiefe in dm, Tempo in cm/s (Vorzeichen = Richtung), Lexikon-Maske je Spieler-Index] */
const ShadowTuple = z.tuple([int, z.enum(SIZE_CLASSES), z.number().int(), z.number().int(), z.number().int(), int]);
const ShadowsData = obj({ s: z.array(ShadowTuple).max(64) });
const BossPhaseSpec = obj({ von: frac, bis: frac, kraft: nonNeg, verhalten: z.array(behavior).max(6) });
export const DrillSpecSchema = obj({
  /** Kraft K (1–10) */
  kraft: nonNeg,
  /** Ausdauer in s (Host: Seltenheit × Größe × Brocken, `drillStaminaS`) */
  ausdauer: nonNeg,
  /** Modifikator der grünen Zone */
  zone: num,
  /** Zweitverhalten ab Ausdauer-Anteil */
  zweit: obj({ verhalten: behavior, ab: frac }).nullable(),
  /** Bossphasen (ohne Namen/Ansage) */
  phasen: z.array(BossPhaseSpec).max(6),
});
export type DrillSpec = z.output<typeof DrillSpecSchema>;
const BiteData = obj({
  spieler: PlayerIdSchema,
  verhalten: behavior,
  schwierigkeit: DrillSpecSchema,
  /** Saat des Drill-Zufalls (Client-Drill reproduzierbar) */
  seed: int,
  /** Anfängerschutz-/Kescher-Rettungen, die in diesem Drill noch gelten */
  schutz: obj({ anfaenger: int, kescher: int }),
});
const ReelData = obj({ spannung: frac, fortschritt: frac });
const DRILL_OUTCOMES = ['caught', 'lineBreak', 'heatBreak', 'unhooked', 'jumpShake'] as const;
const ReelResultData = obj({
  ergebnis: z.enum(DRILL_OUTCOMES),
  /** Drilldauer in s (Client-Uhr) */
  dauer: nonNeg,
  meister: z.boolean(),
  /** verbrauchte Anfängerschutz-/Kescher-Rettungen */
  anfaenger: int,
  kescher: int,
});
export const CatchDataSchema = obj({
  spieler: PlayerIdSchema,
  id: fishId,
  nr: int,
  laenge: nonNeg,
  gewicht: nonNeg,
  groesse: z.enum(SIZE_GRADES),
  schillernd: z.boolean(),
  /** null, solange die Punkte verdeckt sind (D 2.5) */
  punkte: int.nullable(),
  finale: z.boolean(),
  meister: z.boolean(),
  perfekterWurf: z.boolean(),
  perfekterAnschlag: z.boolean(),
  /** Fangzeit (Host-Uhr, ms) */
  t: nonNeg,
});
export type CatchData = z.output<typeof CatchDataSchema>;
const ScoreEntry = obj({ spieler: PlayerIdSchema, punkte: int.nullable(), faenge: int, rueckenwind: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable() });
export const ScoresDataSchema = obj({ runde: int, verdeckt: z.boolean(), liste: z.array(ScoreEntry).max(8) });
export type ScoresData = z.output<typeof ScoresDataSchema>;
const PlayerInfo = obj({
  id: PlayerIdSchema, name: z.string().max(24), hut: z.string().max(16), boot: z.string().max(16),
  bereit: z.boolean(), verbunden: z.boolean(), gast: z.boolean(), ausruestung: LoadoutIdsSchema,
});
export type PlayerInfo = z.output<typeof PlayerInfo>;
export const RoundDataSchema = obj({
  runde: int,
  host: PlayerIdSchema,
  einstellungen: SettingsSchema,
  spieler: z.array(PlayerInfo).max(8),
  gesperrt: z.boolean(),
  /** erlaubte Welten (alle, die irgendein Spieler freigeschaltet hat, D 2.1) */
  welten: z.array(worldId),
  wetter: activeWeather.nullable(),
  wind: z.union([z.literal(-1), z.literal(1)]),
  tageszeit: dayPhase.nullable(),
  ereignisse: z.array(worldEvent),
});
export type RoundData = z.output<typeof RoundDataSchema>;
export const PhaseEndDataSchema = obj({
  runde: int,
  phase: z.enum(ROUND_PHASES),
  /** B4: der eine Zeitwert (Host-Uhr, ms) */
  ende: nonNeg.nullable(),
  /** Ende der Angelzeit (ms), damit der Rundentimer ohne zweite Nachricht läuft */
  angelEnde: nonNeg.nullable(),
});
export type PhaseEndData = z.output<typeof PhaseEndDataSchema>;
const ResultEntry = obj({
  spieler: PlayerIdSchema, platz: int, punkte: int, faenge: int, arten: int, schwersterG: nonNeg,
  muenzen: int, auszeichnungen: z.array(z.enum(AWARDS)), xp: int, pity: int, gast: z.boolean(),
});
export const ResultsDataSchema = obj({ runde: int, plaetze: z.array(ResultEntry).max(8) });
export type ResultsData = z.output<typeof ResultsDataSchema>;
const EmoteData = obj({ id: z.enum(EMOTES) });
const SyncData = obj({
  round: RoundDataSchema,
  phase: PhaseEndDataSchema,
  scores: ScoresDataSchema,
  rods: z.array(obj({ spieler: PlayerIdSchema, zustand: z.enum(ROD_STATES) })).max(8),
  /** Fang-Feed dieser Runde (nur bereits gefangene Fische) */
  feed: z.array(CatchDataSchema).max(400),
  results: ResultsDataSchema.nullable(),
  ich: obj({ zustand: z.enum(ROD_STATES), anfaenger: int, kescher: int }),
});
export type SyncData = z.output<typeof SyncData>;
const JoinData = obj({
  name: z.string().min(1).max(24),
  hut: z.string().max(16),
  boot: z.string().max(16),
  /** Ruf-Stufe (Anfängerschutz bis Stufe 5) */
  ruf: int,
  /** freigeschaltete Welten */
  welten: z.array(worldId).max(5),
  /** schon gefangene Arten (Lexikon-Symbol an Schatten) */
  bekannt: z.array(fishId).max(100),
  /** vollständige Weltabzeichen (Schillernd-Chance) */
  abzeichen: z.array(worldId).max(5),
  /** Glücksschimmer-Zähler */
  pity: int,
  ausruestung: LoadoutIdsSchema,
  /** eigener Rutenzustand vor dem (Wieder-)Beitritt; null = frischer Start */
  aktiv: z.enum(ROD_STATES).nullable(),
});
export type JoinData = z.output<typeof JoinData>;
const DenyData = obj({ grund: z.enum(['gesperrt', 'voll', 'ungueltig']) });
const LeaveData = obj({});
const ReadyData = obj({ bereit: z.boolean() });
const PingData = obj({ t0: nonNeg });
const PongData = obj({ t0: nonNeg, t1: nonNeg });

// ------------------------------------------------------------------ Umschlag

const envelope = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  obj({
    type: z.literal(type),
    from: PlayerIdSchema,
    /** laufende Nummer je Absender (ab 1) */
    seq: int,
    /** Absender-Uhr (ms) */
    ts: nonNeg,
    /** gezielte Nachricht (sync, pong, deny); fehlt = an alle */
    to: PlayerIdSchema.optional(),
    data,
  });

export const NetMessageSchema = z.discriminatedUnion('type', [
  envelope('pos', PosData),
  envelope('cast', CastData),
  envelope('lure', LureData),
  envelope('strike', StrikeData),
  envelope('retrieve', RetrieveData),
  envelope('rodState', RodStateData),
  envelope('shadows', ShadowsData),
  envelope('bite', BiteData),
  envelope('reel', ReelData),
  envelope('reelResult', ReelResultData),
  envelope('catch', CatchDataSchema),
  envelope('scores', ScoresDataSchema),
  envelope('round', RoundDataSchema),
  envelope('phaseEnd', PhaseEndDataSchema),
  envelope('results', ResultsDataSchema),
  envelope('emote', EmoteData),
  envelope('sync', SyncData),
  envelope('join', JoinData),
  envelope('deny', DenyData),
  envelope('leave', LeaveData),
  envelope('ready', ReadyData),
  envelope('ping', PingData),
  envelope('pong', PongData),
]);

export type NetMessage = z.output<typeof NetMessageSchema>;
export type MessageType = NetMessage['type'];
export type MessageOf<T extends MessageType> = Extract<NetMessage, { type: T }>;
export type DataOf<T extends MessageType> = MessageOf<T>['data'];

export const MESSAGE_TYPES = NetMessageSchema.options.map((o) => o.shape.type.value) as MessageType[];

/** Nur der Host darf diese Typen senden (Clients ignorieren sie von anderen Absendern). */
export const HOST_ONLY: ReadonlySet<MessageType> = new Set<MessageType>([
  'rodState', 'shadows', 'bite', 'catch', 'scores', 'round', 'phaseEnd', 'results', 'sync', 'deny', 'pong',
]);
/** Absichten, die nur der Host auswertet. */
export const CLIENT_INTENTS: ReadonlySet<MessageType> = new Set<MessageType>([
  'cast', 'lure', 'strike', 'retrieve', 'reel', 'reelResult', 'join', 'ready', 'leave', 'ping',
]);

/** Unbekanntes (z. B. aus dem Netz) → geprüfte Nachricht oder null. */
export function parseMessage(raw: unknown): NetMessage | null {
  const r = NetMessageSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Erzeugt Umschläge mit laufender Nummer für einen Absender. */
export class Outbox {
  private seq = 0;
  constructor(readonly from: PlayerId, private readonly now: () => number) {}

  make<T extends MessageType>(type: T, data: DataOf<T>, to?: PlayerId): MessageOf<T> {
    this.seq++;
    const m = { type, from: this.from, seq: this.seq, ts: Math.max(0, Math.round(this.now())), data } as Record<string, unknown>;
    if (to !== undefined) m.to = to;
    return m as MessageOf<T>;
  }

  get lastSeq(): number { return this.seq; }
}

/** Gilt die Nachricht für `me` (an alle oder gezielt an mich)? */
export const isForMe = (m: NetMessage, me: PlayerId): boolean => m.to === undefined || m.to === me;
