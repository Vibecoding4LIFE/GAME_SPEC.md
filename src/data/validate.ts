// src/data/validate.ts – zeilenübergreifende Prüfungen (Teil G 6.9) und Asset-Prüfung (Vertrag §4).
// Läuft ohne Node-APIs (auch in Deno/Edge Functions): Dateizugriff nur über einen übergebenen Reader.
import { clipFrameCount, atlasKeyFor, nr3, slugify, assetKeyFor } from './db';
import type { Balancing } from './balancing';
import type { GearDb } from './gear';
import type { FishDb, FishDbEntry, WorldDb, WorldDbEntry } from './schema';
import {
  BAIT_IDS, CANVAS_BY_SIZE, RARITIES, SPRITE_CLIPS, WORLD_IDS, WORLD_KUERZEL,
  type FishTag, type Rarity, type SpawnCondition, type SpriteClip, type WorldId,
} from './types';

export interface Issue { id: string; msg: string }
export interface Report { errors: Issue[]; warnings: Issue[] }

/** Verteilung je Welt (Teil E 5.0): 8/5/4/2/1. */
export const RARITY_DISTRIBUTION: Record<Rarity, number> = {
  Gewoehnlich: 8, Ungewoehnlich: 5, Selten: 4, Episch: 2, Legendaer: 1,
};

/** Punktebänder (Teil G 6.9) – Ausreißer sind Warnungen. */
export const POINT_BANDS: Record<WorldId, Record<Rarity, [number, number]>> = {
  W1: { Gewoehnlich: [10, 25], Ungewoehnlich: [50, 70], Selten: [120, 180], Episch: [350, 450], Legendaer: [1000, 1000] },
  W2: { Gewoehnlich: [20, 40], Ungewoehnlich: [65, 100], Selten: [180, 250], Episch: [500, 600], Legendaer: [1500, 1500] },
  W3: { Gewoehnlich: [30, 55], Ungewoehnlich: [90, 130], Selten: [260, 320], Episch: [600, 750], Legendaer: [2000, 2000] },
  W4: { Gewoehnlich: [40, 70], Ungewoehnlich: [120, 170], Selten: [300, 400], Episch: [800, 900], Legendaer: [2500, 2500] },
  W5: { Gewoehnlich: [55, 90], Ungewoehnlich: [140, 210], Selten: [400, 500], Episch: [1000, 1100], Legendaer: [3000, 3000] },
};

const BAIT_RE = /^K\d{2}$/;
const HEX_RE = /^#[0-9A-F]{6}$/;

function worldList(worlds: WorldDb | readonly WorldDbEntry[]): readonly WorldDbEntry[] {
  return Array.isArray(worlds) ? worlds : (worlds as WorldDb).worlds;
}

/** Ist eine Bedingung (Wetter- oder Ereignis-Schlüssel) in der Welt überhaupt möglich? */
function possibleIn(w: WorldDbEntry, c: SpawnCondition): boolean {
  return w.wetter.some((x) => x.wetter === c) || w.ereignisse.some((x) => x.ereignis === c);
}

/**
 * Regeln 1–5 aus Teil G 6.9 plus Pflichtfelder und Vertragsfelder.
 * Regel 6 (Assets) → validateAssets, Regel 7 (Spawn-Simulation) folgt in Phase 1.
 */
