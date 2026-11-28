# QA Phase 1 – „Angeln fühlt sich gut an“ – vollständige Abnahme

Prüfer: qa-pruefer (hat den Code nicht geschrieben). Datum: 28.11.2026. Geprüfter Stand: Commit `cbf8629` (nach der
Überarbeitung von Steuerung/UI). Ersetzt den Zwischenstand vom selben Tag.

> **Hinweis zum Prüfstand:** Während meiner Prüfung hat jemand anders `dist/` neu gebaut (09:38 Uhr). Außerdem gibt es
> nicht committete Änderungen an `src/ui/frames.ts` und `src/ui/theme.css` (09:45 Uhr, 9-Slice-Rahmen), die nicht von mir
> stammen. Die Touch-Durchläufe ab ca. 09:38 liefen gegen diesen neuen Build. Die Änderungen betreffen nur Rahmen-Optik,
> nicht Eingabe oder Logik.

## 1. Befehle

| Befehl | Ergebnis | Beweis |
|---|---|---|
| `npm run build` | **bestanden** (Exit 0) | prebuild (Daten + Vitest) grün; `index-*.js` 1 724 kB (gzip 468 kB) |
| `npm run lint` | **bestanden** (Exit 0) | ESLint + `tsc --noEmit` ohne Meldung (auch mit den neuen QA-Dateien) |
| `npm test` | **bestanden** | `Test Files 20 passed (20) · Tests 267 passed (267)` |
| `npm run test:e2e` | **bestanden** (Exit 0) | `41 passed, 19 skipped (6,9 min)`, darunter: iframe-Tastatur, iframe-Touch auf 4 Handy-Profilen, Ladebildschirm mit Titel (5 Profile), Pixelraster (5 Profile × 2 Szenen), alle 13 Verhaltensarten (4,2 min), Drill-Video |
| QA-Spieltests `npx playwright test -c tests/qa/playwright.qa.config.ts` | **bestanden** (alle Tests grün nach Behebung von Fehlern in meinem eigenen Test-Harness) | Ergebnisse in `docs/qa/phase-1/qa-*.json` und `qa-*.png` |

## 2. Abnahmepunkte

