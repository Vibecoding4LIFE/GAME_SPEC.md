// Nutzer-Feedback Phase 1: Einholen als eigene Taste, Pfeiltasten, Knopf-Lenken ohne Haltezeit, Schillernd-Palette.
import { describe, expect, it } from 'vitest';
import { InputCollector } from '../../src/game/session';
import { InputMapper, KEY_BINDINGS, type InputAction } from '../../src/ui/inputMap';
import { FEEDBACK_PATTERNS } from '../../src/ui/feedback';
import { hexToRgb, swapPalette } from '../../src/ui/sprite';

const mapper = () => {
  const got: InputAction[] = [];
  return { m: new InputMapper((a) => got.push(a)), got };
};

describe('Tasten (PC)', () => {
  it('Pfeiltasten wie WASD, R/Rücktaste = Einholen (nur im Wasser)', () => {
    expect(KEY_BINDINGS.sink).toContain('ArrowDown');
    expect(KEY_BINDINGS.left).toContain('ArrowLeft');
    expect(KEY_BINDINGS.right).toContain('ArrowRight');
    expect(KEY_BINDINGS.rodUp).toContain('ArrowUp');
    const { m, got } = mapper();
    m.setMode('aim');
    expect(m.key('KeyR', true)).toBe(true); // gehört dem Spiel (preventDefault), tut im Ziel-Modus aber nichts
    m.key('KeyR', false);
    m.setMode('wait');
    m.key('KeyR', true);
    m.key('KeyR', false);
    m.key('Backspace', true);
    expect(got.map((a) => a.type)).toEqual(['retrieve', 'retrieve']);
  });

  it('Knopf-Lenken: sofort −1/+1, Loslassen = 0, zwei Knöpfe heben sich auf', () => {
    const { m, got } = mapper();
    m.setMode('fight');
    m.setSteer('btn-left', 'touch', -1);
    expect(m.steerValue).toBe(-1);
    m.setSteer('btn-right', 'touch', 1);
    expect(m.steerValue).toBe(0);
    m.setSteer('btn-left', 'touch', 0);
    expect(m.steerValue).toBe(1);
    m.setSteer('btn-right', 'touch', 0);
    expect(got.filter((a) => a.type === 'steer').map((a) => a.value)).toEqual([-1, 0, 1, 0]);
  });

  it('Sammler: Einholen ist eine Flanke für genau einen Schritt', () => {
    const c = new InputCollector();
    c.apply({ type: 'retrieve' });
    expect(c.take().retrieve).toBe(true);
    expect(c.take().retrieve).toBe(false);
  });
});

describe('Haptik-Muster', () => {
  it('jede Art hat ein Muster und eine Drossel; rote Spannung pulsiert gedrosselt', () => {
    for (const p of Object.values(FEEDBACK_PATTERNS)) {
      expect(p.pattern.length).toBeGreaterThan(0);
      expect(p.minGapMs).toBeGreaterThan(0);
    }
    expect(FEEDBACK_PATTERNS.red.minGapMs).toBeGreaterThanOrEqual(300);
    expect(FEEDBACK_PATTERNS.bite.pattern.reduce((a, b) => a + b, 0)).toBeGreaterThan(FEEDBACK_PATTERNS.nibble.pattern[0]!);
  });
});

describe('Schillernd: gebackener Palette-Swap (D 1.11)', () => {
  it('Grundfarben werden zu Schillernd-Farben, Helligkeitsstufen bleiben erhalten, Alpha unverändert', () => {
    const from = ['#5B6B2F', '#E8E4C9'];
    const to = ['#B7B2D6', '#8FD3F4'];
    const px = (hex: string, a = 255) => [...hexToRgb(hex), a];
    const dark = hexToRgb('#5B6B2F').map((v) => Math.round(v * 0.7));
    const data = new Uint8ClampedArray([...px('#5B6B2F'), ...dark, 255, ...px('#E8E4C9'), ...px('#000000', 0)]);
    swapPalette(data, from, to);
    expect([...data.slice(0, 3)]).toEqual(hexToRgb('#B7B2D6'));
    const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
    expect(lum(data[4]!, data[5]!, data[6]!)).toBeLessThan(lum(data[0]!, data[1]!, data[2]!)); // Schatten bleibt dunkler
    expect([...data.slice(8, 11)]).toEqual(hexToRgb('#8FD3F4'));
    expect(data[15]).toBe(0);
    expect([...data.slice(12, 15)]).toEqual([0, 0, 0]);
  });
});
