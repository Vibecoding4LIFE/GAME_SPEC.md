# Köderkönige – Dauerregeln für Claude

Die vollständige Spezifikation steht in `GAME_SPEC.md`. Diese Datei ist die Kurzfassung, die in jeder Sitzung gilt.

## Projekt
2D-Wettkampf-Angel- und Sammelspiel im Browser (Handy + PC), 2–4 Freunde online, 100 Fische in 5 Welten.
Stack: **Phaser 4.2.1**, **TypeScript 6 strict**, **Vite 8**, Vitest 5, Playwright 1.63, Zod 4, Supabase (ab Phase 2).
Hosting: siehe `docs/entscheidungen.md`. Node 22 (`.nvmrc`), Python 3 + Pillow für die Pixel-Pipeline.

## Befehle
| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver (http://localhost:5173) |
| `npm run build` | baut Daten + Tests (prebuild) und dann `dist/` |
| `npm run preview` | gebaute Seite lokal (http://localhost:4173) |
| `npm test` | Vitest (Logik, Daten, Assets, i18n) |
| `npm run test:e2e` | Playwright (Desktop, iPhone, Android) |
| `npm run data` | `Data/*.csv` → `public/data/*.json` + i18n-Schlüssel |
| `npm run art` | Pixel-Pipeline: Sprites + Atlanten aus `fish_db.json` |
| `npm run lint` | ESLint + Typprüfung |

## Ordner (B2)
`src/core` (Event-Bus, Zufall, Pixel-Skalierung) · `src/game` (reine Spiellogik, **ohne Phaser**) · `src/scenes` (Phaser-Szenen) ·
`src/net` · `src/ui` (HTML/CSS-Overlays) · `src/audio` · `src/data` (Typen, Schema, Lader, Validator) · `src/i18n` (de/en) ·
`public/assets/fish/<welt>/atlas_fish_<welt>.png/.json` · `public/data/*.json` (erzeugt) · `Data/*.csv` (Quelle der Wahrheit) ·
`tools/build-data.ts`, `tools/art/*.py` · `art_src/` · `supabase/` · `tests/unit`, `tests/e2e` · `docs/`

## Namen
- Welt-IDs `W1`–`W5`, Kürzel `see`, `riff`, `fjord`, `tiefe`, `grotte`. Fische `F001`–`F100`.
- Frames: `fish_<kürzel>_<nr3>_<slug>_<clip>_<frame>` (z. B. `fish_see_014_hecht_swim_0`). Details: `docs/datenvertrag.md`.
- Enum-Werte ohne Umlaute (`Gewoehnlich`). Texte nur über `t('schlüssel')`, nie hart im Code.

## Regeln (Teil I, Kurzform)
1. Nichts erfinden: Phaser-API in `node_modules/phaser/types/phaser.d.ts` und `node_modules/phaser/skills/` prüfen; Unsicheres `[UNGEPRÜFT]`.
2. Nach jeder Änderung: `npm run build`, `npm run lint`, `npm test` grün; Browser-Konsole ohne Fehler.
3. Reine Logik in `src/game`/`src/net` mit Vitest; Abläufe/Multiplayer mit Playwright. Fehlschläge analysieren, nicht blind wiederholen.
4. Daten statt Code: alle Spielzahlen in `Data/*.csv`.
5. Platzhalter stehen in `docs/platzhalter.md`.
6. Sicherheit: kein Service-Role-Key/API-Schlüssel im Browser oder Repo; RLS überall; Dauerwerte nur über Edge Functions.
7. Fairness: keine Lootboxen, kein Echtgeld-Glücksspiel, kein Pay-to-Win, keine Werbung.
8. Lizenzen: jede Quelle in `docs/lizenzen.md`.
9. Kleine Schritte, oft committen (Branch, kein Force-Push).
10. Berichte kurz auf Deutsch: *Was ist neu – Was funktioniert (Beweis) – Was fehlt – Was ich von dir brauche*, mit Vorschau-Link + Screenshot.
11. Feststecken (3 Versuche ohne Fortschritt): stoppen, Problem in 3 Sätzen, 2 Lösungswege.

## Pixel-Perfect (B3)
Interne Auflösung 640×360 (quer) / 360×640 (hoch), **nie ändern**. Ganzzahliger Zoom in Gerätepixeln (`src/core/pixelScale.ts`),
`pixelArt: true`, `roundPixels: true`, Positionen immer `Math.round`. Fische haben feste Canvas-Klassen (S 32×16 … Boss 256×128), nie skalieren.

## Agenten
Definitionen in `.claude/agents/`. Jeder Agent hat feste Schreibrechte; der `qa-pruefer` ändert keinen Spielcode.
Der Orchestrator committet und pflegt `docs/entscheidungen.md`.
