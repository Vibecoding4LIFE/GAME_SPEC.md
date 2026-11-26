# Entscheidungs-Log

Format: Datum · Entscheidung · Begründung · Alternativen.

## 2026-11-26 – Phase 0

### Annahmen
| Thema | Festlegung | Grund |
|---|---|---|
| Phaser | **4.2.1** (npm `latest`, erschienen 09.07.2026) | aktuelle stabile 4.x-Version, exakt gepinnt |
| Node | **22 LTS** (`.nvmrc`) | in der Umgebung vorhanden, LTS |
| TypeScript | **6.0.3** statt 7.0 | `typescript-eslint` 8.74 unterstützt nur TS < 6.1 |
| Vite / Vitest / Playwright | 8.4.0 / 5.1.2 / 1.63.0 | aktuelle Versionen; Playwright passend zum vorinstallierten Chromium |
| Zod | 4.6.7 | Spec 6.8 sieht Zod vor |
| Hosting | **Cloudflare Pages** (Vorschlag, Verbindung durch dich nötig) | kostenlos, unbegrenzte Bandbreite, automatische Vorschau-Links pro Branch. Alternative Vercel (Hobby-Plan nur nicht-kommerziell, 100 GB) – Projekt läuft auf beiden ohne Änderung (statische Seite aus `dist/`). |

### Technik
- **Skalierung:** `Phaser.Scale.NONE` mit eigener Resize-Logik (`src/core/pixelScale.ts`). Der Zoom wird in **Gerätepixeln** ganzzahlig gewählt (`floor(min(w·dpr/640, h·dpr/360))`) und als `deviceZoom / dpr` an Phaser gegeben. So belegt jedes Spielpixel auch auf Handys mit DPR 2,625 oder 3 exakt n×n echte Pixel. Alternative `MAX_ZOOM` von Phaser rechnet in CSS-Pixeln und verschenkt auf Handys Schärfe.
- **Hochformat:** interne Größe 360×640 (gleiche Pixelgröße), Szenen ordnen sich über das `layout`-Event neu an.
- **Text in Phase 0:** Beschriftungen als HTML-Overlay mit Systemschrift (scharf). Pixel-Schrift folgt mit dem UI (Phase 1), siehe `docs/platzhalter.md`.
- **Sprite-Namen:** Langform aus B2/F2 (`fish_see_014_hecht_swim_0`) statt Kurzform aus 6.8 (`fish_014_swim_0`), weil B2 und F2 sie verbindlich nennen. `assetKey` wird von `build-data.ts` erzeugt, damit Spiel und Python dieselbe Regel nutzen.
- **Datenvertrag:** zusätzliche CSV-Spalten (Körperform, Muster, Farben, ODER-Bedingungen, englische Texte) in `docs/datenvertrag.md`.
- **ODER-Bedingungen** (Barnabas „Gewitter oder Vollmond“, Coralina, Korallendrache) als Spalte `pflicht_oder` in Disjunktiver Normalform (`|` = oder, `+` = und), weil 6.3 nur UND-Bedingungen abbildet.
- **Mindesttiefe aller Welten = 0 m.** W4-Schichten beginnen bei 200 m; der Quastenflosser (150–700 m) bleibt so gültig, weil die Validator-Regel „überlappt mindestens eine Schicht“ greift.
- **`npm run build`** führt vorher `npm run data && vitest run` aus (Spec 6.8). Die erzeugten Atlanten werden mit eingecheckt, damit der Hosting-Build kein Python braucht.
- **Agenten-Skills:** Die Spec nennt `anthropic-skills:frontend-design`; in dieser Umgebung heißt der Skill `frontend-design:frontend-design`. In `.claude/agents/` steht der echte Name.
