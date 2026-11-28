// tools/build-data.ts – `npm run data`
// Liest Data/*.csv, prüft sie (Zod-Schema je Zeile + validateDb/validateGear/validateBalancing), schreibt
// public/data/fish_db.json, worlds.json, gear.json, balancing.json und die Text-Schlüssel in src/i18n/de.json / en.json.
// Fehler: rot mit Fisch-ID, Exit-Code 1. Warnungen: gelb, kein Abbruch.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { z } from 'zod';
import {
  AccessoryRow, BaitRow, BalancingRow, BossPhaseRow, CurioRow, EventRow, FishRow, LineRow, ReelRow, RodRow, WeatherRow, WorldRow,
  type FishDb, type WorldDb,
} from '../src/data/schema';
import { DB_VERSION, bossPhaseKeys, textKeys, toFishDbEntry, toWorldDbEntry, weatherKey } from '../src/data/db';
import { nestBalancing, validateBalancing, type Balancing } from '../src/data/balancing';
import { gearKey, toGearDb, type GearCategory, type GearDb } from '../src/data/gear';
import { DERIVED_FISH_TAGS } from '../src/data/types';
import { validateDb, validateGear, type Issue } from '../src/data/validate';

export interface BuildResult {
  db: FishDb;
  worlds: WorldDb;
  gear: GearDb | null;
  balancing: Balancing | null;
  de: Record<string, string>;
  en: Record<string, string>;
  errors: Issue[];
  warnings: Issue[];
  phaseCount: number;
  balancingCount: number;
}

type Row = Record<string, string>;

function readCsv(path: string): Row[] {
  try {
    return parse(readFileSync(path, 'utf8'), {
      delimiter: ';', columns: true, bom: true, skip_empty_lines: true, trim: true,
    }) as Row[];
  } catch (e) {
    // z. B. abgeschnittene Zeile (falsche Spaltenzahl): als lesbare Meldung statt Stacktrace
    console.error(`\x1b[31mFEHLER ${path}: ${e instanceof Error ? e.message : String(e)}\x1b[0m`);
    process.exit(1);
  }
}

/** Generierte Schlüssel-Namensräume – alles andere (UI-Texte) bleibt unangetastet. */
const GENERATED_KEY = /^(fish\.\d{3}\.|boss\.\d{3}\.|weather\.\d\.|world\.\d\.name$|(rod|line|reel|bait|accessory|curio)\.[a-z0-9]+\.(name|desc|text)$)/;

function parseRows<S extends z.ZodType>(file: string, rows: Row[], schema: S, idOf: (r: Row, i: number) => string, errors: Issue[]): z.output<S>[] {
  const out: z.output<S>[] = [];
  rows.forEach((r, i) => {
    const res = schema.safeParse(r);
    if (res.success) out.push(res.data);
    else errors.push({ id: idOf(r, i), msg: `${file}: ${res.error.issues.map((x) => `${x.path.join('.') || '(Zeile)'} ${x.message}`).join('; ')}` });
  });
  return out;
}

