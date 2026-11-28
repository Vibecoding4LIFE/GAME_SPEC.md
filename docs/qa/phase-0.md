# QA-Abnahme Phase 0 – Fundament

Prüfer: `qa-pruefer` (unabhängig, hat den Code nicht geschrieben) · Datum: 2026-11-27 · Stand: Commit `15958e5`
Geprüft gegen: GAME_SPEC.md Teil H „Phase 0“, A2, B2, B3, B7, F2/F5/F8, G 6.6–6.9, Teil I; `docs/datenvertrag.md`, `docs/entscheidungen.md`.
Umgebung: Linux, Node 22, Chromium (Playwright 1.63, headless, SwiftShader-WebGL). Kein echtes Handy, kein Safari, kein Hosting-Zugang.

## Gesamturteil

**Technisch bestanden, aber noch nicht abnahmefähig.** Build, Lint, Unit-Tests und die bestehenden E2E-Tests sind grün. Die Daten (100 Fische) stimmen in allen geprüften Spalten mit Teil E überein. Atlanten und Clips sind vollständig. Die Fische schwimmen scharf (ohne Weichzeichnung). Zwei Dinge fehlen noch:
1. **Vorschau-Link fehlt.** Das Hosting ist nicht verbunden. Dafür muss der Nutzer handeln (`docs/hosting.md`). Der Abnahmepunkt „Vorschau-Link öffnet auf Handy und PC“ ist deshalb offen.
2. **Bug B1 (mittel):** Bei manchen Bildschirmen ist das Pixelraster nicht exakt. Betroffen sind Kombinationen, bei denen die CSS-Größe des Canvas keine glatte Zahl ist (z. B. Pixel 7 mit DPR 2,625, iPhone quer mit Zoom 2 bei DPR 3). Dann sind 0,4–0,8 % der Pixelspalten und -zeilen 1 Gerätepixel zu schmal oder zu breit. Das sieht man kaum, aber B3 verlangt „exakt n×n“. Der neue Test `tests/e2e/qa-pixelraster.spec.ts` zeigt den Fehler (Projekt `android` ist rot).

Es gibt keine kritischen Bugs.

## 1. Befehle

| Befehl | Ergebnis | Beweis (gekürzt) |
|---|---|---|
| `npm run build` | **bestanden** (Exit 0, 5,5 s) | prebuild: `WARNUNG F052 … "Regen" gibt es in W3 nicht`, `WARNUNG F077 … 150 m`, `✓ 100 Fische, 19 Bossphasen, 5 Welten (2 Warnungen)`, `Tests 45 passed \| 1 todo`, `dist/assets/index-*.js 1,428.97 kB │ gzip: 375.96 kB`, `✓ built in 818ms` |
| `npm run lint` | **bestanden** (Exit 0) | `eslint . && tsc --noEmit` ohne Ausgabe |
| `npm test` | **bestanden** (Exit 0) | `Test Files 5 passed (5)`, `Tests 45 passed \| 1 todo (46)` (Todo = Regel 7, Spawn-Simulation → Phase 1) |
| `npm run test:e2e` (Stand vor QA) | **bestanden** (Exit 0) | `5 passed, 1 skipped` (desktop/iphone/android; Drehtest nur Handy) |
| `npm run test:e2e` (mit neuem QA-Test) | **1 rot** | `7 passed, 1 skipped, 1 failed`: `[android] qa-pixelraster … 407 von 114445 Läufen kein Vielfaches von 3` → Bug B1 |
| `python3 tools/art/check.py` | **bestanden** (Exit 0) | `100 Fische geprüft, 0 mit Fehlern` |

## 2. Definition of Done Phase 0 (Teil H) und Zusatzpunkte

