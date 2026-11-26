/** Minimale Sicht auf public/data/worlds.json, die die Szenen brauchen (volles Schema: src/data). */
export interface WorldJsonEntry {
  id: string;
  kuerzel: string;
  leitfarben: string[];
  [key: string]: unknown;
}

export interface WorldsJson {
  version: number;
  worlds: WorldJsonEntry[];
}

export function worldById(json: WorldsJson, id: string): WorldJsonEntry | undefined {
  return json.worlds.find((w) => w.id === id);
}

export function hexToInt(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}
