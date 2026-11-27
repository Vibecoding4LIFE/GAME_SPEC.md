// Zeilen-Schema fuer Data/fish.csv und Data/boss_phases.csv (Spec G 6.6/6.8).
// Leere Zelle = Standardwert. Kein Zod im Projekt: kleine eigene Pruefung mit Fehlerliste.
import * as T from './types';

export interface FishRow {
  id: string; nr: number; name_de: string; basis: string; fantasie: boolean;
  welt: T.WorldId; seltenheit: T.Rarity; boss: boolean;
  groesse: T.SizeClass; canvas: T.Size;
  laenge_min_cm: number; laenge_max_cm: number; k: number;
  tiefe_min_m: number; tiefe_max_m: number;
  zonen: T.HorizontalZone[]; zeit: T.TimeOfDay[];
  wetter_pflicht: T.Weather[]; wetter_bevorzugt: T.Weather[];
  ereignis_pflicht: T.WorldEvent; ereignis_bevorzugt: T.WorldEvent;
  koeder_mag: string[]; koeder_mag_nicht: string[];
  schwarm: T.Range; schooling: boolean; zupfer: T.Range;
  scheinbisse: boolean; zahnfisch: boolean;
  verhalten: T.FightBehavior; verhalten2: T.FightBehavior | null; verhalten2_ab: number;
  kraft: number; zone_mod: number; punkte: number; leuchtet: boolean;
  art_text: string; schillernd_text: string; lexikon_text: string; hinweis_text: string;
}

export interface BossPhaseRow {
  fisch_id: string; phase: number; name_de: string; hp_von: number; hp_bis: number;
  verhalten: T.FightBehavior[]; spezial: T.BossSpecial; kraft: number; ansage_de: string;
}

type Raw = Record<string, string>;

class Reader {
  errors: string[] = [];
  constructor(private r: Raw) {}
  raw(k: string): string { return (this.r[k] ?? '').trim(); }
  private fail(k: string, msg: string) { this.errors.push(`${k}: ${msg}`); }
  str(k: string, required = true): string {
    const v = this.raw(k);
    if (required && v === '') this.fail(k, 'fehlt');
    return v;
  }
  num(k: string, def?: number): number {
    const v = this.raw(k);
    if (v === '') { if (def === undefined) this.fail(k, 'fehlt'); return def ?? 0; }
    const n = Number(v);
    if (!Number.isFinite(n)) { this.fail(k, `keine Zahl: "${v}"`); return def ?? 0; }
    return n;
  }
  int(k: string, def?: number): number {
    const n = this.num(k, def);
    if (!Number.isInteger(n)) this.fail(k, `keine Ganzzahl: ${n}`);
    return n;
  }
  bool(k: string, def = false): boolean {
    const v = this.raw(k);
    if (v === '') return def;
    if (v !== '0' && v !== '1') { this.fail(k, `0 oder 1 erwartet: "${v}"`); return def; }
    return v === '1';
  }
  enum<E extends readonly string[]>(k: string, vals: E, def?: E[number]): E[number] {
    const v = this.raw(k);
    if (v === '') { if (def === undefined) this.fail(k, 'fehlt'); return (def ?? vals[0]) as E[number]; }
    if (!(vals as readonly string[]).includes(v)) { this.fail(k, `unbekannter Wert "${v}"`); return (def ?? vals[0]) as E[number]; }
    return v as E[number];
  }
  flags<E extends readonly string[]>(k: string, vals: E, def: E[number][]): E[number][] {
    const v = this.raw(k);
    if (v === '') return def;
    const parts = v.split('|');
    for (const p of parts) if (!(vals as readonly string[]).includes(p)) this.fail(k, `unbekannter Wert "${p}"`);
    return parts as E[number][];
  }
  ids(k: string, re: RegExp): string[] {
    const v = this.raw(k);
    if (v === '') return [];
    const parts = v.split('|');
    for (const p of parts) if (!re.test(p)) this.fail(k, `ungueltige ID "${p}"`);
    return parts;
  }
  range(k: string, def: string): T.Range {
    const v = this.raw(k) || def;
    const m = /^(\d+)(?:-(\d+))?$/.exec(v);
    if (!m) { this.fail(k, `Bereich "min-max" erwartet: "${v}"`); return { min: 0, max: 0 }; }
    return { min: Number(m[1]), max: Number(m[2] ?? m[1]) };
  }
  fail2(msg: string) { this.errors.push(msg); }
}

