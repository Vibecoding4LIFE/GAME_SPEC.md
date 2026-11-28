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
- **Skalierung (überarbeitet nach QA-Befund B1, 27.11.):** Der Canvas füllt das ganze Fenster, sein Puffer hat exakt die Größe in **Gerätepixeln** (`ResizeObserver` mit `devicePixelContentBoxSize`, Fallback CSS × DPR). Die Spielwelt 640×360 wird über die Phaser-Kamera mit ganzzahligem Zoom (`floor(min(w/640, h/360))`) gezeichnet, Ausschnitt auf ganze Gerätepixel zentriert (`src/scenes/pixelCamera.ts`). Der Rand ist transparent und zeigt die Weltfarbe der Seite.
  - Erste Version skalierte einen 640×360-Puffer per CSS (`zoom = deviceZoom / dpr`). Bei krummer DPR (Android 2,625) rundet der Browser die CSS-Größe auf 1/64 px; dadurch waren 0,4–0,8 % der Pixelspalten 1 Gerätepixel zu breit/schmal. Der Regressionstest `tests/e2e/qa-pixelraster.spec.ts` prüft das jetzt auf 5 Profilen (inkl. Handy quer).
  - Preis: Der Puffer ist so groß wie der Bildschirm (mehr Füllrate als 640×360). Die FPS auf einem Mittelklasse-Handy werden in Phase 1 gemessen (B8); Plan B wäre ein Render-Texture-Zwischenschritt.
  - Einige Emulatoren melden in `devicePixelContentBoxSize` CSS-Pixel. Werte werden deshalb nur übernommen, wenn sie zu CSS × DPR passen (±2 px).
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

### QA-Befunde Phase 0 (siehe `docs/qa/phase-0.md`)
- B1 (Pixelraster Android/quer) behoben, s. o.
- K1 leere B2-Ordner mit `.gitkeep` eingecheckt. K2 kaputte CSV-Zeile liefert jetzt eine rote Meldung statt Stacktrace.
- K4 (Zahlen in `TestbeckenScene.ts`): bewusst gelassen – Schwimmtempo und Himmelsanteil betreffen nur die Testszene, keine Spielwerte. Die echte Welt-Szene (Phase 1) liest alles aus den Daten.
- K3 (DPR 1,25 halbe Randspalte) ist mit dem neuen Ansatz erledigt (Ausschnitt startet auf ganzen Gerätepixeln).

## 2026-11-27 – Spielname
- **Name: „Catch that Dih!“** (Entscheidung des Nutzers), in Deutsch und Englisch gleich. Ersetzt den Arbeitstitel „Köderkönige“ in Titel, Texten, README, CLAUDE.md und Agenten. `GAME_SPEC.md` bleibt als Original-Spezifikation unverändert.
- Unverändert bleiben die Spielbegriffe aus der Spec: Titel „Köderkönig/Köderkönigin“ für 100/100, „Goldene Rute des Köderkönigs“, Köder-Item „Bosslocker“ usw.

## 2026-11-27 – Phase 1: Ausrüstung und Balancing (daten-designer)
Alle Spielzahlen stehen in `Data/balancing.csv` (259 Werte, jede mit Quelle). Wo die Spec nichts sagt, gilt eine **eigene Wahl** (in der Spalte `quelle` markiert), u. a.:
- Sinkgeschwindigkeit leicht/mittel/schwer 2,5 / 4 / 6 m/s. Grund-Wartezeit 5–15 s (min. 2 s), Wartezeit = Grundwert / (1 + Σ Bissraten-Boni); Zupfer alle 0,8–2 s.
- Anschlagfenster-Zwischenstufen linear (U +0,1125, S +0,025, E −0,0625 s).
- Musterfaktor-Grundwert 0,5 (mit 1,0 wäre ab Kraft 6 mit der Startrute nichts haltbar). Grüne Zone mittig bei 0,50, Brocken +0,15. Erschöpfter Fisch zieht mit 0,3.
- Distanz normiert 1 → 0, Einholen 0,10/s, Flucht 0,12/s. Boss-Ausdauer 45 + x·25 s.
- Zu früher Anschlag: Bissrate ×0,5 für 5 s. Scheinbiss 35 % (max. 2). Futterplatz-Radius 3 m. Mückenschwarm 50 % je Abend, 120 s.
- Schnurfarbe #E8EEF2 statt #FFFFFF (Style Guide: kein Reinweiß).
- Fisch-Tags (`raubfisch`, `friedfisch`, `oberflaeche`, `grund`, `aal`, `forelle`, `lachs`, `mystisch`, `kristall`, `glut`, `riff`, `lagune`, `scheu`) steuern Wetter-, Köder- und Zucken-Effekte (`docs/datenvertrag.md` §5).

**Offene Spec-Fragen (vorläufig entschieden):**
1. Qualitätsfaktor Q additiv (wie Rechenbeispiel D 2.3 = 234 Punkte), nicht ×1,1 / ×1,2 multiplikativ.
2. RG hat Flex 41 %, obwohl D 1.6 „20–40 %“ sagt → 41 % übernommen.
3. Größen-μ-Bonus nur bei RW1 (Tabelle), RW2–RW5 = 0.
4. Ruf-Stufenformel 100 × n^1,4 als XP **pro Stufe** (nicht kumuliert).
5. „Scheue Fische“ fürs Stahlvorfach = Tag `scheu`.
6. „Bissrate +X %“ wirkt auf die Wartezeit, „Fischart +X %“ auf das Spawn-Gewicht.
7. Welt-Spezialköder bei 10/20 Arten noch offen (Phase 3).

## 2026-11-28 – Phase 1: Steuerung und Drill-Balancing
- **Steuerung im iframe** (Artifact-Vorschau): Fokus wird beim ersten Zeiger-Druck ins Spiel geholt (`autoFocus: false`), Eingabe-Flanken werden über Logik-Schritte gerettet (120-Hz-Displays), Spielzeit läuft über `rawDelta`. Sichtbare Touch-Knöpfe statt unsichtbarer Gesten.
- **Startrolle RO1 = 20 m** (Spec 25 m): „Schnur zu kurz!“ wird in Welt 1 erlebbar, das Tiefe Loch braucht das erste Upgrade.
- **Drill:** `drill.stamina.scale` = 1,5 auf alle Ausdauer-Grundwerte; erste Aktion je Verhalten spätestens nach 1–2 s (`firstActionMaxS`); Pausen 2,5–4 s. Ergebnis (Bot, 30 Seeds): jede aktive Verhaltensart zeigt ≥ 2 Aktionen pro Drill – außer **Aufbläher (1 Aktion)**: Seine 5–7-s-Pause und das Erschöpfen nach dem Aufblähen stehen so in D 1.7; das bleibt vorerst Spec-treu.
- **Zonen** (Ufer/Freiwasser/Kante) in Metern aus `worlds.json` statt in Prozent der Wurfweite (D 1.3); spielerisch gleichwertig und je Welt einstellbar. `cast.zone.*` entfernt.
- **Einkommen** nach den Änderungen 55–68 Münzen/min (Ziel 60–90) → in Phase 5 (Balancing-Simulation) nachjustieren.
