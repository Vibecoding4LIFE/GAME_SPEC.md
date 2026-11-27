// fish_db.json: Format (Spec G 6.7), Erzeugung aus den CSV-Zeilen und Lader fuer das Spiel.
import type {
  BossPhase, BossSpecial, FightBehavior, FishData, FishId, HorizontalZone, Rarity, SizeClass,
  TimeOfDay, Weather, WorldEvent, WorldId,
} from './types';
import type { BossPhaseRow, FishRow } from './schema';

export interface FishDbBossPhase {
  phase: number; name: string; hpVon: number; hpBis: number;
  verhalten: FightBehavior[]; spezial: BossSpecial; kraft: number; ansage: string;
}

export interface FishDbEntry {
  id: FishId; nr: number; name: string; basis: string; fantasie: boolean;
  welt: WorldId; seltenheit: Rarity; boss: boolean;
  groesse: { klasse: SizeClass; canvas: [number, number]; laengeCm: [number, number]; k: number };
  spawn: {
    tiefeM: [number, number]; zonen: HorizontalZone[]; zeit: TimeOfDay[];
    wetterPflicht: Weather[]; wetterBevorzugt: Weather[];
    ereignisPflicht: WorldEvent; ereignisBevorzugt: WorldEvent;
    koederMag: string[]; koederMagNicht: string[]; schwarm: [number, number];
  };
  biss: { zupfer: [number, number]; scheinbisse: boolean; zahnfisch: boolean };
  drill: { verhalten: FightBehavior; verhalten2: FightBehavior | null; verhalten2Ab: number; kraft: number; zoneMod: number };
  punkte: number;
  art: { text: string; schillernd: string; leuchtet: boolean };
  texte: { lexikon: string; hinweis: string };
  bossPhasen?: FishDbBossPhase[];
}

export interface FishDb { version: number; fish: FishDbEntry[] }

export const nr3 = (n: number): string => String(n).padStart(3, '0');

export function toFishDbEntry(f: FishRow, phases: BossPhaseRow[]): FishDbEntry {
  const entry: FishDbEntry = {
    id: f.id as FishId, nr: f.nr, name: f.name_de, basis: f.basis, fantasie: f.fantasie,
    welt: f.welt, seltenheit: f.seltenheit, boss: f.boss,
    groesse: { klasse: f.groesse, canvas: [f.canvas.w, f.canvas.h], laengeCm: [f.laenge_min_cm, f.laenge_max_cm], k: f.k },
    spawn: {
      tiefeM: [f.tiefe_min_m, f.tiefe_max_m], zonen: f.zonen, zeit: f.zeit,
      wetterPflicht: f.wetter_pflicht, wetterBevorzugt: f.wetter_bevorzugt,
      ereignisPflicht: f.ereignis_pflicht, ereignisBevorzugt: f.ereignis_bevorzugt,
      koederMag: f.koeder_mag, koederMagNicht: f.koeder_mag_nicht,
      schwarm: [f.schwarm.min, f.schwarm.max],
    },
    biss: { zupfer: [f.zupfer.min, f.zupfer.max], scheinbisse: f.scheinbisse, zahnfisch: f.zahnfisch },
    drill: { verhalten: f.verhalten, verhalten2: f.verhalten2, verhalten2Ab: f.verhalten2_ab, kraft: f.kraft, zoneMod: f.zone_mod },
    punkte: f.punkte,
    art: { text: f.art_text, schillernd: f.schillernd_text, leuchtet: f.leuchtet },
    texte: { lexikon: f.lexikon_text, hinweis: f.hinweis_text },
  };
  const own = phases.filter(p => p.fisch_id === f.id).sort((a, b) => a.phase - b.phase);
  if (own.length) {
    entry.bossPhasen = own.map(p => ({
      phase: p.phase, name: p.name_de, hpVon: p.hp_von, hpBis: p.hp_bis,
      verhalten: p.verhalten, spezial: p.spezial, kraft: p.kraft, ansage: p.ansage_de,
    }));
  }
  return entry;
}

