// src/net/roomCode.ts – Raumcode (B4): 6 Zeichen ohne verwechselbare Zeichen (0/O, 1/I/L), Link `?raum=ABC123`.
// Das Format ist Teil des Protokolls (keine Spielzahl). Keine DOM-Abhängigkeit: URL-Teile kommen als String.
import type { Rng } from '../core/random';

/** 31 Zeichen: A–Z ohne I, L, O; 2–9 ohne 0, 1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
/** Name des URL-Parameters */
export const ROOM_PARAM = 'raum';

/** Zufallsquelle: seedbarer `Rng` (Tests) oder eine Funktion, die [0, 1) liefert (z. B. aus crypto.getRandomValues). */
export type RandomSource = Pick<Rng, 'next'> | (() => number);

/** Neuer Raumcode. */
export function generateRoomCode(rnd: RandomSource): string {
  const next = typeof rnd === 'function' ? rnd : () => rnd.next();
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const r = next();
    out += ROOM_CODE_ALPHABET[Math.min(ROOM_CODE_ALPHABET.length - 1, Math.floor(r * ROOM_CODE_ALPHABET.length))];
  }
  return out;
}

/**
 * Nutzereingabe → gültiger Code oder null. Großschreibung, Leerzeichen/Bindestriche weg. Verwechselbare Zeichen
 * (0, O, 1, I, L) kommen im Alphabet nicht vor und werden abgelehnt – lieber ablehnen als raten.
 */
export function normalizeRoomCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of s) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return s;
}

export const isRoomCode = (s: string): boolean => normalizeRoomCode(s) === s;

/** `?raum=ABC123` (oder ganze URL / `location.search`) → Code oder null. */
export function parseRoomParam(searchOrUrl: string): string | null {
  const q = searchOrUrl.includes('?') ? searchOrUrl.slice(searchOrUrl.indexOf('?') + 1) : searchOrUrl;
  const query = q.split('#')[0] ?? '';
  const params = new URLSearchParams(query);
  const v = params.get(ROOM_PARAM);
  return v === null ? null : normalizeRoomCode(v);
}

/** Einladungslink: Basis-URL (ohne Query) + `?raum=CODE`. */
export function roomLink(baseUrl: string, code: string): string {
  const c = normalizeRoomCode(code);
  if (!c) throw new Error(`ungültiger Raumcode: ${code}`);
  const base = baseUrl.split('#')[0]?.split('?')[0] ?? baseUrl;
  return `${base}?${ROOM_PARAM}=${c}`;
}

/** Realtime-Kanalname (B4): `raum:<CODE>`. */
export const roomChannel = (code: string): string => `raum:${code}`;
