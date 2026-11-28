// src/game/drill.ts – Spannungsbalken-Minispiel (D 1.6) mit allen 13 Verhaltensarten (D 1.7).
// Alle Zahlen aus balancing.json (`drill.*`). Spannung T, Zonen und Schwellen sind Anteile 0…1
// (Anzeige × `drill.tensionScale`). Die Formeln aus D 1.6 rechnen in Prozent pro Sekunde, daher / tensionScale.
//
// API: createDrill(fish, gear, balancing, rng, opts) und stepDrill(state, input, dt) → { state, events }.
// Der Zustand wird aus Geschwindigkeitsgründen (Bot-Simulationen) an Ort und Stelle fortgeschrieben.
import type { Balancing } from '../data/balancing';
import type { Rng } from '../core/random';
import type { BossPhase, FightBehavior, FishData, WorldId } from '../data/types';
import { clamp, lineProtects, rodAbilityValue, type ActiveWeather, type Loadout } from './types';

export type PullDir = 'left' | 'right' | 'down';

/** Aktionen mit Vorwarnung (Telegraph), die die Szene darstellt. */
export const DRILL_ACTIONS = [
  'spike', 'sprint', 'dive', 'jump', 'zigzag', 'fake', 'flee', 'cover', 'inflate', 'shock', 'invisible',
] as const;
export type DrillAction = (typeof DRILL_ACTIONS)[number];

export type DrillOutcome = 'caught' | 'lineBreak' | 'heatBreak' | 'unhooked' | 'jumpShake';

/**
 * Eingabe je Zeitschritt (passt zu src/ui/input.ts):
 * `reel` = Kurbel gehalten (reelStart/reelStop), `steer` = −1…+1 (zählt nur das Vorzeichen),
 * `rodUp` = „Rute hochreißen“ in diesem Schritt (Flanke, W/Wisch hoch), `tap` = Kurbel in diesem Schritt neu gedrückt (Flanke).
 */
export interface DrillInput {
  reel: boolean;
  steer: number;
  rodUp: boolean;
  tap: boolean;
}

export const NO_DRILL_INPUT: DrillInput = Object.freeze({ reel: false, steer: 0, rodUp: false, tap: false });

export interface DrillOptions {
  /** Größenwurf x (0…1) für die Ausdauer */
  sizeX: number;
  perfectStrike?: boolean;
  weather?: ActiveWeather;
  depthM?: number;
  world?: WorldId;
  /** Debug: Verhalten erzwingen */
  forceBehavior?: FightBehavior | null;
  /** Anfängerschutz: so viele Schnurrisse werden zur Warnung (D 2.5) */
  beginnerSaves?: number;
  /** Kescher: so viele Ausschlitzer werden gerettet (Zubehör `KescherRettung`) */
  netSaves?: number;
}

type StageKind = DrillAction | 'rest' | 'telegraph' | 'exhaust' | 'snag';
/** Abschnitt: `total` = Gesamtdauer (für Vorwarn-Animationen), `dir` = Zugrichtung der (kommenden) Aktion. */
export interface Stage { kind: StageKind; left: number; total: number; next?: DrillAction; dir?: PullDir }

export type DrillGear = Pick<Loadout, 'rod' | 'line' | 'leader' | 'reel'>;

export interface DrillState {
  readonly fish: FishData;
  readonly gear: DrillGear;
  readonly b: Balancing;
  readonly rng: Rng;
  readonly opts: DrillOptions;
  elapsedS: number;
  /** Spannung 0…1 */
  tension: number;
  /** Distanz Fisch → Boot (Start `drill.distance.start`, gelandet bei 0) */
  distance: number;
  stamina: number;
  staminaMax: number;
  /** angezeigte Ausdauer (Trickser täuscht Müdigkeit vor) */
  displayStamina: number;
  exhausted: boolean;
  behavior: FightBehavior;
  /** Index der Bossphase oder −1 */
  bossPhase: number;
  strength: number;
  pullDir: PullDir;
  zone: { lo: number; hi: number };
  stage: Stage;
  queue: Stage[];
  actionCount: number;
  /** Stromer: Steuerung vertauscht */
  inverted: boolean;
  /** Blinker: Fisch und Pfeil unsichtbar; Sichtbarkeit 0…1 (Laternenrute: halb sichtbar) */
  invisible: boolean;
  visibility: number;
  /** Rute in diesem Tauchgang hochgerissen */
  rodUpArmed: boolean;
  /** Trickser: Spannungsspitze zu Fluchtbeginn → Riss im nächsten Prüfschritt */
  snapPending: boolean;
  countering: boolean;
  cover: { away: number; countered: number } | null;
  snag: { count: number; needed: number; sinceTap: number } | null;
  heat: number;
  breakTimer: number;
  unhookTimer: number;
  /** nie rot, nie unter der Ausschlitz-Grenze → Meisterdrill */
  masterDrill: boolean;
  beginnerSaves: number;
  netSaves: number;
  outcome: DrillOutcome | null;
}

