// tests/gear.test.ts – Phase 1: Ausrüstung (Teil D 3.3 / G 6.5), Fundstücke (D 3.7) und Fisch-Tags (datenvertrag.md §5).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFishData, loadFishDb, loadWorldDb } from '../src/data/db';
import { loadBalancing } from '../src/data/balancing';
import { gearKey, loadGear } from '../src/data/gear';
import { BaitRow, RodRow } from '../src/data/schema';
import { REQUIRED_GEAR_IDS, validateGear } from '../src/data/validate';
import { BAIT_IDS, type FishTag } from '../src/data/types';
import { buildData } from '../tools/build-data';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const gearJson = readJson('public/data/gear.json');
const gear = loadGear(gearJson);
const balancing = loadBalancing(readJson('public/data/balancing.json'));
const db = loadFishDb(readJson('public/data/fish_db.json'));
const worlds = loadWorldDb(readJson('public/data/worlds.json'));
const de = readJson('src/i18n/de.json') as Record<string, string>;
const en = readJson('src/i18n/en.json') as Record<string, string>;

const rod = (id: string) => gear.rods.find((r) => r.id === id)!;
const line = (id: string) => gear.lines.find((r) => r.id === id)!;
const reel = (id: string) => gear.reels.find((r) => r.id === id)!;
const bait = (id: string) => gear.baits.find((r) => r.id === id)!;

