# Platzhalter
- Testszene (TestScene) ersetzt später Hafen/Welt.

## Daten Phase 0 (Fische, `Data/fish.csv`, `Data/boss_phases.csv`)
Alle Werte stammen aus Spec E 5 und G 6.6/6.7. Was dort fehlt, ist leer (Standardwert greift) oder hier vermerkt.
- **k (Gewichtsfaktor):** nur F001 (0.012), F014 (0.009), F017 (0.013), F080 (0.03) stehen in den Spec-Beispielzeilen. Alle anderen leer = Standard 0.011.
- **Lexikon-Texte (`lexikon_text`):** nur dort gefüllt, wo die Spec einen Text nennt (Zitate „Lexikon: …“ in E 5, plus F001/F014/F017/F080 aus den Beispielen G 6). Rest leer.
- **Hinweis-Texte (`hinweis_text`):** alle 100 leer, die Spec liefert nur gekürzte Beispiele („Gesichtet“-Hinweise offen).
- **Englisch (`src/i18n/en.json`):** alle Schlüssel leer, Übersetzung offen (Fallback Deutsch).
- **Köder (`koeder_mag`/`koeder_mag_nicht`):** je Fisch nicht in E 5. Gesetzt nur für F001, F014, F017, F080 (Beispielzeilen) und F089/F096 (K11 Kristallköder, aus „Zeit · Wetter: Kristallköder“). Rest leer.
- **Zupfer:** nur F001/F014/F017/F080 aus Beispielen, sonst Standard 0-2.
- **Schwarmgröße:** nur F005 (3-6) genannt. F023, F042, F061, F073, F084 sind laut Text Schwarm-/Gruppenfische, Größe offen (schwarm = 0).
- **Zonen (Ufer/Freiwasser/Kante):** nur F017 in der Spec. Hinweise in Klammern („Seerosen“, „Grund“, „Riffkante“ …) sind nicht übernommen, alle Standard `Alle`.
- **Scheinbisse:** abgeleitet, `1` bei Hauptverhalten Trickser (Schema-Kommentar „Trickser / Täuschlichter“).
- **Zahnfisch:** aus dem Text „Zahnfisch.“ der Beschreibung, F080 laut Beispielzeile.
- **Leuchtet (Emissionsmaske):** aus der Beschreibung abgeleitet (Leuchtorgane/Glut), bitte prüfen: 017, 057, 060–063, 065, 067, 068, 071–074, 076, 079, 080, 083, 084, 086, 090, 091, 093–095, 097–100.
- **ODER-Bedingungen** lassen sich in einer Spalte nicht abbilden, daher nur als „bevorzugt“ eingetragen (keine Pflicht): F020 (Gewitter oder Vollmond), F039 (Korallenblüte oder Regen bei Flut, nur Korallenblüte eingetragen), F040 (Vollmond oder Flut, nur Vollmond eingetragen). Schema-Erweiterung nötig.
- **Wetter „Eisnebel“** (F058) ist als `Nebel` eingetragen (generischer Wetter-Schlüssel).
- **Kombiverhalten** mit „+“ (F093 Versteckspieler + Hitzkopf; Boss F080/F100) sind nicht als Wechsel erfassbar: nur Hauptverhalten gesetzt, Rest in `boss_phases.csv` bzw. offen (F093 `Hitzkopf` fehlt).
- **Bossphasen:** Phasen, HP-Grenzen, Namen und Spezial aus Teil C. `ansage_de` nur für F020 (alle 3) und F080 Phase 1 (Spec-Beispiele). Leere `verhalten` bei F040 Ph. 3, F060 Ph. 2/4, F100 Ph. 2/4 (nur Spezialmechanik beschrieben). `kraft` nur wo genannt (F020, F040 Ph. 1, F060 Ph. 1, F080 Ph. 1, F100 Ph. 1), sonst Standard 8. F080 Ph. 3 Spezial `Keine`.
- **Zweitsprites** (aufgeblasen, Segel hoch, Kiefer vor: F029, F038, F075, F092) sind in `FishData.altSprite` nicht gesetzt, Flag fehlt im CSV-Format.
- **Asset-Keys:** nur `fish_NNN_swim_0..5` und `luts/fish_NNN_shiny.png` stammen aus der Spec. `struggle` (2 Frames), `catch`, `sil`, `emit` sind angenommene Namen.
- **Validator:** Regeln 2 (Welttiefen), 5 (Wetter/Ereignisse je Welt), 6 (Atlas/Sprites) und 7 (Spawn-Simulation) fehlen, bis `worlds.csv`, Atlas und Spawn-Code existieren.
- **Abhängigkeiten:** Spec nennt `zod` und `csv-parse`, im Projekt nicht installiert. Eigener Mini-Parser (`src/data/csv.ts`, `schema.ts`). Node-Typen fehlen, `src/data/node-shims.d.ts` ersetzt sie. `prebuild`-Hook (`npm run data && vitest run`) nicht gesetzt (package.json bewusst unberührt).
