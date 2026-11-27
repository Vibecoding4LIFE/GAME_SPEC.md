// src/game/clock.ts – Tageszeit (16-min-Tag, 4 Phasen), Wetterwechsel nach Welt-Wettertabelle, Weltereignisse,
// Blitze und Wettervorhersage (D 1.9, Teil E). Reiner Zustand + step(dt).
import type { Balancing } from '../data/balancing';
import type { Rng } from '../core/random';
import type { WorldEvent } from '../data/types';
import { PENDING_DATA } from './pending';
import { weightedPick } from './spawn';
import { DAY_PHASES, type ActiveWeather, type DayPhase, type WorldDbEntry } from './types';

export interface ForecastEntry { weather: ActiveWeather; atS: number; windDir: -1 | 1 }

export interface ClockState {
  /** Spielzeit seit Tagesbeginn von Tag 0 (Morgen) in s */
  dayTimeS: number;
  weather: ActiveWeather;
  windDir: -1 | 1;
  /** kommende Wetterwechsel (erster = nächster) */
  forecast: ForecastEntry[];
  /** Wetter fixiert (Host / Debug): keine Wechsel */
  weatherFixed: boolean;
  /** aktive Ereignisse mit Ende (Spielzeit) */
  events: { evt: WorldEvent; untilS: number }[];
  /** nächste Prüfung je zufälligem Ereignis */
  nextCheckS: Partial<Record<WorldEvent, number>>;
  /** Debug: Ereignisse erzwingen */
  forcedEvents: WorldEvent[];
  nextLightningS: number;
}

export type ClockEvent =
  | { type: 'phase'; phase: DayPhase; day: number }
  | { type: 'weather'; weather: ActiveWeather; windDir: -1 | 1 }
  | { type: 'eventStart'; evt: WorldEvent }
  | { type: 'eventEnd'; evt: WorldEvent }
  | { type: 'lightning'; revealS: number };

const phaseLen = (b: Balancing) => b.time.phaseLengthS;

/** Tageszeit-Phase zu einer Spielzeit. */
export const phaseAt = (dayTimeS: number, b: Balancing): DayPhase =>
  DAY_PHASES[Math.floor((((dayTimeS % b.time.dayLengthS) + b.time.dayLengthS) % b.time.dayLengthS) / phaseLen(b))] as DayPhase;

/** Tag (0-basiert) zu einer Spielzeit. */
export const dayAt = (dayTimeS: number, b: Balancing): number => Math.floor(dayTimeS / b.time.dayLengthS);

/** Sekunden bis zum nächsten Phasenwechsel. */
export const secondsToNextPhase = (dayTimeS: number, b: Balancing): number => phaseLen(b) - (dayTimeS % phaseLen(b));

/** Wetter würfeln, das zur Tageszeit passt (`nurZeit`, z. B. Morgennebel nur morgens). */
export function rollWeather(world: WorldDbEntry, phase: DayPhase, rng: Rng): ActiveWeather {
  const pool = world.wetter.filter((w) => w.wetter !== 'Alle' && (w.nurZeit === null || w.nurZeit === phase || w.nurZeit === 'Immer'));
  const pick = weightedPick(pool, (w) => w.gewicht, rng);
  if (!pick) throw new Error(`Welt ${world.id}: keine Wettertabelle für ${phase}`);
  return pick.wetter as ActiveWeather;
}

const windOf = (rng: Rng): -1 | 1 => (rng.next() < 1 / 2 ? -1 : 1);

function weatherAllowed(world: WorldDbEntry, w: ActiveWeather, phase: DayPhase): boolean {
  const e = world.wetter.find((x) => x.wetter === w);
  return !e || e.nurZeit === null || e.nurZeit === 'Immer' || e.nurZeit === phase;
}

function fillForecast(c: ClockState, world: WorldDbEntry, b: Balancing, rng: Rng, count: number): void {
  while (c.forecast.length < Math.max(1, count)) {
    const last = c.forecast[c.forecast.length - 1];
    const atS = (last ? last.atS : c.dayTimeS) + rng.range(b.weather.changeMinS, b.weather.changeMaxS);
    c.forecast.push({ weather: rollWeather(world, phaseAt(atS, b), rng), atS, windDir: windOf(rng) });
  }
}

export interface ClockInit {
  world: WorldDbEntry;
  b: Balancing;
  rng: Rng;
  startPhase?: DayPhase;
  startWeather?: ActiveWeather;
  /** Wettervorhersage-Länge (Standard `weather.forecastCount`, Wetterradio mehr) */
  forecastCount?: number;
}

export function createClock({ world, b, rng, startPhase, startWeather, forecastCount }: ClockInit): ClockState {
  const phase = startPhase ?? (rng.pick(DAY_PHASES) as DayPhase);
  const dayTimeS = DAY_PHASES.indexOf(phase) * phaseLen(b);
  const c: ClockState = {
    dayTimeS, weather: startWeather ?? rollWeather(world, phase, rng), windDir: windOf(rng), forecast: [],
    weatherFixed: false, events: [], nextCheckS: {}, forcedEvents: [], nextLightningS: Infinity,
  };
  fillForecast(c, world, b, rng, forecastCount ?? b.weather.forecastCount);
  scheduleLightning(c, b, rng);
  return c;
}

function scheduleLightning(c: ClockState, b: Balancing, rng: Rng): void {
  c.nextLightningS = c.weather === 'Gewitter'
    ? c.dayTimeS + rng.range(b.weather.lightning.intervalMinS, b.weather.lightning.intervalMaxS)
    : Infinity;
}

