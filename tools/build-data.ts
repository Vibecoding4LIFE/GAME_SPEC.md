// tools/build-data.ts – `npm run data`
// Liest Data/*.csv, prüft sie (Zod-Schema je Zeile + validateDb), schreibt public/data/fish_db.json,
// public/data/worlds.json und die Text-Schlüssel in src/i18n/de.json / en.json.
// Fehler: rot mit Fisch-ID, Exit-Code 1. Warnungen: gelb, kein Abbruch.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { z } from 'zod';
import {
  BossPhaseRow, EventRow, FishRow, WeatherRow, WorldRow,
  type FishDb, type WorldDb,
} from '../src/data/schema';
import { DB_VERSION, bossPhaseKeys, textKeys, toFishDbEntry, toWorldDbEntry, weatherKey } from '../src/data/db';
import { validateDb, type Issue } from '../src/data/validate';

export interface BuildResult {
  db: FishDb;
  worlds: WorldDb;
  de: Record<string, string>;
  en: Record<string, string>;
  errors: Issue[];
  warnings: Issue[];
  phaseCount: number;
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
const GENERATED_KEY = /^(fish\.\d{3}\.|boss\.\d{3}\.|weather\.\d\.|world\.\d\.name$)/;

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
  for (const w of worldRows) {
    de[`world.${w.index}.name`] = w.name_de;
    en[`world.${w.index}.name`] = w.name_en;
    for (const x of weatherRows.filter((y) => y.welt === w.id)) {
      de[weatherKey(w.index, x.wetter)] = x.anzeigename_de;
      en[weatherKey(w.index, x.wetter)] = x.anzeigename_en;
    }
  }

  return { db, worlds, de: sortKeys(de), en: sortKeys(en), errors, warnings: report.warnings, phaseCount: phaseRows.length };
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
  writeFileSync(join(root, 'src/i18n/de.json'), json(r.de));
  writeFileSync(join(root, 'src/i18n/en.json'), json(r.en));
  const warnTxt = r.warnings.length ? ` (${r.warnings.length} Warnungen)` : '';
  console.log(`${GRN}✓ ${r.db.fish.length} Fische, ${r.phaseCount} Bossphasen, ${r.worlds.worlds.length} Welten${warnTxt}${OFF}`);
  return 0;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(ROOT));
}

