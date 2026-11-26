// src/data/db.ts – CSV-Zeile → fish_db.json-Eintrag (Teil G 6.7 + docs/datenvertrag.md §3)
// und fish_db.json → FishData (Teil G 6.3) für das Spiel. Keine Node-APIs.
import {
  FishDbSchema, WorldDbSchema,
  type BossPhaseRowT, type EventRowT, type FishDb, type FishDbEntry, type FishRowT, type WeatherRowT,
  type WorldDb, type WorldDbEntry, type WorldRowT,
} from './schema';
import {
  SPRITE_CLIPS, WORLD_KUERZEL,
  type BossPhase, type FishData, type SizeClass, type SpriteClip, type WorldKuerzel,
} from './types';

export const DB_VERSION = 1 as const;

/** 14 → "014" */
export const nr3 = (n: number): string => String(n).padStart(3, '0');

/** Slug nach Vertrag: klein, ä→ae, ö→oe, ü→ue, ß→ss, sonst [a-z0-9], "-" zusammengefasst, Rand-"-" weg. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const assetKeyFor = (kuerzel: WorldKuerzel, nr: number, slug: string): string =>
  `fish_${kuerzel}_${nr3(nr)}_${slug}`;

export const atlasKeyFor = (kuerzel: WorldKuerzel): string => `atlas_fish_${kuerzel}`;

/** Anzahl Frames eines Clips (Größenklasse S hat weniger Schwimm-Frames). */
export const clipFrameCount = (clip: SpriteClip, size: SizeClass): number =>
  size === 'S' ? SPRITE_CLIPS[clip].framesS : SPRITE_CLIPS[clip].frames;

/** Frame-Namen im Atlas: `<assetKey>_<clip>_<frame>` */
export const frameNames = (assetKey: string, clip: SpriteClip, size: SizeClass): string[] =>
  Array.from({ length: clipFrameCount(clip, size) }, (_, i) => `${assetKey}_${clip}_${i}`);

export const textKeys = (nr: number) => {
  const k = `fish.${nr3(nr)}`;
  return { name: `${k}.name`, lexicon: `${k}.lexicon`, hint: `${k}.hint` };
};

export const bossPhaseKeys = (fishId: string, phase: number) => {
  const k = `boss.${fishId.slice(1)}.phase${phase}`;
  return { name: k, ansage: `${k}.ansage` };
};

// ------------------------------------------------------------------ CSV → JSON

export function toFishDbEntry(f: FishRowT, phases: readonly BossPhaseRowT[] = []): FishDbEntry {
  const weltKuerzel = WORLD_KUERZEL[f.welt];
  const slug = slugify(f.name_de);
  const own = phases.filter((p) => p.fisch_id === f.id).sort((a, b) => a.phase - b.phase);
  const entry: FishDbEntry = {
    id: f.id,
    nr: f.nr,
    name: f.name_de,
    nameEn: f.name_en,
    basis: f.basis,
    fantasie: f.fantasie,
    welt: f.welt,
    weltKuerzel,
    slug,
    assetKey: assetKeyFor(weltKuerzel, f.nr, slug),
    seltenheit: f.seltenheit,
    boss: f.boss,
    groesse: { klasse: f.groesse, canvas: [f.canvas.w, f.canvas.h], laengeCm: [f.laenge_min_cm, f.laenge_max_cm], k: f.k },
    spawn: {
      tiefeM: [f.tiefe_min_m, f.tiefe_max_m],
      zonen: f.zonen,
      zeit: f.zeit,
      wetterPflicht: f.wetter_pflicht,
      wetterBevorzugt: f.wetter_bevorzugt,
      ereignisPflicht: f.ereignis_pflicht,
      ereignisBevorzugt: f.ereignis_bevorzugt,
      pflichtOder: f.pflicht_oder,
      koederMag: f.koeder_mag,
      koederMagNicht: f.koeder_mag_nicht,
      schwarm: f.schwarm.max >= 2 ? [f.schwarm.min, f.schwarm.max] : null,
    },
    biss: { zupfer: [f.zupfer.min, f.zupfer.max], scheinbisse: f.scheinbisse, zahnfisch: f.zahnfisch },
    drill: {
      verhalten: f.verhalten,
      verhalten2: f.verhalten2,
      verhalten2Ab: f.verhalten2_ab,
      kraft: f.kraft,
      zoneMod: f.zone_mod,
    },
    punkte: f.punkte,
    art: {
      koerperform: f.koerperform,
      schwanz: f.schwanz,
      muster: f.muster,
      farben: f.farben,
      schillerndFarben: f.schillernd_farben,
      merkmale: f.merkmale,
      text: f.art_text,
      schillernd: f.schillernd_text,
      leuchtet: f.leuchtet,
    },
    texte: { lexikon: f.lexikon_text, hinweis: f.hinweis_text },
  };
  if (f.boss || own.length > 0) {
    entry.bossPhasen = own.map((p) => {
      const keys = bossPhaseKeys(p.fisch_id, p.phase);
      return {
        phase: p.phase,
        nameKey: keys.name,
        name: p.name_de,
        nameEn: p.name_en,
        hpVon: p.hp_von,
        hpBis: p.hp_bis,
        verhalten: p.verhalten,
        spezial: p.spezial,
        kraft: p.kraft,
        ansageKey: keys.ansage,
        ansage: p.ansage_de,
      };
    });
  }
  return entry;
}

