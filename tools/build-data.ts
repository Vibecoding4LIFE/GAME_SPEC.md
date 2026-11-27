// npm run data: Data/*.csv -> public/data/fish_db.json + Uebersetzungsschluessel (Spec G 6.8).
// Aufruf im Projektstamm. Fehler brechen mit Exit-Code 1 ab, Warnungen nicht.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../src/data/csv';
import { parseBossPhaseRow, parseFishRow } from '../src/data/schema';
import type { BossPhaseRow, FishRow } from '../src/data/schema';
import { nr3, toFishDbEntry } from '../src/data/db';
import type { FishDb } from '../src/data/db';
import { validateDb } from '../src/data/validate';

const errors: string[] = [];

const fish: FishRow[] = parseCsv(readFileSync('Data/fish.csv', 'utf8')).flatMap((r, i) => {
  const res = parseFishRow(r);
  if (res.row) return [res.row];
  errors.push(`${r.id || `Zeile ${i + 2}`}: ${res.errors.join(', ')}`);
  return [];
});
const phases: BossPhaseRow[] = parseCsv(readFileSync('Data/boss_phases.csv', 'utf8')).flatMap((r, i) => {
  const res = parseBossPhaseRow(r);
  if (res.row) return [res.row];
  errors.push(`boss_phases Zeile ${i + 2}: ${res.errors.join(', ')}`);
  return [];
});

// Lokalisierung: de wird ueberschrieben, en bekommt fehlende Schluessel leer (Uebersetzung offen)
const readJson = (p: string): Record<string, string> => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
const de = readJson('src/i18n/de.json');
const en = readJson('src/i18n/en.json');
for (const f of fish) {
  const k = `fish.${nr3(f.nr)}`;
  Object.assign(de, { [`${k}.name`]: f.name_de, [`${k}.lexicon`]: f.lexikon_text, [`${k}.hint`]: f.hinweis_text });
  for (const s of ['name', 'lexicon', 'hint']) en[`${k}.${s}`] ??= '';
}
for (const p of phases) {
  const k = `boss.${p.fisch_id.slice(1)}.phase${p.phase}`;
  de[k] = p.name_de;
  de[`${k}.ansage`] = p.ansage_de;
  en[k] ??= '';
  en[`${k}.ansage`] ??= '';
}

const db: FishDb = { version: 1, fish: fish.map(f => toFishDbEntry(f, phases)) };
const report = validateDb(db);
report.warnings.forEach(w => console.warn(`\x1b[33mWARNUNG ${w.id}: ${w.msg}\x1b[0m`));
errors.push(...report.errors.map(e => `${e.id}: ${e.msg}`));
if (errors.length) {
  errors.forEach(e => console.error(`\x1b[31mFEHLER ${e}\x1b[0m`));
  process.exit(1);
}

const sortKeys = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync('public/data', { recursive: true });
mkdirSync('src/i18n', { recursive: true });
writeFileSync('public/data/fish_db.json', JSON.stringify(db, null, 2) + '\n');
writeFileSync('src/i18n/de.json', JSON.stringify(sortKeys(de), null, 2) + '\n');
writeFileSync('src/i18n/en.json', JSON.stringify(sortKeys(en), null, 2) + '\n');
console.log(`OK: ${fish.length} Fische, ${phases.length} Bossphasen`);