export function validateDb(db: FishDb, worlds: WorldDb | readonly WorldDbEntry[]): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (id: string, msg: string) => errors.push({ id, msg });
  const warn = (id: string, msg: string) => warnings.push({ id, msg });
  const wl = worldList(worlds);
  const worldById = new Map(wl.map((w) => [w.id, w]));

  // ---- Welten selbst
  for (const id of WORLD_IDS) if (!worldById.has(id)) err(id, 'Welt fehlt in worlds');
  for (const w of wl) {
    if (w.kuerzel !== WORLD_KUERZEL[w.id]) err(w.id, `Kürzel "${w.kuerzel}" passt nicht zu ${w.id}`);
    if (w.schichten.length === 0) err(w.id, 'keine Tiefenschichten');
    for (const s of w.schichten) {
      if (s.minM >= s.maxM) err(w.id, `Schicht "${s.name}": min ≥ max`);
      if (s.minM < w.minTiefeM || s.maxM > w.maxTiefeM) err(w.id, `Schicht "${s.name}" liegt außerhalb ${w.minTiefeM}–${w.maxTiefeM} m`);
    }
    if (w.wetter.length === 0) err(w.id, 'keine Wettertabelle');
    const sum = w.wetter.reduce((a, x) => a + x.gewicht, 0);
    if (Math.abs(sum - 100) > 1e-6) warn(w.id, `Wettergewichte ergeben ${sum} statt 100`);
    if (w.leitfarben.length !== 8) err(w.id, `${w.leitfarben.length} Leitfarben statt 8`);
  }

  // ---- Regel 1: IDs lückenlos/eindeutig, Verteilung, Bosse
  const seen = new Map<string, number>();
  for (const f of db.fish) seen.set(f.id, (seen.get(f.id) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) err(id, `ID ${n}× vergeben`);
  for (let i = 1; i <= 100; i++) {
    const id = `F${nr3(i)}`;
    if (!seen.has(id)) err(id, 'ID fehlt (F001–F100 müssen lückenlos sein)');
  }
  for (const f of db.fish) {
    if (f.id !== `F${nr3(f.nr)}`) err(f.id, `nr ${f.nr} passt nicht zur ID`);
    const expectedWorld = WORLD_IDS[Math.ceil(f.nr / 20) - 1];
    if (expectedWorld && f.welt !== expectedWorld) err(f.id, `Nr. ${nr3(f.nr)} gehört zu ${expectedWorld}, steht aber in ${f.welt}`);
    if (f.boss !== (f.seltenheit === 'Legendaer')) err(f.id, 'Boss und Legendär müssen zusammenfallen');
  }
  for (const wid of WORLD_IDS) {
    const inWorld = db.fish.filter((f) => f.welt === wid);
    if (inWorld.length !== 20) err(wid, `${inWorld.length} Fische statt 20`);
    for (const r of RARITIES) {
      const n = inWorld.filter((f) => f.seltenheit === r).length;
      if (n !== RARITY_DISTRIBUTION[r]) err(wid, `${n}× ${r} statt ${RARITY_DISTRIBUTION[r]} (Verteilung 8/5/4/2/1)`);
    }
    const bosses = inWorld.filter((f) => f.boss);
    if (bosses.length !== 1) err(wid, `${bosses.length} Bosse statt genau 1`);
  }

  // ---- je Fisch
  for (const f of db.fish) {
    const w = worldById.get(f.welt);
    checkFields(f, err, warn);
    checkTags(f, err, warn);
    checkSizeAndDrill(f, err);
    checkBoss(f, err, warn);
    if (!w) { err(f.id, `Welt ${f.welt} unbekannt`); continue; }

    // Regel 2: Tiefe
    const [dMin, dMax] = f.spawn.tiefeM;
    if (dMin > dMax) err(f.id, `tiefe_min ${dMin} > tiefe_max ${dMax}`);
    if (dMin < w.minTiefeM) err(f.id, `tiefe_min ${dMin} < Weltminimum ${w.minTiefeM} m`);
    if (dMax > w.maxTiefeM) err(f.id, `tiefe_max ${dMax} > Weltmaximum ${w.maxTiefeM} m`);
    if (!w.schichten.some((s) => dMin < s.maxM && dMax > s.minM)) err(f.id, `Tiefe ${dMin}–${dMax} m überlappt keine Schicht von ${w.id}`);
    else if (dMin < (w.schichten[0]?.minM ?? 0)) warn(f.id, `Tiefe beginnt bei ${dMin} m, oberhalb der ersten Schicht (${w.schichten[0]?.minM} m)`);

    // Regel 4: Punkteband (Warnung)
    const [pMin, pMax] = POINT_BANDS[f.welt][f.seltenheit];
    if (f.punkte < pMin || f.punkte > pMax) warn(f.id, `Punkte ${f.punkte} außerhalb des Bands ${pMin}–${pMax} (${f.welt}/${f.seltenheit})`);

    // Regel 5: Pflicht-Bedingungen müssen in der Welt möglich sein
    checkConditions(f, w, err, warn);
  }

  return { errors, warnings };
}