export type DrillEvent =
  | { type: 'telegraph'; action: DrillAction; inS: number; dir?: PullDir }
  | { type: 'action'; action: DrillAction; durationS: number; dir: PullDir }
  | { type: 'actionEnd'; action: DrillAction }
  | { type: 'spike'; amount: number }
  | { type: 'dirChange'; dir: PullDir }
  | { type: 'snag'; tapsNeeded: number }
  | { type: 'tap'; ok: boolean; count: number; needed: number }
  | { type: 'snagFreed' }
  | { type: 'exhausted' }
  | { type: 'behaviorChange'; behavior: FightBehavior }
  | { type: 'bossPhase'; phase: number; nameKey: string; telegraphKey: string }
  | { type: 'beginnerSave' }
  | { type: 'netSave' }
  | { type: 'end'; outcome: DrillOutcome };

// ------------------------------------------------------------------ reine Formeln

/**
 * Ausdauer in s effektiver Drillzeit: Seltenheit × `drill.stamina.scale` × Größenfaktor (Bosse: 45…70 nach x, × scale),
 * Brocken × staminaMultiplier.
 */
export function drillStaminaS(fish: FishData, sizeX: number, b: Balancing, behaviors: readonly FightBehavior[] = []): number {
  const st = b.drill.stamina;
  if (fish.staminaOverrideS >= 0) return fish.staminaOverrideS;
  let s = st.scale * (fish.rarity === 'Legendaer'
    ? st.baseS.Legendaer + sizeX * (st.legendaerMaxS - st.baseS.Legendaer)
    : st.baseS[fish.rarity] * (st.sizeFactorMin + sizeX * (st.sizeFactorMax - st.sizeFactorMin)));
  if (behaviors.includes('Brocken')) s *= b.drill.behavior.Brocken.staminaMultiplier;
  return s;
}

/** Grüne Zone (D 1.6): Breite = Flex − K × Strafe (≥ Mindestbreite), × Fisch-Modifikator, × Kälte, × erschöpft. */
export function greenZone(p: {
  b: Balancing; flex: number; strength: number; zoneModifier: number; coldFactor: number; exhausted: boolean; brocken: boolean;
}): { lo: number; hi: number } {
  const z = p.b.drill.zone;
  let w = Math.max(z.minWidth, p.flex - p.strength * z.strengthPenalty) * (1 + p.zoneModifier) * p.coldFactor;
  if (p.exhausted) w *= p.b.drill.exhausted.zoneMultiplier;
  const center = z.center + (p.brocken ? p.b.drill.behavior.Brocken.zoneOffset : 0);
  const lo = clamp(center - w / 2, p.b.drill.unhook.tension, z.redFrom);
  const hi = clamp(center + w / 2, lo, z.redFrom);
  return { lo, hi };
}

/** Kältefaktor auf die Zonenbreite (Schnee/Schneesturm ohne Kälteschutz und ohne `KaelteImmun`). */
export function coldFactor(gear: DrillGear, weather: ActiveWeather | undefined, world: WorldId | undefined, b: Balancing): number {
  if (!weather) return 1;
  const f = b.drill.cold[weather];
  if (f === undefined || lineProtects(gear, 'Kaelte')) return 1;
  if (world && rodAbilityValue(gear.rod, 'KaelteImmun', world) !== null) return 1;
  return f;
}

