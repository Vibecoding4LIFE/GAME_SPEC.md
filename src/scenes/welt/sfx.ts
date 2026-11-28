// Ton-Hooks für den audio-designer (Phase 1 hat noch keinen Ton): Die Welt-Szene meldet hier alle Klang-Anlässe.
// Ein späteres src/audio/ abonniert z. B. `sfx.on('pling', …)`. Entsperrt wird Audio über das Fenster-Ereignis
// `ctd:unlock` (erster Tipp im Ladebildschirm).
import { EventBus } from '../../core/events';

export interface SfxEvents extends Record<string, unknown> {
  cast: { perfect: boolean };
  /** perfekter Wurf (D 1.3) */
  pling: Record<string, never>;
  nibble: Record<string, never>;
  fakeBite: Record<string, never>;
  bite: Record<string, never>;
  telegraph: { action: string };
  /** Aufbläher wird rund (D 1.7 „Quietsch-Sound“) */
  squeak: Record<string, never>;
  /** 10× je s im Drill: Schnur-Ton (Tonhöhe nach Spannung), Rollen-Surren beim Kurbeln */
  lineTension: { tension: number; reeling: boolean };
  catch: { shiny: boolean };
  lineBreak: Record<string, never>;
}

export const sfx = new EventBus<SfxEvents>();
