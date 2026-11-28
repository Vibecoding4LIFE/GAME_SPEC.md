# QA Phase 1 – „Angeln fühlt sich gut an“ – **ZWISCHENSTAND (abgebrochen)**

> **Status: Zwischenstand, keine Abnahme.** Die Prüfung wurde auf Bitte des Orchestrators abgebrochen, weil Steuerung,
> Eingabe und UI gerade überarbeitet werden (Rückmeldung des Nutzers: Tasten/Touch funktionieren bei ihm nicht, UI und
> Haptik fühlen sich ungenau an, Titel im Ladebildschirm fehlt). Nach der Überarbeitung folgt die vollständige Abnahme.
> Prüfer: qa-pruefer (hat den Code nicht geschrieben). Datum: 28.11.2026. Stand: Commit `f299318`.

## 1. Befehle

| Befehl | Ergebnis | Beweis |
|---|---|---|
| `npm run build` | **bestanden** (Exit 0) | prebuild: `npm run data` + Vitest grün; `dist/assets/index-*.js` 1 704 kB (gzip 463 kB) |
| `npm run lint` | **bestanden** (Exit 0) | ESLint + `tsc --noEmit` ohne Meldung |
| `npm test` | **bestanden** | `Test Files 19 passed (19) · Tests 250 passed (250)` |
| `npm run test:e2e` | **nicht bestanden** (Exit 1): 25 bestanden, **1 fehlgeschlagen**, 14 übersprungen (4,5 min) | Pixelraster (Testbecken + Welt 1) auf allen 5 Profilen grün; „auswerfen … Fang-Karte“ grün auf allen 5 Profilen; „alle 13 Verhaltensarten“ grün (3,5 min); FPS headless: desktop Ø 30,9 (26–44), iphone Ø 17,9 (11–38). **Fehlgeschlagen:** `welt1.spec.ts:175` „Video eines Drills“ – `video.saveAs: ENOENT … test-results/video/page@….webm -> docs/qa/phase-1/drill.webm` (Bug M2). |

## 2. Abnahmepunkte (Stand beim Abbruch)

Legende: bestanden / nicht bestanden / nicht prüfbar / **offen** (noch nicht geprüft).

| Punkt | Urteil | Beweis / Notiz |
|---|---|---|
| Wurf mit Kraftbalken, Perfekt/Fehlwurf | Logik bestanden, Spiel **offen** | `src/game/cast.ts` (Ping-Pong 1,2 s, Perfekt ≥ 0,92 bzw. Rute, Floor 0,86, Fehlwurf < 0,10 → Ufer); Unit-Tests `game-mechanics.test.ts:21–47` |
| Zonen | bestanden mit Abweichung | Zonen nach Metern aus `worlds.csv` (Ufer < 6 m, Freiwasser < 15 m), **nicht** nach D 1.3-Prozenten. `balancing.csv` `cast.zone.uferMax/freiwasserMax` werden nirgends benutzt (nur validiert, `src/data/balancing.ts:287`). Nicht in `docs/entscheidungen.md`. → Bug K2 |
| Sinken/Stoppen | bestanden (E2E) | E2E hält S 700 ms, `depthM > 0` |
| Tiefenanzeige + „Schnur zu kurz“ | Anzeige vorhanden; „Schnur zu kurz“ in W1 **nicht prüfbar** | Startrolle RO1 = 25 m = W1-Maximaltiefe → Meldung kann in W1 nie erscheinen. Nur Unit-Test (`game-mechanics.test.ts:65`, W2). |
| Zupfer, Biss, Anschlagfenster | Logik bestanden, Spiel **offen** | 0,6 s + Seltenheit + Rute, perfekt in ersten 40 %, zu früh → verscheucht 5 s, zu spät → Köder weg (`game-mechanics.test.ts:90–130`) |
| Drill mit allen 13 Verhaltensarten inkl. Telegraph | Logik bestanden; eigene Spielstrategie **offen** | `src/game/drill.ts` deckt alle 13 ab, Unit-Tests je Verhalten (`game-drill.test.ts:158–298`). Der vorhandene E2E prüft nur „Telegraph-Ereignis kommt“, nicht „Fang mit richtiger Reaktion“. Eigene Playwright-Strategie (≥ 4 Arten) noch nicht gelaufen. |
| Fang-Präsentation | teilweise | Fang-Karte erscheint (E2E). Screenshots noch nicht bewertet. |
| Fangeimer + Verkauf | **offen** | Badge „1“ nach Neuladen (E2E); Verkauf noch nicht gespielt |
| Spawn-Formel | bestanden (Unit) | `game-spawn.test.ts` (Tiefe/Zone/Zeit/Wetter/Köder/Ereignis/Pity) |
| Tageszeit, Wetter | Logik bestanden (Unit), Optik **offen** | `game-mechanics.test.ts:158–222` |
| Größe/Gewicht | bestanden (Unit) | μ 0,45 / σ 0,18, Klassen, k × L³ (`game-size.test.ts`) |
| Schillernd | **nicht bestanden** | Chance korrekt (Unit 1:250/125/200/100/60), aber nicht per Debug erzwingbar und ohne Palette-Swap/Glitzer → Bug M1 |
| Lexikon (Silhouette → gesichtet → gefangen, Sterne) | Logik bestanden (Unit), UI **offen** | `game-mechanics.test.ts:225`, `ui-stars.test.ts` |
| Lokaler Spielstand überlebt Neuladen | bestanden (E2E) | Eimer-Badge nach `reload()` = 1 |
| Parallax/Steg/Boot/Wasser | sichtbar | `test-results/welt1-desktop-drill.png`, `welt1-iphone-drill.png` |
| Touch **und** Tastatur | E2E grün, aber **Nutzer meldet Ausfall** → offen | siehe Abschnitt 3 |
| Debug-Menü: Fisch erzwingen | vorhanden | `src/ui/debugMenu.ts` (Fisch, Verhalten, Zeit, Wetter, FPS) |
| Punkteformel 234 / Schnurriss 0,35 s + Reserve | bestanden | `game-score.test.ts:13` (= 234), `game-drill.test.ts:107` (0,35 / 0,5 mit L02 / Druck) |
| Drill-Video | **nicht bestanden** (Erzeugung) | Der Video-Test schlägt fehl (M2). `docs/qa/phase-1/drill.webm` (2,37 MB) stammt noch vom 27.11. 21:02, nicht aus diesem Lauf; Inhalt noch nicht geprüft. |
| Keine Spielzahlen in `src/game` | bestanden | grep nach Dezimal-/Mehrziffern-Literalen: nur Kommentare und Regex `F\d{3}` |
| Keine hartcodierten Texte in `src/scenes`, `src/ui` | bestanden (Stichprobe) | grep: nur `'⛶'` (`src/ui/fullscreen.ts:22`, Symbol) |
| Leistung | **nicht prüfbar auf echtem Gerät** | headless iphone Ø 17,9 FPS (Software-WebGL, nur Richtwert) |

