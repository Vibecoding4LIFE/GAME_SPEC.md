// src/ui/spatialNav.ts – Fokus mit Pfeiltasten / Steuerkreuz räumlich bewegen (reine Logik, testbar).

export type NavDir = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Wählt den nächsten Kandidaten in Richtung `dir`.
 * Bewertung: Abstand in Hauptrichtung + 2 × Versatz quer dazu (Kandidaten in derselben Zeile/Spalte gewinnen).
 * Rückgabe: Index in `candidates` oder −1.
 */
export function pickNeighbor(current: NavRect, candidates: readonly NavRect[], dir: NavDir): number {
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((r, i) => {
    const rx = r.x + r.w / 2;
    const ry = r.y + r.h / 2;
    let main: number;
    let cross: number;
    switch (dir) {
      case 'right':
        main = r.x - (current.x + current.w);
        cross = Math.abs(ry - cy);
        if (rx <= cx + 1) return;
        break;
      case 'left':
        main = current.x - (r.x + r.w);
        cross = Math.abs(ry - cy);
        if (rx >= cx - 1) return;
        break;
      case 'down':
        main = r.y - (current.y + current.h);
        cross = Math.abs(rx - cx);
        if (ry <= cy + 1) return;
        break;
      case 'up':
        main = current.y - (r.y + r.h);
        cross = Math.abs(rx - cx);
        if (ry >= cy - 1) return;
        break;
    }
    const score = Math.max(0, main) + 2 * cross;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export const KEY_TO_DIR: Record<string, NavDir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