| # | Punkt | Urteil | Beweis |
|---|---|---|---|
| H1 | Annahmen-Liste (Phaser, Hosting, Node) | bestanden | `docs/entscheidungen.md` „Annahmen“: Phaser 4.2.1, Node 22, TS 6.0.3, Cloudflare Pages (Vorschlag) |
| H2 | Vite + TS strict + Phaser 4 | bestanden | `package.json` (phaser 4.2.1, vite 8.4.0, typescript 6.0.3), `tsc --noEmit` grün |
| H3 | Ordnerstruktur B2 | bestanden, mit Einschränkung | Alle Ordner liegen lokal vor. Die leeren Ordner sind aber **nicht in Git** (→ Bug K1) |
| H4 | `CLAUDE.md` mit Befehlen | bestanden | Befehlstabelle dev/build/preview/test/test:e2e/data/art/lint, Ordner, Namen, Regeln Teil I, B3 |
| H5 | `.claude/agents/` (A2): 8 Dateien mit `name`, `description`, `tools` | bestanden | architekt, gameplay-coder, netcode-coder, daten-designer, pixel-artist, ui-designer, audio-designer, qa-pruefer – jede mit Frontmatter `name/description/tools` |
| H6 | `docs/entscheidungen.md` | bestanden | vorhanden, mit Annahmen, Technik und 7 bekannten Spec-Unstimmigkeiten |
| H7 | Hosting verbunden, Hauptbranch → feste Adresse, Branches → Vorschau | **nicht bestanden (blockiert, Nutzer muss handeln)** | Kein Link vorhanden. `docs/hosting.md` enthält die Anleitung für Cloudflare Pages. Vom QA-Agenten nicht prüfbar |
| H8 | Pixel-Perfect B3: ganzzahlige Skalierung, Hoch- und Querformat | **bestanden mit Bug B1** | siehe Abschnitt 4. Zoom ist überall ganzzahlig in Gerätepixeln, `pixelated`, intern 640×360 / 360×640. Raster exakt auf Desktop 1280×720, 1920×1080, 1366×768@1,25 und iPhone hoch. Nicht exakt auf iPhone quer, Pixel 7 hoch und Pixel 7 quer (B1) |
| H9 | `Data/fish.csv` mit allen 100 Fischen (Format 6.6) | bestanden | 100 Zeilen, 48 Spalten (6.6 + Vertragsspalten). Abgleich aller 100 Zeilen mit Teil E: siehe Abschnitt 3 |
| H10 | `npm run data` → `fish_db.json` + Übersetzungsschlüssel | bestanden | Test „ist aktuell (entspricht den CSVs)“ grün. 373 Schlüssel in de und en |
| H11 | Validator: 100 Fische, 20 je Welt, 8/5/4/2/1, IDs eindeutig, Pflichtfelder | bestanden | `tests/data.test.ts` grün. Kaputte CSV bricht den Build ab (6 Fälle, Abschnitt 3.3) |
| H12 | `fishgen.py` Platzhalter für 100 Fische, `pack.py` Atlanten | bestanden | 5 Atlanten, alle Frames vorhanden, Padding 2 / Extrude 1 (Abschnitt 5) |
| H13 | Abnahme: Testszene zeigt 20 Fische von W1 gestochen scharf schwimmend | bestanden (Desktop/Chromium) | `__KK.fishOnScreen = 20` in allen 7 Profilen. Screenshots a/b zeigen Bewegung. Keine Mischfarben, also keine Weichzeichnung. Rasterfehler B1 auf 3 Profilen |
| H14 | Abnahme: Vorschau-Link öffnet auf Handy und PC | **nicht prüfbar** | kein Link (H7). Echtes iPhone-Safari und echtes Android nicht verfügbar. Nur Chromium-Emulation |
| H15 | Abnahme: alle Tests grün | bestanden (Stand der Entwickler) | Build/Lint/Unit/E2E grün. Der neue QA-Test ist auf `android` rot und dokumentiert B1 |
| I1 | Keine Geheimnisse im Repo/Browser | bestanden | `git ls-files` ohne `.env`. Grep nach `service_role`, `eyJhbGciOi`, `sk-…`, `api_key=`, Private Keys: keine Treffer (auch nicht in `dist/`). `.gitignore` schließt `.env*` aus |
| I2 | Keine hartcodierten UI-Texte (alles über `t()`) | bestanden | Alle sichtbaren Texte laufen über `t()`: `main.ts:11`, `fullscreen.ts:10`, `TestbeckenScene.ts:193–195`, `PreloadScene.ts:22`. Einzige Ausnahme ist das Symbol `⛶` (Icon mit `aria-label`). `throw new Error(...)` sind nur Entwicklermeldungen |
| I3 | i18n de/en vollständig | bestanden | 373/373 Schlüssel, keine fehlen, keine leer. Unit-Test `tests/unit/i18n.test.ts` grün. Browser: Locale de-DE → „Testbecken: Sonnenspiegelsee · 20 Fische“, en-US → „Test tank: Sunmirror Lake · 20 fish“ (`docs/qa/phase-0/de-desktop-1280x720.png`) |
| I4 | Zahlen in Daten | bestanden, Hinweis | Fisch-, Welt-, Wetter- und Bossphasenwerte stehen in `Data/*.csv`, die Bildraten in der Atlas-JSON `meta.clips`. Nur die Testszene hat eigene Konstanten (`TEST_SPEED`, `SKY_SHARE`) → K4 |
| I5 | `docs/platzhalter.md` | bestanden | listet Sprites, Bosse, Schillernd, Schrift, Hintergrund, Texte, Sounds, PWA |
| I8 | `docs/lizenzen.md` | bestanden | Phaser, Zod, Tools, Pillow, eigene Sprites |
| G6.9 R6 | Sprites, Silhouette, Emission, Schillernd-LUT | teilweise | Frames, Silhouette und Emission sind vollständig. **Schillernd-LUT fehlt.** Sie steht aber offen in `platzhalter.md` (Phase 1) |
| G6.9 R7 | Spawn-Simulation | nicht geprüft (geplant) | `it.todo`, braucht die Spawn-Funktion aus Phase 1 |

