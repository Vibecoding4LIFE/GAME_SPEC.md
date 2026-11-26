// tests/data.test.ts – Regeln aus GAME_SPEC.md Teil G 6.9 gegen die erzeugte fish_db.json.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFishData, loadFishDb, loadWorldDb, slugify, toFishDbEntry } from '../src/data/db';
import { BossPhaseRow, FishRow } from '../src/data/schema';
import { validateDb } from '../src/data/validate';
import { RARITIES, WORLD_IDS } from '../src/data/types';
import { buildData } from '../tools/build-data';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const db = loadFishDb(readJson('public/data/fish_db.json'));
const worlds = loadWorldDb(readJson('public/data/worlds.json'));

describe('fish_db', () => {
  it('hat keine Fehler (Regeln 1–5)', () => {
    const { errors } = validateDb(db, worlds);
    expect(errors, errors.map((e) => `${e.id}: ${e.msg}`).join('\n')).toEqual([]);
  });

  it('ist aktuell (entspricht den CSVs in Data/)', () => {
    const r = buildData(ROOT);
    expect(r.errors).toEqual([]);
    expect(r.db).toEqual(db);
    expect(r.worlds).toEqual(worlds);
  });

  it('enthält genau 100 Fische mit eindeutigen IDs F001–F100', () => {
    expect(db.fish).toHaveLength(100);
    const ids = db.fish.map((f) => f.id);
    expect(new Set(ids).size).toBe(100);
    expect([...ids].sort()).toEqual(Array.from({ length: 100 }, (_, i) => `F${String(i + 1).padStart(3, '0')}`));
  });

  it.each(WORLD_IDS)('%s hat 20 Fische in der Verteilung 8/5/4/2/1 und genau einen legendären Boss', (wid) => {
    const fish = db.fish.filter((f) => f.welt === wid);
    expect(fish).toHaveLength(20);
    const count = Object.fromEntries(RARITIES.map((r) => [r, fish.filter((f) => f.seltenheit === r).length]));
    expect(count).toEqual({ Gewoehnlich: 8, Ungewoehnlich: 5, Selten: 4, Episch: 2, Legendaer: 1 });
    const bosses = fish.filter((f) => f.boss);
    expect(bosses).toHaveLength(1);
    expect(bosses[0]?.seltenheit).toBe('Legendaer');
    expect(bosses[0]?.nr).toBe(Number(wid.slice(1)) * 20);
    expect(bosses[0]?.bossPhasen?.length).toBeGreaterThanOrEqual(3);
  });

  it('Echt/Fantasie-Verteilung wie Teil E 5.6 (15/5, 16/4, 12/8, 15/5, 3/17)', () => {
    const fantasy = WORLD_IDS.map((w) => db.fish.filter((f) => f.welt === w && f.fantasie).length);
    expect(fantasy).toEqual([5, 4, 8, 5, 17]);
  });

  it('alle Pflichtfelder sind gefüllt', () => {
    for (const f of db.fish) {
      for (const v of [f.name, f.nameEn, f.basis, f.art.text, f.art.schillernd, f.texte.lexikon, f.texte.hinweis, f.slug, f.assetKey]) {
        expect(v.trim(), `${f.id}`).not.toBe('');
      }
      expect(f.art.farben.length, f.id).toBeGreaterThanOrEqual(4);
      expect(f.art.schillerndFarben.length, f.id).toBeGreaterThanOrEqual(4);
      expect(f.spawn.zeit.length, f.id).toBeGreaterThan(0);
      expect(f.drill.kraft, f.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('Vertragsfelder: slug und assetKey nach Namenskonvention', () => {
    const hecht = db.fish.find((f) => f.id === 'F014');
    expect(hecht?.assetKey).toBe('fish_see_014_hecht');
    const barnabas = db.fish.find((f) => f.id === 'F020');
    expect(barnabas?.slug).toBe('der-alte-barnabas');
    expect(slugify('Grimmbart, der Gletscherhai')).toBe('grimmbart-der-gletscherhai');
    expect(slugify('Schneeflöckchen-Grundel')).toBe('schneefloeckchen-grundel');
    expect(slugify('Großer Barrakuda')).toBe('grosser-barrakuda');
  });

  it('ODER-Bedingungen (DNF) für Barnabas, Coralina, Korallendrache', () => {
    const by = (id: string) => db.fish.find((f) => f.id === id)?.spawn;
    expect(by('F020')?.pflichtOder).toEqual([['Gewitter'], ['Vollmond']]);
    expect(by('F040')?.pflichtOder).toEqual([['Vollmond'], ['Flut']]);
    expect(by('F039')?.pflichtOder).toEqual([['Korallenbluete'], ['Regen', 'Flut']]);
  });

  it('loadFishData liefert FishData mit Asset-Namen nach Vertrag', () => {
    const data = loadFishData(readJson('public/data/fish_db.json'));
    expect(data).toHaveLength(100);
    const rotauge = data[0];
    expect(rotauge?.nameKey).toBe('fish.001.name');
    expect(rotauge?.swimFrames).toHaveLength(4); // Größe S: 4 Schwimm-Frames
    const hecht = data.find((f) => f.id === 'F014');
    expect(hecht?.swimFrames).toEqual([0, 1, 2, 3, 4, 5].map((i) => `fish_see_014_hecht_swim_${i}`));
    expect(hecht?.silhouette).toBe('fish_see_014_hecht_silhouette_0');
    expect(hecht?.atlasKey).toBe('atlas_fish_see');
    const lumina = data.find((f) => f.id === 'F080');
    expect(lumina?.emissionMask).toBe('fish_tiefe_080_lumina-die-abgrundlaterne_emission_0');
    expect(lumina?.bossPhases).toHaveLength(4);
    expect(lumina?.hasFakeBites).toBe(true);
  });
});

describe('schema', () => {
  const base: Record<string, string> = {
    id: 'F014', nr: '14', name_de: 'Hecht', basis: 'Esox lucius', fantasie: '0', welt: 'W1', seltenheit: 'Selten',
    boss: '0', groesse: 'L', canvas: '96x48', laenge_min_cm: '50', laenge_max_cm: '130', k: '', tiefe_min_m: '3',
    tiefe_max_m: '15', zonen: '', zeit: '', wetter_pflicht: '', wetter_bevorzugt: '', ereignis_pflicht: '',
    ereignis_bevorzugt: '', koeder_mag: '', koeder_mag_nicht: '', schwarm: '', zupfer: '', scheinbisse: '',
    zahnfisch: '', verhalten: 'Sprinter', verhalten2: '', verhalten2_ab: '', kraft: '', zone_mod: '', punkte: '120',
    leuchtet: '', art_text: 'x', schillernd_text: 'x', lexikon_text: 'x', hinweis_text: 'x', pflicht_oder: '',
    koerperform: 'torpedo', schwanz: 'gegabelt', muster: 'flecken', farben: '#5B6B2F|#E8E4C9|#E9D86A|#8A4B2A',
    schillernd_farben: '#B7B2D6|#E9E6F4|#8FD3F4|#A99BD6', merkmale: '', name_en: 'Northern Pike',
    lexikon_text_en: 'x', hinweis_text_en: 'x',
  };

  it('setzt Standardwerte für leere Zellen (6.8)', () => {
    const r = FishRow.parse(base);
    expect(r.k).toBe(0.011);
    expect(r.zonen).toEqual(['Alle']);
    expect(r.zeit).toEqual(['Immer']);
    expect(r.wetter_pflicht).toEqual(['Alle']);
    expect(r.ereignis_pflicht).toBe('Keins');
    expect(r.zupfer).toEqual({ min: 0, max: 2 });
    expect(r.verhalten2).toBeNull();
    expect(r.verhalten2_ab).toBe(0.5);
    expect(r.kraft).toBe(3);
    expect(r.pflicht_oder).toEqual([]);
    const e = toFishDbEntry(r);
    expect(e.spawn.schwarm).toBeNull();
    expect(e.bossPhasen).toBeUndefined();
  });

  it('lehnt leere Pflichtfelder, falsche Enums und verbotene Farben ab', () => {
    expect(FishRow.safeParse({ ...base, punkte: '' }).success).toBe(false);
    expect(FishRow.safeParse({ ...base, name_en: '' }).success).toBe(false);
    expect(FishRow.safeParse({ ...base, verhalten: 'Tänzer' }).success).toBe(false);
    expect(FishRow.safeParse({ ...base, farben: '#000000|#E8E4C9|#E9D86A|#8A4B2A' }).success).toBe(false);
    expect(FishRow.safeParse({ ...base, pflicht_oder: 'Alle' }).success).toBe(false);
    expect(FishRow.safeParse({ ...base, unbekannt: '1' }).success).toBe(false);
  });

  it('parst Bossphasen mit mehreren Verhalten', () => {
    const p = BossPhaseRow.parse({
      fisch_id: 'F080', phase: '4', name_de: 'Schlund', hp_von: '0.2', hp_bis: '0.0', verhalten: 'Brocken|Zappler',
      spezial: 'Schlund', kraft: '9', ansage_de: 'x', name_en: 'Maw', ansage_en: 'x',
    });
    expect(p.verhalten).toEqual(['Brocken', 'Zappler']);
  });
});

describe('Regel 7 – Spawn-Simulation', () => {
  it.todo('würfelt 10.000 Spawns je Welt/Tageszeit/Wetter mit der Spawn-Funktion des Spiels (Phase 1)');
});
