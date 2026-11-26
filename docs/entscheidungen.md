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

### Fischdaten (daten-designer, geprüft vom Orchestrator)
- **Abgeleitete Werte**, die Teil E nicht nennt, sind nach festen Regeln gesetzt: `k` nach Körperform (D 1.10; Hecht 0,009 wie Beispiel 6.7), `zupfer` nach Seltenheit (G 0-2, U/S 1-2, E 1-3, L 2-3), `zonen` aus dem Text (Seerosen/Anemonen/Seegras → Ufer, Riffkante/Blauwasser/Tiefes Loch → Kante), Lieblingsköder aus D 3.3, `scheinbisse` bei allen Trickser + Lumina, `zahnfisch` wo „Zahnfisch“ steht + Bosse.
- **Lexikontexte:** wörtlich aus der Spec, wo vorhanden; sonst von Claude geschrieben. **Hinweistexte** aus den Spawn-Bedingungen erzeugt. Englisch für alle 100 Fische (B7).
- **Bossphasen ohne Verhaltensangabe** (Coralina P3, Grimmbart P2/P4, Ignaris P2/P4) sinnvoll ergänzt, siehe `Data/boss_phases.csv`.
- **F093 Magma-Muräne** („Versteckspieler + Hitzkopf“): Hauptverhalten Versteckspieler; Hitzkopf kommt über die Magmakammer-Regel (alle Fische 40–60 m).
- **Bekannte Spec-Unstimmigkeiten (bleiben als Warnung sichtbar, Klärung in Phase 1/4):**
  1. F052 Lachs bevorzugt „Regen“, W3 hat kein Regenwetter.
  2. F077 Quastenflosser beginnt bei 150 m, W4-Schichten erst bei 200 m.
  3. „Erdbeben“ ist Wetter und Ereignis zugleich, steht aber nur in `WEATHERS` → läuft als Wetter.
  4. „Tag-Nacht-Wanderung“ (W4, „nachts ab 200 m“) ist keine Datenspalte → Spawn-Regel in Phase 1.
  5. Coralina „Vollmondnacht ODER Flut am Abend“: DNF kann keine Tageszeit pro Bedingung ausdrücken → etwas großzügiger.
  6. Barnabas: Wetter „Gewitter“ vs. Ereignis „Sommergewitter“ – derzeit zählt das Wetter.
  7. Zählt „Großer Ausbruch“ auch als „Ausbruch“ (F094)? → Entscheidung in Phase 4.
