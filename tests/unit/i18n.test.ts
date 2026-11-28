// tests/unit/i18n.test.ts – B7: jeder Schlüssel in de und en vorhanden und nicht leer; t() mit Platzhalter und Mehrzahl.
import { afterEach, describe, expect, it } from 'vitest';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';
import { allKeys, detectLanguage, getLanguage, setLanguage, t } from '../../src/i18n';

const tables: Record<string, Record<string, string>> = { de, en };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Vollständigkeit (B7)', () => {
  it('de und en haben dieselben Schlüssel', () => {
    const d = Object.keys(de).sort();
    const e = Object.keys(en).sort();
    expect(d.filter((k) => !(k in en)), 'fehlt in en.json').toEqual([]);
    expect(e.filter((k) => !(k in de)), 'fehlt in de.json').toEqual([]);
  });

  it.each(['de', 'en'])('kein Text in %s.json ist leer', (lang) => {
    const empty = Object.entries(tables[lang] ?? {}).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('Platzhalter stimmen in beiden Sprachen überein', () => {
    const bad = Object.keys(de).filter((k) => k in en && placeholders(de[k as keyof typeof de]).join() !== placeholders((en as Record<string, string>)[k] ?? '').join());
    expect(bad).toEqual([]);
  });

  it('enthält die Texte aller 100 Fische und der 5 Welten', () => {
    for (let i = 1; i <= 100; i++) {
      const k = `fish.${String(i).padStart(3, '0')}`;
      for (const s of ['name', 'lexicon', 'hint']) expect(allKeys('de')).toContain(`${k}.${s}`);
    }
    for (let i = 1; i <= 5; i++) expect(allKeys('en')).toContain(`world.${i}.name`);
  });
});

describe('t()', () => {
  afterEach(() => setLanguage('de'));

  it('ersetzt Platzhalter', () => {
    setLanguage('de');
    expect(t('test.title', { world: 'Frostfjord' })).toBe('Testbecken: Frostfjord');
    setLanguage('en');
    expect(t('test.title', { world: 'Frost Fjord' })).toBe('Test tank: Frost Fjord');
  });

  it('wählt Einzahl oder Mehrzahl über count', () => {
    setLanguage('de');
    expect(t('test.fishCount', { count: 1 })).toBe('1 Fisch');
    expect(t('test.fishCount', { count: 5 })).toBe('5 Fische');
    expect(t('test.fishCount', { count: 0 })).toBe('0 Fische');
  });

  it('lässt unbekannte Platzhalter stehen und fällt auf den Schlüssel zurück', () => {
    expect(t('test.title')).toBe('Testbecken: {world}');
    expect(t('gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  it('liefert Fischnamen in beiden Sprachen', () => {
    expect(t('fish.014.name')).toBe('Hecht');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('fish.014.name')).toBe('Northern Pike');
  });

  it('erkennt die Browsersprache (Standard Deutsch)', () => {
    expect(detectLanguage(['en-US', 'de'])).toBe('en');
    expect(detectLanguage(['fr-FR'])).toBe('de');
    expect(detectLanguage([])).toBe('de');
  });
});
