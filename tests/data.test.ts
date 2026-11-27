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
import { Rng, hashSeed } from '../src/core/random';
import { loadBalancing } from '../src/data/balancing';
import { loadGear } from '../src/data/gear';
import { rollSpawn } from '../src/game/spawn';
import { DAY_PHASES, type ActiveWeather } from '../src/game/types';

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

  it('Ereignisse haben Tageszeit und Wetter-Kopplung (events.csv zeit/wetter)', () => {
    const ev = (w: string, e: string) => worlds.worlds.find((x) => x.id === w)?.ereignisse.find((x) => x.ereignis === e);
    expect(ev('W1', 'Mueckenschwarm')).toMatchObject({ zeit: ['Abend'], wetter: null });
    expect(ev('W1', 'Vollmond')?.zeit).toEqual(['Nacht']);
    expect(ev('W1', 'Sommergewitter')).toMatchObject({ zeit: ['Immer'], wetter: 'Gewitter' });
    expect(ev('W5', 'GrosserAusbruch')?.zeit).toEqual(['Nacht']);
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
  // Dieselbe Spawn-Funktion wie im Spiel (src/game/spawn.ts). Je Welt × Tageszeit × Wetter 10.000 Spawns mit
  // zufälliger Tiefe, Zone, Köder (der Welt) und zufälligen Weltereignissen. W1 wird hart geprüft (Phase 1),
  // W2–W5 nur gewarnt, bis ihre Weltmechaniken (Phase 4) eingebaut sind.
  const fishData = loadFishData(readJson('public/data/fish_db.json'));
  const gear = loadGear(readJson('public/data/gear.json'));
  const bal = loadBalancing(readJson('public/data/balancing.json'));
  const N = 10000;
  const ZONES = ['Ufer', 'Freiwasser', 'Kante'] as const;

  function simulate(wid: (typeof WORLD_IDS)[number]) {
    const world = worlds.worlds.find((w) => w.id === wid);
    if (!world) throw new Error(wid);
    const fish = fishData.filter((f) => f.world === wid);
    // Bosslocker ruft den Boss absichtlich herbei und gehört nicht in die Zufallsverteilung
    const baits = gear.baits.filter((x) => (x.worlds.length === 0 || x.worlds.includes(wid)) && !x.summonsWorldBoss);
    const line = gear.lines[0];
    if (!line) throw new Error('keine Schnur');
    const rng = new Rng(hashSeed(`regel7:${wid}`));
    const total: Record<string, number> = Object.fromEntries(fish.map((f) => [f.id, 0]));
    const weathers = [...new Set(world.wetter.map((x) => x.wetter))].filter((x): x is ActiveWeather => x !== 'Alle');
    for (const phase of DAY_PHASES) {
      for (const weather of weathers) {
        for (let i = 0; i < N; i++) {
          const events = world.ereignisse.map((e) => e.ereignis).filter(() => rng.next() < 0.5);
          const r = rollSpawn({
            b: bal, world, fish, curios: [], phase, weather, events,
            depthM: rng.range(world.minTiefeM, world.maxTiefeM), zone: rng.pick(ZONES), bait: rng.pick(baits),
            line, leader: null, twitching: rng.next() < 0.5, feedingSpot: false, pityCount: 0, allowCurios: false,
          }, rng);
          if (r.kind === 'fish') total[r.fish.id] = (total[r.fish.id] ?? 0) + 1;
        }
      }
    }
    const never = fish.filter((f) => !total[f.id]).map((f) => f.id);
    const commons = fish.filter((f) => f.rarity === 'Gewoehnlich').map((f) => total[f.id] ?? 0);
    const meanCommon = commons.reduce((a, c) => a + c, 0) / Math.max(1, commons.length);
    const rares = fish.filter((f) => f.rarity === 'Selten');
    // Auslegung: ein Seltener darf nicht öfter erscheinen als ein durchschnittlicher Gewöhnlicher der Welt
    const rareTooOften = rares.filter((f) => (total[f.id] ?? 0) > meanCommon).map((f) => f.id);
    // strenger Vergleich (gegen den seltensten Gewöhnlichen) nur als Hinweis
    const rareAboveRarestCommon = rares.filter((f) => (total[f.id] ?? 0) > Math.min(...commons)).map((f) => f.id);
    return { total, never, rareTooOften, rareAboveRarestCommon };
  }

  it('W1: jeder Fisch ist unter irgendeiner Kombination fangbar, kein Seltener öfter als ein Gewöhnlicher', () => {
    const r = simulate('W1');
    expect(r.never, JSON.stringify(r.total)).toEqual([]);
    expect(r.rareTooOften, JSON.stringify(r.total)).toEqual([]);
    if (r.rareAboveRarestCommon.length) console.warn(`W1: Seltene öfter als der seltenste Gewöhnliche: ${r.rareAboveRarestCommon.join(', ')} – ${JSON.stringify(r.total)}`);
  });

  it.each(['W2', 'W3', 'W4', 'W5'] as const)('%s: Warnungen (Weltmechaniken folgen in Phase 4)', (wid) => {
    const r = simulate(wid);
    if (r.never.length) console.warn(`${wid}: nie gespawnt: ${r.never.join(', ')}`);
    if (r.rareTooOften.length) console.warn(`${wid}: Seltene öfter als ein Gewöhnlicher: ${r.rareTooOften.join(', ')}`);
    expect(Object.keys(r.total)).toHaveLength(20);
  });
});
