// src/net/clockOffset.ts – Uhrzeit-Versatz zum Host per Ping-Pong (B4: „Uhrzeit-Versatz beim Beitritt messen“).
// NTP-Prinzip: Client sendet t0, Host antwortet mit t0 und seiner Uhr t1, Client empfängt bei t2.
//   rtt = t2 − t0,  offset = t1 − (t0 + t2) / 2   →   Host-Uhr ≈ lokale Uhr + offset
// Von mehreren Proben gilt die mit der kleinsten Laufzeit (am wenigsten Warteschlange). Reine Logik.

export interface ClockSample { t0: number; t1: number; t2: number }

export const sampleRtt = (s: ClockSample): number => s.t2 - s.t0;
export const sampleOffset = (s: ClockSample): number => s.t1 - (s.t0 + s.t2) / 2;

export interface ClockEstimate { offsetMs: number; rttMs: number; samples: number }

/** Beste Schätzung aus den Proben (kleinste RTT); null ohne gültige Probe. */
export function estimateOffset(samples: readonly ClockSample[]): ClockEstimate | null {
  let best: ClockSample | null = null;
  let n = 0;
  for (const s of samples) {
    if (!(s.t2 >= s.t0)) continue;
    n++;
    if (!best || sampleRtt(s) < sampleRtt(best)) best = s;
  }
  return best ? { offsetMs: sampleOffset(best), rttMs: sampleRtt(best), samples: n } : null;
}

/** Sammelt Proben eines Clients. `hostNow(local)` rechnet lokale Zeit in Host-Zeit um. */
export class ClockSync {
  private samples: ClockSample[] = [];
  private est: ClockEstimate | null = null;

  constructor(private readonly maxSamples = 16) {}

  add(t0: number, t1: number, t2: number): ClockEstimate | null {
    this.samples.push({ t0, t1, t2 });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.est = estimateOffset(this.samples);
    return this.est;
  }

  get estimate(): ClockEstimate | null { return this.est; }
  get count(): number { return this.samples.length; }
  /** Versatz in ms (0, solange keine Probe da ist). */
  get offsetMs(): number { return this.est?.offsetMs ?? 0; }

  hostNow(localNow: number): number { return localNow + this.offsetMs; }
  toLocal(hostTime: number): number { return hostTime - this.offsetMs; }

  reset(): void { this.samples = []; this.est = null; }
}