| # | Punkt | Urteil | Beweis |
|---|---|---|---|
| 1 | Wurf mit Kraftbalken | bestanden | Leertaste halten → `Casting`, loslassen → Wurf; Touch: „Halten: Auswerfen!“ (`qa-iphone-2-kraftbalken.png`) |
| 1a | Perfekter Wurf | bestanden | 3/3 Würfe mit 0,59 s Halten → `perfectCast: true` im Fangeintrag; Banner „Perfect cast!“ (`qa-perfekter-wurf.png`) |
| 1b | Fehlwurf | bestanden | 30 ms halten → Köder direkt am Steg, Kamera bleibt bei x = 0 (weiter Wurf: x = 189) (`qa-fehlwurf.png`, `qa-weiter-wurf.png`) |
| 2 | Zonen | bestanden (Abweichung dokumentiert) | in Metern aus `worlds.json`, Entscheidung 28.11. im Log; `cast.zone.*` entfernt |
| 3 | Sinken/Stoppen | bestanden | S halten / Knopf „Halten: Sinken!“ → Tiefe > 0, Loslassen stoppt (E2E + QA) |
| 4 | Tiefenanzeige + „Schnur zu kurz“ | bestanden | RO1 = 20 m: weit werfen, 7 s sinken → Tiefe bleibt bei 20 m, rot „Line too short!“ (`qa-schnur-zu-kurz.png`) |
| 5 | Zupfer / Biss / Anschlagfenster | bestanden | zu früh (im Zupfer) → „Too early – fish scared off!“, Zustand `Waiting` (`qa-zu-frueh.png`); zu spät → `late` (`qa-zu-spaet.png`); sofort → `perfectStrike: true`; nach 0,55 s → `perfectStrike: false`, gefangen (`qa-wurf-anschlag.json`) |
| 6 | Drill mit allen 13 Verhaltensarten | Logik bestanden, **Vorwarnung nicht bestanden** | Eigene Strategie per Tastatur im iframe: **13/13 gefangen, alle im 1. Versuch** (`qa-strategie.json`). Per Touch auf dem iPhone: Ruhig, Taucher, Springer, Zickzack 4/4 (`qa-touch-iphone.json`). **Aber:** Die Vorwarnungen aus D 1.7 sind im Bild nicht zu sehen → K-1 |
| 6a | Gegenprobe: falsche Reaktion | teilweise | Ohne Reaktion (Spannung mittig, nie lenken): Springer 3/3 verloren (`jumpShake`), Versteckspieler hakt fest und lässt sich per 3× Tippen im Takt lösen. Taucher, Trickser und Aufbläher werden aber **trotzdem gefangen** (`qa-gegenprobe.json`) → M-2 |
| 7 | Fang-Präsentation | bestanden | Fang-Karte mit Sprite, NEU!-Stempel, Länge/Gewicht/Punkte, Größenklasse (`qa-fang-Taucher.png`, `qa-iphone-5-fang.png`) |
| 8 | Fangeimer + Verkauf | bestanden | 2 Einträge, „Alles verkaufen · 50“ → 0 → 50 Münzen, Eimer leer (`qa-eimer.png`, `qa-eimer-verkauft.png`) |
| 9 | Spawn-Formel | bestanden (Unit) | `tests/unit/game-spawn.test.ts`: Tiefe/Zone/Zeit/Wetter/Köder/Ereignis/Pity |
| 10 | Tageszeit / Wetter | bestanden | Morgen + Nebel, Abend + Regen, Nacht + Gewitter (Windpfeil), Tag + Bewölkt, Fridolin-Vorhersage (`qa-welt-*.png`); kleine Anmerkung K-6 |
| 11 | Größe/Gewicht | bestanden | Unit `game-size.test.ts`; Fang-Karten zeigen plausible Werte (Schleie 34 cm / 527 g, Rotauge 21 cm / 118 g) |
| 12 | Schillernd | bestanden (kleine Lücke K-4) | Debug „forceShiny“ funktioniert; Fang-Karte mit Regenbogen-Banner, getauschter Palette und Funkeln (`qa-schillernd-karte.png`); im Lexikon 3 Sterne + Schillernd-Stern |
| 13 | Lexikon | bestanden | Ausgeschlitzter F013 → „gesichtet“ mit Hinweistext; F001/F004 → gefangen; 17 Silhouetten „???“; Sterne; 2/20-Kreis (`qa-lexikon-schillernd.png`, `qa-lexikon-gesichtet.png`) |
| 14 | Spielstand überlebt Neuladen | bestanden | nach `reload()`: Münzen 50, F001/F004 `caught`, F013 `seen` (`qa-lexikon-eimer.json`) |
| 15 | Parallax/Steg/Boot/Wasser | bestanden | alle Screenshots; Pixelraster **auch im Drill** fehlerfrei: 75 156 Läufe, 0 falsch (`qa-raster-drill.json`) |
| 16 | Touch **und** Tastatur | bestanden | Tastatur im sandboxed iframe nach Klick (13 Fänge); Touch mit echten CDP-Touch-Ereignissen und mehreren Fingern (Kurbeln + ◀/▶ gleichzeitig) auf iPhone (4 Fänge) und Android quer (1 Fang); Knöpfe ≥ 48 px, Hauptknopf 104 px |
| 17 | Debug-Menü: Fisch/Verhalten/Schillernd erzwingen | bestanden | Hooks `forceFish`, `forceBehavior`, `forceShiny`, Zeit, Wetter |
| 18 | Vitest Spawn/Punkte/Größe/Drill | bestanden | 234 Punkte (`game-score.test.ts:13`); Anschlagfenster 0,8 / 0,45 / 0,9 s; Schnurriss 0,35 s / 0,5 s (L02) / Druck → 0,35 s (`game-drill.test.ts`); die neuen Tests rechnen weiter mit den Spec-Zahlen × `scale` (keine Tautologie) |
| 19 | Drill-Video | bestanden | `docs/qa/phase-1/drill.webm`: VP8, 1280×720, **23,9 s**. Kontaktbogen (ffmpeg, 1 Bild/3 s): Einführung → Biss → Drill mit Spannungs-/Distanzbalken → Fang-Karte „Rainbow Trout“ |
| 20 | i18n de/en vollständig, keine hart codierten Texte | bestanden | 678/678 Schlüssel, keiner leer; grep in `src/scenes`, `src/ui`: keine Texte |
| 21 | Keine Spielzahlen in `src/game` | bestanden | grep: nur Kommentare |
| 22 | Konsole ohne Fehler | bestanden | alle E2E- und QA-Tests prüfen das. Anmerkung: Die Tests blenden „GL Driver/GPU stall“ aus (SwiftShader-Meldungen im Headless-Browser) |
| 23 | Leistung | **nicht prüfbar auf echtem Gerät** | headless, 1 Worker: Desktop Ø 27,1 FPS (22–37), iPhone-Emulation Ø 18,9 (13–30), Software-WebGL; nur Richtwerte |

