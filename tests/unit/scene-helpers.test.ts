import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/core/pixelScale';
import { createRope, rasterLine, rasterPolyline, stepRope } from '../../src/core/rope';
import { Rng } from '../../src/core/random';
import { createShadowSim, pickShadowFish, shadowViews, stepShadows } from '../../src/game/shadows';
import { cssInsetToGame, hudInsets, hudLayout } from '../../src/scenes/hudLayout';
import {
  bottomDepthAt, cameraView, celestialPos, depthToY, parallaxX, phaseKey, seabedY, tileOffsets, type WorldSee,
} from '../../src/scenes/worldSee';
import { b, data, startLoadout, W1, w1Fish } from './helpers/gameData';

const see = JSON.parse(readFileSync(join(__dirname, '../../public/assets/worlds/see/world_see.json'), 'utf8')) as WorldSee;

describe('Pixel-Linie (Bresenham)', () => {
  it('liefert lückenlose, ganzzahlige Pixel inkl. Endpunkte', () => {
    const px: [number, number][] = [];
    rasterLine(0.4, 0.4, 5.2, 2.6, (x, y) => px.push([x, y]));
    expect(px[0]).toEqual([0, 0]);
    expect(px[px.length - 1]).toEqual([5, 3]);
    for (let i = 1; i < px.length; i++) {
      const [ax, ay] = px[i - 1] as [number, number];
      const [bx, by] = px[i] as [number, number];
      expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1);
    }
    expect(px.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true);
  });
  it('Polylinie ohne doppelte Pixel', () => {
    const pts = rasterPolyline([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }]);
    expect(pts).toHaveLength(7);
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(7);
  });
});

describe('Verlet-Seil', () => {
  const opts = { segments: 12, gravity: 300, damping: 0.98, iterations: 8, waterY: Infinity, waterDamping: 1 };
  it('Enden bleiben befestigt, lockeres Seil hängt durch, straffes nicht', () => {
    const r = createRope(0, 0, 100, 0, opts);
    for (let i = 0; i < 240; i++) stepRope(r, 1 / 60, 0, 0, 100, 0, 1.2);
    expect(r.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(r.points[12]).toMatchObject({ x: 100, y: 0 });
    const sag = Math.max(...r.points.map((p) => p.y));
    expect(sag).toBeGreaterThan(10);
    const t = createRope(0, 0, 100, 0, opts);
    for (let i = 0; i < 240; i++) stepRope(t, 1 / 60, 0, 0, 100, 0, 1);
    expect(Math.max(...t.points.map((p) => p.y))).toBeLessThan(sag / 3);
  });
  it('Segmentlängen nähern sich der Sollänge', () => {
    const r = createRope(0, 0, 60, 80, opts);
    for (let i = 0; i < 300; i++) stepRope(r, 1 / 60, 0, 0, 60, 80, 1.1);
    const seg = (100 * 1.1) / 12;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1]!;
      const c = r.points[i]!;
      expect(Math.abs(Math.hypot(c.x - a.x, c.y - a.y) - seg)).toBeLessThan(seg * 0.15);
    }
  });
});

describe('world_see.json – Geometrie und Kamera', () => {
  it('20 px = 1 m, Oberfläche y = 120, 25 m bei y = 620', () => {
    expect(depthToY(see, 0)).toBe(120);
    expect(depthToY(see, 25)).toBe(620);
    expect(phaseKey('Nacht')).toBe('nacht');
  });
  it('Grundlinie interpoliert, Grundtiefe nie negativ und ≤ maxTiefe', () => {
    expect(seabedY(see, 0)).toBe(see.seegrund.polyline[0]![1]);
    for (let x = 0; x <= 960; x += 7) {
      const d = bottomDepthAt(see, x);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(see.maxTiefeM);
    }
  });
  it('Kamera: Querformat folgt dem Köder bis 25 m, Hochformat zeigt die ganze Höhe; immer ganze Pixel', () => {
    expect(cameraView(see, 'landscape', 640, 360, 124, 120)).toEqual({ x: 0, y: 0 });
    expect(cameraView(see, 'landscape', 640, 360, 124, 620)).toEqual({ x: 0, y: 280 });
    const mid = cameraView(see, 'landscape', 640, 360, 700.4, 400.6);
    expect(Number.isInteger(mid.x) && Number.isInteger(mid.y)).toBe(true);
    expect(cameraView(see, 'portrait', 360, 640, 524, 600)).toEqual({ x: 344, y: 0 });
  });
  it('Parallax ohne Bruchteile, Kacheln decken den Ausschnitt', () => {
    for (const s of [0, 1, 37, 320, 599]) {
      for (const f of [0.1, 0.3, 0.6, 1, 1.15]) {
        const x = parallaxX(s, f);
        expect(Number.isInteger(x - s)).toBe(true);
        const tiles = tileOffsets(x, 960, s, 640);
        expect(tiles[0]!).toBeLessThanOrEqual(s);
        expect(tiles[tiles.length - 1]! + 960).toBeGreaterThanOrEqual(s + 640);
      }
    }
  });
  it('Sonnenbahn: Horizont an den Enden, Höchststand in der Mitte', () => {
    expect(celestialPos(see, 0).y).toBe(see.sonnenbahn.yHorizont);
    expect(celestialPos(see, 0.5).y).toBe(see.sonnenbahn.yHoch);
  });
});