/** Reserve vor dem Schnurriss: `drill.break.baseS` + Schnur (+ Vorfach); ohne Druckschutz ab `pressure.fromM` nur baseS. */
export function breakDelayS(gear: DrillGear, depthM: number, b: Balancing): number {
  const reserve = gear.line.breakReserveS + (gear.leader?.breakReserveS ?? 0);
  const crushed = depthM >= b.drill.pressure.fromM && !lineProtects(gear, 'Druck');
  return b.drill.break.baseS + (crushed ? 0 : reserve);
}

const sideOf = (rng: Rng): PullDir => (rng.next() < 1 / 2 ? 'left' : 'right');
const flip = (d: PullDir): PullDir => (d === 'left' ? 'right' : 'left');

function bossPhaseIndex(phases: readonly BossPhase[], frac: number): number {
  if (phases.length === 0) return -1;
  const i = phases.findIndex((p) => frac <= p.hpFrom && frac > p.hpTo);
  return i >= 0 ? i : phases.length - 1;
}

/** Aktuelles Verhalten nach Ausdauer: Bossphase, sonst Haupt- → Zweitverhalten bei `secondaryAtStamina`. */
function currentBehavior(s: DrillState): { behavior: FightBehavior; phase: number; strength: number } {
  const { fish } = s;
  const frac = s.staminaMax > 0 ? s.stamina / s.staminaMax : 0;
  if (s.opts.forceBehavior) return { behavior: s.opts.forceBehavior, phase: -1, strength: fish.strength };
  if (fish.bossPhases.length > 0) {
    const i = bossPhaseIndex(fish.bossPhases, frac);
    const p = fish.bossPhases[i] as BossPhase;
    const list = p.behaviors.length > 0 ? p.behaviors : [fish.primaryBehavior];
    return { behavior: list[s.actionCount % list.length] as FightBehavior, phase: i, strength: p.strength };
  }
  if (fish.hasSecondaryBehavior && fish.secondaryBehavior && frac <= fish.secondaryAtStamina) {
    return { behavior: fish.secondaryBehavior, phase: -1, strength: fish.strength };
  }
  return { behavior: fish.primaryBehavior, phase: -1, strength: fish.strength };
}

// ------------------------------------------------------------------ Aktionsplanung

/** Pause bis zur nächsten Aktion; ∞ für Verhalten ohne Aktionen und für erschöpfte Fische. */
function restS(s: DrillState): number {
  if (s.exhausted) return Infinity;
  const B = s.b.drill.behavior;
  const r = s.rng;
  switch (s.behavior) {
    case 'Ruhig': case 'Brocken': case 'Hitzkopf': return Infinity;
    case 'Zappler': return Math.max(0, r.range(B.Zappler.intervalMinS, B.Zappler.intervalMaxS) - B.Zappler.telegraphS);
    case 'Sprinter': return Math.max(0, r.range(B.Sprinter.intervalMinS, B.Sprinter.intervalMaxS) - B.Sprinter.telegraphS);
    case 'Taucher': return Math.max(0, r.range(B.Taucher.intervalMinS, B.Taucher.intervalMaxS) - B.Taucher.telegraphS);
    case 'Springer': return Math.max(0, r.range(B.Springer.intervalMinS, B.Springer.intervalMaxS) - B.Springer.telegraphS);
    case 'Zickzack': return Math.max(0, r.range(B.Zickzack.intervalMinS, B.Zickzack.intervalMaxS) - B.Zickzack.telegraphS);
    case 'Trickser': return r.range(B.Trickser.intervalMinS, B.Trickser.intervalMaxS);
    case 'Versteckspieler': return Math.max(0, r.range(B.Versteckspieler.intervalMinS, B.Versteckspieler.intervalMaxS) - B.Versteckspieler.telegraphS);
    case 'Aufblaeher': return Math.max(0, r.range(B.Aufblaeher.intervalMinS, B.Aufblaeher.intervalMaxS) - B.Aufblaeher.telegraphS);
    case 'Stromer': return Math.max(0, r.range(B.Stromer.intervalMinS, B.Stromer.intervalMaxS) - B.Stromer.telegraphS);
    case 'Blinker': return Math.max(0, r.range(B.Blinker.intervalMinS, B.Blinker.intervalMaxS) - B.Blinker.telegraphS);
  }
}