## 3. Daten und Validator

### 3.1 Vollabgleich `Data/fish.csv` ↔ Teil E (alle 100 Zeilen, Skript `docs/qa/phase-0/skripte/cmp.py`)
Geprüft wurden: Name, Seltenheit, Boss, Größenklasse und Canvas, Länge min/max, Tiefe min/max, Zeit, „(Pflicht)“ vorhanden, Hauptverhalten, Verhalten nach dem Pfeil, K, Punkte und Echt/Fantasie.
Ergebnis: **0 echte Abweichungen.** Das Skript meldete nur drei Fehlalarme: `Aufbläher` heißt im Enum `Aufblaeher` (Regel: ohne Umlaute), und bei F036 ist „Abend (Pflicht)“ korrekt als `zeit=Abend` umgesetzt.

### 3.2 Stichproben von Hand (14 Fische, alle Welten, 5 Bosse)
| Fisch | Spec Teil E | CSV | OK |
|---|---|---|---|
| F002 Flussbarsch | G · S 32×16 · 10–35 cm · 2–10 m · Tag · Sonnig/Bewölkt · Zappler K3 · 15 | Gewoehnlich, S, 32x16, 10–35, 2–10, Tag, bevorzugt Sonnig\|Bewoelkt, Zappler, 3, 15 | ✓ |
| F017 Glühwürmchen-Barsch | S · M · 15–30 · 0–5 · Nacht · kein Regen (Pflicht) · Zickzack K4 · 180 | Selten, M 64x32, Nacht, Pflicht Sonnig\|Bewoelkt\|Nebel, Zickzack 4, 180, leuchtet 1 | ✓ |
| **F020 Barnabas (Boss)** | Boss 256×128 · 220–300 · 15–25 · Nacht · Gewitter oder Vollmond (Pflicht) · Sprinter→Versteckspieler→Springer K8 · 1000 | Legendaer, boss 1, 256x128, 220–300, 15–25, Nacht, `pflicht_oder=Gewitter\|Vollmond`, Sprinter + Phasen Sprinter/Versteckspieler/Springer, 8, 1000 | ✓ |
| F033 Zuckerwatte-Seepferdchen | U · M · 8–18 · 0–8 · Tag · Sonnig · Ruhig, grüne Zone −30 % · K1 · 100 | Ruhig, `zone_mod=-0.3`, 1, 100 | ✓ |
| F036 Mandarinfisch | S · S · 5–7 · 5–12 · Abend (Pflicht) · Zickzack K2 · 200 | zeit=Abend, Zickzack 2, 200 | ✓ |
| F039 Korallendrache | E · XL · Nacht · Korallenblüte (oder Regen bei Flut) (Pflicht) · Versteckspieler K6 · 600 | `pflicht_oder=Korallenbluete\|Regen+Flut` | ✓ |
| **F040 Coralina (Boss)** | Boss · Spannweite 500–700 · 30–50 · Abend/Nacht · Vollmond oder Flut (Pflicht) · K8 · 1500 | Abend\|Nacht, `Vollmond\|Flut`, 4 Phasen, 8, 1500 | ✓ (Phase 3 „Ruhig“ ergänzt, siehe entscheidungen.md) |
| F052 Lachs | U · L · Morgen · Regen · Springer K5 · 120 | bevorzugt Regen → Validator-Warnung (W3 hat kein Regenwetter) | ✓ (Spec-Widerspruch, dokumentiert) |
| F057 Polarlicht-Neon | S · M · Nacht · Polarlicht (Pflicht) · Zickzack K3 · 320 | `ereignis_pflicht=Polarlicht`, leuchtet 1 | ✓ |
| **F060 Grimmbart (Boss)** | Boss · 500–700 · 50–70 · Nacht · Schneesturm (Pflicht) · K9 · 2000 | wetter_pflicht Schneesturm, 4 Phasen, 9, 2000 | ✓ |
| F073 Sternenstaub-Sardine | U · S · 1.000–3.000 · Biolumineszenz-Welle (Pflicht) · Sprinter K2 · 170 | 1000–3000, `BiolumineszenzWelle`, 2, 170 | ✓ |
| **F080 Lumina (Boss)** | Boss · 400–600 · 6.000–11.000 · Schwarzer-Raucher (Pflicht) · K9 · 2500 | wie 6.6-Beispielzeile, k 0.03, 4 Phasen | ✓ |
| F093 Magma-Muräne | U · L · 80–160 · 40–55 · Nacht · Versteckspieler + Hitzkopf K6 · 210 | Versteckspieler, 6, 210 (Hitzkopf über die Magmakammer-Regel, dokumentiert) | ✓ |
| **F100 Ignaris (Boss)** | Boss · 800–1.200 · 55–60 · Nacht · Großer Ausbruch (Pflicht) · K10 · 3000 | `GrosserAusbruch`, 10, 3000, 4 Phasen | ✓ |