/** Ist ein Ereignis per Zeitplan aktiv (Vollmond jede n-te Nacht, an Wetter gekoppelte Ereignisse)? */
function scheduledEvents(c: ClockState, world: WorldDbEntry, b: Balancing): WorldEvent[] {
  const out: WorldEvent[] = [];
  const phase = phaseAt(c.dayTimeS, b);
  for (const { ereignis } of world.ereignisse) {
    const cfg = b.event[ereignis as Exclude<WorldEvent, 'Keins'>];
    if (cfg?.everyNthNight !== undefined) {
      if (phase === 'Nacht' && (dayAt(c.dayTimeS, b) + 1) % cfg.everyNthNight === 0) out.push(ereignis);
    }
    const w = PENDING_DATA.eventFromWeather[ereignis];
    if (w && c.weather === w) out.push(ereignis);
  }
  return out;
}

/** Alle aktiven Ereignisse (Zeitplan, Zufall, erzwungen). */
export function activeEvents(c: ClockState, world: WorldDbEntry, b: Balancing): WorldEvent[] {
  const set = new Set<WorldEvent>([...scheduledEvents(c, world, b), ...c.events.map((e) => e.evt), ...c.forcedEvents]);
  return [...set];
}

/** Ein Zeitschritt. Meldet Phasen-, Wetter-, Ereignis- und Blitz-Wechsel. */
export function stepClock(c: ClockState, dt: number, world: WorldDbEntry, b: Balancing, rng: Rng, forecastCount?: number): ClockEvent[] {
  const ev: ClockEvent[] = [];
  const before = activeEvents(c, world, b);
  const oldPhase = phaseAt(c.dayTimeS, b);
  c.dayTimeS += dt;
  const phase = phaseAt(c.dayTimeS, b);
  if (phase !== oldPhase) ev.push({ type: 'phase', phase, day: dayAt(c.dayTimeS, b) });

  // Wetter
  if (!c.weatherFixed) {
    const next = c.forecast[0];
    if (next && c.dayTimeS >= next.atS) {
      c.forecast.shift();
      setWeatherInternal(c, next.weather, next.windDir, b, rng, ev);
      fillForecast(c, world, b, rng, forecastCount ?? b.weather.forecastCount);
    } else if (phase !== oldPhase && !weatherAllowed(world, c.weather, phase)) {
      // z. B. Morgennebel endet mit dem Morgen
      setWeatherInternal(c, rollWeather(world, phase, rng), windOf(rng), b, rng, ev);
      c.forecast = [];
      fillForecast(c, world, b, rng, forecastCount ?? b.weather.forecastCount);
    }
  }

  // Zufällige Ereignisse (chancePerCheck / checkIntervalS / durationS), ggf. nur zu bestimmten Tageszeiten
  c.events = c.events.filter((e) => e.untilS > c.dayTimeS);
  for (const { ereignis } of world.ereignisse) {
    const cfg = b.event[ereignis as Exclude<WorldEvent, 'Keins'>];
    if (cfg?.chancePerCheck === undefined || cfg.checkIntervalS === undefined || cfg.durationS === undefined) continue;
    const times = PENDING_DATA.eventAllowedTimes[ereignis];
    const allowed = !times || times.includes(phase);
    if (!allowed) {
      delete c.nextCheckS[ereignis];
      c.events = c.events.filter((e) => e.evt !== ereignis);
      continue;
    }
    const due = c.nextCheckS[ereignis] ?? c.dayTimeS;
    if (c.dayTimeS >= due) {
      c.nextCheckS[ereignis] = c.dayTimeS + cfg.checkIntervalS;
      if (rng.next() < cfg.chancePerCheck && !c.events.some((e) => e.evt === ereignis)) {
        c.events.push({ evt: ereignis, untilS: c.dayTimeS + cfg.durationS });
      }
    }
  }

  // Blitze
  if (c.dayTimeS >= c.nextLightningS) {
    ev.push({ type: 'lightning', revealS: b.weather.lightning.revealS });
    scheduleLightning(c, b, rng);
  }

  const after = activeEvents(c, world, b);
  for (const e of after) if (!before.includes(e)) ev.push({ type: 'eventStart', evt: e });
  for (const e of before) if (!after.includes(e)) ev.push({ type: 'eventEnd', evt: e });
  return ev;
}

function setWeatherInternal(c: ClockState, w: ActiveWeather, windDir: -1 | 1, b: Balancing, rng: Rng, ev: ClockEvent[]): void {
  const changed = w !== c.weather;
  c.weather = w;
  c.windDir = windDir;
  if (changed) {
    ev.push({ type: 'weather', weather: w, windDir });
    scheduleLightning(c, b, rng);
  }
}

// ------------------------------------------------------------------ Debug / Host

/** Wetter setzen; `fixed` = keine weiteren Wechsel (Host-Einstellung bzw. Debug). */
export function setWeather(c: ClockState, w: ActiveWeather, b: Balancing, rng: Rng, fixed = true): ClockEvent[] {
  const ev: ClockEvent[] = [];
  setWeatherInternal(c, w, c.windDir, b, rng, ev);
  c.weatherFixed = fixed;
  return ev;
}

/** Zum Beginn einer Tageszeit-Phase springen (gleicher Tag, sonst nächster). */
export function setPhase(c: ClockState, phase: DayPhase, b: Balancing): ClockEvent[] {
  const day = dayAt(c.dayTimeS, b);
  c.dayTimeS = day * b.time.dayLengthS + DAY_PHASES.indexOf(phase) * phaseLen(b);
  for (const f of c.forecast) f.atS = Math.max(f.atS, c.dayTimeS);
  return [{ type: 'phase', phase, day }];
}

/** Ereignis erzwingen bzw. freigeben (Debug). */
export function forceEvent(c: ClockState, evt: WorldEvent, on: boolean): void {
  c.forcedEvents = on ? [...new Set([...c.forcedEvents, evt])] : c.forcedEvents.filter((e) => e !== evt);
}
