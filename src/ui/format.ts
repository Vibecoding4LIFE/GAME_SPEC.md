// src/ui/format.ts – Zahlen, Längen und Gewichte nach Sprache (reine Logik, testbar).
import { getLanguage, type Language } from '../i18n';

const LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-US' };
const cache = new Map<string, Intl.NumberFormat>();

function nf(lang: Language, digits: number): Intl.NumberFormat {
  const key = `${lang}:${digits}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(key, f);
  }
  return f;
}

/** Zahl mit fester Nachkommazahl: 1234.5 → „1.234,5“ (de) / „1,234.5“ (en). */
export function formatNumber(value: number, digits = 0, lang: Language = getLanguage()): string {
  return nf(lang, digits).format(value);
}

/** Münzen ganzzahlig mit Tausenderpunkt: 12500 → „12.500“ / „12,500“. */
export function formatCoins(coins: number, lang: Language = getLanguage()): string {
  return formatNumber(Math.max(0, Math.round(coins)), 0, lang);
}

/**
 * Länge: unter 10 cm eine Nachkommastelle („8,5 cm“), bis 99 cm ganzzahlig („45 cm“),
 * ab 100 cm in Metern mit zwei Stellen („1,32 m“).
 */
export function formatLength(cm: number, lang: Language = getLanguage()): string {
  if (cm >= 100) return `${formatNumber(cm / 100, 2, lang)} m`;
  if (cm < 10) return `${formatNumber(cm, 1, lang)} cm`;
  return `${formatNumber(Math.round(cm), 0, lang)} cm`;
}

/**
 * Gewicht: unter 1 kg in Gramm („850 g“), bis 100 kg mit einer Nachkommastelle („1,2 kg“),
 * darüber ganzzahlig („245 kg“).
 */
export function formatWeight(g: number, lang: Language = getLanguage()): string {
  if (g < 1000) return `${formatNumber(Math.max(1, Math.round(g)), 0, lang)} g`;
  const kg = g / 1000;
  if (kg < 100) return `${formatNumber(kg, 1, lang)} kg`;
  return `${formatNumber(Math.round(kg), 0, lang)} kg`;
}

/** Tiefenbereich „3–15 m“ (Halbgeviertstrich, schmale Leerzeichen nicht nötig). */
export function formatDepthRange(minM: number, maxM: number, lang: Language = getLanguage()): string {
  return minM === maxM ? `${formatNumber(minM, 0, lang)} m` : `${formatNumber(minM, 0, lang)}–${formatNumber(maxM, 0, lang)} m`;
}

/** Lexikonnummer „#014“. */
export const formatLexNr = (nr: number): string => `#${String(nr).padStart(3, '0')}`;

/** Aufzählung nach Sprache: „Morgen oder Abend“ / „morning or evening“. */
export function formatList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction', lang: Language = getLanguage()): string {
  if (items.length === 0) return '';
  return new Intl.ListFormat(LOCALES[lang], { style: 'long', type }).format(items);
}
