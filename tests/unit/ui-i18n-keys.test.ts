// tests/unit/ui-i18n-keys.test.ts – jeder in src/ui benutzte Text-Schlüssel existiert in de und en (B7).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';
import { FIGHT_BEHAVIORS, HORIZONTAL_ZONES, RARITIES, TIMES_OF_DAY, WORLD_EVENTS } from '../../src/data/types';
import { RARITY_STYLE, SIZE_TIER_STYLE } from '../../src/ui/rarity';
import { SIZE_TIERS } from '../../src/ui/types';

const dir = join(__dirname, '../../src/ui');
const src = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const has = (k: string) => k in de && k in en;

describe('UI-Texte', () => {
  it('alle festen t(\'…\')-Schlüssel sind übersetzt', () => {
    const keys = new Set([...src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1] as string));
    // Schlüssel, die als Parameter (labelKey) übergeben werden
    for (const m of src.matchAll(/'((?:hud|catch|bucket|lexicon|debug|touch|ui|size)\.[a-zA-Z0-9_.]+)'/g)) keys.add(m[1] as string);
    expect(keys.size).toBeGreaterThan(40);
    expect([...keys].filter((k) => !has(k))).toEqual([]);
  });

  it('zusammengesetzte Schlüssel (Seltenheit, Größe, Verhalten, Zeit, Zone, Ereignis) sind übersetzt', () => {
    const missing: string[] = [];
    RARITIES.forEach((r) => has(RARITY_STYLE[r].nameKey) || missing.push(RARITY_STYLE[r].nameKey));
    SIZE_TIERS.forEach((s) => {
      const k = SIZE_TIER_STYLE[s].labelKey;
      if (k && !has(k)) missing.push(k);
    });
    FIGHT_BEHAVIORS.forEach((b) => has(`behavior.${b}`) || missing.push(`behavior.${b}`));
    TIMES_OF_DAY.forEach((x) => has(`time.${x}`) || missing.push(`time.${x}`));
    HORIZONTAL_ZONES.forEach((z) => has(`zone.${z}`) || missing.push(`zone.${z}`));
    WORLD_EVENTS.filter((e) => e !== 'Keins').forEach((e) => has(`event.${e}`) || missing.push(`event.${e}`));
    expect(missing).toEqual([]);
  });

  it('deutsche Aktions-Knöpfe im Imperativ mit Ausrufezeichen (B7)', () => {
    for (const k of ['touch.cast', 'touch.reel', 'touch.reelIn', 'touch.strike']) expect((de as Record<string, string>)[k]).toMatch(/!$/);
  });
});
