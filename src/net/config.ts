// src/net/config.ts – Zahlen des Mehrspieler-Teils (B4, D 2.1–2.6) aus Data/balancing.csv (`net.*`).
// Bedeutung und Quelle jedes Werts stehen in der CSV. Werte, die es schon an anderer Stelle im Balancing gibt
// (Finale ×1,5 und 60 s, verdeckte Punkte 30 s, Rückenwind, Anfängerschutz, Platzbasis …), liest der Netzcode dort.
// Keine Phaser-/DOM-/Node-Abhängigkeit.
import type { Balancing } from '../data/balancing';

type Net = Balancing['net'];

/** Netz-Konfiguration; `round.durationsS` als sortierte Liste (3/5/8 min). */
export type NetConfig = Omit<Net, 'round'> & { round: Omit<Net['round'], 'durationsS'> & { durationsS: number[] } };

/** Netz-Konfiguration aus dem geprüften Balancing (`loadBalancing`). */
export function netConfigFrom(b: Balancing): NetConfig {
  const n = b.net;
  return {
    ...n,
    round: { ...n.round, durationsS: [n.round.durationsS.kurz, n.round.durationsS.mittel, n.round.durationsS.lang].sort((x, y) => x - y) },
  };
}
