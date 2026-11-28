// src/net/supabaseEnv.ts – Supabase-Werte aus import.meta.env (ohne die Bibliothek zu laden).
export interface SupabaseEnv { url: string; key: string; privateChannels: boolean }

/** Werte aus import.meta.env (Vite ersetzt sie beim Bauen). */
export function supabaseEnv(): SupabaseEnv | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Private Kanäle brauchen die RLS-Regeln aus supabase/migrations (Realtime-Autorisierung); bis sie angewendet
  // sind, bleibt der Kanal öffentlich (Risiko in docs/qa/phase-2-fruehtests.md).
  return { url, key, privateChannels: env.VITE_SUPABASE_PRIVATE === '1' };
}