## 3. Befunde zu Steuerung, Eingabe, Touch, UI-Lesbarkeit, Rückmeldung

| # | Schwere | Datei:Zeile | Befund |
|---|---|---|---|
| S1 | mittel | `src/game/session.ts:242-243`, `src/scenes/WeltScene.ts:78` | Nach „Escaped“ steht der Eingabemodus auf `aim`, aber der erste Druck auf Leertaste/Wurf-Knopf quittiert nur die Meldung (`acknowledge`) und wirft **nicht** aus. Der Spieler muss ein zweites Mal drücken → wirkt wie „Eingabe verschluckt“. |
| S2 | mittel | `src/game/session.ts:334` | Leertaste/Kurbel **halten** im Warte-Zustand holt nach `depth.twitch.activeS` (2 s) die Schnur ein (zurück zu Idle). Wer nach dem Wurf aus Gewohnheit die Leertaste hält, verliert den Wurf ohne klare Meldung. Außerdem wird hier ein Zucken-Wert als Einhol-Schwelle wiederverwendet (eigene Balancing-Zahl nötig). |
| S3 | mittel | `src/ui/inputMap.ts:122` | Touch-Rutenführung startet erst nach `holdMs: 180` ms. Zickzack hat nur 0,25 s Telegraph (`balancing.csv` `drill.behavior.Zickzack.telegraphS`), Richtungswechsel alle 0,6–1,2 s → auf dem Handy bleibt kaum Reaktionszeit, fühlt sich träge/ungenau an. |
| S4 | mittel | `src/scenes/WeltScene.ts:337`, `:356` | Haptik nur bei Biss (60 ms) und Springer-Telegraph (30 ms). Es fehlt die Vibration im roten Spannungsbereich (D 1.6) und beim Blinker („nach Vibration und Ton spielen“, D 1.7). Auf dem iPhone gibt es gar keine Vibration (erwartbar) – dort fehlt ein Ersatz-Signal. |
| S5 | mittel | `src/audio/` (leer), `docs/platzhalter.md` | Kein einziger Ton: kein „Pling“ beim perfekten Wurf (D 1.3), kein Schnur-Sound mit Tonhöhe nach Spannung, kein Bremsgeräusch, kein Blinker-Glöckchen. Rückmeldung beim Drill daher nur optisch. |
| S6 | mittel | `src/scenes/welt/Hud.ts:52`, `:89` (Nadel), Screenshot `test-results/welt1-iphone-drill.png` | Spannungsbalken ohne Beschriftung/Legende; die Spannungsnadel ist eine dünne goldene Linie in Rahmenfarbe und auf dem Handy hochkant schwer von Rahmen/Zonengrenze zu unterscheiden. Distanzbalken und Ausdauer-Flossen sind sehr klein. |
| S7 | klein | Screenshot `welt1-iphone-drill.png` | Im Drill hochkant ist Angler/Steg/Rute nicht im Bild (Kamera folgt dem Hakpunkt) – man sieht die Rutenbiegung (Rückmeldung zur Spannung) nicht. |
| S8 | klein | `src/scenes/PreloadScene.ts:48-49` | Ladebildschirm zeigt nur einen Fortschrittsbalken, keinen Spieltitel (bestätigt die Nutzermeldung). |
| S9 | klein | `src/ui/touchControls.ts:162` (`lostpointercapture` → `end(e, true)`) | Nach `pointerup` folgt `lostpointercapture` und ruft `gestures.cancel` für einen bereits beendeten Zeiger. Vermutlich harmlos, nach der Überarbeitung gezielt testen (Doppel-Ereignisse bei Wisch/Tippen). |
| S10 | Hinweis | `tests/e2e/welt1.spec.ts:30-40` | Die E2E-Touch-Tests nutzen CDP-Touch auf dem Wurf-Knopf und lenken nie per Bildschirmhälfte/Wisch; Tastatur-Tests nutzen `page.keyboard` ohne vorherigen Klick/Fokus. Ein Ausfall bei echten Nutzern (z. B. Fokus auf einem HUD-Knopf, iOS-Safari-Pointer-Events, Gesten-Erkennung) wird so **nicht** erkannt. |

