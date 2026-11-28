import { describe, it, expect } from 'vitest';
import { Rng, hashSeed } from '../../src/core/random';
import { ditherGradient, gradientColorAt, hexToRgb } from '../../src/core/dither';
import { EventBus } from '../../src/core/events';
import { groupFishFrames } from '../../src/scenes/fishFrames';

describe('Rng', () => {
  it('ist mit gleicher Saat reproduzierbar', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
  it('liefert Werte in [0,1) und int() in Grenzen', () => {
    const r = new Rng(hashSeed('F001'));
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('Bayer-Verlauf', () => {
  const a = hexToRgb('#000010');
  const b = hexToRgb('#0000F0');
  it('nutzt nur die Stopp-Farben (kein Mischen)', () => {
    const px = ditherGradient(8, 16, [a, b]);
    for (let i = 0; i < px.length; i += 4) {
      const blue = px[i + 2];
      expect([0x10, 0xf0]).toContain(blue);
      expect(px[i + 3]).toBe(255);
    }
  });
  it('beginnt mit der ersten und endet mit der letzten Farbe', () => {
    expect(gradientColorAt(0, 0, 16, [a, b])).toEqual(a);
    expect(gradientColorAt(1, 15, 16, [a, b])).toEqual(b);
  });
});

describe('EventBus', () => {
  it('ruft Zuhörer auf und kann sie abmelden', () => {
    const bus = new EventBus<{ ping: number }>();
    const seen: number[] = [];
    const off = bus.on('ping', (n) => seen.push(n));
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(seen).toEqual([1]);
  });
});

describe('groupFishFrames', () => {
  it('gruppiert Frames nach Fisch und Clip in numerischer Reihenfolge', () => {
    const groups = groupFishFrames([
      'fish_see_014_hecht_swim_10',
      'fish_see_014_hecht_swim_2',
      'fish_see_014_hecht_swim_0',
      'fish_see_014_hecht_idle_0',
      'fish_see_020_der-alte-barnabas_swim_0',
      'irgendwas_anderes',
    ]);
    expect(groups).toHaveLength(3);
    const swim = groups.find((g) => g.assetKey === 'fish_see_014_hecht' && g.clip === 'swim');
    expect(swim?.frames).toEqual(['fish_see_014_hecht_swim_0', 'fish_see_014_hecht_swim_2', 'fish_see_014_hecht_swim_10']);
  });
});
