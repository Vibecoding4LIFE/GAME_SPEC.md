// src/net/supabase.ts – Supabase-Client und anonyme Anmeldung (B4). Läuft nur im Browser.
// URL und Publishable Key kommen aus `.env.local` (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, nie im Repo).
// Ein Service-Role-Key gehört NIE hierher. Die Bibliothek wird erst beim ersten Mehrspieler-Aufruf geladen
// (dynamischer Import), damit „Allein angeln“ nichts davon herunterlädt.
// API geprüft an @supabase/supabase-js 2.119.0 (node_modules, Typen von auth-js/realtime-js).
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseEnv } from './supabaseEnv';

export { supabaseEnv, type SupabaseEnv } from './supabaseEnv';

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  const env = supabaseEnv();
  if (!env) return Promise.reject(new Error('Supabase nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen)'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(env.url, env.key, { auth: { persistSession: true, autoRefreshToken: true } }));
  return clientPromise;
}

export type AuthResult =
  | { ok: true; userId: string; anonymous: boolean }
  | { ok: false; code: 'nichtKonfiguriert' | 'anonymAus' | 'netz' | 'unbekannt'; detail: string };

/**
 * Anmeldung beim ersten Start: vorhandene Sitzung weiterverwenden (gleiche User-ID nach Neuladen = Reconnect, B4),
 * sonst `signInAnonymously()`. Fehlercode `anonymous_provider_disabled` → im Dashboard einschalten.
 */
export async function ensureUser(): Promise<AuthResult> {
  if (!supabaseEnv()) return { ok: false, code: 'nichtKonfiguriert', detail: 'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY fehlen' };
  try {
    const sb = await getSupabase();
    const { data: s } = await sb.auth.getSession();
    if (s.session?.user) return { ok: true, userId: s.session.user.id, anonymous: s.session.user.is_anonymous ?? false };
    const { data, error } = await sb.auth.signInAnonymously();
    if (error || !data.user) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'anonymous_provider_disabled') return { ok: false, code: 'anonymAus', detail: error?.message ?? code };
      if (error && (error.status === 0 || /fetch|network/i.test(error.message))) return { ok: false, code: 'netz', detail: error.message };
      return { ok: false, code: 'unbekannt', detail: error?.message ?? 'kein Nutzer' };
    }
    return { ok: true, userId: data.user.id, anonymous: data.user.is_anonymous ?? true };
  } catch (e) {
    return { ok: false, code: 'netz', detail: e instanceof Error ? e.message : String(e) };
  }
}