### 3.3 Kaputte CSV bricht den Build ab (Kopie im Scratchpad, Original per md5 unverändert)
Für jeden Fall: Repo-Kopie ohne `.git` anlegen, `node_modules` verlinken, eine Zeile in `Data/fish.csv` beschädigen, dann `npm run build`.
| Fall | Exit | Meldung |
|---|---|---|
| Seltenheit `Superselten` (F014) | 1 | `FEHLER F014: fish.csv: seltenheit Invalid option …` · `✗ 4 Fehler – nichts geschrieben.` |
| doppelte ID (F015→F014) | 1 | `FEHLER F014: ID 2× vergeben` |
| Zeile abgeschnitten (20 von 48 Spalten) | 1 | `CsvError: Invalid Record Length: columns length is 48, got 20 on line 6` (Stacktrace statt sauberer Meldung → K2) |
| `punkte` leer (F003) | 1 | `FEHLER F003: fish.csv: punkte Pflichtfeld ist leer` |
| Zeile gelöscht (F050) | 1 | `FEHLER W3: 19 Fische statt 20`, `4× Ungewoehnlich statt 5` |
| `kraft=11` (F020) | 1 | `FEHLER F020: fish.csv: kraft Too big: expected number to be <=10` |
Danach: `md5sum -c` → alle `Data/*.csv` und `public/data/*.json` OK. `git status` zeigt keine Änderung an Spieldaten.

## 4. Pixel-Perfect im echten Browser (Chromium/Playwright)

Skript: `docs/qa/phase-0/skripte/pp.cjs` (Screenshots) und `grid.py` (Pillow). Rohdaten: `docs/qa/phase-0/browser-results.json`, `grid-check.txt`.
Für die Rasterprüfung wurde das HTML-Overlay (Systemschrift, Knopf) ausgeblendet. Bewertet wurde nur der Canvas (`raster/*-ohne-overlay.png`).