describe('gear.json', () => {
  it('ist aktuell und fehlerfrei (entspricht Data/*.csv)', () => {
    const r = buildData(ROOT);
    expect(r.errors, r.errors.map((e) => `${e.id}: ${e.msg}`).join('\n')).toEqual([]);
    expect(r.gear).toEqual(gear);
    expect(r.balancing).toEqual(balancing);
  });

  it('hat alle Ruten R01–R06, RW1–RW5, RG', () => {
    expect(gear.rods.map((r) => r.id)).toEqual(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'RW1', 'RW2', 'RW3', 'RW4', 'RW5', 'RG']);
  });

  it('hat alle Schnüre L01–L06 + Stahlvorfach Z-V', () => {
    expect(gear.lines.map((r) => r.id)).toEqual(['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'Z-V']);
  });

  it('hat alle Rollen RO1–RO8', () => {
    expect(gear.reels.map((r) => r.id)).toEqual(['RO1', 'RO2', 'RO3', 'RO4', 'RO5', 'RO6', 'RO7', 'RO8']);
  });

  it('hat alle Köder K01–K14', () => {
    expect(gear.baits.map((r) => r.id)).toEqual([...BAIT_IDS]);
  });

  it('hat Zubehör (inkl. Köderlampe I–IV) und Fundstücke für jede Welt', () => {
    expect(gear.accessories.map((a) => a.id)).toHaveLength(9);
    expect(gear.accessories.filter((a) => a.effect === 'Lichtradius').map((a) => a.value)).toEqual([32, 48, 64, 96]);
    expect(gear.curios.map((c) => c.id)).toHaveLength(8);
  });

  it('validateGear meldet keine Fehler', () => {
    const r = validateGear(gear, db, balancing, worlds);
    expect(r.errors, r.errors.map((e) => `${e.id}: ${e.msg}`).join('\n')).toEqual([]);
  });
});

describe('Werte gegen die Spec (D 3.3)', () => {
  it('Ruten: Bambus-Start, Karbon-Kracher, Neptun, Seerosenrute, Goldene Rute', () => {
    expect(rod('R01')).toMatchObject({ source: 'Start', priceCoins: 0, castMaxDistanceM: 20, perfectWindowMin: 0.92, flexGreenZone: 0.26, relief: 1.0, castCycleS: 1.2 });
    expect(rod('R03')).toMatchObject({ tier: 3, priceCoins: 2500, requiredReputation: 8, castMaxDistanceM: 36, perfectWindowMin: 0.9, flexGreenZone: 0.32, relief: 1.2, reactionBonusS: 0.1 });
    expect(rod('R04').abilities).toEqual([{ ability: 'TaucherKonter', value: 0.1 }]);
    expect(rod('R06')).toMatchObject({ priceCoins: 50000, requiredReputation: 35, counterBonus: 0.35, ability: 'StarkerKonter', perfectWindowMin: 0.86 });
    expect(rod('RW1')).toMatchObject({ source: 'Sammlung', sizeMuBonus: 0.05, ability: 'HaengerLeicht', abilityWorld: 'W1', flexGreenZone: 0.33 });
    expect(rod('RG')).toMatchObject({ source: 'Komplett', flexGreenZone: 0.41, ability: 'SchillerndGlobal', lineParticles: 'gold' });
    expect(rod('RG').abilities[0]?.value).toBe(200);
  });

  it('Schnüre: Geisterfaden, Hitzeschild, Stahlvorfach', () => {
    expect(line('L02')).toMatchObject({ priceCoins: 400, requiredReputation: 2, breakReserveS: 0.15, biteRateBonus: 0 });
    expect(line('L03')).toMatchObject({ priceCoins: 1500, breakReserveS: 0.1, biteRateBonus: 0.1, protection: [] });
    expect(line('L05')).toMatchObject({ protection: ['Kaelte', 'Druck'], maxDepthPressureM: 11000 });
    expect(line('L06')).toMatchObject({ priceCoins: 22000, requiredReputation: 30, breakReserveS: 0.3, heatMultiplier: 0.5, protection: ['Kaelte', 'Druck', 'Hitze'] });
    expect(line('Z-V')).toMatchObject({ priceCoins: 900, requiredReputation: 5, isLeader: true, protectsToothed: true, shyBiteRateMod: -0.05 });
  });

  it('Rollen: Klapperrolle, Tiefseewinden, Drachenrolle', () => {
    expect(reel('RO1')).toMatchObject({ priceCoins: 0, crankPower: 1, retrieveSpeed: 1, lineCapacityM: 20, isDeepSeaWinch: false });
    expect(reel('RO4')).toMatchObject({ priceCoins: 7000, requiredReputation: 14, crankPower: 1.3, retrieveSpeed: 1.3, lineCapacityM: 80 });
    expect(reel('RO5')).toMatchObject({ crankPower: 1.3, retrieveSpeed: 1.2, lineCapacityM: 2000, isDeepSeaWinch: true, fallbackCapacityM: 80 });
    expect(reel('RO7').lineCapacityM).toBe(11000);
    expect(reel('RO8')).toMatchObject({ priceCoins: 55000, crankPower: 1.6, retrieveSpeed: 1.5, lineCapacityM: 11000, isDeepSeaWinch: true, fallbackCapacityM: 80 });
  });

  it('Köder: Effekte als Zahlen', () => {
    expect(bait('K01')).toMatchObject({ infinite: true, priceCoins: 0 });
    expect(bait('K02')).toMatchObject({ packSize: 10, priceCoins: 50, rarityMods: { Gewoehnlich: 1.3 }, commonMod: 1.3, worlds: ['W1'] });
    expect(bait('K03')).toMatchObject({ priceCoins: 40, createsFeedingSpot: true });
    expect(bait('K04')).toMatchObject({ reusable: true, priceCoins: 300, twitchBonus: 1.5 });
    expect(bait('K05')).toMatchObject({ priceCoins: 800, retrieveDiveM: 2, tagBonus: { raubfisch: 1.4 } });
    expect(bait('K07')).toMatchObject({ rarityMods: { Selten: 1.2 }, worlds: ['W2', 'W3', 'W4'] });
    expect(bait('K08')).toMatchObject({ biteRateBonus: 0.25, worlds: ['W3'] });
    expect(bait('K11')).toMatchObject({ packSize: 3, priceCoins: 800, tagBonus: { kristall: 1.8 } });
    expect(bait('K12')).toMatchObject({ sizeMuBonus: 0.08, commonMod: 0.5 });
    expect(bait('K13')).toMatchObject({ pricePearls: 2, priceCoins: 0, shinyMultiplier: 2 });
    expect(bait('K14')).toMatchObject({ pricePearls: 1, priceCoinsPerWorldFactor: 800, summonsWorldBoss: true, unlockSpeciesInWorld: 15 });
  });

  it('Sinkgeschwindigkeit kommt aus balancing', () => {
    for (const b of gear.baits) expect(b.sinkSpeedMs).toBe(balancing.depth.sinkSpeedMs[b.sinkClass]);
    expect(bait('K02').sinkSpeed).toBeLessThan(1);
    expect(bait('K01').sinkSpeed).toBe(1);
  });

  it('Fundstücke: Stiefel 1 Münze, Schatzkiste 100–500 × Weltfaktor, Drachenei 10 Splitter', () => {
    const c = (id: string) => gear.curios.find((x) => x.id === id)!;
    expect(c('C01')).toMatchObject({ worlds: ['W1'], coinsMin: 1, coinsMax: 1 });
    expect(c('C04')).toMatchObject({ coinsMin: 100, coinsMax: 500, coinsTimesWorldFactor: true, worlds: [] });
    expect(c('C08')).toMatchObject({ reward: 'Sammelteil', collectCount: 10, worlds: ['W5'] });
  });
});

describe('i18n der Ausrüstung (B7)', () => {
  it('jede Zeile hat Name und Beschreibung in de und en', () => {
    const items = [
      ...gear.rods.map((x) => ['rod', x.id] as const), ...gear.lines.map((x) => ['line', x.id] as const),
      ...gear.reels.map((x) => ['reel', x.id] as const), ...gear.baits.map((x) => ['bait', x.id] as const),
      ...gear.accessories.map((x) => ['accessory', x.id] as const),
    ];
    for (const [cat, id] of items) {
      for (const f of ['name', 'desc'] as const) {
        const k = gearKey(cat, id, f);
        expect(de[k]?.trim(), `${k} de`).toBeTruthy();
        expect(en[k]?.trim(), `${k} en`).toBeTruthy();
      }
    }
    for (const c of gear.curios) for (const k of [c.nameKey, c.textKey]) expect(de[k] && en[k], k).toBeTruthy();
    expect(de['rod.r01.name']).toBe('Opas Bambusrute');
    expect(de['line.zv.name']).toBe('Stahlvorfach');
    expect(rod('R01').nameKey).toBe('rod.r01.name');
  });
});

describe('Schema und Validator', () => {
  it('lehnt negative Preise und unbekannte Köder-Tags ab', () => {
    const r: Record<string, string> = {
      id: 'R09', stufe: '1', quelle: 'Shop', preis_muenzen: '-5', preis_perlen: '', ruf: '1', wurfweite_m: '20', wurf_zyklus_s: '',
      perfekt_ab: '', flex: '', entlastung: '', reaktion_s: '', konter: '', groessen_mu: '', faehigkeiten: '', faehigkeit_welt: '',
      nur_welt: '', schnurfarbe: '', schnur_partikel: '', name_de: 'x', name_en: 'x', beschreibung_de: 'x', beschreibung_en: 'x',
    };
    expect(RodRow.safeParse(r).success).toBe(false);
    expect(RodRow.parse({ ...r, preis_muenzen: '5' })).toMatchObject({ wurf_zyklus_s: 1.2, perfekt_ab: 0.92, flex: 0.26, konter: 0.3, nur_welt: true, schnurfarbe: '#FFFFFF' });
    const b = BaitRow.safeParse({
      id: 'K01', unendlich: '', dauerhaft: '', packung: '', preis_muenzen: '0', preis_perlen: '', preis_weltfaktor: '', gewicht: 'mittel',
      bissrate_bonus: '', groessen_mu: '', seltenheit_mods: '', tag_bonus: 'drache:2', schillernd_mult: '', zucken_mult: '', welten: '',
      wirkt_auf: '', einhol_tiefe_m: '', futterplatz: '', leuchtet_dunkel: '', hitzefest: '', bosslocker: '', ab_arten: '',
      name_de: 'x', name_en: 'x', beschreibung_de: 'x', beschreibung_en: 'x',
    });
    expect(b.success).toBe(false);
  });

  it('loadGear wirft bei negativem Preis', () => {
    const broken = structuredClone(gearJson) as { rods: { priceCoins: number }[] };
    broken.rods[1]!.priceCoins = -1;
    expect(() => loadGear(broken)).toThrow();
  });

  it('meldet Köder-IDs aus fish.csv, die es nicht gibt', () => {
    const fewer = { ...gear, baits: gear.baits.filter((b) => b.id !== 'K05') };
    const r = validateGear(fewer, db, balancing, worlds);
    const ids = r.errors.map((e) => e.id);
    expect(ids).toContain('K05');           // Pflicht-ID fehlt
    expect(ids).toContain('F014');          // Hecht mag K05
    expect(REQUIRED_GEAR_IDS.lines).toContain('Z-V');
  });
});

describe('Fisch-Tags (Vertrag §5)', () => {
  const fish = loadFishData(readJson('public/data/fish_db.json'));
  const tagsOf = (id: string) => fish.find((f) => f.id === id)!.tags;

  it('jeder Fisch ist genau Raub- oder Friedfisch', () => {
    for (const f of fish) expect(f.tags.includes('raubfisch') !== f.tags.includes('friedfisch'), f.id).toBe(true);
  });

  it('Stichproben aus Art und Text', () => {
    expect(tagsOf('F014')).toEqual(expect.arrayContaining<FishTag>(['raubfisch', 'zahnfisch']));  // Hecht
    expect(tagsOf('F005')).toEqual(expect.arrayContaining<FishTag>(['friedfisch', 'oberflaeche', 'schwarm'])); // Ukelei
    expect(tagsOf('F011')).toContain('aal');
    expect(tagsOf('F012')).toContain('forelle');
    expect(tagsOf('F052')).toContain('lachs');
    expect(tagsOf('F097')).toContain('mystisch');
    expect(tagsOf('F089')).toContain('kristall');
    expect(tagsOf('F090')).toContain('glut');
    expect(tagsOf('F065')).toEqual(expect.arrayContaining<FishTag>(['raubfisch', 'leucht', 'zahnfisch'])); // Viperfisch
    expect(fish.filter((f) => f.world === 'W2').every((f) => f.tags.includes('riff'))).toBe(true);
  });

  it('Köder-Tags treffen Fische (K10 Glut, K11 Kristall, K09 Leucht)', () => {
    for (const t of ['glut', 'kristall', 'leucht', 'raubfisch', 'riff'] as const) {
      expect(fish.some((f) => f.tags.includes(t)), t).toBe(true);
    }
  });
});