/** Wandelt einen fish_db-Eintrag in FishData (G 6.3). Asset-Keys nach Namenskonvention aus der Lexikonnummer. */
export function toFishData(e: FishDbEntry): FishData {
  const n = nr3(e.nr);
  const phases: BossPhase[] = (e.bossPhasen ?? []).map(p => ({
    nameKey: `boss.${n}.phase${p.phase}`,
    hpFrom: p.hpVon, hpTo: p.hpBis, behaviors: p.verhalten, special: p.spezial, strength: p.kraft,
    telegraphKey: `boss.${n}.phase${p.phase}.ansage`,
  }));
  return {
    id: e.id, lexiconNumber: e.nr,
    nameKey: `fish.${n}.name`, displayNameDe: e.name, speciesBasis: e.basis, isFantasy: e.fantasie,
    world: e.welt, rarity: e.seltenheit, isBoss: e.boss,
    lexiconKey: `fish.${n}.lexicon`, hintKey: `fish.${n}.hint`,
    sizeClass: e.groesse.klasse, canvasSize: { w: e.groesse.canvas[0], h: e.groesse.canvas[1] },
    swimFrames: [0, 1, 2, 3, 4, 5].map(i => `fish_${n}_swim_${i}`),
    struggleFrames: [0, 1].map(i => `fish_${n}_struggle_${i}`),
    catchSprite: `fish_${n}_catch`,
    silhouette: `fish_${n}_sil`,
    shinyLut: `luts/fish_${n}_shiny.png`,
    emissionMask: e.art.leuchtet ? `fish_${n}_emit` : undefined,
    glowsInDark: e.art.leuchtet,
    artBriefDe: e.art.text, shinyBriefDe: e.art.schillernd,
    lengthMinCm: e.groesse.laengeCm[0], lengthMaxCm: e.groesse.laengeCm[1], weightFactorK: e.groesse.k,
    depthMinM: e.spawn.tiefeM[0], depthMaxM: e.spawn.tiefeM[1],
    zones: e.spawn.zonen, timeMask: e.spawn.zeit,
    requiredWeather: e.spawn.wetterPflicht, preferredWeather: e.spawn.wetterBevorzugt,
    requiredEvent: e.spawn.ereignisPflicht, preferredEvent: e.spawn.ereignisBevorzugt,
    favoriteBaits: e.spawn.koederMag, dislikedBaits: e.spawn.koederMagNicht,
    spawnWeightOverride: -1,
    schooling: e.spawn.schwarm[1] > 1, schoolSize: { min: e.spawn.schwarm[0], max: e.spawn.schwarm[1] },
    nibbleMin: e.biss.zupfer[0], nibbleMax: e.biss.zupfer[1], biteWindowBonusS: 0,
    hasFakeBites: e.biss.scheinbisse, isToothed: e.biss.zahnfisch,
    primaryBehavior: e.drill.verhalten,
    hasSecondaryBehavior: e.drill.verhalten2 !== null,
    secondaryBehavior: e.drill.verhalten2 ?? undefined,
    secondaryAtStamina: e.drill.verhalten2Ab,
    strength: e.drill.kraft, staminaOverrideS: -1, greenZoneModifier: e.drill.zoneMod,
    bossPhases: phases,
    basePoints: e.punkte, xpOverride: -1,
  };
}

/** Alle Fische aus einer geladenen fish_db.json (z. B. Phaser-Cache `this.cache.json.get('fish_db')`). */
export function fishFromDb(db: FishDb): FishData[] {
  return db.fish.map(toFishData);
}

/** Laedt `data/fish_db.json` per fetch (ausserhalb von Phaser, z. B. in Tools/Tests mit Browser). */
export async function loadFishDb(url = 'data/fish_db.json'): Promise<FishData[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fish_db konnte nicht geladen werden: ${res.status}`);
  return fishFromDb((await res.json()) as FishDb);
}