/**
 * Erste Pause nach Drill-Beginn bzw. Verhaltenswechsel: höchstens `firstActionMaxS` bis zur ersten Aktion
 * (Vorwarnung eingeschlossen), damit jedes Verhalten in jedem Drill erlebbar ist. Ruhig/Brocken/Hitzkopf: keine Aktion.
 */
function firstRestS(s: DrillState): number {
  const rest = restS(s);
  const cfg = firstActionCfg(s);
  if (!Number.isFinite(rest) || !cfg) return rest;
  return Math.min(rest, Math.max(0, cfg.maxS - cfg.leadS));
}

/** `firstActionMaxS` und Vorlauf (Vorwarnung; Trickser beginnt mit der Schein-Müdigkeit ohne Vorwarnung). */
function firstActionCfg(s: DrillState): { maxS: number; leadS: number } | null {
  const B = s.b.drill.behavior;
  switch (s.behavior) {
    case 'Zappler': return { maxS: B.Zappler.firstActionMaxS, leadS: B.Zappler.telegraphS };
    case 'Sprinter': return { maxS: B.Sprinter.firstActionMaxS, leadS: B.Sprinter.telegraphS };
    case 'Taucher': return { maxS: B.Taucher.firstActionMaxS, leadS: B.Taucher.telegraphS };
    case 'Springer': return { maxS: B.Springer.firstActionMaxS, leadS: B.Springer.telegraphS };
    case 'Zickzack': return { maxS: B.Zickzack.firstActionMaxS, leadS: B.Zickzack.telegraphS };
    case 'Trickser': return { maxS: B.Trickser.firstActionMaxS, leadS: 0 };
    case 'Versteckspieler': return { maxS: B.Versteckspieler.firstActionMaxS, leadS: B.Versteckspieler.telegraphS };
    case 'Aufblaeher': return { maxS: B.Aufblaeher.firstActionMaxS, leadS: B.Aufblaeher.telegraphS };
    case 'Stromer': return { maxS: B.Stromer.firstActionMaxS, leadS: B.Stromer.telegraphS };
    case 'Blinker': return { maxS: B.Blinker.firstActionMaxS, leadS: B.Blinker.telegraphS };
    default: return null;
  }
}

/** Abschnitte einer Aktion (Telegraph → Aktion → ggf. Erschöpfung). */
function planAction(s: DrillState): Stage[] {
  const B = s.b.drill.behavior;
  const r = s.rng;
  const st = (kind: StageKind, left: number, dir?: PullDir): Stage => ({ kind, left, total: left, ...(dir ? { dir } : {}) });
  const tg = (inS: number, next: DrillAction, dir?: PullDir): Stage => ({ kind: 'telegraph', left: inS, total: inS, next, ...(dir ? { dir } : {}) });
  switch (s.behavior) {
    case 'Zappler': return [tg(B.Zappler.telegraphS, 'spike'), st('spike', 0)];
    case 'Sprinter': { const d = sideOf(r); return [tg(B.Sprinter.telegraphS, 'sprint', d), st('sprint', r.range(B.Sprinter.durationMinS, B.Sprinter.durationMaxS), d)]; }
    case 'Taucher': return [tg(B.Taucher.telegraphS, 'dive', 'down'), st('dive', r.range(B.Taucher.durationMinS, B.Taucher.durationMaxS), 'down')];
    case 'Springer': return [tg(B.Springer.telegraphS, 'jump'), st('jump', B.Springer.jumpMaxS), st('exhaust', B.Springer.exhaustS)];
    case 'Zickzack': return [tg(B.Zickzack.telegraphS, 'zigzag'), st('zigzag', 0)];
    case 'Trickser': { const d = sideOf(r); return [st('fake', r.range(B.Trickser.fakeTiredMinS, B.Trickser.fakeTiredMaxS)), tg(B.Trickser.telegraphS, 'flee', d), st('flee', B.Trickser.fleeS, d)]; }
    case 'Versteckspieler': { const d = sideOf(r); return [tg(B.Versteckspieler.telegraphS, 'cover', d), st('cover', Infinity, d)]; }
    case 'Aufblaeher': return [tg(B.Aufblaeher.telegraphS, 'inflate'), st('inflate', B.Aufblaeher.durationS), st('exhaust', B.Aufblaeher.exhaustS)];
    case 'Stromer': return [tg(B.Stromer.telegraphS, 'shock'), st('shock', B.Stromer.invertS)];
    case 'Blinker': { const d = sideOf(r); return [tg(B.Blinker.telegraphS, 'invisible', d), st('invisible', r.range(B.Blinker.invisibleMinS, B.Blinker.invisibleMaxS), d)]; }
    default: return [];
  }
}

