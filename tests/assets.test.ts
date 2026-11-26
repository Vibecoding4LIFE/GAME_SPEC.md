// tests/assets.test.ts – Regel 6 (Teil G 6.9) bzw. docs/datenvertrag.md §4:
// Atlas pro Welt, alle Clips mit richtiger Frame-Anzahl, silhouette_0, emission_0 bei leuchtenden Fischen.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFishDb } from '../src/data/db';
import { validateAssets, type AssetReader } from '../src/data/validate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = loadFishDb(JSON.parse(readFileSync(join(ROOT, 'public/data/fish_db.json'), 'utf8')));

const fsReader: AssetReader = {
  readText: (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null),
  exists: (p) => existsSync(p),
};

describe('Fisch-Assets', () => {
  it('jeder Fisch hat alle Frames im Atlas seiner Welt', () => {
    const { errors } = validateAssets(db, join(ROOT, 'public/assets/fish'), fsReader);
    expect(errors, errors.map((e) => `${e.id}: ${e.msg}`).join('\n')).toEqual([]);
  });
});

describe('validateAssets (mit Test-Atlas im Speicher)', () => {
  const hecht = db.fish.find((f) => f.id === 'F014');
  const rotauge = db.fish.find((f) => f.id === 'F001');
  if (!hecht || !rotauge) throw new Error('Testfische fehlen');

  const fullFrames = (f: typeof hecht, swim: number) => {
    const names = [
      ...Array.from({ length: swim }, (_, i) => `swim_${i}`),
      ...[0, 1, 2, 3].map((i) => `idle_${i}`),
      ...[0, 1, 2, 3].map((i) => `struggle_${i}`),
      ...[0, 1, 2].map((i) => `caught_${i}`),
      'silhouette_0',
    ];
    return Object.fromEntries(names.map((n) => [`${f.assetKey}_${n}`, { sourceSize: { w: f.groesse.canvas[0], h: f.groesse.canvas[1] } }]));
  };
  const memReader = (files: Record<string, string>): AssetReader => ({
    readText: (p) => files[p] ?? null,
    exists: (p) => p in files || p.endsWith('.png'),
  });
  const meta = { clips: { swim: 10, idle: 6, struggle: 14, caught: 8 } };
  const onlyW1 = { ...db, fish: [hecht, rotauge] };

  it('meldet keine Fehler für einen vollständigen Atlas (S: 4 Schwimm-Frames)', () => {
    const atlas = { frames: { ...fullFrames(hecht, 6), ...fullFrames(rotauge, 4) }, meta };
    const r = validateAssets(onlyW1, '/x', memReader({ '/x/see/atlas_fish_see.json': JSON.stringify(atlas) }));
    expect(r.errors.filter((e) => e.id.startsWith('F'))).toEqual([]);
    expect(r.errors.filter((e) => e.id === 'W1')).toEqual([]);
  });

  it('meldet fehlende Frames, zu viele Frames und fehlende Bildraten', () => {
    const frames = fullFrames(hecht, 6);
    delete frames[`${hecht.assetKey}_silhouette_0`];
    const atlas = { frames: { ...frames, ...fullFrames(rotauge, 6) }, meta: {} };
    const r = validateAssets(onlyW1, '/x', memReader({ '/x/see/atlas_fish_see.json': JSON.stringify(atlas) }));
    const msgs = r.errors.map((e) => `${e.id}: ${e.msg}`).join('\n');
    expect(msgs).toContain('F014: fehlende Frames');
    expect(msgs).toContain('silhouette_0');
    expect(msgs).toContain('F001: Clip swim: 6 Frames statt 4');
    expect(msgs).toContain('meta.clips.swim');
  });

  it('verlangt emission_0 bei leuchtenden Fischen', () => {
    const lumina = db.fish.find((f) => f.id === 'F080');
    if (!lumina) throw new Error('F080 fehlt');
    const atlas = { frames: fullFrames(lumina, 6), meta };
    const r = validateAssets({ ...db, fish: [lumina] }, '/x', memReader({ '/x/tiefe/atlas_fish_tiefe.json': JSON.stringify(atlas) }));
    expect(r.errors.some((e) => e.id === 'F080' && e.msg.includes('emission_0'))).toBe(true);
  });

  it('meldet einen fehlenden Atlas pro Welt', () => {
    const r = validateAssets(onlyW1, '/x', { readText: () => null, exists: () => false });
    expect(r.errors.some((e) => e.id === 'W1' && e.msg.includes('Atlas-JSON fehlt'))).toBe(true);
  });
});
