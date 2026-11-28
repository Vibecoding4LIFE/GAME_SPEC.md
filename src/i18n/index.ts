import de from './de.json';
import en from './en.json';

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const tables: Record<Language, Record<string, string>> = { de, en };
let current: Language = 'de';

/** Sprache aus dem Browser übernehmen (Standard: Deutsch). */
export function detectLanguage(navLanguages: readonly string[] = []): Language {
  for (const l of navLanguages) {
    const code = l.slice(0, 2).toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(code)) return code as Language;
  }
  return 'de';
}

export function setLanguage(lang: Language): void {
  current = lang;
}

export function getLanguage(): Language {
  return current;
}

/**
 * Übersetzt einen Schlüssel. Platzhalter: {name}. Mehrzahl: "Einzahl|Mehrzahl",
 * gewählt über den Parameter `count`. Fehlt ein Text, wird Deutsch, dann der Schlüssel gezeigt.
 */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let text = tables[current][key] || tables.de[key] || key;
  if (text.includes('|') && typeof params.count === 'number') {
    const [one, many = one] = text.split('|');
    text = (params.count === 1 ? one : many) ?? text;
  }
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function allKeys(lang: Language): string[] {
  return Object.keys(tables[lang]);
}