const isAction = (k: StageKind): k is DrillAction => (DRILL_ACTIONS as readonly string[]).includes(k);

/** Abschnitt beginnt: Zustand setzen und Ereignis melden. */
function enterStage(s: DrillState, st: Stage, ev: DrillEvent[]): void {
  s.stage = st;
  const B = s.b.drill.behavior;
  if (st.kind === 'telegraph' && st.next) {
    if (st.next === 'dive') s.rodUpArmed = false;
    ev.push({ type: 'telegraph', action: st.next, inS: st.left, ...(st.dir ? { dir: st.dir } : {}) });
    return;
  }
  if (!isAction(st.kind)) return;
  switch (st.kind) {
    case 'spike': {
      const amount = s.rng.range(B.Zappler.spikeMin, B.Zappler.spikeMax);
      s.tension = clamp(s.tension + amount, 0, 1);
      ev.push({ type: 'spike', amount });
      break;
    }
    case 'sprint': case 'cover': s.pullDir = st.dir ?? sideOf(s.rng); break;
    case 'flee':
      s.pullDir = st.dir ?? sideOf(s.rng);
      // „nicht gierig werden“: wer zu Fluchtbeginn noch Spannung hält, verliert die Schnur (D 1.7, QA M-2)
      if (s.tension > B.Trickser.fleeTensionLimit) s.snapPending = true;
      break;
    case 'dive': s.pullDir = 'down'; break;
    case 'zigzag': s.pullDir = s.pullDir === 'down' ? sideOf(s.rng) : flip(s.pullDir); ev.push({ type: 'dirChange', dir: s.pullDir }); break;
    case 'shock': s.inverted = true; break;
    case 'invisible': {
      s.invisible = true;
      const half = s.opts.world ? rodAbilityValue(s.gear.rod, 'BlinkerHalbSichtbar', s.opts.world) : null;
      s.visibility = half ?? 0;
      s.pullDir = st.dir ?? sideOf(s.rng);
      break;
    }
    default: break;
  }
  if (st.kind === 'cover') s.cover = { away: 0, countered: 0 };
  ev.push({ type: 'action', action: st.kind, durationS: Number.isFinite(st.left) ? st.left : -1, dir: s.pullDir });
}

/** Abschnitt endet: Zustand zurücksetzen. */
function leaveStage(s: DrillState, ev: DrillEvent[]): void {
  const k = s.stage.kind;
  if (k === 'dive') s.pullDir = sideOf(s.rng);
  if (k === 'shock') s.inverted = false;
  if (k === 'invisible') { s.invisible = false; s.visibility = 1; }
  if (k === 'cover') s.cover = null;
  if (isAction(k)) ev.push({ type: 'actionEnd', action: k });
}

/** Nächsten Abschnitt aus der Warteschlange oder eine neue Pause. */
function advance(s: DrillState, ev: DrillEvent[]): void {
  leaveStage(s, ev);
  const next = s.queue.shift();
  if (next) { enterStage(s, next, ev); return; }
  if (s.stage.kind !== 'rest') { s.stage = { kind: 'rest', left: restS(s), total: 0 }; return; }
  // Pause vorbei → neue Aktion planen
  s.queue = planAction(s);
  s.actionCount++;
  const first = s.queue.shift();
  if (first) enterStage(s, first, ev);
  else s.stage = { kind: 'rest', left: Infinity, total: 0 };
}

// ------------------------------------------------------------------ Erzeugen & Schritt