## 3. Nachprüfung der Befunde aus dem Zwischenstand

| Befund | Status | Beweis |
|---|---|---|
| S1 erster Druck nach „Escaped“ verschluckt | **behoben** | `session.ts:244-251`: Quittieren und Wurf beginnen in einem Schritt |
| S2 Halten holt Schnur ein | **behoben** | eigene Aktion „Einholen“ (Taste R / Knopf); Halten = nur Sinken bzw. Kurbeln |
| S3 Touch-Lenken mit 180 ms Verzögerung | **behoben** | sichtbare ◀/▶-Knöpfe ohne Haltezeit (E2E prüft `steer = −1` nach 150 ms); Zickzack per Touch 2/2 und 1/1 gefangen |
| S4 Haptik | **behoben** | `src/ui/feedback.ts`: Zupfer, Biss, rot, Sprung, Blinker, Hänger, Fang, Riss; Rand-Puls als Ersatz ohne Vibration (iPhone/iframe) |
| S5 kein Ton | **offen** (Platzhalter) | `src/scenes/welt/sfx.ts` meldet nur Anlässe, `src/audio/` ist leer, steht in `docs/platzhalter.md` → K-5 |
| S6 Spannungsbalken unlesbar | **behoben** | Beschriftung „Tension“/„Distance“, weiße Nadel (`qa-iphone-4-drill.png`) |
| S7 Angler hochkant nicht im Bild | **behoben** | `qa-iphone-4-drill.png` zeigt Steg, Angler und Rute |
| S8 kein Titel beim Laden | **behoben** | E2E „Ladebildschirm“ (5 Profile): `.ld__title` = „Catch that Dih!“, ≥ 36 px |
| S9 doppeltes Zeiger-Ende | **behoben** | `touchControls.ts:204` beendet jeden Zeiger nur einmal |
| S10 Tests ohne echte Bedienung | **behoben** | `tests/e2e/iframe.spec.ts` + Harness; zusätzlich meine Mehrfinger-Durchläufe |
| M1 Schillernd unsichtbar | **behoben** (Rest K-4) | Fang-Karte, Debug-Schalter |
| M2 Video-Test rot | **behoben** | E2E grün, Video 23,9 s |
| M3 nur 1 Aktion je Drill | **teilweise** | Erste Aktion kommt jetzt nach höchstens 1–2 s. In meinen Tastatur-Drills (~10 s) kamen bei Springer, Versteckspieler, Aufbläher, Stromer und Blinker trotzdem nur **1** Aktion; per Touch (längerer Drill) 3–4 Sprünge. Der Aufbläher hat laut Log bewusst nur 1 Aktion. |
| K1 „Schnur zu kurz“ in W1 nie | **behoben** | RO1 = 20 m (Spec-Abweichung, im Log) |
| K2 Zonen-Werte tot | **behoben** | Entscheidung im Log, `cast.zone` entfernt |

## 4. Bugliste

### Kritisch
| # | Datei:Zeile | Befund | Reproduktion |
|---|---|---|---|
| K-1 | `src/scenes/welt/FishLayer.ts:88-113` (einzige Drill-Darstellung), `src/scenes/WeltScene.ts:436-440` | **Die Vorwarnungen aus D 1.7 sind nicht zu sehen.** Es gibt kein zitternder Schatten (Zappler), kein Drehen/Wasserstreifen (Sprinter), keine Blasen (Taucher), kein Wölben (Springer), kein Pfeil-Blinken (Zickzack), kein Flossenzucken (Trickser), keine blinkende Deckung (Versteckspieler), keinen runden Fisch (Aufbläher), keine blauen Funken / kein flackernder Balken (Stromer) und kein Durchsichtig-Werden vor dem Blinken. Es gibt nur: den Knopf „Hochreißen!“ (Taucher), Vibration bzw. Rand-Puls (Springer, Blinker) und `sfx.emit` ohne Ton. Der Spieler kann deshalb erst auf die Aktion reagieren, nicht auf die Warnung. Die Abnahme-Forderung „jede Verhaltensart erleben … inkl. Telegraph“ ist damit nicht erfüllt. Meine 13/13 gelangen nur, weil die Strategie das Drill-Protokoll (`drillLog`) liest. | `forceBehavior('Stromer')` usw., beim Ereignis `telegraph:*` einen Screenshot machen: `qa-verhalten-*.png` zeigt jeweils einen ganz normalen Schatten. Im Code: `grep telegraph src/scenes` findet nur Ton-, Haptik- und Knopf-Hooks. |