| Profil | DPR | Canvas intern | Zoom (Gerät) | Canvas in Gerätepx | `image-rendering` | Fische | Konsolenfehler | Bewegung a→b | Raster n×n |
|---|---|---|---|---|---|---|---|---|---|
| Desktop 1280×720 | 1 | 640×360 | 2 | 1280×720 @ (0,0) | pixelated | 20 | 0 | 11,2 % Pixel geändert | **exakt** (0 von 229 401 Blöcken, 0 von 21 936 Läufen falsch) |
| Desktop 1920×1080 | 1 | 640×360 | 3 | 1920×1080 @ (0,0) | pixelated | 20 | 0 | 11,3 % | **exakt** |
| Desktop 1366×768 @1,25 | 1,25 | 640×360 | 2 | 1280×720 @ (213,75 / 120) | pixelated | 20 | 0 | 6,3 % | innen exakt. Nur die linke Randspalte ist halb belegt (Kante, K3) |
| iPhone 13 hoch | 3 | 360×640 | 3 | 1080×1920 @ (45/36) | pixelated | 20 | 0 | 8,5 % | **exakt** |
| iPhone 13 quer | 3 | 640×360 | 2 | **1279,97**×720 @ (485,02/153) | pixelated | 20 | 0 | 4,5 % | **nicht exakt**: 87 von 21 941 Läufen (0,40 %) ungerade |
| Pixel 7 hoch | 2,625 | 360×640 | 3 | **1079,98×1919,98** @ (0,74/141,18) | pixelated | 20 | 0 | 8,5 % | **nicht exakt**: 91 von 24 577 (0,37 %) |
| Pixel 7 quer | 2,625 | 640×360 | 2 | **1279,97×719,99** @ (492,68/112,51) | pixelated | 20 | 0 | 4,9 % | **nicht exakt**: 164 von 21 532 (0,76 %) |

- **Scharf, keine Weichzeichnung:** Im Canvas gibt es auf allen Profilen 250–257 Farben, also keine Mischfarben durch Filterung. Die Sichtprüfung der Screenshots bestätigt das: harte Kanten, Outline sichtbar.
- **Bewegung:** Die Screenshots `-a` und `-b` (1 s Abstand) unterscheiden sich deutlich. Die Fische haben die Position gewechselt (z. B. Barnabas, Wels, Koi in `desktop-1280x720-a/-b.png`). Alle Clips im Atlas haben unterschiedliche Frames (geprüft für see und tiefe).
- **Zoom 2 = exakt 2×2:** Desktop 1280×720 mit DPR 1 hat 0 uneinheitliche 2×2-Blöcke. Alle Farb-Läufe sind gerade lang.
- **Ursache B1, bestätigt durch Gegenprobe:** Ein ganzzahliger Versatz behebt es nicht. Mit Canvas oben links bei (0,0) gibt es auf dem Pixel 7 weiterhin 198 falsche Läufe. Ursache ist die **CSS-Größe**: 360 × (3/2,625) = 411,43 px lässt sich im Layout nicht exakt darstellen (Browser rechnen in 1/64 px). Deshalb wird der Canvas auf 1079,98 statt 1080 Gerätepixel skaliert, und bei Nearest-Sampling fällt hier und da eine Spalte schmaler oder breiter aus.
- Screenshots (alle angesehen): `docs/qa/phase-0/desktop-1280x720-a.png`, `-b.png`, `desktop-1920x1080-a.png`, `desktop-1366x768-dpr1.25-a.png`, `iphone13-hoch-a.png`, `iphone13-quer-a.png`, `pixel7-hoch-a.png`, `pixel7-quer-a.png`, `de-desktop-1280x720.png`, `de-pixel7-hoch.png`. Ausschnitte 5×: `raster/detail-desktop-1280.png`, `raster/detail-pixel7-quer.png`.
- Drehen hoch → quer: Der bestehende E2E-Test ist auf iPhone und Android grün (Canvas wechselt auf 640×360).
- WebGL-Warnung „GPU stall due to ReadPixels“ kommt nur auf Desktop 1280 vor. Sie stammt von SwiftShader beim Screenshot und nicht vom Spiel.

## 5. Sprites und Atlanten

