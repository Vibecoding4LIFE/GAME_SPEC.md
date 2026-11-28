// Lädt die erzeugten Spieldaten für Tests (Node-fs nur hier, nicht in src/game).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBalancing } from '../../../src/data/balancing';
import { loadFishData, loadWorldDb } from '../../../src/data/db';
import { loadGear } from '../../../src/data/gear';
import type { FishData, FishId } from '../../../src/data/types';
import { byId, worldById, type GameData, type Loadout } from '../../../src/game/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, 'public/data', p), 'utf8'));

export const data: GameData = {
  fish: loadFishData(readJson('fish_db.json')),
  worlds: loadWorldDb(readJson('worlds.json')).worlds,
  gear: loadGear(readJson('gear.json')),
  balancing: loadBalancing(readJson('balancing.json')),
};
export const b = data.balancing;
export const W1 = worldById(data.worlds, 'W1');
export const w1Fish = data.fish.filter((f) => f.world === 'W1');
export const fishById = (id: FishId): FishData => {
  const f = data.fish.find((x) => x.id === id);
  if (!f) throw new Error(id);
  return f;
};

/** Startausrüstung: R01, L01, RO1, K01 (Regenwurm). */
export function startLoadout(baitId = 'K01'): Loadout {
  const g = data.gear;
  return {
    rod: byId(g.rods, 'R01', 'Rute'), line: byId(g.lines, 'L01', 'Schnur'), leader: null,
    reel: byId(g.reels, 'RO1', 'Rolle'), bait: byId(g.baits, baitId, 'Köder'), accessories: [],
  };
}