### Mittel
| # | Datei:Zeile | Befund | Reproduktion |
|---|---|---|---|
| M-2 | `Data/balancing.csv` `drill.behavior.*` | Bei Taucher, Trickser und Aufbläher spielt die richtige Reaktion kaum eine Rolle: Mit „Spannung mittig, nie lenken, nie hochreißen“ werden alle drei 3/3 gefangen. Der Trickser ist so sogar schneller (16 s statt 24 s). Nur der Springer bestraft falsches Verhalten. Zusammen mit K-1 fühlen sich die Verhaltensarten gleich an. | `qa-gegenprobe.json` (QA-Test „Gegenprobe“) |
| M-3 | `src/core/pixelScale.ts` (ganzzahliger Zoom), HUD `src/scenes/welt/Hud.ts` | Lesbarkeit bei kleinem Zoom. In der Artifact-Vorschau (iframe, 28 px Kopfleiste) läuft das Spiel auf einem 1280×720-Desktop nur mit **1×** (HUD-Schrift ≈ 5 px). Auf dem iPhone 13 (636 px Höhe) sind es **2 Gerätepixel = 0,67 CSS-px** je Spielpixel: „Perfect“, „Day“ und der Kraftbalken sind dann winzig. Das ist B3-konform, aber genau die Umgebung, in der der Nutzer testet. Vorschlag: Die Kern-Anzeigen (Kraft, Spannung, Meldungen) als HTML-Overlay in CSS-Größe, oder ab Zoom < 2 CSS-px größere HUD-Varianten. | `qa-schnur-zu-kurz.png`, `qa-iphone-1-bereit.png`, `qa-iphone-3-warten.png` |

### Klein
| # | Datei:Zeile | Befund |
|---|---|---|
| K-4 | `src/ui/bucket.ts:150`, `src/ui/lexicon.ts:164/189`, `docs/platzhalter.md:7` | Die Schillernd-Palette gibt es nur auf der Fang-Karte. Eimer-Vorschaubild und Lexikon zeigen den Fisch in Normalfarben (`qa-eimer.png`, `qa-lexikon-schillernd.png`). Der Platzhalter-Eintrag „Schillernd … Phase 1“ ist veraltet. |
| K-5 | `src/audio/` leer, `src/scenes/welt/sfx.ts` | Kein Ton (Pling, Schnur-Ton, Bremse, Blinker-Glöckchen). Steht in `docs/platzhalter.md`, fehlt aber für das „Drillgefühl“ (D 1.6) und das Blinker-Signal (D 1.7). |
| K-6 | Backdrop/Tönung | Bei Nacht bleibt das Wasser fast so türkis wie am Tag; D 1.9 nennt „Nachtblau“ (`qa-welt-Nacht-Gewitter.png`). Teilweise schon als Platzhalter vermerkt. |
| K-7 | `src/scenes/welt/FishLayer.ts:108` | Der gehakte Fisch wird nur auf `grundTiefsterY` begrenzt, nicht auf den Grund an seiner Stelle. Beim Tauchen hochkant steckt er sichtbar im Uferhang (`qa-iphone-4-drill.png`). |
| K-8 | `src/game/drill.ts:217` | `as unknown as Record<…>` umgeht die Typen der Balancing-Daten. `firstActionMaxS` sollte im Balancing-Typ stehen. |
| K-9 | Entscheidungen 28.11. | Spec-Abweichungen (Ausdauer ×1,5, RO1 20 m statt 25 m, Zonen in Metern) sind protokolliert, also kein Bug. Sie sollten aber bei der Spec-Freigabe durch den Nutzer bestätigt werden. |