export function createDrill(fish: FishData, gear: DrillGear, b: Balancing, rng: Rng, opts: DrillOptions): DrillState {
  const behaviors = opts.forceBehavior
    ? [opts.forceBehavior]
    : [fish.primaryBehavior, ...(fish.secondaryBehavior ? [fish.secondaryBehavior] : [])];
  const max = drillStaminaS(fish, opts.sizeX, b, behaviors);
  const start = max * (opts.perfectStrike ? 1 - b.bite.perfect.staminaReduction : 1);
  const s: DrillState = {
    fish, gear, b, rng, opts,
    elapsedS: 0, tension: 0, distance: b.drill.distance.start,
    stamina: start, staminaMax: max, displayStamina: start, exhausted: false,
    behavior: fish.primaryBehavior, bossPhase: -1, strength: fish.strength,
    pullDir: sideOf(rng), zone: { lo: 0, hi: 0 },
    stage: { kind: 'rest', left: 0, total: 0 }, queue: [], actionCount: 0,
    inverted: false, invisible: false, visibility: 1, rodUpArmed: false, snapPending: false, countering: false,
    cover: null, snag: null, heat: 0, breakTimer: 0, unhookTimer: 0, masterDrill: true,
    beginnerSaves: opts.beginnerSaves ?? 0, netSaves: opts.netSaves ?? 0, outcome: null,
  };
  const cb = currentBehavior(s);
  s.behavior = cb.behavior;
  s.bossPhase = cb.phase;
  s.strength = cb.strength;
  updateZone(s);
  s.tension = (s.zone.lo + s.zone.hi) / 2;
  s.stage = { kind: 'rest', left: firstRestS(s), total: 0 };
  return s;
}

function updateZone(s: DrillState): void {
  const exhaustedNow = s.exhausted || s.stage.kind === 'exhaust';
  s.zone = greenZone({
    b: s.b, flex: s.gear.rod.flexGreenZone, strength: s.strength, zoneModifier: s.fish.greenZoneModifier,
    coldFactor: coldFactor(s.gear, s.opts.weather, s.opts.world, s.b), exhausted: exhaustedNow, brocken: s.behavior === 'Brocken',
  });
}

/** Zugmuster-Faktor des aktuellen Abschnitts (× patternBase). */
function patternFactor(s: DrillState): number {
  const B = s.b.drill.behavior;
  const k = s.stage.kind;
  if (k === 'jump' || s.snag) return 0;
  let m = s.b.drill.patternBase;
  if (s.behavior === 'Ruhig') m *= B.Ruhig.pull;
  if (s.behavior === 'Brocken') m *= 1 + B.Brocken.pullBonus;
  if (k === 'sprint') m *= 1 + B.Sprinter.pullBonus;
  if (k === 'dive') m *= 1 + B.Taucher.pullBonus;
  if (k === 'flee') m *= 1 + B.Trickser.fleePullBonus;
  if (k === 'inflate') m *= B.Aufblaeher.pullMultiplier;
  if (k === 'fake' || k === 'exhaust' || s.exhausted) m *= s.b.drill.exhausted.pullFactor;
  return m;
}

function end(s: DrillState, outcome: DrillOutcome, ev: DrillEvent[]): void {
  s.outcome = outcome;
  ev.push({ type: 'end', outcome });
}

