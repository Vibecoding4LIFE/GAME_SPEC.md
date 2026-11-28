// src/net/config.ts – Zahlen des Mehrspieler-Teils (B4, D 2.1–2.6), die noch NICHT in Data/balancing.csv stehen.
//
// Teil I Nr. 4 („alle Spielzahlen in Data/*.csv“): Dieser Block ist ein VORSCHLAG für neue Zeilen `net.*` in
// Data/balancing.csv (Schlüssel = Pfad unten, z. B. `net.round.countdownS`). Sobald der daten-designer sie dort
// einträgt und src/data/balancing.ts sie als `net` kennt, liest `netConfigFrom()` sie aus dem Balancing und der
// Vorschlag ist nur noch Rückfall für Tests. Werte, die schon im Balancing stehen (Finale ×1,5 und 60 s,
// verdeckte Punkte 30 s, Rückenwind, Anfängerschutz, Platzbasis …), werden NICHT dupliziert, sondern dort gelesen.
// Keine Phaser-/DOM-/Node-Abhängigkeit.
import { z } from 'zod';
import type { Balancing } from '../data/balancing';

const pos = z.number().finite().positive();
const nonNeg = z.number().finite().min(0);
const frac = z.number().finite().min(0).max(1);
const int = z.number().int().min(0);
const obj = z.strictObject;

export const NetConfigSchema = obj({
  round: obj({
    /** Countdown vor dem Start (B4: 5 s) */
    countdownS: pos,
    /** wählbare Rundendauern (D 2.1: 3/5/8 min) */
    durationsS: z.array(pos).min(1),
    /** Standarddauer (D 2.1: 5 min) */
    defaultDurationS: pos,
    /** „gehakte Fische dürfen 5 s fertig gedrillt werden“ (B4) */
    lastCastS: nonNeg,
    /** Ergebnis-Bildschirm (B4: 15 s) */
    resultsS: pos,
  }),
  room: obj({
    /** D 0: 2–4 Freunde */
    minPlayers: int,
    maxPlayers: int,
  }),
  msg: obj({
    /** Client → Host `reel` alle 0,5 s (B4) */
    reelIntervalS: pos,
    /** Host → alle `shadows` alle 0,5 s (B4) */
    shadowsIntervalS: pos,
    /** `pos` höchstens 5×/s (B4); gilt auch für `lure` (Ködertiefe) */
    posMaxPerS: pos,
    /** Ping-Pong-Proben beim Beitritt (B4 „Uhrzeit-Versatz beim Beitritt messen“) – eigene Wahl */
    clockSamples: int,
    /** Abstand der Ping-Proben (s) – eigene Wahl */
    clockSampleGapS: pos,
  }),
  host: obj({
    /** Abklingzeit zwischen zwei Würfen desselben Spielers (s) – eigene Wahl */
    castCooldownS: nonNeg,
    /** Toleranz der Reichweitenprüfung `cast.ziel` ≤ Wurfweite × (1 + x) – eigene Wahl */
    castRangeTolerance: frac,
    /** Toleranz der Sinkgeschwindigkeits-Prüfung `lure.tiefe` (m) – eigene Wahl */
    depthToleranceM: nonNeg,
    /** schnellere Reaktionen werden auf diesen Wert angehoben (s) – eigene Wahl */
    minReactionS: nonNeg,
    /** Netzwerk-Zuschlag auf das Anschlagfenster (s), bevor der Host „zu spät“ entscheidet – eigene Wahl */
    strikeGraceS: nonNeg,
    /** Drill gilt als plausibel ab Faktor × theoretischer Mindestdauer (Ausdauer, Einholtempo) – eigene Wahl */
    drillMinFactor: frac,
    /** so viel Anteil der erwarteten `reel`-Nachrichten muss ankommen (Paketverlust) – eigene Wahl */
    reelCountFactor: frac,
    /** ohne `reel` so lange → Fisch entkommt (s) – eigene Wahl */
    reelTimeoutS: pos,
  }),
  client: obj({
    /** Host fehlt so lange in der Presence → Aborted (s) – eigene Wahl */
    hostLostGraceS: nonNeg,
    /** `join` wiederholen, solange kein `sync` kam (s) – eigene Wahl */
    joinRetryS: pos,
  }),
  budget: obj({
    /** B4: 4 Spieler × 5 min < 15.000 Nachrichten */
    perRound: pos,
  }),
});

export type NetConfig = z.output<typeof NetConfigSchema>;

/**
 * VORSCHLAG (siehe Kopfkommentar) – Quelle je Wert: Spec-Abschnitt oder „eigene Wahl“.
 * Nicht im Spielcode ändern, sondern nach Data/balancing.csv übertragen.
 */
export const PROPOSED_NET_CONFIG: NetConfig = Object.freeze({
  round: { countdownS: 5, durationsS: [180, 300, 480], defaultDurationS: 300, lastCastS: 5, resultsS: 15 },
  room: { minPlayers: 2, maxPlayers: 4 },
  msg: { reelIntervalS: 0.5, shadowsIntervalS: 0.5, posMaxPerS: 5, clockSamples: 5, clockSampleGapS: 0.2 },
  host: {
    castCooldownS: 1, castRangeTolerance: 0.05, depthToleranceM: 0.5, minReactionS: 0.1, strikeGraceS: 0.35,
    drillMinFactor: 0.9, reelCountFactor: 0.5, reelTimeoutS: 3,
  },
  client: { hostLostGraceS: 5, joinRetryS: 2 },
  budget: { perRound: 15000 },
}) as NetConfig;

/** Netz-Konfiguration: `balancing.net`, sobald es im Schema steht, sonst der Vorschlag. Wirft bei ungültigen Werten. */
export function netConfigFrom(b: Balancing | null, override?: unknown): NetConfig {
  const fromData = b && typeof b === 'object' && 'net' in b ? (b as unknown as { net: unknown }).net : undefined;
  const raw = override ?? fromData ?? PROPOSED_NET_CONFIG;
  const res = NetConfigSchema.safeParse(raw);
  if (!res.success) throw new Error(`Netz-Konfiguration ungültig: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const c = res.data;
  if (!c.round.durationsS.includes(c.round.defaultDurationS)) throw new Error('net.round.defaultDurationS ist keine der durationsS');
  if (c.room.minPlayers > c.room.maxPlayers) throw new Error('net.room.minPlayers > maxPlayers');
  return c;
}