type Add = (id: string, msg: string) => void;

function checkFields(f: FishDbEntry, err: Add, warn: Add): void {
  const texts: [string, string][] = [
    ['name', f.name], ['nameEn', f.nameEn], ['basis', f.basis], ['art.text', f.art.text], ['art.schillernd', f.art.schillernd],
    ['texte.lexikon', f.texte.lexikon], ['texte.hinweis', f.texte.hinweis],
  ];
  for (const [k, v] of texts) {
    if (!v || v.trim() === '') err(f.id, `Pflichtfeld ${k} ist leer`);
    else if (v.includes('|')) err(f.id, `${k} enthält "|" (kollidiert mit der Mehrzahl-Syntax von t())`);
  }
  // Vertragsfelder
  const slug = slugify(f.name);
  if (f.slug !== slug) err(f.id, `slug "${f.slug}" ≠ "${slug}"`);
  if (f.weltKuerzel !== WORLD_KUERZEL[f.welt]) err(f.id, `weltKuerzel "${f.weltKuerzel}" passt nicht zu ${f.welt}`);
  const ak = assetKeyFor(WORLD_KUERZEL[f.welt], f.nr, slug);
  if (f.assetKey !== ak) err(f.id, `assetKey "${f.assetKey}" ≠ "${ak}"`);
  for (const [k, list] of [['farben', f.art.farben], ['schillerndFarben', f.art.schillerndFarben]] as const) {
    if (list.length < 4 || list.length > 5) err(f.id, `${k}: ${list.length} Farben statt 4–5`);
    for (const c of list) {
      if (!HEX_RE.test(c)) err(f.id, `${k}: "${c}" ist kein Hex-Wert #RRGGBB`);
      if (c === '#000000' || c === '#FFFFFF') err(f.id, `${k}: ${c} ist verboten (kein Reinschwarz/-weiß)`);
    }
  }
  if (f.art.farben.length !== f.art.schillerndFarben.length) warn(f.id, 'farben und schillerndFarben haben unterschiedlich viele Einträge');
  for (const b of [...f.spawn.koederMag, ...f.spawn.koederMagNicht]) if (!BAIT_RE.test(b)) err(f.id, `Köder-ID "${b}" ungültig`);
  const both = f.spawn.koederMag.filter((b) => f.spawn.koederMagNicht.includes(b));
  if (both.length) err(f.id, `Köder ${both.join(', ')} steht in koeder_mag und koeder_mag_nicht`);
  if (f.groesse.k <= 0) err(f.id, 'k muss > 0 sein');
  const [zMin, zMax] = f.biss.zupfer;
  if (zMin < 0 || zMin > zMax) err(f.id, `zupfer ${zMin}-${zMax} ungültig`);
  if (f.spawn.schwarm && (f.spawn.schwarm[0] < 1 || f.spawn.schwarm[0] > f.spawn.schwarm[1])) err(f.id, 'schwarm ungültig');
  if (f.art.leuchtet === false && f.art.muster === 'leuchtpunkte') warn(f.id, 'Muster "leuchtpunkte", aber leuchtet = 0');
  // Flags: "Immer"/"Alle" nur allein
  if (f.spawn.zeit.length === 0) err(f.id, 'zeit ist leer');
  if (f.spawn.zeit.includes('Immer') && f.spawn.zeit.length > 1) err(f.id, '"Immer" darf nicht mit anderen Zeiten kombiniert werden');
  if (f.spawn.zonen.length === 0) err(f.id, 'zonen ist leer');
  if (f.spawn.zonen.includes('Alle') && f.spawn.zonen.length > 1) err(f.id, '"Alle" darf nicht mit anderen Zonen kombiniert werden');
  if (f.spawn.wetterPflicht.length === 0) err(f.id, 'wetter_pflicht ist leer (Standard "Alle")');
  if (f.spawn.wetterPflicht.includes('Alle') && f.spawn.wetterPflicht.length > 1) err(f.id, '"Alle" darf nicht mit anderem Pflicht-Wetter kombiniert werden');
  if (f.spawn.wetterBevorzugt.includes('Alle')) err(f.id, '"Alle" ist als bevorzugtes Wetter sinnlos');
}