/** Reine Build-Logik ohne Schreiben (für Tests und `npm run data`). */
export function buildData(root: string): BuildResult {
  const errors: Issue[] = [];
  const p = (f: string) => join(root, 'Data', f);
  const line = (prefix: string) => (r: Row, i: number) => r.id || r.fisch_id || `${prefix} Zeile ${i + 2}`;

  const fishRows = parseRows('fish.csv', readCsv(p('fish.csv')), FishRow, line('fish.csv'), errors);
  const phaseRows = parseRows('boss_phases.csv', readCsv(p('boss_phases.csv')), BossPhaseRow, line('boss_phases.csv'), errors);
  const worldRows = parseRows('worlds.csv', readCsv(p('worlds.csv')), WorldRow, (r, i) => r.id || `worlds.csv Zeile ${i + 2}`, errors);
  const weatherRows = parseRows('weather.csv', readCsv(p('weather.csv')), WeatherRow, (r, i) => r.welt || `weather.csv Zeile ${i + 2}`, errors);
  const eventRows = parseRows('events.csv', readCsv(p('events.csv')), EventRow, (r, i) => r.welt || `events.csv Zeile ${i + 2}`, errors);
  const gearRows = {
    rods: parseRows('rods.csv', readCsv(p('rods.csv')), RodRow, line('rods.csv'), errors),
    lines: parseRows('lines.csv', readCsv(p('lines.csv')), LineRow, line('lines.csv'), errors),
    reels: parseRows('reels.csv', readCsv(p('reels.csv')), ReelRow, line('reels.csv'), errors),
    baits: parseRows('baits.csv', readCsv(p('baits.csv')), BaitRow, line('baits.csv'), errors),
    accessories: parseRows('accessories.csv', readCsv(p('accessories.csv')), AccessoryRow, line('accessories.csv'), errors),
    curios: parseRows('curios.csv', readCsv(p('curios.csv')), CurioRow, line('curios.csv'), errors),
  };
  const balancingRows = parseRows('balancing.csv', readCsv(p('balancing.csv')), BalancingRow, (r, i) => r.schluessel || `balancing.csv Zeile ${i + 2}`, errors);

  // Abgeleitete Tags dürfen nicht von Hand in fish.csv stehen (Vertrag §5)
  for (const f of fishRows) {
    const manual = f.tags.filter((t) => (DERIVED_FISH_TAGS as readonly string[]).includes(t));
    if (manual.length) errors.push({ id: f.id, msg: `fish.csv: Tag ${manual.join(', ')} wird abgeleitet und darf nicht in "tags" stehen` });
    if (new Set(f.tags).size !== f.tags.length) errors.push({ id: f.id, msg: 'fish.csv: Tag doppelt' });
  }

  // Bossphasen ohne passenden Boss
  for (const ph of phaseRows) {
    const f = fishRows.find((x) => x.id === ph.fisch_id);
    if (!f) errors.push({ id: ph.fisch_id, msg: 'boss_phases.csv: Fisch unbekannt' });
    else if (!f.boss) errors.push({ id: ph.fisch_id, msg: 'boss_phases.csv: Fisch ist kein Boss' });
  }
  const dupPhase = new Set<string>();
  for (const ph of phaseRows) {
    const k = `${ph.fisch_id}#${ph.phase}`;
    if (dupPhase.has(k)) errors.push({ id: ph.fisch_id, msg: `boss_phases.csv: Phase ${ph.phase} doppelt` });
    dupPhase.add(k);
  }

  const fish = fishRows.map((f) => toFishDbEntry(f, phaseRows)).sort((a, b) => a.nr - b.nr);
  const db: FishDb = { version: DB_VERSION, fish };
  const worlds: WorldDb = {
    version: DB_VERSION,
    worlds: worldRows.sort((a, b) => a.index - b.index).map((w) => toWorldDbEntry(w, weatherRows, eventRows, fish)),
  };

  const report = validateDb(db, worlds);
  errors.push(...report.errors);
  const warnings = [...report.warnings];

  // Balancing → verschachteltes Objekt, Pflicht-Schlüssel und Bereiche prüfen
  const nested = nestBalancing(balancingRows);
  const checked = validateBalancing({ version: 1, ...nested.tree });
  for (const i of [...nested.issues, ...checked.issues]) errors.push({ id: i.key, msg: `balancing.csv: ${i.msg}` });
  const balancing = nested.issues.length ? null : checked.data;

  // Ausrüstung (braucht Balancing für die Sinkgeschwindigkeiten)
  const gear = balancing ? toGearDb(gearRows, balancing) : null;
  if (gear && balancing) {
    const g = validateGear(gear, db, balancing, worlds);
    errors.push(...g.errors);
    warnings.push(...g.warnings);
  }

  // Lokalisierung: bestehende UI-Schlüssel behalten, generierte Namensräume neu schreiben
  const readJson = (f: string): Record<string, string> => JSON.parse(readFileSync(join(root, 'src/i18n', f), 'utf8')) as Record<string, string>;
  const keep = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).filter(([k]) => !GENERATED_KEY.test(k)));
  const de = keep(readJson('de.json'));
  const en = keep(readJson('en.json'));
  for (const f of fishRows) {
    const k = textKeys(f.nr);
    Object.assign(de, { [k.name]: f.name_de, [k.lexicon]: f.lexikon_text, [k.hint]: f.hinweis_text });
    Object.assign(en, { [k.name]: f.name_en, [k.lexicon]: f.lexikon_text_en, [k.hint]: f.hinweis_text_en });
  }
  for (const ph of phaseRows) {
    const k = bossPhaseKeys(ph.fisch_id, ph.phase);
    Object.assign(de, { [k.name]: ph.name_de, [k.ansage]: ph.ansage_de });
    Object.assign(en, { [k.name]: ph.name_en, [k.ansage]: ph.ansage_en });
  }
  const gearText = (cat: GearCategory, id: string, field: 'name' | 'desc' | 'text', vDe: string, vEn: string) => {
    const k = gearKey(cat, id, field);
    if (k in de) errors.push({ id, msg: `i18n-Schlüssel ${k} doppelt` });
    for (const v of [vDe, vEn]) if (v.includes('|')) errors.push({ id, msg: `${k} enthält "|" (kollidiert mit der Mehrzahl-Syntax von t())` });
    de[k] = vDe;
    en[k] = vEn;
  };
  const named: [GearCategory, readonly { id: string; name_de: string; name_en: string; beschreibung_de: string; beschreibung_en: string }[]][] = [
    ['rod', gearRows.rods], ['line', gearRows.lines], ['reel', gearRows.reels], ['bait', gearRows.baits], ['accessory', gearRows.accessories],
  ];
  for (const [cat, rows] of named) {
    for (const r of rows) {
      gearText(cat, r.id, 'name', r.name_de, r.name_en);
      gearText(cat, r.id, 'desc', r.beschreibung_de, r.beschreibung_en);
    }
  }
  for (const c of gearRows.curios) {
    gearText('curio', c.id, 'name', c.name_de, c.name_en);
    gearText('curio', c.id, 'text', c.text_de, c.text_en);
  }
  for (const w of worldRows) {
    de[`world.${w.index}.name`] = w.name_de;
    en[`world.${w.index}.name`] = w.name_en;
    for (const x of weatherRows.filter((y) => y.welt === w.id)) {
      de[weatherKey(w.index, x.wetter)] = x.anzeigename_de;
      en[weatherKey(w.index, x.wetter)] = x.anzeigename_en;
    }
  }

  return {
    db, worlds, gear, balancing, de: sortKeys(de), en: sortKeys(en), errors, warnings,
    phaseCount: phaseRows.length, balancingCount: balancingRows.length,
  };
}

