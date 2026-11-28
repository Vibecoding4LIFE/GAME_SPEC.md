// src/ui/feedback.ts – Haptik (Vibration-API) mit sichtbarem Ersatz (Rand-Puls), wenn das Gerät nicht vibrieren kann
// (iPhone-Safari kennt navigator.vibrate nicht; in eingebetteten Vorschauen kann die Permissions-Policy es verbieten).
// Abschaltbar; jede Art ist gedrosselt, damit z. B. „rote Spannung“ nicht dauerhaft brummt.
import './styles';

export type FeedbackKind = 'nibble' | 'bite' | 'fake' | 'red' | 'catch' | 'lineBreak' | 'jump' | 'blinker' | 'snag';

/** Muster in ms (an, aus, an …) und Mindestabstand zwischen zwei Auslösungen derselben Art. */
export const FEEDBACK_PATTERNS: Record<FeedbackKind, { pattern: number[]; minGapMs: number; color: string }> = {
  nibble: { pattern: [12], minGapMs: 150, color: '#f8eed4' },
  fake: { pattern: [18], minGapMs: 150, color: '#ffa23a' },
  bite: { pattern: [70, 40, 90], minGapMs: 300, color: '#ff6f59' },
  red: { pattern: [25], minGapMs: 450, color: '#ff3b2f' },
  catch: { pattern: [40, 50, 40, 50, 140], minGapMs: 800, color: '#ffc83d' },
  lineBreak: { pattern: [220], minGapMs: 500, color: '#ff3b2f' },
  jump: { pattern: [30, 30, 30], minGapMs: 300, color: '#8fd3f4' },
  blinker: { pattern: [20, 40, 20], minGapMs: 300, color: '#a86bff' },
  snag: { pattern: [50, 50, 50], minGapMs: 400, color: '#ffa23a' },
};

export interface FeedbackOptions {
  /** Vibration erlaubt (Einstellung) */
  vibration: boolean;
  /** Rand-Puls zeigen, wenn nicht vibriert werden kann (Standard: ja) */
  visualFallback?: boolean;
}

/** Kann dieses Gerät vibrieren? (Feature-Erkennung, keine Garantie: der Aufruf kann trotzdem `false` liefern.) */
export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export class Feedback {
  private last = new Map<FeedbackKind, number>();
  private readonly edge: HTMLDivElement;
  private vibrateWorks: boolean;
  /** Zähler für Tests (window.__KK) */
  readonly counts: Partial<Record<FeedbackKind, number>> = {};

  constructor(private opts: FeedbackOptions, parent: HTMLElement = document.body) {
    this.edge = document.createElement('div');
    this.edge.className = 'ui-edge-pulse';
    this.edge.setAttribute('aria-hidden', 'true');
    parent.append(this.edge);
    this.vibrateWorks = canVibrate();
  }

  set(opts: Partial<FeedbackOptions>): void {
    this.opts = { ...this.opts, ...opts };
    if (!this.opts.vibration) this.stop();
  }

  /** Löst eine Rückmeldung aus (gedrosselt). `now` in ms (performance.now). */
  fire(kind: FeedbackKind, now: number = performance.now()): void {
    const p = FEEDBACK_PATTERNS[kind];
    const prev = this.last.get(kind) ?? -Infinity;
    if (now - prev < p.minGapMs) return;
    this.last.set(kind, now);
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    let vibrated = false;
    if (this.opts.vibration && this.vibrateWorks) {
      try {
        vibrated = navigator.vibrate(p.pattern);
      } catch {
        vibrated = false;
      }
      // dauerhaft verweigert (z. B. Permissions-Policy im iframe) → künftig gleich den Rand-Puls zeigen
      if (!vibrated) this.vibrateWorks = false;
    }
    if (!vibrated && this.opts.visualFallback !== false) this.pulse(p.color);
  }

  stop(): void {
    try {
      if (canVibrate()) navigator.vibrate(0);
    } catch {
      /* egal */
    }
  }

  private pulse(color: string): void {
    this.edge.style.setProperty('--pulse-color', color);
    this.edge.classList.remove('is-on');
    // Neustart der CSS-Animation: Layout lesen erzwingt den Reflow
    void this.edge.offsetWidth;
    this.edge.classList.add('is-on');
  }

  destroy(): void {
    this.stop();
    this.edge.remove();
  }
}