## 5. Spielgefühl (ehrlich)

- **Ist erkennbar, was zu tun ist?** Ja. Die Einführung „So angelst du“ (4 Schritte), die Hinweiszeile oben links („Hold (Space): reel · (A)/(D) steer · (W) lift rod“) und der Hauptknopf mit wechselnder Beschriftung („Halten: Auswerfen!“ → „Halten: Sinken!“ → „Anschlagen!“ → „Halten: Kurbeln!“, rot „Hochreißen!“ beim Taucher) führen gut durch.
- **Taktung:** Drills dauerten 10–34 s, Wurf bis Kescher etwa 20–45 s – das passt zu D 1.1.
- **Schwierigkeit:** Für Welt 1 eher leicht. Meine einfache Strategie fing alles im ersten Versuch, und auch ohne jede Reaktion gingen 4 von 5 Arten an den Haken. Die Verhaltensarten unterscheiden sich vor allem in der Bewegung (Sprung, Tauchen, Richtungswechsel), nicht in dem, was der Spieler tun muss (K-1, M-2).
- **HUD auf dem Handy hochkant:** Spannung und Distanz sind beschriftet und im Drill gut lesbar. Im Warte-Zustand sind Kraftbalken und Tiefenanzeige bei Zoom 2 sehr klein (M-3). Die Touch-Knöpfe sind groß und klar beschriftet.
- **Rückmeldung:** Haptik bzw. Rand-Puls vorhanden, Bildschirmwackeln bei Biss/Sprung, Banner für Perfekt/zu früh/Riss. Es fehlt Ton (K-5).

## 6. QA-Dateien

- Tests: `tests/qa/playwright.qa.config.ts`, `tests/qa/phase1-spiel.qa.ts`. Sie laufen nicht mit `npm run test:e2e`. Inhalt: 13 Verhaltensarten mit eigener Strategie, Wurf/Anschlag, Lexikon/Eimer/Neuladen, Wetter + Raster im Drill, Touch-Fänge, Gegenprobe, Diagnosen. Mein Touch-Helfer muss bei Mehrfinger-Eingabe alle Finger loslassen und neu drücken, weil CDP keinen einzelnen Finger freigibt; das ist im Code erklärt.
- Ergebnisse: `docs/qa/phase-1/qa-*.json`, Screenshots `docs/qa/phase-1/qa-*.png`.

## 7. Zusammenfassung

- Build, Lint, 267 Unit-Tests und 41 E2E-Tests sind grün. Konsole ohne Fehler, Pixelraster auch im Drill sauber, i18n vollständig.
- Die Steuerung funktioniert jetzt im sandboxed iframe, per Tastatur und per echtem Mehrfinger-Touch. Alle 10 Steuerungsbefunde, M1, M2, K1 und K2 sind behoben, M3 teilweise.
- Gespielt: 13 Fänge per Tastatur (alle 13 Verhaltensarten) und 5 per Touch (iPhone hochkant, Android quer). Dazu Anschlag zu früh/zu spät/perfekt, perfekter Wurf, Fehlwurf, „Schnur zu kurz“, Schillernd, Lexikon gesichtet/gefangen, Verkauf und Neuladen.
- **Kritisch (K-1):** Die Vorwarnungen der Verhaltensarten sind im Bild nicht zu sehen. Der Spieler kann nur auf die Aktion reagieren, nicht vorher.
- **Mittel:** Die richtige Reaktion lohnt sich nur beim Springer (M-2). HUD-Schrift ist in der Vorschau bei Zoom 1–2 sehr klein (M-3).
- **Klein:** Schillernd-Palette nur auf der Fang-Karte, kein Ton, Nachtwasser kaum blau, Fisch im Hang beim Tauchen, Typ-Umgehung in `drill.ts`.
- Leistung ist auf echtem Gerät nicht prüfbar (headless Desktop Ø 27 FPS, iPhone-Emulation Ø 19 FPS).

**Gesamturteil: nicht abgenommen – wegen eines kritischen Befunds (K-1).** Alle anderen Abnahmepunkte sind bestanden oder
haben nur kleine Auflagen. Wenn K-1 behoben und M-2 nachjustiert ist, empfehle ich die Abnahme. Für die Nachprüfung genügt
`tests/qa/phase1-spiel.qa.ts` (Gegenprobe + Screenshots bei `telegraph:*`).
