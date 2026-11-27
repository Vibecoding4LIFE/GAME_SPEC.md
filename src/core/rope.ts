// src/core/rope.ts – Angelschnur als Verlet-Seil (B3) und Rasterung als harte Pixel-Linie (Bresenham, ohne Glättung).
// Reine Mathematik ohne Phaser/DOM; die Szene liefert Endpunkte und zeichnet die Pixel.

export interface RopePoint { x: number; y: number; px: number; py: number }

export interface RopeOptions {
  /** Anzahl Segmente (Punkte = Segmente + 1) */
  segments: number;
  /** Schwerkraft in Spielpixeln / s² */
  gravity: number;
  /** Dämpfung je Schritt 0…1 (1 = keine) */
  damping: number;
  /** Constraint-Iterationen je Schritt */
  iterations: number;
  /** Punkte unterhalb dieser y-Linie (Wasser) werden zusätzlich gedämpft; Infinity = aus */
  waterY: number;
  waterDamping: number;
}

export interface Rope { points: RopePoint[]; opts: RopeOptions }

export function createRope(x0: number, y0: number, x1: number, y1: number, opts: RopeOptions): Rope {
  const points: RopePoint[] = [];
  for (let i = 0; i <= opts.segments; i++) {
    const f = i / opts.segments;
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    points.push({ x, y, px: x, py: y });
  }
  return { points, opts };
}

/**
 * Ein Verlet-Schritt. Erster und letzter Punkt sind an (ax, ay) bzw. (bx, by) befestigt.
 * `slack` ≥ 1: Seillänge = Abstand × slack (durchhängende Schnur); 1 = straff (Drill).
 */
export function stepRope(r: Rope, dt: number, ax: number, ay: number, bx: number, by: number, slack: number): void {
  const { points, opts } = r;
  const n = points.length;
  const g = opts.gravity * dt * dt;
  for (let i = 1; i < n - 1; i++) {
    const p = points[i] as RopePoint;
    const d = p.y > opts.waterY ? opts.damping * opts.waterDamping : opts.damping;
    const vx = (p.x - p.px) * d;
    const vy = (p.y - p.py) * d;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + g;
  }
  const first = points[0] as RopePoint;
  const last = points[n - 1] as RopePoint;
  const total = Math.hypot(bx - ax, by - ay) * Math.max(1, slack);
  const seg = total / (n - 1);
  for (let k = 0; k < opts.iterations; k++) {
    first.x = ax; first.y = ay;
    last.x = bx; last.y = by;
    for (let i = 0; i < n - 1; i++) {
      const a = points[i] as RopePoint;
      const b = points[i + 1] as RopePoint;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || Number.EPSILON;
      const diff = (dist - seg) / dist;
      const aFixed = i === 0;
      const bFixed = i + 1 === n - 1;
      if (aFixed && bFixed) continue;
      const wa = aFixed ? 0 : bFixed ? 1 : 1 / 2;
      const wb = bFixed ? 0 : aFixed ? 1 : 1 / 2;
      a.x += dx * diff * wa; a.y += dy * diff * wa;
      b.x -= dx * diff * wb; b.y -= dy * diff * wb;
    }
  }
  first.x = ax; first.y = ay; first.px = ax; first.py = ay;
  last.x = bx; last.y = by; last.px = bx; last.py = by;
}

/** Ruft `plot` für jedes ganze Pixel der Linie (x0,y0)→(x1,y1) auf (Bresenham, Endpunkte gerundet). */
export function rasterLine(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x, y);
    if (x === xe && y === ye) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Alle Pixel einer Polylinie ohne doppelte Punkte (für Graphics.fillRect je Pixel). */
export function rasterPolyline(pts: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  const add = (x: number, y: number) => {
    const k = (y + 4096) * 16384 + (x + 4096);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as { x: number; y: number };
    const b = pts[i + 1] as { x: number; y: number };
    rasterLine(a.x, a.y, b.x, b.y, add);
  }
  if (pts.length === 1) add(Math.round((pts[0] as { x: number }).x), Math.round((pts[0] as { y: number }).y));
  return out;
}