const sortKeys = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

export function main(root: string): number {
  const r = buildData(root);
  const RED = '\x1b[31m'; const YEL = '\x1b[33m'; const GRN = '\x1b[32m'; const OFF = '\x1b[0m';
  r.warnings.forEach((w) => console.warn(`${YEL}WARNUNG ${w.id}: ${w.msg}${OFF}`));
  if (r.errors.length) {
    r.errors.forEach((e) => console.error(`${RED}FEHLER ${e.id}: ${e.msg}${OFF}`));
    console.error(`${RED}✗ ${r.errors.length} Fehler – nichts geschrieben.${OFF}`);
    return 1;
  }
  const out = join(root, 'public/data');
  if (!existsSync(out)) mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'fish_db.json'), json(r.db));
  writeFileSync(join(out, 'worlds.json'), json(r.worlds));
  writeFileSync(join(out, 'gear.json'), json(r.gear));
  writeFileSync(join(out, 'balancing.json'), json(r.balancing));
  writeFileSync(join(root, 'src/i18n/de.json'), json(r.de));
  writeFileSync(join(root, 'src/i18n/en.json'), json(r.en));
  const warnTxt = r.warnings.length ? ` (${r.warnings.length} Warnungen)` : '';
  const g = r.gear;
  const gearTxt = g ? `, ${g.rods.length} Ruten, ${g.lines.length} Schnüre, ${g.reels.length} Rollen, ${g.baits.length} Köder, ${g.accessories.length} Zubehör, ${g.curios.length} Fundstücke` : '';
  console.log(`${GRN}✓ ${r.db.fish.length} Fische, ${r.phaseCount} Bossphasen, ${r.worlds.worlds.length} Welten${gearTxt}, ${r.balancingCount} Balancing-Werte${warnTxt}${OFF}`);
  return 0;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(ROOT));
}

