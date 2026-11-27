import { describe, expect, it } from 'vitest';
import fishCsv from '../../Data/fish.csv?raw';
import phasesCsv from '../../Data/boss_phases.csv?raw';
import db from '../../public/data/fish_db.json';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';
import { parseCsv } from '../../src/data/csv';
import { parseBossPhaseRow, parseFishRow } from '../../src/data/schema';
import { fishFromDb, toFishDbEntry } from '../../src/data/db';
import type { FishDb } from '../../src/data/db';
import { RARITY_DISTRIBUTION, validateDb } from '../../src/data/validate';
import { RARITIES, WORLD_IDS } from '../../src/data/types';

const fishDb = db as unknown as FishDb;
const fish = fishDb.fish;

describe('Data/fish.csv', () => {
  const rows = parseCsv(fishCsv);
  const parsed = rows.map(parseFishRow);

  it('hat 100 Zeilen und jede Zeile besteht das Schema', () => {
    expect(rows).toHaveLength(100);
    const bad = parsed.flatMap((p, i) => (p.row ? [] : [`${rows[i].id}: ${p.errors.join(', ')}`]));
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('public/data/fish_db.json ist aktuell (npm run data ausfuehren, falls rot)', () => {
    const phases = parseCsv(phasesCsv).map(r => parseBossPhaseRow(r).row!);
    const expected = parsed.map(p => toFishDbEntry(p.row!, phases));
    expect(fish).toEqual(JSON.parse(JSON.stringify(expected)));
  });
});

describe('fish_db', () => {
  it('hat keine Validator-Fehler (G 6.9)', () => {
    const { errors } = validateDb(fishDb);
    expect(errors.map(e => `${e.id}: ${e.msg}`)).toEqual([]);
  });

  it('hat keine Punkte-Ausreisser', () => {
    expect(validateDb(fishDb).warnings.map(w => `${w.id}: ${w.msg}`)).toEqual([]);
  });

  it('enthaelt genau 100 Fische mit eindeutigen IDs F001-F100', () => {
    expect(fish).toHaveLength(100);
    expect(new Set(fish.map(f => f.id)).size).toBe(100);
    fish.forEach((f, i) => expect(f.id).toBe(`F${String(i + 1).padStart(3, '0')}`));
  });

  it('hat 20 Fische je Welt mit Seltenheiten 8/5/4/2/1', () => {
    for (const w of WORLD_IDS) {
      const inWorld = fish.filter(f => f.welt === w);
      expect(inWorld, w).toHaveLength(20);
      for (const r of RARITIES) {
        expect(inWorld.filter(f => f.seltenheit === r).length, `${w} ${r}`).toBe(RARITY_DISTRIBUTION[r]);
      }
      expect(inWorld.filter(f => f.boss)).toHaveLength(1);
    }
  });

  it('hat alle Pflichtfelder gefuellt', () => {
    for (const f of fish) {
      expect(f.name, f.id).not.toBe('');
      expect(f.basis, f.id).not.toBe('');
      expect(f.art.text, f.id).not.toBe('');
      expect(f.art.schillernd, f.id).not.toBe('');
      expect(f.groesse.laengeCm[0], f.id).toBeLessThan(f.groesse.laengeCm[1]);
      expect(f.punkte, f.id).toBeGreaterThan(0);
      expect(f.drill.kraft, f.id).toBeGreaterThanOrEqual(1);
      expect(f.drill.kraft, f.id).toBeLessThanOrEqual(10);
    }
  });

  it('meldet Fehler bei kaputten Daten', () => {
    const broken: FishDb = { version: 1, fish: [...fish.slice(0, 99), { ...fish[0], id: 'F001' }] };
    expect(validateDb(broken).errors.length).toBeGreaterThan(0);
  });

  it('erzeugt FishData mit Schluesseln nach Namenskonvention', () => {
    const data = fishFromDb(fishDb);
    expect(data).toHaveLength(100);
    const hecht = data.find(f => f.id === 'F014')!;
    expect(hecht.nameKey).toBe('fish.014.name');
    expect(hecht.isToothed).toBe(true);
    expect(hecht.swimFrames).toHaveLength(6);
  });
});

describe('i18n-Schluessel', () => {
  it('de.json hat Namen aller Fische, en.json dieselben Schluessel', () => {
    const d = de as Record<string, string>;
    for (const f of fish) expect(d[`fish.${String(f.nr).padStart(3, '0')}.name`], f.id).toBe(f.name);
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });
});