## 4. Weitere Bugs (bisher)

| # | Schwere | Datei:Zeile | Befund / Reproduktion |
|---|---|---|---|
| M1 | mittel | `src/ui/catchCard.ts:117`, `src/scenes/WeltScene.ts` (`makeDebug`), `src/ui/debugMenu.ts` | Schillernd: `data-shiny` wird gesetzt, aber keine CSS-Regel/kein Palette-Swap, kein Glitzer alle 2 s (D 1.11). Nicht per Debug-Menü/Hook erzwingbar → für die Abnahme nicht vorführbar. `docs/platzhalter.md` nennt „Ersetzen in Phase 1“. |
| M2 | mittel | `tests/e2e/welt1.spec.ts:189-193` | Video-Test rot: Videodatei unter `test-results/video/` existiert nach `context.close()` nicht mehr (ENOENT beim `saveAs`). Reproduktion: `npm run test:e2e` (Desktop-Projekt). Verstößt gegen Teil I Nr. 2 (alles grün). |
| M3 | mittel | `Data/balancing.csv` `drill.stamina.baseS.Gewoehnlich` (6 s) + `drill.behavior.*.intervalMinS` (2,5 s) | Laut E2E-Protokoll („Telegraph je Verhalten“) endet ein Drill meist nach **einer einzigen** Aktion (Sprinter, Taucher, Springer, Versteckspieler, Aufbläher, Stromer, Blinker: `telegraph → action → exhausted → end`). Das Verhalten ist so kaum „erlebbar“ (Abnahme-Ziel H Phase 1); Spielgefühl in der vollständigen Abnahme prüfen. |
| K1 | klein | `Data/reels.csv` RO1 (25 m) vs. W1 `maxTiefe` 25 m | „Schnur zu kurz!“ ist in Welt 1 mit Startausrüstung nie zu sehen. |
| K2 | klein | `src/game/cast.ts` `zoneAt`, `Data/balancing.csv` `cast.zone.*` | Zonen in Metern statt D-1.3-Prozenten; Balancing-Werte toter Code; Entscheidung nicht protokolliert. |

## 5. Vorbereitet, noch nicht gelaufen
- `tests/qa/playwright.qa.config.ts`: eigene QA-Konfiguration (Port 4174, Desktop / iPhone / Android quer) für die
  Spiel-Durchläufe mit eigener Strategie (3 Tastatur-Fänge, 1 Touch-Fang, ≥ 4 Verhaltensarten, Anschlag zu früh/zu spät/perfekt,
  Lexikon/Eimer/Verkauf/Neuladen). Die Spec-Datei `*.qa.ts` folgt in der vollständigen Abnahme.

## 6. Zusammenfassung (Zwischenstand)
- Build, Lint, 250 Unit-Tests grün; E2E 25 grün, **1 rot** (Drill-Video, M2).
- Spiellogik (Wurf, Biss, Drill mit 13 Verhalten, Spawn, Punkte 234, Größe, Schnurriss 0,35 s + Reserve) ist sauber aus
  Daten gerechnet und gut getestet.
- Offen bzw. kritisch für die Abnahme: echte Eingabe (Nutzer meldet Ausfall – Tests decken reale Bedienung nicht ab),
  Haptik/Ton fast nicht vorhanden, Spannungsanzeige schlecht lesbar, Schillernd nicht vorführbar.
- **Gesamturteil: keine Abnahme möglich (Zwischenstand).** Vollständige Prüfung nach der Überarbeitung.
