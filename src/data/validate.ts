// Zeilenuebergreifende Pruefungen fuer fish_db (Spec G 6.9, Regeln 1-4).
// Regeln 2 (Weltdaten), 5 (Wetter/Ereignisse je Welt), 6 (Atlas), 7 (Spawn-Simulation) brauchen
// Daten bzw. Code, die es in Phase 0 noch nicht gibt (siehe docs/platzhalter.md).
import { RARITIES, WORLD_IDS } from './types';
import type { Rarity, SizeClass, WorldId } from './types';
import type { FishDb } from './db';

export interface Issue { id: string; msg: string }
export interface Report { errors: Issue[]; warnings: Issue[] }

export const RARITY_DISTRIBUTION: Record<Rarity, number> = {
  Gewoehnlich: 8, Ungewoehnlich: 5, Selten: 4, Episch: 2, Legendaer: 1,
};

export const CANVAS_BY_SIZE: Record<SizeClass, [number, number]> = {
  S: [32, 16], M: [64, 32], L: [96, 48], XL: [128, 64], Boss: [256, 128],
};

/** Punktebaender je Welt und Seltenheit (G 6.9). */
export const POINT_BANDS: Record<WorldId, Record<Rarity, [number, number]>> = {
  W1: { Gewoehnlich: [10, 25], Ungewoehnlich: [50, 70], Selten: [120, 180], Episch: [350, 450], Legendaer: [1000, 1000] },
  W2: { Gewoehnlich: [20, 40], Ungewoehnlich: [65, 100], Selten: [180, 250], Episch: [500, 600], Legendaer: [1500, 1500] },
  W3: { Gewoehnlich: [30, 55], Ungewoehnlich: [90, 130], Selten: [260, 320], Episch: [600, 750], Legendaer: [2000, 2000] },
  W4: { Gewoehnlich: [40, 70], Ungewoehnlich: [120, 170], Selten: [300, 400], Episch: [800, 900], Legendaer: [2500, 2500] },
  W5: { Gewoehnlich: [55, 90], Ungewoehnlich: [140, 210], Selten: [400, 500], Episch: [1000, 1100], Legendaer: [3000, 3000] },
};

export function validateDb(db: FishDb): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (id: string, msg: string) => errors.push({ id, msg });
  const warn = (id: string, msg: string) => warnings.push({ id, msg });

  // Regel 1: IDs F001-F100 lueckenlos und eindeutig, 20 je Welt, 8/5/4/2/1, 1 Boss je Welt (Legendaer)
  if (db.fish.length !== 100) err('db', `Es muessen genau 100 Fische sein, gefunden: ${db.fish.length}`);
  const seen = new Set<string>();
  for (const f of db.fish) {
    if (seen.has(f.id)) err(f.id, 'ID doppelt');
    seen.add(f.id);
  }
  const nrs = new Set<number>();
  for (const f of db.fish) {
    if (nrs.has(f.nr)) err(f.id, `Lexikonnummer ${f.nr} doppelt`);
    nrs.add(f.nr);
    if (f.id !== `F${String(f.nr).padStart(3, '0')}`) err(f.id, `ID passt nicht zur Nummer ${f.nr}`);
  }
  for (let i = 1; i <= 100; i++) {
    const id = `F${String(i).padStart(3, '0')}`;
    if (!seen.has(id)) err(id, 'ID fehlt (Luecke)');
  }
  for (const w of WORLD_IDS) {
    const inWorld = db.fish.filter(f => f.welt === w);
    if (inWorld.length !== 20) err(w, `Welt hat ${inWorld.length} statt 20 Fische`);
    for (const r of RARITIES) {
      const n = inWorld.filter(f => f.seltenheit === r).length;
      if (n !== RARITY_DISTRIBUTION[r]) err(w, `${r}: ${n} statt ${RARITY_DISTRIBUTION[r]}`);
    }
    const bosses = inWorld.filter(f => f.boss);
    if (bosses.length !== 1) err(w, `Welt hat ${bosses.length} Bosse statt 1`);
    else if (bosses[0].seltenheit !== 'Legendaer') err(bosses[0].id, 'Boss muss Legendaer sein');
  }

  for (const f of db.fish) {
    // Pflichtfelder
    if (!f.name) err(f.id, 'Name fehlt');
    if (!f.basis) err(f.id, 'Basis fehlt');
    if (!f.art.text) err(f.id, 'art_text fehlt');
    if (!f.art.schillernd) err(f.id, 'schillernd_text fehlt');
    // Regel 3
    const [lmin, lmax] = f.groesse.laengeCm;
    if (!(lmin < lmax)) err(f.id, `laenge_min (${lmin}) muss kleiner sein als laenge_max (${lmax})`);
    if (!(f.drill.kraft >= 1 && f.drill.kraft <= 10)) err(f.id, `kraft ${f.drill.kraft} ausserhalb 1-10`);
    const want = CANVAS_BY_SIZE[f.groesse.klasse];
    if (!want || f.groesse.canvas[0] !== want[0] || f.groesse.canvas[1] !== want[1]) {
      err(f.id, `canvas ${f.groesse.canvas.join('x')} passt nicht zur Groesse ${f.groesse.klasse}`);
    }
    if (f.boss !== (f.groesse.klasse === 'Boss')) err(f.id, 'boss-Flag und Groesse "Boss" passen nicht zusammen');
    const [tmin, tmax] = f.spawn.tiefeM;
    if (!(tmin >= 0 && tmin < tmax)) err(f.id, `Tiefe ${tmin}-${tmax} ungueltig`);
    if (f.groesse.k <= 0) err(f.id, 'k muss positiv sein');
    if (f.spawn.zeit.length === 0) err(f.id, 'zeit leer');
    // Regel 4 (Warnung)
    const band = POINT_BANDS[f.welt]?.[f.seltenheit];
    if (band && (f.punkte < band[0] || f.punkte > band[1])) {
      warn(f.id, `Punkte ${f.punkte} ausserhalb des Bandes ${band[0]}-${band[1]} (${f.welt}, ${f.seltenheit})`);
    }
    // Boss-Phasen
    if (f.boss && (!f.bossPhasen || f.bossPhasen.length === 0)) warn(f.id, 'Boss ohne Phasen');
  }
  return { errors, warnings };
}