/** Tag-Regeln (datenvertrag.md §5). */
function checkTags(f: FishDbEntry, err: Add, warn: Add): void {
  const has = (t: FishTag) => f.tags.includes(t);
  if (has('raubfisch') === has('friedfisch')) err(f.id, 'tags: genau einer von "raubfisch" oder "friedfisch" erwartet');
  if (has('oberflaeche') && has('grund')) err(f.id, 'tags: "oberflaeche" und "grund" schließen sich aus');
  if (has('leucht') !== f.art.leuchtet) err(f.id, 'tags: "leucht" passt nicht zu leuchtet');
  if (has('zahnfisch') !== f.biss.zahnfisch) err(f.id, 'tags: "zahnfisch" passt nicht zu zahnfisch');
  if ((has('riff') || has('lagune')) && f.welt !== 'W2') warn(f.id, 'tags: "riff"/"lagune" außerhalb des Regenbogenriffs');
  if (has('lagune') && f.spawn.tiefeM[0] > 5) warn(f.id, 'tags: "lagune", aber Tiefe beginnt unter der Lagune (0–5 m)');
  if (has('glut') && f.welt !== 'W5') warn(f.id, 'tags: "glut" außerhalb der Glutgrotte');
}

function checkSizeAndDrill(f: FishDbEntry, err: Add): void {
  // Regel 3
  const [lMin, lMax] = f.groesse.laengeCm;
  if (!(lMin < lMax)) err(f.id, `laenge_min ${lMin} muss < laenge_max ${lMax} sein`);
  if (f.drill.kraft < 1 || f.drill.kraft > 10) err(f.id, `kraft ${f.drill.kraft} außerhalb 1–10`);
  const c = CANVAS_BY_SIZE[f.groesse.klasse];
  const [cw, ch] = f.groesse.canvas;
  if (cw !== c.w || ch !== c.h) err(f.id, `canvas ${cw}x${ch} passt nicht zu Größe ${f.groesse.klasse} (${c.w}x${c.h})`);
  if (f.boss !== (f.groesse.klasse === 'Boss')) err(f.id, 'Größenklasse "Boss" nur (und immer) für Bosse');
  if (f.drill.verhalten2 !== null && (f.drill.verhalten2Ab <= 0 || f.drill.verhalten2Ab >= 1)) err(f.id, 'verhalten2_ab muss zwischen 0 und 1 liegen');
  if (f.drill.verhalten2 !== null && f.drill.verhalten2 === f.drill.verhalten) err(f.id, 'verhalten2 gleicht verhalten');
}