- 5 Atlanten (`see` 2048×1024, `riff` 2048×1024, `fjord`/`tiefe`/`grotte` 2048×2048), alle RGBA, Alpha nur 0/255. `meta.padding = 2`, `meta.extrude = 1`, gemessener Mindestabstand zwischen Frames 4 px (= 2 + 2×1). `meta.clips = {swim:10, idle:6, struggle:14, caught:8}` passt zu F5.
- Eigenes Prüfskript `skripte/atlas.py` mit 0 Fehlern. Jeder der 100 Fische hat swim (6, Größe S: 4), idle 4, struggle 4, caught 3 und silhouette_0, alle in Canvasgröße der Klasse. emission_0 haben alle 29 leuchtenden Fische (W1: 2, W3: 2, W4: 13, W5: 12). Es gibt keine überzähligen Frames.
- `check.py`: 100/100 OK (Canvas, Rand ≥ 2 px, Alpha binär, Farbanzahl ≤ 12/16/24, kein #000, genau 1 weißes Pixel, gen.json). Bewusst noch nicht geprüft (laut Skript erst mit `qa.py` in Phase 4): Weltpalette, Lichtprobe, IoU.
- Kontaktbogen `art_src/contact/see_contact.png`, angesehen: Alle 20 Fische lesbar auf hellem und dunklem Grund, mit klaren Silhouetten, Outline und Schuppenraster ab L. Platzhalter-Qualität, siehe K5.

## 6. Struktur

- B2-Ordner liegen lokal vor: `src/{core,game,scenes,net,ui,audio,data,i18n}`, `public/{assets/fish,assets/worlds,assets/ui,audio,data}`, `supabase/{migrations,functions}`, `tools/art`, `art_src`, `tests/{unit,e2e}`, `docs` (jetzt mit `qa/`). `docs/balancing.md` ist erst für Phase 5 vorgesehen.
- 8 Agenten-Dateien mit Frontmatter `name`, `description`, `tools`. `CLAUDE.md` mit Befehlen.

## Bugliste

### Kritisch
Keine.

### Mittel
**B1 – Pixelraster nicht exakt n×n, wenn die Canvas-CSS-Größe gebrochen ist** (B3)
- Ort: `src/core/pixelScale.ts:33` (`cssZoom = deviceZoom / dpr`) und `src/main.ts:34/47` (`zoom`/`setZoom(cssZoom)`). Die CSS-Breite des Canvas (z. B. 411,43 px, 426,67 px) ist nicht exakt darstellbar. Der Browser skaliert deshalb 360 → 1079,98 Gerätepixel.
- Reproduktion: `npx playwright test tests/e2e/qa-pixelraster.spec.ts --project=android` → `407 von 114445 Läufen kein Vielfaches von 3`. Oder `node docs/qa/phase-0/skripte/pp.cjs && python3 docs/qa/phase-0/skripte/grid.py` → Pixel 7 hoch/quer und iPhone quer haben ungerade Läufe.
- Wirkung: Einzelne Spielpixel-Spalten und -Zeilen sind 1 Gerätepixel schmaler oder breiter. Es gibt keine Unschärfe. Bei feinen Mustern (Bayer-Dither, Schuppen) kann es leicht flimmern, wenn Fische sich bewegen.
- Vorschlag [ungeprüft]: Den Canvas-Backbuffer in Gerätepixeln anlegen (640·n × 360·n, Kamera-Zoom n) und seine Größe über `ResizeObserver` mit `devicePixelContentBoxSize` exakt an die echte Gerätepixelgröße koppeln. Dann zeichnet der Browser 1:1 und skaliert nicht mehr. Alternativ den Zoom nur so wählen, dass `base × deviceZoom / dpr` ein Vielfaches von 1/64 px ergibt. Den Test `qa-pixelraster.spec.ts` als Regressionstest behalten.
- Testlücke: `tests/e2e/testbecken.spec.ts:39` (`toBeCloseTo(…, 1)`) erlaubt ±0,05 CSS-px und kann diesen Fehler deshalb nicht finden.

**M1 – Kein Vorschau-Link / Hosting nicht verbunden** (Teil H Phase 0, Abnahme)
- Ort: `docs/hosting.md`. Die Anleitung ist da, der Link fehlt.
- Wirkung: Der Abnahmepunkt „Vorschau-Link öffnet auf Handy und PC“ ist offen. Echte Geräte (iPhone-Safari, Android-Chrome) sind nicht geprüft.
- Nötig: Der Nutzer verbindet Cloudflare Pages, danach Test auf echtem Handy.

### Klein
**K1 – Leere B2-Ordner sind nicht in Git.** `src/game`, `src/net`, `src/audio`, `supabase/migrations`, `supabase/functions`, `public/audio`, `public/assets/worlds`, `public/assets/ui` gibt es nur lokal. Reproduktion: `git ls-files src/game supabase public/audio` → leer. Ein frischer Klon (Hosting, neue Sitzung) hat sie nicht. Vorschlag: `.gitkeep` anlegen.

**K2 – Abgeschnittene CSV-Zeile liefert einen Stacktrace statt einer roten Fehlermeldung.** `tools/build-data.ts:30` (`parse(...)` ohne try/catch). Der Build bricht zwar richtig ab (Exit 1), die Meldung entspricht aber nicht dem Format „FEHLER <ID>: …“ aus 6.9. Reproduktion: Eine Zeile in einer Kopie von `fish.csv` auf 20 Spalten kürzen und `npm run data` ausführen.

**K3 – Bei gebrochenem CSS-Versatz ist die Randspalte halb belegt** (Desktop 1366×768 @1,25: Canvas bei x = 213,75 Gerätepx, die linke Spielpixelspalte ist uneinheitlich, 286 Blöcke). Die Ursache ist die Zentrierung per Flexbox. Der Effekt ist nur am Rand sichtbar. Vorschlag: Versatz auf ganze Gerätepixel runden.

**K4 – Zahlen im Code der Testszene.** `src/scenes/TestbeckenScene.ts:13–14` (`TEST_SPEED`, `SKY_SHARE`). Für eine reine Testszene ist das vertretbar. Wenn die Werte in die echte Welt-Szene übernommen werden, gehören sie nach `Data/`.

**K5 – Platzhalter-Optik einzelner Fische** (Kontaktbogen `see`): F020 Barnabas wirkt eher wie ein Knochenhecht mit Stachelkrone als wie ein „Riesenhecht“. F010 Zander hat ein auffällig großes, helles Auge. F018 Wels hat eine lange Bartel, die wie ein Bein wirkt. Das ist als Platzhalter dokumentiert (`platzhalter.md`, F8.5 Bosse von Hand → Phase 4). Hier nur zur Kenntnis.

**K6 – Testszene: Fische überlappen sich stark, Wassergrund = Randfarbe.** `TestbeckenScene.ts:148` und `:59`: Die tiefste Verlaufsfarbe ist gleich der Randfarbe. Im Hochformat sieht es deshalb aus, als schwimme die Regenbogenforelle im Rand (`iphone13-hoch-a.png` unten). `__KK.fishOnScreen` zählt erzeugte Sprites und prüft keine Sichtbarkeit (`tests/e2e/testbecken.spec.ts:23`). Für Phase 0 ist das unkritisch.

**K7 – Schillernd-LUT fehlt (G 6.9 Regel 6), Spawn-Simulation (Regel 7) ist `todo`.** Beides ist in `platzhalter.md` bzw. im Test als Phase 1 vermerkt, also bekannt und offen.

## Nicht prüfbar
- Vorschau-Link, feste Adresse und Branch-Links (kein Hosting verbunden).
- Echtes iPhone-Safari (WebKit). Getestet wurde nur Chromium mit iPhone-Profil. Safari rechnet mit eigener Layout-Rundung, B1 kann dort anders ausfallen.
- Echtes Android-Gerät, Firefox, Touch-Gefühl, 60 FPS (ist ohnehin Phase 5).

## Vom QA-Prüfer angelegte Dateien
- `tests/e2e/qa-pixelraster.spec.ts`: Regressionstest für B1. Er läuft mit `npm run test:e2e`, ist aktuell auf `android` rot und wird grün, wenn B1 behoben ist.
- `docs/qa/phase-0/`: Screenshots, `browser-results.json`, `grid-check.txt`, `raster/`, `skripte/` (pp.cjs, grid.py, cmp.py, atlas.py, de.cjs).
