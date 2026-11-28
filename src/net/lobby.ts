// src/net/lobby.ts – Warteraum (B4, D 2.1): Einstellungen, Teilnehmer, Bereit-Status, Beitrittsregeln. Reine Logik.
import type { GearDb } from '../data/gear';
import type { WorldId } from '../data/types';
import type { LoadoutIds } from '../game/save';
import type { NetConfig } from './config';
import { SUPPORTED_MODES, type EquipmentRule, type LobbySettings, type PlayerId } from './messages';
import { isLocked, type RoundPhase } from './round';

export function defaultSettings(cfg: NetConfig, world: WorldId): LobbySettings {
  return {
    welt: world, modus: 'Wettangeln', dauerS: cfg.round.defaultDurationS, ausruestung: 'Ausgeglichen',
    schabernack: true, tageszeit: 'Zufall', wetter: 'Zufall', teams: 'JederGegenJeden',
  };
}

export type SettingsProblem = 'modus' | 'dauer' | 'welt' | 'teams' | 'gesperrt';

/**
 * Einstellungen ändern (nur Host, nur im Warteraum). Welt muss jemand im Raum freigeschaltet haben (D 2.1);
 * Phase 2 kann nur Wettangeln, jeder gegen jeden.
 */
export function checkSettings(
  next: LobbySettings, phase: RoundPhase, cfg: NetConfig, unlockedWorlds: readonly WorldId[], extraDurationsS: readonly number[] = [],
): SettingsProblem | null {
  if (isLocked(phase)) return 'gesperrt';
  if (!SUPPORTED_MODES.includes(next.modus)) return 'modus';
  if (!cfg.round.durationsS.includes(next.dauerS) && !extraDurationsS.includes(next.dauerS)) return 'dauer';
  if (!unlockedWorlds.includes(next.welt)) return 'welt';
  if (next.teams !== 'JederGegenJeden') return 'teams';
  return null;
}

/** Erlaubte Welten = Vereinigung der Freischaltungen aller Spieler, sortiert. */
export function unlockedUnion(lists: readonly (readonly WorldId[])[]): WorldId[] {
  const s = new Set<WorldId>();
  for (const l of lists) for (const w of l) s.add(w);
  return [...s].sort();
}

export type JoinDecision = 'neu' | 'wieder' | 'gesperrt' | 'voll';

/** Beitritt: bekannte ID kommt immer wieder rein (Reconnect); neue nur im Warteraum und solange Platz ist. */
export function decideJoin(id: PlayerId, known: ReadonlySet<PlayerId>, phase: RoundPhase, playerCount: number, cfg: NetConfig): JoinDecision {
  if (known.has(id)) return 'wieder';
  if (isLocked(phase)) return 'gesperrt';
  if (playerCount >= cfg.room.maxPlayers) return 'voll';
  return 'neu';
}

/** Alle verbundenen Spieler bereit und genug Spieler → Countdown startet automatisch (B4). */
export function allReady(players: readonly { ready: boolean; connected: boolean }[], cfg: NetConfig): boolean {
  const present = players.filter((p) => p.connected);
  return present.length >= Math.max(1, cfg.room.minPlayers) && present.every((p) => p.ready);
}

/** „Bereit (2/3)“ */
export function readyCount(players: readonly { ready: boolean; connected: boolean }[]): { ready: number; total: number } {
  const present = players.filter((p) => p.connected);
  return { ready: present.filter((p) => p.ready).length, total: present.length };
}

/**
 * Ausrüstungsregel (D 2.1). Phase 2 kann davon nur „Eigene“ vollständig:
 *  - „Ausgeglichen“ deckelt die Rute auf `tierCap` (nur Ruten haben eine Stufe in gear.json; Schnur/Rolle/Köder
 *    bleiben). Die Empfehlungsstufe je Welt fehlt noch in den Daten → ohne `tierCap` bleibt die eigene Rute.
 *  - „Leihausrüstung“ braucht ein Leih-Set aus den Daten (`loan`); ohne bleibt die eigene Ausrüstung.
 * Unbekannte IDs (manipulierter Client) werden durch die Startausrüstung (erstes Teil je Liste) ersetzt.
 */
export function applyEquipmentRule(
  rule: EquipmentRule, ids: LoadoutIds, gear: GearDb, opts: { tierCap?: number | null; loan?: LoadoutIds | null } = {},
): LoadoutIds {
  const first = <T extends { id: string }>(l: readonly T[]): string => (l[0] as T).id;
  const has = <T extends { id: string }>(l: readonly T[], id: string | null): boolean => id !== null && l.some((x) => x.id === id);
  const lines = gear.lines.filter((l) => !l.isLeader);
  const clean: LoadoutIds = {
    rod: has(gear.rods, ids.rod) ? ids.rod : first(gear.rods),
    line: has(lines, ids.line) ? ids.line : first(lines),
    leader: ids.leader && gear.lines.some((l) => l.id === ids.leader && l.isLeader) ? ids.leader : null,
    reel: has(gear.reels, ids.reel) ? ids.reel : first(gear.reels),
    bait: has(gear.baits, ids.bait) ? ids.bait : (gear.baits.find((b) => b.infinite) ?? gear.baits[0] as { id: string }).id,
    accessories: ids.accessories.filter((a) => gear.accessories.some((x) => x.id === a)),
  };
  if (rule === 'Leihausruestung' && opts.loan) return { ...opts.loan, accessories: [...opts.loan.accessories] };
  if (rule === 'Ausgeglichen' && typeof opts.tierCap === 'number') {
    const rod = gear.rods.find((r) => r.id === clean.rod);
    if (rod && rod.tier > opts.tierCap) {
      const best = gear.rods.filter((r) => r.tier <= (opts.tierCap as number) && r.source === rod.source)
        .sort((a, b) => b.tier - a.tier)[0] ?? gear.rods.filter((r) => r.tier <= (opts.tierCap as number)).sort((a, b) => b.tier - a.tier)[0];
      if (best) clean.rod = best.id;
    }
  }
  return clean;
}