function checkBoss(f: FishDbEntry, err: Add, warn: Add): void {
  const phases = f.bossPhasen ?? [];
  if (!f.boss) {
    if (phases.length) err(f.id, 'Bossphasen bei einem Nicht-Boss');
    return;
  }
  if (phases.length < 3) { err(f.id, `${phases.length} Bossphasen, erwartet 3–4`); return; }
  if (phases.length > 4) warn(f.id, `${phases.length} Bossphasen (Teil D 1.7: 3–4)`);
  let expectFrom = 1;
  phases.forEach((p, i) => {
    if (p.phase !== i + 1) err(f.id, `Phase ${p.phase} an Position ${i + 1} (lückenlos ab 1)`);
    if (Math.abs(p.hpVon - expectFrom) > 1e-9) err(f.id, `Phase ${p.phase} beginnt bei ${p.hpVon}, erwartet ${expectFrom}`);
    if (!(p.hpBis < p.hpVon)) err(f.id, `Phase ${p.phase}: hp_bis muss < hp_von sein`);
    if (p.kraft < 1 || p.kraft > 10) err(f.id, `Phase ${p.phase}: kraft außerhalb 1–10`);
    if (p.verhalten.length === 0) err(f.id, `Phase ${p.phase}: kein Verhalten`);
    if (!p.name.trim() || !p.nameEn.trim() || !p.ansage.trim()) err(f.id, `Phase ${p.phase}: Name/Ansage leer`);
    expectFrom = p.hpBis;
  });
  if (Math.abs(expectFrom) > 1e-9) err(f.id, `letzte Phase endet bei ${expectFrom} statt 0`);
  const first = phases[0];
  if (first && !first.verhalten.includes(f.drill.verhalten)) warn(f.id, `Hauptverhalten ${f.drill.verhalten} fehlt in Phase 1`);
}

function checkConditions(f: FishDbEntry, w: WorldDbEntry, err: Add, warn: Add): void {
  const s = f.spawn;
  const nurZeit = (wx: string) => w.wetter.find((x) => x.wetter === wx)?.nurZeit ?? null;
  const timeOk = (t: string | null) => t === null || s.zeit.includes('Immer') || s.zeit.includes(t as never);

  const required = s.wetterPflicht.filter((x) => x !== 'Alle');
  if (required.length) {
    const possible = required.filter((x) => possibleIn(w, x) && timeOk(nurZeit(x)));
    for (const x of required) if (!possibleIn(w, x)) warn(f.id, `Pflicht-Wetter "${x}" gibt es in ${w.id} nicht`);
    if (possible.length === 0) err(f.id, `kein Pflicht-Wetter (${required.join('|')}) ist in ${w.id} zur Fangzeit möglich`);
  }
  if (s.ereignisPflicht !== 'Keins' && !possibleIn(w, s.ereignisPflicht)) err(f.id, `Pflicht-Ereignis "${s.ereignisPflicht}" steht nicht in den Ereignissen von ${w.id}`);
  if (s.pflichtOder.length) {
    const termOk = (term: SpawnCondition[]) => term.every((c) => possibleIn(w, c) && timeOk(nurZeit(c)));
    s.pflichtOder.forEach((term) => {
      if (!termOk(term)) warn(f.id, `ODER-Bedingung "${term.join('+')}" ist in ${w.id} nicht erfüllbar`);
    });
    if (!s.pflichtOder.some(termOk)) err(f.id, `keine ODER-Bedingung (${s.pflichtOder.map((t) => t.join('+')).join('|')}) ist in ${w.id} möglich`);
  }
  for (const x of s.wetterBevorzugt) if (!possibleIn(w, x)) warn(f.id, `bevorzugtes Wetter "${x}" gibt es in ${w.id} nicht`);
  if (s.ereignisBevorzugt !== 'Keins' && !possibleIn(w, s.ereignisBevorzugt)) warn(f.id, `bevorzugtes Ereignis "${s.ereignisBevorzugt}" gibt es in ${w.id} nicht`);
}

// ------------------------------------------------------------------ Regel 6: Assets (Vertrag §4)

/** Dateizugriff von außen (Node: fs, Deno: Deno.readTextFile …). Pfade mit "/". */
export interface AssetReader {
  /** Textinhalt oder null, wenn die Datei fehlt. */
  readText(path: string): string | null;
  exists(path: string): boolean;
}

interface AtlasFrame { sourceSize?: { w: number; h: number } }
interface AtlasJson { frames?: Record<string, AtlasFrame> | unknown[]; meta?: { clips?: Record<string, number>; image?: string } }