/** Ein Zeitschritt des Drills. */
export function stepDrill(s: DrillState, input: DrillInput, dt: number): { state: DrillState; events: DrillEvent[] } {
  const ev: DrillEvent[] = [];
  if (s.outcome) return { state: s, events: ev };
  const { b } = s;
  const D = b.drill;
  const scale = D.tensionScale;
  s.elapsedS += dt;

  // 1) Verhalten / Bossphase nach Ausdauer
  const cb = currentBehavior(s);
  if (cb.phase !== s.bossPhase && cb.phase >= 0) {
    const p = s.fish.bossPhases[cb.phase] as BossPhase;
    ev.push({ type: 'bossPhase', phase: cb.phase, nameKey: p.nameKey, telegraphKey: p.telegraphKey });
  }
  if (cb.behavior !== s.behavior && s.stage.kind === 'rest') {
    s.behavior = cb.behavior;
    ev.push({ type: 'behaviorChange', behavior: cb.behavior });
    s.stage = { kind: 'rest', left: firstRestS(s), total: 0 };
  }
  s.bossPhase = cb.phase;
  s.strength = cb.strength;

  // 2) Abschnitte fortschalten (Deckung und Hänger enden durch Logik, nicht durch Zeit)
  s.stage.left -= dt;
  let guard = 0;
  while (s.stage.left <= 0 && guard++ < DRILL_ACTIONS.length * 2) advance(s, ev);

  // 3) Rutenführung / Konter
  const sign = Math.sign(input.steer) * (s.inverted ? -1 : 1);
  if (input.rodUp && (s.stage.kind === 'dive' || (s.stage.kind === 'telegraph' && s.stage.next === 'dive'))) s.rodUpArmed = true;
  if (s.pullDir === 'down') s.countering = s.rodUpArmed || input.rodUp;
  else s.countering = (s.pullDir === 'left' && sign > 0) || (s.pullDir === 'right' && sign < 0);
  let counter = s.gear.rod.counterBonus;
  if (s.pullDir === 'down' && s.opts.world) counter += rodAbilityValue(s.gear.rod, 'TaucherKonter', s.opts.world) ?? 0;
  const counterF = s.countering ? 1 - clamp(counter, 0, 1) : 1;

  // 4) Spannung
  const pull = (s.strength * patternFactor(s) * counterF * D.fishPullFactor) / scale;
  const own = input.reel ? (s.gear.reel.crankPower * D.crankFactor) / scale : -(s.gear.rod.relief * D.reliefFactor) / scale;
  // Unbeantwortete Aktion (D 1.7, QA M-2): Sprinter ohne Gegenhalten, Taucher ohne Hochreißen, Stromer ohne
  // (umgekehrtes) Gegensteuern → die Spannung steigt zusätzlich, schneller als die Rute entlasten kann
  const B = D.behavior;
  const sk = s.stage.kind;
  const unanswered = s.countering ? 0
    : sk === 'sprint' ? B.Sprinter.unansweredTensionPerS
    : sk === 'dive' ? B.Taucher.unansweredTensionPerS
    : sk === 'shock' ? B.Stromer.unansweredTensionPerS : 0;
  s.tension = clamp(s.tension + (own + pull + unanswered) * dt, 0, D.break.tension);
  updateZone(s);
  const { lo, hi } = s.zone;
  const inZone = s.tension >= lo && s.tension <= hi;

  // 5) Distanz
  const k = s.stage.kind;
  if (k === 'sprint' || k === 'dive' || k === 'flee') {
    const f = k === 'dive' ? D.behavior.Taucher.distanceFactor : 1;
    s.distance += D.distance.fleePerS * f * counterF * dt;
  } else if (k !== 'jump' && !s.snag) {
    const share = inZone ? 1 : s.tension < lo ? D.progress.belowZone : D.progress.aboveZone;
    const infl = k === 'inflate' ? D.behavior.Aufblaeher.retrieveMultiplier : 1;
    s.distance -= s.gear.reel.retrieveSpeed * D.distance.retrievePerS * share * infl * dt;
  }
  s.distance = Math.min(D.distance.max, s.distance);
  if (s.stamina > 0) s.distance = Math.max(D.distance.minWhileFresh, s.distance);

  // 6) Ausdauer
  if (s.tension >= lo && k !== 'jump' && !s.snag && s.stamina > 0) {
    let drain = dt * (s.countering ? D.stamina.counterMultiplier : 1);
    if (k === 'exhaust' && s.behavior === 'Springer') drain *= D.behavior.Springer.exhaustStaminaMultiplier;
    s.stamina = Math.max(0, s.stamina - drain);
    if (s.stamina <= 0 && !s.exhausted) {
      s.exhausted = true;
      ev.push({ type: 'exhausted' });
      if (s.stage.kind === 'rest') s.stage.left = Infinity;
    }
  }
  s.displayStamina = k === 'fake' && s.stage.left > 0 && Number.isFinite(s.stage.left)
    ? Math.min(s.displayStamina, s.stamina) * Math.max(0, 1 - dt / (s.stage.left + dt))
    : s.stamina;

  // 7) Versteckspieler: Deckung erreicht → Hänger
  if (s.cover && k === 'cover') {
    if (s.countering) s.cover.countered += dt;
    else s.cover.away += dt;
    const reach = D.behavior.Versteckspieler.coverReachS;
    if (s.cover.away >= reach) {
      const needed = (s.opts.world ? rodAbilityValue(s.gear.rod, 'HaengerLeicht', s.opts.world) : null) ?? D.behavior.Versteckspieler.haengerTaps;
      leaveStage(s, ev);
      s.snag = { count: 0, needed, sinceTap: 0 };
      s.stage = { kind: 'snag', left: Infinity, total: 0 };
      ev.push({ type: 'snag', tapsNeeded: needed });
    } else if (s.cover.countered >= reach) {
      advance(s, ev);
    }
  }

  // 8) Hänger lösen: n× im Takt tippen
  if (s.snag) {
    s.snag.sinceTap += dt;
    if (input.tap) {
      const V = D.behavior.Versteckspieler;
      const ok = s.snag.count === 0 || Math.abs(s.snag.sinceTap - V.tapIntervalS) <= V.tapToleranceS;
      s.snag.count = ok ? s.snag.count + 1 : 1;
      s.snag.sinceTap = 0;
      ev.push({ type: 'tap', ok, count: s.snag.count, needed: s.snag.needed });
      if (s.snag.count >= s.snag.needed) {
        s.snag = null;
        s.stage = { kind: 'rest', left: restS(s), total: 0 };
        ev.push({ type: 'snagFreed' });
      }
    }
  }

  // 9) Hitzkopf: Hitzeleiste
  if (s.behavior === 'Hitzkopf') {
    const H = D.behavior.Hitzkopf;
    const lineF = s.gear.line.heatMultiplier * (s.gear.leader?.heatMultiplier ?? 1);
    const rodF = (s.opts.world ? rodAbilityValue(s.gear.rod, 'HitzeMinus30', s.opts.world) : null) ?? 1;
    if (s.tension < lo) s.heat = Math.max(0, s.heat - H.coolPerS * dt);
    else s.heat += H.heatPerS * (s.tension > hi ? H.highTensionMultiplier : 1) * lineF * rodF * dt;
    if (s.heat >= H.breakAt) { end(s, 'heatBreak', ev); return { state: s, events: ev }; }
  }

  // 10) Springer: Spannung während des Sprungs zu hoch → Haken abgeschüttelt
  if (k === 'jump' && s.tension > D.behavior.Springer.tensionLimit) { end(s, 'jumpShake', ev); return { state: s, events: ev }; }

  // 11) Meisterdrill
  if (s.tension >= D.zone.redFrom || s.tension < D.unhook.tension) s.masterDrill = false;

  // 12) Schnurriss (aufgebläht hält die Schnur nur bis inflateBreakTension; Trickser-Spitze reißt sofort)
  const breakAt = k === 'inflate' ? Math.min(D.break.tension, B.Aufblaeher.inflateBreakTension) : D.break.tension;
  const snap = s.snapPending;
  s.snapPending = false;
  if (snap || s.tension >= breakAt) {
    s.breakTimer += dt;
    if (snap || s.breakTimer > breakDelayS(s.gear, s.opts.depthM ?? 0, b)) {
      if (s.beginnerSaves > 0) {
        s.beginnerSaves--;
        s.tension = b.catchup.beginner.tensionAfterSave;
        s.breakTimer = 0;
        ev.push({ type: 'beginnerSave' });
      } else { end(s, 'lineBreak', ev); return { state: s, events: ev }; }
    }
  } else s.breakTimer = 0;

  // 13) Ausschlitzen
  if (s.tension < D.unhook.tension) {
    s.unhookTimer += dt;
    if (s.unhookTimer > D.unhook.durationS) {
      if (s.netSaves > 0) {
        s.netSaves--;
        s.unhookTimer = 0;
        s.tension = s.zone.lo;
        ev.push({ type: 'netSave' });
      } else { end(s, 'unhooked', ev); return { state: s, events: ev }; }
    }
  } else s.unhookTimer = 0;

  // 14) Gelandet
  if (s.distance <= 0) { s.distance = 0; end(s, 'caught', ev); }
  return { state: s, events: ev };
}

/** Rutenbiegung 0…3 für die 4 Biegestufen (Anteil der Spannung, gleichmäßig verteilt). */
export const rodBendStage = (tension: number, stages: number): number =>
  Math.min(stages - 1, Math.floor(clamp(tension, 0, 1) * stages));
