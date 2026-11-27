// tests/unit/ui-format.test.ts – Länge, Gewicht, Münzen und Listen nach Sprache.
import { describe, expect, it } from 'vitest';
import { formatCoins, formatDepthRange, formatLength, formatLexNr, formatList, formatWeight } from '../../src/ui/format';

describe('formatWeight', () => {
  it('Gramm unter 1 kg', () => {
    expect(formatWeight(850, 'de')).toBe('850 g');
    expect(formatWeight(0.3, 'de')).toBe('1 g');
  });
  it('„1,2 kg“ / „1.2 kg“', () => {
    expect(formatWeight(1200, 'de')).toBe('1,2 kg');
    expect(formatWeight(1200, 'en')).toBe('1.2 kg');
    expect(formatWeight(1249, 'de')).toBe('1,2 kg');
  });
  it('ab 100 kg ganzzahlig mit Tausendertrenner', () => {
    expect(formatWeight(245_400, 'de')).toBe('245 kg');
    expect(formatWeight(1_250_000, 'de')).toBe('1.250 kg');
    expect(formatWeight(1_250_000, 'en')).toBe('1,250 kg');
  });
});

describe('formatLength', () => {
  it('unter 10 cm mit einer Stelle, sonst ganze cm', () => {
    expect(formatLength(8.46, 'de')).toBe('8,5 cm');
    expect(formatLength(8.46, 'en')).toBe('8.5 cm');
    expect(formatLength(45.4, 'de')).toBe('45 cm');
  });
  it('ab 1 m in Metern', () => {
    expect(formatLength(132, 'de')).toBe('1,32 m');
    expect(formatLength(132, 'en')).toBe('1.32 m');
  });
});

describe('Sonstiges', () => {
  it('Münzen mit Tausendertrenner, nie negativ', () => {
    expect(formatCoins(12500, 'de')).toBe('12.500');
    expect(formatCoins(12500, 'en')).toBe('12,500');
    expect(formatCoins(-5, 'de')).toBe('0');
  });
  it('Tiefenbereich und Lexikonnummer', () => {
    expect(formatDepthRange(3, 15, 'de')).toBe('3–15 m');
    expect(formatDepthRange(5, 5, 'de')).toBe('5 m');
    expect(formatLexNr(14)).toBe('#014');
  });
  it('Aufzählungen', () => {
    expect(formatList(['Morgen', 'Abend'], 'disjunction', 'de')).toBe('Morgen oder Abend');
    expect(formatList(['Blinker', 'Wobbler', 'Wurm'], 'conjunction', 'de')).toBe('Blinker, Wobbler und Wurm');
    expect(formatList(['morning', 'evening'], 'disjunction', 'en')).toBe('morning or evening');
    expect(formatList([], 'conjunction', 'de')).toBe('');
  });
});
