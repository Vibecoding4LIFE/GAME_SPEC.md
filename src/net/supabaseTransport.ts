// src/net/supabaseTransport.ts – PLATZHALTER für Teil B (Supabase Realtime). Noch kein Code gegen die Supabase-API:
// `@supabase/supabase-js` ist noch nicht installiert (Teil I Nr. 1: nichts erfinden). Das Projekt existiert;
// URL und Publishable Key kommen in Teil B aus `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
// (.env.local, nicht im Repo). host.ts/client.ts kennen nur das `Transport`-Interface → hier einsetzbar ohne Umbau.
//
// Plan (alles [UNGEPRÜFT], in Teil B in der Doku der installierten Version prüfen):
//  - Kanal `raum:<CODE>` (roomCode.ts `roomChannel`), Broadcast-Event z. B. "m" mit dem Umschlag aus messages.ts.
//  - Broadcast-Option `self: false` (Absender bekommt eigene Nachrichten nicht) – entspricht LocalTransport.
//  - Presence-Schlüssel = Supabase-User-ID (anonyme Anmeldung), Zustand = `PresenceState` aus transport.ts.
//  - Absender-Echtheit: Broadcast-Nutzdaten sind vom Client frei wählbar; `from` muss gegen die Presence/den
//    Auth-Kontext geprüft werden (private Kanäle + RLS auf realtime.messages?) – offene Frage für Teil B.
//  - Wiederverbindung (Handy gesperrt): Kanal neu abonnieren, dann `join` → Host antwortet mit `sync`.
import type { Transport } from './transport';

export interface SupabaseTransportOptions {
  roomCode: string;
  userId: string;
}

export function createSupabaseTransport(_opts: SupabaseTransportOptions): Transport {
  throw new Error('Supabase-Transport folgt in Teil B');
}