/**
 * Prüft je Welt `public/assets/fish/<kuerzel>/atlas_fish_<kuerzel>.png|.json` und je Fisch alle Clips mit
 * richtiger Frame-Anzahl, `silhouette_0` und (bei `leuchtet`) `emission_0`.
 * `rootDir` ist der Ordner `…/public/assets/fish`.
 */
export function validateAssets(db: FishDb, rootDir: string, reader: AssetReader): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const root = rootDir.replace(/\/+$/, '');
  const clips = Object.keys(SPRITE_CLIPS) as SpriteClip[];

  for (const wid of WORLD_IDS) {
    const k = WORLD_KUERZEL[wid];
    const base = `${root}/${k}/${atlasKeyFor(k)}`;
    const fish = db.fish.filter((f) => f.welt === wid);
    if (!reader.exists(`${base}.png`)) errors.push({ id: wid, msg: `Atlas-Bild fehlt: ${base}.png` });
    const raw = reader.readText(`${base}.json`);
    if (raw === null) {
      errors.push({ id: wid, msg: `Atlas-JSON fehlt: ${base}.json (${fish.length} Fische ohne Sprites)` });
      continue;
    }
    let atlas: AtlasJson;
    try {
      atlas = JSON.parse(raw) as AtlasJson;
    } catch (e) {
      errors.push({ id: wid, msg: `Atlas-JSON ist kaputt: ${(e as Error).message}` });
      continue;
    }
    if (!atlas.frames || Array.isArray(atlas.frames) || typeof atlas.frames !== 'object') {
      errors.push({ id: wid, msg: 'Atlas-JSON ist kein Phaser-JSON-Hash (frames muss ein Objekt sein)' });
      continue;
    }
    const frames = atlas.frames as Record<string, AtlasFrame>;
    const names = Object.keys(frames);
    const metaClips = atlas.meta?.clips;
    for (const c of clips) {
      const fps = metaClips?.[c];
      if (typeof fps !== 'number') errors.push({ id: wid, msg: `meta.clips.${c} (Bildrate) fehlt in der Atlas-JSON` });
      else if (fps !== SPRITE_CLIPS[c].fps) warnings.push({ id: wid, msg: `meta.clips.${c} = ${fps}, Vertrag sagt ${SPRITE_CLIPS[c].fps}` });
    }

    for (const f of fish) {
      const missing: string[] = [];
      for (const c of clips) {
        const n = clipFrameCount(c, f.groesse.klasse);
        const prefix = `${f.assetKey}_${c}_`;
        for (let i = 0; i < n; i++) if (!(`${prefix}${i}` in frames)) missing.push(`${c}_${i}`);
        const extra = names.filter((x) => x.startsWith(prefix) && /^\d+$/.test(x.slice(prefix.length)) && Number(x.slice(prefix.length)) >= n);
        if (extra.length) errors.push({ id: f.id, msg: `Clip ${c}: ${n + extra.length} Frames statt ${n}` });
      }
      if (!(`${f.assetKey}_silhouette_0` in frames)) missing.push('silhouette_0');
      const hasEmission = `${f.assetKey}_emission_0` in frames;
      if (f.art.leuchtet && !hasEmission) missing.push('emission_0');
      if (!f.art.leuchtet && hasEmission) warnings.push({ id: f.id, msg: 'emission_0 vorhanden, aber leuchtet = 0' });
      if (missing.length) errors.push({ id: f.id, msg: `fehlende Frames (${f.assetKey}_…): ${missing.join(', ')}` });
      const [cw, ch] = f.groesse.canvas;
      const sz = frames[`${f.assetKey}_swim_0`]?.sourceSize;
      if (sz && (sz.w !== cw || sz.h !== ch)) warnings.push({ id: f.id, msg: `swim_0 ist ${sz.w}x${sz.h}, Canvas laut Daten ${cw}x${ch}` });
    }
  }
  return { errors, warnings };
}

// ------------------------------------------------------------------ Phase 1: Ausrüstung und Balancing (Vertrag §5)