export function toWorldDbEntry(
  w: WorldRowT,
  weather: readonly WeatherRowT[],
  events: readonly EventRowT[],
  fish: readonly FishDbEntry[],
): WorldDbEntry {
  const own = fish.filter((f) => f.welt === w.id).sort((a, b) => a.nr - b.nr);
  return {
    id: w.id,
    index: w.index,
    kuerzel: w.kuerzel,
    nameKey: `world.${w.index}.name`,
    name: w.name_de,
    nameEn: w.name_en,
    muenzfaktor: w.muenzfaktor,
    leitfarben: w.leitfarben,
    minTiefeM: w.min_tiefe_m,
    maxTiefeM: w.max_tiefe_m,
    schichten: w.schichten,
    uferEndeM: w.ufer_ende_m,
    freiwasserEndeM: w.freiwasser_ende_m,
    mechanik: w.mechanik,
    schillerndRegel: w.schillernd_regel,
    wetter: weather
      .filter((x) => x.welt === w.id)
      .map((x) => ({
        wetter: x.wetter,
        gewicht: x.gewicht,
        anzeigename: x.anzeigename_de,
        anzeigenameEn: x.anzeigename_en,
        displayNameKey: weatherKey(w.index, x.wetter),
        nurZeit: x.nur_zeit,
      })),
    ereignisse: events.filter((x) => x.welt === w.id).map((x) => ({ ereignis: x.ereignis, beschreibung: x.beschreibung_de })),
    fish: own.map((f) => f.id),
    boss: own.find((f) => f.boss)?.id ?? null,
  };
}

export const weatherKey = (worldIndex: number, weather: string): string => `weather.${worldIndex}.${weather}`;

// ------------------------------------------------------------------ JSON → Spiel

/** Prüft die Struktur der fish_db.json (wirft bei kaputter Datei). */
export function loadFishDb(json: unknown): FishDb {
  return FishDbSchema.parse(json);
}

export function loadWorldDb(json: unknown): WorldDb {
  return WorldDbSchema.parse(json);
}

/** fish_db.json (z. B. aus `this.cache.json.get('fish_db')`) → FishData[] für das Spiel. */
export function loadFishData(json: unknown): FishData[] {
  return loadFishDb(json).fish.map(toFishData);
}

export function toFishData(e: FishDbEntry): FishData {
  const [w, h] = e.groesse.canvas;
  const size = e.groesse.klasse;
  const keys = textKeys(e.nr);
  const bossPhases: BossPhase[] = (e.bossPhasen ?? []).map((p) => ({
    nameKey: p.nameKey,
    hpFrom: p.hpVon,
    hpTo: p.hpBis,
    behaviors: p.verhalten,
    special: p.spezial,
    strength: p.kraft,
    telegraphKey: p.ansageKey,
  }));
  const schwarm = e.spawn.schwarm;
  return {
    id: e.id as FishData['id'],
    lexiconNumber: e.nr,
    nameKey: keys.name,
    displayNameDe: e.name,
    speciesBasis: e.basis,
    isFantasy: e.fantasie,
    world: e.welt,
    rarity: e.seltenheit,
    isBoss: e.boss,
    lexiconKey: keys.lexicon,
    hintKey: keys.hint,

    sizeClass: size,
    canvasSize: { w, h },
    swimFrames: frameNames(e.assetKey, 'swim', size),
    struggleFrames: frameNames(e.assetKey, 'struggle', size),
    catchSprite: `${e.assetKey}_caught_0`,
    silhouette: `${e.assetKey}_silhouette_0`,
    shinyLut: `luts/${e.assetKey}_shiny.png`,
    emissionMask: e.art.leuchtet ? `${e.assetKey}_emission_0` : undefined,
    glowsInDark: e.art.leuchtet,
    artBriefDe: e.art.text,
    shinyBriefDe: e.art.schillernd,

    lengthMinCm: e.groesse.laengeCm[0],
    lengthMaxCm: e.groesse.laengeCm[1],
    weightFactorK: e.groesse.k,

    depthMinM: e.spawn.tiefeM[0],
    depthMaxM: e.spawn.tiefeM[1],
    zones: e.spawn.zonen,
    timeMask: e.spawn.zeit,
    requiredWeather: e.spawn.wetterPflicht,
    preferredWeather: e.spawn.wetterBevorzugt,
    requiredEvent: e.spawn.ereignisPflicht,
    preferredEvent: e.spawn.ereignisBevorzugt,
    favoriteBaits: e.spawn.koederMag,
    dislikedBaits: e.spawn.koederMagNicht,
    spawnWeightOverride: -1,
    schooling: schwarm !== null,
    schoolSize: schwarm ? { min: schwarm[0], max: schwarm[1] } : { min: 1, max: 1 },

    nibbleMin: e.biss.zupfer[0],
    nibbleMax: e.biss.zupfer[1],
    biteWindowBonusS: 0,
    hasFakeBites: e.biss.scheinbisse,
    isToothed: e.biss.zahnfisch,

    primaryBehavior: e.drill.verhalten,
    hasSecondaryBehavior: e.drill.verhalten2 !== null,
    secondaryBehavior: e.drill.verhalten2 ?? undefined,
    secondaryAtStamina: e.drill.verhalten2Ab,
    strength: e.drill.kraft,
    staminaOverrideS: -1,
    greenZoneModifier: e.drill.zoneMod,
    bossPhases,

    basePoints: e.punkte,
    xpOverride: -1,

    slug: e.slug,
    worldKuerzel: e.weltKuerzel,
    assetKey: e.assetKey,
    atlasKey: atlasKeyFor(e.weltKuerzel),
    idleFrames: frameNames(e.assetKey, 'idle', size),
    caughtFrames: frameNames(e.assetKey, 'caught', size),
    requiredAny: e.spawn.pflichtOder,
    art: {
      bodyShape: e.art.koerperform,
      tailShape: e.art.schwanz,
      pattern: e.art.muster,
      colors: e.art.farben,
      shinyColors: e.art.schillerndFarben,
      features: e.art.merkmale,
    },
  };
}