describe('HUD-Layout', () => {
  const reserve = { dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 }, topBarCss: 52, touchButtonCss: 0 };
  const sizes = { gaugeW: 20, gaugeH: 132, tensionW: 168, tensionH: 16, distanceW: 104, distanceH: 10, staminaW: 55, staminaH: 11, iconH: 8, labelH: 14, arrowW: 17, gap: 4, touchButtonGame: 0 };
  it('Abstände rechnen den Rand außerhalb der Spielfläche ab', () => {
    expect(cssInsetToGame(52, 1, 0, 2)).toBe(26);
    expect(cssInsetToGame(52, 3, 306, 3)).toBe(0);
    expect(cssInsetToGame(44, 3, 0, 3)).toBe(44);
  });
  it('Quer- und Hochformat: alles innerhalb der Spielfläche, ganze Pixel, unter der HTML-Leiste', () => {
    for (const [w, h, dpr] of [[1280, 720, 1], [1170, 2532, 3], [2532, 1170, 3], [1080, 2400, 2.625]] as const) {
      const l = computeLayout(w, h);
      const ins = hudInsets(l, { ...reserve, dpr, safe: { top: 47, right: 0, bottom: 34, left: 0 } });
      const lay = hudLayout(l, ins, { ...sizes, touchButtonGame: l.orientation === 'portrait' ? 40 : 0 });
      for (const box of Object.values(lay)) {
        expect(Number.isInteger(box.x) && Number.isInteger(box.y)).toBe(true);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x).toBeLessThanOrEqual(l.gameWidth);
        expect(box.y).toBeLessThanOrEqual(l.gameHeight);
      }
      expect(lay.weather.y).toBeGreaterThanOrEqual(ins.top);
      expect(lay.tension.y + sizes.tensionH).toBeLessThanOrEqual(l.gameHeight - ins.bottom);
      // keine Überlappung im Drill-Stapel
      expect(lay.arrow.y + Math.ceil(sizes.arrowW / 2)).toBeLessThanOrEqual(lay.stamina.y);
      expect(lay.stamina.y + sizes.staminaH).toBeLessThanOrEqual(lay.distance.y - sizes.iconH);
      // Beschriftungszeile „Spannung“ zwischen Distanz und Spannung
      expect(lay.distance.y + sizes.distanceH + sizes.labelH).toBeLessThanOrEqual(lay.tension.y);
    }
  });
});

describe('Fisch-Schatten', () => {
  const lo = startLoadout();
  const ctx = {
    b, world: W1, fish: w1Fish, curios: data.gear.curios, phase: 'Tag' as const, weather: 'Sonnig' as const, events: [],
    depthM: 0, zone: 'Freiwasser' as const, bait: lo.bait, line: lo.line, leader: null, twitching: false, feedingSpot: false, pityCount: 0,
  };
  const params = { max: 40, minXM: 0, maxXM: 30, speedMs: [0.3, 1] as [number, number], ttlS: [5, 10] as [number, number], spawnPerS: 3 };
  it('nur Arten, die gerade beißen können, in ihrer Tiefe; höchstens max', () => {
    const rng = new Rng(2);
    const sim = createShadowSim();
    for (let i = 0; i < 600; i++) stepShadows(sim, 1 / 10, ctx, params, rng);
    expect(sim.shadows.length).toBeGreaterThan(5);
    expect(sim.shadows.length).toBeLessThanOrEqual(40);
    for (const s of sim.shadows) {
      const f = w1Fish.find((x) => x.id === s.fishId)!;
      expect(f.timeMask.includes('Tag') || f.timeMask.includes('Immer')).toBe(true);
      expect(s.depthM).toBeGreaterThanOrEqual(f.depthMinM);
      expect(s.depthM).toBeLessThanOrEqual(f.depthMaxM);
      expect(s.xM).toBeGreaterThanOrEqual(params.minXM - 1);
    }
    expect(sim.shadows.some((s) => s.fishId === 'F020')).toBe(false);
  });
  it('Clients sehen die Art nicht, nur ob sie bekannt ist', () => {
    const sim = createShadowSim();
    stepShadows(sim, 1, ctx, params, new Rng(1));
    const v = shadowViews(sim, (id) => id === 'F001');
    expect(v.every((x) => !('fishId' in x))).toBe(true);
    expect(pickShadowFish({ ...ctx, phase: 'Nacht', weather: 'Gewitter' }, new Rng(1))).not.toBeNull();
  });
});