export function parseFishRow(raw: Raw): { row?: FishRow; errors: string[] } {
  const r = new Reader(raw);
  const id = r.str('id');
  if (id && !/^F\d{3}$/.test(id)) r.fail2(`id: ungueltig "${id}"`);
  const cv = /^(\d+)x(\d+)$/.exec(r.str('canvas'));
  if (r.raw('canvas') && !cv) r.fail2('canvas: Format "BxH" erwartet');
  const schwarmRaw = r.raw('schwarm');
  const schooling = schwarmRaw !== '' && schwarmRaw !== '0';
  const verhalten2 = r.raw('verhalten2') === '' ? null : r.enum('verhalten2', T.FIGHT_BEHAVIORS);
  const row: FishRow = {
    id,
    nr: r.int('nr'),
    name_de: r.str('name_de'),
    basis: r.str('basis'),
    fantasie: r.bool('fantasie'),
    welt: r.enum('welt', T.WORLD_IDS),
    seltenheit: r.enum('seltenheit', T.RARITIES),
    boss: r.bool('boss'),
    groesse: r.enum('groesse', T.SIZE_CLASSES),
    canvas: cv ? { w: Number(cv[1]), h: Number(cv[2]) } : { w: 0, h: 0 },
    laenge_min_cm: r.num('laenge_min_cm'),
    laenge_max_cm: r.num('laenge_max_cm'),
    k: r.num('k', 0.011),
    tiefe_min_m: r.num('tiefe_min_m'),
    tiefe_max_m: r.num('tiefe_max_m'),
    zonen: r.flags('zonen', T.HORIZONTAL_ZONES, ['Alle']),
    zeit: r.flags('zeit', T.TIMES_OF_DAY, ['Immer']),
    wetter_pflicht: r.flags('wetter_pflicht', T.WEATHERS, ['Alle']),
    wetter_bevorzugt: r.flags('wetter_bevorzugt', T.WEATHERS, []),
    ereignis_pflicht: r.enum('ereignis_pflicht', T.WORLD_EVENTS, 'Keins'),
    ereignis_bevorzugt: r.enum('ereignis_bevorzugt', T.WORLD_EVENTS, 'Keins'),
    koeder_mag: r.ids('koeder_mag', /^K\d{2}$/),
    koeder_mag_nicht: r.ids('koeder_mag_nicht', /^K\d{2}$/),
    schwarm: schooling ? r.range('schwarm', '1') : { min: 1, max: 1 },
    schooling,
    zupfer: r.range('zupfer', '0-2'),
    scheinbisse: r.bool('scheinbisse'),
    zahnfisch: r.bool('zahnfisch'),
    verhalten: r.enum('verhalten', T.FIGHT_BEHAVIORS),
    verhalten2,
    verhalten2_ab: r.num('verhalten2_ab', 0.5),
    kraft: r.int('kraft', 3),
    zone_mod: r.num('zone_mod', 0),
    punkte: r.int('punkte'),
    leuchtet: r.bool('leuchtet'),
    art_text: r.str('art_text'),
    schillernd_text: r.str('schillernd_text'),
    lexikon_text: r.str('lexikon_text', false),
    hinweis_text: r.str('hinweis_text', false),
  };
  return r.errors.length ? { errors: r.errors } : { row, errors: [] };
}

export function parseBossPhaseRow(raw: Raw): { row?: BossPhaseRow; errors: string[] } {
  const r = new Reader(raw);
  const row: BossPhaseRow = {
    fisch_id: r.str('fisch_id'),
    phase: r.int('phase'),
    name_de: r.str('name_de'),
    hp_von: r.num('hp_von', 1),
    hp_bis: r.num('hp_bis', 0.7),
    verhalten: r.flags('verhalten', T.FIGHT_BEHAVIORS, []),
    spezial: r.enum('spezial', T.BOSS_SPECIALS, 'Keine'),
    kraft: r.int('kraft', 8),
    ansage_de: r.str('ansage_de', false),
  };
  return r.errors.length ? { errors: r.errors } : { row, errors: [] };
}