/** Pflicht-IDs aus Teil D 3.3. */
export const REQUIRED_GEAR_IDS = {
  rods: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'RW1', 'RW2', 'RW3', 'RW4', 'RW5', 'RG'],
  lines: ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'Z-V'],
  reels: ['RO1', 'RO2', 'RO3', 'RO4', 'RO5', 'RO6', 'RO7', 'RO8'],
  baits: [...BAIT_IDS],
} as const;

/**
 * Ausrüstung gegen Spec-Pflichten, Fischdaten und Balancing prüfen:
 * Pflicht-IDs, eindeutige IDs, Preise ≥ 0, Quelle/Preis passend, Köder-Referenzen aus fish.csv,
 * Tags der Köder, Fundstücke je Welt, Fisch-/Ereignis-Referenzen in balancing.
 */
export function validateGear(gear: GearDb, db: FishDb, balancing: Balancing, worlds: WorldDb | readonly WorldDbEntry[]): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (id: string, msg: string) => errors.push({ id, msg });
  const warn = (id: string, msg: string) => warnings.push({ id, msg });
  const wl = worldList(worlds);

  const lists = {
    rods: gear.rods, lines: gear.lines, reels: gear.reels, baits: gear.baits, accessories: gear.accessories, curios: gear.curios,
  } as const;
  for (const [cat, list] of Object.entries(lists) as [keyof typeof lists, readonly { id: string }[]][]) {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) err(x.id, `${cat}: ID doppelt`);
      seen.add(x.id);
    }
    const req = (REQUIRED_GEAR_IDS as Record<string, readonly string[]>)[cat] ?? [];
    for (const id of req) if (!seen.has(id)) err(id, `${cat}: Pflicht-ID fehlt (Teil D 3.3)`);
  }
  const priced = [...gear.rods, ...gear.lines, ...gear.reels, ...gear.baits, ...gear.accessories] as { id: string; priceCoins: number; pricePearls?: number }[];
  for (const x of priced) {
    if (!(x.priceCoins >= 0)) err(x.id, `Preis ${x.priceCoins} < 0`);
    if (x.pricePearls !== undefined && !(x.pricePearls >= 0)) err(x.id, `Perlenpreis ${x.pricePearls} < 0`);
  }

  // Ruten
  const starts = gear.rods.filter((r) => r.source === 'Start');
  if (starts.length !== 1) err('rods', `${starts.length} Startruten statt genau 1`);
  for (const r of gear.rods) {
    if (r.source === 'Shop' && r.priceCoins <= 0) err(r.id, 'Shop-Rute ohne Preis');
    if (r.source !== 'Shop' && r.priceCoins > 0) err(r.id, `Quelle ${r.source}, aber Preis ${r.priceCoins}`);
    if (r.perfectWindowMin < balancing.cast.perfect.windowMinFloor) err(r.id, `Perfekt-Fenster ab ${r.perfectWindowMin} ist größer als erlaubt (${balancing.cast.perfect.windowMinFloor})`);
    if (r.flexGreenZone < balancing.drill.zone.minWidth) err(r.id, `Flex ${r.flexGreenZone} unter der Mindestbreite der grünen Zone`);
    if (r.sizeMuBonus > 0 && r.abilityWorld === null) warn(r.id, 'Größen-μ-Bonus ohne Welt (gilt überall)');
    if (r.abilities.length && r.ability !== r.abilities[0]?.ability) err(r.id, 'ability ≠ erste Fähigkeit');
  }
  const byTier = [...gear.rods].filter((r) => r.source === 'Shop' || r.source === 'Start').sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < byTier.length; i++) {
    const a = byTier[i - 1]; const b = byTier[i];
    if (a && b && b.priceCoins < a.priceCoins) warn(b.id, `Stufe ${b.tier} ist billiger als Stufe ${a.tier}`);
  }

  // Schnüre / Rollen
  if (gear.lines.filter((l) => l.priceCoins === 0).length !== 1) err('lines', 'genau eine Startschnur (Preis 0) erwartet');
  if (gear.reels.filter((l) => l.priceCoins === 0).length !== 1) err('reels', 'genau eine Startrolle (Preis 0) erwartet');
  for (const l of gear.lines) if (l.isLeader && !l.protectsToothed) warn(l.id, 'Vorfach ohne Zahnschutz');

  // Köder
  const baitIds = new Set(gear.baits.map((b) => b.id as string));
  const usedTags = new Set(db.fish.flatMap((f) => f.tags));
  for (const b of gear.baits) {
    if (b.infinite && b.priceCoins > 0) err(b.id, 'unendlicher Köder mit Preis');
    if (b.summonsWorldBoss && b.priceCoinsPerWorldFactor <= 0) warn(b.id, 'Bosslocker ohne Preis × Weltfaktor');
    for (const t of [...Object.keys(b.tagBonus), ...b.targetTags]) if (!usedTags.has(t as FishTag)) warn(b.id, `Tag "${t}" trägt kein Fisch`);
  }
  for (const f of db.fish) {
    for (const k of [...f.spawn.koederMag, ...f.spawn.koederMagNicht]) if (!baitIds.has(k)) err(f.id, `Köder "${k}" steht nicht in baits.csv`);
  }

  // Zubehör
  const lamps = gear.accessories.filter((a) => a.effect === 'Lichtradius').sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < lamps.length; i++) {
    const a = lamps[i - 1]; const b = lamps[i];
    if (a && b && b.value <= a.value) err(b.id, 'Lichtradius muss mit der Stufe steigen');
  }

  // Fundstücke
  for (const c of gear.curios) {
    if (c.coinsMin > c.coinsMax) err(c.id, `muenzen_min ${c.coinsMin} > muenzen_max ${c.coinsMax}`);
    if (c.reward === 'Sammelteil' && (c.collectCount < 2 || !c.rewardRef)) err(c.id, 'Sammelteil braucht sammelzahl ≥ 2 und belohnung_ref');
    if (c.reward === 'Hut' && !c.rewardRef) err(c.id, 'Hut braucht belohnung_ref');
  }
  for (const w of WORLD_IDS) if (!gear.curios.some((c) => c.worlds.length === 0 || c.worlds.includes(w))) err(w, 'kein Fundstück in dieser Welt');

  // Balancing-Referenzen: Fisch-IDs und Ereignisse müssen existieren
  const fishById = new Map(db.fish.map((f) => [f.id, f]));
  for (const [evt, eff] of Object.entries(balancing.spawn.event)) {
    const inWorlds = wl.filter((w) => w.ereignisse.some((e) => e.ereignis === evt));
    if (inWorlds.length === 0) err(`spawn.event.${evt}`, 'Ereignis kommt in keiner Welt vor (events.csv)');
    for (const id of Object.keys(eff?.fish ?? {})) {
      const f = fishById.get(id);
      if (!f) err(`spawn.event.${evt}.fish.${id}`, 'Fisch unbekannt');
      else if (!inWorlds.some((w) => w.id === f.welt)) warn(`spawn.event.${evt}.fish.${id}`, `Fisch lebt in ${f.welt}, Ereignis gibt es dort nicht`);
    }
  }
  for (const evt of Object.keys(balancing.event)) {
    if (!wl.some((w) => w.ereignisse.some((e) => e.ereignis === evt))) err(`event.${evt}`, 'Ereignis kommt in keiner Welt vor (events.csv)');
  }
  for (const tag of [
    ...Object.values(balancing.spawn.weather).flatMap((e) => Object.keys(e?.tags ?? {})),
    ...Object.values(balancing.spawn.event).flatMap((e) => Object.keys(e?.tags ?? {})),
    ...Object.keys(balancing.spawn.futterplatz.tags ?? {}),
  ]) {
    if (!usedTags.has(tag as FishTag)) warn('balancing', `Tag "${tag}" trägt kein Fisch`);
  }
  return { errors, warnings };
}
