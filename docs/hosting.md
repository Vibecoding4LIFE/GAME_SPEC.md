# Hosting einrichten (einmalig, ca. 5 Minuten, geht auch am Handy)

Empfehlung: **Cloudflare Pages** (kostenlos). Danach baut jeder Push automatisch:
- Hauptbranch `main` → feste Adresse `https://<projektname>.pages.dev`
- jeder andere Branch → eigener Vorschau-Link `https://<branch>.<projektname>.pages.dev`

## Schritte
1. Auf https://dash.cloudflare.com anmelden (kostenloses Konto).
2. **Workers & Pages → Erstellen → Pages → Mit Git verbinden** → GitHub erlauben → Repository wählen.
3. Einstellungen:
   - Framework-Voreinstellung: **Vite** (oder „Keine“)
   - Build-Befehl: `npm run build`
   - Ausgabeordner: `dist`
   - Umgebungsvariable (falls gefragt): `NODE_VERSION` = `22`
4. **Speichern und bereitstellen.** Danach unter „Einstellungen → Builds → Vorschau-Bereitstellungen“: **Alle Branches**.
5. Mir die Adresse schicken – ab dann gebe ich nach jedem Schritt den Vorschau-Link an.

Supabase-Variablen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) kommen erst in Phase 2 dazu.

## Alternative Vercel
https://vercel.com → **Add New → Project → Import** → Repository → Framework „Vite“ erkannt → Deploy. Vorschau-Links pro Branch sind automatisch an.
